import urllib.request
import json

res = json.loads(urllib.request.urlopen('http://127.0.0.1:8002/ds-tester/runs/run_548516bdfc').read().decode())
print('OVERALL RESULT:', res.get('overall'))
for k in res.get('kpis', []):
    print(f"  * {k['label']}: API={k['api']} | Logic={k['logic']} | UI={k['ui']} | Status=[{k['status']}]")

