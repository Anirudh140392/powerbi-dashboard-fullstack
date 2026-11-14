import sys, os, time
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step3_selenium import (
    create_chrome_driver,
    ensure_authenticated,
    FRONTEND_URL
)
from selenium.webdriver.common.by import By

driver = create_chrome_driver(headless=True)
try:
    target_url = f"{FRONTEND_URL}/watch-tower"
    ensure_authenticated(driver, target_url, client="mars")
    time.sleep(5)
    
    print("Page title:", driver.title)
    print("Page URL:", driver.current_url)
    
    # Save screenshot
    driver.save_screenshot("scratch/watchtower_screen.png")
    print("Saved screenshot to scratch/watchtower_screen.png")
    
    # Check body text
    body = driver.find_element(By.TAG_NAME, "body").text
    lines = [l.strip() for l in body.split("\n") if l.strip()]
    print("First 30 lines of body text:")
    for l in lines[:30]:
        print(" ", l)

finally:
    driver.quit()

