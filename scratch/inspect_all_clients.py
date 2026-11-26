import sys
import json
sys.path.insert(0, ".")
from ds_tester.backend.step2_logic import execute_select_query

# 1. Query all databases from tb_database
dbs = execute_select_query("SELECT id, db_name, status, created_on FROM admin_master.tb_database WHERE status = 'active' ORDER BY id")
print(f"Total active databases: {len(dbs)}")
for d in dbs:
    print(d)

# 2. Check tabPermissions from tb_user for each database
users = execute_select_query("SELECT DISTINCT db_id, user_email, tab_permissions, status FROM admin_master.tb_user WHERE status = 'active'")
print(f"\nTotal users: {len(users)}")
for u in users:
    print(u[0], u[1], u[3], u[2][:100] if u[2] else None)
