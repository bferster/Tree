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

	ScoreMentions(blockedMentions, factors, sources)            // SCORE ALL MENTIONS
	{
		let i;
		let mention_ids = [];                                    // Init array
		let me = app.findMention("ALB-CN-1880-257");             // Find mention
		this.ScoreFactor(factors, me);           				 // Score factor
		let totalScore = 0;
		for (i = 0; i < factors.length; i++) {                	 // Loop factors
			if (factors[i].compare != "ignore")					 // If active
				totalScore += factors[i].score
			if (this.useSmartName)
				totalScore += this.SmartNameScore;
		}
		trace(totalScore)
		return { mention_ids, factors, totalScore };               // Return results
	}

	ScoreFactor(factors, mention, smartName)              // SCORE SINGLE FACTOR
	{
		let byField = {};                                        // Init lookup
		for (let f of factors) byField[f.field] = f;             // Populate lookup
		let consumed = new Set();                                // Init consumed set
		this.SmartNameScore = 0.0;
		if (this.useSmartName) {                                  // If smart name matching
			let v = (field) => (byField[field] ? byField[field].value : undefined); // Value helper
			let firstMatch = Score.StrEq(v('first_name'), mention.first_name); // First name match
			let middleMatch = Score.StrEq(v('middle_name'), mention.middle_name); // Middle name match
			let lastMatch = Score.StrEq(v('last_name'), mention.last_name); // Last name match
			let initialMatch = Score.InitialEq(v('first_name'), mention.first_name) && Score.InitialEq(v('last_name'), mention.last_name); // Initials match
			let normLast = Score.StrEq(v('norm_first_name'), mention.norm_first_name) && lastMatch; // Norm first and last match
			let jwBoth = this.JwAbove(v('norm_first_name'), mention.norm_first_name, 'norm_first_name') && this.JwAbove(v('last_name'), mention.last_name, 'last_name'); // JW both
			let nysiisMatch = Score.StrEq(v('nysiis_last_name'), mention.nysiis_last_name); // NYSIIS match
			let soundexMatch = Score.StrEq(v('soundex_last_name'), mention.soundex_last_name); // Soundex match

			let matchScore = 0.0;                                // Init score
			if (firstMatch && middleMatch && lastMatch) matchScore = 1.0; // Exact match
			else if (firstMatch && lastMatch) matchScore = 0.95; // First and last
			else if (initialMatch) matchScore = 0.9;             // Initials
			else if (normLast) matchScore = 0.90;                // Norm last
			else if (jwBoth) matchScore = 0.70;                  // JW both
			else if (nysiisMatch) matchScore = 0.60;             // NYSIIS
			else if (soundexMatch) matchScore = 0.50;            // Soundex

			this.SmartNameScore = matchScore;                    // Store score
			for (let field of this.nameFields) {               // Loop name fields
				if (byField[field]) byField[field].score = 0; // Distribute score
				consumed.add(field);                           // Mark consumed
			}
		}

		for (let factor of factors) {                         	 // Loop remaining factors
			let field = factor.field;                            // Get field
			let compare = factor.compare;                        // Get compare mode

			let isRare = false;                                  // Init rare flag
			if (Array.isArray(compare)) {                        // If array
				isRare = compare.includes('rare');               // Check rare
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
			} else if (field == 'birth_year' || field == 'death_year') { 		// If years
				factor.score = this.ScoreYear(factor.value, candidate, compare); 		// Band match
			} else if (compare == 'exact') {                     // If exact
				factor.score = Score.StrEq(factor.value, candidate) ? 1.0 : 0.0; // Exact match
			} else if (compare == 'fuzzy') {                     // If fuzzy
				if (Score.IsAbsent(factor.value) || Score.IsAbsent(candidate)) { // If absent
					factor.score = 0.0;                          // Score 0
				} else {
					let jw = this.JaroWinkler(String(factor.value), String(candidate)); // Calc JW score
					factor.score = jw > this.JwThresholdFor(field) ? jw : 0.0; 	// Assign actual JW
				}
			} else {                                           // Else
				factor.score = 0.0;                              // Unknown mode
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
		return String(a).toLowerCase()[0] == String(b).toLowerCase()[0]; // Compare first char
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
		if (compare.includes('±')) slop = compare.split('±')[1] - 0;
		let bandScores = { 0: 1.0, 1: 0.8, 2: 0.7, 3: 0.6, 5: 0.5, 10: 0.3, 20: 0.2 }; 		// Set band scores
		if (String(source).includes("-")) {
			let range = source.split('-');
			let delta = Math.abs(range[0] - range[1]) - 0;
			let start = Math.min(range[0], range[1]) - slop;
			let end = Math.max(range[0], range[1]) + delta + slop;
			match = (target >= start && target <= end) ? 1 : 0;
		} else match = Math.abs(source - target) <= slop ? 1 : 0;
		return match * bandScores[slop];
	}
}

window.Score = Score;                                            // EXPORT GLOBALLY