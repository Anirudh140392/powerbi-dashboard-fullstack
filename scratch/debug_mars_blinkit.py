import sys
sys.path.append('.')
from ds_tester.backend.modules.pricing import step1_fetch, step2_logic, _get_segment_info

period = {'startDate': '2026-11-01', 'endDate': '2026-11-01'}
s1 = step1_fetch('pricing_overview_blinkit', period, client='mars')
s2 = step2_logic('pricing_overview_blinkit', period, client='mars')
print("Mars pricing_overview_blinkit Step 1:", s1)
print("Mars pricing_overview_blinkit Step 2:", s2)
