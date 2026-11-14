import sys, os, time
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step3_selenium import (
    create_chrome_driver,
    ensure_authenticated,
    FRONTEND_URL
)
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

driver = create_chrome_driver(headless=True)
try:
    target_url = f"{FRONTEND_URL}/market-share"
    ensure_authenticated(driver, target_url, client="mars")
    time.sleep(3)

    # Click the date button
    wait = WebDriverWait(driver, 10)
    date_btn = wait.until(
        EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(., '-') and (.//p or .//span or contains(@class, 'flex'))]")
        )
    )
    print("Found date button with text:", repr(date_btn.text))
    date_btn.click()
    time.sleep(1)

    # Inspect inputs inside popover
    inputs = driver.find_elements(By.CSS_SELECTOR, ".MuiPopover-root input, input[type='date']")
    print(f"Found {len(inputs)} date inputs:")
    for inp in inputs:
        print("  input type:", inp.get_attribute("type"), "value:", inp.get_attribute("value"))

finally:
    driver.quit()

