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
		this.match = (typeof Match !== 'undefined') ? new Match() : null;

		this.curTree = {
			treeName: "Family",
			county: "AUG",
			owner: "Bill",
			persons: [],
			relationships: [],
			notepad: ""
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



	sanitizeRelationships() {
		if (!this.curTree || !this.curTree.relationships || !this.curTree.persons) return;

		const persons = Array.isArray(this.curTree.persons) ? this.curTree.persons : Object.values(this.curTree.persons);
		const personMap = new Map(persons.map(p => [p.person_id, p]));

		const cleaned = [];
		const seenKeys = new Set();

		this.curTree.relationships.forEach(r => {
			let sub = r.subject_id;
			let pred = r.predicate;
			let obj = r.object_id;

			if (!sub || !obj || sub === obj) return;

			// Convert isParentOf to isChildOf
			if (pred === 'isParentOf') {
				pred = 'isChildOf';
				const temp = sub;
				sub = obj;
				obj = temp;
			}

			if (pred === 'isChildOf') {
				const childP = personMap.get(sub);
				const parentP = personMap.get(obj);
				if (childP && parentP) {
					const childBirth = parseInt((childP.birth_year || '').split(':')[0], 10);
					const parentBirth = parseInt((parentP.birth_year || '').split(':')[0], 10);
					if (!isNaN(childBirth) && !isNaN(parentBirth)) {
						if (childBirth < parentBirth - 5) {
							// Birth year proves child is older than parent => reverse!
							const temp = sub;
							sub = obj;
							obj = temp;
						}
					}
				}
			}

			const key = `${sub}|${pred}|${obj}`;
			if (!seenKeys.has(key)) {
				seenKeys.add(key);
				cleaned.push({ subject_id: sub, predicate: pred, object_id: obj });
			}
		});

		// Filter out duplicate reverse parent-child pairs
		const childParentPairs = new Set();
		cleaned.forEach(r => {
			if (r.predicate === 'isChildOf') {
				childParentPairs.add(`${r.subject_id}|${r.object_id}`);
			}
		});

		const finalRels = [];
		cleaned.forEach(r => {
			if (r.predicate === 'isChildOf') {
				const revKey = `${r.object_id}|${r.subject_id}`;
				if (childParentPairs.has(revKey)) {
					const childP = personMap.get(r.subject_id);
					const parentP = personMap.get(r.object_id);
					if (childP && parentP) {
						const childBirth = parseInt((childP.birth_year || '').split(':')[0], 10);
						const parentBirth = parseInt((parentP.birth_year || '').split(':')[0], 10);
						if (!isNaN(childBirth) && !isNaN(parentBirth) && childBirth < parentBirth) {
							return; // Drop inverted relationship where older person is child
						}
					}
				}
			}
			finalRels.push(r);
		});

		this.curTree.relationships = finalRels;
	}

	rebuildAllRelationships()                                  // REBUILD FROM ExpandAssertions
	{
		this.processLoadedPersons();
		this.sanitizeRelationships();
		const mentionToPerson = new Map();
		const persons = Array.isArray(this.curTree.persons) ? this.curTree.persons : Object.values(this.curTree.persons);

		persons.forEach(p => {
			if (p.mentions) {
				p.mentions.forEach(mid => mentionToPerson.set(mid, p.person_id));
			}
		});

		const newRelationships = [];
		const added = new Set();

		// Process relationships defined in person anchors (e.g. isEnslaverOf:P003, isCousinOf:P002) first.
		// These anchor definitions are authoritative for person-to-target relationships.
		const anchoredPairs = new Set();
		persons.forEach(p => {
			if (p.anchor && p.anchor.includes(':')) {
				const parts = p.anchor.split(':');
				const pred = parts[0];
				const targetPid = parts[1];
				if (pred && targetPid && targetPid !== p.person_id) {
					const key = `${p.person_id}|${pred}|${targetPid}`;
					const pairKey = `${p.person_id}|${targetPid}`;
					const revPairKey = `${targetPid}|${p.person_id}`;
					anchoredPairs.add(pairKey);
					anchoredPairs.add(revPairKey);

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

		// Preserve existing relationships in curTree.relationships ONLY if they don't conflict with explicit anchors
		if (Array.isArray(this.curTree.relationships)) {
			this.curTree.relationships.forEach(r => {
				const pairKey = `${r.subject_id}|${r.object_id}`;
				const revPairKey = `${r.object_id}|${r.subject_id}`;
				if (anchoredPairs.has(pairKey) || anchoredPairs.has(revPairKey)) {
					return; // Skip stale relationship for pairs that have an explicit anchor override
				}
				const key = `${r.subject_id}|${r.predicate}|${r.object_id}`;
				if (!added.has(key)) {
					added.add(key);
					newRelationships.push(r);
				}
			});
		}

		// Pull in ExpandAssertions relationships for existing persons in tree
		if (this.expand) {
			persons.forEach(p => {
				if (!p.mentions) return;
				p.mentions.forEach(mid => {
					const view = this.expand.viewFor(mid);
					if (view && view.results) {
						view.results.forEach(res => {
							if (!res.mention_id) return;
							const targetPid = mentionToPerson.get(res.mention_id);

							if (targetPid && targetPid !== p.person_id) {
								const pred = res.predicate;
								if (['isChildOf', 'isParentOf', 'isSiblingOf', 'isSpouseOf', 'isCousinOf', 'isEnslaverOf', 'wasEnslavedBy', 'enslaves'].includes(pred)) {
									let sub = p.person_id;
									let obj = targetPid;
									let normalizedPred = pred;

									if (pred === 'isChildOf') {
										sub = targetPid;
										obj = p.person_id;
									} else if (pred === 'isParentOf') {
										sub = p.person_id;
										obj = targetPid;
										normalizedPred = 'isChildOf';
									}

									const key = `${sub}|${normalizedPred}|${obj}`;
									if (!added.has(key)) {
										added.add(key);
										newRelationships.push({
											subject_id: sub,
											predicate: normalizedPred,
											object_id: obj
										});
									}
								}
							}
						});
					}
				});
			});
		}

		// Ensure children of one parent inherit isChildOf to the parent's spouse
		const spousePairs = newRelationships.filter(r => r.predicate === 'isSpouseOf');
		const childRels = newRelationships.filter(r => r.predicate === 'isChildOf');
		childRels.forEach(cr => {
			const childPid = cr.subject_id;
			const parentPid = cr.object_id;
			spousePairs.forEach(sr => {
				let spousePid = null;
				if (sr.subject_id === parentPid) spousePid = sr.object_id;
				else if (sr.object_id === parentPid) spousePid = sr.subject_id;

				if (spousePid && spousePid !== parentPid && spousePid !== childPid) {
					const key = `${childPid}|isChildOf|${spousePid}`;
					if (!added.has(key)) {
						added.add(key);
						newRelationships.push({
							subject_id: childPid,
							predicate: 'isChildOf',
							object_id: spousePid
						});
					}
				}
			});
		});

		// Fail-safe birth year check on all isChildOf relationships: child (subject_id) must be younger than parent (object_id)
		const personMap = new Map(persons.map(p => [p.person_id, p]));
		newRelationships.forEach(r => {
			if (r.predicate === 'isChildOf') {
				const childP = personMap.get(r.subject_id);
				const parentP = personMap.get(r.object_id);
				if (childP && parentP) {
					const childBirth = parseInt((childP.birth_year || '').split(':')[0], 10);
					const parentBirth = parseInt((parentP.birth_year || '').split(':')[0], 10);
					if (!isNaN(childBirth) && !isNaN(parentBirth) && childBirth < parentBirth - 10) {
						const temp = r.subject_id;
						r.subject_id = r.object_id;
						r.object_id = temp;
					}
				}
			}
		});

		// Remove conflicting relationships between parents and children (e.g. child cannot be sibling/cousin to parent)
		const parentChildPairs = new Set();
		newRelationships.forEach(r => {
			if (r.predicate === 'isChildOf') {
				parentChildPairs.add(`${r.subject_id}|${r.object_id}`);
				parentChildPairs.add(`${r.object_id}|${r.subject_id}`);
			}
		});

		const filteredRelationships = newRelationships.filter(r => {
			if (r.predicate === 'isSiblingOf' || r.predicate === 'isCousinOf' || r.predicate === 'isUncleOf' || r.predicate === 'isAuntOf' || r.predicate === 'isNiblingOf') {
				if (parentChildPairs.has(`${r.subject_id}|${r.object_id}`)) {
					return false;
				}
			}
			return true;
		});

		this.curTree.relationships = filteredRelationships;
		this.sanitizeRelationships();

		// Sync to treeApp
		if (window.treeApp && window.treeApp.state) {
			const tripletSet = new Set();
			const triplets = [];
			this.curTree.relationships.forEach(r => {
				const key = `${r.subject_id}|${r.predicate}|${r.object_id}`;
				if (!tripletSet.has(key)) {
					tripletSet.add(key);
					triplets.push({ subject: r.subject_id, predicate: r.predicate, object: r.object_id });
				}
			});
			window.treeApp.state.triplets = triplets;
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
			const res = await fetch(url + (maxRecords ? `${separator}limit=${maxRecords}` : ''), {
				headers: { 'Accept': 'text/csv' }
			});
			if (!res.ok) throw new Error(`Failed to load ${label}: ${res.status} ${res.statusText}`);
			const text = await res.text();
			return d3.csvParse(text);
		}

		// 2. Fetch in chunks (using CSV for 4x smaller payload & faster parsing)
		const chunkLimit = 50000;
		const separator = url.includes('?') ? '&' : '?';
		const fetchPromises = [];
		let loadedRecords = 0;
		let allData = [];

		for (let offset = 0; offset < totalRecords; offset += chunkLimit) {
			const fetchLimit = Math.min(chunkLimit, totalRecords - offset);
			const promise = fetch(`${url}${separator}limit=${fetchLimit}&offset=${offset}`, {
				headers: { 'Accept': 'text/csv' }
			})
				.then(res => {
					if (!res.ok) throw new Error(`Failed to load chunk for ${label}`);
					return res.text();
				})
				.then(csvText => {
					const chunkData = d3.csvParse(csvText);
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
						<div class="tab-btn active" data-target="person-editor-container" style="padding: 10px 20px; cursor: pointer; background: #e5e5e5; border-top: 2px solid #0078d7; font-weight: bold; font-size: 14px; color: #333;">PERSON</div>
						<div class="tab-btn" data-target="mentions-editor-container" style="padding: 10px 20px; cursor: pointer; background: #d4d4d4; border-top: 2px solid transparent; font-size: 14px; color: #666;">MENTIONS</div>
						<div class="tab-btn" data-target="sources-editor-container" style="padding: 10px 20px; cursor: pointer; background: #d4d4d4; border-top: 2px solid transparent; font-size: 14px; color: #666;">SOURCES</div>
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

		if (targetSources.some(ts => String(ts).toUpperCase() === 'ORANGE FL')) {
			if (ms === 'ORF' || ms === 'ORF-FL' || ms.startsWith('ORF-FL')) return true;
		}

		// If filtering for a specific vital record subtype (VRB, VRM, VRD)
		if (activeFilter === 'VRB' || activeFilter === 'VRM' || activeFilter === 'VRD') {
			let msParts = ms.split('-');
			let msCore = msParts.length > 1 && (msParts[0] === 'ALB' || msParts[0] === 'AUG' || msParts[0] === 'FAQ' || msParts[0] === 'ORF') ? msParts[1] : msParts[0];
			if (msCore.startsWith('VR') && msCore !== activeFilter) {
				return false;
			}
		}

		const getBaseCore = (s) => {
			let sParts = s.split('-');
			let core = sParts.length > 1 && (sParts[0] === 'ALB' || sParts[0] === 'AUG' || sParts[0] === 'FAQ' || sParts[0] === 'ORF') ? sParts.slice(1).join('-') : s;

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
			let tsCore = tsParts.length > 1 && (tsParts[0] === 'ALB' || tsParts[0] === 'AUG' || tsParts[0] === 'FAQ' || tsParts[0] === 'ORF') ? tsParts.slice(1).join('-') : tsNormalized;
			let expectedPrefix = currentCounty + '-';
			let expectedFull = expectedPrefix + tsCore;

			if (ms === expectedFull || ms.startsWith(expectedFull)) return true;

			return false;
		});
	}

	async loadData()                                           // LOAD DATA
	{
		const urlParams = new URLSearchParams(window.location.search);
		const isTest = window.location.search.toLowerCase().includes('test');
		this.county = urlParams.get('c') || 'AUG';
		const lastSavedTreeName = localStorage.getItem('verite_last_tree_name');
		let hasLoadedSavedTree = false;

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
						hasLoadedSavedTree = true;
					}
				} catch (e) {
					console.error('Failed to parse last saved tree on startup:', e);
				}
			}
		}

		if (!hasLoadedSavedTree) {
			const filename = `${this.county}-demo.json`;
			const pathsToTry = [`img/${filename}`, filename, `img/${this.county}demo.json`, `${this.county}demo.json`];
			for (const path of pathsToTry) {
				try {
					const response = await fetch(path);
					if (response.ok) {
						const parsed = await response.json();
						this.curTree = JSON.parse(JSON.stringify(parsed));
						this.curTree.county = this.county;
						this.processLoadedPersons();
						hasLoadedSavedTree = true;
						break;
					}
				} catch (e) {
					// continue trying
				}
			}
		}

		const countyPrefix = this.county + '-';
		if (!this.curTree.county) {
			this.curTree.county = this.county;
		}

		this.showProgress('Connecting to database...', false);
		const mentionsCols = 'mention_id,source,source_year,confidence,full_name,first_name,middle_name,last_name,birth_year,death_year,race,gender,occupation,legal_status,norm_first_name,nysiis_last_name,norm_race,norm_occupation,head,household_id,family_id,metaphone_last_name,birth_place';
		const assertionsCols = 'assertion_id,subject_id,predicate,object_id,start_year,end_year,who,confidence';
		const [assertions, mentions] = await Promise.all([
			this.fetchWithProgress(`/api/assertions?select=${assertionsCols}&subject_id=like.${countyPrefix}*&order=assertion_id`, 'assertions'),
			this.fetchWithProgress(`/api/mentions?select=${mentionsCols}&source=like.${countyPrefix}*&order=mention_id`, 'mentions')
		]);
		this.assertions = assertions;
		this.mentions = mentions;

		const currentPersons = Array.isArray(this.curTree.persons) ? this.curTree.persons : Object.values(this.curTree.persons || {});
		if (currentPersons.length === 0 && this.mentions && this.mentions.length > 0) {
			const firstM = this.mentions[0];
			const pid = 'P001';
			const mId = firstM.mention_id;
			const seedPerson = {
				person_id: pid,
				mentions: [mId],
				anchor: null,
				first_name: `${firstM.first_name || ''}:${mId}`,
				middle_name: `${firstM.middle_name || ''}:${mId}`,
				last_name: `${firstM.last_name || ''}:${mId}`,
				suffix: null,
				birth_year: `${firstM.birth_year || ''}:${mId}`,
				death_year: `${firstM.death_year || ''}:${mId}`,
				gender: `${firstM.gender || ''}:${mId}`,
				race: `${firstM.race || ''}:${mId}`,
				x: 200,
				y: 200,
				verity: 3,
				isEnslaver: false
			};
			this.curTree.persons = [seedPerson];
			this.processLoadedPersons();
		}

		try {
			const sourceText = await (await fetch('img/sources.csv')).text();
			window.GlobalSources = {};
			const lines = sourceText.split('\n');
			if (lines.length > 0) {
				const headers = lines[0].split(',').map(h => h.trim());
				const displayIdx = headers.indexOf('display_name');
				const titleIdx = headers.indexOf('title');
				if (displayIdx !== -1) {
					for (let i = 1; i < lines.length; i++) {
						const parts = lines[i].split(',');
						if (parts.length > displayIdx && parts[displayIdx]) {
							const name = parts[displayIdx].trim().replace(/^"|"$/g, '');
							let title = '';
							if (titleIdx !== -1 && parts.length > titleIdx && parts[titleIdx]) {
								title = parts[titleIdx].trim().replace(/^"|"$/g, '');
							}
							if (name) {
								window.GlobalSources[name] = { display_name: name, title: title };
							}
						}
					}
				}
			}
		} catch (err) {
			console.log('Failed to load sources.csv', err);
			window.GlobalSources = null;
		}

		this.isLoaded = true;                                  // Mark loaded
		if (window.Match && !this.match) {
			this.match = new window.Match();
		}
		if (this.match && this.mentions && this.mentions.length) {
			this.match.usePool(this.mentions);
		}
		if (typeof Search !== 'undefined') {
			this.search = new Search({
				mentions: this.mentions || [],
				assertions: this.assertions || [],
				match: this.match
			});
		}
		this.showProgress(`Loaded ${this.assertions.length} assertions, ${this.mentions.length} mentions.`, 100); // Done
		setTimeout(() => this.hideProgress(), 1500);           // Hide popup

		if (window.treeApp) {                                  // If tree exists
			let maxPid = 1;
			Object.values(this.curTree.persons).forEach(p => {  // For each person
				if (!window.treeApp.GetNode(p.person_id)) {    // If missing
					window.treeApp.AddNode(p, false);           // Add to tree
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

			window.treeApp.ResetLayout();                      // Reset layout & fit
		}

		if (window.treeApp && window.treeApp.state.nodes.length > 0) { // If nodes present
			const pid = window.treeApp.state.selectedPid || window.treeApp.state.nodes[0].person_id; // Get target PID
			window.treeApp.SelectNodeAndShowEditor(pid);       // Select node
		}
	}

	async saveTree(name) {
		if (!name) return;
		this.curTree.treeName = name;
		this.curTree.county = this.county;
		if (window.treeApp && window.treeApp.state && window.treeApp.state.notepad !== undefined) {
			this.curTree.notepad = window.treeApp.state.notepad;
		}
		const treeToSave = JSON.parse(JSON.stringify(this.curTree));
		treeToSave.relationships = [];
		const safeReplacer = (k, v) => (k && k.startsWith('_cached') ? undefined : v);
		localStorage.setItem('verite_tree_' + name, JSON.stringify(treeToSave, safeReplacer));
		localStorage.setItem('verite_last_tree_name', name);
		console.log('Saved tree:', name);
	}

	async loadTreeData(parsed) {
		if (!parsed || typeof parsed !== 'object') return false;
		try {
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
					const mentionsCols = 'mention_id,source,source_year,confidence,full_name,first_name,middle_name,last_name,birth_year,death_year,race,gender,occupation,legal_status,norm_first_name,nysiis_last_name,norm_race,norm_occupation,head,household_id,family_id,metaphone_last_name,birth_place';
					const assertionsCols = 'assertion_id,subject_id,predicate,object_id,start_year,end_year,who,confidence';
					const [assertions, mentions] = await Promise.all([
						this.fetchWithProgress(`/api/assertions?select=${assertionsCols}&subject_id=like.${countyPrefix}*&order=assertion_id`, 'assertions'),
						this.fetchWithProgress(`/api/mentions?select=${mentionsCols}&source=like.${countyPrefix}*&order=mention_id`, 'mentions')
					]);
					this.assertions = assertions;
					this.mentions = mentions;
				}
				if (window.Match && !this.match) {
					this.match = new window.Match();
				}
				if (this.match && this.mentions && this.mentions.length) {
					this.match.usePool(this.mentions);
				}
				if (typeof Search !== 'undefined') {
					this.search = new Search({
						mentions: this.mentions || [],
						assertions: this.assertions || [],
						match: this.match
					});
				}
				setTimeout(() => this.hideProgress(), 1500);
			}

			this.curTree = JSON.parse(JSON.stringify(parsed));
			if (!this.curTree.treeName) this.curTree.treeName = "Imported Tree";
			if (this.curTree.notepad === undefined) this.curTree.notepad = "";
			this.curTree.county = this.county;
			this.processLoadedPersons();
			const treeToSave = JSON.parse(JSON.stringify(this.curTree));
			treeToSave.relationships = [];
			const safeReplacer = (k, v) => (k && k.startsWith('_cached') ? undefined : v);
			localStorage.setItem('verite_tree_' + this.curTree.treeName, JSON.stringify(treeToSave, safeReplacer));
			localStorage.setItem('verite_last_tree_name', this.curTree.treeName);

			if (window.treeApp) {
				window.treeApp.ClearAll();
				if (window.treeApp.state) {
					window.treeApp.state.notepad = this.curTree.notepad || "";
					if (document.getElementById("notepad-text")) {
						document.getElementById("notepad-text").value = this.curTree.notepad || "";
					}
				}
				let maxPid = 1;
				const persons = Array.isArray(this.curTree.persons) ? this.curTree.persons : Object.values(this.curTree.persons || {});
				persons.forEach(p => {
					if (!window.treeApp.GetNode(p.person_id)) {
						window.treeApp.AddNode(p, false);
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

				window.treeApp.ResetLayout();

				if (window.treeApp.state.nodes.length > 0) {
					const pid = window.treeApp.state.nodes[0].person_id;
					window.treeApp.SelectNodeAndShowEditor(pid);
				}
			}
			return true;
		} catch (e) {
			console.error('Failed to load tree data:', e);
			return false;
		}
	}

	async loadDemo() {
		const county = this.county || "AUG";
		const filename = `${county}-demo.json`;
		const pathsToTry = [`img/${filename}`, filename, `img/${county}demo.json`, `${county}demo.json`];

		for (const path of pathsToTry) {
			try {
				const response = await fetch(path);
				if (response.ok) {
					const data = await response.json();
					return await this.loadTreeData(data);
				}
			} catch (e) {
				// Continue trying next path
			}
		}

		console.warn(`Could not fetch demo file for ${county}, falling back to default demo tree.`);
		const fallbackDemoTree = {
			treeName: "Demo Family",
			county: county,
			owner: "Bill",
			persons: [],
			relationships: []
		};
		return await this.loadTreeData(fallbackDemoTree);
	}

	async loadTree(name) {
		const saved = localStorage.getItem('verite_tree_' + name);
		if (!saved) return false;
		try {
			const parsed = JSON.parse(saved);
			parsed.treeName = name;
			return await this.loadTreeData(parsed);
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
