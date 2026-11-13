import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

clients = ["boat", "mars", "pidilite", "drl", "emami", "mamaearth", "sugar", "danone", "zydus"]

for c in clients:
    try:
        tables = execute_select_query(f"SELECT name FROM system.tables WHERE database = '{c}'", database=c)
        table_names = [t[0] for t in tables]
        has_pdp = "rb_pdp_olap" in table_names
        has_pm = any("pm" in t for t in table_names)
        has_kw = "rb_kw_olap" in table_names
        print(f"[{c}] Tables: {len(table_names)}, pdp={has_pdp}, pm={has_pm}, kw={has_kw}")
    except Exception as e:
        print(f"[{c}] Error: {e}")

