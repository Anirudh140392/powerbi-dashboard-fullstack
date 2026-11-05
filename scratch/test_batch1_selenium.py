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
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

driver = create_chrome_driver(headless=True)
try:
    print("=== Testing Watch Tower ===")
    target_url = f"{FRONTEND_URL}/watch-tower"
    ensure_authenticated(driver, target_url, client="mars")
    wait_for_loading_complete(driver, timeout=25)
    
    # Apply period
    period = {"startDate": "2026-03-01", "endDate": "2026-03-31"}
    apply_dashboard_period(driver, period)
    wait_for_loading_complete(driver, timeout=20)
    
    print("Waiting for Watch Tower cards to finish loading...")
    # Wait until card values are populated (not '-' or 'Loading...')
    wait = WebDriverWait(driver, 25)
    wait.until(lambda d: any(
        el.text.strip() and el.text.strip() not in ('-', 'Loading...', '')
        for el in d.find_elements(By.CSS_SELECTOR, "div.text-3xl span, div[class*='text-3xl'] span")
    ))
    
    cards = driver.find_elements(By.CSS_SELECTOR, "div.group.relative")
    print(f"Found {len(cards)} Watch Tower cards:")
    for c in cards:
        t = c.find_element(By.TAG_NAME, "h3").text.strip() if len(c.find_elements(By.TAG_NAME, "h3")) > 0 else ""
        v = c.find_element(By.CSS_SELECTOR, "div.text-3xl span").text.strip() if len(c.find_elements(By.CSS_SELECTOR, "div.text-3xl span")) > 0 else ""
        print(f"  WT Card -> '{t}': '{v}'")

    print("\n=== Testing Market Share ===")
    target_url_ms = f"{FRONTEND_URL}/market-share"
    ensure_authenticated(driver, target_url_ms, client="mars")
    wait_for_loading_complete(driver, timeout=25)
    apply_dashboard_period(driver, period)
    wait_for_loading_complete(driver, timeout=20)
    
    wait.until(lambda d: any(
        el.text.strip() and el.text.strip() not in ('-', 'Loading...', '')
        for el in d.find_elements(By.CSS_SELECTOR, "div.text-3xl span, div[class*='text-3xl'] span")
    ))
    
    cards_ms = driver.find_elements(By.CSS_SELECTOR, "div.group.relative")
    print(f"Found {len(cards_ms)} Market Share cards:")
    for c in cards_ms:
        t = c.find_element(By.TAG_NAME, "h3").text.strip() if len(c.find_elements(By.TAG_NAME, "h3")) > 0 else ""
        v = c.find_element(By.CSS_SELECTOR, "div.text-3xl span").text.strip() if len(c.find_elements(By.CSS_SELECTOR, "div.text-3xl span")) > 0 else ""
        print(f"  MS Card -> '{t}': '{v}'")

finally:
    driver.quit()

