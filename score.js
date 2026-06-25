class Score {

	constructor(options = {})                                    // CONSTRUCTOR
	{
		app.score = this;
		this.jwThresholds = Object.assign({ default: 0.85 }, options.jwThresholds); // Set thresholds
		this.nameFields = ['first_name', 'middle_name', 'last_name', 'norm_first_name', 'nysiis_last_name', 'soundex_last_name'];
		this.skipFields = new Set(options.skipFields || ['race', 'gender', 'suffix']); // Set skip fields
		this.useSmartName = true;
		this.SmartNameScore = 0.0;
	}

	ScoreMentions(blockedMentions, factors, sources, smartName)            // SCORE ALL MENTIONS
	{
		let i, mention;

		if (sources && sources.length > 0) {
			const normalizeSrc = (src) => {
				if (!src) return '';
				let s = String(src).replace(/-/g, '_').toLowerCase().trim();
				const map = {
					'alb_fg': 'alb_findagrave',
					'alb_findagrave': 'alb_findagrave',
					'alb_fbr_1800': 'alb_fbr',
					'alb_fbr': 'alb_fbr'
				};
				return map[s] || s;
			};
			const normalizedSources = sources.map(s => normalizeSrc(s));
			blockedMentions = blockedMentions.filter(m => {
				const normSrc = normalizeSrc(m.source);
				return normSrc && normalizedSources.includes(normSrc);
			});
		}

		let useSmart = smartName !== undefined ? smartName : this.useSmartName;
		for (i = 0; i < blockedMentions.length; i++) {
			mention = blockedMentions[i];
			if (!mention) continue;
			this.ScoreFactor(factors, mention, useSmart);			// Run ScoreFactor to calculate individual factor scores for this mention
			let totalScore = 0;
			let mentionFactors = {};

			// Map SmartNameScore — apply IMPACT multiplier from first_name factor if set
			if (useSmart) {
				let smartScore = this.SmartNameScore;
				const firstNameFactor = factors.find(f => f.field === 'first_name');
				if (firstNameFactor) {
					const impact = firstNameFactor.impact || 0;
					if (impact > 0) {
						smartScore *= 2;               // Double SmartNameScore for IMPACT +
					} else if (impact < 0) {
						smartScore *= 0.5;             // Halve SmartNameScore for IMPACT -
					}
				}
				totalScore += smartScore;
				mentionFactors['smartName'] = { value: smartScore };
			}

			for (let f of factors) {			// Map to MentionsEditor FACTOR_LABELS format
				// Normalize compare value (may be an array or a string)
				const fcmp = Array.isArray(f.compare) ? f.compare.find(x => x !== 'rare') || 'ignore' : (f.compare || 'ignore');
				if (fcmp === 'ignore') continue;
				if (!useSmart || !this.nameFields.includes(f.field)) {
					totalScore += f.score;
				}
				if (f.field === 'birth_year') {
					mentionFactors['birthYear'] = { value: f.score };
				} else if (f.field === 'death_year') {
					mentionFactors['deathYear'] = { value: f.score };
				} else if (f.field === 'first_name') {
					if (fcmp === 'exact') mentionFactors['exactFirstName'] = { value: f.score };
					else if (fcmp === 'fuzzy') mentionFactors['fuzzyFirstName'] = { value: f.score };
				} else if (f.field === 'last_name') {
					if (fcmp === 'exact') mentionFactors['exactLastName'] = { value: f.score };
					else if (fcmp === 'fuzzy') mentionFactors['fuzzyLastName'] = { value: f.score };
				} else if (f.field === 'norm_first_name') {
					if (fcmp === 'exact') mentionFactors['exactFirstName'] = { value: f.score };
					else if (fcmp === 'fuzzy') mentionFactors['fuzzyFirstName'] = { value: f.score };
				} else if (f.field === 'nysiis_last_name') {
					mentionFactors['exactNysiisLast'] = { value: f.score };
				} else if (f.field === 'soundex_last_name') {
					mentionFactors['exactSoundexLast'] = { value: f.score };
				}

				// Check if this factor has rare comparison enabled
				let isRare = f.rare || false;
				if (Array.isArray(f.compare)) {
					isRare = isRare || f.compare.includes('rare');
				} else if (typeof f.compare === 'string') {
					isRare = isRare || f.compare.includes('rare');
				}

				if (isRare && f.score > 0 && !Score.IsAbsent(mention[f.field])) {
					let freqMap = (f.field === 'first_name' || f.field === 'middle_name' || f.field === 'norm_first_name') ? app.firstNameFreq : app.lastNameFreq;
					let rarityScore = app.GetNameWeightModifier(mention[f.field], freqMap);
					totalScore += rarityScore;

					if (f.field === 'first_name' || f.field === 'middle_name' || f.field === 'norm_first_name') {
						mentionFactors['rarityFirstName'] = { value: rarityScore };
					} else if (f.field === 'last_name') {
						mentionFactors['rarityLastName'] = { value: rarityScore };
					} else if (f.field === 'nysiis_last_name') {
						mentionFactors['rarityNysiisLast'] = { value: rarityScore };
					} else if (f.field === 'soundex_last_name') {
						mentionFactors['raritySoundexLast'] = { value: rarityScore };
					}
				}
			}

			mention.score = totalScore;
			mention.factors = mentionFactors;
		}

		blockedMentions.sort((a, b) => (b.score || 0) - (a.score || 0)); 		// Sort the mention objects by score in descending order
		let mention_ids = blockedMentions.map(m => m.mention_id);
		return { mentions: blockedMentions, mention_ids, factors, totalScore: 0 };
	}

	ScoreFactor(factors, mention, smartName)              // SCORE SINGLE FACTOR
	{
		let byField = {};                                        // Init lookup
		for (let f of factors) byField[f.field] = f;             // Populate lookup
		let consumed = new Set();                                // Init consumed set
		this.SmartNameScore = 0.0;
		let useSmart = smartName !== undefined ? smartName : this.useSmartName;
		if (useSmart) {                                  // If smart name matching
			let v = (field) => (byField[field] ? byField[field].value : undefined); // Value helper
			let firstMatch = Score.StrEq(v('first_name'), mention.first_name); // First name match
			let middleMatch = Score.StrEq(v('middle_name'), mention.middle_name); // Middle name match
			let lastMatch = Score.StrEq(v('last_name'), mention.last_name); // Last name match

			let matchScore = 0.0;                                // Init score
			if (firstMatch && middleMatch && lastMatch) {
				matchScore = 1.0; // Exact match
			} else if (firstMatch && lastMatch) {
				matchScore = 0.95; // First and last
			} else {
				let initialMatch = Score.InitialEq(v('first_name'), mention.first_name) && Score.InitialEq(v('last_name'), mention.last_name); // Initials match
				if (initialMatch) {
					matchScore = 0.9;             // Initials
				} else {
					let normLast = Score.StrEq(v('norm_first_name'), mention.norm_first_name) && lastMatch; // Norm first and last match
					if (normLast) {
						matchScore = 0.90;                // Norm last
					} else {
						// Only perform expensive Jaro-Winkler string comparison if fast matches fail
						let jwBoth = this.JwAbove(v('norm_first_name'), mention.norm_first_name, 'norm_first_name') && this.JwAbove(v('last_name'), mention.last_name, 'last_name'); // JW both
						if (jwBoth) {
							matchScore = 0.70;                  // JW both
						} else {
							let nysiisMatch = Score.StrEq(v('nysiis_last_name'), mention.nysiis_last_name); // NYSIIS match
							if (nysiisMatch) {
								matchScore = 0.60;             // NYSIIS
							} else {
								let soundexMatch = Score.StrEq(v('soundex_last_name'), mention.soundex_last_name); // Soundex match
								if (soundexMatch) {
									matchScore = 0.50;            // Soundex
								}
							}
						}
					}
				}
			}

			this.SmartNameScore = matchScore;                   // Store score
		}

		for (let factor of factors) {                         	 // Loop remaining factors
			let field = factor.field;                            // Get field
			let compare = factor.compare;                        // Get compare mode

			let isRare = factor.rare || false;                   // Init rare flag
			if (Array.isArray(compare)) {                        // If array
				isRare = isRare || compare.includes('rare');     // Check rare
				compare = compare.find(x => x !== 'rare');       // Extract true mode
			} else if (typeof compare === 'string' && compare.includes('rare')) { // If string contains rare
				isRare = true;                                   // Set rare
				compare = compare.replace('rare', '').trim();    // Strip rare
			}

			if (this.skipFields.has(field)) continue;            // Skip if blocked
			if (consumed.has(field)) continue;                	 // Skip if consumed

			let candidate = mention[field];                      // Get candidate value

			if (compare == 'ignore') {                           // If ignore
				factor.score = 0.0;                              // Score 0
			} else if (compare == 'exact' || (!compare && isRare)) {                     // If exact or only rare
				if (field == 'birth_year' || field == 'death_year') {
					factor.score = this.ScoreYear(factor.value, candidate, compare);
				} else {
					factor.score = Score.StrEq(factor.value, candidate) ? 1.0 : 0.0; // Exact match
				}
			} else if (field == 'birth_year' || field == 'death_year') { 		// If years
				factor.score = this.ScoreYear(factor.value, candidate, compare); 		// Band match

			} else if (compare == 'fuzzy') {                     // If fuzzy
				if (Score.IsAbsent(factor.value) || Score.IsAbsent(candidate)) { // If absent
					factor.score = 0.0;                          // Score 0
				} else {
					let jw = this.JaroWinkler(String(factor.value), String(candidate)); // Calc JW score
					factor.score = jw > this.JwThresholdFor(field) ? jw : 0.0; 	// Assign actual JW
				}
			} else {                                           	// Else
				factor.score = 0.0;                            	// Unknown mode
			}

			// Apply IMPACT multiplier: +1 doubles score, -1 halves score
			if (compare !== 'ignore') {
				const impact = factor.impact || 0;
				if (impact > 0) {
					factor.score *= 2;                           // Double for positive IMPACT
				} else if (impact < 0) {
					factor.score *= 0.5;                         // Halve for negative IMPACT
				}
			}
		}
		return factors;                                        // Return factors
	}

	JaroWinkler(s1, s2)                                        // JARO-WINKLER DISTANCE
	{
		if (!s1 || !s2) return 0.0;                            // Quit if empty
		s1 = s1.toLowerCase();                                   // Lowercase s1
		s2 = s2.toLowerCase();                                   // Lowercase s2
		if (s1 == s2) return 1.0;                                // Exact match
		let matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1; // Match distance
		let s1Matches = new Array(s1.length).fill(false);        // Init s1 matches
		let s2Matches = new Array(s2.length).fill(false);        // Init s2 matches
		let matches = 0;                                         // Match count

		for (let i = 0; i < s1.length; ++i) {                    // Loop s1
			let start = Math.max(0, i - matchDistance);          // Start index
			let end = Math.min(i + matchDistance + 1, s2.length);    // End index
			for (let j = start; j < end; ++j) {                  // Loop window
				if (s2Matches[j]) continue;                      // Skip if matched
				if (s1[i] !== s2[j]) continue;                   // Skip if diff
				s1Matches[i] = true;                             // Mark matched
				s2Matches[j] = true;                             // Mark matched
				++matches;                                       // Increment count
				break;                                           // Break window
			}
		}

		if (matches == 0) return 0.0;                            // Quit if no matches

		let t = 0;                                               // Transpositions
		let point = 0;                                           // Point index
		for (let i = 0; i < s1.length; ++i) {                        // Loop s1
			if (!s1Matches[i]) continue;                       // Skip unmatched
			while (!s2Matches[point]) ++point;                 // Find matched
			if (s1[i] !== s2[point]) ++t;                        // Diff trans
			++point;                                           // Next point
		}
		t = t / 2;                                                 // Half transpositions

		let jaro = ((matches / s1.length) + (matches / s2.length) + ((matches - t) / matches)) / 3.0; // Jaro score

		let prefix = 0;                                          // Prefix length
		for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); ++i) { // Loop prefix
			if (s1[i] == s2[i]) ++prefix;                        // Match prefix
			else break;                                        // Break
		}
		return jaro + prefix * 0.1 * (1.0 - jaro);                     // Return JW score
	}

	/////////////////////////////////////////////////////////////////////////////////////////////////
	// STATELESS HELPERS
	/////////////////////////////////////////////////////////////////////////////////////////////////

	static IsAbsent(v)                                         // CHECK IF ABSENT
	{
		return v == null || v == undefined || String(v).trim() == ""; // Return true if empty
	}

	static StrEq(a, b)                                         // STRING EQUALITY
	{
		if (Score.IsAbsent(a) || Score.IsAbsent(b)) return false; // Fail if absent
		return String(a).toLowerCase() == String(b).toLowerCase(); // Compare strings
	}

	static InitialEq(a, b)                                     // INITIAL EQUALITY
	{
		if (Score.IsAbsent(a) || Score.IsAbsent(b)) return false; // Fail if absent
		const strA = String(a).trim().replace(/\./g, '');
		const strB = String(b).trim().replace(/\./g, '');
		if (strA.length > 1 && strB.length > 1) return false;      // Both are full names, not initials
		return strA.toLowerCase()[0] == strB.toLowerCase()[0];     // Compare first char
	}

	JwThresholdFor(field)                                      // GET JW THRESHOLD
	{
		let t = this.jwThresholds[field];                        // Get field threshold
		return t === undefined ? this.jwThresholds.default : t;  // Return default if none
	}

	JwAbove(a, b, field)                                       // CHECK JW THRESHOLD
	{
		if (Score.IsAbsent(a) || Score.IsAbsent(b)) return false; // Fail if absent
		let jw = this.JaroWinkler(String(a), String(b));         // Calculate JW score
		return jw > this.JwThresholdFor(field);                // Return if above threshold
	}

	ScoreYear(source, target, compare)                        // CALCULATE BAND SCORE
	{
		let match, slop = 0;
		if (compare && String(compare).includes('±')) slop = String(compare).split('±')[1] - 0;
		let bandScores = { 0: 1.0, 1: 0.8, 2: 0.7, 3: 0.6, 5: 0.5, 10: 0.3, 20: 0.2 }; 		// Set band scores

		let srcStr = String(source).split(':')[0].trim();
		let tgtStr = String(target).split(':')[0].trim();

		if (srcStr === '' || tgtStr === '') return 0.0;

		if (srcStr.includes("-")) {
			let range = srcStr.split('-');
			let delta = Math.abs(range[0] - range[1]) - 0;
			let start = Math.min(range[0], range[1]) - slop;
			let end = Math.max(range[0], range[1]) + delta + slop;
			match = (Number(tgtStr) >= start && Number(tgtStr) <= end) ? 1 : 0;
		} else {
			let srcNum = Number(srcStr);
			let tgtNum = Number(tgtStr);
			if (isNaN(srcNum) || isNaN(tgtNum)) return 0.0;
			match = Math.abs(srcNum - tgtNum) <= slop ? 1 : 0;
		}
		return match * (bandScores[slop] !== undefined ? bandScores[slop] : 1.0);
	}
}

window.Score = Score;                                            // EXPORT GLOBALLY