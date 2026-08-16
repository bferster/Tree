// match.js
// ---------------------------------------------------------------------------
// Match — standalone name-comparison primitives.
//
// Collects the three name-matching capabilities the scoring pipeline needs:
//   1. nickname / canonical-name resolution
//   2. Jaro-Winkler string similarity
//   3. name-rarity weighting
//
// No external dependencies — does not require score.js, Normalize, or any
// module. Everything is inline. Tunables (rarity thresholds, extra nickname
// pairs) can be supplied through the constructor.
//
// NOTE ON PROVENANCE: score.js contained no nickname data of its own — it only
// called Normalize.getNickname(). The NICKNAMES table below is transcribed in
// full from Normalize.md (the project's authoritative source). Likewise the
// rarity buckets and the Jaro-Winkler contract (case-insensitive, no external
// deps) follow the algorithms specified in Normalize.md.
// ---------------------------------------------------------------------------

// Rarity thresholds + modifiers (Fellegi-Sunter name weighting, per Normalize.md):
//   Count <= 5  (Very Rare):        +15
//   Count <= 20 (Uncommon):          +5
//   Count 21-100 (Average):           0
//   Count 101-500 (Common):          -5
//   Count > 500 (Extremely Common): -15
// The *Max fields are the inclusive upper bound of each bucket.
const DEFAULT_RARITY = {
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

// Below this Jaro-Winkler score a "Fuzzy" name match is treated as ~zero rather
// than a small positive (jwFuzzyPassThreshold in score.js).
const DEFAULT_JW_FUZZY_PASS = 0.85;

// Nickname -> canonical map, transcribed in full from the NICKNAMES object in
// Normalize.md. Direction is nickname -> full name ("BILL" -> "WILLIAM").
//
// KNOWN DUPLICATE KEYS (JS object literal = last-wins, matching how the source
// object evaluates): "ED" resolves to EDMUND (a later entry) although the
// source comments note EDWARD was the intended winner; "KIT" resolves to
// CATHERINE (shadowing CHRISTOPHER); "SUSY" resolves to SUSANNAH (shadowing
// SUSAN). Reassign any of these via `new Match({ nicknames: { ED: 'EDWARD' } })`.
const DEFAULT_NICKNAMES = {
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

	// Edmund  (NOTE: "ED" here overrides the Edward entry above under last-wins)
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

	// Catherine / Katherine  (NOTE: "KIT" here overrides the Christopher entry)
	"KATE": "CATHERINE", "KATIE": "CATHERINE", "KIT": "CATHERINE",
	"KITTY": "CATHERINE", "KATH": "CATHERINE",

	// Sarah
	"SARA": "SARAH", "SALLY": "SARAH", "SAL": "SARAH",

	// Susan / Susannah  (NOTE: "SUSY" here overrides the Susan entry)
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

	// Phillis / Phyllis (common in enslaved records)
	"PHILLIS": "PHYLLIS",

	// Minerva
	"MINNIE": "MINERVA",

	// -----------------------------------------------------------------------
	// Additions mined from mentions.csv (first-name frequency analysis).
	// These are abbreviations, -ie/-y diminutives, and spelling variants of
	// canonicals already in the table; counts below are occurrences in the
	// 150,827-row mentions set at time of analysis. Ambiguous diminutives
	// (NANCY, JENNIE, NETTIE, HETTIE, MILLIE, PATSY, MAY, MARIAH, ABRAM, ...)
	// were intentionally left out pending a mapping decision — see notes.
	// -----------------------------------------------------------------------

	// abbreviations
	"SAML": "SAMUEL",       // 446
	"ALEXR": "ALEXANDER",   // 10
	"ANDW": "ANDREW",       // 1
	"EDWD": "EDWARD",       // 18
	"JOSH": "JOSHUA",       // 3

	// Elizabeth cluster
	"ELISABETH": "ELIZABETH", // 347
	"BETTIE": "ELIZABETH",    // 529
	"BETSY": "ELIZABETH",     // 257
	"BETSEY": "ELIZABETH",    // 51
	"LIZA": "ELIZABETH",      // 6

	// Sarah cluster
	"SALLIE": "SARAH",      // 709
	"SADIE": "SARAH",       // 29
	"SADY": "SARAH",        // 1

	// Frances cluster
	"FANNIE": "FRANCES",    // 558
	"FRANKIE": "FRANCES",   // 1

	// Ann cluster
	"NANNIE": "ANN",        // 336

	// Mary cluster
	"MOLLIE": "MARY",       // 147

	// Margaret cluster
	"MARGIE": "MARGARET",   // 6
	"MAGGY": "MARGARET",    // 2

	// Catherine cluster
	"CATHARINE": "CATHERINE", // 970
	"KATY": "CATHERINE",      // 13

	// Rachel (spelling variant -> standalone canonical)
	"RACHAEL": "RACHEL",    // 199

	// Susannah cluster
	"SUSANNA": "SUSANNAH",  // 85
	"SUSANAH": "SUSANNAH",  // 43

	// male -ie/-y diminutives
	"JOHNNIE": "JOHN",      // 13
	"JIMMIE": "JAMES",      // 4
	"TOMMIE": "THOMAS",     // 1
	"BILLIE": "WILLIAM",    // 6
	"GEORGIE": "GEORGE",    // 19
	"CHARLEY": "CHARLES",   // 25
	"FREDDIE": "FREDERICK", // 3

	// Ambiguous diminutives — added by explicit decision. Each has plausible
	// alternate canonicals (noted); revisit if false merges appear in ER.
	"NETTIE": "HENRIETTA",  // 114  (alt: Antoinette / Jeannette / Nannette)
	"HETTIE": "HESTER",     // 93   (alt: Henrietta)
	"MILLIE": "MILDRED",    // 81   (alt: Amelia / Millicent / Emily)
	"MAY": "MARY",          // 72   (alt: Margaret; also a standalone name)
	"ABRAM": "ABRAHAM",     // 82   (alt: distinct biblical name, not a variant)
};

// --- small self-contained helpers ---
function isPresent(v) {
	return v !== null && v !== undefined && String(v).trim() !== "" && String(v).trim().toLowerCase() !== "null";
}

function normUpper(s) {
	return isPresent(s) ? String(s).trim().toUpperCase().replace(/[^A-Z]/g, "") : "";
}

function clamp(x, lo, hi) {
	return Math.max(lo, Math.min(hi, x));
}

class Match {

	constructor(config = {}) {
		if (typeof app !== 'undefined') {
			app.match = this;
		}
		// Rarity bucketing config — override individual buckets via the constructor.
		this.rarity = { ...DEFAULT_RARITY, ...(config.rarity || {}) };

		// Threshold governing how Jaro-Winkler results feed fuzzy name matching.
		this.jwFuzzyPassThreshold = (config.jwFuzzyPassThreshold != null)
			? config.jwFuzzyPassThreshold
			: DEFAULT_JW_FUZZY_PASS;

		// Build the nickname -> canonical lookup from the built-in table, then
		// fold in caller additions (same { NICK: 'CANONICAL' } shape). Every
		// canonical also maps to itself so a canonical input is stable. normUpper
		// on keys collapses the placeholder "SUSY_" back onto "SUSY" harmlessly —
		// it exists only so both source lines survive object-literal parsing.
		this._nickToCanon = new Map();
		const tables = [DEFAULT_NICKNAMES, config.nicknames || {}];
		for (const table of tables) {
			for (const nickRaw of Object.keys(table)) {
				const nick = normUpper(nickRaw);
				const canon = normUpper(table[nickRaw]);
				if (!nick || !canon) continue;
				this._nickToCanon.set(nick, canon);
				if (!this._nickToCanon.has(canon)) this._nickToCanon.set(canon, canon);
			}
		}
	}

	// -----------------------------------------------------------------------
	// 1. NICKNAME
	// -----------------------------------------------------------------------

	// Canonical form of a given name, upper-cased and normalized
	// ("Bill"/"Billy"/"Will" -> "WILLIAM"). Unknown names return their own
	// normalized-upper form (treated as already canonical).
	nickname(name) {
		const key = normUpper(name);
		if (!key) return "";
		return this._nickToCanon.get(key) || key;
	}

	// -----------------------------------------------------------------------
	// NYSIIS phonetic encoding
	// -----------------------------------------------------------------------

	getNYSIIS(name) {
		if (!name) return "";
		let n = String(name).toUpperCase().replace(/[^A-Z]/g, '');
		if (!n) return "";

		if (n.startsWith("MAC")) n = "MC" + n.substring(3);
		else if (n.startsWith("KN")) n = "N" + n.substring(2);
		else if (n.startsWith("SCH")) n = "S" + n.substring(3);

		if (n.endsWith("EE") || n.endsWith("IE")) n = n.substring(0, n.length - 2) + "Y";
		else if (n.endsWith("DT") || n.endsWith("RT") || n.endsWith("RD") || n.endsWith("NT") || n.endsWith("ND")) n = n.substring(0, n.length - 2) + "D";

		n = n.replace(/[SA]$/, '');

		const isVowel = c => "AEIOU".includes(c);
		let res = "";

		for (let i = 0; i < n.length; i++) {
			let c = n[i];
			let prev = i > 0 ? n[i - 1] : '';
			let next = i < n.length - 1 ? n[i + 1] : '';

			if (isVowel(c)) c = "A";
			else if (c === "Q") c = "G";
			else if (c === "Z") c = "S";
			else if (c === "M") c = "N";
			else if (c === "P" && next === "H") { c = "F"; i++; }
			else if (c === "K") c = "C";
			else if (c === "H" && (!isVowel(prev) || !isVowel(next))) continue;
			else if (c === "W" && isVowel(prev)) continue;

			if (res.length > 0 && res[res.length - 1] === c) continue;
			res += c;
		}
		return res;
	}

	// -----------------------------------------------------------------------
	// Double Metaphone phonetic encoding
	// -----------------------------------------------------------------------

	getMetaphone(name) {
		if (!name) return "";
		return this.doubleMetaphone(name);
	}

	doubleMetaphone(word) {
		if (!word || typeof word !== "string") return ":";

		// Keep original (for multi-word checks like 'san jose')
		const originalUpper = word.toUpperCase();

		// Uppercase and strip non-alpha characters
		let str = word.toUpperCase().replace(/[^A-Z]/g, "");
		if (str.length === 0) return ":";

		const length = str.length;
		let primary = "";
		let secondary = "";
		let index = 0;

		// Helper: safe character access (returns "" if out of range)
		const charAt = (i) => (i >= 0 && i < str.length ? str[i] : "");

		// Helper: check if a substring at position matches any of the given strings
		const contains = (start, len, ...values) => {
			const sub = str.substring(start, start + len);
			return values.includes(sub);
		};

		// Helper: is character a vowel? (guards against out-of-range empty string)
		const isVowel = (i) => {
			const ch = charAt(i);
			return ch !== "" && "AEIOU".includes(ch);
		};

		// Helper: is character a slavo-germanic indicator present in the word?
		const isSlavoGermanic = () =>
			str.includes("W") ||
			str.includes("K") ||
			str.includes("CZ") ||
			str.includes("WITZ");

		// Helper: add codes to primary and secondary
		const add = (p, s) => {
			primary += p;
			secondary += s !== undefined ? s : p;
		};

		// Handle leading silent letters and special cases
		// Note: PS is also a silent pair (psalm, psycho) but PF is NOT (pfister keeps PF)
		if (contains(0, 2, "AE", "GN", "KN", "PN", "WR", "PS")) {
			index++;
		}

		// Initial vowel maps to "A"
		if (charAt(0) === "A" || isVowel(0)) {
			add("A");
			index++;
		}

		const slavoGermanic = isSlavoGermanic();

		while (index < length) {
			const c = charAt(index);

			switch (c) {
				case "A":
				case "E":
				case "I":
				case "O":
				case "U":
				case "Y":
					// Vowels only coded at start (already handled above); others are skipped
					if (index === 0) add("A");
					index++;
					break;

				case "X":
					// Initial X → S primary, S secondary (Xavier-class words in English).
					// Non-initial X is handled later in this same case.
					if (index === 0) {
						add("S");
						index++;
						break;
					}
					// Non-initial X handled in the dedicated X case below
					if (
						!(index === length - 1 &&
							(contains(index - 3, 3, "IAU", "EAU") ||
								contains(index - 2, 2, "AU", "OU")))
					) {
						add("KS");
					}
					index += contains(index + 1, 1, "C", "X") ? 2 : 1;
					break;

				case "B":
					add("P");
					index += charAt(index + 1) === "B" ? 2 : 1;
					break;

				case "Ç":
					add("S");
					index++;
					break;

				case "C":
					// Germanic ACH rule: previous='A', next='H', no vowel 2 back, not followed by I/E (unless BACHER/MACHER)
					if (
						charAt(index - 1) === "A" &&
						charAt(index + 1) === "H" &&
						charAt(index + 2) !== "I" &&
						!isVowel(index - 2) &&
						(charAt(index + 2) !== "E" ||
							contains(index - 2, 6, "BACHER", "MACHER"))
					) {
						add("K");
						index += 2;
						break;
					}
					// Special case for Caesar
					if (index === 0 && contains(index, 6, "CAESAR")) {
						add("S");
						index += 2;
						break;
					}
					// Italian Chianti
					if (contains(index + 1, 3, "HIA")) {
						add("K");
						index += 2;
						break;
					}
					// CH rules
					if (contains(index, 2, "CH")) {
						// Michael
						if (index > 0 && charAt(index + 2) === "A" && charAt(index + 3) === "E") {
							add("K", "X");
							index += 2;
							break;
						}
						// Greek roots: chemistry, chorus
						if (
							index === 0 &&
							(contains(index + 1, 5, "HARAC", "HARIS") ||
								contains(index + 1, 3, "HOR", "HYM", "HIA", "HEM")) &&
							!contains(0, 5, "CHORE")
						) {
							add("K");
							index += 2;
							break;
						}
						// Germanic/Greek/KH sound
						if (
							contains(0, 4, "VAN ", "VON ") ||
							contains(0, 3, "SCH") ||
							contains(index - 2, 6, "ORCHES", "ARCHIT", "ORCHID") ||
							contains(index + 2, 1, "T", "S") ||
							((contains(index - 1, 1, "A", "O", "U", "E") || index === 0) &&
								/[ BFHLMNRVW]/.test(charAt(index + 2)))
						) {
							add("K");
						} else if (index === 0) {
							add("X");
						} else if (contains(0, 2, "MC")) {
							// McHugh etc.
							add("K");
						} else {
							add("X", "K");
						}
						index += 2;
						break;
					}
					// Czerny
					if (contains(index, 2, "CZ") && !contains(index - 2, 4, "WICZ")) {
						add("S", "X");
						index += 2;
						break;
					}
					// Focaccia (C followed by CIA)
					if (contains(index + 1, 3, "CIA")) {
						add("X", "X");
						index += 3;
						break;
					}
					// Double C, but not McClellan
					if (
						contains(index, 2, "CC") &&
						!(index === 1 && charAt(0) === "M")
					) {
						if (
							contains(index + 2, 1, "I", "E", "H") &&
							!contains(index + 2, 2, "HU")
						) {
							// Accident, Accede, Succeed → KS; Bacci, Bertucci (Italian) → X
							const sub = str.substring(index - 1, index + 4);
							if (
								(index === 1 && charAt(index - 1) === "A") ||
								sub === "UCCEE" ||
								sub === "UCCES"
							) {
								add("KS");
							} else {
								add("X");
							}
							index += 3;
							break;
						} else {
							// Pierce's rule
							add("K");
							index += 2;
							break;
						}
					}
					if (contains(index, 2, "CK", "CG", "CQ")) {
						add("K");
						index += 2;
						break;
					}
					// Italian: CIE / CIO → S primary, X secondary
					if (
						charAt(index + 1) === "I" &&
						(charAt(index + 2) === "E" || charAt(index + 2) === "O")
					) {
						add("S", "X");
						index += 2;
						break;
					}
					// CI / CE / CY → S (both codes)
					if (contains(index, 2, "CI", "CE", "CY")) {
						add("S");
						index += 2;
						break;
					}
					add("K");
					// Skip two extra characters in 'Mac Caffrey', 'Mac Gregor'
					if (contains(index + 1, 2, " C", " Q", " G")) {
						index += 3;
					} else if (
						contains(index + 1, 1, "K", "Q") &&
						!contains(index + 1, 2, "CE", "CI")
					) {
						// CK / CQ – the K and Q are silent
						index += 2;
					} else {
						index++;
					}
					break;

				case "D":
					if (contains(index, 2, "DG")) {
						if (contains(index + 2, 1, "I", "E", "Y")) {
							add("J");
							index += 3;
						} else {
							add("TK");
							index += 2;
						}
						break;
					}
					if (contains(index, 2, "DT", "DD")) {
						add("T");
						index += 2;
					} else {
						add("T");
						index++;
					}
					break;

				case "F":
					add("F");
					index += charAt(index + 1) === "F" ? 2 : 1;
					break;

				case "G":
					if (charAt(index + 1) === "H") {
						if (index > 0 && !isVowel(index - 1)) {
							add("K");
							index += 2;
							break;
						}
						if (index === 0) {
							if (charAt(index + 2) === "I") {
								add("J");
							} else {
								add("K");
							}
							index += 2;
							break;
						}
						if (
							(index > 1 && contains(index - 2, 1, "B", "H", "D")) ||
							(index > 2 && contains(index - 3, 1, "B", "H", "D")) ||
							(index > 3 && contains(index - 4, 1, "B", "H"))
						) {
							index += 2;
							break;
						}
						if (
							index > 2 &&
							charAt(index - 1) === "U" &&
							contains(index - 3, 1, "C", "G", "L", "R", "T")
						) {
							add("F");
							index += 2;
							break;
						}
						if (index > 0 && charAt(index - 1) !== "I") {
							add("K");
						}
						index += 2;
						break;
					}
					if (charAt(index + 1) === "N") {
						if (index === 1 && isVowel(0) && !slavoGermanic) {
							add("KN", "N");
						} else {
							if (
								!contains(index + 2, 2, "EY") &&
								charAt(index + 1) !== "Y" &&
								!slavoGermanic
							) {
								add("N", "KN");
							} else {
								add("KN");
							}
						}
						index += 2;
						break;
					}
					if (contains(index + 1, 2, "LI") && !slavoGermanic) {
						add("KL", "L");
						index += 2;
						break;
					}
					if (
						index === 0 &&
						(charAt(index + 1) === "Y" ||
							contains(index + 1, 2, "ES", "EP", "EB", "EL", "EY", "IB", "IL", "IN", "IE", "EI", "ER"))
					) {
						add("K", "J");
						index += 2;
						break;
					}
					if (
						(contains(index + 1, 2, "ER") || charAt(index + 1) === "Y") &&
						!contains(0, 6, "DANGER", "RANGER", "MANGER") &&
						!contains(index - 1, 1, "E", "I") &&
						!contains(index - 1, 3, "RGY", "OGY")
					) {
						add("K", "J");
						index += 2;
						break;
					}
					if (contains(index + 1, 1, "E", "I", "Y") || contains(index - 1, 4, "AGGI", "OGGI")) {
						if (contains(0, 4, "VAN ", "VON ") || contains(0, 3, "SCH") || contains(index + 1, 2, "ET")) {
							add("K");
						} else {
							if (contains(index + 1, 4, "IER ")) {
								add("J");
							} else {
								add("J", "K");
							}
						}
						index += 2;
						break;
					}
					if (charAt(index + 1) === "G") {
						index += 2;
					} else {
						index++;
					}
					add("K");
					break;

				case "H":
					if (
						(index === 0 || isVowel(index - 1)) &&
						isVowel(index + 1)
					) {
						add("H");
						index += 2;
					} else {
						index++;
					}
					break;

				case "J":
					if (contains(index, 4, "JOSE") || originalUpper.startsWith("SAN ")) {
						if (
							(index === 0 && charAt(index + 4) === " ") ||
							str.length === 4 ||
							originalUpper.startsWith("SAN ")
						) {
							add("H");
						} else {
							add("J", "H");
						}
						index++;
						break;
					}
					if (index === 0 && !contains(index, 4, "JOSE")) {
						add("J", "A");
					} else {
						if (isVowel(index - 1) && !slavoGermanic && (charAt(index + 1) === "A" || charAt(index + 1) === "O")) {
							add("J", "H");
						} else {
							if (index === length - 1) {
								add("J", "");
							} else if (
								!contains(index + 1, 1, "L", "T", "K", "S", "N", "M", "B", "Z") &&
								!contains(index - 1, 1, "S", "K", "L")
							) {
								add("J");
							}
						}
					}
					index += charAt(index + 1) === "J" ? 2 : 1;
					break;

				case "K":
					add("K");
					index += charAt(index + 1) === "K" ? 2 : 1;
					break;

				case "L":
					if (charAt(index + 1) === "L") {
						if (
							(index === length - 3 &&
								contains(index - 1, 4, "ILLO", "ILLA", "ALLE")) ||
							((contains(length - 2, 2, "AS", "OS") ||
								contains(length - 1, 1, "A", "O")) &&
								contains(index - 1, 4, "ALLE"))
						) {
							add("L", "");
							index += 2;
							break;
						}
						index += 2;
					} else {
						index++;
					}
					add("L");
					break;

				case "M":
					if (
						(contains(index - 1, 3, "UMB") &&
							(index + 1 === length - 1 || contains(index + 2, 2, "ER"))) ||
						charAt(index + 1) === "M"
					) {
						index += 2;
					} else {
						index++;
					}
					add("M");
					break;

				case "N":
					add("N");
					index += charAt(index + 1) === "N" ? 2 : 1;
					break;

				case "Ñ":
					add("N");
					index++;
					break;

				case "P":
					if (charAt(index + 1) === "H") {
						add("F");
						index += 2;
					} else {
						add("P");
						index += contains(index + 1, 1, "P", "B") ? 2 : 1;
					}
					break;

				case "Q":
					add("K");
					index += charAt(index + 1) === "Q" ? 2 : 1;
					break;

				case "R":
					if (index === length - 1 && !slavoGermanic && contains(index - 2, 2, "IE") && !contains(index - 4, 2, "ME", "MA")) {
						add("", "R");
					} else {
						add("R");
					}
					index += charAt(index + 1) === "R" ? 2 : 1;
					break;

				case "S":
					if (contains(index - 1, 3, "ISL", "YSL")) {
						index++;
						break;
					}
					if (index === 0 && contains(index, 5, "SUGAR")) {
						add("X", "S");
						index++;
						break;
					}
					if (contains(index, 2, "SH")) {
						if (contains(index + 1, 4, "HEIM", "HOEK", "HOLM", "HOLZ")) {
							add("S");
						} else {
							add("X");
						}
						index += 2;
						break;
					}
					if (contains(index, 3, "SIO", "SIA")) {
						if (slavoGermanic) {
							add("S");
						} else {
							add("S", "X");
						}
						index += 3;
						break;
					}
					if (
						(index === 0 && contains(index + 1, 1, "M", "N", "L", "W")) ||
						contains(index + 1, 1, "Z")
					) {
						add("S", "X");
						index += contains(index + 1, 1, "Z") ? 2 : 1;
						break;
					}
					if (contains(index, 2, "SC")) {
						if (charAt(index + 2) === "H") {
							if (
								contains(index + 3, 2, "OO", "ER", "EN", "UY", "ED", "EM")
							) {
								add("SK");
							} else {
								if (index === 0 && !isVowel(3) && charAt(3) !== "W") {
									add("X", "S");
								} else {
									add("X");
								}
							}
							index += 3;
							break;
						}
						if (contains(index + 2, 1, "I", "E", "Y")) {
							add("S");
							index += 3;
							break;
						}
						add("SK");
						index += 3;
						break;
					}
					if (index === length - 1 && contains(index - 2, 2, "AI", "OI")) {
						add("", "S");
					} else {
						add("S");
					}
					index += contains(index + 1, 1, "S", "Z") ? 2 : 1;
					break;

				case "T":
					if (contains(index, 4, "TION")) {
						add("X");
						index += 3;
						break;
					}
					if (contains(index, 3, "TIA", "TCH")) {
						add("X");
						index += 3;
						break;
					}
					if (
						contains(index, 2, "TH") ||
						contains(index, 3, "TTH")
					) {
						if (
							contains(index + 2, 2, "OM", "AM") ||
							contains(0, 4, "VAN ", "VON ") ||
							contains(0, 3, "SCH")
						) {
							add("T");
						} else {
							add("0", "T");
						}
						index += 2;
						break;
					}
					add("T");
					index += contains(index + 1, 1, "T", "D") ? 2 : 1;
					break;

				case "V":
					add("F");
					index += charAt(index + 1) === "V" ? 2 : 1;
					break;

				case "W":
					if (contains(index, 2, "WR")) {
						add("R");
						index += 2;
						break;
					}
					if (index === 0 && (isVowel(index + 1) || contains(index, 2, "WH"))) {
						if (isVowel(index + 1)) {
							add("A", "F");
						} else {
							add("A");
						}
					}
					if (
						(index === length - 1 && isVowel(index - 1)) ||
						contains(index - 1, 5, "EWSKI", "EWSKY", "OWSKI", "OWSKY") ||
						contains(0, 3, "SCH")
					) {
						add("", "F");
						index++;
						break;
					}
					if (contains(index, 4, "WICZ", "WITZ")) {
						add("TS", "FX");
						index += 4;
						break;
					}
					index++;
					break;

				case "X":
					if (
						!(index === length - 1 &&
							(contains(index - 3, 3, "IAU", "EAU") ||
								contains(index - 2, 2, "AU", "OU")))
					) {
						add("KS");
					}
					index += contains(index + 1, 1, "C", "X") ? 2 : 1;
					break;

				case "Z":
					if (charAt(index + 1) === "H") {
						add("J");
						index += 2;
						break;
					}
					if (
						contains(index + 1, 2, "ZO", "ZI", "ZA") ||
						(slavoGermanic && index > 0 && charAt(index - 1) !== "T")
					) {
						add("S", "TS");
					} else {
						add("S");
					}
					index += charAt(index + 1) === "Z" ? 2 : 1;
					break;

				default:
					index++;
					break;
			}
		}

		// Trim trailing spaces from secondary (from Spanish LL rule)
		secondary = secondary.trimEnd();

		const sec = secondary === primary ? primary : secondary;
		return `${primary}:${sec}`;
	}

	doubleMetaphoneMatchScore(word1, word2) {
		const code1 = (String(word1).includes(':')) ? word1 : this.doubleMetaphone(word1);
		const code2 = (String(word2).includes(':')) ? word2 : this.doubleMetaphone(word2);
		return this._doubleMetaphoneScore(code1, code2) || 0.0;
	}

	// -----------------------------------------------------------------------
	// 2. JARO-WINKLER  (case-insensitive, no external deps, per Normalize.md)
	// -----------------------------------------------------------------------

	// Jaro similarity in [0, 1] — proportion of matching characters (within a
	// sliding window) adjusted for transpositions.
	jaro(s1, s2) {
		if (!s1 || !s2) return 0.0;
		s1 = String(s1).toUpperCase();
		s2 = String(s2).toUpperCase();
		if (s1 === s2) return 1.0;

		const len1 = s1.length;
		const len2 = s2.length;
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
				s1Matches[i] = true;
				s2Matches[j] = true;
				matches++;
				break;
			}
		}
		if (matches === 0) return 0.0;

		// Count transpositions among the matched characters.
		let transpositions = 0;
		let k = 0;
		for (let i = 0; i < len1; i++) {
			if (!s1Matches[i]) continue;
			while (!s2Matches[k]) k++;
			if (s1[i] !== s2[k]) transpositions++;
			k++;
		}
		transpositions /= 2;

		return (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3;
	}

	// Jaro-Winkler: Jaro similarity with a bonus for a shared leading prefix (up
	// to 4 chars), applied only once the Jaro score clears boostThreshold.
	jaroWinkler(s1, s2, prefixScale = 0.1, boostThreshold = 0.7) {
		if (!s1 || !s2) return 0.0;                 // Quit if empty
		s1 = String(s1).toUpperCase();
		s2 = String(s2).toUpperCase();
		if (s1 === s2) return 1.0;                  // Identical

		const j = this.jaro(s1, s2);                // Phase 1: base Jaro
		if (j < boostThreshold) return j;

		// Phase 2: Winkler prefix-scale modification.
		const maxPrefix = Math.min(4, s1.length, s2.length);
		let prefix = 0;
		while (prefix < maxPrefix && s1[prefix] === s2[prefix]) prefix++;

		return j + prefix * prefixScale * (1 - j);
	}

	JaroWinkler(s1, s2, prefixScale = 0.1, boostThreshold = 0.7) {
		return this.jaroWinkler(s1, s2, prefixScale, boostThreshold);
	}

	// -----------------------------------------------------------------------
	// 3. RARITY  (Fellegi-Sunter name weighting, per Normalize.md)
	// -----------------------------------------------------------------------

	// Build first/last-name frequency maps over a candidate pool — the input the
	// rarity modifier is measured against. Keys are normalized-upper names.
	buildNameFrequencies(mentions) {
		const firstNameFreq = new Map();
		const lastNameFreq = new Map();
		if (Array.isArray(mentions)) {
			for (const m of mentions) {
				if (!m) continue;
				const fk = normUpper(m.first_name || m.norm_first_name);
				if (fk) firstNameFreq.set(fk, (firstNameFreq.get(fk) || 0) + 1);
				const lk = normUpper(m.last_name);
				if (lk) lastNameFreq.set(lk, (lastNameFreq.get(lk) || 0) + 1);
			}
		}
		return { firstNameFreq, lastNameFreq };
	}

	// Raw rarity modifier (in the "x100" points score.js logs), given a name and
	// the matching frequency map. Positive for rare names, negative for common.
	// Name missing / not in map -> 0.
	nameWeightModifier(value, freqMap) {
		const r = this.rarity;
		const key = normUpper(value);
		if (!key || !freqMap || typeof freqMap.get !== 'function' || !freqMap.has(key)) return 0;
		const count = freqMap.get(key) || 0;

		if (count <= r.veryRareMax) return r.modVeryRare;
		if (count <= r.uncommonMax) return r.modUncommon;
		if (count <= r.averageMax) return r.modAverage;
		if (count <= r.commonMax) return r.modCommon;
		return r.modExtremelyCommon;
	}

	getNameWeightModifier(value, freqMap) {
		return this.nameWeightModifier(value, freqMap);
	}

	// =======================================================================
	// LEVER A — NAME AGREEMENT   (implements Step 3 of the scoring spec)
	//
	//   MatchName(objA, objB) -> Number in [0, 1]
	//
	// objA is treated as the target, objB as the candidate. Each object may
	// carry: full_name, first_name, middle_name, last_name, norm_first_name,
	// metaphone_last_name ("PRIMARY:SECONDARY"), nysiis_last_name. Any may be
	// absent. Only the single highest-firing rung contributes the base score
	// (rungs are NOT summed); rarity (3.5) then adjusts it and the result is
	// clamped to [0, 1]. Middle name is excluded from the score (3.6, tiebreak
	// only) and surfaced separately in the detail object.
	//
	// Optional inputs (set once on the instance, since MatchName takes only the
	// two objects):
	//   usePool(mentions) / useFrequencies(ff, lf) -> enables rarity (3.5).
	//     Without them the rarity term is 0 and the rungs score on their own.
	//   setSurnameBridge(fn) -> enables the BRIDGED surname rung (3.1). fn(a,b)
	//     returns true when a hasNameVariant / marriage assertion links the two
	//     surnames. Without it, BRIDGED is skipped.
	// =======================================================================

	// Load a blocked candidate pool for rarity weighting (3.5). Callers should
	// pass the pool already blocked to the target's source list / norm_race /
	// gender, per the spec — Match does not re-block.
	usePool(mentions) {
		const { firstNameFreq, lastNameFreq } = this.buildNameFrequencies(mentions);
		return this.useFrequencies(firstNameFreq, lastNameFreq);
	}

	// Attach precomputed frequency maps directly (keys normalized-upper).
	useFrequencies(firstNameFreq, lastNameFreq) {
		this._firstNameFreq = firstNameFreq || null;
		this._lastNameFreq = lastNameFreq || null;
		this._initialFreq = null; // derived lazily from _firstNameFreq
		return this;
	}

	// Provide a surname-bridge predicate for the BRIDGED rung (3.1).
	setSurnameBridge(fn) {
		this._surnameBridge = (typeof fn === 'function') ? fn : null;
		return this;
	}

	// --- public score ------------------------------------------------------

	// Returns the Lever A score in [0, 1].
	MatchName(objA, objB) {
		return this.matchNameDetail(objA, objB).score;
	}

	// Same computation, but returns the full breakdown: { score, rung,
	// surnameStrength, surnameKind, weakSurnameHint, needsCorroboration,
	// givenClass, rarityFirst, raritySurname, middleTiebreak }. Useful to the
	// caller because needsCorroboration / weakSurnameHint tell Levers B and C
	// whether this candidate may stand on name evidence alone.
	matchNameDetail(objA, objB) {
		objA = objA || {};
		objB = objB || {};

		// --- 3.1 surname-match determination -------------------------------
		const sm = this._surnameMatch(objA, objB);
		const firedSurname = sm.strength >= 0.8;          // 0.6 weak does NOT fire

		// --- 3.2 given-name classification ---------------------------------
		const gA = this._classifyGiven(objA);
		const gB = this._classifyGiven(objB);

		let rung = 'NONE';
		let base = 0.0;
		let needsCorroboration = false;
		let usedFirstNameAgreement = false; // gates first-name rarity (3.5)
		let usedInitial = false;            // gates initial-letter rarity (3.5)
		let initialLetter = '';

		if (gA.cls === 'ABSENT' || gB.cls === 'ABSENT') {
			// Given-name lever excluded — rely on surname alone.
			if (firedSurname) { rung = 'SURNAME_ONLY'; base = 0.3; needsCorroboration = true; }
		} else if (gA.cls === 'FULL' && gB.cls === 'FULL') {
			// --- 3.3 Jaro-Winkler rung (FULL vs FULL) ---
			const canonA = this.nickname(gA.norm);
			const canonB = this.nickname(gB.norm);
			const givenExact = !!canonA && canonA === canonB;
			const jw = this.jaroWinkler(gA.norm, gB.norm);
			const givenNickname = jw >= 0.85;

			if (givenExact && firedSurname) {
				rung = 'EXACT_FIRST_SURNAME'; base = 1.0; usedFirstNameAgreement = true;
			} else if (givenNickname && firedSurname) {
				rung = 'NICKNAME_FIRST_SURNAME'; base = 0.85; usedFirstNameAgreement = true;
			} else if ((givenExact || givenNickname) && sm.strength >= 0.6 && sm.strength < 0.8) {
				// Moderate/weak phonetic surname (only 0.6 lands here) paired with
				// first-name agreement. Spec sets base 0.7 and states this rung
				// "requires no additional corroboration" — the first-name
				// agreement is treated as the corroboration for the weak hint.
				rung = 'PHONETIC_MODERATE_SURNAME'; base = 0.7; usedFirstNameAgreement = true;
			} else if ((givenExact || givenNickname) && sm.strength === 0.0) {
				rung = 'GIVEN_NAME_ONLY'; base = 0.4; needsCorroboration = true; usedFirstNameAgreement = true;
			} else if (firedSurname) {
				// First names are both full but disagree; lean on surname alone at
				// a reduced independent weight (mirrors 3.4's inconsistent path).
				rung = 'SURNAME_ONLY'; base = 0.3; needsCorroboration = true;
			}
		} else {
			// --- 3.4 initial-consistency rung (at least one INITIAL) ---
			const bothInitials = gA.cls === 'INITIAL' && gB.cls === 'INITIAL';
			const consistent = bothInitials
				? gA.initial === gB.initial
				: gA.initial === gB.initial; // FULL-vs-INITIAL: compare first letters
			initialLetter = gA.initial || gB.initial;

			if (!consistent) {
				if (firedSurname) { rung = 'SURNAME_ONLY'; base = 0.3; needsCorroboration = true; }
			} else if (bothInitials) {
				if (firedSurname) {
					rung = 'BOTH_INITIALS_SURNAME'; base = 0.35; needsCorroboration = true; usedInitial = true;
				}
			} else {
				// one INITIAL, one FULL, consistent
				if (firedSurname) {
					rung = 'INITIAL_CONSISTENT_SURNAME'; base = 0.55; needsCorroboration = true; usedInitial = true;
				}
			}
		}

		// --- 3.5 rarity weighting ------------------------------------------
		let rarityFirst = 0;
		let raritySurname = 0;
		if (base > 0) {
			// Surname rarity: applies whenever a surname rung fired.
			if (firedSurname && this._lastNameFreq) {
				const surname = this._resolveSurname(objA) || this._resolveSurname(objB);
				raritySurname = this.nameWeightModifier(surname, this._lastNameFreq) / 100;
			}
			// Given-name rarity: first-name frequency when the rung fired on
			// first-name agreement; initial-letter inverse modifier for the
			// initials rungs.
			if (usedFirstNameAgreement && this._firstNameFreq) {
				const fn = isPresent(objA.norm_first_name) ? objA.norm_first_name : objA.first_name;
				rarityFirst = this.nameWeightModifier(fn, this._firstNameFreq) / 100;
			} else if (usedInitial && this._firstNameFreq) {
				rarityFirst = this._initialLetterModifier(initialLetter) / 100;
			}
		}

		const score = base > 0 ? clamp(base + rarityFirst + raritySurname, 0, 1) : 0;

		return {
			score,
			rung,
			surnameStrength: sm.strength,
			surnameKind: sm.kind,
			weakSurnameHint: !!sm.weakHint,
			needsCorroboration,
			givenClass: gA.cls + '/' + gB.cls,
			rarityFirst,
			raritySurname,
			middleTiebreak: this._middleTiebreak(objA, objB), // 3.6, not in score
		};
	}

	// --- Lever A helpers ---------------------------------------------------

	// 3.1: resolve the surname-match strength and kind between two objects.
	_surnameMatch(a, b) {
		// 1. full_name exact (case-insensitive, punctuation stripped)
		const fa = this._normFullName(a.full_name);
		const fb = this._normFullName(b.full_name);
		if (fa && fb && fa === fb) return { strength: 1.0, kind: 'EXACT_FULLNAME' };

		// 2. last_name exact (case-insensitive)
		const la = this._normLast(a.last_name);
		const lb = this._normLast(b.last_name);
		if (la && lb && la === lb) return { strength: 1.0, kind: 'EXACT_LASTNAME' };

		// 3. bridged (hasNameVariant / marriage) — only if a bridge is provided
		if (this._surnameBridge && this._surnameBridge(a, b)) {
			return { strength: 0.9, kind: 'BRIDGED' };
		}

		// 4. double metaphone, else NYSIIS fallback
		const dm = this._doubleMetaphoneScore(a.metaphone_last_name, b.metaphone_last_name);
		if (dm === null) {
			// metaphone absent on at least one side -> NYSIIS equality
			const na = normUpper(a.nysiis_last_name);
			const nb = normUpper(b.nysiis_last_name);
			if (na && nb && na === nb) return { strength: 0.85, kind: 'NYSIIS' };
			return { strength: 0.0, kind: 'NO_MATCH' };
		}
		if (dm === 1.0) return { strength: 1.0, kind: 'PHONETIC_STRONG' };
		if (dm === 0.8) return { strength: 0.8, kind: 'PHONETIC_MODERATE' };
		if (dm === 0.6) return { strength: 0.6, kind: 'PHONETIC_WEAK', weakHint: true };
		return { strength: 0.0, kind: 'NO_MATCH' };
	}

	// Compare two double-metaphone codes ("PRIMARY:SECONDARY"). Returns
	// 1.0 / 0.8 / 0.6 / 0.0, or null when either code is absent (caller then
	// falls back to NYSIIS, per 3.1).
	_doubleMetaphoneScore(codeA, codeB) {
		if (!isPresent(codeA) || !isPresent(codeB)) return null;
		const parse = (c) => {
			const parts = String(c).toUpperCase().split(':').map((x) => x.trim().replace(/[^A-Z]/g, ''));
			const primary = parts[0] || '';
			const secondary = parts[1] || primary;
			return { primary, secondary };
		};
		const A = parse(codeA);
		const B = parse(codeB);
		if (!A.primary || !B.primary) return 0.0;
		if (A.primary === B.primary) return 1.0;                       // strong
		if (A.primary === B.secondary || A.secondary === B.primary) return 0.8; // moderate
		if (A.secondary && A.secondary === B.secondary) return 0.6;    // weak
		return 0.0;
	}

	// 3.2: classify a first name as FULL / INITIAL / ABSENT, preferring
	// norm_first_name. Returns { cls, norm, initial }.
	_classifyGiven(o) {
		const raw = isPresent(o.norm_first_name) ? o.norm_first_name : o.first_name;
		const n = normUpper(raw); // strips non-alpha (so "J." -> "J")
		if (!n) return { cls: 'ABSENT', norm: '', initial: '' };
		if (n.length === 1) return { cls: 'INITIAL', norm: n, initial: n };
		return { cls: 'FULL', norm: n, initial: n[0] };
	}

	// full_name: uppercase, punctuation -> space, collapse whitespace.
	_normFullName(s) {
		if (!isPresent(s)) return '';
		return String(s).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
	}

	// last_name: case-insensitive exact string (trimmed, alpha-folded).
	_normLast(s) {
		return normUpper(s);
	}

	// Resolve the surname string for rarity (the name, not the metaphone code):
	// prefer last_name, else the final token of full_name.
	_resolveSurname(o) {
		if (isPresent(o.last_name)) return normUpper(o.last_name);
		const full = this._normFullName(o.full_name);
		if (full) { const t = full.split(' '); return normUpper(t[t.length - 1]); }
		return '';
	}

	// 3.5: inverse initial-letter modifier for the initials rungs. Rarer
	// starting letters score higher; common ones (J/M/W...) lower or negative.
	// Derived from the loaded first-name frequency pool; 0 when no pool.
	_initialLetterModifier(letter) {
		const L = normUpper(letter);
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
		// Bucketed inverse mapping onto the same +/-15 scale as name rarity.
		if (share >= 0.09) return -15; // very common initial
		if (share >= 0.06) return -5;
		if (share >= 0.03) return 0;
		if (share >= 0.01) return 5;
		return 15;                     // rare initial
	}

	// 3.6: middle-name tiebreak (not part of the score). Returns
	// 'MATCH' (exact middle name/initial), 'NO_DATA' (either side absent), or
	// 'MISMATCH'. The caller uses this only to break ties after Step 6.
	_middleTiebreak(a, b) {
		const ma = normUpper(a.middle_name);
		const mb = normUpper(b.middle_name);
		if (!ma || !mb) return 'NO_DATA';
		if (ma === mb) return 'MATCH';
		if (ma[0] === mb[0] && (ma.length === 1 || mb.length === 1)) return 'MATCH'; // initial vs full
		return 'MISMATCH';
	}
}

// Export for both browser global and Node.
if (typeof window !== 'undefined') window.Match = Match;
if (typeof module !== 'undefined' && module.exports) {
	module.exports = Match;
	module.exports.Match = Match;
}
