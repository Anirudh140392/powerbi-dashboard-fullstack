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
        
        let totalSpend = null;
        const spendTooltipEl = Array.from(container.querySelectorAll('[title]')).find(el => (el.getAttribute('title') || '').toLowerCase().includes('spend:'));
        let debug = {};
        if (spendTooltipEl) {
            const title = spendTooltipEl.getAttribute('title');
            const pctMatch = title.match(/Spend:\\s*([\\d.]+)%\\s*of\\s*all\\s*categories/i);
            
            const spendLabel = Array.from(container.querySelectorAll('span, div')).find(el => el.innerText && el.innerText.trim().toLowerCase() === 'spend');
            const spendValEl = spendLabel ? spendLabel.parentElement?.querySelector('button, .font-medium') : null;
            
            debug = {
                title,
                pctMatch: pctMatch ? pctMatch[1] : null,
                spendValText: spendValEl ? spendValEl.innerText : null
            };
            
            if (pctMatch && spendValEl) {
                const pct = parseFloat(pctMatch[1]);
                const spendTxt = (spendValEl.innerText || '').trim();
                const mSpend = spendTxt.match(/₹?([\\d.]+)\\s*(Cr|Lac|K)?/i);
                if (mSpend && pct > 0) {
                    let v = parseFloat(mSpend[1]);
                    let u = (mSpend[2] || '').toLowerCase();
                    let vCr = v;
                    if (u === 'lac') vCr = v / 100.0;
                    else if (u === 'k') vCr = v / 10000.0;
                    totalSpend = (vCr / (pct / 100.0)).toFixed(2);
                }
            }
        }
        return { totalSpend, debug };
    """)
    import json
    print("EXTRACTED SPEND:", json.dumps(res, ensure_ascii=True, indent=2))
finally:
    driver.quit()

