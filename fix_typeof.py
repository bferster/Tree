import re

with open('tree.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace `if (typeof someFunc === 'function') this.someFunc();` with `this.someFunc();`
# Note: it can be block form: `if (typeof foo === 'function') { this.foo(); this.bar(); }`
# Let's just remove the `if (typeof ... === 'function')` wrapper.
code = re.sub(r'if\s*\(\s*typeof\s+[a-zA-Z0-9_]+\s*===\s*[\'"]function[\'"]\s*\)\s*\{\s*(this\.[^}]+)\s*\}', r'\1', code)
code = re.sub(r'if\s*\(\s*typeof\s+[a-zA-Z0-9_]+\s*===\s*[\'"]function[\'"]\s*\)\s*(this\.[a-zA-Z0-9_]+\([^)]*\);?)', r'\1', code)

# Let's also check for else if
code = re.sub(r'else\s+if\s*\(\s*typeof\s+[a-zA-Z0-9_]+\s*===\s*[\'"]function[\'"]\s*\)\s*\{', r'else {', code)

with open('tree.js', 'w', encoding='utf-8') as f:
    f.write(code)
