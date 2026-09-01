// match.js  (revised)
// ---------------------------------------------------------------------------
// Match — standalone name-comparison primitives + person<->mention scoring.
//
// CHANGES IN THIS REVISION (see design notes):
//   1. Household (Lever C) is now a NOISY-OR *boost* on the residual gap to
//      certainty, not an averaged lever. It can only raise a score, never drag
//      it, so an absent or weak roster is no longer a penalty.
//        S0 = weighted(name, birth)            // base identity evidence
//        H  = 1 - prod(1 - h_k)                // noisy-OR over matched relatives
//        S  = S0 + beta * H * (1 - S0)         // residual-gap boost (beta default 0.6)
//   2. Birth profile default sigma loosened 2.0 -> 3.0 and knockout 10 -> 12,
//      to fit the age-report noise of 1850/1860 self/enumerator-reported ages.
//   3. Race knockout uses _raceClass(), which collapses Black<->Mulatto into one
//      class so routine B<->M reclassification across enumerations does not veto.
//   4. Calibration features are now [name, birth, H] (H is the family feature).
//
// PRECISION REVISION (validated on a 500-pair human-reviewed sample; strict
// auto-accept precision was 52.6%). Four changes:
//   A. Surname-distance guard (_surnameMatch): a phonetic / NYSIIS / bridged
//      surname tier only stands if the raw surnames are also close under
//      Jaro-Winkler (>= surnameFuzzyFloor, default 0.85). Stops double-metaphone
//      collisions (Price/Boyers, Carrier/Crow) from counting as a full surname
//      while sparing genuine spelling variants (Snyder/Snider, Kline/Cline).
//   B. Nickname demotion (matchNameDetail): base 1.00 (EXACT_FIRST_SURNAME) is
//      reserved for LITERALLY identical given names. Nickname-table equivalence
//      (Fannie/Frances) and fuzzy matches drop to NICKNAME_FIRST_SURNAME (0.85)
//      and are marked needsCorroboration.
//   C. Corroboration gate (MatchPerson combiner): needsCorroboration is no longer
//      diagnostic-only. A needsCorroboration rung with NO corroborating evidence
//      (no household, no birthplace-agree, no occupation-agree) takes a subtractive
//      corroborationPenalty (default 0.15). Second downward soft signal, alongside
//      birthplace disagreement. Set corroborationPenalty=0 to restore old behavior.
//   D. Calibration features are now [name, birth, H, surnameReliability]; the new
//      scalar lets probability see how trustworthy the surname match is. Margin is
//      a caller-level signal and stays out of this per-pair vector.
//
// Unchanged: name cascade (MatchName), Jaro-Winkler, rarity, nickname table,
// logistic calibration machinery.
//
// No external dependencies. Tunables via the constructor / per-call ctx.
// ---------------------------------------------------------------------------

class Match {

	static DEFAULT_RARITY = {
		veryRareMax: 5,
		uncommonMax: 20,
		averageMax: 100,
		commonMax: 500,
		modVeryRare: 15,
		modUncommon: 5,
		modAverage: 0,
		modCommon: -5,
		modExtremelyCommon: -15,
	};

	// Given-name fuzzy pass. Lowered from 0.85 to 0.84 so that truncations
	// sitting just under the old bar are caught - ARCHIBALD/ARCHY is 0.8489,
	// WASHINGTON/WASHT 0.8457 - without carrying a curated nickname table for
	// them. This is a deliberate recall-for-precision trade: measured against
	// the AUG corpus it admits roughly 660 additional cross-name equivalences,
	// of which only a small fraction are true (ARCHIBALD/ARCHY, SOPHRONIA/SOPHY,
	// CASSANDRA/CASSY) and the rest are not (HENRY/HENRIETTA, EDWARD/STEWARD,
	// CHARLES/HARLEY, ELIJAH/DELILAH, LUCINDA/LUCIUS, WILLIS/WILLARD).
	//
	// Two things contain the damage, and both matter:
	//   - a fuzzy given-name hit yields rung NICKNAME_FIRST_SURNAME at base 0.85
	//     with needsCorroboration set, not an exact-name score; and
	//   - it still requires the SURNAME to have fired, so these are not loose
	//     matches on the given name alone.
	// Raise back to 0.85 via config { jwFuzzyPassThreshold: 0.85 } if false merges show
	// up in review.
	static DEFAULT_JW_FUZZY_PASS = 0.84;

	// Surname-distance guard: floor on raw-surname Jaro-Winkler below which a
	// phonetic / NYSIIS / bridged code match is rejected (falls through to
	// NO_MATCH). Exact full-/last-name tiers are exempt (they are identical).
	static DEFAULT_SURNAME_FUZZY_FLOOR = 0.85;

	// surnameReliability: how much to trust the surname match, fed to calibration
	// (feature D). Higher = more trustworthy. Keyed by surnameKind.
	static SURNAME_RELIABILITY = {
		EXACT_FULLNAME: 1.0,
		EXACT_LASTNAME: 1.0,
		BRIDGED: 0.85,
		FUZZY_STRONG: 0.75,
		NYSIIS: 0.70,
		PHONETIC_STRONG: 0.70,
		PHONETIC_MODERATE: 0.50,
		FUZZY_MODERATE: 0.45,
		PHONETIC_WEAK: 0.35,
		NO_MATCH: 0.0,
	};

	static DEFAULT_NICKNAMES = {
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
		"ED": "EDMUND",
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
		"SUSY_": "SUSANNAH", "SUSA": "SUSANNAH",
		"SUSY": "SUSANNAH",
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
		// Phillis / Phyllis
		"PHILLIS": "PHYLLIS",
		// Minerva
		"MINNIE": "MINERVA",

		// ---- additions mined from mentions.csv ----
		"SAML": "SAMUEL", "ALEXR": "ALEXANDER", "ANDW": "ANDREW",
		"EDWD": "EDWARD", "JOSH": "JOSHUA",
		"ELISABETH": "ELIZABETH", "BETTIE": "ELIZABETH", "BETSY": "ELIZABETH",
		"BETSEY": "ELIZABETH", "LIZA": "ELIZABETH",
		"SALLIE": "SARAH", "SADIE": "SARAH", "SADY": "SARAH",
		"FANNIE": "FRANCES", "FRANKIE": "FRANCES",
		"NANNIE": "ANN",
		"MOLLIE": "MARY",
		"MARGIE": "MARGARET", "MAGGY": "MARGARET",
		"CATHARINE": "CATHERINE", "KATY": "CATHERINE",
		"RACHAEL": "RACHEL",
		"SUSANNA": "SUSANNAH", "SUSANAH": "SUSANNAH",
		"JOHNNIE": "JOHN", "JIMMIE": "JAMES", "TOMMIE": "THOMAS",
		"BILLIE": "WILLIAM", "GEORGIE": "GEORGE", "CHARLEY": "CHARLES",
		"FREDDIE": "FREDERICK",
		"NETTIE": "HENRIETTA", "HETTIE": "HESTER", "MILLIE": "MILDRED",
		"MAY": "MARY", "ABRAM": "ABRAHAM",
	};

	// --- small self-contained helpers ---
	static isPresent(v) {
		return v !== null && v !== undefined && String(v).trim() !== "" && String(v).trim().toLowerCase() !== "null";
	}

	static normUpper(s) {
		return Match.isPresent(s) ? String(s).trim().toUpperCase().replace(/[^A-Z]/g, "") : "";
	}

	static clamp(x, lo, hi) {
		return Math.max(lo, Math.min(hi, x));
	}

	static jaro(s1, s2) {
		if (!s1 || !s2) return 0.0;
		s1 = String(s1).toUpperCase();
		s2 = String(s2).toUpperCase();
		if (s1 === s2) return 1.0;
		const len1 = s1.length, len2 = s2.length;
		const matchDistance = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
		const s1Matches = new Array(len1).fill(false);
		const s2Matches = new Array(len2).fill(false);
		let matches = 0;
		for (let i = 0; i < len1; i++) {
			const start = Math.max(0, i - matchDistance);
			const end = Math.min(i + matchDistance + 1, len2);
			for (let j = start; j < end; j++) {
				if (s2Matches[j]) continue;
				if (s1[i] !== s2[j]) continue;
				s1Matches[i] = true; s2Matches[j] = true; matches++; break;
			}
		}
		if (matches === 0) return 0.0;
		let transpositions = 0, k = 0;
		for (let i = 0; i < len1; i++) {
			if (!s1Matches[i]) continue;
			while (!s2Matches[k]) k++;
			if (s1[i] !== s2[k]) transpositions++;
			k++;
		}
		transpositions /= 2;
		return (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3;
	}

	static jaroWinkler(s1, s2, prefixScale = 0.1, boostThreshold = 0.7) {
		if (!s1 || !s2) return 0.0;
		s1 = String(s1).toUpperCase();
		s2 = String(s2).toUpperCase();
		if (s1 === s2) return 1.0;
		const j = Match.jaro(s1, s2);
		if (j < boostThreshold) return j;
		const maxPrefix = Math.min(4, s1.length, s2.length);
		let prefix = 0;
		while (prefix < maxPrefix && s1[prefix] === s2[prefix]) prefix++;
		return j + prefix * prefixScale * (1 - j);
	}

	static doubleMetaphoneScore(codeA, codeB) {
		if (!Match.isPresent(codeA) || !Match.isPresent(codeB)) return null;
		const parse = (c) => {
			const parts = String(c).toUpperCase().split(':').map((x) => x.trim().replace(/[^A-Z]/g, ''));
			const primary = parts[0] || '';
			const secondary = parts[1] || primary;
			return { primary, secondary };
		};
		const A = parse(codeA);
		const B = parse(codeB);
		if (!A.primary || !B.primary) return 0.0;
		if (A.primary === B.primary) return 1.0;
		if (A.primary === B.secondary || A.secondary === B.primary) return 0.8;
		if (A.secondary && A.secondary === B.secondary) return 0.6;
		return 0.0;
	}

	static buildNameFrequencies(mentions) {
		const firstNameFreq = new Map();
		const lastNameFreq = new Map();
		if (Array.isArray(mentions)) {
			for (const m of mentions) {
				if (!m) continue;
				const fk = Match.normUpper(m.first_name || m.norm_first_name);
				if (fk) firstNameFreq.set(fk, (firstNameFreq.get(fk) || 0) + 1);
				const lk = Match.normUpper(m.last_name);
				if (lk) lastNameFreq.set(lk, (lastNameFreq.get(lk) || 0) + 1);
			}
		}
		return { firstNameFreq, lastNameFreq };
	}

	static nameWeightModifier(value, freqMap, rarityConfig = Match.DEFAULT_RARITY) {
		const r = rarityConfig || Match.DEFAULT_RARITY;
		const key = Match.normUpper(value);
		if (!key || !freqMap || typeof freqMap.get !== 'function' || !freqMap.has(key)) return 0;
		const count = freqMap.get(key) || 0;
		if (count <= r.veryRareMax) return r.modVeryRare;
		if (count <= r.uncommonMax) return r.modUncommon;
		if (count <= r.averageMax) return r.modAverage;
		if (count <= r.commonMax) return r.modCommon;
		return r.modExtremelyCommon;
	}

	static nickname(name) {
		if (!Match._defaultInstance) Match._defaultInstance = new Match();
		return Match._defaultInstance.nickname(name);
	}

	static canonical(name) {
		return Match.nickname(name);
	}

	constructor(config = {}) {
		this.rarity = { ...Match.DEFAULT_RARITY, ...(config.rarity || {}) };

		this.jwFuzzyPassThreshold = (config.jwFuzzyPassThreshold != null)
			? config.jwFuzzyPassThreshold
			: Match.DEFAULT_JW_FUZZY_PASS;

		this.surnameFuzzyFloor = (config.surnameFuzzyFloor != null)
			? config.surnameFuzzyFloor
			: Match.DEFAULT_SURNAME_FUZZY_FLOOR;

		this._nickToCanon = new Map();
		const tables = [Match.DEFAULT_NICKNAMES, config.nicknames || {}];
		for (const table of tables) {
			for (const nickRaw of Object.keys(table)) {
				const nick = Match.normUpper(nickRaw);
				const canon = Match.normUpper(table[nickRaw]);
				if (!nick || !canon) continue;
				this._nickToCanon.set(nick, canon);
				if (!this._nickToCanon.has(canon)) this._nickToCanon.set(canon, canon);
			}
		}
	}

	// -----------------------------------------------------------------------
	// 1. NICKNAME & PHONETICS
	// -----------------------------------------------------------------------
	nickname(name) {
		const key = Match.normUpper(name);
		if (!key) return "";
		return this._nickToCanon.get(key) || key;
	}
	canonical(name) { return this.nickname(name); }
	sameNickname(a, b) {
		const ca = this.nickname(a);
		const cb = this.nickname(b);
		return !!ca && ca === cb;
	}

	getNYSIIS(name) {
		return Match.normUpper(name);
	}

	getMetaphone(name) {
		return Match.normUpper(name);
	}

	doubleMetaphoneMatchScore(codeA, codeB) {
		return Match.doubleMetaphoneScore(codeA, codeB);
	}

	// -----------------------------------------------------------------------
	// 2. JARO-WINKLER
	// -----------------------------------------------------------------------
	jaro(s1, s2) {
		if (!s1 || !s2) return 0.0;
		s1 = String(s1).toUpperCase();
		s2 = String(s2).toUpperCase();
		if (s1 === s2) return 1.0;
		const len1 = s1.length, len2 = s2.length;
		const matchDistance = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
		const s1Matches = new Array(len1).fill(false);
		const s2Matches = new Array(len2).fill(false);
		let matches = 0;
		for (let i = 0; i < len1; i++) {
			const start = Math.max(0, i - matchDistance);
			const end = Math.min(i + matchDistance + 1, len2);
			for (let j = start; j < end; j++) {
				if (s2Matches[j]) continue;
				if (s1[i] !== s2[j]) continue;
				s1Matches[i] = true; s2Matches[j] = true; matches++; break;
			}
		}
		if (matches === 0) return 0.0;
		let transpositions = 0, k = 0;
		for (let i = 0; i < len1; i++) {
			if (!s1Matches[i]) continue;
			while (!s2Matches[k]) k++;
			if (s1[i] !== s2[k]) transpositions++;
			k++;
		}
		transpositions /= 2;
		return (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3;
	}

	jaroWinkler(s1, s2, prefixScale = 0.1, boostThreshold = 0.7) {
		if (!s1 || !s2) return 0.0;
		s1 = String(s1).toUpperCase();
		s2 = String(s2).toUpperCase();
		if (s1 === s2) return 1.0;
		const j = this.jaro(s1, s2);
		if (j < boostThreshold) return j;
		const maxPrefix = Math.min(4, s1.length, s2.length);
		let prefix = 0;
		while (prefix < maxPrefix && s1[prefix] === s2[prefix]) prefix++;
		return j + prefix * prefixScale * (1 - j);
	}

	// -----------------------------------------------------------------------
	// 3. RARITY
	// -----------------------------------------------------------------------
	buildNameFrequencies(mentions) {
		const firstNameFreq = new Map();
		const lastNameFreq = new Map();
		if (Array.isArray(mentions)) {
			for (const m of mentions) {
				if (!m) continue;
				const fk = Match.normUpper(m.first_name || m.norm_first_name);
				if (fk) firstNameFreq.set(fk, (firstNameFreq.get(fk) || 0) + 1);
				const lk = Match.normUpper(m.last_name);
				if (lk) lastNameFreq.set(lk, (lastNameFreq.get(lk) || 0) + 1);
			}
		}
		return { firstNameFreq, lastNameFreq };
	}

	nameWeightModifier(value, freqMap) {
		const r = this.rarity;
		const key = Match.normUpper(value);
		if (!key || !freqMap || typeof freqMap.get !== 'function' || !freqMap.has(key)) return 0;
		const count = freqMap.get(key) || 0;
		if (count <= r.veryRareMax) return r.modVeryRare;
		if (count <= r.uncommonMax) return r.modUncommon;
		if (count <= r.averageMax) return r.modAverage;
		if (count <= r.commonMax) return r.modCommon;
		return r.modExtremelyCommon;
	}

	applyRarity(base, value, freqMap) {
		if (!(base > 0)) return base;
		const modifier = this.nameWeightModifier(value, freqMap) / 100;
		return Match.clamp(base + modifier, 0, 1);
	}

	// =======================================================================
	// LEVER A — NAME AGREEMENT
	// =======================================================================
	usePool(mentions) {
		const { firstNameFreq, lastNameFreq } = this.buildNameFrequencies(mentions);
		return this.useFrequencies(firstNameFreq, lastNameFreq);
	}
	useFrequencies(firstNameFreq, lastNameFreq) {
		this._firstNameFreq = firstNameFreq || null;
		this._lastNameFreq = lastNameFreq || null;
		this._initialFreq = null;
		return this;
	}
	setSurnameBridge(fn) {
		this._surnameBridge = (typeof fn === 'function') ? fn : null;
		return this;
	}

	MatchName(objA, objB) { return this.matchNameDetail(objA, objB).score; }

	matchNameDetail(objA, objB) {
		objA = objA || {};
		objB = objB || {};

		const sm = this._surnameMatch(objA, objB);
		const firedSurname = sm.strength >= 0.8;

		const gA = this._classifyGiven(objA);
		const gB = this._classifyGiven(objB);

		let rung = 'NONE';
		let base = 0.0;
		let needsCorroboration = false;
		let usedFirstNameAgreement = false;
		let usedInitial = false;
		let initialLetter = '';

		if (gA.cls === 'ABSENT' || gB.cls === 'ABSENT') {
			if (firedSurname) { rung = 'SURNAME_ONLY'; base = 0.3; needsCorroboration = true; }
		} else if (gA.cls === 'FULL' && gB.cls === 'FULL') {
			// Three levels of given-name agreement, strongest first:
			//   givenIdentical - literally the same string after normUpper (base 1.0)
			//   givenExact     - same canonical form via the nickname table, but NOT
			//                    identical (Fannie/Frances) -> 0.85, needsCorroboration
			//   givenNickname  - fuzzy Jaro-Winkler match -> 0.85, needsCorroboration
			// A same-name-family, same-surname, close-birth pair is common among
			// siblings and neighbors in a county census, so anything short of a
			// literal match now wants corroboration.
			const canonA = this.nickname(gA.norm);
			const canonB = this.nickname(gB.norm);
			const givenIdentical = gA.norm === gB.norm;
			const givenExact = !givenIdentical && !!canonA && canonA === canonB;
			const jw = this.jaroWinkler(gA.norm, gB.norm);
			const givenNickname = jw >= this.jwFuzzyPassThreshold;
			const givenAgree = givenIdentical || givenExact || givenNickname;

			if (givenIdentical && firedSurname) {
				rung = 'EXACT_FIRST_SURNAME'; base = 1.0; usedFirstNameAgreement = true;
			} else if ((givenExact || givenNickname) && firedSurname) {
				rung = 'NICKNAME_FIRST_SURNAME'; base = 0.85; needsCorroboration = true; usedFirstNameAgreement = true;
			} else if (givenAgree && sm.strength >= 0.6 && sm.strength < 0.8) {
				rung = 'PHONETIC_MODERATE_SURNAME'; base = 0.7; needsCorroboration = true; usedFirstNameAgreement = true;
			} else if (givenAgree && sm.strength === 0.0) {
				rung = 'GIVEN_NAME_ONLY'; base = 0.4; needsCorroboration = true; usedFirstNameAgreement = true;
			} else if (firedSurname) {
				rung = 'SURNAME_ONLY'; base = 0.3; needsCorroboration = true;
			}
		} else {
			const bothInitials = gA.cls === 'INITIAL' && gB.cls === 'INITIAL';
			const consistent = gA.initial === gB.initial;
			initialLetter = gA.initial || gB.initial;
			if (!consistent) {
				if (firedSurname) { rung = 'SURNAME_ONLY'; base = 0.3; needsCorroboration = true; }
			} else if (bothInitials) {
				if (firedSurname) { rung = 'BOTH_INITIALS_SURNAME'; base = 0.35; needsCorroboration = true; usedInitial = true; }
			} else {
				if (firedSurname) { rung = 'INITIAL_CONSISTENT_SURNAME'; base = 0.55; needsCorroboration = true; usedInitial = true; }
			}
		}

		let rarityFirst = 0;
		let raritySurname = 0;
		if (base > 0) {
			if (firedSurname && this._lastNameFreq) {
				const surname = this._resolveSurname(objA) || this._resolveSurname(objB);
				raritySurname = this.nameWeightModifier(surname, this._lastNameFreq) / 100;
			}
			if (usedFirstNameAgreement && this._firstNameFreq) {
				const fn = Match.isPresent(objA.norm_first_name) ? objA.norm_first_name : objA.first_name;
				rarityFirst = this.nameWeightModifier(fn, this._firstNameFreq) / 100;
			} else if (usedInitial && this._firstNameFreq) {
				rarityFirst = this._initialLetterModifier(initialLetter) / 100;
			}
		}

		const score = base > 0 ? Match.clamp(base + rarityFirst + raritySurname, 0, 1) : 0;

		return {
			score, rung,
			surnameStrength: sm.strength, surnameKind: sm.kind,
			weakSurnameHint: !!sm.weakHint, needsCorroboration,
			givenClass: gA.cls + '/' + gB.cls,
			rarityFirst, raritySurname,
			middleTiebreak: this._middleTiebreak(objA, objB),
		};
	}

	_surnameMatch(a, b) {
		const fa = this._normFullName(a.full_name);
		const fb = this._normFullName(b.full_name);
		if (fa && fb && fa === fb) return { strength: 1.0, kind: 'EXACT_FULLNAME' };
		const la = this._normLast(a.last_name);
		const lb = this._normLast(b.last_name);
		if (la && lb && la === lb) return { strength: 1.0, kind: 'EXACT_LASTNAME' };

		// Surname-distance guard. The phonetic / NYSIIS / bridged tiers below match
		// on CODES, not spellings, and double-metaphone primaries collide for
		// genuinely different surnames (Bell/Bull, Price/Boyers, Carrier/Crow). A
		// code match only stands if the raw surnames are also close under
		// Jaro-Winkler (>= surnameFuzzyFloor). Exact full-/last-name matched above
		// and are exempt. When a surname string is missing on either side we cannot
		// verify spelling, so the guard is a no-op (evidence excluded, not penalized).
		const surnameJw = (la && lb) ? this.jaroWinkler(la, lb) : null;
		const guardOk = (surnameJw == null) || (surnameJw >= this.surnameFuzzyFloor);

		if (guardOk && this._surnameBridge && this._surnameBridge(a, b)) return { strength: 0.9, kind: 'BRIDGED' };

		const dm = this._doubleMetaphoneScore(a.metaphone_last_name, b.metaphone_last_name);
		if (guardOk && dm === 1.0) return { strength: 1.0, kind: 'PHONETIC_STRONG' };
		if (guardOk && dm === 0.8) return { strength: 0.8, kind: 'PHONETIC_MODERATE' };

		// Check NYSIIS phonetic match
		const na = Match.normUpper(a.nysiis_last_name);
		const nb = Match.normUpper(b.nysiis_last_name);
		if (guardOk && na && nb && na === nb) return { strength: 0.85, kind: 'NYSIIS' };

		if (guardOk && dm === 0.6) return { strength: 0.6, kind: 'PHONETIC_WEAK', weakHint: true };

		// Fuzzy Jaro-Winkler similarity on surnames (already distance-based, so it
		// carries its own guard - no separate floor needed).
		if (la && lb) {
			const jw = surnameJw != null ? surnameJw : this.jaroWinkler(la, lb);
			if (jw >= 0.90) return { strength: 0.80, kind: 'FUZZY_STRONG' };
			if (jw >= 0.85) return { strength: 0.65, kind: 'FUZZY_MODERATE', weakHint: true };
		}

		return { strength: 0.0, kind: 'NO_MATCH' };
	}

	// surnameReliability scalar for calibration (feature D). Unknown kinds get a
	// neutral 0.5 so a new tier never silently reads as fully trustworthy.
	_surnameReliability(kind) {
		const R = Match.SURNAME_RELIABILITY;
		return (kind && R[kind] != null) ? R[kind] : 0.5;
	}

	_doubleMetaphoneScore(codeA, codeB) {
		return Match.doubleMetaphoneScore(codeA, codeB);
	}

	// A compound given name ("MARY FRANCIS", "JAMES F", "WILLIAM ANDERSON")
	// must compare on its FIRST token. normUpper strips whitespace, so
	// "MARTHA J" collapses to "MARTHAJ" and never equals "MARTHA" - not on the
	// nickname table, not on Jaro-Winkler, not on the blocking key. 1,378 AUG
	// mentions (~1% of the corpus) carry a multi-token norm_first_name, and
	// 1,343 of them have a first token that already exists as a simple form,
	// so nearly all of them are silently unreachable today.
	//
	// The trailing tokens are not discarded: a single-letter tail is returned
	// as a middle initial, which the caller can use as corroboration rather
	// than letting it destroy the given-name comparison.
	_classifyGiven(o) {
		const raw = Match.isPresent(o.norm_first_name) ? o.norm_first_name : o.first_name;
		const parts = String(raw == null ? '' : raw).trim().split(/[\s.]+/).filter(Boolean);
		const n = Match.normUpper(parts.length ? parts[0] : '');
		const tail = parts.slice(1).map(t => Match.normUpper(t)).filter(Boolean);
		const extraInitial = tail.length === 1 && tail[0].length === 1 ? tail[0] : '';
		if (!n) return { cls: 'ABSENT', norm: '', initial: '', tail: tail, extraInitial: '' };
		if (n.length === 1) return { cls: 'INITIAL', norm: n, initial: n, tail: tail, extraInitial: extraInitial };
		return { cls: 'FULL', norm: n, initial: n[0], tail: tail, extraInitial: extraInitial };
	}

	_normFullName(s) {
		if (!Match.isPresent(s)) return '';
		return String(s).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
	}
	_normLast(s) { return Match.normUpper(s); }

	_resolveSurname(o) {
		if (Match.isPresent(o.last_name)) return Match.normUpper(o.last_name);
		const full = this._normFullName(o.full_name);
		if (full) { const t = full.split(' '); return Match.normUpper(t[t.length - 1]); }
		return '';
	}

	_initialLetterModifier(letter) {
		const L = Match.normUpper(letter);
		if (!L || !this._firstNameFreq) return 0;
		if (!this._initialFreq) {
			const m = new Map();
			let total = 0;
			for (const [name, cnt] of this._firstNameFreq.entries()) {
				const c = name && name[0];
				if (!c) continue;
				m.set(c, (m.get(c) || 0) + cnt);
				total += cnt;
			}
			m.set('__total__', total || 1);
			this._initialFreq = m;
		}
		const total = this._initialFreq.get('__total__') || 1;
		const share = (this._initialFreq.get(L) || 0) / total;
		if (share >= 0.09) return -15;
		if (share >= 0.06) return -5;
		if (share >= 0.03) return 0;
		if (share >= 0.01) return 5;
		return 15;
	}

	_middleTiebreak(a, b) {
		const ma = Match.normUpper(a.middle_name);
		const mb = Match.normUpper(b.middle_name);
		if (!ma || !mb) return 'NO_DATA';
		if (ma === mb) return 'MATCH';
		if (ma[0] === mb[0] && (ma.length === 1 || mb.length === 1)) return 'MATCH';
		return 'MISMATCH';
	}

	// A non-head whose surname differs from the household head's is living in
	// someone else's household - boarder, servant, farm laborer. Kin absence
	// from that roster carries no information about identity, so the
	// corroboration gate must not treat it as a missing corroboration.
	// Conservative by design: when headship or either surname is unknown it
	// returns false, leaving the gate's previous behavior in place.
	// Multiplier on Lever B sigma for a possibly-heaped age. Returns 1 when the
	// age cannot be computed, is under 20, or does not land on a multiple of 5.
	static _heapFactor(birthRange, censusYear) {
		if (!birthRange || !censusYear) return 1;
		const age = censusYear - Math.round((birthRange[0] + birthRange[1]) / 2);
		if (!(age >= 20)) return 1;
		if (age % 10 === 0) return 1.35;   // strongest pile-up
		if (age % 5 === 0)  return 1.20;
		return 1;
	}

	// Does the candidate's household have its spouse slot occupied by someone
	// who is clearly NOT the person's known spouse? ctx.personKin entries may
	// carry a _predicate ('isSpouseOf'); without it nothing fires, so callers
	// that do not label kin are unaffected.
	_spouseContradiction(ctx, censusYear) {
		const none = { fired: false, strength: 0 };
		const kin = Array.isArray(ctx.personKin) ? ctx.personKin : [];
		const roster = Array.isArray(ctx.candidateHousehold) ? ctx.candidateHousehold : [];
		if (!kin.length || !roster.length) return none;

		const spouses = kin.filter(k => k && String(k._predicate || '') === 'isSpouseOf');
		if (!spouses.length) return none;

		// A spouse already dead by this year cannot be expected in the roster,
		// and remarriage is then the expected outcome rather than a red flag.
		const alive = spouses.filter(sp => {
			const d = parseInt(String(sp.death_year || '').match(/\d{4}/) || [], 10);
			return !(Number.isFinite(d) && censusYear && d < censusYear);
		});
		if (!alive.length) return none;

		// The roster's spouse slot: a co-resident adult of the opposite gender
		// to the candidate, close in age. Relationship-to-head is not in the
		// data, so this is inferred.
		let worst = none;
		for (const sp of alive) {
			const spg = this._gender(sp), spy = this._birthYear(sp);
			if (!spg) continue;
			for (const r of roster) {
				if (this._gender(r) !== spg) continue;
				const ry = this._birthYear(r);
				if (ry == null || censusYear == null) continue;
				if (censusYear - ry < 16) continue;                 // not an adult
				if (spy != null && Math.abs(ry - spy) > 15) continue; // wrong generation
				const ns = this.MatchName(sp, r);
				if (ns >= 0.6) return none;   // the slot IS our spouse: no contradiction
				const ageOff = spy != null ? Math.min(1, Math.abs(ry - spy) / 12) : 0.5;
				const strength = Match.clamp((1 - ns) * (0.5 + 0.5 * ageOff), 0, 1);
				if (strength > worst.strength) {
					worst = { fired: true, strength, occupant: r, expected: sp, nameScore: +ns.toFixed(3) };
				}
			}
		}
		return worst;
	}

	// 'AGREE' | 'DISAGREE' | 'NA'. Reads an explicit middle_name and the tail of
	// a compound given name, so "Martha J Crawford" and "Martha Crawford" with
	// middle_name "J" both yield J.
	_middleInitial(o) {
		if (!o) return '';
		const mid = Match.normUpper(o.middle_name);
		if (mid) return mid[0];
		const g = this._classifyGiven(o);
		return g && g.extraInitial ? g.extraInitial[0] : '';
	}
	_middleInitialState(a, b) {
		const x = this._middleInitial(a), y = this._middleInitial(b);
		if (!x || !y) return 'NA';
		return x === y ? 'AGREE' : 'DISAGREE';
	}

	_sourceYear(o, fallbackSource) {
		if (!o) return null;
		const direct = parseInt(o.source_year, 10);
		if (Number.isFinite(direct)) return direct;
		const m = String(o.source || fallbackSource || '').match(/(1[6-9]\d{2}|20\d{2})/);
		return m ? parseInt(m[1], 10) : null;
	}

	static isBoarder(mention, roster) {
		if (!mention || !Array.isArray(roster) || !roster.length) return false;
		const isHead = h => h === true || String(h).trim().toLowerCase() === 't' ||
		                    String(h).trim().toLowerCase() === 'true';
		if (isHead(mention.head)) return false;
		let head = null;
		for (const r of roster) { if (isHead(r.head)) { head = r; break; } }
		if (!head) return false;
		const a = Match.normUpper(mention.last_name), b = Match.normUpper(head.last_name);
		if (!a || !b) return false;
		return a !== b;
	}

	_hasName(o) {
		if (!o) return false;
		return Match.isPresent(o.first_name) || Match.isPresent(o.norm_first_name) ||
		       Match.isPresent(o.last_name) || Match.isPresent(o.full_name);
	}

	// =======================================================================
	// CROSS-CENSUS PERSON MATCHING helpers
	// =======================================================================
	_gender(o) {
		const g = String((o && o.gender) || '').split(':')[0].trim().toUpperCase();
		return (g === 'M' || g === 'MALE') ? 'M' : (g === 'F' || g === 'FEMALE') ? 'F' : '';
	}
	_race(o) {
		return String((o && (o.norm_race || o.race)) || '').split(':')[0].trim().toUpperCase();
	}
	// Race CLASS for knockout purposes. Collapses Black<->Mulatto (and common
	// synonyms) into a single non-white class, because B<->M reclassification
	// across enumerations is routine and must not veto a true match. White stays
	// separate; other codes (I, C, Y, ...) compare as-is.
	_raceClass(o) {
		const r = String((o && (o.norm_race || o.race)) || '').split(':')[0].trim().toUpperCase().replace(/[^A-Z]/g, '');
		if (!r) return '';
		if (r === 'W' || r === 'WHITE') return 'W';
		if (r === 'B' || r === 'BLACK' || r === 'M' || r === 'MU' || r === 'MULATTO' || r === 'NEGRO' || r === 'COLORED') return 'BLACK';
		return r;
	}
	_birthYear(o) {
		const v = String((o && o.birth_year != null) ? o.birth_year : '').split(':')[0].trim();
		const n = parseInt(v, 10);
		return Number.isFinite(n) ? n : null;
	}
	// Normalized birth place for EXACT matching. Prefers a norm_birth_place
	// column if present, else birth_place. Case/whitespace-insensitive, trailing
	// punctuation dropped; otherwise compared verbatim. Returns '' when absent.
	_birthPlace(o) {
		const raw = (o && (o.norm_birth_place != null && String(o.norm_birth_place).trim() !== '')) ? o.norm_birth_place
			: (o && o.birth_place != null) ? o.birth_place : '';
		let s = String(raw).split(':')[0].trim();
		if (!s || s.toLowerCase() === 'null') return '';
		return s.toUpperCase().replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();
	}
	// Normalized occupation CATEGORY for boost-only agreement. norm_occupation
	// holds coarse categories (DOMESTIC, AGRICULTURE, LABORER, ...). Blank / null
	// / configured boilerplate => '' (neutral). Compared verbatim after
	// case/whitespace normalization.
	_normOccupation(o, boilerplate) {
		const raw = (o && (o.norm_occupation != null && String(o.norm_occupation).trim() !== '')) ? o.norm_occupation
			: (o && o.occupation != null) ? o.occupation : '';
		let s = String(raw).split(':')[0].trim();
		if (!s || s.toLowerCase() === 'null') return '';
		s = s.toUpperCase().replace(/\s+/g, ' ').trim();
		if (boilerplate && boilerplate.has(s)) return '';
		return s;
	}

	// --- Lever C — household / family continuity (noisy-OR support) ---------
	// Matches each anchor member to at most one candidate member by name
	// (>= nameThreshold) + birth-year gap + non-disagreeing gender. Each matched
	// relative yields a quality h_k in [0,1]; support is aggregated as a noisy-OR
	//   H = 1 - prod(1 - h_k)
	// so one strong corroborating relative already moves H substantially, with
	// diminishing returns and saturation toward 1. The legacy linear `score`
	// (+0.5/member, cap 2.0) is retained for backward compatibility only.
	scoreHousehold(anchorMembers, candidateMembers, opts = {}) {
		const maxGap = opts.birthGap != null ? opts.birthGap : 3;
		const nameThreshold = opts.nameThreshold != null ? opts.nameThreshold : 0.6;
		const aM = (anchorMembers || []).filter(Boolean);
		const cM = (candidateMembers || []).filter(Boolean);
		const used = new Set();
		const matched = [];
		const qualities = [];
		for (const am of aM) {
			let best = null, bestRank = 0, bestIdx = -1, bestQ = 0;
			for (let i = 0; i < cM.length; i++) {
				if (used.has(i)) continue;
				const cm = cM[i];
				const ga = this._gender(am), gc = this._gender(cm);
				if (ga && gc && ga !== gc) continue;
				const ay = this._birthYear(am), cy = this._birthYear(cm);
				const gap = (ay != null && cy != null) ? Math.abs(ay - cy) : null;
				if (gap != null && gap > maxGap) continue;
				const ns = this.MatchName(am, cm);
				if (ns < nameThreshold) continue;
				const birthAgree = (gap != null) ? (1 - gap / (maxGap + 1)) : 0.5;
				const rank = ns + birthAgree;                 // 0..2, ranking only
				if (rank > bestRank) {
					bestRank = rank; best = cm; bestIdx = i;
					bestQ = Match.clamp(0.5 * ns + 0.5 * birthAgree, 0, 1);
				}
			}
			if (best) { used.add(bestIdx); matched.push({ anchor: am, candidate: best }); qualities.push(bestQ); }
		}
		let prod = 1;
		for (const q of qualities) prod *= (1 - q);
		const H = 1 - prod;
		const score = Math.min(2.0, matched.length * 0.5);
		return { score, H, qualities, matched, count: matched.length, fired: matched.length >= 1 };
	}

	// --- rank a later-census pool against one anchor ----------------------
	rankCensusCandidates(anchor, pool, opts = {}) {
		const window = opts.birthWindow != null ? opts.birthWindow : 10;
		const ay = this._birthYear(anchor);
		const ag = this._gender(anchor);
		const ar = this._raceClass(anchor);
		const anchorHH = opts.anchorHousehold || [];
		const households = opts.households || null;
		const out = [];
		for (const cand of pool) {
			if (cand === anchor) continue;
			if (ag) { const cg = this._gender(cand); if (cg && cg !== ag) continue; }
			if (ar) { const cr = this._raceClass(cand); if (cr && ar && cr !== ar) continue; }
			if (ay != null) { const cy = this._birthYear(cand); if (cy != null && Math.abs(cy - ay) > window) continue; }
			let candHH = [];
			if (households) {
				const h = String(cand.household_id || '').trim();
				if (h && households.has(h)) candHH = households.get(h).filter((m) => m !== cand);
			}
			const censusYear = opts.censusYear != null ? opts.censusYear : (parseInt(cand.source_year, 10) || null);
			const res = this.MatchPerson(anchor, cand, {
				censusYear,
				personKin: anchorHH,
				candidateHousehold: candHH,
				householdOpts: opts.householdOpts,
				householdBoost: opts.householdBoost,
				weights: opts.weights,
				birthProfiles: opts.birthProfiles,
				targetSource: opts.targetSource,
				candidateSource: opts.candidateSource,
			});
			if (res.tier === 'KNOCKOUT') continue;
			out.push(Object.assign({ candidate: cand }, res));
		}
		out.sort((x, y) => y.score - x.score);
		return out;
	}

	// =======================================================================
	// PROBABILITY CALIBRATION  (features = [name, birth, H, surnameReliability])
	//   surnameReliability lets probability see how trustworthy the surname match
	//   is - the signal the old [name, birth, H] vector was blind to. Margin
	//   (winner - runner-up) is a CALLER-level signal (it needs the full candidate
	//   set) and is deliberately NOT in this per-pair vector; put it in the caller's
	//   MATCH/MAYBE bucketing instead. When you change this list, update the
	//   caller's labeled-pair export in the same commit or every fitted model
	//   silently misaligns (probability() throws on length mismatch, swallowed).
	// =======================================================================
	_calibFeatures(res) {
		if (Array.isArray(res)) return res.slice();
		const w = (res && res.why) ? res.why : null;
		const A = w ? (w.name || 0) : (res.name != null ? res.name : 0);
		const B = w ? (w.birth || 0) : (res.birth != null ? res.birth : 0);
		const C = w ? (w.family || 0) : (res.family != null ? res.family : 0);
		let R;
		if (w && w.surnameReliability != null) R = w.surnameReliability;
		else R = this._surnameReliability(w ? w.surnameKind : res.surnameKind);
		return [A || 0, B || 0, Math.min(1, C || 0), R != null ? R : 0.5];
	}

	fitCalibration(rows, opts = {}) {
		const lambda = opts.lambda != null ? opts.lambda : 1e-3;
		const lr = opts.lr != null ? opts.lr : 0.1;
		const epochs = opts.epochs != null ? opts.epochs : 3000;
		const X = [], y = [];
		for (const r of (rows || [])) {
			const f = r.features ? r.features.slice() : this._calibFeatures(r.res || r);
			if (!f || !f.length) continue;
			X.push(f); y.push(r.label ? 1 : 0);
		}
		const n = X.length, d = n ? X[0].length : 0;
		if (n < 2 || d === 0) throw new Error('fitCalibration: need >=2 labeled rows with features');
		const pos = y.reduce((a, v) => a + v, 0);
		const mean = new Array(d).fill(0), std = new Array(d).fill(0);
		for (const row of X) for (let j = 0; j < d; j++) mean[j] += row[j];
		for (let j = 0; j < d; j++) mean[j] /= n;
		for (const row of X) for (let j = 0; j < d; j++) std[j] += (row[j] - mean[j]) ** 2;
		for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j] / n) || 1;
		const Z = X.map((row) => row.map((v, j) => (v - mean[j]) / std[j]));
		const w = new Array(d).fill(0);
		let b = 0;
		const sig = (t) => 1 / (1 + Math.exp(-t));
		for (let e = 0; e < epochs; e++) {
			const gw = new Array(d).fill(0);
			let gb = 0;
			for (let i = 0; i < n; i++) {
				let t = b;
				for (let j = 0; j < d; j++) t += w[j] * Z[i][j];
				const err = sig(t) - y[i];
				gb += err;
				for (let j = 0; j < d; j++) gw[j] += err * Z[i][j];
			}
			b -= lr * (gb / n);
			for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / n + lambda * w[j]);
		}
		let ll = 0;
		for (let i = 0; i < n; i++) {
			let t = b;
			for (let j = 0; j < d; j++) t += w[j] * Z[i][j];
			const p = Math.min(1 - 1e-12, Math.max(1e-12, sig(t)));
			ll += -(y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p));
		}
		ll /= n;
		const rawW = w.map((wj, j) => wj / std[j]);
		let rawB = b;
		for (let j = 0; j < d; j++) rawB -= w[j] * mean[j] / std[j];
		this._calib = { w, b, mean, std, d, n, positives: pos, lambda, logloss: ll, rawW, rawB };
		return this._calib;
	}

	probability(input) {
		if (!this._calib) return null;
		const f = Array.isArray(input) ? input : this._calibFeatures(input);
		const c = this._calib;
		if (f.length !== c.d) throw new Error('probability: feature length ' + f.length + ' != ' + c.d);
		let t = c.b;
		for (let j = 0; j < c.d; j++) t += c.w[j] * ((f[j] - c.mean[j]) / c.std[j]);
		return 1 / (1 + Math.exp(-t));
	}

	reliability(rows, bins = 10) {
		const preds = [];
		for (const r of (rows || [])) {
			const f = r.features ? r.features : this._calibFeatures(r.res || r);
			preds.push({ p: this.probability(f), y: r.label ? 1 : 0 });
		}
		const out = [];
		for (let k = 0; k < bins; k++) {
			const lo = k / bins, hi = (k + 1) / bins;
			const inb = preds.filter((x) => x.p >= lo && (k === bins - 1 ? x.p <= hi + 1e-9 : x.p < hi));
			if (!inb.length) { out.push({ lo, hi, n: 0, meanPred: null, empirical: null }); continue; }
			const meanPred = inb.reduce((a, x) => a + x.p, 0) / inb.length;
			const empirical = inb.reduce((a, x) => a + x.y, 0) / inb.length;
			out.push({ lo, hi, n: inb.length, meanPred, empirical });
		}
		return out;
	}

	// =======================================================================
	// PERSON <-> MENTION MATCHING
	//   name + birth form the base identity score; household is a noisy-OR boost.
	//   gender / race-class / death-before-census / out-of-profile birth gap are
	//   KNOCKOUTS. A lever with no data is EXCLUDED (its weight redistributes).
	// =======================================================================
	MatchPerson(person, mention, ctx = {}) {
		const censusYear = ctx.censusYear != null ? ctx.censusYear : (parseInt(mention.source_year, 10) || null);
		const W0 = Object.assign({ name: 0.40, birth: 0.30 }, ctx.weights || {});
		const corroboration = ctx.corroboration != null ? ctx.corroboration : 0;
		const BETA = ctx.householdBoost != null ? ctx.householdBoost : 0.6;
		// Birthplace (exact match) tunables. Absent field => no-op.
		const BP_BOOST = ctx.birthplaceBoost != null ? ctx.birthplaceBoost : 0.15;      // exact agreement raises residual gap
		const BP_PENALTY = ctx.birthplacePenalty != null ? ctx.birthplacePenalty : 0.15; // disagreement softly lowers score
		const BP_KNOCKOUT = ctx.birthplaceKnockout === true;                            // opt-in hard veto on disagreement
		// Occupation (norm_occupation) tunables. Minor valence, BOOST-ONLY: category
		// agreement nudges up; disagreement/blank is neutral (occupation drifts over
		// a decade, so a mismatch is not evidence against a match). No-op if absent.
		const OCC_BOOST = ctx.occupationBoost != null ? ctx.occupationBoost : 0.05;
		// Corroboration gate: a needsCorroboration name rung with NO corroborating
		// evidence takes this subtractive penalty. Set to 0 to restore the previous
		// diagnostic-only behavior exactly.
		const CORROB_PENALTY = ctx.corroborationPenalty != null ? ctx.corroborationPenalty : 0.15;
		const OCC_BOILERPLATE = ctx.occupationBoilerplate
			? new Set(ctx.occupationBoilerplate.map((x) => String(x).toUpperCase().trim()))
			: null;
		const ko = (reason) => ({ score: 0, tier: 'KNOCKOUT', reason, firedLevers: [], why: null });

		// Birth profiles: sigma loosened for 1850/1860 age-report noise.
		const PROFILES = ctx.birthProfiles || {
			CENSUS_CENSUS: { sigma: 3.0, knockout: 12 },
			SCHEDULE_INVOLVED: { sigma: 3.5, knockout: 12 },
		};

		const range = (v) => { if (v == null) return null; const n = String(v).match(/\d{3,4}/g); if (!n) return null; const y = n.map(Number); return [Math.min(...y), Math.max(...y)]; };
		const isSchedule = (o, src) => /(-SS-|SLAVE)/i.test(String((o && o.source) || src || ''));

		// --- KNOCKOUTS: gender / race-class / death-before-census ---
		const gp = this._gender(person), gm = this._gender(mention);
		if (gp && gm && gp !== gm) return ko('GENDER_DISAGREE');
		const rp = this._raceClass(person), rm = this._raceClass(mention);
		if (rp && rm && rp !== rm) return ko('RACE_DISAGREE');
		const death = range(person.death_year);
		if (death && censusYear && death[1] < censusYear) return ko('DIED_BEFORE_CENSUS');

		// ===== LEVER A: name (gender-aware) =====
		const nd = this.matchNameDetail(person, mention);
		let A = nd.score;
		const gender = gp || gm, surnameFired = nd.surnameStrength >= 0.8, bothLast = person.last_name && mention.last_name;
		if (gender === 'F' && surnameFired) A = Math.min(1, A + 0.05);
		else if (gender === 'M' && !surnameFired && bothLast && nd.surnameStrength === 0) A = Math.min(A, 0.3);

		// MIDDLE INITIAL. _classifyGiven already extracts a trailing initial
		// from a compound given name ("MARTHA J" -> MARTHA + J) and middle_name
		// carries one directly. Two records agreeing on it are more likely the
		// same person than two agreeing on the given name alone; two that
		// disagree are weak evidence against, but only weak - enumerators drop
		// middle initials constantly, and a person may use different ones.
		// Absence on either side is neutral.
		const midState = this._middleInitialState(person, mention);
		if (midState === 'AGREE') A = Math.min(1, A + 0.05);
		else if (midState === 'DISAGREE') A = Math.max(0, A - 0.05);
		const aAvailable = this._hasName(person) && this._hasName(mention);

		// ===== LEVER B: profile-aware smooth birth agreement =====
		const profile = (isSchedule(person, ctx.targetSource) || isSchedule(mention, ctx.candidateSource)) ? 'SCHEDULE_INVOLVED' : 'CENSUS_CENSUS';
		const prof = PROFILES[profile] || PROFILES.CENSUS_CENSUS;
		const bp = range(person.birth_year), bm = range(mention.birth_year);
		let bAvailable = false, B = 0, gap = null;
		let sigma = prof.sigma, knockout = prof.knockout, heaped = null, intervalScale = 1;
		if (bp && bm) {
			bAvailable = true;
			gap = (bm[0] > bp[1]) ? bm[0] - bp[1] : (bp[0] > bm[1]) ? bp[0] - bm[1] : 0;

			// AGE HEAPING. Self-reported census ages pile up on multiples of 5
			// and 10. Measured on AUG-CN-1870, ages 20-70, the last digit of the
			// reported age is 0 for 19.5% of people and 5 for 14.1%, against 10%
			// expected for each - a Whipple index near 168, "rough" by
			// demographic standards. An age landing on 0 or 5 is therefore much
			// more likely to have been rounded, so the birth year it implies
			// carries more error and Lever B should be correspondingly less
			// confident. Only adults are affected: children's ages are usually
			// reported by a parent who knows them, and heaping is negligible
			// below about 20.
			heaped = Match._heapFactor(bp, censusYear) * Match._heapFactor(bm, censusYear);
			sigma = sigma * heaped;

			// INTERVAL SCALING. Reporting drift accumulates with the time
			// between the two records: Arch Crawford is born 1835 by the 1870
			// census and 1840 by the 1880 one, five years of drift across one
			// decade. A single sigma for a 10-year and a 30-year separation
			// under-forgives the wide one. Grows as sqrt(decades), since the
			// drift behaves like accumulated independent error rather than a
			// steady trend.
			const ySelf = this._sourceYear(person, ctx.targetSource);
			const yCand = this._sourceYear(mention, ctx.candidateSource) || censusYear;
			if (ySelf && yCand) {
				const decades = Math.abs(yCand - ySelf) / 10;
				intervalScale = Math.max(1, Math.sqrt(Math.max(decades, 1)));
				sigma = sigma * intervalScale;
			}

			// The knockout widens with sigma too, or a legitimately drifted pair
			// is thrown out before it can be scored.
			knockout = Math.max(prof.knockout, Math.round(prof.knockout * (sigma / prof.sigma)));
			if (gap > knockout) return ko('BIRTH_GAP_' + gap + '(' + profile + ')');
			B = Math.exp(-(gap * gap) / (2 * sigma * sigma));
		}

		// ===== LEVER C: household / family continuity (noisy-OR support) =====
		let C = { score: 0, H: 0, qualities: [], count: 0, matched: [], fired: false }, cAvailable = false;
		if (ctx.personKin && ctx.personKin.length && ctx.candidateHousehold && this.scoreHousehold) {
			cAvailable = true;
			C = this.scoreHousehold(ctx.personKin, ctx.candidateHousehold, ctx.householdOpts);
		}

		// CONTRADICTION. Lever C only ever adds: a candidate whose household
		// holds none of the expected kin scores the same as one with no
		// household at all. But those are different findings. Kin ABSENCE is
		// usually uninformative - people board out, families split, a wife dies.
		// Kin CONTRADICTION is not: if this person's wife is Martha b.1840 and
		// the candidate is a head living with a wife named Sarah b.1852, the
		// slot is filled by someone else and that is evidence against identity,
		// not merely evidence missing.
		//
		// Only spouse slots are checked. A missing or replaced child is far too
		// common to read as contradiction (children die, are fostered out, or
		// were simply born later), whereas a co-resident spouse is a single
		// occupancy that two different women cannot both hold at one census.
		// Remarriage after a death is exactly why this is a soft penalty rather
		// than a knockout, and why it is suppressed when the person's own
		// records show the spouse could already have died.
		const contradiction = this._spouseContradiction(ctx, censusYear);
		if (contradiction.fired) {
			// Applied to the household term so it cannot fire alongside a
			// household boost for the same slot.
			C = Object.assign({}, C, { contradiction: contradiction });
		}
		const H = cAvailable ? C.H : 0;

		// ===== LEVER P: birth place (EXACT match) =====
		// Compared verbatim after case/whitespace normalization. Agreement is a
		// residual-gap boost; disagreement is a soft penalty (or, opt-in, a
		// hard knockout). Absent on either side => neutral (no effect), so this
		// is a complete no-op until the birth_place column exists in the data.
		const pPlace = this._birthPlace(person), mPlace = this._birthPlace(mention);
		const pAvailable = !!(pPlace && mPlace);
		let placeState = 'NA', placeAgree = null;
		if (pAvailable) {
			placeAgree = (pPlace === mPlace);
			placeState = placeAgree ? 'AGREE' : 'DISAGREE';
			if (!placeAgree && BP_KNOCKOUT) return ko('BIRTHPLACE_DISAGREE');
		}

		// ===== LEVER O: occupation category (BOOST-ONLY, minor) =====
		// Same norm_occupation category on both sides => small boost. Disagreement
		// and blanks are neutral (occupation drifts across a decade). No-op if absent.
		const pOcc = this._normOccupation(person, OCC_BOILERPLATE), mOcc = this._normOccupation(mention, OCC_BOILERPLATE);
		const occAvailable = !!(pOcc && mOcc);
		const occAgree = occAvailable ? (pOcc === mOcc) : null;
		const occState = !occAvailable ? 'NA' : (occAgree ? 'AGREE' : 'DISAGREE');

		// ===== COMBINE: base identity (name+birth), birthplace, THEN residual boosts =====
		// S0 = weighted(name, birth), redistributed if one lever is absent.
		// Birthplace-agree, household, and occupation-agree are noisy-OR boosts on the
		// residual gap (raise only, never drag). Birthplace disagreement applies a
		// soft penalty; occupation never penalizes.
		let wA = aAvailable ? W0.name : 0;
		let wB = bAvailable ? W0.birth : 0;
		const wBase = (wA + wB) || 1;
		let S0 = (wA / wBase) * A + (wB / wBase) * B;
		if (placeState === 'AGREE') S0 = S0 + BP_BOOST * (1 - S0);
		else if (placeState === 'DISAGREE') S0 = Math.max(0, S0 - BP_PENALTY);
		let rawScore = S0 + BETA * H * (1 - S0);
		if (occState === 'AGREE') rawScore = rawScore + OCC_BOOST * (1 - rawScore);
		// Soft, proportional to how badly the occupant fits: a wife of the right
		// name but wrong age is a weaker contradiction than a different name.
		const CONTRA_PENALTY = ctx.contradictionPenalty != null ? ctx.contradictionPenalty : 0.20;
		if (C.contradiction && C.contradiction.fired && CONTRA_PENALTY > 0) {
			rawScore = Math.max(0, rawScore - CONTRA_PENALTY * C.contradiction.strength);
		}
		// Corroboration gate (second downward soft signal). Fires only when the name
		// rung is marked needsCorroboration AND nothing corroborated the pair:
		// household did not fire, birthplace is not AGREE, occupation is not AGREE.
		// It never fires for EXACT_FIRST_SURNAME (literal-identical given), and since
		// it only subtracts when no boost was applied it never interacts with a boost.
		const corroborated = C.fired || placeState === 'AGREE' || occState === 'AGREE' ||
		                     midState === 'AGREE';
		// The gate must only fire when corroboration was POSSIBLE. As written it
		// never asked, so it subtracted 0.15 whenever a channel was merely
		// unavailable, which inverts the evidence in two common situations:
		//
		//   1. The candidate is a boarder. Arch Crawford in 1870 is a lone Black
		//      farm laborer inside the white Dalhouse household, so his wife and
		//      children are correctly absent from that roster - that IS what the
		//      right record looks like. Penalizing it dropped his true 1870
		//      record from rank 1 to rank 6, below the default floor.
		//   2. No kin are known yet. Early in a tree nobody has relatives, so the
		//      household channel cannot fire for anyone and every
		//      needsCorroboration rung takes a blanket -0.15.
		//
		// A channel counts as available only if it could actually have produced
		// agreement: household needs kin AND a roster AND a candidate who lives
		// with their own family; birthplace and occupation need both sides
		// populated (placeState/occState are 'NA' when they are not).
		const corroborationChannels = {
			household:  (Array.isArray(ctx.personKin) && ctx.personKin.length > 0) &&
			            (Array.isArray(ctx.candidateHousehold) && ctx.candidateHousehold.length > 0) &&
			            !Match.isBoarder(mention, ctx.candidateHousehold),
			birthplace: placeState !== 'NA',
			occupation: occState !== 'NA',
			middleInitial: midState !== 'NA'
		};
		const corroborationPossible = corroborationChannels.household ||
		                              corroborationChannels.birthplace ||
		                              corroborationChannels.occupation ||
		                              corroborationChannels.middleInitial;
		let corroborationGate = false;
		if (nd.needsCorroboration && !corroborated && corroborationPossible && CORROB_PENALTY > 0) {
			rawScore = Math.max(0, rawScore - CORROB_PENALTY);
			corroborationGate = true;
		}
		const score = Math.max(0, Math.min(1, rawScore + corroboration));

		// tier reflects the CORE identity levers (name/birth/birthplace/family);
		// occupation is minor and is listed but does not inflate the tier.
		const fired = [];
		if (aAvailable && nd.rung !== 'SURNAME_ONLY' && A >= 0.4) fired.push('name');
		if (bAvailable && B >= 0.4) fired.push('birth');
		if (placeState === 'AGREE') fired.push('birthplace');
		if (C.fired) fired.push('family');
		const tier = fired.length >= 3 ? 'STRONG' : fired.length === 2 ? 'SUPPORTED' : fired.length === 1 ? 'PROVISIONAL' : 'WEAK';
		if (occState === 'AGREE') fired.push('occupation');

		const sRel = this._surnameReliability(nd.surnameKind);

		const out = {
			score, tier, firedLevers: fired, reason: null,
			weights: { name: +(wA / wBase).toFixed(3), birth: +(wB / wBase).toFixed(3), householdBoost: BETA },
			why: {
				name: +A.toFixed(3), birth: +B.toFixed(3), family: +H.toFixed(3),
				householdH: +H.toFixed(3), boost: BETA,
				base: +S0.toFixed(3),
				rung: nd.rung, surnameKind: nd.surnameKind, surnameReliability: +sRel.toFixed(3),
				needsCorroboration: !!nd.needsCorroboration, corroborationGate,
				birthGap: gap, birthProfile: profile, familyCount: C.count,
				birthplace: placeState, birthplaceAgree: placeAgree,
				birthPlacePerson: pPlace || '', birthPlaceMention: mPlace || '',
				occupation: occState, occupationAgree: occAgree, occupationBoost: OCC_BOOST,
				occupationPerson: pOcc || '', occupationMention: mOcc || '',
				familyMatches: C.matched.map((m) => { const p = m.candidate, yr = (range(p.birth_year) || [''])[0]; return (p.full_name || `${p.first_name || ''} ${p.last_name || ''}`).trim() + (yr ? `-${yr}` : ''); }),
				middleInitial: midState,
				contradiction: (C.contradiction && C.contradiction.fired) ? {
					strength: +C.contradiction.strength.toFixed(3),
					expected: C.contradiction.expected && C.contradiction.expected.full_name,
					occupant: C.contradiction.occupant && C.contradiction.occupant.full_name,
					nameScore: C.contradiction.nameScore
				} : null,
				birthSigma: +sigma.toFixed(2), birthKnockout: knockout,
				heapFactor: heaped != null ? +heaped.toFixed(2) : null,
				intervalScale: +intervalScale.toFixed(2),
				corroboration, corroborationPossible, corroborationChannels,
				available: { name: aAvailable, birth: bAvailable, birthplace: pAvailable, occupation: occAvailable, household: cAvailable },
			},
		};
		if (this._calib && this.probability) { try { out.probability = this.probability([A, B, H, sRel]); } catch (e) { /* feature mismatch */ } }
		return out;
	}

	// --- name-only calibration (1-D Platt scaling of MatchName scores) ------
	fitNameCalibration(rows, opts = {}) {
		const lr = opts.lr != null ? opts.lr : 0.5;
		const epochs = opts.epochs != null ? opts.epochs : 4000;
		const lambda = opts.lambda != null ? opts.lambda : 1e-4;
		const xs = [], ys = [];
		for (const r of (rows || [])) { const s = Number(r.score); if (!Number.isFinite(s)) continue; xs.push(s); ys.push(r.label ? 1 : 0); }
		const n = xs.length;
		if (n < 2) throw new Error('fitNameCalibration: need >=2 labeled rows');
		const mean = xs.reduce((a, v) => a + v, 0) / n;
		const sd = Math.sqrt(xs.reduce((a, v) => a + (v - mean) ** 2, 0) / n) || 1;
		let w = 0, b = 0;
		const sig = (t) => 1 / (1 + Math.exp(-t));
		for (let e = 0; e < epochs; e++) {
			let gw = 0, gb = 0;
			for (let i = 0; i < n; i++) { const z = (xs[i] - mean) / sd; const err = sig(b + w * z) - ys[i]; gb += err; gw += err * z; }
			b -= lr * (gb / n); w -= lr * (gw / n + lambda * w);
		}
		let ll = 0;
		for (let i = 0; i < n; i++) { const p = Math.min(1 - 1e-12, Math.max(1e-12, sig(b + w * ((xs[i] - mean) / sd)))); ll += -(ys[i] * Math.log(p) + (1 - ys[i]) * Math.log(1 - p)); }
		const A = w / sd, B = b - w * mean / sd;
		this._nameCalib = { w, b, mean, sd, n, positives: ys.reduce((a, v) => a + v, 0), logloss: ll / n, A, B };
		return this._nameCalib;
	}

	nameProbability(score) {
		if (!this._nameCalib) return null;
		const c = this._nameCalib;
		return 1 / (1 + Math.exp(-(c.b + c.w * ((Number(score) - c.mean) / c.sd))));
	}
}

// Export for both browser global and Node.
if (typeof window !== 'undefined') window.Match = Match;
if (typeof module !== 'undefined' && module.exports) module.exports = { Match };
