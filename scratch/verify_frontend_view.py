import time
import os
import json
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import jwt

def verify_table():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1600,1200")
    driver = webdriver.Chrome(options=options)
    
    try:
        url = "http://localhost:9500/ds-tester?client=boat"
        driver.get("http://localhost:9500")
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

        driver.get(url)
        time.sleep(3)

        buttons = driver.find_elements(By.TAG_NAME, "button")
        for b in buttons:
            if "Assigned Anomalies Registry" in b.text:
                b.click()
                time.sleep(2)
                driver.execute_script("window.scrollBy(0, 350);")
                time.sleep(1)
                driver.save_screenshot("C:/Users/ssk09/.gemini/antigravity/brain/55495f97-5f36-4d70-84af-3367d3cf8591/verified_assigned_rows_fixed.png")
                print("Captured verified_assigned_rows_fixed.png")
                break

    finally:
        driver.quit()

if __name__ == "__main__":
    verify_table()
