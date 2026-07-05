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
		wasEnslavedBy: { inverse: 'enslaves', yields: 'inHouseOf', symmetric: false },
		isSameAs: { inverse: 'isSameAs', yields: null, symmetric: true },
		isNotSameAs: { inverse: 'isNotSameAs', yields: null, symmetric: true },
	};

	// Gendered aliases → canonical form (direction unchanged).
	static UNGENDER = {
		issonof: 'isChildOf', isdaughterof: 'isChildOf',
		isfatherof: 'isParentOf', ismotherof: 'isParentOf',
		isbrotherof: 'isSiblingOf', issisterof: 'isSiblingOf',
		ishusbandof: 'isSpouseOf', iswifeof: 'isSpouseOf',
	};

	constructor(assertions) {
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

		for (const a of assertions) {
			const predicate = this._canon.get(String(a.predicate || '').trim().toLowerCase());
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
				addResult(this._row(a.object_id, predicate, a.confidence, 'stored', a, null));
			}

			// 2. Reciprocal readings: mention is the object; invert via registry.
			for (const { assertion: a, predicate } of this.byObject.get(id) || []) {
				const inverse = ExpandAssertions.REGISTRY[predicate].inverse;
				if (inverse === 'isSameAs' || inverse === 'isNotSameAs') continue;
				addResult(this._row(a.subject_id, inverse, a.confidence, 'derived', a, [a]));
			}

			// 3. Entailed readings: yields column, subject side only.
			for (const { assertion: a, predicate } of this.bySubject.get(id) || []) {
				const yields = ExpandAssertions.REGISTRY[predicate].yields;
				if (yields) addResult(this._row(a.object_id, yields, a.confidence, 'entailed', a, [a]));
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
				if (String(trimmedId) >= String(sib)) continue; // C2 emits each sibling pair once, with the lower mention_id as subject
				addResult(this._composedRow(sib, 'isSiblingOf', pe, ce, 'C2'));
			}
		}

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
}

// Example:
// const view = new ExpandAssertions(app.assertions);
// const { results } = view.viewFor('ALB-CN-1870-123');
// results.forEach(r => console.log(r.mention_id, r.predicate, r.confidence));
