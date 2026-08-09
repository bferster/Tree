

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RESULTS = 80;

const DEFAULT_CONFIG = {
	jaroWinkler: null, // REQUIRED: (a, b) => number in [0,1]

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
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SearchMentions
// ---------------------------------------------------------------------------

// Ensure Normalize class resolution across environments
const NormalizeClass = (typeof Normalize !== 'undefined')
	? Normalize
	: ((typeof window !== 'undefined' && window.Normalize)
		? window.Normalize
		: (typeof require !== 'undefined' ? require('./normalize') : null));

function jaroWinkler(s1, s2, p = 0.1) {
	s1 = (s1 || "").toLowerCase();
	s2 = (s2 || "").toLowerCase();
	if (s1 === s2) return 1.0;
	const len1 = s1.length, len2 = s2.length;
	if (len1 === 0 || len2 === 0) return 0.0;
	const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
	const s1Matches = new Array(len1).fill(false);
	const s2Matches = new Array(len2).fill(false);
	let matches = 0, trans = 0;
	for (let i = 0; i < len1; i++) {
		const start = Math.max(0, i - matchDistance);
		const end = Math.min(i + matchDistance + 1, len2);
		for (let j = start; j < end; j++) {
			if (s2Matches[j]) continue;
			if (s1[i] !== s2[j]) continue;
			s1Matches[i] = true;
			s2Matches[j] = true;
			matches++;
			break;
		}
	}
	if (matches === 0) return 0.0;
	let k = 0;
	for (let i = 0; i < len1; i++) {
		if (!s1Matches[i]) continue;
		while (!s2Matches[k]) k++;
		if (s1[i] !== s2[k]) trans++;
		k++;
	}
	const m = matches;
	const jaro = (m / len1 + m / len2 + (m - trans / 2) / m) / 3;
	let l = 0;
	while (l < 4 && s1[l] && s1[l] === s2[l]) l++;
	return jaro + l * p * (1 - jaro);
}

class SearchMentions {
	/**
	 * @param {object[]} mentions - the full mentions table (or a pre-filtered slice)
	 * @param {object} config - see DEFAULT_CONFIG; jaroWinkler is optional with built-in default
	 */
	constructor(mentions, config = {}) {
		this.mentions = mentions || [];
		if (!config.jaroWinkler) {
			config.jaroWinkler = jaroWinkler;
		}
		this.config = mergeConfig(DEFAULT_CONFIG, config);
		if (typeof this.config.jaroWinkler !== "function") {
			this.config.jaroWinkler = jaroWinkler;
		}
	}

	/**
	 * @param {object} search_criteria - { source, max_results, fields: [{term,value,match,rare}] }
	 * @returns {object[]} matching mentions, each with _score/_probability, sorted desc, truncated
	 */
	Search(search_criteria) {
		const cfg = this.config;
		const fields = search_criteria.fields || [];
		const maxResults = search_criteria.max_results || DEFAULT_MAX_RESULTS;

		// --- Step 1: source filter ---
		let candidates = this.mentions.filter((m) => m.source === search_criteria.source);

		// --- Step 2: hard-block fields (norm_race, gender) ---
		const raceField = fieldByTerm(fields, "norm_race");
		if (raceField && isPresent(raceField.value) && raceField.match !== "Ignore" && raceField.value !== "Ignore") {
			candidates = candidates.filter((m) => !isPresent(m.norm_race) || m.norm_race === raceField.value);
		}

		const genderField = fieldByTerm(fields, "gender");
		if (genderField && isPresent(genderField.value) && genderField.match !== "Ignore" && genderField.value !== "Ignore") {
			candidates = candidates.filter((m) => !isPresent(m.gender) || m.gender === genderField.value);
		}

		// --- Step 3: birth_year hard window (knockout beyond the chosen tolerance) ---
		const birthField = fieldByTerm(fields, "birth_year");
		const birthActive = birthField && birthField.match !== "Ignore" && isPresent(birthField.value);
		let birthWindow = null;
		if (birthActive) {
			birthWindow = cfg.birthYearWindows[birthField.match];
			if (birthWindow === undefined) birthWindow = 0;
			candidates = candidates.filter((m) => {
				if (!isPresent(m.birth_year)) return true; // absence is not evidence against a match
				const diff = Math.abs(Number(m.birth_year) - Number(birthField.value));
				return diff <= birthWindow;
			});
		}

		// --- Step 3b: death_year hard window ---
		const deathField = fieldByTerm(fields, "death_year");
		const deathActive = deathField && deathField.match !== "Ignore" && isPresent(deathField.value);
		let deathWindow = null;
		if (deathActive) {
			deathWindow = cfg.birthYearWindows[deathField.match];
			if (deathWindow === undefined) deathWindow = 0;
			candidates = candidates.filter((m) => {
				if (!isPresent(m.death_year)) return true;
				const diff = Math.abs(Number(m.death_year) - Number(deathField.value));
				return diff <= deathWindow;
			});
		}

		// --- Step 4: precompute rarity pool (post-blocking, pre-name-scoring) ---
		const nameFreq = (NormalizeClass && NormalizeClass.buildNameFrequencies) ? NormalizeClass.buildNameFrequencies(candidates) : { firstNameFreq: new Map(), lastNameFreq: new Map() };

		const firstField = fieldByTerm(fields, "first_name");
		const lastField = fieldByTerm(fields, "last_name");

		if (firstField && firstField.rare && isPresent(firstField.value)) {
			const k = String(firstField.value).trim().toUpperCase().replace(/[^A-Z]/g, "");
			const freq = nameFreq.firstNameFreq.get(k) || 0;
			const mod = (NormalizeClass && NormalizeClass.getNameWeightModifier) ? NormalizeClass.getNameWeightModifier(firstField.value, nameFreq.firstNameFreq, cfg.rarity) : 0;
			console.log(`[Rarity Trace] first_name: "${firstField.value}" (Key: ${k}) | Count in candidate pool (${candidates.length} mentions): ${freq} | Rarity modifier: ${mod >= 0 ? '+' : ''}${mod}`);
		}

		if (lastField && lastField.rare && isPresent(lastField.value)) {
			const k = String(lastField.value).trim().toUpperCase().replace(/[^A-Z]/g, "");
			const freq = nameFreq.lastNameFreq.get(k) || 0;
			const mod = (NormalizeClass && NormalizeClass.getNameWeightModifier) ? NormalizeClass.getNameWeightModifier(lastField.value, nameFreq.lastNameFreq, cfg.rarity) : 0;
			console.log(`[Rarity Trace] last_name: "${lastField.value}" (Key: ${k}) | Count in candidate pool (${candidates.length} mentions): ${freq} | Rarity modifier: ${mod >= 0 ? '+' : ''}${mod}`);
		}

		// --- Step 5: score remaining candidates on active continuous fields ---

		const activeFieldScorers = [];
		if (firstField && firstField.match !== "Ignore" && isPresent(firstField.value)) {
			activeFieldScorers.push((m) => this._scoreFirstName(m, firstField, nameFreq));
		}
		if (lastField && lastField.match !== "Ignore" && isPresent(lastField.value)) {
			activeFieldScorers.push((m) => this._scoreLastName(m, lastField, nameFreq));
		}
		if (birthActive) {
			activeFieldScorers.push((m) => this._scoreBirthYear(m, birthField, birthWindow));
		}
		if (deathActive) {
			activeFieldScorers.push((m) => this._scoreDeathYear(m, deathField, deathWindow));
		}

		// Pre-resolve activePerson and familyIndex once before scoring candidates
		const famField = fieldByTerm(fields, "family_boost");
		const isFamBoostActive = !famField || famField.match !== "Ignore";
		const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
		let activePerson = null;
		let familyIndex = null;

		if (isFamBoostActive && globalApp) {
			if (globalApp.curTree) {
				const pid = (window.treeApp && window.treeApp.state && window.treeApp.state.selectedPid) || globalApp.curPerson;
				if (pid && globalApp.curTree.persons) {
					activePerson = Array.isArray(globalApp.curTree.persons) 
						? globalApp.curTree.persons.find(p => p.person_id === pid) 
						: globalApp.curTree.persons[pid];
				}
			}
			if (globalApp.score && typeof globalApp.score._getFamilyIndex === 'function') {
				familyIndex = globalApp.score._getFamilyIndex(globalApp.mentions);
			}
		}

		const scored = candidates.map((m) => {
			const mFactors = {};

			// First Name
			if (firstField && firstField.match !== "Ignore" && isPresent(firstField.value)) {
				const fnScore = this._scoreFirstName(m, firstField, nameFreq);
				let key = "exactFirstName";
				if (firstField.match === "Fuzzy") key = "fuzzyFirstName";
				else if (firstField.match === "Nickname") key = "norm_first_name";
				mFactors[key] = { value: fnScore };

				if (firstField.rare && fnScore > 0 && NormalizeClass && NormalizeClass.getNameWeightModifier) {
					const mod = NormalizeClass.getNameWeightModifier(firstField.value, nameFreq.firstNameFreq, cfg.rarity) / 100;
					if (mod !== 0) mFactors['rarityFirstName'] = { value: mod };
				}
			}

			// Last Name
			if (lastField && lastField.match !== "Ignore" && isPresent(lastField.value)) {
				const lnScore = this._scoreLastName(m, lastField, nameFreq);
				let key = "exactLastName";
				if (lastField.match === "Fuzzy") key = "fuzzyLastName";
				else if (lastField.match === "NYSIIS") key = "exactNysiisLast";
				else if (lastField.match === "Metaphone") key = "exactSoundexLast";
				mFactors[key] = { value: lnScore };

				if (lastField.rare && lnScore > 0 && NormalizeClass && NormalizeClass.getNameWeightModifier) {
					const mod = NormalizeClass.getNameWeightModifier(lastField.value, nameFreq.lastNameFreq, cfg.rarity) / 100;
					if (mod !== 0) mFactors['rarityLastName'] = { value: mod };
				}
			}

			// Birth Year
			if (birthActive) {
				const byScore = this._scoreBirthYear(m, birthField, birthWindow);
				mFactors['birthYear'] = { value: byScore };
			}

			// Death Year
			if (deathActive) {
				const dyScore = this._scoreDeathYear(m, deathField, deathWindow);
				mFactors['deathYear'] = { value: dyScore };
			}

			// Family Boost (O(1) indexed lookup)
			if (isFamBoostActive && m.family_id && activePerson && globalApp && globalApp.score) {
				const fRes = globalApp.score._calculateFamilyBoost(activePerson, m, fields, familyIndex);
				if (fRes && fRes.value > 0) {
					mFactors['familyBoost'] = { value: fRes.value, matches: fRes.matches };
				}
			}

			if (activeFieldScorers.length === 0 && !mFactors['familyBoost']) {
				return { mention: m, rawScore: 0.5, factors: mFactors };
			}
			let total = 0;
			for (const scorer of activeFieldScorers) {
				total += scorer(m);
			}
			if (mFactors['familyBoost']) {
				total += mFactors['familyBoost'].value;
			}
			const rawScore = Math.max(0, total);
			return { mention: m, rawScore, factors: mFactors };
		});

		// --- Step 6: calibrate to probability (pool-relative softmax) ---
		const temp = cfg.softmaxTemperature || 1.0;
		const exps = scored.map((s) => Math.exp(s.rawScore / temp));
		const sumExp = exps.reduce((a, b) => a + b, 0) || 1;

		const results = scored.map((s, i) => ({
			...s.mention,
			score: s.rawScore,
			_score: s.rawScore,
			_probability: exps[i] / sumExp,
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
		const candValue = isPresent(mention.norm_first_name) ? mention.norm_first_name : mention.first_name;
		if (!isPresent(candValue)) return 0;

		const searchNorm = normUpper(field.value);
		const candNorm = normUpper(candValue);

		let base;
		switch (field.match) {
			case "Exact":
				base = searchNorm === candNorm ? 1.0 : 0.0;
				break;
			case "Fuzzy": {
				const jw = cfg.jaroWinkler(searchNorm, candNorm);
				base = jw >= cfg.jwFuzzyPassThreshold ? jw : 0.0;
				break;
			}
			case "Nickname": {
				// mention.norm_first_name is already nickname-normalized at ingest
				// (normalize.js). Normalize the typed search value the same way.
				const searchCanonical = normUpper(NormalizeClass ? NormalizeClass.getNickname(field.value) : field.value);
				const candCanonical = isPresent(mention.norm_first_name)
					? normUpper(mention.norm_first_name)
					: normUpper(NormalizeClass ? NormalizeClass.getNickname(candValue) : candValue);
				if (searchCanonical === candCanonical) {
					base = 1.0;
				} else {
					const jw = cfg.jaroWinkler(searchCanonical, candCanonical);
					base = jw >= cfg.jwFuzzyPassThreshold ? jw * 0.9 : 0.0; // slightly below a direct nickname hit
				}
				break;
			}
			default:
				base = 0;
		}

		if (field.rare && base > 0) {
			const modifier = (NormalizeClass && NormalizeClass.getNameWeightModifier) ? NormalizeClass.getNameWeightModifier(field.value, nameFreq.firstNameFreq, cfg.rarity) / 100 : 0;
			base = clamp(base + modifier, 0, 1);
		}
		return base;
	}

	_scoreLastName(mention, field, nameFreq) {
		const cfg = this.config;
		if (!isPresent(mention.last_name) && !isPresent(mention.full_name)) return 0;

		const searchNorm = normUpper(field.value);
		const candNorm = normUpper(mention.last_name);

		let base;
		switch (field.match) {
			case "Exact":
				base = searchNorm === candNorm ? 1.0 : 0.0;
				break;
			case "Fuzzy": {
				const jw = cfg.jaroWinkler(searchNorm, candNorm);
				base = jw >= cfg.jwFuzzyPassThreshold ? jw : 0.0;
				break;
			}
			case "NYSIIS": {
				// mention.nysiis_last_name is precomputed at ingest (normalize.js).
				// Encode the typed search value the same way and compare directly.
				if (isPresent(mention.nysiis_last_name)) {
					const searchCode = NormalizeClass ? NormalizeClass.getNYSIIS(field.value) : normUpper(field.value);
					base = searchCode === mention.nysiis_last_name ? 0.85 : 0.0;
				} else {
					base = searchNorm === candNorm ? 0.85 : 0.0;
				}
				break;
			}
			case "Metaphone": {
				// mention.metaphone_last_name is precomputed at ingest (normalize.js)
				// as "PRIMARY:SECONDARY". Encode the typed search value the same
				// way, then compare using doubleMetaphoneMatchScore.
				if (isPresent(mention.metaphone_last_name)) {
					base = NormalizeClass ? NormalizeClass.doubleMetaphoneMatchScore(field.value, mention.metaphone_last_name) : (searchNorm === candNorm ? 1.0 : 0.0);
				} else {
					base = searchNorm === candNorm ? 1.0 : 0.0;
				}
				break;
			}
			default:
				base = 0;
		}

		if (field.rare && base > 0) {
			const modifier = (NormalizeClass && NormalizeClass.getNameWeightModifier) ? NormalizeClass.getNameWeightModifier(field.value, nameFreq.lastNameFreq, cfg.rarity) / 100 : 0;
			base = clamp(base + modifier, 0, 1);
		}
		return base;
	}

	_scoreBirthYear(mention, field, window) {
		if (!isPresent(mention.birth_year)) return 0.5; // absence excluded from penalty, neutral contribution
		const diff = Math.abs(Number(mention.birth_year) - Number(field.value));
		if (window === 0) return diff === 0 ? 1.0 : 0.0;
		// Smooth falloff within the chosen window; diff already guaranteed <= window (Step 3 filtered).
		const sigma = window / 2;
		return Math.exp(-(diff * diff) / (2 * sigma * sigma));
	}

	_scoreDeathYear(mention, field, window) {
		if (!isPresent(mention.death_year)) return 0.5;
		const diff = Math.abs(Number(mention.death_year) - Number(field.value));
		if (window === 0) return diff === 0 ? 1.0 : 0.0;
		const sigma = window / 2;
		return Math.exp(-(diff * diff) / (2 * sigma * sigma));
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = { SearchMentions };
}
if (typeof window !== 'undefined') {
	window.SearchMentions = SearchMentions;
}
