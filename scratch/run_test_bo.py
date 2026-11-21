import urllib.request
import json
import time

payload = {
    'module': 'business_overview',
    'segment': 'business_overview_overview',
    'period': {
        'startDate': '2026-10-01',
        'endDate': '2026-10-31'
    },
    'client': 'boat',
    'headless': True
}
req = urllib.request.Request(
    'http://127.0.0.1:8002/ds-tester/run',
    data=json.dumps(payload).encode(),
    headers={'Content-Type': 'application/json'}
)
res = json.loads(urllib.request.urlopen(req).read().decode())
run_id = res['run_id']
print('Run started, ID:', run_id)

for _ in range(60):
    time.sleep(2)
    s_req = urllib.request.urlopen(f'http://127.0.0.1:8002/ds-tester/runs/{run_id}')
    status = json.loads(s_req.read().decode())
    if status.get('status') in ('done', 'error', 'completed', 'failed'):
        print('FINISHED! Overall:', status.get('overall'))
        for r in status.get('kpis', []):
            print(f"[{r['status']}] {r['label']}: API={r['api']}, Logic={r['logic']}, UI={r['ui']} (raw: {r.get('ui_raw')}) | {r.get('reason')}")
        break
    else:
        print('Progress:', status.get('live_step'))

