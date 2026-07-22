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

def run_extraction(target_file, sigs, names):
    results = extract_routes('clean_api.cjs', sigs, names)
    with open(target_file, 'w') as out:
        out.write("import pool from '../../config/db.js';\n\n")
        for sig, block in results.items():
            out.write(block + '\n\n')
            print(f"Extracted {names.get(sig)}")

if __name__ == "__main__":
    auto_sigs = [
        "app.get('/api/automation/alert-rules'",
        "app.post('/api/automation/alert-rules'",
        "app.put('/api/automation/alert-rules/:id'",
        "app.delete('/api/automation/alert-rules/:id'",
        "app.post('/api/automation/alert-rules/:id/test'",
        "app.get('/api/automation/alert-events'",
        "app.get('/api/automation/status'",
        "app.get('/api/automation/runs'",
        "app.post('/api/automation/trigger'",
        "app.get('/api/automation/jobs/known'",
        "app.get('/api/automation/jobs/recent'",
        "app.get('/api/automation/jobs/:id'",
        "app.post('/api/automation/jobs/trigger'",
        "app.get('/api/automation/mailer-settings'",
        "app.put('/api/automation/mailer-settings'",
        "app.post('/api/automation/test-mail'",
        "app.post('/api/automation/trigger-stage'",
        "app.post('/api/automation/jobs/:id/cancel'"
    ]
    auto_names = {
        "app.get('/api/automation/alert-rules'": "getAlertRules",
        "app.post('/api/automation/alert-rules'": "createAlertRule",
        "app.put('/api/automation/alert-rules/:id'": "updateAlertRule",
        "app.delete('/api/automation/alert-rules/:id'": "deleteAlertRule",
        "app.post('/api/automation/alert-rules/:id/test'": "testAlertRule",
        "app.get('/api/automation/alert-events'": "getAlertEvents",
        "app.get('/api/automation/status'": "getAutomationStatus",
        "app.get('/api/automation/runs'": "getAutomationRuns",
        "app.post('/api/automation/trigger'": "triggerAutomation",
        "app.get('/api/automation/jobs/known'": "getKnownJobs",
        "app.get('/api/automation/jobs/recent'": "getRecentJobs",
        "app.get('/api/automation/jobs/:id'": "getJobStatus",
        "app.post('/api/automation/jobs/trigger'": "triggerJob",
        "app.get('/api/automation/mailer-settings'": "getMailerSettings",
        "app.put('/api/automation/mailer-settings'": "updateMailerSettings",
        "app.post('/api/automation/test-mail'": "testMail",
        "app.post('/api/automation/trigger-stage'": "triggerStage",
        "app.post('/api/automation/jobs/:id/cancel'": "cancelJob"
    }

    datalake_sigs = [
        "app.get('/api/data-lake/export'",
        "app.get('/api/data-lake/reviews'",
        "app.post('/api/data-lake/reviews/edit'",
        "app.post('/api/data-lake/reviews/bulk-delete'"
    ]
    datalake_names = {
        "app.get('/api/data-lake/export'": "exportDataLake",
        "app.get('/api/data-lake/reviews'": "getDataLakeReviews",
        "app.post('/api/data-lake/reviews/edit'": "editDataLakeReview",
        "app.post('/api/data-lake/reviews/bulk-delete'": "bulkDeleteDataLakeReviews"
    }
    
    run_extraction('src/controllers/automation/automation.controller.js', auto_sigs, auto_names)
    run_extraction('src/controllers/datalake/datalake.controller.js', datalake_sigs, datalake_names)
