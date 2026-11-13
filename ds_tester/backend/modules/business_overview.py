import time
import re
from typing import Dict, Any, List, Optional, Tuple
from selenium import webdriver
from selenium.webdriver.common.by import By

from ..step1_api import call_platform_api
from ..step2_logic import execute_select_query, period_to_date_range, resolve_table_column
from ..step3_selenium import (
    FRONTEND_URL,
    ensure_authenticated,
    wait_for_loading_complete,
    show_live_step_banner,
    bring_chrome_to_top,
    apply_dashboard_period,
    highlight_element,
)

SEGMENTS = [
    {"id": "business_overview_overview", "label": "Business Overview"},
    {"id": "business_overview_platform", "label": "Platform Overview"},
    {"id": "business_overview_category", "label": "Category performance"},
    {"id": "business_overview_breakdown", "label": "Performance Breakdown"},
]

KPIS_BY_SEGMENT = {
    "business_overview_overview": [
        {"key": "offtake", "label": "Offtake", "unit": "Cr", "decimals": 2, "abs_tol": 1.0, "rel_tol": 0.05},
        {"key": "osa", "label": "On Shelf Availability (OSA)", "unit": "%", "decimals": 2, "abs_tol": 1.0, "rel_tol": 0.03},
        {"key": "sos", "label": "Share of Search (SOS)", "unit": "%", "decimals": 2, "abs_tol": 1.0, "rel_tol": 0.03},
        {"key": "market_share", "label": "Market Share", "unit": "%", "decimals": 2, "abs_tol": 1.0, "rel_tol": 0.05},
        {"key": "discount", "label": "Average Discount", "unit": "%", "decimals": 2, "abs_tol": 1.0, "rel_tol": 0.03},
    ],
    "business_overview_platform": [
        {"key": "platform_count", "label": "Active Platforms Count", "unit": "platforms", "decimals": 0, "abs_tol": 0.5},
        {"key": "total_offtake", "label": "Total Platform Offtakes", "unit": "Cr", "decimals": 2, "abs_tol": 1.0, "rel_tol": 0.05},
        {"key": "avg_osa", "label": "Average Platform OSA", "unit": "%", "decimals": 2, "abs_tol": 1.0, "rel_tol": 0.03},
        {"key": "avg_sos", "label": "Average Platform SOS", "unit": "%", "decimals": 2, "abs_tol": 1.0, "rel_tol": 0.03},
    ],
    "business_overview_category": [
        {"key": "category_count", "label": "Active Categories Count", "unit": "categories", "decimals": 0, "abs_tol": 0.5},
        {"key": "total_offtake", "label": "Total Category Offtakes", "unit": "Cr", "decimals": 2, "abs_tol": 1.0, "rel_tol": 0.05},
        {"key": "total_spend", "label": "Total Category Spend", "unit": "Cr", "decimals": 2, "abs_tol": 1.0, "rel_tol": 0.05},
        {"key": "overall_roas", "label": "Overall Category ROAS", "unit": "x", "decimals": 2, "abs_tol": 0.5, "rel_tol": 0.05},
    ],
    "business_overview_breakdown": [
        {"key": "total_impressions", "label": "Total Impressions", "unit": "Cr", "decimals": 2, "abs_tol": 1.0, "rel_tol": 0.05},
        {"key": "total_spends", "label": "Total Ad Spends", "unit": "Cr", "decimals": 2, "abs_tol": 1.0, "rel_tol": 0.05},
        {"key": "total_sales", "label": "Total Ad Sales", "unit": "Cr", "decimals": 2, "abs_tol": 1.0, "rel_tol": 0.05},
        {"key": "overall_roas", "label": "Breakdown Ad ROAS", "unit": "x", "decimals": 2, "abs_tol": 0.5, "rel_tol": 0.05},
        {"key": "overall_ctr", "label": "Overall CTR", "unit": "%", "decimals": 2, "abs_tol": 0.5, "rel_tol": 0.05},
    ]
}


def _parse_num(val: Any) -> Optional[float]:
    if val is None:
        return None
    s = str(val).strip()
    if s in ("N/A", "-", "", "None", "null"):
        return None
    # Take first line if multiline (e.g. value followed by trend/delta)
    first_line = s.split("\n")[0].strip()
    match = re.search(r"[-+]?₹?\s*(\d+(?:\.\d+)?)", first_line)
    if match:
        try:
            return float(match.group(1))
        except (ValueError, TypeError):
            pass
    clean = re.sub(r"[^\d.-]", "", first_line)
    try:
        return float(clean)
    except (ValueError, TypeError):
        return None


def _parse_currency_cr(val: Any) -> Optional[float]:
    if val is None:
        return None
    s = str(val).strip().lower()
    if s in ("n/a", "-", "", "none", "null"):
        return None
    num = _parse_num(s)
    if num is None:
        return None
    if "cr" in s:
        return num
    elif "lac" in s or "lakh" in s:
        return num / 100.0
    elif "k" in s:
        return num / 10000.0
    # Raw rupee amount without Cr/Lac/K suffix: convert to Crores (1 Cr = 10,000,000)
    return num / 10000000.0


def get_segments(client: Optional[str] = None) -> List[Dict[str, Any]]:
    return SEGMENTS


def get_kpis_for_segment(segment_id: str, client: Optional[str] = None) -> List[Dict[str, Any]]:
    return KPIS_BY_SEGMENT.get(segment_id, KPIS_BY_SEGMENT["business_overview_overview"])


def step1_fetch(segment: str, period: Any, client: Optional[str] = "boat") -> Dict[str, Optional[float]]:
    db_name = client or "boat"
    start_date, end_date = period_to_date_range(period)
    params = {"startDate": start_date, "endDate": end_date}

    if segment == "business_overview_overview":
        data = call_platform_api("/api/watchtower/overview", params=params, db_name=db_name)
        top = data.get("topMetrics", []) if isinstance(data, dict) else []
        extracted = {}
        for m in top:
            n = (m.get("name") or "").lower().strip()
            raw = m.get("label")
            num = _parse_num(raw)
            if "offtake" in n:
                extracted["offtake"] = num
            elif "osa" in n or "availability" in n:
                extracted["osa"] = num
            elif "search" in n or "sos" in n:
                extracted["sos"] = num
            elif "market" in n:
                extracted["market_share"] = num
            elif "discount" in n or "promo" in n:
                extracted["discount"] = num

        return {
            "offtake": extracted.get("offtake"),
            "osa": extracted.get("osa"),
            "sos": extracted.get("sos"),
            "market_share": extracted.get("market_share"),
            "discount": extracted.get("discount"),
        }

    elif segment == "business_overview_platform":
        data = call_platform_api("/api/watchtower/platform-overview", params=params, db_name=db_name)
        plat_list = data if isinstance(data, list) else []
        plat_count = len(plat_list)

        all_row = next((p for p in plat_list if (p.get("label") or "").lower() == "all"), (plat_list[0] if plat_list else {}))
        cols = {c.get("title", ""): _parse_num(c.get("value")) for c in all_row.get("columns", [])}

        return {
            "platform_count": float(plat_count) if plat_count > 0 else None,
            "total_offtake": cols.get("Offtakes"),
            "avg_osa": cols.get("OSA"),
            "avg_sos": cols.get("Share of Search") or cols.get("SOS"),
        }

    elif segment == "business_overview_category":
        data = call_platform_api("/api/watchtower/category-overview", params=params, db_name=db_name)
        cats = data if isinstance(data, list) else []
        cat_count = len(cats)

        total_offtake = 0.0
        total_spend = 0.0
        total_sales = 0.0

        for c in cats:
            c_cols = {col.get("title", ""): col.get("value") for col in c.get("columns", [])}
            total_offtake += (_parse_currency_cr(c_cols.get("Offtakes")) or 0.0)
            total_spend += (_parse_currency_cr(c_cols.get("Spend")) or 0.0)
            total_sales += (_parse_currency_cr(c_cols.get("Inorg Sales")) or 0.0)

        roas = (total_sales / total_spend) if total_spend > 0 else None

        return {
            "category_count": float(cat_count) if cat_count > 0 else None,
            "total_offtake": round(total_offtake, 2) if total_offtake > 0 else None,
            "total_spend": round(total_spend, 2) if total_spend > 0 else None,
            "overall_roas": round(roas, 2) if roas is not None else None,
        }

    elif segment == "business_overview_breakdown":
        data = call_platform_api("/api/watchtower/performance-breakdown", params=params, db_name=db_name)
        totals = data.get("totals", {}) if isinstance(data, dict) else {}

        impr = _parse_num(totals.get("impressions"))
        spends = _parse_num(totals.get("spends"))
        sales = _parse_num(totals.get("sales"))
        ctr = _parse_num(totals.get("ctr"))
        roas = (sales / spends) if (sales and spends and spends > 0) else None

        return {
            "total_impressions": round(impr / 10000000.0, 2) if impr else None,
            "total_spends": round(spends / 10000000.0, 2) if spends else None,
            "total_sales": round(sales / 10000000.0, 2) if sales else None,
            "overall_roas": round(roas, 2) if roas is not None else None,
            "overall_ctr": round(ctr, 2) if ctr else None,
        }

    return {}


def step2_logic(segment: str, period: Any, client: Optional[str] = "boat") -> Dict[str, Optional[float]]:
    db_name = client or "boat"
    start_date, end_date = period_to_date_range(period)

    sales_col = resolve_table_column(db_name, "rb_pdp_olap", "Sales")
    disc_col = resolve_table_column(db_name, "rb_pdp_olap", "Discount")
    mrp_col = resolve_table_column(db_name, "rb_pdp_olap", "MRP")
    sp_col = resolve_table_column(db_name, "rb_pdp_olap", "Selling_Price")

    if segment == "business_overview_overview":
        # 1. Offtake & OSA
        q_pdp = f"""
        SELECT 
            sum(ifNull(toFloat64OrZero(toString({sales_col})), 0)) / 10000000.0 as offtake_cr,
            (sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullIf(sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100 as osa
        FROM {db_name}.rb_pdp_olap
        WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}'
          AND toString(Comp_flag) = '0'
        """
        res_pdp = execute_select_query(q_pdp, database=db_name)
        offtake_val = float(res_pdp[0][0]) if res_pdp and res_pdp[0] and res_pdp[0][0] is not None else None
        osa_val = float(res_pdp[0][1]) if res_pdp and res_pdp[0] and res_pdp[0][1] is not None else None

        # 2. Promo / Discount
        q_promo = f"""
        SELECT 
            (SUM(ifNull(toFloat64OrZero(toString({mrp_col})), 0)) - SUM(ifNull(toFloat64OrZero(toString({sp_col})), 0))) / NULLIF(SUM(ifNull(toFloat64OrZero(toString({mrp_col})), 0)), 0) * 100 as avg_promo
        FROM {db_name}.rb_pdp_olap
        WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}'
          AND toString(Comp_flag) = '0'
          AND neno_osa > 0
        """
        res_promo = execute_select_query(q_promo, database=db_name)
        promo_val = float(res_promo[0][0]) if res_promo and res_promo[0] and res_promo[0][0] is not None else None

        # 3. Share of Search (SOS)
        q_sos = f"""
        SELECT 
            (sumIf(toInt32(overall), POSITION <= 10 AND toString(flag) = '1') / nullIf(sumIf(toInt32(overall), POSITION <= 10), 0)) * 100 as sos
        FROM {db_name}.rb_kw_olap
        WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}'
        """
        res_sos = execute_select_query(q_sos, database=db_name)
        sos_val = float(res_sos[0][0]) if res_sos and res_sos[0] and res_sos[0][0] is not None else None

        # 4. Market Share
        q_ms = f"""
        SELECT 
            (sumIf(toFloat64OrZero(toString(sales)), toString(flag) = '1') / nullIf(sum(toFloat64OrZero(toString(sales))), 0)) * 100 as ms
        FROM {db_name}.rb_ms_olap
        WHERE toDate(created_on) BETWEEN '{start_date}' AND '{end_date}'
        """
        res_ms = execute_select_query(q_ms, database=db_name)
        ms_val = float(res_ms[0][0]) if res_ms and res_ms[0] and res_ms[0][0] is not None else None

        return {
            "offtake": round(offtake_val, 2) if offtake_val is not None else None,
            "osa": round(osa_val, 2) if osa_val is not None else None,
            "sos": round(sos_val, 2) if sos_val is not None else None,
            "market_share": round(ms_val, 2) if ms_val is not None else None,
            "discount": round(promo_val, 2) if promo_val is not None else None,
        }

    elif segment == "business_overview_platform":
        buymore_exists = False
        try:
            check_bm = execute_select_query(f"SELECT count() FROM system.tables WHERE database = '{db_name}' AND name = 'buymore_rb_pdp_olap'", database=db_name)
            buymore_exists = bool(check_bm and check_bm[0] and check_bm[0][0])
        except Exception:
            buymore_exists = False

        if buymore_exists:
            q_plat_cnt = f"""
            SELECT count(DISTINCT lower(p)) + 1 FROM (
                SELECT platform as p FROM {db_name}.rca_sku_dim WHERE platform IS NOT NULL AND platform != ''
                UNION ALL
                SELECT Platform as p FROM {db_name}.buymore_rb_pdp_olap WHERE Platform IS NOT NULL AND Platform != ''
            )
            """
        else:
            q_plat_cnt = f"""
            SELECT count(DISTINCT lower(platform)) + 1
            FROM {db_name}.rca_sku_dim
            WHERE platform IS NOT NULL AND platform != ''
            """
        try:
            res_p_cnt = execute_select_query(q_plat_cnt, database=db_name)
            p_count = int(res_p_cnt[0][0]) if res_p_cnt and res_p_cnt[0] and res_p_cnt[0][0] else None
        except Exception:
            p_count = None

        if not p_count:
            q_plat_fb = f"SELECT count(DISTINCT lower(Platform)) + 1 FROM {db_name}.rb_pdp_olap WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}' AND toString(Comp_flag) = '0'"
            res_plat_fb = execute_select_query(q_plat_fb, database=db_name)
            p_count = int(res_plat_fb[0][0]) if res_plat_fb and res_plat_fb[0] and res_plat_fb[0][0] else None

        q_plat = f"""
        SELECT 
            sum(ifNull(toFloat64OrZero(toString({sales_col})), 0)) / 10000000.0 as offtake_cr,
            (sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullIf(sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100 as osa
        FROM {db_name}.rb_pdp_olap
        WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}'
          AND toString(Comp_flag) = '0'
        """
        res_plat = execute_select_query(q_plat, database=db_name)
        tot_offtake = float(res_plat[0][0]) if res_plat and res_plat[0] and res_plat[0][0] is not None else None
        tot_osa = float(res_plat[0][1]) if res_plat and res_plat[0] and res_plat[0][1] is not None else None

        q_sos = f"""
        SELECT 
            (sumIf(toInt32(overall), POSITION <= 10 AND toString(flag) = '1') / nullIf(sumIf(toInt32(overall), POSITION <= 10), 0)) * 100 as sos
        FROM {db_name}.rb_kw_olap
        WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}'
        """
        res_sos = execute_select_query(q_sos, database=db_name)
        tot_sos = float(res_sos[0][0]) if res_sos and res_sos[0] and res_sos[0][0] is not None else None

        return {
            "platform_count": float(p_count) if p_count else None,
            "total_offtake": round(tot_offtake, 2) if tot_offtake is not None else None,
            "avg_osa": round(tot_osa, 2) if tot_osa is not None else None,
            "avg_sos": round(tot_sos, 2) if tot_sos is not None else None,
        }

    elif segment == "business_overview_category":
        cat_col = resolve_table_column(db_name, "rb_pdp_olap", "Category")
        buymore_exists = False
        try:
            check_bm = execute_select_query(f"SELECT count() FROM system.tables WHERE database = '{db_name}' AND name = 'buymore_rb_pdp_olap'", database=db_name)
            buymore_exists = bool(check_bm and check_bm[0] and check_bm[0][0])
        except Exception:
            buymore_exists = False

        if buymore_exists:
            q_cat = f"""
            SELECT 
                count(DISTINCT lower(cat)) as num_cats,
                sum(offtake) / 10000000.0 as offtake_cr
            FROM (
                SELECT lower({cat_col}) as cat, ifNull(toFloat64OrZero(toString({sales_col})), 0) as offtake
                FROM {db_name}.rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}'
                  AND toString(Comp_flag) = '0'
                  AND {cat_col} IS NOT NULL AND {cat_col} != ''
                UNION ALL
                SELECT ifNull(nullIf(trim(category), ''), 'Other') as cat, ifNull(toFloat64OrZero(toString(Sales)), 0) as offtake
                FROM {db_name}.buymore_rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}'
            )
            """
            cat_subquery = f"""
            SELECT DISTINCT lower(cat) FROM (
                SELECT lower({cat_col}) as cat FROM {db_name}.rb_pdp_olap WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}' AND toString(Comp_flag) = '0' AND {cat_col} IS NOT NULL AND {cat_col} != ''
                UNION ALL
                SELECT ifNull(nullIf(trim(category), ''), 'Other') as cat FROM {db_name}.buymore_rb_pdp_olap WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}'
            )
            """
        else:
            q_cat = f"""
            SELECT 
                count(DISTINCT lower({cat_col})) as num_cats,
                sum(ifNull(toFloat64OrZero(toString({sales_col})), 0)) / 10000000.0 as offtake_cr
            FROM {db_name}.rb_pdp_olap
            WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}'
              AND toString(Comp_flag) = '0'
              AND {cat_col} IS NOT NULL AND {cat_col} != ''
            """
            cat_subquery = f"""
            SELECT DISTINCT lower({cat_col}) FROM {db_name}.rb_pdp_olap WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}' AND toString(Comp_flag) = '0' AND {cat_col} IS NOT NULL AND {cat_col} != ''
            """

        res_cat = execute_select_query(q_cat, database=db_name)
        num_cats = int(res_cat[0][0]) if res_cat and res_cat[0] and res_cat[0][0] else None
        tot_offtake = float(res_cat[0][1]) if res_cat and res_cat[0] and res_cat[0][1] is not None else None

        # Fetch Category Spend & ROAS from rb_pm_olap strictly for the active categories
        q_pm = f"""
        SELECT 
            sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) / 10000000.0 as spends_cr,
            sum(ifNull(toFloat64OrZero(toString(ad_sales)), 0)) / nullIf(sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)), 0) as roas
        FROM {db_name}.rb_pm_olap
        WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}'
          AND lower(category) IN ({cat_subquery})
        """
        res_pm = execute_select_query(q_pm, database=db_name)
        tot_spend_cr = float(res_pm[0][0]) if res_pm and res_pm[0] and res_pm[0][0] is not None else None
        tot_roas = float(res_pm[0][1]) if res_pm and res_pm[0] and res_pm[0][1] is not None else None

        return {
            "category_count": float(num_cats) if num_cats else None,
            "total_offtake": round(tot_offtake, 2) if tot_offtake is not None else None,
            "total_spend": round(tot_spend_cr, 2) if tot_spend_cr is not None else None,
            "overall_roas": round(tot_roas, 2) if tot_roas is not None else None,
        }

    elif segment == "business_overview_breakdown":
        q_pm = f"""
        SELECT 
            sum(ifNull(toFloat64OrZero(toString(impressions)), 0)) / 10000000.0 as impressions_cr,
            sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) / 10000000.0 as spends_cr,
            sum(ifNull(toFloat64OrZero(toString(ad_sales)), 0)) / 10000000.0 as sales_cr,
            sum(ifNull(toFloat64OrZero(toString(ad_sales)), 0)) / nullIf(sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)), 0) as roas,
            (sum(ifNull(toFloat64OrZero(toString(ad_click)), 0)) / nullIf(sum(ifNull(toFloat64OrZero(toString(impressions)), 0)), 0)) * 100 as ctr
        FROM {db_name}.rb_pm_olap
        WHERE toDate(DATE) BETWEEN '{start_date}' AND '{end_date}'
        """
        res_pm = execute_select_query(q_pm, database=db_name)
        impr = float(res_pm[0][0]) if res_pm and res_pm[0] and res_pm[0][0] is not None else None
        spends = float(res_pm[0][1]) if res_pm and res_pm[0] and res_pm[0][1] is not None else None
        sales = float(res_pm[0][2]) if res_pm and res_pm[0] and res_pm[0][2] is not None else None
        roas = float(res_pm[0][3]) if res_pm and res_pm[0] and res_pm[0][3] is not None else None
        ctr = float(res_pm[0][4]) if res_pm and res_pm[0] and res_pm[0][4] is not None else None

        return {
            "total_impressions": round(impr, 2) if impr is not None else None,
            "total_spends": round(spends, 2) if spends is not None else None,
            "total_sales": round(sales, 2) if sales is not None else None,
            "overall_roas": round(roas, 2) if roas is not None else None,
            "overall_ctr": round(ctr, 2) if ctr else None,
        }

    return {}


def step3_ui(
    driver: webdriver.Chrome,
    segment: str,
    period: Any,
    client: Optional[str] = "boat",
    headless: bool = False,
    on_live_step: Optional[Any] = None,
) -> Dict[str, Optional[str]]:
    target_url = f"{FRONTEND_URL}/watch-tower"
    client_label = (client or "boat").capitalize()

    if on_live_step:
        on_live_step(f"Authenticating session for {client_label}...")
    ensure_authenticated(driver, target_url, client=client)

    if not headless:
        bring_chrome_to_top(driver)
        show_live_step_banner(driver, f"🔍 DS Tester: Loading Business Overview ({client_label})...")

    time.sleep(1.0)
    wait_for_loading_complete(driver, timeout=20)

    # Apply date range
    if on_live_step:
        on_live_step(f"Applying period filter...")
    apply_dashboard_period(driver, period)
    time.sleep(2.0)
    wait_for_loading_complete(driver, timeout=25)
    time.sleep(1.0)

    if segment == "business_overview_overview":
        if on_live_step:
            on_live_step("Focusing & Highlighting Business Overview Top KPI Cards...")
        if not headless:
            bring_chrome_to_top(driver)
            show_live_step_banner(driver, "🔍 DS Tester: Testing Business Overview (Top KPI Cards)...")

        # Highlight and scroll to top
        driver.execute_script("""
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const topGrid = document.querySelector('.grid.grid-cols-1.sm\\\\:grid-cols-2.lg\\\\:grid-cols-5');
            if (topGrid) {
                const container = topGrid.closest('div.border') || topGrid.closest('div.rounded-3xl') || topGrid.parentElement;
                if (container) {
                    container.style.outline = '3px solid #16a34a';
                    container.style.boxShadow = '0 0 20px #16a34a';
                    container.style.borderRadius = '1.5rem';
                }
            }
        """)
        time.sleep(1.5)

        res = driver.execute_script("""
            const topGrid = document.querySelector('.grid.grid-cols-1.sm\\\\:grid-cols-2.lg\\\\:grid-cols-5');
            if (!topGrid) return {};
            
            const metrics = {};
            for (const child of topGrid.children) {
                const txt = (child.innerText || '').trim();
                const lines = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                if (lines.length >= 3) {
                    const val = lines[1];
                    const title = lines[lines.length - 1].toLowerCase();
                    if (title.includes('offtake')) metrics.offtake = val;
                    else if (title.includes('osa')) metrics.osa = val;
                    else if (title.includes('search')) metrics.sos = val;
                    else if (title.includes('market')) metrics.market_share = val;
                    else if (title.includes('discount')) metrics.discount = val;
                }
            }
            return metrics;
        """)

        return res or {}

    elif segment == "business_overview_platform":
        if on_live_step:
            on_live_step("Focusing & Highlighting Platform Overview Section...")
        if not headless:
            bring_chrome_to_top(driver)
            show_live_step_banner(driver, "🔍 DS Tester: Testing Platform Overview Table & Cards...")

        # Smooth scroll to Platform Overview section and highlight
        driver.execute_script("""
            let targetEl = null;
            for (const h of document.querySelectorAll("span, h2, h3, h4, div")) {
                if ((h.innerText || "").trim() === "Platform Overview") {
                    targetEl = h;
                    break;
                }
            }
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const container = targetEl.closest('.rounded-3xl') || targetEl.closest('div.border') || targetEl.parentElement?.parentElement;
                if (container) {
                    container.style.outline = '3px solid #16a34a';
                    container.style.boxShadow = '0 0 20px #16a34a';
                    container.style.borderRadius = '1.5rem';
                }
            }
        """)
        time.sleep(1.5)

        res = driver.execute_script(r"""
            const platHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim() === 'Platform Overview');
            if (!platHeader) return {};
            const container = platHeader.closest('div.border') || platHeader.parentElement?.parentElement;
            
            // Find all entity rows inside container
            const entityContainer = container.querySelector('div.space-y-2, div.space-y-3');
            const rows = entityContainer ? Array.from(entityContainer.children) : Array.from(container.querySelectorAll('.space-y-2 > div, .space-y-3 > div'));
            let allRow = null;
            for (const r of rows) {
                const titleSpan = r.querySelector('span[title="All"], span');
                if (titleSpan && (titleSpan.getAttribute('title') === 'All' || titleSpan.innerText.trim() === 'All')) {
                    allRow = r;
                    break;
                }
            }
            
            let offtake = null, osa = null, sos = null;
            if (allRow) {
                const btns = Array.from(allRow.querySelectorAll('button'));
                for (const b of btns) {
                    const title = (b.getAttribute('title') || '').toLowerCase();
                    const txt = (b.innerText || '').trim();
                    const cleanVal = txt.replace(/\r?\n.*/s, '').trim();
                    if (title.startsWith('offtakes:')) offtake = cleanVal;
                    else if (title.startsWith('osa:')) osa = cleanVal;
                    else if (title.startsWith('share of search:') || title.startsWith('sos:')) sos = cleanVal;
                }
            }
            
            // Count platform entities dynamically (from pagination total or rendered rows)
            let count = 0;
            const paginationMatch = (container.innerText || '').match(/of\s+(\d+)\s+entries/i);
            if (paginationMatch) {
                count = parseInt(paginationMatch[1]);
            } else {
                count = rows.length;
            }
            
            return {
                platform_count: count > 0 ? count.toString() : null,
                total_offtake: offtake,
                avg_osa: osa,
                avg_sos: sos
            };
        """)

        return res or {}

    elif segment == "business_overview_category":
        if on_live_step:
            on_live_step("Focusing & Highlighting Category Performance Studio...")
        if not headless:
            bring_chrome_to_top(driver)
            show_live_step_banner(driver, "🔍 DS Tester: Testing Category Performance Studio...")

        driver.execute_script("""
            let catHeader = null;
            for (const h of document.querySelectorAll("h2, h3, h4, span, div")) {
                if ((h.innerText || "").toLowerCase().trim() === "category performance") {
                    catHeader = h;
                    break;
                }
            }
            if (catHeader) {
                catHeader.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const box = catHeader.closest('.rounded-3xl') || catHeader.closest('div.border') || catHeader.parentElement?.parentElement;
                if (box) {
                    box.style.outline = '3px solid #16a34a';
                    box.style.boxShadow = '0 0 20px #16a34a';
                    box.style.borderRadius = '1.5rem';
                }
            }
        """)
        time.sleep(1.5)

        res = driver.execute_script("""
            const catHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim().toLowerCase() === 'category performance');
            if (!catHeader) return {};
            const container = catHeader.closest('.grid') || catHeader.closest('div.border') || catHeader.parentElement?.parentElement;
            
            // Extract exact live category data via React component fiber
            let fiberKey = Object.keys(container).find(k => k.startsWith('__reactFiber'));
            if (!fiberKey) {
                const child = container.querySelector('*');
                if (child) fiberKey = Object.keys(child).find(k => k.startsWith('__reactFiber'));
            }
            
            let cur = container[fiberKey];
            let rows = null;
            for (let i = 0; i < 40 && cur; i++) {
                if (cur.memoizedProps && Array.isArray(cur.memoizedProps.rows)) {
                    rows = cur.memoizedProps.rows;
                    break;
                }
                cur = cur.return;
            }
            
            if (rows && rows.length > 0) {
                const totOfftake = rows.reduce((acc, r) => acc + (parseFloat(r.offtakes) || 0), 0) / 10000000.0;
                const totSpend = rows.reduce((acc, r) => acc + (parseFloat(r.spend) || 0), 0) / 10000000.0;
                const totInorg = rows.reduce((acc, r) => acc + (parseFloat(r.inorgSalesPct) || 0), 0) / 10000000.0;
                const overallRoas = totSpend > 0 ? (totInorg / totSpend) : null;
                return {
                    category_count: rows.length.toString(),
                    total_offtake: totOfftake.toFixed(2),
                    total_spend: totSpend.toFixed(2),
                    overall_roas: overallRoas ? overallRoas.toFixed(2) : null
                };
            }
            
            return {};
        """)

        return res or {}

    elif segment == "business_overview_breakdown":
        if on_live_step:
            on_live_step("Focusing & Highlighting Performance Breakdown Table...")
        if not headless:
            bring_chrome_to_top(driver)
            show_live_step_banner(driver, "🔍 DS Tester: Testing Performance Breakdown Table...")

        driver.execute_script(r"""
            let pbHeader = null;
            for (const h of document.querySelectorAll("h3, h4, span, div")) {
                if ((h.innerText || "").toLowerCase().includes("performance breakdown")) {
                    pbHeader = h;
                    break;
                }
            }
            if (pbHeader) {
                pbHeader.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const box = pbHeader.closest('.rounded-3xl') || pbHeader.closest('div.border') || pbHeader.parentElement?.parentElement;
                if (box) {
                    box.style.outline = '3px solid #16a34a';
                    box.style.boxShadow = '0 0 20px #16a34a';
                    box.style.borderRadius = '1.5rem';
                }
            }
        """)
        time.sleep(1.5)

        res = driver.execute_script(r"""
            const tables = Array.from(document.querySelectorAll('table'));
            let totalRow = null;
            let targetTable = null;
            for (const t of tables) {
                const trs = Array.from(t.querySelectorAll('tr'));
                for (const tr of trs) {
                    const cells = Array.from(tr.querySelectorAll('td, th')).map(c => c.innerText.trim());
                    if (cells[0] && cells[0].toLowerCase().startsWith('total')) {
                        totalRow = cells;
                        targetTable = t;
                        break;
                    }
                }
                if (totalRow) break;
            }
            
            if (!totalRow) return {};
            
            const targetT = targetTable || (totalRow ? document.querySelector('table') : null);
            const headers = Array.from(targetT ? targetT.querySelectorAll('thead th') : []).map(th => th.innerText.trim().toLowerCase());
            const findCol = (predicate) => headers.findIndex(predicate);
            const imprIdx = findCol(h => h.includes('impression'));
            const ctrIdx = findCol(h => h === 'ctr' || (h.includes('ctr') && !h.includes('cpc')));
            const spendIdx = findCol(h => (h === 'spends' || h.endsWith('spends')) && !h.includes('%'));
            const salesIdx = findCol(h => (h.includes('sales') || h.includes('revenue')) && !h.includes('%'));

            const cleanCell = (c) => c ? c.replace(/\r?\n.*/s, '').trim() : null;
            const impr = imprIdx >= 0 && imprIdx < totalRow.length ? cleanCell(totalRow[imprIdx]) : cleanCell(totalRow[1]);
            const ctr = ctrIdx >= 0 && ctrIdx < totalRow.length ? cleanCell(totalRow[ctrIdx]) : cleanCell(totalRow[3]);
            const spend = spendIdx >= 0 && spendIdx < totalRow.length ? cleanCell(totalRow[spendIdx]) : cleanCell(totalRow[5]);
            const sales = salesIdx >= 0 && salesIdx < totalRow.length ? cleanCell(totalRow[salesIdx]) : cleanCell(totalRow[totalRow.length - 1]);
            
            let roas = null;
            const parseAmount = (str) => {
                if (!str) return 0;
                const s = str.toLowerCase();
                const m = s.match(/([\d,]+(?:\.\d+)?)/);
                if (!m) return 0;
                const num = parseFloat(m[1].replace(/,/g, ''));
                if (s.includes('cr')) return num * 10000000;
                if (s.includes('lac') || s.includes('lakh')) return num * 100000;
                if (s.includes('k')) return num * 1000;
                return num;
            };
            const sVal = parseAmount(sales);
            const spVal = parseAmount(spend);
            if (sVal > 0 && spVal > 0) {
                roas = (sVal / spVal).toFixed(2);
            }
            
            return {
                total_impressions: impr,
                total_spends: spend,
                total_sales: sales,
                overall_roas: roas,
                overall_ctr: ctr
            };
        """)

        return res or {}

    return {}


class BusinessOverviewModule:
    name = "business_overview"
    display_name = "Business Overview"
    segments = SEGMENTS
    get_segments = get_segments
    get_kpis = get_kpis_for_segment
    step1_fetch = staticmethod(step1_fetch)
    step2_logic = staticmethod(step2_logic)
    step3_ui = staticmethod(step3_ui)
    step3_selenium = staticmethod(step3_ui)
