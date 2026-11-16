import sys, os
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step3_selenium import create_chrome_driver, ensure_authenticated, FRONTEND_URL
import time

driver = create_chrome_driver(headless=False)
try:
    target_url = f"{FRONTEND_URL}/pds-score"
    ensure_authenticated(driver, target_url, client="mars")
    time.sleep(2.0)

    # Test fetch from inside the authenticated browser session
    res = driver.execute_async_script("""
        const done = arguments[arguments.length - 1];
        fetch('/api/pds-score/overview?platform=Blinkit&period=Period%2011', {
            headers: {
                'Authorization': sessionStorage.getItem('token') ? ('Bearer ' + sessionStorage.getItem('token')) : ''
            }
        })
        .then(r => r.json().then(data => done({ status: r.status, ok: r.ok, data: data })))
        .catch(err => done({ error: err.toString() }));
    """)
    print("Browser fetch result:", res)

    # Check console errors
    logs = driver.get_log('browser')
    print("\nBrowser console logs:")
    for l in logs[-10:]:
        print(l)
finally:
    driver.quit()

