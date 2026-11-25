path = 'ds_tester/backend/anomaly_engine.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """                    today_str = datetime.now().strftime("%Y-%m-%d")
                    # Prune stale past-day anomalies - only retain anomalies from current calendar day
                    self.anomalies = [
                        a for a in raw_anomalies
                        if str(a.get("timestamp", ""))[:10] == today_str
                    ]"""

replacement = """                    today_str = datetime.now().strftime("%Y-%m-%d")
                    # Retain anomalies from current calendar day OR any anomaly that has been assigned to a tester
                    self.anomalies = [
                        a for a in raw_anomalies
                        if str(a.get("timestamp", ""))[:10] == today_str or a.get("assignment_status") == "ASSIGNED" or a.get("assigned_to")
                    ]"""

if target in content:
    content = content.replace(target, replacement, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Updated anomaly_engine.py successfully!')
else:
    print('Target not found directly, checking normalized...')
    content_norm = content.replace('\r\n', '\n')
    target_norm = target.replace('\r\n', '\n')
    if target_norm in content_norm:
        content_norm = content_norm.replace(target_norm, replacement.replace('\r\n', '\n'), 1)
        with open(path, 'w', encoding='utf-8', newline='\r\n') as f:
            f.write(content_norm)
        print('Updated anomaly_engine.py (CRLF normalized) successfully!')
    else:
        print('Target completely not found!')
