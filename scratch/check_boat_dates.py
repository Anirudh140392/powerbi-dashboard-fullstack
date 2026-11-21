import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

q = "SELECT min(toDate(DATE)), max(toDate(DATE)), count() FROM boat.rb_pdp_olap"
print("Boat pdp dates:", execute_select_query(q, database="boat"))
q2 = "SELECT min(toDate(date)), max(toDate(date)), count() FROM boat.rb_pm_olap"
try:
    print("Boat pm dates:", execute_select_query(q2, database="boat"))
except Exception as e:
    print("Boat pm error:", e)

