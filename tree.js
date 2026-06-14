class TreeApp {
	constructor() {
		this.init();
	}

	init() {
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
						<div class="dropdown-item has-submenu">
							Export
							<div class="submenu">
								<div class="dropdown-item" id="menu-export-gedcom">GEDCOM</div>
								<div class="dropdown-item" id="menu-export-rdf">RDF</div>
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
						<div class="dropdown-item" id="menu-edit-node">Edit Node</div>
						<div class="dropdown-item" id="menu-delete-node">Delete Node</div>
					</div>
				</div>
		
				<!-- View Menu -->
				<div class="menu-top-level">
					View
					<div class="dropdown">
						<div class="dropdown-item" id="menu-this.zoom-in">Zoom In</div>
						<div class="dropdown-item" id="menu-this.zoom-out">Zoom Out</div>
						<div class="dropdown-item" id="menu-fit-screen">Fit to Screen</div>
						<div class="dropdown-item" id="menu-reset-layout">Reset Layout</div>
						<div class="dropdown-separator"></div>
						<div class="dropdown-item" id="menu-toggle-notepad">Notepad</div>
					</div>
				</div>
		
			</div>
		
			<!-- Workspace Area -->
			<div class="main-workspace">
				<!-- Main Canvas Area -->
				<div class="canvas-container" style="width: 50%; position: relative;">
					<img src="Vlogo.png" style="position: absolute; bottom: 20px; left: 20px; width: 4vw;opacity: 0.5; pointer-events: none;">
				</div>
		
				<!-- Vertical Divider Splitter -->
				<div id="divider"></div>
		
				<!-- Matching Module Placeholder -->
				<div class="matching-module-placeholder" style="width: calc(50% - 6px);">
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
		
			<!-- node-modal removed: editing is done via the right-panel PersonEditor -->
		
			<dialog id="predicate-modal" class="modern-dialog" style="min-width: 250px;">
				<div class="dialog-header">
					<h3 style="margin:0;">Select Relationship</h3>
				</div>
				<div class="dialog-body" style="margin-bottom: 20px;">
					<p>Relationship to <strong id="pred-target-name"></strong>:</p>
					<select id="pred-select" style="width: 100%; padding: 5px;">
						<option value="MotherOf">MotherOf</option>
						<option value="FatherOf">FatherOf</option>
						<option value="SpouseOf">SpouseOf</option>
						<option value="ChildOf">ChildOf</option>
						<option value="SiblingOf">SiblingOf</option>
						<option value="UncleOf">UncleOf</option>
						<option value="AuntOf">AuntOf</option>
						<option value="NiblingOf">NiblingOf</option>
						<option value="CousinOf">CousinOf</option>
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
				<div class="dialog-body" style="margin-bottom: 20px;">
					<p>How is this new person related to <strong id="add-node-target-name"></strong>?</p>
					<select id="add-node-select" style="width: 100%; padding: 5px;">
						<option value="ChildOf">is Child of</option>
						<option value="ParentOf">is Parent of</option>
						<option value="SiblingOf">is Sibling of</option>
						<option value="SpouseOf">is Spouse of</option>
					</select>
				</div>
				<div class="dialog-footer">
					<button id="add-node-cancel">Cancel</button>
					<button id="add-node-confirm" class="primary-btn">Add Person</button>
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
				this.undo();
				this.applyLayout();
				this.renderNodes(); this.renderEdges();
			}
			// Ctrl+Y
			if (e.ctrlKey && e.key === 'y') {
				e.preventDefault();
				this.redo();
				this.applyLayout();
				this.renderNodes(); this.renderEdges();
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

		this.svg.call(this.zoom);

		// Click background to deselect
		this.svg.on("click", (e) => {
			if (e.target.tagName === 'svg') {
				this.state.selectedPid = null;
				this.updateNodeSelection();
			}
		});

		// Initialize layers: edges strictly BEFORE nodes so they sit behind!
		this.gEdges = this.gMain.append("g").attr("class", "edges-layer");
		this.gNodes = this.gMain.append("g").attr("class", "nodes-layer");

		// Node Dimensions
		this.nodeWidth = 160;
		this.nodeHeight = 116;

		// Path definitions for gender silhouettes
		this.femalePath = "M 25,90 L 42,45 A 15,15 0 1,1 58,45 L 75,90 Q 80,100 70,100 L 30,100 Q 20,100 25,90 Z";
		this.malePath = "M 28,45 L 42.52,45 A 15,15 0 1,1 57.48,45 L 72,45 Q 77,45 77,50 L 77,95 Q 77,100 72,100 L 28,100 Q 23,100 23,95 L 23,50 Q 23,45 28,45 Z";
		this.circlePath = "M 50, 50 m -40, 0 a 40,40 0 1,0 80,0 a 40,40 0 1,0 -80,0";


		// Drag Behavior
		this.drag = d3.drag()
			.filter(function (e) {
				if (typeof this.linkMode !== 'undefined' && this.linkMode) return false;
				return !e.button;
			})
			.on("start", (e, d) => {
				d3.select(e.currentTarget).raise();
				this.state.selectedPid = d.person_id;
				this.updateNodeSelection();

				// Build list of all downstream descendants to this.drag along
				e.sourceEvent.stopPropagation();
				d.spouseSet = new Set();
				d.wasDragged = false;

				// Record immediate spouses
				this.state.triplets.forEach(t => {
					if (t.predicate === 'SpouseOf') {
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
					const spouseNode = this.getNode(spid);
					if (spouseNode) {
						spouseNode.y = d.y;
					}
				});

				// Fast DOM update for all nodes uniformly
				this.gNodes.selectAll(".node-group").attr("transform", nd => `translate(${nd.x},${nd.y})`);
				this.renderEdges();														// Update edges in real time dynamically
			})
			.on("end", (e, d) => {
				delete d.spouseSet;
				if (d.wasDragged) {
					d.moved = true;													// Mark as manually moved so layout doesn't override unconditionally
				} else {
					// It was a click (no dragging occurred)
					if (typeof this.linkMode !== 'undefined' && this.linkMode) {
						this.handleLinkTargetClick(d.person_id);
					} else this.selectNodeAndShowEditor(d.person_id);

				}
			});

		// Live synchronization helper




		// Layout and Edge rendering






		this.clearAll();																	// Ensure clean this.state before injecting our persistent test data
		this.undoStack = [];

		this.addNode({ person_id: "P001", first_name: "Mary", last_name: "Johnson", birth_year: 1820, death_year: 1890, gender: "F", enslaved: true, x: 200, y: 200 });
		this.addNode({ person_id: "P002", first_name: "James", last_name: "Johnson", birth_year: 1815, death_year: 1878, gender: "M", enslaved: true, x: 500, y: 200 });
		this.addNode({ person_id: "P003", first_name: "Sarah", last_name: "Johnson", birth_year: 1845, death_year: null, gender: "F", enslaved: false, x: 200, y: 450 });
		this.addNode({ person_id: "P004", first_name: "Thomas", last_name: "Johnson", birth_year: 1842, death_year: 1910, gender: "M", enslaved: false, x: 500, y: 450 });
		this.addNode({ person_id: "P005", first_name: "Josh", last_name: "Johnson", birth_year: 1872, death_year: 1940, gender: "M", enslaved: false, x: -100, y: 200 });

		// Phase 4 test triplets
		this.addTriplet("P001", "SpouseOf", "P002");
		this.addTriplet("P001", "MotherOf", "P003");
		this.addTriplet("P001", "MotherOf", "P004");
		this.addTriplet("P002", "FatherOf", "P003");
		this.addTriplet("P002", "FatherOf", "P004");
		this.addTriplet("P003", "SiblingOf", "P004");
		this.addTriplet("P005", "CousinOf", "P001");
		this.undoStack = [];																// clear test data from undo
		this.isDirty = false;

		// Dialog and Link variables
		this.linkMode = false;
		this.linkSourcePid = null;


		// jQuery Document Ready handlers
		$(document).ready(() => {
			this.restoreNotepadSizeAndPosition();


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

			// Edit Menu Logic — editing is done in the right-panel PersonEditor (click a node to open)
			$('#menu-edit-node').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (!this.state.selectedPid) {
					alert("Please select a node first");
					return;
				}
				// Focus the right panel editor — it opens when a node is clicked
				this.selectNodeAndShowEditor(this.state.selectedPid);

			});

			$('#menu-delete-node').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (!this.state.selectedPid) {
					alert("Please select a node first");
					return;
				}
				const n = this.getNode(this.state.selectedPid);
				if (n && confirm('Are you sure you want to delete ' + n.first_name + " " + n.last_name + '?')) {
					this.deleteNode(this.state.selectedPid);
					this.applyLayout(); this.renderNodes(); this.renderEdges();
				}
			});

			$('#menu-undo').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (this.undoStack.length > 0) {
					this.undo();
					this.applyLayout();
					this.renderNodes(); this.renderEdges();
				}
			});

			$('#menu-redo').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (this.redoStack.length > 0) {
					this.redo();
					this.applyLayout();
					this.renderNodes(); this.renderEdges();
				}
			});

			// View Menu Logic
			$('#menu-this.zoom-in').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (typeof this.svg !== 'undefined' && typeof this.zoom !== 'undefined') {
					this.svg.transition().duration(250).call(this.zoom.scaleBy, 1.1);
				}
			});

			$('#menu-this.zoom-out').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (typeof this.svg !== 'undefined' && typeof this.zoom !== 'undefined') {
					this.svg.transition().duration(250).call(this.zoom.scaleBy, 0.9);
				}
			});

			$('#menu-fit-screen').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				this.fitToScreen();

			});

			$('#menu-reset-layout').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				if (this.state && this.state.nodes) {
					this.state.nodes.forEach(n => n.moved = false);
					this.applyLayout();
					this.renderNodes(); this.renderEdges();
				}
				this.fitToScreen();

			});

			$('#menu-toggle-notepad').on('click', (e) => {
				e.stopPropagation();
				$('.menu-top-level').removeClass('active');
				const np = document.getElementById('notepad-container');
				if (np) {
					np.style.display = np.style.display === 'none' ? 'flex' : 'none';
				}
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
			const npText = document.getElementById('notepad-text');
			if (npText) {
				npText.addEventListener('input', function (e) {
					this.state.notepad = e.target.value;
					this.isDirty = true;
				});
				npText.addEventListener('blur', function () {
					this.saveState();														// push notepad change to undo history so it is saved natively in tree history
				});
			}

			// Predicate-modal listeners (for link mode: click a node to link to it)
			document.getElementById("pred-cancel").addEventListener("click", () => {
				document.getElementById("predicate-modal").close();
				this.linkMode = false;
				document.getElementById("link-banner").style.display = "none";
			});

			document.getElementById("pred-confirm").addEventListener("click", () => {
				const pred = document.getElementById("pred-select").value;
				const targetPid = document.getElementById("predicate-modal").dataset.target;
				document.getElementById("predicate-modal").close();
				if (pred && targetPid && this.linkSourcePid) {
					this.addTriplet(this.linkSourcePid, pred, targetPid);
					this.applyLayout(); this.renderNodes(); this.renderEdges();
				}
				this.linkMode = false;
				document.getElementById("link-banner").style.display = "none";
			});

			// Add-node-modal listeners
			document.getElementById("add-node-cancel").addEventListener("click", () => {
				document.getElementById("add-node-modal").close();
			});

			document.getElementById("add-node-confirm").addEventListener("click", () => {
				const sourcePid = document.getElementById("add-node-modal").dataset.sourcePid;
				const relation = document.getElementById("add-node-select").value;
				document.getElementById("add-node-modal").close();

				if (sourcePid && relation) {
					const sourceNode = this.getNode(sourcePid);
					const newPid = this.generatePid();
					let newX = sourceNode ? sourceNode.x : 0;
					let newY = sourceNode ? sourceNode.y : 0;

					if (relation === 'ChildOf') {
						const spouses = this.state.triplets.filter(t => t.predicate === 'SpouseOf' && (t.subject === sourcePid || t.object === sourcePid));
						if (spouses.length > 0) {
							const spouseId = spouses[0].subject === sourcePid ? spouses[0].object : spouses[0].subject;
							const spouseNode = this.getNode(spouseId);
							if (spouseNode) {
								newX = (sourceNode.x + spouseNode.x) / 2;
							}
						}
						newY += 250;
					} else if (relation === 'ParentOf') {
						newX += 0; newY -= 250;
					} else if (relation === 'SiblingOf') {
						newX += 250; newY += 0;
					} else if (relation === 'SpouseOf') {
						newX += 200; newY += 0;
					}

					const newNode = this.addNode({
						person_id: newPid,
						first_name: '',
						last_name: sourceNode ? (sourceNode.last_name || '') : '',
						x: newX,
						y: newY
					});

					if (relation === 'ChildOf') {
						this.addTriplet(newPid, 'ChildOf', sourcePid);
						const spouses = this.state.triplets.filter(t => t.predicate === 'SpouseOf' && (t.subject === sourcePid || t.object === sourcePid));
						spouses.forEach(t => {
							const spousePid = t.subject === sourcePid ? t.object : t.subject;
							this.addTriplet(newPid, 'ChildOf', spousePid);
						});

						// Connect to existing siblings
						const siblings = this.state.triplets
							.filter(t => t.predicate === 'ChildOf' && t.object === sourcePid && t.subject !== newPid)
							.map(t => t.subject);
						siblings.forEach(siblingPid => {
							this.addTriplet(newPid, 'SiblingOf', siblingPid);
						});
					} else if (relation === 'ParentOf') {
						this.addTriplet(sourcePid, 'ChildOf', newPid);
					} else if (relation === 'SiblingOf') {
						this.addTriplet(newPid, 'SiblingOf', sourcePid);

						// Connect the new sibling to all known parents of the source node
						const parents = new Set();
						this.state.triplets.forEach(t => {
							if (t.predicate === 'ChildOf' && t.subject === sourcePid) {
								parents.add(t.object);
							}
							if ((t.predicate === 'MotherOf' || t.predicate === 'FatherOf') && t.object === sourcePid) {
								parents.add(t.subject);
							}
						});
						parents.forEach(parentPid => {
							this.addTriplet(newPid, 'ChildOf', parentPid);
						});
					} else if (relation === 'SpouseOf') {
						this.addTriplet(newPid, 'SpouseOf', sourcePid);
					}

					this.applyLayout(); this.renderNodes(); this.renderEdges();
					this.selectNodeAndShowEditor(newPid);

				}
			});



			// Splitter Resizing Interaction logic
			const splitDivider = document.getElementById('divider');
			const workspace = document.querySelector('.main-workspace');
			const canvasContainer = document.querySelector('.canvas-container');
			const detailsPanel = document.querySelector('.matching-module-placeholder');

			if (splitDivider && workspace && canvasContainer && detailsPanel) {
				let isResizing = false;

				splitDivider.addEventListener('mousedown', (e) => {
					isResizing = true;
					splitDivider.classList.add('active');
					document.body.style.cursor = 'col-resize';
					document.body.style.userSelect = 'none';
				});

				document.addEventListener('mousemove', (e) => {
					if (!isResizing) return;
					const offsetLeft = workspace.getBoundingClientRect().left;
					const totalWidth = workspace.clientWidth;
					let pointerX = e.clientX - offsetLeft;

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
					this.fitToScreen(0);
				});

				document.addEventListener('mouseup', () => {
					if (isResizing) {
						isResizing = false;
						splitDivider.classList.remove('active');
						document.body.style.cursor = 'default';
						document.body.style.userSelect = 'auto';

						// Smoothly settle the tree position once dragging is finished
						this.fitToScreen(200);
					}
				});
			}

			// Apply automatic hierarchical layout and initial draw on load
			this.applyLayout();
			this.renderNodes();
			this.renderEdges();
			this.fitToScreen(0);
			if (this.state.nodes && this.state.nodes.length > 0) {
				this.selectNodeAndShowEditor(this.state.nodes[0].person_id);
			}
		});



	}

	restoreNotepadSizeAndPosition() {
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

	updateUndoRedoMenu() {
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

	saveState() {
		// Deep copy using JSON (safe since our data is simple JS objects)
		this.undoStack.push(JSON.parse(JSON.stringify(this.state)));
		this.redoStack = [];															// Clear redo stack on new action
		this.updateUndoRedoMenu();
	}

	undo() {
		if (this.undoStack.length > 0) {
			this.redoStack.push(JSON.parse(JSON.stringify(this.state)));
			this.state = this.undoStack.pop();
			this.updateUndoRedoMenu();
			if (document.getElementById("notepad-text")) document.getElementById("notepad-text").value = this.state.notepad || "";
			this.isDirty = true;
		}
	}

	redo() {
		if (this.redoStack.length > 0) {
			this.undoStack.push(JSON.parse(JSON.stringify(this.state)));
			this.state = this.redoStack.pop();
			this.updateUndoRedoMenu();
			if (document.getElementById("notepad-text")) document.getElementById("notepad-text").value = this.state.notepad || "";
			this.isDirty = true;
		}
	}

	getVisibleNodes() {
		const visible = new Set(this.state.nodes.map(n => n.person_id));

		function hideDirection(pid, dir) {
			const queue = [];
			this.state.triplets.forEach(t => {
				if (dir === 'down') {
					if (t.subject === pid && (t.predicate === 'MotherOf' || t.predicate === 'FatherOf')) queue.push(t.object);
					if (t.object === pid && t.predicate === 'ChildOf') queue.push(t.subject);
				} else if (dir === 'up') {
					if (t.object === pid && (t.predicate === 'MotherOf' || t.predicate === 'FatherOf')) queue.push(t.subject);
					if (t.subject === pid && t.predicate === 'ChildOf') queue.push(t.object);
				} else if (dir === 'right' || dir === 'left') {
					if (t.subject === pid && t.predicate === 'SpouseOf') {
						const other = this.getNode(t.object);
						const me = this.getNode(pid);
						if (other && me) {
							if (dir === 'right' && other.x > me.x) queue.push(t.object);
							if (dir === 'left' && other.x < me.x) queue.push(t.object);
						}
					}
				}
			});

			function hideDescendants(cpid) {
				if (visible.has(cpid)) {
					visible.delete(cpid);
					this.state.triplets.forEach(t => {
						if (t.subject === cpid && (t.predicate === 'MotherOf' || t.predicate === 'FatherOf')) hideDescendants(t.object);
						if (t.object === cpid && t.predicate === 'ChildOf') hideDescendants(t.subject);
						if (t.subject === cpid && t.predicate === 'SpouseOf') hideDescendants(t.object);
					});
				}
			}

			function hideAncestors(cpid) {
				if (visible.has(cpid)) {
					visible.delete(cpid);
					this.state.triplets.forEach(t => {
						if (t.object === cpid && (t.predicate === 'MotherOf' || t.predicate === 'FatherOf')) hideAncestors(t.subject);
						if (t.subject === cpid && t.predicate === 'ChildOf') hideAncestors(t.object);
						if (t.subject === cpid && t.predicate === 'SpouseOf') hideAncestors(t.object);
					});
				}
			}

			queue.forEach(targetPid => {
				if (dir === 'down') hideDescendants(targetPid);
				else if (dir === 'up') hideAncestors(targetPid);
				else hideAncestors(targetPid);									// For spouses, hiding their ancestral line is safe
			});
		}

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

	generatePid() {
		let newPid;
		do {
			newPid = "P" + String(this.pidCounter).padStart(3, '0');
			this.pidCounter++;
		} while (this.getNode(newPid) !== null);
		return newPid;
	}

	clearAll() {
		this.saveState();
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

	addNode(fields) {
		this.saveState();
		const pid = fields.person_id || this.generatePid();
		const newNode = {
			person_id: pid,
			first_name: fields.first_name || "",
			norm_first_name: fields.norm_first_name || "",
			last_name: fields.last_name || "",
			nysiis_last_name: fields.nysiis_last_name || "",
			soundex_last_name: fields.soundex_last_name || "",
			suffix: fields.suffix || "",
			race: fields.race || "",
			gender: fields.gender || "male",
			birth_year: fields.birth_year !== undefined ? fields.birth_year : null,
			death_year: fields.death_year !== undefined ? fields.death_year : null,
			confidence: fields.confidence !== undefined ? fields.confidence : 1,
			mentions: fields.mentions || [],
			linked_persons: fields.linked_persons || [],
			enslaved: fields.enslaved || false,									// kept for node color/tan styling

			// Canvas layout properties
			x: fields.x !== undefined ? fields.x : 0,
			y: fields.y !== undefined ? fields.y : 0,
			moved: fields.moved || false,
			expanded: true,
			hiddenDirs: { top: false, bottom: false, left: false, right: false }
		};
		this.state.nodes.push(newNode);
		this.isDirty = true;
		return newNode;
	}

	editNode(pid, fields) {
		this.saveState();
		const node = this.getNode(pid);
		if (node) {
			Object.keys(fields).forEach(key => {
				if (fields[key] !== undefined && key !== 'person_id') {
					node[key] = fields[key];
				}
			});
			this.isDirty = true;
		}
	}

	deleteNode(pid) {
		this.saveState();

		const toDelete = new Set([pid]);
		const queue = [pid];

		// Find all downstream descendants
		while (queue.length > 0) {
			const current = queue.shift();
			this.state.triplets.forEach(t => {
				if ((t.predicate === 'MotherOf' || t.predicate === 'FatherOf') && t.subject === current) {
					if (!toDelete.has(t.object)) {
						toDelete.add(t.object);
						queue.push(t.object);
					}
				}
				if (t.predicate === 'ChildOf' && t.object === current) {
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

		if (toDelete.has(this.state.selectedPid)) {
			this.state.selectedPid = null;
		}
		this.isDirty = true;
	}

	addTriplet(subject, predicate, object) {
		this.saveState();
		this.state.triplets.push({ subject, predicate, object });
		if (predicate === "SpouseOf") {
			// Automatically add reciprocal
			const exists = this.state.triplets.some(t => t.subject === object && t.predicate === "SpouseOf" && t.object === subject);
			if (!exists) {
				this.state.triplets.push({ subject: object, predicate: "SpouseOf", object: subject });
			}
		}
		this.isDirty = true;
	}

	removeTriplet(subject, predicate, object) {
		this.saveState();
		const initialLen = this.state.triplets.length;
		this.state.triplets = this.state.triplets.filter(t => !(t.subject === subject && t.predicate === predicate && t.object === object));

		// If it was SpouseOf and we actually removed one, try removing reciprocal
		if (predicate === "SpouseOf" && this.state.triplets.length < initialLen) {
			this.state.triplets = this.state.triplets.filter(t => !(t.subject === object && t.predicate === "SpouseOf" && t.object === subject));
		}
		this.isDirty = true;
	}

	getNode(pid) {
		return this.state.nodes.find(n => n.person_id === pid) || null;
	}

	getRelationships(pid) {
		return this.state.triplets.filter(t => t.subject === pid);
	}

	getGenderPath(gender) {
		if (!gender) return this.circlePath;
		const g = gender.toLowerCase();
		if (g === 'female' || g === 'f') return this.femalePath;
		if (g === 'male' || g === 'm') return this.malePath;
		return this.circlePath;
	}

	syncEditorToNode(node) {
		const container = $('#person-editor-container');
		if (!container.length) return;

		container.find('.vpe-row').each(function () {
			const label = $(this).find('.vpe-field-label').text().trim().toLowerCase();
			const val = $(this).find('.vpe-chip').text().trim() || null;

			if (label === 'first name') node.first_name = val || "";
			else if (label === 'last name') node.last_name = val || "";
			else if (label === 'nick name') node.norm_first_name = val || "";
			else if (label === 'suffix') node.suffix = val || "";
			else if (label === 'race') node.race = val || "";
			else if (label === 'gender') node.gender = val || "male";
			else if (label === 'birth year') node.birth_year = val ? parseInt(val) : null;
			else if (label === 'death year') node.death_year = val ? parseInt(val) : null;
		});

		// Re-render tree nodes and edges
		this.renderNodes();
		this.renderEdges();
	}

	renderNodes() {
		// Bind data mapped against visibility
		const visibleSet = this.getVisibleNodes();
		const vNodes = this.state.nodes.filter(n => visibleSet.has(n.person_id));

		const nodeSelection = this.gNodes.selectAll(".node-group")
			.data(vNodes, d => d.person_id);

		// Enter selection
		const nodeEnter = nodeSelection.enter()
			.append("g")
			.attr("class", "node-group")
			.attr("transform", d => `translate(${d.x},${d.y})`)
			.call(this.drag);

		// 1. Background Shape (Gendered Silhouette)
		nodeEnter.append("path")
			.attr("class", "node-bg")
			.attr("d", d => this.getGenderPath(d.gender))
			.attr("transform", "translate(22, 0) scale(1.16)")
			.attr("fill", "#f5d506d9")
			.attr("stroke", "#999999")
			.attr("stroke-width", 1)
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
			.attr("fill", "#333")
			.text(d => (d.first_name || "?") + " " + (d.last_name || ""));

		// 4. Year range
		nodeEnter.append("text")
			.attr("class", "node-years")
			.attr("x", this.nodeWidth / 2)
			.attr("y", 103)
			.attr("text-anchor", "middle")
			.attr("font-size", "6px")
			.attr("fill", "#666")
			.text(d => {
				const by = d.birth_year ? d.birth_year : "?";
				const dy = d.death_year ? d.death_year : "?";
				return `${by} – ${dy}`;
			});

		// 5. Small '+' button (over dates)
		const plusGroup = nodeEnter.append("g")
			.attr("transform", `translate(${this.nodeWidth / 2}, 90)`)
			.style("cursor", "pointer")
			.on("mousedown", e => e.stopPropagation())
			.on("click", (e, d) => {
				e.stopPropagation();
				const targetName = (d.first_name || "") + " " + (d.last_name || "");
				document.getElementById("add-node-target-name").innerText = targetName.trim() || d.person_id;
				document.getElementById("add-node-modal").dataset.sourcePid = d.person_id;
				document.getElementById("add-node-modal").showModal();
			});

		plusGroup.append("circle")
			.attr("r", 4)
			.attr("fill", "white")
			.attr("stroke", "#999");

		plusGroup.append("text")
			.attr("text-anchor", "middle")
			.attr("y", 2)
			.attr("font-size", "7px")
			.attr("font-weight", "bold")
			.attr("fill", "#2ecc71")
			.text("+");

		// 6. Expand/Collapse triangles
		const trianglesGroup = nodeEnter.append("g").attr("class", "triangles");

		trianglesGroup.append("polygon")
			.attr("class", "tri-right")
			.attr("points", "0,-3 6,0 0,3")
			.attr("transform", `translate(${this.nodeWidth - 10}, ${this.nodeHeight / 2})`)
			.attr("fill", "#999")
			.style("display", "none")
			.on("mousedown", e => e.stopPropagation())
			.on("click", (e, d) => {
				e.stopPropagation();
				d.hiddenDirs = d.hiddenDirs || { top: false, bottom: false, left: false, right: false };
				d.hiddenDirs.right = !d.hiddenDirs.right;
				this.applyLayout(); this.renderNodes(); this.renderEdges();
			});

		trianglesGroup.append("polygon")
			.attr("class", "tri-left")
			.attr("points", "6,-3 0,0 6,3")
			.attr("transform", `translate(10, ${this.nodeHeight / 2})`)
			.attr("fill", "#999")
			.style("display", "none")
			.on("mousedown", e => e.stopPropagation())
			.on("click", (e, d) => {
				e.stopPropagation();
				d.hiddenDirs = d.hiddenDirs || { top: false, bottom: false, left: false, right: false };
				d.hiddenDirs.left = !d.hiddenDirs.left;
				this.applyLayout(); this.renderNodes(); this.renderEdges();
			});

		trianglesGroup.append("polygon")
			.attr("class", "tri-bottom")
			.attr("points", "-3,3 3,3 0,-3")
			.attr("transform", `translate(${this.nodeWidth / 2}, ${this.nodeHeight - 7})`)
			.attr("fill", "#999")
			.style("display", "none")
			.on("mousedown", e => e.stopPropagation())
			.on("click", (e, d) => {
				e.stopPropagation();
				d.hiddenDirs = d.hiddenDirs || { top: false, bottom: false, left: false, right: false };
				d.hiddenDirs.bottom = !d.hiddenDirs.bottom;
				this.applyLayout(); this.renderNodes(); this.renderEdges();
			});

		trianglesGroup.append("polygon")
			.attr("class", "tri-top")
			.attr("points", "-3,3 3,3 0,-3")
			.attr("transform", `translate(${this.nodeWidth / 2}, 8)`)
			.attr("fill", "#999")
			.style("display", "none")
			.on("mousedown", e => e.stopPropagation())
			.on("click", (e, d) => {
				e.stopPropagation();
				d.hiddenDirs = d.hiddenDirs || { top: false, bottom: false, left: false, right: false };
				d.hiddenDirs.top = !d.hiddenDirs.top;
				this.applyLayout(); this.renderNodes(); this.renderEdges();
			});

		const nodeUpdate = nodeSelection.merge(nodeEnter);
		nodeUpdate.attr("transform", d => `translate(${d.x},${d.y})`);

		// Update core node editable data elements
		nodeUpdate.select(".node-name").text(d => (d.first_name || "?") + " " + (d.last_name || ""));
		nodeUpdate.select(".node-years").text(d => {
			const by = d.birth_year ? d.birth_year : "?";
			const dy = d.death_year ? d.death_year : "?";
			return `${by} – ${dy}`;
		});
		nodeUpdate.select(".node-bg")
			.attr("d", d => this.getGenderPath(d.gender))
			.attr("fill", "#ffe0b2");

		// Update triangle fill colors if they are actively hiding a branch
		nodeUpdate.select(".tri-right").attr("fill", d => d.hiddenDirs && d.hiddenDirs.right ? "green" : "#999");
		nodeUpdate.select(".tri-left").attr("fill", d => d.hiddenDirs && d.hiddenDirs.left ? "green" : "#999");
		nodeUpdate.select(".tri-bottom")
			.attr("fill", d => d.hiddenDirs && d.hiddenDirs.bottom ? "green" : "#999")
			.attr("points", d => d.hiddenDirs && d.hiddenDirs.bottom ? "-3,-3 3,-3 0,3" : "-3,3 3,3 0,-3");
		nodeUpdate.select(".tri-top").attr("fill", d => d.hiddenDirs && d.hiddenDirs.top ? "green" : "#999");

		nodeSelection.exit().remove();

		this.updateNodeSelection();
	}

	updateTriangleVisibility() {
		this.gNodes.selectAll(".node-group").each(function (d) {
			let hasBottomEdge = false;

			this.state.triplets.forEach(t => {
				if (t.subject === d.person_id || t.object === d.person_id) {
					if (t.predicate === 'MotherOf' || t.predicate === 'FatherOf') {
						if (t.subject === d.person_id) hasBottomEdge = true;		// parent to child -> bottom
					} else if (t.predicate === 'ChildOf') {
						if (t.object === d.person_id) hasBottomEdge = true;		// parent to child -> bottom
					}
				}
			});

			const group = d3.select(e.currentTarget);
			group.select(".tri-right").style("display", "none");
			group.select(".tri-left").style("display", "none");
			group.select(".tri-bottom").style("display", hasBottomEdge ? "block" : "none");
			group.select(".tri-top").style("display", "none");
		});
	}

	updateNodeSelection() {
		this.gNodes.selectAll(".node-bg")
			.attr("stroke", d => d.person_id === this.state.selectedPid ? "#2ecc71" : "#999999")
			.attr("stroke-width", 1);
	}

	fitToScreen(duration = 500) {
		const visibleSet = this.getVisibleNodes();
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
			4																	// Cap at max this.zoom scale (4)
		);

		const finalScale = Math.max(scale, 0.1);

		// Center the bounding box in the container
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

	applyLayout() {
		const visibleSet = this.getVisibleNodes();
		const vNodes = this.state.nodes.filter(n => visibleSet.has(n.person_id));
		const vTriplets = this.state.triplets.filter(t => visibleSet.has(t.subject) && visibleSet.has(t.object));

		const parentsOf = {};
		const childrenOf = {};
		const spousesOf = {};
		const cousinsOf = {};

		vNodes.forEach(n => {
			parentsOf[n.person_id] = [];
			childrenOf[n.person_id] = [];
			spousesOf[n.person_id] = [];
			cousinsOf[n.person_id] = [];
		});

		vTriplets.forEach(t => {
			if (t.predicate === 'MotherOf' || t.predicate === 'FatherOf') {
				parentsOf[t.object].push(t.subject);
				childrenOf[t.subject].push(t.object);
			} else if (t.predicate === 'ChildOf') {
				parentsOf[t.subject].push(t.object);
				childrenOf[t.object].push(t.subject);
			}
			if (t.predicate === 'SpouseOf') {
				spousesOf[t.subject].push(t.object);
			}
			if (t.predicate === 'CousinOf') {
				cousinsOf[t.subject].push(t.object);
			}
		});

		const depths = {};
		const queue = [];

		vNodes.forEach(n => {
			if (parentsOf[n.person_id].length === 0) {
				depths[n.person_id] = 0;
				queue.push(n.person_id);
			}
		});

		while (queue.length > 0) {
			const curr = queue.shift();
			const d = depths[curr];
			childrenOf[curr].forEach(child => {
				if (depths[child] === undefined || depths[child] < d + 1) {
					depths[child] = d + 1;
					queue.push(child);
				}
			});
			spousesOf[curr].forEach(spouse => {
				if (depths[spouse] === undefined || depths[spouse] < d) {
					depths[spouse] = d;
					queue.push(spouse);
				}
			});
			cousinsOf[curr].forEach(cousin => {
				if (depths[cousin] === undefined || depths[cousin] < d) {
					depths[cousin] = d;
					queue.push(cousin);
				}
			});
		}

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

		Object.keys(nodesByDepth).sort().forEach((dStr, rowIdx) => {
			const d = parseInt(dStr);
			const pids = nodesByDepth[d];

			let currentX = startX;
			const placed = new Set();

			pids.forEach(pid => {
				if (placed.has(pid)) return;
				const node = this.getNode(pid);
				if (!node.moved) {
					node.x = currentX;
					node.y = startY + rowIdx * ySpacing;
				} else {
					// Optionally handle currentX if we want alignment to respect moved nodes later
					// For now just skip overwriting coordinates
				}
				placed.add(pid);
				currentX += xSpacing;

				spousesOf[pid].forEach(spid => {
					if (!placed.has(spid) && depths[spid] === d) {
						const snode = this.getNode(spid);
						if (snode) {
							currentX -= xSpacing;									// Undo standard gap
							currentX += this.nodeWidth + 20;							// Snug 20px physical gap between spouses
							if (!snode.moved) {
								snode.x = currentX;
								snode.y = startY + rowIdx * ySpacing;
							}
							placed.add(spid);
							currentX += xSpacing;									// Resume standard spacing
						}
					}
				});

				cousinsOf[pid].forEach(cid => {
					if (!placed.has(cid) && depths[cid] === d) {
						const cnode = this.getNode(cid);
						if (cnode) {
							if (!cnode.moved) {
								cnode.x = currentX;
								cnode.y = startY + rowIdx * ySpacing;
							}
							placed.add(cid);
							currentX += xSpacing;
						}
					}
				});
			});
		});

	}

	getAnchors(node) {
		const g = (node.gender || "unknown").toLowerCase();
		let lx, rx, y;

		if (g === 'female' || g === 'f') {
			lx = node.x + 60;
			rx = node.x + 100;
			y = node.y + 81;
		} else if (g === 'male' || g === 'm') {
			lx = node.x + 49;
			rx = node.x + 111;
			y = node.y + 81;
		} else {
			lx = node.x + 34;
			rx = node.x + 126;
			y = node.y + 58;
		}
		return {
			left: { x: lx, y: y, dir: [-1, 0] },
			right: { x: rx, y: y, dir: [1, 0] }
		};
	}

	drawSmartCurve(source, target) {
		const cy1 = source.y + this.nodeHeight / 2;
		const cy2 = target.y + this.nodeHeight / 2;

		// 1. Same horizontal line check (close to being horizontal)
		if (Math.abs(cy1 - cy2) < 50) {
			let s = source, t = target;
			if (source.x > target.x) { s = target; t = source; }						// s is left
			const startX = this.getAnchors(s).right.x;
			const startY = this.getAnchors(s).right.y;
			const endX = this.getAnchors(t).left.x;
			const endY = this.getAnchors(t).left.y;

			const cp1X = startX + 30;
			const cp2X = endX - 30;
			return `M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`;
		}

		// 2. Otherwise, connect closest sides
		const a1 = this.getAnchors(source);
		const a2 = this.getAnchors(target);
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

	renderEdges() {
		const visibleSet = this.getVisibleNodes();

		const edgeData = [];
		const seenSpouses = new Set();
		const seenSiblings = new Set();
		const seenExtended = new Set();
		const childToParents = {};

		const vTriplets = this.state.triplets.filter(t => visibleSet.has(t.subject) && visibleSet.has(t.object));

		vTriplets.forEach(t => {
			const s = this.getNode(t.subject);
			const o = this.getNode(t.object);
			if (!s || !o) return;

			if (t.predicate === 'SpouseOf') {
				const pairKey = [t.subject, t.object].sort().join("-");
				if (seenSpouses.has(pairKey)) return;
				seenSpouses.add(pairKey);
				edgeData.push({ type: 'SpouseOf', source: s, target: o, id: pairKey });
			} else if (t.predicate === 'SiblingOf') {
				const pairKey = [t.subject, t.object].sort().join("-");
				if (seenSiblings.has(pairKey)) return;
				seenSiblings.add(pairKey);
				edgeData.push({ type: 'SiblingOf', source: s, target: o, id: pairKey + '-Sibling' });
			} else if (t.predicate === 'CousinOf' || t.predicate === 'UncleOf' || t.predicate === 'AuntOf' || t.predicate === 'NiblingOf') {
				const pairKey = [t.subject, t.object].sort().join("-");
				if (seenExtended.has(pairKey)) return;
				seenExtended.add(pairKey);
				edgeData.push({ type: 'ExtendedOf', source: s, target: o, id: pairKey + '-Extended' });
			} else if (t.predicate === 'MotherOf' || t.predicate === 'FatherOf' || t.predicate === 'ChildOf') {
				let parent = s, child = o;
				if (t.predicate === 'ChildOf') { parent = o; child = s; }

				if (!childToParents[child.person_id]) childToParents[child.person_id] = [];
				if (!childToParents[child.person_id].includes(parent.person_id)) {
					childToParents[child.person_id].push(parent.person_id);
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
			const parents = fam.parents.map(pid => this.getNode(pid)).filter(Boolean);
			const children = fam.children.map(pid => this.getNode(pid)).filter(Boolean);
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
		edgeGroups.filter(d => d.type === 'SpouseOf')
			.append("path")
			.attr("class", "spouse-bg")
			.attr("fill", "none")
			.attr("stroke", "#999999")
			.attr("stroke-width", 3)
			.attr("d", d => this.drawSmartCurve(d.source, d.target));

		edgeGroups.filter(d => d.type === 'SpouseOf')
			.append("path")
			.attr("class", "spouse-fg")
			.attr("fill", "none")
			.attr("stroke", "var(--canvas-bg, #e5e5e5)")
			.attr("stroke-width", 1)
			.attr("d", d => this.drawSmartCurve(d.source, d.target));

		// Family Pedigree (parent→child lines)
		edgeGroups.filter(d => d.type === 'FamilyPedigree')
			.append("path")
			.attr("class", "parent-child-line")
			.attr("fill", "none")
			.attr("stroke", "#666666")
			.attr("stroke-width", 1)
			.attr("stroke-linejoin", "round")
			.attr("d", d => {
				let parentX, parentY;
				if (d.parents.length === 1) {
					const p = d.parents[0];
					const avgChildX = d.children.reduce((sum, c) => sum + c.x, 0) / d.children.length;
					if (avgChildX > p.x) {
						parentX = this.getAnchors(p).right.x;
					} else {
						parentX = this.getAnchors(p).left.x;
					}
					parentY = this.getAnchors(p).right.y;
				} else {
					const minPx = Math.min(...d.parents.map(p => p.x));
					const maxPx = Math.max(...d.parents.map(p => p.x));
					parentX = minPx + (maxPx - minPx) / 2 + this.nodeWidth / 2;
					parentY = Math.max(...d.parents.map(p => this.getAnchors(p).right.y));
				}

				let pathStr = "";
				d.children.forEach(c => {
					const isRight = c.x > parentX;
					const anchors = this.getAnchors(c);
					const cx = isRight ? anchors.left.x : anchors.right.x;
					const cy = anchors.left.y;

					if (d.parents.length > 1) {
						// Start with a vertical drop, swing gracefully into a horizontal entry (sigmoid S-curve)
						const dx = Math.abs(cx - parentX);
						const cp2X = isRight ? cx - dx / 2 : cx + dx / 2;
						const midY = parentY + (cy - parentY) / 2;
						pathStr += `M ${parentX} ${parentY} C ${parentX} ${midY}, ${cp2X} ${cy}, ${cx} ${cy} `;
					} else {
						// Horizontal to horizontal sigmoid S-curve
						const dx = cx - parentX;
						const cp1X = parentX + dx / 2;
						const cp2X = cx - dx / 2;
						pathStr += `M ${parentX} ${parentY} C ${cp1X} ${parentY}, ${cp2X} ${cy}, ${cx} ${cy} `;
					}
				});
				return pathStr;
			});

		// Family Pedigree (Junction Circle)
		edgeGroups.filter(d => d.type === 'FamilyPedigree' && d.parents.length > 1)
			.append("circle")
			.attr("class", "family-junction")
			.attr("r", 1.5)
			.attr("fill", "#666666")
			.attr("cx", d => {
				const minPx = Math.min(...d.parents.map(p => p.x));
				const maxPx = Math.max(...d.parents.map(p => p.x));
				return minPx + (maxPx - minPx) / 2 + this.nodeWidth / 2;
			})
			.attr("cy", d => Math.max(...d.parents.map(p => this.getAnchors(p).right.y)));

		// Sibling
		edgeGroups.filter(d => d.type === 'SiblingOf')
			.append("path")
			.attr("class", "sibling-line")
			.attr("fill", "none")
			.attr("stroke", "#666666")
			.attr("stroke-width", 1)
			.attr("stroke-dasharray", "5,5")
			.attr("d", d => this.drawSmartCurve(d.source, d.target));

		// Extended relationships
		edgeGroups.filter(d => d.type === 'ExtendedOf')
			.append("path")
			.attr("class", "extended-line")
			.attr("fill", "none")
			.attr("stroke", "#666666")
			.attr("stroke-width", 1)
			.attr("stroke-dasharray", "2,4")
			.attr("d", d => this.drawSmartCurve(d.source, d.target));

		if (typeof updateTriangleVisibility !== 'undefined') this.updateTriangleVisibility();
	}

	handleLinkTargetClick(targetPid) {
		this.linkMode = false;
		document.getElementById("link-banner").style.display = "none";
		const targetNode = this.getNode(targetPid);
		if (!targetNode) return;

		document.getElementById("pred-target-name").innerText = targetNode.first_name + " " + targetNode.last_name;
		document.getElementById("predicate-modal").dataset.target = targetPid;
		document.getElementById("predicate-modal").showModal();
	}



	selectNodeAndShowEditor(personId) {
		if (window.app && typeof window.app.selectNodeAndShowEditor === 'function') {
			window.app.selectNodeAndShowEditor(personId);
		}
	}
}

window.treeApp = new TreeApp();
