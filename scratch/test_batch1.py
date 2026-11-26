import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))
from ds_tester.backend.step1_api import call_platform_api
from ds_tester.backend.step2_logic import execute_select_query

print("=== 1. WATCH TOWER TEST ===")
res_wt = call_platform_api('/api/watchtower/overview', params={'startDate': '2026-03-01', 'endDate': '2026-03-31'}, db_name='mars')
top = res_wt.get('topMetrics', [])
for m in top:
    print(f"API WT -> {m.get('name')}: {m.get('label')}")

# ClickHouse Logic for WT
q_sales = "SELECT SUM(toFloat64OrZero(toString(Sales))) FROM mars.rb_pdp_olap WHERE toDate(DATE) >= '2026-03-01' AND toDate(DATE) <= '2026-03-31' AND (toString(Comp_flag) = '0' OR Comp_flag = 0)"
q_osa = "SELECT SUM(toFloat64OrZero(toString(neno_osa))) / SUM(toFloat64OrZero(toString(deno_osa))) * 100 FROM mars.rb_pdp_olap WHERE toDate(DATE) >= '2026-03-01' AND toDate(DATE) <= '2026-03-31' AND (toString(Comp_flag) = '0' OR Comp_flag = 0)"
q_disc = "SELECT (SUM(toFloat64OrZero(toString(MRP))) - SUM(toFloat64OrZero(toString(Selling_Price)))) / NULLIF(SUM(toFloat64OrZero(toString(MRP))), 0) * 100 FROM mars.rb_pdp_olap WHERE toDate(DATE) >= '2026-03-01' AND toDate(DATE) <= '2026-03-31' AND (toString(Comp_flag) = '0' OR Comp_flag = 0) AND neno_osa > 0"

sales_val = execute_select_query(q_sales, database='mars')[0][0]
osa_val = execute_select_query(q_osa, database='mars')[0][0]
disc_val = execute_select_query(q_disc, database='mars')[0][0]
print(f"DB WT -> Sales: ₹{sales_val/1e7:.2f} Cr, OSA: {osa_val:.2f}%, Discount: {disc_val:.2f}%")

print("\n=== 2. MARKET SHARE TEST ===")
res_ms = call_platform_api('/api/market-share', params={'startDate': '2026-03-01', 'endDate': '2026-03-31'}, db_name='mars')
mars_wrigley = res_ms.get('marsWrigley', {})
ms_val = res_ms.get('marketShare', {})
cat_size = res_ms.get('categorySize', {})
print(f"API MS -> Mars Sales: ₹{mars_wrigley.get('sales', 0)/1e7:.2f} Cr, Market Share: {ms_val.get('share')}%, Cat Size: ₹{cat_size.get('size', 0)/1e7:.2f} Cr")

# ClickHouse Logic for MS
brand_rows = execute_select_query("SELECT DISTINCT brand_name FROM mars.rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL AND brand_name != ''", database='mars')
our_brands = [f"'{b[0].lower().strip()}'" for b in brand_rows if b and b[0]]
brands_str = ", ".join(our_brands)

# Check Share of Search in ClickHouse
q_sos = f"""
SELECT 
    SUM(if(lower(brand) IN ({brands_str}) AND toInt32OrZero(toString(POSITION)) <= 10, toInt32OrZero(toString(overall)), 0)) / 
    NULLIF(SUM(if(toInt32OrZero(toString(POSITION)) <= 10, toInt32OrZero(toString(overall)), 0)), 0) * 100 as sos
FROM mars.rb_kw_olap
WHERE toDate(DATE) >= '2026-03-01' AND toDate(DATE) <= '2026-03-31'
"""
try:
    sos_val = execute_select_query(q_sos, database='mars')[0][0]
    print(f"DB WT -> Share of Search: {sos_val:.2f}%")
except Exception as e:
    print("Error querying SOS:", e)





