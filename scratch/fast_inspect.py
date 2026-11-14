import sys
import json
sys.path.insert(0, ".")
from ds_tester.backend.step2_logic import execute_select_query

# 1. Fetch all active databases
dbs_raw = execute_select_query("SELECT id, db_name FROM admin_master.tb_database WHERE status = 'active' ORDER BY db_name")
db_list = [r[1] for r in dbs_raw]
db_in_str = ", ".join([f"'{d}'" for d in db_list])

# 2. Single query for all tables across all active client databases
tables_raw = execute_select_query(f"SELECT database, name FROM system.tables WHERE database IN ({db_in_str})")
db_tables = {}
for db in db_list:
    db_tables[db] = set()
for r in tables_raw:
    db_tables[r[0]].add(r[1])

print(f"Loaded tables for {len(db_list)} databases.")
for db in db_list:
    t_count = len(db_tables[db])
    has_rca = "rca_sku_dim" in db_tables[db]
    has_pdp = "rb_pdp_olap" in db_tables[db]
    has_verify = "rb_product_verify" in db_tables[db]
    has_content_olap = "rb_content_olap" in db_tables[db]
    print(f"{db:<20}: {t_count:<4} tables | rca={has_rca} pdp={has_pdp} verify={has_verify} content_olap={has_content_olap}")

