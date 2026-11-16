import sys
import json
sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")
from ds_tester.backend.step1_api import call_platform_api

data = call_platform_api("/api/watchtower/platform-overview", params={"startDate": "2026-10-01", "endDate": "2026-10-31"}, db_name="boat")
for r in data:
    cols = {c.get("title"): c.get("value") for c in r.get("columns", [])}
    print(r.get("label"), json.dumps(cols, ensure_ascii=True))

