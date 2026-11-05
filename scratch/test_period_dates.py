import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

q = """
SELECT 
    toYear(DATE) as yr,
    min(DATE),
    max(DATE),
    count()
FROM mars.rb_pdp_olap
WHERE lower(Platform) = 'blinkit'
GROUP BY yr
ORDER BY yr
"""
print(execute_select_query(q, database='mars'))
