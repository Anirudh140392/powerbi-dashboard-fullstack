import sys
sys.path.append('.')
from ds_tester.backend.step2_logic import execute_select_query

query = """
SELECT 
    Platform,
    toStartOfMonth(DATE) as month,
    count(),
    sum(CASE WHEN Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(Sales)), 0) ELSE 0 END) as sales
FROM rb_pdp_olap
GROUP BY Platform, month
ORDER BY Platform, month DESC
"""
rows = execute_select_query(query, database='boat')
print("boAt Platform & Monthly Sales:")
for r in rows:
    print(f"Platform: {r[0]:10} | Month: {r[1]} | Rows: {r[2]:7} | Sales: {r[3]:14,.2f}")

