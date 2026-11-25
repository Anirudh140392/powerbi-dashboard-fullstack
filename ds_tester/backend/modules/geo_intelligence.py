"""
Geo Intelligence (India Overview) Module for DS Tester
3-Way Parity Verification Engine:
- Step 1: Live Platform API (/api/map-intellect/data, /api/map-intellect/brands, /api/map-intellect/categories)
- Step 2: Direct ClickHouse Logic (rb_pdp_olap & rb_ms_olap tables)
- Step 3: Live Chrome Browser via Selenium (/geo-intelligence page)

100% Dynamic - Zero hardcoding, zero mock data.
Supported across all multi-city client workspaces (boat, mars, drl, emami, pidilite, prestige, zydus, danone, mamaearth, sugar).

Segments:
1. geo_overview: National Overview & Coverage (Tracked Cities, Avg OSA %, Top City Sales, Top City Orders)
2. geo_osa_analysis: Regional Availability (OSA %) (Available Locations, Avg OSA %, Peak OSA %, Critical Availability)
3. geo_sales_analysis: City-Wise Sales & Orders (Contributing Cities, Total Sales Cr, Top City Sales Cr, Total Orders)
4. geo_market_share: Regional Market Share (Tracked Clusters, Avg Market Share %, Peak Market Share %)
"""

import time
import math
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from selenium import webdriver

from ..step1_api import call_platform_api
from ..step2_logic import execute_select_query, period_to_date_range
from ..step3_selenium import (
    FRONTEND_URL,
    ensure_authenticated,
    wait_for_loading_complete,
    bring_chrome_to_top,
    show_live_step_banner,
)

SEGMENTS = [
    {
        "id": "geo_overview",
        "label": "National Overview & Coverage (Tracked Cities, OSA %, Top City Sales)",
    },
    {
        "id": "geo_osa_analysis",
        "label": "Regional Availability Analysis (OSA %, Coverage & Critical Cities)",
    },
    {
        "id": "geo_sales_analysis",
        "label": "City-Wise Sales & Orders (Geographic Revenue & Peak City)",
    },
    {
        "id": "geo_market_share",
        "label": "Regional Market Share (Urban Clusters & Peak Share %)",
    },
]

KPIS_BY_SEGMENT = {
    "geo_overview": [
        {
            "key": "tracked_cities_count",
            "label": "Tracked Locations Count",
            "unit": "cities",
            "decimals": 0,
            "abs_tol": 2.0,
            "rel_tol": 0.05,
        },
        {
            "key": "national_avg_osa",
            "label": "Average City OSA %",
            "unit": "%",
            "decimals": 1,
            "abs_tol": 1.5,
            "rel_tol": 0.05,
        },
        {
            "key": "top_city_sales",
            "label": "Top City Sales",
            "unit": "Cr",
            "decimals": 2,
            "abs_tol": 0.5,
            "rel_tol": 0.05,
        },
        {
            "key": "top_city_orders",
            "label": "Top City Order Volume",
            "unit": "orders",
            "decimals": 0,
            "abs_tol": 500.0,
            "rel_tol": 0.05,
        },
    ],
    "geo_osa_analysis": [
        {
            "key": "osa_city_count",
            "label": "Available Locations (OSA > 0)",
            "unit": "cities",
            "decimals": 0,
            "abs_tol": 2.0,
            "rel_tol": 0.05,
        },
        {
            "key": "average_city_osa",
            "label": "Average Regional OSA %",
            "unit": "%",
            "decimals": 1,
            "abs_tol": 1.5,
            "rel_tol": 0.05,
        },
        {
            "key": "peak_city_osa",
            "label": "Peak City OSA %",
            "unit": "%",
            "decimals": 1,
            "abs_tol": 1.5,
            "rel_tol": 0.05,
        },
        {
            "key": "critical_osa_cities",
            "label": "Critical Availability Cities (<= 45%)",
            "unit": "cities",
            "decimals": 0,
            "abs_tol": 2.0,
            "rel_tol": 0.1,
        },
    ],
    "geo_sales_analysis": [
        {
            "key": "contributing_cities",
            "label": "Revenue Contributing Cities",
            "unit": "cities",
            "decimals": 0,
            "abs_tol": 2.0,
            "rel_tol": 0.05,
        },
        {
            "key": "total_geo_sales",
            "label": "Total Geographic Sales",
            "unit": "Cr",
            "decimals": 2,
            "abs_tol": 0.5,
            "rel_tol": 0.05,
        },
        {
            "key": "top_city_sales",
            "label": "Top Contributing City Sales",
            "unit": "Cr",
            "decimals": 2,
            "abs_tol": 0.5,
            "rel_tol": 0.05,
        },
        {
            "key": "total_geo_orders",
            "label": "Total Geographic Orders",
            "unit": "orders",
            "decimals": 0,
            "abs_tol": 1000.0,
            "rel_tol": 0.05,
        },
    ],
    "geo_market_share": [
        {
            "key": "ms_tracked_clusters",
            "label": "Tracked Urban Clusters",
            "unit": "clusters",
            "decimals": 0,
            "abs_tol": 2.0,
            "rel_tol": 0.05,
        },
        {
            "key": "average_market_share",
            "label": "Average Cluster Market Share",
            "unit": "%",
            "decimals": 2,
            "abs_tol": 1.0,
            "rel_tol": 0.05,
        },
        {
            "key": "peak_market_share",
            "label": "Peak Urban Cluster Market Share",
            "unit": "%",
            "decimals": 2,
            "abs_tol": 1.0,
            "rel_tol": 0.05,
        },
    ],
}


def _resolve_geo_dates(period: Any, client: Optional[str] = None) -> Tuple[str, str]:
    """
    Dynamically resolves start and end dates for Geo Intelligence.
    If period is an explicit range (dict or string), parses it.
    If period is a preset like 'MTD', '7D', '14D', '31D', queries the latest date in rb_pdp_olap.
    """
    if isinstance(period, dict) and period.get("startDate") and period.get("endDate"):
        return str(period["startDate"])[:10], str(period["endDate"])[:10]

    if isinstance(period, str) and (" to " in period or " - " in period):
        try:
            return period_to_date_range(period)
        except Exception:
            pass

    # Query latest date dynamically from ClickHouse
    db_name = (client or "drl").lower().strip()
    try:
        rows = execute_select_query(f"SELECT MAX(toDate(DATE)) FROM {db_name}.rb_pdp_olap")
        if rows and rows[0][0]:
            max_dt = rows[0][0]
            if isinstance(max_dt, str):
                max_dt = datetime.strptime(max_dt[:10], "%Y-%m-%d").date()
            preset = str(period).strip().upper() if period else "MTD"
            if preset == "7D":
                start_dt = max_dt - timedelta(days=6)
            elif preset == "14D":
                start_dt = max_dt - timedelta(days=13)
            elif preset == "31D":
                start_dt = max_dt - timedelta(days=30)
            else:  # MTD or default (30 days back)
                start_dt = max_dt - timedelta(days=30)
            return start_dt.strftime("%Y-%m-%d"), max_dt.strftime("%Y-%m-%d")
    except Exception:
        pass

    now = datetime.now()
    return (now - timedelta(days=30)).strftime("%Y-%m-%d"), now.strftime("%Y-%m-%d")


def _resolve_client_channel(db_name: str, raw_channel: Optional[str]) -> Optional[str]:
    """
    Dynamically resolves the exact case-sensitive channel string present in rca_sku_dim for this client.
    Handles 'Quick Commerce', 'QuickComm', 'quickcomm', 'E-Commerce', 'Ecommerce', 'ecommerce'.
    """
    if not raw_channel or raw_channel == "All":
        return None
    raw_lower = raw_channel.lower().strip()
    try:
        rows = execute_select_query(
            f"SELECT DISTINCT channel FROM {db_name}.rca_sku_dim WHERE channel IS NOT NULL AND channel != ''",
            database=db_name,
        )
        chans = [str(r[0]).strip() for r in rows if r and r[0]]
        for ch in chans:
            chl = ch.lower()
            if ("quick" in raw_lower or "qcomm" in raw_lower) and ("quick" in chl or "qcomm" in chl):
                return ch
            if ("ecom" in raw_lower or "ecommerce" in raw_lower) and ("ecom" in chl or "ecommerce" in chl):
                return ch
            if raw_lower == chl:
                return ch
        if chans:
            return chans[0]
    except Exception:
        pass
    return raw_channel


def _build_api_params(filters: Optional[Dict[str, Any]], start_date: str, end_date: str, db_name: str = "boat", metric: str = "all") -> Dict[str, Any]:
    params = {
        "startDate": start_date,
        "endDate": end_date,
        "metric": metric,
    }
    if not filters:
        return params

    plat = str(filters.get("platform") or "").strip()
    if plat and plat.lower() not in ("all", "all platforms"):
        params["platform"] = plat

    brand = str(filters.get("brand") or "").strip()
    if brand and brand.lower() not in ("all", "all brands"):
        params["brand"] = brand

    cat = str(filters.get("category") or "").strip()
    if cat and cat.lower() not in ("all", "all categories"):
        params["category"] = cat

    msl = str(filters.get("msl") or "").strip()
    if msl and msl.lower() not in ("all", ""):
        params["msl"] = msl

    chan = str(filters.get("channel") or "").strip()
    if chan and chan.lower() not in ("all", ""):
        resolved_ch = _resolve_client_channel(db_name, chan)
        if resolved_ch:
            params["channel"] = resolved_ch

    return params


# ===========================================================================
# Step 1: Live Platform API
# ===========================================================================

def step1_fetch(segment: str, period: str, client: Optional[str] = None, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Step 1: Calls live Geo Intelligence / Map Intellect API (/api/map-intellect/data)
    """
    start_date, end_date = _resolve_geo_dates(period, client=client)
    db_name = (client or "drl").lower().strip()

    metric_code = "all"
    if segment == "geo_osa_analysis":
        metric_code = "osa"
    elif segment == "geo_sales_analysis":
        metric_code = "sales"
    elif segment == "geo_market_share":
        metric_code = "marketshare"

    params = _build_api_params(filters, start_date, end_date, db_name=db_name, metric=metric_code)
    resp = call_platform_api("/api/map-intellect/data", params=params, db_name=db_name)
    cities_raw = resp.get("cities", []) if isinstance(resp, dict) else []
    is_nation = lambda n: (n or '').lower().strip() in ('india', 'nation', 'national', 'all india', 'pan india', 'overall')
    specific_cities = [c for c in cities_raw if not is_nation(c.get('name'))]
    cities = specific_cities if specific_cities else cities_raw

    if segment == "geo_overview":
        count = float(len(cities))
        avg_osa = (sum(float(c.get("osa") or 0.0) for c in cities) / count) if count > 0 else 0.0
        max_sales = max((float(c.get("sales") or 0.0) for c in cities), default=0.0)
        max_orders = max((float(c.get("orders") or 0.0) for c in cities), default=0.0)
        return {
            "tracked_cities_count": count,
            "national_avg_osa": round(avg_osa, 1),
            "top_city_sales": round(max_sales / 10_000_000.0, 2),
            "top_city_orders": round(max_orders, 0),
        }

    elif segment == "geo_osa_analysis":
        active_cities = [c for c in cities if float(c.get("osa") or 0.0) > 0]
        count = float(len(active_cities))
        avg_osa = (sum(float(c.get("osa") or 0.0) for c in active_cities) / count) if count > 0 else 0.0
        peak_osa = max((float(c.get("osa") or 0.0) for c in active_cities), default=0.0)
        crit_cities = float(len([c for c in active_cities if float(c.get("osa") or 0.0) <= 45.0]))
        return {
            "osa_city_count": count,
            "average_city_osa": round(avg_osa, 1),
            "peak_city_osa": round(peak_osa, 1),
            "critical_osa_cities": crit_cities,
        }

    elif segment == "geo_sales_analysis":
        sales_cities = [c for c in cities if float(c.get("sales") or 0.0) > 0]
        count = float(len(sales_cities))
        total_sales = sum(float(c.get("sales") or 0.0) for c in sales_cities)
        max_sales = max((float(c.get("sales") or 0.0) for c in sales_cities), default=0.0)
        total_orders = sum(float(c.get("orders") or 0.0) for c in cities)
        return {
            "contributing_cities": count,
            "total_geo_sales": round(total_sales / 10_000_000.0, 2),
            "top_city_sales": round(max_sales / 10_000_000.0, 2),
            "total_geo_orders": round(total_orders, 0),
        }

    elif segment == "geo_market_share":
        ms_cities = [c for c in cities if float(c.get("marketShare") or 0.0) > 0]
        count = float(len(ms_cities))
        avg_ms = (sum(float(c.get("marketShare") or 0.0) for c in ms_cities) / count) if count > 0 else 0.0
        peak_ms = max((float(c.get("marketShare") or 0.0) for c in ms_cities), default=0.0)
        return {
            "ms_tracked_clusters": count,
            "average_market_share": round(avg_ms, 2),
            "peak_market_share": round(peak_ms, 2),
        }

    raise ValueError(f"Unknown segment for Geo Intelligence: {segment}")


# ===========================================================================
# Step 2: Direct ClickHouse Logic
# ===========================================================================

def step2_logic(segment: str, period: str, client: Optional[str] = None, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Step 2: Direct ClickHouse query on rb_pdp_olap and rb_ms_olap tables
    """
    start_date, end_date = _resolve_geo_dates(period, client=client)
    db_name = (client or "drl").lower().strip()

    # Build SQL conditions matching mapIntellectService.js
    # If specific cities exist, exclude aggregated nation rows so parity holds with UI map
    try:
        loc_check = execute_select_query(
            f"SELECT count(DISTINCT Location) FROM {db_name}.rb_pdp_olap WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}' AND Comp_flag = 0 AND Location IS NOT NULL AND Location != '' AND lower(Location) NOT IN ('other', 'unknown', 'india', 'nation', 'national', 'all india', 'pan india', 'overall')",
            database=db_name,
        )
        has_specific = bool(loc_check and loc_check[0] and loc_check[0][0] > 0)
    except Exception:
        has_specific = True

    loc_exclude = "('other', 'unknown', 'india', 'nation', 'national', 'all india', 'pan india', 'overall')" if has_specific else "('other', 'unknown')"

    conds = [
        f"toDate(DATE) BETWEEN '{start_date}' AND '{end_date}'",
        "Comp_flag = 0",
        f"Location IS NOT NULL AND Location != '' AND lower(Location) NOT IN {loc_exclude}",
    ]

    if filters:
        plat = str(filters.get("platform") or "").strip()
        if plat and plat.lower() not in ("all", "all platforms"):
            plat_esc = plat.replace("'", "''").lower()
            conds.append(f"lower(Platform) = '{plat_esc}'")
        else:
            chan = str(filters.get("channel") or "").strip()
            if chan and chan.lower() not in ("all", ""):
                resolved_ch = _resolve_client_channel(db_name, chan)
                if resolved_ch:
                    ch_esc = resolved_ch.replace("'", "''")
                    conds.append(f"Platform IN (SELECT DISTINCT platform FROM {db_name}.rca_sku_dim WHERE channel = '{ch_esc}')")

        brand = str(filters.get("brand") or "").strip()
        if brand and brand.lower() not in ("all", "all brands"):
            br = brand.replace("'", "''").lower()
            conds.append(f"lower(Brand) = '{br}'")

        cat = str(filters.get("category") or "").strip()
        if cat and cat.lower() not in ("all", "all categories"):
            cat_esc = cat.replace("'", "''").lower()
            conds.append(f"lower(Category) = '{cat_esc}'")

        msl = str(filters.get("msl") or "").strip()
        if msl and msl.lower() not in ("all", ""):
            conds.append(f"toString(msl) = '{msl}'")

    where_clause = " AND ".join(conds)

    if segment in ("geo_overview", "geo_osa_analysis", "geo_sales_analysis"):
        q = f"""
            SELECT
                Location,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS total_sales,
                SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS total_orders,
                (SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / NULLIF(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100 AS city_osa
            FROM {db_name}.rb_pdp_olap
            WHERE {where_clause}
            GROUP BY Location
            ORDER BY total_sales DESC
            LIMIT 500
        """
        rows = execute_select_query(q)

        cities_data = []
        for r in rows:
            sales = float(r[1] or 0.0)
            orders = float(r[2] or 0.0)
            osa = float(r[3] or 0.0)
            cities_data.append({"sales": sales, "orders": orders, "osa": osa})

        if segment == "geo_overview":
            count = float(len(cities_data))
            avg_osa = (sum(c["osa"] for c in cities_data) / count) if count > 0 else 0.0
            max_sales = max((c["sales"] for c in cities_data), default=0.0)
            max_orders = max((c["orders"] for c in cities_data), default=0.0)
            return {
                "tracked_cities_count": count,
                "national_avg_osa": round(avg_osa, 1),
                "top_city_sales": round(max_sales / 10_000_000.0, 2),
                "top_city_orders": round(max_orders, 0),
            }

        elif segment == "geo_osa_analysis":
            active_cities = [c for c in cities_data if c["osa"] > 0]
            count = float(len(active_cities))
            avg_osa = (sum(c["osa"] for c in active_cities) / count) if count > 0 else 0.0
            peak_osa = max((c["osa"] for c in active_cities), default=0.0)
            crit_cities = float(len([c for c in active_cities if c["osa"] <= 45.0]))
            return {
                "osa_city_count": count,
                "average_city_osa": round(avg_osa, 1),
                "peak_city_osa": round(peak_osa, 1),
                "critical_osa_cities": crit_cities,
            }

        elif segment == "geo_sales_analysis":
            sales_cities = [c for c in cities_data if c["sales"] > 0]
            count = float(len(sales_cities))
            total_sales = sum(c["sales"] for c in sales_cities)
            max_sales = max((c["sales"] for c in sales_cities), default=0.0)
            total_orders = sum(c["orders"] for c in cities_data)
            return {
                "contributing_cities": count,
                "total_geo_sales": round(total_sales / 10_000_000.0, 2),
                "top_city_sales": round(max_sales / 10_000_000.0, 2),
                "total_geo_orders": round(total_orders, 0),
            }

    elif segment == "geo_market_share":
        # Urban clusters for MS query
        allowed_cities = [
            "delhi", "ahmedabad", "bengaluru", "bangalore", "banglore", "chandigarh", "chennai",
            "faridabad", "gurugram", "gurgaon", "hyderabad", "kolkata", "lucknow", "mumbai", "pune", "india"
        ]
        city_clause = " OR ".join(f"lower(location) LIKE '%{c}%'" for c in allowed_cities)

        # Brand condition
        brand_cond = "flag = 1"
        if filters and filters.get("brand") and filters["brand"] != "All":
            br = filters["brand"].replace("'", "''").lower()
            brand_cond = f"lower(group_brand) LIKE '%{br}%'"

        ms_conds = [
            f"toDate(created_on) BETWEEN '{start_date}' AND '{end_date}'",
            f"({city_clause})",
            "location IS NOT NULL AND location != ''",
        ]
        if filters:
            plat = str(filters.get("platform") or "").strip()
            if plat and plat.lower() not in ("all", "all platforms"):
                plat_esc = plat.replace("'", "''").lower()
                ms_conds.append(f"lower(platform) = '{plat_esc}'")
            else:
                chan = str(filters.get("channel") or "").strip()
                if chan and chan.lower() not in ("all", ""):
                    resolved_ch = _resolve_client_channel(db_name, chan)
                    if resolved_ch:
                        ch_esc = resolved_ch.replace("'", "''")
                        ms_conds.append(f"platform IN (SELECT DISTINCT platform FROM {db_name}.rca_sku_dim WHERE channel = '{ch_esc}')")
            cat = str(filters.get("category") or "").strip()
            if cat and cat.lower() not in ("all", "all categories"):
                cat_esc = cat.replace("'", "''").lower()
                ms_conds.append(f"lower(category) = '{cat_esc}'")

        ms_where = " AND ".join(ms_conds)
        q = f"""
            SELECT
                location,
                ROUND((SUM(CASE WHEN {brand_cond} THEN ifNull(toFloat64OrZero(toString(sales)), 0) ELSE 0 END) / NULLIF(SUM(ifNull(toFloat64OrZero(toString(sales)), 0)), 0)) * 100, 2) AS avg_market_share
            FROM {db_name}.rb_ms_olap
            WHERE {ms_where}
            GROUP BY location
        """
        rows = execute_select_query(q)

        ms_data = [float(r[1] or 0.0) for r in rows if float(r[1] or 0.0) > 0]
        count = float(len(ms_data))
        avg_ms = (sum(ms_data) / count) if count > 0 else 0.0
        peak_ms = max(ms_data, default=0.0)
        return {
            "ms_tracked_clusters": count,
            "average_market_share": round(avg_ms, 2),
            "peak_market_share": round(peak_ms, 2),
        }

    raise ValueError(f"Unknown segment for Geo Intelligence: {segment}")


# ===========================================================================
# Step 3: Live Chrome Browser via Selenium
# ===========================================================================

def step3_ui(
    driver: webdriver.Chrome,
    segment: str,
    period: str,
    client: Optional[str] = None,
    headless: bool = False,
    on_live_step: Optional[Any] = None,
    filters: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Step 3: Navigates to /geo-intelligence, applies metric and dynamic active filters,
    and extracts rendered city metrics from React Fiber, window.__geoIntelligenceData, and MapLibre markers.
    """
    if on_live_step:
        on_live_step("Navigating to India Overview (Geo Intelligence) map...")
    if not headless:
        bring_chrome_to_top(driver)
        show_live_step_banner(driver, "🌍 DS Tester: Navigating to India Overview (Geo Intelligence)...")

    db_name = (client or "drl").lower().strip()
    target_url = f"{FRONTEND_URL}/geo-intelligence"
    ensure_authenticated(driver, target_url=target_url, client=db_name)

    current_url = driver.current_url or ""
    if "/geo-intelligence" not in current_url:
        driver.get(target_url)
        wait_for_loading_complete(driver)
        time.sleep(0.2)

    start_date, end_date = _resolve_geo_dates(period, client=client)

    # 1. Target metric
    metric_target = "OSA %"
    if segment == "geo_sales_analysis":
        metric_target = "Sales"
    elif segment == "geo_market_share":
        metric_target = "Market Share"
    elif filters and filters.get("metric"):
        metric_target = filters["metric"]

    plat_target = (filters.get("platform") if filters else None) or "All"
    ch_target = (filters.get("channel") if filters else None) or "All"
    brand_target = (filters.get("brand") if filters else None) or "All"
    cat_target = (filters.get("category") if filters else None) or "All"

    # Check for platform limitation on Market Share (e.g. Amazon does not support MS)
    if segment == "geo_market_share" and ("amazon" in plat_target.lower()):
        return {
            "_platform_unavailable": True,
            "_platform_name": plat_target,
            "ms_tracked_clusters": "0",
            "average_market_share": "0.0",
            "peak_market_share": "0.0",
        }

    # 2. Apply Channel Filter (Quick Commerce vs E-Commerce in Sidebar) if specified
    if ch_target != "All":
        if on_live_step:
            on_live_step(f"Switching Channel to '{ch_target}'...")
        if not headless:
            show_live_step_banner(driver, f"🏷️ Setting Channel Filter: {ch_target}")

        driver.execute_script("""
            const target = (arguments[0] || '').toLowerCase();
            const els = Array.from(document.querySelectorAll('div, p, span, h6, button'));
            const tab = els.find(el => {
                const txt = (el.innerText || '').trim().toLowerCase();
                if ((target.includes('quick') || target.includes('qcomm')) && (txt === 'qcomm' || txt === 'quick commerce' || txt === 'quickcomm')) return true;
                if ((target.includes('ecom') || target.includes('ecommerce')) && (txt === 'ecomm' || txt === 'e-commerce' || txt === 'ecommerce')) return true;
                return txt === target;
            });
            if (tab) {
                tab.click();
                const k = Object.keys(tab).find(x => x.startsWith('__reactFiber$') || x.startsWith('__reactInternalInstance$'));
                if (k && tab[k]) {
                    let cur = tab[k];
                    while (cur) {
                        if (cur.memoizedProps && typeof cur.memoizedProps.onClick === 'function') {
                            try { cur.memoizedProps.onClick({ preventDefault: () => {}, stopPropagation: () => {} }); break; } catch (e) {}
                        }
                        cur = cur.return;
                    }
                }
            }
        """, ch_target)
        time.sleep(0.1)

    # 3. Apply Platform Filter in Sidebar carousel if specified
    if plat_target != "All":
        if on_live_step:
            on_live_step(f"Selecting Platform '{plat_target}' in sidebar...")
        driver.execute_script("""
            const target = (arguments[0] || '').toLowerCase().trim();
            const allEls = Array.from(document.querySelectorAll('div, button, img'));
            for (const el of allEls) {
                const alt = (el.getAttribute('alt') || '').toLowerCase().trim();
                const title = (el.getAttribute('title') || '').toLowerCase().trim();
                const txt = (el.innerText || '').toLowerCase().trim();
                if (alt === target || title === target || txt === target) {
                    el.click();
                    break;
                }
            }
        """, plat_target)
        time.sleep(0.1)

    # 4. Dispatch live filter synchronization event to GeoIntelligenceMap
    if on_live_step:
        on_live_step(f"Synchronizing live map filters ({start_date} to {end_date}, {metric_target})...")
    if not headless:
        show_live_step_banner(driver, f"📅 Applying Date Range: {start_date} to {end_date}")

    driver.execute_script("""
        window.__geoIntelligenceLoading = true;
        window.__geoIntelligencePeriod = null;
        const detail = {
            startDate: arguments[0],
            endDate: arguments[1],
            metric: arguments[2],
            platform: arguments[3],
            brand: arguments[4],
            category: arguments[5],
            timePeriod: 'Custom'
        };
        window.dispatchEvent(new CustomEvent('trailytics:setGeoFilters', { detail }));
    """, start_date, end_date, metric_target, plat_target if plat_target != "All" else None, brand_target if brand_target != "All" else None, cat_target if cat_target != "All" else None)
    time.sleep(0.1)

    # 5. Also click the Metric button in the DOM
    driver.execute_script(f"""
        const target = "{metric_target}".toLowerCase();
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => (b.innerText || '').trim().toLowerCase() === target);
        if (btn) btn.click();
    """)
    time.sleep(0.2)

    # 6. Wait dynamically for live map data to settle for the requested period
    if on_live_step:
        on_live_step(f"Waiting for live map data to settle ({start_date} to {end_date})...")
    start_poll = time.time()
    while time.time() - start_poll < 15.0:
        synced = driver.execute_script("""
            const p = window.__geoIntelligencePeriod;
            const loading = window.__geoIntelligenceLoading;
            const targetStart = arguments[0];
            const targetEnd = arguments[1];
            if (loading) return false;
            if (!p) return false;
            return p.startDate === targetStart && p.endDate === targetEnd;
        """, start_date, end_date)
        if synced:
            break
        time.sleep(0.3)
    time.sleep(0.2)

    # 7. Extract UI Data from window.__geoIntelligenceData, React Fiber, and DOM markers
    if on_live_step:
        on_live_step(f"Scraping live UI metrics for {segment}...")
    if not headless:
        show_live_step_banner(driver, "🔍 DS Tester: Extracting live map data...")

    extracted = driver.execute_script("""
        const results = { cities: [], markerCount: 0, hasMarketShareBtn: false };

        // 1. Check window.__geoIntelligenceData first
        if (window.__geoIntelligenceData && Array.isArray(window.__geoIntelligenceData) && window.__geoIntelligenceData.length > 0) {
            results.cities = window.__geoIntelligenceData.map(c => ({
                name: c.name || '',
                sales: parseFloat(c.sales) || 0,
                orders: parseFloat(c.orders) || 0,
                osa: parseFloat(c.osa) || 0,
                marketShare: parseFloat(c.marketShare) || 0
            }));
        }

        // 2. Fallback: Extract from React Fiber hook state of GeoIntelligenceMap
        if (!results.cities || results.cities.length === 0) {
            function extractFiberCities() {
                const allDivs = Array.from(document.querySelectorAll('div'));
                for (const d of allDivs) {
                    const k = Object.keys(d).find(x => x.startsWith('__reactFiber$') || x.startsWith('__reactInternalInstance$'));
                    if (!k) continue;
                    let cur = d[k];
                    while (cur) {
                        if (cur.memoizedState) {
                            let s = cur.memoizedState;
                            while (s) {
                                const val = s.memoizedState;
                                if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0] === 'object' && val[0].name !== undefined && (val[0].osa !== undefined || val[0].sales !== undefined || val[0].marketShare !== undefined)) {
                                    return val;
                                }
                                s = s.next;
                            }
                        }
                        cur = cur.return;
                    }
                }
                return null;
            }
            const fiberCities = extractFiberCities();
            if (fiberCities && Array.isArray(fiberCities)) {
                results.cities = fiberCities.map(c => ({
                    name: c.name || '',
                    sales: parseFloat(c.sales) || 0,
                    orders: parseFloat(c.orders) || 0,
                    osa: parseFloat(c.osa) || 0,
                    marketShare: parseFloat(c.marketShare) || 0
                }));
            }
        }

        // 3. Check for Market Share button presence
        const allBtns = Array.from(document.querySelectorAll('button'));
        results.hasMarketShareBtn = allBtns.some(b => (b.innerText || '').trim().toLowerCase() === 'market share');

        // 4. Count DOM custom markers
        const domMarkers = document.querySelectorAll('.custom-marker');
        results.markerCount = domMarkers.length;

        return results;
    """)

    cities_raw = (extracted or {}).get("cities", [])
    marker_count = float((extracted or {}).get("markerCount", 0))
    has_ms_btn = bool((extracted or {}).get("hasMarketShareBtn", False))

    # Filter out nation rows if specific cities exist
    is_nation = lambda n: (n or '').lower().strip() in ('india', 'nation', 'national', 'all india', 'pan india', 'overall')
    specific = [c for c in cities_raw if not is_nation(c.get('name'))]
    cities = specific if specific else cities_raw

    # Graceful handling for Market Share if not available
    if segment == "geo_market_share" and not has_ms_btn and ("amazon" in plat_target.lower() or plat_target == "All"):
        if not cities or all(float(c.get("marketShare") or 0.0) == 0.0 for c in cities):
            return {
                "_platform_unavailable": True,
                "_platform_name": plat_target if plat_target != "All" else "Selected Platform",
                "ms_tracked_clusters": "0",
                "average_market_share": "0.0",
                "peak_market_share": "0.0",
            }

    # Calculate KPIs from UI state
    if segment == "geo_overview":
        count = float(len(cities)) if cities else marker_count
        avg_osa = (sum(float(c.get("osa") or 0.0) for c in cities) / len(cities)) if cities else 0.0
        max_sales = max((float(c.get("sales") or 0.0) for c in cities), default=0.0)
        max_orders = max((float(c.get("orders") or 0.0) for c in cities), default=0.0)
        return {
            "tracked_cities_count": str(round(count, 0)),
            "national_avg_osa": str(round(avg_osa, 1)),
            "top_city_sales": str(round(max_sales / 10_000_000.0, 2)),
            "top_city_orders": str(round(max_orders, 0)),
        }

    elif segment == "geo_osa_analysis":
        active_cities = [c for c in cities if float(c.get("osa") or 0.0) > 0] if cities else []
        count = float(len(active_cities)) if active_cities else marker_count
        avg_osa = (sum(float(c.get("osa") or 0.0) for c in active_cities) / len(active_cities)) if active_cities else 0.0
        peak_osa = max((float(c.get("osa") or 0.0) for c in active_cities), default=0.0)
        crit_cities = float(len([c for c in active_cities if float(c.get("osa") or 0.0) <= 45.0]))
        return {
            "osa_city_count": str(round(count, 0)),
            "average_city_osa": str(round(avg_osa, 1)),
            "peak_city_osa": str(round(peak_osa, 1)),
            "critical_osa_cities": str(round(crit_cities, 0)),
        }

    elif segment == "geo_sales_analysis":
        sales_cities = [c for c in cities if float(c.get("sales") or 0.0) > 0] if cities else []
        count = float(len(sales_cities)) if sales_cities else marker_count
        total_sales = sum(float(c.get("sales") or 0.0) for c in sales_cities)
        max_sales = max((float(c.get("sales") or 0.0) for c in sales_cities), default=0.0)
        total_orders = sum(float(c.get("orders") or 0.0) for c in cities)
        return {
            "contributing_cities": str(round(count, 0)),
            "total_geo_sales": str(round(total_sales / 10_000_000.0, 2)),
            "top_city_sales": str(round(max_sales / 10_000_000.0, 2)),
            "total_geo_orders": str(round(total_orders, 0)),
        }

    elif segment == "geo_market_share":
        ms_cities = [c for c in cities if float(c.get("marketShare") or 0.0) > 0] if cities else []
        count = float(len(ms_cities)) if ms_cities else marker_count
        avg_ms = (sum(float(c.get("marketShare") or 0.0) for c in ms_cities) / len(ms_cities)) if ms_cities else 0.0
        peak_ms = max((float(c.get("marketShare") or 0.0) for c in ms_cities), default=0.0)
        return {
            "ms_tracked_clusters": str(round(count, 0)),
            "average_market_share": str(round(avg_ms, 2)),
            "peak_market_share": str(round(peak_ms, 2)),
        }

    raise ValueError(f"Unknown segment for Geo Intelligence: {segment}")


# ===========================================================================
# Module Registration Class
# ===========================================================================

def _check_geo_available(client: Optional[str]) -> bool:
    if not client:
        return False
    db_name = client.lower().strip()
    try:
        rows = execute_select_query(
            f"SELECT count(DISTINCT Location) FROM {db_name}.rb_pdp_olap WHERE Location IS NOT NULL AND Location != '' AND lower(Location) NOT IN ('other', 'unknown')",
            database=db_name,
        )
        return bool(rows and rows[0] and rows[0][0] > 0)
    except Exception:
        return False


def get_segments(client: Optional[str] = None) -> List[Dict[str, Any]]:
    if not client or not _check_geo_available(client):
        return []
    return SEGMENTS


def get_kpis_for_segment(segment: str, client: Optional[str] = None) -> List[Dict[str, Any]]:
    return KPIS_BY_SEGMENT.get(segment, KPIS_BY_SEGMENT["geo_overview"])


class GeoIntelligenceModule:
    name: str = "Geo Intelligence"
    display_name: str = "India Overview"
    slug: str = "geo_intelligence"
    segments: List[Dict[str, Any]] = SEGMENTS

    get_segments = staticmethod(get_segments)
    get_kpis_for_segment = staticmethod(get_kpis_for_segment)
    get_kpis = staticmethod(get_kpis_for_segment)
    step1_fetch = staticmethod(step1_fetch)
    step2_logic = staticmethod(step2_logic)
    step3_ui = staticmethod(step3_ui)
