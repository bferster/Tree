import re

with open('tree.js', 'r', encoding='utf-8') as f:
    code = f.read()

code = re.sub(r'\$\(document\)\.ready\(\s*function\s*\(\s*\)\s*\{', r'$(document).ready(() => {', code)

with open('tree.js', 'w', encoding='utf-8') as f:
    f.write(code)
