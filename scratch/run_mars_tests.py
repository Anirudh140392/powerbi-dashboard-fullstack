import requests
import time
import json

def test_run(segment_id, client="mars"):
    print(f"\n=======================================================")
    print(f"TRIGGERING RUN: client={client}, segment={segment_id}")
    print(f"=======================================================")
    payload = {
        "module": "content_score",
        "segment": segment_id,
        "client": client,
        "period": {"startDate": "2026-10-01", "endDate": "2026-10-31"},
        "headless": True
    }
    r = requests.post("http://127.0.0.1:8002/ds-tester/run", json=payload)
    if r.status_code != 200:
        print("ERROR:", r.status_code, r.text)
        return False
    run_id = r.json()["run_id"]
    print(f"Run ID: {run_id}")

    for i in range(70):
        time.sleep(2)
        res = requests.get(f"http://127.0.0.1:8002/ds-tester/runs/{run_id}").json()
        status = res.get("status")
        overall = res.get("overall")
        live_step = res.get("live_step")
        print(f"[{i*2}s] Status={status}, Overall={overall}, Step: {live_step}")

        if status in ("done", "error"):
            print("\n--- RUN FINISHED ---")
            print("FILTERS:", json.dumps(res.get("filters"), indent=2))
            print("OVERALL RESULT:", overall)
            print("KPIS:")
            all_pass = True
            for k in res.get("kpis", []):
                k_status = k.get("status")
                print(f"  * {k.get('label'):<25}: API={str(k.get('api')):<8} Logic={str(k.get('logic')):<8} UI={str(k.get('ui_raw')):<10} Status={k_status} ({k.get('reason')})")
                if k_status != "PASS":
                    all_pass = False
            return all_pass
    return False

# Test BigBasket overview first
pass_bb = test_run("content_overview_bigbasket")
print("BigBasket OVERVIEW PASSED:", pass_bb)

