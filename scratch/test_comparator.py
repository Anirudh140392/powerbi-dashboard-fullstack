import sys
sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")

from ds_tester.backend.comparator import normalize_ui_text, compare_kpi

kpi_def = {"key": "offtake", "label": "Offtake", "unit": "Cr", "decimals": 2, "abs_tol": 1.0, "rel_tol": 0.05}

raw_ui = "₹94.99 Cr"
ui_val, decimals = normalize_ui_text(raw_ui, target_unit=kpi_def.get("unit"))
print(f"normalize_ui_text -> val={ui_val}, decimals={decimals}")

res = compare_kpi(
    kpi_def=kpi_def,
    api_val=94.99,
    logic_val=94.99,
    ui_val=ui_val,
    ui_raw=raw_ui,
)
print("compare_kpi result:", res["status"], res.get("reason"))

# Also test fallback if ui_val was unnormalized (949,900,000)
res2 = compare_kpi(
    kpi_def=kpi_def,
    api_val=94.99,
    logic_val=94.99,
    ui_val=949900000.0,
    ui_raw=raw_ui,
)
print("compare_kpi fallback test with 949,900,000:", res2["status"], res2.get("reason"))
