import sys
sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")

from ds_tester.backend.step3_selenium import create_chrome_driver, ensure_authenticated, apply_dashboard_period
import time

driver = create_chrome_driver(headless=True)
try:
    target = "http://localhost:9500/watch-tower?client=boat"
    ensure_authenticated(driver, target, client="boat")
    driver.get(target)
    time.sleep(4)
    apply_dashboard_period(driver, {"startDate": "2026-10-01", "endDate": "2026-10-30"})
    time.sleep(3)

    res = driver.execute_script("""
        const catHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim().toLowerCase() === 'category performance');
        if (!catHeader) return { error: 'header not found' };
        const container = catHeader.closest('.grid') || catHeader.closest('div.border') || catHeader.parentElement?.parentElement;
        
        // Find all progress bar tooltips or spend row
        let spendRow = null;
        for (const div of container.querySelectorAll('div')) {
            if (div.innerText && div.innerText.includes('Spend') && div.querySelector('button')) {
                spendRow = div.innerText;
                break;
            }
        }
        
        const allText = container.innerText;
        
        // Check progress bar tooltips
        const tooltips = Array.from(container.querySelectorAll('[title]')).map(el => el.getAttribute('title'));
        
        return {
            spendRow,
            tooltips: tooltips.filter(t => t && t.toLowerCase().includes('spend')),
            allTextSnippet: allText.substring(0, 500)
        };
    """)
    import json
    print("JS RESULT:", json.dumps(res, ensure_ascii=True, indent=2))
finally:
    driver.quit()
