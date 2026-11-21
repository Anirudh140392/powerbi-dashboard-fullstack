import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

print([r[0] for r in execute_select_query("SELECT name FROM system.columns WHERE table = 'rb_ms_olap' AND database = 'boat'", database="boat")])

