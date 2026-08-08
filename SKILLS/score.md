---
name: ScoreMatch
description: Specification for a JavaScript MentionScorer class that ranks candidate mentions against a search target
---

**PURPOSE**

This document specifies a JavaScript class, `MentionScorer`, that compares a target person (a set of known/partial parameters) against a list of candidate mentions drawn from the `mentions` table, and returns the top matches ranked by estimated probability of referring to the same real individual.

This is a specification for code generation, not a design discussion. Implement it literally. Where a default is given, use it unless the caller overrides it via the COMPARE configuration.

---

**CLASS INTERFACE**

```
class MentionScorer {
  constructor(config)
  score(target, candidates)      // returns ranked array of { mention_id, score, probability, levers, gates }
  scoreOne(target, candidate)    // returns a single { score, probability, levers, gates } — used internally by score()
}
```

- `config` — optional overrides for COMPARE settings, weights, and calibration parameters (see **Configuration** below). Falls back to the defaults specified in this document.
- `target` — an object with the same shape as a mention row (see **Input Data Model**), representing the person being searched for. Fields may be missing/null.
- `candidates` — an array of mention rows to compare against.
- `score()` performs blocking, then knockout gating, then lever scoring, then calibration, and returns the **top 80** candidates sorted descending by `probability`. Candidates that fail blocking or trip a knockout gate are excluded from the returned array entirely (not returned with a zero score).

---

**INPUT DATA MODEL**

Each mention (and the target) has these relevant fields:

- `mention_id`, `source`, `source_year`
- `full_name`, `first_name`, `middle_name`, `last_name`
- `norm_first_name`, `nysiis_last_name`, `metaphone_last_name` (format `"PRIMARY:SECONDARY"`)
- `gender` (`M`/`F`/blank), `norm_race` (`B`/`W`/blank)
- `birth_year`, `death_year`
- `household_id`, `family_id`
- `linked_mentions` — array of `{ mention_id, predicate, confidence }` sourced from existing assertions (`isSameAs`, `hasNameVariant`, `wasEnslavedBy`, `isChildOf`, `isSpouseOf`, etc.) involving this mention

A field is "present" if it is not null, undefined, or an empty string. Any field that is not present must be treated as **absent**, never as a mismatch. Absent fields are excluded from the lever(s) that use them (see per-lever rules below) — they do not contribute 0 to a score, and they do not trip a knockout gate (except where explicitly noted).

---

**STEP 1 — BLOCKING**

Before any scoring, filter `candidates` to only those where:

- `candidate.source` is in the caller-specified source list (a single search may target multiple sources; caller supplies an array).
- `candidate.norm_race === target.norm_race`, UNLESS either side's `norm_race` is absent, in which case do not block on race for that pair.
- `candidate.gender === target.gender`, UNLESS either side's `gender` is absent, in which case do not block on gender for that pair.

Blocking is a hard filter, not a lever. Candidates removed here never appear in output.

---

**STEP 2 — KNOCKOUT GATES**

Applied after blocking, before lever scoring. Any gate tripped removes the candidate from results entirely.

1. **Gender disagreement** — should already be excluded by blocking; re-check defensively.
2. **Birth-year window non-overlap** — if both `target.birth_year` and `candidate.birth_year` are present, compute `|target.birth_year - candidate.birth_year|`. If this exceeds the knockout threshold for the active source-pair profile (see Lever B), exclude.
3. **Age regression** — if `candidate.source_year > target.source_year` (candidate is a later record) and the implied birth year from the later record is more than 2 years earlier than the implied birth year from the earlier record, exclude.
4. **Death-before-record** — if `target.death_year` (or a linked death/burial mention) is present and is earlier than `candidate.source_year`, exclude, UNLESS the candidate is explicitly being evaluated for a dual-identity hypothesis (out of scope for this class — the caller filters this case separately).

---

**STEP 3 — LEVER A: NAME AGREEMENT**

Compute in this order. Only the **highest-firing rung** is used for the base name score; do not sum across rungs.

**3.1 Surname-match determination**

Determine whether surnames match, and at what strength, using this priority:

1. If `target.full_name === candidate.full_name` (case-insensitive, punctuation stripped) → surname-match = `EXACT` (strength 1.0).
2. Else if `target.last_name === candidate.last_name` (exact string, case-insensitive) → surname-match = `EXACT` (strength 1.0).
3. Else if a `hasNameVariant` or marriage-bridging assertion links the two surnames (via `linked_mentions`) → surname-match = `BRIDGED` (strength 0.9).
4. Else, compute double-metaphone agreement using `metaphone_last_name` (format `"PRIMARY:SECONDARY"`):

```javascript
function doubleMetaphoneMatchScore(metaphoneField1, metaphoneField2) {
  // Inputs are pre-computed "PRIMARY:SECONDARY" strings from the mentions table.
  // Do not recompute double metaphone here — parse the stored field.
  const [p1, s1] = metaphoneField1.split(':');
  const [p2, s2] = metaphoneField2.split(':');
  if (p1 === p2) return 1.0;              // both primaries match
  if (p1 === s2 || s1 === p2) return 0.8; // primary matches other's secondary
  if (s1 === s2) return 0.6;              // only secondaries match
  return 0.0;
}
```

   - If either side's `metaphone_last_name` is absent, fall back to NYSIIS equality (`nysiis_last_name` exact match → strength 0.85) instead of double metaphone.
   - Map the double-metaphone result to surname-match strength: `1.0 → PHONETIC_STRONG (1.0)`, `0.8 → PHONETIC_MODERATE (0.8)`, `0.6 → PHONETIC_WEAK (0.6)`, `0.0 → NO_MATCH (0.0)`.
   - Do NOT also apply NYSIIS when double metaphone was available — this is one surname signal, not two (conditional independence).

5. `PHONETIC_WEAK` (0.6) does **not** count as a fired surname-match on its own for rung selection in 3.2 below — flag it as `weakSurnameHint` and require corroboration from Lever B or Lever C before it can promote a candidate past the given-name-only rung (see 3.4).

**3.2 Given-name comparison and rung selection**

For each side, classify `first_name` (prefer `norm_first_name` if present) as:
- `FULL` — more than one alpha character after normalization.
- `INITIAL` — exactly one alpha character (with or without trailing period) after normalization.
- `ABSENT` — not present.

Do not run Jaro-Winkler on an `INITIAL` value. Route by classification:

| target | candidate | Comparison |
|---|---|---|
| FULL | FULL | exact string match, else Jaro-Winkler (see 3.3) |
| FULL or INITIAL | INITIAL | initial-consistency check (see 3.4) |
| INITIAL | INITIAL | initial-consistency check, both-initials flag set (see 3.4) |
| ABSENT | anything | given-name lever excluded; rely on surname-match + other levers only |

**3.3 Jaro-Winkler rung (FULL vs FULL)**

Use the standard Jaro-Winkler algorithm (no external dependencies), case-insensitive, on normalized first names.

- Exact match (after nickname normalization via `norm_first_name`) + surname-match fired (strength ≥ 0.8) → rung = `EXACT_FIRST_SURNAME` (base 1.0)
- JW ≥ 0.85 + surname-match fired (strength ≥ 0.8) → rung = `NICKNAME_FIRST_SURNAME` (base 0.85)
- Surname-match strength between 0.6 and 0.8 (BRIDGED excluded) → treat as `PHONETIC_MODERATE_SURNAME`, base 0.7, requires no additional corroboration but scores lower than the above two
- No surname-match (0.0) but exact/nickname first-name agreement → rung = `GIVEN_NAME_ONLY` (base 0.4) — **flag `needsCorroboration = true`**

**3.4 Initial-consistency rung**

- If one side is `INITIAL` and the other is `FULL`: consistent if the initial character equals the first letter of the full name (post-normalization). If consistent AND surname-match fired (strength ≥ 0.8) → rung = `INITIAL_CONSISTENT_SURNAME` (base 0.55), **flag `needsCorroboration = true`** always (this rung never stands alone regardless of surname strength).
- If both sides are `INITIAL`: consistent if characters match. If consistent AND surname-match fired → rung = `BOTH_INITIALS_SURNAME` (base 0.35), **flag `needsCorroboration = true`**, and this rung's weight is further discounted by letter-frequency (see 3.5).
- If inconsistent → given-name signal is `0`, rely on surname-match alone (if fired) at a reduced independent weight (base 0.3), still `needsCorroboration = true`.

**3.5 Rarity weighting**

Compute frequency **within the blocked candidate pool** (same `source` list, same `norm_race`, same `gender` as the target) — not the full `mentions` table, not the full county. Use `buildNameFrequencies()` and `getNameWeightModifier()` as defined in Normalize.md, applied to:

- `norm_first_name` frequency, when the given-name rung fired on first-name agreement.
- `last_name` frequency (the resolved string, not the metaphone code), when a surname rung fired.
- For `INITIAL_CONSISTENT_SURNAME` and `BOTH_INITIALS_SURNAME`: instead of name frequency, compute the frequency of first names in the blocked pool sharing that initial letter, and apply an inverse modifier (rarer starting letter → higher modifier, common letters like J/M/W → lower or negative modifier).

Add the resulting modifier(s) (as integers, per Normalize.md's ±15/±5/0 scale, normalized into the 0–1 lever range by dividing by 100) to the rung's base score. Clamp the final Lever A score to `[0, 1]`.

**3.6 Middle name (tiebreak only)**

`middle_name` is excluded from the weighted sum (COMPARE = `ignore` by default). If two or more candidates are tied on final `probability` after Step 6, break ties by: exact middle initial/name match > no data on either side > mismatch.

---

**STEP 4 — LEVER B: BIRTH-YEAR AGREEMENT**

**4.1 Source-pair profile**

Determine the active profile from `target.source` and `candidate.source`:

| Profile | Condition | Tiers (± years) | Knockout beyond |
|---|---|---|---|
| `CENSUS_CENSUS` | neither source is a slave-schedule (`*-SS-*`) | 0, 1, 2, 3, 5 | ±10 |
| `SCHEDULE_INVOLVED` | either source matches `*-SS-*` | 0, 1, 2, 3, 4 (wider σ) | ±10 |
| `VITAL_RECORD` | either source is a death/marriage record and the comparison concerns `death_year` | 0, 1 | ±3 |

**4.2 Scoring**

If either `birth_year` is absent, exclude this lever from the sum (do not score 0). Otherwise:

```
diff = |target.birth_year - candidate.birth_year|
score = 1.0 if diff === 0
score = 0.92 if diff === 1
score ≈ interpolated smoothly down to 0.0 at the profile's tier ceiling
score = KNOCKOUT (handled in Step 2) if diff exceeds the knockout threshold
```

Use a smooth (e.g. Gaussian or piecewise-linear) falloff consistent with the tier table above rather than hard steps, matching the σ implied by the profile (σ ≈ 2 for `CENSUS_CENSUS`, σ ≈ 3–4 for `SCHEDULE_INVOLVED`).

---

**STEP 5 — LEVER C: HOUSEHOLD/FAMILY CONTINUITY AND LINKED EVIDENCE**

**5.1 Household continuity**

If both `target.household_id` (or `family_id`) and `candidate.household_id`/`family_id` are present:

- Retrieve co-resident mentions for each side.
- +1.0 if a spouse-equivalent co-resident matches (name + birth-year agreement above threshold).
- +0.5 for each other co-resident (child, parent, sibling) whose identity plausibly matches (name + birth-year window overlap).
- Cap total household contribution at **2.0**, then normalize to `[0, 1]` by dividing by 2.0 for combination into the weighted sum (see Step 6 weight table, which already accounts for this being a 0–1 lever).

**5.2 Household absence — redistribution**

If either side lacks `household_id`/`family_id` (e.g., non-census sources such as Freedmen's Bureau entries), do **not** score this sub-lever at a flat neutral value. Instead:

- Set `householdAvailable = false` for this pair.
- In Step 6, redistribute the household weight proportionally across Lever A and Lever B (see Step 6.2) rather than assigning 0.5.

**5.3 Linked-mention corroboration**

Scan `target.linked_mentions` and `candidate.linked_mentions` for any existing assertion connecting the two mention_ids directly, or connecting either to a mention that also matches the other side (transitively, one hop):

- Direct `isSameAs` between target and candidate already existing → treat as a strong prior; set `probability` floor at 0.95 regardless of other levers (still compute and report other levers for transparency).
- Direct `isNotSameAs` between target and candidate → exclude candidate entirely (hard override).
- `hasNameVariant`, `wasEnslavedBy`, or family-predicate assertions that corroborate the pairing (e.g., both mentions independently linked to the same third mention via consistent predicates) → add a flat +0.15 corroboration bonus to the combined score before calibration, capped so total lever contribution does not exceed 1.0.

This corroboration bonus is what satisfies `needsCorroboration` flags raised in Lever A (3.3–3.4). If a candidate has `needsCorroboration = true` and receives no corroboration from Lever B (birth year present and within 1–2 tier) or Lever C (household or linked-mention evidence), cap its final `probability` at 0.5 regardless of raw score — it stays "provisional," never "recorded."

---

**STEP 6 — COMBINATION**

**6.1 Default weights**

```
weight_nameA      = 0.40
weight_birthB     = 0.30
weight_householdC = 0.30
```

**6.2 Redistribution**

If `householdAvailable === false` (per 5.2), redistribute `weight_householdC` proportionally:

```
weight_nameA_adj  = weight_nameA + weight_householdC * (weight_nameA / (weight_nameA + weight_birthB))
weight_birthB_adj = weight_birthB + weight_householdC * (weight_birthB / (weight_nameA + weight_birthB))
weight_householdC_adj = 0
```

If Lever B is also excluded (both birth years absent), redistribute similarly across whatever levers remain present. If only one lever has data, it receives full weight — do not zero out a candidate merely because two of three levers lack data; absence of corroborating data is not evidence against a match, but it should suppress the final probability via the calibration step (6.4), not via a punitive weight scheme.

**6.3 Weighted sum**

```
rawScore = (leverA_score * weight_nameA_adj)
         + (leverB_score * weight_birthB_adj)
         + (leverC_score * weight_householdC_adj)
         + corroborationBonus   // from 5.3, capped
rawScore = clamp(rawScore, 0, 1)
```

**6.4 Calibration to probability**

`rawScore` is not a probability. Apply one of two calibration modes, configurable:

- **`calibration: "logistic"`** (default if a trained model is supplied via `config.logisticWeights`) — apply a logistic regression: `probability = sigmoid(b0 + b1*rawScore + b2*leverC_score + b3*log(candidatePoolSize))`, using weights fit externally against gold-labeled pairs (case studies + FBR-confirmed links) and passed in via config. This class does not perform the fitting — it only applies supplied coefficients.
- **`calibration: "poolRelative"`** (default if no logistic weights supplied) — compute `rawScore` for the target against the **full blocked candidate pool** for this search, then set `probability` for each candidate via softmax over the pool's raw scores (temperature configurable, default 1.0), so that a candidate's probability reflects distinctiveness relative to the field, not just absolute fit.

Apply the `needsCorroboration` cap (Step 5.3) after calibration: `probability = min(probability, 0.5)` if the flag is set and unresolved.

---

**STEP 7 — OUTPUT**

Return an array, sorted descending by `probability`, truncated to the top 80:

```javascript
{
  mention_id: string,
  score: number,        // rawScore, 0–1
  probability: number,  // calibrated, 0–1
  levers: {
    nameA: { score, rung, surnameMatchStrength, needsCorroboration },
    birthB: { score, diff, profile },
    householdC: { score, available, corroborationBonus }
  },
  gates: { blocked: false, knockedOut: false }  // always false/absent for returned rows, included for debugging if config.verbose
}
```

---

**CONFIGURATION DEFAULTS SUMMARY**

| Parameter | Default |
|---|---|
| Blocking fields | `source` (caller list), `norm_race`, `gender` |
| full_name / last_name | exact, else fuzzy via double metaphone (NYSIIS fallback) |
| first_name | exact/nickname JW ≥ 0.85; initial-aware routing per 3.2–3.4 |
| middle_name | ignore (tiebreak only) |
| birth_year | ±3 (census↔census), ±4 (schedule-involved), ±1 (vital record death comparisons); knockout ±10 |
| death_year | ignore except vital-record pairs |
| household/family | weight 0.30, redistributed when absent |
| linked_mentions | corroboration bonus +0.15, hard override on isNotSameAs, floor 0.95 on existing isSameAs |
| Rarity pool | blocked candidate pool only, not full mentions table |
| Weights (name/birth/household) | 0.40 / 0.30 / 0.30 |
| Calibration | poolRelative softmax unless logistic weights supplied |
| Output | top 80 by probability, descending |

---

**IMPLEMENTATION NOTES FOR THE CODE-GENERATING LLM**

- Import existing 	normalize functions from Normalize.md and call them with case-insensitive, with documented base-Jaro and Winkler-prefix phases.
- Do not recompute NYSIIS or double metaphone from raw strings inside this class — both are precomputed fields on the mention row (`nysiis_last_name`, `metaphone_last_name`). Only parse and compare the stored values.
- `buildNameFrequencies()` and `getNameWeightModifier()` should be implemented per Normalize.md and called against the blocked pool passed into `score()`, not cached globally, since the pool changes per search.
- Keep lever computation functions pure and individually unit-testable (`scoreLeverA(target, candidate, pool)`, `scoreLeverB(target, candidate)`, `scoreLeverC(target, candidate)`), with `scoreOne()` composing them.
- All thresholds, weights, and tier tables in this document should be exposed as overridable fields on `config`, not hard-coded constants, so the class can be tuned against gold-labeled pairs without code changes.
