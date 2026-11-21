import sys, os
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step3_selenium import create_chrome_driver, ensure_authenticated, FRONTEND_URL
import time

driver = create_chrome_driver(headless=False)
try:
    target_url = f"{FRONTEND_URL}/pds-score"
    ensure_authenticated(driver, target_url, client="mars")
    time.sleep(2.0)

    res = driver.execute_script("""
        const selects = Array.from(document.querySelectorAll(".MuiSelect-select"));
        return selects.map(s => s.innerText);
    """)
    print("Initial selects on /pds-score:", res)

    # Check table rows text
    rows_text = driver.execute_script("""
        return Array.from(document.querySelectorAll("tr")).map(r => r.innerText);
    """)
    print(f"\nFound {len(rows_text)} table rows. First 4 rows:")
    for r in rows_text[:4]:
        print(" ->", repr(r))

    # Check header achievement text
    achieve_text = driver.execute_script("""
        return Array.from(document.querySelectorAll("div, p, span"))
            .filter(el => (el.innerText || '').includes('Achievement :'))
            .map(el => el.innerText);
    """)
    print("\nAchievement elements:", achieve_text)
finally:
    driver.quit()

