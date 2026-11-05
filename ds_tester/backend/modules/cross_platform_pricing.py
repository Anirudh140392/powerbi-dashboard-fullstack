import os
import time
from datetime import datetime
from typing import Dict, Any, List, Optional

from ..step1_api import call_platform_api
from ..step2_logic import execute_select_query, period_to_date_range, resolve_table_column
from ..step3_selenium import (
    FRONTEND_URL,
    ensure_authenticated,
    apply_dashboard_period,
    wait_for_loading_complete,
    bring_chrome_to_top,
    show_live_step_banner,
    highlight_element,
)


def get_tier1_cities_for_client(client: Optional[str] = "boat") -> List[Dict[str, str]]:
    """
    Dynamically fetches distinct Tier-1 cities from ClickHouse rb_location_darkstore for this client.
    Ensures newly added darkstore locations appear automatically without code changes.
    """
    db_name = client or "boat"
    try:
        query = f"""
            SELECT DISTINCT location 
            FROM {db_name}.rb_location_darkstore 
            WHERE lower(tier) IN ('tier 1', 'tier-1', '1') 
            ORDER BY location ASC
        """
        rows = execute_select_query(query, database=db_name)
        if rows:
            cities = []
            for r in rows:
                if not r or not r[0]:
                    continue
                loc_raw = str(r[0]).strip()
                norm = loc_raw.lower()
                display = loc_raw.capitalize()
                if norm == "bengaluru":
                    display = "Bangalore"
                cities.append({"name": display, "rawName": norm})
            if cities:
                return cities
    except Exception:
        pass

    # If rb_location_darkstore has no tier column, query distinct locations from rb_pdp_olap
    try:
        query = f"SELECT DISTINCT Location FROM {db_name}.rb_pdp_olap WHERE Location IS NOT NULL AND Location != '' LIMIT 10"
        rows = execute_select_query(query, database=db_name)
        if rows:
            return [{"name": str(r[0]).strip().capitalize(), "rawName": str(r[0]).strip().lower()} for r in rows if r and r[0]]
    except Exception:
        pass

    return []


def get_segments(client: Optional[str] = "boat") -> List[Dict[str, Any]]:
    """
    Returns the two primary segments for Cross Platform Pricing:
    1. City Breach Overview (Tier-1 Summary): Validates the top city summary pills and monitored cities.
    2. SKU Pricing & Guardrail Matrix (All Cities - Live Tour): Runs the complete live tour across all cities.
    """
    return [
        {
            "id": "city_breach_overview",
            "label": "City Breach Overview (Tier-1 Summary)",
            "section": "city_overview",
            "city": None,
        },
        {
            "id": "sku_matrix",
            "label": "SKU Pricing & Guardrail Matrix (All Cities - Live Tour)",
            "section": "all_cities_matrix",
            "city": None,
        },
    ]


def _get_segment_info(segment_id: str, client: Optional[str] = None) -> Dict[str, Any]:
    seg_clean = segment_id.lower().strip()
    if seg_clean in ("city_breach_overview", "city breach overview (tier-1 summary)"):
        return {
            "id": "city_breach_overview",
            "label": "City Breach Overview (Tier-1 Summary)",
            "section": "city_overview",
            "city": None,
        }
    if seg_clean in (
        "sku_matrix", 
        "sku pricing & guardrail matrix (all cities)", 
        "sku pricing & guardrail matrix (all cities - live tour)",
        "sku matrix (all cities - live tour)",
        "sku matrix (all cities)"
    ) or "all cities" in seg_clean:
        return {
            "id": "sku_matrix",
            "label": "SKU Pricing & Guardrail Matrix (All Cities - Live Tour)",
            "section": "all_cities_matrix",
            "city": None,
        }
    
    if seg_clean.startswith("city_"):
        raw_city = seg_clean.replace("city_", "").replace("_", " ").strip()
        display = raw_city.capitalize()
        if raw_city in ("bengaluru", "bangalore"):
            display = "Bangalore"
            raw_city = "bengaluru"
        return {
            "id": seg_clean,
            "label": f"SKU Matrix ({display})",
            "section": "city_sku_matrix",
            "city": display,
            "city_raw": raw_city,
        }

    return {
        "id": "city_breach_overview",
        "label": "City Breach Overview (Tier-1 Summary)",
        "section": "city_overview",
        "city": None,
    }


def get_kpis_for_segment(segment_id: str, client: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Returns KPI definitions dynamically.
    For city_breach_overview: returns total breaches plus individual city breach metrics.
    For all_cities_matrix: returns total tracked, total breaching, breach rate, and per-city metrics for all cities.
    For city_sku_matrix: returns total SKUs, breaching SKUs count, and breach rate for that city.
    """
    info = _get_segment_info(segment_id, client=client)
    section = info["section"]

    if section == "city_overview":
        cities = get_tier1_cities_for_client(client)
        kpis = [
            {
                "key": "total_breaches",
                "label": "Total Tier-1 Breaches",
                "unit": "",
                "decimals": 0,
                "abs_tol": 0.0,
                "rel_tol": 0.0,
            },
            {
                "key": "total_cities",
                "label": "Monitored Cities Count",
                "unit": "",
                "decimals": 0,
                "abs_tol": 0.0,
                "rel_tol": 0.0,
            },
        ]
        for c in cities:
            kpis.append({
                "key": f"{c['rawName']}_breaches",
                "label": f"{c['name']} Breaches",
                "unit": "",
                "decimals": 0,
                "abs_tol": 0.0,
                "rel_tol": 0.0,
            })
        return kpis

    elif section == "all_cities_matrix":
        cities = get_tier1_cities_for_client(client)
        kpis = [
            {
                "key": "active_platforms",
                "label": "Active Platforms Monitored",
                "unit": "",
                "decimals": 0,
                "abs_tol": 0.0,
                "rel_tol": 0.0,
            },
            {
                "key": "total_tracked_skus",
                "label": "Total Tracked SKUs (All Cities)",
                "unit": "",
                "decimals": 0,
                "abs_tol": 0.0,
                "rel_tol": 0.0,
            },
            {
                "key": "total_breaching_skus",
                "label": "Total Breaching SKUs (All Cities)",
                "unit": "",
                "decimals": 0,
                "abs_tol": 0.0,
                "rel_tol": 0.0,
            },
            {
                "key": "overall_breach_rate",
                "label": "Overall Breach Rate (%)",
                "unit": "%",
                "decimals": 1,
                "abs_tol": 0.1,
                "rel_tol": 0.01,
            },
        ]
        for c in cities:
            kpis.extend([
                {
                    "key": f"{c['rawName']}_tracked_skus",
                    "label": f"{c['name']}: Tracked SKUs",
                    "unit": "",
                    "decimals": 0,
                    "abs_tol": 0.0,
                    "rel_tol": 0.0,
                },
                {
                    "key": f"{c['rawName']}_breaching_skus",
                    "label": f"{c['name']}: Breaching SKUs",
                    "unit": "",
                    "decimals": 0,
                    "abs_tol": 0.0,
                    "rel_tol": 0.0,
                },
                {
                    "key": f"{c['rawName']}_breach_rate",
                    "label": f"{c['name']}: Breach Rate (%)",
                    "unit": "%",
                    "decimals": 1,
                    "abs_tol": 0.1,
                    "rel_tol": 0.01,
                },
            ])
        return kpis

    elif section == "city_sku_matrix":
        city_label = f" ({info['city']})" if info.get("city") else ""
        return [
            {
                "key": "active_platforms",
                "label": "Active Platforms Monitored",
                "unit": "",
                "decimals": 0,
                "abs_tol": 0.0,
                "rel_tol": 0.0,
            },
            {
                "key": "total_skus",
                "label": f"Tracked SKUs{city_label}",
                "unit": "",
                "decimals": 0,
                "abs_tol": 0.0,
                "rel_tol": 0.0,
            },
            {
                "key": "breaching_skus",
                "label": f"Breaching SKUs{city_label}",
                "unit": "",
                "decimals": 0,
                "abs_tol": 0.0,
                "rel_tol": 0.0,
            },
            {
                "key": "breach_rate",
                "label": f"Breach Rate{city_label}",
                "unit": "%",
                "decimals": 1,
                "abs_tol": 0.1,
                "rel_tol": 0.01,
            },
        ]

    return []


# ---------------------------------------------------------------------------
# Step 1: API
# ---------------------------------------------------------------------------

def step1_fetch(segment: str, period: Any, client: Optional[str] = "boat") -> Dict[str, Optional[float]]:
    """
    Step 1: API. Fetch cross-platform pricing data from Express endpoint GET /api/watchtower/cross-platform-pricing.
    """
    info = _get_segment_info(segment, client=client)
    section = info["section"]
    db_name = client or "boat"

    if section == "city_overview":
        data = call_platform_api(
            endpoint="/api/watchtower/cross-platform-pricing",
            period=period,
            db_name=db_name,
        )
        cities = data.get("cities", []) if isinstance(data, dict) else []
        total_breaches = sum(c.get("breaches", 0) for c in cities)

        results: Dict[str, Optional[float]] = {
            "total_breaches": float(total_breaches),
            "total_cities": float(len(cities)),
        }
        for c in cities:
            raw_name = str(c.get("rawName") or c.get("name") or "").lower().strip()
            if raw_name:
                results[f"{raw_name}_breaches"] = float(c.get("breaches", 0))

        return results

    elif section == "all_cities_matrix":
        cities = get_tier1_cities_for_client(client)
        results: Dict[str, Optional[float]] = {}
        tot_tracked = 0.0
        tot_breaching = 0.0
        plat_count: Optional[float] = None

        for c in cities:
            c_data = call_platform_api(
                endpoint="/api/watchtower/cross-platform-pricing",
                params={"location": c["name"]},
                period=period,
                db_name=db_name,
            )
            if plat_count is None and isinstance(c_data, dict):
                platforms = c_data.get("platforms", [])
                if platforms:
                    plat_count = float(len(platforms))

            c_skus = c_data.get("skus", []) if isinstance(c_data, dict) else []
            c_tot = float(len(c_skus))
            c_b = float(sum(1 for s in c_skus if s.get("hasBreach")))
            c_rate = (c_b / c_tot * 100.0) if c_tot > 0 else 0.0

            results[f"{c['rawName']}_tracked_skus"] = c_tot
            results[f"{c['rawName']}_breaching_skus"] = c_b
            results[f"{c['rawName']}_breach_rate"] = c_rate

            tot_tracked += c_tot
            tot_breaching += c_b

        if plat_count is None:
            c_data = call_platform_api(
                endpoint="/api/watchtower/cross-platform-pricing",
                period=period,
                db_name=db_name,
            )
            if isinstance(c_data, dict):
                plat_count = float(len(c_data.get("platforms", [])))

        results["active_platforms"] = plat_count if plat_count is not None else 0.0
        results["total_tracked_skus"] = tot_tracked
        results["total_breaching_skus"] = tot_breaching
        results["overall_breach_rate"] = (tot_breaching / tot_tracked * 100.0) if tot_tracked > 0 else 0.0

        return results

    else:
        # SKU Matrix (single city)
        api_params = {}
        if info.get("city"):
            api_params["location"] = info["city"]

        data = call_platform_api(
            endpoint="/api/watchtower/cross-platform-pricing",
            params=api_params,
            period=period,
            db_name=db_name,
        )
        skus = data.get("skus", []) if isinstance(data, dict) else []
        platforms = data.get("platforms", []) if isinstance(data, dict) else []
        total_skus = float(len(skus))
        breaching_skus = float(sum(1 for s in skus if s.get("hasBreach")))
        breach_rate = (breaching_skus / total_skus * 100.0) if total_skus > 0 else 0.0

        return {
            "active_platforms": float(len(platforms)),
            "total_skus": total_skus,
            "breaching_skus": breaching_skus,
            "breach_rate": breach_rate,
        }


# ---------------------------------------------------------------------------
# Step 2: Logic (ClickHouse Raw OLAP SQL)
# ---------------------------------------------------------------------------

def step2_logic(segment: str, period: Any, client: Optional[str] = "boat") -> Dict[str, Optional[float]]:
    """
    Step 2: Logic. Calculates cross-platform pricing and guardrail metrics directly against ClickHouse OLAP.
    """
    info = _get_segment_info(segment, client=client)
    section = info["section"]
    db_name = client or "boat"
    start_date, end_date = period_to_date_range(period)

    # Dynamic column casing resolution
    product_col = resolve_table_column(db_name, "rb_pdp_olap", "Product")
    location_col = resolve_table_column(db_name, "rb_pdp_olap", "Location")
    platform_col = resolve_table_column(db_name, "rb_pdp_olap", "Platform")
    mrp_col = resolve_table_column(db_name, "rb_pdp_olap", "MRP")
    sp_col = resolve_table_column(db_name, "rb_pdp_olap", "Selling_Price")
    comp_col = resolve_table_column(db_name, "rb_pdp_olap", "Comp_flag")
    date_col = resolve_table_column(db_name, "rb_pdp_olap", "DATE")

    tier1_cities = get_tier1_cities_for_client(db_name)
    tier1_clause = ",".join([f"'{c['rawName']}'" for c in tier1_cities]) if tier1_cities else "''"

    # Distinct platforms count from ClickHouse
    plat_conditions = [f"{platform_col} IS NOT NULL", f"{platform_col} != ''"]
    if comp_col:
        plat_conditions.append(f"(toString({comp_col}) = '0' OR {comp_col} = 0)")
    plat_query = f"SELECT countDistinct({platform_col}) FROM {db_name}.rb_pdp_olap WHERE {' AND '.join(plat_conditions)}"
    plat_rows = execute_select_query(plat_query, database=db_name)
    active_platforms_count = float(plat_rows[0][0]) if plat_rows and plat_rows[0] and plat_rows[0][0] is not None else 0.0

    if section == "city_overview":
        if not tier1_clause or tier1_clause == "''":
            return {"total_breaches": 0.0, "total_cities": 0.0}

        query = f"""
            SELECT 
                lower({location_col}) as loc,
                countDistinct({product_col}) as total_skus,
                countIf(
                    toFloat64OrZero(toString({mrp_col})) > 0 
                    AND toFloat64OrZero(toString({sp_col})) > 0 
                    AND (
                        ((toFloat64OrZero(toString({mrp_col})) - toFloat64OrZero(toString({sp_col}))) / NULLIF(toFloat64OrZero(toString({mrp_col})), 0) * 100) > 20 
                        OR ((toFloat64OrZero(toString({mrp_col})) - toFloat64OrZero(toString({sp_col}))) / NULLIF(toFloat64OrZero(toString({mrp_col})), 0) * 100) <= 0
                    )
                ) as breach_count
            FROM (
                SELECT 
                    {location_col}, 
                    {product_col}, 
                    {platform_col},
                    max(toFloat64OrZero(toString({mrp_col}))) as {mrp_col}, 
                    min(toFloat64OrZero(toString({sp_col}))) as {sp_col}
                FROM {db_name}.rb_pdp_olap
                WHERE {date_col} BETWEEN '{start_date}' AND '{end_date}'
                  AND (toString({comp_col}) = '0' OR {comp_col} = 0)
                GROUP BY {location_col}, {product_col}, {platform_col}
            )
            WHERE lower({location_col}) IN ({tier1_clause})
            GROUP BY loc
            ORDER BY breach_count DESC
        """
        rows = execute_select_query(query, database=db_name)
        breach_map = {str(r[0]).strip().lower(): float(r[2] or 0) for r in rows if r}

        total_breaches = sum(breach_map.values())
        results: Dict[str, Optional[float]] = {
            "total_breaches": float(total_breaches),
            "total_cities": float(len(tier1_cities)),
        }
        for c in tier1_cities:
            raw_c = c["rawName"]
            results[f"{raw_c}_breaches"] = breach_map.get(raw_c, 0.0)

        return results

    elif section == "all_cities_matrix":
        cities = get_tier1_cities_for_client(db_name)
        results: Dict[str, Optional[float]] = {}
        tot_tracked = 0.0
        tot_breaching = 0.0

        weight_col = resolve_table_column(db_name, "rb_pdp_olap", "weight") or "Weight"
        neno_osa_col = resolve_table_column(db_name, "rb_pdp_olap", "neno_osa") or "neno_osa"

        for c in cities:
            q = f"""
                SELECT 
                    {product_col} as product_name, 
                    {weight_col} as weight, 
                    {platform_col} as platform, 
                    max(toFloat64OrZero(toString({mrp_col}))) as mrp, 
                    min(toFloat64OrZero(toString({sp_col}))) as selling_price, 
                    max(toFloat64OrZero(toString({neno_osa_col}))) as neno_osa 
                FROM {db_name}.rb_pdp_olap 
                WHERE {product_col} IS NOT NULL AND {product_col} != '' 
                  AND (toString({comp_col}) = '0' OR {comp_col} = 0) 
                  AND {date_col} BETWEEN '{start_date}' AND '{end_date}'
                  AND lower({location_col}) = '{c['rawName']}'
                GROUP BY product_name, weight, platform 
                LIMIT 1000
            """
            rows = execute_select_query(q, database=db_name)
            sku_map: Dict[str, bool] = {}
            for r in rows:
                k = f"{r[0]}___{r[1] or ''}"
                if k not in sku_map:
                    sku_map[k] = False
                mrp = float(r[3] or 0)
                sp = float(r[4] or 0)
                oos = (r[5] == 0 or sp == 0)
                disc = ((mrp - sp) / mrp * 100.0) if (mrp > 0 and sp > 0) else 0.0
                if (not oos) and (disc > 20.0 or disc <= 0.0):
                    sku_map[k] = True

            c_tot = float(len(sku_map))
            c_b = float(sum(1 for v in sku_map.values() if v))
            c_rate = (c_b / c_tot * 100.0) if c_tot > 0 else 0.0

            results[f"{c['rawName']}_tracked_skus"] = c_tot
            results[f"{c['rawName']}_breaching_skus"] = c_b
            results[f"{c['rawName']}_breach_rate"] = c_rate

            tot_tracked += c_tot
            tot_breaching += c_b

        results["active_platforms"] = active_platforms_count
        results["total_tracked_skus"] = tot_tracked
        results["total_breaching_skus"] = tot_breaching
        results["overall_breach_rate"] = (tot_breaching / tot_tracked * 100.0) if tot_tracked > 0 else 0.0

        return results

    else:
        # SKU Matrix (single city)
        city_filter = ""
        if info.get("city_raw"):
            city_filter = f"AND lower({location_col}) = '{info['city_raw']}'"
        elif tier1_clause and tier1_clause != "''":
            city_filter = f"AND lower({location_col}) IN ({tier1_clause})"

        weight_col = resolve_table_column(db_name, "rb_pdp_olap", "weight") or "Weight"
        neno_osa_col = resolve_table_column(db_name, "rb_pdp_olap", "neno_osa") or "neno_osa"

        query = f"""
            SELECT 
                {product_col} as product_name, 
                {weight_col} as weight, 
                {platform_col} as platform, 
                max(toFloat64OrZero(toString({mrp_col}))) as mrp, 
                min(toFloat64OrZero(toString({sp_col}))) as selling_price, 
                max(toFloat64OrZero(toString({neno_osa_col}))) as neno_osa 
            FROM {db_name}.rb_pdp_olap 
            WHERE {product_col} IS NOT NULL AND {product_col} != '' 
              AND (toString({comp_col}) = '0' OR {comp_col} = 0) 
              AND {date_col} BETWEEN '{start_date}' AND '{end_date}'
              {city_filter}
            GROUP BY product_name, weight, platform 
            LIMIT 1000
        """
        rows = execute_select_query(query, database=db_name)
        sku_map: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            key = f"{r[0]}___{r[1] or ''}"
            if key not in sku_map:
                sku_map[key] = {"hasBreach": False}
            mrp = float(r[3] or 0)
            sp = float(r[4] or 0)
            out_of_stock = (r[5] == 0 or sp == 0)
            disc = ((mrp - sp) / mrp * 100.0) if (mrp > 0 and sp > 0) else 0.0
            is_breach = (not out_of_stock) and (disc > 20.0 or disc <= 0.0)
            if is_breach:
                sku_map[key]["hasBreach"] = True

        total_skus = float(len(sku_map))
        breaching_skus = float(sum(1 for s in sku_map.values() if s["hasBreach"]))
        breach_rate = (breaching_skus / total_skus * 100.0) if total_skus > 0 else 0.0

        return {
            "active_platforms": active_platforms_count,
            "total_skus": total_skus,
            "breaching_skus": breaching_skus,
            "breach_rate": breach_rate,
        }


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
    Step 3: UI (Selenium). Opens the real Cross Platform Pricing page in Chrome,
    sets workspace database, applies segment, period, and city, and reads the UI values.
    """
    info = _get_segment_info(segment, client=client)
    section = info["section"]
    target_url = f"{FRONTEND_URL}/cross-platform-pricing"
    target_client_label = (client or "boat").capitalize()

    if on_live_step:
        on_live_step(f"Opening Cross Platform Pricing dashboard for {target_client_label}...")

    # Authenticate and set workspace database
    ensure_authenticated(driver, target_url, client=client)

    if not headless:
        bring_chrome_to_top(driver)
        show_live_step_banner(driver, f"Connected to {target_client_label} Workspace (Cross Platform Pricing)")
        time.sleep(1.0)

    # 1. Apply Time Period in UI
    start_str = period.get("startDate") if isinstance(period, dict) else str(period)
    end_str = period.get("endDate") if isinstance(period, dict) else str(period)
    if on_live_step:
        on_live_step(f"Setting dashboard period: {start_str} → {end_str}...")
    if not headless:
        show_live_step_banner(driver, f"Applying Period: {start_str} to {end_str}...")

    apply_dashboard_period(driver, period)

    if not headless:
        time.sleep(1.0)

    # 2. If a specific city is targeted, select that city pill
    if info.get("city"):
        city_target = info["city"]
        if on_live_step:
            on_live_step(f"Selecting city: {city_target}...")
        if not headless:
            show_live_step_banner(driver, f"Selecting City Location: {city_target}...")

        city_clicked = driver.execute_script("""
            const target = arguments[0].toLowerCase().trim();
            // Find pill whose primary text matches the target city
            const pill = Array.from(document.querySelectorAll("div")).find(el => {
                const s = el.querySelector("span");
                if (!s) return false;
                const t = (s.innerText || '').toLowerCase().trim();
                return (t === target || (target === 'bangalore' && t === 'bengaluru') || (target === 'bengaluru' && t === 'bangalore'));
            });
            if (pill) {
                pill.click();
                pill.style.outline = '4px solid #0284c7';
                pill.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return true;
            }
            return false;
        """, city_target)

        time.sleep(1.5)
        wait_for_loading_complete(driver, timeout=20)

    # 3. Read section values
    if on_live_step:
        on_live_step("Inspecting live UI elements & scraping displayed metrics...")
    if not headless:
        bring_chrome_to_top(driver)
        show_live_step_banner(driver, "🔍 DS Tester: Locating & Inspecting Live Cross-Platform Metrics...")

    results: Dict[str, Optional[str]] = {}

    if section == "city_overview":
        # Scrape all unique city pills
        city_data = driver.execute_script("""
            const pills = Array.from(document.querySelectorAll("div")).filter(el => {
                const style = window.getComputedStyle(el);
                const has24Radius = style.borderRadius === '24px' || el.style.borderRadius === '24px';
                const hasWarning = el.querySelector("svg[data-testid='WarningAmberIcon'], svg[data-testid='WarningIcon']");
                const hasText = el.innerText && el.innerText.trim().length > 0;
                return has24Radius && hasWarning && hasText;
            });
            const res = {};
            const seen = new Set();
            let total = 0;
            let cityCount = 0;
            for (const p of pills) {
                const text = p.innerText || '';
                const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
                if (lines.length >= 2) {
                    const cityName = lines[0].toLowerCase().trim();
                    const count = parseInt(lines[1], 10);
                    if (!isNaN(count) && cityName.length > 2 && cityName.length < 25 && !cityName.includes('breach')) {
                        let norm = cityName.replace(/\\s+/g, '_');
                        if (norm === 'bangalore') norm = 'bengaluru';

                        if (!seen.has(norm)) {
                            seen.add(norm);
                            total += count;
                            cityCount += 1;
                            res[norm + '_breaches'] = String(count);
                            if (norm === 'bengaluru') {
                                res['bangalore_breaches'] = String(count);
                            }
                            p.style.outline = '3px solid #22c55e';
                        }
                    }
                }
            }
            res['total_breaches'] = String(total);
            res['total_cities'] = String(cityCount);
            return res;
        """)
        if isinstance(city_data, dict):
            results.update(city_data)

    elif section == "all_cities_matrix":
        import re

        def _extract_sku_count(text: Optional[str]) -> Optional[float]:
            if not text:
                return None
            m = re.search(r'of\s+([0-9,]+)\s*SKU', text, re.IGNORECASE)
            if m:
                clean_num = m.group(1).replace(",", "").strip()
                if clean_num.isdigit():
                    return float(clean_num)
            return None

        cities = get_tier1_cities_for_client(client)
        tot_tracked = 0.0
        tot_breaching = 0.0

        # Inspect and count active platform columns in table header
        platform_count = driver.execute_script("""
            const cells = Array.from(document.querySelectorAll("thead tr:first-child th, thead tr:first-child td"));
            const platCells = cells.filter(c => (c.getAttribute("colspan") === "2" || c.colSpan === 2) && c.innerText.trim().length > 0);
            platCells.forEach(c => {
                c.style.outline = '2px solid #0284c7';
            });
            return platCells.length;
        """)
        if platform_count is not None and platform_count > 0:
            results["active_platforms"] = str(int(platform_count))

        for idx, c in enumerate(cities):
            city_name = c["name"]
            city_raw = c["rawName"]
            city_num = idx + 1
            total_cities = len(cities)

            if on_live_step:
                on_live_step(f"[{city_num}/{total_cities}] 📍 Scrolling to & Selecting: {city_name}...")
            if not headless:
                bring_chrome_to_top(driver)
                show_live_step_banner(driver, f"[{city_num}/{total_cities}] 📍 Scrolling to & Selecting City: {city_name}...")

            # 1. Smoothly scroll horizontal pill container to reveal this city, highlight, and click
            driver.execute_script("""
                const target = arguments[0].toLowerCase().trim();
                const pill = Array.from(document.querySelectorAll("div")).find(el => {
                    const s = el.querySelector("span");
                    if (!s) return false;
                    const t = (s.innerText || '').toLowerCase().trim();
                    return (t === target || (target === 'bangalore' && t === 'bengaluru') || (target === 'bengaluru' && t === 'bangalore'));
                });
                if (pill) {
                    pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    pill.style.outline = '4px solid #0284c7';
                    pill.click();
                }
            """, city_name)

            time.sleep(1.2)
            wait_for_loading_complete(driver, timeout=20)

            # Ensure active_platforms is captured
            if "active_platforms" not in results:
                plat_c = driver.execute_script("""
                    const cells = Array.from(document.querySelectorAll("thead tr:first-child th, thead tr:first-child td"));
                    const platCells = cells.filter(c => (c.getAttribute("colspan") === "2" || c.colSpan === 2) && c.innerText.trim().length > 0);
                    return platCells.length;
                """)
                if plat_c:
                    results["active_platforms"] = str(int(plat_c))

            # 2. Scrape total tracked SKUs from footer
            footer_text = driver.execute_script("""
                const footerEl = Array.from(document.querySelectorAll("p, span, div")).find(el => 
                    el.innerText && el.innerText.includes("Showing") && el.innerText.includes("of") && el.innerText.includes("SKU")
                );
                if (footerEl) {
                    footerEl.style.outline = '3px solid #0284c7';
                    return footerEl.innerText;
                }
                return null;
            """)
            c_tot = _extract_sku_count(footer_text)
            if c_tot is not None:
                results[f"{city_raw}_tracked_skus"] = str(int(c_tot))
                tot_tracked += c_tot

            # 3. Click 'Breaches' button live on screen
            if on_live_step:
                on_live_step(f"[{city_num}/{total_cities}] 🔍 Filtering Breaching SKUs for {city_name}...")
            if not headless:
                show_live_step_banner(driver, f"[{city_num}/{total_cities}] 🔍 Filtering Breaching SKUs: {city_name}...")

            driver.execute_script("""
                const btns = Array.from(document.querySelectorAll("button")).filter(b => (b.innerText || '').includes("Breaches"));
                if (btns.length > 0) {
                    btns[0].style.outline = '3px solid #f59e0b';
                    btns[0].click();
                }
            """)

            time.sleep(1.2)
            wait_for_loading_complete(driver, timeout=15)

            breaches_footer = driver.execute_script("""
                const footerEl = Array.from(document.querySelectorAll("p, span, div")).find(el => 
                    el.innerText && el.innerText.includes("Showing") && el.innerText.includes("of") && el.innerText.includes("SKU")
                );
                if (footerEl) {
                    footerEl.style.outline = '3px solid #ef4444';
                    return footerEl.innerText;
                }
                return null;
            """)
            c_b = _extract_sku_count(breaches_footer)
            if c_b is not None:
                results[f"{city_raw}_breaching_skus"] = str(int(c_b))
                tot_breaching += c_b
                if c_tot and c_tot > 0:
                    c_rate = (c_b / c_tot * 100.0)
                    results[f"{city_raw}_breach_rate"] = f"{c_rate:.1f}%"

            # 4. Untoggle breaches button to restore normal view & mark pill green
            driver.execute_script("""
                const btns = Array.from(document.querySelectorAll("button")).filter(b => (b.innerText || '').includes("Breaches"));
                if (btns.length > 0) {
                    btns[0].click();
                }
                const target = arguments[0].toLowerCase().trim();
                const pill = Array.from(document.querySelectorAll("div")).find(el => {
                    const s = el.querySelector("span");
                    if (!s) return false;
                    const t = (s.innerText || '').toLowerCase().trim();
                    return (t === target || (target === 'bangalore' && t === 'bengaluru') || (target === 'bengaluru' && t === 'bangalore'));
                });
                if (pill) {
                    pill.style.outline = '3px solid #22c55e';
                }
            """, city_name)

            time.sleep(0.4)

        results["total_tracked_skus"] = str(int(tot_tracked))
        results["total_breaching_skus"] = str(int(tot_breaching))
        if tot_tracked > 0:
            results["overall_breach_rate"] = f"{(tot_breaching / tot_tracked * 100.0):.1f}%"

    else:
        # Scrape SKU Matrix: total SKUs from pagination footer and count breaching rows via 'Breaches' toggle
        import re

        def _extract_sku_count(text: Optional[str]) -> Optional[float]:
            if not text:
                return None
            m = re.search(r'of\s+([0-9,]+)\s*SKU', text, re.IGNORECASE)
            if m:
                clean_num = m.group(1).replace(",", "").strip()
                if clean_num.isdigit():
                    return float(clean_num)
            return None

        if on_live_step:
            on_live_step("Reading total tracked SKUs from pagination footer...")
        if not headless:
            show_live_step_banner(driver, "Scraping Tracked SKUs count from UI footer...")

        # Inspect and count active platform columns in table header
        platform_count = driver.execute_script("""
            const cells = Array.from(document.querySelectorAll("thead tr:first-child th, thead tr:first-child td"));
            const platCells = cells.filter(c => (c.getAttribute("colspan") === "2" || c.colSpan === 2) && c.innerText.trim().length > 0);
            platCells.forEach(c => {
                c.style.outline = '2px solid #0284c7';
            });
            return platCells.length;
        """)
        if platform_count is not None and platform_count > 0:
            results["active_platforms"] = str(int(platform_count))

        footer_text = driver.execute_script("""
            const footerEl = Array.from(document.querySelectorAll("p, span, div")).find(el => 
                el.innerText && el.innerText.includes("Showing") && el.innerText.includes("of") && el.innerText.includes("SKU")
            );
            if (footerEl) {
                footerEl.style.outline = '3px solid #0284c7';
                return footerEl.innerText;
            }
            return null;
        """)

        total_skus_num = _extract_sku_count(footer_text)
        if total_skus_num is not None:
            results["total_skus"] = str(int(total_skus_num))

        # Click 'Breaches' filter button live on screen
        if on_live_step:
            on_live_step("Clicking 'Breaches' filter button to inspect breaching SKUs count...")
        if not headless:
            show_live_step_banner(driver, "Clicking 'Breaches' Filter button to verify Breaching SKUs count...")

        btn_clicked = driver.execute_script("""
            const btns = Array.from(document.querySelectorAll("button")).filter(b => (b.innerText || '').includes("Breaches"));
            if (btns.length > 0) {
                btns[0].style.outline = '3px solid #f59e0b';
                btns[0].click();
                return true;
            }
            return false;
        """)

        if btn_clicked:
            time.sleep(1.2)
            wait_for_loading_complete(driver, timeout=15)
            breaches_footer = driver.execute_script("""
                const footerEl = Array.from(document.querySelectorAll("p, span, div")).find(el => 
                    el.innerText && el.innerText.includes("Showing") && el.innerText.includes("of") && el.innerText.includes("SKU")
                );
                if (footerEl) {
                    footerEl.style.outline = '3px solid #ef4444';
                    return footerEl.innerText;
                }
                return null;
            """)
            breaching_skus_num = _extract_sku_count(breaches_footer)
            if breaching_skus_num is not None:
                results["breaching_skus"] = str(int(breaching_skus_num))
                if total_skus_num and total_skus_num > 0:
                    rate = (breaching_skus_num / total_skus_num * 100.0)
                    results["breach_rate"] = f"{rate:.1f}%"

            # Untoggle breaches button to restore normal view
            driver.execute_script("""
                const btns = Array.from(document.querySelectorAll("button")).filter(b => (b.innerText || '').includes("Breaches"));
                if (btns.length > 0) {
                    btns[0].click();
                }
            """)
            time.sleep(0.5)

    if not headless:
        try:
            bring_chrome_to_top(driver)
            show_live_step_banner(driver, "✅ Live Verification Complete! Cross-Platform Values Verified")
            if on_live_step:
                on_live_step("Verification complete! Closing Chrome window...")
            time.sleep(2.5)
        except Exception:
            pass

    return results


class CrossPlatformPricingModule:
    name = "cross_platform_pricing"

    @staticmethod
    def get_segments(client: Optional[str] = "boat") -> List[Dict[str, Any]]:
        return get_segments(client)

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
