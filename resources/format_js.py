import sys
import re

def process_code(code):
    lines = code.split('\n')
    out_lines = []
    
    in_multiline_comment = False
    
    for line in lines:
        if in_multiline_comment:
            out_lines.append(line)
            if '*/' in line:
                in_multiline_comment = False
            continue
            
        if '/*' in line and '*/' not in line:
            in_multiline_comment = True
            
        # Parse for inline comment while ignoring strings
        comment_idx = -1
        in_string = None
        escape = False
        for i in range(len(line)):
            char = line[i]
            if escape:
                escape = False
                continue
                
            if char == '\\':
                escape = True
                continue
                
            if in_string:
                if char == in_string:
                    in_string = None
            else:
                if char in '"\'`':
                    in_string = char
                elif char == '/' and i+1 < len(line) and line[i+1] == '/':
                    comment_idx = i
                    break
        
        comment = ""
        code_part = line
        if comment_idx != -1:
            comment = line[comment_idx:]
            code_part = line[:comment_idx]
            
        # 1. Indentation: convert 4 spaces to tabs
        leading_spaces = len(code_part) - len(code_part.lstrip(' '))
        if leading_spaces > 0 and code_part.startswith(' '):
            tabs = leading_spaces // 4
            rem = leading_spaces % 4
            code_part = '\t' * tabs + ' ' * rem + code_part.lstrip(' ')
            
        # 2. Process code_part excluding strings
        def replace_in_code(match):
            val = match.group(0)
            if val.startswith('"') or val.startswith("'") or val.startswith('`'):
                return val
            # Remove spaces around = (but not ==, ===, !=, <=, >=, =>)
            val = re.sub(r'(?<![=<>!])\s*=\s*(?![=>])', '=', val)
            # Remove spaces in for loops semicolons
            val = re.sub(r';\s+', ';', val)
            return val
            
        code_part = re.sub(r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`|[^"\'`]+)', replace_in_code, code_part)
        
        # 3. Allman braces for functions
        # Exclude common control structures
        brace_pattern = r'^(\s*)(?!(?:if|for|while|switch|catch)\b)((?:async\s+)?(?:function\s+)?\w+\s*\([^)]*\))\s*\{$'
        match = re.match(brace_pattern, code_part.rstrip())
        if match:
            indent = match.group(1)
            sig = match.group(2)
            code_part = f"{indent}{sig}\n{indent}{{"
        
        # 4. Comment alignment
        if comment:
            lines_to_add = code_part.split('\n')
            if len(lines_to_add) == 2:
                # We split a brace into two lines
                out_lines.append(lines_to_add[0])
                code_part = lines_to_add[1]
                
            current_len = len(code_part.rstrip())
            if current_len > 0:
                code_part = code_part.rstrip()
                # Target column 80 (approx 20 tabs)
                # Let's count visual length assuming 1 tab = 4 spaces
                visual_len = 0
                for c in code_part:
                    if c == '\t':
                        visual_len += 4 - (visual_len % 4)
                    else:
                        visual_len += 1
                        
                target_col = 80
                if visual_len < target_col:
                    pad_spaces = target_col - visual_len
                    tabs = pad_spaces // 4
                    if tabs == 0:
                        tabs = 1
                    code_part = code_part + '\t' * tabs + comment
                else:
                    code_part = code_part + '\t' + comment
            else:
                code_part = code_part + comment
        else:
            code_part = code_part.rstrip()
            
        out_lines.append(code_part)
        
    return '\n'.join(out_lines)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python format_js.py <file>")
        sys.exit(1)
        
    filepath = sys.argv[1]
    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()
        
    formatted = process_code(code)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(formatted)
        print(f"Formatted {filepath}")
