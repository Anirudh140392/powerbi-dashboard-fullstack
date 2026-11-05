import sys
sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")

from ds_tester.backend.step3_selenium import create_chrome_driver, ensure_authenticated, apply_dashboard_period
import time
import json

driver = create_chrome_driver(headless=True)
try:
    target = "http://localhost:9500/watch-tower?client=boat"
    ensure_authenticated(driver, target, client="boat")
    driver.get(target)
    time.sleep(3)
    apply_dashboard_period(driver, {"startDate": "2026-10-01", "endDate": "2026-10-30"})
    time.sleep(3)

    res = driver.execute_script("""
        const catHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim().toLowerCase() === 'category performance');
        if (!catHeader) return { error: 'header not found' };
        const container = catHeader.closest('.grid') || catHeader.closest('div.border') || catHeader.parentElement?.parentElement;
        
        let fiberKey = Object.keys(container).find(k => k.startsWith('__reactFiber'));
        if (!fiberKey) {
            const child = container.querySelector('*');
            if (child) fiberKey = Object.keys(child).find(k => k.startsWith('__reactFiber'));
        }
        
        let cur = container[fiberKey];
        let rows = null;
        for (let i = 0; i < 40 && cur; i++) {
            if (cur.memoizedProps && Array.isArray(cur.memoizedProps.rows)) {
                rows = cur.memoizedProps.rows;
                break;
            }
            cur = cur.return;
        }
        
        if (!rows) return { error: 'rows not found' };
        
        const totOfftake = rows.reduce((acc, r) => acc + (parseFloat(r.offtakes) || 0), 0) / 10000000.0;
        const totSpend = rows.reduce((acc, r) => acc + (parseFloat(r.spend) || 0), 0) / 10000000.0;
        const totInorg = rows.reduce((acc, r) => acc + (parseFloat(r.inorgSalesPct) || 0), 0) / 10000000.0;
        const overallRoas = totSpend > 0 ? (totInorg / totSpend) : null;
        
        return {
            count: rows.length,
            totOfftake: totOfftake.toFixed(2),
            totSpend: totSpend.toFixed(2),
            totInorg: totInorg.toFixed(2),
            overallRoas: overallRoas ? overallRoas.toFixed(2) : null,
            firstRow: rows[0]
        };
    """)
    print("EXTRACTED FROM ROWS:", json.dumps(res, ensure_ascii=True, indent=2))
finally:
    driver.quit()

