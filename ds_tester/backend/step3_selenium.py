import os

import time

from typing import Optional, Any, Dict, Tuple

from dotenv import load_dotenv



from selenium import webdriver

from selenium.webdriver.chrome.options import Options

from selenium.webdriver.common.by import By

from selenium.webdriver.support.ui import WebDriverWait

from selenium.webdriver.support import expected_conditions as EC

from selenium.common.exceptions import TimeoutException



# Load backend environment settings

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

load_dotenv(os.path.join(BASE_DIR, "backend", ".env"))



FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:9500").rstrip("/")

LOGIN_EMAIL = os.getenv("TEST_USER_EMAIL") or os.getenv("Alert_email") or "admin@trailytics.com"

LOGIN_PASSWORD = os.getenv("TEST_USER_PASSWORD") or os.getenv("Alert_email_password") or "admin123"





def create_chrome_driver(headless: bool = False) -> webdriver.Chrome:

    """

    Creates a Chrome driver instance.

    - If headless is True: runs invisibly in background (--headless=new).

    - If headless is False: opens a visible Chrome window so the tester can see live execution on screen.

    """

    options = Options()

    if headless:

        options.add_argument("--headless=new")

        options.add_argument("--window-size=1920,1080")

        options.add_argument("--disable-gpu")

    else:

        # Non-headless mode (visible browser window on screen)

        options.add_argument("--start-maximized")

        options.add_argument("--window-position=0,0")

        options.add_argument("--disable-infobars")

        options.add_argument("--disable-notifications")



    options.add_argument("--disable-extensions")

    # Disable notifications so popups don't obstruct Selenium clicks
    prefs = {
        "profile.default_content_setting_values.notifications": 2,
    }
    options.add_experimental_option("prefs", prefs)

    # Container-friendly configuration. Chrome refuses to run as root without
    # --no-sandbox, and /dev/shm is small inside Docker by default. A container
    # also has no display, so visible mode must fall back to headless.
    chrome_bin = os.getenv("CHROME_BIN")
    if chrome_bin:
        options.binary_location = chrome_bin
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
    if os.getenv("DS_TESTER_FORCE_HEADLESS") == "1":
        headless = True
        options.add_argument("--headless=new")
        options.add_argument("--window-size=1920,1080")
    # Suppress verbose DevTools logging

    options.add_experimental_option("excludeSwitches", ["enable-logging"])



    driver = webdriver.Chrome(options=options)

    driver.set_page_load_timeout(60)



    if not headless:

        bring_chrome_to_top(driver)



    return driver





def is_driver_alive(driver) -> bool:

    """Checks whether the Chrome driver session is alive, responsive, and connected."""

    if driver is None:

        return False

    try:

        _ = driver.window_handles

        return True

    except Exception:

        return False





def safe_quit_driver(driver):

    """Safely closes and quits a Chrome driver session without raising errors."""

    if driver is not None:

        try:

            driver.quit()

        except Exception:

            pass





def bring_chrome_to_top(driver: Optional[webdriver.Chrome] = None):

    """

    Forces the visible Chrome window to the absolute foreground of the user's desktop,

    bypassing Windows background window focus restrictions using Win32 HWND_TOPMOST.

    """

    try:

        import ctypes

        from ctypes import wintypes

        user32 = ctypes.windll.user32



        win_title = ""

        try:

            win_title = driver.title

        except Exception:

            pass



        hwnds = []

        def enum_proc(hwnd, lParam):

            if user32.IsWindowVisible(hwnd):

                length = user32.GetWindowTextLengthW(hwnd)

                if length > 0:

                    buff = ctypes.create_unicode_buffer(length + 1)

                    user32.GetWindowTextW(hwnd, buff, length + 1)

                    t = buff.value

                    if (win_title and win_title in t) or "Chrome" in t or "Trailytics" in t or "Pricing" in t:

                        hwnds.append(hwnd)

            return True



        PROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)

        user32.EnumWindows(PROC(enum_proc), 0)



        SW_RESTORE = 9

        HWND_TOPMOST = -1

        SWP_NOMOVE = 0x0002

        SWP_NOSIZE = 0x0001

        SWP_SHOWWINDOW = 0x0040



        for h in hwnds:

            user32.ShowWindow(h, SW_RESTORE)

            user32.SetWindowPos(h, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)

            user32.SetForegroundWindow(h)

    except Exception:

        pass





def show_live_step_banner(driver: webdriver.Chrome, text: str):

    """

    Displays a prominent live status banner at the top center of the browser window

    so the tester watching the live window knows exactly what Selenium is doing.

    """

    try:

        driver.execute_script("""

            let banner = document.getElementById('__ds_tester_live_banner');

            if (!banner) {

                banner = document.createElement('div');

                banner.id = '__ds_tester_live_banner';

                banner.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:9999999;background:rgba(15,23,42,0.95);color:#ffffff;padding:12px 28px;border-radius:30px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:700;box-shadow:0 12px 30px rgba(0,0,0,0.4);border:2px solid #22c55e;display:flex;align-items:center;gap:12px;pointer-events:none;backdrop-filter:blur(8px);transition:all 0.3s;';

                document.body.appendChild(banner);

            }

            banner.innerHTML = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ef4444;box-shadow:0 0 10px #ef4444;"></span> <span style="color:#a7f3d0;font-size:12px;letter-spacing:1px;text-transform:uppercase;">LIVE SELENIUM</span> <span style="color:#ffffff;">| ${arguments[0]}</span>`;

        """, text)

    except Exception:

        pass





def highlight_element(driver: webdriver.Chrome, selector_or_elem: Any, duration_ms: int = 2000):

    """

    Temporarily pulses an outline on the element being verified

    so the tester can visibly see Selenium inspecting that exact data.

    """

    try:

        driver.execute_script("""

            const el = arguments[0];

            if (el && el.style) {

                const origOutline = el.style.outline;

                const origBoxShadow = el.style.boxShadow;

                el.style.outline = '3px solid #22c55e';

                el.style.boxShadow = '0 0 25px rgba(34, 197, 94, 0.7)';

                el.scrollIntoView({ behavior: 'smooth', block: 'center' });

                setTimeout(() => {

                    el.style.outline = origOutline;

                    el.style.boxShadow = origBoxShadow;

                }, arguments[1]);

            }

        """, selector_or_elem, duration_ms)

    except Exception:

        pass





def wait_for_loading_complete(driver: webdriver.Chrome, timeout: float = 3.0):
    """
    Waits for active loading spinners, progress bars, or MUI skeletons to disappear.
    Excludes permanent status indicators (such as .animate-pulse dots/badges).
    Returns immediately if no loaders are active.
    """
    effective_timeout = min(float(timeout), 10.0)
    start_time = time.time()
    time.sleep(0.04)
    while time.time() - start_time < effective_timeout:
        try:
            has_loader = driver.execute_script("""
                const loaders = document.querySelectorAll(
                    ".MuiSkeleton-root, .MuiCircularProgress-root, [role='progressbar'], .animate-spin"
                );
                for (const el of loaders) {
                    if (el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0) {
                        return true;
                    }
                }
                return false;
            """)
            if not has_loader:
                break
        except Exception:
            break
        time.sleep(0.05)





_CLIENT_METADATA_CACHE: Dict[str, Tuple[str, str]] = {}



def normalize_client_db(client_name: Optional[str]) -> str:

    """Normalizes any client name, brand alias, or casing into canonical ClickHouse db_name."""

    if not client_name:

        return "drl"

    norm = str(client_name).lower().strip()

    alias_map = {

        "dr reddy": "drl",

        "dr. reddy's": "drl",

        "dr reddy's": "drl",

        "dr_reddy": "drl",

        "dr reddys": "drl",

        "dr_reddys": "drl",

        "reddy": "drl",

        "dr. reddy": "drl",

        "dr.reddy": "drl",

        "bo at": "boat",

        "bo_at": "boat",

        "mars petcare": "mars_petcare",

        "mars snacking": "mars",

        "suhana masala": "suhana_masala",

    }

    return alias_map.get(norm, norm)



def get_client_metadata(client_name: str) -> Tuple[str, str, str]:

    """Returns (db_id, company_id, logo_url) from ClickHouse admin_master.tb_database."""

    norm = normalize_client_db(client_name)

    if norm in _CLIENT_METADATA_CACHE:

        return _CLIENT_METADATA_CACHE[norm]

    try:

        from ds_tester.backend.step2_logic import get_clickhouse_client

        ch = get_clickhouse_client('admin_master')

        rows = ch.query(f"SELECT toString(db_id), toString(company_id), toString(logo_url) FROM tb_database WHERE lower(db_name) = '{norm}' LIMIT 1").result_rows

        if rows:

            _CLIENT_METADATA_CACHE[norm] = (str(rows[0][0]), str(rows[0][1]), str(rows[0][2] or ""))

            return _CLIENT_METADATA_CACHE[norm]

    except Exception:

        pass

    return ("1", "", "")





def ensure_authenticated(
    driver: webdriver.Chrome,
    target_url: str = FRONTEND_URL,
    client: Optional[str] = None,
    on_live_step: Optional[Any] = None,
):
    """
    Ensures the browser session is authenticated with live platform credentials,
    injecting valid session state and navigating smoothly to target_url.
    Reuses existing session instantly across batch runs if already logged in to target_db.
    """
    import jwt
    import json

    target_db = normalize_client_db(client)

    # 1. Fast Session Reuse: If driver is already authenticated for target_db on frontend, reuse instantly!
    curr_url = ""
    try:
        curr_url = driver.current_url or ""
    except Exception:
        pass

    is_already_auth = False
    if FRONTEND_URL in curr_url:
        try:
            curr_db = driver.execute_script("return sessionStorage.getItem('activeWorkspaceDb') || localStorage.getItem('activeWorkspaceDb');")
            is_logged_in = driver.execute_script("return sessionStorage.getItem('isLoggedIn') === 'true';")
            if is_logged_in and curr_db == target_db:
                is_already_auth = True
        except Exception:
            pass

    if is_already_auth:
        clean_curr = curr_url.split("?")[0].rstrip("/")
        clean_target = target_url.split("?")[0].rstrip("/")
        if clean_curr != clean_target:
            driver.get(target_url)
            wait_for_loading_complete(driver, timeout=3.0)
            if on_live_step:
                on_live_step(f"Navigated to {target_url}...")
        elif on_live_step:
            on_live_step(f"Active session verified on {target_url}...")
        return

    # 2. Fresh Authentication
    jwt_secret = os.getenv("JWT_SECRET", "trailytics_jwt_secret_2026")
    real_db_id, real_company_id, real_logo_url = get_client_metadata(target_db)

    token_payload = {
        "userId": "1",
        "email": LOGIN_EMAIL,
        "userName": "Admin",
        "dbName": target_db,
        "dbId": real_db_id,
        "companyId": real_company_id,
        "dbLogoUrl": real_logo_url,
        "role": "admin",
        "qcUser": 0,
        "dbStatus": True,
    }
    token = jwt.encode(token_payload, jwt_secret, algorithm="HS256")
    tab_perms = {}
    try:
        from ds_tester.backend.modules.insights import _fetch_client_kpi_config
        kpi_cfg = _fetch_client_kpi_config(target_db)
        if kpi_cfg:
            tab_perms["Insights"] = {"kpi": kpi_cfg}
    except Exception:
        pass

    user_obj = {
        "email": LOGIN_EMAIL,
        "name": "Admin",
        "role": "admin",
        "dbName": target_db,
        "dbId": real_db_id,
        "companyId": real_company_id,
        "dbLogoUrl": real_logo_url,
        "tabPermissions": tab_perms,
    }

    # Open base url to allow setting sessionStorage on the dashboard domain
    driver.get(FRONTEND_URL)
    time.sleep(0.1)

    driver.execute_script(
        """
        delete window.__insightsData;
        sessionStorage.setItem("isLoggedIn", "true");
        sessionStorage.setItem("token", arguments[0]);
        sessionStorage.setItem("user", arguments[1]);
        sessionStorage.setItem("workspaceSelected", "true");
        sessionStorage.setItem("activeWorkspaceDb", arguments[2]);
        localStorage.setItem("activeWorkspaceDb", arguments[2]);
        if (arguments[3]) {
            localStorage.setItem("companyId", arguments[3]);
            localStorage.setItem("company_id", arguments[3]);
        }
        localStorage.setItem("companyName", arguments[2]);
        localStorage.setItem("insights_tour_v9", "true");
        localStorage.setItem("insights_dd_tour_v7", "true");
        """,
        token,
        json.dumps(user_obj),
        target_db,
        real_company_id,
    )

    driver.get(target_url)
    try:
        driver.execute_script('''
            localStorage.setItem("insights_tour_v9", "true");
            localStorage.setItem("insights_dd_tour_v7", "true");
        ''')
    except Exception:
        pass

    wait_for_loading_complete(driver, timeout=4.0)
    if on_live_step:
        on_live_step(f"Authenticated session for {target_db.capitalize()} on {target_url}...")





def apply_dashboard_channel(driver: webdriver.Chrome, channel_name: str) -> Tuple[bool, Optional[str]]:

    """

    Dynamically switches the Channel dropdown in the dashboard header to match target channel_name

    (e.g. 'quickcomm', 'ecommerce'). Ensures platform carousel has the right platforms available.

    """

    if not channel_name or str(channel_name).lower() in ("all", "none"):

        return True, None



    ch_norm = str(channel_name).lower().strip()

    is_qc = "quick" in ch_norm or "qcomm" in ch_norm

    is_ecom = "ecom" in ch_norm



    try:

        # Step 1: Check if already selected or click the trigger

        trigger_res = driver.execute_script("""

            const isQc = arguments[0];

            const isEcom = arguments[1];

            const rawTarget = arguments[2];



            // Find typography element containing "CHANNEL"

            const allEls = Array.from(document.querySelectorAll("p, span, div, h6"));

            const channelHeader = allEls.find(el => 

                el.innerText && el.innerText.trim().toUpperCase() === "CHANNEL" && el.children.length === 0

            );

            if (!channelHeader) return { success: false, reason: "CHANNEL label not found in header" };



            const container = channelHeader.parentElement;

            if (!container) return { success: false, reason: "CHANNEL container not found" };



            // Check current display value

            const currentVal = (container.innerText || "").toLowerCase();

            const alreadyQc = isQc && (currentVal.includes("quick") || currentVal.includes("qcomm"));

            const alreadyEcom = isEcom && (currentVal.includes("ecommerce") || currentVal.includes("ecom"));

            if (alreadyQc || alreadyEcom) {

                return { success: true, alreadySelected: true };

            }



            // Find trigger box to open dropdown

            const trigger = container.querySelector("div[style*='cursor: pointer'], div[class*='cursor-pointer']") 

                || container.children[1] 

                || container;

            trigger.click();

            return { success: true, opened: true };

        """, is_qc, is_ecom, ch_norm)



        if not trigger_res or not trigger_res.get("success"):

            return False, trigger_res.get("reason", "Could not trigger CHANNEL dropdown")



        if trigger_res.get("alreadySelected"):

            return True, None



        time.sleep(0.6)



        # Step 2: In the open Popover, select the target channel

        select_res = driver.execute_script("""

            const isQc = arguments[0];

            const isEcom = arguments[1];

            const rawTarget = arguments[2];



            // Look inside all popover containers

            const popovers = Array.from(document.querySelectorAll(".MuiPopover-root, .MuiPaper-root, div[role='presentation']"));

            for (const pop of popovers) {

                const options = Array.from(pop.querySelectorAll("div, p, span")).filter(el => {

                    const txt = (el.innerText || "").trim().toLowerCase();

                    if (!txt || txt === "select all") return false;

                    if (isQc && (txt.includes("quick") || txt.includes("qcomm"))) return true;

                    if (isEcom && (txt.includes("ecommerce") || txt.includes("ecom"))) return true;

                    return txt.includes(rawTarget);

                });



                if (options.length > 0) {

                    const clickable = options[0].closest("div[class*='cursor-pointer'], div[style*='cursor: pointer']") || options[0];

                    clickable.click();

                    return { success: true };

                }

            }

            return { success: false, reason: "Target channel option not found in Popover" };

        """, is_qc, is_ecom, ch_norm)



        # Step 3: Close popover if backdrop is present

        try:

            driver.execute_script("""

                const backdrop = document.querySelector(".MuiBackdrop-root");

                if (backdrop) backdrop.click();

                else document.body.click();

            """)

        except Exception:

            pass



        time.sleep(1.0)

        wait_for_loading_complete(driver, timeout=15)

        return True, None

    except Exception as e:

        return False, f"Error switching channel: {str(e)}"





def apply_segment_platform(driver: webdriver.Chrome, segment: str):
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
    driver.execute_script('''
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
    ''', seg)

    # Step 2: Reactive wait loop - wait for FilterContext.platform to reflect the target platform
    target_clean = seg.replace(" ", "").replace("_", "").replace("-", "")
    start_wait = time.time()
    while time.time() - start_wait < 8:
        curr = driver.execute_script('''
            const fc = window.__filterContext;
            const pd = window.__pricingData;
            return {
                fcPlat: fc ? (fc.platform || '') : '',
                pdPlat: pd ? (pd.platform || '') : ''
            };
        ''')
        fc_p = str(curr.get("fcPlat") or "").lower().replace(" ", "").replace("_", "").replace("-", "")
        pd_p = str(curr.get("pdPlat") or "").lower().replace(" ", "").replace("_", "").replace("-", "")
        if target_clean in fc_p or target_clean in pd_p or fc_p in target_clean:
            break
        time.sleep(0.2)

    # Step 3: Wait for spinners/skeletons to resolve
    time.sleep(0.25)
    wait_for_loading_complete(driver, timeout=20)
    return True, None

def apply_dashboard_period(driver: webdriver.Chrome, period: Any):

    """

    Sets the time period on the dashboard using the real DateRangeComparePicker component

    and React FilterContext state dispatch.

    """

    if not isinstance(period, dict):

        return



    start_date = period.get("startDate") or period.get("start") or period.get("start_date")

    end_date = period.get("endDate") or period.get("end") or period.get("end_date")

    if not start_date or not end_date:

        return



    start_str = str(start_date)[:10]

    end_str = str(end_date)[:10]



    try:
        # 1. Direct state application through FilterContext or DateRangeComparePicker Fiber
        applied = driver.execute_script("""
            const startVal = arguments[0];
            const endVal = arguments[1];

            function toDayjs(base, dateStr) {
                if (window.dayjs) {
                    try { return window.dayjs(dateStr); } catch(e) {}
                }
                if (base && typeof base.clone === 'function') {
                    try {
                        const parts = dateStr.split('-').map(Number);
                        return base.clone().year(parts[0]).month(parts[1] - 1).date(parts[2]).startOf('day');
                    } catch(e) {}
                }
                return null;
            }

            // A. Check window.__filterContext directly (instantaneous React state dispatch)
            const fc = window.__filterContext;
            if (fc && typeof fc.setTimeStart === 'function' && typeof fc.setTimeEnd === 'function') {
                const s = toDayjs(fc.timeStart, startVal);
                const e = toDayjs(fc.timeEnd || fc.timeStart, endVal);
                if (s && e) {
                    const len = e.diff(s, 'day') + 1;
                    const ce = s.subtract(1, 'day');
                    const cs = ce.subtract(len - 1, 'day');
                    fc.setTimeStart(s);
                    fc.setTimeEnd(e);
                    if (typeof fc.setCompareStart === 'function') fc.setCompareStart(cs);
                    if (typeof fc.setCompareEnd === 'function') fc.setCompareEnd(ce);
                    if (typeof fc.setUserSetDate === 'function') fc.setUserSetDate(true);
                    return { success: true, method: 'filterContext' };
                }
            }

            // B. React Fiber on DateRangeComparePicker button
            const allBtns = Array.from(document.querySelectorAll('button'));
            const dateBtn = allBtns.find(b => b.innerText && b.innerText.includes('-') && (b.innerText.includes('202') || b.innerText.includes('201') || b.innerText.includes('203')));
            if (dateBtn) {
                const key = Object.keys(dateBtn).find(k => k.startsWith('__reactFiber$'));
                let fiber = dateBtn[key];
                while (fiber) {
                    if (fiber.memoizedProps && typeof fiber.memoizedProps.onApply === 'function') {
                        const base = fiber.memoizedProps.timeStart || (window.__filterContext && window.__filterContext.timeStart);
                        const s = toDayjs(base, startVal);
                        const e = toDayjs(base, endVal);
                        if (s && e) {
                            const len = e.diff(s, 'day') + 1;
                            const ce = s.subtract(1, 'day');
                            const cs = ce.subtract(len - 1, 'day');
                            fiber.memoizedProps.onApply(s, e, cs, ce, true, "Custom");
                            return { success: true, method: 'fiber' };
                        }
                    }
                    fiber = fiber.return;
                }
            }

            return { success: false, reason: 'Fiber onApply and filterContext not found' };
        """, start_str, end_str)

        if applied and applied.get("success"):
            time.sleep(0.1)
            wait_for_loading_complete(driver, timeout=2.5)
            return

        # 2. Visual Popover Interaction fallback
        try:
            wait = WebDriverWait(driver, 1.5)
            date_btn = wait.until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//button[contains(., '-') and (.//p or .//span or contains(@class, 'flex'))]")
                )
            )
            date_btn.click()
            time.sleep(0.1)

            driver.execute_script("""
                const startVal = arguments[0];
                const endVal = arguments[1];
                const inputs = Array.from(document.querySelectorAll(".MuiPopover-root input[type='date'], input[type='date']"));
                if (inputs.length >= 2) {
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                    if (setter) {
                        setter.call(inputs[0], startVal);
                        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                        inputs[0].dispatchEvent(new Event('change', { bubbles: true }));

                        setter.call(inputs[1], endVal);
                        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
                        inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }

                // Close Popover cleanly
                const popover = document.querySelector(".MuiPopover-root");
                if (popover) {
                    const btns = Array.from(popover.querySelectorAll("button"));
                    const applyBtn = btns.find(b => b.innerText && b.innerText.trim().toLowerCase() === "apply");
                    const cancelBtn = btns.find(b => b.innerText && b.innerText.trim().toLowerCase() === "cancel");
                    if (applyBtn) {
                        applyBtn.click();
                    } else if (cancelBtn) {
                        cancelBtn.click();
                    }
                }
            """, start_str, end_str)
        except Exception:
            pass

        time.sleep(0.2)
        wait_for_loading_complete(driver, timeout=2.5)
    except Exception as e:
        print(f"[apply_dashboard_period] Error setting date range: {e}")





def read_pricing_overview(driver: webdriver.Chrome, headless: bool = False, target_platform: str = 'all') -> Dict[str, Optional[str]]:
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
        scraped = driver.execute_script('''
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
        ''', target_platform) or {}

        is_loading = scraped.get("loading", False)
        disc = scraped.get("discount")
        asp = scraped.get("asp")

        if not is_loading and (disc is not None or asp is not None):
            results = {
                "discount": disc,
                "weighted_discount": scraped.get("weighted_discount"),
                "asp": asp,
            }
            break
        time.sleep(0.4)

    if not headless:
        try:
            driver.execute_script('''
                const headers = Array.from(document.querySelectorAll("h3, p, span")).filter(el => {
                    const t = (el.innerText || '').trim().toLowerCase();
                    return t === "discount" || t === "weighted discount" || t === "average selling price" || t === "asp";
                });
                for (const h of headers) {
                    const card = h.closest("div.rounded-2xl, div[class*='rounded-2xl'], .MuiCard-root");
                    if (card) {
                        card.style.outline = "3px solid #10b981";
                        card.style.outlineOffset = "4px";
                    }
                }
            ''')
            time.sleep(0.3)
        except Exception:
            pass

    return results

def read_insights(driver: webdriver.Chrome, headless: bool = False) -> Dict[str, Optional[str]]:

    """

    Extracts the 4 tab counts from the Insights section:

      - Price Drop (my SKUs)

      - Price Increase (my SKUs)

      - Price Drop (comp. SKUs)

      - Price Increase (comp. SKUs)

    """

    if not headless:

        show_live_step_banner(driver, "🔍 DS Tester: Locating & Inspecting Insights (Drop / Hike SKUs)...")



    # Scroll to Insights section

    driver.execute_script("document.querySelector('button:has(.rounded-full)')?.scrollIntoView({behavior: 'smooth', block: 'center'});")

    if not headless:

        time.sleep(0.1)

    else:

        time.sleep(0.05)



    results: Dict[str, Optional[str]] = {

        "my_skus_drop": None,

        "my_skus_hike": None,

        "comp_skus_drop": None,

        "comp_skus_hike": None,

    }



    try:

        buttons = driver.find_elements(

            By.XPATH,

            "//button[contains(., 'Price Drop') or contains(., 'Price Increase')]"

        )

        for btn in buttons:

            txt = btn.text.strip()

            if not headless:

                driver.execute_script("arguments[0].style.outline = '2px solid #eab308';", btn)



            # Badge count is typically the last number in the button

            parts = txt.split()

            count_val = "0"

            for p in reversed(parts):

                if p.isdigit():

                    count_val = p

                    break



            if "Price Drop" in txt and "my" in txt.lower():

                results["my_skus_drop"] = count_val

            elif "Price Increase" in txt and "my" in txt.lower():

                results["my_skus_hike"] = count_val

            elif "Price Drop" in txt and "comp" in txt.lower():

                results["comp_skus_drop"] = count_val

            elif "Price Increase" in txt and "comp" in txt.lower():

                results["comp_skus_hike"] = count_val



        if not headless:

            time.sleep(0.1)

    except Exception:

        pass



    return results





def read_platform_overview(driver: webdriver.Chrome, headless: bool = False) -> Dict[str, Optional[str]]:

    """

    Extracts platform row values from the Platform Overview section (LatestOverivewCatCity).

    Scrapes the actual KPI values from div.tabular-nums based on button title attributes.

    """

    if not headless:

        show_live_step_banner(driver, "🔍 DS Tester: Locating & Inspecting Platform Overview Table...")



    driver.execute_script(

        "document.querySelectorAll('div').forEach(el => { if (el.innerText && el.innerText.includes('Overview') && el.innerText.includes('KPIs')) el.scrollIntoView({behavior: 'smooth', block: 'center'}); });"

    )

    if not headless:

        time.sleep(0.1)

    else:

        time.sleep(0.05)



    results: Dict[str, Optional[str]] = {}

    try:

        extracted = driver.execute_script("""

            const results = {};

            const rows = Array.from(document.querySelectorAll("div.space-y-1 > div, div.group"));

            for (const r of rows) {

                const nameEl = r.querySelector("span[class*='capitalize'], div.w-56 span");

                if (!nameEl) continue;

                const platName = (nameEl.innerText || nameEl.getAttribute('title') || '').trim().toLowerCase();

                if (!platName || platName.length > 25) continue;



                r.style.outline = '2px solid #6366f1';

                const keyP = platName.replace(/[\\s-]+/g, '_');

                const buttons = Array.from(r.querySelectorAll("button"));

                for (const btn of buttons) {

                    const title = (btn.getAttribute('title') || '').toLowerCase();

                    const valEl = btn.querySelector("div.tabular-nums, div[class*='tabular-nums']");

                    const val = valEl ? valEl.innerText.trim() : '';

                    if (!val || val === '-' || val === 'N/A') continue;



                    if (title.includes('discount') && !results[keyP + '_discount']) {

                        results[keyP + '_discount'] = val;

                    } else if ((title.includes('selling price') || title.includes('asp')) && !title.includes('unit') && !results[keyP + '_asp']) {

                        results[keyP + '_asp'] = val;

                    }

                }

            }

            return results;

        """)

        if isinstance(extracted, dict):

            for k, v in extracted.items():

                if v:

                    results[k] = str(v).strip()



        if not headless:

            time.sleep(0.1)

    except Exception:

        pass



    return results





