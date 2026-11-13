import sys, os
sys.path.insert(0, os.path.abspath('.'))
from ds_tester.backend.step2_logic import execute_select_query

print('--- mars.po_v_periods ---')
for row in execute_select_query("SELECT * FROM mars.po_v_periods ORDER BY period_start DESC LIMIT 15", database='mars'):
    print(row)

print('\n--- mars.po_calendar columns and sample ---')
cols = execute_select_query("SELECT name, type FROM system.columns WHERE database = 'mars' AND table = 'po_calendar'", database='mars')
for c in cols:
    print(c[0], c[1])

print('\n--- sample from po_calendar for 2026 ---')
for row in execute_select_query("SELECT DISTINCT period_id, period_name, min(calendar_date), max(calendar_date) FROM mars.po_calendar WHERE year = 2026 GROUP BY period_id, period_name ORDER BY period_id LIMIT 10", database='mars'):
    print(row)
