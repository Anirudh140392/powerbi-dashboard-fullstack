import sys, os

path = 'ds_tester/backend/step3_selenium.py'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update apply_segment_platform
old_apply = '''def apply_segment_platform(driver: webdriver.Chrome, segment: str):

    """

    Applies the segment platform filter in the live dashboard UI.

    - If 'all': clicks the header 'Reset' button to clear any selected platforms/filters.

    - If a specific platform ('blinkit', 'zepto', 'instamart', 'amazon'): switches to it via the sidebar.

    Returns:

        (success: bool, error_message: Optional[str])

    """

    seg = segment.lower().strip()

    wait = WebDriverWait(driver, 10)



    if seg == "all":

        try:

            reset_btn = wait.until(

                EC.element_to_be_clickable(

                    (By.XPATH, "//button[contains(., 'Reset') or @aria-label='Reset all filters to defaults']")

                )

            )

            reset_btn.click()

            time.sleep(1)

            wait_for_loading_complete(driver, timeout=20)

        except Exception:

            pass

        return True, None



    platform_names = {

        "blinkit": "Blinkit",

        "zepto": "Zepto",

        "instamart": "Instamart",

        "amazon": "Amazon",

    }

    platform_names.update({
        'flipkart': 'Flipkart',
        'apollo_247': 'Apollo 247',
        'apollo 247': 'Apollo 247',
        'first_cry': 'First Cry',
        'first cry': 'First Cry',
        'pharmeasy': 'Pharmeasy',
        'netmeds': 'Netmeds',
        'truemeds': 'Truemeds',
        'myntra': 'Myntra',
        'nykaa': 'Nykaa',
        'meesho': 'Meesho',
        'jiomart': 'Jiomart',
    })
    target_name = platform_names.get(seg, seg.title())

    try:
        ctx_applied = driver.execute_script('''
            const target = arguments[0];
            let applied = false;
            if (window.__filterContext && typeof window.__filterContext.setPlatform === 'function') {
                window.__filterContext.setPlatform(target);
                applied = true;
            }
            window.dispatchEvent(new CustomEvent('trailytics:setPlatform', { detail: target }));
            return applied;
        ''', target_name)
        if ctx_applied:
            time.sleep(0.2)
            return True, None
    except Exception:
        pass"""

new_apply = '''def apply_segment_platform(driver: webdriver.Chrome, segment: str):
    """
    Applies the segment platform filter in the live dashboard UI.
    - If 'all': clicks the header 'Reset' button to clear any selected platforms/filters.
    - If a specific platform ('blinkit', 'zepto', 'instamart', 'flipkart', 'nykaa', etc.):
      dynamically resolves canonical platform from window.__filterContext.platforms,
      dispatches state updates, triggers the sidebar squircle click, and reactively
      waits until the dashboard reflects the target platform.
    Returns:
        (success: bool, error_message: Optional[str])
    """
    seg = segment.lower().strip()
    wait = WebDriverWait(driver, 10)

    if seg == "all":
        try:
            reset_btn = wait.until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//button[contains(., 'Reset') or @aria-label='Reset all filters to defaults']")
                )
            )
            reset_btn.click()
            time.sleep(0.6)
            wait_for_loading_complete(driver, timeout=20)
        except Exception:
            pass
        return True, None

    # Step 1: Execute platform switch in browser using dynamic matching from window.__filterContext
    driver.execute_script("""
        const targetRaw = arguments[0];
        const targetClean = targetRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
        const fc = window.__filterContext;
        const available = (fc && fc.platforms) || [];
        
        let matched = available.find(p => p.toLowerCase().replace(/[^a-z0-9]/g, '') === targetClean);
        if (!matched) {
            matched = available.find(p => p.toLowerCase().includes(targetClean) || targetClean.includes(p.toLowerCase().replace(/[^a-z0-9]/g, '')));
        }
        const finalTarget = matched || targetRaw;
        
        if (fc && typeof fc.setPlatform === 'function') {
            fc.setPlatform(finalTarget);
        }
        window.dispatchEvent(new CustomEvent('trailytics:setPlatform', { detail: finalTarget }));
        
        // Also click sidebar carousel squircle if available to trigger onPlatformChange / onFiltersChange
        const collapse = document.querySelector(".MuiCollapse-root");
        if (collapse) {
            const imgs = Array.from(collapse.querySelectorAll("img"));
            const targetImg = imgs.find(i => {
                const alt = (i.alt || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                return alt === targetClean || alt.includes(targetClean);
            });
            if (targetImg) {
                const squircle = targetImg.closest(".MuiBox-root[style*='cursor: pointer'], div[style*='cursor: pointer']") || targetImg.parentElement;
                if (squircle) squircle.click();
            }
        }
    """, seg)

    # Step 2: Reactive wait loop - wait for FilterContext.platform to reflect the target platform
    target_clean = seg.replace(" ", "").replace("_", "").replace("-", "")
    start_wait = time.time()
    while time.time() - start_wait < 8:
        curr = driver.execute_script("""
            const fc = window.__filterContext;
            const pd = window.__pricingData;
            return {
                fcPlat: fc ? (fc.platform || '') : '',
                pdPlat: pd ? (pd.platform || '') : ''
            };
        """)
        fc_p = str(curr.get("fcPlat") or "").lower().replace(" ", "").replace("_", "").replace("-", "")
        pd_p = str(curr.get("pdPlat") or "").lower().replace(" ", "").replace("_", "").replace("-", "")
        if target_clean in fc_p or target_clean in pd_p or fc_p in target_clean:
            break
        time.sleep(0.2)

    # Step 3: Wait for spinners/skeletons to resolve
    time.sleep(0.25)
    wait_for_loading_complete(driver, timeout=20)
    return True, None'''

if old_apply in code:
    code = code.replace(old_apply, new_apply)
    print("Replaced apply_segment_platform successfully!")
else:
    print("Could not find old_apply in code!")

# 2. Update read_pricing_overview
old_read = '''def read_pricing_overview(driver: webdriver.Chrome, headless: bool = False, target_platform: str = 'all') -> Dict[str, Optional[str]]:

    """

    Extracts the 3 KPI card values from the Pricing Overview section:

      - Discount (%)

      - Weighted Discount (%)

      - Average Selling Price (ASP) (₹)

    """

    if not headless:

        show_live_step_banner(driver, "🔍 DS Tester: Locating & Verifying Pricing Overview KPI Cards...")



    driver.execute_script("window.scrollTo({top: 0, behavior: 'smooth'});")

    

    # Reactive polling loop up to 15s to ensure async cards have loaded and skeletons resolved

    start_time = time.time()

    results: Dict[str, Optional[str]] = {"discount": None, "weighted_discount": None, "asp": None}

    

    while time.time() - start_time < 15:

        scraped = driver.execute_script("""
            // Check window.__pricingData first with target platform alignment
            const targetPlat = (arguments[0] || 'all').toLowerCase().replace(/[^a-z0-9]/g, '');
            const pd = window.__pricingData;
            if (pd && !pd.loading && pd.kpiData) {
                const curPlat = (pd.platform || 'all').toLowerCase().replace(/[^a-z0-9]/g, '');
                const matchesPlat = (targetPlat === 'all' || curPlat === targetPlat || curPlat.includes(targetPlat) || targetPlat.includes(curPlat));
                if (matchesPlat) {
                    const k = pd.kpiData;
                    const dVal = k.discount && k.discount.value !== null && k.discount.value !== undefined ? String(k.discount.value) : null;
                    const wdVal = k.weightedDiscount && k.weightedDiscount.value !== null && k.weightedDiscount.value !== undefined ? String(k.weightedDiscount.value) : null;
                    const aspVal = k.asp && k.asp.value !== null && k.asp.value !== undefined ? String(k.asp.value) : null;
                    if (dVal !== null || aspVal !== null) {
                        return { discount: dVal, weighted_discount: wdVal, asp: aspVal, loading: false };
                    }
                }
            }

            const headers = Array.from(document.querySelectorAll("h3, p, span, div")).filter(el => {

                if (el.children.length > 0) return false;

                const t = (el.innerText || "").trim().toLowerCase();

                return t === "discount" || t === "weighted discount" || t === "average selling price" || t === "asp";

            });

            const out = { discount: null, weighted_discount: null, asp: null, loading: false };

            for (const h of headers) {

                const card = h.closest("div.rounded-2xl, div[class*='rounded-2xl'], .MuiCard-root");

                if (!card) continue;

                if (card.querySelector('.animate-pulse') || card.classList.contains('animate-pulse')) {

                    out.loading = true;

                }

                const valEl = card.querySelector(".text-3xl span, .text-3xl") || card.querySelector("h5, .MuiTypography-h5");

                if (valEl && valEl.innerText.trim()) {

                    const title = h.innerText.trim().toLowerCase();

                    const val = valEl.innerText.trim();

                    if (title === "weighted discount") out.weighted_discount = val;

                    else if (title === "discount") out.discount = val;

                    else if (title.includes("selling price") || title === "asp") out.asp = val;

                }

            }

            return out;

        """, target_platform) or {}'''

new_read = '''def read_pricing_overview(driver: webdriver.Chrome, headless: bool = False, target_platform: str = 'all') -> Dict[str, Optional[str]]:
    """
    Extracts the 3 KPI card values from the Pricing Overview section:
      - Discount (%)
      - Weighted Discount (%)
      - Average Selling Price (ASP) (₹)
    Ensures platform alignment before scraping, preventing race conditions with stale cards.
    """
    if not headless:
        show_live_step_banner(driver, "🔍 DS Tester: Locating & Verifying Pricing Overview KPI Cards...")

    driver.execute_script("window.scrollTo({top: 0, behavior: 'smooth'});")

    # Reactive polling loop up to 15s to ensure async cards have loaded and skeletons resolved
    start_time = time.time()
    results: Dict[str, Optional[str]] = {"discount": None, "weighted_discount": None, "asp": None}

    while time.time() - start_time < 15:
        scraped = driver.execute_script("""
            const targetClean = (arguments[0] || 'all').toLowerCase().replace(/[^a-z0-9]/g, '');
            const fc = window.__filterContext;
            const curPlat = fc ? (fc.platform || 'all').toLowerCase().replace(/[^a-z0-9]/g, '') : 'all';

            // Platform alignment guard: if target platform is specified (not 'all'),
            // ensure the dashboard is actually showing the target platform
            if (targetClean !== 'all' && curPlat !== 'all') {
                const matches = (curPlat === targetClean || curPlat.includes(targetClean) || targetClean.includes(curPlat));
                if (!matches) {
                    return { discount: null, weighted_discount: null, asp: null, loading: true };
                }
            }

            // Check window.__pricingData first
            const pd = window.__pricingData;
            if (pd && !pd.loading && pd.kpiData) {
                const pdPlat = (pd.platform || 'all').toLowerCase().replace(/[^a-z0-9]/g, '');
                const matchesPlat = (targetClean === 'all' || pdPlat === targetClean || pdPlat.includes(targetClean) || targetClean.includes(pdPlat));
                if (matchesPlat) {
                    const k = pd.kpiData;
                    const dVal = k.discount && k.discount.value !== null && k.discount.value !== undefined ? String(k.discount.value) : null;
                    const wdVal = k.weightedDiscount && k.weightedDiscount.value !== null && k.weightedDiscount.value !== undefined ? String(k.weightedDiscount.value) : null;
                    const aspVal = k.asp && k.asp.value !== null && k.asp.value !== undefined ? String(k.asp.value) : null;
                    if (dVal !== null || aspVal !== null) {
                        return { discount: dVal, weighted_discount: wdVal, asp: aspVal, loading: false };
                    }
                }
            }

            // If window.__pricingData is actively loading, do NOT scrape stale cards!
            if (pd && pd.loading) {
                return { discount: null, weighted_discount: null, asp: null, loading: true };
            }

            // DOM Fallback: query strictly within the Pricing Overview section
            const overviewHeaders = Array.from(document.querySelectorAll("h1, h2, h3, h4, span, div")).filter(el => {
                return el.children.length === 0 && (el.innerText || "").trim().toLowerCase() === "pricing overview";
            });
            const container = overviewHeaders.length > 0 ? (overviewHeaders[0].closest(".MuiBox-root, div[class*='rounded'], div[style*='marginBottom']") || document) : document;

            const headers = Array.from(container.querySelectorAll("h3, p, span, div")).filter(el => {
                if (el.children.length > 0) return false;
                const t = (el.innerText || "").trim().toLowerCase();
                return t === "discount" || t === "weighted discount" || t === "average selling price" || t === "asp";
            });

            const out = { discount: null, weighted_discount: null, asp: null, loading: false };

            for (const h of headers) {
                const card = h.closest("div.rounded-2xl, div[class*='rounded-2xl'], .MuiCard-root");
                if (!card) continue;
                if (card.querySelector('.animate-pulse') || card.classList.contains('animate-pulse') || card.querySelector('.MuiSkeleton-root')) {
                    out.loading = true;
                }
                const valEl = card.querySelector(".text-3xl span, .text-3xl") || card.querySelector("h5, .MuiTypography-h5");
                if (valEl && valEl.innerText.trim()) {
                    const title = h.innerText.trim().toLowerCase();
                    const val = valEl.innerText.trim();
                    if (title === "weighted discount") out.weighted_discount = val;
                    else if (title === "discount") out.discount = val;
                    else if (title.includes("selling price") || title === "asp") out.asp = val;
                }
            }
            return out;
        """, target_platform) or {}'''

if old_read in code:
    code = code.replace(old_read, new_read)
    print("Replaced read_pricing_overview successfully!")
else:
    print("Could not find old_read in code!")

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

print("step3_selenium.py updated!")
