---
name: Search Format
description: Tree-driven, on-demand search for mentions that may refer to a person in the researcher's tree
---

# SEARCH

Takes the current tree and a highlighted person, and returns primary-source
mentions that may refer to that person. Replaces the en-masse verified-people
build with an as-needed one. Nothing here writes `isSameAs`; the function
returns ranked candidates and the researcher decides.

## ENTRY POINT

	search(curTree, personId, mode, opts) -> result

	curTree   the full tree object (persons[], relationships[], county)
	personId  the highlighted person, e.g. "P1786307668869"
	mode      "SCAN" | "FIND"
	opts      { source, year, limit, floor, levers }

	SCAN  cheap. Blocking-key retrieval only, no lever scoring.
	      Returns per-source counts and a best rough score.
	      Answers "where might evidence exist," not "who is it."

	FIND  expensive. Full lever scoring against ONE source.
	      opts.source is required. Returns ranked candidates with `why`.

	Everything else is derived from curTree. The caller passes no name,
	no birth year, no kin list.

## STAGE 1 - DEREFERENCE AND VALIDATE

Attributes in curTree are stored as `value:mention_id`
(`"birth_year": "1835:AUG-CN-1870-4795"`). Split each into
`{ value, source_mention, source_type, source_year }`.

	- source_type is parsed from the mention_id prefix (CN, SS, VR, FBR,
	  CH, FG). It drives field reliability downstream.
	- Validate. Fetch each cited mention and confirm the stored value
	  actually appears in it. A mismatch is a data error, not a search
	  input; report it and drop the field rather than searching on it.
	  (The AUG demo tree cites AUG-CN-1870-11826 as "Cyrus Alexander";
	  that mention is Thomas Farr. Silent trust would search on a name
	  no source supports.)

Then rebuild each attribute from ALL linked mentions, not the one stored
value. Attributes are multi-valued across sources and curTree only keeps one.

	birth_year for P002:
		1835  from AUG-CN-1870-4795
		1840  from AUG-CN-1880-24520
	-> window [1835, 1840], center 1837, spread 5

Search on the window. A point value taken from whichever mention happened
to be stored first will miss on one end of the drift.

	Field reliability, used to set Lever B sigma:
		VR / FG death or birth record   hard    sigma 1.5
		FBR, church, cohabitation       medium  sigma 2.5
		census self-reported age        soft    sigma 3.0
		schedule age estimate           softest sigma 3.5

## STAGE 2 - EGO-CENTRIC NORMALIZATION

curTree stores relationships as a single `anchor` per person
(`"anchor": "isChildOf:P002"`), so the graph is a tree rooted at the person
whose anchor is null. `relationships[]` is unused. Two consequences:

	- Children attach to one parent only. Jinnie is isChildOf P002 and has
	  no stored link to Martha, even though Martha is P002's spouse.
	- Siblings are never stored.

So the kin set has to be built, not read. Following Kouki et al.
(relational normalization), invert then impute, centered on personId.

	Inversion
		anchor "isChildOf:P002" on X, highlight P002  ->  P002 isParentOf X
		anchor "isSpouseOf:P002" on X, highlight P002 ->  P002 isSpouseOf X
		anchor "isEnslaverOf:P002" on X               ->  P002 wasEnslavedBy X
		(tree predicate is the inverse of the assertion vocabulary term;
		 keep an explicit map, do not string-manipulate)

	Imputation, capped at 2 hops
		shared anchor parent          -> isSiblingOf, weight 0.8
		spouse of parent              -> isParentOf,  weight 0.6
		parent of parent              -> isGrandParentOf, weight 0.5
		spouse's other children       -> isSiblingOf, weight 0.5

	Plausibility gate on imputed parenthood. Before imputing that Martha
	(b. 1840) is mother to a child, require the child's birth year to fall
	between her age 13 and 50. Outside that, emit the link as a hypothesis
	for the researcher, not as a search input.

	Weight each kin member by:
		hop_weight  x  verity/4  x  grounded

	where grounded = 1.0 if that relative has a confirmed mention in the
	target source-year, 0.3 if the relative is name-only. An ungrounded
	relative is a hint. Scoring it as evidence inflates Lever C on exactly
	the links that most need scrutiny.

## STAGE 3 - TIME SLICE

Project the kin set onto opts.year. Drop anyone not yet born, anyone with
a death year before it, and any spouse whose marriage postdates it.

	Searching Martha in 1870 with the AUG demo tree:
		keep   Jinnie (b.1864, age 6), Charles (b.1866, 4),
		       Mary Lee (b.1868, 2), Lena (b.1870, 0), Arch (spouse)
		drop   Katy (b.1873), Lawrence (b.1876), Sidney (b.1878)

Dropping matters as much as keeping. An unborn child counted as absent
looks like disconfirmation of a correct match.

	Co-residence expectation, per kin member, per year:
		expected      minor child, spouse
		not expected  married daughter, adult son with own household,
		              anyone whose own record places them elsewhere
		unknown       everyone else

Only `expected` kin count against a candidate when absent.

## STAGE 4 - CONSTRAINTS

Assembled from the tree and from a small automatic fetch. These bound the
search; they are not scored levers.

	Knockouts
		gender      populated M vs F disagreement
		race        different _raceClass (B and M collapse)
		birth       window non-overlap beyond +/-10 after Stage 1 widening
		death       any VR / FindAGrave death year before opts.year.
		            curTree carries no death years at all, so fetch these
		            before every FIND rather than reading them off the tree.

	Exclusions
		- mentions already linked to this person
		- mentions already linked to ANY person in curTree (one row cannot
		  be two people in the same family)
		- mentions carrying isNotSameAs against this person
		- the whole of opts.source-year if this person already holds a
		  confirmed mention in it. A person appears once per census.

	P002 already holds AUG-CN-1870-4795 and AUG-CN-1880-24520, so both
	those census years are closed for him and FIND should say so rather
	than return candidates.

## STAGE 5 - RETRIEVAL

Union of the following, capped at MAX_CANDIDATES.

	1. Blocking keys        L, N, F, M, FB (per Census2Census)
	2. Household expansion  for each grounded kin member with a mention in
	                        opts.source-year, pull that mention's whole
	                        hhKey roster regardless of surname
	3. Bridge expansion     precomputed household bridge edges from any
	                        year the person is already located in
	4. Holding expansion    for each wasEnslavedBy enslaver with a schedule
	                        mention, pull the whole holding

	Household expansion is usually the strongest path and it is nearly
	free. But it is not reliable in this population, and the AUG demo
	shows why:

		Arch Crawford, 1880, head of FC1880-4442 with wife and 7 children.
		Arch Crawford, 1870, FC1870-829 - a WHITE household headed by
		John H Dalhouse, where Arch is a non-head Black farm laborer.
		No wife, no children present.

	His family in 1870 is somewhere else entirely. Expanding his 1870
	household to find Martha returns the Dalhouse family and nothing
	useful. This pattern (a Black laborer resident on a white employer's
	farm while his family is enumerated separately) is common enough in
	1870 that household expansion must be treated as one retrieval path
	among several, never as a short circuit, and a bridge built from it
	would be actively misleading.

	Fall back to FB retrieval plus the child-cohort profile below.

## STAGE 6 - SCORING

FIND applies the levers in score.md. Two additions specific to this
function.

	Child-cohort profile. When several time-sliced children are expected
	co-resident, score the candidate's household against the joint
	age-sex profile rather than child by child. Searching Martha in 1870
	means looking for a household holding a B female b. ~1840 with a 6F,
	4M, 2F and 0F alongside her. That joint profile is far more
	distinctive than any single name-and-age hit, and it survives bad
	name transcription completely.

	Enslaver lever. A shared enslaver is a shared location and community,
	so weight it near Lever C rather than as a demographic filter. Scale
	it by holding size: matching into a 5-person holding is strong,
	matching into a 90-person holding is weak. Score the age-sex fit
	explicitly, since pre-1865 schedule mentions are usually nameless.

		Cyrus Alexander's HS1860-920 holds five people:
			1813 M, 1835 F, 1840 F, 1856 M, 1859 F
		P002 is male, b. 1835-1840. The only adult male is b. 1813.
		The profile does not fit, so this lever should score near zero
		and the tree's enslaver link should surface as contested.

	Also note that freedpeople frequently took the surname of a former
	rather than final enslaver, so surname agreement with the enslaver is
	suggestive and should not be scored as reliable.

## RETURN

	SCAN
		{ person_id, sources: [ { source, year, candidates, best_rough,
		  blocked_reason } ] }

	FIND
		{ person_id, source, year,
		  constraints_applied: [...],
		  candidates: [ { mention_id, score, probability, margin,
		                  second_best, why, corroborators: [...] } ] }

	`why` carries the same lever breakdown as Census2Census: name, birth,
	family, rung, surnameKind, surnameReliability, birthGap, margin, plus
	which retrieval path produced the candidate. Retrieval path matters to
	a reviewer: a candidate found by household expansion and a candidate
	found by FB retrieval on a common given name deserve different scrutiny
	at the same score.

	Always return the runner-up and the margin, even when the researcher
	only wants the top hit. A researcher hunting for an expected ancestor
	will accept a weaker match than a blind matcher would; the runner-up is
	the cheapest available check on that.

## ACCEPT AND REJECT

	Accept  write isSameAs (who = researcher, confidence = their setting).
	        Add the mention to person.mentions. Re-derive Stage 1
	        attributes, which may widen the birth window. Any assertions
	        attached to the new mention become new leads: a co-resident
	        not yet in the tree, a named parent, an enslaver.

	Reject  write isNotSameAs. The candidate never resurfaces for this
	        person, in this or any later session.

## REQUIRED ADDITIONS TO curTree

The demo file does not yet carry these, and the search needs them.

	person.rejected[]      mention_ids rejected for this person, so the
	                       exclusion set survives a reload
	person.death_year      populated, with provenance, when a VR or FG
	                       record is accepted
	verity scale           documented. It appears as 2, 3, 4 and is used
	                       as a kin weight multiplier, so its range and
	                       meaning need to be fixed
	relationships[]        currently empty. Either populate it, or accept
	                       that single-anchor storage cannot express a
	                       child of two parents and that Stage 2 must
	                       impute the second parent every time
	family_boost           present and empty. Decide whether it is a
	                       researcher-set Lever C multiplier, and if so,
	                       where it applies

## REJECTION SCOPE

A single reject action currently conflates three different claims. Each has
different reach, so the UI must distinguish them.

	1. Enslaver identity      "this mention is not Cyrus Alexander"
	   Invalidates everything derived from that mention (household,
	   district, that person's location in that year). Leaves
	   wasEnslavedBy intact.

	2. Holding row            "P002 is not AUG-SS-1860-4021"
	   Pair-scoped. Removes one candidate. Leaves wasEnslavedBy intact
	   if the link rests on other evidence.

	3. The link itself        "P002 was not enslaved by Cyrus Alexander"
	   Reach depends on provenance.

Governing rule: a rejection invalidates evidence, and the link survives if
other evidence supports it. So wasEnslavedBy carries its supporting mention
list, exactly as a household bridge carries its anchors.

	- Link inferred only from an age-sex profile fit against a schedule
	  holding -> rejecting the fit rejects the link.
	- Link sourced from an FBR labor contract, church record, or
	  cohabitation register naming a former owner -> a rejected schedule
	  match does not touch it.

Never auto-delete downstream. If a sibling sits in the tree partly because
they shared an enslaver, invalidating that anchor marks the inference
contested and surfaces it in the hypotheses panel. Recompute the affected
inferences; anything that falls below floor without the rejected support is
flagged, not removed. Two reasons: the enslaver link is often a person's
only pre-1865 evidence, so cascading deletion wipes an entire antebellum
trail on one uncertain click, and the researcher may be wrong.

This is the same mechanic as household bridge anchor invalidation and
should be one code path.

## SCAN TRIGGER

	On request only. SCAN does not fire on highlight. Retrieval on every
	click is too expensive to be ambient, and an unrequested coverage
	panel invites the researcher to chase whichever source shows a count
	rather than following the evidence order that actually sharpens the
	search (constraints first, then spouse, then children).

## OPEN QUESTIONS

	- isSameAs scoping (per-tree vs global) is deferred. It determines
	  whether contested claims across researchers need reconciliation,
	  but nothing in this spec depends on the answer yet.
