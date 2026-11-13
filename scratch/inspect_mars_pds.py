import sys, os
sys.path.insert(0, os.path.abspath('.'))
from ds_tester.backend.step2_logic import execute_select_query

print('--- mars.rb_kw_olap sample ---')
print(execute_select_query("SELECT keyword_type, platform_name, min(DATE), max(DATE), count() FROM mars.rb_kw_olap GROUP BY keyword_type, platform_name LIMIT 10", database='mars'))
