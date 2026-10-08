import sys
import re

def extract_routes(file_path, route_signatures):
    with open(file_path, 'r') as f:
        content = f.read()
    
    pattern = re.compile(r"^app\.(?:get|post|put|delete|patch|use)\(", re.MULTILINE)
    matches = list(pattern.finditer(content))
    
    extracted = {}
    for sig in route_signatures:
        start_idx = content.find(sig)
        if start_idx == -1:
            print(f"Warning: Route {sig} not found.")
            continue
            
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
        "app.post('/api/ml-audit/product-inspect'",
        "app.get('/api/ml-audit/pending'",
        "app.post('/api/ml-audit/approve'",
        "app.post('/api/ml-audit/reject'",
        "app.post('/api/ml-audit/bulk-trigger'"
    ]
    
    results = extract_routes(file_path, sigs)
    
    names = {
        "app.post('/api/ml-audit/product-inspect'": "inspectProduct",
        "app.get('/api/ml-audit/pending'": "getPendingAudit",
        "app.post('/api/ml-audit/approve'": "approveAudit",
        "app.post('/api/ml-audit/reject'": "rejectAudit",
        "app.post('/api/ml-audit/bulk-trigger'": "bulkTriggerAudit"
    }

    with open('src/controllers/ml/audit.controller.js', 'w') as out:
        out.write("import pool from '../../config/db.js';\n\n")
        for sig, block in results.items():
            func_name = names.get(sig, "unknown")
            lines = block.split('\n')
            lines[0] = f"export const {func_name} = async (req, res) => {{"
            if lines[-1].strip().endswith(');'):
                lines[-1] = lines[-1].rstrip()[:-2] + ';'
            out.write('\n'.join(lines) + '\n\n')
            print(f"Extracted {func_name}")
