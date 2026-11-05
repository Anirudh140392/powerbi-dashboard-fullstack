import sys
sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")

from ds_tester.backend.step3_selenium import create_chrome_driver, ensure_authenticated
import json
import time

driver = create_chrome_driver(headless=True)
try:
    target_url = "http://localhost:9500/pricing-analysis"
    ensure_authenticated(driver, target_url, client="pidilite")
    driver.get(target_url)
    time.sleep(3)
    
    # Check all filter inputs, selects, dropdowns, buttons
    res = driver.execute_script("""
        const platformBtn = Array.from(document.querySelectorAll('button, div')).find(e => (e.innerText || '').includes('Platform') && e.querySelector('svg, path'));
        
        // Find all platform options or cards or dropdown items
        const texts = Array.from(document.querySelectorAll('*')).map(e => e.innerText ? e.innerText.trim() : '').filter(t => t.length > 0 && t.length < 50);
        
        return {
            hasPlatformBtn: !!platformBtn,
            platformBtnText: platformBtn ? platformBtn.innerText : null
        };
    """)
    print("RES:", res)
finally:
    driver.quit()

