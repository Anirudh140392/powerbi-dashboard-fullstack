import sys
sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")

from ds_tester.backend.step1_api import call_platform_api
import json

db_name = "pidilite"
period = {"startDate": "2026-10-01", "endDate": "2026-10-30"}

# Check all distinct brands for pidilite in ClickHouse
from ds_tester.backend.step2_logic import execute_select_query
brands = execute_select_query("SELECT DISTINCT Brand FROM pidilite.rb_pdp_olap", database="pidilite")
print("Brands in pidilite:", [b[0] for b in brands if b[0]])

for b in [b[0] for b in brands if b[0]]:
    res = call_platform_api(
        endpoint="/api/pricing-analysis/kpis",
        params={"platform": "Amazon", "brand": b},
        period=period,
        db_name=db_name,
    )
    data = res.get("data", {}) if res.get("success") else {}
    disc = data.get("discount", {}).get("value")
    w_disc = data.get("weightedDiscount", {}).get("value")
    asp = data.get("asp", {}).get("value")
    print(f"Brand '{b}' -> disc={disc}, w_disc={w_disc}, asp={asp}")

