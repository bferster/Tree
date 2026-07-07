# Record search panel

* Add a button to the bottom left of the mentions editor labeled “Context”.
* When clicked it will run a new function called ShowSource()

*the ShowSource function*

	Plain vanilla JavaScript
	All code goes into @contextSearch.js file
	It takes the currently selected mention_id as its input.
	Use the VirtualGrid class to render the table.
	The entire contents of the selected source is shown as an interactive table in the “Source” tab, and displays that tab.
	The individual fields can be sorted by toggling their header.
	The row at that matches the input is scrolled to and highlighted.
	There is a search option at the top, and contains a text input field and a search button.

If clicked, the table is searched and the matched row is highlighted. Subsequent clicks will show the next match, until nothing is found.

Use this css, if needed and encapsulate in the @contextSearch.js file:

#source-grid-container {
    display: contents;
}


.pane-label {
    padding: 5px 10px;
    background: var(--header-bg);
    color: var(--header-text);
    font-weight: bold;
    font-size: 0.8rem;
    z-index: 50;
    display: flex;
    justify-content: space-between;
    border-radius: 6px;
    margin: 0 12px;
    align-items: center;
    flex-shrink: 0;
}


/* Grid Styles */
.data-grid {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: auto;
    width: max-content;
    font-size: .8rem;
}


.data-grid th {
    position: sticky;
    top: 0;
    z-index: 100;
    background: #dddddd;
    color: black;
    font-weight: bold;
    padding: 4px 8px;
    border: 1px solid #777;
    border-top: none;
    background-clip: padding-box;
    text-align: left;
    cursor: pointer;
    user-select: none;
    font-size: 0.8rem;
}


.resizer {
    position: absolute;
    top: 0;
    right: 0;
    width: 3px;
    cursor: col-resize;
    user-select: none;
    height: 100%;
    background-color: transparent;
    z-index: 101;
}


.resizer:hover {
    background-color: rgba(0, 0, 0, 0.2);
}


.data-grid td {
    padding: 2px 8px;
    border: 1px solid var(--border-color);
    border-top: none;
    border-left: none;
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}


.data-grid tr:nth-child(even) {
    background-color: #fafafa;
}


.data-grid tr:hover {
    background-color: #f1f1f1;
}


/* Search Pane */
#search-pane {
    background-color: var(--search-bg);
    padding: 10px;
    color: black;
    width: 200px;
    flex: 0 0 250px;
    border-right: 1px solid var(--border-color);
    overflow-y: auto;
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding-right: 16px;
}


.search-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 10px 0;
    width: 100%;
}


.field-unit {
    display: flex;
    flex-direction: row;
    gap: 6px;
    align-items: center;
    width: 100%;
}


.field-unit label {
    font-weight: normal;
    font-size: 0.75rem;
    color: black;
    white-space: nowrap;
    width: 80px;
    flex-shrink: 0;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
}


.field-unit input,
.field-unit select {
    padding: 2px 6px;
    border-radius: 3px;
    border: none;
    font-size: 0.8rem;
    flex: 1;
    min-width: 0;
}


.search-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: auto;
    padding-top: 15px;
    border-top: 1px solid #aaa;
}


.btn {
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: transform 0.1s ease;
    border: 1px solid transparent;
}


.btn:hover {
    transform: translateY(-1px);
}


.btn-search {
    background: #eaf2fb;
    color: #185fa5;
    border-color: #b5d4f4;
}


.btn-clear {
    background: #fbe9e7;
    color: #c0392b;
    border-color: #f5c6cb;
}


/* Results Display Pane */
#results-display-pane {
    flex-grow: 1;
    background-color: var(--results-bg);
    overflow: auto;
    position: relative;
    width: calc(100% - 32px);
    margin-left: 16px;
}


#results-grid-container {
    display: contents;
}


/* Loading Icon */
#loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}


.spinner {
    width: 50px;
    height: 50px;
    border: 5px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #fff;
    animation: spin 1s ease-in-out infinite;
}


@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}


