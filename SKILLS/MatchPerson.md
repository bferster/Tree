# MatchPerson — Implementation Specification

Version: revision current as of this document (household noisy‑OR boost, birthplace exact‑match lever, occupation boost lever). **This revision adds four precision fixes** validated against a 500‑pair human‑reviewed sample where strict auto‑accept precision was 52.6%:

- **Surname‑distance guard (§6.1):** a phonetic / NYSIIS surname tier only stands if the raw surnames are also close under Jaro‑Winkler (`surnameFuzzyFloor`, default 0.85). Stops double‑metaphone collisions (Price/Boyers, Carrier/Crow, Gaulden/Clayton) from counting as a full surname match while sparing genuine spelling variants (Snyder/Snider, Kline/Cline). Borderline pairs like Bell/Bull sit right at the default floor and are a tuning decision (§16.1).
- **Nickname demotion (§6.3):** nickname‑*table* equivalence (Fannie/Frances, Betsy/Elizabeth) now routes to the 0.85 `NICKNAME_FIRST_SURNAME` rung and is marked `needsCorroboration`. Base 1.00 (`EXACT_FIRST_SURNAME`) is reserved for **literally identical** normalized given names.
- **Corroboration gate (§11):** `needsCorroboration` is no longer diagnostic‑only. A pair whose name rung needs corroboration and receives **none** (no household, no birthplace agreement, no occupation agreement) takes a subtractive `corroborationPenalty` (default 0.15). This is the second downward soft signal, alongside birthplace disagreement.
- **Calibration features (§13):** the per‑pair feature vector gains `surnameReliability` so probability can finally see how trustworthy the surname match is. Margin (winner − runner‑up) is a **caller‑level** signal and is recommended for the caller's bucketing, not this per‑pair calibration (see §13).

On the validation sample the first three (scoring‑side) fixes together removed 39% of false positives while retaining 95% of true matches, lifting strict precision to ~76%.

Audience: a developer reimplementing `MatchPerson` (and its dependencies) in any language.
Source of truth: `match.js`. Where this document and the code disagree, the code wins — but this document is intended to match it exactly.

---

## 1. Purpose and scope

`MatchPerson(person, mention, ctx)` scores whether two person records refer to the **same individual** and returns a value in `[0, 1]` plus an explanation object. It is the pairwise identity‑resolution primitive used to link one "verified person" (e.g. an 1850 census person) to one candidate "mention" (e.g. an 1860 census line). It does **not** do blocking, candidate retrieval, one‑to‑one assignment, or MATCH/MAYBE/NEW bucketing — those live in the caller (the census‑to‑census tool). `MatchPerson` scores exactly one ordered pair.

The score is built from independent **levers**:

- **A — Name** (given + surname agreement, with nicknames, phonetics, and frequency‑based rarity)
- **B — Birth year** (smooth Gaussian agreement on reported age)
- **C — Household / kin** (noisy‑OR over co‑resident relatives that persist across records)
- **P — Birth place** (exact category match)
- **O — Occupation** (exact category agreement, minor)

Plus hard **knockouts** (gender, race class, death‑before‑census, out‑of‑profile birth gap) that force the score to 0.

Design invariants that must be preserved:

1. **Name + birth form the base identity score.** Household, birthplace‑agree, and occupation‑agree are *boosts* on the residual gap to 1 — they can raise a score but never drag it down. There are exactly two downward soft signals: a birthplace **disagreement** penalty, and the **corroboration gate** (§11) — a subtractive penalty when a name rung that is marked `needsCorroboration` receives no corroborating evidence at all. Both are floored at 0.
2. **A lever with no data is excluded**, not penalized. If a field is missing on either side, that lever contributes nothing (for name/birth the remaining weight redistributes; for the boosts it is simply skipped).
3. **Monotonicity of evidence:** adding a corroborating relative, an agreeing birthplace, or an agreeing occupation never lowers the score.

---

## 2. Record model (fields consumed)

Records are plain string‑keyed maps. All fields are optional; treat missing/empty/`"null"` as absent. Values may occasionally arrive as `"X : Y"` display strings — every reader below defensively takes the part **before the first colon**.

| Field | Used by | Notes |
|---|---|---|
| `first_name`, `norm_first_name` | Lever A | `norm_first_name` preferred when present |
| `middle_name` | Lever A (tiebreak only, not scored) | |
| `last_name` | Lever A | |
| `full_name` | Lever A (exact full‑name shortcut) | |
| `nysiis_last_name` | Lever A (phonetic fallback) | |
| `metaphone_last_name` | Lever A (double metaphone) | format `"PRIMARY:SECONDARY"` |
| `birth_year` | Lever B, Lever C | may be a year, a range, or contain extra text; digit groups of length 3–4 are extracted |
| `death_year` | Knockout | same parsing as `birth_year` |
| `gender` | Knockout, Lever A adjust, Lever C | `M`/`MALE` → `M`; `F`/`FEMALE` → `F`; else unknown |
| `race`, `norm_race` | Knockout | `norm_race` preferred; collapsed to a class (§5) |
| `birth_place`, `norm_birth_place` | Lever P | `norm_birth_place` preferred; **no‑op until present** |
| `occupation`, `norm_occupation` | Lever O | `norm_occupation` preferred; coarse categories |
| `source`, `source_year` | Birth profile selection, census year default | e.g. source containing `-SS-` or `SLAVE` selects the schedule profile |
| `household_id` | *caller only* | the caller uses it to assemble `personKin` / `candidateHousehold`; `MatchPerson` never reads it directly |

---

## 3. Public interface

### 3.1 Signature

```
MatchPerson(person, mention, ctx = {}) -> Result
```

### 3.2 `ctx` options and defaults

| Key | Default | Meaning |
|---|---|---|
| `censusYear` | `parseInt(mention.source_year)` or `null` | Year the mention was recorded; used by the death knockout. |
| `weights` | `{ name: 0.40, birth: 0.30 }` | Base weights for the name+birth identity score. Only these two keys are used. |
| `corroboration` | `0` | Additive external nudge applied at the very end, then clamped. |
| `householdBoost` (β) | `0.6` | Strength of the household noisy‑OR boost. |
| `surnameFuzzyFloor` | `0.85` | Jaro‑Winkler floor on the raw surnames below which a **phonetic / NYSIIS / bridged** surname tier is rejected (falls through to `NO_MATCH`). Exact full‑/last‑name tiers are unaffected (they are identical, JW=1). |
| `corroborationPenalty` | `0.15` | Subtractive penalty applied when the name rung is marked `needsCorroboration` and **no** corroborating evidence fired (household, birthplace‑agree, occupation‑agree all absent). Floored at 0. Set to `0` to restore the old diagnostic‑only behavior. |
| `birthplaceBoost` | `0.15` | Residual‑gap boost when birthplaces match exactly. |
| `birthplacePenalty` | `0.15` | Subtractive penalty when birthplaces disagree (soft). |
| `birthplaceKnockout` | `false` | If `true`, a birthplace disagreement is a hard knockout instead of a penalty. |
| `occupationBoost` | `0.05` | Residual‑gap boost when occupation categories agree. Minor by design. |
| `occupationBoilerplate` | `null` | Array of category strings to treat as blank/neutral (e.g. `["DOMESTIC"]`). |
| `birthProfiles` | see §7 | Per‑profile `{ sigma, knockout }` for the birth lever. |
| `personKin` | `[]` | Array of the verified person's co‑resident relatives (records). |
| `candidateHousehold` | `[]` | Array of the candidate mention's co‑resident household members (records). |
| `householdOpts` | `{ birthGap: 3, nameThreshold: 0.6 }` | Options passed to `scoreHousehold`. |
| `targetSource`, `candidateSource` | `undefined` | Optional source hints for profile selection. |

### 3.3 Return object

On a scored pair:

```
{
  score:       Number in [0,1],
  tier:        'STRONG' | 'SUPPORTED' | 'PROVISIONAL' | 'WEAK',
  firedLevers: String[],            // subset of name,birth,birthplace,family,occupation
  reason:      null,
  weights:     { name, birth, householdBoost },   // effective, post-redistribution
  why:         { ... },             // full explanation, see §13
  probability?: Number in [0,1]     // present ONLY if calibration has been fit (§12)
}
```

On a knockout:

```
{ score: 0, tier: 'KNOCKOUT', reason: <string>, firedLevers: [], why: null }
```

`reason` is one of `GENDER_DISAGREE`, `RACE_DISAGREE`, `DIED_BEFORE_CENSUS`, `BIRTH_GAP_<n>(<profile>)`, `BIRTHPLACE_DISAGREE`.

---

## 4. Normalization helpers (exact behavior)

Two shared string helpers:

- `isPresent(v)` — false when `v` is null/undefined, empty after trim, or equals `"null"` (case‑insensitive); true otherwise.
- `normUpper(s)` — if present: uppercase, then **remove every character that is not A–Z** (drops digits, spaces, punctuation). Used for name comparisons.

Field readers (each takes the substring before the first `:`; returns `''`/`null` when absent):

- `_gender(o)`: from `gender`; `M`/`MALE` → `'M'`, `F`/`FEMALE` → `'F'`, else `''`.
- `_race(o)`: from `norm_race || race`; trimmed uppercase (diagnostic only).
- `_raceClass(o)`: from `norm_race || race`; strip non‑A–Z; then map `W|WHITE → 'W'`; `B|BLACK|M|MU|MULATTO|NEGRO|COLORED → 'BLACK'`; any other non‑empty code returned as‑is. `''` when absent.
- `_birthYear(o)`: `parseInt` of `birth_year` (before colon); `null` if not a finite integer. (Used only by the household lever.)
- `_birthPlace(o)`: `norm_birth_place` if non‑blank else `birth_place`; if blank/`null` → `''`; else uppercase, collapse internal whitespace to single spaces, strip trailing dots/spaces. Compared verbatim.
- `_normOccupation(o, boilerplateSet?)`: `norm_occupation` if non‑blank else `occupation`; if blank/`null` → `''`; else uppercase + collapse whitespace; if the result is in `boilerplateSet` → `''`. Compared verbatim.

`range(v)` (local to `MatchPerson`, used for `birth_year` and `death_year`):

- Extract all runs of 3–4 digits from `String(v)`. If none → `null`. Otherwise return `[min, max]` of those numbers. This lets a value like `"1836"` become `[1836,1836]` and `"1835-1838"` become `[1835,1838]`.

`isSchedule(o, srcHint)`: `true` if `o.source` (or `srcHint`) matches the regex `/(-SS-|SLAVE)/i`.

---

## 5. Pipeline order (top of `MatchPerson`)

Evaluate strictly in this order; the first knockout that fires returns immediately.

1. Resolve `censusYear`, weights, and all tunables from `ctx`.
2. **Knockout — gender:** if both genders known and differ → `GENDER_DISAGREE`.
3. **Knockout — race class:** if both race classes known and differ → `RACE_DISAGREE`. (Black↔Mulatto do **not** differ; White↔non‑white do.)
4. **Knockout — death:** if `range(person.death_year)` exists and `censusYear` is set and `deathRange.max < censusYear` → `DIED_BEFORE_CENSUS`.
5. Compute **Lever A** (name).
6. Compute **Lever B** (birth). A birth gap beyond the profile knockout returns `BIRTH_GAP_<gap>(<profile>)`.
7. Compute **Lever C** (household).
8. Compute **Lever P** (birthplace). A disagreement with `birthplaceKnockout=true` returns `BIRTHPLACE_DISAGREE`.
9. Compute **Lever O** (occupation).
10. **Combine** (§11), assemble `fired`/`tier`/`why`, attach `probability` if calibrated, return.

---

## 6. Lever A — Name

Lever A is computed by `matchNameDetail(objA, objB)`; `MatchName` is just its `.score`. The result carries `score`, `rung`, `surnameStrength`, `surnameKind`, `needsCorroboration`.

### 6.1 Surname match (`_surnameMatch`)

Return the **first** matching tier:

| Condition | strength | kind |
|---|---|---|
| Normalized `full_name` equal on both sides | 1.0 | EXACT_FULLNAME |
| Normalized `last_name` equal | 1.0 | EXACT_LASTNAME |
| Optional injected `surnameBridge(a,b)` returns truthy | 0.9 | BRIDGED |
| Double‑metaphone primary==primary | 1.0 | PHONETIC_STRONG |
| Double‑metaphone primary==other's secondary (either direction) | 0.8 | PHONETIC_MODERATE |
| Double‑metaphone secondary==secondary | 0.6 | PHONETIC_WEAK (weakHint) |
| Metaphone absent on either side **and** `nysiis_last_name` equal | 0.85 | NYSIIS |
| otherwise | 0.0 | NO_MATCH |

`full_name` / `last_name` normalization here: uppercase, replace non‑alphanumeric runs with a single space, collapse spaces, trim (this keeps digits, unlike `normUpper`). Metaphone code parsing: split on `:` into `primary` and `secondary` (secondary defaults to primary); strip non‑A–Z.

**Surname‑distance guard.** The phonetic tiers (`PHONETIC_STRONG`, `PHONETIC_MODERATE`, `PHONETIC_WEAK`, `NYSIIS`, `BRIDGED`) match on codes, not spellings, and double‑metaphone primaries collide for genuinely different surnames (e.g. Bell/Bull, Price/Boyers, Carrier/Crow, Gaulden/Clayton). To keep a phonetic collision from counting as a full surname, apply the guard **after** selecting a phonetic/NYSIIS/bridged tier:

```
if kind in {PHONETIC_STRONG, PHONETIC_MODERATE, PHONETIC_WEAK, NYSIIS, BRIDGED}:
    jwSurname = jaroWinkler(normUpper(lastA), normUpper(lastB))
    if jwSurname < surnameFuzzyFloor:          # default 0.85
        strength = 0.0; kind = 'NO_MATCH'      # collision rejected
```

`EXACT_FULLNAME` and `EXACT_LASTNAME` are exempt — the surnames are literally equal, so `jwSurname = 1`. This spares true spelling drift (Snyder/Snider, Kline/Cline, Rader/Raider all clear 0.85) while dropping collisions of unrelated names. Use the same Jaro‑Winkler defined for nicknames (§6.3); compute it on the surnames read for `_surnameMatch`.

Define **`firedSurname = surnameStrength >= 0.8`** (evaluated *after* the guard, so a rejected collision has `firedSurname = false`).

### 6.2 Given‑name classification (`_classifyGiven`)

Read `norm_first_name` if present else `first_name`, then `normUpper`:

- `''` → class `ABSENT`
- length 1 → class `INITIAL`, `initial = that letter`
- length ≥ 2 → class `FULL`, `initial = first letter`

### 6.3 Rung ladder (base score)

Three levels of given‑name agreement, from strongest to weakest:

- **`givenIdentical`** = `normUpper(givenA) === normUpper(givenB)`, non‑empty — the given names are *literally* the same string after normalization.
- **`givenExact`** = the two given names share a canonical form via the nickname table (`nickname(a) === nickname(b)`, non‑empty) **and are not `givenIdentical`** — i.e. a name‑family equivalence like Fannie/Frances, Betsy/Elizabeth, Ann/Annie.
- **`givenNickname`** = `jaroWinkler(givenA, givenB) >= jwFuzzyPass` (default `0.85`) — a fuzzy spelling match.

Only `givenIdentical` earns the base‑1.00 top rung. Nickname‑table equivalence and fuzzy matches share the 0.85 `NICKNAME_FIRST_SURNAME` rung and are marked `needsCorroboration`, because a same‑name‑family, same‑surname, close‑birth pair is common among siblings and neighbors in a county census and is not, by itself, sufficient identity evidence. Choose the first matching row:

| # | Given classes | Extra condition | rung | base | needsCorrob. |
|---|---|---|---|---|---|
| 1 | either ABSENT | firedSurname | SURNAME_ONLY | 0.30 | yes |
| 2 | FULL / FULL | **givenIdentical** & firedSurname | EXACT_FIRST_SURNAME | 1.00 | no |
| 3 | FULL / FULL | **(givenExact \| givenNickname)** & firedSurname | NICKNAME_FIRST_SURNAME | 0.85 | **yes** |
| 4 | FULL / FULL | (identical\|exact\|nickname) & 0.6 ≤ surnameStrength < 0.8 | PHONETIC_MODERATE_SURNAME | 0.70 | **yes** |
| 5 | FULL / FULL | (identical\|exact\|nickname) & surnameStrength == 0 | GIVEN_NAME_ONLY | 0.40 | yes |
| 6 | FULL / FULL | firedSurname (given didn't agree) | SURNAME_ONLY | 0.30 | yes |
| 7 | INITIAL involved | initials inconsistent, firedSurname | SURNAME_ONLY | 0.30 | yes |
| 8 | INITIAL / INITIAL | initials consistent, firedSurname | BOTH_INITIALS_SURNAME | 0.35 | yes |
| 9 | INITIAL / FULL | initials consistent, firedSurname | INITIAL_CONSISTENT_SURNAME | 0.55 | yes |

If no row matches, `rung = NONE`, `base = 0`. `aAvailable = (rung !== 'NONE')`.

Note the residual limit: two *different people* who share a literally identical given name and surname and a close birth year (e.g. two "William Miller, b. 1828" in one county) still reach row 2 with `needsCorroboration = no`. This is by design — pairwise scoring cannot separate them. They are the caller's problem, resolved by household corroboration (§8) or by one‑to‑one assignment against the competing candidate, not by `MatchPerson`.

### 6.4 Rarity adjustment (only when `base > 0` and frequency maps are loaded)

Frequency maps come from `usePool(mentions)` / `useFrequencies(firstFreq, lastFreq)`. Without a pool, both rarity terms are 0 and `score = base`.

- **`nameWeightModifier(value, freqMap)`** — 0 if `value` absent from the map, else by its count:

  | count ≤ | modifier |
  |---|---|
  | 5 | +15 |
  | 20 | +5 |
  | 100 | 0 |
  | 500 | −5 |
  | else | −15 |

- `raritySurname = nameWeightModifier(surname, lastFreq) / 100` when `firedSurname`.
- `rarityFirst = nameWeightModifier(firstName, firstFreq) / 100` when a full given name drove the match; **or** `_initialLetterModifier(letter)/100` when an initial drove it:

  `_initialLetterModifier` returns, by the letter's share of all first‑name occurrences: share ≥ 0.09 → −15; ≥ 0.06 → −5; ≥ 0.03 → 0; ≥ 0.01 → +5; else +15.

Final: `A_raw = clamp(base + rarityFirst + raritySurname, 0, 1)`.

### 6.5 Gender‑aware adjustment (in `MatchPerson`, after `matchNameDetail`)

Let `gender = personGender || mentionGender`.

- If `gender == 'F'` and `firedSurname`: `A = min(1, A_raw + 0.05)` (married‑surname continuity is slightly stronger evidence for women in this corpus).
- Else if `gender == 'M'` and **not** `firedSurname` and both have a `last_name` and `surnameStrength == 0`: `A = min(A_raw, 0.30)` (cap unsupported male matches).
- Otherwise `A = A_raw`.

---

## 7. Lever B — Birth year

Select the **profile**: `SCHEDULE_INVOLVED` if either side is a schedule source (`isSchedule`), else `CENSUS_CENSUS`.

Default profiles:

| profile | sigma | knockout |
|---|---|---|
| CENSUS_CENSUS | 3.0 | 12 |
| SCHEDULE_INVOLVED | 3.5 | 12 |

Compute intervals `bp = range(person.birth_year)`, `bm = range(mention.birth_year)`. If either is `null`, `bAvailable = false`, `B = 0`, `gap = null` (lever excluded).

Otherwise `bAvailable = true` and the **interval gap** is:

```
gap = (bm.min > bp.max) ? bm.min - bp.max
    : (bp.min > bm.max) ? bp.min - bm.max
    : 0            // intervals overlap
```

- If `gap > profile.knockout` → knockout `BIRTH_GAP_<gap>(<profile>)`.
- Else `B = exp( -(gap^2) / (2 * sigma^2) )`.

(Reference: sigma 3 gives `B(0)=1.00`, `B(1)=0.95`, `B(2)=0.80`, `B(3)=0.607`, `B(4)=0.41`.)

---

## 8. Lever C — Household / kin (noisy‑OR)

`scoreHousehold(anchorMembers, candidateMembers, opts)` with `opts.birthGap` default 3, `opts.nameThreshold` default 0.6. Only invoked when `personKin` is non‑empty **and** `candidateHousehold` is provided; otherwise `H = 0`, `cAvailable = false`.

Greedy one‑to‑one matching of relatives:

```
used = {}                       # candidate indices already taken
matched = []; qualities = []
for am in anchorMembers:
    best = null; bestRank = 0; bestQ = 0; bestIdx = -1
    for i, cm in candidateMembers:
        if i in used: continue
        if genders both known and differ: continue
        ay = birthYear(am); cy = birthYear(cm)
        gap = (ay and cy) ? abs(ay-cy) : null
        if gap != null and gap > maxGap: continue
        ns = MatchName(am, cm)
        if ns < nameThreshold: continue
        birthAgree = (gap != null) ? (1 - gap/(maxGap+1)) : 0.5
        rank = ns + birthAgree            # ranking only, range 0..2
        if rank > bestRank:
            bestRank = rank; best = cm; bestIdx = i
            bestQ = clamp(0.5*ns + 0.5*birthAgree, 0, 1)   # the relative's quality h_k
    if best:
        used.add(bestIdx); matched.push(...); qualities.push(bestQ)

H = 1 - product(1 - h_k for h_k in qualities)      # noisy-OR
count = matched.length
fired = (count >= 1)
```

`H ∈ [0,1]`. One strong relative already lifts `H` substantially; additional relatives add with diminishing returns and saturate toward 1. (The function also returns a legacy linear `score = min(2, count*0.5)` that the combiner ignores.)

---

## 9. Lever P — Birth place (exact match)

`pPlace = _birthPlace(person)`, `mPlace = _birthPlace(mention)`. `pAvailable = pPlace && mPlace`.

- If not available → `placeState = 'NA'` (no effect).
- Else `placeAgree = (pPlace === mPlace)`; `placeState = 'AGREE' | 'DISAGREE'`.
- If `DISAGREE` and `birthplaceKnockout` → knockout `BIRTHPLACE_DISAGREE`.

The effect is applied in the combiner (§11): AGREE → boost, DISAGREE → soft penalty. This lever is a **complete no‑op** when the birthplace field is absent, which is the current data state.

---

## 10. Lever O — Occupation (boost‑only, minor)

`pOcc = _normOccupation(person, boilerplate)`, `mOcc = _normOccupation(mention, boilerplate)`. `occAvailable = pOcc && mOcc`.

- `occState = 'NA'` if not available; else `'AGREE'` if equal, `'DISAGREE'` otherwise.
- Only `AGREE` has an effect (a small boost, §11). `DISAGREE` and `NA` are neutral — occupation legitimately drifts across a decade, so a mismatch is **not** evidence against a match.

`norm_occupation` is a coarse category (e.g. DOMESTIC, AGRICULTURE, LABORER). Because a few categories dominate and coincidental agreement is common, the boost is deliberately small and callers may pass `occupationBoilerplate` to neutralize dominant/gendered buckets.

---

## 11. Combiner

All boosts are **residual‑gap** operators `x ← x + k·(1−x)` (noisy‑OR form; commutative; saturating at 1). Apply in this exact sequence:

```
wA = aAvailable ? weights.name : 0            # 0.40 default
wB = bAvailable ? weights.birth : 0           # 0.30 default
wBase = (wA + wB) or 1                         # redistribute if one absent
S0 = (wA/wBase)*A + (wB/wBase)*B               # base identity score

# birthplace
if placeState == 'AGREE':    S0 = S0 + BP_BOOST   * (1 - S0)
elif placeState == 'DISAGREE': S0 = max(0, S0 - BP_PENALTY)

# household
raw = S0 + BETA * H * (1 - S0)

# occupation (minor)
if occState == 'AGREE':      raw = raw + OCC_BOOST * (1 - raw)

# corroboration gate (subtractive; §6.3 needsCorroboration)
corroborated = C.fired or (placeState == 'AGREE') or (occState == 'AGREE')
if needsCorroboration and not corroborated:
    raw = max(0, raw - CORROB_PENALTY)          # default 0.15

score = clamp(raw + corroboration, 0, 1)
```

Notes:

- If **neither** name nor birth is available, `wBase = 1` and `S0 = 0`; the boosts then operate from 0 (a match cannot be carried by household/place/occupation alone — those only fill the residual gap above the name+birth base).
- Birthplace‑agree, household, and occupation‑agree commute (their composition is `1 − (1−S0)(1−bp)(1−βH)(1−occ)` in the AGREE case), so ordering among the boosts does not change the result. Birthplace **disagree** is subtractive and is applied to `S0` before the boosts.
- The **corroboration gate** is applied last (before the external `corroboration` nudge) and only when the name rung is marked `needsCorroboration` (§6.3) *and* nothing corroborated the pair: household did not fire, birthplace is not AGREE, and occupation is not AGREE. It never fires for the `EXACT_FIRST_SURNAME` (literal‑identical given) rung, which does not need corroboration. Because it only subtracts when no boost was applied, it never interacts with a boost on the same pair. Set `corroborationPenalty = 0` to disable and recover the previous behavior exactly. Record the gate in `why` (§14) so callers can see when it fired.

---

## 12. `fired` levers and `tier`

```
fired = []
if aAvailable and rung != 'SURNAME_ONLY' and A >= 0.40: fired += 'name'
if bAvailable and B >= 0.40:                             fired += 'birth'
if placeState == 'AGREE':                                fired += 'birthplace'
if C.fired:                                              fired += 'family'
tier = fired.length >= 3 ? 'STRONG'
     : fired.length == 2 ? 'SUPPORTED'
     : fired.length == 1 ? 'PROVISIONAL'
     : 'WEAK'
if occState == 'AGREE':                                  fired += 'occupation'   # appended AFTER tier
```

Occupation is listed for transparency but **excluded from the tier count** — a minor signal must not promote a pair's tier.

---

## 13. Probability calibration

`MatchPerson` attaches `probability` **only if** `fitCalibration(rows)` has previously been called on the instance. The calibration is a standardized logistic regression on the feature vector:

```
features = [ A, B, H, surnameReliability ]   # name, birth, household, surname trust
```

`surnameReliability ∈ [0,1]` encodes how much to trust the surname match — the signal the old 3‑feature vector `[A, B, H]` was blind to. Without it, a phonetic‑surname pair and an exact‑surname pair with the same `A` were indistinguishable to the calibrator, so `probability` could not separate them (on the validation sample, mean probability was 0.93 for true matches and still 0.83 for false positives). Map from `surnameKind`:

| surnameKind | surnameReliability |
|---|---|
| EXACT_FULLNAME, EXACT_LASTNAME | 1.00 |
| BRIDGED | 0.85 |
| NYSIIS | 0.70 |
| PHONETIC_STRONG | 0.70 |
| PHONETIC_MODERATE | 0.50 |
| PHONETIC_WEAK | 0.35 |
| NO_MATCH | 0.00 |

`fitCalibration` z‑scores each feature (stored mean/std), fits weights + bias by gradient descent (L2‑regularized), and `probability(features)` returns the sigmoid. `probability` throws if the feature length ≠ the fitted dimension; `MatchPerson` swallows that and simply omits the field. **When you change the feature list, update the caller's labeled‑pair export in the same commit** — the export must emit the same features in the same order, or every fitted model silently misaligns.

Birthplace and occupation remain **out** of the vector (they are no‑ops in the current data). Add them only alongside a matching export change.

**Margin is a caller‑level signal, not a per‑pair feature.** The winner‑minus‑runner‑up margin requires comparing a person against *all* candidate mentions, which `MatchPerson` never sees — it scores one ordered pair. Do not add margin here. Instead, the caller's MATCH/MAYBE/NEW bucketing should incorporate margin directly: on the validation sample a thin margin was a strong risk marker, and routing thin‑margin winners to MAYBE catches false positives that no per‑pair feature can. Keeping margin caller‑side preserves the invariant that `MatchPerson` is a pure pairwise primitive.

When no calibration is fit, callers should treat the ordinal `score` as the decision variable and display probability as unavailable.

---

## 14. `why` object schema

Every scored result carries `why` (a knockout has `why: null`):

| Field | Type | Meaning |
|---|---|---|
| `name` | number | Lever A score `A` (post gender adjust) |
| `birth` | number | Lever B score `B` |
| `family` | number | `H` (household support), also the calibration family feature |
| `householdH` | number | same as `family` |
| `boost` | number | β actually used |
| `base` | number | `S0` after the birthplace adjustment, before household/occupation |
| `rung` | string | name rung (§6.3) |
| `surnameKind` | string | surname tier kind (§6.1), post surname‑distance guard |
| `surnameReliability` | number | surname‑trust scalar fed to calibration (§13) |
| `needsCorroboration` | bool | from the name rung |
| `corroborationGate` | bool | true if the §11 corroboration penalty was applied |
| `birthGap` | number \| null | interval gap in years |
| `birthProfile` | string | `CENSUS_CENSUS` or `SCHEDULE_INVOLVED` |
| `familyCount` | number | number of matched relatives |
| `birthplace` | string | `AGREE` / `DISAGREE` / `NA` |
| `birthplaceAgree` | bool \| null | |
| `birthPlacePerson`, `birthPlaceMention` | string | normalized place strings |
| `occupation` | string | `AGREE` / `DISAGREE` / `NA` |
| `occupationAgree` | bool \| null | |
| `occupationBoost` | number | OCC_BOOST used |
| `occupationPerson`, `occupationMention` | string | normalized categories |
| `familyMatches` | string[] | matched relatives as `"Name-Year"` |
| `corroboration` | number | the external nudge used |
| `available` | object | `{ name, birth, birthplace, occupation, household }` booleans |

---

## 15. Constants summary

| Constant | Default | Where |
|---|---|---|
| weight: name | 0.40 | base identity |
| weight: birth | 0.30 | base identity |
| β householdBoost | 0.60 | household boost |
| birthplaceBoost | 0.15 | Lever P agree |
| birthplacePenalty | 0.15 | Lever P disagree |
| birthplaceKnockout | false | Lever P |
| occupationBoost | 0.05 | Lever O agree |
| surnameFuzzyFloor | 0.85 | Lever A surname‑distance guard |
| corroborationPenalty | 0.15 | combiner corroboration gate |
| birth sigma (census) | 3.0 | Lever B |
| birth knockout (census) | 12 | Lever B |
| birth sigma (schedule) | 3.5 | Lever B |
| jwFuzzyPass | 0.85 | nickname fuzzy pass |
| exact‑given rung | givenIdentical (literal) only | Lever A §6.3 |
| nickname/fuzzy rung | base 0.85, needsCorroboration | Lever A §6.3 |
| household maxGap | 3 | Lever C |
| household nameThreshold | 0.6 | Lever C |
| firedSurname threshold | 0.8 | Lever A |
| name‑fired for tier | A ≥ 0.40 & rung≠SURNAME_ONLY | tier |
| birth‑fired for tier | B ≥ 0.40 | tier |
| rarity buckets | 5 / 20 / 100 / 500 | Lever A |
| rarity modifiers | +15 / +5 / 0 / −5 / −15 | Lever A |

---

## 16. Reference test vectors

Both records: `full_name="SAMUEL VENEY"`, `first_name/norm_first_name="SAMUEL"`, `last_name="VENEY"`, `gender="M"`. Person `birth_year=1836`, mention `birth_year=1839` (3‑year drift). Race Person `B`, mention `M`. No frequency pool loaded (so `A = base = 1.0`). `censusYear=1860`. Defaults elsewhere. Expected `score` rounded to 3 dp:

| Scenario | Extra inputs | Expected score | Key `why` |
|---|---|---|---|
| Base (name+birth only) | — | **0.831** | birth 0.607, family 0, tier SUPPORTED |
| + household (2 persisting relatives) | `personKin`/`candidateHousehold` = Tobias 1792/1793, Sally 1800/1801 | **0.931** | family (H) 0.984 |
| Household present but junk roster | one non‑matching member | **0.831** | H 0, **no drag** (equals base) |
| Birthplace AGREE | both `birth_place="Virginia"` | **0.857** | birthplace AGREE |
| Birthplace DISAGREE (soft) | `"Virginia"` vs `"Maryland"` | **0.681** | birthplace DISAGREE |
| Birthplace DISAGREE + knockout | + `birthplaceKnockout:true` | **0 / KNOCKOUT** | reason BIRTHPLACE_DISAGREE |
| Occupation AGREE | both `norm_occupation="AGRICULTURE"` | **0.840** | +0.008, occ in fired, tier unchanged |
| Occupation DISAGREE / one blank | — | **0.831** | neutral (equals base) |
| Race W vs B | mention race `W` | **0 / KNOCKOUT** | reason RACE_DISAGREE |
| Race B vs M | (the default here) | scored, **not** knocked out | B/M same class |

Hand‑derivation of the base row: `A=1.0`; `B=exp(−9/18)=0.6065`; `wA/wBase=0.4/0.7`, `wB/wBase=0.3/0.7`; `S0 = 0.5714·1.0 + 0.4286·0.6065 = 0.8313`. No boosts ⇒ `score=0.831`. All nine original scenarios above are **unchanged** by this revision: the person/mention share a literally identical given name and surname, so they still take the `EXACT_FIRST_SURNAME` rung (`needsCorroboration = no`) and the gate never fires.

### 16.1 New reference vectors (this revision)

No frequency pool loaded (so name rung base is the score contribution). Same‑year birth (`B = 1.0`) unless noted; no household, birthplace, or occupation. `censusYear = 1860`.

| Scenario | Inputs | Old score | New score | Why |
|---|---|---|---|---|
| **Nickname demotion + gate** | given `WILL` vs `WILLIAM` (nickname‑table equal, not identical); surname `MILLER` = `MILLER`; male | **1.000** | **0.764** | rung `NICKNAME_FIRST_SURNAME` (base 0.85, needsCorrob **yes**); `S0 = 0.5714·0.85 + 0.4286·1.0 = 0.914`; gate −0.15 (no corroboration) ⇒ 0.764 |
| **Surname‑collision guard** | given `MARGARET` = `MARGARET`; surname `PRICE` vs `BOYERS` (metaphone primaries collide, but JW ≈ 0.46 < 0.85); female | **1.000** | **0.507** | guard rejects the phonetic surname ⇒ `NO_MATCH`, not `firedSurname`; rung `GIVEN_NAME_ONLY` (base 0.40, needsCorrob yes); `S0 = 0.657`; gate −0.15 ⇒ 0.507 |
| **Spelling variant preserved** | given `WILLIAM` = `WILLIAM`; surname `SNYDER` vs `SNIDER` (JW ≈ 0.91 ≥ 0.85); male | **1.000** | **1.000** | JW clears the floor, so `PHONETIC_STRONG` still fires; rung `EXACT_FIRST_SURNAME`; identical to old behavior |
| **Gate does not fire when corroborated** | nickname pair as row 1 **plus** 1 persisting relative (H ≈ 0.75) | (n/a) | **≈ 0.978** | `needsCorroboration` but household fired ⇒ no penalty; household boost lifts `S0 = 0.914` toward 1 |
| **Boundary case (documented)** | surname `BELL` vs `BULL` | 1.000 | depends | JW ≈ 0.850 sits exactly on the default floor — kept at `surnameFuzzyFloor = 0.85`, rejected if the floor is raised. Tune per corpus. |

The first two rows are the core precision wins: pairs that previously scored a perfect 1.000 on name+birth alone now land well below any sane accept threshold unless real corroboration exists.

---

## 17. Edge cases and invariants to test

- **No‑op guarantees:** with birthplace and occupation absent (current data), scores equal the name+birth+household result exactly. Adding the birthplace column must not change any pair whose places are blank.
- **Never‑drag (boosts):** for fixed name/birth, increasing `H`, or flipping occupation to AGREE, or flipping birthplace to AGREE, must be non‑decreasing in `score`. The only subtractive signals are birthplace DISAGREE and the corroboration gate — and both are *removed* by adding corroboration, so acquiring evidence is still monotone non‑decreasing.
- **Surname‑distance guard:** a phonetic/NYSIIS/bridged surname whose raw Jaro‑Winkler is below `surnameFuzzyFloor` must not set `firedSurname`; an exact full‑/last‑name match must be unaffected (JW = 1). Test PRICE/BOYERS (reject) vs SNYDER/SNIDER (keep).
- **Exact rung is literal‑only:** a nickname‑table pair (WILL/WILLIAM) must land on `NICKNAME_FIRST_SURNAME` (0.85, needsCorroboration), never `EXACT_FIRST_SURNAME`. Only a byte‑identical normalized given name reaches base 1.00.
- **Corroboration gate:** with `needsCorroboration` and zero corroboration, `score` must drop by exactly `corroborationPenalty` (floored at 0) relative to the same pair with the gate disabled; with any one of household‑fired / birthplace‑AGREE / occupation‑AGREE, the gate must not fire. Setting `corroborationPenalty = 0` must reproduce the pre‑revision score bit‑for‑bit.
- **Absent‑lever redistribution:** a pair with birth missing scores on name alone at full name weight (`wBase = 0.40`), not a diluted value.
- **Colon‑delimited values:** `gender="M : F"` reads as `M`; same defensive split for race/birth fields.
- **Range birth years:** overlapping ranges give `gap = 0`, `B = 1`.
- **Knockout precedence:** gender → race → death → birth‑gap → (optional) birthplace. The first to fire wins; `why` is null and `score` is 0.
- **Determinism:** the household greedy match iterates anchor members in array order and picks the max‑rank unused candidate; results are order‑dependent on the anchor list but deterministic for a fixed input.

---

## 18. Suggested build order

1. String helpers (`isPresent`, `normUpper`), field readers, `range`, `isSchedule`.
2. Jaro / Jaro‑Winkler; nickname canonicalization; double‑metaphone scorer.
3. `_surnameMatch` (including the surname‑distance guard, §6.1), `_classifyGiven`, the rung ladder (`givenIdentical` vs `givenExact`/`givenNickname`, §6.3), rarity → `matchNameDetail` / `MatchName`. Unit‑test the rung table directly, and test the guard on PRICE/BOYERS vs SNYDER/SNIDER.
4. `scoreHousehold` (noisy‑OR). Unit‑test H against the 2‑relative vector (0.984).
5. Levers B/P/O readers and states.
6. The combiner including the corroboration gate (§11), `fired`/`tier`, then the `why` assembly (with `surnameReliability` and `corroborationGate`).
7. Calibration (`fitCalibration` / `probability`) last — optional, off by default. Emit the 4‑feature vector `[A, B, H, surnameReliability]` and update the caller's labeled‑pair export in the same change.
8. Validate against every row in §16 **and** the new vectors in §16.1.
