"""
Performance Marketing Module for DS Tester
3-Way Parity Verification Engine:
- Step 1: Live Platform API (/api/performance-marketing, /api/performance-marketing/quadrants, /api/performance-marketing/keyword-type-performance)
- Step 2: Direct ClickHouse Logic (rb_pm_olap)
- Step 3: Live Chrome Browser via Selenium (DOM scraping with live interaction & highlighting)

100% Dynamic - Zero hardcoding, zero dummy data.
"""

import os
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from selenium import webdriver

from ..step1_api import call_platform_api
from ..step2_logic import execute_select_query, period_to_date_range
from ..comparator import normalize_ui_text
from ..step3_selenium import (
    FRONTEND_URL,
    ensure_authenticated,
    apply_dashboard_period,
    apply_segment_platform,
    wait_for_loading_complete,
    bring_chrome_to_top,
    show_live_step_banner,
)

CORE_SECTIONS = [
    {
        "id": "pm_overview",
        "label": "Performance Overview (All Platforms)",
        "section": "overview",
        "channel": "all",
        "platform": "all",
    },
    {
        "id": "pm_quadrants",
        "label": "Campaign Quadrants (All Platforms)",
        "section": "quadrants",
        "channel": "all",
        "platform": "all",
    },
    {
        "id": "pm_keyword_type",
        "label": "Keyword Type Performance (All Platforms)",
        "section": "keyword_type",
        "channel": "all",
        "platform": "all",
    },
]

KPIS_BY_SECTION = {
    "overview": [
        {
            "key": "impressions",
            "label": "Impressions",
            "unit": "Cr",
            "decimals": 2,
            "abs_tol": 0.5,
            "rel_tol": 0.05,
        },
        {
            "key": "spend",
            "label": "Spend",
            "unit": "Cr",
            "decimals": 2,
            "abs_tol": 0.5,
            "rel_tol": 0.05,
        },
        {
            "key": "conversion",
            "label": "Conversion",
            "unit": "%",
            "decimals": 1,
            "abs_tol": 0.5,
            "rel_tol": 0.05,
        },
        {
            "key": "roas",
            "label": "ROAS",
            "unit": "ratio",
            "decimals": 2,
            "abs_tol": 0.2,
            "rel_tol": 0.05,
        },
    ],
    "quadrants": [
        {
            "key": "total",
            "label": "Total Campaigns",
            "unit": "",
            "decimals": 0,
            "abs_tol": 2.0,
            "rel_tol": 0.05,
        },
        {
            "key": "q1",
            "label": "Q1 - Performing Well",
            "unit": "",
            "decimals": 0,
            "abs_tol": 2.0,
            "rel_tol": 0.05,
        },
        {
            "key": "q2",
            "label": "Q2 - Need Attention",
            "unit": "",
            "decimals": 0,
            "abs_tol": 2.0,
            "rel_tol": 0.05,
        },
        {
            "key": "q3",
            "label": "Q3 - Experiment",
            "unit": "",
            "decimals": 0,
            "abs_tol": 2.0,
            "rel_tol": 0.05,
        },
        {
            "key": "q4",
            "label": "Q4 - Opportunity",
            "unit": "",
            "decimals": 0,
            "abs_tol": 2.0,
            "rel_tol": 0.05,
        },
    ],
    "keyword_type": [
        {
            "key": "branded_spend",
            "label": "Branded Spend",
            "unit": "L",
            "decimals": 2,
            "abs_tol": 1.0,
            "rel_tol": 0.05,
        },
        {
            "key": "generic_spend",
            "label": "Generic Spend",
            "unit": "L",
            "decimals": 2,
            "abs_tol": 1.0,
            "rel_tol": 0.05,
        },
        {
            "key": "competitor_spend",
            "label": "Competitor Spend",
            "unit": "L",
            "decimals": 2,
            "abs_tol": 1.0,
            "rel_tol": 0.05,
        },
    ],
}


def get_platforms_for_client(client: Optional[str] = "boat") -> List[str]:
    """Dynamically fetches distinct platforms from ClickHouse rb_pm_olap for this client."""
    db_name = (client or "boat").strip().lower()

    # Performance Marketing is explicitly hidden in the live dashboard for 'boat' and 'mamaearth'
    # Reference: frontend/src/components/CommonLayout/Sidebar.jsx (hideForDb: ['mamaearth', 'boat'])
    if db_name in ("boat", "mamaearth"):
        return []

    try:
        query = f"SELECT DISTINCT Platform FROM {db_name}.rb_pm_olap WHERE Platform IS NOT NULL AND Platform != '' ORDER BY Platform"
        rows = execute_select_query(query, database=db_name)
        platforms = [str(r[0]).strip() for r in rows if r and r[0]]
        if platforms:
            return platforms
    except Exception:
        pass
    return []


def get_channels_for_client(client: Optional[str] = "boat") -> List[str]:
    """Dynamically fetches distinct channels from ClickHouse rb_pm_olap for this client."""
    db_name = client or "boat"
    try:
        query = f"SELECT DISTINCT lower(channel) FROM {db_name}.rb_pm_olap WHERE channel IS NOT NULL AND channel != '' ORDER BY lower(channel)"
        rows = execute_select_query(query, database=db_name)
        channels = [str(r[0]).strip().lower() for r in rows if r and r[0]]
        if channels:
            return channels
    except Exception:
        pass
    return []


def get_platform_channel_map(client: Optional[str] = "boat") -> Dict[str, str]:
    """Maps platform -> channel from ClickHouse rb_pm_olap."""
    db_name = client or "boat"
    mapping = {}
    try:
        query = f"SELECT DISTINCT lower(Platform), lower(channel) FROM {db_name}.rb_pm_olap WHERE Platform IS NOT NULL AND Platform != ''"
        rows = execute_select_query(query, database=db_name)
        for r in rows:
            if r and len(r) >= 2 and r[0] and r[1]:
                p = str(r[0]).strip().lower()
                c = str(r[1]).strip().lower()
                mapping[p] = c
    except Exception:
        pass
    return mapping


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
    Only returns segments if the client database actually contains rb_pm_olap with data.
    Generates:
    - Overview: All Platforms, Quick Commerce, E-Commerce, and individual platforms
    - Campaign Quadrants (Q1–Q4): All Platforms, Quick Commerce, E-Commerce, and individual platforms
    - Keyword Type Performance: All Platforms, Quick Commerce, E-Commerce, and individual platforms
    """
    db_name = (client or "boat").strip().lower()

    # Performance Marketing is explicitly hidden in the live dashboard for 'boat' and 'mamaearth'
    # Reference: frontend/src/components/CommonLayout/Sidebar.jsx (hideForDb: ['mamaearth', 'boat'])
    if db_name in ("boat", "mamaearth"):
        return []

    try:
        cnt = execute_select_query(f"SELECT count() FROM {db_name}.rb_pm_olap", database=db_name)
        if not cnt or cnt[0][0] == 0:
            return []
    except Exception:
        return []

    platforms = get_platforms_for_client(db_name)
    channels = get_channels_for_client(db_name)
    plat_channel_map = get_platform_channel_map(db_name)

    has_quickcomm = any("quick" in c or "qcomm" in c for c in channels)
    has_ecommerce = any("ecom" in c for c in channels)

    sections = [
        ("overview", "Performance Overview"),
        ("quadrants", "Campaign Quadrants (Q1–Q4)"),
        ("keyword_type", "Keyword Type Performance"),
    ]

    segs = []
    for sec_id, sec_label in sections:
        # 1. All Platforms (removed)

        # 2. Quick Commerce (if present)
        if has_quickcomm:
            segs.append({
                "id": f"pm_{sec_id}_quickcomm",
                "label": f"{sec_label} (Quick Commerce)",
                "section": sec_id,
                "channel": "quickcomm",
                "platform": "all",
            })

        # 3. E-Commerce (if present)
        if has_ecommerce:
            segs.append({
                "id": f"pm_{sec_id}_ecommerce",
                "label": f"{sec_label} (E-Commerce)",
                "section": sec_id,
                "channel": "ecommerce",
                "platform": "all",
            })

        # 4. Individual Platforms
        for p in platforms:
            p_clean = p.lower().strip()
            p_slug = p_clean.replace(" ", "_")
            p_chan = plat_channel_map.get(p_clean, "all")
            segs.append({
                "id": f"pm_{sec_id}_{p_slug}",
                "label": f"{sec_label} ({format_platform_label(p)})",
                "section": sec_id,
                "channel": p_chan,
                "platform": p_clean,
            })

    return segs


class PerformanceMarketingModule:
    name: str = "Performance Marketing"
    slug: str = "performance_marketing"
    segments: List[Dict[str, Any]] = CORE_SECTIONS

    @classmethod
    def get_segments(cls, client: Optional[str] = "boat") -> List[Dict[str, Any]]:
        return get_segments(client)

    @classmethod
    def _get_segment_info(cls, segment: str, client: Optional[str] = "boat") -> Dict[str, Any]:
        all_segs = get_segments(client)
        for s in all_segs:
            if s["id"] == segment:
                return s
        for s in CORE_SECTIONS:
            if s["id"] == segment:
                return s

        # Dynamic fallback parser
        sec = "overview"
        if "quadrants" in segment:
            sec = "quadrants"
        elif "keyword_type" in segment:
            sec = "keyword_type"

        chan = "all"
        if "quickcomm" in segment:
            chan = "quickcomm"
        elif "ecommerce" in segment:
            chan = "ecommerce"

        plat = "all"
        for p in get_platforms_for_client(client):
            p_slug = p.lower().strip().replace(" ", "_")
            if segment.endswith(f"_{p_slug}"):
                plat = p.lower().strip()
                break

        return {
            "id": segment,
            "label": segment.replace("_", " ").title(),
            "section": sec,
            "channel": chan,
            "platform": plat,
        }

    @classmethod
    def get_kpis_for_segment(cls, segment: str, client: Optional[str] = "boat") -> List[Dict[str, Any]]:
        info = cls._get_segment_info(segment, client)
        sec = info.get("section", "overview")
        return KPIS_BY_SECTION.get(sec, KPIS_BY_SECTION["overview"])

    @classmethod
    def get_kpis(cls, segment: str, client: Optional[str] = "boat") -> List[Dict[str, Any]]:
        return cls.get_kpis_for_segment(segment, client=client)

    # -----------------------------------------------------------------------
    # STEP 1: API Layer Verification
    # -----------------------------------------------------------------------
    @classmethod
    def step1_fetch(cls, segment: str, period: Any, client: Optional[str] = "boat") -> Dict[str, Optional[float]]:
        info = cls._get_segment_info(segment, client)
        sec = info.get("section", "overview")
        plat = info.get("platform") or "all"
        chan = info.get("channel") or "all"
        target_db = client or "boat"
        api_plat = "All" if plat.lower() == "all" else plat
        api_chan = "All" if chan.lower() == "all" else chan

        params = {
            "platform": api_plat,
            "channel": api_chan,
        }

        if sec == "overview":
            res = call_platform_api(
                "/api/performance-marketing",
                params=params,
                period=period,
                db_name=target_db,
            )
            kpis: Dict[str, Optional[float]] = {}
            for card in res.get("kpi_cards", []):
                lbl = (card.get("label") or "").lower()
                val = card.get("value")
                if "impression" in lbl:
                    kpis["impressions"] = normalize_ui_text(val, target_unit="Cr")[0]
                elif "spend" in lbl:
                    kpis["spend"] = normalize_ui_text(val, target_unit="Cr")[0]
                elif "conversion" in lbl:
                    kpis["conversion"] = normalize_ui_text(val, target_unit="%")[0]
                elif "roas" in lbl:
                    kpis["roas"] = normalize_ui_text(val, target_unit="ratio")[0]

            for k in ["impressions", "spend", "conversion", "roas"]:
                if k not in kpis or kpis[k] is None:
                    kpis[k] = 0.0
            return kpis

        elif sec == "quadrants":
            res = call_platform_api(
                "/api/performance-marketing/quadrants",
                params=params,
                period=period,
                db_name=target_db,
            )
            return {
                "total": float(res.get("total", 0)),
                "q1": float(res.get("Q1", 0)),
                "q2": float(res.get("Q2", 0)),
                "q3": float(res.get("Q3", 0)),
                "q4": float(res.get("Q4", 0)),
            }

        elif sec == "keyword_type":
            res = call_platform_api(
                "/api/performance-marketing/keyword-type-performance",
                params=params,
                period=period,
                db_name=target_db,
            )
            rows = res.get("rows", [])
            kpis = {"branded_spend": 0.0, "generic_spend": 0.0, "competitor_spend": 0.0}
            for r in rows:
                lbl = (r.get("label") or "").lower().strip()
                vals = r.get("values", [])
                spend_raw = float(vals[0]) if vals and len(vals) > 0 and vals[0] is not None else 0.0
                spend_lakh = round(spend_raw / 100_000.0, 2)
                if "brand" in lbl:
                    kpis["branded_spend"] = spend_lakh
                elif "generic" in lbl:
                    kpis["generic_spend"] = spend_lakh
                elif "compet" in lbl or "comp" in lbl:
                    kpis["competitor_spend"] = spend_lakh
            return kpis

        return {}

    # -----------------------------------------------------------------------
    # STEP 2: Logic Layer Verification (ClickHouse direct calculation)
    # -----------------------------------------------------------------------
    @classmethod
    def step2_logic(cls, segment: str, period: Any, client: Optional[str] = "boat") -> Dict[str, Optional[float]]:
        info = cls._get_segment_info(segment, client)
        sec = info.get("section", "overview")
        plat = info.get("platform") or "all"
        chan = info.get("channel") or "all"
        target_db = client or "boat"
        start_date, end_date = period_to_date_range(period)

        def build_filter_conditions(s_date: str, e_date: str) -> List[str]:
            conds = [f"toDate(DATE) BETWEEN '{s_date}' AND '{e_date}'"]
            if plat.lower() != "all":
                conds.append(f"lower(Platform) = '{plat.lower()}'")
            if chan.lower() != "all":
                if "quick" in chan.lower() or "qcomm" in chan.lower():
                    conds.append("lower(channel) IN ('quickcomm', 'quick commerce', 'qcomm')")
                elif "ecom" in chan.lower():
                    conds.append("lower(channel) IN ('ecommerce', 'ecom', 'e-commerce')")
                else:
                    conds.append(f"lower(channel) = '{chan.lower()}'")
            return conds

        where_conds = build_filter_conditions(start_date, end_date)
        where_sql = " AND ".join(where_conds)

        if sec == "overview":
            q = f"""
            SELECT 
                sum(ifNull(toFloat64OrZero(toString(impressions)), 0)) as impressions,
                sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) as spend,
                sum(ifNull(toFloat64OrZero(toString(ad_sales)), 0)) as sales,
                sum(ifNull(toFloat64OrZero(toString(ad_click)), 0)) as clicks,
                sum(ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0)) as orders
            FROM {target_db}.rb_pm_olap
            WHERE {where_sql}
            """
            rows = execute_select_query(q, database=target_db)
            if not rows or not rows[0]:
                return {"impressions": 0.0, "spend": 0.0, "conversion": 0.0, "roas": 0.0}

            row = rows[0]
            raw_imp = float(row[0] or 0)
            raw_spend = float(row[1] or 0)
            raw_sales = float(row[2] or 0)
            raw_clicks = float(row[3] or 0)
            raw_orders = float(row[4] or 0)

            imp_cr = round(raw_imp / 10_000_000.0, 2)
            spend_cr = round(raw_spend / 10_000_000.0, 2)
            conv = round((raw_orders / raw_clicks * 100.0), 1) if raw_clicks > 0 else 0.0
            roas = round((raw_sales / raw_spend), 2) if raw_spend > 0 else 0.0

            return {
                "impressions": imp_cr,
                "spend": spend_cr,
                "conversion": conv,
                "roas": roas,
            }

        elif sec == "quadrants":
            q_curr = f"""
            SELECT 
                keyword,
                sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) as spend,
                sum(ifNull(toFloat64OrZero(toString(ad_sales)), 0)) as revenue,
                if(sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) > 0, sum(ifNull(toFloat64OrZero(toString(ad_sales)), 0))/sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)), 0) as roas
            FROM {target_db}.rb_pm_olap
            WHERE {where_sql} AND (ifNull(toFloat64OrZero(toString(ad_spend)), 0) > 0 OR ifNull(toFloat64OrZero(toString(ad_sales)), 0) > 0)
            GROUP BY keyword
            HAVING spend > 0
            """
            kw_rows = execute_select_query(q_curr, database=target_db)
            if not kw_rows:
                return {"total": 0.0, "q1": 0.0, "q2": 0.0, "q3": 0.0, "q4": 0.0}

            s_dt = datetime.strptime(start_date, "%Y-%m-%d")
            e_dt = datetime.strptime(end_date, "%Y-%m-%d")
            duration = (e_dt - s_dt).days + 1

            l2m_end = (s_dt - timedelta(days=1)).strftime("%Y-%m-%d")
            l2m_start = (datetime.strptime(l2m_end, "%Y-%m-%d") - timedelta(days=60)).strftime("%Y-%m-%d")

            l2m_conds = build_filter_conditions(l2m_start, l2m_end)
            l2m_where_sql = " AND ".join(l2m_conds)

            q_l2m = f"""
            SELECT 
                keyword,
                sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) as spend,
                sum(ifNull(toFloat64OrZero(toString(ad_sales)), 0)) as revenue,
                if(sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) > 0, sum(ifNull(toFloat64OrZero(toString(ad_sales)), 0))/sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)), 0) as roas
            FROM {target_db}.rb_pm_olap
            WHERE {l2m_where_sql} AND (ifNull(toFloat64OrZero(toString(ad_spend)), 0) > 0 OR ifNull(toFloat64OrZero(toString(ad_sales)), 0) > 0)
            GROUP BY keyword
            HAVING spend > 0
            """
            l2m_rows = execute_select_query(q_l2m, database=target_db)
            l2m_map = {r[0]: {"spend": float(r[1]), "roas": float(r[3])} for r in l2m_rows}

            q1, q2, q3, q4 = 0, 0, 0, 0
            for r in kw_rows:
                kw = r[0]
                curr_spend = float(r[1])
                curr_roas = float(r[3])
                kw_hist = l2m_map.get(kw, {"spend": 0.0, "roas": 0.0})
                avg_spend = (kw_hist["spend"] / 60.0) * duration
                avg_roas = kw_hist["roas"]

                if curr_roas >= avg_roas and curr_spend >= avg_spend:
                    q1 += 1
                elif curr_roas < avg_roas and curr_spend >= avg_spend:
                    q2 += 1
                elif curr_roas < avg_roas and curr_spend < avg_spend:
                    q3 += 1
                else:
                    q4 += 1

            return {
                "total": float(len(kw_rows)),
                "q1": float(q1),
                "q2": float(q2),
                "q3": float(q3),
                "q4": float(q4),
            }

        elif sec == "keyword_type":
            q = f"""
            SELECT 
                lower(keyword_type) as kw_type,
                sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) as spend
            FROM {target_db}.rb_pm_olap
            WHERE {where_sql}
            GROUP BY kw_type
            """
            rows = execute_select_query(q, database=target_db)
            kpis = {"branded_spend": 0.0, "generic_spend": 0.0, "competitor_spend": 0.0}
            for r in rows:
                kw_t = str(r[0] or "").lower().strip()
                sp = round(float(r[1] or 0) / 100_000.0, 2)
                if "brand" in kw_t:
                    kpis["branded_spend"] += sp
                elif "generic" in kw_t:
                    kpis["generic_spend"] += sp
                elif "compet" in kw_t or "comp" in kw_t:
                    kpis["competitor_spend"] += sp
            return kpis

        return {}

    # -----------------------------------------------------------------------
    # STEP 3: Live UI Layer Verification (Selenium Chrome Automation)
    # -----------------------------------------------------------------------
    @classmethod
    def step3_ui(
        cls,
        driver: webdriver.Chrome,
        segment: str,
        period: Any,
        client: Optional[str] = "boat",
        headless: bool = False,
        on_live_step: Optional[Any] = None,
    ) -> Dict[str, Any]:
        info = cls._get_segment_info(segment, client)
        sec = info.get("section", "overview")
        plat = info.get("platform") or "all"
        chan = info.get("channel") or "all"
        target_db = client or "boat"
        client_label = target_db.replace("_", " ").title()

        if on_live_step:
            on_live_step(f"Authenticating session for {client_label}...")

        target_url = f"{FRONTEND_URL}/performance-marketing"
        ensure_authenticated(driver, target_url, client=target_db)

        if not headless:
            bring_chrome_to_top(driver)
            show_live_step_banner(driver, f"📊 DS Tester: Loading Performance Marketing ({client_label})...")

        time.sleep(1.0)
        wait_for_loading_complete(driver, timeout=25)

        # 1. Reset all filters if checking All Platforms / All Channels
        if chan.lower() == "all" and plat.lower() == "all":
            if on_live_step:
                on_live_step("Resetting filters to All Platforms / All Channels...")
            try:
                driver.execute_script("""
                    const resetBtn = Array.from(document.querySelectorAll('button')).find(b => 
                        b.innerText && b.innerText.includes('Reset')
                    );
                    if (resetBtn) resetBtn.click();
                """)
                time.sleep(1.0)
                wait_for_loading_complete(driver, timeout=20)
            except Exception:
                pass

        # 2. Apply Channel filter if channel specified or required by platform
        if chan.lower() != "all":
            is_qc = "quick" in chan.lower() or "qcomm" in chan.lower()
            is_ecom = "ecom" in chan.lower()
            chan_label = "Quick Commerce" if is_qc else ("E-Commerce" if is_ecom else chan.capitalize())
            if on_live_step:
                on_live_step(f"Selecting Channel pill ({chan_label})...")

            driver.execute_script("""
                const isQc = arguments[0];
                const isEcom = arguments[1];
                const allSpans = Array.from(document.querySelectorAll('p, span, div, h6'));
                const tab = allSpans.find(el => {
                    if (el.children.length > 0) return false;
                    const txt = (el.innerText || '').trim();
                    if (isQc && (txt === 'QComm' || txt === 'Quick Commerce' || txt === 'QuickComm')) return true;
                    if (isEcom && (txt === 'EComm' || txt === 'E-Commerce' || txt === 'Ecommerce')) return true;
                    return false;
                });
                if (tab) {
                    const clickable = tab.closest("div[style*='cursor: pointer'], div[class*='cursor-pointer']") || tab.parentElement || tab;
                    clickable.click();
                }
            """, is_qc, is_ecom)
            time.sleep(1.5)
            wait_for_loading_complete(driver, timeout=20)

        # 3. Apply platform filter
        if plat.lower() != "all":
            if on_live_step:
                on_live_step(f"Selecting platform filter ({plat.capitalize()})...")

            apply_segment_platform(driver, plat)
            time.sleep(1.5)
            wait_for_loading_complete(driver, timeout=25)

        # 4. Apply period filter
        if on_live_step:
            on_live_step("Applying period filter...")

        apply_dashboard_period(driver, period)
        time.sleep(2.0)
        wait_for_loading_complete(driver, timeout=25)

        # 5. Scrape section-specific data
        if sec == "overview":
            if on_live_step:
                on_live_step("Focusing & Highlighting Performance Overview KPI Cards...")

            if not headless:
                bring_chrome_to_top(driver)
                show_live_step_banner(driver, "📊 DS Tester: Verifying Performance Overview KPI Cards...")

            driver.execute_script("""
                window.scrollTo({ top: 0, behavior: 'smooth' });
                const cardContents = document.querySelectorAll('.MuiCardContent-root');
                for (const cc of cardContents) {
                    const card = cc.closest('.MuiCard-root') || cc;
                    card.style.outline = '3px solid #16a34a';
                    card.style.boxShadow = '0 0 20px #16a34a';
                }
            """)
            time.sleep(1.0)

            cards = driver.execute_script("""
                const res = {};
                const cardContents = document.querySelectorAll('.MuiCardContent-root');
                for (const cc of cardContents) {
                    const titleEl = cc.querySelector('.MuiTypography-body2');
                    const valEl = cc.querySelector('.MuiTypography-h5');
                    if (titleEl && valEl) {
                        const title = titleEl.innerText.trim();
                        const val = valEl.innerText.trim();
                        if (title.includes('Impressions')) res.impressions = val;
                        else if (title.includes('Conversion')) res.conversion = val;
                        else if (title.includes('Spend')) res.spend = val;
                        else if (title.includes('ROAS')) res.roas = val;
                    }
                }
                return res;
            """)

            if on_live_step:
                on_live_step("Live UI verification complete!")

            return cards

        elif sec == "quadrants":
            if on_live_step:
                on_live_step("Scrolling to & Highlighting Campaign Quadrants...")

            if not headless:
                bring_chrome_to_top(driver)
                show_live_step_banner(driver, "📊 DS Tester: Verifying Campaign Quadrants (Q1–Q4)...")

            driver.execute_script("""
                const el = Array.from(document.querySelectorAll('h6, p, div')).find(e => 
                    e.innerText && e.innerText.includes('All Campaign Summary')
                );
                const container = el ? (el.closest('.MuiGrid-container') || el.closest('.MuiBox-root') || el.parentElement) : null;
                if (container) {
                    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    container.style.outline = '3px solid #16a34a';
                    container.style.boxShadow = '0 0 20px #16a34a';
                }
            """)
            time.sleep(1.0)

            res = driver.execute_script("""
                const quads = {};
                const cards = document.querySelectorAll('.MuiCard-root, .MuiPaper-root');
                for (const c of cards) {
                    const txt = c.innerText || '';
                    if (txt.includes('All Campaign Summary')) {
                        const lines = txt.split('\\n').map(l => l.trim()).filter(Boolean);
                        for (let i = 0; i < lines.length; i++) {
                            const l = lines[i];
                            if (l === 'All Campaign Summary' && i + 1 < lines.length) {
                                const nextVal = lines.slice(i+1, i+4).find(x => /^\\d+$/.test(x));
                                if (nextVal && !quads.total) quads.total = nextVal;
                            } else if (l.includes('Q1 - Performing Well') && i + 1 < lines.length) {
                                const nextVal = lines.slice(i+1, i+4).find(x => /^\\d+$/.test(x));
                                if (nextVal && !quads.q1) quads.q1 = nextVal;
                            } else if (l.includes('Q2 - Need Attention') && i + 1 < lines.length) {
                                const nextVal = lines.slice(i+1, i+4).find(x => /^\\d+$/.test(x));
                                if (nextVal && !quads.q2) quads.q2 = nextVal;
                            } else if (l.includes('Q3 - Experiment') && i + 1 < lines.length) {
                                const nextVal = lines.slice(i+1, i+4).find(x => /^\\d+$/.test(x));
                                if (nextVal && !quads.q3) quads.q3 = nextVal;
                            } else if (l.includes('Q4 - Opportunity') && i + 1 < lines.length) {
                                const nextVal = lines.slice(i+1, i+4).find(x => /^\\d+$/.test(x));
                                if (nextVal && !quads.q4) quads.q4 = nextVal;
                            }
                        }
                        break;
                    }
                }
                return quads;
            """)

            if on_live_step:
                on_live_step("Live UI verification complete!")

            return res

        elif sec == "keyword_type":
            if on_live_step:
                on_live_step("Scrolling to & Highlighting Keyword Type Performance Heatmap...")

            if not headless:
                bring_chrome_to_top(driver)
                show_live_step_banner(driver, "📊 DS Tester: Verifying Keyword Type Performance Heatmap...")

            driver.execute_script("""
                const allTables = document.querySelectorAll('table');
                let targetTable = null;
                for (const t of allTables) {
                    const ths = Array.from(t.querySelectorAll('thead th')).map(th => th.innerText.toLowerCase());
                    if (ths.some(h => h.includes('keyword type')) && ths.some(h => h.includes('spend')) && ths.some(h => h.includes('cpm') || h.includes('roas'))) {
                        targetTable = t;
                        break;
                    }
                }
                if (!targetTable && allTables.length >= 3) {
                    targetTable = allTables[2];
                }
                if (targetTable) {
                    targetTable.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const container = targetTable.closest('.rounded-3xl, .MuiPaper-root') || targetTable;
                    container.style.outline = '3px solid #16a34a';
                    container.style.boxShadow = '0 0 20px #16a34a';
                }
            """)
            time.sleep(1.0)

            res = driver.execute_script("""
                const allTables = document.querySelectorAll('table');
                let targetTable = null;
                for (const t of allTables) {
                    const ths = Array.from(t.querySelectorAll('thead th')).map(th => th.innerText.toLowerCase());
                    if (ths.some(h => h.includes('keyword type')) && ths.some(h => h.includes('spend')) && ths.some(h => h.includes('cpm') || h.includes('roas'))) {
                        targetTable = t;
                        break;
                    }
                }
                if (!targetTable && allTables.length >= 3) {
                    targetTable = allTables[2];
                }
                const kpis = {};
                if (!targetTable) return kpis;
                const trs = targetTable.querySelectorAll('tbody tr');
                for (const tr of trs) {
                    const cells = Array.from(tr.querySelectorAll('td, th')).map(c => c.innerText.trim());
                    if (cells.length >= 4) {
                        const lbl = cells[0].toLowerCase();
                        const spendVal = cells[3];
                        if (lbl.includes('brand') && !kpis.branded_spend) {
                            kpis.branded_spend = spendVal;
                        } else if (lbl.includes('generic') && !kpis.generic_spend) {
                            kpis.generic_spend = spendVal;
                        } else if ((lbl.includes('compet') || lbl.includes('comp')) && !kpis.competitor_spend) {
                            kpis.competitor_spend = spendVal;
                        }
                    }
                }
                return kpis;
            """)

            if on_live_step:
                on_live_step("Live UI verification complete!")

            return res

        return {}
