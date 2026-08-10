/**
 * GroupMatcher — matches an 1860 slave-schedule holding against an 1870
 * census family and returns a calibrated probability [0.0 – 1.0] that they
 * are the same group of people, age-progressed ten years.
 *
 * Plain vanilla JavaScript (ES2015+). No dependencies. Works in Node or
 * the browser.
 *
 * Design (see Verité data plan discussion):
 *   Layer 1 — pairwise individual similarity (birth year, gender, race)
 *   Layer 2 — one-to-one assignment. Two interchangeable strategies:
 *               'greedy'    — highest-sim-first with conflict resolution
 *               'alignment' — Needleman–Wunsch sequence alignment over the
 *                             age-ordered rosters. Exploits the fact that
 *                             both documents list people in (rough) age
 *                             order, so a matching that crosses the age
 *                             ordering is penalized structurally. Gap
 *                             penalties ARE the excusal/persistence
 *                             weights, so absence semantics stay identical
 *                             across strategies.
 *   Layer 3 — group score with excusal-weighted denominator
 *   Layer 4 — structural evidence (age-spacing matrix similarity)
 *   Layer 5 — enslaver-surname phonetic bridge (Soundex)
 *   Calibration — logistic squash to a probability, with a documentary
 *                 ceiling (nameless matches top out below 1.0 by design)
 *
 * All weights live in `this.params` so a later calibration step can refit
 * them without touching the matching logic. Every excusal decision is
 * logged with a reason code, and the returned object decomposes every
 * component so scores are auditable and recomputable.
 *
 * INPUT SHAPES
 * ------------
 * holding1860 = {
 *   familyId:     "FS1860-1224",
 *   enslaverName: { firstName: "Thomas", lastName: "Jackson" }, // or string
 *   county:       "Albemarle",            // optional
 *   members: [
 *     { birthYear: 1832, gender: "F", race: "B" },
 *     ...                                  // no names — schedules have none
 *   ]
 * }
 *
 * family1870 = {
 *   familyId: "FC1870-1224",
 *   county:   "Albemarle",                 // optional
 *   members: [
 *     { firstName: "Aggie", lastName: "Howell",
 *       birthYear: 1832, gender: "F", race: "B",
 *       freeBefore1860: false },           // optional flag from FBR / 1860 free census
 *     ...
 *   ]
 * }
 *
 * OUTPUT
 * ------
 * matcher.match(holding1860, family1870) => {
 *   probability: 0.71,          // the headline number
 *   components: { ... },        // every intermediate score
 *   assignments: [ ... ],       // matched pairs with per-pair sims
 *   excusals: [ ... ],          // unmatched people + reason codes + weights
 *   hypotheses: [ ... ]         // research leads (e.g. abroad-spouse search)
 * }
 *
 * BATCH API (one family vs. every holding in the schedule)
 * --------------------------------------------------------
 * matcher.matchAll(mentions, family1870) => [
 *   { id, holdingId, enslaverName, county, holdingSize,
 *     probability, rank, marginOverNext, ...full match result }, ...
 * ]  // sorted by probability, descending
 *
 * `mentions` is an array of mention rows (mentions.csv shape, snake_case
 * accepted). Slave-schedule rows are recognized by source containing
 * "SS-1860" (e.g. "ALB-SS-1860"). Rows are grouped into holdings by
 * family_id when present, else household_id. Within a holding the
 * slaveholder is the first-listed row; rows flagged head=t / legal_status
 * ≠ 'E' / carrying a name are also recognized as the enslaver.
 */
class GroupMatcher {
	constructor(overrides = {}) {
		// ---- Parameter table (calibration targets — priors, not truths) ----
		const defaults = {
			// Layer 2: assignment strategy — 'greedy' | 'alignment'
			assigner: 'greedy',

			// Layer 1: pairwise similarity
			ageSigma: 3.5,            // Gaussian σ on birth-year gap (years). Wider
			// than census-to-census because schedule ages
			// are estimated/rounded.
			ageHardCutoff: 10,        // beyond this gap, sim = 0 (knockout)
			pairThreshold: 0.35,      // min sim for a pairing to count as a match
			raceAgree: 1.0,           // B↔B, M↔M
			raceSoft: 0.9,            // B↔M — enumerator-unstable, near-neutral
			raceUnknown: 0.75,        // one side blank

			// Layer 3: excusal weights — unmatched 1870 family members
			wUnexcused: 1.0,          // Black member, born well before 1860, no
			// free-status evidence — full penalty
			wStraddleBirth: 0.25,     // born 1859–1860 (under-enumerated infants)
			wAbroadSpouse: 0.5,       // missing adult male head (abroad marriage)
			wSurnameOutlier: 0.5,     // surname differs from family core (in-law,
			// boarder, post-war recombination)
			straddleYears: [1859, 1860],

			// Layer 3: persistence weights — unmatched 1860 holding entries,
			// keyed by 1860 age band. How strongly "should" this person still be
			// in the family's household in 1870?
			persistenceBands: [
				{ maxAge: 5, w: 0.6 },   // child mortality
				{ maxAge: 11, w: 0.4 },   // leaving for labor/marriage by 1870
				{ maxAge: 25, w: 0.2 },   // near-certainly heads own 1870 household
				{ maxAge: 45, w: 0.6 },   // family core — should persist
				{ maxAge: 999, w: 0.3 },  // mortality dominates
			],

			// Layer 4: structural age-spacing evidence
			spacingSigma: 2.0,        // σ on the *difference of age-differences*

			// Layer 5: surname bridge
			surnameMatchScore: 1.0,   // Soundex match, 1870 surname ↔ enslaver
			surnameMissScore: 0.35,   // no match ≠ knockout: freedpeople often
			// chose surnames other than the enslaver's
			countyMismatchFactor: 0.3,// different county → strong discount

			// Blend weights (must sum to 1.0)
			blendGroup: 0.55,
			blendStructure: 0.25,
			blendSurname: 0.20,

			// Calibration: logistic squash + evidence-mass + ceiling
			logisticK: 8,             // steepness
			logisticMid: 0.55,        // blend value mapping to ceiling/2
			probabilityCeiling: 0.85, // nameless matches top out here without a
			// documentary bridge (Freedmen's Bureau etc.)
			sizeSaturation: 3,        // matched-pair count where evidence mass
			// reaches ~63% of full strength
		};
		this.params = Object.assign({}, defaults, overrides);
	}

	// ======================================================================
	// PUBLIC API
	// ======================================================================

	/**
	 * @param {object} holding1860  slave-schedule group (see shape above)
	 * @param {object} family1870   census family (see shape above)
	 * @returns {object} { probability, components, assignments, excusals, hypotheses }
	 */
	match(holding1860, family1870) {
		const p = this.params;
		const hypotheses = [];

		const holding = (holding1860.members || []).map((m, i) =>
			Object.assign({ _idx: i }, m));
		const family = (family1870.members || []).map((m, i) =>
			Object.assign({ _idx: i }, m));

		if (holding.length === 0 || family.length === 0) {
			return this._emptyResult('EMPTY_GROUP');
		}

		// ---- Pre-pass: classify 1870 members whose absence would be excused
		// *structurally* (they are removed from the comparison entirely). ----
		const familySurnameCore = this._dominantSurname(family);
		const comparable = [];
		const preExcused = [];
		for (const m of family) {
			if (this._normRace(m.race) === 'W') {
				preExcused.push(this._excusal(m, 'EXCUSED_WHITE', 0));
			} else if (typeof m.birthYear === 'number' && m.birthYear >= 1861) {
				preExcused.push(this._excusal(m, 'EXCUSED_POSTNATAL', 0));
			} else if (m.freeBefore1860 === true) {
				preExcused.push(this._excusal(m, 'EXCUSED_FBR', 0));
			} else {
				comparable.push(m);
			}
		}

		// ---- Layer 1: pairwise similarity matrix ----
		const sims = comparable.map(fm =>
			holding.map(hm => this._pairSim(fm, hm)));

		// ---- Layer 2: assignment (strategy chosen by params.assigner) ----
		const assignments = this.params.assigner === 'alignment'
			? this._assignAlignment(sims, comparable, holding, family)
			: this._assign(sims, comparable, holding);
		const matchedFamilyIdx = new Set(assignments.map(a => a.family._idx));
		const matchedHoldingIdx = new Set(assignments.map(a => a.holding._idx));
		const N = assignments.length;
		const simSum = assignments.reduce((s, a) => s + a.sim, 0);

		// ---- Layer 3a: penalty weights for unmatched 1870 members ----
		const excusals = preExcused.slice();
		let familyPenalty = 0;
		for (const m of comparable) {
			if (matchedFamilyIdx.has(m._idx)) continue;
			const { code, w } = this._classifyFamilyAbsence(m, family, familySurnameCore);
			if (code === 'HALF_ABROAD_SPOUSE') {
				hypotheses.push({
					type: 'ABROAD_SPOUSE_SEARCH',
					person: this._label(m),
					note: `${this._label(m)} absent from ${holding1860.familyId}; ` +
						`possible abroad marriage — search other holdings in district.`,
				});
			}
			excusals.push(this._excusal(m, code, w));
			familyPenalty += w;
		}

		// ---- Layer 3b: persistence-weighted penalties for unmatched 1860
		// entries, scaled by holding size (a holding is not a family). ----
		const mEff = comparable.length; // excusal-adjusted family size
		const sizeScale = Math.min(1, mEff / holding.length);
		let holdingPenalty = 0;
		for (const hm of holding) {
			if (matchedHoldingIdx.has(hm._idx)) continue;
			const age1860 = this._ageIn(hm, 1860);
			const wPersist = this._persistenceWeight(age1860);
			const w = wPersist * sizeScale;
			excusals.push(this._excusal(hm, 'HOLDING_UNMATCHED', w,
				{ age1860, wPersist, sizeScale }));
			holdingPenalty += w;
		}

		// ---- Layer 3: group score (weighted group-linking formula) ----
		const denom = N + familyPenalty + holdingPenalty;
		const groupScore = denom > 0 ? simSum / denom : 0;

		// ---- Layer 4: structural age-spacing similarity ----
		const structureScore = this._spacingScore(assignments);

		// ---- Layer 5: surname / geography bridge ----
		const surnameScore = this._surnameBridge(
			family, familySurnameCore, holding1860, family1870);

		// ---- Blend + evidence mass + logistic calibration ----
		const blend =
			p.blendGroup * groupScore +
			p.blendStructure * structureScore +
			p.blendSurname * surnameScore;

		// A perfect 2-person profile is far weaker evidence than a perfect
		// 8-person profile: discount by matched-pair evidence mass.
		const evidenceMass = 1 - Math.exp(-N / p.sizeSaturation);

		const raw = p.probabilityCeiling /
			(1 + Math.exp(-p.logisticK * (blend - p.logisticMid)));
		const probability = this._round(raw * evidenceMass);

		return {
			probability,
			components: {
				matchedPairs: N,
				simSum: this._round(simSum),
				familyPenalty: this._round(familyPenalty),
				holdingPenalty: this._round(holdingPenalty),
				sizeScale: this._round(sizeScale),
				groupScore: this._round(groupScore),
				structureScore: this._round(structureScore),
				surnameScore: this._round(surnameScore),
				blend: this._round(blend),
				evidenceMass: this._round(evidenceMass),
				ceiling: p.probabilityCeiling,
			},
			assignments: assignments.map(a => ({
				family: this._label(a.family),
				holding: this._label(a.holding),
				sim: this._round(a.sim),
			})),
			excusals,
			hypotheses,
		};
	}

	/**
	 * Compare a single 1870 census family against EVERY slave holding found
	 * in a mentions array, returning one result object per holding.
	 *
	 * @param {Array<object>} mentions   mention rows (mentions.csv shape);
	 *                                   slave-schedule rows recognized by
	 *                                   source containing `opts.sourceTag`
	 * @param {object} family1870        census family (see shape above)
	 * @param {object} [opts]
	 *        opts.sourceTag             substring identifying schedule rows
	 *                                   (default 'SS-1860')
	 * @returns {Array<object>} one object per holding, each with a unique
	 *          `id`, sorted by probability descending, with `rank` and
	 *          `marginOverNext` (this probability minus the next-ranked
	 *          holding's — the exclusivity signal for hypothesis cards).
	 */
	matchAll(mentions, family1870, opts = {}) {
		const holdings = this.extractHoldings(mentions, opts);
		const results = holdings.map(h => {
			const r = this.match(h, family1870);
			return Object.assign({
				id: `${family1870.familyId || 'FAMILY'}::${h.familyId}`,
				holdingId: h.familyId,
				enslaverName: h.enslaverName || null,
				county: h.county || null,
				holdingSize: h.members.length,
			}, r);
		});
		results.sort((a, b) => b.probability - a.probability);
		results.forEach((r, i) => {
			r.rank = i + 1;
			r.marginOverNext = i + 1 < results.length
				? this._round(r.probability - results[i + 1].probability)
				: null;
		});
		return results;
	}

	/**
	 * Group slave-schedule mention rows into holding objects consumable by
	 * match(). Grouping key: family_id when present, else household_id
	 * (the ingested data keys SS-1860 groups as HS1860-N household ids).
	 * The enslaver is the first-listed row of each group, per ingest
	 * convention; rows flagged head=t / legal_status ≠ 'E' / carrying a
	 * name are recognized as the enslaver wherever they appear, and are
	 * excluded from the enslaved-member list.
	 */
	extractHoldings(mentions, opts = {}) {
		const tag = opts.sourceTag || 'SS-1860';
		const groups = new Map(); // key → { rows: [] } in file order
		for (const row of mentions) {
			const source = row.source || '';
			if (source.indexOf(tag) === -1) continue;
			const key = row.family_id || row.familyId ||
				row.household_id || row.householdId;
			if (!key) continue;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(row);
		}

		const holdings = [];
		for (const [key, rows] of groups) {
			let enslaverRow = null;
			const enslaved = [];
			for (const row of rows) {
				if (!enslaverRow && this._isEnslaverRow(row)) {
					enslaverRow = row;
				} else {
					enslaved.push(this._mentionToMember(row));
				}
			}
			if (enslaved.length === 0) continue; // enslaver-only fragment
			const source = rows[0].source || '';
			holdings.push({
				familyId: key,
				enslaverName: enslaverRow ? {
					firstName: enslaverRow.first_name || enslaverRow.firstName || '',
					lastName: enslaverRow.last_name || enslaverRow.lastName ||
						(enslaverRow.full_name || enslaverRow.fullName || '')
							.trim().split(/\s+/).pop() || '',
				} : null,
				// Raw mention row for the enslaver, when the ingest data included one —
				// lets a caller show/link the actual source record, not just a name.
				enslaverRow: enslaverRow || null,
				// County code is the source prefix before the tag, e.g. "ALB".
				county: source.split('-')[0] || undefined,
				members: enslaved,
			});
		}
		return holdings;
	}

	/** Slaveholder row: first-listed with a name, head flag, or non-'E'
	 *  legal status. Enslaved rows are nameless with legal_status 'E'. */
	_isEnslaverRow(row) {
		const legal = String(row.legal_status || row.legalStatus || '')
			.trim().toUpperCase();
		if (legal === 'E') return false;
		const head = String(row.head || '').trim().toLowerCase();
		if (head === 't' || head === 'true' || row.head === true) return true;
		return Boolean(row.full_name || row.fullName ||
			row.last_name || row.lastName);
	}

	_mentionToMember(row) {
		const raw = row.birth_year != null ? row.birth_year : row.birthYear;
		const n = typeof raw === 'string' && raw.trim() !== ''
			? Number(raw) : raw;
		return {
			mentionId: row.mention_id || row.mentionId,
			firstName: row.first_name || row.firstName || undefined,
			lastName: row.last_name || row.lastName || undefined,
			birthYear: typeof n === 'number' && !isNaN(n) ? n : undefined,
			gender: row.gender,
			race: row.race || row.norm_race || row.normRace,
			householdId: row.household_id || row.householdId,
		};
	}

	// ======================================================================
	// LAYER 1 — pairwise similarity
	// ======================================================================

	_pairSim(fm, hm) {
		const p = this.params;

		// Gender: hard gate. Blank/unknown is neutral, populated disagreement kills.
		const g1 = this._normGender(fm.gender);
		const g2 = this._normGender(hm.gender);
		if (g1 && g2 && g1 !== g2) return 0;

		// Race: soft signal with B↔W knockout.
		const r1 = this._normRace(fm.race);
		const r2 = this._normRace(hm.race);
		let raceScore;
		if (!r1 || !r2) raceScore = p.raceUnknown;
		else if ((r1 === 'W') !== (r2 === 'W')) return 0;   // B/M vs W knockout
		else if (r1 === r2) raceScore = p.raceAgree;
		else raceScore = p.raceSoft;                        // B↔M

		// Age progression: Gaussian on birth-year gap, hard cutoff beyond ±10.
		if (typeof fm.birthYear !== 'number' || typeof hm.birthYear !== 'number') {
			return 0.4 * raceScore; // age missing: weak, race-only evidence
		}
		const gap = Math.abs(fm.birthYear - hm.birthYear);
		if (gap > p.ageHardCutoff) return 0;
		const ageScore = Math.exp(-(gap * gap) / (2 * p.ageSigma * p.ageSigma));

		return ageScore * raceScore;
	}

	// ======================================================================
	// LAYER 2 — assignment
	// ======================================================================

	/**
	 * Greedy one-to-one assignment: sort all pairs above threshold by sim
	 * descending, accept each pair whose two members are still free. This
	 * mirrors the project's Phase-3 conflict resolution. For an exact
	 * optimum, swap in the Hungarian algorithm here — the rest of the class
	 * is agnostic to how assignments are produced.
	 */
	_assign(sims, family, holding) {
		const pairs = [];
		for (let i = 0; i < family.length; i++) {
			for (let j = 0; j < holding.length; j++) {
				if (sims[i][j] >= this.params.pairThreshold) {
					pairs.push({ i, j, sim: sims[i][j] });
				}
			}
		}
		pairs.sort((a, b) => b.sim - a.sim);
		const usedF = new Set();
		const usedH = new Set();
		const out = [];
		for (const pr of pairs) {
			if (usedF.has(pr.i) || usedH.has(pr.j)) continue;
			usedF.add(pr.i);
			usedH.add(pr.j);
			out.push({ family: family[pr.i], holding: holding[pr.j], sim: pr.sim });
		}
		return out;
	}

	/**
	 * Needleman–Wunsch global alignment over the age-ordered rosters.
	 *
	 * Both documents list people in (rough) age order — census families
	 * head-first then children by descending age, schedules by descending
	 * age within a holding. Sorting both sides oldest-first makes them
	 * comparable sequences, and the DP finds the optimal alignment where:
	 *   - aligning i↔j earns sim(i,j)   (only allowed at/above pairThreshold)
	 *   - a gap opposite a family member costs their absence weight
	 *     (excusal classification: 0.25 straddle birth, 0.5 abroad spouse /
	 *     surname outlier, 1.0 unexcused)
	 *   - a gap opposite a holding entry costs persistence × sizeScale
	 *
	 * Because alignment cannot cross the ordering, a pairing that would
	 * permute ages (1870's eldest matching the schedule's youngest) is
	 * structurally excluded — a signal the unordered greedy assigner cannot
	 * see. Members with unknown birth years sort last and behave as
	 * order-neutral tail items.
	 *
	 * O(M × M′) time and space. Returns the same shape as _assign, so the
	 * rest of the pipeline is agnostic to which strategy produced it.
	 */
	_assignAlignment(sims, comparable, holding, family) {
		const p = this.params;
		const bySeniority = (a, b) => {
			const ay = typeof a.birthYear === 'number' ? a.birthYear : Infinity;
			const by = typeof b.birthYear === 'number' ? b.birthYear : Infinity;
			return ay - by; // oldest (smallest birth year) first, unknowns last
		};
		const famSeq = comparable.slice().sort(bySeniority);
		const holdSeq = holding.slice().sort(bySeniority);

		// Map sorted positions back to the sims matrix (indexed by original
		// position within `comparable` / `holding`).
		const famPos = new Map(comparable.map((m, i) => [m._idx, i]));
		const holdPos = new Map(holding.map((m, i) => [m._idx, i]));

		const familySurnameCore = this._dominantSurname(family);
		const gapF = famSeq.map(m =>
			this._classifyFamilyAbsence(m, family, familySurnameCore).w);
		const sizeScale = Math.min(1, comparable.length / holding.length);
		const gapH = holdSeq.map(m =>
			this._persistenceWeight(this._ageIn(m, 1860)) * sizeScale);

		const M = famSeq.length;
		const H = holdSeq.length;
		const NEG = -Infinity;

		// DP[i][j] = best score aligning famSeq[0..i) with holdSeq[0..j).
		const DP = [];
		const BT = []; // backtrace: 'D' diagonal (match), 'U' up (family gap),
		// 'L' left (holding gap)
		for (let i = 0; i <= M; i++) {
			DP.push(new Array(H + 1).fill(0));
			BT.push(new Array(H + 1).fill(null));
		}
		for (let i = 1; i <= M; i++) {
			DP[i][0] = DP[i - 1][0] - gapF[i - 1];
			BT[i][0] = 'U';
		}
		for (let j = 1; j <= H; j++) {
			DP[0][j] = DP[0][j - 1] - gapH[j - 1];
			BT[0][j] = 'L';
		}
		for (let i = 1; i <= M; i++) {
			for (let j = 1; j <= H; j++) {
				const s = sims[famPos.get(famSeq[i - 1]._idx)]
				[holdPos.get(holdSeq[j - 1]._idx)];
				const diag = s >= p.pairThreshold ? DP[i - 1][j - 1] + s : NEG;
				const up = DP[i - 1][j] - gapF[i - 1];
				const left = DP[i][j - 1] - gapH[j - 1];
				if (diag >= up && diag >= left) {
					DP[i][j] = diag; BT[i][j] = 'D';
				} else if (up >= left) {
					DP[i][j] = up; BT[i][j] = 'U';
				} else {
					DP[i][j] = left; BT[i][j] = 'L';
				}
			}
		}

		// Traceback → matched pairs.
		const out = [];
		let i = M;
		let j = H;
		while (i > 0 || j > 0) {
			const move = BT[i][j];
			if (move === 'D') {
				const fm = famSeq[i - 1];
				const hm = holdSeq[j - 1];
				out.push({
					family: fm,
					holding: hm,
					sim: sims[famPos.get(fm._idx)][holdPos.get(hm._idx)],
				});
				i--; j--;
			} else if (move === 'U') {
				i--;
			} else {
				j--;
			}
		}
		return out.reverse();
	}

	// ======================================================================
	// LAYER 3 helpers — excusals & persistence
	// ======================================================================

	_persistenceWeight(age1860) {
		if (typeof age1860 !== 'number') return 0.4; // unknown age: middling
		for (const band of this.params.persistenceBands) {
			if (age1860 <= band.maxAge) return band.w;
		}
		return 0.3;
	}

	/**
	 * Classify why an 1870 family member might be absent from the holding,
	 * returning a reason code and penalty weight. Used both by Layer 3a
	 * (post-assignment penalties) and by the alignment assigner (gap costs),
	 * so absence semantics cannot diverge between the two.
	 */
	_classifyFamilyAbsence(m, family, familySurnameCore) {
		const p = this.params;
		if (typeof m.birthYear === 'number' &&
			m.birthYear >= p.straddleYears[0] &&
			m.birthYear <= p.straddleYears[1]) {
			return { code: 'EXCUSED_STRADDLE_BIRTH', w: p.wStraddleBirth };
		}
		if (this._isLikelyAdultMaleHead(m, family)) {
			return { code: 'HALF_ABROAD_SPOUSE', w: p.wAbroadSpouse };
		}
		if (familySurnameCore && m.lastName &&
			this._soundex(m.lastName) !== this._soundex(familySurnameCore)) {
			return { code: 'HALF_SURNAME_OUTLIER', w: p.wSurnameOutlier };
		}
		return { code: 'UNEXCUSED', w: p.wUnexcused };
	}

	_isLikelyAdultMaleHead(m, family) {
		if (this._normGender(m.gender) !== 'M') return false;
		if (typeof m.birthYear !== 'number' || m.birthYear > 1845) return false;
		// Oldest male in the family → likely head/husband.
		const males = family.filter(x =>
			this._normGender(x.gender) === 'M' && typeof x.birthYear === 'number');
		if (males.length === 0) return false;
		const oldest = males.reduce((a, b) => (a.birthYear <= b.birthYear ? a : b));
		return oldest._idx === m._idx;
	}

	_excusal(m, code, weight, extra = {}) {
		return Object.assign({ person: this._label(m), code, weight }, extra);
	}

	// ======================================================================
	// LAYER 4 — structural age-spacing evidence
	// ======================================================================

	/**
	 * Compare the matrix of pairwise age differences among matched members
	 * on each side. Internal spacing is preserved even when every age is
	 * off by a shared enumerator error, and it exposes false matches whose
	 * individual ages fit but whose joint structure doesn't.
	 */
	_spacingScore(assignments) {
		const usable = assignments.filter(a =>
			typeof a.family.birthYear === 'number' &&
			typeof a.holding.birthYear === 'number');
		if (usable.length < 2) return 0.5; // no structure to compare: neutral

		const sigma = this.params.spacingSigma;
		let sum = 0;
		let count = 0;
		for (let a = 0; a < usable.length; a++) {
			for (let b = a + 1; b < usable.length; b++) {
				const dFam = usable[a].family.birthYear - usable[b].family.birthYear;
				const dHold = usable[a].holding.birthYear - usable[b].holding.birthYear;
				const diff = dFam - dHold;
				sum += Math.exp(-(diff * diff) / (2 * sigma * sigma));
				count++;
			}
		}
		return count > 0 ? sum / count : 0.5;
	}

	// ======================================================================
	// LAYER 5 — surname / geography bridge
	// ======================================================================

	_surnameBridge(family, familySurnameCore, holding1860, family1870) {
		const p = this.params;
		const enslaver = holding1860.enslaverName;
		const enslaverLast = typeof enslaver === 'string'
			? enslaver.trim().split(/\s+/).pop()
			: enslaver && enslaver.lastName;

		let score = p.surnameMissScore;
		if (enslaverLast) {
			const enslaverCode = this._soundex(enslaverLast);
			// Match against *any* surname carried in the family, not just the
			// dominant one — mixed-surname 1870 households are common.
			const surnames = new Set(
				family.map(m => m.lastName).filter(Boolean));
			if (familySurnameCore) surnames.add(familySurnameCore);
			for (const s of surnames) {
				if (this._soundex(s) === enslaverCode) {
					score = p.surnameMatchScore;
					break;
				}
			}
		}

		// Geography: same county is nearly a precondition.
		const c1 = (holding1860.county || '').trim().toLowerCase();
		const c2 = (family1870.county || '').trim().toLowerCase();
		if (c1 && c2 && c1 !== c2) score *= p.countyMismatchFactor;

		return score;
	}

	// ======================================================================
	// Utilities
	// ======================================================================

	_dominantSurname(family) {
		const counts = new Map();
		for (const m of family) {
			if (!m.lastName) continue;
			const k = m.lastName.trim().toLowerCase();
			counts.set(k, (counts.get(k) || 0) + 1);
		}
		let best = null;
		let bestN = 0;
		for (const [k, n] of counts) {
			if (n > bestN) { best = k; bestN = n; }
		}
		return best;
	}

	/** Standard American Soundex. */
	_soundex(name) {
		if (!name) return '';
		const s = String(name).toUpperCase().replace(/[^A-Z]/g, '');
		if (!s) return '';
		const codes = {
			B: 1, F: 1, P: 1, V: 1,
			C: 2, G: 2, J: 2, K: 2, Q: 2, S: 2, X: 2, Z: 2,
			D: 3, T: 3,
			L: 4,
			M: 5, N: 5,
			R: 6,
		};
		const first = s[0];
		let prev = codes[first] || 0;
		let out = first;
		for (let i = 1; i < s.length && out.length < 4; i++) {
			const ch = s[i];
			const code = codes[ch] || 0;
			if (ch === 'H' || ch === 'W') continue; // H/W don't break runs
			if (code !== 0 && code !== prev) out += code;
			prev = code;
		}
		return (out + '000').slice(0, 4);
	}

	_ageIn(m, year) {
		return typeof m.birthYear === 'number' ? year - m.birthYear : undefined;
	}

	_normGender(g) {
		if (!g) return '';
		const c = String(g).trim().toUpperCase()[0];
		return c === 'M' || c === 'F' ? c : '';
	}

	_normRace(r) {
		if (!r) return '';
		const c = String(r).trim().toUpperCase()[0];
		return c === 'B' || c === 'M' || c === 'W' ? c : '';
	}

	_label(m) {
		const name = [m.firstName, m.lastName].filter(Boolean).join(' ');
		const by = typeof m.birthYear === 'number' ? `b.${m.birthYear}` : 'b.?';
		const g = this._normGender(m.gender) || '?';
		const hhRaw = m.householdId || '';
		let hh = '';
		if (hhRaw) {
			const formatted = hhRaw.startsWith('FC') ? 'HC' + hhRaw.slice(2) : hhRaw;
			hh = `, ${formatted}`;
		}
		return name ? `${name} (${by}, ${g}${hh})` : `(${by}, ${g}${hh})`;
	}

	_round(x) {
		return Math.round(x * 1000) / 1000;
	}

	_emptyResult(code) {
		return {
			probability: 0,
			components: { error: code },
			assignments: [],
			excusals: [],
			hypotheses: [],
		};
	}
}

// Node export without breaking plain <script> usage.
if (typeof module !== 'undefined' && module.exports) {
	module.exports = GroupMatcher;
}

/* ========================================================================
 * EXAMPLE
 * ========================================================================
 * const matcher = new GroupMatcher();
 * const result = matcher.match(
 *   {
 *     familyId: 'FS1860-1224',
 *     enslaverName: { firstName: 'Thomas', lastName: 'Jackson' },
 *     county: 'Albemarle',
 *     members: [
 *       { birthYear: 1830, gender: 'M', race: 'B' },
 *       { birthYear: 1832, gender: 'F', race: 'B' },
 *       { birthYear: 1854, gender: 'F', race: 'B' },
 *       { birthYear: 1857, gender: 'M', race: 'M' },
 *     ],
 *   },
 *   {
 *     familyId: 'FC1870-1224',
 *     county: 'Albemarle',
 *     members: [
 *       { firstName: 'Henderson', lastName: 'Jackson', birthYear: 1831, gender: 'M', race: 'B' },
 *       { firstName: 'Aggie',     lastName: 'Jackson', birthYear: 1833, gender: 'F', race: 'B' },
 *       { firstName: 'Mary',      lastName: 'Jackson', birthYear: 1855, gender: 'F', race: 'B' },
 *       { firstName: 'Wyatt',     lastName: 'Jackson', birthYear: 1857, gender: 'M', race: 'B' },
 *       { firstName: 'Lucy',      lastName: 'Jackson', birthYear: 1866, gender: 'F', race: 'B' }, // EXCUSED_POSTNATAL
 *     ],
 *   }
 * );
 * console.log(result.probability);      // e.g. 0.7–0.8
 * console.log(result.components);       // full audit trail
 * console.log(result.excusals);         // Lucy → EXCUSED_POSTNATAL, w=0
 * ======================================================================== */
