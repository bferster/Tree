/* ============================================================
   Verité — Person Editor
   Vanilla JS module using jQuery + jQuery UI.
   Embed a target <div> in a tab, then call:
	   ShowPersonEditor(personId, $('#myTabDiv'))
   ============================================================ */

class PersonEditor {

	/* ----------------------------------------------------------
	   COLOR RAMPS (per field, light pill bg / dark text)
	   ---------------------------------------------------------- */
	static COLORS = {
		first_name: 'c-purple',
		middle_name: 'c-indigo',
		norm_first_name: 'c-pink',
		last_name: 'c-teal',
		nysiis_last_name: 'c-coral',
		soundex_last_name: 'c-orange',
		suffix: 'c-amber',
		race: 'c-brown',
		gender: 'c-cyan',
		birth_year: 'c-blue',
		death_year: 'c-lime',
		linked_persons: 'c-green'
	};

	static RAMP = {
		'c-purple': ['#EEEDFE', '#26215C'],
		'c-teal': ['#E1F5EE', '#04342C'],
		'c-coral': ['#FAECE7', '#4A1B0C'],
		'c-pink': ['#FBEAF0', '#4B1528'],
		'c-blue': ['#E6F1FB', '#042C53'],
		'c-amber': ['#FCEFD9', '#4A2E07'],
		'c-green': ['#E5F4E9', '#0F3D1F'],
		'c-indigo': ['#E8EAF6', '#1A237E'],
		'c-cyan': ['#E0F7FA', '#006064'],
		'c-lime': ['#F9FBE7', '#827717'],
		'c-orange': ['#FFF3E0', '#E65100'],
		'c-brown': ['#EFEBE9', '#3E2723'],
		'c-gray': ['#F1EFE8', '#2C2C2A']
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
			compare: ['ignore', 'exact', 'fuzzy', 'rare'], compareMode: 'multi'
		},
		{
			key: 'middle_name', label: 'Middle name', editKind: 'free',
			compare: ['ignore', 'exact', 'fuzzy', 'rare'], compareMode: 'multi'
		},
		{
			key: 'norm_first_name', label: 'Nick name', editKind: 'locked',
			compare: ['ignore', 'exact', 'fuzzy', 'rare'], compareMode: 'multi'
		},
		{
			key: 'last_name', label: 'Last name', editKind: 'free',
			compare: ['ignore', 'exact', 'fuzzy', 'rare'], compareMode: 'multi'
		},
		{
			key: 'nysiis_last_name', label: 'NYSIIS', editKind: 'locked',
			compare: ['ignore', 'exact'], compareMode: 'multi'
		},
		{
			key: 'soundex_last_name', label: 'Soundex', editKind: 'locked',
			compare: ['ignore', 'exact'], compareMode: 'multi'
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
	static makeColoredStarSVG(filled, color) {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('width', '20');
		svg.setAttribute('height', '20');
		svg.style.display = 'block';
		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		path.setAttribute('d', PersonEditor.STAR_PATH);
		path.setAttribute('fill', filled ? color : 'none');
		path.setAttribute('stroke', color);
		path.setAttribute('stroke-width', '1.5');
		path.setAttribute('stroke-linejoin', 'round');
		svg.appendChild(path);
		return svg;
	}

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
		const seenValues = new Set();
		const options = [];

		const cfg = PersonEditor.FIELD_CONFIG.find(c => c.key === key);
		if (cfg && cfg.choices) {
			cfg.choices.forEach(c => {
				let v = typeof c === 'object' ? c.v : c;
				let valString = String(v);
				let optString = valString;
				if (!valString.includes(':')) valString = `${valString}:Added`;
				let baseVal = valString.split(':')[0].toLowerCase();
				let valStringKey = valString.toLowerCase();
				if (!seen.has(valStringKey)) {
					options.push({ value: valString, option: optString });
					seen.add(valStringKey);
					seenValues.add(baseVal);
				}
			});
		}

		let canonical = person[key];
		if (!canonical) {
			if (key === 'norm_first_name' && person.first_name) {
				canonical = window.Normalize.getNickname(person.first_name.split(':')[0]);
			} else if (key === 'nysiis_last_name' && person.last_name) {
				canonical = window.Normalize.getNYSIIS(person.last_name.split(':')[0]);
			} else if (key === 'soundex_last_name' && person.last_name) {
				canonical = window.Normalize.getSoundex(person.last_name.split(':')[0]);
			}
		}

		if (canonical != null && canonical !== '') {
			let valString = String(canonical);
			let optString = valString.includes(':') ? valString : String(canonical);
			if (!valString.includes(':')) {
				valString = `${valString}:Added`;
			}
			let baseVal = valString.split(':')[0].toLowerCase();
			let valStringKey = valString.toLowerCase();
			if (!seen.has(valStringKey)) {
				options.push({ value: valString, option: optString });
				seen.add(valStringKey);
				seenValues.add(baseVal);
			}
		}

		const mentionKeys = {
			first_name: 'first_name',
			middle_name: 'middle_name',
			last_name: 'last_name',
			race: 'norm_race',
			gender: 'gender',
			birth_year: 'birth_year',
			death_year: 'death_year'
		};

		const mentionField = mentionKeys[key];
		if (mentionField) {
			(person.mentions || []).forEach(m_id => {
				let m = typeof m_id === 'object' ? m_id : (window.app && window.app.mentions ? window.app.mentions.find(x => x.mention_id === m_id) : null);
				if (!m) return;

				let v = m.field_values ? m.field_values[mentionField] : m[mentionField];

				if (v != null && v !== '') {
					let baseVal = String(v).trim();
					let valString = `${baseVal}:${m.mention_id}`;
					let valStringKey = valString.toLowerCase();

					if (!seen.has(valStringKey)) {
						seen.add(valStringKey);
						seenValues.add(baseVal.toLowerCase());
						options.push({ value: valString, option: valString });
					}
				}
			});
		}

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
		let person = null;
		if (window.app && window.app.curTree && window.app.curTree.persons) {
			const persons = window.app.curTree.persons;
			if (Array.isArray(persons)) {
				person = persons.find(p => p.person_id === personId);
			} else {
				person = persons[personId];
			}
		}

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
		if (!PersonEditor.userSettings) {
			PersonEditor.userSettings = {
				useSmartName: true,
				compareActive: {
					first_name: ['exact'],
					middle_name: ['exact'],
					norm_first_name: ['exact'],
					last_name: ['exact'],
					nysiis_last_name: ['ignore'],
					soundex_last_name: ['ignore'],
					suffix: ['ignore'],
					race: ['exact'],
					gender: ['exact'],
					birth_year: ['±1'],
					death_year: ['±2']
				}
			};
		}

		const fields = {};
		PersonEditor.FIELD_CONFIG.forEach(cfg => {
			if (cfg.editKind === 'linked') return;

			const options = PersonEditor.buildOptions(person, cfg.key);
			let selectedIdx = (cfg.key === 'suffix') ? -1 : 0;

			let canonical = person[cfg.key];
			if (!canonical) {
				if (cfg.key === 'norm_first_name' && person.first_name) {
					canonical = window.Normalize.getNickname(person.first_name.split(':')[0]);
				} else if (cfg.key === 'nysiis_last_name' && person.last_name) {
					canonical = window.Normalize.getNYSIIS(person.last_name.split(':')[0]);
				} else if (cfg.key === 'soundex_last_name' && person.last_name) {
					canonical = window.Normalize.getSoundex(person.last_name.split(':')[0]);
				}
			}

			let found = -1;
			if (canonical != null && canonical !== '') {
				const getBase = (s) => String(s).split(':')[0].trim().toUpperCase();
				const canBase = getBase(canonical);
				found = options.findIndex(o => getBase(o.value) === canBase);
			}
			if (found >= 0) selectedIdx = found;

			let defaultActive = PersonEditor.userSettings.compareActive[cfg.key] || ['exact'];

			fields[cfg.key] = {
				options: options,
				selected: selectedIdx,
				weight: 0,                       // default impact
				compare: cfg.compare,
				compareMode: cfg.compareMode,
				active: defaultActive,
				editing: false
			};
		});

		const sources = {};
		const defaultSource = window.app ? window.app.source : 'CN-1870';

		let anyCheckedInit = false;
		if (window.GlobalSources) {
			Object.keys(window.GlobalSources).forEach(k => {
				let isChecked = false;
				if (window.app && window.app.sourceMatches && window.app.sourceMatches(k, [defaultSource])) {
					isChecked = true;
					anyCheckedInit = true;
				}
				sources[k] = { label: k, checked: isChecked };
			});
		}
		(person.mentions || []).forEach(m_id => {
			let m = typeof m_id === 'object' ? m_id : (window.app && window.app.mentions ? window.app.mentions.find(x => x.mention_id === m_id) : null);
			if (m && m.source && !sources[m.source]) {
				let isChecked = false;
				if (window.app && window.app.sourceMatches && window.app.sourceMatches(m.source, [defaultSource])) {
					isChecked = true;
					anyCheckedInit = true;
				}
				sources[m.source] = { label: m.source, checked: isChecked };
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
		const byear = person.birth_year ? String(person.birth_year).split(':')[0] : '?';
		const dyear = person.death_year ? String(person.death_year).split(':')[0] : '?';
		$dialog.append(`
      <div class="vpe-header">
        <div>
          <p class="vpe-target-summary">${PersonEditor.escapeHtml(fname)} ${PersonEditor.escapeHtml(lname)} &nbsp;&nbsp;(${PersonEditor.escapeHtml(byear)} - ${PersonEditor.escapeHtml(dyear)})</p>
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
        <div>FIELD</div>
        <div>VALUE</div>
        <div style="margin-left: 22px;">IMPACT</div>
        <div style="display: flex; justify-content: space-between; align-items: center; position: relative;">
          <span>COMPARE</span>
          <label id="vpe-smart-name-label"${PersonEditor.userSettings.useSmartName ? ' class="tab-active"' : ''}>
            <input type="checkbox" id="vpe-smart-name-cb"${PersonEditor.userSettings.useSmartName ? ' checked' : ''}> Smart name matching
          </label>
        </div>
      </div>
    `);

		$factors.find('#vpe-smart-name-cb').on('change', function () {
			PersonEditor.userSettings.useSmartName = $(this).is(':checked');
			$factors.trigger('vpe:rerender');
			$('#person-editor-container').trigger('change');
		});

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
			} else if (['first_name', 'middle_name', 'last_name'].includes(cfg.key)) {
				val1 = val1.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
			}
		}

		if (cfg.editKind === 'free' && fstate.editing) {
			let currentVal = ""; // Leave blank when starting to type
			const $input = $(`<input type="text" placeholder="Type a value…" style="color:${ramp_[1]}" value="${PersonEditor.escapeHtml(currentVal)}">`);

			const saveInput = function () {
				if (!fstate.editing) return;
				let txt = $input.val().trim();
				if (txt) {
					if (!txt.includes(':')) txt = txt + ':Added';
					fstate.options = fstate.options.filter(opt => !opt.value.endsWith(':Added'));
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

		const chipColor = cfg.key === 'soundex_last_name' ? '#000' : ramp_[1];
		const $chip = $(`<span class="vpe-chip" style="position: relative; color:${chipColor}"></span>`);
		const $chipText = $(`<span></span>`);
		if (!isNull && val1) $chipText.text(val1);
		$chip.append($chipText);

		if (cfg.editKind === 'free' || cfg.editKind === 'choice') {
			const $sel = $(`<select style="opacity:0; position:absolute; left:0; top:0; width:100%; height:100%; cursor:pointer; z-index:10;"></select>`);

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
			$chip.append($sel);

			$val.append($chip);

			const $rightContainer = $(`<div style="flex: 1; display: flex; align-items: center; justify-content: flex-end; min-height: 20px;"></div>`);
			const displayVal2 = val2 ? PersonEditor.escapeHtml(val2) : '&nbsp;';
			const $sourceText = $(`<span style="color:${isNull ? 'transparent' : ramp_[1]}; padding:0 4px; font-size:12px; font-weight:normal; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor:${(val2 && val2 !== 'Added') ? 'pointer' : 'default'};">${displayVal2}</span>`);

			$sourceText.on('click', function () {
				if (val2 && val2 !== 'Added') {
					$('#right-panel-content .tab-btn[data-target="mentions-editor-container"]').click();
				}
			});

			$rightContainer.append($sourceText);
			$val.append($rightContainer);
		} else {
			$val.append($chip);
			const displayVal2 = val2 ? PersonEditor.escapeHtml(val2) : '&nbsp;';
			const $sourceText = $(`<span style="color:${ramp_[1]}; padding:0 4px; font-size:12px; font-weight:normal; margin-left:auto; cursor:${(val2 && val2 !== 'Added') ? 'pointer' : 'default'};">${displayVal2}</span>`);
			$sourceText.on('click', function () {
				if (val2 && val2 !== 'Added') {
					$('#right-panel-content .tab-btn[data-target="mentions-editor-container"]').click();
				}
			});
			$val.append($sourceText);
			$val.append(`<i class="ti ti-lock" style="color:${ramp_[1]};opacity:.6;margin-left:4px;" aria-label="Not editable"></i>`);
		}
		$row.append($val);

		// IMPACT
		const $impact = $(`<div class="vpe-amount-row" style="display:flex; gap:4px; align-items:center; margin-left:22px;"></div>`);
		const options = [
			{ val: -1, label: '-' },
			{ val: 0, label: '0' },
			{ val: 1, label: '+' }
		];
		options.forEach(opt => {
			const displayVal = opt.label;
			const val = opt.val;
			const isActive = fstate.weight === val;

			let baseBg = 'transparent';
			let baseBorder = '#e5e7eb';
			let baseColor = '#6b7280';

			if (isActive) {
				if (val < 0) {
					baseBg = '#fde8e8';
					baseBorder = '#f8b4b4';
					baseColor = '#9b1c1c';
				} else if (val > 0) {
					baseBg = '#def7ec';
					baseBorder = '#bcf0da';
					baseColor = '#03543f';
				} else {
					baseBg = '#f3f4f6';
					baseBorder = '#d1d5db';
					baseColor = '#374151';
				}
			}

			const isSign = displayVal === '+' || displayVal === '-';
			const $btn = $(`<button type="button" class="vpe-amount-btn" style="
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 24px;
				height: 24px;
				border-radius: 50%;
				font-size: ${isSign ? '14px' : '11px'};
				font-weight: ${isSign ? '800' : '600'};
				cursor: pointer;
				border: 1px solid ${baseBorder};
				background: ${baseBg};
				color: ${baseColor};
				padding: 0;
				line-height: 1;
				transition: all 0.2s;
			">${displayVal}</button>`);

			$btn.on('click', function () {
				fstate.weight = val;
				$impact.children().each(function (idx) {
					const optInner = options[idx];
					const v = optInner.val;
					const active = fstate.weight === v;
					let bg = 'transparent';
					let border = '#e5e7eb';
					let c = '#6b7280';

					if (active) {
						if (v < 0) {
							bg = '#fde8e8';
							border = '#f8b4b4';
							c = '#9b1c1c';
						} else if (v > 0) {
							bg = '#def7ec';
							border = '#bcf0da';
							c = '#03543f';
						} else {
							bg = '#f3f4f6';
							border = '#d1d5db';
							c = '#374151';
						}
					}

					$(this).css({
						'background-color': bg,
						'border-color': border,
						'color': c
					});
				});
				$row.trigger('vpe:changed');
			});
			$impact.append($btn);
		});
		$row.append($impact);

		// COMPARE
		const $compare = $(`<div class="vpe-compare-row"></div>`);
		const isSmartNameChecked = PersonEditor.userSettings ? PersonEditor.userSettings.useSmartName : false;
		const nameFields = ['first_name', 'middle_name', 'norm_first_name', 'last_name', 'nysiis_last_name', 'soundex_last_name', 'suffix'];
		const isNameField = nameFields.includes(cfg.key);
		const shouldColorActive = !(isSmartNameChecked && isNameField);

		if (isNameField && isSmartNameChecked) {
			$compare.addClass('name-group');
			if (cfg.key === 'first_name') $compare.addClass('top');
			if (cfg.key === 'suffix') $compare.addClass('bottom');
		}

		fstate.compare.forEach(label => {
			const isActive = fstate.active.includes(label);
			const hasActiveColor = isActive && shouldColorActive;
			const $pill = $(`<button type="button" class="vpe-pill ${hasActiveColor ? 'active' : ''}">${PersonEditor.escapeHtml(label)}</button>`);
			$pill.on('click', function () {
				if (fstate.compareMode === 'radio') {
					fstate.active = [label];
				} else {
					if (label === 'ignore') {
						fstate.active = ['ignore'];
					} else {
						fstate.active = fstate.active.filter(a => a !== 'ignore');
						if (!fstate.active.includes(label)) {
							if (label === 'fuzzy' && fstate.active.includes('exact')) {
								fstate.active = fstate.active.filter(a => a !== 'exact');
							} else if (label === 'exact' && fstate.active.includes('fuzzy')) {
								fstate.active = fstate.active.filter(a => a !== 'fuzzy');
							}
							fstate.active = [...fstate.active, label];
						} else {
							fstate.active = fstate.active.filter(a => a !== label);
							if (fstate.active.length === 0) fstate.active = ['ignore'];
						}
					}
				}
				if (PersonEditor.userSettings) {
					PersonEditor.userSettings.compareActive[cfg.key] = fstate.active;
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

		const $val = $(`<div class="vpe-value-pill" style="position: relative; background:${ramp_[0]}"></div>`);
		const totalLinked = linked.length + rels.length;
		const $chip = $(`<span class="vpe-chip" style="position: relative; color:${ramp_[1]}">${totalLinked} linked ${totalLinked === 1 ? 'person' : 'people'}</span>`);
		$val.append($chip);

		const $sel = $(`<select style="opacity:0; position:absolute; left:0; top:0; width:100%; height:100%; cursor:pointer; z-index:10;"><option value="" selected disabled>Select to jump...</option></select>`);
		linked.forEach((p, i) => {
			$sel.append(`<option value="${i}" disabled style="color:${ramp_[1]}">${PersonEditor.escapeHtml(p.value)} (${PersonEditor.escapeHtml(p.source)})</option>`);
		});
		rels.forEach((r, i) => {
			const objPerson = Array.isArray(window.app.curTree.persons) ? window.app.curTree.persons.find(p => p.person_id === r.object_id) : window.app.curTree.persons[r.object_id];
			const fname = objPerson ? (objPerson.first_name || '').split(':')[0] : '';
			const lname = objPerson ? (objPerson.last_name || '').split(':')[0] : '';
			const linkedName = `${fname} ${lname}`.trim() || r.object_id;

			const pFname = (person.first_name || '').split(':')[0];
			const pLname = (person.last_name || '').split(':')[0];
			const pFullName = `${pFname} ${pLname}`.trim();

			const predRaw = r.predicate.replace(/^is/, '').replace(/Of$/, '').toUpperCase();
			const toBoldMap = { 'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭' };
			const pred = predRaw.split('').map(c => toBoldMap[c] || c).join('');
			$sel.append(`<option value="rel_${i}" style="color:${ramp_[1]}">${PersonEditor.escapeHtml(pFullName)} is ${pred} of ${PersonEditor.escapeHtml(linkedName)}</option>`);
		});

		$sel.on('change', function () {
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

		$chip.append($sel);
		const $rightContainer = $(`<div style="flex: 1; display: flex; align-items: center; justify-content: flex-end; min-height: 20px;"></div>`);
		$val.append($rightContainer);
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

			// Update the person object with current state selections
			Object.keys(state.fields).forEach(k => {
				const fs = state.fields[k];
				person[k] = (fs && fs.selected >= 0 && fs.options[fs.selected]) ? fs.options[fs.selected].value : null;
			});

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
			if (window.Sound) window.Sound("ding");
			$dialog.trigger('vpe:search', [PersonEditor.collectCriteria(person, state)]);
		});

		const $right = $('<div class="vpe-footer-right"></div>');

		// County dropdown
		const $countyWrap = $('<div class="vpe-county-wrap"></div>');
		const $countySelect = $(`
			<select class="vpe-county-btn" style="
				display: inline-flex;
				align-items: center;
				background: transparent;
				border: 0.5px solid #f0f0f0;
				border-radius: 6px;
				padding: 8px 24px 8px 12px;
				font-size: 13px;
				font-weight: 500;
				cursor: pointer;
				appearance: none;
				-webkit-appearance: none;
				-moz-appearance: none;
				background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23757575%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E');
				background-repeat: no-repeat;
				background-position: right 8px top 50%;
				background-size: 8px auto;
				margin-right: 10px;
			">
				<option value="ALB">Albemarle</option>
				<option value="AUG">Augusta</option>
				<option value="FAQ">Fauquier</option>
			</select>
		`);
		if (window.app && window.app.county) {
			$countySelect.val(window.app.county);
		} else {
			$countySelect.val('ALB');
		}
		$countySelect.on('change', function () {
			if (window.app) window.app.county = $(this).val();
		});
		$countyWrap.append($countySelect);

		$right.append($countyWrap, $sourcesWrap, $searchBtn);

		$footer.append($verity, $right);
	}

	static renderSourcesDropdown($wrap, state) {
		$wrap.empty();

		const sourceOptions = [
			{ label: '1870 Census', value: 'CN-1870' },
			{ label: '1880 Census', value: 'CN-1880' },
			{ label: '1860 Slave Schedule', value: 'SS-1860' },
			{ label: '1850 Slave Schedule', value: 'SS-1850' },
			{ label: 'Find A Grave', value: 'FG' },
			{ label: 'Birth Records', value: 'VRB' },
			{ label: 'Marriage Records', value: 'VRM' },
			{ label: 'Death Records', value: 'VRD' },
			{ label: 'Church Records', value: 'CH' },
			{ label: 'Free Black Register', value: 'FBR' },
			{ label: 'Freemans Records', value: 'FL' }
		];

		const ids = Object.keys(state.sources);
		let selectedId = ids.find(id => state.sources[id].checked) || '';

		// Attempt to match selectedId even if it has a county prefix like 'ALB-CN-1880'
		let matchId = selectedId;
		if (selectedId && selectedId.includes('-') && !sourceOptions.some(opt => opt.value === selectedId)) {
			let suffix = selectedId.substring(selectedId.indexOf('-') + 1);
			if (sourceOptions.some(opt => opt.value === suffix)) {
				matchId = suffix;
			}
		}

		const $select = $(`
			<select class="vpe-sources-btn" style="
				display: inline-flex;
				align-items: center;
				background: transparent;
				border: 0.5px solid #f0f0f0;
				border-radius: 6px;
				padding: 8px 24px 8px 12px;
				font-size: 13px;
				font-weight: 500;
				cursor: pointer;
				appearance: none;
				-webkit-appearance: none;
				-moz-appearance: none;
				background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23757575%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E');
				background-repeat: no-repeat;
				background-position: right 8px top 50%;
				background-size: 8px auto;
			"></select>
		`);

		sourceOptions.forEach(opt => {
			$select.append(`<option value="${opt.value}" ${opt.value === matchId ? 'selected' : ''}>${PersonEditor.escapeHtml(opt.label)}</option>`);
		});

		$select.on('change', function () {
			const newSel = $(this).val();
			if (window.app) window.app.source = newSel;

			// Clear existing checked
			Object.keys(state.sources).forEach(id => {
				state.sources[id].checked = false;
			});

			// Use sourceMatches to set the right checked items
			let anyChecked = false;
			Object.keys(state.sources).forEach(id => {
				if (window.app && window.app.sourceMatches && window.app.sourceMatches(id, [newSel])) {
					state.sources[id].checked = true;
					anyChecked = true;
				}
			});

			// If nothing was checked, force a fallback
			if (!anyChecked) {
				const prefix = window.app && window.app.county ? window.app.county + '_' : 'ALB_';
				let fullSource = prefix + newSel.replace('-', '_');
				state.sources[fullSource] = { label: fullSource, checked: true };
			}
		});

		$wrap.append($select);
	}


	static collectCriteria(person, state) {
		const useSmartName = $('#vpe-smart-name-cb').is(':checked');
		const criteria = { person_id: person.person_id, factors: [], sources: [], useSmartName };
		Object.keys(state.fields).forEach(key => {
			const f = state.fields[key];
			const sel = f.selected;
			const val = (sel === -1 || sel == null) ? null : f.options[sel].value;
			if (val) {
				const splitVal = String(val).split(':')[0].trim();

				const isRare = f.active.includes('rare');
				let compareOpts = f.active.filter(opt => opt !== 'rare');

				criteria.factors.push({
					field: key,
					value: splitVal,
					impact: f.weight / 5,
					compare: compareOpts,
					rare: isRare,
					score: 0
				});
			}
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
      .vpe-row { display:grid; grid-template-columns:130px 240px 110px 1fr; gap:8px 16px; align-items:center;
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
      .vpe-compare-row.name-group {
        border-left: 1px solid #e3ddd5;
        border-right: 1px solid #e3ddd5;
        background: #fbfaf8;
        padding: 5px 8px;
        margin-top: -6px;
        margin-bottom: -6px;
        display: flex;
        align-items: center;
        border-radius: 0;
        position: relative;
        z-index: 1;
      }
      .vpe-compare-row.name-group.top {
        border-top: 1px solid #e3ddd5;
        border-top-left-radius: 8px;
        border-top-right-radius: 0;
        margin-top: -2px;
      }
      .vpe-compare-row.name-group.bottom {
        border-bottom: 1px solid #e3ddd5;
        border-bottom-left-radius: 8px;
        border-bottom-right-radius: 8px;
        margin-bottom: -2px;
      }
      #vpe-smart-name-label {
        display: flex;
        align-items: center;
        gap: 4px;
        font-weight: normal;
        font-size: 11px;
        text-transform: none;
        cursor: pointer;
        color: #333;
        padding: 3px 8px;
        position: relative;
        z-index: 2;
      }
      #vpe-smart-name-label.tab-active {
        border-top: 1px solid #e3ddd5;
        border-left: 1px solid #e3ddd5;
        border-right: 1px solid #e3ddd5;
        border-top-left-radius: 6px;
        border-top-right-radius: 6px;
        background: #fbfaf8;
        margin-bottom: -11px;
      }
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
