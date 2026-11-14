import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

boat_pm = [r[0] for r in execute_select_query("SELECT name FROM system.columns WHERE table = 'rb_pm_olap' AND database = 'boat'", database="boat")]
print("Boat PM columns:", boat_pm)

mars_pm = [r[0] for r in execute_select_query("SELECT name FROM system.columns WHERE table = 'rb_pm_olap' AND database = 'mars'", database="mars")]
print("Mars PM columns:", mars_pm)

