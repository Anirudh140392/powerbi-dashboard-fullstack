import os
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from ..step1_api import call_platform_api
from ..step2_logic import execute_select_query, period_to_date_range, resolve_table_column
from ..step3_selenium import (
    FRONTEND_URL,
    ensure_authenticated,
    apply_dashboard_period,
    apply_segment_platform,
    wait_for_loading_complete,
    read_pricing_overview,
    read_insights,
    read_platform_overview,
)

# Column mapping for ClickHouse table rb_pdp_olap
COLS = {
    "date": "DATE",
    "mrp": "MRP",
    "selling_price": "Selling_Price",
    "discount": "Discount",
    "osa_num": "neno_osa",
    "osa_den": "deno_osa",
    "sales": "Sales",
    "ppu": "PPU",
    "comp_flag": "Comp_flag",
    "platform": "Platform",
}

# The 3 core sections of Pricing Analysis (platform-specific segments are dynamically discovered from rca_sku_dim)
CORE_SECTIONS = [
    {
        "id": "pricing_overview",
        "label": "Pricing Overview (All Platforms)",
        "section": "overview",
        "platform": "all",
    },
    {
        "id": "insights",
        "label": "Insights (Price Drop / Hike SKUs)",
        "section": "insights",
        "platform": None,
    },
    {
        "id": "platform_overview",
        "label": "Platform Overview (Dimension Table)",
        "section": "platform_overview",
        "platform": "ALL",
        "channel": "ALL",
    },
]

# KPIs per Section
KPIS_BY_SECTION = {
    "overview": [
        {
            "key": "discount",
            "label": "Discount",
            "unit": "%",
            "decimals": 1,
            "abs_tol": 0.05,
            "rel_tol": 0.005,
        },
        {
            "key": "weighted_discount",
            "label": "Weighted Discount",
            "unit": "%",
            "decimals": 1,
            "abs_tol": 0.05,
            "rel_tol": 0.005,
        },
        {
            "key": "asp",
            "label": "Average Selling Price",
            "unit": "₹",
            "decimals": 2,
            "abs_tol": 0.1,
            "rel_tol": 0.002,
        },
    ],
    "insights": [
        {
            "key": "my_skus_drop",
            "label": "Price Drop (my SKUs)",
            "unit": "",
            "decimals": 0,
            "abs_tol": 0.0,
            "rel_tol": 0.0,
        },
        {
            "key": "my_skus_hike",
            "label": "Price Increase (my SKUs)",
            "unit": "",
            "decimals": 0,
            "abs_tol": 0.0,
            "rel_tol": 0.0,
        },
        {
            "key": "comp_skus_drop",
            "label": "Price Drop (comp. SKUs)",
            "unit": "",
            "decimals": 0,
            "abs_tol": 0.0,
            "rel_tol": 0.0,
        },
        {
            "key": "comp_skus_hike",
            "label": "Price Increase (comp. SKUs)",
            "unit": "",
            "decimals": 0,
            "abs_tol": 0.0,
            "rel_tol": 0.0,
        },
    ],
}


def get_platforms_for_client(client: Optional[str] = "boat") -> List[str]:
    """
    Dynamically fetches distinct platforms from ClickHouse rca_sku_dim for this client.
    Ensures that any new platform added in the future is automatically detected and included.
    Falls back to rb_pdp_olap if rca_sku_dim is unavailable.
    """
    db_name = client or "boat"
    try:
        query = f"SELECT DISTINCT platform FROM {db_name}.rca_sku_dim WHERE platform IS NOT NULL AND platform != '' ORDER BY platform"
        rows = execute_select_query(query, database=db_name)
        platforms = [str(r[0]).strip() for r in rows if r and r[0]]
        if platforms:
            return platforms
    except Exception:
        pass

    try:
        query = f"SELECT DISTINCT Platform FROM {db_name}.rb_pdp_olap WHERE Platform IS NOT NULL AND Platform != '' ORDER BY Platform"
        rows = execute_select_query(query, database=db_name)
        platforms = [str(r[0]).strip() for r in rows if r and r[0]]
        if platforms:
            return platforms
    except Exception:
        pass

    return []


def format_platform_label(plat: str) -> str:
    """Formats platform identifier into a clean title label (e.g. 'flipkart minutes' -> 'Flipkart Minutes')."""
    words = plat.replace("_", " ").split()
    capitalized = []
    for w in words:
        wl = w.lower()
        if wl in ("1mg", "1_mg"):
            capitalized.append("1mg")
        elif wl in ("247", "24/7"):
            capitalized.append("247")
        else:
            capitalized.append(w.capitalize())
    return " ".join(capitalized)


def get_segments(client: Optional[str] = "boat") -> List[Dict[str, Any]]:
    """
    Dynamically returns the list of segments for the given client workspace.
    The 'Segment / Section' list only contains the platforms that actually exist
    for that client in ClickHouse rca_sku_dim.
    """
    platforms = get_platforms_for_client(client)
    
    segs = []

    for p in platforms:
        p_clean = p.strip().lower()
        if not p_clean:
            continue
        p_label = format_platform_label(p)
        seg_id = f"pricing_overview_{p_clean.replace(' ', '_').replace('-', '_')}"
        segs.append({
            "id": seg_id,
            "label": f"Pricing Overview ({p_label})",
            "section": "overview",
            "platform": p_clean,
        })

    segs.append({
        "id": "insights",
        "label": "Insights (Price Drop / Hike SKUs)",
        "section": "insights",
        "platform": None,
    })
    segs.append({
        "id": "platform_overview",
        "label": "Platform Overview (Dimension Table)",
        "section": "platform_overview",
        "platform": "ALL",
        "channel": "ALL",
    })

    return segs


def get_segment_info(segment_id: str, client: Optional[str] = None) -> Dict[str, Any]:
    return _get_segment_info(segment_id, client=client)


def _get_segment_info(segment_id: str, client: Optional[str] = None) -> Dict[str, Any]:
    seg_clean = segment_id.lower().strip()
    
    if seg_clean in ("pricing_overview", "pricing overview (all platforms)"):
        return {
            "id": "pricing_overview",
            "label": "Pricing Overview (All Platforms)",
            "section": "overview",
            "platform": "all",
        }
    if seg_clean in ("insights", "insights (price drop / hike skus)"):
        return {
            "id": "insights",
            "label": "Insights (Price Drop / Hike SKUs)",
            "section": "insights",
            "platform": None,
        }
    if seg_clean in ("platform_overview", "platform overview (dimension table)"):
        return {
            "id": "platform_overview",
            "label": "Platform Overview (Dimension Table)",
            "section": "platform_overview",
            "platform": "ALL",
            "channel": "ALL",
        }

    # Dynamic platform segment from ID, e.g. 'pricing_overview_blinkit'
    if seg_clean.startswith("pricing_overview_"):
        plat = seg_clean.replace("pricing_overview_", "").replace("_", " ").strip()
        return {
            "id": seg_clean,
            "label": f"Pricing Overview ({format_platform_label(plat)})",
            "section": "overview",
            "platform": plat,
        }

    # Dynamic platform segment from label, e.g. 'Pricing Overview (Blinkit)'
    if seg_clean.startswith("pricing overview (") and seg_clean.endswith(")"):
        plat = seg_clean[18:-1].strip()
        return {
            "id": f"pricing_overview_{plat.replace(' ', '_').replace('-', '_')}",
            "label": f"Pricing Overview ({format_platform_label(plat)})",
            "section": "overview",
            "platform": plat,
        }

    # Check client dynamic segments
    for s in get_segments(client):
        if s["id"] == seg_clean or s["label"].lower() == seg_clean:
            return s

    # Default to pricing_overview
    return {
        "id": "pricing_overview",
        "label": "Pricing Overview (All Platforms)",
        "section": "overview",
        "platform": "all",
    }


def get_channel_for_platform(client: str, platform: str) -> Optional[str]:
    """
    Dynamically queries ClickHouse to find which channel a platform belongs to for this client workspace.
    Zero hardcoding.
    """
    if not platform or platform.lower() == "all":
        return get_default_channel_for_client(client)

    db_name = client or "boat"
    plat_norm = platform.lower().strip()

    # 1. Check rca_sku_dim first
    try:
        query = f"SELECT DISTINCT channel FROM {db_name}.rca_sku_dim WHERE lower(platform) = '{plat_norm}' AND channel IS NOT NULL AND channel != '' LIMIT 1"
        rows = execute_select_query(query, database=db_name)
        if rows and rows[0] and rows[0][0]:
            return str(rows[0][0]).strip()
    except Exception:
        pass

    # 2. Check rb_pdp_olap
    try:
        ch_col = resolve_table_column(db_name, "rb_pdp_olap", "channel") or "channel"
        query = f"SELECT DISTINCT {ch_col} FROM {db_name}.rb_pdp_olap WHERE lower(Platform) = '{plat_norm}' AND {ch_col} IS NOT NULL AND {ch_col} != '' LIMIT 1"
        rows = execute_select_query(query, database=db_name)
        if rows and rows[0] and rows[0][0]:
            return str(rows[0][0]).strip()
    except Exception:
        pass

    return get_default_channel_for_client(client)


def get_default_channel_for_client(client: str) -> Optional[str]:
    """
    Returns the default channel selected by FilterContext for this client workspace.
    Queries ClickHouse rca_sku_dim dynamically to determine client's primary channel.
    """
    db_name = client or "boat"
    try:
        rows = execute_select_query(
            f"SELECT DISTINCT channel FROM {db_name}.rca_sku_dim WHERE channel IS NOT NULL AND channel != ''",
            database=db_name,
        )
        valid = [str(r[0]).strip() for r in rows if r and r[0] and str(r[0]).strip().lower() != "all"]
        if valid:
            return valid[0]
    except Exception:
        pass

    try:
        data = call_platform_api("/api/watchtower/channels", db_name=client)
        if isinstance(data, list):
            valid = [c for c in data if c != "All"]
            if valid:
                return valid[0]
    except Exception:
        pass
    return None


def get_kpis_for_segment(segment_id: str, client: Optional[str] = None) -> List[Dict[str, Any]]:
    info = _get_segment_info(segment_id, client=client)
    section = info["section"]
    if section == "platform_overview":
        # Build platform KPIs dynamically for each platform in rca_sku_dim for this client
        platforms = get_platforms_for_client(client)
        kpis = []
        for p in platforms:
            p_clean = p.strip().lower()
            key_p = p_clean.replace(" ", "_").replace("-", "_")
            p_label = format_platform_label(p)
            kpis.append({
                "key": f"{key_p}_discount",
                "label": f"{p_label} Discount",
                "unit": "%",
                "decimals": 1,
                "abs_tol": 0.05,
                "rel_tol": 0.005,
            })
            kpis.append({
                "key": f"{key_p}_asp",
                "label": f"{p_label} ASP",
                "unit": "₹",
                "decimals": 2,
                "abs_tol": 0.1,
                "rel_tol": 0.002,
            })
        return kpis

    return KPIS_BY_SECTION.get(section, KPIS_BY_SECTION["overview"])


def step1_fetch(segment: str, period: Any, client: Optional[str] = "boat") -> Dict[str, Optional[float]]:
    """
    Step 1: API. Fetch KPI values from the platform's backend API.
    Routes to /api/pricing-analysis/kpis, /api/pricing-analysis/insights, or /api/pricing-analysis/dimension-overview.
    """
    info = _get_segment_info(segment)
    section = info["section"]
    db_name = client or "boat"

    if section == "insights":
        data = call_platform_api(
            endpoint="/api/pricing-analysis/insights",
            period=period,
            db_name=db_name,
        )
        payload = data.get("data") if data.get("success") else {}
        # The backend API returns { pd_my: [...], pi_my: [...], pd_comp: [...], pi_comp: [...] }
        my_drop = payload.get("pd_my") if "pd_my" in payload else payload.get("my_skus_drop", [])
        my_hike = payload.get("pi_my") if "pi_my" in payload else payload.get("my_skus_hike", [])
        comp_drop = payload.get("pd_comp") if "pd_comp" in payload else payload.get("comp_skus_drop", [])
        comp_hike = payload.get("pi_comp") if "pi_comp" in payload else payload.get("comp_skus_hike", [])

        return {
            "my_skus_drop": float(len(my_drop or [])),
            "my_skus_hike": float(len(my_hike or [])),
            "comp_skus_drop": float(len(comp_drop or [])),
            "comp_skus_hike": float(len(comp_hike or [])),
        }

    elif section == "platform_overview":
        api_params = {"dimension": "platform"}

        data = call_platform_api(
            endpoint="/api/pricing-analysis/dimension-overview",
            params=api_params,
            period=period,
            db_name=db_name,
        )
        rows = data.get("data") if data.get("success") else []
        plat_map = {}
        for r in rows:
            p_name = str(r.get("name") or r.get("key") or "").lower()
            if not p_name or p_name in plat_map:
                continue
            cell = r.get("data", {})
            disc = cell.get("discount", {}).get("value")
            asp = cell.get("asp", {}).get("value")
            plat_map[p_name] = {"discount": disc, "asp": asp}

        def get_val(p_name: str, metric: str) -> Optional[float]:
            val = plat_map.get(p_name, {}).get(metric)
            if val is not None:
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return None
            return None

        platforms = get_platforms_for_client(db_name)
        results = {}
        for p in platforms:
            p_clean = p.strip().lower()
            key_p = p_clean.replace(" ", "_").replace("-", "_")
            results[f"{key_p}_discount"] = get_val(p_clean, "discount")
            results[f"{key_p}_asp"] = get_val(p_clean, "asp")
        return results

    else:
        # Default: Pricing Overview
        api_params: Dict[str, Any] = {}
        plat = info.get("platform")
        if plat and plat != "all":
            api_params["platform"] = plat.capitalize()

        data = call_platform_api(
            endpoint="/api/pricing-analysis/kpis",
            params=api_params,
            period=period,
            db_name=db_name,
        )
        kpi_data = data.get("data") if data.get("success") else {}
        if not isinstance(kpi_data, dict):
            kpi_data = {}

        def extract_val(field: str) -> Optional[float]:
            node = kpi_data.get(field)
            if isinstance(node, dict):
                val = node.get("value")
                if val is not None:
                    try:
                        return float(val)
                    except (ValueError, TypeError):
                        return None
            return None

        return {
            "discount": extract_val("discount"),
            "weighted_discount": extract_val("weightedDiscount"),
            "asp": extract_val("asp"),
        }


def step2_logic(segment: str, period: Any, client: Optional[str] = "boat") -> Dict[str, Optional[float]]:
    """
    Step 2: Logic query. Computes the KPIs independently directly against ClickHouse OLAP table rb_pdp_olap.
    Division by zero safely handled via NULLIF; no rounding inside SQL.
    """
    info = _get_segment_info(segment)
    section = info["section"]
    db_name = client or "boat"
    start_date, end_date = period_to_date_range(period)

    # Dynamic column casing resolution
    channel_col = resolve_table_column(db_name, "rb_pdp_olap", "channel")

    if section == "insights":
        # Calculate comparison date range (period length before start_date)
        dt_start = datetime.strptime(start_date, "%Y-%m-%d")
        dt_end = datetime.strptime(end_date, "%Y-%m-%d")
        period_days = (dt_end - dt_start).days + 1
        comp_end_dt = dt_start - timedelta(days=1)
        comp_start_dt = comp_end_dt - timedelta(days=period_days - 1)
        comp_start = comp_start_dt.strftime("%Y-%m-%d")
        comp_end = comp_end_dt.strftime("%Y-%m-%d")

        query = f"""
        SELECT
            Brand,
            Product,
            Comp_flag,
            Platform,
            (SUM(CASE WHEN DATE BETWEEN '{start_date}' AND '{end_date}' AND MRP > 0 THEN MRP ELSE 0 END) - SUM(CASE WHEN DATE BETWEEN '{start_date}' AND '{end_date}' AND MRP > 0 THEN Selling_Price ELSE 0 END)) / NULLIF(SUM(CASE WHEN DATE BETWEEN '{start_date}' AND '{end_date}' AND MRP > 0 THEN MRP ELSE 0 END), 0) * 100 AS discount_curr,
            (SUM(CASE WHEN DATE BETWEEN '{comp_start}' AND '{comp_end}' AND MRP > 0 THEN MRP ELSE 0 END) - SUM(CASE WHEN DATE BETWEEN '{comp_start}' AND '{comp_end}' AND MRP > 0 THEN Selling_Price ELSE 0 END)) / NULLIF(SUM(CASE WHEN DATE BETWEEN '{comp_start}' AND '{comp_end}' AND MRP > 0 THEN MRP ELSE 0 END), 0) * 100 AS discount_prev
        FROM rb_pdp_olap
        WHERE DATE BETWEEN '{comp_start}' AND '{end_date}'
          AND Selling_Price > 0 AND Brand IS NOT NULL AND Brand != ''
        GROUP BY Brand, Product, Comp_flag, Platform
        HAVING discount_curr IS NOT NULL AND discount_prev IS NOT NULL
        """
        rows = execute_select_query(query, database=db_name)
        my_drop = 0
        my_hike = 0
        comp_drop = 0
        comp_hike = 0
        for r in rows:
            dc = float(r[4] or 0)
            dp = float(r[5] or 0)
            delta = dp - dc
            if abs(delta) >= 0.1:
                is_my = (str(r[2]) == "0")
                if is_my and delta < 0:
                    my_drop += 1
                elif is_my and delta > 0:
                    my_hike += 1
                elif not is_my and delta < 0:
                    comp_drop += 1
                elif not is_my and delta > 0:
                    comp_hike += 1

        # Service caps counts at 5 for top impacted SKUs
        return {
            "my_skus_drop": float(min(5, my_drop)),
            "my_skus_hike": float(min(5, my_hike)),
            "comp_skus_drop": float(min(5, comp_drop)),
            "comp_skus_hike": float(min(5, comp_hike)),
        }

    elif section == "platform_overview":
        query = f"""
        SELECT
            Platform AS plat,
            (SUM(CASE WHEN DATE BETWEEN '{start_date}' AND '{end_date}' AND MRP > 0 AND toString(Comp_flag) = '0' THEN MRP ELSE 0 END) - SUM(CASE WHEN DATE BETWEEN '{start_date}' AND '{end_date}' AND MRP > 0 AND toString(Comp_flag) = '0' THEN Selling_Price ELSE 0 END)) / NULLIF(SUM(CASE WHEN DATE BETWEEN '{start_date}' AND '{end_date}' AND MRP > 0 AND toString(Comp_flag) = '0' THEN MRP ELSE 0 END), 0) * 100 AS discount,
            AVG(CASE WHEN DATE BETWEEN '{start_date}' AND '{end_date}' AND toString(Comp_flag) = '0' AND Selling_Price > 0 AND neno_osa > 0 THEN Selling_Price ELSE NULL END) AS asp
        FROM rb_pdp_olap
        WHERE DATE BETWEEN '{start_date}' AND '{end_date}'
          AND Selling_Price > 0 AND Brand IS NOT NULL AND Brand != ''
        GROUP BY plat
        HAVING countIf(toString(Comp_flag) = '0') > 0
        ORDER BY discount DESC
        """
        rows = execute_select_query(query, database=db_name)
        plat_map = {}
        for r in rows:
            p_name = str(r[0] or "").lower()
            if not p_name or p_name in plat_map:
                continue
            disc = float(r[1]) if r[1] is not None else None
            asp = float(r[2]) if r[2] is not None else None
            plat_map[p_name] = {"discount": disc, "asp": asp}

        platforms = get_platforms_for_client(db_name)
        results = {}
        for p in platforms:
            p_clean = p.strip().lower()
            key_p = p_clean.replace(" ", "_").replace("-", "_")
            results[f"{key_p}_discount"] = plat_map.get(p_clean, {}).get("discount")
            results[f"{key_p}_asp"] = plat_map.get(p_clean, {}).get("asp")
        return results

    else:
        # Default: Pricing Overview
        plat = info.get("platform")
        plat_filter = ""
        channel_filter = ""
        if plat and plat != "all":
            plat_filter = f"AND lower(p.Platform) = '{plat.lower()}'"

        query = f"""
        SELECT
            (SUM(CASE WHEN p.DATE BETWEEN '{start_date}' AND '{end_date}' AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 AND p.Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(p.MRP)), 0) ELSE 0 END) - SUM(CASE WHEN p.DATE BETWEEN '{start_date}' AND '{end_date}' AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 AND p.Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) ELSE 0 END)) / NULLIF(SUM(CASE WHEN p.DATE BETWEEN '{start_date}' AND '{end_date}' AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 AND p.Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(p.MRP)), 0) ELSE 0 END), 0) * 100 AS discount,

            SUM(CASE WHEN p.DATE BETWEEN '{start_date}' AND '{end_date}' AND p.Comp_flag = '0' THEN ((ifNull(toFloat64OrZero(toString(p.MRP)), 0) - ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)) / NULLIF(ifNull(toFloat64OrZero(toString(p.MRP)), 0), 0)) * ifNull(toFloat64OrZero(toString(p.Sales)), 0) ELSE 0 END) / NULLIF(SUM(CASE WHEN p.DATE BETWEEN '{start_date}' AND '{end_date}' AND p.Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(p.Sales)), 0) ELSE 0 END), 0) * 100 AS weighted_discount,

            AVG(CASE WHEN p.DATE BETWEEN '{start_date}' AND '{end_date}' AND p.Comp_flag = '0' AND ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) > 0 AND ifNull(toFloat64OrZero(toString(p.neno_osa)), 0) > 0 THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) ELSE NULL END) AS asp
        FROM rb_pdp_olap p
        WHERE p.DATE BETWEEN '{start_date}' AND '{end_date}'
          AND p.Comp_flag = '0'
          {plat_filter}
          {channel_filter}
        """
        rows = execute_select_query(query, database=db_name)
        if not rows or not rows[0]:
            return {"discount": None, "weighted_discount": None, "asp": None}

        row = rows[0]

        def to_float(val: Any) -> Optional[float]:
            if val is None:
                return None
            try:
                return float(val)
            except (ValueError, TypeError):
                return None

        return {
            "discount": to_float(row[0]),
            "weighted_discount": to_float(row[1]),
            "asp": to_float(row[2]),
        }


def step3_ui(
    driver: Any,
    segment: str,
    period: Any,
    client: Optional[str] = "boat",
    headless: bool = False,
    on_live_step: Optional[Any] = None,
) -> Dict[str, Optional[str]]:
    """
    Step 3: UI (Selenium). Opens real dashboard page in Chrome,
    sets client workspace, applies segment and period, and reads the KPI values displayed.
    In visible mode (headless=False), displays live banners, forces window to top, and pulses target elements.
    """
    from ..step3_selenium import bring_chrome_to_top, show_live_step_banner, apply_dashboard_channel

    info = _get_segment_info(segment, client=client)
    section = info["section"]
    target_url = f"{FRONTEND_URL}/pricing-analysis"
    target_client_label = (client or "boat").capitalize()

    if on_live_step:
        on_live_step(f"Opening Pricing Analysis dashboard for {target_client_label}...")

    # Authenticate and set workspace database
    ensure_authenticated(driver, target_url, client=client)

    if not headless:
        bring_chrome_to_top(driver)
        show_live_step_banner(driver, f"Connected to {target_client_label} Workspace")
        time.sleep(1.0)

    # 1. Apply channel & platform / filter reset first
    if section == "overview":
        plat = info.get("platform") or "all"
        if plat != "all":
            if on_live_step:
                on_live_step(f"Selecting platform filter: {plat.capitalize()}...")
            if not headless:
                show_live_step_banner(driver, f"Applying Platform Filter: {plat.capitalize()}...")
            applied, err_msg = apply_segment_platform(driver, plat)
            if not applied:
                return {
                    "discount": None,
                    "weighted_discount": None,
                    "asp": None,
                    "_platform_unavailable": True,
                    "_platform_name": plat.capitalize(),
                    "_error": err_msg,
                }
        else:
            if on_live_step:
                on_live_step("Resetting filters to All Platforms...")
            if not headless:
                show_live_step_banner(driver, "Selecting All Platforms...")
            apply_segment_platform(driver, "all")

    if not headless:
        time.sleep(0.8)

    # 2. Apply Time Period in UI
    start_str = period.get("startDate") if isinstance(period, dict) else str(period)
    end_str = period.get("endDate") if isinstance(period, dict) else str(period)
    if on_live_step:
        on_live_step(f"Setting date range: {start_str} -> {end_str}...")
    if not headless:
        show_live_step_banner(driver, f"Setting Dashboard Period: {start_str} to {end_str}...")

    apply_dashboard_period(driver, period)

    time.sleep(2.5)
    wait_for_loading_complete(driver, timeout=25)
    time.sleep(1.0)

    # 3. Read section values
    if on_live_step:
        on_live_step("Scrolling to KPI metrics & inspecting live values...")

    if not headless:
        bring_chrome_to_top(driver)

    if section == "insights":
        results = read_insights(driver, headless=headless)
    elif section == "platform_overview":
        results = read_platform_overview(driver, headless=headless)
    else:
        results = read_pricing_overview(driver, headless=headless)

    # In live visible mode, give the tester a brief moment to see the completed state
    if not headless:
        try:
            bring_chrome_to_top(driver)
            show_live_step_banner(driver, "✅ Live Verification Complete! Values Scraped Successfully")
            if on_live_step:
                on_live_step("Verification complete! Closing Chrome window...")
            time.sleep(2.5)
        except Exception:
            pass

    return results


class PricingModule:
    name = "pricing"
    display_name = "Pricing Analysis"
    segments = CORE_SECTIONS
    kpis = KPIS_BY_SECTION["overview"]

    @staticmethod
    def get_segments(client: Optional[str] = "boat") -> List[Dict[str, Any]]:
        return get_segments(client)

    @staticmethod
    def get_segment_info(segment: str, client: Optional[str] = None) -> Dict[str, Any]:
        return _get_segment_info(segment, client=client)

    @staticmethod
    def _get_segment_info(segment: str, client: Optional[str] = None) -> Dict[str, Any]:
        return _get_segment_info(segment, client=client)

    @staticmethod
    def get_channel_for_platform(client: str, platform: str) -> Optional[str]:
        return get_channel_for_platform(client, platform)

    @staticmethod
    def get_default_channel_for_client(client: str) -> Optional[str]:
        return get_default_channel_for_client(client)

    @staticmethod
    def get_kpis(segment: str, client: Optional[str] = "boat") -> List[Dict[str, Any]]:
        return get_kpis_for_segment(segment, client=client)

    @staticmethod
    def step1_fetch(segment: str, period: Any, client: Optional[str] = "boat") -> Dict[str, Optional[float]]:
        return step1_fetch(segment, period, client=client)

    @staticmethod
    def step2_logic(segment: str, period: Any, client: Optional[str] = "boat") -> Dict[str, Optional[float]]:
        return step2_logic(segment, period, client=client)

    @staticmethod
    def step3_ui(
        driver: Any,
        segment: str,
        period: Any,
        client: Optional[str] = "boat",
        headless: bool = False,
        on_live_step: Optional[Any] = None,
    ) -> Dict[str, Optional[str]]:
        return step3_ui(driver, segment, period, client=client, headless=headless, on_live_step=on_live_step)
