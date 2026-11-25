import sys
sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")

from ds_tester.backend.modules.pricing import step3_ui
from ds_tester.backend.step3_selenium import create_chrome_driver, ensure_authenticated, apply_dashboard_period, apply_segment_platform
import json
import time

driver = create_chrome_driver(headless=True)
try:
    target_url = "http://localhost:9500/pricing-analysis"
    ensure_authenticated(driver, target_url, client="pidilite")
    driver.get(target_url)
    time.sleep(3)
    
    # Check initial state
    init_state = driver.execute_script("""
        return {
            dateBtn: Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('-'))?.innerText,
            allButtons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean).slice(0, 20)
        };
    """)
    print("INIT STATE:", json.dumps(init_state, ensure_ascii=True, indent=2))
    
    # Apply platform amazon
    applied, err = apply_segment_platform(driver, "amazon")
    print(f"apply_segment_platform('amazon'): applied={applied}, err={err}")
    time.sleep(2)
    
    # Apply period 2026-10-01 to 2026-10-30
    apply_dashboard_period(driver, {"startDate": "2026-10-01", "endDate": "2026-10-30"})
    time.sleep(3)
    
    after_state = driver.execute_script("""
        const cards = Array.from(document.querySelectorAll('div, span, p')).filter(el => {
            const t = (el.innerText || '').trim();
            return t === 'Discount' || t === 'Weighted Discount' || t === 'Average selling price';
        }).map(el => {
            const parent = el.closest('.MuiCard-root') || el.closest('div.border') || el.parentElement?.parentElement;
            return {
                title: el.innerText.trim(),
                boxText: parent ? parent.innerText : 'null'
            };
        });
        
        return {
            dateBtn: Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('-'))?.innerText,
            cards: cards
        };
    """)
    print("AFTER STATE:", json.dumps(after_state, ensure_ascii=True, indent=2))
    
finally:
    driver.quit()

