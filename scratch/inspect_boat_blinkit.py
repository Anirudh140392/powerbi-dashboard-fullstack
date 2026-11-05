import sys
sys.path.append('.')
from ds_tester.backend.step2_logic import execute_select_query

print("=== boAt Blinkit Inspection ===")
# 1. Distinct values and counts for Blinkit
query1 = """
SELECT 
    Platform,
    min(DATE),
    max(DATE),
    count(),
    countIf(Comp_flag = '0'),
    sum(ifNull(toFloat64OrZero(toString(Sales)), 0)),
    sum(CASE WHEN Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(Sales)), 0) ELSE 0 END)
FROM rb_pdp_olap
WHERE lower(Platform) = 'blinkit'
GROUP BY Platform
"""
rows1 = execute_select_query(query1, database='boat')
for r in rows1:
    print(f"Platform: {r[0]} | Min Date: {r[1]} | Max Date: {r[2]} | Total: {r[3]} | Our Rows: {r[4]} | Total Sales: {r[5]} | Our Sales: {r[6]}")

# 2. Check channel for Blinkit
query2 = """
SELECT DISTINCT Channel, Platform, count()
FROM rb_pdp_olap
WHERE lower(Platform) = 'blinkit'
GROUP BY Channel, Platform
"""
rows2 = execute_select_query(query2, database='boat')
print("Blinkit channels in boAt:", rows2)

# 3. Check sales for Blinkit by month
query3 = """
SELECT 
    toStartOfMonth(DATE) as month,
    count(),
    sum(CASE WHEN Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(Sales)), 0) ELSE 0 END)
FROM rb_pdp_olap
WHERE lower(Platform) = 'blinkit'
GROUP BY month
ORDER BY month DESC
"""
rows3 = execute_select_query(query3, database='boat')
print("Blinkit monthly sales in boAt:")
for r in rows3:
    print(f"  Month: {r[0]} | Rows: {r[1]} | Our Sales: {r[2]}")

