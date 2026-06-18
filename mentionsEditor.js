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

	static DEFAULT_WEIGHTS = {
		exactLastName: { enabled: true, weight: 6 },
		fuzzyLastName: { enabled: true, weight: 3 },
		rarityLastName: { enabled: true, weight: 3 },
		exactFirstName: { enabled: true, weight: 6 },
		fuzzyFirstName: { enabled: true, weight: 3 },
		rarityFirstName: { enabled: true, weight: 3 },
		exactNysiisLast: { enabled: true, weight: 4 },
		fuzzyNysiisLast: { enabled: true, weight: 2 },
		rarityNysiisLast: { enabled: true, weight: 2 },
		birthYear: { enabled: true, weight: 3, tolerance: 2 },
		deathYear: { enabled: true, weight: 3, tolerance: 2 },
		familyMember: { enabled: true, weight: 4 },
		narrativeSim: { enabled: true, weight: 16 }
	};

	static FIELD_LABELS = {
		mention_id: "Mention ID",
		source: "Source",
		source_type: "Source type",
		source_year: "Source year",
		full_name: "Full name",
		first_name: "First name",
		middle_name: "Middle name",
		last_name: "Last name",
		maiden_name: "Maiden name",
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
		exactLastName: "Exact last",
		fuzzyLastName: "Fuzzy last",
		rarityLastName: "Rarity last",
		exactFirstName: "Exact first",
		fuzzyFirstName: "Fuzzy first",
		rarityFirstName: "Rarity first",
		exactNysiisLast: "NYSIIS last",
		fuzzyNysiisLast: "Fuzzy NYSIIS",
		rarityNysiisLast: "Rarity NYSIIS",
		birthYear: "Birth",
		deathYear: "Death",
		familyMember: "Family",
		narrativeSim: "Narrative"
	};

	static FACTOR_COLORS = {
		exactLastName: 'c-teal',
		fuzzyLastName: 'c-teal',
		rarityLastName: 'c-teal',
		exactFirstName: 'c-purple',
		fuzzyFirstName: 'c-purple',
		rarityFirstName: 'c-purple',
		exactNysiisLast: 'c-coral',
		fuzzyNysiisLast: 'c-coral',
		rarityNysiisLast: 'c-coral',
		birthYear: 'c-blue',
		deathYear: 'c-blue',
		familyMember: 'c-green',
		narrativeSim: 'c-pink'
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
	 * @param {Object} [options.criteria] - weight/enabled config, merged over defaults
	 * @param {Function} [options.onAdd] - callback(personId, mentionId)
	 * @param {Function} [options.fetchAssertions] - async (sources, targetPerson) => mention[]
	 */
	constructor(container, options = {}) {
		app.mentionsEditor = this;
		this.container = container;
		this.criteria = MentionsEditor._mergeCriteria(MentionsEditor.DEFAULT_WEIGHTS, options.criteria);
		this.onAdd = options.onAdd || (() => { });
		this.fetchAssertions = options.fetchAssertions || null;
		this.targetPerson = null;
		this.sources = [];
		this.matches = [];        // [{ id, score, mention, factors }]
		this.currentMentionId = null;
		this._renderShell();
	}

	static _mergeCriteria(defaults, override) {
		const result = {};
		for (const key of Object.keys(defaults)) {
			result[key] = Object.assign({}, defaults[key], override && override[key] ? override[key] : {});
		}
		return result;
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
	async load(targetPerson, sources, mentions = null) {
		this.targetPerson = targetPerson;
		this.sources = sources;
		this.currentMentionId = null;

		let candidateMentions = mentions;
		if (!candidateMentions) {
			if (!this.fetchAssertions) {
				throw new Error('MentionsEditor: no fetchAssertions function provided and no mentions array given');
			}
			candidateMentions = await this.fetchAssertions(sources, targetPerson);

		}


		this.matches = this._buildMatchList(candidateMentions, targetPerson);

		if (this.matches.length > 0) {
			this.currentMentionId = this.matches[0].mention.mention_id;
		}

		this._renderList();
		this._renderDetail();
	}

	/** Update scoring criteria (weights/enabled flags) and re-score current matches. */
	setCriteria(criteria) {
		this.criteria = MentionsEditor._mergeCriteria(this.criteria, criteria);
		if (this.targetPerson) {
			const mentions = this.matches.map(m => m.mention);
			this.matches = this._buildMatchList(mentions, this.targetPerson);
			this._renderList();
			this._renderDetail();
		}
	}

	/** Returns the currently selected mention object, or null. */
	getCurrentMention() {
		const match = this.matches.find(m => m.mention.mention_id === this.currentMentionId);
		return match ? match.mention : null;
	}

	// ---------------------------------------------------------------------
	// Scoring
	// ---------------------------------------------------------------------

	_buildMatchList(mentions, target) {

		const results = [];
		for (const mention of mentions) {
			const scored = this._scoreMention(mention, target);
			if (scored === null) continue; // hard filter (gender/race) failed
			results.push({ id: mention.mention_id, score: scored.score, mention, factors: scored.factors });
		}
		results.sort((a, b) => b.score - a.score);
		return results.slice(0, 50);
	}


	_scoreMention(mention, target) {
		const c = this.criteria;
		if (!mention) return { score: 0, factors: {} };

		// Hard filter


		//	if (window.Normalize.NormalizeRace(mention.race) !== target.race) return null;
		//	if (mention.gender !== target.gender) return null;

		const factors = {}; // key -> { value, enabled }

		const addFactor = (key, value) => {
			if (c[key] && c[key].enabled) {
				factors[key] = { value, enabled: true };
			}
		};

		// --- Name similarity scoring ---
		if (c.exactLastName.enabled && MentionsEditor._exactMatch(mention.last_name, target.last_name)) {
			addFactor('exactLastName', c.exactLastName.weight);
		}
		if (c.fuzzyLastName.enabled && MentionsEditor._fuzzyMatch(mention.last_name, target.last_name)) {
			addFactor('fuzzyLastName', c.fuzzyLastName.weight);
		}
		if (c.rarityLastName.enabled) {
			const bonus = MentionsEditor._rarityBonus(mention.last_name, target.last_name, c.rarityLastName.weight);
			if (bonus !== 0) addFactor('rarityLastName', bonus);
		}

		if (c.exactFirstName.enabled && MentionsEditor._exactMatch(mention.norm_first_name, target.norm_first_name)) {
			addFactor('exactFirstName', c.exactFirstName.weight);
		}
		if (c.fuzzyFirstName.enabled && MentionsEditor._fuzzyMatch(mention.norm_first_name, target.norm_first_name)) {
			addFactor('fuzzyFirstName', c.fuzzyFirstName.weight);
		}
		if (c.rarityFirstName.enabled) {
			const bonus = MentionsEditor._rarityBonus(mention.norm_first_name, target.norm_first_name, c.rarityFirstName.weight);
			if (bonus !== 0) addFactor('rarityFirstName', bonus);
		}

		if (c.exactNysiisLast.enabled && MentionsEditor._exactMatch(mention.nysiis_last_name, target.nysiis_last_name)) {
			addFactor('exactNysiisLast', c.exactNysiisLast.weight);
		}
		if (c.fuzzyNysiisLast.enabled && MentionsEditor._fuzzyMatch(mention.nysiis_last_name, target.nysiis_last_name)) {
			addFactor('fuzzyNysiisLast', c.fuzzyNysiisLast.weight);
		}
		if (c.rarityNysiisLast.enabled) {
			const bonus = MentionsEditor._rarityBonus(mention.nysiis_last_name, target.nysiis_last_name, c.rarityNysiisLast.weight);
			if (bonus !== 0) addFactor('rarityNysiisLast', bonus);
		}

		// --- Date similarity scoring ---
		if (c.birthYear.enabled && MentionsEditor._yearMatches(mention.birth_year, target.birth_year, c.birthYear.tolerance)) {
			addFactor('birthYear', c.birthYear.weight);
		}
		if (c.deathYear.enabled && MentionsEditor._yearMatches(mention.death_year, target.death_year, c.deathYear.tolerance)) {
			addFactor('deathYear', c.deathYear.weight);
		}

		// --- Family members scoring ---
		if (c.familyMember.enabled) {
			const n = (target.persons || []).length;
			if (n > 0) addFactor('familyMember', n * c.familyMember.weight);
		}

		// --- Narrative similarity scoring ---
		if (c.narrativeSim.enabled) {
			const cos = MentionsEditor._cosineSim(mention.narrative_vector, target.narrative_vector);
			if (cos > 0) addFactor('narrativeSim', cos * c.narrativeSim.weight);
		}

		const score = Object.values(factors).reduce((sum, f) => sum + f.value, 0);
		return { score, factors };
	}

	// ---- comparator helpers ----

	static _exactMatch(a, b) {
		if (!a || !b) return false;
		return a.toString().toLowerCase() === b.toString().toLowerCase();
	}

	/** Simple fuzzy match placeholder using Jaro-Winkler-style threshold. */
	static _fuzzyMatch(a, b, threshold = 0.85) {
		if (!a || !b) return false;
		return MentionsEditor._jaroWinkler(a.toLowerCase(), b.toLowerCase()) >= threshold;
	}

	/** Minimal Jaro-Winkler implementation. */
	static _jaroWinkler(s1, s2) {
		if (s1 === s2) return 1.0;
		const len1 = s1.length, len2 = s2.length;
		if (len1 === 0 || len2 === 0) return 0.0;

		const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
		const s1Matches = new Array(len1).fill(false);
		const s2Matches = new Array(len2).fill(false);
		let matches = 0, transpositions = 0;

		for (let i = 0; i < len1; i++) {
			const start = Math.max(0, i - matchDistance);
			const end = Math.min(i + matchDistance + 1, len2);
			for (let j = start; j < end; j++) {
				if (s2Matches[j]) continue;
				if (s1[i] !== s2[j]) continue;
				s1Matches[i] = true;
				s2Matches[j] = true;
				matches++;
				break;
			}
		}

		if (matches === 0) return 0.0;

		let k = 0;
		for (let i = 0; i < len1; i++) {
			if (!s1Matches[i]) continue;
			while (!s2Matches[k]) k++;
			if (s1[i] !== s2[k]) transpositions++;
			k++;
		}
		transpositions = Math.floor(transpositions / 2);

		const jaro = (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3;

		let prefix = 0;
		for (let i = 0; i < Math.min(4, len1, len2); i++) {
			if (s1[i] === s2[i]) prefix++;
			else break;
		}

		return jaro + prefix * 0.1 * (1 - jaro);
	}

	/**
	 * Rarity bonus/penalty: rare names get a positive bonus on match, common
	 * names get a small penalty. Placeholder logic pending corpus frequency table.
	 */
	static _rarityBonus(mentionVal, targetVal, weight) {
		if (!mentionVal || !targetVal) return 0;
		if (!MentionsEditor._exactMatch(mentionVal, targetVal) && !MentionsEditor._fuzzyMatch(mentionVal, targetVal)) return 0;
		// Placeholder: treat names longer than 6 chars as "rarer" -> bonus, else penalty
		const isRare = mentionVal.length > 6;
		return isRare ? weight : -Math.round(weight / 1.5 * 10) / 10;
	}

	/**
	 * Year matching with tolerance and hyphenated-range support.
	 * @param {number|string} mentionYear - may be a number or "1810-1890" range
	 * @param {number} targetYear
	 * @param {number} tolerance - +/- years allowed for exact comparisons
	 */
	static _yearMatches(mentionYear, targetYear, tolerance = 0) {
		if (mentionYear == null || targetYear == null) return false;

		if (typeof mentionYear === 'string' && mentionYear.includes('-')) {
			const [start, end] = mentionYear.split('-').map(s => parseInt(s.trim(), 10));
			if (isNaN(start) || isNaN(end)) return false;
			return targetYear >= start && targetYear <= end;
		}

		const my = typeof mentionYear === 'string' ? parseInt(mentionYear, 10) : mentionYear;
		if (isNaN(my)) return false;
		return Math.abs(my - targetYear) <= tolerance;
	}

	/** Cosine similarity between two equal-length numeric vectors. */
	static _cosineSim(vecA, vecB) {
		if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length || vecA.length === 0) return 0;
		let dot = 0, normA = 0, normB = 0;
		for (let i = 0; i < vecA.length; i++) {
			dot += vecA[i] * vecB[i];
			normA += vecA[i] * vecA[i];
			normB += vecB[i] * vecB[i];
		}
		if (normA === 0 || normB === 0) return 0;
		return dot / (Math.sqrt(normA) * Math.sqrt(normB));
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
		this.targetSummaryEl.textContent = target
			? `${target.norm_first_name || target.first_name || ''} ${target.last_name || ''} ${target.birth_year || '?'}-${target.death_year || '?'}`
			: '';
		this.countEl.textContent = `${this.matches.length} matches`;

		if (this.matches.length === 0) {
			this.listEl.innerHTML = `<div class="me-empty">No matches found.</div>`;
			return;
		}

		this.listEl.innerHTML = this.matches.map(match => {
			const m = match.mention;
			const active = m.mention_id === this.currentMentionId;
			const sourceLabel = `${m.source_type || ''}${m.source_year ? ' ' + m.source_year : ''}`;
			return `
        <div class="me-match-item ${active ? 'me-active' : ''}" data-id="${m.mention_id}">
          <div class="me-match-row">
            <span class="me-match-name">${MentionsEditor._esc(m.norm_first_name || m.first_name || '')} ${MentionsEditor._esc(m.last_name || '')}
              <span class="me-match-score">${Math.round(match.score * 10) / 10}</span>
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

		const score = Math.round(match.score * 10) / 10;

		const pillsHtml = Object.keys(MentionsEditor.FACTOR_LABELS).map(key => {
			const factor = match.factors[key];
			if (!factor) return '';
			const label = MentionsEditor.FACTOR_LABELS[key];
			const value = Math.round(factor.value * 10) / 10;
			const sign = value > 0 ? '+' : '';
			const colorKey = MentionsEditor.FACTOR_COLORS[key] || 'c-gray';
			const ramp = MentionsEditor.RAMP[colorKey];
			const bg = ramp[0];
			const text = ramp[1];
			return `<span class="me-pill" style="background: ${bg}; color: ${text}; border: 1px solid ${text}22; font-weight: 500;">${label} ${sign}${value}</span>`;
		}).join('');

		const fieldRows = Object.keys(MentionsEditor.FIELD_LABELS).map(key => {
			const label = MentionsEditor.FIELD_LABELS[key];
			let val = match.mention[key];
			if (key === 'gender' && val && val !== '') val = String(val)[0].toUpperCase();
			if (val === undefined || val === null || val === '') val = '\u2014';
			return `
        <tr>
          <td class="me-field-label">${label}</td>
          <td class="me-field-value">${MentionsEditor._esc(String(val))}</td>
        </tr>
      `;
		}).join('');

		const originalData = match.mention.original_data;
		const originalDataHtml = originalData
			? `<div class="me-raw-block"><p class="me-raw-label">Original data</p><pre class="me-raw-json">${MentionsEditor._esc(JSON.stringify(originalData, null, 2))}</pre></div>`
			: '';

		const verity = Math.max(0, Math.min(4, Math.round(match.mention.confidence || (match.score / 5))));
		let starsHtml = '<div style="display:flex; gap:3px; align-items:center;">';
		for (let s = 1; s <= 4; s++) {
			starsHtml += MentionsEditor._makeStarSVG(s <= verity).outerHTML;
		}
		starsHtml += '</div>';

		this.verityEl.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:13px; color:var(--me-text-secondary); font-weight:500;">Verity:</span>
        ${starsHtml}
      </div>
    `;

		this.detailEl.innerHTML = `
      <div class="me-score-row">
        <span class="me-score-value">${score}</span>
        <span class="me-score-label">match score</span>
      </div>
      <div class="me-factor-pills">${pillsHtml}</div>
      <div class="me-narrative-block">
        <p>${MentionsEditor._esc(match.mention.narrative || '')}</p>
      </div>
      <table class="me-field-table">${fieldRows}</table>
      ${originalDataHtml}
    `;
	}

	_handleAdd() {
		const mention = this.getCurrentMention();
		if (!mention || !this.targetPerson) return;

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
	}

	static _esc(str) {
		const div = document.createElement('div');
		div.textContent = str;
		return div.innerHTML;
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

	getMockMentions(node) {
		if (!node) return [];
		const o = [app.mentions[0], app.mentions[1], app.mentions[2], app.mentions[3]];
		return o;
	}
}


window.MentionsEditor = MentionsEditor;
