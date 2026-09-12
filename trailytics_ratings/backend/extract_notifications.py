import sys
import re
import os

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

def run_extraction(target_file, sigs, names):
    results = extract_routes('clean_api.cjs', sigs, names)
    os.makedirs(os.path.dirname(target_file), exist_ok=True)
    with open(target_file, 'w') as out:
        out.write("import pool from '../../config/db.js';\n\n")
        for sig, block in results.items():
            out.write(block + '\n\n')
            print(f"Extracted {names.get(sig)}")

if __name__ == "__main__":
    sigs = [
        "app.get('/api/notifications'",
        "app.post('/api/notifications/:id/read'",
        "app.post('/api/notifications/mark-all-read'",
        "app.post('/api/notifications/:id/dismiss'"
    ]
    names = {
        "app.get('/api/notifications'": "getNotifications",
        "app.post('/api/notifications/:id/read'": "markNotificationRead",
        "app.post('/api/notifications/mark-all-read'": "markAllNotificationsRead",
        "app.post('/api/notifications/:id/dismiss'": "dismissNotification"
    }

    run_extraction('src/controllers/notifications/notifications.controller.js', sigs, names)
