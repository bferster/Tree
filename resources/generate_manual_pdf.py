import os
import subprocess

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Verité Family Tree Editor: Detailed User Manual</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #2c3e50;
            line-height: 1.6;
            margin: 45px;
            background: #fff;
        }
        h1 {
            font-size: 28px;
            font-weight: 700;
            color: #1a365d;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 12px;
            margin-top: 0;
            text-align: center;
        }
        h2 {
            font-size: 16px;
            font-weight: 600;
            color: #2b6cb0;
            margin-top: 25px;
            border-bottom: 1px solid #edf2f7;
            padding-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        h3 {
            font-size: 14px;
            font-weight: 600;
            color: #2d3748;
            margin-top: 15px;
        }
        p {
            font-size: 13.5px;
            color: #4a5568;
            margin: 8px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 12px;
        }
        th, td {
            border: 1px solid #cbd5e0;
            padding: 8px 10px;
            text-align: left;
        }
        th {
            background-color: #f7fafc;
            color: #2d3748;
            font-weight: 600;
        }
        tr:nth-child(even) {
            background-color: #fcfcfc;
        }
        .note-box {
            background-color: #ebf8ff;
            border-left: 4px solid #3182ce;
            padding: 12px 16px;
            margin: 18px 0;
            border-radius: 0 6px 6px 0;
            font-size: 13px;
        }
        .note-box strong {
            color: #2b6cb0;
        }
        .shortcut {
            background: #edf2f7;
            padding: 2px 5px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 11px;
            border: 1px solid #cbd5e0;
        }
        .color-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 500;
            margin-right: 5px;
            border: 0.5px solid rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>

    <h1>Verité Family Tree Editor<br><span style="font-size: 18px; font-weight: 400; color: #718096;">Complete Operations & User Reference Manual</span></h1>

    <h2>1. Introduction & Layout Structure</h2>
    <p>Verité is an advanced desktop-style genealogical software designed for visual family tree modeling, data alignment, and matching profiles against historical documents/mentions. The workspace is divided into two primary columns:</p>
    <ul>
        <li><strong>Left Column (Family Tree Canvas)</strong>: An SVG canvas using D3 force-directed layout to display family nodes. Male nodes are colored blue, female nodes are orange, and gender-neutral nodes are circular. Relationships are rendered as directed edges.</li>
        <li><strong>Right Column (Detail Editors)</strong>: A dynamic tabbed interface:
            <ul>
                <li><strong>Person Editor</strong>: Controls details, data integration rules, and source configurations for the selected individual.</li>
                <li><strong>Mentions Editor</strong>: Reviews, evaluates, and merges scored matching document records into the selected tree profile.</li>
                <li><strong>Sources</strong>: Hosts an interactive search portal to query available database archives.</li>
            </ul>
        </li>
    </ul>

    <h2>2. Field Color Codes & Meaning</h2>
    <p>Verité uses a consistent, harmonic color scheme throughout the application to visually link variables and parameters. The color badges for individual data factors are:</p>
    <div>
        <span class="color-badge" style="background:#EEEDFE; color:#26215C;">First name</span>
        <span class="color-badge" style="background:#E8EAF6; color:#1A237E;">Middle name</span>
        <span class="color-badge" style="background:#FBEAF0; color:#4B1528;">Nick name</span>
        <span class="color-badge" style="background:#E1F5EE; color:#04342C;">Last name</span>
        <span class="color-badge" style="background:#FAECE7; color:#4A1B0C;">NYSIIS</span>
        <span class="color-badge" style="background:#FFF3E0; color:#E65100;">Soundex</span>
        <span class="color-badge" style="background:#FCEFD9; color:#4A2E07;">Suffix</span>
        <span class="color-badge" style="background:#EFEBE9; color:#3E2723;">Race</span>
        <span class="color-badge" style="background:#E0F7FA; color:#006064;">Gender</span>
        <span class="color-badge" style="background:#E6F1FB; color:#042C53;">Birth year</span>
        <span class="color-badge" style="background:#F9FBE7; color:#827717;">Death year</span>
        <span class="color-badge" style="background:#E5F4E9; color:#0F3D1F;">Linked people</span>
    </div>

    <h2>3. Menu Reference & File Exports</h2>
    <p>The top menubar provides typical desktop options:</p>
    <ul>
        <li><strong>File Menu</strong>:
            <ul>
                <li><strong>New</strong>: Reset canvas and start a blank tree workspace.</li>
                <li><strong>Export &gt; GEDCOM</strong>: Export the current tree structure to the industry-standard GEDCOM format for import into other family tree applications.</li>
                <li><strong>Export &gt; RDF</strong>: Export the tree as graph database Resource Description Framework (RDF) triples.</li>
            </ul>
        </li>
        <li><strong>Edit Menu</strong>:
            <ul>
                <li><strong>Undo (<span class="shortcut">Ctrl+Z</span>)</strong>: Step backward through node placements and changes.</li>
                <li><strong>Redo (<span class="shortcut">Ctrl+Y</span>)</strong>: Step forward through undone changes.</li>
                <li><strong>Add person</strong>: Creates a new related node connected to the active node.</li>
                <li><strong>Remove person</strong>: Delete selected person and remove their relationship connections.</li>
            </ul>
        </li>
        <li><strong>View Menu</strong>: Includes canvas zoom controls, Fit to Screen, Reset Layout, and toggles the Notepad.</li>
    </ul>

    <h2>4. Matching & Scoring Rules</h2>
    <h3>A. The Blocking Step</h3>
    <p>Before any similarity scores are computed, candidates must pass hard constraints. A mention is filtered out immediately if:</p>
    <ul>
        <li>It does not belong to the selected list of search sources.</li>
        <li>Its gender does not match the target profile.</li>
        <li>Its race does not match the target profile (if race comparison is enabled).</li>
        <li>The mention source year and the target birth year differ by more than 75 years (chronological check).</li>
    </ul>

    <h3>B. Smart Name Cascade (When Smart Name Checked)</h3>
    <p>Smart Name evaluates names as a collective group, taking into account common nicknames and phonetic overlays. It runs the following priority check:</p>
    <ol>
        <li>Exact match on first, middle, and last name: <strong>1.00</strong></li>
        <li>Exact match on first and last name: <strong>0.95</strong></li>
        <li>Exact match on initials or normalized nickname: <strong>0.90</strong></li>
        <li>Jaro-Winkler above threshold on first and last names: <strong>0.70</strong></li>
        <li>Phonetic sound match via NYSIIS: <strong>0.60</strong></li>
        <li>Phonetic sound match via Soundex: <strong>0.50</strong></li>
    </ol>

    <h3>C. Individual/Year Factor Scoring</h3>
    <p>If Smart Name is off, name fields are scored individually based on settings (Exact = 1.0, Fuzzy Jaro-Winkler = JW score). Chronological year fields are scored via band matching (ScoreYear):</p>
    <table>
        <thead>
            <tr>
                <th>Year Distance</th>
                <th>±1 yr Option</th>
                <th>±2 yrs Option</th>
                <th>±3 yrs Option</th>
                <th>±5 yrs Option</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>Exact Match</strong></td>
                <td>1.0</td>
                <td>1.0</td>
                <td>1.0</td>
                <td>1.0</td>
            </tr>
            <tr>
                <td><strong>1 year off</strong></td>
                <td>0.8</td>
                <td>0.8</td>
                <td>0.8</td>
                <td>0.8</td>
            </tr>
            <tr>
                <td><strong>2 years off</strong></td>
                <td>0.0</td>
                <td>0.7</td>
                <td>0.7</td>
                <td>0.7</td>
            </tr>
            <tr>
                <td><strong>3 years off</strong></td>
                <td>0.0</td>
                <td>0.0</td>
                <td>0.6</td>
                <td>0.6</td>
            </tr>
            <tr>
                <td><strong>5 years off</strong></td>
                <td>0.0</td>
                <td>0.0</td>
                <td>0.0</td>
                <td>0.5</td>
            </tr>
        </tbody>
    </table>

    <h2>5. Linking Records & Profile Verification</h2>
    <ul>
        <li><strong>Scored Mention List</strong>: Mentions tab displays candidates ordered by overall score. Click any mention to inspect details.</li>
        <li><strong>Merging Details</strong>: Review individual fields in the comparison grid. The bottom box shows original JSON data stored on the server.</li>
        <li><strong>Link a Mention</strong>: Clicking <strong>Add to person</strong> merges the record's mention ID into the tree profile.</li>
        <li><strong>Verity Star Display</strong>: The verity indicator (1-4 stars) visually reflects the statistical likelihood/confidence rating of the profile representation.</li>
    </ul>

    <h2>6. Resizable Notepad & Tools</h2>
    <p>The Notepad allows persistent research notes. To open it, click <strong>View &gt; Notepad</strong>. You can drag it by its header and drag its bottom/sides to resize. Its contents are saved to the project data automatically.</p>

</body>
</html>
"""

artifact_dir = r"C:\\Users\\bfers\\.gemini\\antigravity-ide\\brain\\ab77759a-bf28-4ce5-a4a0-e06d53d945b5"
html_path = os.path.join(artifact_dir, "verite_user_manual.html")
pdf_path = os.path.join(artifact_dir, "verite_user_manual.pdf")

# Write HTML file
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Generated HTML manual template at: {html_path}")

# Run headless Chrome to convert HTML to PDF
chrome_path = r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
cmd = [
    chrome_path,
    "--headless",
    "--disable-gpu",
    f"--print-to-pdf={pdf_path}",
    html_path
]

try:
    subprocess.run(cmd, check=True)
    print(f"Successfully generated PDF manual at: {pdf_path}")
except Exception as e:
    print(f"Error during PDF generation: {e}")
