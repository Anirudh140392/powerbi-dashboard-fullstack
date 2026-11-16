import sys
sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")

from ds_tester.backend.modules.pricing import step3_ui
from ds_tester.backend.step3_selenium import create_chrome_driver
import json

driver = create_chrome_driver(headless=True)
try:
    def on_step(s):
        print("STEP:", s)
    res = step3_ui(
        driver, 
        "pricing_overview_amazon", 
        {"startDate": "2026-10-01", "endDate": "2026-10-30"}, 
        client="pidilite", 
        headless=True,
        on_live_step=on_step
    )
    print("SELENIUM RESULT:", json.dumps(res, ensure_ascii=True, indent=2))
finally:
    driver.quit()

