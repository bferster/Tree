class App {
	constructor() {
		this.assertions = [];
		this.mentions = [];
		this.isLoaded = false;
		this.init();
	}

	async init() {
		try {
			await this.loadData();
		} catch (err) {
			console.error('Data load error:', err);
		}
	}

	showProgress(message, percentage = false) {
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

	hideProgress() {
		$('#loading-progress-wrap').fadeOut();
	}

	async fetchWithProgress(url, label, maxRecords = null) {
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

	selectNodeAndShowEditor(personId) {
		if (!this.isLoaded) return;
		window.treeApp.state.selectedPid = personId;
		window.treeApp.updateNodeSelection();

		const rightPanel = $('#right-panel-content');
		rightPanel.empty().append(`
			<div style="display: flex; flex-direction: column; width: 100%; height: 100%; box-sizing: border-box; background: #e5e5e5;">
				<div style="display: flex; background: #d4d4d4; border-bottom: 1px solid #ccc; user-select: none;">
					<div class="tab-btn active" data-target="person-editor-container" style="padding: 10px 20px; cursor: pointer; background: #e5e5e5; border-top: 2px solid #0078d7; font-weight: bold; font-size: 14px; color: #333;">PERSONS EDITOR</div>
					<div class="tab-btn" data-target="mentions-editor-container" style="padding: 10px 20px; cursor: pointer; background: #d4d4d4; border-top: 2px solid transparent; font-size: 14px; color: #666;">MENTIONS EDITOR</div>
				</div>
				<div style="flex: 1; position: relative; overflow: hidden;">
					<div id="person-editor-container" class="person-editor" style="position: absolute; top:0; left:0; right:0; bottom:0; overflow-y: auto; padding: 12px; box-sizing: border-box;"></div>
					<div id="mentions-editor-container" style="position: absolute; top:0; left:0; right:0; bottom:0; overflow-y: auto; padding: 12px; box-sizing: border-box; display: none;"></div>
				</div>
			</div>
		`);

		rightPanel.find('.tab-btn').on('click', (e) => {
			rightPanel.find('.tab-btn').css({ background: '#d4d4d4', borderTopColor: 'transparent', fontWeight: 'normal', color: '#666' }).removeClass('active');
			$(e.currentTarget).css({ background: '#e5e5e5', borderTopColor: '#0078d7', fontWeight: 'bold', color: '#333' }).addClass('active');
			const target = $(e.currentTarget).attr('data-target');
			rightPanel.find('#person-editor-container, #mentions-editor-container').hide();
			rightPanel.find('#' + target).show();
		});

		window.PersonEditor.FAKE_PERSONS = window.PersonEditor.FAKE_PERSONS || {};
		window.treeApp.state.nodes.forEach(n => { window.PersonEditor.FAKE_PERSONS[n.person_id] = n; });

		let mEditor = null;
		const node = window.treeApp.getNode(personId);
		if (node) {
			node.narrative_vector = node.narrative_vector || [0.5, 0.5, 0.5];
		}

		if (window.MentionsEditor) {
			const mentionsContainer = document.getElementById('mentions-editor-container');
			mEditor = new window.MentionsEditor(mentionsContainer, {
				onAdd: (pid, mentionId) => {
					const mention = mEditor.getCurrentMention();
					if (!mention) return;

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

	async loadData() {
		const isTest = window.location.search.toLowerCase().includes('test');
		const maxRecords = isTest ? 1000 : null;
		this.showProgress('Connecting to database...', false);
		this.assertions = await this.fetchWithProgress('/api/assertions', 'assertions', maxRecords);
		this.mentions = await this.fetchWithProgress('/api/mentions', 'mentions', maxRecords);
		this.isLoaded = true;
		this.showProgress(`Loaded ${this.assertions.length} assertions, ${this.mentions.length} mentions.`, 100);
		setTimeout(() => this.hideProgress(), 1500);

		if (window.treeApp && window.treeApp.state.nodes.length > 0) {
			const pid = window.treeApp.state.selectedPid || window.treeApp.state.nodes[0].person_id;
			window.treeApp.selectNodeAndShowEditor(pid);
		}
	}




}
// Create a global variable 'app' that points to an instance of the App class
const app = new App();
window.app = app;
