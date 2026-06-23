import os
import subprocess

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Verité Scoring System: ScoreMentions Explanation</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #2c3e50;
            line-height: 1.6;
            margin: 40px;
            background: #fff;
        }
        h1 {
            font-size: 26px;
            font-weight: 700;
            color: #1a365d;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 12px;
            margin-top: 0;
        }
        h2 {
            font-size: 20px;
            font-weight: 600;
            color: #2b6cb0;
            margin-top: 30px;
            border-bottom: 1px solid #edf2f7;
            padding-bottom: 6px;
        }
        h3 {
            font-size: 16px;
            font-weight: 600;
            color: #4a5568;
            margin-top: 20px;
        }
        p {
            font-size: 14px;
            color: #4a5568;
            margin: 10px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 13px;
        }
        th, td {
            border: 1px solid #cbd5e0;
            padding: 10px 12px;
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
            margin: 20px 0;
            border-radius: 0 6px 6px 0;
        }
        .note-box strong {
            color: #2b6cb0;
            display: block;
            margin-bottom: 4px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .note-box p {
            margin: 0;
            font-size: 13px;
        }
        ul {
            font-size: 14px;
            color: #4a5568;
            padding-left: 20px;
        }
        li {
            margin-bottom: 8px;
        }
        .diagram-container {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background: #fafbfe;
            padding: 20px 10px;
            margin: 25px 0;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.02);
        }
        .flow-step {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 15px;
            margin-bottom: 10px;
            font-size: 13px;
        }
        .flow-step strong {
            color: #2b6cb0;
        }
    </style>
</head>
<body>

    <h1>Verité Scoring & Matching System Explanation</h1>
    <p>This document explains the candidate match scoring and blocking processes implemented in the <code>App</code> and <code>Score</code> classes.</p>

    <h2>1. High-Level Overview</h2>
    <p>Before mentions are scored, the system performs a <strong>Blocking Step</strong> to filter out candidates that do not meet core requirements. This prevents unnecessary, heavy computations on irrelevant records. The pipeline is structured as follows:</p>
    <ol>
        <li><strong>Blocking Step (<code>MakeBlockedMentions</code>)</strong>: Filter raw mentions by source, gender, race, and age boundaries.</li>
        <li><strong>Scoring Step (<code>ScoreMentions</code>)</strong>: Calculate similarity scores for the remaining candidates using prioritized Smart Name or standard field evaluation, and sort the matches descending.</li>
    </ol>

    <h2>2. Process Flowchart</h2>
    <div class="diagram-container">
        <svg width="600" height="430" viewBox="0 0 600 430" style="display: block; margin: 0 auto; font-family: 'Inter', sans-serif; font-size: 11px;">
            <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#718096" />
                </marker>
            </defs>
            
            <!-- Start Node -->
            <rect x="220" y="10" width="160" height="30" rx="15" fill="#ebf8ff" stroke="#3182ce" stroke-width="1.5" />
            <text x="300" y="29" text-anchor="middle" font-weight="600" fill="#2b6cb0" font-size="12px">Start: Click Search Button</text>
            
            <!-- Connection 1 -->
            <line x1="300" y1="40" x2="300" y2="60" stroke="#718096" stroke-width="1.5" marker-end="url(#arrow)" />
            
            <!-- Blocking Node -->
            <rect x="180" y="60" width="240" height="40" rx="4" fill="#fed7d7" stroke="#e53e3e" stroke-width="1.5" />
            <text x="300" y="77" text-anchor="middle" font-weight="600" fill="#c53030" font-size="11px">BLOCKING: MakeBlockedMentions</text>
            <text x="300" y="91" text-anchor="middle" font-size="9px" fill="#e53e3e">Filter by Source, Race, Gender, Birth/Source Year (max 75 yr span)</text>

            <!-- Connection 2 -->
            <line x1="300" y1="100" x2="300" y2="120" stroke="#718096" stroke-width="1.5" marker-end="url(#arrow)" />

            <!-- Loop Node -->
            <rect x="200" y="120" width="200" height="30" rx="4" fill="#f7fafc" stroke="#4a5568" stroke-width="1.5" />
            <text x="300" y="139" text-anchor="middle" font-weight="500" fill="#2d3748" font-size="12px">Loop: For Each Blocked Candidate</text>
            
            <!-- Connection 3 -->
            <line x1="300" y1="150" x2="300" y2="170" stroke="#718096" stroke-width="1.5" marker-end="url(#arrow)" />
            
            <!-- Decision Node -->
            <rect x="200" y="170" width="200" height="35" rx="4" fill="#fffaf0" stroke="#dd6b20" stroke-width="1.5" />
            <text x="300" y="192" text-anchor="middle" font-weight="600" fill="#dd6b20" font-size="12px">Is Smart Name Enabled?</text>
            
            <!-- Yes Arrow (Left) -->
            <path d="M 200 187 L 120 187 L 120 220" fill="none" stroke="#718096" stroke-width="1.5" marker-end="url(#arrow)" />
            <text x="150" y="182" text-anchor="middle" font-weight="600" fill="#2b6cb0">Yes</text>
            
            <!-- No Arrow (Right) -->
            <path d="M 400 187 L 480 187 L 480 220" fill="none" stroke="#718096" stroke-width="1.5" marker-end="url(#arrow)" />
            <text x="450" y="182" text-anchor="middle" font-weight="600" fill="#e53e3e">No</text>
            
            <!-- Yes Action Node -->
            <rect x="30" y="220" width="180" height="40" rx="4" fill="#ebf8ff" stroke="#3182ce" stroke-width="1.5" />
            <text x="120" y="237" text-anchor="middle" font-weight="500" fill="#2b6cb0" font-size="11px">Compute Smart Name Score</text>
            <text x="120" y="251" text-anchor="middle" font-size="9px" fill="#4982c6">Fast prioritized cascade</text>
            
            <!-- No Action Node -->
            <rect x="390" y="220" width="180" height="40" rx="4" fill="#f7fafc" stroke="#4a5568" stroke-width="1.5" />
            <text x="480" y="237" text-anchor="middle" font-weight="500" fill="#2d3748" font-size="11px">Evaluate Fields Individually</text>
            <text x="480" y="251" text-anchor="middle" font-size="9px" fill="#718096">Exact / Fuzzy Jaro-Winkler</text>
            
            <!-- Yes Join Arrow -->
            <path d="M 120 260 L 120 285 L 240 285" fill="none" stroke="#718096" stroke-width="1.5" marker-end="url(#arrow)" />
            
            <!-- No Join Arrow -->
            <path d="M 480 260 L 480 285 L 360 285" fill="none" stroke="#718096" stroke-width="1.5" marker-end="url(#arrow)" />
            
            <!-- Common Evaluation Node -->
            <rect x="180" y="300" width="240" height="35" rx="4" fill="#f7fafc" stroke="#4a5568" stroke-width="1.5" />
            <text x="300" y="321" text-anchor="middle" font-weight="500" fill="#2d3748" font-size="12px">Score birth_year & death_year</text>
            
            <!-- Connection 4 -->
            <line x1="300" y1="335" x2="300" y2="355" stroke="#718096" stroke-width="1.5" marker-end="url(#arrow)" />
            
            <!-- Final Node -->
            <rect x="180" y="355" width="240" height="35" rx="4" fill="#e6fffa" stroke="#319795" stroke-width="1.5" />
            <text x="300" y="376" text-anchor="middle" font-weight="600" fill="#234e52" font-size="12px">Sort by Score & Return IDs</text>
        </svg>
    </div>

    <h2>3. The Blocking Step (<code>MakeBlockedMentions</code>)</h2>
    <p>When searching, the application evaluates raw mentions from the dataset against the following hard constraints. Only records that pass all criteria proceed to scoring:</p>
    <ul>
        <li><strong>Source Filter</strong>: The mention must originate from one of the active sources selected by the user in the Person Editor footer.</li>
        <li><strong>Gender Blocking</strong>: If <em>gender</em> is active, the first character of the mention's gender must match the target (case-insensitive, e.g. "M" vs "Male").</li>
        <li><strong>Race Blocking</strong>: If <em>race</em> is active, the Normalized Race (e.g. "B" or "W") must match exactly.</li>
        <li><strong>Chronological Sanity Check (Birth Year)</strong>: If a target's <em>birth_year</em> is known, any mention with a <code>source_year</code> that is more than 75 years apart from it is blocked. This filters out records where the timeline is physically impossible.</li>
    </ul>

    <h2>4. Smart Name Matching Logic Cascade</h2>
    <p>If Smart Name is enabled, the system runs a fast-path cascade to score the overall name matching:</p>
    <table>
        <thead>
            <tr>
                <th style="width: 10%; text-align: center;">Priority</th>
                <th style="width: 40%;">Match Condition</th>
                <th style="width: 15%; text-align: center;">Score</th>
                <th style="width: 35%;">Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="text-align: center; font-weight: 500;">1</td>
                <td>Exact match on first, middle, and last names</td>
                <td style="text-align: center; font-weight: 600;">1.0</td>
                <td>Perfect exact string equality across all three fields.</td>
            </tr>
            <tr>
                <td style="text-align: center; font-weight: 500;">2</td>
                <td>Exact match on first and last names</td>
                <td style="text-align: center; font-weight: 600;">0.95</td>
                <td>Matches first and last names (ignores middle name).</td>
            </tr>
            <tr>
                <td style="text-align: center; font-weight: 500;">3</td>
                <td>Exact match on initials (first and last names)</td>
                <td style="text-align: center; font-weight: 600;">0.9</td>
                <td>E.g. "W. Spears" matches "William Spears".</td>
            </tr>
            <tr>
                <td style="text-align: center; font-weight: 500;">4</td>
                <td>Exact match on normalized nickname and last name</td>
                <td style="text-align: center; font-weight: 600;">0.9</td>
                <td>E.g. "Bill" matches "William".</td>
            </tr>
            <tr>
                <td style="text-align: center; font-weight: 500;">5</td>
                <td>Jaro-Winkler above threshold on first and last names</td>
                <td style="text-align: center; font-weight: 600;">0.7</td>
                <td>Matches names with slight typos or transpositions.</td>
            </tr>
            <tr>
                <td style="text-align: center; font-weight: 500;">6</td>
                <td>Exact match on NYSIIS sound-alike phonetics</td>
                <td style="text-align: center; font-weight: 600;">0.6</td>
                <td>Phonetic match of the last name.</td>
            </tr>
            <tr>
                <td style="text-align: center; font-weight: 500;">7</td>
                <td>Exact match on Soundex sound-alike phonetics</td>
                <td style="text-align: center; font-weight: 600;">0.5</td>
                <td>Secondary phonetic match of the last name.</td>
            </tr>
        </tbody>
    </table>

    <div class="note-box">
        <strong>Performance Optimization</strong>
        <p>The Jaro-Winkler string similarity calculation is computationally expensive. The cascade is optimized to execute fast equality matches first and only perform Jaro-Winkler comparisons if those fast checks fail.</p>
    </div>

    <h2>5. Evaluation of Individual/Non-Name Fields</h2>
    <p>Any field that was not consumed by the Smart Name cascade (or all fields, if Smart Name is disabled) is evaluated field-by-field:</p>
    <ul>
        <li><strong>Ignored Fields</strong>: If comparison is set to <em>'ignore'</em>, it receives a score of <code>0.0</code>.</li>
        <li><strong>Year Fields (<code>birth_year</code>, <code>death_year</code>)</strong>: Evaluated using a band-matching function <code>ScoreYear</code>. The score is calculated based on distance:
            <ul>
                <li>Exact Match: <code>1.0</code></li>
                <li>Off by 1 year (±1): <code>0.8</code></li>
                <li>Off by 2 years (±2): <code>0.7</code></li>
                <li>Off by 3 years (±3): <code>0.6</code></li>
                <li>Off by 5 years (±5): <code>0.5</code></li>
                <li>Off by 10 years: <code>0.3</code></li>
                <li>Off by 20 years: <code>0.2</code></li>
            </ul>
        </li>
        <li><strong>Exact String Matches</strong>: Case-insensitive string equality checks. Returns <code>1.0</code> if identical, <code>0.0</code> otherwise.</li>
        <li><strong>Fuzzy String Matches (Non-Smart Name Mode)</strong>: Performs Jaro-Winkler distance calculation. If distance is above the threshold (default: <code>0.85</code>), the actual Jaro-Winkler score is assigned; otherwise <code>0.0</code>.</li>
    </ul>

</body>
</html>
"""

artifact_dir = r"C:\\Users\\bfers\\.gemini\\antigravity-ide\\brain\\ab77759a-bf28-4ce5-a4a0-e06d53d945b5"
html_path = os.path.join(artifact_dir, "score_mentions_explanation.html")
pdf_path = os.path.join(artifact_dir, "score_mentions_explanation.pdf")

# Write HTML file
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Generated HTML template at: {html_path}")

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
    print(f"Successfully generated PDF at: {pdf_path}")
except Exception as e:
    print(f"Error during PDF generation: {e}")
