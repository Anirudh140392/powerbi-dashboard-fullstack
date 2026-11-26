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
    target_url = f"{FRONTEND_URL}/pricing-analysis"
    ensure_authenticated(driver, target_url, client="boat")
    wait_for_loading_complete(driver, timeout=25)
    time.sleep(2)

    # Let's test what date range DS Tester passes by default (last 14 days)
    period = {"startDate": "2026-10-21", "endDate": "2026-11-04"}
    print("Setting period:", period)
    apply_dashboard_period(driver, period)
    time.sleep(3)

    # Check date button text
    date_btn = driver.find_element(By.XPATH, "//button[contains(., '-') and (.//p or .//span or contains(@class, 'flex'))]")
    print("Date button text AFTER apply:", repr(date_btn.text))

    # Read pricing cards
    from ds_tester.backend.step3_selenium import read_pricing_overview
    cards = read_pricing_overview(driver, headless=True)
    print("Pricing cards scraped:", cards)

finally:
    driver.quit()

