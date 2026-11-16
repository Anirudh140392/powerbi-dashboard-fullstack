import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step1_api import call_platform_api
from ds_tester.backend.step2_logic import execute_select_query, period_to_date_range

client = "pidilite"
period = {"startDate": "2026-10-01", "endDate": "2026-10-15"}

print("=== TESTING STEP 1: API (PIDILITE) ===")
# 1. Overview
ov = call_platform_api("/api/pricing-analysis/kpis", period=period, db_name=client)
print("Overview API:", {k: ov.get('data', {}).get(k, {}).get('value') for k in ['discount', 'weightedDiscount', 'asp']})

# 2. Insights
ins = call_platform_api("/api/pricing-analysis/insights", period=period, db_name=client)
print("Insights API counts:", {k: len(ins.get('data', {}).get(k, [])) for k in ['my_skus_drop', 'my_skus_hike', 'comp_skus_drop', 'comp_skus_hike']})

# 3. Platform Overview
plat = call_platform_api("/api/pricing-analysis/dimension-overview", params={"dimension": "platform"}, period=period, db_name=client)
print("Platform Overview API rows:", len(plat.get('data', [])))

print("\n=== TESTING STEP 2: CLICKHOUSE (PIDILITE) ===")
start_date, end_date = period_to_date_range(period)
# 1. Overview
ov_query = f"""
SELECT
    100 * (avgIf(MRP, MRP>0) - avgIf(Selling_Price, Selling_Price>0)) / NULLIF(avgIf(MRP, MRP>0), 0) AS discount,
    100 * sum(((MRP - Selling_Price) / NULLIF(MRP, 0)) * Sales) / NULLIF(sum(Sales), 0) AS weighted_discount,
    avgIf(Selling_Price, Selling_Price>0 AND neno_osa>0) AS asp
FROM rb_pdp_olap
WHERE DATE BETWEEN '{start_date}' AND '{end_date}'
  AND Comp_flag = '0'
"""
ov_rows = execute_select_query(ov_query, database=client)
print("Overview CH:", ov_rows[0])

# 2. Insights
# previous dates: 2026-09-16 to 2026-09-30
ins_query = f"""
SELECT
    Brand,
    Product,
    Comp_flag,
    Platform,
    (SUM(CASE WHEN DATE BETWEEN '2026-10-01' AND '2026-10-15' AND MRP > 0 THEN MRP ELSE 0 END) - SUM(CASE WHEN DATE BETWEEN '2026-10-01' AND '2026-10-15' AND MRP > 0 THEN Selling_Price ELSE 0 END)) / NULLIF(SUM(CASE WHEN DATE BETWEEN '2026-10-01' AND '2026-10-15' AND MRP > 0 THEN MRP ELSE 0 END), 0) * 100 AS discount_curr,
    (SUM(CASE WHEN DATE BETWEEN '2026-09-16' AND '2026-09-30' AND MRP > 0 THEN MRP ELSE 0 END) - SUM(CASE WHEN DATE BETWEEN '2026-09-16' AND '2026-09-30' AND MRP > 0 THEN Selling_Price ELSE 0 END)) / NULLIF(SUM(CASE WHEN DATE BETWEEN '2026-09-16' AND '2026-09-30' AND MRP > 0 THEN MRP ELSE 0 END), 0) * 100 AS discount_prev
FROM rb_pdp_olap
WHERE DATE BETWEEN '2026-09-16' AND '2026-10-15'
  AND Selling_Price > 0 AND Brand IS NOT NULL AND Brand != ''
GROUP BY Brand, Product, Comp_flag, Platform
HAVING discount_curr IS NOT NULL AND discount_prev IS NOT NULL
"""
ins_rows = execute_select_query(ins_query, database=client)
my_drop = 0
my_hike = 0
comp_drop = 0
comp_hike = 0
for r in ins_rows:
    dc = float(r[4] or 0)
    dp = float(r[5] or 0)
    delta = dp - dc
    if abs(delta) >= 0.1:
        is_my = (str(r[2]) == '0')
        if is_my and delta < 0:
            my_drop += 1
        elif is_my and delta > 0:
            my_hike += 1
        elif not is_my and delta < 0:
            comp_drop += 1
        elif not is_my and delta > 0:
            comp_hike += 1
print("Insights CH counts (capped at 5):", {
    "my_skus_drop": min(5, my_drop),
    "my_skus_hike": min(5, my_hike),
    "comp_skus_drop": min(5, comp_drop),
    "comp_skus_hike": min(5, comp_hike),
})
