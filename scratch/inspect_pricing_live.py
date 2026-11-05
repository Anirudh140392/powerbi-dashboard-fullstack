import sys, os, time
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step3_selenium import (
    create_chrome_driver,
    ensure_authenticated,
    apply_dashboard_period,
    FRONTEND_URL
)
from selenium.webdriver.common.by import By

driver = create_chrome_driver(headless=True)
try:
    print("=== Inspecting Pricing Analysis Cards on UI ===")
    target_url = f"{FRONTEND_URL}/pricing-analysis"
    ensure_authenticated(driver, target_url, client="mars")
    time.sleep(3)

    # Let's inspect headers and cards
    headers = driver.find_elements(By.XPATH, "//h3[contains(., 'Discount') or contains(., 'selling price') or contains(., 'Price') or contains(., 'ASP')]")
    print(f"Found {len(headers)} pricing headers:")
    for h in headers:
        title = h.text.strip()
        card_elem = h.find_element(By.XPATH, "./ancestor::div[contains(@class, 'rounded')][1]")
        lines = [l.strip() for l in card_elem.text.split("\n") if l.strip()]
        val_elem = card_elem.find_elements(By.XPATH, ".//div[contains(@class, 'text-3xl')]//span | .//div[contains(@class, 'font-bold') and contains(@class, 'text-')]//span")
        val_text = [v.text.strip() for v in val_elem if v.text.strip()]
        print(f"Header: '{title}' | val_elements: {val_text} | card lines: {lines}")

finally:
    driver.quit()

