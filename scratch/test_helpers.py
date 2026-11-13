import sys
import json
sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")
from ds_tester.backend.step1_api import call_platform_api
from ds_tester.backend.modules.business_overview import _parse_num

def _parse_currency_cr(val):
    if val is None:
        return None
    s = str(val).strip().lower()
    if s in ("n/a", "-", "", "none", "null"):
        return None
    num = _parse_num(s)
    if num is None:
        return None
    if "cr" in s:
        return num
    elif "lac" in s or "lakh" in s:
        return num / 100.0
    elif "k" in s:
        return num / 10000.0
    return num

data = call_platform_api("/api/watchtower/category-overview", params={"startDate": "2026-10-01", "endDate": "2026-10-31"}, db_name="boat")
tot_offtake = 0.0
tot_spend = 0.0
tot_sales = 0.0
for c in data:
    cols = {col.get("title"): col.get("value") for col in c.get("columns", [])}
    tot_offtake += (_parse_currency_cr(cols.get("Offtakes")) or 0.0)
    tot_spend += (_parse_currency_cr(cols.get("Spend")) or 0.0)
    tot_sales += (_parse_currency_cr(cols.get("Inorg Sales")) or 0.0)

roas = tot_sales / tot_spend if tot_spend > 0 else 0
print(f"Total Offtake: {round(tot_offtake, 2)} Cr")
print(f"Total Spend: {round(tot_spend, 2)} Cr")
print(f"Total Sales: {round(tot_sales, 2)} Cr")
print(f"Overall ROAS: {round(roas, 2)}x")

