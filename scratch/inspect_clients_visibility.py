import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

for cl in ['boat', 'pidilite', 'mars', 'emami', 'drl']:
    try:
        cnt = execute_select_query(f"SELECT min(DATE), max(DATE), count() FROM {cl}.rb_kw_olap")
        plats = [r[0] for r in execute_select_query(f"SELECT DISTINCT platform_name FROM {cl}.rb_kw_olap")]
        print(f"{cl}: dates={cnt[0]}, platforms={plats}")
    except Exception as e:
        print(f"{cl}: ERROR {e}")

