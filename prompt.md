 am an amateur genealogist who wants to trace my ancestry back to 1800. I may be Black or White, so I need to account for slavery. Much of the information may be unknown. 

The following is the entire project, but it will be implemented in phases, as defined after the overall project description.

**TASK**

Create a plain vanilla JavaScript web application, using no frameworks, that will help create an interactive and visually attractive tool to create, edit, and save my family tree, showing familial relationships. 

	Use Jquery and D3 libraries via CDN
	Use sql.js as a CDN for data storage in SQLite.
	Add a traditional menu bar at the top of the app with File, Edit, View, and Search menu options.
	The tree should be displayed on a virtual canvas that can be zoomed, panned, and scrolled.
	App’s name is “Verité editor”.

*DATA STRUCTURE*

	The internal data is organized as a directed acyclic graph, with each person a node and their relationships as edges.
	The data structure should mimic a traditional family tree structure.
	The structure should support multiple spouses for a person.
	pid is a unique identifier for the node.
	Node fields are:
		full_name
		birth_year
		death_year
		gender
		notes
		pid
	Relationships are stored as RDF triplets in subject, predicate, object order.
		Subjects and objects are referenced by pid fields
		Predicates are, along with “Is” or “Of”, depending on direction (i.e. AL2343 motherOf  AL64334)
			mother
			father
			spouse
			child
			sibling
			enslaver
		Relationships are stored in RDF format.

*NODES* 

	Shape of the node is based on gender fields
		If female, use a simple inline SVG silhouette of a woman.
		If male, use an inline SVG image of a man.
		If enslaved, color inside of the node light tan.
	Make nodes draggable and have sides still connect to other nodes.
	Each node should display:
		Gender, indicated by the node shape.
		Enslaved status by node’s internal color.
		Full name of person in BOLD font.
		Birth to death years or “present” if still alive. (i.e 1820 - present  or 1811 - 1890).
		A “+” button to add a new node using the same dialog box used to edit nodes.
		The nodes should be expandable and collapsible via triangle icons on the edges of the node that flip to show display status.
	Clicking on node sets that node as the current node and highlights it by changing the edge of the node’s color to green.
	Double-clicking on node brings up the node’s editing dialog.
	Clicking on the “Edit node” option in the “Edit” menu also brings up the current node’s editing dialog.

*EDITING NODES*

	When editing, bring up a dialog box to edit a node’s fields:
		“Relationship” is a pulldown list with one or more relationships.
			These are stored in the RDF relationships data as:
			Subject  - this node’s pid
			Predicate, one of the following:
				MotherOf
				FatherOf
				SpouseOf
				ChildOf
				SiblingOf
				EnslavedBy
				Remove
			Object - pid of object node
			Each relationship is a line in this scrollable list and displays as the predicate and object
			Clicking on the line brings highlights the object node
			Selecting the “Remove” option removes the triplet and line in relationship box
		A “+” icon is to the right of the relationship list
			When clicked, it will ask to select an object node, then ask to set the predicate
			A triple will be added to the RDF data and an entry added to the relationship list.
		“Gender” is set via radio buttons (Male, Female, or Unknown)
			“Name”, “pid”,  birth and death years edited via single line text box.
		“Notes” are edited by a multiple line textarea.
		A “Delete” button will delete the node and any triplets that reference it in the RDF data. It will ask if you are sure before deleting.

*EDGES*

	Draw curved lines to show the relationships between nodes:
	Double lines to connect spouses.
	Solid lines to connect children and parents.
	Dotted lines to connect siblings.
	Try to list children and siblings in a row together horizontally.
	Use a hierarchical/Sugiyama-style layout via D3's tree layout.

*SAVING, LOADING, EXPORTING, and UNDO*

	The tree can be saved or loaded as a flat file using SQLite:
		A list of email/password pairs is in the secure folder called “passwords.txt”
		Require a email and password that matches one in 
		Provide an option to reset password.
		Accessed from “Save”, “Load”, and “Save As..” options in the File menu.
	The tree can be exported in GEDCOM 5.5.5  basic export format for interchange with other apps to the computer's drive:
		Accessed from the “Export” option in the “File” menu.
	The tree can be exported in RDF turtle .ttl format on drive:
		Accessed from the “Export” option in the “File” menu.
	Support unlimited undo and redo using ctrl-z and ctrl-y:
		Accessed from “Undo” and “Redo” options in the “Edit” menu.
	Add “Search” option to “Data” menu:
		When clicked it opens a new tab to the link url “/.search”, which will launch searching options.

Implement this in phases. 

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

*Phase 1 — Static scaffold*

	HTML file with menu bar, empty canvas area, and edit button at bottom
	No functionality, just layout and CSS styling
	Confirms the visual structure looks right before any logic
	PHASE 1 prompt: 
		Create a single HTML file for a family tree web application. This is a static scaffold only — no JavaScript logic or functionality is needed yet, just structure and styling.
		Layout requirements:
			A traditional menu bar at the top with four menus: File, Edit, View, and Search.
			File menu items: New, Open, Save, Save As, Export (with submenu: GEDCOM, RDF), separator, Exit.
			Edit menu items: Undo, Redo, separator, Edit Node, Delete Node
			View menu items: Zoom In, Zoom Out, Fit to Screen, Reset Layout.
			Search menu item: opens placeholder alert for now.
		Below the menu bar, a large canvas area that fills the remaining. screen height, with a light gray background and a subtle grid pattern.
		App’s name is  “Verité editor”.
		Style requirements:
			Clean, modern sans-serif font throughout
			Menu bar should look like a traditional desktop application menu (not a navbar)
			The canvas area should feel like a workspace — not a webpage
			Use only vanilla CSS, no frameworks or external stylesheets
		Technical requirements:
			Single self-contained .html file
			Use jQuery (loaded from CDN) for any menu open/close interactions
			Menus should open and close on click, and close when clicking anywhere outside them.

*Phase 2 — Data model*

		A node represents a person with these fields:
			pid — unique identifier string (e.g. "P001"), generated automatically
			full_name — string
			birth_year — integer or null
			death_year — integer or null (null means still living)
			gender — string, one of: "male", "female", "unknown"
			enslaved — boolean
			notes — string
			x, y — canvas position coordinates (initialize to 0)

		Relationships are stored as RDF triplets, each with three fields:
			subject — pid of the subject node
			predicate — one of: "MotherOf", "FatherOf", "SpouseOf", "ChildOf", "SiblingOf", "EnslavedBy"
			object — pid of the object node

		Note: SpouseOf relationships are bidirectional and are the only exception to the DAG structure. When a SpouseOf triplet is added, automatically add the reciprocal triplet.
		
		The global state object should contain:
			nodes — array of node objects
			triplets — array of triplet objects
			selectedPid — pid of the currently selected node, or null

		Functions to implement:

			generatePid() — returns a unique pid string like "P001", incrementing each call
			addNode(fields) — creates a new node with given fields, adds to state, returns the new node
			editNode(pid, fields) — updates fields of the node with the given pid
			deleteNode(pid) — removes node and all triplets that reference it as subject or object
			addTriplet(subject, predicate, object) — adds triplet, with automatic reciprocal for SpouseOf
			removeTriplet(subject, predicate, object) — removes matching triplet, and reciprocal if SpouseOf
			getNode(pid) — returns the node object for a given pid
			getRelationships(pid) — returns all triplets where pid is the subject
			clearAll() — resets state to empty

		Undo/redo:
			Maintain an undo stack and a redo stack
			Before any state-changing operation, push a deep copy of the current state onto the undo stack and clear the redo stack
			undo() — pops from undo stack, pushes current state to redo stack, restores popped state
			redo() — pops from redo stack, pushes current state to undo stack, restores popped state
			Bind ctrl-z to undo() and ctrl-y to redo()
			There is no limit on undo/redo depth

		Verification:
			At the bottom of the script, write a runTests() function that exercises each function above and logs pass/fail results to the browser console. Call runTests() automatically on page load. Tests should cover:

			Adding two nodes and verifying they appear in state
			Editing a node and confirming the change
			Adding a SpouseOf triplet and confirming the reciprocal was created
			Deleting a node and confirming its triplets were also removed
			Undo and redo of a node addition

*Phase 3 — Rendering*

	Setup:
		Add D3 (v7) via CDN to the HTML file. 
		Create an SVG element inside the canvas area that fills its full width and height. 
		This SVG is the drawing surface for all nodes and edges.
		
	Zoom, pan, and scroll:
		Wrap all drawn content in a D3 group element (<g>). Apply D3 zoom behavior to the SVG so the user can:
			Scroll to zoom in and out
			Click and drag the background to pan
			The nodes move with the canvas, not independently

	Hardcoded test data:
		Before rendering, populate the state with the following four test nodes using the addNode() function from Phase 2. Do not remove this test data yet — it will be replaced in a later phase:
		
			Mary Johnson, born 1820, died 1890, female, enslaved
			James Johnson, born 1815, died 1878, male, enslaved
			Sarah Johnson, born 1845, death unknown, female, not enslaved
			Thomas Johnson, born 1842, died 1910, male, not enslaved
			Josh Johnson, born 1872, died 1940, male, not enslaved

	Position them at reasonable starting coordinates spread across the canvas (e.g. 200,200 / 500,200 / 200,450 / 500,450).
	
	Node rendering:
		Write a renderNodes() function that draws each node in the state as a D3 SVG group. Each node group should contain:
			A background rectangle (rounded corners, white fill, light gray border, width ~160px, height ~100px)
			A gender silhouette icon in the top-left corner of the node, drawn as a simple inline SVG path:
				Female: a simple rounded head and flared skirt silhouette
				Male: a simple rounded head and straight-shouldered silhouette
				Unknown: a plain circle
				Make size of silhouette 40px by 40px, and center within node.
				Merge head and body shape in male silouette, no separation between head and body.
				If the person is enslaved, fill the silhouette with light tan (#F5DEB3) instead of white.
			The year range below the name: formatted as "1820 – 1890" or "1842 – present" if death_year is null
			A small "+" button in the bottom-right corner of the node (render as a white circle with a black border and dark green plus sign )
		Small triangle icons on the sides of the node (for expand/collapse):
			Transgles should be drawn with in the node's area.
			If there is an edge connected to the right side of the node, the triangle should point right.
			If there is an edge connected to the left side of the node, the triangle should point left.
			If there are edges connected to both sides of the node, the triangle should point up.
			If there are no edges connected to the node, the triangle should not be rendered.
			If the edges connect siblings, the triangles on the sibling nodes should not be rendered.
			If a triangle has hidden nodes or edges, color it green, otherwise color it gray.

	Node selection:

		Clicking a node sets it as the selected node (state.selectedPid)
		The selected node's border changes to green (#2ecc71)
		Clicking the background deselects the current node

	Dragging:

		Each node should be draggable using D3 drag behavior
		Dragging updates the node's x and y in state
		The node moves smoothly with the drag
		Always place children below parents

	Rendering call:
		Call renderNodes() once on page load after the test data is added. No edges yet — those come in Phase 4.
		Verification checklist (manual, not automated):
		All four nodes are visible on the canvas
		Male and female silhouettes are visually distinct
		Enslaved nodes (Mary and James) have a tan background
		Clicking a node highlights its border green; clicking another moves the highlight
		Nodes can be dragged freely around the canvas
		Zooming and panning work smoothly without moving the nodes independently

*Phase 4 — Edges*

	Setup:
		Add the following relationships to the existing hardcoded test data using the addTriplet() function from Phase 2:
			Mary Johnson SpouseOf James Johnson
			Mary Johnson MotherOf Sarah Johnson
			Mary Johnson MotherOf Thomas Johnson
			James Johnson FatherOf Sarah Johnson
			James Johnson FatherOf Thomas Johnson
			Sarah Johnson SiblingOf Thomas Johnson
			Josh Johnson CousinOf Mary Johnson
	
	Edge rendering:
		Write a renderEdges() function that draws curved SVG paths between connected nodes. Edges must be drawn in a separate <g> layer that sits behind the node layer so edges never appear on top of nodes.
		Edge style by relationship type:
			SpouseOf — draw as two parallel curved lines close together (double line effect), color medium gray
			MotherOf / FatherOf / ChildOf — draw as a single solid curved line, color medium gray
			SiblingOf — draw as a single dashed curved line (stroke-dasharray), color medium gray
			UncleOf / AuntOf / NiblingOf / CousinOf — draw as a single dotted curved line (stroke-dasharray), color light gray

		Draw edges when nodes are first rendered and update them when nodes are dragged.
		Connect edges to the side closest to the connected node.
		If node is close to being on the same horizontal line as the connected node, draw the edge straight across.
		If connecting parents to children, draw the edge down and then draw a horizontal line across to connect the children.
				
	Edge routing:

		Use cubic bezier curves for all edges
		For parent-to-child edges, the curve should flow downward: exit the bottom center of the parent node and enter the top center of the child node
		For spouse edges, connect from the right side of the left node to the left side of the right node horizontally
		For sibling edges, connect nodes at the same horizontal level with a shallow curve above them
		Avoid rendering duplicate edges: since SpouseOf triplets are stored as reciprocal pairs, only draw one visual edge per spouse pair.
		Don't draw triangle on the side of the node if there is no edge connected to that side.
		
		Layout:
			Apply a basic hierarchical layout when renderEdges() is first called:
			Place the oldest generation (nodes with no parents in the triplet data) at the top
			Place each subsequent generation one level lower, spaced evenly
			Space siblings horizontally with enough room so nodes do not overlap (account for node width of ~160px plus padding)
			Spouses should be placed side by side on the same row
			Update each node's x and y in state to reflect the layout positions
			After layout, re-render nodes so they appear in their new positions

	Re-rendering on drag:
		Update the renderNodes() drag behavior so that when a node is dragged, renderEdges() is also called to redraw all edges in their updated positions. Edges should follow their connected nodes in real time during drag.
		
	Rendering call:
		Call renderEdges() once on page load after renderNodes(), so the initial layout and all edges are visible immediately.

*Phase 5 — Interactivity*

	Expand and collapse:
		Each node has a triangle icons on its from Phase 3. Wire it up now:
			Clicking the triangle toggles the node between expanded and collapsed states
			Add an expanded boolean field to each node in state (default true)
			When collapsed all nodes and edges connected to it should be hidden.
				When expanded, all nodes and edges connected to it should be visible.
		After toggling, re-render nodes and edges so layout adjusts cleanly

	Double-click to edit:
		Double-clicking a node opens a placeholder modal dialog
		The dialog should display the node's full name in the title and a close button
		The dialog does not need to be functional yet — full wiring happens in Phase 6
		Prevent the double-click from also triggering the single-click select behavior

	"+" button on nodes:
		Clicking the "+" button on a node opens the same placeholder modal dialog as double-click
		The dialog title should say "Add new person"
		Again, full wiring happens in Phase 6

	Edit menu wiring:
		Clicking "Edit Node" in the Edit menu opens the placeholder modal for the currently selected node
		If no node is selected, show a brief alert: "Please select a node first"

		After an undo or redo, call both renderNodes() and renderEdges() so the canvas updates to reflect the restored state

*Phase 6 — Dialog structure*

	Replace the placeholder modal with a fully styled dialog box containing the following sections:
	Top section — person fields:
		Full name: single-line text input
		PID: single-line text input (editable but must remain unique — show an inline error if a duplicate pid is entered)
		Birth year: single-line text input (numeric only)
		Death year: single-line text input (numeric only, leave blank if still living)
		Gender: three radio buttons labeled Male, Female, Unknown
		Enslaved: a single checkbox labeled "Enslaved"
		Notes: multi-line textarea

	Middle section — relationships:

		A scrollable list of all triplets where this node is the subject
		Each line displays as: [predicate] → [full name of object node] (e.g. "MotherOf → Sarah Johnson")
		Clicking a line in the list highlights the corresponding node on the canvas behind the dialog (change its border to orange temporarily)
		A "Remove" button below the list that removes the selected triplet from the RDF data (and its reciprocal if SpouseOf). Prompts "Are you sure?" before removing
		A "+" icon button to the right of the list header that adds a new relationship:
			Step 1: Close the dialog temporarily and prompt the user to click a node on the canvas to select the object node. Show a banner at the top of the screen saying "Click a node to link to, or press Escape to cancel"
			Step 2: Once a node is clicked, reopen the dialog and show a dropdown to select the predicate (MotherOf, FatherOf, SpouseOf, ChildOf, SiblingOf, EnslavedBy)
			Step 3: On confirm, call addTriplet() and refresh the relationship list

	Bottom section — action buttons:

		"Save" button: calls editNode() with the updated fields, closes the dialog, re-renders nodes and edges
		"Delete" button: prompts "Are you sure you want to delete [full name]?" — if confirmed, calls deleteNode(), closes the dialog, re-renders
		"Cancel" button: closes the dialog without saving any changes

		Opening the dialog:
			The dialog should open pre-populated with the current node's data when:
			A node is double-clicked
			The "+" button on a node is clicked (opens empty/blank form for a new node)
			"Edit Node" is selected from the Edit menu (opens for the currently selected node)
			When opened for a new node (via "+"), the Save button should call addNode() instead of editNode(), and after saving should add a SpouseOf, ChildOf, or other relationship back to the originating node if one was implied by which "+" button was clicked.
		
		Validation:
			Before saving, validate:
			Full name must not be empty
			Birth year must be a valid 4-digit number or blank
			Death year must be a valid 4-digit number or blank
			Death year must be greater than birth year if both are provided
			PID must be unique across all nodes
			Show inline error messages next to the relevant fields, do not use alerts

	Undo integration:
		All save, delete, and add operations triggered from this dialog must go through the existing state-mutation functions (addNode, editNode, deleteNode, addTriplet, removeTriplet) so that undo/redo continues to work correctly.

*Phase 7 — Save and Load*		

	Dependencies:
		Add the following CDN libraries to the HTML file if not already present:

		sql.js: https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js
		CryptoJS: https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js

		sql.js requires its WebAssembly file to be locatable. Add this initialization at startup:
			javascriptconst SQL = await initSqlJs({
		locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
		});
	
		Database schema:
			When saving, create a SQLite database in memory with the following tables:
				sqlCREATE TABLE nodes (
					pid TEXT PRIMARY KEY,
					full_name TEXT,
					birth_year INTEGER,
					death_year INTEGER,
					gender TEXT,
					enslaved INTEGER,
					notes TEXT,
					x REAL,
					y REAL,
					expanded INTEGER
					);

				CREATE TABLE triplets (
					subject TEXT,
					predicate TEXT,
					object TEXT
					);

				CREATE TABLE meta (
					key TEXT PRIMARY KEY,
					value TEXT
					);
	
		Insert a row into meta with key "version" and value "1.0".
	
		Saving:
		Write a saveToFile(filename) function that:

		Serializes the current state into the SQLite schema above
		Exports the database as a Uint8Array using db.export()
		Converts the array to a Base64 string
	Encrypts the Base64 string using CryptoJS AES with the user-supplied password
	Triggers a browser download of the encrypted result as a .ftree file

	Write a promptAndSave(filename) function that:
		Opens a small modal dialog asking for a password and password confirmation
		Validates that both fields match and are not empty, shows inline error if not
		On confirm, calls saveToFile(filename) with the entered password
		"Save" in the File menu calls promptAndSave() using the current filename (or "untitled" if none)
		"Save As" in the File menu calls promptAndSave() and prompts for a new filename first

	Loading:
		Write a loadFromFile() function that:
		Opens a file picker dialog filtered to .ftree files
		Reads the selected file as text
		Opens a small modal dialog asking for the password
		Decrypts the content using CryptoJS AES with the entered password
		If decryption fails or produces invalid data, shows an error message: "Incorrect password or corrupted file"
		Converts the decrypted Base64 string back to a Uint8Array
		Opens the database with sql.js and reads all rows from nodes and triplets tables
		Replaces the current state with the loaded data
		Calls renderNodes() and renderEdges() to redraw the canvas
		"Open" in the File menu calls loadFromFile()

	Password reset:
		Add a "Reset Password" option to the File menu. When clicked:
			Opens a dialog asking for the current file password and a new password (with confirmation)
			Decrypts the current in-memory database content with the old password to verify it
			If verification fails, shows an error: "Incorrect current password"
			If successful, re-encrypts the current state with the new password and triggers a download of the updated file

	New file:
		"New" in the File menu should:
			Prompt "Are you sure? Unsaved changes will be lost."
			If confirmed, call clearAll() and re-render the empty canvas
			Reset the current filename to "untitled"
			
	Dirty state tracking:
		Track whether the current state has unsaved changes with a boolean isDirty
		Set isDirty = true whenever any state-mutating function is called
		Set isDirty = false after a successful save
	If the user clicks "New" or tries to close the browser tab while isDirty is true, warn them with a confirmation prompt

	Verification checklist (manual):

	Saving produces a downloadable .ftree file
	The saved file is not human-readable (encrypted)
	Loading the file with the correct password restores all nodes and edges correctly
	Loading with an incorrect password shows the error message and does not change the canvas
	Save As prompts for a filename and saves correctly
	Reset Password produces a new file encrypted with the new password, loadable with the new password
	New with unsaved changes prompts before clearing
	Browser tab close with unsaved changes shows a warning
	Undo and redo still work correctly after a save/load cycle


Don’t implement any other phases yet!


