import os
import sys
import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")
from ds_tester.backend.step3_selenium import FRONTEND_URL, ensure_authenticated, wait_for_loading_complete

opts = Options()
opts.add_argument("--headless")
opts.add_argument("--window-size=1920,1080")
driver = webdriver.Chrome(options=opts)

try:
    url = f"{FRONTEND_URL}/watch-tower"
    ensure_authenticated(driver, url, client="boat")
    time.sleep(3)
    wait_for_loading_complete(driver, timeout=20)
    time.sleep(3)

    plat_js = """
    // Find the header with ENTITY and OFFTAKES
    const allDivs = Array.from(document.querySelectorAll('div'));
    const headerDiv = allDivs.find(d => (d.innerText || '').includes('ENTITY') && (d.innerText || '').includes('OFFTAKES'));
    if (!headerDiv) return { error: 'header not found' };
    
    // The container of rows is headerDiv.parentElement or adjacent
    const rows = [];
    let p = headerDiv.parentElement;
    for (const child of p.children) {
        rows.push(child.innerText.replace(/\\n/g, ' | '));
    }
    return { containerText: p.className, rowCount: rows.length, rows: rows.slice(0, 10) };
    """
    res = driver.execute_script(plat_js)
    with open(r"scratch\platform_rows.json", "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2, ensure_ascii=False)
    print("SUCCESS: platform_rows.json")

finally:
    driver.quit()

