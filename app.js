class App {
	constructor()                                              // CONSTRUCTOR
	{
		this.assertions = [];
		this.mentions = [];
		this.isLoaded = false;
		this.curPerson = -1;

		this.curTree = {
			treeName: "Family",
			owner: "Bill",
			person: {
				"P001": { person_id: "P001", first_name: "Mary:ALB-CN-1880-67", last_name: "Johnson:ALB-CN-1880-67", birth_year: 1820, death_year: 1890, gender: "F", x: 200, y: 200, mentions: [], relatives: [], verity: 2 },
				"P002": { person_id: "P002", first_name: "James:Added", last_name: "Johnson:ALB-CN-1870", birth_year: 1815, death_year: 1878, gender: "M:ALB-CN-1870-765", x: 500, y: 200, mentions: [], relatives: [], verity: 32 },
				"P003": { person_id: "P003", first_name: "Sarah:ALB-CN-1880-67", last_name: "Johnson:ALB-CN-1880-67", birth_year: 1845, death_year: null, gender: "F", x: 200, y: 450, mentions: [], relatives: [], verity: 2 },
				"P004": { person_id: "P004", first_name: "Thomas:ALB-CN-1880-67", last_name: "Johnson:ALB-CN-1880-67", birth_year: "1842:ALB-CN-1870.765", death_year: 1910, gender: "M", x: 500, y: 450, mentions: [], relatives: [], verity: 2 },
				"P005": { person_id: "P005", first_name: "Josh:Added", last_name: "Johnson:ALB-CN-1870", birth_year: 1872, death_year: 1940, gender: "M", x: -100, y: 200, mentions: [], relatives: [], verity: 1 }
			},
			relationships: []
		};

		this.addRelationship("P001", "isSpouseOf", "P002");
		this.addRelationship("P001", "isMotherOf", "P003");
		this.addRelationship("P001", "isMotherOf", "P004");
		this.addRelationship("P002", "isFatherOf", "P003");
		this.addRelationship("P002", "isFatherOf", "P004");
		this.addRelationship("P003", "isSiblingOf", "P004");
		this.addRelationship("P005", "isCousinOf", "P001");

		this.init();
	}

	addRelationship(subject_id, predicate, object_id)          // ADD RELATIONSHIP
	{
		const inverseMap = {
			'isMotherOf': 'isChildOf',
			'isFatherOf': 'isChildOf',
			'isChildOf': 'isParentOf',
			'isSpouseOf': 'isSpouseOf',
			'isSiblingOf': 'isSiblingOf',
			'isCousinOf': 'isCousinOf',
			'isNiblingOf': 'isNiblingOf',
		};

		// Add direct
		if (!this.curTree.relationships.some(r => r.subject_id === subject_id && r.predicate === predicate && r.object_id === object_id)) {
			this.curTree.relationships.push({ subject_id, predicate, object_id });
		}

		// Add inverse
		if (inverseMap[predicate]) {
			const invPred = inverseMap[predicate];
			if (!this.curTree.relationships.some(r => r.subject_id === object_id && r.predicate === invPred && r.object_id === subject_id)) {
				this.curTree.relationships.push({ subject_id: object_id, predicate: invPred, object_id: subject_id });
			}
		}
	}

	rebuildRelatives(personId)                                 // REBUILD RELATIVES ARRAY
	{
		if (!this.curTree.person[personId]) return;
		const relSet = new Set();
		this.curTree.relationships.forEach(r => {
			if (r.subject_id === personId) relSet.add(r.object_id);
			if (r.object_id === personId) relSet.add(r.subject_id);
		});
		this.curTree.person[personId].relatives = Array.from(relSet);
	}

	async init()                                               // INITIALIZATION
	{
		try {
			await this.loadData();
		} catch (err) {
			console.error('Data load error:', err);
		}
	}

	showProgress(message, percentage = false)                  // SHOW PROGRESS BAR
	{
		let $progressWrap = $('#loading-progress-wrap');
		if ($progressWrap.length === 0) {
			$progressWrap = $('<div id="loading-progress-wrap" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#fff; border:1px solid #ccc; box-shadow:0 4px 12px rgba(0,0,0,0.2); padding:20px; border-radius:8px; z-index:9999; width:300px; text-align:center;"></div>');
			$progressWrap.append('<div id="loading-msg" style="margin-bottom:15px; font-family:-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; font-size:14px; font-weight:600; color:#333;"></div>');
			$progressWrap.append('<div id="loading-bar"></div>');
			$('body').append($progressWrap);
			$('#loading-bar').progressbar({ value: percentage });
		}
		$('#loading-msg').text(message);
		$('#loading-bar').progressbar('value', percentage);
		$progressWrap.show();
	}

	hideProgress()                                             // HIDE PROGRESS BAR
	{
		$('#loading-progress-wrap').fadeOut();
	}

	async fetchWithProgress(url, label, maxRecords = null)     // FETCH WITH PROGRESS
	{
		// 1. Get the total count
		const headResp = await fetch(url, { method: 'HEAD', headers: { 'Prefer': 'count=exact' } });
		if (!headResp.ok) throw new Error(`Failed to count ${label}`);

		const contentRange = headResp.headers.get('content-range');
		let totalRecords = 0;
		if (contentRange) {
			// contentRange is like "0-0/5000" or "*/5000"
			const parts = contentRange.split('/');
			if (parts.length === 2) {
				totalRecords = parseInt(parts[1], 10);
			}
		}

		if (maxRecords && totalRecords > maxRecords) {
			totalRecords = maxRecords;
		}

		if (totalRecords === 0) {
			// Fallback if count is unknown
			this.showProgress(`Loading ${label}...`, false);
			const res = await fetch(url + (maxRecords ? `?limit=${maxRecords}` : ''));
			return await res.json();
		}

		// 2. Fetch in chunks
		const chunkLimit = 10000;
		let offset = 0;
		let allData = [];

		while (offset < totalRecords) {
			const percent = Math.round((offset / totalRecords) * 100);
			this.showProgress(`Loading ${label}... ${percent}%`, percent);

			const separator = url.includes('?') ? '&' : '?';
			const fetchLimit = Math.min(chunkLimit, totalRecords - offset);
			const chunkResp = await fetch(`${url}${separator}limit=${fetchLimit}&offset=${offset}`);
			if (!chunkResp.ok) throw new Error(`Failed to load chunk for ${label}`);

			const chunkData = await chunkResp.json();
			if (chunkData.length === 0) break;

			allData = allData.concat(chunkData);
			offset += chunkData.length;
		}

		this.showProgress(`Loading ${label}... 100%`, 100);
		return allData;
	}

	selectNodeAndShowEditor(personId)                          // SELECT NODE & SHOW EDITOR
	{
		if (!this.isLoaded) return;                            // Quit if not loaded
		this.curPerson = window.treeApp ? window.treeApp.state.nodes.findIndex(n => n.person_id === personId) : -1; // Set curPerson index
		window.treeApp.state.selectedPid = personId;           // Sync tree selection
		window.treeApp.updateNodeSelection();                  // Update node UI

		const rightPanel = $('#right-panel-content');          // Get right panel DOM
		rightPanel.empty().append(`
			<div id="editor-layout" style="display: flex; flex-direction: column; width: 100%; height: 100%; box-sizing: border-box; background: #e5e5e5;">
				<div class="editor-tabs" style="display: flex; background: #d4d4d4; border-bottom: 1px solid #ccc; user-select: none;">
					<div class="tab-btn tree-tab-btn" data-target="tree-view" style="padding: 10px 20px; cursor: pointer; background: #d4d4d4; border-top: 2px solid transparent; font-size: 14px; color: #666; display: none;">FAMILY TREE EDITOR</div>
					<div class="tab-btn active" data-target="person-editor-container" style="padding: 10px 20px; cursor: pointer; background: #e5e5e5; border-top: 2px solid #0078d7; font-weight: bold; font-size: 14px; color: #333;">PERSONS EDITOR</div>
					<div class="tab-btn" data-target="mentions-editor-container" style="padding: 10px 20px; cursor: pointer; background: #d4d4d4; border-top: 2px solid transparent; font-size: 14px; color: #666;">MENTIONS EDITOR</div>
				</div>
				<div id="editor-scroll-area" style="flex: 1; position: relative; overflow: hidden; background: #e5e5e5;">
					<div id="person-editor-container" class="person-editor" style="position: absolute; top:0; left:0; right:0; bottom:0; overflow-y: auto; padding: 12px; box-sizing: border-box;"></div>
					<div id="mentions-editor-container" style="position: absolute; top:0; left:0; right:0; bottom:0; overflow-y: auto; padding: 12px; box-sizing: border-box; display: none;"></div>
				</div>
			</div>
		`);

		rightPanel.find('.tab-btn').on('click', (e) => {       // ON TAB CLICK
			const target = $(e.currentTarget).attr('data-target'); // Get target ID
			rightPanel.find('.tab-btn').css({ background: '#d4d4d4', borderTopColor: 'transparent', fontWeight: 'normal', color: '#666' }).removeClass('active'); // Reset styling
			$(e.currentTarget).css({ background: '#e5e5e5', borderTopColor: '#0078d7', fontWeight: 'bold', color: '#333' }).addClass('active'); // Set active styling

			if (target === 'tree-view') {                      // If tree view tab
				document.body.classList.add('show-tree');      // Show tree
			} else {                                           // If editor tab
				document.body.classList.remove('show-tree');   // Hide tree
				rightPanel.find('#person-editor-container, #mentions-editor-container').hide(); // Hide all panels
				rightPanel.find('#' + target).show();          // Show target panel
			}
		});

		if (document.body.classList.contains('show-tree')) {   // If tree is shown
			rightPanel.find('.tab-btn[data-target="person-editor-container"]').click(); // Switch to person editor
		} else {
			document.body.classList.remove('show-tree');       // Hide tree
		}

		window.treeApp.state.nodes.forEach(n => {              // For each tree node
			this.rebuildRelatives(n.person_id);                // Rebuild relative links
		});

		let mEditor = null;                                    // Mentions editor
		const node = window.treeApp.getNode(personId);         // Get active node
		if (node) {                                            // If node exists
			node.narrative_vector = node.narrative_vector || [0.5, 0.5, 0.5]; // Init narrative
		}

		if (window.MentionsEditor) {
			const mentionsContainer = document.getElementById('mentions-editor-container');
			mEditor = new window.MentionsEditor(mentionsContainer, {
				onAdd: (pid, mentionId) => {
					const mention = mEditor.getCurrentMention();
					if (!mention) return;

					// Add mention to curTree.person
					if (this.curTree.person[pid]) {
						if (!this.curTree.person[pid].mentions.includes(mentionId)) {
							this.curTree.person[pid].mentions.push(mentionId);
						}
					}

					// Look for relationships in the mention (assuming mention.relationships or mention.relatives exists)
					const rels = mention.relationships || mention.relatives || [];
					rels.forEach(rel => {
						// rel is assumed to have a relative object and a predicate
						const relName = rel.first_name ? (rel.first_name + ' ' + rel.last_name) : 'Unknown Relative';
						if (confirm(`Do you want to add relative "${relName}" from this mention?`)) {
							// Pull data from relative's mention and add to curTree
							const newPid = 'P' + Math.floor(Math.random() * 10000); // temp id generation
							this.curTree.person[newPid] = {
								person_id: newPid,
								first_name: rel.first_name || '',
								last_name: rel.last_name || '',
								birth_year: rel.birth_year || '',
								death_year: rel.death_year || '',
								race: rel.race || '',
								gender: rel.gender || '',
								mentions: rel.mention_id ? [rel.mention_id] : [],
								relatives: []
							};

							// Add relationship
							const predicate = rel.predicate || 'RelativeOf';
							this.addRelationship(pid, predicate, newPid);
							window.treeApp.addNode(this.curTree.person[newPid]);
							window.treeApp.addTriplet(pid, predicate, newPid);
							window.treeApp.applyLayout(); window.treeApp.renderNodes(); window.treeApp.renderEdges();
						}
					});
					this.rebuildRelatives(pid);

					const n = window.treeApp.getNode(pid);
					if (n) {
						n.mentions = n.mentions || [];
						const exists = n.mentions.some(m => m.mention_id === mentionId);
						if (!exists) {
							n.mentions.push({
								mention_id: mention.mention_id,
								source: mention.source,
								label: mention.source + ' (' + mention.source_year + ')',
								field_values: {
									first_name: mention.first_name,
									last_name: mention.last_name,
									birth_year: mention.birth_year ? String(mention.birth_year) : undefined,
									death_year: mention.death_year ? String(mention.death_year) : undefined,
									gender: mention.gender === 'female' ? 'F' : (mention.gender === 'male' ? 'M' : ''),
									race: mention.race
								}
							});
							window.treeApp.isDirty = true;
							window.treeApp.selectNodeAndShowEditor(pid);
						}
					}
				}
			});

			if (node) {
				mEditor.load(node, ['ALB-CN1870', 'ALB-CN1880', 'ALB-MARR', 'ALB-TAX'], mEditor.getMockMentions(node));
			}
		}

		if (window.PersonEditor) {
			const pEditor = new window.PersonEditor($('#person-editor-container'));
			pEditor.load(personId);
			$('#person-editor-container').on('change vpe:changed vpe:rerender', () => {
				const n = window.treeApp.getNode(personId);
				if (n) {
					window.treeApp.syncEditorToNode(n);
					if (mEditor && n) {
						n.narrative_vector = n.narrative_vector || [0.5, 0.5, 0.5];
						mEditor.load(n, ['ALB-CN1870', 'ALB-CN1880', 'ALB-MARR', 'ALB-TAX'], mEditor.getMockMentions(n));
					}
				}
			});

			$('#person-editor-container').on('vpe:search', (e, criteria) => {
				if (mEditor && criteria && criteria.fields) {
					const adaptedCriteria = {};
					for (const fieldName of Object.keys(criteria.fields)) {
						const fieldVal = criteria.fields[fieldName];
						let keys = [];
						if (fieldName === 'first_name') keys = ['exactFirstName', 'fuzzyFirstName', 'rarityFirstName'];
						else if (fieldName === 'last_name') keys = ['exactLastName', 'fuzzyLastName', 'rarityLastName'];
						else if (fieldName === 'nysiis_last_name') keys = ['exactNysiisLast', 'fuzzyNysiisLast', 'rarityNysiisLast'];
						else if (fieldName === 'birth_year') keys = ['birthYear'];
						else if (fieldName === 'death_year') keys = ['deathYear'];

						keys.forEach(k => {
							adaptedCriteria[k] = {
								enabled: fieldVal.compare ? !fieldVal.compare.includes('ignore') : true,
								weight: fieldVal.weight * 2
							};
						});
					}
					mEditor.setCriteria(adaptedCriteria);
					$('#right-panel-content .tab-btn[data-target="mentions-editor-container"]').click();
				}
			});
		}
	}

	async loadData()                                           // LOAD DATA
	{
		const isTest = window.location.search.toLowerCase().includes('test');
		const maxRecords = isTest ? 1000 : null;
		this.showProgress('Connecting to database...', false);
		this.assertions = await this.fetchWithProgress('/api/assertions', 'assertions', maxRecords);
		this.mentions = await this.fetchWithProgress('/api/mentions', 'mentions', maxRecords);

		try {
			const sourceText = await (await fetch('sources.csv')).text();
			window.GlobalSources = {};
			const lines = sourceText.split('\n');
			if (lines.length > 0) {
				const headers = lines[0].split(',').map(h => h.trim());
				const displayIdx = headers.indexOf('display_name');
				if (displayIdx !== -1) {
					for (let i = 1; i < lines.length; i++) {
						// Split by comma, respecting quotes is tricky but display_name has no commas in our data
						const parts = lines[i].split(',');
						if (parts.length > displayIdx && parts[displayIdx]) {
							const name = parts[displayIdx].trim();
							window.GlobalSources[name] = true;
						}
					}
				}
			}
		} catch (err) {
			console.log('Failed to load sources.csv', err);
			window.GlobalSources = null;
		}

		this.isLoaded = true;                                  // Mark loaded
		this.showProgress(`Loaded ${this.assertions.length} assertions, ${this.mentions.length} mentions.`, 100); // Done
		setTimeout(() => this.hideProgress(), 1500);           // Hide popup

		window.PersonEditor.FAKE_PERSONS = window.PersonEditor.FAKE_PERSONS || {}; // Init fake persons
		if (window.treeApp) {                                  // If tree exists
			Object.values(this.curTree.person).forEach(p => {  // For each person
				window.PersonEditor.FAKE_PERSONS[p.person_id] = p; // Register
				if (!window.treeApp.getNode(p.person_id)) {    // If missing
					window.treeApp.addNode(p);                 // Add to tree
				}
			});
			this.curTree.relationships.forEach(r => {          // For each relationship
				if (r.predicate !== 'isChildOf' && r.predicate !== 'isParentOf' && r.predicate !== 'isUncleOf') { // Filter inverse
					window.treeApp.addTriplet(r.subject_id, r.predicate, r.object_id); // Add triplet
				}
			});
			window.treeApp.applyLayout();                      // Lay out nodes
			window.treeApp.renderNodes();                      // Draw nodes
			window.treeApp.renderEdges();                      // Draw edges
			window.treeApp.fitToScreen();                      // Fit viewport
		}

		if (window.treeApp && window.treeApp.state.nodes.length > 0) { // If nodes present
			const pid = window.treeApp.state.selectedPid || window.treeApp.state.nodes[0].person_id; // Get target PID
			window.treeApp.selectNodeAndShowEditor(pid);       // Select node
		}
	}




}
// Create a global variable 'app' that points to an instance of the App class
const app = new App();
window.app = app;
