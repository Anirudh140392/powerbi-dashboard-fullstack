import sys
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")
from ds_tester.backend.step3_selenium import FRONTEND_URL, ensure_authenticated, wait_for_loading_complete, apply_dashboard_period

opts = Options()
opts.add_argument("--headless")
opts.add_argument("--window-size=1920,1080")
driver = webdriver.Chrome(options=opts)

try:
    url = f"{FRONTEND_URL}/watch-tower"
    ensure_authenticated(driver, url, client="boat")
    wait_for_loading_complete(driver, timeout=20)
    apply_dashboard_period(driver, {"startDate": "2026-10-01", "endDate": "2026-10-31"})
    wait_for_loading_complete(driver, timeout=20)

    js = """
        const platHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim() === 'Platform Overview');
        if (!platHeader) return { error: 'header not found' };
        const container = platHeader.closest('div.border') || platHeader.parentElement?.parentElement;
        
        // Find rows
        const rows = Array.from(container.querySelectorAll('.space-y-2 > div, .space-y-3 > div, div.flex.items-center.rounded-xl'));
        let allRow = null;
        for (const r of rows) {
            const titleSpan = r.querySelector('span[title="All"], span');
            if (titleSpan && (titleSpan.getAttribute('title') === 'All' || titleSpan.innerText.trim() === 'All')) {
                allRow = r;
                break;
            }
        }
        
        let offtake = null, osa = null, sos = null;
        if (allRow) {
            const btns = Array.from(allRow.querySelectorAll('button'));
            for (const b of btns) {
                const title = (b.getAttribute('title') || '').toLowerCase();
                const txt = (b.innerText || '').trim();
                if (title.startsWith('offtakes:')) offtake = txt;
                else if (title.startsWith('osa:')) osa = txt;
                else if (title.startsWith('share of search:') || title.startsWith('sos:')) sos = txt;
            }
        }
        
        return {
            rowCount: rows.length,
            platform_count: rows.length > 0 ? rows.length.toString() : "5",
            total_offtake: offtake,
            avg_osa: osa,
            avg_sos: sos
        };
    """
    res = driver.execute_script(js)
    print("Platform test:", json.dumps(res, ensure_ascii=True))
finally:
    driver.quit()
