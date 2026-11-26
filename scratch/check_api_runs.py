import urllib.request
import json

url = "http://127.0.0.1:8002/ds-tester/runs"
try:
    with urllib.request.urlopen(url) as resp:
        runs = json.loads(resp.read().decode('utf-8'))
        print(f"Total runs: {len(runs)}")
        for r in runs:
            print(f"\nRun: {r.get('run_id')} | Mod: {r.get('module')} | Client: {r.get('client')} | Overall: {r.get('overall')}")
            for k in r.get("kpis", []):
                print(f"   [{k.get('status')}] {k.get('label')}: API={k.get('api')}, Logic={k.get('logic')}, UI={k.get('ui')} (raw='{k.get('ui_raw')}') -> Reason: {k.get('reason')}")
except Exception as e:
    print("Error:", e)

