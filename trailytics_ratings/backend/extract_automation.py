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
        "app.post('/api/automation/weekly-digest/send'",
        "app.get('/api/automation/training-set/stats'",
        "app.get('/api/automation/training-set/export'",
        "app.put('/api/automation/mailer-settings'",
        "app.post('/api/automation/test-mail'",
        "app.post('/api/automation/trigger-stage'",
        "app.post('/api/automation/jobs/:id/cancel'"
    ]
    
    results = extract_routes(file_path, sigs)
    
    names = {
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
        "app.get('/api/automation/jobs/:id'": "getJobById",
        "app.post('/api/automation/jobs/trigger'": "triggerJob",
        "app.get('/api/automation/mailer-settings'": "getMailerSettings",
        "app.post('/api/automation/weekly-digest/send'": "sendWeeklyDigest",
        "app.get('/api/automation/training-set/stats'": "getTrainingSetStats",
        "app.get('/api/automation/training-set/export'": "exportTrainingSet",
        "app.put('/api/automation/mailer-settings'": "updateMailerSettings",
        "app.post('/api/automation/test-mail'": "testMail",
        "app.post('/api/automation/trigger-stage'": "triggerStage",
        "app.post('/api/automation/jobs/:id/cancel'": "cancelJob"
    }

    with open('src/controllers/automation/automation.controller.js', 'w') as out:
        out.write("import pool from '../../config/db.js';\n")
        out.write("import { spawnJob, KNOWN_JOBS } from '../../automation/spawnJob.cjs';\n\n")
        for sig, block in results.items():
            func_name = names.get(sig, "unknown")
            lines = block.split('\n')
            lines[0] = f"export const {func_name} = async (req, res) => {{"
            if lines[-1].strip() == '});':
                lines[-1] = '};'
            out.write('\n'.join(lines) + '\n\n')
            print(f"Extracted {func_name}")
