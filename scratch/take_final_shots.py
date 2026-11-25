import sys
sys.path.append('.')
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from ds_tester.backend.step3_selenium import ensure_authenticated

opts = Options()
opts.add_argument('--headless=new')
opts.add_argument('--window-size=1920,1400')
driver = webdriver.Chrome(options=opts)

try:
    ensure_authenticated(driver, 'http://localhost:9500/ds-tester?client=boat', client='boat')
    time.sleep(3)

    for b in driver.find_elements(By.TAG_NAME, 'button'):
        t = b.text.strip().encode('ascii', 'ignore').decode()
        if 'Assigned Anomalies' in t:
            driver.execute_script('arguments[0].click();', b)
            break
    time.sleep(2)

    # Scroll down so table is fully in view
    driver.execute_script("window.scrollTo(0, 350);")
    time.sleep(1)

    shot_path = 'C:/Users/ssk09/.gemini/antigravity/brain/55495f97-5f36-4d70-84af-3367d3cf8591/verified_assigned_registry_perfect.png'
    driver.save_screenshot(shot_path)
    print('Screenshot saved at:', shot_path)

    # Also test clicking the Forward via Outlook Web button to verify the modal opens
    for b in driver.find_elements(By.TAG_NAME, 'button'):
        t = b.text.strip().encode('ascii', 'ignore').decode()
        if 'Forward via Outlook Web' in t:
            print('Clicking Forward via Outlook Web button in registry...')
            driver.execute_script('arguments[0].click();', b)
            break

    time.sleep(2)
    modal_shot = 'C:/Users/ssk09/.gemini/antigravity/brain/55495f97-5f36-4d70-84af-3367d3cf8591/verified_modal_from_registry.png'
    driver.save_screenshot(modal_shot)
    print('Modal screenshot saved at:', modal_shot)

finally:
    driver.quit()
