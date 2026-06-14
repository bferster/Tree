import sys
import re

with open('tree.js', 'r', encoding='utf-8') as f:
    code = f.read()

vars = ['state', 'undoStack', 'redoStack', 'pidCounter', 'isDirty', 'currentFilename', 'currentPassword', 'currentEncryptedData', 'svg', 'gMain', 'zoom', 'gEdges', 'gNodes', 'nodeWidth', 'nodeHeight', 'femalePath', 'malePath', 'circlePath', 'drag', 'linkMode', 'linkSourcePid']
for v in vars:
    code = re.sub(r'([\'"])this\.' + v + r'\b', r'\1' + v, code)
    code = re.sub(r'(<[A-Za-z0-9_-]+>)this\.' + v + r'\b', r'\1' + v, code)

with open('tree.js', 'w', encoding='utf-8') as f:
    f.write(code)
