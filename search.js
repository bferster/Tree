// search.js
// ---------------------------------------------------------------------------
// Search — tree-driven, on-demand retrieval of primary-source mentions that may
// refer to a person in the researcher's tree. Implements Search.md.
//
//   search.scan(curTree, personId)                -> coverage across all sources
//   search.find(curTree, personId, { source })    -> ranked candidates in one source
//   search.findBatch(curTree, personIds, {source})-> jointly resolve several
//                                                     tree persons against one
//                                                     source (cross-support +
//                                                     collision detection)
//
// Nothing here writes isSameAs to the tree/assertion store - that's still the
// caller's job. accept()/reject() emit assertion rows for the caller to
// persist, but they DO feed this Search instance's own in-session state right
// away: addAssertion() re-wires the surname bridge, and _recordOutcome() banks
// a labeled feature vector so this.match's calibration (Match.fitCalibration/
// probability) sharpens as researchers confirm or reject candidates.
//
// DEPENDS ON match.js (class Match). Scoring is delegated to Match.MatchPerson;
// this file supplies the person profile, the kin set, the constraints, and the
// retrieval. Two boosts that Match does not model (enslaver holding fit and
// nameless age-sex cohort fit) are applied here as residual-gap boosts on the
// returned score, so match.js needs no modification.
//
// WHY STAGE 1 IS NOT OPTIONAL
//   curTree stores attributes as "value:mention_id" ("Crawford:AUG-CN-1870-4795").
//   Match._birthYear/_gender/_race/_birthPlace/_normOccupation already split on
//   ':' and are safe. The NAME fields are not:
//       Match.normUpper("Crawford:AUG-CN-1870-4795") -> "CRAWFORDAUGCN"
//       range("1835:AUG-CN-1870-4795")               -> [1835, 4795]
//   Every object handed to Match must be dereferenced first.
//
// No external dependencies beyond match.js.
// ---------------------------------------------------------------------------

(function (global) {
	'use strict';

	// -----------------------------------------------------------------------
	// SOURCE TYPES
	// Reliability drives Lever B sigma (Search.md Stage 1). Add rows as new
	// source types are ingested; unknown types fall back to MEDIUM.
	// -----------------------------------------------------------------------
	var SOURCE_TYPES = {
		CN:  { label: 'Census',                reliability: 'SOFT',    schedule: false, roster: true  },
		SS:  { label: 'Slave Schedule',        reliability: 'SOFTEST', schedule: true,  roster: true  },
		VR:  { label: 'Vital Records',         reliability: 'HARD',    schedule: false, roster: false },
		DR:  { label: 'Death Records',         reliability: 'HARD',    schedule: false, roster: false },
		DE:  { label: 'Death Records',         reliability: 'HARD',    schedule: false, roster: false },
		FG:  { label: 'Find A Grave',          reliability: 'HARD',    schedule: false, roster: false },
		FBR: { label: 'Free Black Register',   reliability: 'MEDIUM',  schedule: false, roster: false },
		FL:  { label: "Freedmen's List",       reliability: 'MEDIUM',  schedule: false, roster: false },
		CH:  { label: 'Church',                reliability: 'MEDIUM',  schedule: false, roster: false },
		CF:  { label: 'Cohabitation Family',   reliability: 'MEDIUM',  schedule: false, roster: true  },
		CC:  { label: 'Cohabitation Child',    reliability: 'MEDIUM',  schedule: false, roster: true  },
		MN:  { label: 'Mentions / Narrative',  reliability: 'SOFTEST', schedule: false, roster: false }
	};

	// Birth profiles by the softest reliability present in the pair.
	var BIRTH_PROFILES = {
		HARD:    { sigma: 1.5, knockout: 8  },
		MEDIUM:  { sigma: 2.5, knockout: 10 },
		SOFT:    { sigma: 3.0, knockout: 12 },
		SOFTEST: { sigma: 3.5, knockout: 12 }
	};
	var RELIABILITY_RANK = { HARD: 0, MEDIUM: 1, SOFT: 2, SOFTEST: 3 };

	// Sources that constrain rather than corroborate. Fetched automatically
	// before every FIND (Search.md Stage 4) instead of being searched.
	var CONSTRAINT_TYPES = ['VR', 'DR', 'FG'];

	// Source types whose isSpouseOf start_year is an actual marriage DATE, and
	// so may exclude a spouse from earlier years (see _marriageYear). A census
	// or cohabitation-register date is an upper bound on the marriage, not the
	// marriage itself, so neither belongs here. Vital records do.
	var MARRIAGE_DATE_TYPES = ['VR'];

	// Kin imputation weights (Search.md Stage 2).
	var KIN_WEIGHTS = {
		isSpouseOf:       { hops: 1, weight: 1.0 },
		isParentOf:       { hops: 1, weight: 1.0 },
		isChildOf:        { hops: 1, weight: 1.0 },
		wasEnslavedBy:    { hops: 1, weight: 1.0 },
		isEnslaverOf:     { hops: 1, weight: 1.0 },
		isSiblingOf:      { hops: 2, weight: 0.8 },
		isGrandParentOf:  { hops: 2, weight: 0.5 },
		isGrandChildOf:   { hops: 2, weight: 0.5 }
	};

	// curTree stores the predicate from the OTHER person's point of view.
	// "isChildOf:P002" on Jinnie means Jinnie isChildOf P002, so from P002 the
	// relation is isParentOf. Explicit map; never string-manipulate.
	var INVERSE = {
		isChildOf:            'isParentOf',
		isParentOf:           'isChildOf',
		isSpouseOf:           'isSpouseOf',
		isSiblingOf:          'isSiblingOf',
		isEnslaverOf:         'wasEnslavedBy',
		wasEnslavedBy:        'isEnslaverOf',
		isGrandParentOf:      'isGrandChildOf',
		isGrandChildOf:       'isGrandParentOf',
		isHousemateOf:        'isHousemateOf',
		isNeighborOf:         'isNeighborOf'
	};

	var DEFAULTS = {
		maxCandidates:     800,
		floor:             0.35,
		ceiling:           0.80,
		limit:             50,
		maxHops:           2,
		birthBucket:       5,
		birthTolerance:    10,   // buckets scanned either side of the window
		verityMax:         4,
		ungroundedWeight:  0.3,  // kin with no mention in the target source-year
		householdBoost:    0.6,
		enslaverBoost:     0.45, // residual-gap boost when holding profile fits
		proximityBoost:    0.35, // residual-gap boost for enumeration nearness
		proximityWindow:   40,   // enumeration lines within which nearness counts
		cohortBoost:       0.40, // residual-gap boost for nameless age-sex fit
		minMotherAge:      13,
		maxMotherAge:      50,
		minFatherAge:      14,
		maxFatherAge:      70,
		provisional:       true, // run the constraint-source pre-pass
		provisionalFloor:  0.80, // score a constraint hit must clear
		provisionalMargin: 0.10, // and how far it must beat the runner-up
		provisionalSpread: 2,    // disagreement (years) that voids the ceiling
		// Calibration feedback loop (see accept()/reject()/_maybeRefitCalibration).
		calibMinSamples:   20,  // total labeled pairs required before first fit
		calibMinPerClass:  5,   // accepts AND rejects required before first fit
		calibRefitEvery:   5    // refit after this many new labels accrue
	};

	var MENTION_ID_RE = /^[A-Za-z]{2,5}[-_][A-Za-z0-9]{2,5}[-_]\d{3,4}[-_][\w.]+$/;

	// =======================================================================
	// SMALL HELPERS
	// =======================================================================

	function isPresent(v) {
		if (v === null || v === undefined) return false;
		var s = String(v).trim();
		return s !== '' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined';
	}

	function upper(s) {
		return isPresent(s) ? String(s).trim().toUpperCase().replace(/[^A-Z]/g, '') : '';
	}

	function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

	function toInt(v) {
		var n = parseInt(String(v == null ? '' : v).trim(), 10);
		return Number.isFinite(n) ? n : null;
	}

	// Residual-gap boost. Raises a score toward 1 without ever dragging it,
	// same shape as Match's household boost.
	function boost(score, beta, strength) {
		if (!(strength > 0)) return score;
		return score + beta * strength * (1 - score);
	}

	// -----------------------------------------------------------------------
	// STAGE 1 helper: split "value:mention_id" into value + provenance.
	// Splits at the FIRST ':' only when the tail looks like a mention id, so a
	// value that legitimately contains a colon is left intact.
	// -----------------------------------------------------------------------
	function deref(raw) {
		if (!isPresent(raw)) return { value: '', source: null };
		var s = String(raw).trim();
		var i = s.indexOf(':');
		if (i < 0) return { value: s, source: null };
		var head = s.slice(0, i).trim();
		var tail = s.slice(i + 1).trim();
		if (MENTION_ID_RE.test(tail)) return { value: head, source: tail };
		return { value: s, source: null };
	}

	// Parse a mention_id or source string into its parts.
	// "AUG-CN-1870-4795" -> { county:'AUG', type:'CN', year:1870, seq:'4795' }
	function parseId(id) {
		if (!isPresent(id)) return null;
		var parts = String(id).trim().split(/[-_]/);
		if (parts.length < 3) return null;
		var year = toInt(parts[2]);
		if (year == null) return null;
		return {
			county: parts[0].toUpperCase(),
			type:   parts[1].toUpperCase(),
			year:   year,
			seq:    parts.slice(3).join('-'),
			source: parts[0].toUpperCase() + '-' + parts[1].toUpperCase() + '-' + year
		};
	}

	function sourceInfo(type) {
		return SOURCE_TYPES[type] || { label: type || 'Unknown', reliability: 'MEDIUM', schedule: false, roster: false };
	}

	// The FB blocking key must use the same given-name token match.js compares
	// on (_classifyGiven takes the first token). normUpper strips whitespace, so
	// keying the whole value turns "MARTHA J" into MARTHAJ and it never collides
	// with MARTHA - the record is unreachable through FB no matter how it is
	// scored. 1,378 AUG mentions carry a multi-token norm_first_name and 1,343
	// of those have a first token that already exists as a simple form, so this
	// is the retrieval half of the same defect. Index and query both use this.
	function givenKey(v) {
		if (!isPresent(v)) return '';
		var parts = String(v).trim().split(/[\s.]+/).filter(Boolean);
		return parts.length ? upper(parts[0]) : '';
	}

	function bucketOf(year, size) {
		if (year == null) return null;
		return Math.floor(year / size) * size;
	}

	// =======================================================================
	// SEARCH
	// =======================================================================

	function Search(config) {
		config = config || {};

		var MatchCls = config.MatchClass ||
			(typeof global !== 'undefined' && global.Match) ||
			(typeof Match !== 'undefined' ? Match : null);
		if (!MatchCls && !config.match) {
			throw new Error('search.js requires match.js (class Match) to be loaded first');
		}

		this.opts       = Object.assign({}, DEFAULTS, config.opts || {});
		this.mentions   = config.mentions || [];
		this.assertions = config.assertions || [];
		this.bridges    = config.bridges || null;   // optional precomputed household bridges
		this.match      = config.match || new MatchCls(config.matchConfig || {});
		this.MatchClass = MatchCls || this.match.constructor;

		// Calibration feedback loop (Stage 6a below). Rows are either produced
		// by accept()/reject() during this session or supplied up front via
		// config.calibrationSeed (e.g. a prior human-reviewed sample), in the
		// same {features|res, label} shape Match.fitCalibration accepts.
		this._calibLog = (config.calibrationSeed || []).slice();
		this._calibLogAtLastFit = 0;

		this._index();
		this._wireRarity();
		this._wireSurnameBridge();
		this._maybeRefitCalibration();
	}

	// -----------------------------------------------------------------------
	// INDEXING
	// -----------------------------------------------------------------------

	Search.prototype._index = function () {
		var i, m, id, key, parsed;

		this.byId        = new Map();   // mention_id -> mention
		this.bySource    = new Map();   // "AUG-CN-1870" -> [mentions]
		this.byHh        = new Map();   // "AUG-CN-1870|FC1870-829" -> [mentions]
		this.sources     = new Map();   // "AUG-CN-1870" -> { source, county, type, year, count }
		this.block       = { L: new Map(), N: new Map(), F: new Map(), M: new Map(), FB: new Map() };

		for (i = 0; i < this.mentions.length; i++) {
			m = this.mentions[i];
			if (!m) continue;
			id = m.mention_id;
			if (!isPresent(id)) continue;

			this.byId.set(id, m);

			parsed = parseId(id);
			var src = isPresent(m.source) ? String(m.source).trim() : (parsed ? parsed.source : '');
			if (!src) continue;

			m._type = parsed ? parsed.type : '';
			m._year = toInt(m.source_year) != null ? toInt(m.source_year) : (parsed ? parsed.year : null);
			m._hh   = this.hhKey(m);

			push(this.bySource, src, m);
			if (m._hh) push(this.byHh, src + '|' + m._hh, m);

			if (!this.sources.has(src)) {
				this.sources.set(src, {
					source: src,
					county: parsed ? parsed.county : '',
					type:   m._type,
					year:   m._year,
					label:  sourceInfo(m._type).label,
					count:  0
				});
			}
			this.sources.get(src).count++;

			this._addBlockKeys(m);
		}

		function push(map, k, v) {
			var a = map.get(k);
			if (!a) { a = []; map.set(k, a); }
			a.push(v);
		}
	};

	// hhKey per Census2Census: 1850/1860 populate household_id, 1870/1880
	// populate only family_id. Without the fallback Lever C scores zero for
	// every 1870/1880 pass.
	Search.prototype.hhKey = function (m) {
		var h = isPresent(m.household_id) ? String(m.household_id).trim() : '';
		if (h) return h;
		return isPresent(m.family_id) ? String(m.family_id).trim() : '';
	};

	Search.prototype._addBlockKeys = function (m) {
		var B = this.block, self = this;

		var last = upper(m.last_name);
		if (last) add(B.L, last, m);

		var ny = upper(m.nysiis_last_name);
		if (ny) add(B.N, ny, m);

		var full = isPresent(m.full_name)
			? String(m.full_name).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
			: '';
		if (full) add(B.F, full, m);

		if (isPresent(m.metaphone_last_name)) {
			String(m.metaphone_last_name).toUpperCase().split(':').forEach(function (code) {
				var c = code.replace(/[^A-Z]/g, '');
				if (c) add(B.M, c, m);
			});
		}

		var first = givenKey(isPresent(m.norm_first_name) ? m.norm_first_name : m.first_name);
		var by = toInt(m.birth_year);
		if (first && by != null) {
			add(B.FB, first + '|' + bucketOf(by, self.opts.birthBucket), m);
		}

		function add(map, k, v) {
			var a = map.get(k);
			if (!a) { a = []; map.set(k, a); }
			a.push(v);
		}
	};

	// Rarity is judged against the pool (score.md), so frequencies come from the
	// full corpus. Pass config.frequencyScope = 'source' to scope per source.
	Search.prototype._wireRarity = function () {
		this.match.usePool(this.mentions);
	};

	// Surname bridge: two surnames count as bridged when an assertion connects
	// them (hasNameVariant, or a marriage/spouse link across the two names).
	Search.prototype._computeSurnameVariants = function () {
		var self = this;
		var variants = new Map();   // UPPER surname -> Set of UPPER surnames

		function link(a, b) {
			if (!a || !b || a === b) return;
			if (!variants.has(a)) variants.set(a, new Set());
			if (!variants.has(b)) variants.set(b, new Set());
			variants.get(a).add(b);
			variants.get(b).add(a);
		}

		(this.assertions || []).forEach(function (a) {
			if (!a) return;
			// hasNameVariant ONLY. Building the class from isSpouseOf as well
			// links Crawford<->Scott because some Crawford married some Scott,
			// which collapses most of the county into one surname class and
			// floods retrieval. Spouse-surname bridging is a per-pair question,
			// handled in the scorer, not a global equivalence.
			var p = String(a.predicate || '').trim();
			if (p !== 'hasNameVariant') return;
			var s = self.byId.get(a.subject_id), o = self.byId.get(a.object_id);
			if (!s || !o) return;
			link(upper(s.last_name), upper(o.last_name));
		});

		return variants;
	};

	Search.prototype._wireSurnameBridge = function () {
		var self = this;
		this._surnameVariants = this._computeSurnameVariants();

		// Reads self._surnameVariants at call time (not a captured local), so
		// refreshSurnameBridge() below can swap the Map in place and every
		// retrieval from then on sees the update without re-wiring the closure.
		this.match.setSurnameBridge(function (x, y) {
			var lx = upper(x && x.last_name), ly = upper(y && y.last_name);
			if (!lx || !ly) return false;
			var set = self._surnameVariants.get(lx);
			return !!(set && set.has(ly));
		});
	};

	// Recompute the surname-variant map from the current this.assertions.
	// personEditor.js keeps one Search instance alive for a whole session
	// (window.app.search), so a hasNameVariant assertion added mid-session -
	// via addAssertion() below, including the ones accept()/reject() record -
	// would otherwise never reach retrieval until the page reloaded.
	Search.prototype.refreshSurnameBridge = function () {
		this._surnameVariants = this._computeSurnameVariants();
	};

	// =======================================================================
	// STAGE 1 — DEREFERENCE, VALIDATE, BUILD PROFILE
	// =======================================================================

	Search.prototype.buildProfile = function (curTree, personId) {
		var self = this;
		var person = (curTree.persons || []).filter(function (p) { return p.person_id === personId; })[0];
		if (!person) throw new Error('buildProfile: no person ' + personId + ' in tree');

		var issues = [];
		var fields = ['first_name', 'middle_name', 'last_name', 'suffix', 'birth_year',
		              'death_year', 'gender', 'race', 'occupation', 'birth_place'];

		// 1a. Dereference the stored values and validate each against its source.
		var attested = {};   // field -> [{ value, source, type, reliability, verified }]
		fields.forEach(function (f) { attested[f] = []; });

		fields.forEach(function (f) {
			var d = deref(person[f]);
			if (!isPresent(d.value)) return;
			var rec = { value: d.value, source: d.source, type: null, reliability: 'MEDIUM', verified: null };
			if (d.source) {
				var m = self.byId.get(d.source);
				if (!m) {
					issues.push({ field: f, source: d.source, problem: 'MENTION_NOT_FOUND' });
					return;   // do not search on a value no source backs
				}
				rec.type = m._type;
				rec.reliability = sourceInfo(m._type).reliability;
				rec.verified = self._fieldAgrees(f, d.value, m);
				if (rec.verified === false) {
					issues.push({
						field: f, source: d.source, problem: 'VALUE_NOT_IN_SOURCE',
						stored: d.value, actual: self._fieldOf(f, m)
					});
					return;
				}
			}
			attested[f].push(rec);
		});

		// 1b. Rebuild every field from ALL linked mentions, not the one stored
		// value. Attributes are multi-valued across sources and curTree keeps one.
		var linked = (person.mentions || []).filter(function (id) { return self.byId.has(id); });
		linked.forEach(function (id) {
			var m = self.byId.get(id);
			fields.forEach(function (f) {
				var v = self._fieldOf(f, m);
				if (!isPresent(v)) return;
				// Dedupe on source AND value, not source alone. When a tree
				// field cites a mention ("Arch:AUG-CN-1880-24520") the 1a pass
				// already registered that source, so a source-only check
				// discards what the mention actually says ("Archy") and the
				// second spelling never becomes an attestation. That is the
				// input _nameVariants needs, and it is also what makes the
				// CONFLICTING_ATTESTATIONS report below able to see the
				// disagreement at all.
				var already = attested[f].some(function (r) {
					return r.source === id && upper(r.value) === upper(v);
				});
				if (already) return;
				attested[f].push({
					value: String(v).trim(), source: id, type: m._type,
					reliability: sourceInfo(m._type).reliability, verified: true
				});
			});
		});

		// 1c. Birth window across all attestations, plus death ceiling.
		var birthYears = attested.birth_year
			.map(function (r) { return toInt(r.value); })
			.filter(function (y) { return y != null; });
		var birthWindow = birthYears.length
			? [Math.min.apply(null, birthYears), Math.max.apply(null, birthYears)]
			: null;

		var deathYears = attested.death_year
			.map(function (r) { return toInt(r.value); })
			.filter(function (y) { return y != null; });
		var deathCeiling = deathYears.length ? Math.min.apply(null, deathYears) : null;

		// Conflicting attestations are reported, not silently resolved.
		Object.keys(attested).forEach(function (f) {
			var vals = {};
			attested[f].forEach(function (r) { vals[String(r.value).trim().toUpperCase()] = true; });
			var distinct = Object.keys(vals);
			if (distinct.length > 1 && f !== 'birth_year' && f !== 'death_year') {
				issues.push({
					field: f, problem: 'CONFLICTING_ATTESTATIONS',
					values: attested[f].map(function (r) { return r.value + '@' + (r.source || 'tree'); })
				});
			}
		});

		// Softest reliability present drives Lever B sigma.
		var rel = 'HARD';
		attested.birth_year.forEach(function (r) {
			if (RELIABILITY_RANK[r.reliability] > RELIABILITY_RANK[rel]) rel = r.reliability;
		});
		if (!attested.birth_year.length) rel = 'SOFT';

		return {
			person_id:      personId,
			tree_person:    person,
			attested:       attested,
			mentions:       linked,
			birthWindow:    birthWindow,
			birthReliability: rel,
			deathCeiling:   deathCeiling,
			verity:         toInt(person.verity),
			isEnslaver:     person.isEnslaver === true,
			issues:         issues,
			// A Match-ready object: plain values only, birth as a range string
			// so Match's range() reads it as a window.
			asMatchObject:  this._matchObject(attested, birthWindow, deathCeiling)
		};
	};

	Search.prototype._fieldOf = function (f, m) {
		if (f === 'birth_place') return m.birth_place != null ? m.birth_place : m.norm_birth_place;
		return m[f];
	};

	Search.prototype._fieldAgrees = function (f, value, m) {
		var actual = this._fieldOf(f, m);
		if (!isPresent(actual)) return null;   // source silent, cannot verify
		var a = String(actual).trim().toUpperCase();
		var b = String(value).trim().toUpperCase();
		if (a === b) return true;
		if (f === 'birth_year' || f === 'death_year') return toInt(a) === toInt(b);
		// Names: tolerate the source carrying a fuller form.
		if (a.indexOf(b) === 0 || b.indexOf(a) === 0) return true;
		return false;
	};

	// Pick the modal attested value rather than the first. When sources
	// disagree (the tree says Cyrus, the cited mention says Thomas Farr) the
	// most-attested value wins and the disagreement is reported, instead of one
	// arbitrary source silently renaming the person.
	Search.prototype._modal = function (list) {
		if (!list || !list.length) return '';
		var counts = new Map(), order = [];
		list.forEach(function (r) {
			var k = String(r.value).trim();
			if (!counts.has(k)) { counts.set(k, { n: 0, rel: r.reliability }); order.push(k); }
			counts.get(k).n++;
			if (RELIABILITY_RANK[r.reliability] < RELIABILITY_RANK[counts.get(k).rel]) {
				counts.get(k).rel = r.reliability;
			}
		});
		order.sort(function (a, b) {
			var ca = counts.get(a), cb = counts.get(b);
			if (ca.n !== cb.n) return cb.n - ca.n;
			return RELIABILITY_RANK[ca.rel] - RELIABILITY_RANK[cb.rel];
		});
		return order[0];
	};

	Search.prototype._matchObject = function (attested, birthWindow, deathCeiling) {
		var self = this;
		function best(list) { return self._modal(list); }

		var first = best(attested.first_name);
		var last  = best(attested.last_name);
		var mid   = best(attested.middle_name);

		var obj = {
			first_name:   first,
			middle_name:  mid,
			last_name:    last,
			full_name:    [first, mid, last].filter(Boolean).join(' '),
			gender:       best(attested.gender),
			race:         best(attested.race),
			occupation:   best(attested.occupation),
			birth_place:  best(attested.birth_place),
			// Range string. Match.range() pulls all 3-4 digit runs and takes
			// min/max, so "1835-1840" becomes the window [1835, 1840].
			birth_year:   birthWindow ? (birthWindow[0] === birthWindow[1]
			                ? String(birthWindow[0])
			                : birthWindow[0] + '-' + birthWindow[1]) : '',
			death_year:   deathCeiling != null ? String(deathCeiling) : ''
		};

		// Phonetic keys for Match's surname cascade. Reuse a linked mention's
		// precomputed codes, but only from a mention that agrees on the field
		// being copied. The surname-gated block below must not also carry
		// norm_first_name: _modal() may pick "Arch" as the given name while the
		// mention it copies from says "Archy", and the two normalize
		// differently (ARCHIBALD vs ARCHY), so the normalized given name ends
		// up describing a spelling the object does not have.
		var lastRec = attested.last_name[0];
		if (lastRec && lastRec.source) {
			var m = this.byId.get(lastRec.source);
			if (m && upper(m.last_name) === upper(last)) {
				obj.nysiis_last_name    = m.nysiis_last_name;
				obj.metaphone_last_name = m.metaphone_last_name;
				obj.norm_race           = m.norm_race;
				obj.norm_occupation     = m.norm_occupation;
			}
		}
		// norm_first_name comes only from a mention carrying the chosen given name.
		var firstRec = null;
		attested.first_name.forEach(function (r) {
			if (!firstRec && r.source && upper(r.value) === upper(first)) firstRec = r;
		});
		if (firstRec) {
			var fm = this.byId.get(firstRec.source);
			if (fm && upper(fm.first_name) === upper(first)) obj.norm_first_name = fm.norm_first_name;
		}
		return obj;
	};

	// Every distinct name spelling attested for this person. A person
	// accumulates spellings across sources ("Arch" in the 1870 census, "Archy"
	// in 1880) and Normalize.md's nickname table does not always collapse them:
	// in AUG, Archibald/Arch/Archie all map to ARCHIBALD (166 mentions) but
	// Archy -> ARCHY, Archd -> ARCHD, Archabald -> ARCHABALD are each left
	// alone. Two spellings of one man then never compare equal on the given
	// name, the rung falls to SURNAME_ONLY, and an EXACT_FULLNAME pair scores
	// as though only the surname matched. Scoring every attested variant and
	// keeping the best makes the result independent of which spelling happens
	// to be modal, and of gaps in the nickname table. Fixing the table is still
	// worth doing; this stops the search depending on it.
	Search.prototype._nameVariants = function (profile) {
		var self = this, seen = new Set(), out = [];
		var base = profile.asMatchObject;
		var firsts = profile.attested.first_name.map(function (r) { return r.value; });
		var lasts  = profile.attested.last_name.map(function (r) { return r.value; });
		if (!firsts.length) firsts = [base.first_name];
		if (!lasts.length)  lasts  = [base.last_name];

		firsts.forEach(function (f) {
			lasts.forEach(function (l) {
				var key = upper(f) + '|' + upper(l);
				if (seen.has(key)) return;
				seen.add(key);
				var v = Object.assign({}, base, {
					first_name: f, last_name: l,
					full_name: [f, base.middle_name, l].filter(Boolean).join(' ')
				});
				// Re-derive normalized/phonetic keys from a mention that
				// actually carries this spelling, rather than inheriting the
				// modal object's keys.
				delete v.norm_first_name; delete v.nysiis_last_name; delete v.metaphone_last_name;
				profile.mentions.forEach(function (id) {
					var m = self.byId.get(id);
					if (!m) return;
					if (!v.norm_first_name && upper(m.first_name) === upper(f)) {
						v.norm_first_name = m.norm_first_name;
					}
					if (!v.nysiis_last_name && upper(m.last_name) === upper(l)) {
						v.nysiis_last_name    = m.nysiis_last_name;
						v.metaphone_last_name = m.metaphone_last_name;
					}
				});
				out.push(v);
			});
		});
		return out;
	};

	// Cached per profile object; profiles are rebuilt per find()/round anyway.
	Search.prototype._variantsFor = function (profile) {
		if (!profile._variants) profile._variants = this._nameVariants(profile);
		return profile._variants;
	};

	// =======================================================================
	// STAGE 2 — EGO-CENTRIC NORMALIZATION
	// =======================================================================

	Search.prototype.buildKin = function (curTree, personId) {
		var self = this;
		var persons = curTree.persons || [];
		var byPid = new Map();
		persons.forEach(function (p) { byPid.set(p.person_id, p); });

		// 2a. Read the stored single-anchor edges into a bidirectional graph.
		// curTree.relationships[] is currently unused; read it too if populated.
		var edges = new Map();   // pid -> [{ to, predicate }]
		function edge(from, to, predicate) {
			if (!from || !to || !predicate) return;
			if (!edges.has(from)) edges.set(from, []);
			edges.get(from).push({ to: to, predicate: predicate });
		}

		persons.forEach(function (p) {
			if (!isPresent(p.anchor)) return;
			var bits = String(p.anchor).split(':');
			var pred = bits[0].trim();
			var target = bits.slice(1).join(':').trim();
			if (!byPid.has(target)) return;
			edge(p.person_id, target, pred);                 // p  --pred--> target
			var inv = INVERSE[pred];
			if (inv) edge(target, p.person_id, inv);          // target --inv--> p
		});

		(curTree.relationships || []).forEach(function (r) {
			if (!r) return;
			var pred, target;
			if (typeof r === 'string') {
				var bits = r.split(':');
				pred = bits[0].trim(); target = bits.slice(1).join(':').trim();
			} else {
				pred = r.predicate; target = r.object_id || r.object;
			}
			if (!r.subject_id && typeof r === 'string') return;
			var subj = (typeof r === 'object') ? (r.subject_id || r.subject) : null;
			if (!subj || !byPid.has(subj) || !byPid.has(target)) return;
			edge(subj, target, pred);
			if (INVERSE[pred]) edge(target, subj, INVERSE[pred]);
		});

		// 2b. Impute. Capped at maxHops.
		var out = new Map();   // pid -> kin record
		function record(pid, predicate, hops, weightScale) {
			if (pid === personId) return;
			var spec = KIN_WEIGHTS[predicate] || { hops: hops, weight: 0.4 };
			var w = spec.weight * (weightScale == null ? 1 : weightScale);
			var prev = out.get(pid);
			if (prev && prev.baseWeight >= w) return;
			out.set(pid, {
				person_id:  pid,
				predicate:  predicate,
				hops:       hops,
				baseWeight: w,
				imputed:    hops > 1
			});
		}

		(edges.get(personId) || []).forEach(function (e) { record(e.to, e.predicate, 1); });

		// Siblings: anyone sharing an anchor parent with the target.
		var myParents = (edges.get(personId) || [])
			.filter(function (e) { return e.predicate === 'isChildOf'; })
			.map(function (e) { return e.to; });
		myParents.forEach(function (par) {
			(edges.get(par) || []).forEach(function (e) {
				if (e.predicate === 'isParentOf') record(e.to, 'isSiblingOf', 2);
			});
		});

		// Step-parents: my parent's spouse is my parent too (Search.md Stage 2,
		// "spouse of parent -> isParentOf"). Single-anchor storage links Jinnie
		// only to P002, never to P002's spouse Martha, so this has to be
		// imputed from the child's side as well as the parent's side (the
		// mirror case, spouse's children becoming the parent's, is below).
		var myStepParents = [];
		myParents.forEach(function (par) {
			(edges.get(par) || []).forEach(function (e) {
				if (e.predicate !== 'isSpouseOf') return;
				if (!self._plausibleParent(byPid.get(e.to), byPid.get(personId))) return;
				record(e.to, 'isChildOf', 2, 0.6);
				myStepParents.push(e.to);
			});
		});

		// Step-siblings: a step-parent's other children (Search.md Stage 2,
		// "spouse's other children -> isSiblingOf, weight 0.5"). isSiblingOf's
		// base weight is 0.8, so scale to 0.5 rather than adding a new entry
		// to KIN_WEIGHTS just for this path.
		myStepParents.forEach(function (sp) {
			(edges.get(sp) || []).forEach(function (e) {
				if (e.predicate === 'isParentOf' && e.to !== personId) {
					record(e.to, 'isSiblingOf', 2, 0.625);   // 0.8 * 0.625 = 0.5
				}
			});
		});

		// Spouse's children become the target's children, and the target's
		// children become the spouse's, subject to the plausibility gate.
		var mySpouses = (edges.get(personId) || [])
			.filter(function (e) { return e.predicate === 'isSpouseOf'; })
			.map(function (e) { return e.to; });
		mySpouses.forEach(function (sp) {
			(edges.get(sp) || []).forEach(function (e) {
				if (e.predicate !== 'isParentOf') return;
				if (!self._plausibleParent(byPid.get(personId), byPid.get(e.to))) return;
				record(e.to, 'isParentOf', 2, 0.6);
			});
		});

		// Grandparents.
		myParents.forEach(function (par) {
			(edges.get(par) || []).forEach(function (e) {
				if (e.predicate === 'isChildOf') record(e.to, 'isGrandChildOf', 2);
			});
		});

		// 2c. Attach profiles and weights.
		var kin = [];
		out.forEach(function (rec) {
			var p = byPid.get(rec.person_id);
			if (!p) return;
			if (rec.hops > self.opts.maxHops) return;
			var prof;
			try { prof = self.buildProfile(curTree, rec.person_id); }
			catch (err) { return; }
			var verity = toInt(p.verity);
			rec.verityScale = verity != null ? clamp(verity / self.opts.verityMax, 0.25, 1) : 0.5;
			rec.profile = prof;
			rec.isEnslaver = p.isEnslaver === true || rec.predicate === 'wasEnslavedBy';
			kin.push(rec);
		});

		return kin;
	};

	// Plausibility gate on imputed parenthood (Search.md Stage 2). Outside the
	// window the link is a hypothesis for the researcher, not a search input.
	Search.prototype._plausibleParent = function (parentPerson, childPerson) {
		if (!parentPerson || !childPerson) return false;
		var py = toInt(deref(parentPerson.birth_year).value);
		var cy = toInt(deref(childPerson.birth_year).value);
		if (py == null || cy == null) return true;   // cannot judge, allow
		var age = cy - py;
		var g = upper(deref(parentPerson.gender).value);
		var lo = (g === 'F') ? this.opts.minMotherAge : this.opts.minFatherAge;
		var hi = (g === 'F') ? this.opts.maxMotherAge : this.opts.maxFatherAge;
		return age >= lo && age <= hi;
	};

	// =======================================================================
	// STAGE 3 — TIME SLICE
	// =======================================================================

	// tentative (optional): Map<person_id, mention> of NOT-YET-ACCEPTED grounding
	// hypotheses, supplied by findBatch() when it jointly resolves several tree
	// persons against the same source-year. A kin member with no confirmed
	// mention yet but a strong provisional pick from an earlier batch round can
	// still ground household/proximity/cohort support for the rest of the
	// batch. Single-person scan()/find() calls omit it and behave as before.
	Search.prototype.timeSlice = function (kin, year, targetSource, egoMentions, tentative) {
		var self = this;
		if (year == null) return kin.slice();

		return kin.filter(function (k) {
			var w = k.profile.birthWindow;
			if (w && w[0] > year) return false;                    // not yet born
			if (k.profile.deathCeiling != null && k.profile.deathCeiling < year) return false;
			if (k.predicate === 'isSpouseOf') {
				var married = self._marriageYear(egoMentions, k.profile.mentions);
				if (married != null && married > year) return false;   // marriage postdates the year
			}
			return true;
		}).map(function (k) {
			var c = Object.assign({}, k);

			// Grounded: does this relative hold a confirmed mention in the
			// target source-year? Ungrounded kin are hints, not evidence.
			c.groundedMention = null;
			for (var i = 0; i < k.profile.mentions.length; i++) {
				var m = self.byId.get(k.profile.mentions[i]);
				if (m && m.source === targetSource) { c.groundedMention = m; break; }
			}
			if (!c.groundedMention && tentative && tentative.has(k.person_id)) {
				var tm = tentative.get(k.person_id);
				if (tm && tm.source === targetSource) c.groundedMention = tm;
			}
			c.grounded = !!c.groundedMention;

			// Co-residence expectation. Only 'expected' kin count against a
			// candidate when absent.
			c.coresidence = self._coresidence(k, year);

			c.weight = c.baseWeight * c.verityScale * (c.grounded ? 1.0 : self.opts.ungroundedWeight);
			return c;
		});
	};

	// Marriage year for an isSpouseOf pair, read from mention-level assertions
	// (assertion subject_id/object_id are mention_ids, not person_ids - see
	// _wireSurnameBridge above and ExpandAssertions.md). Earliest start_year
	// found on any assertion linking either side's mentions wins. Returns null
	// when no such assertion exists, in which case the spouse is never dropped
	// on marriage-year grounds (curTree carries no marriage date otherwise).
	//
	// ONLY assertions from sources that RECORD a marriage date count. A census
	// isSpouseOf carries start_year = the enumeration year, because that is
	// when the couple was observed living as married - not when they married.
	// Of the 4,646 isSpouseOf rows in AUG, every one comes from a census (3,773)
	// or a cohabitation register (873), so reading start_year as the marriage
	// date makes every couple look newly wed in whichever year they were first
	// enumerated. Arch and Martha Crawford are enumerated together in 1880, so
	// a literal reading drops Martha's spouse from every pre-1880 search - and
	// with him the household, proximity and Lever C support that finding her in
	// 1870 depends on. Her true 1870 record fell from rank 1 to rank 2 behind
	// an unrelated Martha Crawford purely from this.
	//
	// An enumeration year is an UPPER bound on the marriage ("married by then"),
	// so it must not exclude the spouse from earlier years. Cohabitation
	// registers are worse than neutral here: they record couples formalizing
	// unions that predate emancipation, so their date is the registration, not
	// the marriage.
	Search.prototype._marriageYear = function (egoMentions, spouseMentions) {
		if (!egoMentions || !spouseMentions || !egoMentions.length || !spouseMentions.length) return null;
		var a = new Set(egoMentions), b = new Set(spouseMentions);
		var best = null;
		(this.assertions || []).forEach(function (r) {
			if (!r || String(r.predicate).trim() !== 'isSpouseOf') return;
			var hit = (a.has(r.subject_id) && b.has(r.object_id)) || (a.has(r.object_id) && b.has(r.subject_id));
			if (!hit) return;
			if (!MARRIAGE_DATE_TYPES.length) return;
			var src = parseId(r.subject_id) || parseId(r.object_id);
			if (!src || MARRIAGE_DATE_TYPES.indexOf(src.type) < 0) return;
			var y = toInt(r.start_year);
			if (y != null && (best == null || y < best)) best = y;
		});
		return best;
	};

	Search.prototype._coresidence = function (k, year) {
		var w = k.profile.birthWindow;
		var age = w ? year - w[1] : null;
		if (k.predicate === 'isSpouseOf') return 'EXPECTED';
		if (k.predicate === 'isParentOf') {
			if (age == null) return 'UNKNOWN';
			return age < 18 ? 'EXPECTED' : 'NOT_EXPECTED';
		}
		if (k.predicate === 'isChildOf') return 'UNKNOWN';   // target may have left home
		if (k.predicate === 'wasEnslavedBy') return 'NOT_EXPECTED';
		return 'UNKNOWN';
	};

	// =======================================================================
	// STAGE 4 — CONSTRAINTS
	// =======================================================================

	Search.prototype.buildConstraints = function (curTree, profile, kin, target) {
		var self = this;

		// Automatic constraint fetch: death year from VR/DR/FG, whether or not
		// the tree carries one. curTree has no death years at all in practice.
		var fetched = this._fetchConstraints(profile);
		var deathCeiling = profile.deathCeiling;
		if (fetched.deathYear != null && (deathCeiling == null || fetched.deathYear < deathCeiling)) {
			deathCeiling = fetched.deathYear;
		}

		// Exclusions.
		var excluded = new Set();
		var reasons = new Map();
		function exclude(id, why) {
			if (!isPresent(id)) return;
			excluded.add(id);
			if (!reasons.has(id)) reasons.set(id, why);
		}

		// Already linked to this person, or to ANY person in the tree.
		(curTree.persons || []).forEach(function (p) {
			(p.mentions || []).forEach(function (id) {
				exclude(id, p.person_id === profile.person_id ? 'ALREADY_LINKED' : 'CLAIMED_BY_' + p.person_id);
			});
		});

		// Rejections previously recorded on the person.
		(profile.tree_person.rejected || []).forEach(function (id) { exclude(id, 'REJECTED'); });

		// isNotSameAs assertions against any of this person's mentions.
		var mine = new Set(profile.mentions);
		(this.assertions || []).forEach(function (a) {
			if (!a || String(a.predicate).trim() !== 'isNotSameAs') return;
			if (mine.has(a.subject_id)) exclude(a.object_id, 'IS_NOT_SAME_AS');
			if (mine.has(a.object_id))  exclude(a.subject_id, 'IS_NOT_SAME_AS');
		});

		// One appearance per source-year. If the person already holds a
		// confirmed mention in the target source, that source is closed.
		var closed = null;
		if (target && target.source) {
			for (var i = 0; i < profile.mentions.length; i++) {
				var m = this.byId.get(profile.mentions[i]);
				if (m && m.source === target.source) { closed = m.mention_id; break; }
			}
		}

		return {
			gender:        upper(profile.asMatchObject.gender),
			raceClass:     this._raceClass(profile.asMatchObject.race),
			birthWindow:   profile.birthWindow,
			deathCeiling:  deathCeiling,
			deathSource:   fetched.deathSource,
			excluded:      excluded,
			exclusionReasons: reasons,
			closedBy:      closed,
			applied:       []
		};
	};

	// -----------------------------------------------------------------------
	// PROVISIONAL CONSTRAINTS
	// _fetchConstraints below only reads mentions the researcher has ALREADY
	// accepted, so an unlinked record constrains nothing: AUG-VR-1162 (Martha
	// Crawford, b.1840 d.1883) sits in the corpus scoring 0.857 against her
	// with no rival, and until someone links it by hand it has no effect on any
	// search. This pre-pass searches the constraint sources (VR / DR / FG)
	// directly and returns an unambiguous top hit.
	//
	// Provisional constraints WARN; they never knock out. A death ceiling only
	// ever REMOVES candidates, so acting on an unconfirmed one makes the true
	// match disappear with no explanation the researcher can see. Confirmed
	// evidence closes a search; provisional evidence flags it and returns the
	// candidates anyway, with the offending mention_id and score attached so it
	// can be accepted or rejected - at which point it becomes a real constraint
	// through the ordinary path.
	//
	// Cached per (person, tree-state) for the life of one scan/find/findBatch
	// call; findBatch re-scores the same people over several rounds and must
	// not re-run this each time.
	Search.prototype.provisionalConstraints = function (curTree, personId, opts) {
		opts = opts || {};
		if (this._inProvisional) return null;                    // recursion guard
		if (opts.provisional === false || !this.opts.provisional) return null;

		if (this._provCache && this._provCache.has(personId)) return this._provCache.get(personId);

		var self = this;
		var floor  = opts.provisionalFloor  != null ? opts.provisionalFloor  : this.opts.provisionalFloor;
		var margin = opts.provisionalMargin != null ? opts.provisionalMargin : this.opts.provisionalMargin;

		var result = null;
		try {
			var profile = this.buildProfile(curTree, personId);
			var held = new Set();
			profile.mentions.forEach(function (id) {
				var m = self.byId.get(id);
				if (m) held.add(m.source);
			});

			var found = [];
			this._inProvisional = true;
			try {
				this.sources.forEach(function (info) {
					if (CONSTRAINT_TYPES.indexOf(info.type) < 0) return;
					if (held.has(info.source)) return;   // accepted already: not provisional
					var r;
					try {
						r = self.find(curTree, personId, {
							source: info.source, floor: floor, limit: 2, provisional: false
						});
					} catch (e) { return; }
					if (r.closed || !r.candidates.length) return;
					var top = r.candidates[0];
					if (top.score < floor) return;
					// Unambiguous only. Two close candidates means neither is usable.
					if (r.candidates.length > 1 && (top.score - r.candidates[1].score) < margin) return;
					var d = toInt(top.mention.death_year);
					if (d == null) return;
					found.push({
						deathYear: d, source: info.source, mention_id: top.mention_id,
						name: top.mention.full_name, score: +top.score.toFixed(3),
						margin: top.margin, provisional: true
					});
				});
			} finally {
				this._inProvisional = false;
			}

			if (found.length) {
				found.sort(function (a, b) { return a.deathYear - b.deathYear; });
				var spread = found[found.length - 1].deathYear - found[0].deathYear;
				result = (found.length > 1 && spread > this.opts.provisionalSpread)
					? { conflict: true, candidates: found }
					: found[0];
			}
		} catch (err) { result = null; }

		if (this._provCache) this._provCache.set(personId, result);
		return result;
	};

	// Provisional lookups are cached only for the duration of one public call,
	// so an accept() between calls is always reflected.
	Search.prototype._beginProvCache = function () {
		if (this._provDepth == null) this._provDepth = 0;
		if (this._provDepth === 0) this._provCache = new Map();
		this._provDepth++;
	};
	Search.prototype._endProvCache = function () {
		this._provDepth = Math.max(0, (this._provDepth || 1) - 1);
		if (this._provDepth === 0) this._provCache = null;
	};

	// Build the warning a provisional ceiling produces for one target year.
	Search.prototype._provisionalWarning = function (provisional, year) {
		if (!provisional) return null;
		if (provisional.conflict) {
			return {
				type: 'PROVISIONAL_DEATH_CONFLICT',
				candidates: provisional.candidates,
				note: 'Constraint sources disagree on death year; no provisional ceiling applied.'
			};
		}
		if (provisional.deathYear >= year) return null;
		return {
			type: 'PROVISIONAL_DEATH_BEFORE_SOURCE',
			deathYear: provisional.deathYear,
			mention_id: provisional.mention_id,
			source: provisional.source,
			score: provisional.score,
			note: 'An unaccepted ' + provisional.source + ' record (' + provisional.mention_id +
			      ', score ' + provisional.score + ') puts death at ' + provisional.deathYear +
			      ', before ' + year + '. Candidates below are still shown. Accept or reject ' +
			      'that record to make this a real constraint.'
		};
	};

	Search.prototype._fetchConstraints = function (profile) {
		var self = this, out = { deathYear: null, deathSource: null };
		profile.mentions.forEach(function (id) {
			var m = self.byId.get(id);
			if (!m) return;
			if (CONSTRAINT_TYPES.indexOf(m._type) < 0) return;
			var d = toInt(m.death_year);
			if (d != null && (out.deathYear == null || d < out.deathYear)) {
				out.deathYear = d; out.deathSource = id;
			}
		});
		return out;
	};

	Search.prototype._raceClass = function (r) {
		var s = upper(String(r || '').split(':')[0]);
		if (!s) return '';
		if (s === 'W' || s === 'WHITE') return 'W';
		if (['B', 'BLACK', 'M', 'MU', 'MULATTO', 'NEGRO', 'COLORED'].indexOf(s) >= 0) return 'BLACK';
		return s;
	};

	// =======================================================================
	// HOUSEHOLD BRIDGES (batch, precomputed)
	// Maps source household -> target household across an adjacent census pair,
	// as WEIGHTED EDGES rather than an assignment. Seeded only from
	// conservative person-level anchors; the edges are hypotheses with
	// provenance, never isSameAs claims.
	//
	// Deliberately many-to-many. Households are not stable objects across ten
	// years: they split when children marry, merge when a widow moves in with a
	// son, and dissolve on death. Forcing one-to-one would destroy exactly the
	// cases most worth seeing, and asymmetric coverage is the signature of those
	// events rather than a defect.
	//
	// The output feeds retrieve()'s BRIDGE path. Set search.bridges to the
	// returned Map, or pass it as config.bridges.
	// =======================================================================
	Search.prototype.buildBridges = function (sourceA, sourceB, opts) {
		opts = opts || {};
		var self = this;
		var minSupport = opts.minSupport != null ? opts.minSupport : 1;
		var seedFloor  = opts.seedFloor  != null ? opts.seedFloor  : 0.80;
		var seedMargin = opts.seedMargin != null ? opts.seedMargin : 0.10;
		var edgeFloor  = opts.edgeFloor  != null ? opts.edgeFloor  : 0.25;

		var infoA = this.sources.get(sourceA), infoB = this.sources.get(sourceB);
		if (!infoA || !infoB) throw new Error('buildBridges: unknown source');

		var listA = this.bySource.get(sourceA) || [];
		var listB = this.bySource.get(sourceB) || [];

		// --- 1. household objects -------------------------------------------
		function rosters(list, src) {
			var map = new Map();
			list.forEach(function (m) {
				var hh = self.hhKey(m);
				if (!hh) return;
				if (!map.has(hh)) map.set(hh, []);
				map.get(hh).push(m);
			});
			return map;
		}
		var hhA = rosters(listA, sourceA), hhB = rosters(listB, sourceB);

		// --- 2. seed anchors, strict only -----------------------------------
		// Precision matters far more than recall here: two or three good anchors
		// establish a household, and one bad anchor drags a whole family to the
		// wrong place. Anchors are tagged seed-tier and are the ONLY thing that
		// may rebuild bridges (see the circularity note at the end).
		var indexB = new Map();   // "NYSIIS|bucket" -> [mentions]
		listB.forEach(function (m) {
			var ny = upper(m.nysiis_last_name) || upper(m.last_name);
			var by = toInt(m.birth_year);
			if (!ny || by == null) return;
			var k = ny + '|' + bucketOf(by, self.opts.birthBucket);
			if (!indexB.has(k)) indexB.set(k, []);
			indexB.get(k).push(m);
		});

		var anchors = [];
		listA.forEach(function (a) {
			var ny = upper(a.nysiis_last_name) || upper(a.last_name);
			var by = toInt(a.birth_year);
			if (!ny || by == null) return;
			var pool = [];
			for (var d = -1; d <= 1; d++) {
				var k = ny + '|' + (bucketOf(by, self.opts.birthBucket) + d * self.opts.birthBucket);
				(indexB.get(k) || []).forEach(function (m) { pool.push(m); });
			}
			if (!pool.length) return;

			var best = null, second = 0;
			pool.forEach(function (b) {
				if (Math.abs((toInt(b.birth_year) || 0) - by) > 2) return;   // strict
				var r = self.match.MatchPerson(a, b, {
					censusYear: infoB.year,
					targetSource: sourceA, candidateSource: sourceB
				});
				if (r.tier === 'KNOCKOUT') return;
				if (!best || r.score > best.score) { second = best ? best.score : second; best = { m: b, score: r.score }; }
				else if (r.score > second) second = r.score;
			});
			if (!best || best.score < seedFloor) return;
			if (best.score - second < seedMargin) return;      // ambiguous, discard
			anchors.push({ a: a, b: best.m, score: best.score, tier: 'SEED' });
		});

		// --- 3. tally votes --------------------------------------------------
		var votes = new Map();   // "hhA|hhB" -> { support, pairs[] }
		anchors.forEach(function (an) {
			var ka = self.hhKey(an.a), kb = self.hhKey(an.b);
			if (!ka || !kb) return;
			var key = ka + '||' + kb;
			if (!votes.has(key)) votes.set(key, { sourceHh: ka, targetHh: kb, support: 0, pairs: [] });
			var v = votes.get(key);
			v.support++;
			v.pairs.push({ from: an.a.mention_id, to: an.b.mention_id, score: +an.score.toFixed(3) });
		});

		// --- 4/5. score edges, keep above floor, many-to-many ----------------
		var bySrc = new Map();
		votes.forEach(function (v) {
			if (v.support < minSupport) return;
			if (!bySrc.has(v.sourceHh)) bySrc.set(v.sourceHh, []);
			bySrc.get(v.sourceHh).push(v);
		});

		var bridges = new Map();   // "sourceA|hhA" -> [edge]
		var edgeCount = 0;
		bySrc.forEach(function (list, ka) {
			var rosterA = hhA.get(ka) || [];
			var scored = list.map(function (v) {
				var rosterB = hhB.get(v.targetHh) || [];
				var covA = rosterA.length ? v.support / rosterA.length : 0;
				var covB = rosterB.length ? v.support / rosterB.length : 0;
				var headA = rosterA.filter(function (m) { return String(m.head).toLowerCase() === 't'; })[0];
				var headB = rosterB.filter(function (m) { return String(m.head).toLowerCase() === 't'; })[0];
				var headAgree = (headA && headB) ? self.match.MatchName(headA, headB) : 0;
				var score = clamp(
					0.45 * clamp(v.support / 3, 0, 1) +
					0.20 * covA + 0.20 * covB +
					0.15 * headAgree, 0, 1);
				return {
					sourceSource: sourceA, sourceHh: ka,
					targetSource: sourceB, targetHh: v.targetHh,
					support: v.support,
					coverageSource: +covA.toFixed(3), coverageTarget: +covB.toFixed(3),
					headAgree: +headAgree.toFixed(3),
					score: +score.toFixed(3),
					anchors: v.pairs, seedTier: 'SEED'
				};
			}).filter(function (e) { return e.score >= edgeFloor; });

			if (!scored.length) return;
			scored.sort(function (x, y) { return y.score - x.score; });
			var runnerUp = scored.length > 1 ? scored[1].score : 0;
			scored[0].margin = +(scored[0].score - runnerUp).toFixed(3);
			bridges.set(sourceA + '|' + ka, scored);
			edgeCount += scored.length;
		});

		// CIRCULARITY. Bridges are built from person matches and then used to
		// retrieve person matches. If a bridge-derived match were ever fed back
		// into step 2, one wrong seed would recruit the rest of a household,
		// which would then look like strong support for itself. Only SEED-tier
		// anchors (strict name, birth gap <= 2, clear margin, no bridge input)
		// are used here, and the anchor list is stored on every edge so a bridge
		// can be invalidated cheaply when a human rejects one of its anchors.
		bridges._meta = {
			sourceA: sourceA, sourceB: sourceB,
			households: hhA.size, anchors: anchors.length,
			bridged: bridges.size, edges: edgeCount, builtAt: Date.now()
		};
		return bridges;
	};

	// Build every adjacent census pair at once and merge into one Map.
	Search.prototype.buildAllBridges = function (opts) {
		var self = this, census = [];
		this.sources.forEach(function (i) { if (i.type === 'CN') census.push(i); });
		census.sort(function (a, b) { return a.year - b.year; });
		var all = new Map(), meta = [];
		for (var i = 0; i + 1 < census.length; i++) {
			var m = this.buildBridges(census[i].source, census[i + 1].source, opts);
			m.forEach(function (v, k) { all.set(k, (all.get(k) || []).concat(v)); });
			meta.push(m._meta);
		}
		all._meta = meta;
		this.bridges = all;
		return all;
	};

	// =======================================================================
	// STAGE 5 — RETRIEVAL
	// =======================================================================

	Search.prototype.retrieve = function (profile, kin, constraints, target, opts) {
		opts = opts || {};
		var self = this;
		var pool = new Map();   // mention_id -> { mention, paths:Set }

		function add(m, path) {
			if (!m || !isPresent(m.mention_id)) return;
			if (target && target.source && m.source !== target.source) return;
			if (constraints.excluded.has(m.mention_id)) return;
			var e = pool.get(m.mention_id);
			if (!e) { e = { mention: m, paths: new Set() }; pool.set(m.mention_id, e); }
			e.paths.add(path);
		}

		var o = profile.asMatchObject;

		// 1. Blocking keys.
		var last = upper(o.last_name);
		if (last) (this.block.L.get(last) || []).forEach(function (m) { add(m, 'BLOCK_L'); });

		if (o.nysiis_last_name) {
			(this.block.N.get(upper(o.nysiis_last_name)) || []).forEach(function (m) { add(m, 'BLOCK_N'); });
		}
		if (o.full_name) {
			var fk = o.full_name.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
			(this.block.F.get(fk) || []).forEach(function (m) { add(m, 'BLOCK_F'); });
		}
		if (o.metaphone_last_name) {
			String(o.metaphone_last_name).toUpperCase().split(':').forEach(function (code) {
				var c = code.replace(/[^A-Z]/g, '');
				if (c) (self.block.M.get(c) || []).forEach(function (m) { add(m, 'BLOCK_M'); });
			});
		}

		// Surname variants via hasNameVariant / spouse bridge.
		var vset = this._surnameVariants.get(last);
		if (vset) vset.forEach(function (alt) {
			(self.block.L.get(alt) || []).forEach(function (m) { add(m, 'BLOCK_VARIANT'); });
		});

		// FB — the only retrieval path that survives a surname change. Run it
		// for EVERY attested given-name spelling, not just the modal one: the
		// FB index is keyed on norm_first_name, so a person attested as both
		// "Arch" (-> ARCHIBALD) and "Archy" (-> ARCHY) is reachable under two
		// different keys and searching one of them silently drops the other.
		// This matters most for exactly the case FB exists to cover, a woman
		// whose surname changed, where FB is the only path left.
		if (profile.birthWindow) {
			var firstKeys = new Set();
			this._variantsFor(profile).forEach(function (v) {
				var k = givenKey(v.norm_first_name || v.first_name);
				if (k) firstKeys.add(k);
			});
			var k0 = givenKey(o.norm_first_name || o.first_name);
			if (k0) firstKeys.add(k0);
			var lo = profile.birthWindow[0] - this.opts.birthTolerance;
			var hi = profile.birthWindow[1] + this.opts.birthTolerance;
			firstKeys.forEach(function (fk) {
				for (var b = bucketOf(lo, self.opts.birthBucket); b <= hi; b += self.opts.birthBucket) {
					(self.block.FB.get(fk + '|' + b) || []).forEach(function (m) { add(m, 'BLOCK_FB'); });
				}
			});
		}

		// SCAN wants blocking-key retrieval only (Search.md Stage 5 intro / "SCAN
		// cheap. Blocking-key retrieval only, no lever scoring."). Household,
		// bridge, and holding expansion are comparatively expensive per-source
		// joins that FIND needs but a per-source coverage count does not.
		if (opts.blockingOnly) {
			var blockArr = Array.from(pool.values());
			return blockArr.length <= this.opts.maxCandidates
				? blockArr
				: blockArr.slice(0, this.opts.maxCandidates);
		}

		// 2. Household expansion. Strongest path when it works, and nearly free,
		// but NOT a short circuit. In the AUG demo Arch Crawford heads a family
		// of nine in 1880 and in 1870 is a lone Black farm laborer inside a
		// white Dalhouse household; expanding that household to find his wife
		// returns the wrong family entirely. One path among several.
		kin.forEach(function (k) {
			if (!k.grounded || !k.groundedMention) return;
			var hh = self.hhKey(k.groundedMention);
			if (!hh) return;
			(self.byHh.get(k.groundedMention.source + '|' + hh) || [])
				.forEach(function (m) { add(m, 'HOUSEHOLD:' + k.person_id); });
		});

		// 3. Bridge expansion from any year the person is already located in.
		if (this.bridges && target) {
			profile.mentions.forEach(function (id) {
				var m = self.byId.get(id);
				if (!m || !m._hh) return;
				var edges = self.bridges.get
					? self.bridges.get(m.source + '|' + m._hh)
					: self.bridges[m.source + '|' + m._hh];
				(edges || []).forEach(function (e) {
					if (target.source && e.targetSource !== target.source) return;
					(self.byHh.get(e.targetSource + '|' + e.targetHh) || [])
						.forEach(function (mm) { add(mm, 'BRIDGE'); });
				});
			});
		}

		// 4. Holding expansion via wasEnslavedBy.
		kin.forEach(function (k) {
			if (!k.isEnslaver) return;
			k.profile.mentions.forEach(function (id) {
				var em = self.byId.get(id);
				if (!em || !sourceInfo(em._type).schedule) return;
				var hh = self.hhKey(em);
				if (!hh) return;
				(self.byHh.get(em.source + '|' + hh) || [])
					.forEach(function (m) { add(m, 'HOLDING:' + k.person_id); });
			});
		});

		// Cap. Relational paths (household, holding, bridge) and FB are never
		// discarded to make room for surname blocks: they are the paths that
		// survive a surname change or a bad transcription, so trimming them
		// defeats the point of running them.
		var arr = Array.from(pool.values());
		if (arr.length <= this.opts.maxCandidates) return arr;

		var protectedSet = [], rest = [];
		arr.forEach(function (e) {
			(isProtected(e) ? protectedSet : rest).push(e);
		});
		// Rank the trimmable overflow by actual name fit (the same cheap check
		// scan() uses for best_rough), not by how many blocking paths happened
		// to retrieve it. A candidate found through one strong surname block is
		// a better keep than one found through three weak phonetic blocks, and
		// path-count alone can't tell those apart.
		rest.forEach(function (e) {
			e._capScore = self.match.MatchName(o, e.mention);
		});
		rest.sort(function (a, b) {
			if (a._capScore !== b._capScore) return b._capScore - a._capScore;
			return b.paths.size - a.paths.size;
		});
		var room = Math.max(0, this.opts.maxCandidates - protectedSet.length);
		return protectedSet.concat(rest.slice(0, room));

		function isProtected(e) {
			var yes = false;
			e.paths.forEach(function (p) {
				if (p.indexOf('HOUSEHOLD') === 0 || p.indexOf('HOLDING') === 0 ||
				    p === 'BRIDGE' || p === 'BLOCK_FB' || p === 'BLOCK_F') yes = true;
			});
			return yes;
		}
	};

	// =======================================================================
	// STAGE 6 — SCORING
	// =======================================================================

	Search.prototype.scoreCandidate = function (profile, kin, constraints, entry, target) {
		var self = this;
		var m = entry.mention;
		var o = profile.asMatchObject;

		// Kin objects for Lever C, dereferenced and Match-ready.
		// Kin objects are tagged with _predicate so match.js can tell a spouse
		// from a child. Without it Match._spouseContradiction never fires, since
		// only a spouse slot is single-occupancy enough to treat a different
		// occupant as evidence against.
		var personKin = kin
			.filter(function (k) { return k.coresidence !== 'NOT_EXPECTED'; })
			.map(function (k) {
				return Object.assign({}, k.profile.asMatchObject, {
					_predicate: k.predicate,
					_person_id: k.person_id,
					death_year: k.profile.deathCeiling != null ? String(k.profile.deathCeiling) : ''
				});
			});

		// Candidate's household roster.
		var hh = this.hhKey(m);
		var roster = hh ? (this.byHh.get(m.source + '|' + hh) || []).filter(function (x) { return x !== m; }) : [];

		// Birth profile from the softest reliability in the pair.
		var candRel = sourceInfo(m._type).reliability;
		var rel = RELIABILITY_RANK[candRel] > RELIABILITY_RANK[profile.birthReliability]
			? candRel : profile.birthReliability;
		var prof = BIRTH_PROFILES[rel] || BIRTH_PROFILES.SOFT;

		// BOARDER.
		// match.js now decides this itself: its corroboration gate only fires
		// when corroboration was POSSIBLE, and Match.isBoarder marks a
		// candidate living in someone else's household as a case where kin
		// absence carries no information. So no corroborationPenalty override
		// is passed from here any more - two places deciding the same thing
		// would drift. This call is for reporting in `why` only, and delegates
		// to the same static so the two can never disagree.
		var boarder = this.MatchClass && typeof this.MatchClass.isBoarder === 'function'
			? this.MatchClass.isBoarder(m, roster)
			: this._isBoarder(m, roster);

		// Score every attested name spelling and keep the best (see
		// _nameVariants). Usually one or two variants, so the cost is small.
		var variants = this._variantsFor(profile);
		var res = null, chosen = null, ko = null;
		for (var vi = 0; vi < variants.length; vi++) {
			var r = this.match.MatchPerson(variants[vi], m, {
				censusYear:        target.year,
				personKin:         personKin,
				candidateHousehold: roster,
				householdBoost:    this.opts.householdBoost,
				birthProfiles:     { CENSUS_CENSUS: prof, SCHEDULE_INVOLVED: prof },
				targetSource:      profile.mentions.length ? (this.byId.get(profile.mentions[0]) || {}).source : '',
				candidateSource:   m.source
			});
			if (r.tier === 'KNOCKOUT') { if (!ko) ko = r; continue; }
			if (!res || r.score > res.score) { res = r; chosen = variants[vi]; }
		}
		// Knockouts are demographic (gender, race, birth gap) and identical
		// across spellings, so a knockout on every variant is a real knockout.
		if (!res) return { knockout: (ko && ko.reason) || 'KNOCKOUT' };
		o = chosen;

		// NAME-DISAGREEMENT GUARD.
		// MatchPerson sets aAvailable = (rung !== 'NONE') and redistributes the
		// name weight to birth when it is false. That conflates "no name to
		// compare" with "names compared and disagreed": two fully named people
		// who share nothing but an exact birth year score 1.000 with rung NONE.
		// Absence is neutral; disagreement is negative. Drop the pair when both
		// sides carry a usable name and nothing agreed.
		// The carve-out matters: pre-1865 schedule mentions are nameless, so
		// candNamed is false there and the pair survives to be judged on the
		// holding and cohort levers instead.
		var selfNamed = isPresent(o.first_name) || isPresent(o.last_name) || isPresent(o.full_name);
		var candNamed = isPresent(m.first_name) || isPresent(m.last_name) || isPresent(m.full_name);
		if (res.why && res.why.rung === 'NONE' && selfNamed && candNamed) {
			return { knockout: 'NAME_DISAGREE' };
		}

		var score = res.score;
		var extras = {};

		// Enslaver lever. A shared enslaver is a shared location and community,
		// so it sits near Lever C rather than being a demographic filter. Scaled
		// by holding size: a 5-person holding is a tight block, a 90-person
		// holding is weak. Scored on age-sex fit because pre-1865 schedule
		// mentions are usually nameless.
		var ens = this._enslaverFit(profile, kin, m);
		if (ens.strength > 0) {
			score = boost(score, this.opts.enslaverBoost, ens.strength);
			extras.enslaver = ens;
		}

		// Nameless cohort fit. When expected co-resident kin have known ages but
		// the candidate roster has no usable names (slave schedules), score the
		// joint age-sex profile instead. Survives bad name transcription too.
		// Enumeration proximity. The enumerator walked a route, so sequence
		// distance is geography. This is the lever that separates the true
		// Martha Crawford (AUG-CN-1870-4797, the household enumerated two lines
		// after her husband's employer) from an unrelated Martha Crawford
		// elsewhere in the county with a closer birth year. Without it, a 2-year
		// birth-gap advantage outranks four corroborating children.
		var prox = this._proximityFit(kin, m);
		if (prox.strength > 0) {
			score = boost(score, this.opts.proximityBoost, prox.strength);
			extras.proximity = prox;
		}

		var cohort = this._cohortFit(kin, roster, target.year);
		if (cohort.strength > 0 && (!res.why || (res.why.family || 0) < 0.2)) {
			score = boost(score, this.opts.cohortBoost, cohort.strength);
			extras.cohort = cohort;
		}

		var why = Object.assign({}, res.why, extras, {
			variant: variants.length > 1 ? o.full_name : undefined,
			contradiction: (res.why && res.why.contradiction) || undefined,
			boarder: boarder || undefined,
			paths: Array.from(entry.paths),
			birthReliability: rel,
			sigma: prof.sigma
		});

		return {
			mention_id:  m.mention_id,
			mention:     m,
			score:       clamp(score, 0, 1),
			baseScore:   res.score,
			probability: res.probability != null ? res.probability : null,
			tier:        res.tier,
			firedLevers: res.firedLevers,
			why:         why,
			corroborators: (res.why && res.why.familyMatches) || []
		};
	};

	// Age-sex fit of the person against each enslaver's holding.
	Search.prototype._enslaverFit = function (profile, kin, candidate) {
		var self = this;
		var best = { strength: 0, holding: null, holdingSize: 0, note: '' };

		var enslavers = kin.filter(function (k) { return k.isEnslaver; });
		if (!enslavers.length) return best;

		var w = profile.birthWindow;
		var g = upper(profile.asMatchObject.gender);

		enslavers.forEach(function (k) {
			k.profile.mentions.forEach(function (id) {
				var em = self.byId.get(id);
				if (!em || !sourceInfo(em._type).schedule) return;
				var hh = self.hhKey(em);
				if (!hh) return;
				var roster = (self.byHh.get(em.source + '|' + hh) || [])
					.filter(function (x) { return x.mention_id !== em.mention_id; });
				if (!roster.length) return;

				// Does the candidate sit in this holding at all?
				var inHolding = roster.some(function (x) { return x.mention_id === candidate.mention_id; });

				// Does the person's own age-sex profile fit anyone in it?
				var fit = 0;
				roster.forEach(function (x) {
					var xg = upper(x.gender), xy = toInt(x.birth_year);
					if (g && xg && g !== xg) return;
					if (!w || xy == null) { fit = Math.max(fit, 0.4); return; }
					var gap = (xy < w[0]) ? w[0] - xy : (xy > w[1]) ? xy - w[1] : 0;
					fit = Math.max(fit, Math.exp(-(gap * gap) / (2 * 3.5 * 3.5)));
				});

				// Rarity by holding size.
				var sizeScale = clamp(6 / Math.max(roster.length, 1), 0.15, 1);
				var strength = fit * sizeScale * (inHolding ? 1 : 0.5);

				if (strength > best.strength) {
					best = {
						strength: strength,
						holding: em.mention_id,
						holdingSize: roster.length,
						profileFit: +fit.toFixed(3),
						inHolding: inHolding,
						note: inHolding ? 'candidate is in this holding' : 'holding corroborates location only'
					};
				}
			});
		});

		return best;
	};

	// Fallback only, for a match.js predating Match.isBoarder. Kept so this file
	// still runs against an older match.js; scoreCandidate prefers the static.
	Search.prototype._isBoarder = function (m, roster) {
		if (m.head === true || String(m.head).toLowerCase() === 't') return false;
		var head = null;
		for (var i = 0; i < roster.length; i++) {
			if (roster[i].head === true || String(roster[i].head).toLowerCase() === 't') {
				head = roster[i]; break;
			}
		}
		if (!head) return false;
		var a = upper(m.last_name), b = upper(head.last_name);
		if (!a || !b) return false;
		return a !== b;
	};

	// Enumeration proximity to any grounded kin mention in the same source.
	// The sequence component of a mention_id is enumeration order, so nearness
	// in sequence is nearness on the ground. Applies only within a source.
	Search.prototype._proximityFit = function (kin, candidate) {
		var self = this;
		var cp = parseId(candidate.mention_id);
		if (!cp) return { strength: 0 };
		var cSeq = toInt(cp.seq);
		if (cSeq == null) return { strength: 0 };

		var best = { strength: 0, distance: null, anchor: null };
		kin.forEach(function (k) {
			if (!k.grounded || !k.groundedMention) return;
			if (k.groundedMention.source !== candidate.source) return;
			var kp = parseId(k.groundedMention.mention_id);
			var kSeq = kp ? toInt(kp.seq) : null;
			if (kSeq == null) return;
			var d = Math.abs(cSeq - kSeq);
			if (d > self.opts.proximityWindow) return;
			// Decay across the window; adjacent lines score near 1.
			var strength = Math.exp(-(d * d) / (2 * Math.pow(self.opts.proximityWindow / 3, 2)));
			strength *= k.weight;
			if (strength > best.strength) {
				best = {
					strength: strength, distance: d,
					anchor: k.groundedMention.mention_id,
					anchor_person: k.person_id,
					note: 'enumerated ' + d + ' line(s) from ' + k.groundedMention.mention_id
				};
			}
		});
		return best;
	};

	// Joint age-sex profile of expected co-resident kin against a roster.
	// Greedy one-to-one, gender must not disagree, no name required.
	Search.prototype._cohortFit = function (kin, roster, year) {
		var expected = kin.filter(function (k) {
			return k.coresidence === 'EXPECTED' && k.profile.birthWindow;
		});
		if (expected.length < 2 || !roster.length) return { strength: 0, matched: 0, of: expected.length };

		var used = new Set(), matched = 0, quality = 0;
		expected.forEach(function (k) {
			var w = k.profile.birthWindow;
			var g = upper(k.profile.asMatchObject.gender);
			var bestQ = 0, bestIdx = -1;
			for (var i = 0; i < roster.length; i++) {
				if (used.has(i)) continue;
				var r = roster[i];
				var rg = upper(r.gender), ry = toInt(r.birth_year);
				if (g && rg && g !== rg) continue;
				if (ry == null) continue;
				var gap = (ry < w[0]) ? w[0] - ry : (ry > w[1]) ? ry - w[1] : 0;
				if (gap > 4) continue;
				var q = Math.exp(-(gap * gap) / (2 * 2.5 * 2.5));
				if (q > bestQ) { bestQ = q; bestIdx = i; }
			}
			if (bestIdx >= 0) { used.add(bestIdx); matched++; quality += bestQ; }
		});

		if (matched < 2) return { strength: 0, matched: matched, of: expected.length };

		// Noisy-OR-ish: coverage of the expected set weighted by fit quality.
		var coverage = matched / expected.length;
		var strength = clamp((quality / matched) * coverage, 0, 1);
		return { strength: strength, matched: matched, of: expected.length, coverage: +coverage.toFixed(3) };
	};

	// =======================================================================
	// STAGE 6a — CALIBRATION FEEDBACK LOOP
	// Match.fitCalibration()/probability() exist but nothing ever called them:
	// find() shipped with hand-picked floor/ceiling/boost constants and no
	// calibrated probability. accept()/reject() already produce exactly the
	// labeled pairs calibration needs, so this stage plugs them in: every
	// accept/reject re-scores the pair, banks its feature vector, and refits
	// this.match once enough labels of both kinds have accrued. From then on
	// every scoreCandidate() result carries a real res.probability (see the
	// `available` block in MatchPerson's `why`), and future work can derive
	// floor/ceiling/margin from the fitted model instead of guessing.
	// =======================================================================

	// Re-score an already-known (person, mention) pair outside of find()'s
	// per-source loop, so accept()/reject() can bank its feature vector without
	// requiring the caller to have just run find() over that source.
	Search.prototype._scorePair = function (curTree, personId, mentionId) {
		var m = this.byId.get(mentionId);
		if (!m) return null;
		var target = { source: m.source, year: m._year, type: m._type };
		var profile = this.buildProfile(curTree, personId);
		var kin = this.timeSlice(this.buildKin(curTree, personId), target.year, target.source, profile.mentions);
		var constraints = this.buildConstraints(curTree, profile, kin, target);
		var entry = { mention: m, paths: new Set(['ACCEPT_REJECT_RECOMPUTE']) };
		return this.scoreCandidate(profile, kin, constraints, entry, target);
	};

	Search.prototype._recordOutcome = function (curTree, personId, mentionId, label) {
		// Calibration bookkeeping must never break accept()/reject()'s contract.
		try {
			var res = this._scorePair(curTree, personId, mentionId);
			if (!res || res.knockout || !res.why) return;
			var features = this.match._calibFeatures(res);
			this._calibLog.push({ features: features, label: !!label, person_id: personId, mention_id: mentionId, ts: Date.now() });
			this._maybeRefitCalibration();
		} catch (err) { /* leave calibration state as it was */ }
	};

	Search.prototype._maybeRefitCalibration = function () {
		var log = this._calibLog || [];
		var n = log.length;
		if (n < this.opts.calibMinSamples) return;
		if (n - this._calibLogAtLastFit < this.opts.calibRefitEvery) return;
		var positives = 0;
		for (var i = 0; i < n; i++) if (log[i].label) positives++;
		if (positives < this.opts.calibMinPerClass || (n - positives) < this.opts.calibMinPerClass) return;
		try {
			this.match.fitCalibration(log);
			this._calibLogAtLastFit = n;
		} catch (err) { /* keep the previous fit (if any); try again next label */ }
	};

	// Turn a tree whose links a researcher has already confirmed into labeled
	// pairs. Every accepted mention is a positive; the candidates that lost to
	// it in the same source are negatives, and they are the useful ones - a
	// runner-up that scored 0.81 against a winner's 0.84 teaches the model far
	// more than a random non-match at 0.05 ever could.
	//
	// This is the bootstrap for calibration: fitCalibration needs both classes
	// and this file ships with an empty log, so probability is null and floor /
	// ceiling / margin stay hand-picked constants until something fills it.
	Search.prototype.buildCalibrationFromTree = function (curTree, opts) {
		opts = opts || {};
		var self = this, rows = [], negPer = opts.negativesPerPositive != null ? opts.negativesPerPositive : 3;

		(curTree.persons || []).forEach(function (person) {
			(person.mentions || []).forEach(function (mid) {
				var m = self.byId.get(mid);
				if (!m) return;

				// Positive: the confirmed pair.
				var pos = self._scorePair(curTree, person.person_id, mid);
				if (pos && !pos.knockout && pos.why) {
					rows.push({
						features: self.match._calibFeatures(pos), label: true,
						person_id: person.person_id, mention_id: mid, kind: 'CONFIRMED'
					});
				}

				// Negatives: near-misses in the same source. Temporarily drop
				// the accepted mention so the source reopens and its rivals can
				// be scored.
				var idx = person.mentions.indexOf(mid);
				person.mentions.splice(idx, 1);
				try {
					var r = self.find(curTree, person.person_id, {
						source: m.source, limit: negPer + 1, provisional: false
					});
					(r.candidates || []).forEach(function (c) {
						if (c.mention_id === mid || rows.length > 100000) return;
						if (rows.filter(function (x) { return x.label === false; }).length >= negPer * (rows.length + 1)) return;
						rows.push({
							features: self.match._calibFeatures(c), label: false,
							person_id: person.person_id, mention_id: c.mention_id, kind: 'RUNNER_UP'
						});
					});
				} catch (e) { /* skip */ }
				person.mentions.splice(idx, 0, mid);
			});
		});

		// Explicit rejections are the highest-value negatives: a human looked at
		// that exact pair and said no.
		(curTree.persons || []).forEach(function (person) {
			(person.rejected || []).forEach(function (mid) {
				var r = self._scorePair(curTree, person.person_id, mid);
				if (r && !r.knockout && r.why) {
					rows.push({
						features: self.match._calibFeatures(r), label: false,
						person_id: person.person_id, mention_id: mid, kind: 'REJECTED'
					});
				}
			});
		});
		return rows;
	};

	// Add labeled rows without going through accept()/reject(). Use for a
	// genealogist-reviewed sample or the output of buildCalibrationFromTree.
	Search.prototype.seedCalibration = function (rows, opts) {
		opts = opts || {};
		this._calibLog = (this._calibLog || []).concat(rows || []);
		if (opts.fit !== false) { try { return this.fitCalibration(); } catch (e) { return null; } }
		this._maybeRefitCalibration();
		return null;
	};

	// Persist the log between sessions; feed back via config.calibrationSeed.
	Search.prototype.exportCalibrationLog = function () {
		return (this._calibLog || []).slice();
	};

	// Force a fit right now regardless of the auto-refit thresholds. Useful
	// after bulk-seeding config.calibrationSeed or for a manual "recalibrate"
	// action in the UI. Throws if match.fitCalibration's own minimums aren't met.
	Search.prototype.fitCalibration = function () {
		var calib = this.match.fitCalibration(this._calibLog || []);
		this._calibLogAtLastFit = (this._calibLog || []).length;
		return calib;
	};

	Search.prototype.calibrationStatus = function () {
		var log = this._calibLog || [];
		var positives = log.reduce(function (a, r) { return a + (r.label ? 1 : 0); }, 0);
		return {
			samples: log.length,
			positives: positives,
			negatives: log.length - positives,
			fitted: !!this.match._calib,
			logloss: this.match._calib ? this.match._calib.logloss : null
		};
	};

	// =======================================================================
	// ENTRY POINTS
	// =======================================================================

	// SCAN — cheap. Blocking-key retrieval only, no lever scoring.
	// Answers "where might evidence exist," not "who is it."
	// On request only; never fires on highlight.
	Search.prototype.scan = function (curTree, personId, opts) {
		opts = opts || {};
		var self = this;
		var profile = this.buildProfile(curTree, personId);
		var kin = this.buildKin(curTree, personId);

		// Once per scan, not once per source.
		this._beginProvCache();
		var provisional;
		try { provisional = this.provisionalConstraints(curTree, personId, opts); }
		finally { this._endProvCache(); }

		var results = [];
		this.sources.forEach(function (info) {
			var target = { source: info.source, year: info.year, type: info.type };
			var sliced = self.timeSlice(kin, info.year, info.source, profile.mentions);
			var constraints = self.buildConstraints(curTree, profile, sliced, target);

			if (constraints.closedBy) {
				results.push({
					source: info.source, year: info.year, label: info.label,
					candidates: 0, best_rough: null,
					blocked_reason: 'ALREADY_HELD:' + constraints.closedBy
				});
				return;
			}
			if (constraints.deathCeiling != null && info.year > constraints.deathCeiling) {
				results.push({
					source: info.source, year: info.year, label: info.label,
					candidates: 0, best_rough: null,
					blocked_reason: 'DIED_BEFORE:' + constraints.deathCeiling
				});
				return;
			}

			// A provisional ceiling greys a source out; it never blocks it.
			var provWarn = null;
			if (provisional && !provisional.conflict && info.year > provisional.deathYear) {
				provWarn = 'PROVISIONAL_DIED_BEFORE:' + provisional.deathYear +
				           ' (' + provisional.mention_id + ')';
			}

			var pool = self.retrieve(profile, sliced, constraints, target, { blockingOnly: true });

			// Rough score: name only, no household, no birth profile work.
			var best = null;
			for (var i = 0; i < pool.length; i++) {
				var s = self.match.MatchName(profile.asMatchObject, pool[i].mention);
				if (best == null || s > best) best = s;
			}

			results.push({
				source: info.source, year: info.year, label: info.label, type: info.type,
				candidates: pool.length,
				best_rough: best != null ? +best.toFixed(3) : null,
				provisional_warning: provWarn,
				constraint_source: info.type && CONSTRAINT_TYPES.indexOf(info.type) >= 0,
				blocked_reason: null
			});
		});

		results.sort(function (a, b) {
			if (a.year !== b.year) return a.year - b.year;
			return String(a.source).localeCompare(String(b.source));
		});

		return {
			person_id: personId,
			name: profile.asMatchObject.full_name,
			issues: profile.issues,
			provisional_constraint: provisional || null,
			kin: kin.map(function (k) {
				return { person_id: k.person_id, predicate: k.predicate, hops: k.hops, imputed: k.imputed };
			}),
			sources: results
		};
	};

	// FIND — expensive. Full lever scoring against ONE source.
	Search.prototype.find = function (curTree, personId, opts) {
		opts = opts || {};
		if (!opts.source) throw new Error('find: opts.source is required (e.g. "AUG-CN-1870")');

		var self = this;
		var info = this.sources.get(opts.source);
		if (!info) throw new Error('find: unknown source ' + opts.source);

		var floor   = opts.floor   != null ? opts.floor   : this.opts.floor;
		var ceiling = opts.ceiling != null ? opts.ceiling : this.opts.ceiling;
		var limit   = opts.limit   != null ? opts.limit   : this.opts.limit;

		var target  = { source: info.source, year: info.year, type: info.type };

		// opts.provisionalConstraint lets findBatch pass a value it already
		// computed; opts.provisional === false is how the pre-pass calls back
		// into find() without recursing.
		this._beginProvCache();
		var provisional;
		try {
			provisional = opts.provisionalConstraint !== undefined
				? opts.provisionalConstraint
				: this.provisionalConstraints(curTree, personId, opts);
		} finally { this._endProvCache(); }
		var warning = this._provisionalWarning(provisional, info.year);

		var profile = this.buildProfile(curTree, personId);
		var kin     = this.timeSlice(this.buildKin(curTree, personId), info.year, info.source, profile.mentions);
		var constraints = this.buildConstraints(curTree, profile, kin, target);

		var applied = [];
		if (constraints.gender)       applied.push('gender=' + constraints.gender);
		if (constraints.raceClass)    applied.push('raceClass=' + constraints.raceClass);
		if (constraints.birthWindow)  applied.push('birth=' + constraints.birthWindow.join('-'));
		if (constraints.deathCeiling != null) {
			applied.push('deathCeiling=' + constraints.deathCeiling +
				(constraints.deathSource ? ' (' + constraints.deathSource + ')' : ''));
		}
		applied.push('excluded=' + constraints.excluded.size);
		if (warning && warning.type === 'PROVISIONAL_DEATH_BEFORE_SOURCE') {
			applied.push('provisionalDeath=' + warning.deathYear + ' (WARNING, not applied)');
		}

		if (constraints.closedBy) {
			return {
				person_id: personId, source: info.source, year: info.year,
				closed: true, closed_by: constraints.closedBy,
				note: 'A person appears once per source-year and this one already holds ' +
				      constraints.closedBy + '.',
				constraints_applied: applied, candidates: [], issues: profile.issues,
				warning: warning, provisional_constraint: provisional || null
			};
		}
		if (constraints.deathCeiling != null && info.year > constraints.deathCeiling) {
			return {
				person_id: personId, source: info.source, year: info.year,
				closed: true, closed_by: constraints.deathSource,
				note: 'Death recorded ' + constraints.deathCeiling + ', before ' + info.year + '.',
				constraints_applied: applied, candidates: [], issues: profile.issues,
				warning: warning, provisional_constraint: provisional || null
			};
		}

		var pool = this.retrieve(profile, kin, constraints, target);
		var scored = [], knockouts = {}, belowFloor = 0;
		for (var i = 0; i < pool.length; i++) {
			var r = this.scoreCandidate(profile, kin, constraints, pool[i], target);
			if (!r) continue;
			if (r.knockout) { knockouts[r.knockout] = (knockouts[r.knockout] || 0) + 1; continue; }
			if (r.score >= floor) scored.push(r); else belowFloor++;
		}
		scored.sort(function (a, b) { return b.score - a.score; });

		// Margin and runner-up. Always returned, even when only the top hit is
		// wanted: a researcher hunting an expected ancestor will accept a weaker
		// match than a blind matcher would, and the runner-up is the cheapest
		// available check on that.
		var second = scored.length > 1 ? scored[1].score : 0;
		var marginMin = opts.margin != null ? opts.margin : 0.05;
		scored.forEach(function (c, idx) {
			c.margin      = idx === 0 ? +(c.score - second).toFixed(3) : null;
			c.second_best = idx === 0 && scored.length > 1 ? +second.toFixed(3) : null;
			// Only the top candidate can be MATCH, and only when it clears the
			// ceiling AND beats the runner-up by the margin. Everything else is
			// MAYBE. A crowded top means MAYBE even at a high score, because a
			// score that several candidates reach is not identifying.
			c.status = (idx === 0 && c.score >= ceiling &&
			            (scored.length === 1 || (c.score - second) >= marginMin))
				? 'MATCH' : 'MAYBE';
			c.why.margin      = c.margin;
			c.why.second_best = c.second_best;
		});

		return {
			person_id:  personId,
			name:       profile.asMatchObject.full_name,
			source:     info.source,
			year:       info.year,
			label:      info.label,
			closed:     false,
			warning:    warning,
			provisional_constraint: provisional || null,
			retrieved:  pool.length,
			// An empty candidate list should explain itself. All 34 retrieved
			// for Arch Crawford against AUG-SS-1860 knock out: the enslaved
			// people in Cyrus Alexander's holding are the wrong gender or 20+
			// years off, and the surname blocks return white enslavers. That is
			// a finding about the tree's enslaver link, not a failed search.
			knockouts:  knockouts,
			below_floor: belowFloor,
			constraints_applied: applied,
			kin_used: kin.map(function (k) {
				return {
					person_id: k.person_id, predicate: k.predicate,
					grounded: k.grounded, coresidence: k.coresidence,
					weight: +k.weight.toFixed(3)
				};
			}),
			issues:     profile.issues,
			candidates: scored.slice(0, limit)
		};
	};

	// FIND BATCH — jointly resolve several tree persons against ONE source at
	// once, instead of one find() call per person. Two problems single-person
	// find() cannot see across calls:
	//   1. Bootstrapping: household/proximity/cohort support requires a kin
	//      member to already be GROUNDED (a confirmed mention in this exact
	//      source-year). Early in research nobody in a family is grounded yet,
	//      so none of those levers fire for anyone. findBatch runs a first pass
	//      with no cross-support, then lets each person's strong (>= ceiling)
	//      pick tentatively ground their kin for a second pass, so a confident
	//      hit on one relative can lift the rest of the household.
	//   2. Collision: two different tree persons can each score the SAME
	//      mention as their best candidate. find() has no visibility into any
	//      other person's search, so both would independently report MATCH.
	//      findBatch resolves this with a single greedy assignment over every
	//      (person, mention) pair above floor, highest score first, so once a
	//      mention is claimed nobody else's status can also read MATCH for it.
	// Returns { source, year, persons: { [person_id]: <find()-shaped result> } }.
	// A losing side of a collision is marked status CONTESTED (not MAYBE),
	// with contested_by naming the person who kept the mention - a one-appearance
	// -per-source-year mention cannot honestly belong to two people at once.
	Search.prototype.findBatch = function (curTree, personIds, opts) {
		opts = opts || {};
		if (!opts.source) throw new Error('findBatch: opts.source is required (e.g. "AUG-CN-1870")');
		var self = this;
		var info = this.sources.get(opts.source);
		if (!info) throw new Error('findBatch: unknown source ' + opts.source);

		var floor     = opts.floor   != null ? opts.floor   : this.opts.floor;
		var ceiling   = opts.ceiling != null ? opts.ceiling : this.opts.ceiling;
		var limit     = opts.limit   != null ? opts.limit   : this.opts.limit;
		var rounds    = opts.rounds  != null ? opts.rounds  : 2;
		var marginMin = opts.margin  != null ? opts.margin  : 0.05;

		var target = { source: info.source, year: info.year, type: info.type };
		var ids = (personIds && personIds.length) ? personIds.slice()
			: (curTree.persons || []).map(function (p) { return p.person_id; });

		var tentative = new Map();     // person_id -> mention, cross-support hypothesis
		var perPerson = {};            // person_id -> working state for this round
		var claimedBy = new Map();     // mention_id -> person_id (last round's assignment)

		// One provisional pre-pass per person for the WHOLE call. findBatch
		// re-scores the same people over several rounds, and the pre-pass runs
		// a find() against every constraint source, so computing it per round
		// would multiply that cost by `rounds` for no new information - the
		// tree does not change between rounds.
		this._beginProvCache();
		var provisionals = {};
		try {
			ids.forEach(function (pid) {
				provisionals[pid] = self.provisionalConstraints(curTree, pid, opts) || null;
			});
		} finally { this._endProvCache(); }

		for (var round = 1; round <= rounds; round++) {
			perPerson = {};
			ids.forEach(function (pid) {
				var profile, kin, constraints;
				try { profile = self.buildProfile(curTree, pid); }
				catch (err) { perPerson[pid] = { error: err.message }; return; }

				kin = self.timeSlice(self.buildKin(curTree, pid), info.year, info.source, profile.mentions, tentative);
				constraints = self.buildConstraints(curTree, profile, kin, target);

				if (constraints.closedBy ||
				    (constraints.deathCeiling != null && info.year > constraints.deathCeiling)) {
					perPerson[pid] = { profile: profile, closed: true, closedBy: constraints.closedBy, scored: [] };
					return;
				}

				var pool = self.retrieve(profile, kin, constraints, target);
				var scored = [];
				for (var i = 0; i < pool.length; i++) {
					var r = self.scoreCandidate(profile, kin, constraints, pool[i], target);
					if (r && !r.knockout && r.score >= floor) scored.push(r);
				}
				scored.sort(function (a, b) { return b.score - a.score; });
				perPerson[pid] = { profile: profile, kin: kin, scored: scored, closed: false };
			});

			// Global greedy assignment across every (person, mention) pair above
			// floor: highest score locks in first, consuming both sides, so a
			// mention already claimed can't also go to a second person and a
			// person already assigned doesn't keep competing for a worse pick.
			var pairs = [];
			ids.forEach(function (pid) {
				var pp = perPerson[pid];
				if (!pp || pp.closed || pp.error) return;
				pp.scored.forEach(function (r) { pairs.push({ pid: pid, mention_id: r.mention_id, score: r.score }); });
			});
			pairs.sort(function (a, b) { return b.score - a.score; });

			var assignedTo = new Map();   // person_id -> mention_id
			claimedBy = new Map();
			pairs.forEach(function (pr) {
				if (assignedTo.has(pr.pid) || claimedBy.has(pr.mention_id)) return;
				assignedTo.set(pr.pid, pr.mention_id);
				claimedBy.set(pr.mention_id, pr.pid);
			});

			if (round < rounds) {
				var nextTentative = new Map();
				assignedTo.forEach(function (mentionId, pid) {
					var pp = perPerson[pid];
					var top = pp.scored[0];
					// Only a clear, high-confidence pick is trustworthy enough to
					// ground someone ELSE's search; a middling MAYBE would just
					// propagate uncertainty through the household.
					if (top && top.mention_id === mentionId && top.score >= ceiling) {
						nextTentative.set(pid, self.byId.get(mentionId));
					}
				});
				tentative = nextTentative;
			}
		}

		var out = {};
		ids.forEach(function (pid) {
			var pp = perPerson[pid];
			if (!pp || pp.error) { out[pid] = { person_id: pid, error: (pp && pp.error) || 'unknown error' }; return; }
			if (pp.closed) {
				out[pid] = {
					person_id: pid, source: info.source, year: info.year, label: info.label,
					closed: true, closed_by: pp.closedBy, candidates: [],
					warning: self._provisionalWarning(provisionals[pid], info.year),
					provisional_constraint: provisionals[pid]
				};
				return;
			}

			var scored = pp.scored;
			var second = scored.length > 1 ? scored[1].score : 0;
			scored.forEach(function (c, idx) {
				c.margin      = idx === 0 ? +(c.score - second).toFixed(3) : null;
				c.second_best = idx === 0 && scored.length > 1 ? +second.toFixed(3) : null;
				var rivalPid = claimedBy.get(c.mention_id);
				var contested = rivalPid != null && rivalPid !== pid;
				c.contested_by = contested ? rivalPid : null;
				c.status = contested ? 'CONTESTED'
					: (idx === 0 && c.score >= ceiling && (scored.length === 1 || (c.score - second) >= marginMin))
						? 'MATCH' : 'MAYBE';
				c.why.margin      = c.margin;
				c.why.second_best = c.second_best;
			});

			out[pid] = {
				person_id: pid, name: pp.profile.asMatchObject.full_name,
				source: info.source, year: info.year, label: info.label, closed: false,
				warning: self._provisionalWarning(provisionals[pid], info.year),
				provisional_constraint: provisionals[pid],
				candidates: scored.slice(0, limit)
			};
		});

		return { source: info.source, year: info.year, label: info.label, persons: out };
	};

	// =======================================================================
	// ACCEPT / REJECT
	// Neither writes to tree/assertion STORAGE - the caller still owns that -
	// but both now feed the in-session calibration log and surname-bridge
	// index immediately (addAssertion), so later find()/findBatch() calls in
	// the same Search instance see the effect right away.
	// =======================================================================

	// Make an assertion visible to retrieval within this Search instance right
	// now, rather than waiting for the caller to reconstruct the index. A
	// hasNameVariant row re-enables the surname bridge for the very next
	// find()/findBatch() call instead of only after a page reload.
	Search.prototype.addAssertion = function (a) {
		if (!a) return;
		this.assertions = this.assertions || [];
		this.assertions.push(a);
		// Any cached provisional lookup is stale once the evidence changes.
		this._provCache = null; this._provDepth = 0;
		if (String(a.predicate || '').trim() === 'hasNameVariant') this.refreshSurnameBridge();
	};

	Search.prototype.accept = function (curTree, personId, mentionId, opts) {
		opts = opts || {};
		var person = (curTree.persons || []).filter(function (p) { return p.person_id === personId; })[0];
		if (!person) throw new Error('accept: no person ' + personId);
		var m = this.byId.get(mentionId);
		if (!m) throw new Error('accept: no mention ' + mentionId);

		person.mentions = person.mentions || [];
		if (person.mentions.indexOf(mentionId) < 0) person.mentions.push(mentionId);

		// New leads: assertions attached to the accepted mention point at people
		// who may not be in the tree yet. Read BEFORE the isSameAs row below is
		// added, so that row never shows up as a lead pointing at itself.
		var leads = (this.assertions || []).filter(function (a) {
			return a && (a.subject_id === mentionId || a.object_id === mentionId);
		}).map(function (a) {
			return {
				predicate: a.predicate,
				other:     a.subject_id === mentionId ? a.object_id : a.subject_id,
				direction: a.subject_id === mentionId ? 'OUT' : 'IN',
				confidence: a.confidence
			};
		});

		var assertion = {
			subject_id: person.mentions[0] || mentionId,
			predicate:  'isSameAs',
			object_id:  mentionId,
			start_year: m._year,
			end_year:   '',
			who:        opts.who || 'human',
			confidence: opts.confidence != null ? opts.confidence : 0.9
		};
		this.addAssertion(assertion);
		this._recordOutcome(curTree, personId, mentionId, true);

		return {
			assertion: assertion,
			profile: this.buildProfile(curTree, personId),   // birth window may have widened
			leads:   leads
		};
	};

	Search.prototype.reject = function (curTree, personId, mentionId, opts) {
		opts = opts || {};
		var person = (curTree.persons || []).filter(function (p) { return p.person_id === personId; })[0];
		if (!person) throw new Error('reject: no person ' + personId);

		person.rejected = person.rejected || [];
		if (person.rejected.indexOf(mentionId) < 0) person.rejected.push(mentionId);

		var assertion = {
			subject_id: (person.mentions || [])[0] || personId,
			predicate:  'isNotSameAs',
			object_id:  mentionId,
			start_year: '',
			end_year:   '',
			who:        opts.who || 'human',
			confidence: opts.confidence != null ? opts.confidence : 1
		};
		this.addAssertion(assertion);
		this._recordOutcome(curTree, personId, mentionId, false);

		return {
			assertion: assertion
		};
	};

	// =======================================================================
	// EXPORT
	// =======================================================================

	Search.SOURCE_TYPES   = SOURCE_TYPES;
	Search.BIRTH_PROFILES = BIRTH_PROFILES;
	Search.INVERSE        = INVERSE;
	Search.DEFAULTS       = DEFAULTS;
	Search.deref          = deref;
	Search.parseId        = parseId;
	Search.givenKey       = givenKey;

	if (typeof window !== 'undefined') window.Search = Search;
	if (typeof module !== 'undefined' && module.exports) module.exports = { Search: Search };

})(typeof globalThis !== 'undefined' ? globalThis : this);
