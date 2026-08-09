class Score {

	constructor(options = {})                                    // CONSTRUCTOR
	{
		app.score = this;
		this.jwThresholds = Object.assign({ default: 0.85 }, options.jwThresholds); // Set thresholds
		this.nameFields = ['full_name', 'first_name', 'middle_name', 'last_name', 'norm_first_name', 'nysiis_last_name', 'metaphone_last_name'];
		this.skipFields = new Set(options.skipFields || ['race', 'gender', 'suffix']); // Set skip fields
		this.useSmartName = true;
		this.SmartNameScore = 0.0;
	}

	ScoreMentions(blockedMentions, factors, sources, smartName, personId)            // SCORE ALL MENTIONS
	{
		let i, mention;
		if (sources && sources.length > 0) {
			blockedMentions = blockedMentions.filter(m => m.source && app.sourceMatches(m.source, sources));
		}

		// --- LEVER C: Pre-compute Anchor Kin ---
		let anchorKin = [];
		if (personId && app.curTree && app.curTree.relationships && app.curTree.persons) {
			const rels = app.curTree.relationships.filter(r => r.subject_id === personId || r.object_id === personId);
			const personCollection = Array.isArray(app.curTree.persons) ? app.curTree.persons : Object.values(app.curTree.persons);

			for (let r of rels) {
				const kinId = r.subject_id === personId ? r.object_id : r.subject_id;
				let relation = r.predicate;
				if (r.predicate === 'isChildOf') {
					relation = r.subject_id === personId ? 'isParentOf' : 'isChildOf';
				}

				const kinPerson = personCollection.find(p => p.person_id === kinId);
				if (kinPerson && !anchorKin.some(k => k.person_id === kinId)) {
					const cleanStr = (val) => val ? String(val).split(':')[0].trim().toLowerCase() : '';
					anchorKin.push({
						person_id: kinId,
						relation: relation,
						first_name: cleanStr(kinPerson.first_name),
						norm_first_name: cleanStr(kinPerson.norm_first_name),
						birth_year: kinPerson.birth_year ? parseInt(String(kinPerson.birth_year).split(':')[0]) : null
					});
				}
			}

			// If tree assertions are empty, derive kin from anchor's existing mentions
			if (anchorKin.length === 0) {
				const anchorPerson = personCollection.find(p => p.person_id === personId);
				if (anchorPerson && anchorPerson.mentions) {
					const anchorMentions = Array.isArray(anchorPerson.mentions) ? anchorPerson.mentions : [];
					for (let mid of anchorMentions) {
						const am = app.mentions.find(m => m.mention_id === mid);
						if (am && am.source && (am.household_id || am.family_id)) {
							const hid = am.household_id;
							const fid = am.family_id;
							const derivedKinMentions = app.mentions.filter(m => m.source === am.source && m.mention_id !== am.mention_id &&
								(fid ? m.family_id === fid : m.household_id === hid));

							for (let dk of derivedKinMentions) {
								if (!anchorKin.some(k => k.person_id === dk.mention_id)) {
									const cleanStr = (val) => val ? String(val).trim().toLowerCase() : '';

									// Best guess at relation based on relation string in mention or default to "derived"
									let rel = 'derivedKin';
									const relStr = (dk.relation || '').toLowerCase();
									if (relStr.includes('wife') || relStr.includes('husband') || relStr.includes('spouse')) rel = 'isSpouseOf';
									else if (relStr.includes('son') || relStr.includes('daughter') || relStr.includes('child')) rel = 'isChildOf';
									else if (relStr.includes('father') || relStr.includes('mother') || relStr.includes('parent')) rel = 'isParentOf';

									anchorKin.push({
										person_id: dk.mention_id,
										relation: rel,
										first_name: cleanStr(dk.first_name),
										norm_first_name: cleanStr(dk.norm_first_name),
										birth_year: dk.birth_year ? parseInt(dk.birth_year) : null
									});
								}
							}
						}
					}
				}
			}
		}

		let candGroupIndex = new Map();
		if (anchorKin.length > 0) {
			for (let m of app.mentions) {
				if (!m.source) continue;
				if (m.household_id) {
					let key = m.source + "|H|" + m.household_id;
					if (!candGroupIndex.has(key)) candGroupIndex.set(key, []);
					candGroupIndex.get(key).push(m);
				}
				if (m.family_id) {
					let key = m.source + "|F|" + m.family_id;
					if (!candGroupIndex.has(key)) candGroupIndex.set(key, []);
					candGroupIndex.get(key).push(m);
				}
			}
		}

		let useSmart = smartName !== undefined ? smartName : this.useSmartName;

		const anchorPerson = personId ? (Array.isArray(app.curTree.persons)
			? app.curTree.persons.find(x => x.person_id === personId)
			: app.curTree.persons[personId]) : null;

		const isDeathRecord = (m) => {
			if (!m || !m.source) return false;
			if (m.source.includes('_FindAGrave')) return true;
			if (m.source.includes('_VR_1715')) {
				if (m.original_data && m.original_data.type && m.original_data.type.toLowerCase() === 'death') return true;
				if (m.type && m.type.toLowerCase() === 'death') return true;
			}
			return false;
		};

		if (anchorPerson && !anchorPerson._knockoutCache) {
			anchorPerson._knockoutCache = { sourceYear: null, isDeath: false };
			if (Array.isArray(anchorPerson.mentions)) {
				for (let mid of anchorPerson.mentions) {
					const m = app.findMention ? app.findMention(mid) : app.mentions.find(x => x.mention_id === mid);
					if (m && m.source) {
						if (!anchorPerson._knockoutCache.sourceYear) {
							if (m.source_year) {
								anchorPerson._knockoutCache.sourceYear = parseInt(m.source_year);
							} else if (m.death_year) {
								anchorPerson._knockoutCache.sourceYear = parseInt(m.death_year);
							} else if (!m.source.includes('_VR_1715')) {
								const match = m.source.match(/\d{4}/);
								if (match) anchorPerson._knockoutCache.sourceYear = parseInt(match[0]);
							}
						}
						if (isDeathRecord(m)) {
							anchorPerson._knockoutCache.isDeath = true;
						}
					}
				}
			}
		}

		// Optimization: Pre-process factor comparison modes to avoid 1.1 million string replacements in the hot loop
		if (factors) {
			for (let f of factors) {
				let compare = f.compare;
				let isRare = f.rare || false;
				if (Array.isArray(compare)) {
					isRare = isRare || compare.includes('rare');
					f.fcmp = compare.find(x => x !== 'rare') || 'ignore';
				} else if (typeof compare === 'string' && compare.includes('rare')) {
					isRare = true;
					f.fcmp = compare.replace('rare', '').trim();
				} else {
					f.fcmp = compare || 'ignore';
				}
				f.isRare = isRare;
			}
		}

		for (i = 0; i < blockedMentions.length; i++) {
			mention = blockedMentions[i];
			if (!mention) continue;
			this.ScoreFactor(factors, mention, useSmart);			// Run ScoreFactor to calculate individual factor scores for this mention
			let totalScore = 0;
			let mentionFactors = {};

			// Score the name using the new cascade process (always used for name fields if smartName is true)
			let nameScore = 0.0;
			if (useSmart) {
				nameScore = this.computeCascadeNameScore(mention, factors, personId, mentionFactors);

				// Apply IMPACT multiplier from any active name field (max impact wins)
				let maxImpact = 0;
				for (let f of factors) {
					if (this.nameFields.includes(f.field)) {
						const impact = f.impact || 0;
						if (Math.abs(impact) > Math.abs(maxImpact)) maxImpact = impact;
					}
				}
				if (maxImpact > 0) {
					nameScore *= 2;               // Double nameScore for IMPACT +
				} else if (maxImpact < 0) {
					nameScore *= 0.5;             // Halve nameScore for IMPACT -
				}
				totalScore += nameScore;
				mentionFactors['smartName'] = { value: nameScore };
			}

			// Add non-name factor scores
			for (let f of factors) {			// Map to MentionsEditor FACTOR_LABELS format
				// Skip name fields since we've already scored them as a unified name signal (if smartName is true)
				if (useSmart && this.nameFields.includes(f.field)) continue;

				// Normalize compare value (may be an array or a string)
				const fcmp = f.fcmp !== undefined ? f.fcmp : (Array.isArray(f.compare) ? f.compare.find(x => x !== 'rare') || 'ignore' : (f.compare || 'ignore'));
				if (fcmp === 'ignore') continue;
				totalScore += f.score;

				if (f.field === 'birth_year') {
					mentionFactors['birthYear'] = { value: f.score };
				} else if (f.field === 'death_year') {
					mentionFactors['deathYear'] = { value: f.score };
				} else if (!useSmart && f.field === 'first_name') {
					mentionFactors[fcmp === 'fuzzy' ? 'fuzzyFirstName' : 'exactFirstName'] = { value: f.score };
				} else if (!useSmart && f.field === 'last_name') {
					mentionFactors[fcmp === 'fuzzy' ? 'fuzzyLastName' : 'exactLastName'] = { value: f.score };
				} else if (!useSmart && f.field === 'nysiis_last_name') {
					mentionFactors[fcmp === 'fuzzy' ? 'fuzzyNysiisLast' : 'exactNysiisLast'] = { value: f.score };
				} else if (!useSmart && f.field === 'metaphone_last_name') {
					mentionFactors[fcmp === 'fuzzy' ? 'fuzzyMetaphoneLast' : 'exactMetaphoneLast'] = { value: f.score };
				} else if (!this.nameFields.includes(f.field) || !useSmart) {
					mentionFactors[f.field] = { value: f.score };
				}
			}

			// --- LEVER C: Evaluate Household / Family Continuity & Family Boost ---
			const famFactor = factors ? factors.find(f => f.field === 'family_boost' || f.term === 'family_boost' || f.key === 'family_boost') : null;
			const isFamBoostIgnored = famFactor && (famFactor.compare === 'Ignore' || famFactor.match === 'Ignore');

			if (!isFamBoostIgnored) {
				const familyBoostResult = this._calculateFamilyBoost(anchorPerson, mention, factors);
				if (familyBoostResult && familyBoostResult.value > 0) {
					totalScore += familyBoostResult.value;
					mentionFactors['familyBoost'] = { value: familyBoostResult.value, matches: familyBoostResult.matches };
				}
			} else if (anchorKin.length > 0 && mention.source && (mention.household_id || mention.family_id)) {
				const hid = mention.household_id;
				const fid = mention.family_id;

				let candGroup = [];
				if (fid) {
					const group = candGroupIndex.get(mention.source + "|F|" + fid);
					if (group) candGroup = group;
				} else if (hid) {
					const group = candGroupIndex.get(mention.source + "|H|" + hid);
					if (group) candGroup = group;
				}
				candGroup = candGroup.filter(m => m.mention_id !== mention.mention_id);

				if (candGroup.length > 0) {
					let matchedKin = [];
					let spouseMatches = 0;
					let childMatches = 0;
					let otherMatches = 0;
					let usedCandidates = new Set();

					for (let aKin of anchorKin) {
						let bestMatch = null;
						let bestMatchQuality = -1; // 2=exact/norm, 1=initial/JW

						for (let cKin of candGroup) {
							if (usedCandidates.has(cKin.mention_id)) continue;

							const cFirst = (cKin.first_name || '').toLowerCase().trim();
							const cNorm = (cKin.norm_first_name || '').toLowerCase().trim();

							let matchQuality = -1;
							if (cFirst && aKin.first_name && cFirst === aKin.first_name) matchQuality = 2;
							else if (cNorm && aKin.norm_first_name && cNorm === aKin.norm_first_name) matchQuality = 2;
							else if (matchQuality === -1 && aKin.first_name && cFirst) {
								if (this.JaroWinkler(aKin.first_name, cFirst) >= 0.85) matchQuality = 1;
								else if (cFirst[0] === aKin.first_name[0]) matchQuality = 1;
							}

							if (matchQuality > -1) {
								// Basic birth year match: within 5 years
								let ageMatches = false;
								if (aKin.birth_year) {
									const cBirth = cKin.birth_year ? parseInt(cKin.birth_year) : null;
									if (cBirth && Math.abs(aKin.birth_year - cBirth) <= 5) {
										ageMatches = true;
									}
								} else {
									ageMatches = true; // If anchor kin has no age, just rely on name
								}

								if (ageMatches && matchQuality > bestMatchQuality) {
									bestMatch = cKin;
									bestMatchQuality = matchQuality;
								}
							}
						}

						if (bestMatch) {
							usedCandidates.add(bestMatch.mention_id);
							matchedKin.push({ anchor_id: aKin.person_id, mention_id: bestMatch.mention_id, relation: aKin.relation, name: bestMatch.first_name || 'Relative' });
							if (aKin.relation === 'isSpouseOf') spouseMatches++;
							else if (aKin.relation === 'isChildOf') childMatches++;
							else otherMatches++;
						}
					}

					if (matchedKin.length > 0) {
						let continuityScore = 0;
						continuityScore += (spouseMatches * 0.5);
						continuityScore += (childMatches * 0.25);
						continuityScore += (otherMatches * 0.25);

						if (continuityScore > 2.0) {
							continuityScore = 2.0;
						}
						totalScore += continuityScore;
						mentionFactors['householdContinuity'] = { value: continuityScore, matches: matchedKin };
					}
				}
			}

			mention.score = totalScore;
			mention.factors = mentionFactors;

			// In non-smart mode: if there were active (non-ignore) name factors and none matched,
			// push this mention below all real matches by making its score negative.
			if (!useSmart && totalScore === 0) {
				const hasActiveFactors = factors.some(f => {
					const fcmp = f.fcmp !== undefined ? f.fcmp : (Array.isArray(f.compare) ? f.compare.find(x => x !== 'rare') || 'ignore' : (f.compare || 'ignore'));
					return fcmp !== 'ignore';
				});
				if (hasActiveFactors) {
					mention.score = -1;
				}
			}

			// Step 3 - Knockout Gates
			const knockout = this._applyKnockoutGates(anchorPerson, mention, factors);
			if (knockout) {
				mention.score = -999; // Drop candidate to the bottom
				mention.factors['knockout'] = { value: -999, label: "Knockout", reason: knockout.reason };
			}
		}

		blockedMentions.sort((a, b) => (b.score || 0) - (a.score || 0)); 		// Sort the mention objects by score in descending order
		let mention_ids = blockedMentions.map(m => m.mention_id);
		return { mentions: blockedMentions, mention_ids, factors, totalScore: 0 };
	}

	_getFamilyIndex(mentions) {
		if (!this._familyIndexCache || this._familyIndexCache.mentions !== mentions) {
			const idx = new Map();
			if (Array.isArray(mentions)) {
				for (let i = 0; i < mentions.length; i++) {
					const m = mentions[i];
					if (m.source && m.family_id) {
						const key = m.source + '|F|' + m.family_id;
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

	_calculateFamilyBoost(anchorPerson, candidateMention, factors, familyIndex = null) {
		if (!candidateMention || !candidateMention.source || !candidateMention.family_id) return null;

		const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
		if (!globalApp || !globalApp.mentions) return null;

		// Fallback to selected person in tree if anchorPerson not directly provided
		if (!anchorPerson && globalApp.curTree) {
			const pid = (window.treeApp && window.treeApp.state && window.treeApp.state.selectedPid) || globalApp.curPerson;
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

		// 1. Get anchor person's family roster
		let anchorRoster = anchorPerson._cachedFamilyRoster;
		if (!anchorRoster || anchorPerson._cachedFamilyPerson !== anchorPerson) {
			const anchorMentions = (anchorPerson.mentions || []).map(mid => {
				if (typeof mid === 'object') return mid;
				return globalApp.mentions.find(m => m.mention_id === mid);
			}).filter(Boolean);

			if (anchorMentions.length === 0) return null;

			let anchorM = anchorMentions.find(m => m.family_id);
			if (!anchorM) return null;

			const key = anchorM.source + '|F|' + anchorM.family_id;
			const fullGroup = familyIndex.get(key) || [];
			anchorRoster = fullGroup.filter(m => m.mention_id !== anchorM.mention_id);
			anchorPerson._cachedFamilyRoster = anchorRoster;
			anchorPerson._cachedFamilyPerson = anchorPerson;
		}

		if (!anchorRoster || anchorRoster.length === 0) return null;

		// 2. Get candidate mention's family roster (O(1) Map lookup)
		const candKey = candidateMention.source + '|F|' + candidateMention.family_id;
		const fullCandGroup = familyIndex.get(candKey);
		if (!fullCandGroup || fullCandGroup.length <= 1) return null;

		const candRoster = fullCandGroup.filter(m => m.mention_id !== candidateMention.mention_id);
		if (candRoster.length === 0) return null;

		// 3. Match roster members between the two family units
		const matchedKin = [];
		const usedCandPids = new Set();

		for (const aM of anchorRoster) {
			const aFirst = (aM.norm_first_name || aM.first_name || '').toLowerCase().trim().split(':')[0];
			const aLast = (aM.last_name || '').toLowerCase().trim().split(':')[0];
			const aGender = (aM.gender || '').toUpperCase().trim();
			const aRace = (aM.norm_race || aM.race || '').toUpperCase().trim();
			const aBY = aM.birth_year ? parseInt(aM.birth_year) : null;

			if (!aFirst) continue;

			let bestMatch = null;
			let bestScore = 0;

			for (const cM of candRoster) {
				if (usedCandPids.has(cM.mention_id)) continue;

				const cFirst = (cM.norm_first_name || cM.first_name || '').toLowerCase().trim().split(':')[0];
				const cLast = (cM.last_name || '').toLowerCase().trim().split(':')[0];

				if (!cFirst) continue;

				// Gender check
				const cGender = (cM.gender || '').toUpperCase().trim();
				if (aGender && cGender && aGender !== cGender) continue;

				// Race check
				const cRace = (cM.norm_race || cM.race || '').toUpperCase().trim();
				if (aRace && cRace && aRace !== cRace && !(aRace.startsWith('B') && cRace.startsWith('M')) && !(aRace.startsWith('M') && cRace.startsWith('B'))) continue;

				// Birth year check (gap <= 3 years)
				const cBY = cM.birth_year ? parseInt(cM.birth_year) : null;
				if (aBY && cBY && Math.abs(aBY - cBY) > 3) continue;

				// Last name compatibility check if both present
				if (aLast && cLast && aLast !== cLast) {
					if (typeof this.JaroWinkler === 'function' && this.JaroWinkler(aLast, cLast) < 0.80) {
						continue;
					}
				}

				// First name similarity
				let nameMatch = 0;
				if (aFirst === cFirst) nameMatch = 1.0;
				else if (typeof this.JaroWinkler === 'function' && this.JaroWinkler(aFirst, cFirst) >= 0.82) nameMatch = 0.8;

				if (nameMatch > 0.7 && nameMatch > bestScore) {
					bestScore = nameMatch;
					bestMatch = cM;
				}
			}

			if (bestMatch) {
				usedCandPids.add(bestMatch.mention_id);
				const rawName = bestMatch.first_name || bestMatch.norm_first_name || 'Relative';
				const nameStr = rawName.split(':')[0];
				matchedKin.push({ name: nameStr, mention_id: bestMatch.mention_id, score: bestScore });
			}
		}

		if (matchedKin.length === 0) return null;

		const boostVal = matchedKin.length * 0.5;
		if (boostVal <= 0) return null;

		const candName = [candidateMention.first_name, candidateMention.last_name].filter(Boolean).join(' ') || candidateMention.mention_id;
		const matchedNames = matchedKin.map(m => m.name).join(', ');

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

		return {
			value: boostVal,
			matches: matchedKin,
			count: matchedKin.length
		};
	}

	computeCascadeNameScore(mention, factors, personId, mentionFactors) {
		const cleanVal = (val) => {
			if (val == null) return '';
			return String(val).split(':')[0].trim().toLowerCase();
		};

		const byField = {};
		for (let f of factors) {
			byField[f.field] = f;
		}

		const anchorPerson = personId ? (Array.isArray(app.curTree.persons)
			? app.curTree.persons.find(x => x.person_id === personId)
			: app.curTree.persons[personId]) : null;

		const fallback = (factors == null);

		const anchorFirst = cleanVal(byField['first_name'] ? byField['first_name'].value : (fallback && anchorPerson ? anchorPerson.first_name : ''));
		const anchorMiddle = cleanVal(byField['middle_name'] ? byField['middle_name'].value : (fallback && anchorPerson ? anchorPerson.middle_name : ''));
		const anchorLast = cleanVal(byField['last_name'] ? byField['last_name'].value : (fallback && anchorPerson ? anchorPerson.last_name : ''));
		const anchorGender = cleanVal(byField['gender'] ? byField['gender'].value : (fallback && anchorPerson ? anchorPerson.gender : ''));

		const candidateFirst = cleanVal(mention.first_name);
		const candidateMiddle = cleanVal(mention.middle_name);
		const candidateLast = cleanVal(mention.last_name);
		const candidateGender = cleanVal(mention.gender);

		// Resolve surname match
		let surnameMatch = false;

		const lastFactor = byField['last_name'];
		const lastIgnored = !lastFactor || !lastFactor.value || lastFactor.compare === 'ignore';

		if (lastIgnored) {
			surnameMatch = true;
		}

		// 1. candidate full_name equals anchor full_name
		if (!surnameMatch) {
			const candidateFullName = cleanVal(mention.full_name);
			const anchorFullName = cleanVal(fallback && anchorPerson ? anchorPerson.full_name : (byField['full_name'] ? byField['full_name'].value : ''));
			if (candidateFullName && anchorFullName && candidateFullName === anchorFullName) {
				surnameMatch = true;
			}
		}

		// 2. candidate last_name equals anchor last_name (exact, alias via hasNameVariant, or phonetics)
		if (!surnameMatch && candidateLast && anchorLast) {
			if (candidateLast === anchorLast) {
				surnameMatch = true;
			} else {
				const candidateNysi = window.Normalize.getNYSIIS(candidateLast);
				const anchorNysi = window.Normalize.getNYSIIS(anchorLast);
				const candidateMetaphone = window.Normalize.getMetaphone(candidateLast);
				const anchorMetaphone = window.Normalize.getMetaphone(anchorLast);
				if ((candidateNysi && candidateNysi === anchorNysi) || (candidateMetaphone && candidateMetaphone === anchorMetaphone)) {
					surnameMatch = true;
				}
			}
		}

		// Check hasNameVariant alias in relationships
		if (!surnameMatch && personId && candidateLast) {
			const variantRels = app.curTree.relationships.filter(r => r.predicate === 'hasNameVariant' && (r.subject_id === personId || r.object_id === personId));
			for (let r of variantRels) {
				const otherPid = r.subject_id === personId ? r.object_id : r.subject_id;
				const otherPerson = Array.isArray(app.curTree.persons) ? app.curTree.persons.find(x => x.person_id === otherPid) : app.curTree.persons[otherPid];
				if (otherPerson) {
					const otherLast = cleanVal(otherPerson.last_name);
					if (candidateLast === otherLast) {
						surnameMatch = true;
						break;
					}
				}
			}
		}


		// Gender conditioning helper
		const isFemale = anchorGender === 'f' || candidateGender === 'f';
		const isMale = anchorGender === 'm' || candidateGender === 'm';

		// Score the cascade rungs
		let nameScore = 0.0;
		let rungFired = "";

		const jwScore = this.JaroWinkler(anchorFirst, candidateFirst);

		if (surnameMatch) {
			const candidateFullName = cleanVal(mention.full_name);
			let anchorFullName = cleanVal(fallback && anchorPerson ? anchorPerson.full_name : (byField['full_name'] ? byField['full_name'].value : ''));
			if (!anchorFullName) anchorFullName = `${anchorFirst} ${anchorMiddle} ${anchorLast}`.replace(/\s+/g, ' ').trim();

			if (candidateFullName && anchorFullName && candidateFullName === anchorFullName) {
				nameScore = 1.0;
				rungFired = "exact_full_name";
				if (mentionFactors) {
					mentionFactors['exactFirstName'] = { value: 1.0 };
					mentionFactors['exactLastName'] = { value: 1.0 };
				}
			}
			else if (!anchorFirst || !candidateFirst) {
				// Surname match, but no first name to compare
				nameScore = anchorLast ? 1.0 : 0.0;
				rungFired = anchorLast ? "surname_only" : "no_name_searched";
				if (mentionFactors && anchorLast) {
					mentionFactors['exactLastName'] = { value: 1.0 };
				}
			}
			// exact first + surname-match
			else if (candidateFirst && anchorFirst && candidateFirst === anchorFirst) {
				if (candidateMiddle && anchorMiddle && candidateMiddle === anchorMiddle) {
					nameScore = 1.0;
				} else {
					nameScore = 0.95;
				}
				rungFired = "exact_first";
				if (mentionFactors) {
					mentionFactors['exactFirstName'] = { value: nameScore };
					mentionFactors['exactLastName'] = { value: 1.0 };
				}
			}
			// first_initial + surname-match
			else if (candidateFirst && anchorFirst && candidateFirst[0] === anchorFirst[0]) {
				nameScore = 0.90;
				rungFired = "first_initial";
				if (mentionFactors) {
					mentionFactors['exactFirstName'] = { value: 0.90 }; // initial match
					mentionFactors['exactLastName'] = { value: 1.0 };
				}
			}
			// nickname/normalized first (Jaro-Winkler >= 0.85) + surname-match
			else if (candidateFirst && anchorFirst) {
				const candidateNick = window.Normalize.getNickname(candidateFirst);
				const anchorNick = window.Normalize.getNickname(anchorFirst);
				if (candidateNick && anchorNick && candidateNick === anchorNick) {
					nameScore = 0.90;
					rungFired = "nickname";
					if (mentionFactors) {
						mentionFactors['fuzzyFirstName'] = { value: 0.90 };
						mentionFactors['exactLastName'] = { value: 1.0 };
					}
				} else if (jwScore >= 0.85) {
					nameScore = 0.70;
					rungFired = "jw_first";
					if (mentionFactors) {
						mentionFactors['fuzzyFirstName'] = { value: jwScore };
						mentionFactors['exactLastName'] = { value: 1.0 };
					}
				}
			}
		} else {
			// given-name-only agreement (no surname match): exact or nickname-equivalent first name
			// Only drop to this rung if gender = F (for M, surname mismatch remains a strong negative, returning 0.0)
			if (isFemale && candidateFirst && anchorFirst) {
				const candidateNick = window.Normalize.getNickname(candidateFirst);
				const anchorNick = window.Normalize.getNickname(anchorFirst);
				const isGivenNameMatch = (candidateFirst === anchorFirst) ||
					(candidateNick && anchorNick && candidateNick === anchorNick) ||
					(jwScore >= 0.85);

				if (isGivenNameMatch) {
					// Requires at least one independent corroborating lever (B or C)
					let leverB = false; // Date match (differ by <= 5 years)
					let leverC = false; // Household/family match

					const anchorBirth = cleanVal(byField['birth_year'] ? byField['birth_year'].value : (fallback && anchorPerson ? anchorPerson.birth_year : ''));
					const candidateBirth = cleanVal(mention.birth_year);
					const anchorDeath = cleanVal(byField['death_year'] ? byField['death_year'].value : (fallback && anchorPerson ? anchorPerson.death_year : ''));
					const candidateDeath = cleanVal(mention.death_year);

					if (anchorBirth && candidateBirth && Math.abs(parseFloat(anchorBirth) - parseFloat(candidateBirth)) <= 5) {
						leverB = true;
					}
					if (anchorDeath && candidateDeath && Math.abs(parseFloat(anchorDeath) - parseFloat(candidateDeath)) <= 5) {
						leverB = true;
					}

					if (personId) {
						const relatedRels = app.curTree.relationships.filter(r => (r.subject_id === personId || r.object_id === personId));
						for (let r of relatedRels) {
							const spouseOrChildPid = r.subject_id === personId ? r.object_id : r.subject_id;
							const relatedPerson = Array.isArray(app.curTree.persons) ? app.curTree.persons.find(x => x.person_id === spouseOrChildPid) : app.curTree.persons[spouseOrChildPid];
							if (relatedPerson && relatedPerson.mentions) {
								for (let mId of relatedPerson.mentions) {
									const otherMention = app.findMention(mId);
									if (otherMention) {
										if (mention.household_id && otherMention.household_id && mention.household_id === otherMention.household_id) {
											leverC = true;
											break;
										}
										if (mention.family_id && otherMention.family_id && mention.family_id === otherMention.family_id) {
											leverC = true;
											break;
										}
										if (mention.enslaver_id && otherMention.enslaver_id && mention.enslaver_id === otherMention.enslaver_id) {
											leverC = true;
											break;
										}
									}
								}
							}
							if (leverC) break;
						}
					}

					if (leverB || leverC) {
						nameScore = 0.40;
						rungFired = "given_name_only";
						if (mentionFactors) {
							if (candidateFirst === anchorFirst) {
								mentionFactors['exactFirstName'] = { value: 0.40 };
							} else {
								mentionFactors['fuzzyFirstName'] = { value: 0.40 };
							}
						}
					}
				}
			}
		}

		// Gender conditioning: woman surname match distinctive bonus
		if (isFemale && surnameMatch && nameScore > 0.0) {
			let diffSurnameExpected = false;
			const anchorLastName = cleanVal(byField['last_name'] ? byField['last_name'].value : (fallback && anchorPerson ? anchorPerson.last_name : ''));
			if (!diffSurnameExpected && personId) {
				const spouseRels = app.curTree.relationships.filter(r => r.predicate === 'isSpouseOf' && (r.subject_id === personId || r.object_id === personId));
				for (let r of spouseRels) {
					const spousePid = r.subject_id === personId ? r.object_id : r.subject_id;
					const spousePerson = Array.isArray(app.curTree.persons) ? app.curTree.persons.find(x => x.person_id === spousePid) : app.curTree.persons[spousePid];
					if (spousePerson) {
						const spouseLast = cleanVal(spousePerson.last_name);
						if (spouseLast && anchorLastName && spouseLast !== anchorLastName) {
							diffSurnameExpected = true;
							break;
						}
					}
				}
			}
			if (diffSurnameExpected) {
				nameScore = Math.min(1.0, nameScore + 0.1);
			}
		}

		// Rarity weighting additions
		if (nameScore > 0.0) {
			// Rarity-weight as before:
			// Add first name rarity score if first name matched (not initials)
			if (rungFired === "exact_first" || rungFired === "nickname" || rungFired === "jw_first" || rungFired === "given_name_only") {
				const firstRarity = app.GetNameWeightModifier(mention.first_name, app.firstNameFreq, app.firstNameTotal);
				nameScore += firstRarity;
				if (mentionFactors) {
					mentionFactors['rarityFirstName'] = { value: firstRarity };
				}
			}
			// Add last name rarity score if surname matched (all rungs except given_name_only)
			if (surnameMatch && candidateLast) {
				const lastRarity = app.GetNameWeightModifier(mention.last_name, app.lastNameFreq, app.lastNameTotal);
				nameScore += lastRarity;
				if (mentionFactors) {
					mentionFactors['rarityLastName'] = { value: lastRarity };
				}
			}
		}

		return nameScore;
	}

	_applyKnockoutGates(anchorPerson, mention, factors) {
		const cleanVal = (val) => {
			if (val == null) return '';
			return String(val).split(':')[0].trim().toLowerCase();
		};

		const getSourceYear = (sourceStr, mObj) => {
			if (mObj && mObj.source_year) return parseInt(mObj.source_year);
			if (mObj && mObj.death_year) return parseInt(mObj.death_year);
			if (!sourceStr) return null;
			if (sourceStr.includes('_VR_1715')) return null;
			const match = sourceStr.match(/\d{4}/);
			return match ? parseInt(match[0]) : null;
		};

		const byField = {};
		for (let f of factors) byField[f.field] = f;

		const fallback = (factors == null);

		const getVal = (field) => {
			let v = byField[field] ? byField[field].value : null;
			if (!v && fallback && anchorPerson) v = anchorPerson[field];
			return cleanVal(v);
		};

		// 1. Gender Disagreement
		const anchorGender = getVal('gender');
		const candidateGender = cleanVal(mention.gender);
		if (anchorGender && candidateGender && anchorGender !== candidateGender && (anchorGender === 'm' || anchorGender === 'f') && (candidateGender === 'm' || candidateGender === 'f')) {
			return { reason: 'Gender disagreement' };
		}

		// 2. Birth-year window non-overlap
		const anchorBirthStr = getVal('birth_year');
		const anchorBirth = anchorBirthStr ? parseInt(anchorBirthStr) : null;
		const candidateBirth = mention.birth_year ? parseInt(mention.birth_year) : null;

		if (anchorBirth && candidateBirth && !isNaN(anchorBirth) && !isNaN(candidateBirth)) {
			if (Math.abs(anchorBirth - candidateBirth) > 10) {
				return { reason: 'Birth year gap > 10' };
			}
		}

		let anchorSourceYear = null;
		let anchorIsDeath = false;
		if (anchorPerson && anchorPerson._knockoutCache) {
			anchorSourceYear = anchorPerson._knockoutCache.sourceYear;
			anchorIsDeath = anchorPerson._knockoutCache.isDeath;
		} else {
			let sy = getVal('source_year');
			if (sy) anchorSourceYear = parseInt(sy);
		}

		const candidateSourceYear = getSourceYear(mention.source, mention);
		const isDeathRecord = (m) => {
			if (!m || !m.source) return false;
			if (m.source.includes('_FindAGrave')) return true;
			if (m.source.includes('_VR_1715')) {
				if (m.original_data && m.original_data.type && m.original_data.type.toLowerCase() === 'death') return true;
				if (m.type && m.type.toLowerCase() === 'death') return true;
			}
			return false;
		};

		const candidateIsDeath = isDeathRecord(mention);

		// 3. Age Regression (Newer record implies they are younger / born later by > 2 yrs)
		if (anchorBirth && candidateBirth && !isNaN(anchorBirth) && !isNaN(candidateBirth) && anchorSourceYear && candidateSourceYear) {
			if (candidateSourceYear > anchorSourceYear) {
				if (candidateBirth > anchorBirth + 2) return { reason: 'Age regression' };
			} else if (anchorSourceYear > candidateSourceYear) {
				if (anchorBirth > candidateBirth + 2) return { reason: 'Age regression' };
			}
		}

		// 4. Death before enumeration
		if (anchorSourceYear && candidateSourceYear) {
			if (candidateIsDeath && candidateSourceYear < anchorSourceYear) {
				return { reason: 'Death before enumeration' };
			}
			if (anchorIsDeath && anchorSourceYear < candidateSourceYear) {
				return { reason: 'Death before enumeration' };
			}
		}

		return false;
	}

	ScoreFactor(factors, mention, smartName)              // SCORE SINGLE FACTOR
	{
		let byField = {};                                        // Init lookup
		for (let f of factors) byField[f.field] = f;             // Populate lookup
		let consumed = new Set();                                // Init consumed set
		this.SmartNameScore = 0.0;

		for (let factor of factors) {                         	 // Loop remaining factors
			let field = factor.field;                            // Get field
			if (smartName && this.nameFields.includes(field)) {
				factor.score = 0.0;
				continue;
			}
			let compare = factor.fcmp !== undefined ? factor.fcmp : factor.compare; // Get compare mode
			let isRare = factor.isRare !== undefined ? factor.isRare : (factor.rare || false); // Init rare flag
			
			if (factor.fcmp === undefined) {
				// Fallback if not pre-processed
				if (Array.isArray(compare)) {                        // If array
					isRare = isRare || compare.includes('rare');     // Check rare
					compare = compare.find(x => x !== 'rare');       // Extract true mode
				} else if (typeof compare === 'string' && compare.includes('rare')) { // If string contains rare
					isRare = true;                                   // Set rare
					compare = compare.replace('rare', '').trim();    // Strip rare
				}
			}

			if (this.skipFields.has(field)) continue;            // Skip if blocked
			if (consumed.has(field)) continue;                	 // Skip if consumed

			let candidate = mention[field];                      // Get candidate value

			// Fallback: If candidate is blank but full_name exists, try to extract it from full_name
			if (Score.IsAbsent(candidate) && !Score.IsAbsent(mention.full_name)) {
				const parts = String(mention.full_name).trim().split(/\s+/);
				if (field === 'first_name') candidate = parts[0];
				else if (field === 'last_name') candidate = parts.length > 1 ? parts[parts.length - 1] : '';
				else if (field === 'middle_name') candidate = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
			}

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
		
		// Optimization: Reuse pre-allocated arrays to eliminate 672,000 GC allocations
		if (!this._jwM1) this._jwM1 = new Array(256);
		if (!this._jwM2) this._jwM2 = new Array(256);
		for (let i = 0; i < s1.length; i++) this._jwM1[i] = false;
		for (let j = 0; j < s2.length; j++) this._jwM2[j] = false;
		let s1Matches = this._jwM1;
		let s2Matches = this._jwM2;
		
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
		return String(a).trim().toLowerCase() == String(b).trim().toLowerCase(); // Compare strings
	}

	JwThresholdFor(field)                                      // GET JW THRESHOLD
	{
		let t = this.jwThresholds[field];                        // Get field threshold
		return t === undefined ? this.jwThresholds.default : t;  // Return default if none
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