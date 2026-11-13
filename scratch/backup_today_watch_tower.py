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

WATCHTOWER_KPIS = [
    {
        "key": "offtake",
        "label": "Total Offtake / Sales",
        "unit": "₹",
        "decimals": 0,
        "abs_tol": 200000.0,
        "rel_tol": 0.015,
    },
    {
        "key": "osa",
        "label": "OSA (Stock Availability)",
        "unit": "%",
        "decimals": 2,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "sos",
        "label": "Share of Search",
        "unit": "%",
        "decimals": 2,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
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
        "key": "discount",
        "label": "Discount / Promo Depth",
        "unit": "%",
        "decimals": 2,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
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


def get_platforms_for_client(client: Optional[str] = "mars") -> List[str]:
    """Dynamically queries platforms from /api/watchtower/platforms or rca_sku_dim."""
    db_name = client or "mars"
    try:
        data = call_platform_api("/api/watchtower/platforms", db_name=db_name)
        if isinstance(data, list) and data:
            valid = [str(p).strip() for p in data if p and str(p).lower() != "all"]
            if valid:
                return valid
    except Exception:
        pass

    try:
        query = f"SELECT DISTINCT lower(platform) FROM {db_name}.rca_sku_dim WHERE isNotNull(platform) AND platform != '' ORDER BY lower(platform)"
        rows = execute_select_query(query, database=db_name)
        if rows:
            return [str(r[0]).strip() for r in rows if r and r[0]]
    except Exception:
        pass

    return []


def get_segments(client: Optional[str] = "mars") -> List[Dict[str, Any]]:
    """Returns dynamic list of Watch Tower segments (All Platforms + each available platform)."""
    platforms = get_platforms_for_client(client)
    segs = [
        {
            "id": "watchtower_overview",
            "label": "Business Overview (All Platforms)",
            "section": "overview",
            "platform": "all",
        }
    ]

    for p in platforms:
        p_clean = p.strip().lower()
        if not p_clean:
            continue
        p_label = format_platform_label(p)
        segs.append({
            "id": f"watchtower_overview_{p_clean.replace(' ', '_').replace('-', '_')}",
            "label": f"Business Overview ({p_label})",
            "section": "overview",
            "platform": p_clean,
        })

    return segs


def _get_segment_info(segment_id: str, client: Optional[str] = None) -> Dict[str, Any]:
    seg_clean = segment_id.lower().strip()
    if seg_clean in ("watchtower_overview", "business overview (all platforms)", "all"):
        return {
            "id": "watchtower_overview",
            "label": "Business Overview (All Platforms)",
            "section": "overview",
            "platform": "all",
        }
    if seg_clean.startswith("watchtower_overview_"):
        plat = seg_clean.replace("watchtower_overview_", "").replace("_", " ").strip()
        return {
            "id": seg_clean,
            "label": f"Business Overview ({format_platform_label(plat)})",
            "section": "overview",
            "platform": plat,
        }
    return {
        "id": "watchtower_overview",
        "label": "Business Overview (All Platforms)",
        "section": "overview",
        "platform": "all",
    }


def parse_kpi_value(raw: Any) -> Optional[float]:
    """Extracts numeric float from strings like '₹14.70 Cr', '77.90%', '12.41', etc."""
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
    """Step 1 (API): Calls /api/watchtower/overview and parses topMetrics."""
    info = _get_segment_info(segment, client=client)
    plat = info.get("platform")
    db_name = client or "mars"

    params: Dict[str, Any] = {}
    if plat and plat != "all":
        params["platform"] = plat

    data = call_platform_api(
        endpoint="/api/watchtower/overview",
        params=params,
        period=period,
        db_name=db_name,
    )

    results: Dict[str, Optional[float]] = {
        "offtake": None,
        "osa": None,
        "sos": None,
        "market_share": None,
        "discount": None,
    }

    if not isinstance(data, dict):
        return results

    top_metrics = data.get("topMetrics", [])
    for m in top_metrics:
        if not isinstance(m, dict):
            continue
        name = str(m.get("name") or "").strip().lower()
        label = m.get("label")

        if name in ("offtake", "offtakes"):
            results["offtake"] = parse_kpi_value(label)
        elif name in ("osa", "availability", "stock availability"):
            results["osa"] = parse_kpi_value(label)
        elif name in ("share of search", "sos"):
            results["sos"] = parse_kpi_value(label)
        elif name in ("market share",):
            results["market_share"] = parse_kpi_value(label)
        elif name in ("discount", "promo"):
            results["discount"] = parse_kpi_value(label)

    return results


def step2_logic(segment: str, period: Any, client: Optional[str] = "mars") -> Dict[str, Optional[float]]:
    """Step 2 (Logic / ClickHouse): Computes dynamic KPI calculations from ClickHouse."""
    info = _get_segment_info(segment, client=client)
    plat = info.get("platform")
    db_name = client or "mars"

    start_date, end_date = period_to_date_range(period)

    # 1. Get our brand list from rca_sku_dim
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

    plat_cond_pdp = ""
    plat_cond_kw = ""
    plat_cond_ms = ""
    if plat and plat != "all":
        p_clean = plat.lower().strip()
        plat_cond_pdp = f"AND lower(Platform) = '{p_clean}'"
        plat_cond_kw = f"AND lower(platform) = '{p_clean}'"
        plat_cond_ms = f"AND lower(platform) LIKE '%{p_clean}%'"

    results: Dict[str, Optional[float]] = {
        "offtake": None,
        "osa": None,
        "sos": None,
        "market_share": None,
        "discount": None,
    }

    # Offtake (Sales in ₹)
    try:
        q_sales = f"""
            SELECT SUM(toFloat64OrZero(toString(Sales))) as total_sales
            FROM {db_name}.rb_pdp_olap
            WHERE toDate(DATE) >= '{start_date}' AND toDate(DATE) <= '{end_date}'
              AND (toString(Comp_flag) = '0' OR Comp_flag = 0)
              {plat_cond_pdp}
        """
        rows = execute_select_query(q_sales, database=db_name)
        if rows and rows[0] and rows[0][0] is not None:
            results["offtake"] = round(float(rows[0][0]), 2)
    except Exception as e:
        print(f"[WatchTower Step 2] Error querying offtake: {e}")

    # OSA (%)
    try:
        q_osa = f"""
            SELECT SUM(toFloat64OrZero(toString(neno_osa))) / NULLIF(SUM(toFloat64OrZero(toString(deno_osa))), 0) * 100 as osa_pct
            FROM {db_name}.rb_pdp_olap
            WHERE toDate(DATE) >= '{start_date}' AND toDate(DATE) <= '{end_date}'
              AND (toString(Comp_flag) = '0' OR Comp_flag = 0)
              {plat_cond_pdp}
        """
        rows = execute_select_query(q_osa, database=db_name)
        if rows and rows[0] and rows[0][0] is not None:
            results["osa"] = round(float(rows[0][0]), 2)
    except Exception as e:
        print(f"[WatchTower Step 2] Error querying OSA: {e}")

    # Discount / Promo Depth (%)
    try:
        q_disc = f"""
            SELECT (SUM(toFloat64OrZero(toString(MRP))) - SUM(toFloat64OrZero(toString(Selling_Price)))) / NULLIF(SUM(toFloat64OrZero(toString(MRP))), 0) * 100 as promo_pct
            FROM {db_name}.rb_pdp_olap
            WHERE toDate(DATE) >= '{start_date}' AND toDate(DATE) <= '{end_date}'
              AND (toString(Comp_flag) = '0' OR Comp_flag = 0)
              AND neno_osa > 0
              {plat_cond_pdp}
        """
        rows = execute_select_query(q_disc, database=db_name)
        if rows and rows[0] and rows[0][0] is not None:
            results["discount"] = round(float(rows[0][0]), 2)
    except Exception as e:
        print(f"[WatchTower Step 2] Error querying Discount: {e}")

    # Share of Search (%)
    try:
        q_sos = f"""
            SELECT 
                SUM(if(lower(brand) IN ({brands_sql}) AND toInt32OrZero(toString(POSITION)) <= 10, toInt32OrZero(toString(overall)), 0)) / 
                NULLIF(SUM(if(toInt32OrZero(toString(POSITION)) <= 10, toInt32OrZero(toString(overall)), 0)), 0) * 100 as sos_pct
            FROM {db_name}.rb_kw_olap
            WHERE toDate(DATE) >= '{start_date}' AND toDate(DATE) <= '{end_date}'
              {plat_cond_kw}
        """
        rows = execute_select_query(q_sos, database=db_name)
        if rows and rows[0] and rows[0][0] is not None:
            results["sos"] = round(float(rows[0][0]), 2)
    except Exception as e:
        print(f"[WatchTower Step 2] Error querying SOS: {e}")

    # Market Share (%)
    try:
        q_ms = f"""
            SELECT 
                SUM(IF(coalesce(nullIf(lower(brand), ''), lower(group_brand)) IN ({brands_sql}), toFloat64OrZero(toString(sales)), 0)) / 
                NULLIF(SUM(toFloat64OrZero(toString(sales))), 0) * 100 as ms_pct
            FROM {db_name}.rb_ms_olap
            WHERE toDate(created_on) >= '{start_date}' AND toDate(created_on) <= '{end_date}'
              {plat_cond_ms}
        """
        rows = execute_select_query(q_ms, database=db_name)
        if rows and rows[0] and rows[0][0] is not None:
            results["market_share"] = round(float(rows[0][0]), 2)
    except Exception as e:
        print(f"[WatchTower Step 2] Error querying Market Share: {e}")

    return results


def step3_ui(
    driver: Any,
    segment: str,
    period: Any,
    client: Optional[str] = "mars",
    headless: bool = False,
    on_live_step: Optional[Any] = None,
) -> Dict[str, Optional[str]]:
    """Step 3 (Selenium): Navigates to /watch-tower and scrapes the top metric cards."""
    info = _get_segment_info(segment, client=client)
    plat = info.get("platform")
    db_name = client or "mars"

    def report_step(text: str):
        if on_live_step:
            on_live_step(text)
        if not headless and driver:
            show_live_step_banner(driver, text)

    target_url = f"{FRONTEND_URL}/watch-tower"
    report_step("🌐 Opening Business Overview (Watch Tower)...")
    ensure_authenticated(driver, target_url, client=db_name)
    wait_for_loading_complete(driver, timeout=25)
    if not headless:
        bring_chrome_to_top(driver)

    if plat and plat != "all":
        report_step(f"🔍 Applying Platform: {format_platform_label(plat)}...")
        apply_segment_platform(driver, plat)

    report_step("📅 Setting Dashboard Date Range...")
    apply_dashboard_period(driver, period)

    wait_for_loading_complete(driver, timeout=20)
    time.sleep(2.0)

    report_step("📊 Scraping Top Metrics from Snapshot Overview...")
    results: Dict[str, Optional[str]] = {
        "offtake": None,
        "osa": None,
        "sos": None,
        "market_share": None,
        "discount": None,
    }

    try:
        from selenium.webdriver.common.by import By

        # 1. Scrape from ComparisonCard (.MuiCard-root) and container divs
        cards = driver.find_elements(By.CSS_SELECTOR, ".MuiCard-root, div.group.relative")
        for c in cards:
            try:
                lines = [l.strip() for l in c.text.split("\n") if l.strip()]
                if len(lines) < 2:
                    continue

                card_title = ""
                for l in lines:
                    ll = l.lower()
                    if any(k in ll for k in ("offtake", "osa", "share of search", "sos", "market share", "discount", "promo")):
                        card_title = ll
                        break

                if not card_title:
                    continue

                # Value line: contains numbers, does not start with delta indicators (+/-, ▲/▼), not title line
                val_candidates = [
                    l for l in lines
                    if not l.startswith(("+", "-", "▲", "▼"))
                    and l.lower() != card_title
                    and any(ch.isdigit() for ch in l)
                ]
                if not val_candidates:
                    continue
                card_val = val_candidates[0]

                if not headless:
                    highlight_element(driver, c, color="#2563eb", duration_sec=0.5)

                if "offtake" in card_title and not results["offtake"]:
                    results["offtake"] = card_val
                elif ("osa" in card_title or "availability" in card_title) and not results["osa"]:
                    results["osa"] = card_val
                elif ("search" in card_title or "sos" in card_title) and not results["sos"]:
                    results["sos"] = card_val
                elif "market" in card_title and not results["market_share"]:
                    results["market_share"] = card_val
                elif ("discount" in card_title or "promo" in card_title) and not results["discount"]:
                    results["discount"] = card_val
            except Exception:
                continue
    except Exception as e:
        print(f"[WatchTower Step 3] Error scraping cards: {e}")

    report_step("✅ Completed Business Overview live inspection.")
    return results


class WatchTowerModule:
    name = "watch_tower"
    segments = [
        {
            "id": "watchtower_overview",
            "label": "Business Overview (All Platforms)",
            "section": "overview",
            "platform": "all",
        }
    ]
    kpis = WATCHTOWER_KPIS

    @staticmethod
    def get_segments(client: Optional[str] = "mars") -> List[Dict[str, Any]]:
        return get_segments(client)

    @staticmethod
    def get_kpis(segment: str, client: Optional[str] = "mars") -> List[Dict[str, Any]]:
        return WATCHTOWER_KPIS

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
