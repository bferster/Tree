const fs = require('fs');

global.window = {
	location: { search: '?test' }
};
global.$ = () => ({
	hide: () => {},
	show: () => {},
	val: () => '',
	text: () => {},
	html: () => {},
	progressbar: () => {},
	fadeOut: () => {}
});
global.version = '1.0';
global.d3 = {
	csv: (filePath) => {
		const cleanPath = filePath.split('?')[0];
		const content = fs.readFileSync(cleanPath, 'utf8');
		const lines = content.split('\r\n').join('\n').split('\n').filter(Boolean);
		const headers = lines[0].split(',').map(h => h.trim());
		return lines.slice(1).map(line => {
			const values = line.split(',');
			const obj = {};
			headers.forEach((h, i) => {
				obj[h] = values[i] ? values[i].trim() : '';
			});
			return obj;
		});
	}
};
global.trace = console.log;
global.app = null;
global.window.app = null;

const normalizeCode = fs.readFileSync('normalize.js', 'utf8');
const scoreCode = fs.readFileSync('score.js', 'utf8');
const expandCode = fs.readFileSync('expandAssertions.js', 'utf8');
const appCode = fs.readFileSync('app.js', 'utf8')
	.replace(/class App \{/, 'class App {\n\tshowProgress() {}\n\thideProgress() {}\n\tinit() {}')
	.replace(/const app = new App\(\);/, '// const app = new App();')
	.replace(/window\.app = app;/, '// window.app = app;');

// Combine and evaluate
const fullCode = normalizeCode + '\n' + scoreCode + '\n' + expandCode + '\n' + appCode + '\n' + `
async function test() {
	const app = new App();
	global.app = app;
	global.window.app = app;
	await app.loadData();
	
	console.log('Total assertions loaded:', app.assertions.length);
	console.log('Total mentions loaded:', app.mentions.length);

	new window.Score();

	// Test last-name-only query for "Spears"
	const criteria = {
		factors: [
			{ field: 'first_name', value: 'William', impact: 0.2, compare: ['exact'], rare: false },
			{ field: 'last_name', value: 'Spears', impact: 0.2, compare: ['exact'], rare: false },
			{ field: 'race', value: 'W', impact: 0.2, compare: ['exact'], rare: false }
		],
		sources: { 'ALB-CN-1870': { checked: true }, 'ALB-CN-1880': { checked: true } }
	};

	const blocked = app.MakeBlockedMentions(['race', 'gender'], criteria.factors, criteria.sources);
	console.log('Blocked candidates count:', blocked.length);

	const scored = app.score.ScoreMentions(blocked, criteria.factors, criteria.sources, false, null);
	const topScored = scored.mentions.slice(0, 10).map(m => ({
		mention_id: m.mention_id,
		full_name: m.full_name,
		score: m.score
	}));
	console.log('Top 10 candidates for "William" search:', JSON.stringify(topScored, null, 2));

	const idaSpear = scored.mentions.find(m => m.mention_id === 'ALB-CN-1880-3447');
	console.log('Ida Spear details:', JSON.stringify(idaSpear, null, 2));
}

test().catch(console.error);
`;

eval(fullCode);
