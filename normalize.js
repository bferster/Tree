const NICKNAMES = {
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
	"ARCH": "ARCHIBALD", "ARCHIE": "ARCHIBALD",
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

window.Normalize = {
	getNickname: function (name) {
		if (!name) return "";
		let norm = name.toUpperCase().replace(/[^A-Z]/g, '');
		return NICKNAMES[norm] || norm;
	},

	getNYSIIS: function (name) {
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
	},

	getSoundex: function (name) {
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
	},

	NormalizeRace: function (race) {
		if (!race) return "";
		let r = race.trim().toLowerCase();
		if (r === "w" || r === "cauc" || r === "caucasian" || r === "white") {
			return "W";
		}
		return "B";
	}
};
