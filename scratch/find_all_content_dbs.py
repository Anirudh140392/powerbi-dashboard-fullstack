import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

q = "SELECT database, name, total_rows FROM system.tables WHERE name LIKE '%verify%' OR name LIKE '%content%' ORDER BY database, name"
rows = execute_select_query(q)
for r in rows:
    print(f"{r[0]}.{r[1]} -> rows={r[2]}")

