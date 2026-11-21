import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step1_api import call_platform_api
import json

def test_api(client, endpoint, params):
    try:
        data = call_platform_api(endpoint, params=params, db_name=client)
        if isinstance(data, dict):
            print(f"[{client}] {endpoint} SUCCESS, keys:", list(data.keys())[:10])
            if "topMetrics" in data:
                print("  topMetrics names:", [m.get("name") for m in data["topMetrics"]])
                print("  topMetrics labels:", [m.get("label") for m in data["topMetrics"]])
            if "platformOverview" in data:
                print("  platformOverview length:", len(data["platformOverview"]))
            if "data" in data and isinstance(data["data"], list):
                print("  data rows:", len(data["data"]), "sample:", data["data"][:1])
            elif isinstance(data, list):
                print("  list rows:", len(data), "sample:", data[:1])
        elif isinstance(data, list):
            print(f"[{client}] {endpoint} SUCCESS, list({len(data)})")
            if len(data) > 0:
                print("  sample item:", data[0])
    except Exception as e:
        print(f"[{client}] {endpoint} ERROR: {e}")

print("--- TESTING BOAT ---")
p_boat = {"startDate": "2024-05-01", "endDate": "2024-05-31"}
test_api("boat", "/api/watchtower/overview", p_boat)
test_api("boat", "/api/watchtower/platform-overview", p_boat)
test_api("boat", "/api/watchtower/category-overview", p_boat)
test_api("boat", "/api/watchtower/performance-breakdown", p_boat)

print("\n--- TESTING MARS ---")
p_mars = {"startDate": "2026-10-04", "endDate": "2026-10-31"}
test_api("mars", "/api/watchtower/overview", p_mars)
test_api("mars", "/api/watchtower/platform-overview", p_mars)
test_api("mars", "/api/watchtower/category-overview", p_mars)
test_api("mars", "/api/watchtower/performance-breakdown", p_mars)
