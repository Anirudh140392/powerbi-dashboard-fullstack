import os
import sys
import time
import requests

sys.path.insert(0, os.path.abspath("."))
sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8002/ds-tester"

def test_run(client, segment, period):
    print(f"\n=======================================================")
    print(f"Triggering DS Tester Run: client={client}, segment={segment}, period={period}")
    print(f"=======================================================")
    
    payload = {
        "module": "market_share",
        "segment": segment,
        "period": period,
        "client": client,
        "headless": True
    }
    
    res = requests.post(f"{BASE_URL}/run", json=payload)
    if res.status_code != 200:
        print(f"FAILED to trigger: {res.status_code} {res.text}")
        return False
    
    run_id = res.json().get("run_id")
    print(f"Run started with ID: {run_id}")
    
    start_t = time.time()
    while time.time() - start_t < 90:
        time.sleep(2)
        r = requests.get(f"{BASE_URL}/runs/{run_id}").json()
        status = r.get("status")
        overall = r.get("overall")
        live_step = r.get("live_step")
        print(f"  [{status.upper()}] Overall: {overall} | Step: {live_step}")
        
        if status in ("done", "error"):
            print("\n--- FINAL TEST RESULTS ---")
            print(f"Overall Status: {overall}")
            for kpi in r.get("kpis", []):
                print(f"  * {kpi['label']}: status={kpi['status']} | API={kpi['api']} | Logic={kpi['logic']} | UI={kpi['ui']} (UI raw='{kpi['ui_raw']}') | reason={kpi.get('reason')}")
            return overall == "PASS"

    print("TIMEOUT waiting for run to complete.")
    return False

if __name__ == "__main__":
    # Test 1: boat blinkit
    p1 = {"startDate": "2026-04-01", "endDate": "2026-04-15"}
    success1 = test_run("boat", "market_share_overview_blinkit", p1)

    # Test 2: boat all platforms
    success2 = test_run("boat", "market_share_overview", p1)

    # Test 3: mars all platforms
    p2 = {"startDate": "2026-10-01", "endDate": "2026-10-15"}
    success3 = test_run("mars", "market_share_overview", p2)

    print("\n=======================================================")
    print(f"SUMMARY: Test1={success1}, Test2={success2}, Test3={success3}")
    print("=======================================================")
