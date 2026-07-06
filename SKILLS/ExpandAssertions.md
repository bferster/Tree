# Prompt: Generate Reciprocal, Entailed, and Composed Assertions for a Mention

You are a component of the Verité genealogical inference system. Given a `mention_id`, produce its assertions view for the in-scope relationships, showing the registry that drives the derivation and the original assertion(s) behind every added reading.

## Input

    mention_id: {MENTION_ID}

You have access to the **assertions** table (columns: `assertion_id`, `subject_id`, `predicate`, `object_id`, `start_year`, `end_year`, `who`, `confidence`, `provisional`, `county`). Every relationship is stored once, in one direction. No reciprocal rows exist in the table.

## Predicate registry (in scope)

| predicate | inverse | yields | symmetric | gendered aliases (ungender to this predicate) |
|---|---|---|---|---|
| isChildOf | isParentOf | — | false | isSonOf, isDaughterOf |
| isParentOf | isChildOf | — | false | isFatherOf, isMotherOf |
| isSiblingOf | isSiblingOf | — | true | isBrotherOf, isSisterOf |
| isSpouseOf | isSpouseOf | — | true | isHusbandOf, isWifeOf |
| wasEnslavedBy | enslaves | inHouseOf | false | — |
| isSameAs | isSameAs | — | true | — |
| isNotSameAs | isNotSameAs | — | true | — |
| inFamilyOf | inFamilyOf | — | true | — |
| inHouseholdOf | inHouseholdOf | — | true | — |
| isNeighborOf | isNeighborOf | — | true | — |

The **inverse** column drives reciprocal readings: the same stored row read from the object's side.

The **yields** column drives entailed assertions: an additional predicate implied by a single stored row, in the same direction.

## Composition rules (two-row inference)

| rule | from | and | produces | notes |
|---|---|---|---|---|
| C1 | A isChildOf B | B isSpouseOf C (A ≠ C) | A isChildOf C | other-parent via marriage |
| C2 | A isChildOf P | B isChildOf P (A ≠ B) | A isSiblingOf B | shared parent; includes half-siblings |

Compositions differ from inverses and entailments: they combine **two** assertions, so the result is an inference, not a re-reading.

- **Confidence** of a composed assertion is the **product** of the two source confidences.
- Composed assertions are marked `who: inferred` and `provisional`.
- Compositions run over stored assertions (after ungendering) and their reciprocal readings only — **never over other composed or entailed rows**. One pass, no chaining: C1's output is not input to C2 or to itself.
- If a stored assertion already connects the same pair with the same predicate, do not add the composed duplicate; direct evidence supersedes the inference.
- C2 emits each sibling pair once, with the lower mention_id as subject.
- Composed assertions are subject to the same downstream plausibility checking as all relationship assertions; C1 in particular can produce a step-parent rather than a biological parent (remarriage), which is why its result is provisional rather than certain.

## Rules

1. **Scope.** Output only parent, child, sibling, spouse, and enslavement relationships (including the entailed `inHouseOf`), plus the identity predicates `isSameAs` and `isNotSameAs`, and the census-derived predicates `inFamilyOf`, `inHouseholdOf`, and `isNeighborOf`. Every other predicate (grand-, nibling-, in-law forms, `hasNameVariant`, `isLocatedAt`) is excluded entirely, in both directions. Do not mention, count, or summarize what was excluded.

2. **Ungender first.** Before applying any other rule, replace gendered predicates with their gender-neutral form per the registry's alias column, direction unchanged: `isFatherOf` becomes `isParentOf`; `isSonOf` becomes `isChildOf`; `isWifeOf` becomes `isSpouseOf`. Treat casing variants (`IsMotherOf`) the same way. The original assertion is still reported with its predicate exactly as stored.

3. **Stored readings.** For every assertion where `subject_id = {MENTION_ID}` and the (ungendered) predicate is in the registry, emit one result: the object's mention_id, the predicate, the confidence.

4. **Reciprocal (derived) readings.** For every assertion where `object_id = {MENTION_ID}` and the (ungendered) predicate is in the registry, emit one result: the subject's mention_id, the registry `inverse` of the predicate, the confidence. Symmetric predicates keep the same predicate name.

5. **Entailed (yielded) assertions.** For every in-scope assertion with a non-empty `yields` entry, emit one additional result under the yielded predicate, same direction as the stored row, same temporal span, same confidence.

6. **Composed assertions.** Apply C1 and C2 where `{MENTION_ID}` is the subject of the produced assertion. Emit each result with its product confidence.

7. **Always include the original assertion(s).** Every derived or entailed result must be accompanied by the one original assertion it was read from; every composed result must be accompanied by **both** source assertions — each shown exactly as stored (its subject, its predicate as written in the table, its confidence). Never report an added reading without its evidence.

8. **Confidence.** Derived and entailed rows carry the confidence of their source assertion, unchanged. Composed rows carry the product of their two sources. Never discount or round beyond this.

9. **Preserve disagreement.** If the same pair is connected by multiple rows (e.g. a system row at 0.5 and a human confirmation at 1.0), emit all of them, each with its own original(s).

10. **Do not traverse beyond the rules given.** No grandparents via two `isChildOf` hops, no in-laws composed through a spouse. The only permitted multi-row operations are C1 and C2, exactly as specified.

11. **Identity predicates are reported, never followed.** `isSameAs` and `isNotSameAs` rows involving `{MENTION_ID}` appear as one-hop results like any other symmetric predicate — but they are never expanded (no transitive closure over isSameAs chains) and never used as bridges: C1 and C2 must not treat two mentions linked by `isSameAs` as the same parent or spouse, and relationships attached to an isSameAs-linked mention are not imported into this view. Person-level unification is a separate, downstream operation.

12. **Temporal spans pass through as stored.** Yielded assertions carry the span of their source row. Composed assertions carry the intersection of their sources' spans where both exist; otherwise null.

## Output format

Return two sections:

**Section 1 — Registry** (always shown first): the registry table and the composition rules table above, verbatim.

**Section 2 — Results**: one row per reading, three values: `mention_id`, `predicate`, `confidence`. The implied subject of every row is `{MENTION_ID}`. Derived, entailed, and composed rows carry their original(s) as annotations.

Order results: stored rows first, then derived, then entailed, then composed; within each, by predicate, then mention_id.

## Worked example

Stored rows in the assertions table:

1. `A-100 isChildOf A-200` (confidence 0.5)
2. `A-200 isSpouseOf A-210` (confidence 0.5)
3. `A-300 IsDaughterOf A-200` (confidence 0.5) — legacy gendered row
4. `A-100 wasEnslavedBy A-050` (confidence 0.8)
5. `A-090 isSameAs A-100` (confidence 0.82) — scoring-step identity link, stored with lower mention_id as subject
6. `A-090 isSpouseOf A-400` (confidence 0.6)

The view for `A-100`:

```
Results for A-100:
| mention_id | predicate     | confidence |
|------------|---------------|------------|
| A-200      | isChildOf     | 0.5        |
| A-050      | wasEnslavedBy | 0.8        |
| A-050      | inHouseOf     | 0.8        |
| A-090      | isSameAs      | 0.82       |
| A-210      | isChildOf     | 0.25       |
| A-300      | isSiblingOf   | 0.25       |

Originals:
- (A-090, isSameAs, 0.82) derives from stored assertion: A-090 isSameAs A-100, confidence 0.82
- (A-050, inHouseOf, 0.8) entailed by stored assertion: A-100 wasEnslavedBy A-050, confidence 0.8
- (A-210, isChildOf, 0.25) composed by C1 from: A-100 isChildOf A-200 (0.5) and A-200 isSpouseOf A-210 (0.5)
- (A-300, isSiblingOf, 0.25) composed by C2 from: A-100 isChildOf A-200 (0.5) and A-300 IsDaughterOf A-200 (0.5)
```

Row 3 was ungendered (`IsDaughterOf` → `isChildOf`) before C2 could see it — but its original is reported with the predicate exactly as stored. The composed rows carry product confidence (0.5 × 0.5 = 0.25) and would be written with `who: inferred`, `provisional`. Note that `A-100 isChildOf A-210` did **not** then combine with anything else: composed rows are never inputs to further composition.

Row 5 appears as a derived `isSameAs` reading (symmetric, swapped). Row 6 does **not** appear anywhere: A-400 is the spouse of A-090, and although A-090 isSameAs A-100 at 0.82, this view never imports relationships across an identity link. That spouse surfaces only in the person-level view, after cluster resolution.

## Validation before returning

- Every result predicate is `isChildOf`, `isParentOf`, `isSiblingOf`, `isSpouseOf`, `wasEnslavedBy`, `enslaves`, `inHouseOf`, `isSameAs`, `isNotSameAs`, `inFamilyOf`, `inHouseholdOf`, or `isNeighborOf`. No gendered predicate appears in results.
- Every derived or entailed row lists one original; every composed row lists exactly two.
- Derived/entailed confidence equals the source exactly; composed confidence equals the product of its two sources exactly.
- No composed row was built from another composed or entailed row, and no composition bridged two mentions through an isSameAs link.
- No result belongs to a different mention that is merely isSameAs-linked to `{MENTION_ID}`.
- No out-of-scope assertion appears in any form.

If the mention_id does not exist or has no in-scope assertions, return the registry and an empty results table — do not fabricate relationships.
