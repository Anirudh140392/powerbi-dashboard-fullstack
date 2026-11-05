import sys, os
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.modules.pds_score import step1_fetch, step2_logic, step3_selenium, KPIS
from ds_tester.backend.comparator import compare_kpi, normalize_ui_text
from ds_tester.backend.step3_selenium import create_chrome_driver, ensure_authenticated, FRONTEND_URL

period = {"startDate": "2026-10-04", "endDate": "2026-10-31"}
segment = "pds_score_zepto"
client = "mars"

print(f"=== Running Live Test for PDS Score: {segment} ({client}) ===")

# Step 1: API
print("\n--- Step 1: API ---")
api_res = step1_fetch(segment, period, client=client)
print("API results:", api_res)

# Step 2: Logic
print("\n--- Step 2: Logic ---")
logic_res = step2_logic(segment, period, client=client)
print("Logic results:", logic_res)

# Step 3: UI
print("\n--- Step 3: Selenium UI ---")
driver = create_chrome_driver(headless=False)
try:
    target_url = f"{FRONTEND_URL}/pds-score"
    ensure_authenticated(driver, target_url, client=client)
    ui_raw_res = step3_selenium(driver, segment, period, client=client, headless=False)
    print("UI Raw extracted:", ui_raw_res)
finally:
    driver.quit()

# Comparator
print("\n=== COMPARISON RESULTS ===")
all_pass = True
for kpi in KPIS:
    k = kpi["key"]
    api_val = api_res.get(k)
    logic_val = logic_res.get(k)
    ui_raw = ui_raw_res.get(k)
    ui_val, _ = normalize_ui_text(ui_raw)

    comp = compare_kpi(kpi, api_val, logic_val, ui_val, ui_raw=ui_raw)
    status = comp["status"]
    if status != "PASS":
        all_pass = False
    print(f"[{status}] {kpi['label']}: API={api_val}, Logic={logic_val}, UI={ui_val} (raw: '{ui_raw}') | Reason: {comp.get('reason')}")

if all_pass:
    print("\nALL KPIS PASSED 100% FOR PDS SCORE ON ZEPTO!")
else:
    print("\nSOME KPIS DIFFERED. REVIEW DIAGNOSIS ABOVE.")
