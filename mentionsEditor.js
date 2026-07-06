/**
 * MentionsEditor
 * Displays a scrollable, scored list of candidate mentions for a target person,
 * with a detail panel showing the score breakdown and all mention fields,
 * and a footer "Add to person" action.
 *
 * Usage:
 *   const editor = new MentionsEditor(document.getElementById('mentions-editor'), {
 *     criteria: { ... },               // optional override of default weights
 *     onAdd: (personId, mentionId) => {...}  // called when "Add to person" is clicked
 *   });
 *   editor.load(targetPerson, sources);
 */

class MentionsEditor {

	static STAR_FILL = '#EF9F27';
	static STAR_EMPTY = '#9e9e9e';
	static STAR_PATH = "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z";


	static _makeStarSVG(filled) {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('width', '16');
		svg.setAttribute('height', '16');
		svg.style.display = 'block';
		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		path.setAttribute('d', MentionsEditor.STAR_PATH);
		path.setAttribute('fill', filled ? MentionsEditor.STAR_FILL : 'none');
		path.setAttribute('stroke', filled ? MentionsEditor.STAR_FILL : MentionsEditor.STAR_EMPTY);
		path.setAttribute('stroke-width', '1.5');
		path.setAttribute('stroke-linejoin', 'round');
		svg.appendChild(path);
		return svg;
	}


	static FIELD_LABELS = {
		mention_id: "Mention ID",
		source: "Source",
		source_year: "Source year",
		full_name: "Full name",
		first_name: "First name",
		middle_name: "Middle name",
		last_name: "Last name",
		birth_year: "Birth year",
		death_year: "Death year",
		gender: "Gender",
		legal_status: "Legal status",
		is_enslaver: "Is enslaver",
		norm_occupation: "Norm occupation",
		location_id: "Location ID",
		enslaver_id: "Enslaver ID",
		household_id: "Household ID",
		family_id: "Family ID",
		confidence: "Confidence"
	};

	static FACTOR_LABELS = {
		smartName: "Smart name",
		exactLastName: "Exact last",
		fuzzyLastName: "Fuzzy last",
		rarityLastName: "Rare last",
		exactFirstName: "Exact first",
		fuzzyFirstName: "Fuzzy first",
		rarityFirstName: "Rare first",
		exactNysiisLast: "NYSIIS",
		fuzzyNysiisLast: "Fuzzy",
		rarityNysiisLast: "Rare",
		exactSoundexLast: "Soundex",
		fuzzySoundexLast: "Fuzzy",
		raritySoundexLast: "Rare",
		birthYear: "Birth Year",
		deathYear: "Death Year",
		familyMember: "Relative match",
		householdContinuity: "Family",
		race: "Race",
		gender: "Gender",
		suffix: "Suffix",
		middle_name: "Middle name",
		norm_first_name: "Nick name"
	};

	static FACTOR_COLORS = {
		smartName: 'c-blue',
		exactLastName: 'c-teal',
		fuzzyLastName: 'c-teal',
		rarityLastName: 'c-teal',
		exactFirstName: 'c-purple',
		fuzzyFirstName: 'c-purple',
		rarityFirstName: 'c-purple',
		exactNysiisLast: 'c-coral',
		fuzzyNysiisLast: 'c-coral',
		rarityNysiisLast: 'c-coral',
		exactSoundexLast: 'c-coral',
		fuzzySoundexLast: 'c-coral',
		raritySoundexLast: 'c-coral',
		birthYear: 'c-blue',
		deathYear: 'c-blue',
		familyMember: 'c-purple',
		householdContinuity: 'c-purple',
		knockout: 'c-pink',
		race: 'c-pink',
		gender: 'c-pink',
		suffix: 'c-pink',
		middle_name: 'c-purple',
		norm_first_name: 'c-purple'
	};

	static RAMP = {
		'c-purple': ['#EEEDFE', '#26215C'],
		'c-teal': ['#E1F5EE', '#04342C'],
		'c-coral': ['#FAECE7', '#4A1B0C'],
		'c-pink': ['#FBEAF0', '#4B1528'],
		'c-gray': ['#F1EFE8', '#2C2C2A'],
		'c-blue': ['#E6F1FB', '#042C53'],
		'c-amber': ['#FCEFD9', '#4A2E07'],
		'c-green': ['#E5F4E9', '#0F3D1F']
	};

	/**
	 * @param {HTMLElement} container - element to render into
	 * @param {Object} options
	 * @param {Function} [options.onAdd] - callback(personId, mentionId)
	 * @param {Function} [options.onRemove] - callback(personId, mentionId)
	 */
	constructor(container, options = {}) {
		app.mentionsEditor = this;
		this.container = container;
		this.onAdd = options.onAdd || (() => { });
		this.onRemove = options.onRemove || null;
		this.targetPerson = null;
		this.sources = [];
		this.isSearchResult = false;
		this.matches = [];        // [{ id, score, mention, factors }]
		this.currentMentionId = null;
		this._renderShell();
	}

	// ---------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------

	/**
	 * Load a target person and a list of sources, build the match list, and render.
	 * @param {Object} targetPerson - person object matching Person data format
	 * @param {Array} sources - list of source identifiers/types to search
	 * @param {Array} [mentions] - optional pre-fetched mention list (skips fetchAssertions)
	 */
	async load(targetPerson, sources, mentions = null, factors = null) {
		this.targetPerson = targetPerson;
		this.sources = sources;
		this.factors = factors;
		this.currentMentionId = null;
		this.isSearchResult = !!((factors && factors.length > 0) || (mentions && mentions.length > 0));
		let candidateMentions = mentions;
		if (!this.isSearchResult) {
			const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
			let person = targetPerson;
			let personId = null;
			if (globalApp && globalApp.curPerson !== undefined && globalApp.curPerson !== -1 && window.treeApp && window.treeApp.state && window.treeApp.state.nodes) {
				const node = window.treeApp.state.nodes[globalApp.curPerson];
				if (node) personId = node.person_id;
			}
			if (!personId && window.treeApp && window.treeApp.state && window.treeApp.state.selectedPid) {
				personId = window.treeApp.state.selectedPid;
			}
			if (!personId && targetPerson) {
				personId = targetPerson.person_id;
			}

			if (personId && globalApp && globalApp.curTree && globalApp.curTree.persons) {
				const persons = globalApp.curTree.persons;
				const found = Array.isArray(persons) ? persons.find(p => p.person_id === personId) : persons[personId];
				if (found) person = found;
			}

			const associatedIds = person.mentions || [];

			candidateMentions = associatedIds
				.map(id => {
					if (typeof id === 'object') return id;
					if (!globalApp || !globalApp.mentions) return null;
					return globalApp.mentions.find(m => m.mention_id === id);
				})
				.filter(Boolean);

		}


		this.matches = this._buildMatchList(candidateMentions);

		if (this.matches.length > 0) {
			this.currentMentionId = this.matches[0].mention.mention_id;
		}

		this._renderList();
		this._renderDetail();
	}



	/** Returns the currently selected mention object, or null. */
	getCurrentMention() {
		const match = this.matches.find(m => m.mention.mention_id === this.currentMentionId);
		return match ? match.mention : null;
	}

	// ---------------------------------------------------------------------
	// Scoring
	// ---------------------------------------------------------------------

	_buildMatchList(mentions) {
		const results = [];
		const seenIds = new Set();
		for (const mention of mentions) {
			if (!seenIds.has(mention.mention_id)) {
				seenIds.add(mention.mention_id);
				results.push({
					id: mention.mention_id,
					score: mention.score || 0,
					mention: mention,
					factors: mention.factors || {}
				});
			}
		}
		results.sort((a, b) => b.score - a.score);
		return results;
	}




	// ---------------------------------------------------------------------
	// Rendering
	// ---------------------------------------------------------------------

	_renderShell() {
		this.container.classList.add('mentions-editor');
		this.container.innerHTML = `
      <div class="me-panel">
        <div class="me-header">
          <div>
            <p class="me-target-summary"></p>
          </div>
          <span class="me-count"></span>
        </div>
        <div class="me-body">
          <div class="me-match-list"></div>
          <div class="me-detail-panel"></div>
        </div>
        <div class="me-footer">
          <div class="me-verity-container"></div>
          <button type="button" class="me-add-btn" disabled>Add to person</button>
        </div>
      </div>
      <style>${MentionsEditor._css()}</style>
    `;

		this.listEl = this.container.querySelector('.me-match-list');
		this.detailEl = this.container.querySelector('.me-detail-panel');
		this.countEl = this.container.querySelector('.me-count');
		this.targetSummaryEl = this.container.querySelector('.me-target-summary');
		this.verityEl = this.container.querySelector('.me-verity-container');
		this.addBtn = this.container.querySelector('.me-add-btn');

		this.addBtn.addEventListener('click', () => this._handleAdd());
	}

	_renderList() {
		const target = this.targetPerson;
		const toTitleCase = (str) => {
			if (!str) return '';
			return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
		};
		const fname = target ? toTitleCase((target.norm_first_name || target.first_name || '').split(':')[0]) : '';
		const lname = target ? toTitleCase((target.last_name || '').split(':')[0]) : '';
		if (target) {
			const byear = target.birth_year ? String(target.birth_year).split(':')[0] : '?';
			const dyear = target.death_year ? String(target.death_year).split(':')[0] : '?';
			this.targetSummaryEl.innerHTML = `<div style="display: flex; align-items: center;">${MentionsEditor._getGenderSVG(target.gender, 24, 'green')} <span style="transform: translateY(2px); margin-left: 2px;">${MentionsEditor._esc(fname)} ${MentionsEditor._esc(lname)} &nbsp;&nbsp;(${MentionsEditor._esc(byear)} - ${MentionsEditor._esc(dyear)})</span></div>`;
		} else {
			this.targetSummaryEl.innerHTML = '';
		}
		this.countEl.textContent = this.matches.length > 80 ? `Showing top 80 matches` : `${this.matches.length} matches`;

		if (this.matches.length === 0) {
			this.listEl.innerHTML = `<div class="me-empty">No matches found.</div>`;
			return;
		}

		const matchesToRender = this.matches.slice(0, 80);

		this.listEl.innerHTML = matchesToRender.map(match => {
			const m = match.mention;
			const active = m.mention_id === this.currentMentionId;
			const sourceLabel = `${m.source_type || ''}${m.source_year ? ' ' + m.source_year : ''}`;
			const mid = m.middle_name ? ` ${m.middle_name}` : '';
			return `
        <div class="me-match-item ${active ? 'me-active' : ''}" data-id="${m.mention_id}">
          <div class="me-match-row">
            <span class="me-match-name">${MentionsEditor._esc(m.norm_first_name || m.first_name || '')}${MentionsEditor._esc(mid)} ${MentionsEditor._esc(m.last_name || '')}
              <span class="me-match-score">${Math.round(match.score * 10)}</span>
            </span>
            <span class="me-source-badge">${MentionsEditor._esc(sourceLabel)}</span>
          </div>
          <p class="me-match-years">${m.birth_year ?? '?'} &ndash; ${m.death_year ?? '?'}</p>
          <p class="me-match-narrative">${MentionsEditor._esc(m.narrative || '')}</p>
        </div>
      `;
		}).join('');

		this.listEl.querySelectorAll('.me-match-item').forEach(el => {
			el.addEventListener('click', () => {
				const id = el.dataset.id;
				// mention_id may be numeric or string; compare loosely
				this.currentMentionId = this.matches.find(m => String(m.mention.mention_id) === String(id)).mention.mention_id;
				this._renderList();
				this._renderDetail();
				this.detailEl.scrollTop = 0;
			});
		});
	}

	_renderDetail() {
		const match = this.matches.find(m => m.mention.mention_id === this.currentMentionId);

		if (!match) {
			this.detailEl.innerHTML = `<div class="me-empty">Select a mention to view details.</div>`;
			this.verityEl.innerHTML = '';
			this.addBtn.disabled = true;
			return;
		}

		this.addBtn.disabled = false;
		if (this.isSearchResult) {
			this.addBtn.textContent = "Add to person";
		} else {
			this.addBtn.textContent = "Remove mention from person";
		}

		const score = Math.round(match.score * 10);

		const isSmartNameOn = (window.PersonEditor && window.PersonEditor.userSettings)
			? window.PersonEditor.userSettings.useSmartName
			: $('#vpe-smart-name-cb').is(':checked');

		const nameKeys = [
			'exactLastName', 'fuzzyLastName', 'rarityLastName',
			'exactFirstName', 'fuzzyFirstName', 'rarityFirstName',
			'exactNysiisLast', 'fuzzyNysiisLast', 'rarityNysiisLast',
			'exactSoundexLast', 'fuzzySoundexLast', 'raritySoundexLast'
		];

		const factorToFieldMap = {
			exactLastName: 'last_name',
			fuzzyLastName: 'last_name',
			rarityLastName: 'last_name',
			exactFirstName: 'first_name',
			fuzzyFirstName: 'first_name',
			rarityFirstName: 'first_name',
			exactNysiisLast: 'nysiis_last_name',
			fuzzyNysiisLast: 'nysiis_last_name',
			rarityNysiisLast: 'nysiis_last_name',
			exactSoundexLast: 'soundex_last_name',
			fuzzySoundexLast: 'soundex_last_name',
			raritySoundexLast: 'soundex_last_name',
			suffix: 'suffix',
			birthYear: 'birth_year',
			deathYear: 'death_year'
		};

		const pillsHtml = Object.keys(MentionsEditor.FACTOR_LABELS).map(key => {
			if (isSmartNameOn) {
				if ((nameKeys.includes(key) && key !== 'rarityLastName') || key === 'suffix') return '';
			} else {
				const fieldKey = factorToFieldMap[key];
				if (fieldKey && this.factors) {
					const factorConfig = this.factors.find(f => f.field === fieldKey);
					if (factorConfig && factorConfig.compare === 'ignore') return '';
				}
			}

			const factor = match.factors[key];
			if (!factor || !factor.value) return '';
			const value = Math.round(factor.value * 10);
			if (value === 0) return '';
			let label = MentionsEditor.FACTOR_LABELS[key];
			if (key === 'rarityFirstName') {
				if (value < 0) label = "Common first";
				else if (value === 1 || value === 2) label = "Uncommon first";
				else label = "Rare first";
			} else if (key === 'rarityLastName') {
				if (value < 0) label = "Common last";
				else if (value === 1 || value === 2) label = "Uncommon last";
				else label = "Rare last";
			} else if (key === 'rarityNysiisLast' || key === 'raritySoundexLast') {
				if (value < 0) label = "Common";
				else if (value === 1 || value === 2) label = "Uncommon";
				else label = "Rare";
			}
			const sign = value > 0 ? '+' : '';
			const colorKey = MentionsEditor.FACTOR_COLORS[key] || 'c-gray';
			const ramp = MentionsEditor.RAMP[colorKey];
			const bg = ramp[0];
			const text = ramp[1];

			let tooltip = '';
			if (key === 'householdContinuity' && factor.matches && factor.matches.length > 0) {
				const names = factor.matches.map(m => m.name).join(', ');
				tooltip = ` title="Matched: ${names}"`;
			} else if (key === 'knockout') {
				tooltip = ` title="${MentionsEditor._esc(factor.reason)}"`;
				label = `Knockout: ${factor.reason}`;
				value = ''; // Don't show -999 on the pill
			}

			const displayVal = value !== '' ? ` ${sign}${value}` : '';
			return `<span class="me-pill" style="background: ${bg}; color: ${text}; border: 1px solid ${text}22; font-weight: 500;"${tooltip}>${label}${displayVal}</span>`;
		}).join('');

		const fieldRows = Object.keys(MentionsEditor.FIELD_LABELS).map(key => {
			if (key === 'source') return '';

			const label = MentionsEditor.FIELD_LABELS[key];
			let val = match.mention[key];

			if (key.toLowerCase().includes('is_enslave') || key.toLowerCase().includes('isenslave')) {
				if (!val) return '';
				const strVal = String(val).toLowerCase();
				if (strVal !== 't' && strVal !== 'true') return '';
			}

			if (key === 'gender' && val && val !== '') val = String(val)[0].toUpperCase();
			if (val === undefined || val === null || val === '') return '';
			return `
        <tr>
          <td class="me-field-label">${label}</td>
          <td class="me-field-value">${MentionsEditor._esc(String(val))}</td>
        </tr>
      `;
		}).join('');

		const originalData = match.mention.original_data;
		const originalDataHtml = originalData
			? `
			<div class="me-raw-block">
				<div class="me-raw-header" style="display: flex; align-items: center; cursor: pointer; margin-bottom: 8px; user-select: none;">
					<p class="me-raw-label" style="margin: 0; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #666;">Original data</p>
					<span class="me-raw-toggle-icon" style="font-size: 10px; color: #999; margin-left: 6px; transition: transform 0.2s; display: inline-block;">▶</span>
				</div>
				<pre class="me-raw-json" style="display: none; margin-top: 0;">${typeof originalData === 'string' ? originalData : JSON.stringify(originalData, null, 2)}</pre>
			</div>
			`
			: '';

		this.verityEl.innerHTML = '';

		const m = match.mention;
		const sourceLabel = m.source ? String(m.source).replace(/_/g, '-') : '';

		const toTitleCase = (str) => {
			if (!str) return '';
			return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
		};

		let familyHtml = '';
		if (match.factors && match.factors.householdContinuity && match.factors.householdContinuity.matches) {
			const familyMatches = match.factors.householdContinuity.matches;
			if (familyMatches.length > 0) {
				const famRows = familyMatches.map((f, i) => {
					let fullName = f.name || 'Relative';
					let byear = '?', dyear = '?';
					const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
					if (globalApp && globalApp.mentions) {
						const fMention = globalApp.mentions.find(m => m.mention_id === f.mention_id);
						if (fMention) {
							fullName = (fMention.norm_first_name || fMention.first_name || '') + ' ' + (fMention.last_name || '');
							if (fMention.birth_year) byear = String(fMention.birth_year).split(':')[0];
							if (fMention.death_year) dyear = String(fMention.death_year).split(':')[0];
						}
					}
					fullName = toTitleCase(fullName.trim() || 'Relative');
					const borderStyle = i < familyMatches.length - 1 ? 'border-bottom: 1px solid rgba(0,0,0,0.05);' : '';
					return `
						<div class="me-family-row" data-id="${MentionsEditor._esc(f.mention_id)}" style="display: flex; justify-content: space-between; padding: 4px 6px; ${borderStyle} font-size: 13px; cursor: pointer; border-radius: 4px; transition: background-color 0.15s;">
							<span>${MentionsEditor._esc(fullName)} (${MentionsEditor._esc(byear)} - ${MentionsEditor._esc(dyear)})</span>
							<span style="color: #666; font-family: monospace; text-align: right;">${MentionsEditor._esc(f.mention_id)}</span>
						</div>
					`;
				}).join('');

				familyHtml = `
					<div style="margin-top: 16px;">
						<p class="me-raw-label" style="font-weight: 600; font-size: 11px; color: #666; margin-top: 0; margin-bottom: 8px;">FAMILY MEMBERS</p>
						<div class="me-family-block" style="border: 1px solid #e0e0e0; border-radius: 6px; background-color: #f4f7fa; padding: 8px 6px;">
							<div>${famRows}</div>
						</div>
					</div>
				`;
			}
		}

		let combinedBottomHtml = '';
		if (familyHtml) {
			combinedBottomHtml += `<div style="height: 1px; background: #e0e0e0; margin: 24px 0 0 0;"></div>`;
			combinedBottomHtml += familyHtml;
		}
		if (originalDataHtml) {
			combinedBottomHtml += originalDataHtml;
		}

		this.detailEl.innerHTML = `
      <div class="me-score-row" style="display: flex; justify-content: space-between; align-items: baseline; width: 100%;">
        <div>
          <span class="me-score-value">${score}</span>
          <span class="me-score-label">match score</span>
        </div>
        <div style="font-weight: bold; font-size: 18px;">
          ${MentionsEditor._esc(sourceLabel)}
        </div>
      </div>
      <div class="me-factor-pills">${pillsHtml}</div>
      <div class="me-narrative-block">
        <p>${MentionsEditor._esc(match.mention.narrative || '')}</p>
      </div>
      <table class="me-field-table">${fieldRows}</table>
      ${combinedBottomHtml}
    `;

		this.detailEl.querySelectorAll('.me-family-row').forEach(el => {
			el.addEventListener('mouseenter', (e) => e.currentTarget.style.backgroundColor = '#e2e8f0');
			el.addEventListener('mouseleave', (e) => e.currentTarget.style.backgroundColor = 'transparent');
			el.addEventListener('click', (e) => {
				const id = e.currentTarget.getAttribute('data-id');
				const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
				if (globalApp && globalApp.mentions) {
					const fMention = globalApp.mentions.find(m => m.mention_id === id);
					if (fMention) {
						// Load the clicked family member into the mentions editor as the only result
						this.load(this.targetPerson, this.sources, [fMention], null);
					}
				}
			});
		});

		const rawHeader = this.detailEl.querySelector('.me-raw-header');
		if (rawHeader) {
			rawHeader.addEventListener('click', () => {
				const rawJson = this.detailEl.querySelector('.me-raw-json');
				const icon = this.detailEl.querySelector('.me-raw-toggle-icon');
				if (rawJson.style.display === 'none') {
					rawJson.style.display = 'block';
					icon.style.transform = 'rotate(90deg)';
				} else {
					rawJson.style.display = 'none';
					icon.style.transform = 'rotate(0deg)';
				}
			});
		}
	}

	_handleAdd() {
		const mention = this.getCurrentMention();
		if (!mention || !this.targetPerson) return;

		if (this.isSearchResult) {
			if (!Array.isArray(this.targetPerson.mentions)) {
				this.targetPerson.mentions = [];
			}
			if (!this.targetPerson.mentions.includes(mention.mention_id)) {
				this.targetPerson.mentions.push(mention.mention_id);
			}

			this.onAdd(this.targetPerson.person_id, mention.mention_id);

			this.container.dispatchEvent(new CustomEvent('mentionAdded', {
				bubbles: true,
				detail: { personId: this.targetPerson.person_id, mentionId: mention.mention_id }
			}));

			this.load(this.targetPerson, this.sources);
		} else {
			if (confirm("Are you sure you want to remove this mention from this person?")) {
				if (Array.isArray(this.targetPerson.mentions)) {
					this.targetPerson.mentions = this.targetPerson.mentions.filter(id => id !== mention.mention_id);
				}

				this.container.dispatchEvent(new CustomEvent('mentionRemoved', {
					bubbles: true,
					detail: { personId: this.targetPerson.person_id, mentionId: mention.mention_id }
				}));

				if (this.onRemove) {
					this.onRemove(this.targetPerson.person_id, mention.mention_id);
				}

				this.load(this.targetPerson, this.sources);
			}
		}
	}

	static _esc(str) {
		const div = document.createElement('div');
		div.textContent = str;
		return div.innerHTML;
	}

	static _getGenderSVG(gender, size = 16, color = '#666') {
		let path = "M 50, 50 m -40, 0 a 40,40 0 1,0 80,0 a 40,40 0 1,0 -80,0";
		let fill = color;
		if (gender) {
			const g = String(gender).charAt(0).toLowerCase();
			if (g === 'm') path = "M 34,49 A 16,16 0 0,1 66,49 A 16,16 0 0,1 34,49 Z M 15,100 A 35,35 0 0,1 85,100 Z";
			else if (g === 'f') path = "M 34,49 A 16,16 0 0,1 66,49 A 16,16 0 0,1 34,49 Z M 35,65 L 15,100 L 85,100 L 65,65 Z";
		}
		return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="vertical-align: middle; margin-right: 6px; margin-bottom: 3px; fill: ${fill};"><path d="${path}"/></svg>`;
	}

	static _css() {
		return `
      .mentions-editor {
        --me-bg: #e5e5e5;
        --me-panel: #ffffff;
        --me-border: #e3ddd5;
        --me-accent: #8a6f52;
        --me-radius: 12px;
        --me-shadow: 0 2px 8px rgba(0,0,0,0.06);
        --me-pill-pos-bg: #e6f4ea; --me-pill-pos-text: #2e7d4f;
        --me-pill-neg-bg: #fbe9e7; --me-pill-neg-text: #c0392b;
        --me-text-secondary: #6b6258;
        --me-text-tertiary: #948c82;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: var(--me-bg);
        border-radius: var(--me-radius);
        margin-left: 0;
        margin-top: 0;
        padding: 0;
        box-sizing: border-box;
        max-height: calc(100% - 12px);
        display: flex;
        flex-direction: column;
      }
      .me-panel {
        background: var(--me-panel);
        border: 1px solid var(--me-border);
        border-radius: var(--me-radius);
        box-shadow: var(--me-shadow);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        max-height: 100%;
      }
      .me-header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--me-border);
        display: flex;
        align-items: baseline;
        justify-content: space-between;
      }
      .me-title { font-weight: 600; font-size: 15px; margin: 0; }
      .me-target-summary { font-size: 18px; font-weight: 600; color: #333; margin: 2px 0 0; }
      .me-count { font-size: 12px; color: var(--me-text-tertiary); white-space: nowrap; }
      .me-body { display: flex; flex: 1; overflow: hidden; }
      .me-match-list {
        flex: 1;
        overflow-y: auto;
        border-right: 1px solid var(--me-border);
        min-width: 0;
      }
      .me-detail-panel {
        flex: 1;
        padding: 7px 16px 14px 16px;
        min-width: 0;
        overflow-y: auto;
      }
      .me-match-item {
        padding: 10px 14px;
        border-bottom: 1px solid var(--me-border);
        cursor: pointer;
        border-left: 3px solid transparent;
        transition: background 0.1s ease, transform 0.1s ease;
      }
      .me-match-item:hover { background: #faf8f5; transform: translateY(-1px); }
      .me-match-item.me-active {
        background: #f0e9e1;
        border-left-color: var(--me-accent);
      }
      .me-match-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
      .me-match-name { font-weight: 600; font-size: 14px; }
      .me-match-score { font-weight: 400; font-size: 12px; color: var(--me-text-secondary); margin-left: 6px; }
      .me-source-badge {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 999px;
        background: #f0eee9;
        color: var(--me-text-secondary);
        white-space: nowrap;
      }
      .me-match-years { font-size: 12px; color: var(--me-text-secondary); margin: 2px 0 4px; }
      .me-match-narrative {
        font-size: 12px;
        color: var(--me-text-tertiary);
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .me-empty {
        padding: 24px;
        text-align: center;
        font-size: 13px;
        color: var(--me-text-tertiary);
      }
      .me-score-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
      .me-score-value { font-size: 24px; font-weight: 600; }
      .me-score-label { font-size: 13px; color: var(--me-text-secondary); }
      .me-factor-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
      .me-pill {
        font-size: 12px;
        padding: 3px 10px;
        border-radius: 999px;
        white-space: nowrap;
      }
      .me-pill-pos { background: var(--me-pill-pos-bg); color: var(--me-pill-pos-text); }
      .me-pill-neg { background: var(--me-pill-neg-bg); color: var(--me-pill-neg-text); }
      .me-narrative-block {
        border-top: 1px solid var(--me-border);
        padding-top: 12px;
        margin-bottom: 12px;
      }
      .me-narrative-block p { font-size: 13px; line-height: 1.6; margin: 0; }
      .me-field-table { width: 100%; font-size: 12px; border-collapse: collapse; }
      .me-raw-block { margin-top: 16px; border-top: 1px solid var(--me-border); padding-top: 12px; }
      .me-raw-label { font-size: 12px; color: var(--me-text-secondary); margin: 0 0 6px; }
      .me-raw-json {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 11px;
        line-height: 1.5;
        background: #f7f5f2;
        border: 1px solid var(--me-border);
        border-radius: 8px;
        padding: 10px 12px;
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-x: auto;
      }
      .me-field-label { color: var(--me-text-secondary); padding: 3px 0; }
      .me-field-value { text-align: right; padding: 3px 0; }
      .me-footer {
        padding: 12px 16px;
        border-top: 1px solid var(--me-border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .me-add-btn {
        background: #eaf2fb;
        color: #185fa5;
        border: 1px solid #b5d4f4;
        border-radius: 8px;
        font-weight: 600;
        font-size: 13px;
        padding: 8px 16px;
        cursor: pointer;
        transition: transform 0.1s ease;
      }
      .me-add-btn:hover:not(:disabled) { transform: translateY(-1px); }
      .me-add-btn:disabled { opacity: 0.5; cursor: default; }

      @media (max-width: 768px) {
        .me-body { flex-direction: column; }
        .me-match-list {
          border-right: none;
          border-bottom: 1px solid var(--me-border);
          max-height: 40vh;
        }
        .me-detail-panel { max-height: none; }
      }
    `;
	}

}


window.MentionsEditor = MentionsEditor;
