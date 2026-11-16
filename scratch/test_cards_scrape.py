import sys, os, time
sys.path.insert(0, os.path.abspath("."))
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from ds_tester.backend.step3_selenium import FRONTEND_URL, ensure_authenticated, wait_for_loading_complete

chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--window-size=1920,1080")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--no-sandbox")

driver = webdriver.Chrome(options=chrome_options)
try:
    url = f"{FRONTEND_URL}/watch-tower"
    ensure_authenticated(driver, url, client="boat")
    time.sleep(3)
    wait_for_loading_complete(driver, timeout=25)
    time.sleep(3)

    cards = driver.execute_script("""
        const res = {};
        // Match span containing title
        const spans = Array.from(document.querySelectorAll("span, p, div"));
        for (const s of spans) {
            const txt = (s.innerText || "").trim().toLowerCase();
            if (['offtake', 'offtakes', 'osa', 'share of search', 'market share', 'discount', 'promo'].includes(txt)) {
                // Find nearest card container
                let p = s.parentElement;
                while (p && p.tagName !== 'BODY') {
                    const valEl = p.querySelector(".text-3xl, .font-black");
                    if (valEl) {
                        res[txt] = valEl.innerText.trim();
                        break;
                    }
                    p = p.parentElement;
                }
            }
        }
        return res;
    """)
    print("Scraped cards:", cards)
finally:
    driver.quit()

