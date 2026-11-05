import sys
import re

def extract_routes(file_path, route_signatures, route_names):
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
        
        func_name = route_names.get(sig, "unknown")
        lines = block.split('\n')
        lines[0] = f"export const {func_name} = async (req, res) => {{"
        block = '\n'.join(lines)
        
        block = re.sub(r'^}\);', '};', block, flags=re.MULTILINE)
        
        extracted[sig] = block

    return extracted

def append_extraction(target_file, sigs, names):
    results = extract_routes('clean_api.cjs', sigs, names)
    with open(target_file, 'a') as out:
        for sig, block in results.items():
            out.write('\n\n' + block)
            print(f"Appended {names.get(sig)}")

if __name__ == "__main__":
    auto_sigs = [
        "app.post('/api/automation/weekly-digest/send'",
        "app.get('/api/automation/training-set/stats'",
        "app.get('/api/automation/training-set/export'"
    ]
    auto_names = {
        "app.post('/api/automation/weekly-digest/send'": "sendWeeklyDigest",
        "app.get('/api/automation/training-set/stats'": "getTrainingSetStats",
        "app.get('/api/automation/training-set/export'": "exportTrainingSet"
    }

    append_extraction('src/controllers/automation/automation.controller.js', auto_sigs, auto_names)
