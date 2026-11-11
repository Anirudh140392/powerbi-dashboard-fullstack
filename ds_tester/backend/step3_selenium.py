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
    # Suppress verbose DevTools logging
    options.add_experimental_option("excludeSwitches", ["enable-logging"])

    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(60)

    if not headless:
        bring_chrome_to_top(driver)

    return driver


def bring_chrome_to_top(driver: webdriver.Chrome):
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


def wait_for_loading_complete(driver: webdriver.Chrome, timeout: int = 25):
    """
    Waits for any active loading spinners, progress bars, or MUI skeletons to disappear.
    """
    wait = WebDriverWait(driver, timeout)
    # Give a brief moment for any trigger to start rendering loaders
    time.sleep(0.5)

    try:
        # Wait for MUI skeletons or circular progress to be absent or hidden
        wait.until(
            EC.invisibility_of_element_located((By.CSS_SELECTOR, ".MuiSkeleton-root, .MuiCircularProgress-root"))
        )
    except TimeoutException:
        pass  # If no loading elements were present, proceed smoothly

    # Additional small settle buffer for React DOM repaint
    time.sleep(0.5)


_CLIENT_METADATA_CACHE: Dict[str, Tuple[str, str]] = {}

def get_client_metadata(client_name: str) -> Tuple[str, str]:
    """Returns (db_id, company_id) from ClickHouse admin_master.tb_database."""
    norm = (client_name or "").lower().strip()
    if norm in _CLIENT_METADATA_CACHE:
        return _CLIENT_METADATA_CACHE[norm]
    try:
        from ds_tester.backend.step2_logic import get_clickhouse_client
        ch = get_clickhouse_client('admin_master')
        rows = ch.query(f"SELECT toString(db_id), toString(company_id) FROM tb_database WHERE lower(db_name) = '{norm}' LIMIT 1").result_rows
        if rows:
            _CLIENT_METADATA_CACHE[norm] = (str(rows[0][0]), str(rows[0][1]))
            return _CLIENT_METADATA_CACHE[norm]
    except Exception:
        pass
    return ("1", "")


def ensure_authenticated(driver: webdriver.Chrome, target_url: str, client: Optional[str] = None):
    """
    Ensures the browser session is authenticated with live platform credentials,
    injecting valid session state and navigating smoothly to target_url.
    Supports targeting a specific client database (e.g. boat, pidilite, mars).
    """
    import jwt
    import json

    target_db = client or os.getenv("CLICKHOUSE_DB", "boat")
    jwt_secret = os.getenv("JWT_SECRET", "trailytics_jwt_secret_2026")
    real_db_id, real_company_id = get_client_metadata(target_db)

    token_payload = {
        "userId": "1",
        "email": LOGIN_EMAIL,
        "userName": "Admin",
        "dbName": target_db,
        "dbId": real_db_id,
        "companyId": real_company_id,
        "role": "admin",
        "qcUser": 0,
        "dbStatus": True,
    }
    token = jwt.encode(token_payload, jwt_secret, algorithm="HS256")
    user_obj = {
        "email": LOGIN_EMAIL,
        "name": "Admin",
        "role": "admin",
        "dbName": target_db,
        "dbId": real_db_id,
        "companyId": real_company_id,
        "tabPermissions": {},
    }

    # Open base url to allow setting sessionStorage on the dashboard domain
    driver.get(FRONTEND_URL)
    time.sleep(0.5)

    driver.execute_script(
        """
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
        """,
        token,
        json.dumps(user_obj),
        target_db,
        real_company_id,
    )

    driver.get(target_url)
    driver.maximize_window()
    wait_for_loading_complete(driver, timeout=25)


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
    target_name = platform_names.get(seg, seg.capitalize())

    try:
        # 1. Target the exact platform card and check if already selected or expand carousel
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
            const collapse = document.querySelector(".MuiCollapse-root");
            const isExpanded = collapse ? (collapse.offsetHeight > 10) : false;

            if (!isExpanded && card) {
                card.click();
            }
            return { cardFound: true, current: current };
        """)

        # If already selected, verify it matches target_name
        current_text = (card_info.get("current") or "").strip() if isinstance(card_info, dict) else ""
        first_line = current_text.split('\n')[0].strip().lower() if current_text else ""
        if target_name.lower() == first_line:
            return True, None

        time.sleep(0.5)

        # 2. Select matching platform from the expanded carousel
        switch_result = driver.execute_script("""
            const target = arguments[0].toLowerCase();
            const collapse = document.querySelector(".MuiCollapse-root");
            if (!collapse) return { success: false, reason: "Carousel not found" };

            const available = [];
            const imgs = Array.from(collapse.querySelectorAll("img"));
            imgs.forEach(i => {
                if (i.alt) available.push(i.alt.trim().toLowerCase());
                else if (i.src) {
                    const p = i.src.split('/');
                    available.push(p[p.length - 1].toLowerCase());
                }
            });

            const matchImg = imgs.find(i => (i.alt || '').toLowerCase().includes(target) || (i.src || '').toLowerCase().includes(target));
            if (matchImg) {
                let box = matchImg.closest(".MuiBox-root");
                (box || matchImg).click();
                return { success: true };
            }

            const textMatch = Array.from(collapse.querySelectorAll("div")).find(d => 
                d.children.length === 0 && d.innerText.trim().toLowerCase() === target
            );
            if (textMatch) {
                let box = textMatch.closest(".MuiBox-root");
                (box || textMatch).click();
                return { success: true };
            }

            return { success: false, available: available };
        """, target_name)

        if not switch_result or not switch_result.get("success"):
            avail = (switch_result.get("available") or []) if switch_result else []
            return False, f"Platform '{target_name}' is not available for this client/brand (available: {', '.join(set(avail)) or 'none'})"

        time.sleep(1.5)
        wait_for_loading_complete(driver, timeout=20)
        return True, None
    except Exception as e:
        return False, f"Failed to switch to platform '{target_name}': {str(e)}"


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
        # 1. Apply directly through DateRangeComparePicker React Fiber / FilterContext
        fiber_applied = driver.execute_script("""
            const startVal = arguments[0];
            const endVal = arguments[1];

            const allBtns = Array.from(document.querySelectorAll('button'));
            const dateBtn = allBtns.find(b => b.innerText && b.innerText.includes('-') && (b.innerText.includes('202') || b.innerText.includes('201') || b.innerText.includes('203')));
            if (!dateBtn) return { success: false, reason: 'Date button not found' };

            const key = Object.keys(dateBtn).find(k => k.startsWith('__reactFiber$'));
            let fiber = dateBtn[key];
            while (fiber) {
                if (fiber.memoizedProps && typeof fiber.memoizedProps.onApply === 'function') {
                    const makeDay = (base, dateStr) => {
                        const [y, m, d] = dateStr.split('-').map(Number);
                        return base.clone().year(y).month(m - 1).date(d).startOf('day');
                    };

                    const base = fiber.memoizedProps.timeStart;
                    if (!base || typeof base.clone !== 'function') break;

                    const s = makeDay(base, startVal);
                    const e = makeDay(base, endVal);
                    const len = e.diff(s, 'day') + 1;
                    const ce = s.subtract(1, 'day');
                    const cs = ce.subtract(len - 1, 'day');

                    fiber.memoizedProps.onApply(s, e, cs, ce, true, "Custom");
                    return { success: true };
                }
                fiber = fiber.return;
            }
            return { success: false, reason: 'Fiber onApply not found' };
        """, start_str, end_str)

        # 2. Visual Popover Interaction (for live visible Chrome demonstrations)
        try:
            wait = WebDriverWait(driver, 5)
            date_btn = wait.until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//button[contains(., '-') and (.//p or .//span or contains(@class, 'flex'))]")
                )
            )
            date_btn.click()
            time.sleep(0.4)

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

        time.sleep(2.5)
        wait_for_loading_complete(driver, timeout=25)
    except Exception as e:
        print(f"[apply_dashboard_period] Error setting date range: {e}")


def read_pricing_overview(driver: webdriver.Chrome, headless: bool = False) -> Dict[str, Optional[str]]:
    """
    Extracts the 3 KPI card values from the Pricing Overview section:
      - Discount (%)
      - Weighted Discount (%)
      - Average Selling Price (ASP) (₹)
    """
    if not headless:
        show_live_step_banner(driver, "🔍 DS Tester: Locating & Verifying Pricing Overview KPI Cards...")

    driver.execute_script("window.scrollTo({top: 0, behavior: 'smooth'});")
    time.sleep(1.0)

    # Scrape via precision DOM query targeting headline metric cards
    scraped = driver.execute_script("""
        const headers = Array.from(document.querySelectorAll("h3, p, span, div")).filter(el => {
            if (el.children.length > 0) return false;
            const t = (el.innerText || "").trim().toLowerCase();
            return t === "discount" || t === "weighted discount" || t === "average selling price" || t === "asp";
        });
        const out = { discount: null, weighted_discount: null, asp: null };
        for (const h of headers) {
            const card = h.closest("div.rounded-2xl, div[class*='rounded-2xl'], .MuiCard-root");
            if (!card) continue;
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
    """) or {}

    results: Dict[str, Optional[str]] = {
        "discount": scraped.get("discount"),
        "weighted_discount": scraped.get("weighted_discount"),
        "asp": scraped.get("asp"),
    }

    if not headless:
        try:
            driver.execute_script("""
                const headers = Array.from(document.querySelectorAll("h3, p, span")).filter(el => {
                    const t = (el.innerText || '').trim().toLowerCase();
                    return t === 'discount' || t === 'weighted discount' || t === 'average selling price' || t === 'asp';
                });
                headers.forEach(h => {
                    const card = h.closest("div.rounded-2xl, div[class*='rounded-2xl'], .MuiCard-root");
                    if (card) card.style.outline = '2px solid #2563eb';
                });
            """)
            time.sleep(1.5)
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
        time.sleep(1.5)
    else:
        time.sleep(0.5)

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
            time.sleep(1.5)
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
        time.sleep(1.5)
    else:
        time.sleep(0.5)

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
            time.sleep(1.5)
    except Exception:
        pass

    return results


