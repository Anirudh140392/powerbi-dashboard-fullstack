import sys
sys.path.append('.')
from ds_tester.backend.step3_selenium import create_chrome_driver, ensure_authenticated, wait_for_loading_complete

driver = create_chrome_driver(headless=True)
try:
    ensure_authenticated(driver, "http://localhost:9500/pricing-analysis", client="mars")
    wait_for_loading_complete(driver, timeout=20)
    
    # Inspect what platforms are visible in the carousel / header
    res = driver.execute_script("""
        const carousel = document.querySelector(".MuiCollapse-root");
        const carouselImgs = carousel ? Array.from(carousel.querySelectorAll("img")).map(i => i.alt || i.src) : [];
        const carouselText = carousel ? carousel.innerText : 'NO CAROUSEL';
        
        const channelHeader = Array.from(document.querySelectorAll("p, span, div, h6")).find(el => 
            el.innerText && el.innerText.trim().toUpperCase() === "CHANNEL" && el.children.length === 0
        );
        const channelCurrent = channelHeader ? channelHeader.parentElement.innerText : 'NO CHANNEL HEADER';

        return {
            channelCurrent,
            carouselImgs,
            carouselText
        };
    """)
    print("Mars Pricing Analysis DOM:", res)
finally:
    driver.quit()
