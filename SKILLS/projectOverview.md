###VERITE PROJECT OVERVIEW  

	The Verité project uses the new LLM-based tools coupled with the structured reasoning of expert genealogists who have successfully traced African Americans across the emancipation divide; a context where personal names are often absent from pre-Civil War records and where identity can only be established by reasoning across multiple inconsistent and incomplete primary sources. 

	In reality, there exists only one identity that represents that person, even though there may be evidence for them scattered over many records. Each record can be inaccurate and incomplete, but any person they refer to is one of those unique individuals. 

	The project’s goal is two-fold: First, provide access to accurately transcribed primary source documents for individual Virginia counties with normalized fields enabling systematic comparisons across multiple documents.

	Second, we have developed a series of web-based tools that can aid people in this complicated tracing exercise. Designed with guidance from experienced genealogists, this toolset will scaffold the complex search and tracing process using local records, such as censuses (including slave schedules), birth and death records, marriage licenses, Freedman Bureau records, baptism entries, tax lists, and other local sources. 

	The Verité system relies on this collection of datasets which have been normalized to provide information about unique individuals. It is centered around the researcher: a true human-in-the loop (HITL) AI application.

**The project currently has a number of distinct sections**
	
	*Ingest*
	
	Data needs to be collected, normalized, converted to mentions and initial assertions, and stored into a database. The data is described in dataDescription.md and is included in mentions.csv and assertions.csv. These initial assertions are:
		- Familial relationships from census, birth, marriage, death records, i.e. isChildOf, isParentOf, etc.
		- Enslaver information from slave schedules, church records, and tax/probate records. i.e wasEnslavedBy, enslaves.
	
	*Assertion expansion*
	
	The initial assertions are expanded to include inverse, symmetrical, and derived relationships. This is as an as-needed process and  is not permanently stored:

		- isSpouseOf is set for both husband and wife.
		- isParentOf and isChildOf are applied to parents and children.
		- isSibling of is applied for both siblings.

	*Similarly scoring*

		Finding out whether two mentions are referring the same person. If they are, an isSameAs assertion links them. Factors for assessing similarity are outlined in the  score.md document.  

	*Family formation*

Building a family tree that has its factors grounded in the mentions ingested from primary sources. The user starts by identifying a person in the 1880 census and adds relatives to the tree based on evidence in the data.

