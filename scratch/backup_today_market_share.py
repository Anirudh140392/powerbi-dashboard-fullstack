import os
import time
import re
from datetime import datetime
from typing import Dict, Any, List, Optional

from ..step1_api import call_platform_api
from ..step2_logic import execute_select_query, period_to_date_range, resolve_table_column
from ..step3_selenium import (
    FRONTEND_URL,
    ensure_authenticated,
    apply_dashboard_period,
    apply_segment_platform,
    wait_for_loading_complete,
    bring_chrome_to_top,
    show_live_step_banner,
    highlight_element,
)

MARKET_SHARE_KPIS = [
    {
        "key": "brand_sales",
        "label": "Brand Estimated Sales",
        "unit": "₹",
        "decimals": 0,
        "abs_tol": 200000.0,
        "rel_tol": 0.015,
    },
    {
        "key": "market_share",
        "label": "Market Share",
        "unit": "%",
        "decimals": 2,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "category_size",
        "label": "Category Size",
        "unit": "₹",
        "decimals": 0,
        "abs_tol": 2000000.0,
        "rel_tol": 0.015,
    },
]


def format_platform_label(plat: str) -> str:
    words = plat.replace("_", " ").split()
    capitalized = []
    for w in words:
        wl = w.lower()
        if wl in ("1mg", "1_mg"):
            capitalized.append("1mg")
        elif wl in ("247", "24/7"):
            capitalized.append("247")
        elif wl == "bigbasket":
            capitalized.append("BigBasket")
        elif wl == "bbnow":
            capitalized.append("BBNow")
        else:
            capitalized.append(w.capitalize())
    return " ".join(capitalized)


def has_market_share_table(client: Optional[str]) -> bool:
    """Checks if client database has rb_ms_olap table."""
    db_name = client or "mars"
    try:
        rows = execute_select_query(
            f"SELECT name FROM system.tables WHERE database = '{db_name}' AND name = 'rb_ms_olap'",
            database=db_name
        )
        return bool(rows)
    except Exception:
        return db_name == "mars"


def get_platforms_for_client(client: Optional[str] = "mars") -> List[str]:
    """Dynamically queries distinct platforms from rb_ms_olap."""
    db_name = client or "mars"
    try:
        query = f"SELECT DISTINCT lower(platform) FROM {db_name}.rb_ms_olap WHERE isNotNull(platform) AND platform != '' ORDER BY lower(platform)"
        rows = execute_select_query(query, database=db_name)
        if rows:
            return [str(r[0]).strip() for r in rows if r and r[0]]
    except Exception:
        pass

    return []


def get_segments(client: Optional[str] = "mars") -> List[Dict[str, Any]]:
    """Returns dynamic list of Market Share segments."""
    if not has_market_share_table(client):
        return []

    platforms = get_platforms_for_client(client)
    if not platforms:
        platforms = ["blinkit"]

    default_plat = platforms[0].strip().lower()
    default_label = format_platform_label(default_plat)

    segs = [
        {
            "id": "market_share_overview",
            "label": f"Market Share Overview ({default_label})",
            "section": "overview",
            "platform": default_plat,
        }
    ]

    for p in platforms:
        p_clean = p.strip().lower()
        if not p_clean:
            continue
        p_label = format_platform_label(p)
        segs.append({
            "id": f"market_share_overview_{p_clean.replace(' ', '_').replace('-', '_')}",
            "label": f"Market Share ({p_label})",
            "section": "overview",
            "platform": p_clean,
        })

    return segs


def _get_segment_info(segment_id: str, client: Optional[str] = None) -> Dict[str, Any]:
    platforms = get_platforms_for_client(client)
    default_plat = platforms[0].strip().lower() if platforms else "blinkit"
    default_label = format_platform_label(default_plat)

    seg_clean = segment_id.lower().strip()
    if seg_clean in ("market_share_overview", "market_share", "market share", "all"):
        return {
            "id": "market_share_overview",
            "label": f"Market Share Overview ({default_label})",
            "section": "overview",
            "platform": default_plat,
        }
    if seg_clean.startswith("market_share_overview_"):
        plat = seg_clean.replace("market_share_overview_", "").replace("_", " ").strip()
        return {
            "id": seg_clean,
            "label": f"Market Share ({format_platform_label(plat)})",
            "section": "overview",
            "platform": plat,
        }
    return {
        "id": "market_share_overview",
        "label": f"Market Share Overview ({default_label})",
        "section": "overview",
        "platform": default_plat,
    }


def parse_kpi_value(raw: Any) -> Optional[float]:
    """Extracts numeric float from strings like '₹ 14.70 Cr', '5.44%', etc."""
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    s = str(raw).strip().replace(",", "")
    if not s or s.lower() in ("n/a", "null", "none", "-"):
        return None

    is_cr = "cr" in s.lower()
    is_lac = "l" in s.lower() or "lac" in s.lower()
    is_k = "k" in s.lower()

    m = re.search(r"[-+]?\d*\.?\d+", s)
    if not m:
        return None
    val = float(m.group(0))
    if is_cr:
        return val * 10_000_000.0
    if is_lac:
        return val * 100_000.0
    if is_k:
        return val * 1000.0
    return val


def step1_fetch(segment: str, period: Any, client: Optional[str] = "mars") -> Dict[str, Optional[float]]:
    """Step 1 (API): Calls /api/market-share and parses KPIs."""
    info = _get_segment_info(segment, client=client)
    plat = info.get("platform")
    db_name = client or "mars"

    params: Dict[str, Any] = {}
    if plat and plat != "all":
        params["platform"] = plat

    data = call_platform_api(
        endpoint="/api/market-share",
        params=params,
        period=period,
        db_name=db_name,
    )

    results: Dict[str, Optional[float]] = {
        "brand_sales": None,
        "market_share": None,
        "category_size": None,
    }

    if not isinstance(data, dict):
        return results

    # 1. Brand Estimated Sales (raw rupees)
    mars_data = data.get("marsWrigley") or data.get("brandSales") or {}
    if isinstance(mars_data, dict) and "sales" in mars_data:
        raw_s = mars_data.get("sales")
        if raw_s is not None:
            results["brand_sales"] = float(raw_s)

    # 2. Market Share %
    ms_data = data.get("marketShare") or {}
    if isinstance(ms_data, dict) and "share" in ms_data:
        raw_ms = ms_data.get("share")
        if raw_ms is not None:
            results["market_share"] = round(float(raw_ms), 2)

    # 3. Category Size (raw rupees)
    cat_data = data.get("categorySize") or {}
    if isinstance(cat_data, dict) and "size" in cat_data:
        raw_cat = cat_data.get("size")
        if raw_cat is not None:
            results["category_size"] = float(raw_cat)

    return results


def step2_logic(segment: str, period: Any, client: Optional[str] = "mars") -> Dict[str, Optional[float]]:
    """Step 2 (Logic / ClickHouse): Computes dynamic Market Share calculations from ClickHouse."""
    info = _get_segment_info(segment, client=client)
    plat = info.get("platform")
    db_name = client or "mars"

    start_date, end_date = period_to_date_range(period)

    # Get our brand list
    our_brands: List[str] = []
    try:
        brand_rows = execute_select_query(
            f"SELECT DISTINCT brand_name FROM {db_name}.rca_sku_dim WHERE (comp_flag = 0 OR toString(comp_flag) = '0') AND brand_name IS NOT NULL AND brand_name != ''",
            database=db_name
        )
        if brand_rows:
            our_brands = [str(b[0]).lower().strip() for b in brand_rows if b and b[0]]
    except Exception:
        pass
    if not our_brands:
        our_brands = [db_name.lower()]

    brands_sql = ", ".join([f"'{b}'" for b in our_brands])

    plat_cond = ""
    if plat and plat != "all":
        p_clean = plat.lower().strip()
        plat_cond = f"AND lower(platform) LIKE '%{p_clean}%'"

    results: Dict[str, Optional[float]] = {
        "brand_sales": None,
        "market_share": None,
        "category_size": None,
    }

    try:
        date_col = resolve_table_column(db_name, "rb_ms_olap", "created_on") or "created_on"

        q_ms = f"""
            SELECT 
                SUM(toFloat64OrZero(toString(sales))) as total_sales,
                SUM(IF(coalesce(nullIf(lower(brand), ''), lower(group_brand)) IN ({brands_sql}), toFloat64OrZero(toString(sales)), 0)) as our_sales
            FROM {db_name}.rb_ms_olap
            WHERE toDate({date_col}) >= '{start_date}' AND toDate({date_col}) <= '{end_date}'
              {plat_cond}
        """
        rows = execute_select_query(q_ms, database=db_name)
        if rows and rows[0]:
            total_sales = float(rows[0][0] or 0.0)
            our_sales = float(rows[0][1] or 0.0)

            results["brand_sales"] = our_sales
            results["category_size"] = total_sales
            results["market_share"] = round((our_sales / total_sales * 100.0), 2) if total_sales > 0 else 0.0
    except Exception as e:
        print(f"[MarketShare Step 2] Error querying ClickHouse: {e}")

    return results


def step3_ui(
    driver: Any,
    segment: str,
    period: Any,
    client: Optional[str] = "mars",
    headless: bool = False,
    on_live_step: Optional[Any] = None,
) -> Dict[str, Optional[str]]:
    """Step 3 (Selenium): Navigates to /market-share and scrapes top cards."""
    info = _get_segment_info(segment, client=client)
    plat = info.get("platform")
    db_name = client or "mars"

    def report_step(text: str):
        if on_live_step:
            on_live_step(text)
        if not headless and driver:
            show_live_step_banner(driver, text)

    target_url = f"{FRONTEND_URL}/market-share"
    report_step("🌐 Opening Market Share Dashboard...")
    ensure_authenticated(driver, target_url, client=db_name)
    wait_for_loading_complete(driver, timeout=25)
    if not headless:
        bring_chrome_to_top(driver)

    if plat and plat != "all":
        report_step(f"🔍 Applying Platform: {format_platform_label(plat)}...")
        apply_segment_platform(driver, plat)
    else:
        report_step("🔍 Setting Default Platform...")
        apply_segment_platform(driver, "blinkit")

    report_step("📅 Setting Dashboard Date Range...")
    apply_dashboard_period(driver, period)

    wait_for_loading_complete(driver, timeout=20)
    time.sleep(2.0)

    report_step("📊 Scraping Market Share KPI Cards...")
    results: Dict[str, Optional[str]] = {
        "brand_sales": None,
        "market_share": None,
        "category_size": None,
    }

    try:
        from selenium.webdriver.common.by import By

        cards = driver.find_elements(By.CSS_SELECTOR, "div.group.relative, div[class*='rounded-2xl']")
        for c in cards:
            try:
                text = c.text.strip()
                if not text:
                    continue
                title_elem = c.find_element(By.TAG_NAME, "h3") if len(c.find_elements(By.TAG_NAME, "h3")) > 0 else None
                title = title_elem.text.strip().lower() if title_elem else ""

                val_elem = c.find_element(By.CSS_SELECTOR, "div.text-3xl span, div[class*='text-3xl'] span") if len(c.find_elements(By.CSS_SELECTOR, "div.text-3xl span, div[class*='text-3xl'] span")) > 0 else None
                val = val_elem.text.strip() if val_elem else ""

                if not title or not val or val == "-":
                    continue

                if not headless:
                    highlight_element(driver, c, color="#2563eb", duration_sec=0.5)

                if "estimated sales" in title or "sales" in title:
                    results["brand_sales"] = val
                elif "market share" in title:
                    results["market_share"] = val
                elif "category size" in title:
                    results["category_size"] = val
            except Exception:
                continue
    except Exception as e:
        print(f"[MarketShare Step 3] Error scraping cards: {e}")

    report_step("✅ Completed Market Share live inspection.")
    return results


class MarketShareModule:
    name = "market_share"
    segments = [
        {
            "id": "market_share_overview",
            "label": "Market Share Overview",
            "section": "overview",
            "platform": "all",
        }
    ]
    kpis = MARKET_SHARE_KPIS

    @staticmethod
    def get_segments(client: Optional[str] = "mars") -> List[Dict[str, Any]]:
        return get_segments(client)

    @staticmethod
    def get_kpis(segment: str, client: Optional[str] = "mars") -> List[Dict[str, Any]]:
        return MARKET_SHARE_KPIS

    @staticmethod
    def step1_fetch(segment: str, period: Any, client: Optional[str] = "mars") -> Dict[str, Optional[float]]:
        return step1_fetch(segment, period, client=client)

    @staticmethod
    def step2_logic(segment: str, period: Any, client: Optional[str] = "mars") -> Dict[str, Optional[float]]:
        return step2_logic(segment, period, client=client)

    @staticmethod
    def step3_ui(
        driver: Any,
        segment: str,
        period: Any,
        client: Optional[str] = "mars",
        headless: bool = False,
        on_live_step: Optional[Any] = None,
    ) -> Dict[str, Optional[str]]:
        return step3_ui(driver, segment, period, client=client, headless=headless, on_live_step=on_live_step)
