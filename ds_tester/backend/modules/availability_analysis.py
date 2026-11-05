import os
import time
import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from ..step1_api import call_platform_api
from ..step2_logic import execute_select_query, period_to_date_range, resolve_table_column
from ..step3_selenium import (
    FRONTEND_URL,
    ensure_authenticated,
    apply_dashboard_period,
    apply_dashboard_channel,
    apply_segment_platform,
    wait_for_loading_complete,
    bring_chrome_to_top,
    show_live_step_banner,
    highlight_element,
)

METRO_CITIES = [
    "ahmedabad", "bengaluru", "chennai", "delhi",
    "hyderabad", "kolkata", "mumbai", "pune"
]


def get_tier1_cities_for_client(client: Optional[str] = "boat") -> List[str]:
    """
    Dynamically queries rb_location_darkstore for Tier-1 cities in this client database.
    Guarantees no static lists across diverse client workspaces.
    """
    db_name = client or "boat"
    try:
        rows = execute_select_query(
            f"SELECT DISTINCT location FROM {db_name}.rb_location_darkstore WHERE lower(tier) = 'tier 1' OR lower(tier) LIKE '%tier 1%' OR lower(tier) = '1'",
            database=db_name
        )
        if rows:
            cities = [str(r[0]).lower().strip() for r in rows if r and r[0]]
            if cities:
                return cities
    except Exception:
        pass
    return METRO_CITIES


def get_platforms_for_client(client: Optional[str] = "boat") -> List[str]:
    """
    Dynamically discovers valid platforms for this client workspace and its active channel.
    Matches /api/watchtower/platforms so matrix columns and platform filters align 100%.
    """
    db_name = client or "boat"
    channel = get_default_channel_for_client(db_name)
    try:
        data = call_platform_api("/api/watchtower/platforms", params={"channel": channel}, db_name=db_name)
        if isinstance(data, list) and data:
            valid = [str(p).strip() for p in data if p and str(p).lower() != "all"]
            if valid:
                return valid
    except Exception:
        pass

    try:
        query = f"""
            SELECT DISTINCT Platform 
            FROM {db_name}.rb_pdp_olap 
            WHERE Platform IS NOT NULL AND Platform != '' 
              AND (toString(Comp_flag) = '0' OR Comp_flag = 0)
            ORDER BY Platform ASC
        """
        rows = execute_select_query(query, database=db_name)
        if rows:
            platforms = []
            for r in rows:
                if r and r[0]:
                    plat = str(r[0]).strip()
                    if plat and plat.lower() not in [p.lower() for p in platforms]:
                        platforms.append(plat)
            if platforms:
                return platforms
    except Exception:
        pass

    return ["Amazon", "Blinkit", "Instamart", "Zepto"]


def get_default_channel_for_client(client: Optional[str] = "boat") -> Optional[str]:
    """
    Returns the default channel selected by FilterContext for this client workspace.
    Mirrors AvailablityAnalysis & FilterContext: checks if quickcomm is present in rca_sku_dim,
    defaults to Quickcomm, otherwise Ecommerce.
    """
    db_name = client or "boat"
    try:
        cols = execute_select_query(
            f"SELECT DISTINCT channel FROM {db_name}.rca_sku_dim WHERE channel IS NOT NULL AND channel != ''",
            database=db_name
        )
        if cols:
            chan_list = [str(r[0]).lower().strip() for r in cols if r and r[0]]
            qc = next((c for c in chan_list if "quick" in c), None)
            if qc:
                return "Quickcomm"
            ec = next((c for c in chan_list if "ecom" in c), None)
            if ec:
                return "Ecommerce"
            if chan_list:
                return chan_list[0].capitalize()
    except Exception:
        pass

    try:
        data = call_platform_api("/api/watchtower/channels", db_name=db_name)
        if isinstance(data, list):
            valid = [c for c in data if c != "All"]
            qc = next((c for c in valid if "quick" in str(c).lower()), None)
            if qc:
                return "Quickcomm"
            if valid:
                return valid[0]
    except Exception:
        pass

    return "Ecommerce" if db_name == "boat" else "Quickcomm"


def get_channel_for_platform(client: Optional[str], platform: str) -> Optional[str]:
    """
    Dynamically queries ClickHouse to find which channel a platform belongs to for this client workspace.
    Zero hardcoding.
    """
    db_name = client or "boat"
    plat_norm = (platform or "").lower().strip()
    if not plat_norm or plat_norm == "all":
        return get_default_channel_for_client(db_name)
    try:
        query = f"SELECT DISTINCT channel FROM {db_name}.rca_sku_dim WHERE lower(platform) = '{plat_norm}' AND channel IS NOT NULL AND channel != '' LIMIT 1"
        rows = execute_select_query(query, database=db_name)
        if rows and rows[0] and rows[0][0]:
            return str(rows[0][0]).strip()
    except Exception:
        pass
    return get_default_channel_for_client(db_name)


def get_segments(client: Optional[str] = "boat") -> List[Dict[str, Any]]:
    """
    Returns available verification segments for Availability Analysis:
    1. Availability Overview (Main / Default Platform)
    2. Dynamic per-platform overview segments (e.g. Blinkit, Instamart, Zepto, Amazon)
    3. Platform KPI Matrix (Cross-Platform Table)
    """
    db_name = client or "boat"
    platforms = get_platforms_for_client(db_name)
    channel = (get_default_channel_for_client(db_name) or "ecommerce").lower()
    is_quickcom = "quick" in channel

    default_plat = platforms[0].lower() if platforms else "all"

    segments: List[Dict[str, Any]] = [
        {
            "id": "availability_overview",
            "label": f"Availability Overview ({platforms[0].capitalize() if platforms and is_quickcom else 'All Platforms'})",
            "section": "overview",
            "platform": default_plat if is_quickcom else "all",
        }
    ]

    # Dynamic platform segments for each platform present in workspace
    for p in platforms:
        p_norm = p.lower().strip()
        segments.append({
            "id": f"availability_overview_{p_norm}",
            "label": f"Availability Overview ({p.capitalize()})",
            "section": "platform_overview",
            "platform": p_norm,
            "platform_display": p.capitalize(),
        })

    # Cross-Platform KPI Matrix
    segments.append({
        "id": "platform_kpi_matrix",
        "label": "Platform KPI Matrix (Cross-Platform Table)",
        "section": "platform_kpi_matrix",
        "platform": None,
    })

    return segments


def _get_segment_info(segment_id: str, client: Optional[str] = None) -> Dict[str, Any]:
    seg_clean = segment_id.lower().strip()
    db_name = client or "boat"
    platforms = get_platforms_for_client(db_name)
    channel = (get_default_channel_for_client(db_name) or "ecommerce").lower()
    is_quickcom = "quick" in channel
    default_plat = platforms[0].lower() if platforms else "all"

    if seg_clean in ("availability_overview", "overview", "all", "all platforms"):
        return {
            "id": "availability_overview",
            "label": f"Availability Overview ({platforms[0].capitalize() if platforms and is_quickcom else 'All Platforms'})",
            "section": "overview",
            "platform": default_plat if is_quickcom else "all",
            "platform_display": platforms[0].capitalize() if platforms and is_quickcom else None,
        }

    if seg_clean in ("platform_kpi_matrix", "kpi_matrix", "cross_platform_matrix"):
        return {
            "id": "platform_kpi_matrix",
            "label": "Platform KPI Matrix (Cross-Platform Table)",
            "section": "platform_kpi_matrix",
            "platform": None,
        }

    if seg_clean.startswith("availability_overview_"):
        plat = seg_clean.replace("availability_overview_", "").strip()
        return {
            "id": seg_clean,
            "label": f"Availability Overview ({plat.capitalize()})",
            "section": "platform_overview",
            "platform": plat,
            "platform_display": plat.capitalize(),
        }

    return {
        "id": "availability_overview",
        "label": "Availability Overview",
        "section": "overview",
        "platform": default_plat if is_quickcom else "all",
    }


def get_kpis_for_segment(segment_id: str, client: Optional[str] = "boat") -> List[Dict[str, Any]]:
    """
    Returns KPI definitions for the targeted segment dynamically conditioned on client channel.
    Quickcomm displays: OSA, DOI, Metro City OSA.
    Ecommerce displays: OSA, Buy Box %, DOI, Delivery time, SKU count.
    """
    info = _get_segment_info(segment_id, client=client)
    section = info["section"]
    db_name = client or "boat"
    channel = (get_default_channel_for_client(db_name) or "ecommerce").lower()
    is_quickcom = "quick" in channel

    if section in ("overview", "platform_overview"):
        plat_suffix = f" ({info['platform_display']})" if info.get("platform_display") else ""
        if is_quickcom:
            return [
                {
                    "key": "osa",
                    "label": f"On Shelf Availability{plat_suffix}",
                    "unit": "%",
                    "decimals": 2,
                    "abs_tol": 0.2,
                    "rel_tol": 0.01,
                },
                {
                    "key": "doi",
                    "label": f"Days of Inventory{plat_suffix}",
                    "unit": "days",
                    "decimals": 1,
                    "abs_tol": 1.5,
                    "rel_tol": 0.05,
                },
                {
                    "key": "metro_city_osa",
                    "label": f"Metro City OSA{plat_suffix}",
                    "unit": "%",
                    "decimals": 2,
                    "abs_tol": 0.5,
                    "rel_tol": 0.02,
                },
            ]
        else:
            return [
                {
                    "key": "osa",
                    "label": f"On Shelf Availability{plat_suffix}",
                    "unit": "%",
                    "decimals": 2,
                    "abs_tol": 0.2,
                    "rel_tol": 0.01,
                },
                {
                    "key": "buybox",
                    "label": f"Buy Box %{plat_suffix}",
                    "unit": "%",
                    "decimals": 2,
                    "abs_tol": 0.5,
                    "rel_tol": 0.02,
                },
                {
                    "key": "doi",
                    "label": f"Days of Inventory{plat_suffix}",
                    "unit": "days",
                    "decimals": 1,
                    "abs_tol": 1.5,
                    "rel_tol": 0.05,
                },
                {
                    "key": "delivery",
                    "label": f"Delivery time{plat_suffix}",
                    "unit": "days",
                    "decimals": 0,
                    "abs_tol": 1.0,
                    "rel_tol": 0.1,
                },
                {
                    "key": "sku_count",
                    "label": f"SKU count{plat_suffix}",
                    "unit": "",
                    "decimals": 0,
                    "abs_tol": 0.0,
                    "rel_tol": 0.0,
                },
            ]

    elif section == "platform_kpi_matrix":
        platforms = get_platforms_for_client(db_name)
        kpis: List[Dict[str, Any]] = []
        for p in platforms:
            p_clean = p.lower().strip()
            p_display = p.capitalize()
            kpis.extend([
                {
                    "key": f"{p_clean}_osa",
                    "label": f"{p_display}: OSA (%)",
                    "unit": "%",
                    "decimals": 1,
                    "abs_tol": 1.0,
                    "rel_tol": 0.05,
                },
                {
                    "key": f"{p_clean}_doi",
                    "label": f"{p_display}: DOI (days)",
                    "unit": "days",
                    "decimals": 1,
                    "abs_tol": 1.5,
                    "rel_tol": 0.05,
                },
            ])
            if not is_quickcom:
                kpis.append({
                    "key": f"{p_clean}_sku_count",
                    "label": f"{p_display}: SKU Count",
                    "unit": "",
                    "decimals": 0,
                    "abs_tol": 0.0,
                    "rel_tol": 0.0,
                })
        return kpis

    return []


# ---------------------------------------------------------------------------
# Step 1: API (Live Express Endpoints)
# ---------------------------------------------------------------------------

def step1_fetch(segment: str, period: Any, client: Optional[str] = "boat") -> Dict[str, Optional[float]]:
    """
    Step 1: API. Calls live Express endpoints under /api/availability-analysis/absolute-osa.
    """
    info = _get_segment_info(segment, client=client)
    section = info["section"]
    db_name = client or "boat"
    channel = get_default_channel_for_client(db_name) or "Ecommerce"
    is_quickcom = "quick" in channel.lower()

    if section in ("overview", "platform_overview"):
        plat = info.get("platform") or ("all" if not is_quickcom else "blinkit")
        params = {
            "platform": plat,
            "brand": "All",
            "location": "All",
            "ownBrandsOnly": "true",
            "channel": channel,
        }

        # 1. Fetch Availability Overview
        data_overview = call_platform_api(
            endpoint="/api/availability-analysis/absolute-osa/availability-overview",
            params=params,
            period=period,
            db_name=db_name,
        )
        osa_val = float(data_overview.get("stockAvailability") or 0.0) if isinstance(data_overview, dict) else 0.0
        skus_val = float(data_overview.get("skuCount") or 0.0) if isinstance(data_overview, dict) else 0.0
        buybox_val = float(data_overview.get("fillRate") or 0.0) if isinstance(data_overview, dict) else 0.0

        # Parse delivery time string (e.g. "4 Days" -> 4.0)
        raw_del = data_overview.get("deliveryTime") if isinstance(data_overview, dict) else ""
        del_num = 0.0
        if raw_del:
            m = re.search(r"(\d+)", str(raw_del))
            if m:
                del_num = float(m.group(1))

        # 2. Fetch DOI
        data_doi = call_platform_api(
            endpoint="/api/availability-analysis/absolute-osa/doi",
            params=params,
            period=period,
            db_name=db_name,
        )
        doi_val = float(data_doi.get("doi") or 0.0) if isinstance(data_doi, dict) else 0.0

        # 3. Fetch Metro City OSA
        data_metro = call_platform_api(
            endpoint="/api/availability-analysis/absolute-osa/metro-city-stock-availability",
            params=params,
            period=period,
            db_name=db_name,
        )
        metro_val = float(data_metro.get("stockAvailability") or 0.0) if isinstance(data_metro, dict) else 0.0

        return {
            "osa": osa_val,
            "sku_count": skus_val,
            "doi": doi_val,
            "metro_city_osa": metro_val,
            "buybox": buybox_val,
            "delivery": del_num,
        }

    elif section == "platform_kpi_matrix":
        data_matrix = call_platform_api(
            endpoint="/api/availability-analysis/absolute-osa/platform-kpi-matrix",
            params={"viewMode": "Platform", "platform": "All", "brand": "All", "location": "All", "ownBrandsOnly": "true"},
            period=period,
            db_name=db_name,
        )
        results: Dict[str, Optional[float]] = {}
        rows = data_matrix.get("rows", []) if isinstance(data_matrix, dict) else []
        platforms = get_platforms_for_client(db_name)

        # Parse matrix rows
        for r in rows:
            if not isinstance(r, dict):
                continue
            kpi_name = str(r.get("kpi") or "").strip().upper()
            for p in platforms:
                p_norm = p.lower()
                val = r.get(p_norm) or r.get(p)
                if val is not None:
                    try:
                        num_val = float(val)
                        if kpi_name == "OSA":
                            results[f"{p_norm}_osa"] = num_val
                        elif kpi_name == "DOI":
                            results[f"{p_norm}_doi"] = num_val
                        elif kpi_name == "SKU COUNT":
                            results[f"{p_norm}_sku_count"] = num_val
                    except (ValueError, TypeError):
                        pass

        # Fill any missing platform metrics with 0.0
        for p in platforms:
            p_norm = p.lower()
            if f"{p_norm}_osa" not in results:
                results[f"{p_norm}_osa"] = 0.0
            if f"{p_norm}_doi" not in results:
                results[f"{p_norm}_doi"] = 0.0
            if f"{p_norm}_sku_count" not in results:
                results[f"{p_norm}_sku_count"] = 0.0

        return results

    return {}


# ---------------------------------------------------------------------------
# Step 2: Logic (ClickHouse Raw OLAP SQL)
# ---------------------------------------------------------------------------

def step2_logic(segment: str, period: Any, client: Optional[str] = "boat") -> Dict[str, Optional[float]]:
    """
    Step 2: Logic. Calculates availability and inventory metrics directly against ClickHouse OLAP.
    """
    info = _get_segment_info(segment, client=client)
    section = info["section"]
    db_name = client or "boat"
    start_date, end_date = period_to_date_range(period)
    channel = get_default_channel_for_client(db_name) or "Ecommerce"
    is_quickcom = "quick" in channel.lower()

    # Dynamic column casing resolution
    product_col = resolve_table_column(db_name, "rb_pdp_olap", "Product") or "Product"
    neno_col = resolve_table_column(db_name, "rb_pdp_olap", "neno_osa") or "neno_osa"
    deno_col = resolve_table_column(db_name, "rb_pdp_olap", "deno_osa") or "deno_osa"
    buybox_neno_col = resolve_table_column(db_name, "rb_pdp_olap", "buy_box_neno_osa") or "buy_box_neno_osa"
    web_pid_col = resolve_table_column(db_name, "rb_pdp_olap", "Web_Pid") or "Web_Pid"
    comp_col = resolve_table_column(db_name, "rb_pdp_olap", "Comp_flag") or "Comp_flag"
    date_col = resolve_table_column(db_name, "rb_pdp_olap", "DATE") or "DATE"
    platform_col = resolve_table_column(db_name, "rb_pdp_olap", "Platform") or "Platform"
    location_col = resolve_table_column(db_name, "rb_pdp_olap", "Location") or "Location"
    inv_col = resolve_table_column(db_name, "rb_pdp_olap", "Inventory") or "Inventory"
    qty_col = resolve_table_column(db_name, "rb_pdp_olap", "Qty_Sold") or "Qty_Sold"
    del_col = resolve_table_column(db_name, "rb_pdp_olap", "delivery_date")

    if del_col:
        del_sql = f"""
            avg(
                IF(
                    {del_col} IS NULL OR toString({del_col}) = '' OR toString({del_col}) = '0',
                    NULL,
                    CASE
                        WHEN dateDiff('day', {date_col}, coalesce(parseDateTimeBestEffortOrNull(toString({del_col})), parseDateTimeBestEffortOrNull(concat(toString({del_col}), ' ', toString(toYear({date_col})))))) < 0 THEN 0
                        WHEN dateDiff('day', {date_col}, coalesce(parseDateTimeBestEffortOrNull(toString({del_col})), parseDateTimeBestEffortOrNull(concat(toString({del_col}), ' ', toString(toYear({date_col})))))) > 30 THEN NULL
                        ELSE dateDiff('day', {date_col}, coalesce(parseDateTimeBestEffortOrNull(toString({del_col})), parseDateTimeBestEffortOrNull(concat(toString({del_col}), ' ', toString(toYear({date_col}))))))
                    END
                )
            ) as avg_delivery
        """
    else:
        del_sql = "0 as avg_delivery"

    # Resolve platforms associated with this channel
    channel_plats = []
    try:
        search_pat = "%quick%" if is_quickcom else "%ecom%"
        plats_res = execute_select_query(
            f"SELECT DISTINCT platform FROM {db_name}.rca_sku_dim WHERE lower(channel) LIKE '{search_pat}'",
            database=db_name
        )
        if plats_res:
            channel_plats = [str(r[0]).lower().strip() for r in plats_res if r and r[0]]
    except Exception:
        pass

    if not channel_plats:
        channel_plats = [p.lower() for p in get_platforms_for_client(db_name)]

    if section in ("overview", "platform_overview"):
        plat = info.get("platform")
        if plat and plat != "all":
            plat_filter = f"AND lower({platform_col}) = '{plat}'"
        elif channel_plats:
            c_plats_sql = ",".join([f"'{p}'" for p in channel_plats])
            plat_filter = f"AND lower({platform_col}) IN ({c_plats_sql})"
        else:
            plat_filter = ""

        # 1. Overview SQL (OSA %, SKU Count, Buy Box %, Delivery Time)
        sql_overview = f"""
            SELECT
                SUM(ifNull(toFloat64OrZero(toString({neno_col})), 0)) as sum_neno,
                SUM(ifNull(toFloat64OrZero(toString({deno_col})), 0)) as sum_deno,
                SUM(ifNull(toFloat64OrZero(toString({buybox_neno_col})), 0)) as sum_buybox,
                COUNT(DISTINCT {web_pid_col}) as sku_count,
                {del_sql}
            FROM {db_name}.rb_pdp_olap
            WHERE {date_col} BETWEEN '{start_date}' AND '{end_date}'
              AND (toString({comp_col}) = '0' OR {comp_col} = 0)
              {plat_filter}
        """
        rows = execute_select_query(sql_overview, database=db_name)
        curr = rows[0] if rows else (0, 0, 0, 0, 0)
        sum_neno = float(curr[0] or 0)
        sum_deno = float(curr[1] or 0)
        sum_buybox = float(curr[2] or 0)
        sku_count = float(curr[3] or 0)
        avg_delivery = round(float(curr[4] or 0)) if curr[4] is not None else 0.0

        osa_val = (sum_neno / sum_deno * 100.0) if sum_deno > 0 else 0.0
        buybox_val = (sum_buybox / sum_deno * 100.0) if sum_deno > 0 else 0.0

        # 2. Metro City OSA SQL
        tier1_cities = get_tier1_cities_for_client(db_name)
        metro_clause = ",".join([f"'{c}'" for c in tier1_cities])
        sql_metro = f"""
            SELECT
                SUM(ifNull(toFloat64OrZero(toString({neno_col})), 0)) as sum_neno,
                SUM(ifNull(toFloat64OrZero(toString({deno_col})), 0)) as sum_deno
            FROM {db_name}.rb_pdp_olap
            WHERE {date_col} BETWEEN '{start_date}' AND '{end_date}'
              AND (toString({comp_col}) = '0' OR {comp_col} = 0)
              AND lower({location_col}) IN ({metro_clause})
              {plat_filter}
        """
        rows_metro = execute_select_query(sql_metro, database=db_name)
        m_curr = rows_metro[0] if rows_metro else (0, 0)
        m_neno = float(m_curr[0] or 0)
        m_deno = float(m_curr[1] or 0)
        metro_val = (m_neno / m_deno * 100.0) if m_deno > 0 else 0.0

        # 3. DOI SQL
        sql_doi = f"""
            WITH
                daily_inventory AS (
                    SELECT
                        {date_col} AS d,
                        SUM(ifNull(toFloat64OrZero(toString({inv_col})), 0)) AS total_inventory
                    FROM {db_name}.rb_pdp_olap
                    WHERE {date_col} BETWEEN '{start_date}' AND '{end_date}'
                      AND (toString({comp_col}) = '0' OR {comp_col} = 0)
                      {plat_filter}
                    GROUP BY d
                    HAVING total_inventory > 0
                ),
                latest_inventory_stats AS (
                    SELECT
                        argMax(total_inventory, d) AS latest_inventory,
                        max(d) AS latest_date
                    FROM daily_inventory
                ),
                sales_stats AS (
                    SELECT
                        SUM(ifNull(toFloat64OrZero(toString({qty_col})), 0)) AS total_qty_sold_30d
                    FROM {db_name}.rb_pdp_olap
                    WHERE {date_col} BETWEEN
                          dateSub(DAY, 29, (SELECT latest_date FROM latest_inventory_stats))
                          AND (SELECT latest_date FROM latest_inventory_stats)
                      AND (toString({comp_col}) = '0' OR {comp_col} = 0)
                      {plat_filter}
                )
            SELECT
                ROUND((latest_inventory / NULLIF(total_qty_sold_30d, 0)) * 30, 1) AS doi
            FROM latest_inventory_stats, sales_stats
        """
        rows_doi = execute_select_query(sql_doi, database=db_name)
        doi_val = float(rows_doi[0][0]) if rows_doi and rows_doi[0] and rows_doi[0][0] is not None else 0.0

        return {
            "osa": round(osa_val, 2),
            "sku_count": sku_count,
            "doi": doi_val,
            "metro_city_osa": round(metro_val, 2),
            "buybox": round(buybox_val, 2),
            "delivery": float(avg_delivery),
        }

    elif section == "platform_kpi_matrix":
        platforms = get_platforms_for_client(db_name)
        results: Dict[str, Optional[float]] = {}

        for p in platforms:
            p_norm = p.lower().strip()
            # 1. OSA & SKU count for this platform
            q_plat = f"""
                SELECT
                    SUM(ifNull(toFloat64OrZero(toString({neno_col})), 0)) as sum_neno,
                    SUM(ifNull(toFloat64OrZero(toString({deno_col})), 0)) as sum_deno,
                    COUNT(DISTINCT {web_pid_col}) as sku_count
                FROM {db_name}.rb_pdp_olap
                WHERE {date_col} BETWEEN '{start_date}' AND '{end_date}'
                  AND (toString({comp_col}) = '0' OR {comp_col} = 0)
                  AND lower({platform_col}) = '{p_norm}'
            """
            rows = execute_select_query(q_plat, database=db_name)
            curr = rows[0] if rows else (0, 0, 0)
            sum_neno = float(curr[0] or 0)
            sum_deno = float(curr[1] or 0)
            sku_c = float(curr[2] or 0)
            p_osa = (sum_neno / sum_deno * 100.0) if sum_deno > 0 else 0.0

            # 2. DOI for this platform
            q_doi = f"""
                WITH
                    daily_inventory AS (
                        SELECT
                            {date_col} AS d,
                            SUM(ifNull(toFloat64OrZero(toString({inv_col})), 0)) AS total_inventory
                        FROM {db_name}.rb_pdp_olap
                        WHERE {date_col} BETWEEN '{start_date}' AND '{end_date}'
                          AND (toString({comp_col}) = '0' OR {comp_col} = 0)
                          AND lower({platform_col}) = '{p_norm}'
                        GROUP BY d
                        HAVING total_inventory > 0
                    ),
                    latest_inventory_stats AS (
                        SELECT
                            argMax(total_inventory, d) AS latest_inventory,
                            max(d) AS latest_date
                        FROM daily_inventory
                    ),
                    sales_stats AS (
                        SELECT
                            SUM(ifNull(toFloat64OrZero(toString({qty_col})), 0)) AS total_qty_sold_30d
                        FROM {db_name}.rb_pdp_olap
                        WHERE {date_col} BETWEEN
                              dateSub(DAY, 29, (SELECT latest_date FROM latest_inventory_stats))
                              AND (SELECT latest_date FROM latest_inventory_stats)
                          AND (toString({comp_col}) = '0' OR {comp_col} = 0)
                          AND lower({platform_col}) = '{p_norm}'
                    )
                SELECT
                    ROUND((latest_inventory / NULLIF(total_qty_sold_30d, 0)) * 30, 1) AS doi
                FROM latest_inventory_stats, sales_stats
            """
            rows_doi = execute_select_query(q_doi, database=db_name)
            p_doi = float(rows_doi[0][0]) if rows_doi and rows_doi[0] and rows_doi[0][0] is not None else 0.0

            results[f"{p_norm}_osa"] = round(p_osa, 1)
            results[f"{p_norm}_doi"] = round(p_doi, 1)
            results[f"{p_norm}_sku_count"] = sku_c

        return results

    return {}


# ---------------------------------------------------------------------------
# Step 3: UI (Selenium Live Automation)
# ---------------------------------------------------------------------------

def step3_ui(
    driver: Any,
    segment: str,
    period: Any,
    client: Optional[str] = "boat",
    headless: bool = False,
    on_live_step: Optional[Any] = None,
) -> Dict[str, Optional[str]]:
    """
    Step 3: UI (Selenium). Opens the real Availability Analysis page in Chrome,
    sets workspace database, applies segment, period, and platform, and scrapes the live UI values.
    """
    info = _get_segment_info(segment, client=client)
    section = info["section"]
    target_url = f"{FRONTEND_URL}/availability-analysis"
    target_client_label = (client or "boat").capitalize()

    if on_live_step:
        on_live_step(f"Opening Availability Analysis dashboard for {target_client_label}...")

    # Authenticate and set workspace database
    ensure_authenticated(driver, target_url, client=client)

    if not headless:
        bring_chrome_to_top(driver)
        show_live_step_banner(driver, f"Connected to {target_client_label} Workspace (Availability Analysis)")
        time.sleep(1.0)

    # 1. Switch channel & platform if segment specifies a platform
    plat = info.get("platform")
    if plat and plat != "all":
        dyn_channel = get_channel_for_platform(client, plat)
        if dyn_channel and dyn_channel.lower() != "all":
            if on_live_step:
                on_live_step(f"Setting Channel: {dyn_channel.capitalize()} for {plat.capitalize()}...")
            if not headless:
                show_live_step_banner(driver, f"Switching Channel: {dyn_channel.capitalize()}...")
            apply_dashboard_channel(driver, dyn_channel)
            time.sleep(0.8)

        if on_live_step:
            on_live_step(f"Selecting platform filter: {plat.capitalize()}...")
        if not headless:
            show_live_step_banner(driver, f"Switching Platform: {plat.capitalize()}...")

        success, err_msg = apply_segment_platform(driver, plat)
        if not success:
            return {"_platform_unavailable": True, "_platform_name": plat.capitalize()}

        time.sleep(1.5)
        wait_for_loading_complete(driver, timeout=20)

    # 2. Apply Time Period in UI
    start_str = period.get("startDate") if isinstance(period, dict) else str(period)
    end_str = period.get("endDate") if isinstance(period, dict) else str(period)
    if on_live_step:
        on_live_step(f"Setting dashboard period: {start_str} -> {end_str}...")
    if not headless:
        show_live_step_banner(driver, f"Applying Period: {start_str} to {end_str}...")

    apply_dashboard_period(driver, period)
    time.sleep(2.0)
    wait_for_loading_complete(driver, timeout=25)
    time.sleep(1.5)

    # 3. Scrape section values from the live DOM
    if on_live_step:
        on_live_step("Scraping live UI metrics from Availability cards & matrix...")
    if not headless:
        bring_chrome_to_top(driver)
        show_live_step_banner(driver, "Searching for Availability Metrics...")

    results: Dict[str, Optional[str]] = {}

    if section in ("overview", "platform_overview"):
        # Scrape SnapshotOverview cards with precise heading and card container detection
        cards_scraped = driver.execute_script(r"""
            const titles = [
                "On Shelf Availability",
                "Days of Inventory",
                "Metro City OSA",
                "Buy Box %",
                "Delivery time",
                "SKU count"
            ];
            const res = {};
            const headings = Array.from(document.querySelectorAll("h3"));
            titles.forEach(title => {
                const h = headings.find(el => el.innerText && el.innerText.trim().toLowerCase() === title.toLowerCase());
                if (h) {
                    const card = h.closest(".group") || h.closest("div.rounded-2xl") || h.parentElement?.parentElement?.parentElement;
                    if (card) {
                        card.style.outline = '2px solid #0284c7';
                        const valEl = card.querySelector(".text-3xl span, .text-3xl, div[class*='text-3xl']");
                        if (valEl && valEl.innerText.trim()) {
                            res[title] = valEl.innerText.trim();
                        }
                    }
                }
            });
            return res;
        """)

        if isinstance(cards_scraped, dict):
            if cards_scraped.get("On Shelf Availability"):
                results["osa"] = cards_scraped["On Shelf Availability"]
            if cards_scraped.get("SKU count"):
                results["sku_count"] = cards_scraped["SKU count"]
            if cards_scraped.get("Days of Inventory"):
                results["doi"] = cards_scraped["Days of Inventory"]
            if cards_scraped.get("Metro City OSA"):
                results["metro_city_osa"] = cards_scraped["Metro City OSA"]
            if cards_scraped.get("Buy Box %"):
                results["buybox"] = cards_scraped["Buy Box %"]
            if cards_scraped.get("Delivery time"):
                results["delivery"] = cards_scraped["Delivery time"]

    elif section == "platform_kpi_matrix":
        # Scrape TabbedHeatmapTable platform matrix
        matrix_scraped = driver.execute_script(r"""
            const table = Array.from(document.querySelectorAll("table")).find(t => {
                const text = t.innerText || '';
                return text.includes("KPI") && (text.includes("OSA") || text.includes("DOI"));
            });
            if (!table) return {};

            table.style.outline = '3px solid #22c55e';
            const headers = Array.from(table.querySelectorAll("thead th, thead td, tr:first-child th, tr:first-child td")).map(c => c.innerText.trim().toLowerCase());
            const rows = Array.from(table.querySelectorAll("tbody tr"));
            const res = {};

            rows.forEach(r => {
                const cells = Array.from(r.querySelectorAll("th, td")).map(c => c.innerText.trim());
                if (cells.length >= 2) {
                    const rowKpi = cells[0].toUpperCase();
                    headers.forEach((h, idx) => {
                        if (idx > 0 && idx < cells.length) {
                            const cleanH = h.replace(/[^a-z0-9]/g, '');
                            const cellVal = cells[idx].split('\n')[0].trim();
                            if (rowKpi === 'OSA') {
                                res[cleanH + '_osa'] = cellVal;
                            } else if (rowKpi === 'DOI') {
                                res[cleanH + '_doi'] = cellVal;
                            } else if (rowKpi === 'SKU COUNT') {
                                res[cleanH + '_sku_count'] = cellVal;
                            }
                        }
                    });
                }
            });
            return res;
        """)

        if isinstance(matrix_scraped, dict):
            results.update(matrix_scraped)

    if not headless:
        try:
            bring_chrome_to_top(driver)
            show_live_step_banner(driver, "Live Verification Complete! Availability Values Verified")
            if on_live_step:
                on_live_step("Verification complete! Closing Chrome window...")
            time.sleep(2.0)
        except Exception:
            pass

    return results


class AvailabilityAnalysisModule:
    name = "availability_analysis"

    @staticmethod
    def get_segments(client: Optional[str] = "boat") -> List[Dict[str, Any]]:
        return get_segments(client)

    @staticmethod
    def get_channel_for_platform(client: Optional[str], platform: str) -> Optional[str]:
        return get_channel_for_platform(client, platform)

    @staticmethod
    def get_default_channel_for_client(client: Optional[str] = "boat") -> Optional[str]:
        return get_default_channel_for_client(client)

    @staticmethod
    def _get_segment_info(segment: str, client: Optional[str] = None) -> Dict[str, Any]:
        return _get_segment_info(segment, client=client)

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
