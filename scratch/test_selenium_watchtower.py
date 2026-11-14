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
    print("Opening watch-tower for boat...")
    ensure_authenticated(driver, url, client="boat")
    time.sleep(2)
    wait_for_loading_complete(driver, timeout=25)
    time.sleep(2)

    data = driver.execute_script("""
        const res = {};
        
        // 1. Top KPI cards
        const cards = Array.from(document.querySelectorAll("div.group, div.rounded-\\\\[2rem\\\\], div.rounded-2xl, div"));
        const topMetrics = {};
        for (const el of document.querySelectorAll("div, span, p")) {
            const txt = (el.innerText || "").trim();
            if (['Offtake', 'Offtakes', 'OSA', 'Share of Search', 'Market Share', 'Discount'].includes(txt)) {
                // find value in sibling or parent
                const parent = el.closest(".group") || el.parentElement;
                if (parent) {
                    const valEl = parent.querySelector(".text-3xl, .font-black, h5, .text-xl");
                    if (valEl) {
                        topMetrics[txt] = valEl.innerText.trim();
                    }
                }
            }
        }
        res.topMetrics = topMetrics;

        // 2. Check for Platform Overview
        const platHeaders = Array.from(document.querySelectorAll("h5, h6, h4, span, div")).filter(el => (el.innerText || "").toLowerCase().includes("platform overview"));
        res.hasPlatformOverview = platHeaders.length > 0;

        // 3. Check for Category Performance
        const catHeaders = Array.from(document.querySelectorAll("h5, h6, h4, span, div")).filter(el => (el.innerText || "").toLowerCase().includes("category performance"));
        res.hasCategoryPerformance = catHeaders.length > 0;

        // 4. Check for Performance Breakdown
        const pbHeaders = Array.from(document.querySelectorAll("h5, h6, h4, span, div")).filter(el => (el.innerText || "").toLowerCase().includes("performance breakdown"));
        res.hasPerformanceBreakdown = pbHeaders.length > 0;

        return res;
    """)
    print("Scraped result:", data)
finally:
    driver.quit()

