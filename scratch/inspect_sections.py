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

output = {}

try:
    url = f"{FRONTEND_URL}/watch-tower"
    ensure_authenticated(driver, url, client="boat")
    time.sleep(3)
    wait_for_loading_complete(driver, timeout=20)
    time.sleep(3)

    # 1. Platform Overview details
    dump_plat = """
    const platHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim() === 'Platform Overview');
    let res = [];
    if (platHeader) {
        const container = platHeader.closest('.rounded-3xl') || platHeader.closest('div.border') || platHeader.parentElement?.parentElement;
        if (container) {
            // Find all row divs or buttons
            const items = Array.from(container.querySelectorAll('.flex.items-center.gap-2, .flex.items-center.gap-3, div[class*="group"]'));
            res = items.map(it => it.innerText.replace(/\\n/g, ' | ')).filter(t => t.length > 5);
        }
    }
    return res;
    """
    output["platformItems"] = driver.execute_script(dump_plat)

    # 2. Performance Breakdown details
    dump_pb = """
    const pbHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim().toLowerCase().includes('performance breakdown'));
    let res = [];
    if (pbHeader) {
        const container = pbHeader.closest('.rounded-3xl') || pbHeader.closest('div.border') || pbHeader.parentElement?.parentElement;
        if (container) {
            const table = container.querySelector('table');
            if (table) {
                res.push({
                    headers: Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.replace(/\\n/g, ' ')),
                    rows: Array.from(table.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td, th')).map(td => td.innerText.replace(/\\n/g, ' ')))
                });
            } else {
                res.push({ msg: 'Table not found inside container', containerText: container.innerText.slice(0, 300) });
            }
        }
    }
    return res;
    """
    output["performanceBreakdown"] = driver.execute_script(dump_pb)

    with open(r"scratch\watchtower_sections_dump.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print("SUCCESS: Wrote scratch/watchtower_sections_dump.json")

finally:
    driver.quit()

