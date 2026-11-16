import sys
sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")

from ds_tester.backend.step3_selenium import create_chrome_driver, ensure_authenticated, apply_segment_platform
import time

driver = create_chrome_driver(headless=True)
try:
    target_url = "http://localhost:9500/pricing-analysis"
    ensure_authenticated(driver, target_url, client="pidilite")
    driver.get(target_url)
    time.sleep(3)
    
    card_info = driver.execute_script("""
        const el = Array.from(document.querySelectorAll("p, span, div")).find(e => 
            e.children.length === 0 && (e.innerText.includes("Tap to change platform") || e.innerText.includes("Select Platform"))
        );
        if (!el) return { cardFound: false, current: '' };

        let card = el.closest(".MuiBox-root");
        while (card && card.parentElement && window.getComputedStyle(card).cursor !== 'pointer' && !card.innerText.includes('Tap to change')) {
            card = card.parentElement;
        }

        const current = card ? (card.innerText || '').toLowerCase() : '';
        return { cardFound: true, current: current };
    """)
    print("CARD INFO:", card_info)
    
    applied, err = apply_segment_platform(driver, "amazon")
    print(f"APPLIED: {applied}, ERR: {err}")
finally:
    driver.quit()

