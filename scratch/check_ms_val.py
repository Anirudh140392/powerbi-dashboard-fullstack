import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

q = """
SELECT 
    (sumIf(toFloat64OrZero(toString(sales)), toString(flag) = '1') / nullIf(sum(toFloat64OrZero(toString(sales))), 0)) * 100 as ms
FROM boat.rb_ms_olap
WHERE toDate(created_on) BETWEEN '2026-10-01' AND '2026-10-31'
"""
print("Boat MS:", execute_select_query(q, database="boat"))

q_mars = """
SELECT 
    (sumIf(toFloat64OrZero(toString(sales)), toString(flag) = '1') / nullIf(sum(toFloat64OrZero(toString(sales))), 0)) * 100 as ms
FROM mars.rb_ms_olap
WHERE toDate(created_on) BETWEEN '2026-10-04' AND '2026-10-31'
"""
print("Mars MS:", execute_select_query(q_mars, database="mars"))

