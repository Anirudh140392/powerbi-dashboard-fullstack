import urllib.request
import json

res = json.loads(urllib.request.urlopen("http://127.0.0.1:8002/ds-tester/runs").read().decode())
for r in res:
    mod = r.get("module")
    if mod in ("insights", "geo_intelligence", "primary_summary") and r.get("overall") == "FAIL":
        print(f"=== {mod} : {r.get('segment')} ===")
        for k in r.get("kpis", []):
            if k.get("status") == "FAIL":
                print(f"  {k.get('key')}: API={k.get('api')} Logic={k.get('logic')} UI={k.get('ui')} | Reason={k.get('reason')}")
