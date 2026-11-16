import sys
import json
sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")
from ds_tester.backend.step1_api import call_platform_api

data = call_platform_api("/api/watchtower/category-overview", params={"startDate": "2026-10-01", "endDate": "2026-10-31"}, db_name="boat")
print("COUNT:", len(data))
for c in data:
    cols = {col.get("title"): col.get("value") for col in c.get("columns", [])}
    print(c.get("label"), json.dumps(cols, ensure_ascii=True))
