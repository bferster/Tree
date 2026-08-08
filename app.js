class App {
	constructor()                                              // CONSTRUCTOR
	{
		let i, o;
		this.assertions = [];
		this.mentions = [];
		this.isLoaded = false;
		this.curPerson = -1;
		this.county = "AUG";
		this.source = "CN-1870";

		this.curTree = {
			treeName: "Family",
			county: "AUG",
			owner: "Bill",
			persons: [ /*
				{ person_id: "P001", mentions: ["ALB-CN-1880-257"], anchor: null, first_name: "William:ALB-CN-1880-257", middle_name: null, last_name: "Spears:ALB-CN-1880-257", suffix: null, birth_year: "1840:ALB-CN-1880-257", death_year: "1910:Added", gender: "M:ALB-CN-1880-257", race: "B:ALB-CN-1880-257", x: 200, y: 200, verity: 2, isEnslaver: false },
				{ person_id: "P002", mentions: ["ALB-CN-1880-258"], anchor: "isSpouseOf:P001", first_name: "Georgeanna:ALB-CN-1880-258", middle_name: null, last_name: "Spears:ALB-CN-1880-258", suffix: null, birth_year: "1848:Added", death_year: "1910:Added", gender: "F: ALB- CN - 1880 - 258", race: "B: ALB - CN - 1880 - 258", x: 500, y: 200, verity: 2, isEnslaver: false },
				{ person_id: "P003", mentions: ["ALB-CN-1880-259"], anchor: "isChildOf:P001", first_name: "James:ALB-CN-1880-259", middle_name: "M:ALB-CN-1880-259", last_name: "Spears:ALB-CN-1880-259", suffix: null, birth_year: "1875:ALB-CN-1880-259", death_year: null, gender: "M", race: "B:ALB-CN-1880-259", x: 200, y: 450, verity: 2, isEnslaver: false },
				{ person_id: "P004", mentions: ["ALB-CN-1880-260"], anchor: "isChildOf:P001", first_name: "Joseph:ALB-CN-1880-260", middle_name: null, last_name: "Spears:ALB-CN-1880-260", suffix: null, birth_year: "1880:ALB-CN-1880-260", death_year: null, gender: "M", race: "B:ALB-CN-1880-260", x: 200, y: 450, verity: 2, isEnslaver: false },
				{ person_id: "P005", mentions: ["ALB-CN-1880-22721"], anchor: "isEnslaverOf:P002", first_name: "Dabney:ALB-CN-1880-22721", middle_name: null, last_name: "Johnson:ALB-CN-1880-22721", suffix: null, birth_year: "1832:ALB-CN-1870-1688", death_year: "", gender: "M: ALB- CN - 1880 - 22721", race: "B: ALB - CN - 1880 - 22721", x: 200, y: 200, verity: 2, isEnslaver: true },
*/
			],
			relationships: []
		};
		this.processLoadedPersons();
		this.init();
	}

	processLoadedPersons()                                     // PROCESS ENSLAVER ANCHORS AND RELATIONSHIPS
	{
		if (!this.curTree || !this.curTree.persons) return;
		const persons = Array.isArray(this.curTree.persons) ? this.curTree.persons : Object.values(this.curTree.persons);
		if (!Array.isArray(this.curTree.relationships)) {
			this.curTree.relationships = [];
		}

		persons.forEach(p => {
			if (p.isEnslaver) {
				let targetPid = null;
				if (p.anchor && p.anchor.includes(':')) {
					targetPid = p.anchor.split(':')[1];
				} else if (p.anchor) {
					targetPid = p.anchor;
				}

				if (!targetPid) {
					const rel = this.curTree.relationships.find(r => r.subject_id === p.person_id && (r.predicate === 'isEnslaverOf' || r.predicate === 'enslaves'));
					if (rel) targetPid = rel.object_id;
				}

				if (targetPid) {
					p.anchor = `isEnslaverOf:${targetPid}`;

					const relObj = {
						subject_id: p.person_id,
						predicate: 'isEnslaverOf',
						object_id: targetPid
					};
					const exists = this.curTree.relationships.some(
						r => r.subject_id === relObj.subject_id && r.predicate === relObj.predicate && r.object_id === relObj.object_id
					);
					if (!exists) {
						this.curTree.relationships.push(relObj);
					}
				}
			}
		});
	}


	findMention(mention_id)                                      // FIND MENTION
	{
		return this.mentions.find(m => m.mention_id === mention_id);
	}


	rebuildAllRelationships()                                  // REBUILD FROM ExpandAssertions
	{
		this.processLoadedPersons();
		const mentionToPerson = new Map();
		const persons = Array.isArray(this.curTree.persons) ? this.curTree.persons : Object.values(this.curTree.persons);

		persons.forEach(p => {
			if (p.mentions) {
				p.mentions.forEach(mid => mentionToPerson.set(mid, p.person_id));
			}
		});

		const newRelationships = [];
		const added = new Set();

		// Preserve existing relationships in curTree.relationships
		if (Array.isArray(this.curTree.relationships)) {
			this.curTree.relationships.forEach(r => {
				const key = `${r.subject_id}|${r.predicate}|${r.object_id}`;
				if (!added.has(key)) {
					added.add(key);
					newRelationships.push(r);
				}
			});
		}

		// Preserve relationships defined in person anchors (e.g. isEnslaverOf:P003)
		persons.forEach(p => {
			if (p.anchor && p.anchor.includes(':')) {
				const parts = p.anchor.split(':');
				const pred = parts[0];
				const targetPid = parts[1];
				if (pred && targetPid && targetPid !== p.person_id) {
					const key = `${p.person_id}|${pred}|${targetPid}`;
					if (!added.has(key)) {
						added.add(key);
						newRelationships.push({
							subject_id: p.person_id,
							predicate: pred,
							object_id: targetPid
						});
					}
				}
			}
		});

		// Pull in ExpandAssertions relationships
		if (this.expand) {
			let nextPidNum = 1;
			persons.forEach(p => {
				if (p.person_id && p.person_id.startsWith('P')) {
					const n = parseInt(p.person_id.substring(1), 10);
					if (!isNaN(n) && n >= nextPidNum) nextPidNum = n + 1;
				}
			});

			persons.forEach(p => {
				if (!p.mentions) return;
				p.mentions.forEach(mid => {
					const view = this.expand.viewFor(mid);
					if (view && view.results) {
						view.results.forEach(res => {
							if (!res.mention_id) return;
							let targetPid = mentionToPerson.get(res.mention_id);
							if (!targetPid) {
								const pred = res.predicate;
								if (['isChildOf', 'isParentOf', 'isSiblingOf', 'isSpouseOf'].includes(pred)) {
									const relM = this.mentions.find(m => m.mention_id === res.mention_id);
									if (relM) {
										targetPid = `P${String(nextPidNum++).padStart(3, '0')}`;
										const fname = (relM.first_name || '').trim();
										const lname = (relM.last_name || '').trim();
										const newP = {
											person_id: targetPid,
											first_name: fname ? `${fname}:${relM.mention_id}` : undefined,
											last_name: lname ? `${lname}:${relM.mention_id}` : undefined,
											birth_year: relM.birth_year ? `${relM.birth_year}:${relM.mention_id}` : undefined,
											gender: relM.gender ? `${relM.gender}:${relM.mention_id}` : undefined,
											race: (relM.norm_race || relM.race) ? `${relM.norm_race || relM.race}:${relM.mention_id}` : undefined,
											mentions: [relM.mention_id]
										};
										mentionToPerson.set(relM.mention_id, targetPid);
										persons.push(newP);

										if (window.treeApp && !window.treeApp.GetNode(targetPid)) {
											window.treeApp.AddNode(newP);
										}
									}
								}
							}

							if (targetPid && targetPid !== p.person_id) {
								const pred = res.predicate;
								if (['isChildOf', 'isParentOf', 'isSiblingOf', 'isSpouseOf', 'isEnslaverOf', 'wasEnslavedBy', 'enslaves'].includes(pred)) {
									const key = `${p.person_id}|${pred}|${targetPid}`;
									if (!added.has(key)) {
										added.add(key);
										newRelationships.push({
											subject_id: p.person_id,
											predicate: pred,
											object_id: targetPid
										});
									}
								}
							}
						});
					}
				});
			});
		}

		this.curTree.relationships = newRelationships;

		// Sync to treeApp
		if (window.treeApp && window.treeApp.state) {
			window.treeApp.state.triplets = [];
			this.curTree.relationships.forEach(r => {
				if (r.predicate !== 'isChildOf' && r.predicate !== 'isUncleOf') {
					window.treeApp.state.triplets.push({ subject: r.subject_id, predicate: r.predicate, object: r.object_id });
				}
			});
		}
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
		let totalRecords = 0;
		try {
			// 1. Get the total count
			const headResp = await fetch(url, { method: 'HEAD', headers: { 'Prefer': 'count=exact' } });
			if (headResp.ok) {
				const contentRange = headResp.headers.get('content-range');
				if (contentRange) {
					// contentRange is like "0-0/5000" or "*/5000"
					const parts = contentRange.split('/');
					if (parts.length === 2) {
						totalRecords = parseInt(parts[1], 10);
					}
				}
			} else {
				console.warn(`HEAD count request returned HTTP ${headResp.status} for ${label}`);
			}
		} catch (err) {
			console.warn(`HEAD count request failed for ${label}:`, err);
		}

		if (maxRecords && totalRecords > maxRecords) {
			totalRecords = maxRecords;
		}

		if (totalRecords === 0) {
			// Fallback if count is unknown
			this.showProgress(`Loading ${label}...`, false);
			const separator = url.includes('?') ? '&' : '?';
			const res = await fetch(url + (maxRecords ? `${separator}limit=${maxRecords}` : ''));
			if (!res.ok) throw new Error(`Failed to load ${label}: ${res.status} ${res.statusText}`);
			return await res.json();
		}

		// 2. Fetch in chunks
		const chunkLimit = 10000;
		const separator = url.includes('?') ? '&' : '?';
		const fetchPromises = [];
		let loadedRecords = 0;
		let allData = [];

		for (let offset = 0; offset < totalRecords; offset += chunkLimit) {
			const fetchLimit = Math.min(chunkLimit, totalRecords - offset);
			const promise = fetch(`${url}${separator}limit=${fetchLimit}&offset=${offset}`)
				.then(res => {
					if (!res.ok) throw new Error(`Failed to load chunk for ${label}`);
					return res.json();
				})
				.then(chunkData => {
					loadedRecords += chunkData.length;
					const percent = Math.round((loadedRecords / totalRecords) * 100);
					this.showProgress(`Loading ${label}... ${percent}%`, percent);
					return { offset, data: chunkData };
				});
			fetchPromises.push(promise);
		}

		const chunkResults = await Promise.all(fetchPromises);
		// Sort results by offset to ensure original order is maintained
		chunkResults.sort((a, b) => a.offset - b.offset);
		for (const chunk of chunkResults) {
			allData = allData.concat(chunk.data);
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

		if (rightPanel.find('#editor-layout').length === 0) {
			rightPanel.empty().append(`
				<div id="editor-layout" style="display: flex; flex-direction: column; width: 100%; height: 100%; box-sizing: border-box; background: #e5e5e5;">
					<div class="editor-tabs" style="display: flex; background: #d4d4d4; border-bottom: 1px solid #ccc; user-select: none;">
						<div class="tab-btn tree-tab-btn" data-target="tree-view" style="padding: 10px 20px; cursor: pointer; background: #d4d4d4; border-top: 2px solid transparent; font-size: 14px; color: #666; display: none;">FAMILY TREE</div>
						<div class="tab-btn active" data-target="person-editor-container" style="padding: 10px 20px; cursor: pointer; background: #e5e5e5; border-top: 2px solid #0078d7; font-weight: bold; font-size: 14px; color: #333;">PERSON EDITOR</div>
						<div class="tab-btn" data-target="mentions-editor-container" style="padding: 10px 20px; cursor: pointer; background: #d4d4d4; border-top: 2px solid transparent; font-size: 14px; color: #666;">MENTIONS</div>
						<div class="tab-btn" data-target="sources-editor-container" style="padding: 10px 20px; cursor: pointer; background: #d4d4d4; border-top: 2px solid transparent; font-size: 14px; color: #666;">CONTEXT</div>
						<div class="tab-btn" data-target="chat-editor-container" style="padding: 10px 20px; cursor: pointer; background: #d4d4d4; border-top: 2px solid transparent; font-size: 14px; color: #666;">AI-CHAT</div>
					</div>
					<div id="editor-scroll-area" style="flex: 1; position: relative; overflow: hidden; background: #e5e5e5;">
						<div id="person-editor-container" class="person-editor" style="position: absolute; top:0; left:0; right:0; bottom:0; overflow-y: auto; padding: 12px; box-sizing: border-box;"></div>
						<div id="mentions-editor-container" style="position: absolute; top:0; left:0; right:0; bottom:0; overflow-y: auto; padding: 12px; box-sizing: border-box; display: none;"></div>
						<div id="sources-editor-container" style="position: absolute; top:0; left:0; right:0; bottom:0; overflow: hidden; box-sizing: border-box; display: none;">
							<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #888; font-size: 16px;">No context yet...</div>
						</div>
						<div id="chat-editor-container" style="position: absolute; top:0; left:0; right:0; bottom:0; overflow: hidden; box-sizing: border-box; display: none;">
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
					rightPanel.find('#person-editor-container, #mentions-editor-container, #sources-editor-container, #chat-editor-container').hide(); // Hide all panels
					rightPanel.find('#' + target).show();          // Show target panel

					if (target === 'sources-editor-container') {
						const hasGrid = $('#sources-editor-container').find('.data-grid').length > 0;
						if (!hasGrid) {
							const currentSource = (typeof GetCurrentSource === 'function') ? GetCurrentSource() : null;
							if (currentSource && typeof ShowSource === 'function') {
								ShowSource(currentSource);
							}
						}
					}
				}
			});
		}

		if (!document.body.classList.contains('show-tree')) {
			document.body.classList.remove('show-tree');       // Hide tree
		}
		rightPanel.find('.tab-btn[data-target="' + currentActiveTab + '"]').click(); // Restore active tab



		let mEditor = this.mentionsEditor || null;
		let pEditor = this.personEditor || null;
		const node = window.treeApp.GetNode(personId);         // Get active node
		if (node) {                                            // If node exists
			node.narrative_vector = node.narrative_vector || [0.5, 0.5, 0.5]; // Init narrative
		}

		const mentionsContainer = document.getElementById('mentions-editor-container');

		if (!this.score && window.Score) {
			new window.Score();
		}

		if (window.MentionsEditor && !mEditor) {
			mEditor = new window.MentionsEditor(mentionsContainer, {
				onAdd: (pid, mentionId) => {
					const mention = mEditor.getCurrentMention();
					if (!mention) return;

					const fillFields = (personObj) => {
						const fields = ['first_name', 'middle_name', 'last_name', 'suffix', 'birth_year', 'death_year', 'gender', 'race'];
						fields.forEach(field => {
							const curVal = personObj[field];
							const isNullOrAdded = (!curVal || (typeof curVal === 'string' && (!curVal.includes(':') || /:.*added/i.test(curVal))));
							let mVal = mention[field];
							if (isNullOrAdded && mVal) {
								personObj[field] = `${mVal}:${mention.mention_id}`;
							}
						});
					};

					// Add mention to curTree.persons
					const canonicalPerson = this.curTree.persons.find(p => p.person_id === pid);
					if (canonicalPerson) {
						if (!canonicalPerson.mentions) canonicalPerson.mentions = [];
						if (!canonicalPerson.mentions.includes(mentionId)) {
							canonicalPerson.mentions.push(mentionId);
						}
						fillFields(canonicalPerson);
					}

					// Add mention to the tree node (curPerson)
					const treeNode = window.treeApp ? window.treeApp.GetNode(pid) : null;
					if (treeNode) {
						if (!treeNode.mentions) treeNode.mentions = [];
						if (!treeNode.mentions.includes(mentionId)) {
							treeNode.mentions.push(mentionId);
						}
						fillFields(treeNode);
					}

					// Rebuild relationships from all attached mentions
					this.rebuildAllRelationships();

					if (window.treeApp) {
						window.treeApp.RenderNodes();
						window.treeApp.RenderEdges();
					}

					if (this.personEditor) {
						this.personEditor.load(pid);
					}
				},
				onRemove: (pid, mentionId) => {
					// Remove mention from curTree.persons
					const canonicalPerson = this.curTree.persons.find(p => p.person_id === pid);
					if (canonicalPerson && Array.isArray(canonicalPerson.mentions)) {
						canonicalPerson.mentions = canonicalPerson.mentions.filter(id => id !== mentionId);
					}

					// Remove mention from the tree node (curPerson)
					const treeNode = window.treeApp ? window.treeApp.GetNode(pid) : null;
					if (treeNode && Array.isArray(treeNode.mentions)) {
						treeNode.mentions = treeNode.mentions.filter(id => id !== mentionId);
					}

					// Rebuild relationships after mention removal
					this.rebuildAllRelationships();

					if (window.treeApp) {
						window.treeApp.RenderNodes();
						window.treeApp.RenderEdges();
					}

					if (this.personEditor) {
						this.personEditor.load(pid);
					}
				}
			});
			this.mentionsEditor = mEditor;

			window.treeApp.onNodeSelected = (node) => {
				if (this.personEditor) this.personEditor.load(node.person_id);
				if (this.mentionsEditor) this.mentionsEditor.load(node, [], []);
			};
		}

		if (window.PersonEditor && !pEditor) {
			pEditor = new window.PersonEditor($('#person-editor-container'));
			this.personEditor = pEditor;

			$('#person-editor-container').on('change vpe:changed vpe:rerender', () => {
				const currentPid = window.treeApp.state.selectedPid;
				const n = window.treeApp.GetNode(currentPid);
				if (n) {
					window.treeApp.SyncEditorToNode(n);
					if (this.mentionsEditor && n) {
						this.mentionsEditor.load(n, [], []);
					}
				}
			});

			$('#person-editor-container').on('vpe:search', (e, criteria) => {
				if (criteria && criteria.factors) {
					// Check if searching on slave schedule sources (SS-1850 or SS-1860)
					const slaveScheduleSources = (criteria.sources || []).filter(s => s.includes('SS-1850') || s.includes('SS-1860'));
					const isSlaveScheduleSearch = slaveScheduleSources.length > 0;

					if (isSlaveScheduleSearch) {
						// GroupMatcher requires the current person to have a mention from 1870 census
						const targetPerson = this.curTree ? (Array.isArray(this.curTree.persons) ? this.curTree.persons.find(p => p.person_id === criteria.person_id) : this.curTree.persons[criteria.person_id]) : null;
						const treeNode = window.treeApp ? window.treeApp.GetNode(criteria.person_id) : null;
						const personMentions = (treeNode && treeNode.mentions) || (targetPerson && targetPerson.mentions) || [];

						let has1870Mention = false;
						const mentionsList = personMentions.map(m => typeof m === 'object' ? m : (this.mentions ? this.mentions.find(x => x.mention_id === m) : null)).filter(Boolean);
						for (const m of mentionsList) {
							if (m.source && (m.source.includes('1870') || m.source.includes('CN-1870'))) {
								has1870Mention = true;
								break;
							}
						}

						if (!has1870Mention) {
							alert('Warning: The current person does not have a mention that refers to the 1870 census. GroupMatcher requires an 1870 census family to match against.');
							return;
						}

						this.showProgress("Matching slave schedule with GroupMatcher...", 25);
						setTimeout(() => {
							// Build family1870 structure from target person and relatives
							const familyMembers = [];

							// Add target person
							const tpFirstName = (targetPerson && targetPerson.first_name ? targetPerson.first_name.split(':')[0] : (treeNode && treeNode.first_name ? treeNode.first_name.split(':')[0] : '')) || undefined;
							const tpLastName = (targetPerson && targetPerson.last_name ? targetPerson.last_name.split(':')[0] : (treeNode && treeNode.last_name ? treeNode.last_name.split(':')[0] : '')) || undefined;
							const tpBirthYear = targetPerson && targetPerson.birth_year ? Number(String(targetPerson.birth_year).split(':')[0]) : (treeNode && treeNode.birth_year ? Number(String(treeNode.birth_year).split(':')[0]) : undefined);
							const tpGender = targetPerson && targetPerson.gender ? targetPerson.gender.split(':')[0] : (treeNode && treeNode.gender ? treeNode.gender.split(':')[0] : undefined);
							const tpRace = targetPerson && targetPerson.race ? targetPerson.race.split(':')[0] : (treeNode && treeNode.race ? treeNode.race.split(':')[0] : undefined);

							let tpHouseholdId = undefined;
							if (personMentions.length > 0) {
								const firstPM = this.mentions.find(x => x.mention_id === personMentions[0]);
								if (firstPM) {
									tpHouseholdId = firstPM.household_id || firstPM.householdId;
								}
							}

							familyMembers.push({
								personId: criteria.person_id,
								firstName: tpFirstName,
								lastName: tpLastName,
								birthYear: isNaN(tpBirthYear) ? undefined : tpBirthYear,
								gender: tpGender,
								race: tpRace,
								householdId: tpHouseholdId
							});

							// Add household/family members linked via expandAssertions or tree
							if (this.expand && personMentions.length > 0) {
								const uniqueRelPids = new Set();
								personMentions.forEach(mid => {
									const view = this.expand.viewFor(mid);
									if (view && view.results) {
										view.results.forEach(res => {
											if (res.mention_id && !personMentions.includes(res.mention_id)) {
												const relM = this.mentions.find(x => x.mention_id === res.mention_id);
												if (relM) {
													const rBY = relM.birth_year != null ? Number(relM.birth_year) : undefined;
													familyMembers.push({
														mentionId: relM.mention_id,
														firstName: relM.first_name || undefined,
														lastName: relM.last_name || undefined,
														birthYear: isNaN(rBY) ? undefined : rBY,
														gender: relM.gender,
														race: relM.norm_race || relM.race,
														householdId: relM.household_id || relM.householdId
													});
												}
											}
										});
									}
								});
							}

							const family1870 = {
								familyId: `FC1870-${criteria.person_id}`,
								county: this.county || 'AUG',
								members: familyMembers
							};

							// Filter slave schedule mentions for the requested source(s)
							const sourceTag = slaveScheduleSources[0].includes('1850') ? 'SS-1850' : 'SS-1860';
							const blockedMentions = this.MakeBlockedMentions([], criteria.factors, criteria.sources);

							const groupMatcher = new GroupMatcher();
							const groupResults = groupMatcher.matchAll(blockedMentions, family1870, { sourceTag });

							// Flatten top matched holdings into individual candidate mentions sorted by holding probability
							// and limit to 80 highest scoring mentions
							const scoredMentions = [];
							const holdings = groupMatcher.extractHoldings(blockedMentions, { sourceTag });
							const holdingResultMap = new Map();
							groupResults.forEach(gr => holdingResultMap.set(gr.holdingId, gr));

							for (const h of holdings) {
								const matchRes = holdingResultMap.get(h.familyId);
								const prob = matchRes ? matchRes.probability : 0;
								// Find the owner mention in blockedMentions for this holding
								const ownerMention = blockedMentions.find(row => {
									const key = row.family_id || row.familyId || row.household_id || row.householdId;
									if (key !== h.familyId) return false;
									if (row.original_data) {
										let data = row.original_data;
										if (typeof data === 'string') {
											try { data = JSON.parse(data); } catch (e) { }
										}
										if (data && data.status === 'Owner') {
											return true;
										}
									}
									return false;
								});

								if (ownerMention) {
									const mCopy = Object.assign({}, ownerMention);
									mCopy.score = prob * 100; // convert probability [0..1] to score
									mCopy.groupMatch = matchRes;
									scoredMentions.push(mCopy);
								}
							}

							scoredMentions.sort((a, b) => b.score - a.score);
							const top80Mentions = scoredMentions.slice(0, 80);

							this.showProgress("Rendering matches...", 90);
							setTimeout(() => {
								if (this.mentionsEditor) {
									const n = window.treeApp ? window.treeApp.GetNode(criteria.person_id) : null;
									this.mentionsEditor.load(n || { person_id: -1, full_name: 'Search Person', mentions: [] }, criteria.sources, top80Mentions, []);
									$('#right-panel-content .tab-btn[data-target="mentions-editor-container"]').click();
								}
								this.hideProgress();
							}, 50);
						}, 50);
					} else {
						this.showProgress("Filtering mentions...", 25);
						setTimeout(() => {
							let blockedMentions = this.MakeBlockedMentions(["race", "gender"], criteria.factors, criteria.sources);
							const sample = blockedMentions.filter(m => (m.first_name || '').toLowerCase().includes('mary') || (m.last_name || '').toLowerCase().includes('johnson') || (m.full_name || '').toLowerCase().includes('mary'));
							this.showProgress("Scoring mentions...", 60);
							setTimeout(() => {
								const scoreResult = app.score.ScoreMentions(blockedMentions, criteria.factors, criteria.sources, criteria.useSmartName, criteria.person_id);
								const resultFactors = scoreResult.factors || null;
								const foundMentions = scoreResult.mentions || blockedMentions;
								const topPositive = foundMentions.filter(m => m.score > 0);
								const maryJ = foundMentions.filter(m => (m.first_name || '').toLowerCase().includes('mary') || (m.last_name || '').toLowerCase().includes('johnson') || (m.full_name || '').toLowerCase().includes('mary'));
								const n = window.treeApp.GetNode(criteria.person_id);
								this.showProgress("Rendering matches...", 90);
								setTimeout(() => {
									if (this.mentionsEditor) {
										this.mentionsEditor.load(n || { person_id: -1, full_name: 'Search Person', mentions: [] }, criteria.sources, foundMentions, resultFactors);
										$('#right-panel-content .tab-btn[data-target="mentions-editor-container"]').click();
									}
									this.hideProgress();
								}, 50);
							}, 50);
						}, 50);
					}
				}
			});
		}

		if (mEditor) {
			mEditor.load(node || { person_id: -1, full_name: 'Search Person', mentions: [] }, [], []);
		}
		if (pEditor) {
			pEditor.load(personId);
		}
	}

	editMention(mentionId) {
		const startId = String(mentionId || '').trim();
		if (!startId || !this.mentionsEditor) return;

		// Find all equivalents of startId via isSameAs transitive closure
		const equivalents = new Set([startId]);
		if (this.expand) {
			const queue = [startId];
			while (queue.length > 0) {
				const current = queue.shift();
				for (const { assertion: a, predicate } of this.expand.bySubject.get(current) || []) {
					if (predicate === 'isSameAs') {
						const obj = String(a.object_id).trim();
						if (!equivalents.has(obj)) {
							equivalents.add(obj);
							queue.push(obj);
						}
					}
				}
				for (const { assertion: a, predicate } of this.expand.byObject.get(current) || []) {
					if (predicate === 'isSameAs') {
						const sub = String(a.subject_id).trim();
						if (!equivalents.has(sub)) {
							equivalents.add(sub);
							queue.push(sub);
						}
					}
				}
			}
		}

		// Look up the mention from the global mentions dataset only
		const mention = this.mentions.find(m => equivalents.has(String(m.mention_id).trim()));
		if (!mention) return;

		// Switch to Mentions tab and load this mention directly
		$('#right-panel-content .tab-btn[data-target="mentions-editor-container"]').click();
		this.mentionsEditor.load(null, [], [mention]);
	}

	sourceMatches(mentionSource, targetSources) {
		if (!mentionSource || !targetSources || targetSources.length === 0) return false;
		if (targetSources.some(ts => String(ts).toUpperCase() === 'ALL')) return true;
		let ms = String(mentionSource).toUpperCase().replace(/_/g, '-');
		let currentCounty = (this.county || 'AUG').toUpperCase();

		let activeFilter = (window.app && window.app.source) ? String(window.app.source).toUpperCase() : '';

		// If filtering for a specific vital record subtype (VRB, VRM, VRD)
		if (activeFilter === 'VRB' || activeFilter === 'VRM' || activeFilter === 'VRD') {
			let msParts = ms.split('-');
			let msCore = msParts.length > 1 && (msParts[0] === 'ALB' || msParts[0] === 'AUG' || msParts[0] === 'FAQ') ? msParts[1] : msParts[0];
			if (msCore.startsWith('VR') && msCore !== activeFilter) {
				return false;
			}
		}

		const getBaseCore = (s) => {
			let sParts = s.split('-');
			let core = sParts.length > 1 && (sParts[0] === 'ALB' || sParts[0] === 'AUG' || sParts[0] === 'FAQ') ? sParts.slice(1).join('-') : s;

			if (core.startsWith('CH')) return 'CH';
			if (core.startsWith('SS')) return 'SS';
			if (core.startsWith('FBR')) return 'FBR';
			if (core.startsWith('VR')) return 'VR';
			if (core.startsWith('FL')) return 'FL';
			if (core.startsWith('SB')) return 'SB';
			if (core.startsWith('CC')) return 'CC';
			if (core.startsWith('CF')) return 'CF';
			if (core === 'FG' || core === 'FINDAGRAVE') return 'FG';
			return core;
		};

		let msBase = getBaseCore(ms);

		return targetSources.some(ts => {
			let tsBase = getBaseCore(String(ts).toUpperCase().replace(/_/g, '-'));

			if (msBase === tsBase) return true;

			// Fallback check
			let tsNormalized = String(ts).toUpperCase().replace(/_/g, '-');
			let tsParts = tsNormalized.split('-');
			let tsCore = tsParts.length > 1 && (tsParts[0] === 'ALB' || tsParts[0] === 'AUG' || tsParts[0] === 'FAQ') ? tsParts.slice(1).join('-') : tsNormalized;
			let expectedPrefix = currentCounty + '-';
			let expectedFull = expectedPrefix + tsCore;

			if (ms === expectedFull || ms.startsWith(expectedFull)) return true;

			return false;
		});
	}

	MakeBlockedMentions(blockingFields, factors, sources) {
		let matchedMentions = [];
		let activeFactors = {};
		if (factors) {
			for (let f of factors) {
				if (blockingFields.includes(f.field)) {
					// Only use as a blocker if compare is not 'ignore'
					const cmp = Array.isArray(f.compare) ? f.compare.find(x => x !== 'rare') : f.compare;
					if (cmp && cmp !== 'ignore') {
						activeFactors[f.field] = f.value;
					}
				}
			}
		}

		if (!sources || sources.length === 0) {
			console.log("MakeBlockedMentions: sources is empty");
			return [];
		}

		// Optimization: Pre-evaluate source matches to prevent executing expensive string logic millions of times
		let validSources = new Set();
		let invalidSources = new Set();
		const checkSource = (src) => {
			if (!src) return false;
			if (validSources.has(src)) return true;
			if (invalidSources.has(src)) return false;
			const isValid = this.sourceMatches(src, sources);
			if (isValid) validSources.add(src);
			else invalidSources.add(src);
			return isValid;
		};

		// Optimization: Pre-process blocking filters outside the 112k iteration loop
		// Normalize race: any value that starts with 'w' = 'w' (white), everything else = 'b' (non-white)
		const normalizeRace = (val) => {
			if (!val) return '';
			const v = String(val).trim().toLowerCase();
			if (!v) return '';
			return v.charAt(0) === 'w' ? 'w' : 'b';
		};
		let targetGen = activeFactors['gender'] !== undefined && activeFactors['gender'] !== null ? String(activeFactors['gender']).charAt(0).toLowerCase() : null;
		let targetRace = activeFactors['race'] !== undefined && activeFactors['race'] !== null ? normalizeRace(activeFactors['race']) : null;
		let bYearStr = activeFactors['birth_year'] !== undefined && activeFactors['birth_year'] !== null ? String(activeFactors['birth_year']).split(':')[0].split('-')[0] : null;
		let by = bYearStr ? Number(bYearStr) : NaN;

		for (let m of this.mentions) {
			// Include only if in the requested sources array
			if (!checkSource(m.source)) {
				continue;
			}

			let matchesAll = true;

			if (targetGen) {
				let mentionGen = m.gender ? String(m.gender).charAt(0).toLowerCase() : '';
				if (mentionGen && targetGen !== mentionGen) {
					matchesAll = false;
				}
			}

			if (matchesAll && targetRace) {
				let mentionRace = normalizeRace(m.norm_race || m.race || '');
				if (mentionRace && targetRace !== mentionRace) {
					matchesAll = false;
				}
			}

			if (matchesAll && !isNaN(by)) {
				let sYearStr = m.source_year ? String(m.source_year).split(':')[0].split('-')[0] : '';
				let sy = Number(sYearStr);
				if (isNaN(sy) || Math.abs(sy - by) > 75) {
					matchesAll = false;
				}
			}

			if (matchesAll) {
				matchedMentions.push(m);
			}
		}
		return matchedMentions;
	}

	async loadData()                                           // LOAD DATA
	{
		const urlParams = new URLSearchParams(window.location.search);
		const isTest = window.location.search.toLowerCase().includes('test');
		this.county = urlParams.get('c') || 'AUG';
		const lastSavedTreeName = localStorage.getItem('verite_last_tree_name');
		if (lastSavedTreeName) {
			const saved = localStorage.getItem('verite_tree_' + lastSavedTreeName);
			if (saved) {
				try {
					const parsed = JSON.parse(saved);
					const treeCounty = parsed.county || "AUG";
					const urlCounty = urlParams.get('c');
					if (!urlCounty || urlCounty === treeCounty) {
						this.curTree = parsed;
						this.county = treeCounty;
						this.processLoadedPersons();
					}
				} catch (e) {
					console.error('Failed to parse last saved tree on startup:', e);
				}
			}
		}
		const countyPrefix = this.county + '-';
		if (!this.curTree.county) {
			this.curTree.county = this.county;
		}

		if (isTest) {
			this.showProgress('Loading data from CSV...', false);
			const [allAssertions, allMentions] = await Promise.all([
				d3.csv(`img/assertions.csv?v=${version}`),
				d3.csv(`img/mentions.csv?v=${version}`)
			]);

			this.assertions = allAssertions.filter(r => r.subject_id && r.subject_id.startsWith(countyPrefix));
			this.mentions = allMentions.filter(r => r.source && r.source.startsWith(countyPrefix)).map(r => { delete r.narrative_vector; return r; });
		}
		else {
			this.showProgress('Connecting to database...', false);
			const mentionsCols = 'mention_id,source,source_year,original_data,confidence,full_name,first_name,middle_name,last_name,birth_year,death_year,race,gender,occupation,legal_status,norm_first_name,nysiis_last_name,norm_race,norm_occupation,head,household_id,family_id,narrative,metaphone_last_name';
			const [assertions, mentions] = await Promise.all([
				this.fetchWithProgress(`/api/assertions?subject_id=like.${countyPrefix}*&order=assertion_id`, 'assertions'),
				this.fetchWithProgress(`/api/mentions?select=${mentionsCols}&source=like.${countyPrefix}*&order=mention_id`, 'mentions')
			]);
			this.assertions = assertions;
			this.mentions = mentions;


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
			let maxPid = 1;
			Object.values(this.curTree.persons).forEach(p => {  // For each person
				if (!window.treeApp.GetNode(p.person_id)) {    // If missing
					window.treeApp.AddNode(p);                 // Add to tree
				}
				if (p.person_id && p.person_id.startsWith('P')) {
					const num = parseInt(p.person_id.substring(1), 10);
					if (!isNaN(num) && num >= maxPid) {
						maxPid = num + 1;
					}
				}
			});
			window.treeApp.pidCounter = maxPid;

			this.expand = new ExpandAssertions(this.assertions, this.mentions);
			this.rebuildAllRelationships();

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
		this.firstNameTotal = 0; this.lastNameTotal = 0;                // Initialize total counts to zero
		this.firstNameFreq = new Map();									// Create frequency map
		this.lastNameFreq = new Map();									// Create frequency map
		dataset.forEach(p => {											// For each row (person) in the dataset
			const f = (p.first_name || '').toLowerCase().trim();		// Get first name
			const l = (p.last_name || '').toLowerCase().trim();			// Get last name
			if (f) { 													// If first_name there
				this.firstNameFreq.set(f, (this.firstNameFreq.get(f) || 0) + 1); // Add to map
				app.firstNameTotal++; 									// Inc count
			}
			if (l) { 													// If last_name there
				this.lastNameFreq.set(l, (this.lastNameFreq.get(l) || 0) + 1); // Add to map
				app.lastNameTotal++; 									// Inc count
			}
		});
	}

	GetNameWeightModifier(name, freqMap, total, m = .95)             // GET RARITY MODIFIER
	{
		if (!name || !freqMap) return 0.0;                            	// Missing/Not in map
		const n = name.toLowerCase().trim();                      		// Convert to lower case
		const count = freqMap.get(n) || 0;                          	// Get count from map (0 if missing)
		const u = (count + 0.5) / (total + 1);             				// +0.5 smoothing: unseen names don't blow up
		const raw_log = Math.log2(m / u);                          		// Rare -> large +, common -> small -
		const score = 0.0225 * raw_log - 0.1;							// Calc score
		return Math.max(0.0, Math.min(0.3, score));                 	// Scale to [0.0, 0.3]
	}

	async saveTree(name) {
		if (!name) return;
		this.curTree.treeName = name;
		this.curTree.county = this.county;
		localStorage.setItem('verite_tree_' + name, JSON.stringify(this.curTree));
		localStorage.setItem('verite_last_tree_name', name);
		console.log('Saved tree:', name);
	}

	async loadTree(name) {
		const saved = localStorage.getItem('verite_tree_' + name);
		if (!saved) return false;
		try {
			const parsed = JSON.parse(saved);
			const targetCounty = parsed.county || "AUG";
			if (this.county !== targetCounty) {
				this.county = targetCounty;
				const countyPrefix = this.county + '-';
				const isTest = window.location.search.toLowerCase().includes('test');
				if (isTest) {
					this.showProgress('Loading data from CSV...', false);
					const [allAssertions, allMentions] = await Promise.all([
						d3.csv(`img/assertions.csv?v=${version}`),
						d3.csv(`img/mentions.csv?v=${version}`)
					]);
					this.assertions = allAssertions.filter(r => r.subject_id && r.subject_id.startsWith(countyPrefix));
					this.mentions = allMentions.filter(r => r.source && r.source.startsWith(countyPrefix)).map(r => { delete r.narrative_vector; return r; });
				} else {
					this.showProgress('Connecting to database...', false);
					const mentionsCols = 'mention_id,source,source_year,original_data,confidence,full_name,first_name,middle_name,last_name,birth_year,death_year,race,gender,occupation,legal_status,norm_first_name,nysiis_last_name,norm_race,norm_occupation,head,household_id,family_id,narrative,soundex_last_name';
					const [assertions, mentions] = await Promise.all([
						this.fetchWithProgress(`/api/assertions?subject_id=like.${countyPrefix}*&order=assertion_id`, 'assertions'),
						this.fetchWithProgress(`/api/mentions?select=${mentionsCols}&source=like.${countyPrefix}*&order=mention_id`, 'mentions')
					]);
					this.assertions = assertions;
					this.mentions = mentions;
				}
				this.BuildNameFrequencies(this.mentions);
				setTimeout(() => this.hideProgress(), 1500);
			}

			this.curTree = parsed;
			this.curTree.treeName = name;
			this.curTree.county = this.county;
			this.processLoadedPersons();
			localStorage.setItem('verite_last_tree_name', name);

			if (window.treeApp) {
				window.treeApp.ClearAll();
				let maxPid = 1;
				Object.values(this.curTree.persons).forEach(p => {
					if (!window.treeApp.GetNode(p.person_id)) {
						window.treeApp.AddNode(p);
					}
					if (p.person_id && p.person_id.startsWith('P')) {
						const num = parseInt(p.person_id.substring(1), 10);
						if (!isNaN(num) && num >= maxPid) {
							maxPid = num + 1;
						}
					}
				});
				window.treeApp.pidCounter = maxPid;

				this.expand = new ExpandAssertions(this.assertions, this.mentions);
				this.rebuildAllRelationships();

				window.treeApp.ApplyLayout();
				window.treeApp.RenderNodes();
				window.treeApp.RenderEdges();
				window.treeApp.FitToScreen();

				if (window.treeApp.state.nodes.length > 0) {
					const pid = window.treeApp.state.nodes[0].person_id;
					window.treeApp.SelectNodeAndShowEditor(pid);
				}
			}
			return true;
		} catch (e) {
			console.error('Failed to load tree:', name, e);
			return false;
		}
	}

	async deleteTree(name) {
		localStorage.removeItem('verite_tree_' + name);
		const lastSaved = localStorage.getItem('verite_last_tree_name');
		if (lastSaved === name) {
			localStorage.removeItem('verite_last_tree_name');
			if (this.curTree.treeName === name) {
				this.curTree = {
					treeName: "Family",
					owner: "Bill",
					persons: [],
					relationships: []
				};
				if (window.treeApp) {
					window.treeApp.ClearAll();
					window.treeApp.ApplyLayout();
					window.treeApp.RenderNodes();
					window.treeApp.RenderEdges();
				}
			}
		}
		console.log('Deleted tree:', name);
	}

	listTrees() {
		const list = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key.startsWith('verite_tree_')) {
				list.push(key.substring('verite_tree_'.length));
			}
		}
		return list.sort();
	}

}

const app = new App();												// Create a new instance of the App class
window.app = app;													// Create a global variable 'app' points to an instance of the App class
