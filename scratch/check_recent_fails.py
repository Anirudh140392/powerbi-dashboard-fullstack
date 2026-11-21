import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step2_logic import execute_select_query

# Check recent runs from RUN_STORE in runner
from ds_tester.backend.runner import list_runs
runs = list_runs()
print(f"Total runs in runner: {len(runs)}")
for r in runs[:10]:
    print(f"Run {r.get('run_id')} | mod={r.get('module')} | seg={r.get('segment')} | client={r.get('client')} | status={r.get('status')} | overall={r.get('overall')}")
    for k in r.get("kpis", []):
        if k.get("status") == "FAIL":
            print(f"   [FAIL] {k.get('label')}: API={k.get('api')}, Logic={k.get('logic')}, UI={k.get('ui')} (raw='{k.get('ui_raw')}') | Reason: {k.get('reason')}")

