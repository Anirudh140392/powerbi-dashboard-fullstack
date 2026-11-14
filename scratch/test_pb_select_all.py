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

try:
    url = f"{FRONTEND_URL}/watch-tower"
    ensure_authenticated(driver, url, client="boat")
    time.sleep(2)
    wait_for_loading_complete(driver, timeout=20)
    
    apply_dashboard_period(driver, {"start_date": "2026-10-01", "end_date": "2026-10-31"})
    time.sleep(3)
    wait_for_loading_complete(driver, timeout=25)

    # In Performance Breakdown, open platform dropdown and click "Select All"
    pb_action = driver.execute_script("""
        const pbHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim().toLowerCase().includes('performance breakdown'));
        if (!pbHeader) return { error: 'pbHeader not found' };
        const container = pbHeader.closest('.rounded-3xl') || pbHeader.closest('div.border') || pbHeader.parentElement?.parentElement;
        if (!container) return { error: 'container not found' };

        // Scroll to Performance Breakdown
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Find the platform dropdown button inside container
        const buttons = Array.from(container.querySelectorAll('button'));
        const platBtn = buttons.find(b => b.innerText && (b.innerText.includes('Amazon') || b.innerText.includes('Platforms') || b.innerText.includes('Select')));
        if (platBtn) {
            platBtn.click();
            return { clickedPlatBtn: platBtn.innerText };
        }
        return { error: 'platBtn not found', buttons: buttons.map(b => b.innerText) };
    """)
    print("PB Action 1:", pb_action)
    time.sleep(1)

    # Click "Select All" in the opened dropdown
    pb_action2 = driver.execute_script("""
        const allBtns = Array.from(document.querySelectorAll('button, div, span'));
        const selectAllBtn = allBtns.find(b => b.innerText && b.innerText.trim().toLowerCase().startsWith('select all'));
        if (selectAllBtn) {
            selectAllBtn.click();
            return { clickedSelectAll: true };
        }
        return { error: 'selectAllBtn not found' };
    """)
    print("PB Action 2:", pb_action2)
    time.sleep(3)
    wait_for_loading_complete(driver, timeout=20)

    # Check the table rows now!
    table_data = driver.execute_script("""
        const tables = Array.from(document.querySelectorAll('table'));
        const res = [];
        for (const t of tables) {
            const rows = Array.from(t.querySelectorAll('tr')).map(r => Array.from(r.querySelectorAll('td, th')).map(c => c.innerText.replace(/\\n/g, ' ')));
            res.push({ rowCount: rows.length, rows: rows.slice(0, 5) });
        }
        return res;
    """)
    print("Table Data:")
    for t in table_data:
        print(t)

finally:
    driver.quit()

