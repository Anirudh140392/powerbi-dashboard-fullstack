import sys, os, time
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step3_selenium import (
    create_chrome_driver,
    ensure_authenticated,
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

    # Print all button / select texts in the filter bar
    buttons = driver.find_elements(By.CSS_SELECTOR, "header button, div[class*='filter'] button, div[class*='Filter'] button")
    print("Found filter buttons:")
    for b in buttons:
        txt = b.text.strip().replace("\n", " | ")
        if txt:
            print("  Button:", txt)

    # Let's execute JS to inspect FilterContext state
    js_state = driver.execute_script("""
        return {
            localStorage_user: localStorage.getItem('user'),
            sessionStorage_user: sessionStorage.getItem('user')
        };
    """)
    print("User state:", js_state)

finally:
    driver.quit()

