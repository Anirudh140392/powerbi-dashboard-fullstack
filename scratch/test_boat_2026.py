import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step1_api import call_platform_api
import json

p_boat = {"startDate": "2026-10-01", "endDate": "2026-10-31"}
data = call_platform_api("/api/watchtower/overview", params=p_boat, db_name="boat")
print("[boat] overview topMetrics:")
for m in data.get("topMetrics", []):
    print(" ", m.get("name"), ":", repr(m.get("label")))

