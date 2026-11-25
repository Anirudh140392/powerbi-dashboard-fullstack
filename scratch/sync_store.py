import urllib.request, json
from ds_tester.backend.anomaly_engine import anomaly_sentinel

res = urllib.request.urlopen('http://127.0.0.1:8002/ds-tester/runs')
runs = json.loads(res.read())

print(f'Checking {len(runs)} runs in memory...')
total_added = 0
for r in runs:
    if r.get('overall') == 'PASS':
        run_id = r.get('run_id')
        if hasattr(anomaly_sentinel, '_evaluated_runs') and run_id in anomaly_sentinel._evaluated_runs:
            anomaly_sentinel._evaluated_runs.remove(run_id)
        new_anoms = anomaly_sentinel.evaluate_verified_run(r)
        if new_anoms:
            print(f"Added {len(new_anoms)} anomalies for {r.get('module')}:{r.get('segment')}")
            total_added += len(new_anoms)

print(f'Total anomalies now in store: {len(anomaly_sentinel.anomalies)}')
