import sys, os, time
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step3_selenium import create_chrome_driver, ensure_authenticated, wait_for_loading_complete, apply_segment_platform

driver = create_chrome_driver(headless=True)
try:
    print("Navigating and authenticating as boat...")
    ensure_authenticated(driver, "http://localhost:9500/pricing-analysis", client="boat")
    wait_for_loading_complete(driver, timeout=20)
    time.sleep(2)

    # Let's check what platforms are in the DOM / sidebar / carousel
    dom_info = driver.execute_script("""
        const el = Array.from(document.querySelectorAll("p, span, div")).find(e => 
            e.children.length === 0 && (e.innerText.includes("Tap to change platform") || e.innerText.includes("Select Platform"))
        );
        let cardText = el ? el.innerText : 'NO CARD TRIGGER';

        let card = el ? el.closest(".MuiBox-root") : null;
        while (card && card.parentElement && window.getComputedStyle(card).cursor !== 'pointer' && !card.innerText.includes('Tap to change')) {
            card = card.parentElement;
        }

        const collapse = document.querySelector(".MuiCollapse-root");
        const isExpanded = collapse ? (collapse.offsetHeight > 10) : false;

        // If not expanded, click card
        if (!isExpanded && card) {
            card.click();
        }

        const imgs = collapse ? Array.from(collapse.querySelectorAll("img")).map(i => ({ alt: i.alt, src: i.src })) : [];
        const divTexts = collapse ? Array.from(collapse.querySelectorAll("div")).map(d => d.innerText).filter(t => t && t.trim()) : [];

        // Check window.sessionStorage user and FilterContext values
        const sessionUser = sessionStorage.getItem('user');
        
        return {
            cardFound: !!el,
            cardText,
            isExpanded,
            imgs,
            divTexts: divTexts.slice(0, 10),
            sessionUser
        };
    """)
    print("DOM Info before platform switch:", repr(dom_info).encode('ascii', 'replace').decode('ascii'))
    time.sleep(1)

    applied, err_msg = apply_segment_platform(driver, "blinkit")
    print("apply_segment_platform result:", applied, repr(err_msg).encode('ascii', 'replace').decode('ascii'))

finally:
    driver.quit()
