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
    print('Navigating with ensure_authenticated...')
    ensure_authenticated(driver, "http://localhost:9500/ds-tester?client=boat", client="boat")
    time.sleep(3)
    driver.get("http://localhost:9500/ds-tester?client=boat")
    time.sleep(4)

    print('Current URL:', driver.current_url)
    print('Title:', driver.title)

    # Find buttons
    buttons = driver.find_elements(By.TAG_NAME, 'button')
    print('Total buttons:', len(buttons))
    assigned_btn = None
    for b in buttons:
        t = b.text.strip().encode('ascii', 'ignore').decode()
        if 'Assigned' in t:
            print('Button with Assigned:', t)
            assigned_btn = b
            break

    if assigned_btn:
        print('Clicking assigned_btn...')
        driver.execute_script("arguments[0].click();", assigned_btn)
        time.sleep(3)

    shot_path = 'C:/Users/ssk09/.gemini/antigravity/brain/55495f97-5f36-4d70-84af-3367d3cf8591/verified_assigned_registry_live.png'
    driver.save_screenshot(shot_path)
    print('Saved verified_assigned_registry_live.png successfully!')

    # Print relevant text lines
    body_text = driver.find_element(By.TAG_NAME, 'body').text
    lines = [l.strip().encode('ascii', 'ignore').decode() for l in body_text.split('\n') if any(w in l.lower() for w in ['assigned', 'registry', 'abhishek', 'shushant', '23 nov', 'transfer issue', 'drift'])]
    print('Matched lines in DOM:')
    for l in lines[:25]:
        print('  >', l)

finally:
    driver.quit()
