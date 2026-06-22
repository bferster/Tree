class App {
	constructor()                                              // CONSTRUCTOR
	{
		let i, o;
		this.assertions = [];
		this.mentions = [];
		this.isLoaded = false;
		this.curPerson = -1;

		this.curTree = {
			treeName: "Family",
			owner: "Bill",
			persons: [
				{ person_id: "P001", mentions: ["ALB-CN-1880-257"], anchor: null, first_name: "William:ALB-CN-1880-257", middle_name: null, last_name: "Spears:ALB-CN-1880-257", suffix: null, birth_year: "1840:ALB-CN-1880-257", death_year: "1910:Added", gender: "M:ALB-CN-1880-257", race: "B:ALB-CN-1880-257", x: 200, y: 200, verity: 2 },
				{ person_id: "P002", mentions: ["ALB-CN-1880-258"], anchor: "isSpouseOf:P001", first_name: "Georgiana:ALB-CN-1880-258", middle_name: null, last_name: "Spears:ALB-CN-1880-258", suffix: null, birth_year: "1848:Added", death_year: "1910:Added", gender: "F: ALB- CN - 1880 - 258", race: "B: ALB - CN - 1880 - 258", x: 500, y: 200, verity: 2 },
				{ person_id: "P003", mentions: ["ALB-CN-1880-259"], anchor: "isChildOf:P001", first_name: "James:ALB-CN-1880-259", middle_name: "M:ALB-CN-1880-259", last_name: "Spears:ALB-CN-1880-259", suffix: null, birth_year: "1875:ALB-CN-1880-259", death_year: null, gender: "M", race: "B:ALB-CN-1880-259", x: 200, y: 450, verity: 2 },
				{ person_id: "P004", mentions: ["ALB-CN-1880-260"], anchor: "isChildOf:P001", first_name: "Joseph:ALB-CN-1880-260", middle_name: null, last_name: "Spears:ALB-CN-1880-260", suffix: null, birth_year: "1880:ALB-CN-1880-260", death_year: null, gender: "M", race: "B:ALB-CN-1880-260", x: 200, y: 450, verity: 2 },
			],
			relationships: []
		};

		for (i = 0; i < this.curTree.persons.length; i++) {
			o = this.curTree.persons[i];
			if (o.anchor) {
				this.addRelationship(o.person_id, o.anchor.split(":")[0], o.anchor.split(":")[1]);
			}
		}

		this.init();
	}

	addRelationship(subject_id, predicate, object_id)          // ADD RELATIONSHIP
	{
		const inverseMap = {
			'isParentOf': 'isChildOf',
			'isChildOf': 'isParentOf',
			'isSpouseOf': 'isSpouseOf',
			'isSiblingOf': 'isSiblingOf',
			'isCousinOf': 'isCousinOf',
			'isNiblingOf': 'isNiblingOf',
		};

		// Add direct
		let added = false;
		if (!this.curTree.relationships.some(r => r.subject_id === subject_id && r.predicate === predicate && r.object_id === object_id)) {
			this.curTree.relationships.push({ subject_id, predicate, object_id });
			added = true;
		}

		// Add inverse
		if (inverseMap[predicate]) {
			const invPred = inverseMap[predicate];
			if (!this.curTree.relationships.some(r => r.subject_id === object_id && r.predicate === invPred && r.object_id === subject_id)) {
				this.curTree.relationships.push({ subject_id: object_id, predicate: invPred, object_id: subject_id });
				added = true;
			}
		}

		if (!added) return; // Prevent infinite recursion!
		// Automatically infer siblings
		if (predicate === 'isChildOf') {
			// 1. If adding a child to a parent, the child becomes a sibling to all other children of that parent
			const siblings = this.curTree.relationships
				.filter(r => r.predicate === 'isChildOf' && r.object_id === object_id && r.subject_id !== subject_id)
				.map(r => r.subject_id);
			siblings.forEach(siblingPid => {
				this.addRelationship(subject_id, 'isSiblingOf', siblingPid);
			});

			// 2. If adding a child to a parent who has a spouse, automatically link the child to the spouse as well.
			const spouses = this.curTree.relationships
				.filter(r => r.predicate === 'isSpouseOf' && r.subject_id === object_id)
				.map(r => r.object_id);
			spouses.forEach(spousePid => {
				this.addRelationship(subject_id, 'isChildOf', spousePid);
			});

			// 3. If adding a parent to a child who already has siblings, automatically link the siblings to the new parent
			const childSiblings = this.curTree.relationships
				.filter(r => r.predicate === 'isSiblingOf' && r.subject_id === subject_id)
				.map(r => r.object_id);
			childSiblings.forEach(siblingPid => {
				this.addRelationship(siblingPid, 'isChildOf', object_id);
			});

			// 4. If adding a parent to a child who already has another parent, automatically link the new parent to the other parent as a spouse
			const otherParents = this.curTree.relationships
				.filter(r => r.predicate === 'isChildOf' && r.subject_id === subject_id && r.object_id !== object_id)
				.map(r => r.object_id);
			otherParents.forEach(otherParentPid => {
				this.addRelationship(object_id, 'isSpouseOf', otherParentPid);
			});
		} else if (predicate === 'isSiblingOf') {
			// Infer parents for the new sibling
			const parents = this.curTree.relationships
				.filter(r => r.predicate === 'isChildOf' && r.subject_id === subject_id)
				.map(r => r.object_id);
			parents.forEach(parentPid => {
				this.addRelationship(object_id, 'isChildOf', parentPid);
			});

			const siblings = this.curTree.relationships
				.filter(r => r.predicate === 'isSiblingOf' && r.subject_id === subject_id && r.object_id !== object_id)
				.map(r => r.object_id);
			siblings.forEach(siblingPid => {
				this.addRelationship(object_id, 'isSiblingOf', siblingPid);
			});
		} else if (predicate === 'isSpouseOf') {
			// Infer children for the new spouse
			const children = this.curTree.relationships
				.filter(r => r.predicate === 'isParentOf' && r.subject_id === subject_id)
				.map(r => r.object_id);
			children.forEach(childPid => {
				this.addRelationship(object_id, 'isParentOf', childPid);
			});
		} else if (predicate === 'isParentOf') {
			const siblings = this.curTree.relationships
				.filter(r => r.predicate === 'isParentOf' && r.subject_id === subject_id && r.object_id !== object_id)
				.map(r => r.object_id);
			siblings.forEach(siblingPid => {
				this.addRelationship(object_id, 'isSiblingOf', siblingPid);
			});

			// Infer spouse as another parent
			const spouses = this.curTree.relationships
				.filter(r => r.predicate === 'isSpouseOf' && r.subject_id === subject_id)
				.map(r => r.object_id);
			spouses.forEach(spousePid => {
				this.addRelationship(spousePid, 'isParentOf', object_id);
			});
		} else if (predicate === 'isSpouseOf') {
			// Cross-link existing children if a spouse is added later
			const children1 = this.curTree.relationships
				.filter(r => r.predicate === 'isParentOf' && r.subject_id === subject_id)
				.map(r => r.object_id);
			children1.forEach(childPid => {
				this.addRelationship(object_id, 'isParentOf', childPid);
			});
			const children2 = this.curTree.relationships
				.filter(r => r.predicate === 'isParentOf' && r.subject_id === object_id)
				.map(r => r.object_id);
			children2.forEach(childPid => {
				this.addRelationship(subject_id, 'isParentOf', childPid);
			});
		}
	}

	rebuildRelatives(personId)                                 // REBUILD RELATIVES ARRAY
	{
		const p = Array.isArray(this.curTree.persons) ? this.curTree.persons.find(x => x.person_id === personId) : this.curTree.persons[personId];
		if (!p) return;
		const relSet = new Set();
		this.curTree.relationships.forEach(r => {
			if (r.subject_id === personId) relSet.add(r.object_id);
			if (r.object_id === personId) relSet.add(r.subject_id);
		});
		p.relatives = Array.from(relSet);
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

	selectNodeAndShowEditor(personId, forceTab = null)                          // SELECT NODE & SHOW EDITOR
	{
		if (!this.isLoaded) return;                            // Quit if not loaded
		this.curPerson = window.treeApp ? window.treeApp.state.nodes.findIndex(n => n.person_id === personId) : -1; // Set curPerson index
		window.treeApp.state.selectedPid = personId;           // Sync tree selection
		window.treeApp.UpdateNodeSelection();                  // Update node UI

		const rightPanel = $('#right-panel-content');          // Get right panel DOM
		let currentActiveTab = forceTab || rightPanel.find('.tab-btn.active').attr('data-target') || 'person-editor-container';
		rightPanel.empty().append(`
			<div id="editor-layout" style="display: flex; flex-direction: column; width: 100%; height: 100%; box-sizing: border-box; background: #e5e5e5;">
				<div class="editor-tabs" style="display: flex; background: #d4d4d4; border-bottom: 1px solid #ccc; user-select: none;">
					<div class="tab-btn tree-tab-btn" data-target="tree-view" style="padding: 10px 20px; cursor: pointer; background: #d4d4d4; border-top: 2px solid transparent; font-size: 14px; color: #666; display: none;">FAMILY TREE</div>
					<div class="tab-btn active" data-target="person-editor-container" style="padding: 10px 20px; cursor: pointer; background: #e5e5e5; border-top: 2px solid #0078d7; font-weight: bold; font-size: 14px; color: #333;">PERSON EDITOR</div>
					<div class="tab-btn" data-target="mentions-editor-container" style="padding: 10px 20px; cursor: pointer; background: #d4d4d4; border-top: 2px solid transparent; font-size: 14px; color: #666;">MENTIONS</div>
					<div class="tab-btn" data-target="sources-editor-container" style="padding: 10px 20px; cursor: pointer; background: #d4d4d4; border-top: 2px solid transparent; font-size: 14px; color: #666;">SOURCES</div>
					<div class="tab-btn" data-target="familysearch-editor-container" style="padding: 10px 20px; cursor: pointer; background: #d4d4d4; border-top: 2px solid transparent; font-size: 14px; color: #666;">FAMILY-SEARCH</div>
				</div>
				<div id="editor-scroll-area" style="flex: 1; position: relative; overflow: hidden; background: #e5e5e5;">
					<div id="person-editor-container" class="person-editor" style="position: absolute; top:0; left:0; right:0; bottom:0; overflow-y: auto; padding: 12px; box-sizing: border-box;"></div>
					<div id="mentions-editor-container" style="position: absolute; top:0; left:0; right:0; bottom:0; overflow-y: auto; padding: 12px; box-sizing: border-box; display: none;"></div>
					<div id="sources-editor-container" style="position: absolute; top:0; left:0; right:0; bottom:0; overflow: hidden; box-sizing: border-box; display: none;">
						<iframe src="https://stagetools.com/verite/search/" style="width: 100%; height: 100%; border: none;"></iframe>
					</div>
					<div id="familysearch-editor-container" style="position: absolute; top:0; left:0; right:0; bottom:0; overflow: hidden; box-sizing: border-box; display: none;">
					<br><br><p style="text-align:center">To be added soon!</p>
					</div>
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
				rightPanel.find('#person-editor-container, #mentions-editor-container, #sources-editor-container, #familysearch-editor-container').hide(); // Hide all panels
				rightPanel.find('#' + target).show();          // Show target panel
			}
		});

		if (document.body.classList.contains('show-tree')) {   // If tree is shown
			rightPanel.find('.tab-btn[data-target="' + currentActiveTab + '"]').click(); // Restore active tab
		} else {
			document.body.classList.remove('show-tree');       // Hide tree
		}

		window.treeApp.state.nodes.forEach(n => {              // For each tree node
			this.rebuildRelatives(n.person_id);                // Rebuild relative links
		});

		let mEditor = null;                                    // Mentions editor
		const node = window.treeApp.GetNode(personId);         // Get active node
		if (node) {                                            // If node exists
			node.narrative_vector = node.narrative_vector || [0.5, 0.5, 0.5]; // Init narrative
		}

		if (window.MentionsEditor) {
			const mentionsContainer = document.getElementById('mentions-editor-container');
			mEditor = new window.MentionsEditor(mentionsContainer, {
				onAdd: (pid, mentionId) => {
					const mention = mEditor.getCurrentMention();
					if (!mention) return;

					// Add mention to curTree.persons
					if (this.curTree.persons[pid]) {
						if (!this.curTree.persons[pid].mentions.includes(mentionId)) {
							this.curTree.persons[pid].mentions.push(mentionId);
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
							this.curTree.persons[newPid] = {
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
							window.treeApp.AddNode(this.curTree.persons[newPid]);
							window.treeApp.AddTriplet(pid, predicate, newPid);
							window.treeApp.ApplyLayout(); window.treeApp.RenderNodes(); window.treeApp.RenderEdges();
						}
					});
					this.rebuildRelatives(pid);

					/*					const n = window.treeApp.GetNode(pid);
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
												window.treeApp.SelectNodeAndShowEditor(pid);
											}
										}
						*/
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
				const n = window.treeApp.GetNode(personId);
				if (n) {
					window.treeApp.SyncEditorToNode(n);
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

		if (isTest) {
			this.showProgress('Loading data from CSV...', false);
			this.assertions = await d3.csv('img/assertions.csv');
			this.mentions = await d3.csv('img/mentions.csv');
		}
		else {
			this.showProgress('Connecting to database...', false);
			this.assertions = await this.fetchWithProgress('/api/assertions', 'assertions');
			this.mentions = await this.fetchWithProgress('/api/mentions', 'mentions');
		}

		this.BuildNameFrequencies(this.mentions);

		try {
			const sourceText = await (await fetch('img/sources.csv')).text();
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
							if (name) window.GlobalSources[name] = true;
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

		if (window.treeApp) {                                  // If tree exists
			Object.values(this.curTree.persons).forEach(p => {  // For each person
				if (!window.treeApp.GetNode(p.person_id)) {    // If missing
					window.treeApp.AddNode(p);                 // Add to tree
				}
			});
			this.curTree.relationships.forEach(r => {          // For each relationship
				if (r.predicate !== 'isChildOf' && r.predicate !== 'isUncleOf') { // Filter inverse
					window.treeApp.AddTriplet(r.subject_id, r.predicate, r.object_id); // Add triplet
				}
			});
			window.treeApp.ApplyLayout();                      // Lay out nodes
			window.treeApp.RenderNodes();                      // Draw nodes
			window.treeApp.RenderEdges();                      // Draw edges
			window.treeApp.FitToScreen();                      // Fit viewport
		}

		if (window.treeApp && window.treeApp.state.nodes.length > 0) { // If nodes present
			const pid = window.treeApp.state.selectedPid || window.treeApp.state.nodes[0].person_id; // Get target PID
			window.treeApp.SelectNodeAndShowEditor(pid);       // Select node
		}
	}


	BuildNameFrequencies(dataset)                                  // BUILD NAME FREQ MAPS
	{
		app.firstNameFreq = new Map();
		app.lastNameFreq = new Map();
		dataset.forEach(p => {
			const f = (p.first_name || '').toLowerCase().trim();
			const l = (p.last_name || p['last-_name'] || '').toLowerCase().trim();
			if (f) app.firstNameFreq.set(f, (app.firstNameFreq.get(f) || 0) + 1);
			if (l) app.lastNameFreq.set(l, (app.lastNameFreq.get(l) || 0) + 1);
		});
	}

	GetNameWeightModifier(name, freqMap)                            // GET RARITY MODIFIER
	{
		if (!name || !freqMap) return 0;                            	// Missing/Not in map
		const n = name.toLowerCase().trim();                      		// Convert to lower case
		const count = freqMap.get(n) || 0;                          	// Get count from map
		if (count === 0) return 0.0;                                 // Missing/Not in map
		if (count <= 5) return 1.0;                                 // Very Rare
		if (count <= 20) return .5;                                  // Uncommon
		if (count >= 21 && count <= 100) return 0.0;                	// Average (Wait, spec said 21-100 is 0, so explicit return 0)
		if (count > 500) return -1.0;                              	// Extremely Common
		if (count > 100) return -.5;                                	// Common
		return 0.0;                                               		// Fallback
	}

}

const app = new App();												// Create a global variable 'app' points to an instance of the App class
window.app = app;
