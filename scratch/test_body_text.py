import sys, os, time
sys.path.insert(0, os.path.abspath("."))
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from ds_tester.backend.step3_selenium import FRONTEND_URL, ensure_authenticated, wait_for_loading_complete

chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--window-size=1920,1080")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--no-sandbox")

driver = webdriver.Chrome(options=chrome_options)
try:
    url = f"{FRONTEND_URL}/watch-tower"
    ensure_authenticated(driver, url, client="boat")
    time.sleep(3)
    wait_for_loading_complete(driver, timeout=25)
    time.sleep(3)

    body_text = driver.execute_script("return document.body.innerText;")
    print("Body text snippet (first 1500 chars):")
    print(body_text[:1500].encode('ascii', 'replace').decode())
finally:
    driver.quit()
