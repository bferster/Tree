/**
 * ExpandAssertions — the mention-level assertions view for Verité.
 *
 * Implements the view specification:
 *  - stored readings (mention as subject)
 *  - reciprocal readings (mention as object, predicate inverted via registry)
 *  - entailed readings (yields column: wasEnslavedBy → inHouseOf)
 *  - composed readings (C1 other-parent via spouse; C2 sibling via shared parent)
 *  - ungendering applied before all rules; originals always attached
 *  - identity predicates (isSameAs / isNotSameAs) reported, never followed
 *
 * Usage:
 *   const view = new ExpandAssertions(app.assertions);
 *   const result = view.viewFor('ALB-CN-1870-123');
 */
class ExpandAssertions {
	static REGISTRY = {
		isChildOf: { inverse: 'isParentOf', yields: null, symmetric: false },
		isParentOf: { inverse: 'isChildOf', yields: null, symmetric: false },
		isSiblingOf: { inverse: 'isSiblingOf', yields: null, symmetric: true },
		isSpouseOf: { inverse: 'isSpouseOf', yields: null, symmetric: true },
		isCousinOf: { inverse: 'isCousinOf', yields: null, symmetric: true },
		isEnslaverOf: { inverse: 'wasEnslavedBy', yields: null, symmetric: false },
		enslaves: { inverse: 'wasEnslavedBy', yields: null, symmetric: false },
		wasEnslavedBy: { inverse: 'isEnslaverOf', yields: 'inHouseholdOf', symmetric: false },
		isSameAs: { inverse: 'isSameAs', yields: null, symmetric: true },
		isNotSameAs: { inverse: 'isNotSameAs', yields: null, symmetric: true },
		inFamilyOf: { inverse: 'inFamilyOf', yields: null, symmetric: true },
		inHouseholdOf: { inverse: 'inHouseholdOf', yields: null, symmetric: true },
		isNeighborOf: { inverse: 'isNeighborOf', yields: null, symmetric: true },
	};

	// Gendered aliases → canonical form (direction unchanged).
	static UNGENDER = {
		issonof: 'isChildOf', isdaughterof: 'isChildOf',
		isfatherof: 'isParentOf', ismotherof: 'isParentOf',
		isbrotherof: 'isSiblingOf', issisterof: 'isSiblingOf',
		ishusbandof: 'isSpouseOf', iswifeof: 'isSpouseOf',
	};

	static CENSUS_RELATION_MAP = {
		'son': 'isChildOf', 's': 'isChildOf', 'daughter': 'isChildOf', 'd': 'isChildOf', 'dau': 'isChildOf', 'child': 'isChildOf',
		'father': 'isParentOf', 'fa': 'isParentOf', 'mother': 'isParentOf', 'mo': 'isParentOf', 'parent': 'isParentOf',
		'brother': 'isSiblingOf', 'bro': 'isSiblingOf', 'sister': 'isSiblingOf', 'sis': 'isSiblingOf', 'sibling': 'isSiblingOf',
		'wife': 'isSpouseOf', 'w': 'isSpouseOf', 'wf': 'isSpouseOf', 'husband': 'isSpouseOf', 'h': 'isSpouseOf', 'spouse': 'isSpouseOf',
		'stepson': 'isChildOf', 'stepdaughter': 'isChildOf', 'stepdau': 'isChildOf',
		'halfson': 'isChildOf', 'halfdaughter': 'isChildOf'
	};

	constructor(assertions, mentions = []) {
		this.mentionsMap = new Map();
		this.mentionsBySource = new Map();
		this.mentionsByFamily = new Map();
		this.mentionsByHousehold = new Map();
		this.sortedMentionsBySource = new Map();

		for (const m of mentions) {
			const id = String(m.mention_id || '').trim();
			this.mentionsMap.set(id, m);

			if (m.source) {
				const src = String(m.source).trim();
				if (!this.mentionsBySource.has(src)) this.mentionsBySource.set(src, []);
				this.mentionsBySource.get(src).push(m);

				const famId = String(m.family_id || m.familyId || '').trim();
				if (famId && famId.toLowerCase() !== 'null' && famId.toLowerCase() !== 'undefined') {
					const famKey = `${src}|${famId}`;
					if (!this.mentionsByFamily.has(famKey)) this.mentionsByFamily.set(famKey, []);
					this.mentionsByFamily.get(famKey).push(m);
				}

				const houseId = String(m.household_id || m.householdId || m.family_id || m.familyId || '').trim();
				if (houseId && houseId.toLowerCase() !== 'null' && houseId.toLowerCase() !== 'undefined') {
					const houseKey = `${src}|${houseId}`;
					if (!this.mentionsByHousehold.has(houseKey)) this.mentionsByHousehold.set(houseKey, []);
					this.mentionsByHousehold.get(houseKey).push(m);
				}
			}
		}

		// Lowercased lookup for casing drift ("IsMotherOf") + gendered aliases.
		this._canon = new Map();
		for (const p of Object.keys(ExpandAssertions.REGISTRY)) this._canon.set(p.toLowerCase(), p);
		for (const [alias, target] of Object.entries(ExpandAssertions.UNGENDER)) this._canon.set(alias, target);

		this.bySubject = new Map();       // subject_id -> [edge]
		this.byObject = new Map();       // object_id  -> [edge]
		this.childrenByParent = new Map(); // parent_id -> [{child, edge}]
		this.parentsByChild = new Map(); // child_id  -> [{parent, edge}]
		this.spouses = new Map(); // person_id -> [{other, edge}]
		this._directPairs = new Set();     // "lo|predicate|hi" for composed-duplicate suppression

		const allAssertions = [...assertions];
		for (const [famKey, members] of this.mentionsByFamily.entries()) {
			if (famKey.includes('CN-')) {
				let head = members.find(m => m.head === true || String(m.head || '').trim().toLowerCase() === 't' || String(m.head || '').trim().toLowerCase() === 'y' || (m.original_data && String(m.original_data.head || '').trim().toLowerCase() === 'y'));
				if (!head) head = members.find(m => {
					const rel = m.original_data ? (m.original_data.relation || m.original_data.Relation) : m.relation;
					const rStr = String(rel || '').trim().toLowerCase();
					return rStr === 'head' || rStr === 'self' || rStr === 'hd' || rStr === 'h';
				});
				if (!head && members.length > 0) head = members[0];
				
				if (head) {
					for (const m of members) {
						if (m.mention_id !== head.mention_id) {
							const rel = m.original_data ? (m.original_data.relation || m.original_data.Relation) : m.relation;
							const rawRel = String(rel || '').trim().toLowerCase().replace(/[-\s]+/g, '');
							const pred = ExpandAssertions.CENSUS_RELATION_MAP[rawRel];
							if (pred) {
								allAssertions.push({
									subject_id: m.mention_id,
									predicate: pred,
									object_id: head.mention_id,
									confidence: 1.0
								});
							}
						}
					}
				}
			}
		}

		for (const a of allAssertions) {
			const rawPred = String(a.predicate || '').toLowerCase().replace(/\s+/g, '');
			const predicate = this._canon.get(rawPred);
			if (!predicate) continue; // out of scope: excluded entirely

			const subject_id = String(a.subject_id || '').trim();
			const object_id = String(a.object_id || '').trim();

			const edge = { assertion: a, predicate }; // predicate = ungendered canonical
			this._push(this.bySubject, subject_id, edge);
			this._push(this.byObject, object_id, edge);
			this._directPairs.add(this._pairKey(subject_id, predicate, object_id,
				ExpandAssertions.REGISTRY[predicate].symmetric));

			// Normalized parent/child and spouse edges feed the compositions.
			if (predicate === 'isChildOf') {
				this._push(this.parentsByChild, subject_id, { parent: object_id, edge });
				this._push(this.childrenByParent, object_id, { child: subject_id, edge });
			} else if (predicate === 'isParentOf') { // legacy direction, post-ungender
				this._push(this.parentsByChild, object_id, { parent: subject_id, edge });
				this._push(this.childrenByParent, subject_id, { child: object_id, edge });
			} else if (predicate === 'isSpouseOf') {
				this._push(this.spouses, subject_id, { other: object_id, edge });
				this._push(this.spouses, object_id, { other: subject_id, edge });
			}
		}
	}

	/** The complete view for one mention_id. */
	viewFor(mentionId) {
		const results = [];
		const trimmedId = String(mentionId).trim();

		// 0. Find all equivalent mention IDs via isSameAs transitive closure.
		const equivalents = new Set([trimmedId]);
		const queue = [trimmedId];
		while (queue.length > 0) {
			const current = queue.shift();
			for (const { assertion: a, predicate } of this.bySubject.get(current) || []) {
				if (predicate === 'isSameAs') {
					const obj = String(a.object_id).trim();
					if (!equivalents.has(obj)) {
						equivalents.add(obj);
						queue.push(obj);
					}
				}
			}
			for (const { assertion: a, predicate } of this.byObject.get(current) || []) {
				if (predicate === 'isSameAs') {
					const sub = String(a.subject_id).trim();
					if (!equivalents.has(sub)) {
						equivalents.add(sub);
						queue.push(sub);
					}
				}
			}
		}

		// Helper to check if a result already exists to avoid duplicate rows
		const seen = new Set();
		const addResult = (row) => {
			const key = `${row.mention_id}|${row.predicate}|${row.direction}`;
			if (!seen.has(key)) {
				seen.add(key);
				results.push(row);
			}
		};

		// 1-3. Gather stored, derived, and entailed for all equivalent IDs.
		for (const id of equivalents) {
			// 1. Stored readings: mention is the subject.
			for (const { assertion: a, predicate } of this.bySubject.get(id) || []) {
				if (predicate === 'isSameAs' || predicate === 'isNotSameAs') continue;
				const obj = String(a.object_id).trim();
				addResult(this._row(obj, predicate, a.confidence, 'stored', a, null));
			}

			// 2. Reciprocal readings: mention is the object; invert via registry.
			for (const { assertion: a, predicate } of this.byObject.get(id) || []) {
				const inverse = ExpandAssertions.REGISTRY[predicate].inverse;
				if (inverse === 'isSameAs' || inverse === 'isNotSameAs') continue;
				const sub = String(a.subject_id).trim();
				addResult(this._row(sub, inverse, a.confidence, 'derived', a, [a]));
			}

			// 3. Entailed readings: yields column, subject side only.
			for (const { assertion: a, predicate } of this.bySubject.get(id) || []) {
				const yields = ExpandAssertions.REGISTRY[predicate].yields;
				const obj = String(a.object_id).trim();
				if (yields) addResult(this._row(obj, yields, a.confidence, 'entailed', a, [a]));
			}
		}

		// Gather dynamic assertions from metadata for all equivalents
		for (const id of equivalents) {
			const m = this.mentionsMap.get(id);
			if (m && m.source) {
				const source = String(m.source).trim();
				const year = this._getCensusYear(source);
				const isCensus = source.includes('CN-');

				if (isCensus) {
					const famId = String(m.family_id || '').trim();
					const hasFam = famId && famId.toLowerCase() !== 'null' && famId.toLowerCase() !== 'undefined';

					// 1. inFamilyOf (CN census sources - strictly same family_id)
					if (hasFam) {
						const famKey = `${source}|${famId}`;
						const members = this.mentionsByFamily.get(famKey) || [];
						for (const member of members) {
							if (member.mention_id !== id) {
								// For census sources without explicit relation strings (e.g. 1870/1860),
								// ensure family members share the surname/soundex to avoid grouping unrelated households sharing a generic family_id
								const mSur = (m.last_name || '').split(':')[0].trim().toLowerCase();
								const memSur = (member.last_name || '').split(':')[0].trim().toLowerCase();
								const mSx = (m.soundex_last_name || m.metaphone_last_name || '').split(':')[0].trim().toLowerCase();
								const memSx = (member.soundex_last_name || member.metaphone_last_name || '').split(':')[0].trim().toLowerCase();

								const hasExplicitRel = Boolean((member.original_data && (member.original_data.relation || member.original_data.Relation)) || member.relation);
								if (!hasExplicitRel && mSur && memSur) {
									const surMatch = (mSur === memSur);
									const sxMatch = (mSx && memSx && mSx === memSx);
									if (!surMatch && !sxMatch) {
										continue; // Skip unrelated surname sharing a generic family_id
									}
								}

								const virtualAssertion = { subject_id: id, predicate: 'inFamilyOf', object_id: member.mention_id, start_year: year, end_year: '' };
								addResult(this._row(member.mention_id, 'inFamilyOf', 1.0, 'stored', virtualAssertion, null));
							}
						}
					}

					// 3. isNeighborOf (CN-1870, CN-1880)
					const sorted = this._getSortedMentions(source);
					const famKey = hasFam ? `${source}|${famId}` : null;
					const familyMembers = famKey ? (this.mentionsByFamily.get(famKey) || []) : [m];

						// Find head
						let head = familyMembers.find(member => String(member.head || '').trim().toLowerCase() === 't');
						if (!head) head = familyMembers[0];

						// Find last member by sorting the family members
						const headIdx = sorted.findIndex(member => member.mention_id === head.mention_id);
						const sortedFamily = [...familyMembers].sort((a, b) => this._parseMentionId(a.mention_id) - this._parseMentionId(b.mention_id));
						const last = sortedFamily[sortedFamily.length - 1];
						const lastIdx = sorted.findIndex(member => member.mention_id === last.mention_id);

						if (headIdx !== -1 && lastIdx !== -1) {
							// Preceding neighbors
							const precedingNeighbors = sorted.slice(Math.max(0, headIdx - 5), headIdx)
								.filter(neighbor => {
									const nFamId = String(neighbor.family_id || '').trim();
									return famId === '' ? neighbor.mention_id !== id : nFamId !== famId;
								});

							// Succeeding neighbors
							const succeedingNeighbors = sorted.slice(lastIdx + 1, lastIdx + 6)
								.filter(neighbor => {
									const nFamId = String(neighbor.family_id || '').trim();
									return famId === '' ? neighbor.mention_id !== id : nFamId !== famId;
								});

							const neighbors = [...precedingNeighbors, ...succeedingNeighbors];
							for (const neighbor of neighbors) {
								const virtualAssertion = { subject_id: id, predicate: 'isNeighborOf', object_id: neighbor.mention_id, start_year: year, end_year: '' };
								addResult(this._row(neighbor.mention_id, 'isNeighborOf', 1.0, 'stored', virtualAssertion, null));
							}
						}
					}
				}
			}

		// 4. Compositions. Merge parent edges across all equivalents.
		const parentEdges = [];
		for (const id of equivalents) {
			parentEdges.push(...(this.parentsByChild.get(id) || []));
		}

		// C1: other-parent via the parent's spouse.
		for (const { parent, edge: pe } of parentEdges) {
			for (const { other: spouse, edge: se } of this.spouses.get(parent) || []) {
				if (equivalents.has(spouse)) continue; // A != C
				
				let hasDirect = false;
				for (const eqId of equivalents) {
					if (this._directPairs.has(this._pairKey(eqId, 'isChildOf', spouse, false))) {
						hasDirect = true;
						break;
					}
				}
				if (hasDirect) continue;
				addResult(this._composedRow(spouse, 'isChildOf', pe, se, 'C1'));
			}
		}

		// C1b: child via spouse (current is spouse of parent, so current is parent of child)
		const spouseEdges = [];
		for (const id of equivalents) {
			spouseEdges.push(...(this.spouses.get(id) || []));
		}

		for (const { other: spouse, edge: se } of spouseEdges) {
			for (const { child, edge: ce } of this.childrenByParent.get(spouse) || []) {
				if (equivalents.has(child)) continue; // A != C
				
				let hasDirect = false;
				for (const eqId of equivalents) {
					if (this._directPairs.has(this._pairKey(eqId, 'isParentOf', child, false))) {
						hasDirect = true;
						break;
					}
				}
				if (hasDirect) continue;
				addResult(this._composedRow(child, 'isParentOf', se, ce, 'C1b'));
			}
		}

		// C2: siblings via a shared parent (half-siblings included).
		const seenSiblings = new Set();
		for (const { parent, edge: pe } of parentEdges) {
			for (const { child: sib, edge: ce } of this.childrenByParent.get(parent) || []) {
				if (equivalents.has(sib) || seenSiblings.has(sib)) continue;
				seenSiblings.add(sib);

				let hasDirect = false;
				for (const eqId of equivalents) {
					if (this._directPairs.has(this._pairKey(eqId, 'isSiblingOf', sib, true))) {
						hasDirect = true;
						break;
					}
				}
				if (hasDirect) continue;
				addResult(this._composedRow(sib, 'isSiblingOf', pe, ce, 'C2'));
			}
		}

		// Group results by target mention_id to resolve child/parent direction conflicts
		const byMention = new Map();
		for (const r of results) {
			if (!byMention.has(r.mention_id)) byMention.set(r.mention_id, []);
			byMention.get(r.mention_id).push(r);
		}

		const filteredResults = [];
		for (const [targetId, rows] of byMention.entries()) {
			const hasChild = rows.some(r => r.predicate === 'isChildOf');
			const hasParent = rows.some(r => r.predicate === 'isParentOf');
			if (hasChild && hasParent) {
				const me = this.mentionsMap.get(trimmedId);
				const target = this.mentionsMap.get(targetId);
				const myBY = this._getBirthYear(me);
				const targetBY = this._getBirthYear(target);

				if (myBY !== null && targetBY !== null && myBY !== targetBY) {
					if (myBY < targetBY) {
						// I am older (the parent). Target is the child.
						filteredResults.push(...rows.filter(r => r.predicate !== 'isChildOf'));
					} else {
						// I am younger (the child). Target is the parent.
						filteredResults.push(...rows.filter(r => r.predicate !== 'isParentOf'));
					}
					continue;
				}
			}
			filteredResults.push(...rows);
		}
		results.length = 0;
		results.push(...filteredResults);

		// Ordering: stored, derived, entailed, composed; then predicate, then mention_id.
		const rank = { stored: 0, derived: 1, entailed: 2, composed: 3 };
		results.sort((x, y) =>
			rank[x.direction] - rank[y.direction] ||
			x.predicate.localeCompare(y.predicate) ||
			String(x.mention_id).localeCompare(String(y.mention_id)));

		return {
			mention_id: mentionId,
			registry: ExpandAssertions.REGISTRY,
			results,
		};
	}

	// ---- internals -----------------------------------------------------

	_row(otherId, predicate, confidence, direction, sourceAssertion, originals) {
		return {
			mention_id: otherId,          // implied subject is the queried mention
			predicate,
			confidence,
			direction,                    // stored | derived | entailed | composed
			start_year: sourceAssertion.start_year ?? null,
			end_year: sourceAssertion.end_year ?? null,
			originals: originals ? originals.map(o => ({ ...o })) : null, // verbatim, gendered predicate and all
		};
	}

	_composedRow(otherId, predicate, edgeA, edgeB, rule) {
		const a = edgeA.assertion, b = edgeB.assertion;
		const confidence = (a.confidence ?? 0) * (b.confidence ?? 0); // product of sources
		const start = (a.start_year != null && b.start_year != null)
			? Math.max(a.start_year, b.start_year)
			: null;                                                     // span intersection
		const end = (a.end_year != null && b.end_year != null)
			? Math.min(a.end_year, b.end_year)
			: null;
		return {
			mention_id: otherId,
			predicate,
			confidence,
			direction: 'composed',
			rule,                          // C1 | C2
			who: 'inferred',
			provisional: true,
			start_year: start,
			end_year: end,
			originals: [{ ...a }, { ...b }], // both sources, verbatim
		};
	}

	_pairKey(idA, predicate, idB, symmetric) {
		if (symmetric && String(idB) < String(idA)) [idA, idB] = [idB, idA];
		return `${idA}|${predicate}|${idB}`;
	}

	_push(map, key, value) {
		const list = map.get(key);
		if (list) list.push(value); else map.set(key, [value]);
	}

	_getCensusYear(source) {
		if (!source) return null;
		const m = source.match(/-((?:18|19)\d{2})/);
		return m ? m[1] : null;
	}

	_parseMentionId(id) {
		const parts = String(id).split('-');
		const lineStr = parts[parts.length - 1]; // e.g. "1688" or "1688.1"
		const num = parseFloat(lineStr);
		return isNaN(num) ? 0 : num;
	}

	_getSortedMentions(source) {
		if (this.sortedMentionsBySource.has(source)) {
			return this.sortedMentionsBySource.get(source);
		}
		const list = this.mentionsBySource.get(source) || [];
		const sorted = [...list].sort((a, b) => {
			return this._parseMentionId(a.mention_id) - this._parseMentionId(b.mention_id);
		});
		this.sortedMentionsBySource.set(source, sorted);
		return sorted;
	}

	_getBirthYear(m) {
		if (!m) return null;
		let by = m.birth_year;
		if (!by && m.original_data) by = m.original_data.birth_year;
		if (!by && m.original_data) {
			const age = parseInt(m.original_data.age, 10);
			if (!isNaN(age)) {
				const cYear = parseInt(this._getCensusYear(m.source), 10) || 1880;
				by = cYear - age;
			}
		}
		const parsed = parseInt(by, 10);
		return isNaN(parsed) ? null : parsed;
	}
}
