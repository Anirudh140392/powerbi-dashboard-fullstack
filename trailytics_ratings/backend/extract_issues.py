import sys
import re

def extract_routes(file_path, route_signatures):
    with open(file_path, 'r') as f:
        content = f.read()
    
    extracted = {}
    
    for route_sig in route_signatures:
        start_idx = content.find(route_sig)
        if start_idx == -1:
            print(f"Warning: Route {route_sig} not found.")
            continue
            
        brace_count = 0
        in_string = False
        string_char = ''
        in_comment = False
        
        for i in range(start_idx, len(content)):
            char = content[i]
            
            if not in_comment and (char == '"' or char == "'" or char == '`'):
                if not in_string:
                    in_string = True
                    string_char = char
                elif string_char == char and content[i-1] != '\\':
                    in_string = False
                    
            if not in_string and not in_comment:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        if content[i+1:i+3] == ');' or content[i+1:i+2] == ')':
                            end_idx = i + 3
                            extracted[route_sig] = content[start_idx:end_idx]
                            break
                            
    return extracted

if __name__ == "__main__":
    file_path = sys.argv[1]
    sigs = [
        "app.get('/api/ratings/asin-issues'",
        "app.get('/api/ratings/issues-breakdown'",
        "app.get('/api/ratings/issue-detail'",
        "app.get('/api/ratings/reviews-by-issue'",
        "app.get('/api/ratings/issue-statuses'",
        "app.post('/api/ratings/issue-statuses'",
        "app.get('/api/ratings/issue/:name/drilldown'"
    ]
    
    results = extract_routes(file_path, sigs)
    
    names = {
        "app.get('/api/ratings/asin-issues'": "getAsinIssues",
        "app.get('/api/ratings/issues-breakdown'": "getIssuesBreakdown",
        "app.get('/api/ratings/issue-detail'": "getIssueDetail",
        "app.get('/api/ratings/reviews-by-issue'": "getReviewsByIssue",
        "app.get('/api/ratings/issue-statuses'": "getIssueStatuses",
        "app.post('/api/ratings/issue-statuses'": "updateIssueStatuses",
        "app.get('/api/ratings/issue/:name/drilldown'": "getIssueDrilldown"
    }

    with open('src/controllers/issues/issues.controller.js', 'w') as out:
        out.write("import pool from '../../config/db.js';\n\n")
        for sig, block in results.items():
            func_name = names.get(sig, "unknown")
            lines = block.split('\n')
            lines[0] = f"export const {func_name} = async (req, res) => {{"
            if lines[-1].strip() == '});':
                lines[-1] = '};'
            out.write('\n'.join(lines) + '\n\n')
            print(f"Extracted {func_name}")
