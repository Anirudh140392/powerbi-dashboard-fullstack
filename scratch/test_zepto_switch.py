import sys, os, time
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step3_selenium import (
    create_chrome_driver,
    ensure_authenticated,
    apply_dashboard_period,
    apply_segment_platform,
    wait_for_loading_complete,
    FRONTEND_URL
)
from selenium.webdriver.common.by import By

driver = create_chrome_driver(headless=True)
try:
    target_url = f"{FRONTEND_URL}/market-share"
    ensure_authenticated(driver, target_url, client="mars")
    wait_for_loading_complete(driver, timeout=25)
    time.sleep(2)

    period = {"startDate": "2026-03-01", "endDate": "2026-03-31"}
    apply_dashboard_period(driver, period)
    wait_for_loading_complete(driver, timeout=20)
    time.sleep(2)

    print("=== Testing switch to Zepto ===")
    ok, err = apply_segment_platform(driver, "zepto")
    print(f"apply_segment_platform('zepto') returned: ok={ok}, err={err}")
    wait_for_loading_complete(driver, timeout=20)
    time.sleep(3)

    cards = driver.find_elements(By.CSS_SELECTOR, "div.group.relative")
    print(f"Found {len(cards)} cards on Zepto:")
    for c in cards:
        lines = [l.strip() for l in c.text.split("\n") if l.strip()]
        print("  Zepto Card:", lines)

finally:
    driver.quit()

