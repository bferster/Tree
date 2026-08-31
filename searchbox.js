/**
 * searchbox.js
 * ------------
 * Implements the Search tool dialog styled like Person Editor (vpe-* style).
 * Produces search_criteria object and runs it through Score.Search() to query mentions.
 */

class SearchBox {
	constructor(options = {}) {
		this.options = options;
		this.dialogElement = null;
	}

	static getInstance() {
		if (!window._searchBoxInstance) {
			window._searchBoxInstance = new SearchBox();
		}
		return window._searchBoxInstance;
	}

	static openDialog(initialValues = {}, callback = null) {
		SearchBox.getInstance().showDialog(initialValues, callback);
	}

	showDialog(initialValues = {}, callback = null) {
		this.onSearchCallback = callback || (typeof initialValues === 'object' && initialValues.onSearch ? initialValues.onSearch : null);
		this.createDialogDOM();
		this.populateValues(initialValues);

		const dialog = this.dialogElement;
		if (typeof dialog.showModal === 'function') {
			try {
				if (!dialog.open) dialog.showModal();
			} catch (e) {
				$(dialog).show();
			}
		} else {
			$(dialog).show();
		}
		this.bindDraggable(dialog);
	}

	bindDraggable(dialog) {
		const header = dialog.querySelector('.vpe-header');
		if (!header || dialog._isDraggableBound) return;
		dialog._isDraggableBound = true;

		header.style.cursor = 'move';

		let isDragging = false;
		let startX = 0, startY = 0;
		let startLeft = 0, startTop = 0;

		header.addEventListener('mousedown', (e) => {
			if (e.target.closest('.vpe-close') || e.target.closest('select') || e.target.closest('input') || e.target.closest('button')) {
				return;
			}

			isDragging = true;
			startX = e.clientX;
			startY = e.clientY;

			const rect = dialog.getBoundingClientRect();
			startLeft = rect.left;
			startTop = rect.top;

			dialog.style.position = 'fixed';
			dialog.style.margin = '0';
			dialog.style.left = `${startLeft}px`;
			dialog.style.top = `${startTop}px`;
			dialog.style.right = 'auto';
			dialog.style.bottom = 'auto';

			e.preventDefault();
		});

		document.addEventListener('mousemove', (e) => {
			if (!isDragging) return;
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			dialog.style.left = `${startLeft + dx}px`;
			dialog.style.top = `${startTop + dy}px`;
		});

		document.addEventListener('mouseup', () => {
			isDragging = false;
		});
	}

	closeDialog() {
		if (this.dialogElement) {
			if (typeof this.dialogElement.close === 'function') {
				try {
					this.dialogElement.close();
				} catch (e) {
					$(this.dialogElement).hide();
				}
			} else {
				$(this.dialogElement).hide();
			}
		}
	}

	createDialogDOM() {
		if (document.getElementById('search-tool-dialog')) {
			this.dialogElement = document.getElementById('search-tool-dialog');
			return;
		}

		const dialog = document.createElement('dialog');
		dialog.id = 'search-tool-dialog';
		dialog.className = 'vpe-dialog';
		dialog.style.cssText = `
			width: 540px;
			max-width: 92vw;
			padding: 16px 20px;
			border: 1px solid #e3ddd5;
			border-radius: 12px;
			box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
			background: #ffffff;
			overflow: hidden;
			z-index: 10000;
			box-sizing: border-box;
		`;

		dialog.innerHTML = `
			<!-- Header -->
			<div class="vpe-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; border-bottom:0.5px solid #f0f0f0; padding-bottom:10px;">
				<div class="vpe-target-summary" style="font-size:20px; font-weight:600; color:#333; margin:2px 0 0;">Search Mentions</div>
				<div style="display:flex; align-items:center; gap:10px;">
					<div class="vpe-sources-wrap" style="display:flex; align-items:center; gap:6px;">
						<span style="font-size:14px; font-weight:500; color:#757575;">Source:</span>
						<select id="sb-source-select" class="vpe-sources-btn" style="display:flex; align-items:center; background:#fff; border:0.5px solid #d0d0d0; border-radius:6px; padding:6px 24px 6px 10px; font-size:14px; font-weight:500; cursor:pointer; appearance:none; -webkit-appearance:none; background-image:url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23757575%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'); background-repeat:no-repeat; background-position:right 8px top 50%; background-size:8px auto;">
						</select>
					</div>
					<span id="sb-close-x" class="vpe-close" style="font-size:24px; color:#757575; cursor:pointer; line-height:1; padding:0 4px;">&times;</span>
				</div>
			</div>

			<form id="sb-dialog-form" style="margin:0;">
				<div style="display:flex; flex-direction:column; gap:4px;">

					<!-- First name -->
					<div class="vpe-row" style="display:grid; grid-template-columns:125px 1fr 115px 55px; gap:8px 12px; align-items:center; padding:5px 8px; border-top:0.5px solid #f0f0f0;">
						<span class="vpe-field-label" style="font-size:15px; font-weight:500; color:#333;">First name</span>
						<div class="vpe-value-pill" style="display:flex; align-items:center; background:#EEEDFE; color:#26215C; border-radius:999px; padding:2px 10px; min-height:28px;">
							<input type="text" id="sb-first-name-val" placeholder="Value..." style="width:100%; border:none; background:transparent; font-size:14px; color:#26215C; font-weight:500; outline:none;">
						</div>
						<select id="sb-first-name-match" class="vpe-sources-btn" style="background:#fff; border:0.5px solid #d0d0d0; border-radius:6px; padding:4px 8px; font-size:14px; cursor:pointer;">
							<option value="Ignore">Ignore</option>
							<option value="Exact" selected>Exact</option>
							<option value="Fuzzy">Fuzzy</option>
							<option value="Nickname">Nickname</option>
						</select>
						<label style="display:flex; align-items:center; gap:4px; font-size:14px; color:#555; cursor:pointer;">
							<input type="checkbox" id="sb-first-name-rare" style="cursor:pointer;"> Rare
						</label>
					</div>

					<!-- Last name -->
					<div class="vpe-row" style="display:grid; grid-template-columns:125px 1fr 115px 55px; gap:8px 12px; align-items:center; padding:5px 8px; border-top:0.5px solid #f0f0f0;">
						<span class="vpe-field-label" style="font-size:15px; font-weight:500; color:#333;">Last name</span>
						<div class="vpe-value-pill" style="display:flex; align-items:center; background:#E1F5EE; color:#04342C; border-radius:999px; padding:2px 10px; min-height:28px;">
							<input type="text" id="sb-last-name-val" placeholder="Value..." style="width:100%; border:none; background:transparent; font-size:14px; color:#04342C; font-weight:500; outline:none;">
						</div>
						<select id="sb-last-name-match" class="vpe-sources-btn" style="background:#fff; border:0.5px solid #d0d0d0; border-radius:6px; padding:4px 8px; font-size:14px; cursor:pointer;">
							<option value="Ignore">Ignore</option>
							<option value="Exact" selected>Exact</option>
							<option value="Fuzzy">Fuzzy</option>
							<option value="NYSIIS">NYSIIS</option>
							<option value="Metaphone">Metaphone</option>
						</select>
						<label style="display:flex; align-items:center; gap:4px; font-size:14px; color:#555; cursor:pointer;">
							<input type="checkbox" id="sb-last-name-rare" style="cursor:pointer;"> Rare
						</label>
					</div>

					<!-- Race -->
					<div class="vpe-row" style="display:grid; grid-template-columns:125px 1fr 115px 55px; gap:8px 12px; align-items:center; padding:5px 8px; border-top:0.5px solid #f0f0f0;">
						<span class="vpe-field-label" style="font-size:15px; font-weight:500; color:#333;">Race</span>
						<div class="vpe-value-pill" style="display:flex; align-items:center; background:#EFEBE9; color:#3E2723; border-radius:999px; padding:2px 10px; min-height:28px;">
							<select id="sb-race-val" style="width:100%; border:none; background:transparent; font-size:14px; color:#3E2723; font-weight:500; outline:none; cursor:pointer;">
								<option value="B" selected>B (Black)</option>
								<option value="W">W (White)</option>
							</select>
						</div>
						<select id="sb-race-match" class="vpe-sources-btn" style="background:#fff; border:0.5px solid #d0d0d0; border-radius:6px; padding:4px 8px; font-size:14px; cursor:pointer;">
							<option value="Exact" selected>Exact</option>
							<option value="Ignore">Ignore</option>
						</select>
						<div></div>
					</div>

					<!-- Gender -->
					<div class="vpe-row" style="display:grid; grid-template-columns:125px 1fr 115px 55px; gap:8px 12px; align-items:center; padding:5px 8px; border-top:0.5px solid #f0f0f0;">
						<span class="vpe-field-label" style="font-size:15px; font-weight:500; color:#333;">Gender</span>
						<div class="vpe-value-pill" style="display:flex; align-items:center; background:#E0F7FA; color:#006064; border-radius:999px; padding:2px 10px; min-height:28px;">
							<select id="sb-gender-val" style="width:100%; border:none; background:transparent; font-size:14px; color:#006064; font-weight:500; outline:none; cursor:pointer;">
								<option value="M" selected>M (Male)</option>
								<option value="F">F (Female)</option>
							</select>
						</div>
						<select id="sb-gender-match" class="vpe-sources-btn" style="background:#fff; border:0.5px solid #d0d0d0; border-radius:6px; padding:4px 8px; font-size:14px; cursor:pointer;">
							<option value="Exact" selected>Exact</option>
							<option value="Ignore">Ignore</option>
						</select>
						<div></div>
					</div>

					<!-- Birth year -->
					<div class="vpe-row" style="display:grid; grid-template-columns:125px 1fr 115px 55px; gap:8px 12px; align-items:center; padding:5px 8px; border-top:0.5px solid #f0f0f0;">
						<span class="vpe-field-label" style="font-size:15px; font-weight:500; color:#333;">Birth year</span>
						<div class="vpe-value-pill" style="display:flex; align-items:center; background:#E6F1FB; color:#042C53; border-radius:999px; padding:2px 10px; min-height:28px;">
							<input type="text" id="sb-birth-year-val" placeholder="Year..." style="width:100%; border:none; background:transparent; font-size:14px; color:#042C53; font-weight:500; outline:none;">
						</div>
						<select id="sb-birth-year-match" class="vpe-sources-btn" style="background:#fff; border:0.5px solid #d0d0d0; border-radius:6px; padding:4px 8px; font-size:14px; cursor:pointer;">
							<option value="Ignore">Ignore</option>
							<option value="Exact" selected>Exact</option>
							<option value="±1">±1</option>
							<option value="±2">±2</option>
							<option value="±3">±3</option>
							<option value="±5">±5</option>
							<option value="±10">±10</option>
						</select>
						<div></div>
					</div>

					<!-- Death year -->
					<div class="vpe-row" style="display:grid; grid-template-columns:125px 1fr 115px 55px; gap:8px 12px; align-items:center; padding:5px 8px; border-top:0.5px solid #f0f0f0;">
						<span class="vpe-field-label" style="font-size:15px; font-weight:500; color:#333;">Death year</span>
						<div class="vpe-value-pill" style="display:flex; align-items:center; background:#FCE8E6; color:#5C1D18; border-radius:999px; padding:2px 10px; min-height:28px;">
							<input type="text" id="sb-death-year-val" placeholder="Year..." style="width:100%; border:none; background:transparent; font-size:14px; color:#5C1D18; font-weight:500; outline:none;">
						</div>
						<select id="sb-death-year-match" class="vpe-sources-btn" style="background:#fff; border:0.5px solid #d0d0d0; border-radius:6px; padding:4px 8px; font-size:14px; cursor:pointer;">
							<option value="Ignore">Ignore</option>
							<option value="Exact" selected>Exact</option>
							<option value="±1">±1</option>
							<option value="±2">±2</option>
							<option value="±3">±3</option>
							<option value="±5">±5</option>
							<option value="±10">±10</option>
						</select>
						<div></div>
					</div>

					<!-- Family boost -->
					<div class="vpe-row" style="display:grid; grid-template-columns:125px 1fr 115px 55px; gap:8px 12px; align-items:center; padding:5px 8px; border-top:0.5px solid #f0f0f0;">
						<span class="vpe-field-label" style="font-size:15px; font-weight:500; color:#333;">Family boost</span>
						<div class="vpe-value-pill" style="display:flex; align-items:center; background:#FEF9D7; border-radius:999px; padding:2px 6px; min-height:28px;">
							<div style="background:#ffffff; border:1px solid #d0d0d0; border-radius:999px; padding:2px 10px; display:flex; align-items:center;">
								<span id="sb-family-boost-pill-text" style="font-size:14px; font-weight:500; color:#333;">Boost</span>
							</div>
						</div>
						<select id="sb-family-boost-match" class="vpe-sources-btn" style="background:#fff; border:0.5px solid #d0d0d0; border-radius:6px; padding:4px 8px; font-size:14px; cursor:pointer;">
							<option value="Boost" selected>Boost</option>
							<option value="Ignore">Ignore</option>
						</select>
						<div></div>
					</div>

				</div>

				<!-- Footer -->
				<div class="vpe-footer" style="display:flex; justify-content:space-between; align-items:center; margin-top:1.25rem; padding-top:0.75rem; border-top:0.5px solid #f0f0f0;">
					<div style="display:flex; align-items:center; gap:10px;">
						<button type="button" id="sb-toggle-all-btn" style="background:#f5f5f5; border:0.5px solid #d0d0d0; border-radius:6px; padding:6px 14px; font-size:13px; font-weight:500; cursor:pointer; color:#333;" title="Toggle all match options between Exact and Ignore">Toggle All</button>
						<div style="display:inline-flex; align-items:center; gap:6px;">
							<label style="font-size:13px; font-weight:500; color:#555;">Include:</label>
							<select id="sb-include-select" style="background:transparent; border:0.5px solid #d0d0d0; border-radius:6px; padding:4px 8px; font-size:13px; font-weight:500; cursor:pointer;">
								<option value="all">All terms</option>
								<option value="any">Any term</option>
							</select>
						</div>
					</div>
					<div style="display:flex; gap:10px;">
						<button type="button" id="sb-cancel-btn" style="background:transparent; border:0.5px solid #d0d0d0; border-radius:6px; padding:8px 18px; font-size:14px; font-weight:500; cursor:pointer; color:#555;">CANCEL</button>
						<button type="submit" id="sb-submit-btn" class="vpe-search-btn" style="background:#eaf2fb; border:1px solid #b5d4f4; border-radius:6px; padding:8px 20px; color:#185fa5; text-transform:uppercase; letter-spacing:.04em; font-size:14px; font-weight:600; cursor:pointer;"><i class="ti ti-search"></i>SEARCH</button>
					</div>
				</div>
			</form>
		`;

		document.body.appendChild(dialog);
		this.dialogElement = dialog;

		document.getElementById('sb-close-x').addEventListener('click', () => this.closeDialog());
		document.getElementById('sb-cancel-btn').addEventListener('click', () => this.closeDialog());
		document.getElementById('sb-toggle-all-btn').addEventListener('click', () => {
			const matchSelects = [
				'#sb-first-name-match',
				'#sb-last-name-match',
				'#sb-race-match',
				'#sb-gender-match',
				'#sb-birth-year-match',
				'#sb-death-year-match'
			];
			const hasNonIgnore = matchSelects.some(sel => $(sel).val() !== 'Ignore');
			const targetVal = hasNonIgnore ? 'Ignore' : 'Exact';
			const targetFbVal = hasNonIgnore ? 'Ignore' : 'Boost';

			matchSelects.forEach(sel => $(sel).val(targetVal).trigger('change'));
			$('#sb-family-boost-match').val(targetFbVal).trigger('change');
		});

		document.getElementById('sb-dialog-form').addEventListener('submit', (e) => {
			e.preventDefault();
			this.handleFormSubmit();
		});

		// Sync race & gender dropdown value when match dropdown changes
		$('#sb-race-match, #sb-race-val').on('change', function () {
			SearchBox.lastRaceMatch = $('#sb-race-match').val();
			SearchBox.lastRace = $('#sb-race-val').val();
		});

		$('#sb-gender-match, #sb-gender-val').on('change', function () {
			SearchBox.lastGenderMatch = $('#sb-gender-match').val();
			SearchBox.lastGender = $('#sb-gender-val').val();
		});

		$('#sb-first-name-rare').on('change', function () {
			SearchBox.lastFirstNameRare = $(this).is(':checked');
		});
		$('#sb-last-name-rare').on('change', function () {
			SearchBox.lastLastNameRare = $(this).is(':checked');
		});
	}

	populateValues(initialValues = {}) {
		const $sourceSelect = $('#sb-source-select').empty();
		let availableSources = [];

		if (window.GlobalSources) {
			const currentCounty = (window.app && window.app.county) ? String(window.app.county).toUpperCase() : 'AUG';
			Object.keys(window.GlobalSources).forEach(src => {
				const sUpper = src.toUpperCase();
				if (sUpper.startsWith(currentCounty + '-') || sUpper.startsWith(currentCounty + '_')) {
					availableSources.push(src);
				}
			});
		}

		if (availableSources.length === 0) {
			const activeCounty = (window.app && window.app.county) ? window.app.county : 'AUG';
			const activeSource = (window.app && window.app.source) ? window.app.source : 'CN-1870';
			availableSources = [`${activeCounty}-${activeSource}`];
		}

		availableSources.forEach(src => {
			$sourceSelect.append(`<option value="${src}">${src}</option>`);
		});

		if (initialValues.source) {
			$sourceSelect.val(initialValues.source);
		} else if (window.app && window.app.county && window.app.source) {
			const defaultSrc = `${window.app.county}-${window.app.source}`;
			if ($sourceSelect.find(`option[value="${defaultSrc}"]`).length > 0) {
				$sourceSelect.val(defaultSrc);
			}
		}

		if (initialValues.first_name !== undefined) $('#sb-first-name-val').val(initialValues.first_name);
		if (initialValues.last_name !== undefined) $('#sb-last-name-val').val(initialValues.last_name);
		if (initialValues.birth_year !== undefined) $('#sb-birth-year-val').val(initialValues.birth_year);
		if (initialValues.death_year !== undefined) $('#sb-death-year-val').val(initialValues.death_year);

		const fnRareDefault = initialValues.first_name_rare !== undefined ? !!initialValues.first_name_rare : (SearchBox.lastFirstNameRare !== undefined ? SearchBox.lastFirstNameRare : false);
		const lnRareDefault = initialValues.last_name_rare !== undefined ? !!initialValues.last_name_rare : (SearchBox.lastLastNameRare !== undefined ? SearchBox.lastLastNameRare : false);
		$('#sb-first-name-rare').prop('checked', fnRareDefault);
		$('#sb-last-name-rare').prop('checked', lnRareDefault);

		const raceDefault = initialValues.norm_race || SearchBox.lastRace || 'B';
		const raceMatchDefault = initialValues.norm_race_match || SearchBox.lastRaceMatch || 'Exact';
		$('#sb-race-val').val(raceDefault);
		$('#sb-race-match').val(raceMatchDefault);

		const genderDefault = initialValues.gender || SearchBox.lastGender || 'M';
		const genderMatchDefault = initialValues.gender_match || SearchBox.lastGenderMatch || 'Exact';
		$('#sb-gender-val').val(genderDefault);
		$('#sb-gender-match').val(genderMatchDefault);

		$('#sb-birth-year-match').val(initialValues.birth_year_match || 'Exact');
		$('#sb-death-year-match').val(initialValues.death_year_match || 'Exact');
		const fbVal = initialValues.family_boost_match || initialValues.family_boost || SearchBox.lastFamilyBoostMatch || 'Boost';
		$('#sb-family-boost-match').val(fbVal);
		$('#sb-family-boost-pill-text').text(fbVal);
		$('#sb-family-boost-match').off('change.fb').on('change.fb', function () {
			$('#sb-family-boost-pill-text').text($(this).val());
		});

		const includeVal = initialValues.include || SearchBox.lastIncludeSetting || 'all';
		$('#sb-include-select').val(includeVal);
	}

	buildSearchCriteria() {
		const source = $('#sb-source-select').val() || (window.app ? `${window.app.county}-${window.app.source}` : 'AUG-CN-1870');
		const max_results = 80;

		const fields = [];

		const isNullOrEmpty = (v) => v === null || v === undefined || String(v).trim() === '' || String(v).trim().toLowerCase() === 'null';

		// first_name
		const firstNameRaw = $('#sb-first-name-val').val();
		const firstNameVal = isNullOrEmpty(firstNameRaw) ? null : firstNameRaw.trim();
		const firstNameMatch = (firstNameVal === null) ? 'Ignore' : $('#sb-first-name-match').val();
		const firstNameRare = $('#sb-first-name-rare').is(':checked');
		SearchBox.lastFirstNameRare = firstNameRare;
		fields.push({
			term: 'first_name',
			value: firstNameVal,
			match: firstNameMatch,
			rare: firstNameRare
		});

		// last_name
		const lastNameRaw = $('#sb-last-name-val').val();
		const lastNameVal = isNullOrEmpty(lastNameRaw) ? null : lastNameRaw.trim();
		const lastNameMatch = (lastNameVal === null) ? 'Ignore' : $('#sb-last-name-match').val();
		const lastNameRare = $('#sb-last-name-rare').is(':checked');
		SearchBox.lastLastNameRare = lastNameRare;
		fields.push({
			term: 'last_name',
			value: lastNameVal,
			match: lastNameMatch,
			rare: lastNameRare
		});

		// norm_race
		const raceVal = $('#sb-race-val').val();
		const raceMatch = $('#sb-race-match').val();
		SearchBox.lastRace = raceVal;
		SearchBox.lastRaceMatch = raceMatch;
		const raceEffectiveMatch = (raceMatch === 'Ignore' || isNullOrEmpty(raceVal)) ? 'Ignore' : raceMatch;
		fields.push({
			term: 'norm_race',
			value: raceEffectiveMatch === 'Ignore' ? null : raceVal,
			match: raceEffectiveMatch,
			rare: false
		});

		// gender
		const genderVal = $('#sb-gender-val').val();
		const genderMatch = $('#sb-gender-match').val();
		SearchBox.lastGender = genderVal;
		SearchBox.lastGenderMatch = genderMatch;
		const genderEffectiveMatch = (genderMatch === 'Ignore' || isNullOrEmpty(genderVal)) ? 'Ignore' : genderMatch;
		fields.push({
			term: 'gender',
			value: genderEffectiveMatch === 'Ignore' ? null : genderVal,
			match: genderEffectiveMatch,
			rare: false
		});

		// birth_year
		const birthYearRaw = $('#sb-birth-year-val').val();
		const birthYearVal = isNullOrEmpty(birthYearRaw) ? null : birthYearRaw.trim();
		const birthYearMatch = (birthYearVal === null) ? 'Ignore' : $('#sb-birth-year-match').val();
		fields.push({
			term: 'birth_year',
			value: birthYearVal,
			match: birthYearMatch,
			rare: false
		});

		// death_year
		const deathYearRaw = $('#sb-death-year-val').val();
		const deathYearVal = isNullOrEmpty(deathYearRaw) ? null : deathYearRaw.trim();
		const deathYearMatch = (deathYearVal === null) ? 'Ignore' : $('#sb-death-year-match').val();
		fields.push({
			term: 'death_year',
			value: deathYearVal,
			match: deathYearMatch,
			rare: false
		});

		// family_boost
		const familyBoostMatch = $('#sb-family-boost-match').val() || 'Boost';
		SearchBox.lastFamilyBoostMatch = familyBoostMatch;
		fields.push({
			term: 'family_boost',
			value: familyBoostMatch,
			match: familyBoostMatch,
			rare: false
		});

		const include = $('#sb-include-select').val() || SearchBox.lastIncludeSetting || 'all';
		SearchBox.lastIncludeSetting = include;

		return {
			source,
			max_results,
			include,
			fields
		};
	}

	handleFormSubmit() {
		const search_criteria = this.buildSearchCriteria();
		const mentionsArray = (window.app && window.app.mentions) ? window.app.mentions : [];
		if (window.app && !window.app.score && window.Score) new window.Score();

		let results;
		if (search_criteria.include === 'scan') {
			let searchObj = (window.app && window.app.search) ? window.app.search : null;
			if (!searchObj && typeof Search !== 'undefined') {
				searchObj = new Search({
					mentions: mentionsArray,
					assertions: (window.app && window.app.assertions) ? window.app.assertions : [],
					match: (window.app && window.app.match) ? window.app.match : null
				});
				if (window.app) window.app.search = searchObj;
			}
			const curTree = (window.app && window.app.curTree) ? window.app.curTree : { persons: [], relationships: [] };
			let personId = (this.targetPerson && this.targetPerson.person_id) || (window.app && window.app.curPerson !== -1 ? window.app.curPerson : null);
			if (searchObj && typeof searchObj.scan === 'function' && personId) {
				try {
					const scanRes = searchObj.scan(curTree, personId);
					results = (scanRes && scanRes.sources) ? scanRes.sources.map(s => ({
						mention_id: s.source,
						source: s.source,
						source_type: s.label || s.type || '',
						full_name: `${s.label || s.source} (${s.year || ''})`,
						score: s.best_rough != null ? s.best_rough : (s.candidates > 0 ? 0.5 : 0),
						_score: s.best_rough != null ? s.best_rough : 0,
						_probability: s.best_rough != null ? s.best_rough : 0,
						_matchStrength: s.best_rough != null ? s.best_rough : 0,
						birth_year: s.year,
						narrative: `Candidates: ${s.candidates} | Best rough score: ${s.best_rough != null ? Math.round(s.best_rough * 100) + '%' : 'N/A'}${s.blocked_reason ? ' | Blocked: ' + s.blocked_reason : ''}`,
						why: s,
						factors: s,
						isScanResult: true
					})) : [];
				} catch (err) {
					results = [];
				}
			} else {
				results = window.app.score.Search(mentionsArray, search_criteria);
			}
		} else if (search_criteria.include === 'wide') {
			let searchObj = (window.app && window.app.search) ? window.app.search : null;
			if (!searchObj && typeof Search !== 'undefined') {
				searchObj = new Search({
					mentions: mentionsArray,
					assertions: (window.app && window.app.assertions) ? window.app.assertions : [],
					match: (window.app && window.app.match) ? window.app.match : null
				});
				if (window.app) window.app.search = searchObj;
			}
			const curTree = (window.app && window.app.curTree) ? window.app.curTree : { persons: [], relationships: [] };
			let personId = (this.targetPerson && this.targetPerson.person_id) || (window.app && window.app.curPerson !== -1 ? window.app.curPerson : null);
			if (searchObj && typeof searchObj.find === 'function' && personId) {
				let targetSource = search_criteria.source;
				if (searchObj.sources && !searchObj.sources.has(targetSource)) {
					for (let k of searchObj.sources.keys()) {
						if (k === targetSource || k.endsWith('-' + targetSource) || targetSource.endsWith('-' + k)) {
							targetSource = k;
							break;
						}
					}
				}
				try {
					const findRes = searchObj.find(curTree, personId, { source: targetSource });
					const buildFactorsFromWhy = (why, score) => {
						const factors = {};
						if (!why) return factors;
						const rung = String(why.rung || '').toUpperCase();
						const sKind = String(why.surnameKind || '').toUpperCase();

						// First name factor
						if (rung.includes('EXACT_FIRST')) {
							factors['exactFirstName'] = { value: why.first_name != null ? why.first_name : 1.0 };
						} else if (rung.includes('NICKNAME')) {
							factors['norm_first_name'] = { value: why.first_name != null ? why.first_name : 0.85 };
						} else if (rung.includes('PHONETIC') || rung.includes('FUZZY')) {
							factors['fuzzyFirstName'] = { value: why.first_name != null ? why.first_name : 0.7 };
						} else if (rung.includes('INITIAL')) {
							factors['fuzzyFirstName'] = { value: why.first_name != null ? why.first_name : 0.55 };
						} else if (why.first_name > 0) {
							factors['exactFirstName'] = { value: why.first_name };
						}

						// Last name factor
						if (sKind === 'EXACT_LASTNAME' || (rung.includes('SURNAME') && sKind !== 'NONE')) {
							if (sKind === 'NYSIIS') {
								factors['exactNysiisLast'] = { value: why.last_name != null ? why.last_name : 0.85 };
							} else if (sKind === 'SOUNDEX' || sKind === 'METAPHONE') {
								factors['fuzzyLastName'] = { value: why.last_name != null ? why.last_name : 0.75 };
							} else {
								factors['exactLastName'] = { value: why.last_name != null ? why.last_name : 1.0 };
							}
						} else if (why.last_name > 0) {
							factors['exactLastName'] = { value: why.last_name };
						}

						// Birth Year
						if (why.birth != null && (typeof why.birth === 'number' ? why.birth > 0 : true)) {
							const bVal = typeof why.birth === 'object' ? (why.birth.score != null ? why.birth.score : 0.9) : why.birth;
							if (bVal > 0) factors['birthYear'] = { value: bVal };
						}

						// Gender
						if (why.gender != null && why.gender > 0) {
							factors['gender'] = { value: why.gender };
						}

						// Race
						if (why.race != null && why.race > 0) {
							factors['race'] = { value: why.race };
						}

						// Family / Household boost
						const famScore = why.family != null ? why.family : why.household;
						if (famScore != null && famScore > 0) {
							factors['familyBoost'] = { value: famScore, matches: why.familyMatches || [] };
						}

						// Enslaver holding fit
						if (why.enslaver && why.enslaver.strength > 0) {
							factors['enslaverHolding'] = { value: why.enslaver.strength };
						}

						// Proximity fit
						if (why.proximity && why.proximity.strength > 0) {
							factors['proximityFit'] = { value: why.proximity.strength };
						}

						// Cohort fit
						if (why.cohort && why.cohort.strength > 0) {
							factors['cohortFit'] = { value: why.cohort.strength };
						}

						return factors;
					};

					results = (findRes && findRes.candidates) ? findRes.candidates.map(c => {
						const mFactors = buildFactorsFromWhy(c.why, c.score);
						return {
							...c.mention,
							score: c.score != null ? c.score : 0,
							_score: c.score != null ? c.score : 0,
							_probability: c.probability != null ? c.probability : c.score,
							_matchStrength: c.score != null ? c.score : 0,
							why: c.why,
							factors: mFactors,
							_factors: mFactors
						};
					}) : [];
				} catch (err) {
					results = [];
				}
			} else {
				results = window.app.score.Search(mentionsArray, search_criteria);
			}
		} else {
			results = window.app.score.Search(mentionsArray, search_criteria);
		}

		if (typeof this.onSearchCallback === 'function') {
			this.onSearchCallback(results, search_criteria);
			return results;
		}

		// Render results in Mentions Editor
		if (window.app && window.app.mentionsEditor) {
			window.app.mentionsEditor.load(
				{ person_id: -1, full_name: 'Search Person', mentions: [] },
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

		return results;
	}
}

if (typeof window !== 'undefined') {
	window.SearchBox = SearchBox;
}
if (typeof module !== 'undefined' && module.exports) {
	module.exports = SearchBox;
}
