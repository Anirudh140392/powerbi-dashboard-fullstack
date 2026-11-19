import sys, os, time
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.runner import start_test_run, get_run

period = {"startDate": "2026-03-01", "endDate": "2026-03-31"}

def run_and_wait(mod_name, seg_name, client="mars"):
    print(f"\n==================================================")
    print(f"RUNNING: {mod_name} -> {seg_name}")
    print(f"==================================================")
    res = start_test_run(module_name=mod_name, segment=seg_name, period=period, client=client, headless=True)
    if res.get("busy"):
        print("Runner is busy:", res.get("message"))
        return
    run_id = res.get("run_id")
    print(f"Run started with ID: {run_id}")

    while True:
        time.sleep(2)
        record = get_run(run_id)
        status = record.get("status")
        live_step = record.get("live_step")
        if status in ("done", "error"):
            print(f"Finished with status: {status}, overall: {record.get('overall')}")
            print(f"Steps: {record.get('steps')}")
            print("KPIs:")
            for k in record.get("kpis", []):
                print(f"  [{k['status']}] {k['label']} | API: {k['api']}, Logic: {k['logic']}, UI: {k['ui']} (raw: '{k['ui_raw']}') | Reason: {k['reason']}")
            break
        else:
            print(f"  ... {live_step or 'running'}")

# 1. Watch Tower
run_and_wait("watch_tower", "watchtower_overview")

# 2. Market Share
run_and_wait("market_share", "market_share_overview")
