import sys
import json
sys.path.insert(0, ".")
from ds_tester.backend.step2_logic import execute_select_query

# Check unique tables in key clients
for db in ["drl", "pidilite", "mars", "boat", "mamaearth", "zydus", "sugar", "prestige", "emami"]:
    tables = execute_select_query(f"SELECT name FROM system.tables WHERE database = '{db}'")
    table_names = sorted([t[0] for t in tables])
    print(f"\n=== {db.upper()} ({len(table_names)} tables) ===")
    print([t for t in table_names if not t.startswith('tmp_') and not t.endswith('_backup') and not t.endswith('_old')])

