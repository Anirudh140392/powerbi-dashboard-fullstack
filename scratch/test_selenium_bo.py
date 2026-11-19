import os
import sys
import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")
from ds_tester.backend.step3_selenium import (
    FRONTEND_URL,
    ensure_authenticated,
    wait_for_loading_complete,
    apply_dashboard_period,
)

opts = Options()
opts.add_argument("--headless")
opts.add_argument("--window-size=1920,1080")
driver = webdriver.Chrome(options=opts)

results = {}

try:
    url = f"{FRONTEND_URL}/watch-tower"
    ensure_authenticated(driver, url, client="boat")
    time.sleep(2)
    wait_for_loading_complete(driver, timeout=20)
    
    apply_dashboard_period(driver, {"start_date": "2026-10-01", "end_date": "2026-10-31"})
    time.sleep(3)
    wait_for_loading_complete(driver, timeout=25)
    time.sleep(2)

    # 1. Scrape Business Overview
    bo_res = driver.execute_script("""
        const topGrid = document.querySelector('.grid.grid-cols-1.sm\\\\:grid-cols-2.lg\\\\:grid-cols-5');
        if (!topGrid) return { error: 'topGrid not found' };
        const cards = Array.from(topGrid.children).map(c => c.innerText.replace(/\\n/g, ' '));
        return { cards };
    """)
    results["business_overview"] = bo_res

    # 2. Scrape Platform Overview
    plat_res = driver.execute_script("""
        const platHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim() === 'Platform Overview');
        if (!platHeader) return { error: 'platHeader not found' };
        
        // Find All row inside Platform Overview container
        const container = platHeader.closest('div.border') || platHeader.parentElement?.parentElement;
        const allCards = Array.from(container ? container.querySelectorAll('div, button') : []).map(el => el.innerText || '');
        const allRow = allCards.find(t => t.startsWith('All') && (t.includes('Cr') || t.includes('%')));
        
        return {
            allRowText: allRow ? allRow.slice(0, 300) : null
        };
    """)
    results["platform_overview"] = plat_res

    # 3. Scrape Category performance
    cat_res = driver.execute_script("""
        const catHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim().toLowerCase() === 'category performance');
        if (!catHeader) return { error: 'catHeader not found' };
        const container = catHeader.closest('div.border') || catHeader.parentElement?.parentElement;
        const buttons = Array.from(container ? container.querySelectorAll('button') : []).map(b => b.innerText.replace(/\\n/g, ' ')).filter(t => t.includes('Offtakes'));
        return { buttonCount: buttons.length, sampleButtons: buttons.slice(0, 5) };
    """)
    results["category_performance"] = cat_res

    # 4. Scrape Performance Breakdown
    pb_res = driver.execute_script("""
        // Find table in the entire document or near Performance Breakdown
        const tables = Array.from(document.querySelectorAll('table'));
        const tableData = [];
        for (const t of tables) {
            const rows = Array.from(t.querySelectorAll('tr')).map(r => Array.from(r.querySelectorAll('td, th')).map(c => c.innerText.replace(/\\n/g, ' ')));
            tableData.push({ rowCount: rows.length, rows: rows.slice(0, 5) });
        }
        return { tablesCount: tables.length, tableData };
    """)
    results["performance_breakdown"] = pb_res

    with open(r"scratch\selenium_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print("SUCCESS: wrote scratch/selenium_results.json")

finally:
    driver.quit()
