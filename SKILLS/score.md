Lever A — Name agreement (cascade, gender-aware):

	First, resolve the surname-match question, then score the cascade.
	
	Surname match fires if any of these hold:

		candidate full_name equals anchor full_name ; OR
		candidate last_name equals anchor last_name (exact, or via hasNameVariant alias, or NYSIIS→Metaphone phonetic — see independence note below); OR
		an assertion (isSpouseOf, marriage record) bridges the two surnames.

		Score the strongest rung that fires:

			exact first + surname-match
			first_initial + surname-match
			nickname/normalized first (Jaro-Winkler ≥ 0.85) + surname-match
			given-name-only agreement (no surname match): exact or nickname-equivalent first name, surname unmatched or absent. This rung fires the "name agrees" signal at reduced strength and requires at least one independent corroborating lever (B or C) to count toward the match at all. Without corroboration it is not evidence of identity.

		Gender conditioning:

			When gender = F, a surname mismatch does not veto name agreement — drop to the given-name-only rung rather than scoring zero, because women's surnames change across sources (maiden ↔ married) as a matter of course. Conversely, when a woman's surname does match across two different-surname-expected contexts, weight it slightly higher, since a surviving surname match is less expected and therefore more distinctive. 
			When gender = M, a hard surname mismatch (no alias, no phonetic) remains a strong negative as before.
		
		Conditional independence: 
		
			String and phonetic surname agreement are one surname signal, not two; do not double-count.

		Rarity weighting:

			A name match is only as strong as the name is rare — matching on a common name is weak evidence because many people share it, while matching on a distinctive name is strong evidence because few do. Apply this to both parts of the name:

				- Surname rarity. A shared common surname (Johnson, Smith, Brown — high frequency in the candidate pool) is weak corroboration on its own; many unrelated people carry it, so a surname match barely narrows the field. A shared rare surname is strong corroboration. Weight the surname rung of the cascade accordingly: a common-surname match needs more help from Levers B and C to reach confidence, whereas a rare-surname match can carry more of the load itself.

				- Given-name rarity. When the surname does not match and the link rests on the first name alone, the given name's rarity is doing all the identifying work. A distinctive given name (Aggie, Henderson, Wyatt) shared between two records is meaningful — few people carry it, so the coincidence is unlikely. A common given name (Mary, John, William) shared between two records is nearly worthless on its own — there are dozens in any census. Therefore: a rare given name + one strong household corroborator (Lever C) may reach high confidence; a common given name on the given-name-only rung may not reach confidence at all, even with a household hint, and stays provisional.

			How to judge rarity: use frequency within the candidate pool itself, not outside intuition. A surname or given name is "common" if it recurs many times across the ALB_CN_1870 block; "rare" if it appears few times. The same name can be common in one county and rare in another — judge against the data in front of you, not a general sense of the name.

			Interaction with the cascade: rarity does not change which rung fires — it scales how much that rung is worth. A rung that fires on a rare name contributes more confidence than the same rung firing on a common name. This is a weighting on the name signal, applied after the cascade and the conditional-independence rule, never a substitute for them.

	Lever B  — Birth agreement (cascade, with a ceiling). 

		Score birth_year agreement: exact > ±1 > ±2 > ±3 > ±5. Beyond ±10 is not a match rung — it is a knockout candidate (Step 3), not a weak positive. 

	Lever C — Household / family continuity (strongest corroborator). 

		For each prospective 1870 identity match, check whether the same set of co-resident kin reappears, aged forward by the year gap. Read the kin set from existing isSpouseOf / isChildOf assertions where available rather than re-deriving it. A spouse match plus ≥2 children whose birth-year windows overlap is far stronger than any single name+age hit, because a whole family's joint age–sex profile rarely coincides by chance. Record each matched kin mention and the assertion/mention_id backing it.

		- To score, add 1.0 for a spouse and .5 for each other family member
		- Cap total contribution at 2.0

	Step 3 — Apply knockout gates (precision)

		Drop any candidate that trips a hard gate; these override all positive levers:

			- Gender disagreement. A blank/unknown gender on either side does not trip this gate; only a populated M-vs-F disagreement does.
			- Birth-year window non-overlap (gap beyond ±10 with no offsetting evidence).
			- Age regression — the 1880 record implies an earlier birth than the 1870 record beyond ~2 years (the same person cannot age backward).
			- Death before 1880 — a death record (ALB_VR_1715) or ALB_FindAGrave entry showing the 1870 person died before the 1880 enumeration. A same-named 1880 record is then a different individual (usually a Jr.) → route to the dual-identity guard, do not merge. 
	
	Step 4 — Converge and classify
	
		Combine the levers. Require multiple independent levers for high confidence; a link on one lever only is provisional. Re-apply the dual-identity guard (in Principles) and the knockouts to the surviving set. Pull in the corroboration layer (VR marriage/death, Find a Grave, FBR, church) to promote provisional links to recorded or to settle collisions. 


