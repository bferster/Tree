

// ---------------------------------------------------------------------------
// Search defaults / helpers — private implementation details of Score.Search
// (formerly the standalone searchMentions.js module)
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RESULTS = 80;

const DEFAULT_CONFIG = {
	jwFuzzyPassThreshold: 0.85, // below this, a "Fuzzy" match contributes near-zero rather than a small positive
	rarity: {
		veryRareMax: 5,
		uncommonMax: 20,
		averageMax: 100,
		commonMax: 500,
		modVeryRare: 15,
		modUncommon: 5,
		modAverage: 0,
		modCommon: -5,
		modExtremelyCommon: -15,
	},

	// Birth-year match-mode -> window (years). "Exact" = 0. Diff beyond the
	// window is a hard knockout for that candidate (the user explicitly chose
	// this tolerance in the UI).
	birthYearWindows: {
		Exact: 0,
		"±1": 1,
		"±2": 2,
		"±3": 3,
		"±5": 5,
		"±10": 10,
	},

	softmaxTemperature: 1.0,

	// When false (default), the family-boost and rarity trace console logs are
	// suppressed — they used to fire unconditionally on every scored candidate,
	// which was real overhead and noise on every search. Set to true (or pass
	// {debug: true} to `new Score(...)`) to restore the verbose trace output.
	debug: false,
};

function isPresent(v) {
	return v !== null && v !== undefined && String(v).trim() !== "" && String(v).trim().toLowerCase() !== "null";
}

function normUpper(s) {
	return isPresent(s) ? String(s).trim().toUpperCase().replace(/[^A-Z]/g, "") : "";
}

function clamp(x, lo, hi) {
	return Math.max(lo, Math.min(hi, x));
}

function mergeConfig(defaults, overrides) {
	const merged = { ...defaults, ...overrides };
	merged.rarity = { ...defaults.rarity, ...(overrides.rarity || {}) };
	merged.birthYearWindows = { ...defaults.birthYearWindows, ...(overrides.birthYearWindows || {}) };
	return merged;
}

function fieldByTerm(fields, term) {
	return (fields || []).find((f) => f.term === term);
}

// A mention's family/household grouping key: household_id when present, else family_id.
function getFamId(m) {
	if (!m) return null;
	return (m.household_id !== null && m.household_id !== undefined && String(m.household_id).trim() !== '') ? m.household_id : m.family_id;
}

// Resolution pattern for GroupMatcher (browser global vs. Node require).
const GroupMatcherClass = (typeof globalThis !== 'undefined' && globalThis.GroupMatcher)
	? globalThis.GroupMatcher
	: (typeof require !== 'undefined' ? require('./groupMatcher') : null);

// Same resolution pattern for Match (browser global vs. Node require).
const MatchClass = (typeof globalThis !== 'undefined' && globalThis.Match)
	? globalThis.Match
	: (typeof require !== 'undefined' ? (require('./match').Match || require('./match')) : null);

function getCanonicalNickname(name) {
	if (!name) return "";
	if (typeof app !== 'undefined' && app && app.match && typeof app.match.nickname === 'function') {
		return app.match.nickname(name);
	}
	if (typeof window !== 'undefined' && window.app && window.app.match && typeof window.app.match.nickname === 'function') {
		return window.app.match.nickname(name);
	}
	if (MatchClass) {
		if (!Score._defaultMatch) Score._defaultMatch = new MatchClass();
		return Score._defaultMatch.nickname(name);
	}
	return normUpper(name);
}

function getCanonicalNYSIIS(name) {
	if (!name) return "";
	if (typeof app !== 'undefined' && app && app.match && typeof app.match.getNYSIIS === 'function') {
		return app.match.getNYSIIS(name);
	}
	if (typeof window !== 'undefined' && window.app && window.app.match && typeof window.app.match.getNYSIIS === 'function') {
		return window.app.match.getNYSIIS(name);
	}
	if (MatchClass) {
		if (!Score._defaultMatch) Score._defaultMatch = new MatchClass();
		return Score._defaultMatch.getNYSIIS(name);
	}
	return normUpper(name);
}

function getCanonicalMetaphone(name) {
	if (!name) return "";
	if (typeof app !== 'undefined' && app && app.match && typeof app.match.getMetaphone === 'function') {
		return app.match.getMetaphone(name);
	}
	if (typeof window !== 'undefined' && window.app && window.app.match && typeof window.app.match.getMetaphone === 'function') {
		return window.app.match.getMetaphone(name);
	}
	if (MatchClass) {
		if (!Score._defaultMatch) Score._defaultMatch = new MatchClass();
		return Score._defaultMatch.getMetaphone(name);
	}
	return normUpper(name);
}

function getDoubleMetaphoneMatchScore(w1, w2) {
	if (typeof app !== 'undefined' && app && app.match && typeof app.match.doubleMetaphoneMatchScore === 'function') {
		return app.match.doubleMetaphoneMatchScore(w1, w2);
	}
	if (typeof window !== 'undefined' && window.app && window.app.match && typeof window.app.match.doubleMetaphoneMatchScore === 'function') {
		return window.app.match.doubleMetaphoneMatchScore(w1, w2);
	}
	if (MatchClass) {
		if (!Score._defaultMatch) Score._defaultMatch = new MatchClass();
		return Score._defaultMatch.doubleMetaphoneMatchScore(w1, w2);
	}
	return 0.0;
}

function getJaroWinkler(s1, s2, prefixScale = 0.1, boostThreshold = 0.7) {
	if (!s1 || !s2) return 0.0;
	if (typeof app !== 'undefined' && app && app.match && typeof app.match.jaroWinkler === 'function') {
		return app.match.jaroWinkler(s1, s2, prefixScale, boostThreshold);
	}
	if (typeof window !== 'undefined' && window.app && window.app.match && typeof window.app.match.jaroWinkler === 'function') {
		return window.app.match.jaroWinkler(s1, s2, prefixScale, boostThreshold);
	}
	if (MatchClass) {
		if (!Score._defaultMatch) Score._defaultMatch = new MatchClass();
		return Score._defaultMatch.jaroWinkler(s1, s2, prefixScale, boostThreshold);
	}
	return 0.0;
}

function getNameFrequencies(mentions) {
	if (typeof app !== 'undefined' && app && app.match && typeof app.match.buildNameFrequencies === 'function') {
		return app.match.buildNameFrequencies(mentions);
	}
	if (typeof window !== 'undefined' && window.app && window.app.match && typeof window.app.match.buildNameFrequencies === 'function') {
		return window.app.match.buildNameFrequencies(mentions);
	}
	if (MatchClass) {
		if (!Score._defaultMatch) Score._defaultMatch = new MatchClass();
		return Score._defaultMatch.buildNameFrequencies(mentions);
	}
	return { firstNameFreq: new Map(), lastNameFreq: new Map() };
}

function getNameRarityModifier(value, freqMap, rarityConfig) {
	if (typeof app !== 'undefined' && app && app.match && typeof app.match.nameWeightModifier === 'function') {
		return app.match.nameWeightModifier(value, freqMap);
	}
	if (typeof window !== 'undefined' && window.app && window.app.match && typeof window.app.match.nameWeightModifier === 'function') {
		return window.app.match.nameWeightModifier(value, freqMap);
	}
	if (MatchClass) {
		if (!Score._defaultMatch) Score._defaultMatch = new MatchClass();
		return Score._defaultMatch.nameWeightModifier(value, freqMap);
	}
	return 0;
}

class Score {

	constructor(config = {})                                    // CONSTRUCTOR
	{
		if (typeof app !== 'undefined') {
			app.score = this;                                        // Register globally so tree/search/editor code can reach it via app.score
		}
		this.config = mergeConfig(DEFAULT_CONFIG, config);
	}

	JaroWinkler(s1, s2, prefixScale = 0.1, boostThreshold = 0.7) {
		return getJaroWinkler(s1, s2, prefixScale, boostThreshold);
	}

	buildNameFrequencies(mentions) {
		return getNameFrequencies(mentions);
	}

	nameWeightModifier(value, freqMap) {
		return getNameRarityModifier(value, freqMap);
	}

	getNameWeightModifier(value, freqMap) {
		return getNameRarityModifier(value, freqMap);
	}

	getNYSIIS(name) {
		return getCanonicalNYSIIS(name);
	}

	getMetaphone(name) {
		return getCanonicalMetaphone(name);
	}

	nickname(name) {
		return getCanonicalNickname(name);
	}

	_getFamilyIndex(mentions) {
		if (!this._familyIndexCache || this._familyIndexCache.mentions !== mentions) {
			const idx = new Map();
			if (Array.isArray(mentions)) {
				for (let i = 0; i < mentions.length; i++) {
					const m = mentions[i];
					const famId = getFamId(m);
					if (m.source && famId) {
						const key = m.source + '|F|' + famId;
						let list = idx.get(key);
						if (!list) {
							list = [];
							idx.set(key, list);
						}
						list.push(m);
					}
				}
			}
			this._familyIndexCache = { mentions, index: idx };
		}
		return this._familyIndexCache.index;
	}

	// Map<String(mention_id), mention> — avoids re-scanning the whole mentions table
	// for every enslaver_id lookup in _getEnslaverName.
	_getMentionIndex(mentions) {
		if (!this._mentionIndexCache || this._mentionIndexCache.mentions !== mentions) {
			const idx = new Map();
			if (Array.isArray(mentions)) {
				for (let i = 0; i < mentions.length; i++) {
					const m = mentions[i];
					if (m && m.mention_id !== undefined && m.mention_id !== null) {
						idx.set(String(m.mention_id), m);
					}
				}
			}
			this._mentionIndexCache = { mentions, index: idx };
		}
		return this._mentionIndexCache.index;
	}

	// Map<String(person_id), person> — curTree.persons may be an array or an
	// object keyed by person_id; normalize either into one lookup Map.
	_getPersonIndex(persons) {
		if (!this._personIndexCache || this._personIndexCache.persons !== persons) {
			const idx = new Map();
			const list = Array.isArray(persons) ? persons : (persons ? Object.values(persons) : []);
			for (let i = 0; i < list.length; i++) {
				const p = list[i];
				if (p && p.person_id !== undefined && p.person_id !== null) {
					idx.set(String(p.person_id), p);
				}
			}
			this._personIndexCache = { persons, index: idx };
		}
		return this._personIndexCache.index;
	}

	// Source-loading pipeline generates two mentions per 1850/1860 slave-schedule row
	// (the enslaver + the enslaved) linked by a wasEnslavedBy assertion — see
	// SKILLS/dataDescription.md. This is also the format where the enslaved person's
	// own record carries no name at all, so surfacing the enslaver's name matters most.
	isSlaveScheduleSource(source) {
		const norm = String(source || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
		return norm.includes('SS1850') || norm.includes('SS1860');
	}

	// Map<String(enslaved mention_id), enslaver mention_id> built from the wasEnslavedBy
	// (and inverse enslaves/isEnslaverOf) assertions — avoids rescanning the whole
	// assertions table for every mention that needs its enslaver resolved.
	_getEnslavedByIndex(assertions) {
		if (!this._enslavedByIndexCache || this._enslavedByIndexCache.assertions !== assertions) {
			const idx = new Map();
			if (Array.isArray(assertions)) {
				for (let i = 0; i < assertions.length; i++) {
					const a = assertions[i];
					if (!a) continue;
					if (a.predicate === 'wasEnslavedBy' && a.subject_id) {
						idx.set(String(a.subject_id), a.object_id);
					} else if ((a.predicate === 'enslaves' || a.predicate === 'isEnslaverOf') && a.object_id) {
						idx.set(String(a.object_id), a.subject_id);
					}
				}
			}
			this._enslavedByIndexCache = { assertions, index: idx };
		}
		return this._enslavedByIndexCache.index;
	}

	_getEnslaverName(m) {
		if (!m) return '';
		const globalApp = window.app || (typeof app !== 'undefined' ? app : null);

		if (m.enslaver_name) return String(m.enslaver_name).trim();
		if (m.enslaver) return typeof m.enslaver === 'string' ? m.enslaver.trim() : (m.enslaver.full_name || m.enslaver.name || '');

		let orig = m.original_data;
		if (typeof orig === 'string') {
			try { orig = JSON.parse(orig); } catch (e) { }
		}
		if (orig && typeof orig === 'object') {
			const eName = orig.enslaver || orig.enslaver_name || orig.Enslaver || orig['Enslaver Name'] || orig['enslaver_name'] || orig.owner || orig.Owner;
			if (eName && typeof eName === 'string') return eName.trim();
		}

		// Authoritative link: the wasEnslavedBy assertion generated at ingest time.
		if (globalApp && globalApp.assertions && globalApp.mentions) {
			const enslaverMentionId = this._getEnslavedByIndex(globalApp.assertions).get(String(m.mention_id));
			if (enslaverMentionId) {
				const eM = this._getMentionIndex(globalApp.mentions).get(String(enslaverMentionId));
				if (eM) {
					const name = [eM.first_name, eM.middle_name, eM.last_name].filter(Boolean).join(' ') || eM.full_name;
					if (name) return name.trim();
				}
			}
		}

		if (m.enslaver_id && globalApp) {
			if (globalApp.mentions) {
				const eM = this._getMentionIndex(globalApp.mentions).get(String(m.enslaver_id));
				if (eM) {
					const name = [eM.first_name, eM.middle_name, eM.last_name].filter(Boolean).join(' ') || eM.full_name;
					if (name) return name.trim();
				}
			}
			if (globalApp.curTree && globalApp.curTree.persons) {
				const eP = this._getPersonIndex(globalApp.curTree.persons).get(String(m.enslaver_id));
				if (eP) {
					const name = [eP.first_name, eP.last_name].filter(Boolean).join(' ');
					if (name) return name.trim();
				}
			}
		}

		// Fallback specific to 1850/1860 slave schedules: within a household, the one
		// named row with head='t' is the enslaver (the transcription format for these
		// two sources — everyone else in the household is listed by age/sex/race only,
		// with no name). Only valid for these two sources; census "head" means the
		// ordinary head-of-household and has nothing to do with enslavement.
		const famId = getFamId(m);
		if (famId && m.source && this.isSlaveScheduleSource(m.source) && globalApp && globalApp.mentions) {
			// Same grouping the family index already builds — jump straight to this
			// mention's family unit instead of rescanning the entire mentions table.
			const group = this._getFamilyIndex(globalApp.mentions).get(m.source + '|F|' + famId) || [];
			const groupEnslaver = group.find(x => {
				if (x.mention_id === m.mention_id) return false;
				const headVal = String(x.head || '').trim().toLowerCase();
				const isHead = headVal === 't' || headVal === 'true' || headVal === 'y' || headVal === 'yes';
				return isHead && (isPresent(x.first_name) || isPresent(x.full_name));
			});
			if (groupEnslaver) {
				const name = [groupEnslaver.first_name, groupEnslaver.middle_name, groupEnslaver.last_name].filter(Boolean).join(' ') || groupEnslaver.full_name;
				if (name) return name.trim();
			}
		}

		if (globalApp && globalApp.curTree && globalApp.curTree.relationships && globalApp.curTree.persons) {
			const pid = m.person_id || m.mention_id;
			const rels = globalApp.curTree.relationships;
			const personIndex = this._getPersonIndex(globalApp.curTree.persons);

			for (const r of rels) {
				let enslaverPid = null;
				if (r.predicate === 'wasEnslavedBy' && r.subject_id === pid) enslaverPid = r.object_id;
				else if ((r.predicate === 'isEnslaverOf' || r.predicate === 'enslaves') && r.object_id === pid) enslaverPid = r.subject_id;

				if (enslaverPid) {
					const eP = personIndex.get(String(enslaverPid));
					if (eP) {
						const name = [eP.first_name, eP.last_name].filter(Boolean).join(' ');
						if (name) return name.trim();
					}
				}
			}
		}

		return '';
	}

	_calculateFamilyBoost(anchorPerson, candidateMention, familyIndex = null) {
		const candidateFamId = getFamId(candidateMention);
		if (!candidateMention || !candidateMention.source || !candidateFamId) return null;

		const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
		if (!globalApp || !globalApp.mentions) return null;

		// Fallback to selected person in tree if anchorPerson not directly provided.
		// globalApp.curPerson is an array INDEX into treeApp.state.nodes (see
		// app.js selectNodeAndShowEditor), not a person_id — resolve it through that
		// array rather than comparing it directly against person_id strings.
		if (!anchorPerson && globalApp.curTree) {
			let pid = window.treeApp && window.treeApp.state && window.treeApp.state.selectedPid;
			if (!pid && typeof globalApp.curPerson === 'number' && globalApp.curPerson >= 0 && window.treeApp && window.treeApp.state && window.treeApp.state.nodes) {
				const idxNode = window.treeApp.state.nodes[globalApp.curPerson];
				pid = idxNode ? idxNode.person_id : null;
			}
			if (pid && globalApp.curTree.persons) {
				anchorPerson = Array.isArray(globalApp.curTree.persons)
					? globalApp.curTree.persons.find(p => p.person_id === pid)
					: globalApp.curTree.persons[pid];
			}
		}

		if (!anchorPerson) return null;

		if (!familyIndex) {
			familyIndex = this._getFamilyIndex(globalApp.mentions);
		}

		// 1. Get anchor person's family roster (Tree relatives + attached mentions)
		// Signature is the content (not just the count) of relationships touching this
		// anchor, so editing/replacing an edge (e.g. correcting a parent) invalidates the
		// cache even when the total relationship count is unchanged.
		const relSignature = (globalApp.curTree && globalApp.curTree.relationships)
			? globalApp.curTree.relationships
				.filter(r => r.subject_id === anchorPerson.person_id || r.object_id === anchorPerson.person_id)
				.map(r => `${r.subject_id}>${r.predicate || ''}>${r.object_id}`)
				.sort()
				.join(',')
			: '';
		const mentionsHash = (anchorPerson.mentions || []).map(m => (typeof m === 'object' ? m.mention_id : m)).join(',') + '_' + relSignature;
		let anchorRoster = anchorPerson._cachedFamilyRoster;
		if (!anchorRoster || anchorPerson._cachedMentionsHash !== mentionsHash) {
			anchorRoster = [];
			const seenNames = new Set();

			// A. Collect relatives from Tree (curTree.relationships + curTree.persons)
			if (globalApp.curTree && globalApp.curTree.relationships && globalApp.curTree.persons) {
				const personsList = Array.isArray(globalApp.curTree.persons) ? globalApp.curTree.persons : Object.values(globalApp.curTree.persons);
				const rels = globalApp.curTree.relationships.filter(r => r.subject_id === anchorPerson.person_id || r.object_id === anchorPerson.person_id);

				const seenPids = new Set([anchorPerson.person_id]);
				rels.forEach(r => {
					const relPid = r.subject_id === anchorPerson.person_id ? r.object_id : r.subject_id;
					if (!seenPids.has(relPid)) {
						seenPids.add(relPid);
						const relP = personsList.find(p => p.person_id === relPid);
						if (relP && (relP.first_name || relP.norm_first_name)) {
							const fname = (relP.first_name || relP.norm_first_name).split(':')[0].trim();
							seenNames.add(fname.toLowerCase());
							anchorRoster.push({
								person_id: relP.person_id,
								first_name: fname,
								norm_first_name: relP.norm_first_name || fname,
								last_name: relP.last_name,
								gender: relP.gender,
								norm_race: relP.race,
								birth_year: relP.birth_year,
								source: 'TREE',
								family_id: 'TREE'
							});
						}
					}
				});
			}

			// B. Collect roster members from anchor's attached mentions.
			// household_id/family_id groupings in some sources (e.g. this county's
			// 1870 census) are coarser than one dwelling — they can span 20-30+
			// unrelated households on the same enumeration page. Without a surname
			// filter, this pulls in every neighboring family as "roster", and since
			// the *candidate* roster for the anchor's own mention is the same broad
			// group, nearly everyone trivially self-matches. Require the household
			// member's surname to match the anchor's own (exact or close — OCR/
			// transcription variance) before treating them as part of this family.
			const anchorLastName = (anchorPerson.last_name || '').split(':')[0].trim().toLowerCase();
			const anchorMentions = (anchorPerson.mentions || []).map(mid => {
				if (typeof mid === 'object') return mid;
				return globalApp.mentions.find(m => m.mention_id === mid);
			}).filter(Boolean);

			anchorMentions.forEach(anchorM => {
				const anchorFamId = getFamId(anchorM);
				if (anchorM.source && anchorFamId) {
					const key = anchorM.source + '|F|' + anchorFamId;
					const fullGroup = familyIndex.get(key) || [];
					fullGroup.forEach(m => {
						if (m.mention_id !== anchorM.mention_id && (m.first_name || m.norm_first_name)) {
							const mLastName = (m.last_name || '').split(':')[0].trim().toLowerCase();
							if (anchorLastName && mLastName && anchorLastName !== mLastName && this.JaroWinkler(anchorLastName, mLastName) < 0.80) {
								return;
							}
							const fname = (m.first_name || m.norm_first_name).split(':')[0].trim().toLowerCase();
							if (!seenNames.has(fname)) {
								seenNames.add(fname);
								anchorRoster.push(m);
							}
						}
					});
				}
			});

			Object.defineProperty(anchorPerson, '_cachedFamilyRoster', {
				value: anchorRoster,
				writable: true,
				configurable: true,
				enumerable: false
			});
			Object.defineProperty(anchorPerson, '_cachedMentionsHash', {
				value: mentionsHash,
				writable: true,
				configurable: true,
				enumerable: false
			});
		}

		if (!anchorRoster || anchorRoster.length === 0) return null;

		// 2. Get candidate mention's family roster (O(1) Map lookup)
		const candKey = candidateMention.source + '|F|' + candidateFamId;
		const fullCandGroup = familyIndex.get(candKey);
		if (!fullCandGroup || fullCandGroup.length <= 1) return null;

		const candRoster = fullCandGroup.filter(m => m.mention_id !== candidateMention.mention_id);
		if (candRoster.length === 0) return null;

		// 3. Match roster members between the two family units.
		const usedCandPids = new Set();
		const code = (val) => String(val == null ? '' : val).split(':')[0].trim().toUpperCase();
		const candidatePairs = [];

		for (const aM of anchorRoster) {
			const aFirst = (aM.norm_first_name || aM.first_name || '').toLowerCase().trim().split(':')[0];
			const aLast = (aM.last_name || '').toLowerCase().trim().split(':')[0];
			const aGender = code(aM.gender);
			const aRace = code(aM.norm_race || aM.race);
			const aBY = aM.birth_year ? parseInt(aM.birth_year) : null;
			const aKey = aM.person_id || aM.mention_id;

			if (!aFirst || !aKey) continue;

			for (const cM of candRoster) {
				const cFirst = (cM.norm_first_name || cM.first_name || '').toLowerCase().trim().split(':')[0];
				const cLast = (cM.last_name || '').toLowerCase().trim().split(':')[0];

				if (!cFirst) continue;

				// Gender check
				const cGender = code(cM.gender);
				if (aGender && cGender && aGender !== cGender) continue;

				// Race check
				const cRace = code(cM.norm_race || cM.race);
				if (aRace && cRace && aRace !== cRace && !(aRace.startsWith('B') && cRace.startsWith('M')) && !(aRace.startsWith('M') && cRace.startsWith('B'))) continue;

				// Birth year check (gap <= 3 years)
				const cBY = cM.birth_year ? parseInt(cM.birth_year) : null;
				if (aBY && cBY && Math.abs(aBY - cBY) > 3) continue;

				// Last name compatibility check if both present
				if (aLast && cLast && aLast !== cLast) {
					if (this.JaroWinkler(aLast, cLast) < 0.80) {
						continue;
					}
				}

				// First name similarity
				let nameMatch = 0;
				if (aFirst === cFirst) nameMatch = 1.0;
				else if (this.JaroWinkler(aFirst, cFirst) >= 0.82) nameMatch = 0.8;

				if (nameMatch > 0.7) {
					candidatePairs.push({ aKey, cM, score: nameMatch });
				}
			}
		}

		candidatePairs.sort((a, b) => b.score - a.score);

		const usedAnchorKeys = new Set();
		const matchedKin = [];
		for (const pair of candidatePairs) {
			if (usedAnchorKeys.has(pair.aKey) || usedCandPids.has(pair.cM.mention_id)) continue;
			usedAnchorKeys.add(pair.aKey);
			usedCandPids.add(pair.cM.mention_id);
			const rawName = pair.cM.first_name || pair.cM.norm_first_name || 'Relative';
			const nameStr = rawName.split(':')[0];
			const enslaverName = this._getEnslaverName(pair.cM);
			matchedKin.push({
				name: nameStr,
				mention_id: pair.cM.mention_id,
				score: pair.score,
				...(enslaverName ? { enslaver_name: enslaverName } : {})
			});
		}

		if (matchedKin.length === 0) return null;

		// Boost = one point per matched kin (4 matched Crawfords → 4, displayed as
		// 40 via the same ×10 convention every other factor pill uses). A straight
		// count, not a ratio or a saturating curve — each confirmed relative is
		// independent evidence, so the boost should grow with how many were found.
		const boostVal = matchedKin.length;

		const candName = [candidateMention.first_name, candidateMention.last_name].filter(Boolean).join(' ') || candidateMention.mention_id;
		const matchedNames = matchedKin.map(m => m.enslaver_name ? `${m.name} (Enslaver: ${m.enslaver_name})` : m.name).join(', ');

		if (this.config.debug) {
			if (typeof window !== 'undefined' && window.console) {
				console.log(`%c[Family Boost] %c${candName} (${candidateMention.mention_id}): +${boostVal.toFixed(2)} pts (%c${matchedKin.length} matched: ${matchedNames}%c)`,
					'color: #0F3D1F; font-weight: bold; background: #E5F4E9; padding: 2px 6px; border-radius: 4px;',
					'color: #111; font-weight: bold;',
					'color: #0F3D1F; font-style: italic;',
					'color: #111;'
				);
			} else {
				console.log(`[Family Boost Trace] Anchor: ${anchorPerson.person_id} | Candidate: ${candidateMention.mention_id} (${candName}) | Matched (${matchedKin.length}): [${matchedNames}] | Boost Value: +${boostVal.toFixed(2)}`);
			}
		}

		return {
			value: boostVal,
			matches: matchedKin,
			count: matchedKin.length
		};
	}


	// -------------------------------------------------------------------------
	// Group match search (1850/1860 slave schedules) — see GroupMatch.md.
	//
	// Per-mention field scoring (Search(), below) can't work for these sources:
	// enslaved individuals in a slave-schedule row carry no name at all, only
	// age/sex/race, so any active name criterion scores them a hard 0 and buries
	// the correct household. GroupMatcher instead compares the WHOLE 1870 family
	// against each slave-schedule holding as a group (optimal age/race/gender
	// assignment + excusal-weighted group score + household age-spacing
	// structure + enslaver-surname bridge), which works even when the target
	// person individually has no clean age match in the true holding — a
	// spouse or child matching well is still strong evidence for the household.
	// -------------------------------------------------------------------------

	/**
	 * Build a GroupMatcher family1870 group from a tree person and their
	 * immediate family/household relationships (spouse, children, parents,
	 * siblings — NOT enslaver/enslaved edges, which aren't part of the 1870
	 * census family unit being matched).
	 */
	_buildFamily1870FromPerson(targetPerson) {
		const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
		const strip = (v) => (v == null ? '' : String(v).split(':')[0].trim());
		const toMember = (p) => {
			const byRaw = strip(p.birth_year);
			const by = byRaw ? Number(byRaw) : NaN;
			return {
				personId: p.person_id,
				firstName: strip(p.first_name) || undefined,
				lastName: strip(p.last_name) || undefined,
				birthYear: !isNaN(by) ? by : undefined,
				gender: strip(p.gender) || undefined,
				race: strip(p.race) || undefined,
			};
		};

		const members = [toMember(targetPerson)];
		const familyPredicates = new Set(['isChildOf', 'isParentOf', 'isSpouseOf', 'isSiblingOf']);
		if (globalApp && globalApp.curTree && globalApp.curTree.relationships && globalApp.curTree.persons) {
			const personsList = Array.isArray(globalApp.curTree.persons) ? globalApp.curTree.persons : Object.values(globalApp.curTree.persons);
			const seenPids = new Set([targetPerson.person_id]);
			globalApp.curTree.relationships.forEach(r => {
				if (!familyPredicates.has(r.predicate)) return;
				if (r.subject_id !== targetPerson.person_id && r.object_id !== targetPerson.person_id) return;
				const relPid = r.subject_id === targetPerson.person_id ? r.object_id : r.subject_id;
				if (seenPids.has(relPid)) return;
				seenPids.add(relPid);
				const relP = personsList.find(p => p.person_id === relPid);
				if (relP) members.push(toMember(relP));
			});
		}

		return {
			familyId: `FC1870-${targetPerson.person_id}`,
			county: (globalApp && globalApp.county) || undefined,
			members,
		};
	}

	/**
	 * If the target person already has a recorded enslaver relationship in the
	 * tree, and that enslaver has a mention in this slave-schedule source, this
	 * is not something the matcher needs to *discover* — it's already
	 * established. Returns { holdingKey, mention } or null.
	 */
	_findKnownEnslaverHolding(targetPerson, mentions, sourceTag) {
		const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
		if (!globalApp || !globalApp.curTree || !Array.isArray(globalApp.curTree.relationships)) return null;

		let enslaverPid = null;
		for (const r of globalApp.curTree.relationships) {
			if (r.predicate === 'wasEnslavedBy' && r.subject_id === targetPerson.person_id) { enslaverPid = r.object_id; break; }
			if ((r.predicate === 'isEnslaverOf' || r.predicate === 'enslaves') && r.object_id === targetPerson.person_id) { enslaverPid = r.subject_id; break; }
		}
		if (!enslaverPid) return null;

		const personsList = Array.isArray(globalApp.curTree.persons) ? globalApp.curTree.persons : Object.values(globalApp.curTree.persons || {});
		const enslaverPerson = personsList.find(p => p.person_id === enslaverPid);
		if (!enslaverPerson || !Array.isArray(enslaverPerson.mentions)) return null;

		for (const mid of enslaverPerson.mentions) {
			const mentionId = typeof mid === 'object' ? mid.mention_id : mid;
			const m = this._getMentionIndex(mentions).get(String(mentionId));
			if (m && m.source && m.source.indexOf(sourceTag) !== -1) {
				return { holdingKey: getFamId(m), mention: m };
			}
		}
		return null;
	}

	/** Turn one holding-level GroupMatcher result into a display-ready "mention" row. */
	_holdingToDisplayMention(matchResult, holding, isKnownLink) {
		const enslaverRow = holding && holding.enslaverRow;
		const base = enslaverRow ? Object.assign({}, enslaverRow) : {
			mention_id: matchResult.id,
			full_name: holding && holding.enslaverName
				? [holding.enslaverName.firstName, holding.enslaverName.lastName].filter(Boolean).join(' ')
				: 'Unknown enslaver',
		};
		const pct = Math.round(matchResult.probability * 100);
		base.score = matchResult.probability * 10; // same 0-10ish scale as regular Search() rawScore
		base._matchStrength = matchResult.probability;
		base._probability = matchResult.probability;
		base.factors = {};
		base._factors = {};
		base.groupMatch = matchResult;
		base._knownLink = Boolean(isKnownLink);
		const holdingSize = (holding && holding.members && holding.members.length) || matchResult.holdingSize || '?';
		base.narrative = isKnownLink
			? `Already linked in the tree — ${matchResult.components.matchedPairs} of ${holdingSize} household members matched (${pct}% group match).`
			: `Group match: ${matchResult.components.matchedPairs} of ${holdingSize} household members matched, ${pct}% probability.`;
		return base;
	}

	/**
	 * @param {object[]} mentions - the full mentions table
	 * @param {object} targetPerson - tree person the search was triggered from (needs person_id)
	 * @param {string} sourceTag - 'SS-1850' or 'SS-1860'
	 * @returns {object[]} one display-ready row per candidate holding, sorted with any
	 *   already tree-linked holding first, then by group-match probability descending
	 */
	SearchGroupMatch(mentions, targetPerson, sourceTag) {
		if (typeof GroupMatcherClass !== 'function') {
			console.error('GroupMatcher is not loaded — cannot run group match search.');
			return [];
		}
		if (!targetPerson || !targetPerson.person_id) return [];

		const family1870 = this._buildFamily1870FromPerson(targetPerson);
		const matcher = new GroupMatcherClass();
		const holdings = matcher.extractHoldings(mentions, { sourceTag });
		const holdingByKey = new Map(holdings.map(h => [h.familyId, h]));
		const holdingResults = matcher.matchAll(mentions, family1870, { sourceTag });

		const known = this._findKnownEnslaverHolding(targetPerson, mentions, sourceTag);

		const rows = holdingResults.map(r =>
			this._holdingToDisplayMention(r, holdingByKey.get(r.holdingId), known && known.holdingKey === r.holdingId));

		// Guarantee the already tree-linked holding is present even if its
		// probabilistic rank (age/sex/race evidence alone) would otherwise leave it
		// outside a truncated result set — it's already established, not something
		// that needs discovering; the search should surface it so the user can
		// attach it as a documentary source.
		if (known && !rows.some(row => row.mention_id === known.mention.mention_id)) {
			const h = holdingByKey.get(known.holdingKey);
			if (h) {
				const r = Object.assign({
					id: `${family1870.familyId}::${h.familyId}`,
					holdingId: h.familyId,
					enslaverName: h.enslaverName,
					county: h.county,
					holdingSize: h.members.length,
				}, matcher.match(h, family1870));
				rows.push(this._holdingToDisplayMention(r, h, true));
			}
		}

		rows.sort((a, b) => {
			if (a._knownLink !== b._knownLink) return a._knownLink ? -1 : 1;
			return b.groupMatch.probability - a.groupMatch.probability;
		});
		return rows;
	}

	// -------------------------------------------------------------------------
	// Mention search (merged in from the former searchMentions.js)
	// -------------------------------------------------------------------------

	/**
	 * @param {object[]} mentions - the full mentions table (or a pre-filtered slice)
	 * @param {object} search_criteria - { source, max_results, fields: [{term,value,match,rare}] }
	 * @returns {object[]} matching mentions, each with _score/_probability (pool-relative)
	 *   and _matchStrength (pool-independent, 0-1), sorted desc, truncated
	 */
	Search(mentions, search_criteria) {
		const cfg = this.config;
		const fields = search_criteria.fields || [];
		const maxResults = search_criteria.max_results || DEFAULT_MAX_RESULTS;

		const formattedSearchTerms = fields
			.filter(f => f && isPresent(f.value) && f.match !== 'Ignore' && f.value !== 'Ignore')
			.map(f => {
				const termName = f.term || f.field || 'field';
				const origValue = String(f.value).trim();
				const matchMode = f.match || f.compare || 'Exact';

				let computedTerm = origValue;

				if (termName === 'first_name' || termName === 'norm_first_name') {
					if (matchMode === 'Nickname' || matchMode === 'Canonical') {
						const nick = getCanonicalNickname(origValue);
						computedTerm = nick ? String(nick).toUpperCase() : normUpper(origValue);
					}
				} else if (termName === 'last_name' || termName === 'nysiis_last_name' || termName === 'metaphone_last_name') {
					if (matchMode === 'NYSIIS') {
						const nysiis = getCanonicalNYSIIS(origValue);
						computedTerm = nysiis || normUpper(origValue);
					} else if (matchMode === 'Metaphone') {
						const meta = getCanonicalMetaphone(origValue);
						computedTerm = meta ? (Array.isArray(meta) ? meta.join('/') : meta) : normUpper(origValue);
					}
				} else if (termName === 'birth_year') {
					const win = cfg.birthYearWindows[matchMode] !== undefined ? cfg.birthYearWindows[matchMode] : 0;
					const yearNum = Number(origValue);
					if (!isNaN(yearNum) && win > 0) {
						computedTerm = `${yearNum - win}-${yearNum + win}`;
					}
				} else if (termName === 'gender' || termName === 'norm_race') {
					const s = origValue.toUpperCase();
					if (s === 'MALE' || s === 'M') computedTerm = 'M';
					else if (s === 'FEMALE' || s === 'F') computedTerm = 'F';
					else if (s === 'BLACK' || s === 'B') computedTerm = 'B';
					else if (s === 'WHITE' || s === 'W') computedTerm = 'W';
					else if (s === 'MULATTO' || s === 'MUL') computedTerm = 'M';
				}

				return `${termName} is ${origValue} -> ${computedTerm} (${matchMode})`;
			});

		if (formattedSearchTerms.length > 0) {
			const traceFn = (typeof window !== 'undefined' && typeof window.trace === 'function') ? window.trace : (typeof console !== 'undefined' && console.trace ? console.trace.bind(console) : console.log.bind(console));
			traceFn(`-------------- SEARCH TERMS ---------------\n` + formattedSearchTerms.join('\n') + `\n-------------------------------------------\n`);
		}

		// --- Step 1: source filter ---
		const sourceMatch = (src1, src2) => {
			if (!src1 || !src2) return true;
			const s1 = String(src1).toUpperCase().replace(/[^A-Z0-9]/g, "");
			const s2 = String(src2).toUpperCase().replace(/[^A-Z0-9]/g, "");
			return s1.includes(s2) || s2.includes(s1) || s1.endsWith(s2) || s2.endsWith(s1);
		};

		let candidates = (mentions || []).filter((m) => sourceMatch(m.source, search_criteria.source));

		const isAnyTerm = Boolean(search_criteria && search_criteria.include && String(search_criteria.include).toLowerCase().includes('any'));

		const normalizeVal = (val) => {
			if (!val) return "";
			const s = String(val).split(':')[0].trim().toUpperCase();
			if (s === 'MALE' || s === 'M') return 'M';
			if (s === 'FEMALE' || s === 'F') return 'F';
			if (s === 'BLACK' || s === 'B') return 'B';
			if (s === 'WHITE' || s === 'W') return 'W';
			if (s === 'MULATTO' || s === 'MUL') return 'M';
			return s;
		};

		const raceField = fieldByTerm(fields, "norm_race");
		const raceActive = Boolean(raceField && isPresent(raceField.value) && raceField.match !== "Ignore" && raceField.value !== "Ignore");
		const targetRace = raceActive ? normalizeVal(raceField.value) : null;

		const genderField = fieldByTerm(fields, "gender");
		const genderActive = Boolean(genderField && isPresent(genderField.value) && genderField.match !== "Ignore" && genderField.value !== "Ignore");
		const targetGender = genderActive ? normalizeVal(genderField.value) : null;

		const birthField = fieldByTerm(fields, "birth_year");
		const birthActive = Boolean(birthField && birthField.match !== "Ignore" && isPresent(birthField.value));
		let birthWindow = null;
		if (birthActive) {
			birthWindow = cfg.birthYearWindows[birthField.match];
			if (birthWindow === undefined) birthWindow = 0;
		}

		const deathField = fieldByTerm(fields, "death_year");
		const deathActive = Boolean(deathField && deathField.match !== "Ignore" && isPresent(deathField.value));
		let deathWindow = null;
		if (deathActive) {
			deathWindow = cfg.birthYearWindows[deathField.match];
			if (deathWindow === undefined) deathWindow = 0;
		}

		const firstField = fieldByTerm(fields, "first_name");
		const firstActive = Boolean(firstField && firstField.match !== "Ignore" && isPresent(firstField.value));

		const lastField = fieldByTerm(fields, "last_name");
		const lastActive = Boolean(lastField && lastField.match !== "Ignore" && isPresent(lastField.value));

		// Precompute name frequencies for name scoring
		const nameFreq = getNameFrequencies(candidates);

		if (isAnyTerm) {
			const hasAnyActive = firstActive || lastActive || birthActive || deathActive || raceActive || genderActive;
			if (hasAnyActive) {
				candidates = candidates.filter((m) => {
					if (firstActive && this._scoreFirstName(m, firstField, nameFreq) > 0) return true;
					if (lastActive && this._scoreLastName(m, lastField, nameFreq) > 0) return true;
					if (birthActive && isPresent(m.birth_year) && Math.abs(Number(m.birth_year) - Number(birthField.value)) <= birthWindow) return true;
					if (deathActive && isPresent(m.death_year) && Math.abs(Number(m.death_year) - Number(deathField.value)) <= deathWindow) return true;
					if (raceActive && isPresent(m.norm_race) && normalizeVal(m.norm_race) === targetRace) return true;
					if (genderActive && isPresent(m.gender) && normalizeVal(m.gender) === targetGender) return true;
					return false;
				});
			}
		} else {
			if (raceActive) {
				candidates = candidates.filter((m) => {
					if (!isPresent(m.norm_race)) return true;
					const candRace = normalizeVal(m.norm_race);
					return !candRace || candRace === targetRace;
				});
			}
			if (genderActive) {
				candidates = candidates.filter((m) => {
					if (!isPresent(m.gender)) return true;
					const candGender = normalizeVal(m.gender);
					return !candGender || candGender === targetGender;
				});
			}
			if (birthActive) {
				candidates = candidates.filter((m) => {
					if (!isPresent(m.birth_year)) return true;
					const diff = Math.abs(Number(m.birth_year) - Number(birthField.value));
					return diff <= birthWindow;
				});
			}
			if (deathActive) {
				candidates = candidates.filter((m) => {
					if (!isPresent(m.death_year)) return true;
					const diff = Math.abs(Number(m.death_year) - Number(deathField.value));
					return diff <= deathWindow;
				});
			}
		}

		if (cfg.debug && firstField && firstField.rare && isPresent(firstField.value)) {
			const k = String(firstField.value).trim().toUpperCase().replace(/[^A-Z]/g, "");
			const freq = nameFreq.firstNameFreq.get(k) || 0;
			const mod = getNameRarityModifier(firstField.value, nameFreq.firstNameFreq, cfg.rarity);
			console.log(`[Rarity Trace]first_name: "${firstField.value}"(Key: ${k}) | Count in candidate pool(${candidates.length} mentions): ${freq} | Rarity modifier: ${mod >= 0 ? '+' : ''}${mod} `);
		}

		if (cfg.debug && lastField && lastField.rare && isPresent(lastField.value)) {
			const k = String(lastField.value).trim().toUpperCase().replace(/[^A-Z]/g, "");
			const freq = nameFreq.lastNameFreq.get(k) || 0;
			const mod = getNameRarityModifier(lastField.value, nameFreq.lastNameFreq, cfg.rarity);
			console.log(`[Rarity Trace]last_name: "${lastField.value}"(Key: ${k}) | Count in candidate pool(${candidates.length} mentions): ${freq} | Rarity modifier: ${mod >= 0 ? '+' : ''}${mod} `);
		}

		// --- Step 5: score remaining candidates on active continuous fields ---

		// Pre-resolve activePerson and familyIndex once before scoring candidates
		const famField = fieldByTerm(fields, "family_boost");
		const isFamBoostActive = !famField || famField.match !== "Ignore";
		const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
		let activePerson = null;
		let familyIndex = null;

		if (isFamBoostActive && globalApp) {
			if (globalApp.curTree) {
				// globalApp.curPerson is an array INDEX into treeApp.state.nodes (see
				// app.js selectNodeAndShowEditor), not a person_id — resolve it through
				// that array rather than comparing it directly against person_id strings.
				let pid = window.treeApp && window.treeApp.state && window.treeApp.state.selectedPid;
				if (!pid && typeof globalApp.curPerson === 'number' && globalApp.curPerson >= 0 && window.treeApp && window.treeApp.state && window.treeApp.state.nodes) {
					const idxNode = window.treeApp.state.nodes[globalApp.curPerson];
					pid = idxNode ? idxNode.person_id : null;
				}
				if (pid && globalApp.curTree.persons) {
					activePerson = Array.isArray(globalApp.curTree.persons)
						? globalApp.curTree.persons.find(p => p.person_id === pid)
						: globalApp.curTree.persons[pid];
				}
			}
			// This method lives on Score itself now, so no need to hop through
			// globalApp.score — just call our own family-boost helpers directly.
			familyIndex = this._getFamilyIndex(globalApp.mentions);
		}

		const scored = candidates.map((m) => {
			const mFactors = {};
			// One entry per ACTIVE field; null means this candidate carries no data for it.
			const levers = [];

			// First Name
			if (firstActive) {
				const fnScore = this._scoreFirstName(m, firstField, nameFreq);
				levers.push(fnScore);
				let key = "exactFirstName";
				if (firstField.match === "Fuzzy") key = "fuzzyFirstName";
				else if (firstField.match === "Nickname") key = "norm_first_name";
				mFactors[key] = { value: fnScore };

				if (firstField.rare && fnScore > 0) {
					const mod = getNameRarityModifier(firstField.value, nameFreq.firstNameFreq, cfg.rarity) / 100;
					if (mod !== 0) mFactors['rarityFirstName'] = { value: mod };
				}
			}

			// Last Name
			if (lastActive) {
				const lnScore = this._scoreLastName(m, lastField, nameFreq);
				levers.push(lnScore);
				let key = "exactLastName";
				if (lastField.match === "Fuzzy") key = "fuzzyLastName";
				else if (lastField.match === "NYSIIS") key = "exactNysiisLast";
				else if (lastField.match === "Metaphone") key = "exactSoundexLast";
				mFactors[key] = { value: lnScore };

				if (lastField.rare && lnScore > 0) {
					const mod = getNameRarityModifier(lastField.value, nameFreq.lastNameFreq, cfg.rarity) / 100;
					if (mod !== 0) mFactors['rarityLastName'] = { value: mod };
				}
			}

			// Birth Year — null when the candidate has no birth year recorded
			if (birthActive) {
				const byScore = this._scoreBirthYear(m, birthField, birthWindow);
				levers.push(byScore);
				if (byScore !== null) mFactors['birthYear'] = { value: byScore };
			}

			// Death Year — null when the candidate has no death year recorded
			if (deathActive) {
				const dyScore = this._scoreDeathYear(m, deathField, deathWindow);
				levers.push(dyScore);
				if (dyScore !== null) mFactors['deathYear'] = { value: dyScore };
			}

			// Family Boost (O(1) indexed lookup)
			let hasBaselineMatch = true;
			if (firstActive) {
				const fnScore = mFactors['exactFirstName'] ? mFactors['exactFirstName'].value : (mFactors['fuzzyFirstName'] ? mFactors['fuzzyFirstName'].value : (mFactors['norm_first_name'] ? mFactors['norm_first_name'].value : 0));
				if (fnScore <= 0) hasBaselineMatch = false;
			}
			if (lastActive) {
				const lnScore = mFactors['exactLastName'] ? mFactors['exactLastName'].value : (mFactors['fuzzyLastName'] ? mFactors['fuzzyLastName'].value : (mFactors['exactNysiisLast'] ? mFactors['exactNysiisLast'].value : (mFactors['exactSoundexLast'] ? mFactors['exactSoundexLast'].value : 0)));
				if (lnScore <= 0) hasBaselineMatch = false;
			}

			const candFamId = getFamId(m);
			if (hasBaselineMatch && isFamBoostActive && candFamId && activePerson) {
				const fRes = this._calculateFamilyBoost(activePerson, m, familyIndex);
				if (fRes && fRes.value > 0) {
					mFactors['familyBoost'] = { value: fRes.value, matches: fRes.matches };
				}
			}

			if (levers.length === 0 && !mFactors['familyBoost']) {
				return { mention: m, rawScore: 0.5, matchStrength: 0.5, factors: mFactors };
			}

			// An absent field is not evidence against a match, and it is not neutral
			// evidence for one either: drop the lever and redistribute its weight over
			// the levers that do have data (equal weights, so this is the mean of the
			// present levers scaled back up to the full active count). Scoring absence
			// as a flat 0.5 let a candidate with no recorded year outrank one whose
			// year was merely a couple of years off.
			const present = levers.filter(v => v !== null);
			let total = present.length
				? (present.reduce((a, b) => a + b, 0) / present.length) * levers.length
				: 0;
			if (mFactors['familyBoost']) {
				total += mFactors['familyBoost'].value;
			}
			const rawScore = Math.max(0, total);
			// Pool-independent strength (mean per-lever agreement, clamped to 0-1) — unlike
			// _probability below, this doesn't shift when the candidate pool composition
			// changes (e.g. loosening a filter adds more low-scoring candidates), so it's
			// safe to show as an absolute "how good is this match" indicator.
			const matchStrength = clamp(total / levers.length, 0, 1);
			return { mention: m, rawScore, matchStrength, factors: mFactors };
		});

		// --- Step 6: calibrate to probability (pool-relative softmax) ---
		// _probability is relative to the current candidate pool: useful for ranking and
		// for showing "how much better is this than the other results shown", but its
		// magnitude shifts whenever the pool composition changes (e.g. loosening a filter
		// adds more low-scoring candidates and shrinks everyone else's share) even though
		// nothing about the top candidate's evidence changed. Use _matchStrength for an
		// absolute, pool-independent confidence figure.
		const temp = cfg.softmaxTemperature || 1.0;
		const exps = scored.map((s) => Math.exp(s.rawScore / temp));
		const sumExp = exps.reduce((a, b) => a + b, 0) || 1;

		const results = scored.map((s, i) => ({
			...s.mention,
			score: s.rawScore,
			_score: s.rawScore,
			_probability: exps[i] / sumExp,
			_matchStrength: s.matchStrength,
			factors: s.factors,
			_factors: s.factors
		}));

		// --- Step 7: sort + truncate ---
		results.sort((a, b) => b._probability - a._probability);
		return results.slice(0, maxResults);
	}

	// -------------------------------------------------------------------------
	// Field scorers
	// -------------------------------------------------------------------------

	_scoreFirstName(mention, field, nameFreq) {
		const cfg = this.config;
		if (!isPresent(field.value)) return 0;

		const searchNorm = normUpper(field.value);
		const searchCanonical = normUpper(getCanonicalNickname(field.value));

		const firstNorm = isPresent(mention.first_name) ? normUpper(mention.first_name) : "";
		const normNorm = isPresent(mention.norm_first_name) ? normUpper(mention.norm_first_name) : "";
		const candCanonical = (normNorm && getCanonicalNickname(normNorm))
			|| (firstNorm ? normUpper(getCanonicalNickname(firstNorm)) : normNorm);

		if (!firstNorm && !normNorm && !candCanonical) return 0;

		const isPrefixOrStem = (a, b) => a && b && a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a));

		let base = 0.0;
		switch (field.match) {
			case "Exact": {
				if (searchNorm === firstNorm || searchNorm === normNorm || (searchCanonical && searchCanonical === candCanonical)) {
					base = 1.0;
				} else if (isPrefixOrStem(searchNorm, firstNorm) || isPrefixOrStem(searchNorm, normNorm) || isPrefixOrStem(searchCanonical, candCanonical)) {
					base = 0.95;
				}
				break;
			}
			case "Fuzzy": {
				const jw1 = firstNorm ? this.JaroWinkler(searchNorm, firstNorm) : 0;
				const jw2 = normNorm ? this.JaroWinkler(searchNorm, normNorm) : 0;
				const jw3 = (searchCanonical && candCanonical) ? this.JaroWinkler(searchCanonical, candCanonical) : 0;
				const maxJw = Math.max(jw1, jw2, jw3);
				if (isPrefixOrStem(searchNorm, firstNorm) || isPrefixOrStem(searchNorm, normNorm) || isPrefixOrStem(searchCanonical, candCanonical)) {
					base = Math.max(maxJw, 0.95);
				} else {
					base = maxJw >= cfg.jwFuzzyPassThreshold ? maxJw : 0.0;
				}
				break;
			}
			case "Nickname": {
				if (searchCanonical && candCanonical && searchCanonical === candCanonical) {
					base = 1.0;
				} else if (searchNorm === firstNorm || searchNorm === normNorm) {
					base = 1.0;
				} else if (isPrefixOrStem(searchNorm, firstNorm) || isPrefixOrStem(searchNorm, normNorm) || isPrefixOrStem(searchCanonical, candCanonical)) {
					base = 0.95;
				} else {
					const jw = this.JaroWinkler(searchCanonical, candCanonical);
					base = jw >= cfg.jwFuzzyPassThreshold ? jw * 0.9 : 0.0;
				}
				break;
			}
			default: {
				if (searchNorm === firstNorm || searchNorm === normNorm || (searchCanonical && searchCanonical === candCanonical)) {
					base = 1.0;
				} else if (isPrefixOrStem(searchNorm, firstNorm) || isPrefixOrStem(searchNorm, normNorm) || isPrefixOrStem(searchCanonical, candCanonical)) {
					base = 0.95;
				}
			}
		}

		if (field.rare && base > 0) {
			const modifier = getNameRarityModifier(field.value, nameFreq.firstNameFreq, cfg.rarity) / 100;
			base = clamp(base + modifier, 0, 1);
		}
		return base;
	}

	_scoreLastName(mention, field, nameFreq) {
		const cfg = this.config;
		if (!isPresent(mention.last_name) && !isPresent(mention.full_name)) return 0;

		const searchNorm = normUpper(field.value);
		const candLast = normUpper(mention.last_name || '');
		// Word-preserving normalization for full_name so containment checks match whole
		// name tokens (e.g. "ANN" inside "MARY ANN SMITH") rather than arbitrary substrings
		// (e.g. "ANN" inside "SUSANNAH", which normUpper's space-stripping used to allow).
		const candFullWords = isPresent(mention.full_name)
			? String(mention.full_name).trim().toUpperCase().replace(/[^A-Z\s]/g, "").replace(/\s+/g, " ").split(" ").filter(Boolean)
			: [];
		const candFull = normUpper(mention.full_name || '');
		const candNorm = candLast || candFull;
		const fullContainsWord = (token) => candFullWords.includes(token);

		const isPrefixOrStem = (a, b) => a && b && a.length >= 2 && b.length >= 2 && (a.startsWith(b) || b.startsWith(a));

		let base = 0.0;
		switch (field.match) {
			case "Exact": {
				if (searchNorm === candLast || searchNorm === candNorm || fullContainsWord(searchNorm)) {
					base = 1.0;
				} else if (isPrefixOrStem(searchNorm, candLast) || isPrefixOrStem(searchNorm, candNorm)) {
					base = 0.95;
				} else {
					base = 0.0;
				}
				break;
			}
			case "Fuzzy": {
				const jw1 = candLast ? this.JaroWinkler(searchNorm, candLast) : 0;
				const jw2 = candFull ? this.JaroWinkler(searchNorm, candFull) : 0;
				const jw = Math.max(jw1, jw2);
				if (isPrefixOrStem(searchNorm, candLast) || fullContainsWord(searchNorm)) {
					base = Math.max(jw, 0.95);
				} else {
					base = jw >= cfg.jwFuzzyPassThreshold ? jw : 0.0;
				}
				break;
			}
			case "NYSIIS": {
				if (isPresent(mention.nysiis_last_name)) {
					const searchCode = getCanonicalNYSIIS(field.value);
					base = searchCode === mention.nysiis_last_name ? 0.85 : 0.0;
				} else {
					base = (searchNorm === candLast || fullContainsWord(searchNorm)) ? 0.85 : 0.0;
				}
				break;
			}
			case "Metaphone": {
				if (isPresent(mention.metaphone_last_name)) {
					base = getDoubleMetaphoneMatchScore(field.value, mention.metaphone_last_name);
				} else {
					base = (searchNorm === candLast || fullContainsWord(searchNorm)) ? 1.0 : 0.0;
				}
				break;
			}
			default:
				base = 0;
		}

		if (field.rare && base > 0) {
			const modifier = getNameRarityModifier(field.value, nameFreq.lastNameFreq, cfg.rarity) / 100;
			base = clamp(base + modifier, 0, 1);
		}
		return base;
	}

	_scoreBirthYear(mention, field, window) {
		if (!isPresent(mention.birth_year)) return null; // no data: caller drops this lever
		const diff = Math.abs(Number(mention.birth_year) - Number(field.value));
		if (window === 0) return diff === 0 ? 1.0 : 0.0;
		// Smooth falloff within the chosen window; diff already guaranteed <= window (Step 3 filtered).
		const sigma = window / 2;
		return Math.exp(-(diff * diff) / (2 * sigma * sigma));
	}

	_scoreDeathYear(mention, field, window) {
		if (!isPresent(mention.death_year)) return null; // no data: caller drops this lever
		const diff = Math.abs(Number(mention.death_year) - Number(field.value));
		if (window === 0) return diff === 0 ? 1.0 : 0.0;
		const sigma = window / 2;
		return Math.exp(-(diff * diff) / (2 * sigma * sigma));
	}

}

if (typeof window !== 'undefined') window.Score = Score;                                            // EXPORT GLOBALLY

if (typeof module !== 'undefined' && module.exports) {
	module.exports = { Score };
}
