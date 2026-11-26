import sys, os
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step3_selenium import create_chrome_driver, ensure_authenticated, FRONTEND_URL
import time

driver = create_chrome_driver(headless=False)
try:
    target_url = f"{FRONTEND_URL}/pds-score"
    ensure_authenticated(driver, target_url, client="mars")
    time.sleep(2.0)

    # 1. Switch platform to Blinkit
    driver.execute_script("""
        const selects = Array.from(document.querySelectorAll(".MuiSelect-select"));
        selects[0].click();
    """)
    time.sleep(0.5)

    # Click Blinkit
    driver.execute_script("""
        const options = Array.from(document.querySelectorAll("li.MuiMenuItem-root, li[role='option']"));
        const blinkitOpt = options.find(o => (o.innerText || '').toLowerCase().includes('blinkit'));
        if (blinkitOpt) blinkitOpt.click();
    """)
    time.sleep(2.0)

    # Check selects and table rows after switching to Blinkit
    selects_after = driver.execute_script("""
        return Array.from(document.querySelectorAll(".MuiSelect-select")).map(s => s.innerText);
    """)
    print("Selects after switching:", selects_after)

    # Check table row 1
    rows = driver.execute_script("""
        return Array.from(document.querySelectorAll("tr")).map(r => r.innerText);
    """)
    print("\nFirst 4 rows on Blinkit:")
    for r in rows[:4]:
        print(" ->", repr(r))

    # Check achievement
    header_info = driver.execute_script("""
        const achEl = Array.from(document.querySelectorAll("div, p, span")).find(el => (el.innerText || '').includes('Achievement :'));
        const tgtEl = Array.from(document.querySelectorAll("div, p, span")).find(el => (el.innerText || '').includes('Target :'));
        return {
            achievement: achEl ? achEl.innerText : null,
            target: tgtEl ? tgtEl.innerText : null
        };
    """)
    print("\nHeader info on Blinkit:", header_info)

finally:
    driver.quit()

