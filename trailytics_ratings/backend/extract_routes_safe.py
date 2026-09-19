import sys
import re

def extract_routes(file_path, route_signatures):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Find all route starts
    # We look for lines starting with 'app.' or containing it at start of line
    pattern = re.compile(r"^(?://.*\n)*app\.(?:get|post|put|delete|patch|use)\(", re.MULTILINE)
    
    matches = list(pattern.finditer(content))
    
    extracted = {}
    
    for sig in route_signatures:
        # Find the match that corresponds to this sig
        start_idx = content.find(sig)
        if start_idx == -1:
            print(f"Warning: Route {sig} not found.")
            continue
            
        # Find which match block this belongs to
        current_match_idx = -1
        for i, match in enumerate(matches):
            if match.start() <= start_idx < match.end() or match.start() == content.rfind("app.", 0, start_idx+4):
                current_match_idx = i
                break
                
        # We can just find the start of the next match
        # Wait, start_idx is exactly where `app.get` is.
        # Let's just find the next match that is strictly after start_idx.
        end_idx = len(content)
        for match in matches:
            if match.start() > start_idx:
                end_idx = match.start()
                break
                
        block = content[start_idx:end_idx].strip()
        extracted[sig] = block

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
            # The block should end with }); or };. 
            # We strip trailing whitespace, then check if it ends with });
            if lines[-1].strip().endswith(');'):
                lines[-1] = lines[-1].rstrip()[:-2] + ';'
            out.write('\n'.join(lines) + '\n\n')
            print(f"Extracted {func_name}")
