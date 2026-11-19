import sys
sys.path.insert(0, '.')
from ds_tester.backend.step3_selenium import create_chrome_driver, ensure_authenticated, FRONTEND_URL
from selenium.webdriver.common.by import By
import time

driver = create_chrome_driver(headless=True)
try:
    url = f"{FRONTEND_URL}/availability-analysis"
    print("Navigating and authenticating...")
    ensure_authenticated(driver, url, client="mars")
    time.sleep(5)
    
    print("Current URL:", driver.current_url)
    
    # Get all text in the page
    cards = driver.execute_script("""
        const cards = [];
        document.querySelectorAll("h3").forEach(h => {
            const card = h.closest(".group") || h.closest("div.rounded-2xl") || h.parentElement?.parentElement?.parentElement;
            let val = "";
            if (card) {
                const valEl = card.querySelector(".text-3xl span, .text-3xl, div[class*='text-3xl']");
                if (valEl) val = valEl.innerText.trim();
            }
            cards.push({ title: h.innerText.trim(), value: val });
        });
        return cards;
    """)
    print("CARDS FOUND:", cards)
    
    # Also check what channels and platforms are selected in FilterContext
    filters = driver.execute_script("""
        return {
            localStorage: { ...localStorage },
            sessionStorage: { ...sessionStorage },
            bodySnippet: document.body.innerText.slice(0, 1000)
        };
    """)
    print("Body snippet:\n", filters.get("bodySnippet", "")[:500])
finally:
    driver.quit()
