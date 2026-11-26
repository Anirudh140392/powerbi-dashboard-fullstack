import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

cols = [r[0] for r in execute_select_query("SELECT name FROM system.columns WHERE table = 'rb_kw_olap' AND database = 'boat'", database="boat")]
print("Boat kw cols:", cols)

q = """
SELECT 
    (sumIf(toInt32(overall), POSITION <= 10 AND toString(flag) = '1') / nullIf(sumIf(toInt32(overall), POSITION <= 10), 0)) * 100 as sos
FROM boat.rb_kw_olap
WHERE toDate(DATE) BETWEEN '2026-10-01' AND '2026-10-31'
"""
print("Boat SOS result:", execute_select_query(q, database="boat"))

q_mars = """
SELECT 
    (sumIf(toInt32(overall), POSITION <= 10 AND toString(flag) = '1') / nullIf(sumIf(toInt32(overall), POSITION <= 10), 0)) * 100 as sos
FROM mars.rb_kw_olap
WHERE toDate(DATE) BETWEEN '2026-10-04' AND '2026-10-31'
"""
print("Mars SOS result:", execute_select_query(q_mars, database="mars"))

