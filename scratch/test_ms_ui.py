import sys, os, time
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step3_selenium import (
    create_chrome_driver,
    ensure_authenticated,
    apply_dashboard_period,
    wait_for_loading_complete,
    FRONTEND_URL
)
from selenium.webdriver.common.by import By

driver = create_chrome_driver(headless=True)
try:
    print("=== Testing Market Share UI Scraping with Date Picker ===")
    target_url_ms = f"{FRONTEND_URL}/market-share"
    ensure_authenticated(driver, target_url_ms, client="mars")
    wait_for_loading_complete(driver, timeout=25)
    time.sleep(2)
    
    period = {"startDate": "2026-03-01", "endDate": "2026-03-31"}
    print("Applying date range: March 2026...")
    apply_dashboard_period(driver, period)
    wait_for_loading_complete(driver, timeout=20)
    time.sleep(2)

    cards = driver.find_elements(By.CSS_SELECTOR, "div.group.relative")
    print(f"Found {len(cards)} Market Share cards:")
    for c in cards:
        lines = [l.strip() for l in c.text.split("\n") if l.strip()]
        print(f"  MS Card text lines: {lines}")

finally:
    driver.quit()
