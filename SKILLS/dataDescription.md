
### DATA FORMATS AND SOURCES

	The data about people in a county comes from primary sources such as the census and are stored in a table called "MENTIONS", one row  per person.

	Relationships between people, such as family ties, are stored in a second table called ASSERTIONS, which link two mentions together in some specie way, such as isChildOf. If two mentions are deemed to be identifying the same person, they are linked with a isSameAs predicate.

	A third table, called the "TREE", is a user- constructed family tree of persons.  The persons in the tree are connected to one other person with the anchor field which identifies the person_id and how they are connected, say as a child. (i.e. "isSpouseOf:P001").

**MENTIONS**

	Mentions contain information about people mentioned in primary source documents, such as censuses. The ingest app takes primary sources and each time a person is referenced, a new mention row is added to the file.

	Each time a person is identified in a primary source, whether by name or some other description, a record of that person is added to the system as a mention. A mention merely notes the identification of an individual in a primary source, with no claims about who it may actually be, or their relationship to any other person or organization. 

	Mentions are the atomic units that the Verité system is built upon. They contain all the information available about that person, such as names, ages, gender, race, etc. Some mentions may not have any name associated with them at all. 

	*Mention format*

		- mention_id: unique id
		- source: a unique identifier of the source ingested 
		- confidence: from 0.0 to 0.99
		- full_name
		- first_name 
		- middle_name
		- last_name
		- birth_year
		- death_year
		- race: B or W
		- gender: M or F (male or female)
		- legal_status: F or  E (free or enslaved)
		- norm_occupation: one of  21 basic clustered categories 
		- household _id: number unique to source that defines a household 
		- family_id: number unique to source that defines a family unit

**ASSERTIONS**

		To connect mentions about people with other people, we create a series of assertions that define that relationship. No assertion exists without a traceable chain back to its primary source mention. An assertion important to true identification of a person is isSameAs, which asserts that two mentions refer to the same actual person. 

	*Assertion format*

	Assertions take the form where one person, the subject, is connected to another person, the object, has a predicate relationship, such as being the father, mother, enslaver, etc.

		- subject_id: mention_id of the subject person
		- predicate: the type of relationship between the subject and object
		- object_id holds a mention_id of the object person	
		- confidence, from 0 to 1, that it is indeed true.
		- The start_year and end_year define the temporal span.
		- who is the person or document asserting the relationship. 

	*The predicate vocabulary*

		- isSameAs: the same-person link. The confidence field reflect how sure the system is about that similarity.
		-isNotSameAs: an explicit negative assertion. Useful when two records that look similar have been confirmed by a human as different people. 
		- isChildOf, isParentOf, isSpouseOf, sSiblingOf, all directional. isChildOf with subject A and object B means A is the child, and B is the parent. 
		- wasEnslavedBy: Subject A is the person, object B is the enslaver.
		- enslaved: Subject A is the enslaver, object B is the person.
		- isHousemateOf: co-resident in the same household for a specific year.
		- isFamilyOf: person A is a member of person B's family.
		- isNeighborOf: person A lives in the same neighborhood as person B.
		- hasNameVariant: person mentioned is known by an additional name.

**TREE**

	This is a user- constructed family tree of persons.  The persons in the tree are connected to one other person with the anchor field which identifies the person_id and how they are connected, say as a child. (i.e. "isSpouseOf:P001").

	Each person of the tree has a number of identifying fields, such as name, age, and race. Each field has a value, typically tagged with the mention_id it was derived from, i.e. “Smith:ALB-CN-1880-1234”.

	In addition, there is a list of mention_ids that have been deemed by the user to refer to this person, as well as a list of associated assertions.

	*Tree format*

		- owner: use who constructed tree
		- persons: an array of person objects:
			- person_id: unique id
			- anchor: person attached to
			- birth_year
			- death_year
			- first_name
			- middle_name
			- last_name
			- suffix
			- gender
			- race
		- mentions: an array of mentions associated with person
		- treeName: title of tree

**SOURCES**

	These are tables of primary source data that has been normalized and stored in the format as mentions. There may be omissions, duplications, and errors in the data

	*Normalization*

	If a source has a name, it is normalized to full_name, first_name, middle_name, last_name, NYSIIS-encoded nysiis_last_name, Metaphone-encoded metaphone_last_name. If a source has race, it is normalized into norm_race as W (white) or B (non-white) or null. If a source has an occupation, it is normalized into norm_occupation into 21 categories.

	*Other fields*

	All mentions have a unique id called mention_id, and a source field that defines the type. There is a short narrative, called narrative that describes the mentioned person and any linked people to them. 

	*Mention_id*

	Each has a unique id: The country-source-line, where county is the county code (ALB, AUG, FAQ), the source field  defines the source type, and the line is the line number in the original source: i.e ALB-CN-1870-432.  If there is already an identical mention_id within this source,  append a number to it to differentiate it, like this for the first one: ALB-CN-1880-23.1, ALB-CN-1880-23.2 for the second, etc.

	*Assertions*

	When the sources are ingested into the system, some relationships between mentions are saved in a table called assertions. Each row is this table defines these relationships in an RDF style subject, object, predicate format, i.e ALB-CN-1870-258 isChildOf ALB-CN-1870-257 with a confidence of .9.

	*Sources types*

		*1870 Census - CN-1870*
		From a US census file for the county. It is the first census to list non-white people by name. Relevant fields are: name, birth_date, head, occupation, gender, race. Families are grouped together under the family_id. Households are grouped together under the household_id.
 
		*1880 Census - CN-1880*
		From a US census file for the county. Relevant fields are name, birth_date, head, occupation, gender, race. A relation field specifies the relationship a person in a row with who is identified as the head.
		Families are grouped together under the family_id. A series of assertions will be generated from the relation (i.e. isChildOf, isParentOf p, etc.).

		*1850/1860 Slave Schedule - SS-1850 and SS-1860*
		From files that are transcriptions of the US slave schedules for 1850 and 1860. Each row represents an enslaved person, their data and their enslaver. The enslaver has a name, but the enslaved do not and only have their gender, birth_year, and race.
		Each row will generate two mentions. One for the enslaver and one for the enslaved. An isEnslavedBy assertion will be generated to link them together.

		*Birth Records - VRB*
		These come from the Virginia vital records and list the births of people in the county. Relevant fields are the name, birth_year, race, gender, father’s name, and mother’s name.
		If a father or mother is listed, a new mention will be generated with their name. Assertions will be generated to link  them together as isSpouseOf and as parents to the child.

		*Marriage Records - VRM*
		These come from the Virginia vital records and list the marriages of people in the county. Relevant fields are the name, birth_year, race, gender, father’s name, and mother’s name.
		If a father or mother is listed, a new mention will be generated with their name. Assertions will be generated to link them together as isSpouseOf.

		*Death Records - VRD*
		These come from the Virginia vital records and list the deaths of people in the county. Relevant fields are the name, birth_year, race, gender, father’s name, and mother’s name.
		If a father or mother is listed, a new mention will be generated with their name. Assertions will be generated to link  them together as isSpouseOf.

		*Find a Grave - FG*
		This file contains the cemeteries where people are buried, from 1600 to 1900. Relevant fields are the name, birth_year, death_year, and location of the cemetery they were buried.

		*Church Records - CH*
		These are lists of people and where they attended church. Each line includes a person, their race, age, gender, and their enslaver. An additional mention will be added with the enslaver’s name. Assertions will be generated to link them together as WasEnslavedBy.

		*Free Black Register - FBR*
		This is a transcription of the Free black register, Also known as the "Register of Free Negroes". From a law Requiring free African Americans to formally register to prove their status. It contains the name, age, gender, and race.





