import sys, os
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step3_selenium import create_chrome_driver, ensure_authenticated, FRONTEND_URL
import time

driver = create_chrome_driver(headless=False)
try:
    target_url = f"{FRONTEND_URL}/pds-score"
    ensure_authenticated(driver, target_url, client="mars")
    time.sleep(2.0)

    # Trigger mousedown to open MUI Select
    opened = driver.execute_script("""
        const selects = Array.from(document.querySelectorAll(".MuiSelect-select"));
        if (selects.length > 0) {
            selects[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            return true;
        }
        return false;
    """)
    print("Mousedown triggered:", opened)
    time.sleep(1.0)

    # Check open options
    options = driver.execute_script("""
        const items = Array.from(document.querySelectorAll("li.MuiMenuItem-root, li[role='option']"));
        return items.map(i => i.innerText);
    """)
    print("Open menu options:", options)

    # Click Blinkit
    clicked = driver.execute_script("""
        const items = Array.from(document.querySelectorAll("li.MuiMenuItem-root, li[role='option']"));
        const match = items.find(i => (i.innerText || '').toLowerCase().includes('blinkit'));
        if (match) {
            match.click();
            return true;
        }
        return false;
    """)
    print("Clicked Blinkit option:", clicked)
    time.sleep(2.0)

    # Check selects after
    selects_after = driver.execute_script("""
        return Array.from(document.querySelectorAll(".MuiSelect-select")).map(s => s.innerText);
    """)
    print("Selects after switching:", selects_after)

finally:
    driver.quit()

