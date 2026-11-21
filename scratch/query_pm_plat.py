import sys
sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")
from ds_tester.backend.step2_logic import execute_select_query

rows = execute_select_query("""
    SELECT DISTINCT Platform, min(toDate(DATE)), max(toDate(DATE)), count(), sum(impressions), sum(ad_spend), sum(ad_sales)
    FROM boat.rb_pm_olap
    GROUP BY Platform
""")
for r in rows:
    print(r)
