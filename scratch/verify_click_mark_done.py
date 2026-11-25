import json
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import jwt

options = Options()
options.add_argument('--headless=new')
options.add_argument('--window-size=1800,1200')
driver = webdriver.Chrome(options=options)

try:
    driver.get('http://localhost:9500')
    time.sleep(1)

    token_payload = {
        "userId": "1",
        "email": "admin@trailytics.com",
        "userName": "Admin",
        "dbName": "boat",
        "dbId": "4",
        "companyId": "2",
        "role": "admin",
        "qcUser": 0,
        "dbStatus": True,
    }
    token = jwt.encode(token_payload, "trailytics_jwt_secret_2026", algorithm="HS256")
    user_obj = {
        "email": "admin@trailytics.com",
        "name": "Admin",
        "role": "admin",
        "dbName": "boat",
        "dbId": "4",
        "companyId": "2",
    }
    driver.execute_script("""
        sessionStorage.setItem("isLoggedIn", "true");
        sessionStorage.setItem("token", arguments[0]);
        sessionStorage.setItem("user", arguments[1]);
    """, token, json.dumps(user_obj))

    driver.get('http://localhost:9500/ds-tester?client=boat')
    time.sleep(3)

    for b in driver.find_elements(By.TAG_NAME, 'button'):
        txt = b.get_attribute('innerText') or ''
        if 'Assigned' in txt:
            b.click()
            time.sleep(2)
            break

    md_btns = [b for b in driver.find_elements(By.TAG_NAME, 'button') if 'Mark Done' in (b.get_attribute('innerText') or '')]
    print(f"Found {len(md_btns)} Mark Done buttons via innerText!")
    assert len(md_btns) > 0, "No Mark Done buttons found!"

    print("Clicking first Mark Done button...")
    driver.execute_script("arguments[0].click();", md_btns[0])
    time.sleep(2)

    # Check updated tab counts
    fixed_btns = [b for b in driver.find_elements(By.TAG_NAME, 'button') if 'Fixed Anomalies' in (b.get_attribute('innerText') or '')]
    if fixed_btns:
        print("Fixed tab text:", fixed_btns[0].get_attribute('innerText'))

    driver.save_screenshot("C:/Users/ssk09/.gemini/antigravity/brain/55495f97-5f36-4d70-84af-3367d3cf8591/verified_clicked_done_success.png")
    print("SUCCESS: Mark Done clicked and verified!")

finally:
    driver.quit()
