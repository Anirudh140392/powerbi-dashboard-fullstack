import sys
sys.path.append('.')
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from ds_tester.backend.step3_selenium import ensure_authenticated

opts = Options()
opts.add_argument('--headless=new')
opts.add_argument('--window-size=1650,1300')
driver = webdriver.Chrome(options=opts)

try:
    print('Calling ensure_authenticated...')
    ensure_authenticated(driver, "http://localhost:9500/ds-tester?client=boat", client="boat")
    time.sleep(4)

    # Click the Assigned Anomalies Registry tab
    buttons = driver.find_elements(By.TAG_NAME, 'button')
    for b in buttons:
        t = b.text.strip().encode('ascii', 'ignore').decode()
        if 'Assigned Anomalies' in t:
            print('Clicking:', t)
            driver.execute_script("arguments[0].click();", b)
            break

    time.sleep(3)

    shot_path = 'C:/Users/ssk09/.gemini/antigravity/brain/55495f97-5f36-4d70-84af-3367d3cf8591/verified_assigned_registry_final.png'
    driver.save_screenshot(shot_path)
    print('Screenshot saved successfully:', shot_path)

    body_text = driver.find_element(By.TAG_NAME, 'body').text
    for target in [
        'Commercial Anomaly Assignment Registry',
        'abhishek.j@trailytics.com',
        'shushant@trailytics.com',
        '23 Nov 2026',
        'Transfer Issue Affected Lines',
        'Stock Transfer Issue Sales Loss',
        '53 Assigned Issues'
    ]:
        print(f"Check '{target}':", target in body_text)

finally:
    driver.quit()
