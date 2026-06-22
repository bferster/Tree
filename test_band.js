class Score {
	constructor() {
		this.bandScores={ 1: 0.8, 2: 0.7, 3: 0.6, 5: 0.5, 10: 0.3, 20: 0.2 };
	}
	BandScore(aVal, bVal, compare) {
		let m=String(compare).match(/(\d+)/);
		if (!m) return 0.0;
		let maxTol=Number(m[1]);
		let a=Number(String(aVal).split(':')[0]);
		let bStr=String(bVal).split(':')[0];
		let b=Number(bStr);

		if (Number.isNaN(a)) return 0.0;

		let getScore=(diff) => {
			if (diff>maxTol) return 0.0;
			if (diff===0) return 1.0;
			let bandTol=Object.keys(this.bandScores).map(Number).sort((x,y)=>x-y).find(t=>diff<=t);
			return bandTol!==undefined ? this.bandScores[bandTol] : 0.0;
		};

		if (Number.isNaN(b)) {
			if (bStr.includes('-')) {
				let [start, end]=bStr.split('-').map(s=>parseInt(s.trim(), 10));
				if (!isNaN(start) && !isNaN(end)) {
					if (a>=start && a<=end) return 1.0;
					let diff=Math.min(Math.abs(a-start), Math.abs(a-end));
					return getScore(diff);
				}
			}
			return 0.0;
		}

		return getScore(Math.abs(a-b));
	}
}

const s = new Score();
console.log("diff=0:", s.BandScore(1840, 1840, '+/- 1'));
console.log("diff=1:", s.BandScore(1840, 1841, '+/- 1'));
console.log("diff=2:", s.BandScore(1840, 1842, '+/- 1'));
console.log("diff=2, tol=2:", s.BandScore(1840, 1842, '+/- 2'));
