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
	progressbar: () => {}
});

const expandCode = fs.readFileSync('ExpandAssertions.js', 'utf8');
const appCode = fs.readFileSync('app.js', 'utf8').replace(/class App \{/, 'class App {\n\tshowProgress() {}\n\thideProgress() {}');

// Combine and evaluate
const fullCode = expandCode + '\n' + appCode + '\n' + `
global.d3 = {
	csv: (filePath) => {
		const content = fs.readFileSync(filePath, 'utf8');
		const lines = content.split('\\r\\n').join('\\n').split('\\n').filter(Boolean);
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

async function test() {
	const app = new App();
	await app.loadData();
	
	console.log('Total assertions loaded:', app.assertions.length);
	
	const expand = new ExpandAssertions(app.assertions);
	const results = expand.viewFor('ALB-CN-1870-1688');
	console.log('Querying for ALB-CN-1870-1688 results:', JSON.stringify(results, null, 2));
}

test().catch(console.error);
`;

eval(fullCode);
