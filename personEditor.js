/* ============================================================
   Verité — Person Editor
   Vanilla JS module using jQuery + jQuery UI.
   Embed a target <div> in a tab, then call:
	   ShowPersonEditor(personId, $('#myTabDiv'))
   ============================================================ */

class PersonEditor {

	static FAKE_PERSONS = {
	};

	/* ----------------------------------------------------------
	   COLOR RAMPS (per field, light pill bg / dark text)
	   ---------------------------------------------------------- */
	static COLORS = {
		first_name: 'c-purple', norm_first_name: 'c-purple', last_name: 'c-teal', nysiis_last_name: 'c-coral',
		soundex_last_name: 'c-coral', suffix: 'c-amber', race: 'c-pink', gender: 'c-pink',
		birth_year: 'c-blue', death_year: 'c-blue', linked_persons: 'c-green'
	};

	static RAMP = {
		'c-purple': ['#EEEDFE', '#26215C'], 'c-teal': ['#E1F5EE', '#04342C'], 'c-coral': ['#FAECE7', '#4A1B0C'],
		'c-pink': ['#FBEAF0', '#4B1528'], 'c-gray': ['#F1EFE8', '#2C2C2A'], 'c-blue': ['#E6F1FB', '#042C53'],
		'c-amber': ['#FCEFD9', '#4A2E07'], 'c-green': ['#E5F4E9', '#0F3D1F']
	};

	static STAR_FILL = '#EF9F27';
	static STAR_EMPTY = '#9e9e9e';
	static STAR_PATH = "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z";

	/* ----------------------------------------------------------
	   FIELD CONFIG
	   Each entry describes how to render the FACTORS row for
	   that property of the person object.
	   ---------------------------------------------------------- */
	static FIELD_CONFIG = [
		{
			key: 'first_name', label: 'First name', editKind: 'free',
			compare: ['ignore', 'exact', 'fuzzy', 'rarity'], compareMode: 'multi'
		},
		{
			key: 'norm_first_name', label: 'Nick name', editKind: 'locked',
			compare: ['ignore', 'exact', 'fuzzy', 'rarity'], compareMode: 'multi'
		},
		{
			key: 'last_name', label: 'Last name', editKind: 'free',
			compare: ['ignore', 'exact', 'fuzzy', 'rarity'], compareMode: 'multi'
		},
		{
			key: 'nysiis_last_name', label: 'NYSIIS', editKind: 'locked',
			compare: ['ignore', 'exact', 'rarity'], compareMode: 'multi'
		},
		{
			key: 'soundex_last_name', label: 'Soundex', editKind: 'locked',
			compare: ['ignore', 'exact', 'rarity'], compareMode: 'multi'
		},
		{
			key: 'suffix', label: 'Suffix', editKind: 'choice', choices: ['Jr', 'Sr'],
			compare: ['ignore', 'exact'], compareMode: 'multi'
		},
		{
			key: 'race', label: 'Race', editKind: 'choice', choices: [{ v: 'B', l: 'Black' }, { v: 'W', l: 'White' }],
			compare: ['ignore', 'exact'], compareMode: 'multi'
		},
		{
			key: 'gender', label: 'Gender', editKind: 'choice', choices: [{ v: 'M', l: 'M' }, { v: 'F', l: 'F' }],
			compare: ['ignore', 'exact'], compareMode: 'multi'
		},
		{
			key: 'birth_year', label: 'Birth year', editKind: 'free',
			compare: ['ignore', 'exact', '±1', '±2', '±3', '±5'], compareMode: 'radio'
		},
		{
			key: 'death_year', label: 'Death year', editKind: 'free',
			compare: ['ignore', 'exact', '±1', '±2', '±3', '±5'], compareMode: 'radio'
		},
		{ key: 'linked_persons', label: 'Linked people', editKind: 'linked' }
	];

	/* ----------------------------------------------------------
	   SVG star helpers
	   ---------------------------------------------------------- */
	static makeStarSVG(filled) {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('width', '18');
		svg.setAttribute('height', '18');
		svg.style.display = 'block';
		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		path.setAttribute('d', PersonEditor.STAR_PATH);
		path.setAttribute('fill', filled ? PersonEditor.STAR_FILL : 'none');
		path.setAttribute('stroke', filled ? PersonEditor.STAR_FILL : PersonEditor.STAR_EMPTY);
		path.setAttribute('stroke-width', '1.5');
		path.setAttribute('stroke-linejoin', 'round');
		svg.appendChild(path);
		return svg;
	}

	static paintStars(container, n) {
		container.children().each(function (idx) {
			const path = this.querySelector('path');
			const filled = idx < n;
			path.setAttribute('fill', filled ? PersonEditor.STAR_FILL : 'none');
			path.setAttribute('stroke', filled ? PersonEditor.STAR_FILL : PersonEditor.STAR_EMPTY);
		});
	}

	/* ----------------------------------------------------------
	   Build the list of selectable "VALUE" options for a field
	   by combining the canonical value with any mention variants.
	   ---------------------------------------------------------- */
	static buildOptions(person, key) {
		const seen = new Set();
		const options = [];

		const cfg = PersonEditor.FIELD_CONFIG.find(c => c.key === key);
		if (cfg && cfg.choices) {
			cfg.choices.forEach(c => {
				let v = typeof c === 'object' ? c.v : c;
				let valString = String(v);
				if (!valString.includes(':')) valString = `${valString}:Added`;
				if (!seen.has(valString)) {
					options.push({ value: valString, option: valString });
					seen.add(valString);
				}
			});
		}

		const canonical = person[key];
		if (canonical != null && canonical !== '') {
			let valString = String(canonical);
			if (!valString.includes(':')) valString = `${valString}:Added`;
			if (!seen.has(valString)) {
				options.push({ value: valString, option: valString });
				seen.add(valString);
			}
		}

		(person.mentions || []).forEach(m => {
			const v = m.field_values && m.field_values[key];
			if (v != null && v !== '') {
				let valString = `${v}:${m.source}`;
				if (!seen.has(valString)) {
					seen.add(valString);
					options.push({ value: valString, option: valString });
				}
			}
		});

		if (options.length === 0) {
			options.push({ value: '', option: '(none)' });
		}
		return options;
	}

	/* ----------------------------------------------------------
	   Main entry point
	   ---------------------------------------------------------- */


	constructor($target) {
		this.$target = $target || $('body');
		app.personEditor = this;
	}

	load(personId) {
		const $target = this.$target;
		const person = PersonEditor.FAKE_PERSONS[personId];

		if (!person) {
			$target.empty().append($('<p>').text('Person not found: ' + personId));
			return;
		}

		// working copy of state (selections, weights, etc.)
		const state = PersonEditor.buildState(person);

		$target.empty();
		const $dialog = $('<div class="vpe-dialog"></div>');
		$target.append($dialog);

		PersonEditor.renderShell($dialog, person, state);
		PersonEditor.renderFactors($dialog, person, state);
		PersonEditor.renderFooter($dialog, person, state);

		PersonEditor.injectStylesOnce();
	}

	/* ----------------------------------------------------------
	   State initialization
	   ---------------------------------------------------------- */
	static buildState(person) {
		if (person.first_name && !person.norm_first_name) {
			person.norm_first_name = window.Normalize.getNickname(person.first_name.split(':')[0]);
		}
		if (person.last_name) {
			const lnBase = person.last_name.split(':')[0];
			if (!person.nysiis_last_name) person.nysiis_last_name = window.Normalize.getNYSIIS(lnBase);
			if (!person.soundex_last_name) person.soundex_last_name = window.Normalize.getSoundex(lnBase);
		}

		const fields = {};
		PersonEditor.FIELD_CONFIG.forEach(cfg => {
			if (cfg.editKind === 'linked') return;

			const options = PersonEditor.buildOptions(person, cfg.key);
			let selectedIdx = 0;
			const canonical = person[cfg.key];
			let found = -1;
			if (canonical != null && canonical !== '') {
				let canStr = String(canonical);
				if (!canStr.includes(':')) canStr = `${canStr}:Added`;
				found = options.findIndex(o => o.value === canStr);
			}
			if (found >= 0) selectedIdx = found;

			fields[cfg.key] = {
				options: options,
				selected: selectedIdx,
				weight: 3,                       // default impact
				compare: cfg.compare,
				compareMode: cfg.compareMode,
				active: ['ignore'],
				editing: false
			};
		});

		const sources = {};
		if (window.GlobalSources) {
			Object.keys(window.GlobalSources).forEach(k => {
				sources[k] = { label: k, checked: true };
			});
		}
		(person.mentions || []).forEach(m => { 
			if (!sources[m.source]) {
				sources[m.source] = { label: m.source, checked: true }; 
			}
		});

		return {
			fields: fields,
			sources: sources,
			verity: Math.max(0, Math.min(4, Math.round(person.verity !== undefined ? person.verity : (person.confidence || 0))))
		};
	}

	/* ----------------------------------------------------------
	   Shell: header + factors table container
	   ---------------------------------------------------------- */
	static renderShell($dialog, person, state) {
		const fname = (person.first_name || '').split(':')[0];
		const lname = (person.last_name || '').split(':')[0];
		$dialog.append(`
      <div class="vpe-header">
        <div>
          <p class="vpe-target-summary">${PersonEditor.escapeHtml(fname)} ${PersonEditor.escapeHtml(lname)} ${PersonEditor.escapeHtml(person.birth_year || '?')}-${PersonEditor.escapeHtml(person.death_year || '?')}</p>
        </div>
        <i class="ti ti-x vpe-close" aria-label="Close"></i>
      </div>
      <div class="vpe-factors"></div>
      <div class="vpe-footer"></div>
    `);

		$dialog.find('.vpe-close').on('click', function () {
			$dialog.trigger('vpe:close');
		});
	}

	/* ----------------------------------------------------------
	   FACTORS table
	   ---------------------------------------------------------- */
	static renderFactors($dialog, person, state) {
		const $factors = $dialog.find('.vpe-factors');
		$factors.empty();

		$factors.append(`
      <div class="vpe-row vpe-row-header">
        <div>FIELD</div><div>VALUE</div><div>IMPACT</div><div>COMPARE</div>
      </div>
    `);

		PersonEditor.FIELD_CONFIG.forEach(cfg => {
			if (cfg.editKind === 'linked') {
				$factors.append(PersonEditor.renderLinkedRow(person, cfg));
				return;
			}
			$factors.append(PersonEditor.renderFieldRow(person, cfg, state));
		});

		// re-render after any change
		$factors.off('vpe:rerender').on('vpe:rerender', function () {
			PersonEditor.renderFactors($dialog, person, state);
		});
	}

	/* ----- single field row (free / choice / locked) ----- */
	static renderFieldRow(person, cfg, state) {
		const fstate = state.fields[cfg.key];
		const ramp_ = PersonEditor.RAMP[PersonEditor.COLORS[cfg.key]] || PersonEditor.RAMP['c-gray'];

		const $row = $(`<div class="vpe-row"></div>`);
		$row.append(`<div class="vpe-field-label">${PersonEditor.escapeHtml(cfg.label)}</div>`);

		// VALUE
		const $val = $(`<div class="vpe-value-pill" style="background:${ramp_[0]}"></div>`);

		const isNull = fstate.selected === -1 || fstate.selected == null;
		let val1 = "", val2 = "";
		let fullVal = "";
		if (!isNull) {
			fullVal = fstate.options[fstate.selected].value;
			const parts = fullVal.split(':');
			if (parts.length > 1) {
				val1 = parts[0];
				val2 = parts.slice(1).join(':');
			} else {
				val1 = fullVal;
				val2 = fullVal;
			}
			
			if (['norm_first_name', 'nysiis_last_name', 'soundex_last_name'].includes(cfg.key)) {
				val1 = val1.toUpperCase();
				val2 = "";
			} else if (['first_name', 'last_name'].includes(cfg.key)) {
				val1 = val1.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
			}
		}

		if (cfg.editKind === 'free' && fstate.editing) {
			let currentVal = val1; // Pre-fill with the first part only
			const $input = $(`<input type="text" placeholder="Type a value…" style="color:${ramp_[1]}" value="${PersonEditor.escapeHtml(currentVal)}">`);

			const saveInput = function () {
				if (!fstate.editing) return;
				let txt = $input.val().trim();
				if (txt) {
					if (!txt.includes(':')) txt = txt + ':Added';
					fstate.options.push({ value: txt, option: txt });
					fstate.selected = fstate.options.length - 1;
				} else {
					fstate.selected = -1;
				}
				fstate.editing = false;
				$row.trigger('vpe:changed');
			};

			$input.on('input', function () {
				const val = $input.val().trim().split(':')[0];
				const $factors = $row.closest('.vpe-factors');
				if (cfg.key === 'first_name') {
					const norm = window.Normalize.getNickname(val);
					$factors.find('.vpe-row').filter(function () { return $(this).find('.vpe-field-label').text() === 'Nick name'; }).find('.vpe-chip').text(norm ? norm.toUpperCase() : '');
				} else if (cfg.key === 'last_name') {
					$factors.find('.vpe-row').filter(function () { return $(this).find('.vpe-field-label').text() === 'NYSIIS'; }).find('.vpe-chip').text(window.Normalize.getNYSIIS(val) ? window.Normalize.getNYSIIS(val).toUpperCase() : '');
					$factors.find('.vpe-row').filter(function () { return $(this).find('.vpe-field-label').text() === 'Soundex'; }).find('.vpe-chip').text(window.Normalize.getSoundex(val) ? window.Normalize.getSoundex(val).toUpperCase() : '');
				}
			});

			$input.on('keydown', function (e) {
				if (e.key === 'Enter') {
					saveInput();
				} else if (e.key === 'Escape') {
					fstate.editing = false;
					$row.trigger('vpe:changed');
				}
			});

			$input.on('blur', function () {
				saveInput();
			});

			const $cancel = $(`<i class="ti ti-x" style="cursor:pointer;color:${ramp_[1]}"></i>`);
			$cancel.on('click', function () { fstate.editing = false; $row.trigger('vpe:changed'); });
			$val.append($input, $cancel);
			$row.append($val);

			// empty impact/compare placeholders to keep grid alignment
			$row.append('<div></div><div></div>');
			PersonEditor.bindChanged($row, person, cfg, state);
			setTimeout(() => $input.trigger('focus'), 0);
			return $row;
		}

		const $chip = $(`<span class="vpe-chip" style="color:${ramp_[1]}"></span>`);
		if (!isNull && val1) $chip.text(val1);
		$val.append($chip);

		if (cfg.editKind === 'free' || cfg.editKind === 'choice') {
			const $selContainer = $(`<div style="position: relative; flex: 1; display: flex; align-items: center; justify-content: flex-end; min-height: 20px;"></div>`);
			const displayVal2 = val2 ? PersonEditor.escapeHtml(val2) : '&nbsp;';
			const $visibleText = $(`<span style="color:${isNull ? 'transparent' : ramp_[1]}; padding:0 4px; font-size:12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayVal2}</span>`);
			const $sel = $(`<select style="opacity:0; position:absolute; left:0; top:0; width:100%; height:100%; cursor:pointer;"></select>`);

			fstate.options.forEach((o, i) => {
				$sel.append(`<option value="${i}" ${i === fstate.selected ? 'selected' : ''} style="color:${ramp_[1]}">${PersonEditor.escapeHtml(o.option)}</option>`);
			});
			$sel.append(`<option value="-1" ${isNull ? 'selected' : ''} style="color:${ramp_[1]}">Make blank</option>`);
			if (cfg.editKind === 'free') {
				$sel.append(`<option value="addtext" style="color:${ramp_[1]}">Add text</option>`);
			}
			$sel.on('change', function () {
				const v = $(this).val();
				if (v === 'addtext') { fstate.editing = true; }
				else { fstate.selected = parseInt(v, 10); }
				$row.trigger('vpe:changed');
			});

			$selContainer.append($visibleText, $sel);
			$val.append($selContainer);
		} else {
			$val.append(`<span style="color:${ramp_[1]}; padding:0 4px; font-size:12px; margin-left:auto;">${PersonEditor.escapeHtml(val2)}</span>`);
			$val.append(`<i class="ti ti-lock" style="color:${ramp_[1]};opacity:.6;margin-left:4px;" aria-label="Not editable"></i>`);
		}
		$row.append($val);

		// IMPACT
		const $impact = $(`<div class="vpe-star-row"></div>`);
		for (let s = 1; s <= 4; s++) {
			const svg = PersonEditor.makeStarSVG(s <= fstate.weight);
			svg.setAttribute('aria-label', `${s} star${s > 1 ? 's' : ''}`);
			$(svg).css('cursor', 'pointer');
			$impact.append(svg);
			$(svg).on('click', function () {
				fstate.weight = s;
				PersonEditor.paintStars($impact, fstate.weight);
			});
		}
		$row.append($impact);

		// COMPARE
		const $compare = $(`<div class="vpe-compare-row"></div>`);
		fstate.compare.forEach(label => {
			const isActive = fstate.active.includes(label);
			const $pill = $(`<button type="button" class="vpe-pill ${isActive ? 'active' : ''}">${PersonEditor.escapeHtml(label)}</button>`);
			$pill.on('click', function () {
				if (fstate.compareMode === 'radio') {
					fstate.active = [label];
				} else {
					if (label === 'ignore') {
						fstate.active = ['ignore'];
					} else {
						fstate.active = fstate.active.filter(a => a !== 'ignore');
						if (fstate.active.includes(label)) {
							fstate.active = fstate.active.filter(a => a !== label);
							if (fstate.active.length === 0) fstate.active = ['ignore'];
						} else {
							fstate.active = [...fstate.active, label];
						}
					}
				}
				$row.trigger('vpe:changed');
			});
			$compare.append($pill);
		});
		$row.append($compare);

		PersonEditor.bindChanged($row, person, cfg, state);
		return $row;
	}

	/* ----- linked people row ----- */
	static renderLinkedRow(person, cfg) {
		const ramp_ = PersonEditor.RAMP[PersonEditor.COLORS.linked_persons];
		const linked = person.linked_persons || [];
		
		const rels = (window.app && window.app.curTree) 
			? window.app.curTree.relationships.filter(r => r.subject_id === person.person_id) 
			: [];

		const $row = $(`<div class="vpe-row vpe-row-linked"></div>`);
		$row.append(`<div class="vpe-field-label">${PersonEditor.escapeHtml(cfg.label)}</div>`);

		const $val = $(`<div class="vpe-value-pill" style="background:${ramp_[0]}"></div>`);
		const $chip = $(`<span class="vpe-chip" style="color:${ramp_[1]}">${linked.length + rels.length} linked people</span>`);
		$val.append($chip);

		const $sel = $(`<select style="color:${ramp_[1]}"></select>`);
		$sel.append('<option value="">View linked people</option>');
		linked.forEach((p, i) => {
			$sel.append(`<option value="${i}" disabled style="color:${ramp_[1]}">${PersonEditor.escapeHtml(p.value)} (${PersonEditor.escapeHtml(p.source)})</option>`);
		});
		rels.forEach((r, i) => {
			const objPerson = window.app.curTree.person[r.object_id];
			const fname = objPerson ? (objPerson.first_name||'').split(':')[0] : '';
			const lname = objPerson ? (objPerson.last_name||'').split(':')[0] : '';
			const fullName = `${fname} ${lname}`.trim() || r.object_id;
			$sel.append(`<option value="rel_${i}" style="color:${ramp_[1]}">${PersonEditor.escapeHtml(fullName)} - ${PersonEditor.escapeHtml(r.predicate)}</option>`);
		});
		
		$sel.on('change', function() {
			const val = $(this).val();
			if (val && val.startsWith('rel_')) {
				const idx = parseInt(val.split('_')[1], 10);
				const rel = rels[idx];
				if (rel && window.app && typeof window.app.selectNodeAndShowEditor === 'function') {
					window.app.selectNodeAndShowEditor(rel.object_id);
				}
				$(this).val(''); // Reset
			}
		});

		$val.append($sel);

		$row.append($val);
		return $row;
	}

	/* re-render the whole factors table when a row changes */
	static bindChanged($row, person, cfg, state) {
		$row.on('vpe:changed', function () {
			const fstate = state.fields[cfg.key];
			let selectedValue = null;
			if (fstate && fstate.selected >= 0 && fstate.options[fstate.selected]) {
				selectedValue = fstate.options[fstate.selected].value;
			}

			if (cfg.key === 'first_name' && selectedValue) {
				let norm = window.Normalize.getNickname(selectedValue.split(':')[0]);
				if (norm) PersonEditor.updateFieldState(state, 'norm_first_name', norm);
			} else if (cfg.key === 'last_name' && selectedValue) {
				let baseVal = selectedValue.split(':')[0];
				let nysiis = window.Normalize.getNYSIIS(baseVal);
				if (nysiis) PersonEditor.updateFieldState(state, 'nysiis_last_name', nysiis);
				let soundex = window.Normalize.getSoundex(baseVal);
				if (soundex) PersonEditor.updateFieldState(state, 'soundex_last_name', soundex);
			}

			$row.closest('.vpe-factors').trigger('vpe:rerender');
		});
	}

	static updateFieldState(state, key, newValue) {
		const fs = state.fields[key];
		if (!fs) return;
		let idx = fs.options.findIndex(o => String(o.value).toUpperCase() === String(newValue).toUpperCase());
		if (idx >= 0) {
			fs.selected = idx;
		} else {
			fs.options.push({ value: newValue, option: newValue });
			fs.selected = fs.options.length - 1;
		}
	}

	/* ----------------------------------------------------------
	   FOOTER: Verity stars, Sources dropdown, Search button
	   ---------------------------------------------------------- */
	static renderFooter($dialog, person, state) {
		const $footer = $dialog.find('.vpe-footer');
		$footer.empty();

		// Verity (read-only, from confidence)
		const $verity = $(`<div class="vpe-verity"><span class="vpe-verity-label">Verity:</span></div>`);
		const $stars = $('<div class="vpe-star-row"></div>');
		for (let s = 1; s <= 4; s++) {
			const svg = PersonEditor.makeStarSVG(s <= state.verity);
			svg.setAttribute('aria-label', `${s} star${s > 1 ? 's' : ''}`);
			$stars.append(svg);
		}
		$verity.append($stars);

		// Sources dropdown
		const $sourcesWrap = $('<div class="vpe-sources-wrap"></div>');
		PersonEditor.renderSourcesDropdown($sourcesWrap, state);

		// Search button
		const $searchBtn = $(`<button type="button" class="vpe-search-btn"><i class="ti ti-search"></i>Search</button>`);
		$searchBtn.on('click', function () {
			$dialog.trigger('vpe:search', [PersonEditor.collectCriteria(person, state)]);
		});

		const $right = $('<div class="vpe-footer-right"></div>');
		$right.append($sourcesWrap, $searchBtn);

		$footer.append($verity, $right);
	}

	static renderSourcesDropdown($wrap, state) {
		$wrap.empty();
		const ids = Object.keys(state.sources);
		const checkedCount = ids.filter(id => state.sources[id].checked).length;

		const $btn = $(`
      <button type="button" class="vpe-sources-btn">
        <span>Sources${checkedCount ? ` (${checkedCount})` : ''}</span>
        <i class="ti ti-chevron-down"></i>
      </button>
    `);
		$wrap.append($btn);

		let open = false;
		$btn.on('click', function (e) {
			e.stopPropagation();
			open = !open;
			if (open) showPanel(); else $wrap.find('.vpe-sources-panel').remove();
		});

		$(document).on('click.vpe-sources-' + Math.random(), function () {
			if (open) { open = false; $wrap.find('.vpe-sources-panel').remove(); }
		});

		function showPanel() {
			$wrap.find('.vpe-sources-panel').remove();
			const $panel = $('<div class="vpe-sources-panel"></div>');
			$panel.on('click', e => e.stopPropagation());

			const $headerRow = $('<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"></div>');
			$headerRow.append('<div style="font-size:13px; font-weight:bold; color:#333;">Choose source(s) to search:</div>');

			const $closeBtn = $(`<button type="button" style="background:none; border:none; cursor:pointer; color:#757575; padding:4px; display:flex; align-items:center; justify-content:center;"><i class="ti ti-x"></i></button>`);
			$closeBtn.on('click', function(e) {
				e.stopPropagation();
				open = false;
				$wrap.find('.vpe-sources-panel').remove();
			});
			$headerRow.append($closeBtn);
			$panel.append($headerRow);

			const allChecked = ids.every(id => state.sources[id].checked);
			const $toggleRow = $('<div class="vpe-toggle-all-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"></div>');
			
			const $leftGroup = $('<div style="display:flex; align-items:center; gap:8px;"></div>');
			$leftGroup.append(`<span class="vpe-toggle-label">${allChecked ? 'All selected' : 'Select all'}</span>`);
			const $toggleBtn = $(`<button type="button" class="vpe-toggle-btn">${allChecked ? 'Clear all' : 'Select all'}</button>`);
			$toggleBtn.on('click', function (e) {
				e.stopPropagation();
				const newVal = !allChecked;
				ids.forEach(id => state.sources[id].checked = newVal);
				PersonEditor.renderSourcesDropdown($wrap, state);
				$wrap.find('.vpe-sources-btn').click(); // re-open after re-render
			});
			$leftGroup.append($toggleBtn);

			$toggleRow.append($leftGroup);
			$panel.append($toggleRow);

			ids.forEach(id => {
				const src = state.sources[id];
				const $row = $('<div class="vpe-source-row"></div>');
				const $cb = $(`<input type="checkbox" ${src.checked ? 'checked' : ''}>`);
				$cb.on('click', e => e.stopPropagation());
				$cb.on('change', function () { 
					src.checked = $cb.is(':checked'); 
					PersonEditor.renderSourcesDropdown($wrap, state); 
					$wrap.find('.vpe-sources-btn').click(); // re-open
				});
				$row.append($cb, `<span>${PersonEditor.escapeHtml(src.label)}</span>`);
				$row.on('click', function (e) {
					if (e.target !== $cb[0]) {
						$cb.prop('checked', !$cb.is(':checked'));
						src.checked = $cb.is(':checked');
						PersonEditor.renderSourcesDropdown($wrap, state);
						$wrap.find('.vpe-sources-btn').click(); // re-open
					}
				});
				$panel.append($row);
			});

			$wrap.append($panel);
		}
	}

	/* ----------------------------------------------------------
	   Collect current criteria for "Search"
	   ---------------------------------------------------------- */
	static collectCriteria(person, state) {
		const criteria = { person_id: person.person_id, fields: {}, sources: [] };
		Object.keys(state.fields).forEach(key => {
			const f = state.fields[key];
			const sel = f.selected;
			criteria.fields[key] = {
				value: (sel === -1 || sel == null) ? null : f.options[sel].value,
				weight: f.weight,
				compare: f.active
			};
		});
		Object.keys(state.sources).forEach(id => {
			if (state.sources[id].checked) criteria.sources.push(id);
		});
		return criteria;
	}

	/* ----------------------------------------------------------
	   Utilities
	   ---------------------------------------------------------- */
	static escapeHtml(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	static stylesInjected = false;
	static injectStylesOnce() {
		if (PersonEditor.stylesInjected) return;
		PersonEditor.stylesInjected = true;
		const css = `
      .person-editor {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #e5e5e5;
        border-radius: 12px;
        margin-left: 0;
        margin-top: 0;
        padding: 0;
        box-sizing: border-box;
      }
      .vpe-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; }
      .vpe-dialog { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        background:#fff; border-radius:12px; border:1px solid #e3ddd5; box-shadow:0 2px 8px rgba(0,0,0,0.06); width:100%; box-sizing:border-box; padding:0.5rem; overflow:hidden; }
      .vpe-title { margin:0; font-size:15px; font-weight:600; }
      .vpe-target-summary { font-size:18px; font-weight:600; color:#333; margin:2px 0 0; }
      .vpe-close { font-size:20px; color:#757575; cursor:pointer; }
      .vpe-section-label { font-size:13px; font-weight:500; letter-spacing:.05em; color:#9e9e9e; margin:0 0 .75rem; }
      .vpe-row { display:grid; grid-template-columns:130px 240px 80px 1fr; gap:8px 24px; align-items:center;
        padding:4px 8px; border-top:0.5px solid #f0f0f0; }
      .vpe-row-header { font-size:12px; font-weight:500; color:#9e9e9e; border-top:none; padding:4px 8px; }
      .vpe-row-linked { grid-template-columns:130px 1fr; }
      .vpe-field-label { font-size:13px; font-weight:500; }
      .vpe-value-pill { display:flex; align-items:center; flex-wrap:wrap; gap:4px; width:100%;
        min-height:24px; border-radius:999px; padding:2px 6px; }
      .vpe-chip { display:inline-flex; align-items:center; gap:4px; font-size:12px; padding:2px 6px;
        border-radius:999px; white-space:nowrap; min-width:24px; min-height:18px; background:#fff; }
      .vpe-value-pill select, .vpe-value-pill input[type=text] {
        font-size:12px; height:20px; padding:0 4px; min-width:90px; flex:1; background:transparent;
        border:none; }
      .vpe-star-row { display:flex; gap:3px; align-items:center; }
      .vpe-compare-row { display:flex; flex-wrap:wrap; gap:6px; }
      .vpe-pill { display:inline-flex; align-items:center; font-size:12px; padding:3px 10px; border-radius:999px;
        white-space:nowrap; cursor:pointer; border:0.5px solid #f0f0f0; background:transparent; color:#757575; }
      .vpe-pill.active { background:#eaf2fb; color:#185fa5; border-color:#b5d4f4; }
      .vpe-footer { display:flex; justify-content:space-between; align-items:center; gap:8px;
        margin-top:1.5rem; padding-top:1rem; border-top:0.5px solid #f0f0f0; }
      .vpe-verity { display:flex; align-items:center; gap:6px; }
      .vpe-verity-label { font-size:13px; font-weight:500; color:#757575; }
      .vpe-footer-right { display:flex; align-items:center; gap:8px; position:relative; }
      .vpe-sources-wrap { position:relative; }
      .vpe-sources-btn { display:flex; align-items:center; gap:6px; background:transparent; border:0.5px solid #f0f0f0;
        border-radius:6px; padding:8px 12px; font-size:13px; font-weight:500; cursor:pointer; }
      .vpe-sources-panel { position:absolute; bottom:calc(100% + 6px); right:0; background:#fff; border:0.5px solid #f0f0f0;
        border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,.12); padding:8px; min-width:220px; z-index:20; }
      .vpe-toggle-all-row { display:flex; align-items:center; justify-content:space-between; padding:6px 8px;
        border-bottom:0.5px solid #f0f0f0; margin-bottom:4px; }
      .vpe-toggle-label { font-size:12px; font-weight:500; color:#9e9e9e; }
      .vpe-toggle-btn { font-size:12px; padding:2px 10px; background:transparent; border:0.5px solid #f0f0f0;
        border-radius:4px; cursor:pointer; }
      .vpe-source-row { display:flex; align-items:center; gap:8px; padding:6px 8px; font-size:13px; cursor:pointer; border-radius:6px; }
      .vpe-source-row:hover { background:#f5f5f5; }
      .vpe-source-row input { width:14px; height:14px; cursor:pointer; flex-shrink:0; }
      .vpe-search-btn { display:flex; align-items:center; gap:6px; background:#eaf2fb; border:1px solid #b5d4f4;
        border-radius:6px; padding:8px 16px; color:#185fa5; text-transform:uppercase; letter-spacing:.04em;
        font-size:12px; font-weight:600; cursor:pointer; }
    `;
		$('<style>').text(css).appendTo('head');
	}

}

window.PersonEditor = PersonEditor;
window._VPE_FAKE_PERSONS = PersonEditor.FAKE_PERSONS; // for testing/dev
