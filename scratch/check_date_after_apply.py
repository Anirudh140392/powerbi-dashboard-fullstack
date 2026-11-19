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
    target_url = f"{FRONTEND_URL}/market-share"
    ensure_authenticated(driver, target_url, client="mars")
    wait_for_loading_complete(driver, timeout=25)
    time.sleep(2)

    # Check date button before
    btn = driver.find_element(By.XPATH, "//button[contains(., '-') and (.//p or .//span or contains(@class, 'flex'))]")
    print("Date button BEFORE apply:", repr(btn.text))

    period = {"startDate": "2026-03-01", "endDate": "2026-03-31"}
    apply_dashboard_period(driver, period)
    wait_for_loading_complete(driver, timeout=20)
    time.sleep(2)

    # Check date button after
    btn = driver.find_element(By.XPATH, "//button[contains(., '-') and (.//p or .//span or contains(@class, 'flex'))]")
    print("Date button AFTER apply:", repr(btn.text))

finally:
    driver.quit()

