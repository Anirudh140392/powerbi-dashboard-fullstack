import sys
sys.path.append('.')
from ds_tester.backend.step2_logic import execute_select_query

# 2. Check channel for Blinkit
query2 = """
SELECT DISTINCT channel, Platform, count()
FROM rb_pdp_olap
WHERE lower(Platform) = 'blinkit'
GROUP BY channel, Platform
"""
rows2 = execute_select_query(query2, database='boat')
print("Blinkit channels in boAt:", rows2)

# 3. Check sales for Blinkit by month
query3 = """
SELECT 
    toStartOfMonth(DATE) as month,
    count(),
    sum(CASE WHEN Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(Sales)), 0) ELSE 0 END),
    SUM(CASE WHEN Comp_flag = '0' THEN ((ifNull(toFloat64OrZero(toString(MRP)), 0) - ifNull(toFloat64OrZero(toString(Selling_Price)), 0)) / NULLIF(ifNull(toFloat64OrZero(toString(MRP)), 0), 0)) * ifNull(toFloat64OrZero(toString(Sales)), 0) ELSE 0 END) / NULLIF(SUM(CASE WHEN Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(Sales)), 0) ELSE 0 END), 0) * 100 AS weighted_discount
FROM rb_pdp_olap
WHERE lower(Platform) = 'blinkit'
GROUP BY month
ORDER BY month DESC
"""
rows3 = execute_select_query(query3, database='boat')
print("Blinkit monthly sales & weighted discount in boAt:")
for r in rows3:
    print(f"  Month: {r[0]} | Rows: {r[1]} | Our Sales: {r[2]} | Weighted Disc: {r[3]}")

