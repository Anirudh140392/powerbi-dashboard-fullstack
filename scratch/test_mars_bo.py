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

period = {"startDate": "2026-10-01", "endDate": "2026-10-31"}
client = "mars"

print(f"=== TESTING BUSINESS OVERVIEW ALL 4 SEGMENTS FOR CLIENT: {client.upper()} ===")

summary_results = []

for seg in SEGMENTS:
    seg_id = seg["id"]
    seg_label = seg["label"]
    kpis = get_kpis_for_segment(seg_id)
    
    s1 = step1_fetch(seg_id, period, client=client)
    s2 = step2_logic(seg_id, period, client=client)
    
    print(f"\n=======================================================")
    print(f"  STEP 1 API vs STEP 2 LOGIC: {seg_label} ({client})")
    print(f"=======================================================")
    seg_pass = True
    for k in kpis:
        k_id = k["key"]
        v1 = s1.get(k_id)
        v2 = s2.get(k_id)
        unit = k.get("unit", "")
        tol = k.get("abs_tol", 1.0)
        
        diff = round(abs(v1 - v2), 4) if (v1 is not None and v2 is not None) else None
        overall = "PASS" if (diff is not None and diff <= tol) else "CHECK"
        if overall != "PASS":
            seg_pass = False
        
        print(f"  * {k['label']}:")
        print(f"      Step 1 API   : {v1} {unit}")
        print(f"      Step 2 Logic : {v2} {unit}")
        print(f"      Diff         : {diff} {unit} -> [{overall}]")
    
    summary_results.append({"segment": seg_label, "status": "100% PASS" if seg_pass else "DIFF"})

print("\n=== SUMMARY OF ALL 4 SEGMENTS FOR MARS ===")
for r in summary_results:
    print(f"  - {r['segment']}: {r['status']}")

