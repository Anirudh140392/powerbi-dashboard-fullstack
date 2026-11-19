import sys
sys.path.insert(0, ".")
from ds_tester.backend.step2_logic import execute_select_query

cols = execute_select_query("SELECT name, type FROM system.columns WHERE database = 'admin_master' AND table = 'tb_user_access'")
print("tb_user_access columns:", cols)

sample_access = execute_select_query("SELECT * FROM admin_master.tb_user_access LIMIT 5")
print("\nsample tb_user_access:", sample_access)

user_cols = execute_select_query("SELECT name, type FROM system.columns WHERE database = 'admin_master' AND table = 'tb_user'")
print("\ntb_user columns:", user_cols)

sample_user = execute_select_query("SELECT email, role, database FROM admin_master.tb_user LIMIT 10")
print("\nsample tb_user:", sample_user)

