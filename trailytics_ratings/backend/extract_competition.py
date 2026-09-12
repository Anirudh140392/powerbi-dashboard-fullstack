import sys

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
        "app.get('/api/ratings/competitor-mentions'",
        "app.get('/api/ratings/competitor-matrix'",
        "app.get('/api/ratings/competitor-mappings'",
        "app.post('/api/ratings/competitor-mappings'",
        "app.put('/api/ratings/competitor-mappings/:id'",
        "app.delete('/api/ratings/competitor-mappings/:id'",
        "app.get('/api/ratings/competitor-mapping-types'",
        "app.get('/api/ratings/competitor-mapping-options'",
        "app.get('/api/ratings/competitor-mapping-pairs'",
        "app.post('/api/ratings/competitor-mapping-pairs'",
        "app.put('/api/ratings/competitor-mapping-pairs/:id'",
        "app.delete('/api/ratings/competitor-mapping-pairs/:id'",
        "app.get('/api/ratings/competitor-mapping-pairs/export'",
        "app.get('/api/ratings/competitor-brands'"
    ]
    
    results = extract_routes(file_path, sigs)
    
    # Names for each signature
    names = {
        "app.get('/api/ratings/competitor-mentions'": "getCompetitorMentions",
        "app.get('/api/ratings/competitor-matrix'": "getCompetitorMatrix",
        "app.get('/api/ratings/competitor-mappings'": "getCompetitorMappings",
        "app.post('/api/ratings/competitor-mappings'": "createCompetitorMapping",
        "app.put('/api/ratings/competitor-mappings/:id'": "updateCompetitorMapping",
        "app.delete('/api/ratings/competitor-mappings/:id'": "deleteCompetitorMapping",
        "app.get('/api/ratings/competitor-mapping-types'": "getCompetitorMappingTypes",
        "app.get('/api/ratings/competitor-mapping-options'": "getCompetitorMappingOptions",
        "app.get('/api/ratings/competitor-mapping-pairs'": "getCompetitorMappingPairs",
        "app.post('/api/ratings/competitor-mapping-pairs'": "createCompetitorMappingPair",
        "app.put('/api/ratings/competitor-mapping-pairs/:id'": "updateCompetitorMappingPair",
        "app.delete('/api/ratings/competitor-mapping-pairs/:id'": "deleteCompetitorMappingPair",
        "app.get('/api/ratings/competitor-mapping-pairs/export'": "exportCompetitorMappingPairs",
        "app.get('/api/ratings/competitor-brands'": "getCompetitorBrands"
    }

    with open('src/controllers/competition/competition.controller.js', 'w') as out:
        out.write("import pool from '../../config/db.js';\n\n")
        for sig, block in results.items():
            func_name = names.get(sig, "unknown")
            lines = block.split('\n')
            lines[0] = f"export const {func_name} = async (req, res) => {{"
            if lines[-1].strip() == '});':
                lines[-1] = '};'
            out.write('\n'.join(lines) + '\n\n')
            print(f"Extracted {func_name}")
