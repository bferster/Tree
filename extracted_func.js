	selectNodeAndShowEditor(personId) {
		this.state.selectedPid = personId;
		this.updateNodeSelection();
	
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
	
		window._VPE_FAKE_PERSONS = window._VPE_FAKE_PERSONS || {};
		this.state.nodes.forEach(n => { window._VPE_FAKE_PERSONS[n.person_id] = n; });
	
		let mEditor = null;
		const node = this.getNode(personId);
		if (node) {
			node.narrative_vector = node.narrative_vector || [0.5, 0.5, 0.5];
		}
	
		if (window.MentionsEditor) {
			const mentionsContainer = document.getElementById('mentions-editor-container');
			mEditor = new window.MentionsEditor(mentionsContainer, {
				onAdd: (pid, mentionId) => {
					const mention = mEditor.getCurrentMention();
					if (!mention) return;
	
					const n = this.getNode(pid);
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
							this.isDirty = true;
							this.selectNodeAndShowEditor(pid);
						}
					}
				}
			});
	
			if (node) {
				mEditor.load(node, ['ALB-CN1870', 'ALB-CN1880', 'ALB-MARR', 'ALB-TAX'], this.getMockMentions(node));
			}
		}
	
		if (window.PersonEditor) {
			const pEditor = new window.PersonEditor($('#person-editor-container'));
			pEditor.load(personId);
			$('#person-editor-container').on('change vpe:changed vpe:rerender', () => {
				const n = this.getNode(personId);
				if (n) {
					this.syncEditorToNode(n);
					if (mEditor && n) {
						n.narrative_vector = n.narrative_vector || [0.5, 0.5, 0.5];
						mEditor.load(n, ['ALB-CN1870', 'ALB-CN1880', 'ALB-MARR', 'ALB-TAX'], this.getMockMentions(n));
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
