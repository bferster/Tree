**MENTIONS EDITOR**

I want to design a  module within the Verité user app for displaying and choosing mentions found after using the search tab criteria for searching for matches in the source data to a list of attributes for a person. It should have:

	Plain vanilla JavaScript using jquery and jquery ui.
	Mentions and assertions data will come from a Postgres database loaded earlier.
	Intuitive Layout: Grouped fields for clear input organization.
	Modern Aesthetics: Uses neutral tones, subtle shadows, and rounded corners to fit a premium "Verité" design language.
	Responsive Design: Adapts smoothly from mobile touch screens to desktop environments.
	It is written in plain vanilla JavaScript with jquery and jqueryui.
	The module should be in a file called mentionsEditor.js.
	It will display in the same space as the personsEditor module, to the right of it.


*Mention data format*

	mention_id: unique id
	source: a unique identifier of the source ingested 
	source_type: “census”, “slaveschedule”, “findagrave”, …
	source_year: year of source data
	original_data: the full row in original source table
	confidence: from 0.0 to 0.99
	full_name
	first_name 
	middle_name
	last_name
	maiden_name
	birth_year
	death_year
	race
	gender 
	legal_status: “F” or  “E” (free or enslaved)
	is_enslaver: “true” or  “”
	norm_race: “B” or  “W”
	norm_occupation: one of  21 basic clustered categories 
	location_id
	enslaver_id
	household _id
	family_id
narrative: textual summary of the data

*Person data format*

	person_id
	first_name
	norm_first_name
	last_name
	NYSIIS
	soundex
	suffix
	race
	gender 
	birth_year
	death_year
	mentions : a list of mention_ids that have been linked to this person
	persons : a list of person_ids that have been linked to this person
	confidence 

**TASK**

*Create match list*

	The process is initiated by providing a target person object and a list of sources to search from.
	Create a new list that contains the mention_id and score:
			[ { id, score } … { id, score }  ]
	For each assertion in the assertions list that matches that source specified, score the assertion as to its similarity to the target person as described  below and put that score in the score field of the match list.
	Sort the matches in descending order according to the score.
	Keep only the top 50 entries in the match list after sorting.

*Scoring the possible matches*

	The score starts at 0.
	The gender and race must match the target person.
	Each factor is evaluated if it is enabled.
	The score is added  by the weight value in the search criteria.
	Name similarity scoring
	If  a match, add the factor’s weight to score:
	Exact last_name match
	Fuzzy last_name match
	Rarity last_name bonus/penalty
	Exact norm_first_name match
	Fuzzy norm_first_name match
	Rarity norm_first_name bonus/penalty
	Exact nysiis_last_name match
	Fuzzy nysiis_last_name match
	Rarity nysiis_last_name bonus/penalty
	Date similarly search scoring:
	If  a match, add the factor’s weight to score:
	Exact and +/- birth_year options match
	Exact and +/- death_year options match
	If a date is hyphenated, a match is if the year falls between them. i.e. 1810-1890
	Family members scoring:
	Number of  family members in the persons field times 4
	Narrative similarity scoring
	Vector cosine similarity value times 16

	Max score could be as high as 32 + number of relatives * 4 (60?)

*Show the mentions*

	The matches are in a scrollable list.
	Each match shows the norm_first_name, last_name, birth_year, death_year, and the narrative.
	A separate section shows the score and for each enabled factor, show if that factor affected the score and by how much,  i.e. Birth +3, Fuzzy Last +4, Family +8, Rarity Last -3, etc.
	These are shown as pills.
	Clicking on a mention in the list highlights it as the current mention.

*Adding the mention*

	In the footer, put a button labeled ‘Add to person” to add the currently highlighted mention to the current target person.
	If clicked, that mention_id is added to the mentions field.







