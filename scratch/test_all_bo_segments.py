import sys
import json
import time

sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")

from ds_tester.backend.modules.business_overview import (
    BusinessOverviewModule,
    SEGMENTS,
    get_kpis_for_segment,
    step1_fetch,
    step2_logic,
    step3_ui,
    _parse_num,
)
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

period = {"startDate": "2026-10-01", "endDate": "2026-10-31"}
client = "boat"

print(f"=== TESTING BUSINESS OVERVIEW ALL 4 SEGMENTS FOR CLIENT: {client.upper()} ===")

# Test Step 1 and Step 2 for all 4 segments
for seg in SEGMENTS:
    seg_id = seg["id"]
    seg_label = seg["label"]
    kpis = get_kpis_for_segment(seg_id)
    
    s1 = step1_fetch(seg_id, period, client=client)
    s2 = step2_logic(seg_id, period, client=client)
    
    print(f"\n--- Segment: {seg_label} ({seg_id}) ---")
    for k in kpis:
        k_id = k["key"]
        v1 = s1.get(k_id)
        v2 = s2.get(k_id)
        unit = k.get("unit", "")
        tol = k.get("abs_tol", 1.0)
        
        diff = round(abs(v1 - v2), 4) if (v1 is not None and v2 is not None) else None
        status = "PASS" if (diff is not None and diff <= tol) else "DIFF"
        print(f"  {k['label']}: Step1(API)={v1} {unit} | Step2(Logic)={v2} {unit} | diff={diff} | [{status}]")

print("\n=== STARTING SELENIUM FOR STEP 3 UI SCRAPING ===")
opts = Options()
opts.add_argument("--headless")
opts.add_argument("--window-size=1920,1080")
driver = webdriver.Chrome(options=opts)

summary_results = []

try:
    for seg in SEGMENTS:
        seg_id = seg["id"]
        seg_label = seg["label"]
        kpis = get_kpis_for_segment(seg_id)
        
        s1 = step1_fetch(seg_id, period, client=client)
        s2 = step2_logic(seg_id, period, client=client)
        s3 = step3_ui(driver, seg_id, period, client=client, headless=True)
        
        print(f"\n=======================================================")
        print(f"  FULL 3-STEP VERIFICATION: {seg_label}")
        print(f"=======================================================")
        seg_pass = True
        for k in kpis:
            k_id = k["key"]
            v1 = s1.get(k_id)
            v2 = s2.get(k_id)
            v3_raw = s3.get(k_id)
            v3 = _parse_num(v3_raw)
            unit = k.get("unit", "")
            tol = k.get("abs_tol", 1.0)
            
            p12 = abs(v1 - v2) <= tol if (v1 is not None and v2 is not None) else False
            p23 = abs(v2 - v3) <= tol if (v2 is not None and v3 is not None) else False
            overall = "PASS" if (p12 and p23) else "CHECK"
            if overall != "PASS":
                seg_pass = False
            
            clean_raw = json.dumps(v3_raw, ensure_ascii=True)
            print(f"  * {k['label']}:")
            print(f"      Step 1 API   : {v1} {unit}")
            print(f"      Step 2 Logic : {v2} {unit}")
            print(f"      Step 3 UI    : {v3} {unit} (raw: {clean_raw})")
            print(f"      Status       : [{overall}]")
        
        summary_results.append({"segment": seg_label, "status": "100% PASS" if seg_pass else "FAIL"})

finally:
    driver.quit()

print("\n=== SUMMARY OF ALL 4 SEGMENTS ===")
for r in summary_results:
    print(f"  - {r['segment']}: {r['status']}")

print("\n=== ALL 4 SEGMENTS TEST RUN COMPLETE ===")
