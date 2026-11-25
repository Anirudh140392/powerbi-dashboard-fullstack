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
    print('Calling ensure_authenticated for boat...')
    ensure_authenticated(driver, "http://localhost:9500/ds-tester", client="boat")
    time.sleep(3)

    # Find the Assigned Anomalies tab button
    buttons = driver.find_elements(By.TAG_NAME, 'button')
    assigned_btn = None
    for b in buttons:
        txt = b.text.strip()
        if 'Assigned' in txt:
            print('Found Assigned button:', txt.encode('ascii', 'ignore').decode())
            if 'Assigned Anomalies' in txt:
                assigned_btn = b
                break

    if assigned_btn:
        print('Clicking Assigned Anomalies tab...')
        driver.execute_script("arguments[0].click();", assigned_btn)
        time.sleep(3)
    else:
        print('WARNING: Could not find Assigned Anomalies button')

    # Take screenshot of the Assigned Anomalies Registry Table
    shot_path = 'C:/Users/ssk09/.gemini/antigravity/brain/55495f97-5f36-4d70-84af-3367d3cf8591/verified_assigned_registry_table.png'
    driver.save_screenshot(shot_path)
    print('Saved registry screenshot at:', shot_path)

    body_text = driver.find_element(By.TAG_NAME, 'body').text
    print('Has Commercial Anomaly Assignment Registry:', 'Commercial Anomaly Assignment Registry' in body_text)
    print('Has abhishek.j@trailytics.com:', 'abhishek.j@trailytics.com' in body_text)
    print('Has shushant@trailytics.com:', 'shushant@trailytics.com' in body_text)
    print('Has 23 Nov 2026:', '23 Nov 2026' in body_text)
    print('Has Transfer Issue Affected Lines:', 'Transfer Issue Affected Lines' in body_text)

    # Scroll down to see full table rows
    driver.execute_script("window.scrollBy(0, 450);")
    time.sleep(1)
    shot_path_scroll = 'C:/Users/ssk09/.gemini/antigravity/brain/55495f97-5f36-4d70-84af-3367d3cf8591/verified_assigned_registry_scrolled.png'
    driver.save_screenshot(shot_path_scroll)
    print('Saved scrolled screenshot at:', shot_path_scroll)

finally:
    driver.quit()
