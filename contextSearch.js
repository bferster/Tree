/**
 * Optimized Grid Rendering with Virtualization
 */

class VirtualGrid {
	constructor(containerId, headerId, bodyId, labelId, options = {}) {
		this.container = document.getElementById(containerId);
		this.header = document.getElementById(headerId);
		this.body = document.getElementById(bodyId);
		this.label = document.getElementById(labelId);
		this.options = {
			rowHeight: 32,
			...options
		};

		this.data = [];
		this.headers = [];
		this.startIndex = 0;
		this.sortState = { field: null, direction: 1 };
		this.columnWidths = [];
		this.highlightIndex = -1;

		this.container.addEventListener('scroll', () => this.onScroll());
		window.addEventListener('resize', () => this.updateViewport());
	}

	setData(headers, data, labelText = null, widths = null) {
		const validIndices = [];
		const validHeaders = [];
		(headers || []).forEach((h, idx) => {
			if (h != null && String(h).trim() !== '' && h !== 'undefined' && h !== 'null') {
				validHeaders.push(h);
				validIndices.push(idx);
			}
		});

		this.headers = validHeaders;
		if (validIndices.length === (headers || []).length) {
			this.data = data || [];
		} else {
			this.data = (data || []).map(row => validIndices.map(i => row[i]));
		}
		if (labelText) this.labelText = labelText;

		// Reset scroll positions
		this.container.scrollTop = 0;
		this.container.scrollLeft = 0;
		this.startIndex = 0;
		this.highlightIndex = -1;

		this.updateLabel();

		if (widths) {
			this.columnWidths = validIndices.map(i => widths[i]);
		} else {
			this.measureWidths();
		}
		this.renderHeader(false);
		this.updateViewport();
	}

	updateLabel() {
		if (this.label) {
			const baseText = this.labelText || this.label.textContent.split('(')[0].trim();
			this.label.textContent = `${baseText} (${this.data.length} rows)`;
		}
	}

	measureWidths() {
		if (!this.headers || !this.headers.length) return;

		if (!VirtualGrid.canvasCtx) {
			const canvas = document.createElement('canvas');
			VirtualGrid.canvasCtx = canvas.getContext('2d');
		}
		const ctx = VirtualGrid.canvasCtx;

		const headerFont = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
		const cellFont = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

		this.columnWidths = this.headers.map((h, colIdx) => {
			ctx.font = headerFont;
			const headerText = String(h || '').replace(/_/g, ' ');
			const headerPixelWidth = ctx.measureText(headerText).width + 36;

			ctx.font = cellFont;
			let maxCellWidth = 0;
			const sampleLimit = Math.min(this.data.length, 500);
			for (let r = 0; r < sampleLimit; r++) {
				const row = this.data[r];
				if (row && row[colIdx] != null) {
					const cellText = String(row[colIdx]);
					if (cellText) {
						const w = ctx.measureText(cellText).width;
						if (w > maxCellWidth) maxCellWidth = w;
					}
				}
			}
			const dataPixelWidth = maxCellWidth + 28;

			const calculatedWidth = Math.ceil(Math.max(headerPixelWidth, dataPixelWidth));
			return Math.max(65, Math.min(calculatedWidth, 500));
		});
	}

	getColorForHeader(str) {
		const ramps = [
			['#EEEDFE', '#26215C'], // c-purple
			['#E1F5EE', '#04342C'], // c-teal
			['#FAECE7', '#4A1B0C'], // c-coral
			['#FBEAF0', '#4B1528'], // c-pink
			['#F1EFE8', '#2C2C2A'], // c-gray
			['#E6F1FB', '#042C53'], // c-blue
			['#FCEFD9', '#4A2E07'], // c-amber
			['#E5F4E9', '#0F3D1F']  // c-green
		];
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = str.charCodeAt(i) + ((hash << 5) - hash);
		}
		return ramps[Math.abs(hash) % ramps.length];
	}

	renderHeader(isMeasuring = false) {
		this.header.innerHTML = '';
		const tr = document.createElement('tr');
		this.headers.forEach((h, i) => {
			const th = document.createElement('th');

			const [bg, fg] = this.getColorForHeader(h);
			const innerPill = document.createElement('div');
			innerPill.style.display = 'flex';
			innerPill.style.justifyContent = 'center';
			innerPill.style.gap = '6px';
			innerPill.style.alignItems = 'center';
			innerPill.style.width = '100%';
			innerPill.style.background = bg;
			innerPill.style.color = fg;
			innerPill.style.borderRadius = '12px';
			innerPill.style.padding = '4px 10px';
			innerPill.style.boxSizing = 'border-box';

			const textSpan = document.createElement('span');
			textSpan.textContent = h.replace(/_/g, ' ');
			textSpan.style.overflow = 'hidden';
			textSpan.style.textOverflow = 'ellipsis';
			innerPill.appendChild(textSpan);

			if (!isMeasuring && this.sortState.field === h) {
				const indicator = document.createElement('span');
				indicator.textContent = this.sortState.direction === 1 ? ' ▽' : ' △';
				indicator.style.fontSize = '0.7rem';
				indicator.style.color = '#999999';
				innerPill.appendChild(indicator);
			}

			th.appendChild(innerPill);

			if (!isMeasuring && this.columnWidths[i]) {
				th.style.width = `${this.columnWidths[i]}px`;
				th.style.minWidth = `${this.columnWidths[i]}px`;
			}

			th.style.whiteSpace = 'nowrap';

			const resizer = document.createElement('div');
			resizer.className = 'resizer';
			resizer.addEventListener('mousedown', (e) => this.initResize(e, th, i));
			resizer.addEventListener('touchstart', (e) => this.initResize(e, th, i), { passive: false });
			th.appendChild(resizer);

			th.onclick = (e) => {
				if (e.target.className === 'resizer') return;
				this.toggleSort(h);
			};
			tr.appendChild(th);
		});
		this.header.appendChild(tr);
	}

	toggleSort(field) {
		if (this.sortState.field === field) {
			this.sortState.direction *= -1;
		} else {
			this.sortState.field = field;
			this.sortState.direction = 1;
		}
		this.options.onSort?.(field, this.sortState.direction);
		this.renderHeader();
	}

	initResize(e, th, index) {
		if (e.cancelable) e.preventDefault();
		const getX = (evt) => (evt.touches && evt.touches.length > 0) ? evt.touches[0].pageX : (evt.pageX || evt.clientX);
		const startX = getX(e);
		const startWidth = th.offsetWidth;

		const onMove = (moveEvent) => {
			const currentX = getX(moveEvent);
			const newWidth = Math.max(30, startWidth + (currentX - startX));
			this.columnWidths[index] = newWidth;
			th.style.width = `${newWidth}px`;
			th.style.minWidth = `${newWidth}px`;
			this.renderBody();
		};

		const onEnd = () => {
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onEnd);
			document.removeEventListener('touchmove', onMove);
			document.removeEventListener('touchend', onEnd);
			document.removeEventListener('touchcancel', onEnd);
		};

		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onEnd);
		document.addEventListener('touchmove', onMove, { passive: false });
		document.addEventListener('touchend', onEnd);
		document.addEventListener('touchcancel', onEnd);
	}

	updateViewport() {
		const containerHeight = this.container.clientHeight;
		this.rowsPerPage = Math.ceil(containerHeight / this.options.rowHeight) + 5;
		this.renderBody();
	}

	onScroll() {
		const scrollTop = this.container.scrollTop;
		const newStartIndex = Math.floor(scrollTop / this.options.rowHeight);

		if (newStartIndex !== this.startIndex) {
			this.startIndex = newStartIndex;
			this.renderBody();
		}
	}

	setHighlightIndex(index) {
		this.highlightIndex = index;
		if (index !== -1) {
			const rowHeight = this.options.rowHeight;
			this.container.scrollTop = Math.max(0, (index * rowHeight) - (this.container.clientHeight / 2));
		}
		this.renderBody();
	}

	renderBody() {
		const totalHeight = this.data.length * this.options.rowHeight;
		this.body.innerHTML = '';

		const spacerTop = document.createElement('tr');
		spacerTop.style.height = `${this.startIndex * this.options.rowHeight}px`;
		this.body.appendChild(spacerTop);

		const endIndex = Math.min(this.startIndex + this.rowsPerPage, this.data.length);
		const visibleData = this.data.slice(this.startIndex, endIndex);

		visibleData.forEach((row, rowIdx) => {
			const tr = document.createElement('tr');
			tr.style.height = `${this.options.rowHeight}px`;

			if (this.startIndex + rowIdx === this.highlightIndex) {
				tr.style.backgroundColor = '#fff3cd';
				tr.style.outline = '1px solid #ffeeba';
			}

			row.forEach((val, i) => {
				const td = document.createElement('td');
				td.textContent = val;
				if (this.columnWidths[i]) {
					td.style.width = `${this.columnWidths[i]}px`;
					td.style.minWidth = `${this.columnWidths[i]}px`;
				}
				tr.appendChild(td);
			});
			tr.addEventListener('dblclick', () => {
				const idColIndex = this.headers.indexOf('mention_id');
				if (idColIndex !== -1) {
					const mentionId = row[idColIndex];
					const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
					if (globalApp && globalApp.editMention) {
						globalApp.editMention(mentionId);
					}
				}
			});
			this.body.appendChild(tr);
		});

		const spacerBottom = document.createElement('tr');
		spacerBottom.style.height = `${Math.max(0, totalHeight - (endIndex * this.options.rowHeight))}px`;
		this.body.appendChild(spacerBottom);
	}
}

// -----------------------------------------------------------------------------
// GetCurrentSource Helper
// -----------------------------------------------------------------------------

function GetCurrentSource() {
	const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
	if (!globalApp || !globalApp.mentions || globalApp.mentions.length === 0) return null;

	// 1. Check selected person's mentions
	if (window.treeApp && window.treeApp.state && window.treeApp.state.selectedPid) {
		const node = window.treeApp.GetNode(window.treeApp.state.selectedPid);
		if (node && node.mentions && node.mentions.length > 0) {
			const targetMention = globalApp.mentions.find(m => String(m.mention_id) === String(node.mentions[0]));
			if (targetMention && targetMention.source) {
				return targetMention.source;
			}
		}
	}

	// 2. Check globalApp.county and globalApp.source
	if (globalApp.county && globalApp.source) {
		const constructedSource = `${globalApp.county}-${globalApp.source}`;
		const hasMentions = globalApp.mentions.some(m => m.source === constructedSource);
		if (hasMentions) {
			return constructedSource;
		}
	}

	// 3. Fallback to first mention's source
	if (globalApp.mentions[0] && globalApp.mentions[0].source) {
		return globalApp.mentions[0].source;
	}

	return null;
}

// -----------------------------------------------------------------------------
// ShowSource Implementation
// -----------------------------------------------------------------------------

let currentGrid = null;
let currentSearchTerm = '';
let currentSearchIndex = -1;

async function ShowSource(mention_id) {
	const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
	if (!globalApp || !globalApp.mentions) return;

	let targetMention = globalApp.mentions.find(m => String(m.mention_id) === String(mention_id));
	if (!targetMention) {
		// Try treating mention_id as a source name and find the first mention in that source
		targetMention = globalApp.mentions.find(m => m.source === mention_id);
	}
	if (!targetMention) return;

	const sourceData = globalApp.mentions.filter(m => m.source === targetMention.source);
	if (!sourceData.length) return;

	// Inject CSS
	if (!document.getElementById('cs-styles')) {
		const style = document.createElement('style');
		style.id = 'cs-styles';
		style.textContent = `
.pane-label { padding: 4px 10px; color: #666; font-weight: bold; font-size: 0.8rem; margin-right: 12px; flex-shrink: 0; }
.data-grid { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: auto; width: max-content; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fff; }
.data-grid th { position: sticky; top: 0; z-index: 100; background: #fff; font-weight: 600; padding: 6px 4px; border-bottom: 1px solid #e3ddd5; text-align: left; cursor: pointer; user-select: none; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
.resizer { position: absolute; top: 0; right: 0; width: 4px; cursor: col-resize; user-select: none; height: 100%; background-color: transparent; z-index: 101; }
.resizer:hover { background-color: rgba(0, 0, 0, 0.1); }
.data-grid td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; border-right: 1px solid #f0f0f0; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #333; }
.data-grid tr:hover td { background-color: #f7f9fc; }
#search-pane { background-color: #ffffff; padding: 10px 16px; border-bottom: 1px solid #d1d5db; display: flex; flex-direction: row; align-items: center; box-sizing: border-box; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.05); z-index: 10; }
.search-grid { display: flex; flex-direction: row; gap: 12px; margin: 0; flex-grow: 1; align-items: center; }
.field-unit { display: flex; flex-direction: row; gap: 8px; align-items: center; margin-left: auto; }
.field-unit label { font-weight: 500; font-size: 0.75rem; color: #555; white-space: nowrap; }
.field-unit input, .field-unit select { padding: 5px 12px; border-radius: 20px; border: 1px solid #ccc; font-size: 0.8rem; width: 250px; background-color: #fff; outline: none; transition: border-color 0.2s; }
.field-unit input:focus { border-color: #0078d7; }
.search-actions { display: flex; flex-direction: row; gap: 8px; }
.btn { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 16px; font-weight: 600; font-size: 13px; cursor: pointer; transition: transform 0.1s ease; border: 1px solid transparent; }
.btn-search { background: #eaf2fb; color: #185fa5; border-color: #b5d4f4; }
.btn-search:hover { transform: translateY(-1px); background-color: #dcedfc; }
#results-display-pane { flex-grow: 1; background-color: #fff; overflow: auto; position: relative; width: 100%; box-sizing: border-box; }
.cs-spinner { width: 32px; height: 32px; border: 3px solid rgba(0, 120, 215, 0.2); border-radius: 50%; border-top-color: #0078d7; animation: cs-spin 0.7s linear infinite; }
@keyframes cs-spin { to { transform: rotate(360deg); } }
`;
		document.head.appendChild(style);
	}

	const container = document.getElementById('sources-editor-container');
	if (container && !document.getElementById('search-pane')) {
		container.innerHTML = `
			<div style="display: flex; flex-direction: column; height: 100%; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f0f2f5;">
				<div id="search-pane">
					<div class="pane-label" id="cs-pane-label">Source Data</div>
					<div class="search-grid" style="display:flex; align-items:center; gap:12px; flex-grow:1;">
						<div style="display:flex; align-items:center; gap:6px;">
							<label for="cs-source-select" style="font-weight:500; font-size:0.8rem; color:#555; white-space:nowrap;">Source:</label>
							<select id="cs-source-select" class="vpe-sources-btn" style="background:#fff; border:1px solid #d0d0d0; border-radius:999px; padding:4px 14px; font-size:13px; cursor:pointer; font-weight:500; min-width:160px; max-width:320px; color:#333; outline:none;"></select>
						</div>
						<div class="search-actions" style="margin-left:auto; display:flex; gap:8px;">
							<button id="cs-search-btn" class="btn btn-search"><i class="ti ti-target"></i>Search</button>
							<button id="cs-find-all-btn" class="btn btn-search" style="background:#f1f5f9; color:#475569; border-color:#cbd5e1;"><i class="ti ti-search"></i>Find All</button>
						</div>
					</div>
				</div>
				<div id="results-display-pane">
					<div id="cs-loading-overlay" style="position: absolute; top:0; left:0; right:0; bottom:0; background: rgba(255, 255, 255, 0.8); display: none; justify-content: center; align-items: center; z-index: 500; flex-direction: column; gap: 8px;">
						<div class="cs-spinner"></div>
						<span style="font-size: 13px; font-weight: 500; color: #0078d7;">Loading source data...</span>
					</div>
					<div id="source-grid-container" style="height:100%; overflow:auto;">
						<table class="data-grid">
							<thead id="sg-header"></thead>
							<tbody id="sg-body"></tbody>
						</table>
					</div>
				</div>
			</div>
		`;

		document.getElementById('cs-search-btn')?.addEventListener('click', () => {
			openContextSearchDialog();
		});

		document.getElementById('cs-find-all-btn')?.addEventListener('click', () => {
			if (typeof SearchBox !== 'undefined') {
				SearchBox.openDialog();
			} else {
				handleContextSearch();
			}
		});

		document.getElementById('cs-source-select')?.addEventListener('change', (e) => {
			const selSrc = e.target.value;
			if (selSrc && typeof ShowSource === 'function') {
				showContextLoading();
				setTimeout(() => {
					ShowSource(selSrc);
				}, 20);
			}
		});
	}

	// Switch to Source tab
	if (container) {
		$('.tab-btn').removeClass('active').css('border-top', '2px solid transparent').css('background', '#d4d4d4');
		$('.tab-btn[data-target="sources-editor-container"]').addClass('active').css('border-top', '2px solid #0078d7').css('background', '#e5e5e5');
		$('#person-editor-container, #mentions-editor-container, #sources-editor-container, #chat-editor-container').hide();
		$('#sources-editor-container').show();

		showContextLoading();
		setTimeout(() => {
			renderSourceGrid(sourceData, targetMention.source, mention_id);
			populateContextSourceDropdown(targetMention.source);
			setTimeout(() => hideContextLoading(), 150);
		}, 50);
	}
}

function showContextLoading() {
	const overlay = document.getElementById('cs-loading-overlay');
	if (overlay) overlay.style.display = 'flex';
}

function hideContextLoading() {
	const overlay = document.getElementById('cs-loading-overlay');
	if (overlay) overlay.style.display = 'none';
}

function populateContextSourceDropdown(activeSource) {
	const selectEl = document.getElementById('cs-source-select');
	if (!selectEl) return;

	const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
	if (!globalApp || !globalApp.mentions) return;

	const currentCounty = globalApp.county ? String(globalApp.county).toUpperCase() : 'AUG';

	// Collect unique sources from mentions
	const allMentionSources = Array.from(new Set(globalApp.mentions.map(m => m.source).filter(Boolean)));

	if (window.GlobalSources) {
		Object.keys(window.GlobalSources).forEach(src => {
			if (!allMentionSources.includes(src)) {
				allMentionSources.push(src);
			}
		});
	}

	let matchingSources = allMentionSources.filter(src => {
		const sUpper = src.toUpperCase();
		return sUpper.startsWith(currentCounty + '-') || sUpper.startsWith(currentCounty + '_');
	});
	if (matchingSources.length === 0) {
		matchingSources = allMentionSources;
	} else if (activeSource && !matchingSources.includes(activeSource)) {
		matchingSources.push(activeSource);
	}

	const preferredOrder = ['CN-1880', 'CN-1870', 'CN-1860', 'CN-1850', 'CN-1900', 'SS-1860', 'SS-1850', 'FG', 'VR', 'CH', 'FBR', 'FL', 'SB', 'CC', 'CF'];
	matchingSources.sort((a, b) => {
		const getCore = (s) => s.includes('-') ? s.substring(s.indexOf('-') + 1) : s;
		const coreA = getCore(a);
		const coreB = getCore(b);
		let idxA = preferredOrder.indexOf(coreA);
		let idxB = preferredOrder.indexOf(coreB);
		if (idxA !== -1 && idxB !== -1) return idxA - idxB;
		if (idxA !== -1) return -1;
		if (idxB !== -1) return 1;
		return a.localeCompare(b);
	});

	const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	selectEl.innerHTML = '';
	matchingSources.forEach(src => {
		let core = src.includes('-') ? src.substring(src.indexOf('-') + 1) : src;
		let label = src;
		if (typeof PersonEditor !== 'undefined' && PersonEditor.getSourceLabel) {
			label = PersonEditor.getSourceLabel(core, currentCounty);
		}
		const display = label && label !== src ? `${label} (${src})` : src;
		const isSelected = src === activeSource;
		selectEl.insertAdjacentHTML('beforeend', `<option value="${esc(src)}" ${isSelected ? 'selected' : ''}>${esc(display)}</option>`);
	});
}

function renderSourceGrid(mentionsList, sourceLabel, highlightMentionId) {
	const excludeFields = [
		'score', 'factors', 'confidence', 'nysiis_last_name', 'soundex_last_name',
		'last_name', 'middle_name', 'first_name', 'norm_first_name', 'norm_occupation', 'narrative', 'norm_race', 'source', 'source_year', 'created_at',
		'age', 'line', 'original_line', 'metaphone_last_name', 'household_id', 'family_id', 'fam-cen', 'dwell-cen'
	];

	if (!sourceLabel || !sourceLabel.includes('1880')) {
		excludeFields.push('relation');
	}

	// Flatten original_data and include all other top-level mention fields
	const processedList = mentionsList.map(m => {
		let origData = m.original_data || {};
		if (typeof origData === 'string') {
			try { origData = JSON.parse(origData); } catch (e) { origData = {}; }
		}
		if (Array.isArray(origData)) {
			origData = origData.length > 0 ? origData[0] : {};
		}

		let relVal = '';
		if (origData) {
			relVal = origData.Relation || origData.relation || origData.Relationship || origData.relationship || origData['Rel to Head'] || '';
		}

		const row = { ...m, ...origData, relation: relVal };
		delete row.original_data; // Remove the object/string so it doesn't render as [object Object]

		// Remove requested excluded fields (case-insensitive check just in case)
		excludeFields.forEach(field => {
			if (field in row) delete row[field];
			const lowerField = field.toLowerCase();
			Object.keys(row).forEach(k => {
				if (k.toLowerCase() === lowerField) delete row[k];
			});
		});

		return row;
	});

	let headers = Array.from(new Set(processedList.flatMap(row => Object.keys(row))))
		.filter(h => h != null && String(h).trim() !== '' && h !== 'undefined' && h !== 'null');

	const fullNameIdx = headers.indexOf('full_name');
	const relationIdx = headers.indexOf('relation');
	if (fullNameIdx !== -1 && relationIdx !== -1) {
		headers.splice(relationIdx, 1);
		const newFullNameIdx = headers.indexOf('full_name');
		headers.splice(newFullNameIdx + 1, 0, 'relation');
	}

	let familyIdx = headers.findIndex(h => h.toLowerCase() === 'family');
	if (familyIdx !== -1) {
		const familyKey = headers[familyIdx];
		headers.splice(familyIdx, 1);
		let genderIdx = headers.findIndex(h => h.toLowerCase() === 'gender');
		if (genderIdx !== -1) {
			headers.splice(genderIdx + 1, 0, familyKey);
		} else {
			let fullNamePos = headers.indexOf('full_name');
			headers.splice(fullNamePos !== -1 ? fullNamePos + 1 : 0, 0, familyKey);
		}
	}

	let headIdx = headers.findIndex(h => h.toLowerCase() === 'head');
	if (headIdx !== -1) {
		const headKey = headers[headIdx];
		headers.splice(headIdx, 1);

		let deathYearIdx = headers.findIndex(h => h.toLowerCase() === 'death_year' || h.toLowerCase() === 'death year');
		let birthYearIdx = headers.findIndex(h => h.toLowerCase() === 'birth_year' || h.toLowerCase() === 'birth year');
		let raceIdx = headers.findIndex(h => h.toLowerCase() === 'race');

		if (deathYearIdx !== -1) {
			headers.splice(deathYearIdx + 1, 0, headKey);
		} else if (birthYearIdx !== -1) {
			headers.splice(birthYearIdx + 1, 0, headKey);
		} else if (raceIdx !== -1) {
			headers.splice(raceIdx, 0, headKey);
		} else {
			headers.push(headKey);
		}
	}

	let dataArrays = processedList.map(row => headers.map(h => row[h] != null ? row[h] : ''));

	if (!currentGrid) {
		currentGrid = new VirtualGrid('source-grid-container', 'sg-header', 'sg-body', 'cs-pane-label', {
			onSort: (field, direction) => {
				const colIndex = currentGrid.headers.indexOf(field);
				if (colIndex === -1) return;

				// Remember highlighted mention_id before sorting
				let highlightedId = null;
				if (currentGrid.highlightIndex !== -1 && currentGrid.highlightIndex < currentGrid.data.length) {
					// We need to find the mention_id column index to save the id
					const idColIndex = currentGrid.headers.indexOf('mention_id');
					if (idColIndex !== -1) {
						highlightedId = currentGrid.data[currentGrid.highlightIndex][idColIndex];
					}
				}

				currentGrid.data.sort((a, b) => {
					let valA = a[colIndex];
					let valB = b[colIndex];
					if (valA == null) valA = '';
					if (valB == null) valB = '';
					if (typeof valA === 'string' && typeof valB === 'string') {
						return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' }) * direction;
					}
					return (valA > valB ? 1 : valA < valB ? -1 : 0) * direction;
				});

				// Restore highlight index
				if (highlightedId !== null) {
					const idColIndex = currentGrid.headers.indexOf('mention_id');
					if (idColIndex !== -1) {
						const newIndex = currentGrid.data.findIndex(row => row[idColIndex] == highlightedId);
						currentGrid.setHighlightIndex(newIndex);
					}
				} else {
					currentGrid.renderBody();
				}
			}
		});
	}

	const idColIndex = headers.indexOf('mention_id');
	if (idColIndex !== -1) {
		dataArrays.sort((a, b) => {
			let valA = a[idColIndex];
			let valB = b[idColIndex];
			if (valA == null) valA = '';
			if (valB == null) valB = '';
			if (typeof valA === 'string' && typeof valB === 'string') {
				return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
			}
			return (valA > valB ? 1 : valA < valB ? -1 : 0);
		});
		currentGrid.sortState = { field: 'mention_id', direction: 1 };
	}

	currentGrid.setData(headers, dataArrays, sourceLabel);

	setTimeout(() => {
		const idColIndex = headers.indexOf('mention_id');
		if (idColIndex !== -1) {
			const targetRowIndex = currentGrid.data.findIndex(row => row[idColIndex] == highlightMentionId);
			if (targetRowIndex !== -1) {
				currentGrid.setHighlightIndex(targetRowIndex);
			}
		}
	}, 100);
}

function handleContextSearch() {
	if (!currentGrid) return;
	const term = document.getElementById('cs-search-input').value.toLowerCase();
	if (!term) return;

	if (term !== currentSearchTerm) {
		currentSearchTerm = term;
		currentSearchIndex = -1;
		console.trace('ContextSearch - Searching term:', term);
	}

	const terms = term.split(/\s+/).filter(Boolean);

	let foundIndex = -1;
	const data = currentGrid.data;
	for (let i = currentSearchIndex + 1; i < data.length; i++) {
		const rowString = data[i].map(val => String(val).toLowerCase()).join(' ');
		if (terms.every(t => rowString.includes(t))) {
			foundIndex = i;
			break;
		}
	}

	if (foundIndex !== -1) {
		currentSearchIndex = foundIndex;
		currentGrid.setHighlightIndex(foundIndex);
	} else {
		// loop around
		if (currentSearchIndex !== -1) {
			currentSearchIndex = -1;
			handleContextSearch();
		}
	}
}

function highlightMostLikelyMatch() {
	if (!currentGrid || !currentGrid.data || !currentGrid.data.length) return;

	const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
	const mentionsArray = globalApp && globalApp.mentions ? globalApp.mentions : [];

	let person = null;
	if (window.treeApp && window.treeApp.state && window.treeApp.state.selectedPid) {
		person = window.treeApp.GetNode(window.treeApp.state.selectedPid);
	}
	if (!person && globalApp && globalApp.targetPerson) {
		person = globalApp.targetPerson;
	}
	if (!person && globalApp && globalApp.curTree && globalApp.curTree.persons) {
		const pList = Array.isArray(globalApp.curTree.persons) ? globalApp.curTree.persons : Object.values(globalApp.curTree.persons);
		if (pList.length > 0) person = pList[0];
	}

	const idColIndex = currentGrid.headers.indexOf('mention_id');
	let bestIndex = -1;

	if (person) {
		const fname = (person.first_name || '').split(':')[0].trim();
		const lname = (person.last_name || '').split(':')[0].trim();
		const byear = (person.birth_year ? String(person.birth_year) : '').split(':')[0].trim();
		const gender = (person.gender ? String(person.gender) : '').split(':')[0].trim();

		if (globalApp && !globalApp.score && window.Score) new window.Score();

		if (globalApp && globalApp.score && typeof globalApp.score.Search === 'function') {
			const sourceSelect = document.getElementById('cs-source-select');
			const activeSource = sourceSelect ? sourceSelect.value : (currentGrid.labelText || '');

			const fields = [];
			if (fname) fields.push({ term: 'first_name', value: fname, match: 'Exact', rare: false });
			if (lname) fields.push({ term: 'last_name', value: lname, match: 'Exact', rare: false });
			if (byear) fields.push({ term: 'birth_year', value: byear, match: 'Exact', rare: false });
			if (gender) fields.push({ term: 'gender', value: gender, match: 'Exact', rare: false });

			if (fields.length > 0) {
				const criteria = {
					source: activeSource,
					max_results: 50,
					fields: fields
				};

				const results = globalApp.score.Search(mentionsArray, criteria);
				if (results && results.length > 0) {
					const firstRes = results[0];
					const topMentionId = (firstRes.mention && firstRes.mention.mention_id) ? firstRes.mention.mention_id : (firstRes.mention_id || firstRes.id);
					if (idColIndex !== -1 && topMentionId) {
						bestIndex = currentGrid.data.findIndex(row => String(row[idColIndex]).trim() === String(topMentionId).trim());
					}
				}
			}
		}

		if (bestIndex === -1 && (lname || fname)) {
			let highestScore = -1;
			currentGrid.data.forEach((row, idx) => {
				const rowStr = row.map(v => String(v).toLowerCase()).join(' ');
				let score = 0;
				if (lname && rowStr.includes(lname.toLowerCase())) score += 5;
				if (fname && rowStr.includes(fname.toLowerCase())) score += 3;
				if (byear && rowStr.includes(byear.toLowerCase())) score += 2;
				if (gender && rowStr.includes(gender.toLowerCase())) score += 1;
				if (score > highestScore && score > 0) {
					highestScore = score;
					bestIndex = idx;
				}
			});
		}
	}

	if (bestIndex === -1 && currentGrid.data.length > 0) {
		bestIndex = 0;
	}

	if (bestIndex !== -1) {
		currentGrid.setHighlightIndex(bestIndex);
	}
}

let lastSearchCriteriaKey = null;
let currentOccurrenceIndex = 0;

function openContextSearchDialog() {
	const globalApp = window.app || (typeof app !== 'undefined' ? app : null);
	let person = null;
	if (window.treeApp && window.treeApp.state && window.treeApp.state.selectedPid) {
		person = window.treeApp.GetNode(window.treeApp.state.selectedPid);
	}
	if (!person && globalApp && globalApp.targetPerson) {
		person = globalApp.targetPerson;
	}
	if (!person && globalApp && globalApp.curTree && globalApp.curTree.persons) {
		const pList = Array.isArray(globalApp.curTree.persons) ? globalApp.curTree.persons : Object.values(globalApp.curTree.persons);
		if (pList.length > 0) person = pList[0];
	}

	const sourceSelect = document.getElementById('cs-source-select');
	const currentSource = sourceSelect ? sourceSelect.value : (globalApp ? `${globalApp.county}-${globalApp.source}` : '');

	const initialValues = {
		source: currentSource
	};

	if (person) {
		if (person.first_name) initialValues.first_name = person.first_name.split(':')[0];
		if (person.last_name) initialValues.last_name = person.last_name.split(':')[0];
		if (person.birth_year) initialValues.birth_year = String(person.birth_year).split(':')[0];
		if (person.death_year) initialValues.death_year = String(person.death_year).split(':')[0];
		if (person.gender) initialValues.gender = String(person.gender).split(':')[0];
		if (person.race) initialValues.norm_race = String(person.race).split(':')[0];
	}

	if (typeof SearchBox === 'undefined' || typeof SearchBox.openDialog !== 'function') {
		highlightMostLikelyMatch();
		return;
	}

	SearchBox.openDialog(initialValues, (results, search_criteria) => {
		const targetSource = search_criteria ? search_criteria.source : null;
		const searchKey = JSON.stringify(search_criteria);

		if (searchKey === lastSearchCriteriaKey) {
			currentOccurrenceIndex++;
		} else {
			lastSearchCriteriaKey = searchKey;
			currentOccurrenceIndex = 0;
		}

		// Collect all matching mention IDs from results
		const matchingMentionIds = [];
		if (results && results.length > 0) {
			results.forEach(res => {
				const mid = (res.mention && res.mention.mention_id) ? res.mention.mention_id : (res.mention_id || res.id);
				if (mid && !matchingMentionIds.includes(mid)) {
					matchingMentionIds.push(mid);
				}
			});
		}

		const highlightResultOccurrence = () => {
			if (!currentGrid || !currentGrid.data) return;
			const idColIndex = currentGrid.headers.indexOf('mention_id');

			// Build list of matching grid row indices
			const matchingGridIndices = [];

			if (idColIndex !== -1 && matchingMentionIds.length > 0) {
				matchingMentionIds.forEach(mid => {
					const idx = currentGrid.data.findIndex(row => String(row[idColIndex]).trim() === String(mid).trim());
					if (idx !== -1 && !matchingGridIndices.includes(idx)) {
						matchingGridIndices.push(idx);
					}
				});
			}

			// Fallback: match row text string against active search fields
			if (matchingGridIndices.length === 0 && search_criteria && search_criteria.fields) {
				const terms = search_criteria.fields
					.filter(f => f && f.match !== 'Ignore' && f.value)
					.map(f => String(f.value).toLowerCase().trim())
					.filter(Boolean);

				if (terms.length > 0) {
					currentGrid.data.forEach((row, idx) => {
						const rowStr = row.map(v => String(v).toLowerCase()).join(' ');
						if (terms.every(t => rowStr.includes(t))) {
							matchingGridIndices.push(idx);
						}
					});
				}
			}

			if (matchingGridIndices.length > 0) {
				const targetIndex = matchingGridIndices[currentOccurrenceIndex % matchingGridIndices.length];
				currentGrid.setHighlightIndex(targetIndex);
			}
		};

		const sourceSelectEl = document.getElementById('cs-source-select');
		const curSourceVal = sourceSelectEl ? sourceSelectEl.value : '';

		const needsSourceLoad = !currentGrid || !currentGrid.data || currentGrid.data.length === 0 || (targetSource && targetSource !== curSourceVal);

		if (needsSourceLoad && typeof ShowSource === 'function') {
			ShowSource(targetSource || (matchingMentionIds.length > 0 ? matchingMentionIds[0] : null));
			setTimeout(highlightResultOccurrence, 100);
			setTimeout(highlightResultOccurrence, 350);
		} else {
			highlightResultOccurrence();
		}
	});
}