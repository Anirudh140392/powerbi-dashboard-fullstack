import urllib.request
import json
import time

segments = [
    'business_overview_platform',
    'business_overview_category',
    'business_overview_breakdown'
]

for seg in segments:
    payload = {
        'module': 'business_overview',
        'segment': seg,
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
    print(f"\nStarted run for {seg}: {run_id}")

    for _ in range(60):
        time.sleep(1.5)
        status_res = json.loads(urllib.request.urlopen(f'http://127.0.0.1:8002/ds-tester/runs/{run_id}').read().decode())
        if status_res['status'] in ('completed', 'failed', 'done'):
            print(f"[{seg}] OVERALL: {status_res.get('overall')}")
            for k in status_res.get('kpis', []):
                print(f"  * {k['label']}: API={k['api']} | Logic={k['logic']} | UI={k['ui']} -> [{k['status']}]")
            break

