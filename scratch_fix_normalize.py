import re

with open('normalize.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace from getMetaphone to the end of window.Normalize object cleanly
pattern = r'getMetaphone:[\s\S]*?\}\n\};'

replacement = '''getMetaphone: function (name) {
		if (!name) return "";
		const res = doubleMetaphone(name);
		return res ? res.split(':')[0] : "";
	}
};'''

content = re.sub(pattern, replacement, content)

with open('normalize.js', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Cleanly fixed normalize.js")
