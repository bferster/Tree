import re

def process_file():
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the specific script blocks to remove and consolidate
    # We have three script blocks without src attributes.
    script_pattern = re.compile(r'<script(?:[^>]*?)>\s*(.*?)\s*</script>', re.DOTALL)
    
    js_content = []
    
    def replacer(match):
        script_tag = match.group(0)
        inner_js = match.group(1)
        
        # Keep external scripts like jQuery and D3
        if 'src=' in script_tag:
            return script_tag
            
        js_content.append(inner_js)
        return ""
        
    new_content = script_pattern.sub(replacer, content)
    
    # Insert the <script src="app.js"></script> before </body>
    new_content = new_content.replace('</body>', '\t<script src="app.js"></script>\n</body>')
    
    # Save the JS content
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(js_content))
        
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(new_content)

if __name__ == '__main__':
    process_file()
