import urllib.request
import json
import time

payload = {
    'module': 'business_overview',
    'segment': 'business_overview_category',
    'period': {'startDate': '2026-10-01', 'endDate': '2026-10-30'},
    'client': 'boat',
    'headless': True
}

req = urllib.request.Request(
    'http://127.0.0.1:8002/ds-tester/run',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
res = json.loads(urllib.request.urlopen(req).read().decode())
run_id = res['run_id']
print('Started run:', run_id)

for _ in range(60):
    time.sleep(1.5)
    status_res = json.loads(urllib.request.urlopen(f'http://127.0.0.1:8002/ds-tester/runs/{run_id}').read().decode())
    st = status_res['status']
    if st in ('completed', 'failed', 'done'):
        print('\n=== RUN FINISHED ===')
        print('Overall:', status_res['overall'])
        for kpi in status_res.get('kpis', []):
            lbl = kpi.get('label')
            ap = kpi.get('api')
            lg = kpi.get('logic')
            ui = kpi.get('ui')
            stat = kpi.get('status')
            reason = kpi.get('reason')
            print(f"  * {lbl}: API={ap} | Logic={lg} | UI={ui} -> [{stat}] {reason or ''}")
        break

