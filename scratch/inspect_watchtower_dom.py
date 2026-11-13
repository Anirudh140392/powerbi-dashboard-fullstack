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

output_data = {}

try:
    url = f"{FRONTEND_URL}/watch-tower"
    ensure_authenticated(driver, url, client="boat")
    time.sleep(3)
    wait_for_loading_complete(driver, timeout=20)
    time.sleep(2)

    # 1. SnapshotOverview cards (Top KPIs)
    kpis_js = """
    const topGrid = document.querySelector('.grid.grid-cols-1.sm\\\\:grid-cols-2.lg\\\\:grid-cols-5');
    const res = [];
    if (topGrid) {
        for (const child of topGrid.children) {
            res.push(child.innerText);
        }
    }
    return res;
    """
    output_data["topGridChildren"] = driver.execute_script(kpis_js)

    # 2. Platform Overview
    plat_js = """
    const platHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim() === 'Platform Overview');
    let platData = { found: false, rows: [] };
    if (platHeader) {
        platData.found = true;
        const container = platHeader.closest('.rounded-3xl') || platHeader.closest('div.border') || platHeader.parentElement?.parentElement;
        if (container) {
            const divs = Array.from(container.querySelectorAll('.flex.items-center')).map(d => d.innerText.replace(/\\n/g, ' | '));
            platData.rows = divs.slice(0, 15);
        }
    }
    return platData;
    """
    output_data["platformOverview"] = driver.execute_script(plat_js)

    # 3. Category Performance
    cat_js = """
    const catHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim().toLowerCase() === 'category performance');
    let catData = { found: false, buttons: [] };
    if (catHeader) {
        catData.found = true;
        const container = catHeader.closest('.rounded-3xl') || catHeader.closest('div.border') || catHeader.parentElement?.parentElement;
        if (container) {
            catData.buttons = Array.from(container.querySelectorAll('button')).map(b => b.innerText.replace(/\\n/g, ' | ')).slice(0, 10);
        }
    }
    return catData;
    """
    output_data["categoryPerformance"] = driver.execute_script(cat_js)

    # 4. Performance Breakdown
    pb_js = """
    const pbHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim().toLowerCase().includes('performance breakdown'));
    let pbData = { found: false, rows: [] };
    if (pbHeader) {
        pbData.found = true;
        const container = pbHeader.closest('.rounded-3xl') || pbHeader.closest('div.border') || pbHeader.parentElement?.parentElement;
        if (container) {
            const trs = Array.from(container.querySelectorAll('tr')).map(tr => Array.from(tr.querySelectorAll('th, td')).map(td => td.innerText.replace(/\\n/g, ' ')));
            pbData.rows = trs.slice(0, 8);
        }
    }
    return pbData;
    """
    output_data["performanceBreakdown"] = driver.execute_script(pb_js)

    with open(r"scratch\watchtower_dom_dump.json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    print("SUCCESS: Wrote scratch/watchtower_dom_dump.json")

finally:
    driver.quit()
