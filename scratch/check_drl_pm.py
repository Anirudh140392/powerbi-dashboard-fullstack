from ds_tester.backend.step2_logic import execute_select_query

tables = execute_select_query("SELECT name FROM system.tables WHERE database = 'drl' AND (name LIKE '%pm%' OR name LIKE '%perform%' OR name LIKE '%ad%')")
print('DRL PM / Marketing tables:', tables)

all_tables = execute_select_query("SELECT name FROM system.tables WHERE database = 'drl' ORDER BY name")
print('\nAll DRL tables count:', len(all_tables))
print('All DRL tables:', [t[0] for t in all_tables])
