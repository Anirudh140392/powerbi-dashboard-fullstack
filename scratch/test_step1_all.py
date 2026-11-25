import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step1_api import call_platform_api
import json

def parse_num(val):
    if val is None or val == "N/A" or val == "-":
        return None
    s = str(val).replace("?", "").replace("₹", "").replace(",", "").replace("%", "").replace("Cr", "").replace("Lac", "").replace("K", "").replace("x", "").strip()
    try:
        return float(s)
    except:
        return None

client = "boat"
p = {"startDate": "2026-10-01", "endDate": "2026-10-31"}

print("--- 1. OVERVIEW ---")
ov = call_platform_api("/api/watchtower/overview", params=p, db_name=client)
top = ov.get("topMetrics", [])
ov_metrics = {}
for m in top:
    name = m.get("name")
    val = parse_num(m.get("label"))
    ov_metrics[name] = val
print("Overview parsed:", ov_metrics)

print("\n--- 2. PLATFORM OVERVIEW ---")
plat = call_platform_api("/api/watchtower/platform-overview", params=p, db_name=client)
print("Platforms count:", len(plat))
if plat:
    # check first item 'all'
    all_p = plat[0]
    cols = {c["title"]: parse_num(c["value"]) for c in all_p.get("columns", [])}
    print("All platform columns:", cols.get("Offtakes"), cols.get("OSA"), cols.get("Share of Search"))

print("\n--- 3. CATEGORY OVERVIEW ---")
cat = call_platform_api("/api/watchtower/category-overview", params=p, db_name=client)
print("Category count:", len(cat))
if cat:
    print("Sample category:", cat[0].get("label"))
    cols0 = {c["title"]: parse_num(c["value"]) for c in cat[0].get("columns", [])}
    print("Sample cat cols:", cols0.get("Offtakes"), cols0.get("Spend"), cols0.get("ROAS"))

print("\n--- 4. PERFORMANCE BREAKDOWN ---")
pb = call_platform_api("/api/watchtower/performance-breakdown", params=p, db_name=client)
totals = pb.get("totals", {})
print("Performance Breakdown totals:", totals)

