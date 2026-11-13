import sys
sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")

from ds_tester.backend.step1_api import call_platform_api
import json

db_name = "pidilite"
period = {"startDate": "2026-10-01", "endDate": "2026-10-30"}

tests = [
    {"desc": "platform=Amazon (Step 1 call)", "params": {"platform": "Amazon"}},
    {"desc": "platform=Amazon, channel=Ecommerce", "params": {"platform": "Amazon", "channel": "Ecommerce"}},
    {"desc": "platform=amazon, channel=ecommerce", "params": {"platform": "amazon", "channel": "ecommerce"}},
    {"desc": "channel=Ecommerce only", "params": {"channel": "Ecommerce"}},
    {"desc": "No params", "params": {}},
    {"desc": "platform=All", "params": {"platform": "All"}},
]

for t in tests:
    res = call_platform_api(
        endpoint="/api/pricing-analysis/kpis",
        params=t["params"],
        period=period,
        db_name=db_name,
    )
    data = res.get("data", {}) if res.get("success") else {}
    disc = data.get("discount", {}).get("value")
    w_disc = data.get("weightedDiscount", {}).get("value")
    asp = data.get("asp", {}).get("value")
    print(f"{t['desc']} -> disc={disc}, w_disc={w_disc}, asp={asp}")

