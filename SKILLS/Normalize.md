**NORMALIZATION**

	This document describes how to normalize the data in source files.
	A data is passed to a function called NormalizeSourceData() as a JSON object.
	Remove any dots and commas from the data.	

	The data is normalized according to its name, and the normalized data is returned as a JSON object.	

	If the field name to be normalized contains the string "last_name" {
		- Create a new field name that is the same as the field name but with "nysiis_" prepended to it.
			- i.e. "last_name" becomes 	"nysiis_last_name", "owner_last_name" becomes "nysiis_owner_last_name".	
		- Use the NYSIIS algorithm to encode the value and store that value in the new field.
		}
	
	If the field name to be normalized contains the string "first_name" {
		- Create a new field name that is the same as the field name but with "norm_" prepended to it.
			- i.e. "first_name" becomes "norm_first_name", "owner_first_name" becomes "norm_owner_first_name".	
		- Use the nickname algorithm to encode the value and store that value in the new field.
		}

	If the field is "race" {
		- Create a new field name that is the same as the field name but with "norm_" prepended to it.
		- If race is null, set norm_race to ''.
		- Else if the race is "W", "Cauc", "Caucasian" or "White" norm_race is set to "W".
		- Else norm_race is set to "B".
		}

	If the field name to be normalized contains the string "occupation" {
		- Create a new field name that is the same as the field name but with "norm_" prepended to it.
			- i.e. "occupation" becomes "norm_occupation", "owner_occupation" becomes "norm_owner_occupation".	
		- Use the occupation algorithm to encode the value and store that value in the new field.
		}
	If the full_name has only one word, then add that word to last_name.
		If the full_name has two words, then first_name is the first word and last_name is the last word.
		If the full_name has more than two words, then first_name is the first word, middle_name is the second word, and last_name is the last word.
		if the full_name has a jr or sr or or ii or iii or iv 2nd or 3rd or 4th or 5th, use the word before it as the last_name.
		remove all punctuation from middle name.
	
**NICKNAME ALGORITHM**

		Convert the value to a normalized value using the NICKNAMES object found below.
		Remove all non-alphabetic characters and convert the name to uppercase.
		Convert all abbreviations to full names, e.g. "Wm" to "William", "Robt" to "Robert", "Jas" to "James", etc.
		Convert all nicknames to full names, e.g. "Bill" to "William", "Bob" to "Robert", "Jim" to "James", etc.

**JARO-WINKLER ALGORITHM**

		Write a JavaScript function that implements the Jaro-Winkler string similarity algorithm {
			The function should take two strings as arguments and return a number between 0.0 and 1.0 (where 1.0 is an exact match and 0.0 means no similarity).
			Do not use any external dependencies or libraries.
			Include handling for edge cases: empty strings, identical strings, and case-insensitivity.
			Provide clear comments explaining the two main phases: calculating the base Jaro similarity, and then applying the Winkler prefix scale modification.
		}`

**FELLEGI-SUNTER ALGORITHM:**

	Create a fun`ction called buildNameFrequencies(dataset) {
		- It takes an array of person objects, such as a dataset of census records. 
		- It creates and returns two Map objects (firstNameFreq and lastNameFreq). 
		- It iterates through the dataset, normalizes the first_name and last_name (lowercase, trimmed), and counts their occurrences.
		}

	Create a function called getNameWeightModifier(name, freqMap) {
		- It takes a normalized name and its corresponding frequency map. It returns an integer based on these rules {
			- Name missing/not in map: 0
			- Count <= 5 (Very Rare): +15
			- Count <= 20 (Uncommon): +5
			- Count between 21 and 100 (Average): 0
			- Count > 100 (Common): -5
			- Count > 500 (Extremely Common): -15
		}
	}

**NYSIIS ALGORITHM**

		Remove all non-alphabetic characters and convert the name to uppercase.
		At the beginning of name:
			MAC becomes MC
			KN becomes N.
			SCH becomes S.
		At end of name:
			EE or IE becomes Y.
			DT, RT, RD, NT, or ND becomes D.
		Remove trailing S, or A.
		Within the name:
			Vowels (A, E, I, O, U) are all converted to A.
			Q becomes G, Z becomes S, M becomes N.
			PH becomes F, K becomes C.
			H is removed if the preceding or following character is not a vowel.
			W is removed if the preceding character is a vowel.
		Collapse all duplicate consecutive characters (e.g., AA becomes A).
	
**OCCUPATION ALGORITHM**

		Convert the value to a normalized value using the normalized_occupations table found below.
		Ignore case when normalizing.
		Remove all punctuation from occupation before normalizing.
		Remove the words Assist or Assistant or intern or app or appren. apprentice or apprenticed from occupation.
		It is not necessary to match occupations exactly when normalizing for example “house keeper” and “house keeping” should both map to Domestic.
		If occupation has "school " or "university" or "prof" in it,  normalize it to "Education".
		If occupation has “farm” in it, normalize it to "Agriculture".
		If occupation has “maid” or “house” in it, normalize it to "Domestic".
		If occupation has “r r” in it, normalize it to "Transportation".
		If occupation does not match any of the categories, try to find the closest category that matches it. Do not make up any new categories.
		Make uppercase.

		normalized_occupations_table [
		{
			"label": "Agriculture",
			"title": "Agricultural & Farming",
			"examples": "farmer, farmhand, planter, gardener, cattle work, dairyman, shepherd, hostler"
		},
		{
			"label": "Food",
			"title": "Food Production & Processing",
			"examples": "baker, butcher, miller, flour work, confectioner"
		},
		{
			"label": "Textile",
			"title": "Textile & Clothing",
			"examples": "tailor, seamstress, dressmaker, weaver, spinner"
		},
		{
			"label": "Leather",
			"title": "Leather & Footwear",
			"examples": "shoemaker, shoe maker, saddler, tanner, harness maker"
		},
		{
			"label": "Metal",
			"title": "Metalworking & Smithing",
			"examples": "blacksmith, silversmith, tinsmith, gunsmith, locksmith, b smith, blk-smith, bsmith"
		},
		{
			"label": "Woodwork",
			"title": "Woodworking & Furniture",
			"examples": "carpenter, cabinetmaker, wheelwright, chairmaker"
		},
		{
			"label": "Construction",
			"title": "Construction & Building",
			"examples": "mason, brickmaker, plasterer, painter, slater"
		},
		{
			"label": "Transportation",
			"title": "Railroad & Transportation",
			"examples": "railroad worker, railroad, conductor, engineer, brakeman, flagman, boatman, ferryman, sailor, waterman, teamster, drayman, wagoner, driver, expressman, rail road"
		},
		{
			"label": "Domestic",
			"title": "Domestic Service",
			"examples": "domestic, servant, cook, butler, chambermaid, housekeeper, laundress, washerwoman, nurse, governess, keep house, keeping house, at home, house keeper, house-keeping"
		},
		{
			"label": "Commerce",
			"title": "Retail & Commerce",
			"examples": "merchant, grocer, dealer, trader, storekeeper"
		},
		{
			"label": "Office",
			"title": "Clerical & Office Work",
			"examples": "clerk, bookkeeper, accountant, copyist"
		},
		{
			"label": "Profession",
			"title": "Professional Services",
			"examples": "lawyer, physician, surveyor, architect, photographer, doctor, dentist, banker, nurse"
		},
		{
			"label": "Education",
			"title": "Education",
			"examples": "teacher, college,professor, school, university prof"
		},
		{
			"label": "Religion",
			"title": "Religion",
			"examples": "minister, preacher, librarian"
		},
		{
			"label": "Manufacturing",
			"title": "Manufacturing & Industrial",
			"examples": "machinist, factory [worker], foundry [worker], manufacturer"
		},
		{
			"label": "Extraction",
			"title": "Mining & Extraction",
			"examples": "miner, coal [worker], quarryman, well digger"
		},
		{
			"label": "Government",
			"title": "Public Service & Law Enforcement",
			"examples": "police, sheriff, constable, judge, jailer, postmaster, tax collector, inspector, enumerator, mayor, post master, post mistress"
		},
		{
			"label": "Hospitality",
			"title": "Hospitality & Food Service",
			"examples": "hotel [keeper], saloonkeeper, bartender, waiter, boarding house [keeper]"
		},
		{
			"label": "Craftsman",
			"title": "Skilled Artisans & Crafts",
			"examples": "jeweler, watchmaker, printer, cooper"
		},
		{
			"label": "Laborer",
			"title": "General Labor & Assistance",
			"examples": "laborer, helper, assistant, errand [boy]"
		}
		];

**NICKNAMES**
`
		const nickname = {
			// William
			"WM": "WILLIAM", "BILL": "WILLIAM", "BILLY": "WILLIAM",
			"WILL": "WILLIAM", "WILLY": "WILLIAM", "WILLIE": "WILLIAM",

			// Robert
			"ROBT": "ROBERT", "ROB": "ROBERT", "BOB": "ROBERT",
			"BOBBY": "ROBERT", "ROBBIE": "ROBERT",

			// James
			"JAS": "JAMES", "JIM": "JAMES", "JIMMY": "JAMES", "JAMIE": "JAMES",

			// Charles
			"CHAS": "CHARLES", "CHARLIE": "CHARLES", "CHUCK": "CHARLES", "CARL": "CHARLES",

			// Thomas
			"THOS": "THOMAS", "TOM": "THOMAS", "TOMMY": "THOMAS",

			// John
			"JNO": "JOHN", "JON": "JOHN", "JACK": "JOHN", "JACKIE": "JOHN",
			"JONNY": "JOHN", "JOHNNY": "JOHN",

			// Daniel
			"DAN": "DANIEL", "DANNY": "DANIEL",

			// Edward
			"ED": "EDWARD", "EDDIE": "EDWARD", "NED": "EDWARD", "TED": "EDWARD", "TEDDY": "EDWARD",

			// George
			"GEO": "GEORGE",

			// Joseph
			"JOS": "JOSEPH", "JOE": "JOSEPH", "JOEY": "JOSEPH",

			// Samuel
			"SAM": "SAMUEL", "SAMMY": "SAMUEL",

			// Alexander
			"ALEX": "ALEXANDER", "ALECK": "ALEXANDER", "ALEC": "ALEXANDER",
			"SANDY": "ALEXANDER",

			// Patrick
			"PAT": "PATRICK", "PADDY": "PATRICK",

			// Matthew
			"MATT": "MATTHEW", "MAT": "MATTHEW",

			// Michael
			"MIKE": "MICHAEL", "MICK": "MICHAEL", "MICKEY": "MICHAEL",
			"MICH": "MICHAEL",

			// David
			"DAVE": "DAVID", "DAVEY": "DAVID", "DAVY": "DAVID",

			// Christopher
			"CHRIS": "CHRISTOPHER", "KIT": "CHRISTOPHER",

			// Richard
			"RICH": "RICHARD", "RICK": "RICHARD", "DICK": "RICHARD",
			"RICHD": "RICHARD", "DICKY": "RICHARD",

			// Henry
			"HARRY": "HENRY", "HAL": "HENRY", "HEN": "HENRY",

			// Benjamin
			"BEN": "BENJAMIN", "BENNY": "BENJAMIN", "BENJ": "BENJAMIN",

			// Frederick
			"FRED": "FREDERICK", "FREDDY": "FREDERICK", "FREDK": "FREDERICK",

			// Francis
			"FRANK": "FRANCIS", "FRAN": "FRANCIS", "FRAS": "FRANCIS",

			// Andrew
			"ANDY": "ANDREW",

			// Anthony
			"TONY": "ANTHONY", "ANT": "ANTHONY",

			// Arthur
			"ART": "ARTHUR", "ARTIE": "ARTHUR",

			// Albert
			"AL": "ALBERT", "ALB": "ALBERT",

			// Alfred
			"ALF": "ALFRED", "ALFIE": "ALFRED",

			// Walter
			"WALT": "WALTER", "WALLY": "WALTER",

			// Peter
			"PETE": "PETER",

			// Stephen/Steven
			"STEVE": "STEPHEN", "STEPH": "STEPHEN",

			// Nicholas
			"NICK": "NICHOLAS", "NICKY": "NICHOLAS",

			// Nathaniel
			"NAT": "NATHANIEL", "NATE": "NATHANIEL", "NATHL": "NATHANIEL",

			// Abraham
			"ABE": "ABRAHAM",

			// Isaac
			"IKE": "ISAAC",

			// Elijah
			"LI": "ELIJAH", "LIJE": "ELIJAH",

			// Emanuel / Emmanuel
			"MANNY": "EMANUEL", "MANUEL": "EMANUEL",

			// Harvey
			"HARV": "HARVEY",

			// Lewis / Louis
			"LEW": "LEWIS",

			// Moses
			"MOSE": "MOSES",

			// Solomon
			"SOL": "SOLOMON",

			// Tobias
			"TOBY": "TOBIAS",

			// Jeremiah
			"JERRY": "JEREMIAH", "JER": "JEREMIAH",

			// Ezekiel
			"ZEKE": "EZEKIEL",

			// Cornelius
			"NEIL": "CORNELIUS", "CORN": "CORNELIUS",

			// Bartholomew
			"BART": "BARTHOLOMEW",

			// Edmund
			"ED": "EDMUND",  // overlaps with Edward — order-dependent; keep Edward last if you split

			// Archibald
			"ARCH": "ARCHIBALD", "ARCHIE": "ARCHIBALD",

			// Augustus
			"GUS": "AUGUSTUS",

			// Ambrose
			"AMB": "AMBROSE",

			// Zachariah / Zachary
			"ZACH": "ZACHARIAH", "ZACK": "ZACHARIAH",

			// ---------- Female names ----------

			// Elizabeth
			"LIZ": "ELIZABETH", "LIZZIE": "ELIZABETH", "LIZZY": "ELIZABETH",
			"BETH": "ELIZABETH", "BETTY": "ELIZABETH", "BETTE": "ELIZABETH",
			"BESS": "ELIZABETH", "BESSIE": "ELIZABETH", "ELIZA": "ELIZABETH",
			"ELIZ": "ELIZABETH", "LIBBY": "ELIZABETH",

			// Mary
			"MOLLY": "MARY", "POLLY": "MARY", "MAE": "MARY", "MAMIE": "MARY",

			// Margaret
			"MAG": "MARGARET", "MAGGIE": "MARGARET", "MEG": "MARGARET",
			"PEGGY": "MARGARET", "MARG": "MARGARET", "MARGT": "MARGARET",
			"RITA": "MARGARET",

			// Catherine / Katherine
			"KATE": "CATHERINE", "KATIE": "CATHERINE", "KIT": "CATHERINE",
			"KITTY": "CATHERINE", "KATH": "CATHERINE",

			// Sarah
			"SARA": "SARAH", "SALLY": "SARAH", "SAL": "SARAH",

			// Susan / Susannah
			"SUE": "SUSAN", "SUSIE": "SUSAN", "SUSY": "SUSAN",
			"SUSY": "SUSANNAH", "SUSA": "SUSANNAH",

			// Ann / Anne / Hannah
			"ANNIE": "ANN", "ANNA": "ANN", "NAN": "ANN", "NANNY": "ANN",
			"HANNA": "HANNAH",

			// Martha
			"MART": "MARTHA", "MATTIE": "MARTHA",

			// Rebecca
			"BECCA": "REBECCA", "BECKY": "REBECCA",

			// Caroline / Carolina
			"CARRIE": "CAROLINE", "CAROL": "CAROLINE",

			// Eleanor
			"NELL": "ELEANOR", "NELLIE": "ELEANOR", "NORA": "ELEANOR",

			// Frances
			"FANNY": "FRANCES",

			// Harriet
			"HATTIE": "HARRIET",

			// Louisa
			"LOU": "LOUISA", "LULA": "LOUISA",

			// Matilda
			"TILLY": "MATILDA", "TILLIE": "MATILDA",

			// Virginia
			"GINNY": "VIRGINIA",

			// Lavinia
			"VINA": "LAVINIA", "VINEY": "LAVINIA",

			// Priscilla
			"PRISSY": "PRISCILLA", "CILLA": "PRISCILLA",

			// Delilah
			"DELIA": "DELILAH", "LILA": "DELILAH",

			// Lucinda
			"LUCY": "LUCINDA",

			// Phillis / Phyllis (common in enslaved records)
			"PHILLIS": "PHYLLIS",

			// Minerva
			"MINNIE": "MINERVA",
		};