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
		this.headers = headers;
		this.data = data;
		if (labelText) this.labelText = labelText;

		// Reset scroll positions
		this.container.scrollTop = 0;
		this.container.scrollLeft = 0;
		this.startIndex = 0;
		this.highlightIndex = -1;

		this.updateLabel();

		if (widths) {
			this.columnWidths = widths;
			this.renderHeader(false);
			this.updateViewport();
		} else {
			// First render header to determine widths
			this.renderHeader(true);

			// Use timeout to allow browser to calculate widths
			setTimeout(() => {
				this.measureWidths();
				this.renderHeader(false);
				this.updateViewport();
			}, 0);
		}
	}

	setColumnWidths(widths) {
		this.columnWidths = widths;
		this.renderHeader();
		this.renderBody();
	}

	updateLabel() {
		if (this.label) {
			const baseText = this.labelText || this.label.textContent.split('(')[0].trim();
			this.label.textContent = `${baseText} (${this.data.length} rows)`;
		}
	}

	measureWidths() {
		const ths = this.header.querySelectorAll('th');
		this.columnWidths = Array.from(ths).map(th => th.offsetWidth);
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
				indicator.textContent = this.sortState.direction === 1 ? ' ▲' : ' ▼';
				indicator.style.fontSize = '0.7rem';
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
		e.preventDefault();
		const startX = e.pageX;
		const startWidth = th.offsetWidth;

		const onMouseMove = (moveEvent) => {
			const newWidth = startWidth + (moveEvent.pageX - startX);
			this.columnWidths[index] = newWidth;
			th.style.width = `${newWidth}px`;
			th.style.minWidth = `${newWidth}px`;
			this.renderBody();
		};

		const onMouseUp = () => {
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);
		};

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
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
			this.body.appendChild(tr);
		});

		const spacerBottom = document.createElement('tr');
		spacerBottom.style.height = `${Math.max(0, totalHeight - (endIndex * this.options.rowHeight))}px`;
		this.body.appendChild(spacerBottom);
	}
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

	const targetMention = globalApp.mentions.find(m => m.mention_id == mention_id);
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
`;
		document.head.appendChild(style);
	}

	const container = document.getElementById('sources-editor-container');
	if (container && !document.getElementById('search-pane')) {
		container.innerHTML = `
			<div style="display: flex; flex-direction: column; height: 100%; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f0f2f5;">
				<div id="search-pane">
					<div class="pane-label" id="cs-pane-label">Source Data</div>
					<div class="search-grid">
						<div class="field-unit">
							<label>Search:</label>
							<input type="text" id="cs-search-input" placeholder="Type to search...">
						</div>
						<div class="search-actions">
							<button id="cs-search-btn" class="btn btn-search"><i class="ti ti-search"></i>Search</button>
						</div>
					</div>
				</div>
				<div id="results-display-pane">
					<div id="source-grid-container" style="height:100%; overflow:auto;">
						<table class="data-grid">
							<thead id="sg-header"></thead>
							<tbody id="sg-body"></tbody>
						</table>
					</div>
				</div>
			</div>
		`;

		document.getElementById('cs-search-btn').addEventListener('click', handleContextSearch);
		document.getElementById('cs-search-input').addEventListener('keyup', (e) => {
			if (e.key === 'Enter') handleContextSearch();
		});
	}

	// Switch to Source tab
	if (container) {
		$('.tab-btn').removeClass('active').css('border-top', '2px solid transparent').css('background', '#d4d4d4');
		$('.tab-btn[data-target="sources-editor-container"]').addClass('active').css('border-top', '2px solid #0078d7').css('background', '#e5e5e5');
		$('#person-editor-container, #mentions-editor-container, #sources-editor-container, #familysearch-editor-container, #chat-editor-container').hide();
		$('#sources-editor-container').show();

		setTimeout(() => {
			renderSourceGrid(sourceData, targetMention.source, mention_id);
		}, 50);
	}
}

function renderSourceGrid(mentionsList, sourceLabel, highlightMentionId) {
	const excludeFields = [
		'score', 'factors', 'confidence', 'nysiis_last_name', 'soundex_last_name',
		'last_name', 'middle_name', 'first_name', 'norm_first_name', 'norm_occupation', 'narrative', 'norm_race', 'source', 'source_year', 'created_at'
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

	let headers = Array.from(new Set(processedList.flatMap(row => Object.keys(row))));

	const fullNameIdx = headers.indexOf('full_name');
	const relationIdx = headers.indexOf('relation');
	if (fullNameIdx !== -1 && relationIdx !== -1) {
		headers.splice(relationIdx, 1);
		const newFullNameIdx = headers.indexOf('full_name');
		headers.splice(newFullNameIdx + 1, 0, 'relation');
	}

	const familyIdIdx = headers.indexOf('family_id');
	if (familyIdIdx !== -1) {
		headers.splice(familyIdIdx, 1);
		let birthYearIdx = headers.indexOf('birth_year');
		if (birthYearIdx === -1) birthYearIdx = headers.length; // fallback
		headers.splice(birthYearIdx, 0, 'family_id');
	}

	let dataArrays = processedList.map(row => headers.map(h => row[h] != null ? row[h] : ''));

	if (!currentGrid) {
		currentGrid = new VirtualGrid('source-grid-container', 'sg-header', 'sg-body', 'cs-pane-label', {
			onSort: (field, direction) => {
				const colIndex = headers.indexOf(field);
				if (colIndex === -1) return;

				// Remember highlighted mention_id before sorting
				let highlightedId = null;
				if (currentGrid.highlightIndex !== -1 && currentGrid.highlightIndex < currentGrid.data.length) {
					// We need to find the mention_id column index to save the id
					const idColIndex = headers.indexOf('mention_id');
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
						return valA.localeCompare(valB, undefined, { numeric: true }) * direction;
					}
					return (valA > valB ? 1 : valA < valB ? -1 : 0) * direction;
				});

				// Restore highlight index
				if (highlightedId !== null) {
					const idColIndex = headers.indexOf('mention_id');
					if (idColIndex !== -1) {
						const newIndex = currentGrid.data.findIndex(row => row[idColIndex] == highlightedId);
						currentGrid.highlightIndex = newIndex;
					}
				}

				currentGrid.renderBody();
			}
		});
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
	}

	let foundIndex = -1;
	const data = currentGrid.data;
	for (let i = currentSearchIndex + 1; i < data.length; i++) {
		if (data[i].some(val => String(val).toLowerCase().includes(term))) {
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