class TreeApp {
	constructor()																		// CONSTRUCTOR
	{

		this.Init();
	}

	Init()																		// INITIALIZE APP
	{

		// Dynamically generate structural HTML elements and prepend to document.body
		document.body.insertAdjacentHTML('afterbegin', `
			<!-- Link Banner -->
			<div id="link-banner"
				style="display:none; position:absolute; top:30px; left:0; right:0; background:#f0ad4e; color:white; text-align:center; padding:10px; z-index:2000; font-weight:bold;">
				Click a node to link to, or press Escape to cancel
			</div>
		
			<!-- Menu Bar -->
			<div class="menubar" id="menubar">
				<!-- File Menu -->
				<div class="menu-top-level">
					File
					<div class="dropdown">
						<div class="dropdown-item" id="menu-new">New</div>
						<div class="dropdown-item" id="menu-save">Save</div>
						<div class="dropdown-item" id="menu-load">Load...</div>
						<div class="dropdown-item" id="menu-load-demo">Load demo</div>
						<div class="dropdown-item" id="menu-delete">Delete...</div>
						<div class="dropdown-separator"></div>
						<div class="dropdown-item has-submenu">
							Import
							<div class="submenu">
								<div class="dropdown-item" id="menu-import-json">JSON</div>
							</div>
						</div>
						<div class="dropdown-item has-submenu">
							Export
							<div class="submenu">
								<div class="dropdown-item" id="menu-export-gedcom" style="color:#aaa; cursor:default;" title="GEDCOM export isn't implemented yet">GEDCOM (coming soon)</div>
								<div class="dropdown-item" id="menu-export-json">JSON</div>
							</div>
						</div>
					</div>
				</div>
		
				<!-- Edit Menu -->
				<div class="menu-top-level">
					Edit
					<div class="dropdown">
						<div class="dropdown-item" id="menu-undo">Undo</div>
						<div class="dropdown-item" id="menu-redo">Redo</div>
						<div class="dropdown-separator"></div>
						<div class="dropdown-item" id="menu-add-node">Add person</div>
						<div class="dropdown-item" id="menu-delete-node">Remove person</div>
					</div>
				</div>
		
				<!-- View Menu -->
				<div class="menu-top-level">
					View
					<div class="dropdown">
						<div class="dropdown-item" id="menu-zoom-in">Zoom In</div>
						<div class="dropdown-item" id="menu-zoom-out">Zoom Out</div>
						<div class="dropdown-item" id="menu-fit-screen">Fit to Screen</div>
						<div class="dropdown-item" id="menu-reset-layout">Reset Layout</div>
						<div class="dropdown-separator"></div>
						<div class="dropdown-item" id="menu-toggle-notepad">Notepad</div>
					</div>
				</div>
		
				<!-- Help Menu -->
				<div class="menu-top-level">
					Help
					<div class="dropdown">
						<div class="dropdown-item" id="menu-help-docs">Open User Manual</div>
					</div>
				</div>
		
			</div>
		
			<!-- Workspace Area -->
			<div class="main-workspace">
				<!-- Main Canvas Area -->
				<div class="canvas-container" style="width: 66%; position: relative;">
					<img src="img/Vlogo.png" style="position: absolute; bottom: 20px; left: 20px; width: 4vw;opacity: 0.5; pointer-events: none;">
				</div>
		
				<!-- Vertical Divider Splitter -->
				<div id="divider"></div>
		
				<!-- Matching Module Placeholder -->
				<div class="matching-module-placeholder" style="width: calc(34% - 6px);">
					<div id="right-panel-content" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #666; font-size: 16px; overflow-y: auto;">
						Select a person node to view/edit details
					</div>
				</div>
			</div>
		
			<!-- Notepad Area -->
			<div id="notepad-container" class="modern-dialog"
				style="display:none; position:absolute; top:60px; right:20px; width:20vw; height:60vh; z-index:1500; padding:0; flex-direction:column; resize:both; overflow:hidden;">
				<div class="dialog-header" id="notepad-header"
					style="padding:10px; margin:0; cursor:move; background:#f9f9f9; border-bottom:1px solid #eee;">
					<h2 style="font-size:16px;">Notepad</h2>
					<button id="notepad-close-x" class="close-x">&times;</button>
				</div>
				<div style="flex-grow:1; display:flex;">
					<textarea id="notepad-text"
						style="width:100%; height:100%; resize:none; border:none; padding:10px; box-sizing:border-box; font-family:inherit; outline:none; white-space: pre-wrap;"
						placeholder="Type notes about your search..."></textarea>
				</div>
			</div>
		
			<dialog id="predicate-modal" class="modern-dialog" style="min-width: 250px;">
				<div class="dialog-header">
					<h3 style="margin:0;">Select Relationship</h3>
				</div>
				<div class="dialog-body" style="margin-bottom: 20px;">
					<p>Relationship to <strong id="pred-target-name"></strong>:</p>
					<select id="pred-select" style="width: 100%; padding: 5px;">
						<option value="isParentOf">isParentOf</option>
						<option value="isSpouseOf">isSpouseOf</option>
						<option value="isChildOf">isChildOf</option>
						<option value="isSiblingOf">isSiblingOf</option>
						<option value="isUncleOf">isUncleOf</option>
						<option value="isAuntOf">isAuntOf</option>
						<option value="isNiblingOf">isNiblingOf</option>
						<option value="isCousinOf">isCousinOf</option>
						<option value="EnslavedBy">EnslavedBy</option>
					</select>
				</div>
				<div class="dialog-footer">
					<button id="pred-cancel">Cancel</button>
					<button id="pred-confirm" class="primary-btn">Confirm</button>
				</div>
			</dialog>
		
			<dialog id="add-node-modal" class="modern-dialog" style="min-width: 250px;">
				<div class="dialog-header">
					<h3 style="margin:0;">Add New Person</h3>
				</div>
				<div class="dialog-body" style="margin-bottom: 20px; text-align: center;">
					<p style="margin-bottom: 15px; font-size: 16px;">How is this new person related to <strong id="add-node-target-name"></strong>?</p>
					<div class="vpe-value-pill" style="position: relative; background: #E6F1FB; width: max-content; margin: 0 auto; padding: 12px 20px; border-radius: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
						<span class="vpe-chip" style="position: relative; color: #042C53; font-size: 18px; font-weight: 600;">
							<span id="add-node-select-display">is Child of</span>
							<select id="add-node-select" style="opacity:0; position:absolute; left:0; top:0; width:100%; height:100%; cursor:pointer; z-index:10;">
								<option value="isChildOf">is Child of</option>
								<option value="isCousinOf">is Cousin of</option>
								<option value="isMotherOf">is Mother of</option>
								<option value="isFatherOf">is Father of</option>
								<option value="isSiblingOf">is Sibling of</option>
								<option value="isSpouseOf">is Spouse of</option>
								<option value="isEnslaverOf">is Enslaver of</option>
								<option value="isDifferentFamily">in Different family</option>
							</select>
						</span>
					</div>
				</div>
				<div class="dialog-footer">
					<button id="add-node-cancel">Cancel</button>
					<button id="add-node-confirm" class="primary-btn">Add Person</button>
				</div>
			</dialog>

			<dialog id="save-tree-modal" class="modern-dialog" style="min-width: 300px;">
				<div class="dialog-header">
					<h3 style="margin:0;">Save Family Tree</h3>
				</div>
				<div class="dialog-body" style="margin-bottom: 20px;">
					<p style="margin-bottom: 10px;">Enter tree name:</p>
					<input type="text" id="save-tree-name-input" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" />
				</div>
				<div class="dialog-footer">
					<button id="save-tree-cancel">Cancel</button>
					<button id="save-tree-confirm" class="primary-btn">Save</button>
				</div>
			</dialog>

			<dialog id="load-tree-modal" class="modern-dialog" style="min-width: 300px;">
				<div class="dialog-header">
					<h3 style="margin:0;">Load Family Tree</h3>
				</div>
				<div class="dialog-body" style="margin-bottom: 20px;">
					<p style="margin-bottom: 10px;">Select a tree to load:</p>
					<select id="load-tree-select" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"></select>
				</div>
				<div class="dialog-footer">
					<button id="load-tree-cancel">Cancel</button>
					<button id="load-tree-confirm" class="primary-btn">Load</button>
				</div>
			</dialog>

			<dialog id="delete-tree-modal" class="modern-dialog" style="min-width: 300px;">
				<div class="dialog-header">
					<h3 style="margin:0;">Delete Family Tree</h3>
				</div>
				<div class="dialog-body" style="margin-bottom: 20px;">
					<p style="margin-bottom: 10px;">Select a tree to delete:</p>
					<select id="delete-tree-select" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"></select>
				</div>
				<div class="dialog-footer">
					<button id="delete-tree-cancel">Cancel</button>
					<button id="delete-tree-confirm" class="danger-btn">Delete</button>
				</div>
			</dialog>
		`);

		// Global this.state
		this.state = {
			nodes: [],
			triplets: [],
			selectedPid: null,
			notepad: "",
			notepadWidth: "20vw",
			notepadHeight: "60vh",
			notepadLeft: "",
			notepadTop: "60px"
		};

		// Undo/Redo Stacks
		this.undoStack = [];
		this.redoStack = [];

		// PID Counter
		this.pidCounter = 1;

		// Save/Load this.state
		this.isDirty = false;
		this.currentFilename = "untitled.ftree";
		this.currentPassword = null;
		this.currentEncryptedData = null;

		// State management

		// Bind keyboard shortcuts for Undo/Redo
		$(document).on('keydown', (e) => {
			// Ctrl+Z
			if (e.ctrlKey && e.key === 'z') {
				e.preventDefault();
				this.Undo();
				this.ApplyLayout();
				this.RenderNodes(); this.RenderEdges();
			}
			// Ctrl+Y
			if (e.ctrlKey && e.key === 'y') {
				e.preventDefault();
				this.Redo();
				this.ApplyLayout();
				this.RenderNodes(); this.RenderEdges();
			}
		});

		// Visibility Logic Map for Expand/Collapse states
		// Visibility Logic Map for Expand/Collapse states

		// Core Functions

		// Reciprocal removal of triplets

		// Global function to query triplets

		// Setup SVG
		this.svg = d3.select(".canvas-container")
			.append("svg")
			.attr("width", "100%")
			.attr("height", "100%")
			.style("display", "block");

		// Main group for this.zoom/pan
		this.gMain = this.svg.append("g");

		// Zoom and Pan behavior
		this.zoom = d3.zoom()
			.scaleExtent([0.1, 4])
			.on("zoom", (e) => {
				this.gMain.attr("transform", e.transform);
			});

		this.svg.call(this.zoom).on("dblclick.zoom", null);

		// Double-click background to clear current person
		this.svg.on("dblclick", (e) => {
			if (e.target.tagName === 'svg') {
				if (window.app && typeof window.app.selectNodeAndShowEditor === 'function') {
					window.app.selectNodeAndShowEditor(-1, 'person-editor-container');
				}
			}
		});

		// Click background to deselect
		this.svg.on("click", (e) => {
			if (e.target.tagName === 'svg') {
				this.state.selectedPid = null;
				this.UpdateNodeSelection();
			}
		});

		// Initialize layers: edges strictly BEFORE nodes so they sit behind!
		this.gEdges = this.gMain.append("g").attr("class", "edges-layer");
		this.gNodes = this.gMain.append("g").attr("class", "nodes-layer");

		// Node Dimensions
		this.nodeWidth = 160;
		this.nodeHeight = 116;

		// Path definitions for gender silhouettes
		this.femalePath = "M 34,49 A 16,16 0 0,1 66,49 A 16,16 0 0,1 34,49 Z M 35,65 L 15,100 L 85,100 L 65,65 Z";
		this.malePath = "M 34,49 A 16,16 0 0,1 66,49 A 16,16 0 0,1 34,49 Z M 15,100 A 35,35 0 0,1 85,100 Z";
		this.circlePath = "M 50, 50 m -40, 0 a 40,40 0 1,0 80,0 a 40,40 0 1,0 -80,0";
		this.squarePath = "M 31,30 H 69 A 16,16 0 0 1 85,46 V 84 A 16,16 0 0 1 69,100 H 31 A 16,16 0 0 1 15,84 V 46 A 16,16 0 0 1 31,30 Z";

		// Drag Behavior
		this.drag = d3.drag()
			.filter(function (e) {
				if (typeof this.linkMode !== 'undefined' && this.linkMode) return false;
				return !e.button;
			})
			.on("start", (e, d) => {
				d3.select(e.currentTarget).raise();
				this.state.selectedPid = d.person_id;
				this.UpdateNodeSelection();

				// Build list of all downstream descendants to this.drag along
				e.sourceEvent.stopPropagation();
				d.spouseSet = new Set();
				d.wasDragged = false;

				// Record immediate spouses
				this.state.triplets.forEach(t => {
					if (t.predicate === 'isSpouseOf') {
						if (t.subject === d.person_id) d.spouseSet.add(t.object);
						if (t.object === d.person_id) d.spouseSet.add(t.subject);
					}
				});

				if (!e.active && typeof simulation !== 'undefined') simulation.alphaTarget(0.3).restart();
			})
			.on("drag", (e, d) => {
				d.wasDragged = true;
				d.x += e.dx;
				d.y += e.dy;

				// Vertically align spouses (keep on the same horizontal plane)
				d.spouseSet.forEach(spid => {
					const spouseNode = this.GetNode(spid);
					if (spouseNode) {
						spouseNode.y = d.y;
					}
				});

				// Fast DOM update for all nodes uniformly
				this.gNodes.selectAll(".node-group").attr("transform", nd => `translate(${nd.x},${nd.y})`);
				this.RenderEdges();														// Update edges in real time dynamically
			})
			.on("end", (e, d) => {
				delete d.spouseSet;
				if (d.wasDragged) {
					d.moved = true;													// Mark as manually moved so layout doesn't override unconditionally
				} else {
					// It was a click (no dragging occurred)
					if (typeof this.linkMode !== 'undefined' && this.linkMode) {
						this.HandleLinkTargetClick(d.person_id);
					} else {
						this.SelectNodeAndShowEditor(d.person_id);
					}

				}
			});

		// Live synchronization helper

		// Layout and Edge rendering

		this.ClearAll();																	// Ensure clean this.state before injecting our persistent test data
		this.undoStack = [];																// clear test data from undo
		this.isDirty = false;

		// Dialog and Link variables
		this.linkMode = false;
		this.linkSourcePid = null;

		// jQuery Document Ready handlers
		$(document).ready(() => {
			this.RestoreNotepadSizeAndPosition();

			$('#menu-new').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (window.app && window.app.curTree) {
					if (confirm("Are you sure you want to create a new tree? This will clear all current persons and relationships.")) {
						window.app.curTree.persons = [];
						window.app.curTree.relationships = [];

						const newPid = this.GeneratePid();
						const newPerson = {
							person_id: newPid,
							mentions: [],
							anchor: null,
							first_name: null,
							middle_name: null,
							last_name: null,
							suffix: null,
							birth_year: null,
							death_year: null,
							gender: null,
							race: null,
							x: 200,
							y: 200,
							verity: 2
						};
						window.app.curTree.persons.push(newPerson);

						this.ClearAll();
						this.AddNode(newPerson);

						if (typeof window.app.rebuildAllRelationships === 'function') {
							window.app.rebuildAllRelationships();
						}

						this.ApplyLayout();
						this.RenderNodes();
						this.RenderEdges();
						this.SelectNodeAndShowEditor(newPid);
					}
				}
			});

			// Save Tree Handler
			$('#menu-save').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (window.app) {
					const curName = window.app.curTree.treeName || "Family";
					$('#save-tree-name-input').val(curName);
					document.getElementById('save-tree-modal').showModal();
				}
			});

			$('#save-tree-cancel').on('click', () => {
				document.getElementById('save-tree-modal').close();
			});

			$('#save-tree-confirm').on('click', async () => {
				const name = $('#save-tree-name-input').val().trim();
				if (!name) {
					alert('Please enter a valid tree name.');
					return;
				}
				document.getElementById('save-tree-modal').close();
				await window.app.saveTree(name);
				if (typeof Sound === 'function') Sound("ding");
				this.showToast(`Tree saved successfully as "${name}".`);
			});

			// Load Tree Handler
			$('#menu-load').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (window.app) {
					const trees = window.app.listTrees();
					if (trees.length === 0) {
						this.showToast('No saved trees found.', 3000);
						return;
					}
					const select = $('#load-tree-select');
					select.empty();
					trees.forEach(t => {
						select.append(`<option value="${t}">${t}</option>`);
					});
					if (trees.includes(window.app.curTree.treeName)) {
						select.val(window.app.curTree.treeName);
					}
					document.getElementById('load-tree-modal').showModal();
				}
			});

			$('#load-tree-cancel').on('click', () => {
				document.getElementById('load-tree-modal').close();
			});

			$('#load-tree-confirm').on('click', async () => {
				const name = $('#load-tree-select').val();
				document.getElementById('load-tree-modal').close();
				if (name) {
					const success = await window.app.loadTree(name);
					if (success) {
						if (typeof Sound === 'function') Sound("ding");
						this.showToast(`Tree "${name}" loaded successfully.`);
					} else {
						this.showToast(`Failed to load tree "${name}".`, 3500);
					}
				}
			});

			// Load Demo Handler
			$('#menu-load-demo').on('click', async (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (window.app) {
					const success = await window.app.loadDemo();
					if (success) {
						if (typeof Sound === 'function') Sound("ding");
						this.showToast("Demo tree loaded successfully!");
					} else {
						this.showToast("Failed to load demo tree.", 3500);
					}
				}
			});

			// Delete Tree Handler
			$('#menu-delete').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (window.app) {
					const trees = window.app.listTrees();
					if (trees.length === 0) {
						this.showToast('No saved trees found.', 3000);
						return;
					}
					const select = $('#delete-tree-select');
					select.empty();
					trees.forEach(t => {
						select.append(`<option value="${t}">${t}</option>`);
					});
					document.getElementById('delete-tree-modal').showModal();
				}
			});

			$('#delete-tree-cancel').on('click', () => {
				document.getElementById('delete-tree-modal').close();
			});

			$('#delete-tree-confirm').on('click', async () => {
				const name = $('#delete-tree-select').val();
				document.getElementById('delete-tree-modal').close();
				if (name) {
					if (confirm(`Are you sure you want to delete the tree "${name}"?`)) {
						await window.app.deleteTree(name);
						this.showToast(`Tree "${name}" has been deleted.`);
					}
				}
			});

			// JSON Import Handler
			$('#menu-import-json').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				const input = document.createElement('input');
				input.type = 'file';
				input.accept = '.json,application/json';
				input.onchange = (event) => {
					const file = event.target.files[0];
					if (!file) return;
					const reader = new FileReader();
					reader.onload = async (evt) => {
						try {
							const data = JSON.parse(evt.target.result);
							if (window.app) {
								const success = await window.app.loadTreeData(data);
								if (success) {
									if (typeof Sound === 'function') Sound("ding");
									this.showToast("JSON file imported successfully!");
								} else {
									this.showToast("Failed to import JSON file. Invalid tree format.", 3500);
								}
							}
						} catch (err) {
							console.error("JSON parse error:", err);
							alert("Failed to parse JSON file: " + err.message);
						}
					};
					reader.readAsText(file);
				};
				input.click();
			});

			// JSON Export Handler
			$('#menu-export-json').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (window.app && window.app.curTree) {
					const treeToExport = JSON.parse(JSON.stringify(window.app.curTree));
					treeToExport.relationships = [];
					const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(treeToExport, null, 4));
					const downloadAnchorNode = document.createElement('a');
					downloadAnchorNode.setAttribute("href", dataStr);
					downloadAnchorNode.setAttribute("download", (window.app.curTree.treeName || "tree") + "_json.json");
					document.body.appendChild(downloadAnchorNode);
					downloadAnchorNode.click();
					downloadAnchorNode.remove();

					if (typeof Sound === 'function') Sound("ding");
					this.showToast("JSON file saved successfully!");
				}
			});

			$('#menu-search-sources').on('click', (e) => {
				window.open('/verite/search', '_blank');
				$('.menu-top-level').removeClass('active');
				e.stopPropagation();
			});

			$('#menu-search-match').on('click', (e) => {
				window.open('/verite/match', '_blank');
				$('.menu-top-level').removeClass('active');
				e.stopPropagation();
			});

			// Handle top-level menu click to toggle dropdowns
			$('.menu-top-level').on('click', (e) => {
				// Determine if this is currently active before modifying siblings
				const isActive = $(e.currentTarget).hasClass('active');

				// Remove active from everywhere
				$('.menu-top-level').removeClass('active');

				// Toggle this one only if it wasn't active
				if (!isActive) {
					$(e.currentTarget).addClass('active');
				}

				// Prevent bubbling to document which closes menus
				e.stopPropagation();
			});

			// Prevent closing the menu when clicking on a dropdown item
			$('.dropdown').on('click', (e) => {
				// Here, normally you would execute the action for the clicked item.
				// We let it bubble up to document so it closes the menu, mimicking desktop behavior.
			});

			// Submenu mouseenter / mouseleave
			$('.has-submenu').on('mouseenter', (e) => {
				$(e.currentTarget).addClass('active-submenu');
			}).on('mouseleave', (e) => {
				$(e.currentTarget).removeClass('active-submenu');
			});

			// Close menus when clicking outside
			$(document).on('click', () => {
				$('.menu-top-level').removeClass('active');
			});

			// Re-apply layout on window resize
			$(window).on('resize', () => {
				this.ApplyLayout();
				this.RenderNodes();
				this.RenderEdges();
			});

			// Edit Menu Logic
			$('#menu-add-node').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (!this.state.selectedPid) {
					alert("Please select a node first to add a relative");
					return;
				}
				const targetNode = this.GetNode(this.state.selectedPid);
				if (!targetNode) return;
				document.getElementById("add-node-target-name").innerText = this.FormatNodeName(targetNode);
				document.getElementById("add-node-modal").dataset.sourcePid = this.state.selectedPid;
				document.getElementById("add-node-modal").showModal();
			});

			$('#menu-delete-node').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (!this.state.selectedPid) {
					alert("Please select a node first");
					return;
				}
				const n = this.GetNode(this.state.selectedPid);
				if (n && confirm('Are you sure you want to delete ' + this.FormatNodeName(n) + '?')) {
					this.DeleteNode(this.state.selectedPid);
					this.ApplyLayout(); this.RenderNodes(); this.RenderEdges();
					this.FitToScreen();
				}
			});

			$('#menu-undo').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (this.undoStack.length > 0) {
					this.Undo();
					this.ApplyLayout();
					this.RenderNodes(); this.RenderEdges();
				}
			});

			$('#menu-redo').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (this.redoStack.length > 0) {
					this.Redo();
					this.ApplyLayout();
					this.RenderNodes(); this.RenderEdges();
				}
			});

			// View Menu Logic
			$('#menu-zoom-in').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (typeof this.svg !== 'undefined' && typeof this.zoom !== 'undefined') {
					this.svg.transition().duration(250).call(this.zoom.scaleBy, 1.1);
				}
			});

			$('#menu-zoom-out').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (typeof this.svg !== 'undefined' && typeof this.zoom !== 'undefined') {
					this.svg.transition().duration(250).call(this.zoom.scaleBy, 0.9);
				}
			});

			$('#menu-fit-screen').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				this.FitToScreen();

			});

			$('#menu-reset-layout').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (this.state && this.state.nodes) {
					this.ResetLayout();
				}

			});

			$('#menu-toggle-notepad').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				const np = document.getElementById('notepad-container');
				if (np) {
					if (np.style.display === 'none' || !np.style.display) {
						this.OpenNotepad();
					} else {
						np.style.display = 'none';
					}
				}
			});

			$('#menu-help-docs').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				window.open('https://docs.google.com/document/d/1a7I7EOdWLTSjWXkSE67qL05oBj1nuTyhBj8EX1fg-QU', '_blank');
			});

			$('#notepad-close-x').on('click', () => {
				document.getElementById('notepad-container').style.display = 'none';
			});

			// Notepad Dragging Logic
			const npEl = document.getElementById('notepad-container');
			const npHeader = document.getElementById('notepad-header');
			if (npEl && npHeader) {
				let isDragging = false, startX, startY, startLeft, startTop;

				npHeader.addEventListener('mousedown', (e) => {
					if (e.target.tagName.toLowerCase() === 'button') return;
					isDragging = true;
					startX = e.clientX;
					startY = e.clientY;
					const rect = npEl.getBoundingClientRect();
					startLeft = rect.left;
					startTop = rect.top;
					npEl.style.right = 'auto';											// Disable right/bottom alignments to avoid flex issues on this.drag
					npEl.style.bottom = 'auto';
				});
				document.addEventListener('mousemove', (e) => {
					if (!isDragging) return;
					const dx = e.clientX - startX;
					const dy = e.clientY - startY;
					npEl.style.left = (startLeft + dx) + 'px';
					npEl.style.top = (startTop + dy) + 'px';
				});
				document.addEventListener('mouseup', () => {
					if (isDragging) {
						isDragging = false;
						this.state.notepadLeft = npEl.style.left;
						this.state.notepadTop = npEl.style.top;
						this.isDirty = true;
					}
				});

				// Observe resizing changes
				const ro = new ResizeObserver(entries => {
					for (let entry of entries) {
						if (npEl.style.display !== 'none') {
							this.state.notepadWidth = npEl.style.width || (entry.contentRect.width + 'px');
							this.state.notepadHeight = npEl.style.height || (entry.contentRect.height + 'px');
							this.isDirty = true;
						}
					}
				});
				ro.observe(npEl);
			}

			// Notepad Event Syncing
			const $npText = $('#notepad-text');
			if ($npText.length > 0) {
				const self = this;
				$npText.off('input.notepad blur.notepad');
				$npText.on('input.notepad', function (e) {
					const val = $(this).val();
					if (self && self.state) {
						self.state.notepad = val;
						self.isDirty = true;
					}
					if (window.app && window.app.curTree) {
						window.app.curTree.notepad = val;
					}
				});
				$npText.on('blur.notepad', function () {
					if (self && typeof self.SaveState === 'function') {
						self.SaveState();
					}
					if (window.app && window.app.curTree) {
						window.app.curTree.notepad = (self && self.state && self.state.notepad !== undefined) ? self.state.notepad : ($(this).val() || "");
						if (window.app.curTree.treeName && typeof window.app.saveTree === 'function') {
							window.app.saveTree(window.app.curTree.treeName);
						}
					}
				});
			}


			// Add-node-modal listeners
			document.getElementById("add-node-cancel").addEventListener("click", () => {
				document.getElementById("add-node-modal").close();
			});

			document.getElementById("add-node-select").addEventListener("change", (e) => {
				const select = e.target;
				document.getElementById("add-node-select-display").innerText = select.options[select.selectedIndex].text;
			});

			document.getElementById("add-node-confirm").addEventListener("click", () => {
				const sourcePid = document.getElementById("add-node-modal").dataset.sourcePid;
				let relation = document.getElementById("add-node-select").value;
				document.getElementById("add-node-modal").close();
				let newGender = "", newBirth = "";

				if (sourcePid && relation) {
					// One snapshot for the whole "add person" action (new node + every relationship
					// triplet it creates) so a single Ctrl+Z reverts it atomically, instead of only
					// undoing the last triplet and leaving the node half-connected.
					this.SaveState();

					const sourceNode = this.GetNode(sourcePid);
					const newPid = this.GeneratePid();
					let newX = sourceNode ? sourceNode.x : 0;
					let newY = sourceNode ? sourceNode.y : 0;

					if (relation == 'isMotherOf') {
						relation = 'isParentOf';
						newGender = "F";
						if (sourceNode.birth_year) {
							newBirth = ("" + sourceNode.birth_year).split(":")[0] - 0;
							newBirth = (newBirth - 45) + "-" + (newBirth - 0 + 10);
						}
					} else if (relation == 'isFatherOf') {
						relation = 'isParentOf';
						newGender = "M"
						if (sourceNode.birth_year) {
							newBirth = ("" + sourceNode.birth_year).split(":")[0] - 0;
							newBirth = (newBirth - 75) + "-" + (newBirth + 10);
						}
					}

					if (relation === 'isChildOf') {
						const spouses = this.state.triplets.filter(t => t.predicate === 'isSpouseOf' && (t.subject === sourcePid || t.object === sourcePid));
						if (spouses.length > 0) {
							const spouseId = spouses[0].subject === sourcePid ? spouses[0].object : spouses[0].subject;
							const spouseNode = this.GetNode(spouseId);
							if (spouseNode) {
								newX = (sourceNode.x + spouseNode.x) / 2;
							}
						}
						newY += 250;
					} else if (relation === 'isParentOf') {
						newX += 0; newY -= 250;
					} else if (relation === 'isSiblingOf') {
						newX += 250; newY += 0;
					} else if (relation === 'isCousinOf') {
						newX += 300; newY += 0;
					} else if (relation === 'isSpouseOf') {
						newX += 200; newY += 0;
					} else if (relation === 'isDifferentFamily') {
						newX += 400; newY += 200;
					} else if (relation === 'isEnslaverOf') {
						let topNode = sourceNode;
						const connectedPids = new Set([sourcePid]);
						let changed = true;
						while (changed) {
							changed = false;
							this.state.triplets.forEach(t => {
								if (connectedPids.has(t.subject) && !connectedPids.has(t.object)) {
									connectedPids.add(t.object);
									changed = true;
								}
								if (connectedPids.has(t.object) && !connectedPids.has(t.subject)) {
									connectedPids.add(t.subject);
									changed = true;
								}
							});
						}
						connectedPids.forEach(pid => {
							const node = this.GetNode(pid);
							if (node && node.y < topNode.y) {
								topNode = node;
							}
						});
						newX = topNode.x;
						newY = topNode.y - 250;
					}

					const newNodeInfo = {
						person_id: newPid,
						anchor: (sourcePid && relation && relation !== 'isDifferentFamily') ? `${relation}:${sourcePid}` : null,
						first_name: '',
						last_name: (sourceNode && relation !== 'isDifferentFamily' && relation !== 'isEnslaverOf') ? (sourceNode.last_name || '') : '',
						gender: newGender,
						birth_year: newBirth,
						x: newX,
						y: newY,
						isEnslaver: relation === 'isEnslaverOf',
						color: undefined,
						fillColor: undefined,
						moved: true
					};

					if (sourceNode && relation !== 'isDifferentFamily' && relation !== 'isEnslaverOf') {
						newNodeInfo.linked_persons = sourceNode.linked_persons ? JSON.parse(JSON.stringify(sourceNode.linked_persons)) : [];

						// Add the source node's formal relatives as plain text
						if (window.app && window.app.curTree && window.app.curTree.relationships) {
							const parentRels = window.app.curTree.relationships.filter(r => r.subject_id === sourceNode.person_id);
							parentRels.forEach(r => {
								let objPerson = null;
								if (Array.isArray(window.app.curTree.persons)) {
									objPerson = window.app.curTree.persons.find(p => p.person_id === r.object_id);
								} else {
									objPerson = window.app.curTree.persons[r.object_id];
								}

								if (objPerson) {
									const fname = (objPerson.first_name || '').split(':')[0];
									const mname = (objPerson.middle_name || '').split(':')[0];
									const lname = (objPerson.last_name || '').split(':')[0];
									const fullName = [fname, mname, lname].filter(Boolean).join(' ').trim() || r.object_id;

									const sourceName = (sourceNode.first_name || '').split(':')[0] || sourceNode.person_id;

									// Avoid duplicates
									const existing = newNodeInfo.linked_persons.find(lp => lp.value === fullName);
									if (!existing) {
										newNodeInfo.linked_persons.push({
											value: fullName,
											source: `Relative of ${sourceName}`
										});
									}
								}
							});
						}
					}
					const newNode = this.AddNode(newNodeInfo, false, true);

					if (relation === 'isChildOf') {
						this.AddTriplet(newPid, 'isChildOf', sourcePid, true);
						const spouses = this.state.triplets.filter(t => t.predicate === 'isSpouseOf' && (t.subject === sourcePid || t.object === sourcePid));
						spouses.forEach(t => {
							const spousePid = t.subject === sourcePid ? t.object : t.subject;
							this.AddTriplet(newPid, 'isChildOf', spousePid, true);
						});

						// Connect to existing siblings
						const siblings = this.state.triplets
							.filter(t => t.predicate === 'isChildOf' && t.object === sourcePid && t.subject !== newPid)
							.map(t => t.subject);
						siblings.forEach(siblingPid => {
							this.AddTriplet(newPid, 'isSiblingOf', siblingPid, true);
						});
					} else if (relation === 'isParentOf') {
						this.AddTriplet(sourcePid, 'isChildOf', newPid, true);
					} else if (relation === 'isSiblingOf') {
						this.AddTriplet(newPid, 'isSiblingOf', sourcePid, true);

						// Connect the new sibling to all known parents of the source node
						const parents = new Set();
						this.state.triplets.forEach(t => {
							if (t.predicate === 'isChildOf' && t.subject === sourcePid) {
								parents.add(t.object);
							}
							if (t.predicate === 'isParentOf' && t.object === sourcePid) {
								parents.add(t.subject);
							}
						});
						if (window.app && window.app.curTree && Array.isArray(window.app.curTree.relationships)) {
							window.app.curTree.relationships.forEach(r => {
								if (r.predicate === 'isChildOf' && r.subject_id === sourcePid) parents.add(r.object_id);
								if (r.predicate === 'isParentOf' && r.object_id === sourcePid) parents.add(r.subject_id);
							});
						}
						if (sourceNode && sourceNode.anchor && sourceNode.anchor.startsWith('isChildOf:')) {
							parents.add(sourceNode.anchor.split(':')[1]);
						}

						parents.forEach(parentPid => {
							this.AddTriplet(newPid, 'isChildOf', parentPid, true);
							if (window.app && window.app.curTree && Array.isArray(window.app.curTree.relationships)) {
								const pRel = { subject_id: newPid, predicate: 'isChildOf', object_id: parentPid };
								if (!window.app.curTree.relationships.some(r => r.subject_id === pRel.subject_id && r.predicate === pRel.predicate && r.object_id === pRel.object_id)) {
									window.app.curTree.relationships.push(pRel);
								}
							}

							const spouses = this.state.triplets.filter(t => t.predicate === 'isSpouseOf' && (t.subject === parentPid || t.object === parentPid));
							spouses.forEach(t => {
								const spousePid = t.subject === parentPid ? t.object : t.subject;
								this.AddTriplet(newPid, 'isChildOf', spousePid, true);
							});
						});

						if (parents.size > 0 && newNode) {
							newNode.anchor = `isChildOf:${Array.from(parents)[0]}`;
						}
					} else if (relation === 'isSpouseOf') {
						this.AddTriplet(newPid, 'isSpouseOf', sourcePid, true);
					} else if (relation === 'isCousinOf') {
						this.AddTriplet(newPid, 'isCousinOf', sourcePid, true);
					} else if (relation === 'isEnslaverOf') {
						this.AddTriplet(newPid, 'isEnslaverOf', sourcePid, true);
					}

					if (window.app && window.app.curTree) {
						if (!Array.isArray(window.app.curTree.relationships)) {
							window.app.curTree.relationships = [];
						}
						const relObj = {
							subject_id: newPid,
							predicate: relation,
							object_id: sourcePid
						};
						const exists = window.app.curTree.relationships.some(
							r => r.subject_id === relObj.subject_id && r.predicate === relObj.predicate && r.object_id === relObj.object_id
						);
						if (!exists) {
							window.app.curTree.relationships.push(relObj);
						}
						if (typeof window.app.rebuildAllRelationships === 'function') {
							window.app.rebuildAllRelationships();
						}
					}

					this.RenderNodes(); this.RenderEdges();

					// after the person has been added to the tree and placed, call the reset layout function
					this.ResetLayout();

					this.SelectNodeAndShowEditor(newPid);

				}
			});


			// Splitter Resizing Interaction logic
			const splitDivider = document.getElementById('divider');
			const workspace = document.querySelector('.main-workspace');
			const canvasContainer = document.querySelector('.canvas-container');
			const detailsPanel = document.querySelector('.matching-module-placeholder');

			if (splitDivider && workspace && canvasContainer && detailsPanel) {
				let isResizing = false;

				const getClientX = (evt) => {
					if (evt.touches && evt.touches.length > 0) {
						return evt.touches[0].clientX;
					}
					return evt.clientX;
				};

				const startResize = () => {
					isResizing = true;
					splitDivider.classList.add('active');
					document.body.style.cursor = 'col-resize';
					document.body.style.userSelect = 'none';
				};

				const updateResize = (evt) => {
					if (!isResizing) return;
					const clientX = getClientX(evt);
					const offsetLeft = workspace.getBoundingClientRect().left;
					const totalWidth = workspace.clientWidth;
					let pointerX = clientX - offsetLeft;

					// Boundary constraints: 15% to 85%
					const minWidth = totalWidth * 0.15;
					const maxWidth = totalWidth * 0.85;
					if (pointerX < minWidth) pointerX = minWidth;
					if (pointerX > maxWidth) pointerX = maxWidth;

					const leftPercent = (pointerX / totalWidth) * 100;
					const rightPercent = 100 - leftPercent;

					canvasContainer.style.width = `${leftPercent}%`;
					detailsPanel.style.width = `calc(${rightPercent}% - 6px)`;

					// Recenter and fit the D3 canvas tree instantly as the divider is dragged
					this.FitToScreen(0);
				};

				const stopResize = () => {
					if (isResizing) {
						isResizing = false;
						splitDivider.classList.remove('active');
						document.body.style.cursor = 'default';
						document.body.style.userSelect = 'auto';

						// Smoothly settle the tree position once dragging is finished
						this.FitToScreen(200);
					}
				};

				// Mouse events
				splitDivider.addEventListener('mousedown', (e) => {
					startResize();
				});

				document.addEventListener('mousemove', (e) => {
					if (isResizing) updateResize(e);
				});

				document.addEventListener('mouseup', () => {
					stopResize();
				});

				// Touch events (mobile & tablet touchscreens)
				splitDivider.addEventListener('touchstart', (e) => {
					startResize();
					if (e.cancelable) e.preventDefault();
				}, { passive: false });

				document.addEventListener('touchmove', (e) => {
					if (isResizing) {
						updateResize(e);
						if (e.cancelable) e.preventDefault();
					}
				}, { passive: false });

				document.addEventListener('touchend', () => {
					stopResize();
				});

				document.addEventListener('touchcancel', () => {
					stopResize();
				});
			}

			// Apply automatic hierarchical layout and initial draw on load
			this.ApplyLayout();
			this.RenderNodes();
			this.RenderEdges();
			this.FitToScreen(0);
			if (this.state.nodes && this.state.nodes.length > 0) {
				this.SelectNodeAndShowEditor(this.state.nodes[0].person_id);
			}
		});

	}

	OpenNotepad()																		// OPEN NOTEPAD & SYNC FROM CURTREE
	{
		const np = document.getElementById('notepad-container');
		if (np) {
			if (window.app && window.app.curTree && window.app.curTree.notepad !== undefined) {
				const content = window.app.curTree.notepad || "";
				this.state.notepad = content;
				const npText = document.getElementById("notepad-text");
				if (npText) npText.value = content;
			}
			np.style.display = 'flex';
		}
	}

	RestoreNotepadSizeAndPosition()																		// RESTORE NOTEPAD SIZE AND POSITION
	{

		const npEl = document.getElementById('notepad-container');
		if (npEl && this.state) {
			if (this.state.notepadWidth) npEl.style.width = this.state.notepadWidth;
			if (this.state.notepadHeight) npEl.style.height = this.state.notepadHeight;
			if (this.state.notepadLeft) {
				npEl.style.left = this.state.notepadLeft;
				npEl.style.right = 'auto';
			}
			if (this.state.notepadTop) {
				npEl.style.top = this.state.notepadTop;
				npEl.style.bottom = 'auto';
			}
		}
	}

	UpdateUndoRedoMenu()																		// UPDATE UNDO REDO MENU
	{

		const undoEl = document.getElementById('menu-undo');
		const redoEl = document.getElementById('menu-redo');
		if (undoEl) {
			undoEl.style.color = this.undoStack.length > 0 ? '#000' : '#ccc';
			undoEl.style.pointerEvents = this.undoStack.length > 0 ? 'auto' : 'none';
		}
		if (redoEl) {
			redoEl.style.color = this.redoStack.length > 0 ? '#000' : '#ccc';
			redoEl.style.pointerEvents = this.redoStack.length > 0 ? 'auto' : 'none';
		}
	}

	showToast(message, duration = 2500) {
		let $toast = $('#verite-toast-notification');
		if ($toast.length === 0) {
			$toast = $(`
				<div id="verite-toast-notification" style="
					position: fixed;
					bottom: 24px;
					right: 24px;
					background: #26215C;
					color: #ffffff;
					padding: 10px 20px;
					border-radius: 8px;
					font-size: 14px;
					font-weight: 500;
					box-shadow: 0 4px 14px rgba(0,0,0,0.2);
					z-index: 10000;
					display: flex;
					align-items: center;
					gap: 8px;
					transition: opacity 0.3s ease, transform 0.3s ease;
					opacity: 0;
					transform: translateY(12px);
					pointer-events: none;
				"></div>
			`).appendTo('body');
		}

		$toast.html(`<i class="ti ti-check" style="font-size:16px; color:#4ade80;"></i> ${message}`);
		$toast.css({ opacity: 1, transform: 'translateY(0)' });

		if (this._toastTimer) clearTimeout(this._toastTimer);
		this._toastTimer = setTimeout(() => {
			$toast.css({ opacity: 0, transform: 'translateY(12px)' });
		}, duration);
	}

	SaveState()																		// SAVE STATE TO UNDO STACK
	{

		// Deep copy using JSON (safe since our data is simple JS objects)
		const safeReplacer = (k, v) => (k && k.startsWith('_cached') ? undefined : v);
		this.undoStack.push(JSON.parse(JSON.stringify(this.state, safeReplacer)));
		this.redoStack = [];															// Clear redo stack on new action
		this.UpdateUndoRedoMenu();
	}

	Undo()																		// UNDO STATE
	{

		if (this.undoStack.length > 0) {
			const safeReplacer = (k, v) => (k && k.startsWith('_cached') ? undefined : v);
			this.redoStack.push(JSON.parse(JSON.stringify(this.state, safeReplacer)));
			this.state = this.undoStack.pop();
			this.UpdateUndoRedoMenu();
			if (document.getElementById("notepad-text")) document.getElementById("notepad-text").value = this.state.notepad || "";
			if (window.app && window.app.curTree) window.app.curTree.notepad = this.state.notepad || "";
			this.isDirty = true;
		}
	}

	Redo()																		// REDO STATE
	{

		if (this.redoStack.length > 0) {
			const safeReplacer = (k, v) => (k && k.startsWith('_cached') ? undefined : v);
			this.undoStack.push(JSON.parse(JSON.stringify(this.state, safeReplacer)));
			this.state = this.redoStack.pop();
			this.UpdateUndoRedoMenu();
			if (document.getElementById("notepad-text")) document.getElementById("notepad-text").value = this.state.notepad || "";
			if (window.app && window.app.curTree) window.app.curTree.notepad = this.state.notepad || "";
			this.isDirty = true;
		}
	}

	GetVisibleNodes()																		// GET LIST OF VISIBLE NODES
	{

		const visible = new Set(this.state.nodes.map(n => n.person_id));

		const hideDirection = (pid, dir) => {
			const queue = [];
			this.state.triplets.forEach(t => {
				if (dir === 'down') {
					if (t.subject === pid && t.predicate === 'isParentOf') queue.push(t.object);
					if (t.object === pid && t.predicate === 'isChildOf') queue.push(t.subject);
				} else if (dir === 'up') {
					if (t.object === pid && t.predicate === 'isParentOf') queue.push(t.subject);
					if (t.subject === pid && t.predicate === 'isChildOf') queue.push(t.object);
				} else if (dir === 'right' || dir === 'left') {
					if (t.subject === pid && t.predicate === 'isSpouseOf') {
						const other = this.GetNode(t.object);
						const me = this.GetNode(pid);
						if (other && me) {
							if (dir === 'right' && other.x > me.x) queue.push(t.object);
							if (dir === 'left' && other.x < me.x) queue.push(t.object);
						}
					}
				}
			});

			const hideDescendants = (cpid) => {
				if (visible.has(cpid)) {
					visible.delete(cpid);
					this.state.triplets.forEach(t => {
						if (t.subject === cpid && t.predicate === 'isParentOf') hideDescendants(t.object);
						if (t.object === cpid && t.predicate === 'isChildOf') hideDescendants(t.subject);
						if (t.subject === cpid && t.predicate === 'isSpouseOf') hideDescendants(t.object);
					});
				}
			};

			const hideAncestors = (cpid) => {
				if (visible.has(cpid)) {
					visible.delete(cpid);
					this.state.triplets.forEach(t => {
						if (t.object === cpid && t.predicate === 'isParentOf') hideAncestors(t.subject);
						if (t.subject === cpid && t.predicate === 'isChildOf') hideAncestors(t.object);
						if (t.subject === cpid && t.predicate === 'isSpouseOf') hideAncestors(t.object);
					});
				}
			};

			queue.forEach(targetPid => {
				if (dir === 'down') hideDescendants(targetPid);
				else if (dir === 'up') hideAncestors(targetPid);
				else hideAncestors(targetPid);									// For spouses, hiding their ancestral line is safe
			});
		};

		this.state.nodes.forEach(n => {
			if (n.hiddenDirs) {
				if (n.hiddenDirs.bottom) hideDirection(n.person_id, 'down');
				if (n.hiddenDirs.top) hideDirection(n.person_id, 'up');
				if (n.hiddenDirs.right) hideDirection(n.person_id, 'right');
				if (n.hiddenDirs.left) hideDirection(n.person_id, 'left');
			}
		});
		return visible;
	}

	GeneratePid()																		// GENERATE UNIQUE PID
	{

		let newPid;
		do {
			newPid = "P" + String(this.pidCounter).padStart(3, '0');
			this.pidCounter++;
		} while (this.GetNode(newPid) !== null);
		return newPid;
	}

	ClearAll()																		// CLEAR ALL NODES AND TRIPLETS
	{

		this.SaveState();
		this.state = {
			nodes: [],
			triplets: [],
			selectedPid: null,
			notepad: ""
		};
		this.pidCounter = 1;
		if (document.getElementById("notepad-text")) {
			document.getElementById("notepad-text").value = "";
		}
		this.isDirty = true;
	}

	AddNode(fields, resetLayout = true, skipSave = false)																		// ADD PERSON NODE TO STATE
	{

		if (!skipSave) this.SaveState();
		const pid = fields.person_id || this.GeneratePid();
		const newNode = {
			person_id: pid,
			anchor: fields.anchor !== undefined ? fields.anchor : null,
			first_name: fields.first_name || "",
			middle_name: fields.middle_name || "",
			norm_first_name: fields.norm_first_name || "",
			last_name: fields.last_name || "",
			nysiis_last_name: fields.nysiis_last_name || "",
			metaphone_last_name: fields.metaphone_last_name || "",
			suffix: fields.suffix || "",
			race: fields.race || "",
			gender: fields.gender || "male",
			birth_year: fields.birth_year !== undefined ? fields.birth_year : null,
			death_year: fields.death_year !== undefined ? fields.death_year : null,
			confidence: fields.confidence !== undefined ? fields.confidence : 1,
			mentions: fields.mentions || [],
			linked_persons: fields.linked_persons || [],
			enslaved: fields.enslaved || false,									// kept for node color/tan styling
			isEnslaver: fields.isEnslaver !== undefined ? Boolean(fields.isEnslaver) : false,
			color: fields.color,
			fillColor: fields.fillColor,

			// Canvas layout properties
			x: fields.x !== undefined ? fields.x : 0,
			y: fields.y !== undefined ? fields.y : 0,
			moved: fields.moved || false,
			expanded: true,
			hiddenDirs: { top: false, bottom: false, left: false, right: false }
		};
		this.state.nodes.push(newNode);
		this.isDirty = true;

		// Sync with backend data representation
		if (window.app && window.app.curTree && window.app.curTree.persons) {
			let personCollection = window.app.curTree.persons;
			let existingAppNode = null;

			if (Array.isArray(personCollection)) {
				existingAppNode = personCollection.find(p => p.person_id === newNode.person_id);
				if (!existingAppNode) {
					existingAppNode = Object.assign({}, newNode);
					existingAppNode.linked_persons = newNode.linked_persons ? JSON.parse(JSON.stringify(newNode.linked_persons)) : [];
					personCollection.push(existingAppNode);
				} else {
					existingAppNode.isEnslaver = newNode.isEnslaver;
				}
			} else {
				existingAppNode = personCollection[newNode.person_id];
				if (!existingAppNode) {
					existingAppNode = Object.assign({}, newNode);
					existingAppNode.linked_persons = newNode.linked_persons ? JSON.parse(JSON.stringify(newNode.linked_persons)) : [];
					personCollection[newNode.person_id] = existingAppNode;
				} else {
					existingAppNode.isEnslaver = newNode.isEnslaver;
				}
			}

		}

		if (window.app && typeof window.app.rebuildAllRelationships === 'function') {
			window.app.rebuildAllRelationships();
		}

		if (resetLayout) {
			this.ResetLayout();
		}

		return newNode;
	}

	AddTriplet(subject, predicate, object, skipSave = false)																		// ADD RELATIONSHIP TRIPLET
	{
		if (!skipSave) this.SaveState();
		if (!this.state.triplets.some(t => t.subject === subject && t.predicate === predicate && t.object === object)) {
			this.state.triplets.push({ subject, predicate, object });
		}
	}

	DeleteNode(pid)																		// DELETE PERSON NODE AND DESCENDANTS
	{

		this.SaveState();

		const toDelete = new Set([pid]);
		const queue = [pid];

		// Find all downstream descendants
		while (queue.length > 0) {
			const current = queue.shift();
			this.state.triplets.forEach(t => {
				if (t.predicate === 'isParentOf' && t.subject === current) {
					if (!toDelete.has(t.object)) {
						toDelete.add(t.object);
						queue.push(t.object);
					}
				}
				if (t.predicate === 'isChildOf' && t.object === current) {
					if (!toDelete.has(t.subject)) {
						toDelete.add(t.subject);
						queue.push(t.subject);
					}
				}
			});
		}

		// Remove nodes
		this.state.nodes = this.state.nodes.filter(n => !toDelete.has(n.person_id));
		// Remove triplets where any deleted node is subject or object
		this.state.triplets = this.state.triplets.filter(t => !toDelete.has(t.subject) && !toDelete.has(t.object));

		// Sync with app.curTree
		if (window.app && window.app.curTree && window.app.curTree.persons) {
			if (Array.isArray(window.app.curTree.persons)) {
				window.app.curTree.persons = window.app.curTree.persons.filter(p => !toDelete.has(p.person_id));
			} else {
				toDelete.forEach(deletedId => {
					delete window.app.curTree.persons[deletedId];
				});
			}
		}

		if (toDelete.has(this.state.selectedPid)) {
			this.state.selectedPid = null;
		}
		this.isDirty = true;

		if (window.app && typeof window.app.rebuildAllRelationships === 'function') {
			window.app.rebuildAllRelationships();
		}
	}

	GetNode(pid)																		// GET NODE BY PID
	{

		return this.state.nodes.find(n => n.person_id === pid) || null;
	}

	GetGenderPath(gender, isEnslaver = false)																		// GET SILHOUETTE PATH BY GENDER
	{

		if (isEnslaver) return this.squarePath;
		if (!gender) return this.circlePath;
		const g = gender.split(':')[0].toLowerCase();
		if (g === 'female' || g === 'f') return this.femalePath;
		if (g === 'male' || g === 'm') return this.malePath;
		return this.circlePath;
	}

	FormatNodeName(d)																		// FORMAT FULL NAME FOR NODE
	{

		const toTitleCase = (str) => {
			if (!str) return "";
			return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
		};
		const clean = (s) => {
			if (!s) return "";
			const val = String(s).split(':')[0].trim();
			return val.toLowerCase() === 'click to set' ? "" : val;
		};
		const fn = clean(d.first_name);
		const mn = clean(d.middle_name);
		const ln = clean(d.last_name);
		let parts = [];
		if (fn) parts.push(toTitleCase(fn));
		if (mn) parts.push(toTitleCase(mn));
		if (ln) parts.push(toTitleCase(ln));
		if (parts.length > 0) return parts.join(" ");
		const rawFull = clean(d.full_name);
		return rawFull ? toTitleCase(rawFull) : "?";
	}

	SyncEditorToNode(node)																		// SYNC PERSON EDITOR FIELDS TO NODE
	{

		const container = $('#person-editor-container');
		if (!container.length) return;

		container.find('.vpe-row').each(function () {
			const label = $(this).find('.vpe-field-label').text().trim().toLowerCase();
			const $chip = $(this).find('.vpe-chip').clone();
			$chip.children('select').remove(); // Exclude the dropdown options text
			let val = $chip.text().trim() || null;
			if (val && val.toLowerCase() === 'click to set') {
				val = null;
			}

			if (label === 'first name') node.first_name = val || "";
			else if (label === 'middle name') node.middle_name = val || "";
			else if (label === 'last name') node.last_name = val || "";
			else if (label === 'nick name') node.norm_first_name = val || "";
			else if (label === 'suffix') node.suffix = val || "";
			else if (label === 'race') node.race = val || "";
			else if (label === 'gender') node.gender = val || "male";
			else if (label === 'birth year') node.birth_year = (val && !isNaN(parseInt(val, 10))) ? parseInt(val, 10) : null;
			else if (label === 'death year') node.death_year = (val && !isNaN(parseInt(val, 10))) ? parseInt(val, 10) : null;
		});

		// Re-render tree nodes and edges
		this.RenderNodes();
		this.RenderEdges();
	}

	RenderNodes()																		// RENDER NODE GROUPS
	{

		// Bind data mapped against visibility
		const visibleSet = this.GetVisibleNodes();
		const vNodes = this.state.nodes.filter(n => visibleSet.has(n.person_id));

		const nodeSelection = this.gNodes.selectAll(".node-group")
			.data(vNodes, d => d.person_id);

		// Enter selection
		const nodeEnter = nodeSelection.enter()
			.append("g")
			.attr("class", "node-group")
			.attr("transform", d => `translate(${d.x},${d.y})`)
			.on("dblclick", (e, d) => {
				e.stopPropagation();
				this.SelectNodeAndShowEditor(d.person_id, "person-editor-container");
			})
			.call(this.drag);

		// 1. Background Shape (Gendered Silhouette / Enslaver Rounded Square)
		nodeEnter.append("path")
			.attr("class", "node-bg")
			.attr("d", d => this.GetGenderPath(d.gender, d.isEnslaver))
			.attr("transform", "translate(22, 0) scale(1.16)")
			.attr("fill", d => d.isEnslaver ? "#ffe0b2" : (d.color || d.fillColor || d.interiorColor || "#ffe0b2"))
			.attr("stroke", "#999999")
			.attr("stroke-width", 3)
			.attr("stroke-linejoin", "round")
			.attr("stroke-linecap", "round");

		// 3. Name Label
		nodeEnter.append("text")
			.attr("class", "node-name")
			.attr("x", this.nodeWidth / 2)
			.attr("y", 135)
			.attr("text-anchor", "middle")
			.attr("font-weight", "bold")
			.attr("font-size", "12px")
			.attr("fill", "#000099")
			.text(d => this.FormatNodeName(d));

		// 4. Year range
		nodeEnter.append("text")
			.attr("class", "node-years")
			.attr("x", this.nodeWidth / 2)
			.attr("y", 110)
			.attr("text-anchor", "middle")
			.attr("font-size", "10px")
			.attr("fill", "#000")
			.text(d => {
				const by = d.birth_year ? String(d.birth_year).split(':')[0] : "?";
				const dy = d.death_year ? String(d.death_year).split(':')[0] : "?";
				return d.death_year ? `${by} – ${dy}` : by;
			});



		// 6. Expand/Collapse triangles
		const trianglesGroup = nodeEnter.append("g").attr("class", "triangles");

		trianglesGroup.append("polygon")
			.attr("class", "tri-right")
			.attr("points", "0,-5 10,0 0,5")
			.attr("transform", `translate(${this.nodeWidth - 10}, ${this.nodeHeight / 2})`)
			.attr("fill", "#999")
			.style("display", "none")
			.on("mousedown", e => e.stopPropagation())
			.on("click touchend", (e, d) => {
				e.stopPropagation();
				if (e.type === 'touchend') e.preventDefault();
				d.hiddenDirs = d.hiddenDirs || { top: false, bottom: false, left: false, right: false };
				d.hiddenDirs.right = !d.hiddenDirs.right;
				this.ApplyLayout(); this.RenderNodes(); this.RenderEdges();
			});

		trianglesGroup.append("polygon")
			.attr("class", "tri-left")
			.attr("points", "10,-5 0,0 10,5")
			.attr("transform", `translate(10, ${this.nodeHeight / 2})`)
			.attr("fill", "#999")
			.style("display", "none")
			.on("mousedown", e => e.stopPropagation())
			.on("click touchend", (e, d) => {
				e.stopPropagation();
				if (e.type === 'touchend') e.preventDefault();
				d.hiddenDirs = d.hiddenDirs || { top: false, bottom: false, left: false, right: false };
				d.hiddenDirs.left = !d.hiddenDirs.left;
				this.ApplyLayout(); this.RenderNodes(); this.RenderEdges();
			});

		trianglesGroup.append("polygon")
			.attr("class", "tri-bottom")
			.attr("points", "-5,5 5,5 0,-5")
			.attr("transform", `translate(${this.nodeWidth / 2}, 87)`)
			.attr("fill", "#999")
			.style("display", "none")
			.style("cursor", "pointer")
			.on("mousedown", e => e.stopPropagation())
			.on("click touchend", (e, d) => {
				e.stopPropagation();
				if (e.type === 'touchend') e.preventDefault();
				d.hiddenDirs = d.hiddenDirs || { top: false, bottom: false, left: false, right: false };
				d.hiddenDirs.bottom = !d.hiddenDirs.bottom;
				this.ApplyLayout(); this.RenderNodes(); this.RenderEdges();
			})
			.append("title")
			.text("Collapse / Expand Children");

		trianglesGroup.append("polygon")
			.attr("class", "tri-top")
			.attr("points", "-5,5 5,5 0,-5")
			.attr("transform", `translate(${this.nodeWidth / 2}, 8)`)
			.attr("fill", "#999")
			.style("display", "none")
			.on("mousedown", e => e.stopPropagation())
			.on("click touchend", (e, d) => {
				e.stopPropagation();
				if (e.type === 'touchend') e.preventDefault();
				d.hiddenDirs = d.hiddenDirs || { top: false, bottom: false, left: false, right: false };
				d.hiddenDirs.top = !d.hiddenDirs.top;
				this.ApplyLayout(); this.RenderNodes(); this.RenderEdges();
			});

		const nodeUpdate = nodeSelection.merge(nodeEnter);
		nodeUpdate.attr("transform", d => `translate(${d.x},${d.y})`);

		// Update core node editable data elements
		nodeUpdate.select(".node-name").text(d => this.FormatNodeName(d));
		nodeUpdate.select(".node-years").text(d => {
			const by = d.birth_year ? String(d.birth_year).split(':')[0] : "?";
			const dy = d.death_year ? String(d.death_year).split(':')[0] : "?";
			return d.death_year ? `${by} – ${dy}` : by;
		});
		nodeUpdate.select(".node-bg")
			.attr("d", d => this.GetGenderPath(d.gender, d.isEnslaver))
			.attr("fill", d => d.isEnslaver ? "#ffe0b2" : (d.color || d.fillColor || d.interiorColor || "#ffe0b2"));

		nodeUpdate.each(function (d) {
			const group = d3.select(this);
			let chain = group.select(".enslaver-chain");
			const nodeColor = d.isEnslaver ? "#ffe0b2" : (d.color || d.fillColor || d.interiorColor || "#ffe0b2");
			if (d.isEnslaver) {
				if (chain.empty()) {
					chain = group.insert("g", ".node-name")
						.attr("class", "enslaver-chain")
						.attr("transform", "translate(22, 0) scale(1.16)");

					// Link 1 (top-left)
					const link1 = chain.append("g").attr("transform", "translate(44, 55) rotate(-35)");
					link1.append("ellipse").attr("class", "chain-ellipse-outer-1").attr("rx", 8.5).attr("ry", 14.5).attr("stroke", "#888888").attr("stroke-width", 2.2);
					link1.append("ellipse").attr("class", "chain-ellipse-inner-1").attr("rx", 4).attr("ry", 8.5).attr("stroke", "#888888").attr("stroke-width", 1.8);

					// Link 2 (bottom-right)
					const link2 = chain.append("g").attr("transform", "translate(56, 70) rotate(-35)");
					link2.append("ellipse").attr("class", "chain-ellipse-outer-2").attr("rx", 8.5).attr("ry", 14.5).attr("stroke", "#888888").attr("stroke-width", 2.2);
					link2.append("ellipse").attr("class", "chain-ellipse-inner-2").attr("rx", 4).attr("ry", 8.5).attr("stroke", "#888888").attr("stroke-width", 1.8);

					// Interlocking overlay arc from top-left link
					const link1Arc = chain.append("g").attr("transform", "translate(44, 55) rotate(-35)");
					link1Arc.append("path").attr("d", "M -8.5,3 A 8.5,14.5 0 0,0 8.5,3").attr("fill", "none").attr("stroke", "#888888").attr("stroke-width", 2.2);
				}
				chain.selectAll("ellipse").attr("fill", nodeColor);
				chain.style("display", "block");
			} else {
				if (!chain.empty()) chain.style("display", "none");
			}
		});

		// Update triangle fill colors if they are actively hiding a branch
		nodeUpdate.select(".tri-right").attr("fill", d => d.hiddenDirs && d.hiddenDirs.right ? "green" : "#999");
		nodeUpdate.select(".tri-left").attr("fill", d => d.hiddenDirs && d.hiddenDirs.left ? "green" : "#999");
		nodeUpdate.select(".tri-bottom")
			.attr("fill", d => d.hiddenDirs && d.hiddenDirs.bottom ? "green" : "#999")
			.attr("points", d => d.hiddenDirs && d.hiddenDirs.bottom ? "-5,-5 5,-5 0,5" : "-5,5 5,5 0,-5");
		nodeUpdate.select(".tri-top").attr("fill", d => d.hiddenDirs && d.hiddenDirs.top ? "green" : "#999");

		nodeSelection.exit().remove();

		this.UpdateNodeSelection();
		this.UpdateTriangleVisibility();
	}

	UpdateTriangleVisibility()																		// UPDATE TRIANGLE VISIBILITY
	{

		// Group families by children
		const childParents = {};
		this.state.triplets.forEach(t => {
			let p = null, c = null;
			if (t.predicate === 'isParentOf') { p = t.subject; c = t.object; }
			else if (t.predicate === 'isChildOf') { p = t.object; c = t.subject; }

			if (p && c) {
				childParents[c] = childParents[c] || new Set();
				childParents[c].add(p);
			}
		});

		const arrowParents = new Set();
		for (const c in childParents) {
			const parents = Array.from(childParents[c]).map(pid => this.GetNode(pid)).filter(Boolean);
			if (parents.length > 0) {
				parents.sort((a, b) => a.x - b.x); // first parent by X coordinate
				arrowParents.add(parents[0].person_id);
			}
		}

		this.gNodes.selectAll(".node-group").each((d, i, nodes) => {
			const hasBottomEdge = arrowParents.has(d.person_id);

			const group = d3.select(nodes[i]);
			group.select(".tri-right").style("display", "none");
			group.select(".tri-left").style("display", "none");
			group.select(".tri-bottom").style("display", hasBottomEdge ? "block" : "none");
			group.select(".tri-top").style("display", "none");

			// Dynamic tooltip text
			group.select(".tri-bottom title").text(d.hiddenDirs && d.hiddenDirs.bottom ? "Expand Children" : "Collapse Children");
		});
	}

	UpdateNodeSelection()																		// UPDATE SELECTED NODE HIGHLIGHT
	{

		this.gNodes.selectAll(".node-bg")
			.attr("stroke", d => d.person_id === this.state.selectedPid ? "#37c472ff" : "#999999")
			.attr("stroke-width", 3);
	}

	FitToScreen(duration = 0, centerOnParents = false)																		// FIT VIEWPORT TO TREE BOUNDING BOX
	{

		const visibleSet = this.GetVisibleNodes();
		const vNodes = this.state.nodes.filter(n => visibleSet.has(n.person_id));
		if (vNodes.length === 0) return;

		// Find bounding box
		let minX = Infinity, maxX = -Infinity;
		let minY = Infinity, maxY = -Infinity;

		vNodes.forEach(n => {
			if (n.x < minX) minX = n.x;
			if (n.x + this.nodeWidth > maxX) maxX = n.x + this.nodeWidth;
			if (n.y < minY) minY = n.y;
			if (n.y + this.nodeHeight > maxY) maxY = n.y + this.nodeHeight;
		});

		// Add a bit of padding around the bounding box
		const padding = 40;
		const bboxWidth = (maxX - minX) + padding * 2;
		const bboxHeight = (maxY - minY) + padding * 2;

		// Get canvas container dimensions
		const container = document.querySelector(".canvas-container");
		if (!container) return;
		const containerWidth = container.clientWidth;
		const containerHeight = container.clientHeight;

		// Calculate scale to fit
		const scale = Math.min(
			containerWidth / bboxWidth,
			containerHeight / bboxHeight,
			1.5
		);

		const finalScale = Math.max(scale, 0.1);

		// Center the bounding box vertically and horizontally in the container
		const centerX = minX + (maxX - minX) / 2;
		const centerY = minY + (maxY - minY) / 2;

		const tx = containerWidth / 2 - finalScale * centerX;
		const ty = containerHeight / 2 - finalScale * centerY;

		// Apply transform using transition or instantly
		const transform = d3.zoomIdentity.translate(tx, ty).scale(finalScale);
		if (duration > 0) {
			this.svg.transition().duration(duration).call(this.zoom.transform, transform);
		} else {
			this.svg.call(this.zoom.transform, transform);
		}
	}

	ResetLayout()																		// RESET HIERARCHICAL LAYOUT
	{
		this.ApplyLayout(true);
		this.RenderNodes();
		this.RenderEdges();
		this.FitToScreen(300, true);
	}

	ApplyLayout(forceReset = false)																		// APPLY HIERARCHICAL LAYOUT
	{

		const visibleSet = this.GetVisibleNodes();
		const vNodes = this.state.nodes.filter(n => visibleSet.has(n.person_id));
		const vTriplets = this.state.triplets.filter(t => visibleSet.has(t.subject) && visibleSet.has(t.object));

		const parentsOf = {};
		const childrenOf = {};
		const spousesOf = {};
		const cousinsOf = {};
		const directedCousinsOf = {};

		vNodes.forEach(n => {
			parentsOf[n.person_id] = new Set();
			childrenOf[n.person_id] = new Set();
			spousesOf[n.person_id] = new Set();
			cousinsOf[n.person_id] = new Set();
			directedCousinsOf[n.person_id] = new Set();
		});

		vTriplets.forEach(t => {
			if (t.predicate === 'isParentOf') {
				parentsOf[t.object].add(t.subject);
				childrenOf[t.subject].add(t.object);
			} else if (t.predicate === 'isChildOf') {
				parentsOf[t.subject].add(t.object);
				childrenOf[t.object].add(t.subject);
			}
			if (t.predicate === 'isSpouseOf') {
				spousesOf[t.subject].add(t.object);
				spousesOf[t.object].add(t.subject);
			}
			if (t.predicate === 'isCousinOf') {
				cousinsOf[t.subject].add(t.object);
				cousinsOf[t.object].add(t.subject);
				directedCousinsOf[t.object].add(t.subject);
			}
		});

		const depths = {};
		const queue = [];

		vNodes.forEach(n => {
			if (parentsOf[n.person_id].size === 0) {
				depths[n.person_id] = 0;
				queue.push(n.person_id);
			}
		});

		// Fallback if graph is a pure cycle and no root nodes were found
		if (queue.length === 0 && vNodes.length > 0) {
			depths[vNodes[0].person_id] = 0;
			queue.push(vNodes[0].person_id);
		}

		const maxAllowedDepth = vNodes.length + 5;
		let queueOps = 0;
		const maxQueueOps = Math.max(1000, vNodes.length * 100);

		while (queue.length > 0 && queueOps < maxQueueOps) {
			queueOps++;
			const curr = queue.shift();
			const d = depths[curr];
			if (d > maxAllowedDepth) continue;

			childrenOf[curr].forEach(child => {
				const nextD = d + 1;
				if (nextD <= maxAllowedDepth && (depths[child] === undefined || depths[child] < nextD)) {
					depths[child] = nextD;
					queue.push(child);
				}
			});
			spousesOf[curr].forEach(spouse => {
				if (d <= maxAllowedDepth && (depths[spouse] === undefined || depths[spouse] < d)) {
					depths[spouse] = d;
					queue.push(spouse);
				}
			});
			directedCousinsOf[curr].forEach(cousin => {
				const nextD = d + 2;
				if (nextD <= maxAllowedDepth && (depths[cousin] === undefined || depths[cousin] === 0)) {
					depths[cousin] = nextD;
					queue.push(cousin);
				}
			});
		}

		// Adjust depths for enslaver nodes to be 1 row higher than top-most family member
		vTriplets.forEach(t => {
			if (t.predicate === 'isEnslaverOf' || t.predicate === 'wasEnslavedBy' || t.predicate === 'enslaves') {
				let enslaverPid = t.subject, enslavedPid = t.object;
				if (t.predicate === 'wasEnslavedBy') {
					enslaverPid = t.object;
					enslavedPid = t.subject;
				}

				let minDepth = depths[enslavedPid] !== undefined ? depths[enslavedPid] : 0;
				const connectedPids = new Set([enslavedPid]);
				let changed = true;
				let iterations = 0;
				while (changed && iterations < 1000) {
					iterations++;
					changed = false;
					vTriplets.forEach(t2 => {
						if (t2.predicate !== 'isEnslaverOf' && t2.predicate !== 'wasEnslavedBy' && t2.predicate !== 'enslaves') {
							if (connectedPids.has(t2.subject) && !connectedPids.has(t2.object)) {
								connectedPids.add(t2.object);
								changed = true;
							}
							if (connectedPids.has(t2.object) && !connectedPids.has(t2.subject)) {
								connectedPids.add(t2.subject);
								changed = true;
							}
						}
					});
				}
				connectedPids.forEach(pid => {
					if (depths[pid] !== undefined && depths[pid] < minDepth) {
						minDepth = depths[pid];
					}
				});

				depths[enslaverPid] = minDepth - 1;
			}
		});

		const nodesByDepth = {};
		vNodes.forEach(n => {
			let d = depths[n.person_id] || 0;
			if (!nodesByDepth[d]) nodesByDepth[d] = [];
			nodesByDepth[d].push(n.person_id);
		});

		const startX = 100;
		const startY = 100;
		const xSpacing = 220;
		const ySpacing = 250;

		const depthKeys = Object.keys(nodesByDepth).map(Number).sort((a, b) => a - b);

		depthKeys.forEach(d => {
			const pids = nodesByDepth[d];
			if (!pids || pids.length === 0) return;

			const placed = new Set();

			if (d < 0) {
				// Depth < 0: Center enslaver nodes above their enslaved family members
				let currentX = startX;
				pids.forEach(pid => {
					if (placed.has(pid)) return;
					const node = this.GetNode(pid);
					if (node) {
						const enslavedPids = [];
						vTriplets.forEach(t => {
							if ((t.predicate === 'isEnslaverOf' && t.subject === pid) ||
								(t.predicate === 'wasEnslavedBy' && t.object === pid) ||
								(t.predicate === 'enslaves' && t.subject === pid)) {
								const targetId = t.predicate === 'wasEnslavedBy' ? t.subject : t.object;
								enslavedPids.push(targetId);
							}
						});
						const enslavedNodes = enslavedPids.map(id => this.GetNode(id)).filter(Boolean);
						if (enslavedNodes.length > 0) {
							const minEX = Math.min(...enslavedNodes.map(p => p.x));
							const maxEX = Math.max(...enslavedNodes.map(p => p.x + this.nodeWidth));
							const centerEX = minEX + (maxEX - minEX) / 2;
							node.x = centerEX - this.nodeWidth / 2;
						} else {
							node.x = currentX;
						}
						node.y = startY + d * ySpacing;
						if (forceReset) node.moved = false;
						placed.add(pid);
						currentX += xSpacing;
					}
				});
			} else if (d === 0) {
				// Depth 0: Root parents
				let currentX = startX;
				pids.forEach(pid => {
					if (placed.has(pid)) return;
					const node = this.GetNode(pid);
					if (node) {
						if (forceReset || !node.moved) {
							node.x = currentX;
							node.y = startY + d * ySpacing;
							if (forceReset) node.moved = false;
						} else {
							node.y = startY + d * ySpacing;
						}
						placed.add(pid);
						currentX += xSpacing;

						// Place spouse adjacent
						spousesOf[pid].forEach(spid => {
							if (!placed.has(spid) && depths[spid] === d) {
								const snode = this.GetNode(spid);
								if (snode) {
									currentX -= xSpacing;
									currentX += this.nodeWidth + 20;
									if (forceReset || !snode.moved) {
										snode.x = currentX;
										snode.y = startY + d * ySpacing;
										if (forceReset) snode.moved = false;
									} else {
										snode.y = startY + d * ySpacing;
									}
									placed.add(spid);
									currentX += xSpacing;
								}
							}
						});
					}
				});
			} else {
				// Depth > 0: Center children under their parent(s)
				const parentToChildren = {};
				pids.forEach(pid => {
					const pList = Array.from(parentsOf[pid] || []).sort().join(',');
					const groupKey = pList || 'unparented';
					if (!parentToChildren[groupKey]) parentToChildren[groupKey] = [];
					parentToChildren[groupKey].push(pid);
				});

				let currentX = startX;

				Object.keys(parentToChildren).forEach(groupKey => {
					const childrenPids = parentToChildren[groupKey];
					if (groupKey !== 'unparented') {
						const parentPids = groupKey.split(',');
						const parentNodes = parentPids.map(id => this.GetNode(id)).filter(Boolean);
						if (parentNodes.length > 0) {
							const minPx = Math.min(...parentNodes.map(p => p.x));
							const maxPx = Math.max(...parentNodes.map(p => p.x + this.nodeWidth));
							const parentCenterX = minPx + (maxPx - minPx) / 2;

							const numC = childrenPids.length;
							const cGap = 220;
							const span = (numC - 1) * cGap + this.nodeWidth;
							let childX = parentCenterX - span / 2;

							// Only clamp childX if previous family groups have already been placed on this row
							if (placed.size > 0 && childX < currentX) childX = currentX;

							childrenPids.forEach(cid => {
								if (placed.has(cid)) return;
								const cnode = this.GetNode(cid);
								if (cnode) {
									cnode.x = childX;
									cnode.y = startY + d * ySpacing;
									if (forceReset) cnode.moved = false;
									placed.add(cid);
									childX += cGap;
								}
							});
							currentX = Math.max(currentX, childX);
							return;
						}
					}

					// Unparented children at depth d
					childrenPids.forEach(cid => {
						if (placed.has(cid)) return;
						const cnode = this.GetNode(cid);
						if (cnode) {
							cnode.x = currentX;
							cnode.y = startY + d * ySpacing;
							if (forceReset) cnode.moved = false;
							placed.add(cid);
							currentX += xSpacing;
						}
					});
				});
			}
		});

	}

	GetAnchors(node)																		// GET NODE ANCHOR COORDINATES
	{

		const g = (node.gender || "unknown").split(':')[0].toLowerCase();
		let lx, rx, y;

		if (g === 'female' || g === 'f') {
			lx = node.x + 60;
			rx = node.x + 100;
			y = node.y + 81;
		} else if (g === 'male' || g === 'm') {
			lx = node.x + 80;
			rx = node.x + 80;
			y = node.y + 81;
		} else {
			lx = node.x + 80;
			rx = node.x + 80;
			y = node.y + 58;
		}
		return {
			left: { x: lx, y: y, dir: [-1, 0] },
			right: { x: rx, y: y, dir: [1, 0] }
		};
	}

	DrawSmartCurve(source, target)																		// DRAW CURVED LINES BETWEEN ANCHORS
	{

		const cy1 = source.y + this.nodeHeight / 2;
		const cy2 = target.y + this.nodeHeight / 2;

		// 1. Same horizontal line check (close to being horizontal)
		if (Math.abs(cy1 - cy2) < 50) {
			let s = source, t = target;
			if (source.x > target.x) { s = target; t = source; }						// s is left
			const startX = this.GetAnchors(s).right.x;
			const startY = this.GetAnchors(s).right.y;
			const endX = this.GetAnchors(t).left.x;
			const endY = this.GetAnchors(t).left.y;

			const cp1X = startX + 30;
			const cp2X = endX - 30;
			return `M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`;
		}

		// 2. Otherwise, connect closest sides
		const a1 = this.GetAnchors(source);
		const a2 = this.GetAnchors(target);
		let minD = Infinity;
		let p1, p2;

		for (let k1 in a1) {
			for (let k2 in a2) {
				const dx = a1[k1].x - a2[k2].x;
				const dy = a1[k1].y - a2[k2].y;
				const dist = dx * dx + dy * dy;
				if (dist < minD) {
					minD = dist;
					p1 = a1[k1];
					p2 = a2[k2];
				}
			}
		}

		const d = Math.sqrt(minD);
		const handleLen = Math.max(d * 0.4, 30);

		const cp1x = p1.x + p1.dir[0] * handleLen;
		const cp1y = p1.y + p1.dir[1] * handleLen;
		const cp2x = p2.x + p2.dir[0] * handleLen;
		const cp2y = p2.y + p2.dir[1] * handleLen;

		return `M ${p1.x} ${p1.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
	}

	RenderEdges()																		// RENDER ALL EDGES
	{

		const visibleSet = this.GetVisibleNodes();

		const edgeData = [];
		const seenSpouses = new Set();
		const seenSiblings = new Set();
		const seenExtended = new Set();
		const childToParents = {};

		const vTriplets = this.state.triplets.filter(t => visibleSet.has(t.subject) && visibleSet.has(t.object));

		vTriplets.forEach(t => {
			const s = this.GetNode(t.subject);
			const o = this.GetNode(t.object);
			if (!s || !o) return;

			if (t.predicate === 'isSpouseOf') {
				const pairKey = [t.subject, t.object].sort().join("-");
				if (seenSpouses.has(pairKey)) return;
				seenSpouses.add(pairKey);
				edgeData.push({ type: 'isSpouseOf', source: s, target: o, id: pairKey });
			} else if (t.predicate === 'isSiblingOf') {
				const pairKey = [t.subject, t.object].sort().join("-");
				if (seenSiblings.has(pairKey)) return;
				seenSiblings.add(pairKey);
				edgeData.push({ type: 'isSiblingOf', source: s, target: o, id: pairKey + '-Sibling' });
			} else if (t.predicate === 'isCousinOf' || t.predicate === 'isUncleOf' || t.predicate === 'isAuntOf' || t.predicate === 'isNiblingOf') {
				const pairKey = [t.subject, t.object].sort().join("-");
				if (seenExtended.has(pairKey)) return;
				seenExtended.add(pairKey);
				edgeData.push({ type: 'ExtendedOf', source: s, target: o, id: pairKey + '-Extended' });
			} else if (t.predicate === 'isEnslaverOf' || t.predicate === 'wasEnslavedBy' || t.predicate === 'enslaves') {
				const pairKey = [t.subject, t.object].sort().join("-");
				let enslaver = s, enslaved = o;
				if (t.predicate === 'wasEnslavedBy') { enslaver = o; enslaved = s; }
				edgeData.push({ type: 'isEnslaverOf', source: enslaver, target: enslaved, id: pairKey + '-Enslaver' });
			} else if (t.predicate === 'isParentOf' || t.predicate === 'isChildOf') {
				let parent = s, child = o;
				if (t.predicate === 'isChildOf') { parent = o; child = s; }

				if (!childToParents[child.person_id]) childToParents[child.person_id] = [];
				if (!childToParents[child.person_id].includes(parent.person_id)) {
					childToParents[child.person_id].push(parent.person_id);
				}
			}
		});

		// Implicitly connect children of a single parent to that parent's spouse for rendering
		Object.keys(childToParents).forEach(childPid => {
			if (childToParents[childPid].length === 1) {
				const parentPid = childToParents[childPid][0];
				const spouseEdge = vTriplets.find(t => t.predicate === 'isSpouseOf' && (t.subject === parentPid || t.object === parentPid));
				if (spouseEdge) {
					const spousePid = spouseEdge.subject === parentPid ? spouseEdge.object : spouseEdge.subject;
					if (!childToParents[childPid].includes(spousePid)) {
						childToParents[childPid].push(spousePid);
					}
				}
			}
		});

		const familyGroups = {};
		Object.keys(childToParents).forEach(childPid => {
			const parentPids = childToParents[childPid].sort().join(",");
			if (!familyGroups[parentPids]) familyGroups[parentPids] = { parents: childToParents[childPid], children: [] };
			familyGroups[parentPids].children.push(childPid);
		});

		Object.keys(familyGroups).forEach(parentKey => {
			const fam = familyGroups[parentKey];
			const parents = fam.parents.map(pid => this.GetNode(pid)).filter(Boolean);
			const children = fam.children.map(pid => this.GetNode(pid)).filter(Boolean);
			if (parents.length > 0 && children.length > 0) {
				// Use stable ID: sorted parent PIDs + sorted child PIDs
				const stableId = 'fam-' + fam.parents.sort().join(',') + '--' + fam.children.slice().sort().join(',');
				edgeData.push({ type: 'FamilyPedigree', parents, children, id: stableId });
			}
		});

		// Use a full clear+redraw approach — removes stale edges and redraws everything fresh
		// This avoids D3 key-mismatch bugs when node positions change between renders
		this.gEdges.selectAll(".edge-group").remove();

		const edgeGroups = this.gEdges.selectAll(".edge-group")
			.data(edgeData)
			.enter()
			.append("g")
			.attr("class", "edge-group");

		// Spouse (Double curved line effect)
		edgeGroups.filter(d => d.type === 'isSpouseOf')
			.append("path")
			.attr("class", "spouse-bg")
			.attr("fill", "none")
			.attr("stroke", "#999999")
			.attr("stroke-width", 3)
			.attr("d", d => this.DrawSmartCurve(d.source, d.target));

		edgeGroups.filter(d => d.type === 'isSpouseOf')
			.append("path")
			.attr("class", "spouse-fg")
			.attr("fill", "none")
			.attr("stroke", "var(--canvas-bg, #e5e5e5)")
			.attr("stroke-width", 1)
			.attr("d", d => this.DrawSmartCurve(d.source, d.target));

		// Helper to get midpoint (junction dot) for a family pedigree unit
		const getPedigreeJunction = (d) => {
			let jx, jy;
			if (d.parents.length === 1) {
				const p = d.parents[0];
				jx = p.x + this.nodeWidth / 2;
				jy = p.y + this.nodeHeight;
			} else {
				const p1 = d.parents[0];
				const p2 = d.parents[1];
				jx = (p1.x + p2.x) / 2 + this.nodeWidth / 2;
				jy = (p1.y + p2.y) / 2 + 81;
			}
			return { x: jx, y: jy };
		};

		// Family Pedigree (parent→child curved lines)
		edgeGroups.filter(d => d.type === 'FamilyPedigree')
			.append("path")
			.attr("class", "parent-child-line")
			.attr("fill", "none")
			.attr("stroke", "#666666")
			.attr("stroke-width", 1.5)
			.attr("stroke-linejoin", "round")
			.attr("d", d => {
				if (!d.children || d.children.length === 0) return "";
				const j = getPedigreeJunction(d);
				const parentX = j.x;
				const parentY = j.y;

				let pathStr = "";
				d.children.forEach(c => {
					const childX = c.x + this.nodeWidth / 2;
					const childY = c.y + 38; // Center of head icon
					const midY = parentY + (childY - parentY) / 2;

					// Smooth Cubic Bezier S-curve from spouse junction dot to center of child head icon
					pathStr += `M ${parentX} ${parentY} C ${parentX} ${midY}, ${childX} ${midY}, ${childX} ${childY} `;
				});

				return pathStr;
			});

		// Family Pedigree (Junction Circle)
		const familyJunctions = edgeGroups.filter(d => d.type === 'FamilyPedigree');

		familyJunctions.append("circle")
			.attr("class", "family-junction-outer")
			.attr("r", 4)
			.attr("fill", "none")
			.attr("stroke", "#666666")
			.attr("stroke-width", 1)
			.attr("cx", d => getPedigreeJunction(d).x)
			.attr("cy", d => getPedigreeJunction(d).y);

		familyJunctions.append("circle")
			.attr("class", "family-junction")
			.attr("r", 2)
			.attr("fill", "#666666")
			.attr("cx", d => getPedigreeJunction(d).x)
			.attr("cy", d => getPedigreeJunction(d).y);

		// Sibling
		edgeGroups.filter(d => d.type === 'isSiblingOf')
			.append("path")
			.attr("class", "sibling-line")
			.attr("fill", "none")
			.attr("stroke", "#666666")
			.attr("stroke-width", 1)
			.attr("stroke-dasharray", "5,5")
			.attr("d", d => this.DrawSmartCurve(d.source, d.target));

		// Extended relationships
		edgeGroups.filter(d => d.type === 'ExtendedOf')
			.append("path")
			.attr("class", "extended-line")
			.attr("fill", "none")
			.attr("stroke", "#666666")
			.attr("stroke-width", 1)
			.attr("stroke-dasharray", "2,4")
			.attr("d", d => this.DrawSmartCurve(d.source, d.target));

		// Enslaver (Double dotted line effect)
		const enslaverEdges = edgeGroups.filter(d => d.type === 'isEnslaverOf');
		enslaverEdges.append("path")
			.attr("class", "enslaver-bg")
			.attr("fill", "none")
			.attr("stroke", "#999999")
			.attr("stroke-width", 3.5)
			.attr("stroke-dasharray", "4,4")
			.attr("d", d => this.DrawSmartCurve(d.source, d.target));

		enslaverEdges.append("path")
			.attr("class", "enslaver-fg")
			.attr("fill", "none")
			.attr("stroke", "var(--canvas-bg, #ffffff)")
			.attr("stroke-width", 1.5)
			.attr("stroke-dasharray", "4,4")
			.attr("d", d => this.DrawSmartCurve(d.source, d.target));

		this.UpdateTriangleVisibility();
	}

	HandleLinkTargetClick(targetPid)																		// HANDLE LINK MODE CLICK TARGET
	{

		this.linkMode = false;
		document.getElementById("link-banner").style.display = "none";
		const targetNode = this.GetNode(targetPid);
		if (!targetNode) return;

		document.getElementById("pred-target-name").innerText = this.FormatNodeName(targetNode);
		document.getElementById("predicate-modal").dataset.target = targetPid;
		document.getElementById("predicate-modal").showModal();
	}

	SelectNodeAndShowEditor(personId, forceTab = null)																		// SELECT NODE AND LAUNCH EDITOR
	{

		if (window.app && typeof window.app.selectNodeAndShowEditor === 'function') {
			window.app.selectNodeAndShowEditor(personId, forceTab);
		}
	}
}

window.treeApp = new TreeApp();
