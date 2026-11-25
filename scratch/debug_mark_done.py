import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import jwt

options = Options()
options.add_argument('--headless=new')
driver = webdriver.Chrome(options=options)

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

print("Title:", driver.title)
for b in driver.find_elements(By.TAG_NAME, 'button'):
    t = b.text.encode('ascii', 'ignore').decode().strip()
    if 'Assigned' in t:
        print('Found Assigned button:', t)
        b.click()
        time.sleep(2)
        break

# Now look for Mark Done button
found_md = False
for b in driver.find_elements(By.TAG_NAME, 'button'):
    t = b.text.encode('ascii', 'ignore').decode().strip()
    if 'Mark Done' in t:
        print('Found Mark Done button:', t)
        found_md = True
        b.click()
        time.sleep(2)
        print("Successfully clicked Mark Done!")
        break

print("Found Mark Done?:", found_md)
driver.quit()
