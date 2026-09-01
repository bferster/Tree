---
name: Search Format
description: Tree-driven, on-demand search for mentions that may refer to a person in the researcher's tree
---

# SEARCH

Takes the current tree and a highlighted person, and returns primary-source
mentions that may refer to that person. Replaces the en-masse verified-people
build with an as-needed one. Nothing here writes `isSameAs`; the function
returns ranked candidates and the researcher decides.

Implemented in `search.js`, scoring delegated to `match.js`. Figures quoted
throughout are measured against the AUG corpus (150,827 mentions, 13 sources,
Augusta County only) and the AUG-demo tree.

## ENTRY POINTS

	search.scan(curTree, personId, opts)             -> coverage, all sources
	search.find(curTree, personId, opts)             -> ranked candidates, ONE source
	search.findBatch(curTree, personIds[], opts)     -> several people, cross-supported
	search.accept(curTree, personId, mentionId)      -> isSameAs row + new leads
	search.reject(curTree, personId, mentionId)      -> isNotSameAs row
	search.buildBridges(sourceA, sourceB, opts)      -> household bridge edges
	search.buildAllBridges(opts)                     -> every adjacent census pair
	search.buildCalibrationFromTree(curTree)         -> labeled rows
	search.seedCalibration(rows)                     -> fit the probability model

	SCAN  cheap. Blocking-key retrieval only, no lever scoring. Returns
	      per-source counts and a rough name-only best score. Answers
	      "where might evidence exist," not "who is it." ON REQUEST ONLY -
	      see SCAN TRIGGER.

	FIND  expensive. Full lever scoring against ONE source; opts.source
	      required. Single-source by design: scores are not comparable
	      across source types, because different levers are even available.
	      A 0.72 against an 1870 census row and a 0.72 against a Find A
	      Grave entry do not mean the same thing.

	Everything else is derived from curTree. The caller passes no name, no
	birth year, no kin list.

## STAGE 1 - DEREFERENCE, VALIDATE, BUILD PROFILE

Attributes in curTree are stored as `value:mention_id`
(`"birth_year": "1835:AUG-CN-1870-4795"`). This convention is the best thing
in the tree format: it gives per-field provenance for free, which is exactly
what Lever B needs to set sigma per source type.

Dereferencing is NOT optional. `match.js` splits a `:suffix` off gender, race,
birth_year, birth_place and occupation, but not off the name fields:

	Match.normUpper("Crawford:AUG-CN-1870-4795")  ->  "CRAWFORDAUGCN"
	range("1835:AUG-CN-1870-4795")                ->  [1835, 4795]

Every object handed to `MatchPerson` must be dereferenced first.

	1a. Split each field into { value, source, type, reliability }.
	    Validate: fetch the cited mention and confirm the stored value
	    actually appears in it. A mismatch is a data error, not a search
	    input; report it and drop the field. (The AUG demo tree cites
	    AUG-CN-1870-11826 as "Cyrus Alexander"; that mention is Thomas
	    Farr.)

	1b. Rebuild every field from ALL linked mentions. Attributes are
	    multi-valued across sources and curTree keeps one.

	    Dedupe on (source, value), NOT on source alone. When a tree field
	    cites a mention, 1a already registered that source, so a
	    source-only check discards what the mention actually says. P002's
	    tree says "Arch" citing AUG-CN-1880-24520; that mention says
	    "Archy". Both are attestations and both are needed.

	1c. Birth window across all attestations.

	        1835 from AUG-CN-1870-4795
	        1840 from AUG-CN-1880-24520
	        -> window [1835, 1840]

	    Search the window. A point value from whichever mention happened to
	    be stored first misses on one end of the drift.

	1d. Modal value per field, not first. When sources disagree the
	    most-attested value wins and the disagreement is reported as
	    CONFLICTING_ATTESTATIONS, instead of one arbitrary source silently
	    renaming the person.

	1e. Phonetic keys are copied only from a mention agreeing on the field
	    being copied. Copying norm_first_name off a surname-matched mention
	    can attach ARCHY to a person whose chosen given name is Arch.

	Field reliability -> Lever B sigma:
		VR / DR / FG                    hard    sigma 1.5
		FBR, church, cohabitation, SB   medium  sigma 2.5
		census self-reported age        soft    sigma 3.0
		schedule age estimate           softest sigma 3.5

### Name variants

Score against EVERY attested spelling and keep the best. Normalize.md's
nickname table does not always collapse them: in AUG, Archibald/Arch/Archie
map to ARCHIBALD (166 mentions) but Archy -> ARCHY, Archd -> ARCHD,
Archabald -> ARCHABALD are each left alone. Two spellings of one man then
never compare equal on the given name, the rung falls to SURNAME_ONLY, and an
EXACT_FULLNAME pair scores as though only the surname matched.

Variant scoring makes the result independent of which spelling is modal. It
does NOT rescue a person attested under only one un-collapsed spelling; that
requires the table or the fuzzy threshold (see MATCH.JS DEPENDENCIES).

## STAGE 2 - EGO-CENTRIC NORMALIZATION

curTree stores relationships as a single `anchor` per person
(`"anchor": "isChildOf:P002"`), so the graph is a tree rooted at the person
whose anchor is null. `relationships[]` is unused. Two consequences:

	- Children attach to one parent only. Jinnie is isChildOf P002 with no
	  stored link to Martha, even though Martha is P002's spouse.
	- Siblings are never stored.

So the kin set is built, not read. Following Kouki et al. (relational
normalization), invert then impute, centered on personId.

	Inversion (explicit map; never string-manipulate)
		anchor "isChildOf:P002" on X      ->  P002 isParentOf X
		anchor "isSpouseOf:P002" on X     ->  P002 isSpouseOf X
		anchor "isEnslaverOf:P002" on X   ->  P002 wasEnslavedBy X

	Imputation, capped at 2 hops
		shared anchor parent        -> isSiblingOf,      weight 0.8
		spouse of parent            -> isParentOf,       weight 0.6
		parent of parent            -> isGrandParentOf,  weight 0.5

	Plausibility gate on imputed parenthood: the child's birth year must
	fall between the parent's age 13 and 50 (F) or 14 and 70 (M). Outside
	that, emit as a hypothesis for the researcher, not a search input.

	Weight = hop_weight  x  verity/4  x  grounded

	grounded = 1.0 with a confirmed mention in the target source-year,
	0.3 for name-only. An ungrounded relative is a hint; scoring it as
	evidence inflates Lever C on the links most needing scrutiny.

	Kin objects are tagged with `_predicate` so match.js can tell a spouse
	from a child. Without it the contradiction lever cannot fire.

## STAGE 3 - TIME SLICE

Project the kin set onto opts.year. Drop anyone not yet born and anyone with
a death year before it.

	Searching Martha in 1870:
		keep   Jinnie (b.1864), Charles (b.1866), Mary Lee (b.1868),
		       Lena (b.1870), Arch (spouse)
		drop   Katy (b.1873), Lawrence (b.1876), Sidney (b.1878)

Dropping matters as much as keeping. An unborn child counted as absent looks
like disconfirmation of a correct match.

### Marriage year is an UPPER bound

Only assertions from sources that RECORD a marriage date may exclude a spouse
from earlier years. A census `isSpouseOf` carries start_year = the enumeration
year, because that is when the couple was OBSERVED married, not when they
married. All 4,646 isSpouseOf rows in AUG come from a census (3,773) or a
cohabitation register (873), so reading start_year literally makes every
couple look newly wed in whichever year they were first enumerated.

Arch and Martha are enumerated together in 1880. A literal reading dropped her
spouse from every pre-1880 search, and with him the household, proximity and
Lever C support that finding her in 1870 depends on. Her true 1870 record fell
to rank 2 behind an unrelated Martha Crawford from this alone.

Cohabitation registers are worse than neutral: they record couples formalizing
unions that predate emancipation, so the date is the registration.

	MARRIAGE_DATE_TYPES = ['VR']

### Co-residence expectation

	expected      minor child, spouse
	not expected  married daughter, adult son with own household, anyone
	              whose own record places them elsewhere
	unknown       everyone else

Only `expected` kin count against a candidate when absent.

## STAGE 4 - CONSTRAINTS

### Confirmed constraints (hard)

	Knockouts
		gender      populated M vs F disagreement
		race        different _raceClass (B and M collapse)
		birth       gap beyond the profile knockout, which now widens
		            with sigma (see Lever B)
		death       any accepted VR / DR / FG death year before opts.year

	Exclusions
		- mentions already linked to this person
		- mentions already linked to ANY person in curTree
		- mentions carrying isNotSameAs against this person
		- person.rejected[]
		- the whole of opts.source if this person already holds a
		  confirmed mention in it

	One-appearance-per-source-year assumes the existing link is CORRECT.
	If a researcher accepted the wrong record, the search that would
	surface the right one is now shut. `opts.ignoreHeld` should run anyway
	and rank the held mention alongside the alternatives. The UI must also
	render a closed source differently from an empty one - both return
	zero candidates, and only one of them means "nothing found".

### Provisional constraints (soft, WARN ONLY)

Reading death years only off ACCEPTED mentions means an unlinked record
constrains nothing. AUG-VR-1162 (Martha Crawford, b.1840 d.1883) sits in the
corpus scoring 0.857 against her with no rival, and until someone links it by
hand it has no effect on any search.

`provisionalConstraints()` searches VR/DR/FG directly before scoring and
returns an unambiguous top hit.

	Requirements: score >= 0.80, margin >= 0.10 over the runner-up,
	source not already held, recursion guarded, cached per public call.

	If two constraint sources disagree by more than 2 years, return
	{ conflict: true } and apply NOTHING. Martha now hits this: AUG-VR-1162
	(d.1883) and AUG-FG-8784 "Martha Hanger Mattie Walker Crawford"
	(d.1911) both clear 0.80.

PROVISIONAL CONSTRAINTS WARN; THEY NEVER KNOCK OUT. A death ceiling only ever
REMOVES candidates, so acting on an unconfirmed one makes the true match
disappear with no explanation the researcher can see. Confirmed evidence
closes a search; provisional evidence flags it, returns the candidates anyway
with `closed: false`, and attaches the offending mention_id and score so it
can be accepted or rejected - at which point it becomes a real constraint
through the ordinary path.

In SCAN, a provisional ceiling greys a source out rather than blocking it.

## STAGE 5 - RETRIEVAL

Union of the following, capped at MAX_CANDIDATES.

	1. Blocking keys        L, N, F, M, FB (per Census2Census)
	2. Surname variants     via hasNameVariant assertions
	3. Household expansion  for each grounded kin member with a mention in
	                        opts.source, pull that mention's whole hhKey
	                        roster regardless of surname
	4. Bridge expansion     precomputed household bridge edges
	5. Holding expansion    for each wasEnslavedBy enslaver with a schedule
	                        mention, pull the whole holding

### FB must use the first token and every spelling

The FB index is keyed on norm_first_name, and normUpper strips whitespace, so
"MARTHA J" becomes MARTHAJ and never collides with MARTHA. 1,378 AUG mentions
carry a multi-token norm_first_name and 1,343 of them have a first token that
already exists as a simple form - those records were unreachable through FB
entirely. Index and query both key on the first token (`givenKey`).

FB must also run for EVERY attested spelling, not just the modal one: a person
attested as both "Arch" (-> ARCHIBALD) and "Archy" (-> ARCHY) sits under two
keys, and searching one silently drops the other. This matters most for the
case FB exists to cover, a woman whose surname changed, where FB is the only
path left.

### The cap must protect relational paths

Household, holding, bridge and FB hits are never discarded to make room for
surname blocks. Those are the paths that survive a surname change or a bad
transcription; trimming them defeats the point of running them.

### Household expansion is a path, not a short circuit

	Arch Crawford, 1880: head of FC1880-4442, wife and 7 children.
	Arch Crawford, 1870: FC1870-829, a WHITE household headed by John H
	Dalhouse, where Arch is a non-head Black farm laborer. No wife, no
	children present.

His family in 1870 is elsewhere - Martha heads FC1870-830, the very next
household, with two of the same children. Expanding Arch's 1870 household to
find her returns the Dalhouse family. This pattern (a Black laborer resident
on a white employer's farm while his family is enumerated separately) is
common enough in 1870 that a bridge built from it would be actively
misleading. Enumeration proximity is what recovers the case.

### Surname variants come from hasNameVariant ONLY

Building the class from isSpouseOf as well links Crawford<->Scott because some
Crawford married some Scott, which collapses most of the county into one
surname class and floods retrieval. Spouse-surname bridging is a per-pair
question, handled in the scorer.

## STAGE 6 - SCORING

FIND applies the levers in score.md through `match.js`. Additions specific to
this function, plus changes made inside match.js that this stage depends on.

### Enumeration proximity

The enumerator walked a route, so sequence distance is geography. Residual-gap
boost against any grounded kin mention in the same source, decaying over a
40-line window, scaled by kin weight.

This is the lever that separates the true Martha Crawford (AUG-CN-1870-4797,
enumerated two lines after her husband's employer) from an unrelated Martha
Crawford with a closer birth year. Without it a 2-year birth-gap advantage
outranks four corroborating children.

### Contradiction as negative evidence

Lever C only ever adds: a candidate whose household holds none of the expected
kin scores the same as one with no household at all. Those are different
findings. Kin ABSENCE is usually uninformative - people board out, families
split, a wife dies. Kin CONTRADICTION is not: if this person's wife is Martha
b.1840 and the candidate is a head living with a wife named Sarah b.1852, the
slot is filled by someone else.

	Spouse slots only. A missing or replaced child is far too common to
	read as contradiction; a co-resident spouse is a single occupancy two
	women cannot both hold at one census.

	Soft and proportional to occupant misfit, not a knockout, because
	remarriage after a death is real. Suppressed entirely when the
	person's own records show the spouse could already have died.

Effect on the demo tree: Martha's rival AUG-CN-1870-2248 (in Cyrus Crawford's
household, spouse slot occupied by someone else) fell from 0.817 to 0.757,
while the true match rose to 0.890. Margin went from 0.022 to 0.133 and the
status from MAYBE to MATCH.

### Age heaping

Self-reported census ages pile up on multiples of 5 and 10. Measured on
AUG-CN-1870, ages 20-70, last digit of reported age:

	digit 0   19.5%        digit 5   14.1%
	all others 6.2 - 10.4%              (10% expected each)

A Whipple index near 168, "rough" by demographic standards. An age landing on
0 or 5 is much more likely to have been rounded, so Lever B widens sigma:
x1.35 on a multiple of 10, x1.20 on a multiple of 5, adults only. Children's
ages are usually reported by a parent who knows them.

### Interval-scaled sigma

Drift accumulates with the separation between records - Arch is b.1835 by the
1870 census and b.1840 by the 1880 one. Sigma grows as sqrt(decades), since
the drift behaves like accumulated independent error rather than a trend. The
knockout widens with sigma too, or a legitimately drifted pair is discarded
before it can be scored.

### Middle initial

`_classifyGiven` returns a trailing initial from a compound given name
("MARTHA J" -> MARTHA + J) and middle_name carries one directly. +0.05 on
agreement, -0.05 on disagreement, neutral when either side is absent -
enumerators drop middle initials constantly. Agreement also counts as a
corroboration channel.

### Boarder carve-out

match.js's corroboration gate subtracts 0.15 when a needsCorroboration rung
has no household, birthplace or occupation agreement. It must only fire when
corroboration was POSSIBLE. Two cases invert the evidence otherwise:

	1. The candidate is a boarder. Arch in 1870 is a lone Black farm
	   laborer inside the white Dalhouse household, so his wife and
	   children are correctly absent. Penalizing that dropped his true
	   1870 record from rank 1 to rank 6, below the floor.
	2. No kin are known yet. Early in a tree nobody has relatives, so the
	   household channel cannot fire for anyone and every
	   needsCorroboration rung takes a blanket -0.15.

`Match.isBoarder` marks a non-head whose surname differs from the head's.
search.js does not pass a penalty override; match.js decides, so
census2census.htm gets the same behavior.

### Child-cohort profile

When several time-sliced children are expected co-resident, score the joint
age-sex profile rather than child by child. Searching Martha in 1870 means
looking for a B female b.~1840 with a 6F, 4M, 2F and 0F alongside her. Far
more distinctive than any single name-and-age hit, and it survives bad name
transcription completely. Applied when Lever C is weak.

### Enslaver lever

A shared enslaver is a shared location and community, so weight it near Lever
C rather than as a demographic filter. Scale by holding size: a 5-person
holding is a tight block, a 90-person holding is weak.

	Cyrus Alexander's HS1860-920 holds five people:
		1813 M, 1835 F, 1840 F, 1856 M, 1859 F
	P002 is male, b.1835-1840. The only adult male is b.1813. FIND against
	AUG-SS-1860 returns nothing, and the knockout tally says why:
	3 GENDER_DISAGREE, birth gaps of 16 and 22. That is a finding about
	the tree's enslaver link, not a failed search.

Freedpeople frequently took the surname of a FORMER rather than final
enslaver, so surname agreement with the enslaver is suggestive and must not be
scored as reliable.

### The enslavement data is better than the schedules suggest

All 2,390 `wasEnslavedBy` assertions in AUG come from slave birth registers
(AUG-SB), and 2,169 of them (91%) have a NAMED enslaved subject. AUG-SB also
supplies 1,114 isParentOf rows tying children to named mothers, and AUG-CH
carries 1,308 named enslaved mentions.

	Jeremiah  wasEnslavedBy  James W Crawford
	Patsy     isParentOf     Jeremiah

So the pre-1865 bridge does not have to run through nameless age-sex profiles.
Named triples exist and should be the primary path; profile matching against a
holding is the fallback, not the default.

## RETURN

	SCAN
		{ person_id, name, issues, provisional_constraint, kin[],
		  sources: [ { source, year, label, candidates, best_rough,
		               provisional_warning, blocked_reason } ] }

	FIND
		{ person_id, name, source, year, closed, closed_by, note,
		  warning, provisional_constraint,
		  retrieved, knockouts, below_floor,
		  constraints_applied[], kin_used[], issues[],
		  candidates: [ { mention_id, score, baseScore, probability,
		                  status, margin, second_best, tier,
		                  firedLevers[], why, corroborators[] } ] }

	`why` carries the lever breakdown plus: paths (which retrieval path
	produced the candidate), variant (which spelling won), boarder,
	proximity, cohort, enslaver, contradiction, heapFactor, intervalScale,
	birthSigma, birthKnockout, middleInitial, corroborationPossible,
	corroborationChannels, margin, second_best.

	Retrieval path matters to a reviewer: a candidate found by household
	expansion and one found by FB retrieval on a common given name deserve
	different scrutiny at the same score.

	An empty candidate list must explain itself. `knockouts` tallies the
	reasons; `below_floor` counts the rest.

	status is MATCH only for the TOP candidate, only above ceiling, and
	only with margin over the runner-up. A score several candidates reach
	is not identifying.

	Always return the runner-up and the margin. A researcher hunting an
	expected ancestor will accept a weaker match than a blind matcher
	would; the runner-up is the cheapest available check on that.

## HOUSEHOLD BRIDGES

Batch precompute mapping source household -> target household across an
adjacent census pair, as WEIGHTED EDGES rather than an assignment.

	1. Household objects per (source, hhKey), hhKey = household_id ||
	   family_id. 1850/1860 populate household_id; 1870/1880 populate only
	   family_id, and without the fallback Lever C scores zero for every
	   1870/1880 pass.
	2. Seed anchors, strict only: near-exact name, birth gap <= 2, clear
	   margin over runner-up, no bridge input. Tagged SEED-tier.
	3. Tally votes: which target household did each source household's
	   anchors land in.
	4. Score each edge on support, coverage both sides, head-to-head name
	   agreement, margin over the next-best edge.
	5. Keep above floor, MANY-TO-MANY. Households split when children
	   marry and merge when a widow moves in with a son. Forcing
	   one-to-one destroys the cases most worth seeing; asymmetric
	   coverage is the signature of those events, not a defect.
	6. Store the anchoring mention pairs on every edge. That is what makes
	   a candidate explainable and what lets a bridge be invalidated
	   cheaply when a human rejects one of its anchors.

	Measured, AUG-CN-1870 -> AUG-CN-1880, 1.4s:
		4,865 source households, 7,447 seed anchors
		2,556 bridged (52.5%), 2,984 edges, median support 2
		380 source households with >1 edge (splits and merges)

	FC1870-829 (Arch's boarding household) bridges to the DALHOUSE 1880
	family, not to Arch's own FC1880-4442. Correct, and the reason
	household expansion is one path among several.

CIRCULARITY. Bridges are built from person matches and then used to retrieve
person matches. If a bridge-derived match were fed back into seeding, one
wrong anchor would recruit a whole household which would then look like strong
support for itself. Only SEED-tier anchors rebuild bridges.

The 1860->1870 gap has no bridge for the formerly enslaved: there is no 1860
household, only a holding. That gap is the holding-to-household table's job
and belongs in a parallel artifact with its own scoring.

## CALIBRATION

`fitCalibration` needs both classes and the log ships empty, so `probability`
is null and floor / ceiling / margin stay hand-picked constants until
something fills it.

	buildCalibrationFromTree(curTree)
		positives: every accepted mention
		negatives: the candidates that LOST to it in the same source, and
		           every person.rejected[] entry

The same-source runner-ups are the valuable ones. A rival that scored 0.81
against a winner's 0.84 teaches the model far more than a random non-match at
0.05. The demo tree alone yields 46 rows (13 positive) and fits at logloss
0.094 - but that is 13 positives from one family and must not be mistaken for
a fitted model.

The Goings / Howell / Downey case studies are ALBEMARLE County; the corpus is
Augusta only. They cannot seed calibration until Albemarle is ingested.

## EVALUATION

Guaranteed negatives are free. Two different mentions in the same census year
cannot be the same person - the one-appearance-per-source-year rule, used as a
label source. No human annotation required.

	13,578 same-surname, same-census, different-household pairs:
		83.1%  knocked out
		 6.20% score >= floor 0.35
		 0.49% score >= ceiling 0.80   <- provably wrong MATCHes
		 p50 / p90 / p99 of scored pairs: 0.258 / 0.605 / 1.000

Recall can be estimated the same way: hold out SEED-tier bridge anchors
(7,447 for 1870->1880, established by whole-household agreement) and check
whether the scorer recovers them from name and birth alone.

Build this before adding further levers. Every change described above was
validated against two people in one demo tree, which cannot tell you whether
loosening sigma cost more than it bought.

## ACCEPT AND REJECT

	Accept  write isSameAs (who = researcher, confidence = their setting).
	        Add to person.mentions. Re-derive Stage 1 attributes; the birth
	        window may widen. Assertions attached to the new mention become
	        new leads: a co-resident not yet in the tree, a named parent,
	        an enslaver. Invalidate any cached provisional lookup.

	Reject  write isNotSameAs. The candidate never resurfaces for this
	        person, in this or any later session.

## REJECTION SCOPE

A single reject action conflates three claims with different reach.

	1. Enslaver identity   "this mention is not Cyrus Alexander"
	   Invalidates everything derived from that mention. Leaves
	   wasEnslavedBy intact.

	2. Holding row         "P002 is not AUG-SS-1860-4021"
	   Pair-scoped.

	3. The link itself     "P002 was not enslaved by Cyrus Alexander"
	   Reach depends on provenance.

Governing rule: a rejection invalidates EVIDENCE, and the link survives if
other evidence supports it. So `wasEnslavedBy` must carry its supporting
mention list, exactly as a bridge carries its anchors. It does not today -
assertions have `who` and `confidence` but no evidence array, so there is no
way to tell a profile-fit inference from an SB-sourced one after the fact.

	- Link inferred only from an age-sex profile fit -> rejecting the fit
	  rejects the link.
	- Link sourced from a slave birth register, FBR labor contract, church
	  record or cohabitation register naming the owner -> a rejected
	  schedule match does not touch it.

Never auto-delete downstream. If a sibling sits in the tree partly because
they shared an enslaver, invalidating that anchor marks the inference
contested and surfaces it for review. Recompute; anything that falls below
floor without the rejected support is FLAGGED, not removed. The enslaver link
is often a person's only pre-1865 evidence, so cascading deletion wipes an
entire antebellum trail on one uncertain click - and the researcher may be
wrong. Same mechanic as bridge anchor invalidation; one code path.

## SCAN TRIGGER

On request only. SCAN does not fire on highlight. Retrieval on every click is
too expensive to be ambient, and an unrequested coverage panel invites the
researcher to chase whichever source shows a count rather than following the
order that actually sharpens the search: constraints first, then spouse, then
children.

## MATCH.JS DEPENDENCIES

Changes made in match.js that this spec assumes.

	_classifyGiven      compares on the FIRST TOKEN of a compound given
	                    name. normUpper strips whitespace, so "MARTHA J"
	                    became MARTHAJ and never equalled MARTHA - not via
	                    the nickname table, not via Jaro-Winkler, not in
	                    the blocking key. Returns the tail as extraInitial.

	_hasName            aAvailable now means "both sides HAVE a name", not
	                    "the names agreed". The old form dropped the name
	                    weight on disagreement and redistributed it to
	                    birth, so two unrelated people sharing a birth year
	                    scored 1.000 with rung NONE.

	corroborationPossible
	                    the gate fires only when a channel could actually
	                    have produced agreement.

	Match.isBoarder     static, so every caller gets it.

	_spouseContradiction / _middleInitialState / _heapFactor / _sourceYear
	                    new, described above.

	DEFAULT_JW_FUZZY_PASS = 0.84
	                    lowered from 0.85 and the added nickname entries
	                    removed. ARCHIBALD/ARCHY is 0.8489, one thousandth
	                    under the old bar. This is a deliberate
	                    recall-for-precision trade: it admits roughly 660
	                    additional cross-name equivalences in AUG, of which
	                    only a small fraction are true (ARCHIBALD/ARCHY,
	                    SOPHRONIA/SOPHY, CASSANDRA/CASSY) and the rest are
	                    not (HENRY/HENRIETTA, EDWARD/STEWARD,
	                    CHARLES/HARLEY, LUCINDA/LUCIUS, WILLIS/WILLARD).
	                    Measured effect on scored pairs: 0.58% crossed the
	                    0.35 floor that did not before; nothing was
	                    lowered. Watch HENRY/HENRIETTA and MARY/MARIA in
	                    review - high-frequency names where a false merge
	                    has the most reach. Revert via
	                    config { jwFuzzyPassThreshold: 0.85 }, which
	                    search.js passes through as matchConfig.

	Nickname equivalence is not a distance property: ARCHY->ARCHIBALD and
	HARLEY->CHARLES are the same edit distance and one is right. No
	threshold or prefix rule separates them. If a table returns, it should
	be a JSON file loaded via matchConfig.nicknames and grown from
	confirmed links, not hand-curated - the original Archibald group was
	hand-written and still missed five spellings.

## DATA GAPS

Levers that cannot fire because the field was never ingested.

	birth_place         COLUMN ABSENT from mentions.csv. match.js has
	                    BP_BOOST, BP_PENALTY and the full placeState
	                    cascade, all dead code against this corpus. The
	                    1880 census also records FATHER'S and MOTHER'S
	                    birthplace, which is close to a free parent
	                    identity check. Highest-value ingestion target.

	relationship-to-head
	                    absent. _spouseContradiction currently INFERS the
	                    spouse slot from gender and age. The census states
	                    it outright.

	narrative           0% populated. Wills, probate inventories, estate
	                    divisions, deeds and Freedmen's Bureau contracts
	                    are where named enslaved people and ownership
	                    transfers live, and they are prose.

	literacy, real / personal estate value
	                    1870 census fields, not ingested. Economic
	                    continuity is a genuine linkage signal and the
	                    Goings case study quotes these directly.

	occupation          27.7% populated; death_year 9.8%.

## REQUIRED ADDITIONS TO curTree

	person.rejected[]   so the exclusion set survives a reload
	person.death_year   with provenance, when a VR/DR/FG record is accepted
	verity scale        appears as 2, 3, 4 and is used as a kin weight
	                    multiplier; its range and meaning need fixing
	relationships[]     empty. Either populate it, or accept that
	                    single-anchor storage cannot express a child of two
	                    parents and that Stage 2 imputes the second parent
	                    every time
	family_boost        present and empty. Decide whether it is a
	                    researcher-set Lever C multiplier

## WHERE AN LLM FITS

Not in ranking. Rarity is a corpus statistic, calibration needs a fitted
model, knockouts dispatch 83% of pairs for nothing, and the `why` object has
to survive a genealogist asking why a candidate was proposed. A model handed
"find Martha Crawford, wife of Arch, born 1840" is also a badly biased judge -
it will produce a fluent justification for whatever it is pointed at, and the
deterministic scorer's indifference is a feature.

Three places it clearly helps:

	1. Extraction from prose. The narrative column is empty and every
	   wasEnslavedBy comes from one source type. Estate divisions and
	   labor contracts name enslaved people and record transfers between
	   holdings. This is upstream of matching and worth more than any
	   scoring change.
	2. Name variant proposal, run offline over distinct forms, human
	   approved, shipped as matchConfig.nicknames. Goings / Gowan / Going
	   / Goen / Gowns / Gains is one family, as the case study states.
	3. Adjudicating the top few candidates with full rosters in view,
	   required to argue against as well as for, output to a human rather
	   than writing isSameAs.

Keep it out of nameless-schedule matching. There is no information there that
reasoning can recover, and a model will produce a confident, plausible,
unfalsifiable narrative for any assignment proposed. FIND returning nothing
for Arch against Cyrus Alexander's holding was the correct answer.

## OPEN QUESTIONS

	- isSameAs scoping (per-tree vs global). Determines whether contested
	  claims across researchers need reconciliation. Deferred; nothing
	  here depends on it yet.
	- Kin grounded in a NON-target source still take the 0.3 ungrounded
	  weight. Martha's four children, all confirmed in 1880, contributed
	  0.09 each to her 1870 search. A middle tier - 1.0 in the target
	  source, ~0.6 within ten years, 0.3 name-only - is the obvious fix
	  and has not been made.
	- Rarity is computed corpus-wide. score.md asks for it against the
	  pool in front of you. Moot at one county; not moot at two.
