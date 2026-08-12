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
		metaphone_last_name: 'c-orange',
		suffix: 'c-amber',
		race: 'c-brown',
		gender: 'c-cyan',
		birth_year: 'c-blue',
		death_year: 'c-red',
		relationship: 'c-blue',
		family_boost: 'c-yellow',
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
		'c-red': ['#FCE8E6', '#5C1D18'],
		'c-yellow': ['#FEF9D7', '#4A3B00'],
		'c-white': ['#FFFFFF', '#333333'],
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
			compareOptions: ['Exact', 'Ignore', 'Fuzzy', 'Nickname'], defaultMatch: 'Exact', hasRare: true
		},
		{
			key: 'middle_name', label: 'Middle name', editKind: 'free',
			compareOptions: ['Exact', 'Ignore', 'Fuzzy'], defaultMatch: 'Exact', hasRare: true
		},
		{
			key: 'last_name', label: 'Last name', editKind: 'free',
			compareOptions: ['Exact', 'Ignore', 'Fuzzy', 'NYSIIS', 'Metaphone'], defaultMatch: 'Exact', hasRare: true
		},
		{
			key: 'suffix', label: 'Suffix', editKind: 'choice', choices: ['Jr', 'Sr'],
			compareOptions: ['Exact', 'Ignore'], defaultMatch: 'Exact', hasRare: false
		},
		{
			key: 'race', label: 'Race', editKind: 'choice', choices: [{ v: 'B', l: 'Black' }, { v: 'W', l: 'White' }],
			compareOptions: ['Exact', 'Ignore'], defaultMatch: 'Exact', hasRare: false
		},
		{
			key: 'gender', label: 'Gender', editKind: 'choice', choices: [{ v: 'M', l: 'M' }, { v: 'F', l: 'F' }],
			compareOptions: ['Exact', 'Ignore'], defaultMatch: 'Exact', hasRare: false
		},
		{
			key: 'birth_year', label: 'Birth year', editKind: 'free',
			compareOptions: ['Exact', 'Ignore', '±1', '±2', '±3', '±5', '±10'], defaultMatch: 'Exact', hasRare: false
		},
		{
			key: 'death_year', label: 'Death year', editKind: 'free',
			compareOptions: ['Exact', 'Ignore', '±1', '±2', '±3', '±5', '±10'], defaultMatch: 'Exact', hasRare: false
		},
		{
			key: 'family_boost', label: 'Family boost', editKind: 'free',
			compareOptions: ['Boost', 'Ignore'], defaultMatch: 'Boost', hasRare: false
		},
		{ key: 'relationship', label: 'Relationship', editKind: 'relationship' },
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
			} else if (key === 'metaphone_last_name' && person.last_name) {
				canonical = window.Normalize.getMetaphone(person.last_name.split(':')[0]);
			}
		}

		if (canonical != null && canonical !== '') {
			let valString = String(canonical);
			let optString = valString;
			if (key === 'metaphone_last_name') {
				if (!valString.endsWith(':Added') && !valString.endsWith(':Calculated') && !valString.includes('ALB-')) {
					valString = `${valString}:Calculated`;
				}
			} else if (!valString.includes(':')) {
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
			if (personId === -1) {
				person = { person_id: -1, full_name: 'Search Person', mentions: [] };
			} else {
				$target.empty().append($('<p>').text('Person not found: ' + personId));
				return;
			}
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
	static calculateVerity(person) {
		const mentionsCount = Array.isArray(person.mentions) ? person.mentions.length : 0;
		if (mentionsCount === 0) return 0;
		if (mentionsCount === 1) {
			const hasValidFirst = person.first_name && person.first_name.includes(':') && !person.first_name.endsWith(':Added');
			const hasValidLast = person.last_name && person.last_name.includes(':') && !person.last_name.endsWith(':Added');
			return (hasValidFirst && hasValidLast) ? 2 : 1;
		}
		if (mentionsCount === 2) return 3;
		return 4;
	}

	static buildState(person) {
		if (!PersonEditor.userSettings) {
			PersonEditor.userSettings = {
				useSmartName: false,
				matches: {
					first_name: 'Exact',
					middle_name: 'Exact',
					last_name: 'Exact',
					suffix: 'Exact',
					race: 'B',
					gender: 'F',
					birth_year: 'Exact',
					death_year: 'Exact',
					family_boost: 'Boost'
				},
				rares: {
					first_name: false,
					middle_name: false,
					last_name: false
				}
			};
		}

		const fields = {};
		PersonEditor.FIELD_CONFIG.forEach(cfg => {
			if (cfg.editKind === 'linked' || cfg.editKind === 'relationship') return;

			const options = PersonEditor.buildOptions(person, cfg.key);
			let selectedIdx = (cfg.key === 'suffix') ? -1 : 0;

			let canonical = person[cfg.key];
			if (!canonical) {
				if (cfg.key === 'norm_first_name' && person.first_name) {
					canonical = window.Normalize.getNickname(person.first_name.split(':')[0]);
				} else if (cfg.key === 'nysiis_last_name' && person.last_name) {
					canonical = window.Normalize.getNYSIIS(person.last_name.split(':')[0]);
				} else if (cfg.key === 'metaphone_last_name' && person.last_name) {
					canonical = window.Normalize.getMetaphone(person.last_name.split(':')[0]);
				}
			}

			let found = -1;
			if (canonical != null && canonical !== '') {
				const exactIdx = options.findIndex(o => o.value === canonical);
				if (exactIdx >= 0) {
					found = exactIdx;
				} else {
					const getBase = (s) => {
						const str = String(s).trim().toUpperCase();
						if (cfg.key === 'metaphone_last_name') {
							const parts = str.split(':');
							if (parts.length >= 3) return `${parts[0]}:${parts[1]}`;
							if (parts.length === 2 && (parts[1].includes('-') || parts[1] === 'ADDED' || parts[1] === 'CALCULATED')) {
								return parts[0];
							}
							return str;
						}
						return str.split(':')[0];
					};
					const canBase = getBase(canonical);
					found = options.findIndex(o => getBase(o.value) === canBase);
				}
			}
			if (found >= 0) selectedIdx = found;

			let defaultMatch = cfg.defaultMatch || 'Exact';
			let savedMatch = PersonEditor.userSettings.matches ? PersonEditor.userSettings.matches[cfg.key] : undefined;
			let matchVal = savedMatch !== undefined ? savedMatch : defaultMatch;

			let defaultRare = false;
			let savedRare = PersonEditor.userSettings.rares ? PersonEditor.userSettings.rares[cfg.key] : undefined;
			let rareVal = savedRare !== undefined ? savedRare : defaultRare;

			fields[cfg.key] = {
				options: options,
				selected: selectedIdx,
				match: matchVal,
				rare: rareVal,
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

		person.verity = PersonEditor.calculateVerity(person);
		return {
			fields,
			verity: person.verity,
			sources,
			editing: false
		};
	}

	/* ----------------------------------------------------------
	   Shell: header + factors table container
	   ---------------------------------------------------------- */
	static renderShell($dialog, person, state) {
		const fname = (person.first_name || '').split(':')[0];
		const mname = (person.middle_name || '').split(':')[0];
		const lname = (person.last_name || '').split(':')[0];
		let fullDisplay = [fname, mname, lname].filter(Boolean).join(' ').trim();
		if (!fullDisplay && person.full_name) {
			fullDisplay = person.full_name.split(':')[0];
		}
		const byear = person.birth_year ? String(person.birth_year).split(':')[0] : '?';
		const yearStr = byear !== '?' ? `(b. ${PersonEditor.escapeHtml(byear)})` : '';
		$dialog.append(`
      <div class="vpe-header">
        <div>
          <p class="vpe-target-summary">${PersonEditor.escapeHtml(fullDisplay)} &nbsp;&nbsp;${yearStr}</p>
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
        <div style="display:flex; justify-content:space-between; align-items:center;"><span>VALUE</span><span style="margin-right:60px">FROM</span></div>
        <div>COMPARE</div>
      </div>
    `);

		PersonEditor.FIELD_CONFIG.forEach(cfg => {
			if (cfg.editKind === 'linked') {
				$factors.append(PersonEditor.renderLinkedRow(person, cfg));
				return;
			}
			if (cfg.editKind === 'relationship') {
				$factors.append(PersonEditor.renderRelationshipRow(person, cfg, state));
				return;
			}
			$factors.append(PersonEditor.renderFieldRow(person, cfg, state));
		});

		// re-render after any change
		$factors.off('vpe:rerender').on('vpe:rerender', function () {
			PersonEditor.renderFactors($dialog, person, state);
			PersonEditor.renderFooter($dialog, person, state);
		});
	}

	/* ----- single field row (free / choice / locked) ----- */
	static renderFieldRow(person, cfg, state) {
		const fstate = state.fields[cfg.key];
		const ramp_ = PersonEditor.RAMP[PersonEditor.COLORS[cfg.key]] || PersonEditor.RAMP['c-gray'];
		const isWhitePill = cfg.key === 'family_boost';

		const $row = $(`<div class="vpe-row"></div>`);
		$row.append(`<div class="vpe-field-label">${PersonEditor.escapeHtml(cfg.label)}</div>`);

		// VALUE
		const valPillBg = isWhitePill ? '#FEF9D7' : ramp_[0];
		const $val = $(`<div class="vpe-value-pill" style="background:${valPillBg};"></div>`);

		const isNull = fstate.selected === -1 || fstate.selected == null;
		let val1 = "", val2 = "";
		let fullVal = "";
		if (!isNull) {
			fullVal = fstate.options[fstate.selected].value;
			if (cfg.key === 'metaphone_last_name') {
				const parts = fullVal.split(':');
				if (parts.length >= 3) {
					val1 = `${parts[0]}:${parts[1]}`.toUpperCase();
					val2 = parts.slice(2).join(':');
				} else if (parts.length === 2) {
					if (parts[1].includes('-') || parts[1].toLowerCase() === 'added' || parts[1].toLowerCase() === 'calculated') {
						val1 = parts[0].toUpperCase();
						val2 = parts[1];
					} else {
						val1 = `${parts[0]}:${parts[1]}`.toUpperCase();
						val2 = "";
					}
				} else {
					val1 = fullVal.toUpperCase();
					val2 = "";
				}
			} else {
				const parts = fullVal.split(':');
				if (parts.length > 1) {
					val1 = parts[0];
					val2 = parts.slice(1).join(':');
				} else {
					val1 = fullVal;
					val2 = fullVal;
				}

				if (['norm_first_name', 'nysiis_last_name'].includes(cfg.key)) {
					val1 = val1.toUpperCase();
					val2 = "";
				} else if (['first_name', 'middle_name', 'last_name'].includes(cfg.key)) {
					val1 = val1.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
				}
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
					$factors.find('.vpe-row').filter(function () { return $(this).find('.vpe-field-label').text() === 'Metaphone'; }).find('.vpe-chip').text(window.Normalize.getMetaphone(val) ? window.Normalize.getMetaphone(val).toUpperCase() : '');
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

			PersonEditor.bindChanged($row, person, cfg, state);
			setTimeout(() => $input.trigger('focus'), 0);
			return $row;
		}

		const chipColor = cfg.key === 'metaphone_last_name' ? '#000' : ramp_[1];
		const chipStyle = isWhitePill ? "position: relative; background:#FFFFFF; border:1px solid #d0d0d0; border-radius:999px; padding:2px 10px; color:#333; display:inline-flex; align-items:center;" : `position: relative; color:${chipColor}`;
		const $chip = $(`<span class="vpe-chip" style="${chipStyle}"></span>`);
		const $chipText = $(`<span></span>`);
		if (cfg.key === 'family_boost') {
			$chipText.text(fstate.match || cfg.defaultMatch || 'Boost');
		} else if (!isNull && val1) {
			$chipText.text(val1);
		} else {
			$chipText.text('click to set').css({ opacity: 0.5 });
		}
		$chip.append($chipText);

		if (cfg.editKind === 'free' || cfg.editKind === 'choice') {
			const tooltipMsg = cfg.editKind === 'free' ? "Double-click to add text, or pick from options" : "Pick from options";
			$chip.attr('title', tooltipMsg);
			const $sel = $(`<select style="opacity:0; position:absolute; left:0; top:0; width:100%; height:100%; cursor:pointer; z-index:10;" title="${PersonEditor.escapeHtml(tooltipMsg)}"></select>`);

			fstate.options.forEach((o, i) => {
				$sel.append(`<option value="${i}" ${i === fstate.selected ? 'selected' : ''} style="color:${ramp_[1]}">${PersonEditor.escapeHtml(o.option)}</option>`);
			});
			$sel.append(`<option value="-1" ${isNull ? 'selected' : ''} style="color:${ramp_[1]}">Make blank</option>`);
			if (cfg.editKind === 'free') {
				$sel.append(`<option value="addtext" style="color:${ramp_[1]}">Add text</option>`);
				$sel.on('dblclick', function (e) {
					e.stopPropagation();
					fstate.editing = true;
					$row.trigger('vpe:changed');
				});
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
			const isMention = val2 && val2 !== 'Added';
			const sourceTitleAttr = isMention ? ' title="Click to see mention"' : '';
			const $sourceText = $(`<span style="color:${isNull ? 'transparent' : ramp_[1]}; padding:0 4px; font-size:13px; font-weight:normal; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor:${isMention ? 'pointer' : 'default'};"${sourceTitleAttr}>${displayVal2}</span>`);

			$sourceText.on('click', function () {
				if (isMention) {
					$('#right-panel-content .tab-btn[data-target="mentions-editor-container"]').click();
				}
			});

			$rightContainer.append($sourceText);
			$val.append($rightContainer);
		} else {
			$val.append($chip);
			const displayVal2 = val2 ? PersonEditor.escapeHtml(val2) : '&nbsp;';
			const isMention = val2 && val2 !== 'Added';
			const sourceTitleAttr = isMention ? ' title="Click to see mention"' : '';
			const $sourceText = $(`<span style="color:${ramp_[1]}; padding:0 4px; font-size:13px; font-weight:normal; margin-left:auto; cursor:${isMention ? 'pointer' : 'default'};"${sourceTitleAttr}>${displayVal2}</span>`);
			$sourceText.on('click', function () {
				if (isMention) {
					$('#right-panel-content .tab-btn[data-target="mentions-editor-container"]').click();
				}
			});
			$val.append($sourceText);
			$val.append(`<i class="ti ti-lock" style="color:${ramp_[1]};opacity:.6;margin-left:4px;" aria-label="Not editable"></i>`);
		}
		$row.append($val);

		// COMPARE / MATCH
		const $compareCol = $(`<div style="display:flex; align-items:center; gap:8px;"></div>`);
		const compareOpts = cfg.compareOptions || ['Exact', 'Ignore'];
		const matchTooltip = (cfg.key === 'family_boost') ? "Boost score if common family members" : "Choose how to match this term";
		const $matchSel = $(`<select title="${matchTooltip}" style="width:115px; min-width:115px; background:#fff; border:1px solid #d0d0d0; border-radius:6px; padding:3px 6px; font-size:13px; cursor:pointer; color:#333; box-sizing:border-box;"></select>`);

		compareOpts.forEach(opt => {
			const isSel = (fstate.match === opt);
			$matchSel.append(`<option value="${opt}" ${isSel ? 'selected' : ''}>${opt}</option>`);
		});

		$matchSel.on('change', function () {
			const val = $(this).val();
			fstate.match = val;
			if (cfg.key === 'family_boost') {
				$chipText.text(val);
			}
			if (PersonEditor.userSettings) {
				if (!PersonEditor.userSettings.matches) PersonEditor.userSettings.matches = {};
				PersonEditor.userSettings.matches[cfg.key] = val;
			}
			$row.trigger('vpe:changed');
		});

		$compareCol.append($matchSel);

		if (cfg.hasRare) {
			const isRareChecked = fstate.rare !== undefined ? fstate.rare : false;
			const $rareLabel = $(`<label title="Boost score if a rare name" style="display:flex; align-items:center; gap:3px; font-size:13px; color:#444; cursor:pointer; white-space:nowrap;"><input type="checkbox" ${isRareChecked ? 'checked' : ''} style="cursor:pointer;"> Rare</label>`);
			$rareLabel.find('input').on('change', function () {
				const checked = $(this).is(':checked');
				fstate.rare = checked;
				if (PersonEditor.userSettings) {
					if (!PersonEditor.userSettings.rares) PersonEditor.userSettings.rares = {};
					PersonEditor.userSettings.rares[cfg.key] = checked;
				}
				$row.trigger('vpe:changed');
			});
			$compareCol.append($rareLabel);
		}

		$row.append($compareCol);

		PersonEditor.bindChanged($row, person, cfg, state);
		return $row;
	}

	/* ----- linked people row ----- */
	static renderLinkedRow(person, cfg) {
		const ramp_ = PersonEditor.RAMP[PersonEditor.COLORS.linked_persons];

		let rels = [];
		if (window.app && window.app.expand && person.mentions) {
			const uniqueRelsMap = new Map();
			person.mentions.forEach(mid => {
				const view = window.app.expand.viewFor(mid);
				if (view && view.results) {
					view.results.forEach(res => {
						if (res.predicate === 'isNeighborOf') return;
						if (person.mentions.includes(res.mention_id)) return; // Don't list as a relative if already merged into this person

						const existing = uniqueRelsMap.get(res.mention_id);
						// Priority order for predicates: specific kinship > inFamilyOf > inHouseholdOf
						const priority = (pred) => {
							if (['isChildOf', 'isParentOf', 'isSiblingOf', 'isSpouseOf', 'isCousinOf', 'isEnslaverOf', 'wasEnslavedBy', 'enslaves'].includes(pred)) return 3;
							if (pred === 'inFamilyOf') return 2;
							if (pred === 'inHouseholdOf') return 1;
							return 0;
						};

						if (!existing || priority(res.predicate) > priority(existing.predicate)) {
							uniqueRelsMap.set(res.mention_id, {
								predicate: res.predicate,
								target_mention: res.mention_id
							});
						}
					});
				}
			});
			rels = Array.from(uniqueRelsMap.values());
		}

		const $row = $(`<div class="vpe-row vpe-row-linked"></div>`);
		$row.append(`<div class="vpe-field-label">${PersonEditor.escapeHtml(cfg.label)}</div>`);

		const linkedTooltip = "View family members. Click on one to show it";
		const $val = $(`<div class="vpe-value-pill" style="position: relative; background:${ramp_[0]}" title="${PersonEditor.escapeHtml(linkedTooltip)}"></div>`);
		const totalLinked = rels.length;
		const $chip = $(`<span class="vpe-chip" style="position: relative; color:${ramp_[1]}" title="${PersonEditor.escapeHtml(linkedTooltip)}">${totalLinked} linked ${totalLinked === 1 ? 'person' : 'people'}</span>`);
		$val.append($chip);

		const $sel = $(`<select style="opacity:0; position:absolute; left:0; top:0; width:100%; height:100%; cursor:pointer; z-index:10;" title="${PersonEditor.escapeHtml(linkedTooltip)}"><option value="" selected disabled>Select to jump...</option></select>`);
		rels.forEach((r, i) => {
			let linkedName = `Mention ${r.target_mention}`;
			if (window.app && window.app.expand && window.app.expand.mentionsMap) {
				const m = window.app.expand.mentionsMap.get(r.target_mention);
				if (m) {
					const fn = (m.first_name || '').split(':')[0];
					const mn = (m.middle_name || '').split(':')[0];
					const ln = (m.last_name || '').split(':')[0];
					linkedName = [fn, mn, ln].filter(Boolean).join(' ').trim();
				}
			}
			if (!linkedName) linkedName = r.target_mention;

			const predLabelMap = {
				'isChildOf': 'PARENT',
				'isParentOf': 'CHILD',
				'isSiblingOf': 'SIBLING',
				'isSpouseOf': 'SPOUSE',
				'inHouseholdOf': 'HOUSEMATE',
				'inFamilyOf': 'FAMILY',
				'isCousinOf': 'COUSIN',
				'isEnslaverOf': 'ENSLAVER',
				'wasEnslavedBy': 'ENSLAVED',
				'enslaves': 'ENSLAVER'
			};
			let predRaw = predLabelMap[r.predicate];
			if (!predRaw) {
				predRaw = r.predicate.replace(/^is/, '').replace(/Of$/, '').replace(/^in/, '').toUpperCase();
			}

			const toBoldMap = { 'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭' };
			const pred = predRaw.split('').map(c => toBoldMap[c] || c).join('');
			$sel.append(`<option value="rel_${i}" style="color:${ramp_[1]}">${PersonEditor.escapeHtml(linkedName)} - ${pred}</option>`);
		});

		$sel.on('change', function (e) {
			e.stopPropagation(); // Prevent bubbling to #person-editor-container's change handler
			const val = $(this).val();
			if (val && val.startsWith('rel_')) {
				const idx = parseInt(val.split('_')[1], 10);
				const rel = rels[idx];
				if (rel && rel.target_mention && window.app && typeof window.app.editMention === 'function') {
					window.app.curRelation = rel.predicate;
					window.app.targetPerson = person;
					window.app.editMention(rel.target_mention);
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

	/* ----- relationship row ----- */
	static renderRelationshipRow(person, cfg, state) {
		const ramp_ = PersonEditor.RAMP[PersonEditor.COLORS.relationship] || PersonEditor.RAMP['c-blue'];
		const $row = $(`<div class="vpe-row vpe-row-relationship"></div>`);
		$row.append(`<div class="vpe-field-label">${PersonEditor.escapeHtml(cfg.label)}</div>`);

		// VALUE - colored pill background container with white chip inside
		const $val = $(`<div class="vpe-value-pill" style="background:${ramp_[0]};"></div>`);

		const options = [
			{ label: 'Parent', value: 'isParentOf' },
			{ label: 'Child', value: 'isChildOf' },
			{ label: 'Sibling', value: 'isSiblingOf' },
			{ label: 'Cousin', value: 'isCousinOf' },
			{ label: 'Spouse', value: 'isSpouseOf' },
			{ label: 'Enslaver', value: 'isEnslaverOf' },
			{ label: 'Anchor', value: 'NULL' }
		];

		// Determine current predicate from person.anchor
		let currentPred = 'NULL';
		if (person.anchor) {
			const pStr = String(person.anchor).split(':')[0];
			if (options.some(o => o.value === pStr)) {
				currentPred = pStr;
			}
		}

		const currentOpt = options.find(o => o.value === currentPred) || options.find(o => o.value === 'NULL');

		const $chip = $(`<span class="vpe-chip" style="position: relative; background:#FFFFFF; border:1px solid #d0d0d0; border-radius:999px; padding:2px 10px; color:#333; display:inline-flex; align-items:center;"></span>`);
		const $chipText = $(`<span>${PersonEditor.escapeHtml(currentOpt.label)}</span>`);
		$chip.append($chipText);

		const $sel = $(`<select style="opacity:0; position:absolute; left:0; top:0; width:100%; height:100%; cursor:pointer; z-index:10;"></select>`);
		options.forEach(o => {
			const isSel = (o.value === currentPred);
			$sel.append(`<option value="${o.value}" ${isSel ? 'selected' : ''} style="color:${ramp_[1]}">${PersonEditor.escapeHtml(o.label)}</option>`);
		});

		$sel.on('change', function () {
			const selVal = $(this).val();
			const foundOpt = options.find(o => o.value === selVal);
			if (foundOpt) {
				$chipText.text(foundOpt.label);
			}

			// Update anchor property on person and app.curTree
			let newAnchor = null;
			if (selVal && selVal !== 'NULL') {
				let targetPid = null;
				if (person.anchor && person.anchor.includes(':')) {
					targetPid = person.anchor.split(':')[1];
				}
				if (!targetPid && window.treeApp && window.treeApp.state && window.treeApp.state.selectedPid && window.treeApp.state.selectedPid !== person.person_id) {
					targetPid = window.treeApp.state.selectedPid;
				}
				if (!targetPid) {
					const modalEl = document.getElementById('add-node-modal');
					if (modalEl && modalEl.dataset && modalEl.dataset.sourcePid && modalEl.dataset.sourcePid !== person.person_id) {
						targetPid = modalEl.dataset.sourcePid;
					}
				}
				if (!targetPid && window.app && window.app.curTree && Array.isArray(window.app.curTree.relationships)) {
					const rel = window.app.curTree.relationships.find(r => r.subject_id === person.person_id || r.object_id === person.person_id);
					if (rel) {
						targetPid = (rel.subject_id === person.person_id) ? rel.object_id : rel.subject_id;
					}
				}
				if (!targetPid && window.app && window.app.curTree && window.app.curTree.persons) {
					const pList = Array.isArray(window.app.curTree.persons) ? window.app.curTree.persons : Object.values(window.app.curTree.persons);
					const otherP = pList.find(p => p.person_id !== person.person_id);
					if (otherP) targetPid = otherP.person_id;
				}
				if (!targetPid) targetPid = 'P001';
				newAnchor = `${selVal}:${targetPid}`;
			}

			person.anchor = newAnchor;

			if (window.app && window.app.curTree && window.app.curTree.persons) {
				const pList = window.app.curTree.persons;
				let appPerson = Array.isArray(pList) ? pList.find(p => p.person_id === person.person_id) : pList[person.person_id];
				if (appPerson) {
					appPerson.anchor = newAnchor;
					if (selVal === 'isEnslaverOf') {
						appPerson.isEnslaver = true;
					}
				}
			}

			if (window.treeApp && typeof window.treeApp.SaveState === 'function') {
				window.treeApp.SaveState();
			}

			if (window.treeApp) {
				const node = window.treeApp.GetNode(person.person_id);
				if (node) {
					node.anchor = newAnchor;
					if (selVal === 'isEnslaverOf') node.isEnslaver = true;
				}
				window.treeApp.isDirty = true;
			}

			// Re-build all relationships so new anchor edge is added to curTree.relationships & state.triplets
			if (window.app && typeof window.app.rebuildAllRelationships === 'function') {
				window.app.rebuildAllRelationships();
			} else if (window.app && typeof window.app.processLoadedPersons === 'function') {
				window.app.processLoadedPersons();
			}

			if (window.treeApp) {
				if (typeof window.treeApp.ApplyLayout === 'function') window.treeApp.ApplyLayout(true);
				if (typeof window.treeApp.RenderNodes === 'function') window.treeApp.RenderNodes();
				if (typeof window.treeApp.RenderEdges === 'function') window.treeApp.RenderEdges();
				if (typeof window.treeApp.FitToScreen === 'function') window.treeApp.FitToScreen(200, true);
			}
		});

		$chip.append($sel);
		$val.append($chip);

		const $rightContainer = $(`<div style="flex: 1; display: flex; align-items: center; justify-content: flex-end; min-height: 20px;"></div>`);
		$val.append($rightContainer);
		$row.append($val);
		return $row;
	}

	/* re-render the whole factors table when a row changes */
	static bindChanged($row, person, cfg, state) {
		$row.on('vpe:changed', function () {
			// Person-field edits mutate curTree.persons/treeApp nodes directly (below) rather
			// than going through treeApp's own mutators, so capture undo state here — otherwise
			// these edits are invisible to Ctrl+Z.
			if (window.treeApp && typeof window.treeApp.SaveState === 'function') {
				window.treeApp.SaveState();
			}

			const fstate = state.fields[cfg.key];
			let selectedValue = null;
			if (fstate && fstate.selected >= 0 && fstate.options[fstate.selected]) {
				selectedValue = fstate.options[fstate.selected].value;
			}

			if (cfg.key === 'first_name') {
				let norm = selectedValue ? window.Normalize.getNickname(selectedValue.split(':')[0]) : '';
				PersonEditor.updateFieldState(state, 'norm_first_name', norm || '');
			} else if (cfg.key === 'last_name') {
				let baseVal = selectedValue ? selectedValue.split(':')[0] : '';
				let nysiis = baseVal ? window.Normalize.getNYSIIS(baseVal) : '';
				PersonEditor.updateFieldState(state, 'nysiis_last_name', nysiis || '');
				let metaphone = baseVal ? window.Normalize.getMetaphone(baseVal) : '';
				PersonEditor.updateFieldState(state, 'metaphone_last_name', metaphone || '');
			}

			// Update the person object with current state selections
			Object.keys(state.fields).forEach(k => {
				const fs = state.fields[k];
				person[k] = (fs && fs.selected >= 0 && fs.options[fs.selected]) ? fs.options[fs.selected].value : null;
			});

			// Calculate verity before syncing changes
			person.verity = PersonEditor.calculateVerity(person);
			state.verity = person.verity;

			// Update the tree node
			if (window.treeApp) {
				const node = window.treeApp.GetNode(person.person_id);
				if (node) {
					const { x, y, fx, fy, vx, vy } = node;
					Object.assign(node, person);
					node.x = x;
					node.y = y;
					if (fx !== undefined) node.fx = fx;
					if (fy !== undefined) node.fy = fy;
					if (vx !== undefined) node.vx = vx;
					if (vy !== undefined) node.vy = vy;
					window.treeApp.isDirty = true;
					window.treeApp.RenderNodes();
				}
			}

			// Save verity to curTree.persons as well
			if (window.app && window.app.curTree && window.app.curTree.persons) {
				let persons = window.app.curTree.persons;
				let appPerson = Array.isArray(persons) ? persons.find(p => p.person_id === person.person_id) : persons[person.person_id];
				if (appPerson) {
					appPerson.verity = person.verity;
				}
			}

			// Update the person editor header
			const fname = (person.first_name || '').split(':')[0];
			const mname = (person.middle_name || '').split(':')[0];
			const lname = (person.last_name || '').split(':')[0];
			let fullDisplay = [fname, mname, lname].filter(Boolean).join(' ').trim();
			if (!fullDisplay && person.full_name) {
				fullDisplay = person.full_name.split(':')[0];
			}
			const byear = person.birth_year ? String(person.birth_year).split(':')[0] : '?';
			const yearStr = byear !== '?' ? `(b. ${PersonEditor.escapeHtml(byear)})` : '';
			$row.closest('.vpe-dialog').find('.vpe-target-summary').html(`${PersonEditor.escapeHtml(fullDisplay)} &nbsp;&nbsp;${yearStr}`);

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
			const search_criteria = PersonEditor.buildSearchCriteriaFromState(person, state);
			const mentionsArray = (window.app && window.app.mentions) ? window.app.mentions : [];
			if (window.app && !window.app.score && window.Score) new window.Score();

			// 1850/1860 slave schedules can't be matched person-by-person — the
			// enslaved carry no name at all, only age/sex/race, so field scoring
			// buries the correct household under name-mismatch penalties. Use the
			// GroupMatcher family-vs-holding algorithm instead (see GroupMatch.md)
			// when we have a real tree person to build an 1870 family group from.
			const scoreObj = window.app.score;
			const isSlaveSchedule = scoreObj && typeof scoreObj.isSlaveScheduleSource === 'function' && scoreObj.isSlaveScheduleSource(search_criteria.source);
			let results;
			if (isSlaveSchedule && person && person.person_id !== -1 && typeof scoreObj.SearchGroupMatch === 'function') {
				const sourceTag = String(search_criteria.source).toUpperCase().includes('1850') ? 'SS-1850' : 'SS-1860';
				results = scoreObj.SearchGroupMatch(mentionsArray, person, sourceTag);
			} else {
				results = scoreObj.Search(mentionsArray, search_criteria);
			}

			if (window.app && window.app.mentionsEditor) {
				window.app.mentionsEditor.load(
					person,
					[search_criteria.source],
					results,
					[]
				);
				$('#right-panel-content .tab-btn[data-target="mentions-editor-container"]').click();
				if (typeof window.app.mentionsEditor.scrollToTop === 'function') {
					window.app.mentionsEditor.scrollToTop();
					setTimeout(() => window.app.mentionsEditor.scrollToTop(), 50);
				}
			}
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
				font-size: 14px;
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
				<option value="ORF">Orange FL</option>
			</select>
		`);
		if (window.app && window.app.county) {
			$countySelect.val(window.app.county);
		} else {
			$countySelect.val('AUG');
		}
		$countySelect.on('change', function () {
			if (window.app) {
				window.app.county = $(this).val();
				const urlParams = new URLSearchParams(window.location.search);
				urlParams.set('c', window.app.county);
				window.location.search = urlParams.toString();
			}
		});
		$countyWrap.append($countySelect);

		$right.append($countyWrap, $sourcesWrap, $searchBtn);

		$footer.append($verity, $right);
	}

	static getSourceLabel(val, county = 'AUG') {
		const currentCounty = (window.app && window.app.county) ? String(window.app.county).toUpperCase() : String(county).toUpperCase();
		if (window.GlobalSources) {
			const keys = Object.keys(window.GlobalSources);
			for (let k of keys) {
				const kUpper = k.toUpperCase();
				if (kUpper.startsWith(currentCounty + '-') || kUpper.startsWith(currentCounty + '_')) {
					let sParts = kUpper.split('-');
					let core = sParts.length > 1 ? sParts.slice(1).join('-') : kUpper;
					if (core === val || (core === 'VR' && val.startsWith('VR'))) {
						const srcData = window.GlobalSources[k];
						if (srcData && typeof srcData === 'object' && srcData.title) {
							if (val === 'VRB') return 'Birth Records';
							if (val === 'VRM') return 'Marriage Records';
							if (val === 'VRD') return 'Death Records';
							return srcData.title;
						}
					}
				}
			}
		}

		const labelMap = {
			'CN-1880': '1880 Census',
			'CN-1870': '1870 Census',
			'CN-1860': '1860 Census',
			'CN-1850': '1850 Census',
			'CN-1900': '1900 Census',
			'SS-1860': '1860 Slave Schedule',
			'SS-1850': '1850 Slave Schedule',
			'FG': 'Find A Grave',
			'VRB': 'Birth Records',
			'VRM': 'Marriage Records',
			'VRD': 'Death Records',
			'VR': 'Vital Records',
			'CH': 'Church Records',
			'FBR': 'Free Black Register',
			'FL': 'Freemans Records',
			'SB': 'Slave Births',
			'CC': 'Cohabitation Children',
			'CF': 'Cohabitation Families'
		};
		if (labelMap[val]) return labelMap[val];
		const cnMatch = String(val).match(/^CN-(\d{4})$/i);
		if (cnMatch) return `${cnMatch[1]} Census`;
		const ssMatch = String(val).match(/^SS-(\d{4})$/i);
		if (ssMatch) return `${ssMatch[1]} Slave Schedule`;
		return val;
	}

	static renderSourcesDropdown($wrap, state) {
		$wrap.empty();

		const currentCounty = (window.app && window.app.county) ? String(window.app.county).toUpperCase() : 'AUG';
		const optionsMap = new Map();

		if (window.GlobalSources) {
			Object.keys(window.GlobalSources).forEach(k => {
				const srcData = window.GlobalSources[k];
				const kUpper = k.toUpperCase();
				if (kUpper.startsWith(currentCounty + '-') || kUpper.startsWith(currentCounty + '_')) {
					let sParts = kUpper.split('-');
					let core = sParts.length > 1 ? sParts.slice(1).join('-') : kUpper;
					let title = (srcData && typeof srcData === 'object' && srcData.title) ? srcData.title : core;

					if (core === 'VR') {
						optionsMap.set('VRB', 'Birth Records');
						optionsMap.set('VRM', 'Marriage Records');
						optionsMap.set('VRD', 'Death Records');
						optionsMap.set('VR', title || 'Vital Records');
					} else {
						optionsMap.set(core, title);
					}
				}
			});
		}

		if (state && state.sources) {
			Object.keys(state.sources).forEach(k => {
				const kUpper = k.toUpperCase();
				if (kUpper.startsWith(currentCounty + '-') || kUpper.startsWith(currentCounty + '_')) {
					let sParts = kUpper.split('-');
					let core = sParts.length > 1 ? sParts.slice(1).join('-') : kUpper;
					if (!optionsMap.has(core)) {
						optionsMap.set(core, PersonEditor.getSourceLabel(core, currentCounty));
					}
				}
			});
		}

		const defaultFallbacks = [
			{ value: 'CN-1880', label: '1880 Census' },
			{ value: 'CN-1870', label: '1870 Census' },
			{ value: 'CN-1860', label: '1860 Census' },
			{ value: 'CN-1850', label: '1850 Census' },
			{ value: 'CN-1900', label: '1900 Census' },
			{ value: 'SS-1860', label: '1860 Slave Schedule' },
			{ value: 'SS-1850', label: '1850 Slave Schedule' },
			{ value: 'FG', label: 'Find A Grave' },
			{ value: 'VRB', label: 'Birth Records' },
			{ value: 'VRM', label: 'Marriage Records' },
			{ value: 'VRD', label: 'Death Records' },
			{ value: 'VR', label: 'Vital Records' },
			{ value: 'CH', label: 'Church Records' },
			{ value: 'FBR', label: 'Free Black Register' },
			{ value: 'FL', label: 'Freemans Records' },
			{ value: 'SB', label: 'Slave Births' },
			{ value: 'CC', label: 'Cohabitation Children' },
			{ value: 'CF', label: 'Cohabitation Families' }
		];
		defaultFallbacks.forEach(opt => {
			if (!optionsMap.has(opt.value)) {
				optionsMap.set(opt.value, opt.label);
			}
		});

		const preferredOrder = ['CN-1880', 'CN-1870', 'CN-1860', 'CN-1850', 'CN-1900', 'SS-1860', 'SS-1850', 'FG', 'VRB', 'VRM', 'VRD', 'VR', 'CH', 'FBR', 'FL', 'SB', 'CC', 'CF'];
		const sortedKeys = Array.from(optionsMap.keys()).sort((a, b) => {
			let idxA = preferredOrder.indexOf(a);
			let idxB = preferredOrder.indexOf(b);
			if (idxA !== -1 && idxB !== -1) return idxA - idxB;
			if (idxA !== -1) return -1;
			if (idxB !== -1) return 1;
			return a.localeCompare(b);
		});

		const sourceOptions = sortedKeys.map(val => ({
			value: val,
			label: optionsMap.get(val)
		}));

		const ids = Object.keys(state.sources);
		const allChecked = ids.length > 0 && ids.every(id => state.sources[id].checked);
		let matchId = '';

		if (window.app && window.app.source === 'ALL') {
			matchId = 'ALL';
		} else if (allChecked) {
			matchId = 'ALL';
		} else {
			let selectedId = ids.find(id => state.sources[id].checked) || '';
			matchId = selectedId;
			if (selectedId && selectedId.includes('-') && !sourceOptions.some(opt => opt.value === selectedId)) {
				let suffix = selectedId.substring(selectedId.indexOf('-') + 1);
				if (sourceOptions.some(opt => opt.value === suffix)) {
					matchId = suffix;
				}
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
				font-size: 14px;
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
				const prefix = window.app && window.app.county ? window.app.county + '_' : 'AUG_';
				let fullSource = prefix + newSel.replace('-', '_');
				state.sources[fullSource] = { label: fullSource, checked: true };
			}
		});

		$wrap.append($select);
	}

	static buildSearchCriteriaFromState(person, state) {
		const activeCounty = (window.app && window.app.county) ? String(window.app.county).toUpperCase() : 'AUG';
		let activeSource = (window.app && window.app.source) ? window.app.source : 'CN-1870';
		if (activeSource === 'ALL' || !activeSource) activeSource = 'CN-1870';

		let source = activeSource;
		const prefix = activeCounty + '-';
		if (!source.toUpperCase().startsWith(prefix)) {
			source = `${activeCounty}-${activeSource}`;
		}

		const fields = [];
		PersonEditor.FIELD_CONFIG.forEach(cfg => {
			if (cfg.editKind === 'linked' || cfg.editKind === 'relationship') return;
			const f = state.fields[cfg.key];
			if (!f) return;
			const sel = f.selected;
			const val = (sel === -1 || sel == null) ? null : f.options[sel].value;
			const splitVal = val ? String(val).split(':')[0].trim() : null;
			const matchVal = f.match || cfg.defaultMatch || 'Exact';
			const isRare = f.rare !== undefined ? f.rare : false;

			let term = cfg.key;
			if (term === 'race') term = 'norm_race';

			fields.push({
				term: term,
				value: (matchVal === 'Ignore' || !splitVal) ? null : splitVal,
				match: matchVal,
				rare: isRare
			});
		});

		return {
			source: source,
			max_results: 80,
			fields: fields
		};
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
      .vpe-title { margin:0; font-size:16px; font-weight:600; }
      .vpe-target-summary { font-size:19px; font-weight:600; color:#333; margin:2px 0 0; }
      .vpe-close { font-size:21px; color:#757575; cursor:pointer; }
      .vpe-section-label { font-size:14px; font-weight:500; letter-spacing:.05em; color:#9e9e9e; margin:0 0 .75rem; }
      .vpe-row { display:grid; grid-template-columns:125px 255px 210px; gap:8px 12px; align-items:center;
        padding:4px 8px; border-top:0.5px solid #f0f0f0; }
      .vpe-row-header { font-size:13px; font-weight:500; color:#9e9e9e; border-top:none; padding:4px 8px; }
      .vpe-row-linked { grid-template-columns:125px 1fr; }
      .vpe-field-label { font-size:14px; font-weight:500; }
      .vpe-value-pill { display:flex; align-items:center; flex-wrap:nowrap; gap:4px; width:100%; box-sizing:border-box;
        min-height:28px; border-radius:999px; padding:2px 8px; overflow:hidden; }
      .vpe-chip { display:inline-flex; align-items:center; gap:4px; font-size:13px; padding:2px 10px;
        border-radius:999px; white-space:nowrap; width:fit-content; max-width:100%; flex:0 0 auto; min-height:22px; background:#fff; box-sizing:border-box; }
      .vpe-value-pill select, .vpe-value-pill input[type=text] {
        font-size:13px; height:24px; padding:0 2px; min-width:0; flex:1; width:100%; background:transparent;
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
        font-size: 12px;
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
      .vpe-pill { display:inline-flex; align-items:center; font-size:13px; padding:4px 12px; border-radius:999px;
        white-space:nowrap; cursor:pointer; border:0.5px solid #f0f0f0; background:transparent; color:#757575; }
      .vpe-pill.active { background:#eaf2fb; color:#185fa5; border-color:#b5d4f4; }
      .vpe-footer { display:flex; justify-content:space-between; align-items:center; gap:8px;
        margin-top:1.5rem; padding-top:1rem; border-top:0.5px solid #f0f0f0; }
      .vpe-verity { display:flex; align-items:center; gap:6px; }
      .vpe-verity-label { font-size:14px; font-weight:500; color:#757575; }
      .vpe-footer-right { display:flex; align-items:center; gap:8px; position:relative; }
      .vpe-sources-wrap { position:relative; }
      .vpe-sources-btn { display:flex; align-items:center; gap:6px; background:transparent; border:0.5px solid #f0f0f0;
        border-radius:6px; padding:8px 12px; font-size:14px; font-weight:500; cursor:pointer; }
      .vpe-search-btn { display:flex; align-items:center; gap:6px; background:#eaf2fb; border:1px solid #b5d4f4;
        border-radius:6px; padding:8px 16px; color:#185fa5; text-transform:uppercase; letter-spacing:.04em;
        font-size:13px; font-weight:600; cursor:pointer; }
    `;
		$('<style>').text(css).appendTo('head');
	}

}

window.PersonEditor = PersonEditor;
