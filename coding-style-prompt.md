# Code Formatting Style Guide — Prompt for Code-Generating Programs

Use the following rules when generating HTML, CSS, and JavaScript code for me. These reflect my personal formatting conventions. Follow them precisely.

---

## General Principles

- I write compact, dense code. Minimize vertical whitespace and blank lines. Don't spread simple logic across many lines.
- I favor **single-file architecture**: HTML, CSS, and JS all live in one `.html` file, not split into separate files.
- I use **tabs for indentation**, not spaces.
- I prefer terse, abbreviated variable names (e.g., `s`, `d`, `o`, `i`, `str`, `e`, `trt`, `num`) over verbose names.
- I use **right-aligned inline comments** extensively, pushed out to a consistent column (usually around column 80–100) using tabs. Every significant line should have a short, capitalized comment explaining what it does. Example:
  ```js
  let url=window.location.search.substring(1);                // Get query string
  if (url) app.name=url.split("&")[0];                        // Get name
  ```

---

## HTML

- Indent `<head>`, `<body>`, and their children with **one tab** per nesting level.
- Use self-closing tags loosely (e.g., `<br>` not `<br/>`).
- Inline styles via `style="..."` attributes are acceptable and common — don't always extract to CSS classes.
- Attributes use **double quotes**.
- IDs and classes use a **namespace prefix** pattern: `el-` (e.g., `el-script`, `el-media`, `el-play`).
- Keep HTML compact: short elements can go on a single line, even with inline styles.
- `<style>` and `<script>` blocks go directly in the HTML file, not in external files.

---

## CSS

- I use a **tabular/column-aligned** format for CSS rules. The selector is left-aligned, and the opening `{` plus properties are pushed rightward with tabs so that all property blocks start at the same column. Example:
  ```css
  .el-script {      position:absolute; background-color: #fff; width:calc(50% - 12px);
                     border:6px solid #339999; border-top-left-radius:0px;
                     }
  ```
- **No spaces** before colons in property declarations: `font-size:14px` not `font-size: 14px`. (Minor inconsistency is okay — sometimes a space after the colon is fine.)
- **Closing braces `}`** go on their own line, indented to match the property column (not the selector column).
- Multiple properties can go on the **same line**, separated by semicolons and spaces. Group related properties together on a line.
- Use `calc()` freely for layout math.
- Use CSS variables via `:root` and `var()`.
- Prefer shorthand hex colors: `#fff`, `#999`, `#339999`.
- Scrollbar styling via `::-webkit-scrollbar` pseudo-elements is fine.

---

## JavaScript

### Spacing and Syntax

- **No spaces** around `=` in assignments: `let x=5;` not `let x = 5;`.
- **No spaces** after `if`/`for`/`while` keywords before the paren is acceptable: `if (x)` or `for (i=0;...`.
- **No spaces** inside `for` loop semicolons: `for (i=0;i<n;++i)`.
- Use **prefix increment**: `++i` not `i++`.
- Use `let` and `var` (not `const` unless it's truly constant).
- **Arrow functions** are preferred for callbacks: `()=>{ ... }` with **no space** before the arrow.
- Ternary operators are used freely inline, even for assignments:
  ```js
  mode == "toggle" ? app.inPlay=!app.inPlay : app.inPlay=mode
  ```
- Use **template literals** (backticks) for string interpolation.
- Omit optional semicolons at the end of blocks sometimes (relaxed about trailing semicolons).

### Structure and Patterns

- Use **ES6 classes** with methods that have no `function` keyword.
- Class methods use the format:
  ```js
  MethodName()                                               // DESCRIPTION IN CAPS
  {
      // body
  }
  ```
  The opening brace `{` goes on its **own line** below the method signature (Allman/next-line style), **not** K&R style.
- Standalone functions outside classes use `function name()` with opening brace on the **next line**:
  ```js
  function trace(msg, p1)                                    // CONSOLE
  {
      // body
  }
  ```
- **jQuery** is the DOM library. Use `$()` selectors, `.on()` for events, `.css()`, `.attr()`, `.html()`, etc.
- Event handlers follow this pattern with inline comments:
  ```js
  $("#el-play").on("click",()=>{                             // ON PLAY CLICK
      Sound("click");                                        // Click
      app.Play();                                            // Toggle play
      });
  ```
  Note: closing `});` for jQuery event handlers is on its own line, indented to the inner level.
- Use **regex** liberally: `.match()`, `.replace()`, `new RegExp()`.
- Global variables are declared at the top of the script block.
- Use a **global app pointer** pattern: `var app=null;` at top, then `app=new App();`.
- `this` and `app` are used interchangeably to reference the app instance within class methods.

### Control Flow

- Short conditional bodies go on the **same line** as the `if`:
  ```js
  if (!file) return;                                         // Quit if bad
  ```
- `else` and `else if` go on the **same line** as the closing brace when using block form, but can also use brace-on-next-line for longer blocks.
- Chains of `if/else if` with similar one-line bodies are aligned:
  ```js
  if (url.match(/&auto/i) && !isMobile)  app.autoPlay=true;  // Autoplay?
  if (url.match(/t=/))                   app.start=...;      // If time set
  ```
- Early returns are common: `if (!term) return;`

### Comments

- **Section dividers** use full-width comment bars:
  ```js
  /////////////////////////////////////////////////////////////////////////////////////////////////
  // SECTION NAME
  /////////////////////////////////////////////////////////////////////////////////////////////////
  ```
- **Inline comments** are right-aligned, short, and in **Title Case or sentence fragments**: `// Set mobile flag`, `// Quit if bad`, `// Add to obj`.
- **Method header comments** are ALL CAPS on the same line as the signature: `// PLAY OR PAUSE`, `// CONSTRUCTOR`.
make comments line up on tab breaks

---

## Naming Conventions

- **Variables**: camelCase, short/abbreviated (`str`, `msg`, `num`, `trt`, `aud`, `pct`).
- **Class names**: PascalCase (`App`).
- **Methods**: PascalCase (`ParseScript`, `AudioInit`, `ShowMedia`, `CountWords`).
- **Standalone functions**: PascalCase (`Sound`, `PopUp`, `TimecodeToSeconds`).
- **CSS classes**: lowercase with `el-` prefix and hyphen separation (`el-rawscript`, `el-media`, `el-control`).
- **HTML IDs**: same as CSS class names (`el-slider`, `el-play`, `el-now`).

---

## Other Preferences

- I use **jQuery UI** for UI widgets (sliders, draggable).
- I load libraries from **Google CDN** (`ajax.googleapis.com`).
- I use `$.ajax()` for loading external data files.
- Audio is handled via the native `Audio()` object, not a library.
- I embed `<iframe>` elements for showing external content (maps, images, word clouds) within the app.
- I favor **functional density**: pack logic tightly, avoid boilerplate, and keep files lean.
