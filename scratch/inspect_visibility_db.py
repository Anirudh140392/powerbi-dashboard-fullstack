import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

print("Columns in boat.rb_kw_olap:")
cols = [r[0] for r in execute_select_query("SELECT name FROM system.columns WHERE database = 'boat' AND table = 'rb_kw_olap'")]
print(cols)

print("\nDistinct platforms in boat.rb_kw_olap:")
platforms = execute_select_query("SELECT DISTINCT platform_name FROM boat.rb_kw_olap")
print(platforms)

print("\nDate range in boat.rb_kw_olap:")
dates = execute_select_query("SELECT min(DATE), max(DATE), count() FROM boat.rb_kw_olap")
print(dates)

print("\nSample row from boat.rb_kw_olap:")
sample = execute_select_query("SELECT * FROM boat.rb_kw_olap LIMIT 1")
print(sample)

