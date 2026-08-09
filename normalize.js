class Normalize {
	static NICKNAMES = {
		"WM": "WILLIAM", "BILL": "WILLIAM", "BILLY": "WILLIAM", "WILL": "WILLIAM", "WILLY": "WILLIAM", "WILLIE": "WILLIAM",
		"ROBT": "ROBERT", "ROB": "ROBERT", "BOB": "ROBERT", "BOBBY": "ROBERT", "ROBBIE": "ROBERT",
		"JAS": "JAMES", "JIM": "JAMES", "JIMMY": "JAMES", "JAMIE": "JAMES",
		"CHAS": "CHARLES", "CHARLIE": "CHARLES", "CHUCK": "CHARLES", "CARL": "CHARLES",
		"THOS": "THOMAS", "TOM": "THOMAS", "TOMMY": "THOMAS",
		"JNO": "JOHN", "JON": "JOHN", "JACK": "JOHN", "JACKIE": "JOHN", "JONNY": "JOHN", "JOHNNY": "JOHN",
		"DAN": "DANIEL", "DANNY": "DANIEL",
		"ED": "EDWARD", "EDDIE": "EDWARD", "NED": "EDWARD", "TED": "EDWARD", "TEDDY": "EDWARD",
		"GEO": "GEORGE",
		"JOS": "JOSEPH", "JOE": "JOSEPH", "JOEY": "JOSEPH",
		"SAM": "SAMUEL", "SAMMY": "SAMUEL",
		"ALEX": "ALEXANDER", "ALECK": "ALEXANDER", "ALEC": "ALEXANDER", "SANDY": "ALEXANDER",
		"PAT": "PATRICK", "PADDY": "PATRICK",
		"MATT": "MATTHEW", "MAT": "MATTHEW",
		"MIKE": "MICHAEL", "MICK": "MICHAEL", "MICKEY": "MICHAEL", "MICH": "MICHAEL",
		"DAVE": "DAVID", "DAVEY": "DAVID", "DAVY": "DAVID",
		"CHRIS": "CHRISTOPHER", "KIT": "CHRISTOPHER",
		"RICH": "RICHARD", "RICK": "RICHARD", "DICK": "RICHARD", "RICHD": "RICHARD", "DICKY": "RICHARD",
		"HARRY": "HENRY", "HAL": "HENRY", "HEN": "HENRY",
		"BEN": "BENJAMIN", "BENNY": "BENJAMIN", "BENJ": "BENJAMIN",
		"FRED": "FREDERICK", "FREDDY": "FREDERICK", "FREDK": "FREDERICK",
		"FRANK": "FRANCIS", "FRAN": "FRANCIS", "FRAS": "FRANCIS",
		"ANDY": "ANDREW",
		"TONY": "ANTHONY", "ANT": "ANTHONY",
		"ART": "ARTHUR", "ARTIE": "ARTHUR",
		"AL": "ALBERT", "ALB": "ALBERT",
		"ALF": "ALFRED", "ALFIE": "ALFRED",
		"WALT": "WALTER", "WALLY": "WALTER",
		"PETE": "PETER",
		"STEVE": "STEPHEN", "STEPH": "STEPHEN",
		"NICK": "NICHOLAS", "NICKY": "NICHOLAS",
		"NAT": "NATHANIEL", "NATE": "NATHANIEL", "NATHL": "NATHANIEL",
		"ABE": "ABRAHAM",
		"IKE": "ISAAC",
		"LI": "ELIJAH", "LIJE": "ELIJAH",
		"MANNY": "EMANUEL", "MANUEL": "EMANUEL",
		"HARV": "HARVEY",
		"LEW": "LEWIS",
		"MOSE": "MOSES",
		"SOL": "SOLOMON",
		"TOBY": "TOBIAS",
		"JERRY": "JEREMIAH", "JER": "JEREMIAH",
		"ZEKE": "EZEKIEL",
		"NEIL": "CORNELIUS", "CORN": "CORNELIUS",
		"BART": "BARTHOLOMEW",
		"ARCH": "ARCHIBALD", "ARCHIE": "ARCHIBALD", "ARCHY": "ARCHIBALD", "ARCHABLE": "ARCHIBALD", "ARCHABALD": "ARCHIBALD", "ARCHA": "ARCHIBALD",
		"CY": "CYRUS", "CYRUS": "CYRUS", "CYRE": "CYRUS", "CYR": "CYRUS", "SY": "CYRUS",
		"GUS": "AUGUSTUS",
		"AMB": "AMBROSE",
		"ZACH": "ZACHARIAH", "ZACK": "ZACHARIAH",
		"LIZ": "ELIZABETH", "LIZZIE": "ELIZABETH", "LIZZY": "ELIZABETH", "BETH": "ELIZABETH", "BETTY": "ELIZABETH", "BETTE": "ELIZABETH", "BESS": "ELIZABETH", "BESSIE": "ELIZABETH", "ELIZA": "ELIZABETH", "ELIZ": "ELIZABETH", "LIBBY": "ELIZABETH",
		"MOLLY": "MARY", "POLLY": "MARY", "MAE": "MARY", "MAMIE": "MARY",
		"MAG": "MARGARET", "MAGGIE": "MARGARET", "MEG": "MARGARET", "PEGGY": "MARGARET", "MARG": "MARGARET", "MARGT": "MARGARET", "RITA": "MARGARET",
		"KATE": "CATHERINE", "KATIE": "CATHERINE", "KITTY": "CATHERINE", "KATH": "CATHERINE",
		"SARA": "SARAH", "SALLY": "SARAH", "SAL": "SARAH",
		"SUE": "SUSAN", "SUSIE": "SUSAN", "SUSY": "SUSAN", "SUSA": "SUSANNAH",
		"ANNIE": "ANN", "ANNA": "ANN", "NAN": "ANN", "NANNY": "ANN", "HANNA": "HANNAH",
		"MART": "MARTHA", "MATTIE": "MARTHA",
		"BECCA": "REBECCA", "BECKY": "REBECCA",
		"GEORGEANA": "GEORGEANNA", "GEORGIANA": "GEORGEANNA", "GEORGIANNA": "GEORGEANNA", "GEORGEANNE": "GEORGEANNA",
		"CARRIE": "CAROLINE", "CAROL": "CAROLINE",
		"NELL": "ELEANOR", "NELLIE": "ELEANOR", "NORA": "ELEANOR",
		"FANNY": "FRANCES",
		"HATTIE": "HARRIET",
		"LOU": "LOUISA", "LULA": "LOUISA",
		"TILLY": "MATILDA", "TILLIE": "MATILDA",
		"GINNY": "VIRGINIA",
		"VINA": "LAVINIA", "VINEY": "LAVINIA",
		"PRISSY": "PRISCILLA", "CILLA": "PRISCILLA",
		"DELIA": "DELILAH", "LILA": "DELILAH",
		"LUCY": "LUCINDA",
		"PHILLIS": "PHYLLIS",
		"MINNIE": "MINERVA"
	};

	static getNickname(name) {
		if (!name) return "";
		let norm = name.toUpperCase().replace(/[^A-Z]/g, '');
		return Normalize.NICKNAMES[norm] || norm;
	}

	static getNYSIIS(name) {
		if (!name) return "";
		let n = name.toUpperCase().replace(/[^A-Z]/g, '');
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

	static getSoundex(name) {
		if (!name) return "";
		let s = name.toUpperCase().replace(/[^A-Z]/g, '');
		if (!s) return "";

		const map = {
			B: 1, F: 1, P: 1, V: 1,
			C: 2, G: 2, J: 2, K: 2, Q: 2, S: 2, X: 2, Z: 2,
			D: 3, T: 3,
			L: 4,
			M: 5, N: 5,
			R: 6
		};

		let res = s[0];
		let prevCode = map[s[0]] || 0;

		for (let i = 1; i < s.length; i++) {
			if (res.length === 4) break;
			let c = s[i];
			if (c === 'H' || c === 'W') continue;
			if ("AEIOUY".includes(c)) {
				prevCode = 0;
				continue;
			}
			let code = map[c];
			if (code && code !== prevCode) {
				res += code;
				prevCode = code;
			} else if (code) {
				prevCode = code;
			}
		}
		return (res + "000").substring(0, 4);
	}

	static getMetaphone(name) {
		if (!name) return "";
		return Normalize.doubleMetaphone(name);
	}

	static buildNameFrequencies(dataset) {
		const firstNameFreq = new Map();
		const lastNameFreq = new Map();

		for (const m of dataset || []) {
			const fn = (m.norm_first_name !== undefined && m.norm_first_name !== null && String(m.norm_first_name).trim() !== "")
				? m.norm_first_name : m.first_name;
			if (fn !== undefined && fn !== null && String(fn).trim() !== "") {
				const k = String(fn).trim().toUpperCase().replace(/[^A-Z]/g, "");
				if (k) firstNameFreq.set(k, (firstNameFreq.get(k) || 0) + 1);
			}
			const ln = m.last_name;
			if (ln !== undefined && ln !== null && String(ln).trim() !== "") {
				const k = String(ln).trim().toUpperCase().replace(/[^A-Z]/g, "");
				if (k) lastNameFreq.set(k, (lastNameFreq.get(k) || 0) + 1);
			}
		}

		return { firstNameFreq, lastNameFreq };
	}

	static getNameWeightModifier(name, freqMap, rarityConfig) {
		if (!name || !freqMap) return 0;
		const k = String(name).trim().toUpperCase().replace(/[^A-Z]/g, "");
		const count = freqMap.get(k);
		if (count === undefined || count === null) return 0;

		const r = rarityConfig || {
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

		if (count <= r.veryRareMax) return r.modVeryRare;
		if (count <= r.uncommonMax) return r.modUncommon;
		if (count <= r.averageMax) return r.modAverage;
		if (count <= r.commonMax) return r.modCommon;
		return r.modExtremelyCommon;
	}

	static doubleMetaphoneMatchScore(word1, word2) {
		const [p1, s1] = Normalize.doubleMetaphone(word1).split(':');
		const [p2, s2] = Normalize.doubleMetaphone(word2).split(':');
		if (p1 === p2) return 1.0;
		if (p1 === s2 || s1 === p2) return 0.8;
		if (s1 === s2) return 0.6;
		return 0.0;
	}

	static doubleMetaphone(word) {
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
}

// Standalone function wrappers for backwards compatibility
function buildNameFrequencies(dataset) {
	return Normalize.buildNameFrequencies(dataset);
}

function getNameWeightModifier(name, freqMap, rarityConfig) {
	return Normalize.getNameWeightModifier(name, freqMap, rarityConfig);
}

function doubleMetaphone(word) {
	return Normalize.doubleMetaphone(word);
}

function doubleMetaphoneMatchScore(word1, word2) {
	return Normalize.doubleMetaphoneMatchScore(word1, word2);
}

const matchScore = doubleMetaphoneMatchScore;

if (typeof window !== 'undefined') {
	window.Normalize = Normalize;
	window.buildNameFrequencies = buildNameFrequencies;
	window.getNameWeightModifier = getNameWeightModifier;
	window.doubleMetaphone = doubleMetaphone;
	window.doubleMetaphoneMatchScore = doubleMetaphoneMatchScore;
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Normalize;
}


