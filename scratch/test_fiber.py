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
        
        // Find React fiber key on container or child
        let fiberKey = Object.keys(container).find(k => k.startsWith('__reactFiber'));
        if (!fiberKey) {
            const child = container.querySelector('*');
            if (child) fiberKey = Object.keys(child).find(k => k.startsWith('__reactFiber'));
        }
        
        // Traverse fiber to find categoryOverview or rows or categoryTotals
        let cur = container[fiberKey];
        let foundData = null;
        for (let i = 0; i < 40 && cur; i++) {
            if (cur.memoizedProps && (cur.memoizedProps.categoryOverview || cur.memoizedProps.rows || cur.memoizedProps.categoryTotals)) {
                foundData = {
                    hasOverview: !!cur.memoizedProps.categoryOverview,
                    hasRows: !!cur.memoizedProps.rows,
                    hasTotals: !!cur.memoizedProps.categoryTotals,
                    totals: cur.memoizedProps.categoryTotals
                };
                break;
            }
            if (cur.memoizedState) {
                // check memoizedState chain
                let s = cur.memoizedState;
                while (s) {
                    if (s.memoizedState && typeof s.memoizedState === 'object') {
                        if (s.memoizedState.categoryOverview || s.memoizedState.spend !== undefined) {
                            foundData = { stateKeys: Object.keys(s.memoizedState), val: s.memoizedState };
                            break;
                        }
                    }
                    s = s.next;
                }
            }
            if (foundData) break;
            cur = cur.return;
        }
        
        return { fiberKey: !!fiberKey, foundData };
    """)
    print("FIBER RES:", json.dumps(res, ensure_ascii=True, indent=2))
finally:
    driver.quit()

