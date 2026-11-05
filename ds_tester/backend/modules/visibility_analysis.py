import os
import time
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

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
)

CORE_SECTIONS = [
    {
        "id": "visibility_overview",
        "label": "Visibility Overview (All Platforms)",
        "section": "overview",
        "platform": "all",
    }
]

KPIS_BY_SECTION = {
    "overview": [
        {
            "key": "overall_sos",
            "label": "Overall SOS",
            "unit": "%",
            "decimals": 1,
            "abs_tol": 0.15,
            "rel_tol": 0.01,
        },
        {
            "key": "sponsored_sos",
            "label": "Sponsored SOS",
            "unit": "%",
            "decimals": 1,
            "abs_tol": 0.15,
            "rel_tol": 0.01,
        },
        {
            "key": "organic_sos",
            "label": "Organic SOS",
            "unit": "%",
            "decimals": 1,
            "abs_tol": 0.15,
            "rel_tol": 0.01,
        },
    ]
}


def get_platforms_for_client(client: Optional[str] = "boat") -> List[str]:
    """
    Dynamically queries ClickHouse {client}.rb_kw_olap to find distinct platforms available
    for this client. Zero hardcoding.
    """
    db_name = client or "boat"
    try:
        query = f"SELECT DISTINCT lower(platform_name) FROM {db_name}.rb_kw_olap WHERE platform_name IS NOT NULL AND platform_name != '' ORDER BY lower(platform_name)"
        rows = execute_select_query(query, database=db_name)
        platforms = [str(r[0]).strip() for r in rows if r and r[0]]
        if platforms:
            return platforms
    except Exception:
        pass

    try:
        query = f"SELECT DISTINCT platform FROM {db_name}.rca_sku_dim WHERE platform IS NOT NULL AND platform != '' ORDER BY platform"
        rows = execute_select_query(query, database=db_name)
        platforms = [str(r[0]).strip() for r in rows if r and r[0]]
        if platforms:
            return platforms
    except Exception:
        pass

    return ["amazon", "blinkit", "instamart", "zepto"]


def format_platform_label(plat: str) -> str:
    """Formats platform identifier into a clean title label (e.g. 'blinkit' -> 'Blinkit')."""
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
    Dynamically returns the list of segments for this client.
    Includes 'Visibility Overview (All Platforms)' plus one segment per platform
    actually present in {client}.rb_kw_olap.
    """
    platforms = get_platforms_for_client(client)
    segs = [
        {
            "id": "visibility_overview",
            "label": "Visibility Overview (All Platforms)",
            "section": "overview",
            "platform": "all",
        }
    ]

    for p in platforms:
        p_clean = p.strip().lower()
        if not p_clean:
            continue
        p_label = format_platform_label(p)
        seg_id = f"visibility_overview_{p_clean.replace(' ', '_').replace('-', '_')}"
        segs.append({
            "id": seg_id,
            "label": f"Visibility Overview ({p_label})",
            "section": "overview",
            "platform": p_clean,
        })

    return segs


def _get_segment_info(segment_id: str, client: Optional[str] = None) -> Dict[str, Any]:
    seg_clean = segment_id.lower().strip()

    if seg_clean in ("visibility_overview", "visibility overview (all platforms)"):
        return {
            "id": "visibility_overview",
            "label": "Visibility Overview (All Platforms)",
            "section": "overview",
            "platform": "all",
        }

    # Dynamic platform segment from ID, e.g. 'visibility_overview_blinkit'
    if seg_clean.startswith("visibility_overview_"):
        plat = seg_clean.replace("visibility_overview_", "").replace("_", " ").strip()
        return {
            "id": seg_clean,
            "label": f"Visibility Overview ({format_platform_label(plat)})",
            "section": "overview",
            "platform": plat,
        }

    # Dynamic platform segment from label, e.g. 'Visibility Overview (Blinkit)'
    if seg_clean.startswith("visibility overview (") and seg_clean.endswith(")"):
        plat = seg_clean[21:-1].strip()
        return {
            "id": f"visibility_overview_{plat.replace(' ', '_').replace('-', '_')}",
            "label": f"Visibility Overview ({format_platform_label(plat)})",
            "section": "overview",
            "platform": plat,
        }

    # Check client dynamic segments
    for s in get_segments(client):
        if s["id"] == seg_clean or s["label"].lower() == seg_clean:
            return s

    return {
        "id": "visibility_overview",
        "label": "Visibility Overview (All Platforms)",
        "section": "overview",
        "platform": "all",
    }


def get_kpis_for_segment(segment_id: str, client: Optional[str] = None) -> List[Dict[str, Any]]:
    return KPIS_BY_SECTION["overview"]


def step1_fetch(segment: str, period: Any, client: Optional[str] = "boat") -> Dict[str, Optional[float]]:
    """
    Step 1: API. Fetches Visibility Overview KPI cards from the Express backend API:
    /api/visibility-analysis/visibility-overview.
    Parses 'Overall SOS', 'Sponsored SOS', and 'Organic SOS'.
    """
    info = _get_segment_info(segment, client=client)
    db_name = client or "boat"
    plat = info.get("platform")

    api_params: Dict[str, Any] = {}
    if plat and plat != "all":
        api_params["platform"] = format_platform_label(plat)
    else:
        api_params["platform"] = "All"

    data = call_platform_api(
        endpoint="/api/visibility-analysis/visibility-overview",
        period=period,
        params=api_params,
        db_name=db_name,
    )

    cards = []
    if isinstance(data, dict):
        cards = data.get("cards", [])

    card_map = {}
    for c in cards:
        title = (c.get("title") or "").strip().lower()
        val = None
        raw_v = c.get("value")
        if raw_v is not None:
            cleaned = str(raw_v).replace("%", "").strip()
            try:
                val = float(cleaned)
            except (ValueError, TypeError):
                val = None

        if val is None:
            spark = c.get("sparklineData")
            if isinstance(spark, list) and len(spark) > 0 and spark[-1] is not None:
                try:
                    val = float(spark[-1])
                except (ValueError, TypeError):
                    val = None

        if "overall" in title:
            card_map["overall_sos"] = val
        elif "sponsored" in title or "ad sos" in title:
            card_map["sponsored_sos"] = val
        elif "organic" in title:
            card_map["organic_sos"] = val

    return {
        "overall_sos": card_map.get("overall_sos"),
        "sponsored_sos": card_map.get("sponsored_sos"),
        "organic_sos": card_map.get("organic_sos"),
    }


def step2_logic(segment: str, period: Any, client: Optional[str] = "boat") -> Dict[str, Optional[float]]:
    """
    Step 2: Logic query. Independently computes the SOS KPIs directly from ClickHouse table rb_kw_olap.
    Formulas:
      overall_sos   = ROUND(sumIf(overall, flag = 1) * 100.0 / nullIf(sum(overall), 0), 2)
      sponsored_sos = ROUND(sumIf(spons, flag = 1) * 100.0 / nullIf(sum(spons), 0), 2)
      organic_sos   = ROUND(sumIf(organic, flag = 1) * 100.0 / nullIf(sum(organic), 0), 2)
    """
    info = _get_segment_info(segment, client=client)
    db_name = client or "boat"
    start_date, end_date = period_to_date_range(period)

    # Dynamic column name resolution for safety
    plat_col = resolve_table_column(db_name, "rb_kw_olap", "platform_name") or "platform_name"
    flag_col = resolve_table_column(db_name, "rb_kw_olap", "flag") or "flag"

    plat_condition = ""
    plat = info.get("platform")
    if plat and plat != "all":
        plat_clean = plat.strip().lower()
        plat_condition = f"AND lower({plat_col}) = '{plat_clean}'"

    query = f"""
    SELECT
        ROUND(sumIf(overall, {flag_col} = 1) * 100.0 / nullIf(sum(overall), 0), 2) AS overall_sos,
        ROUND(sumIf(spons, {flag_col} = 1) * 100.0 / nullIf(sum(spons), 0), 2) AS sponsored_sos,
        ROUND(sumIf(organic, {flag_col} = 1) * 100.0 / nullIf(sum(organic), 0), 2) AS organic_sos
    FROM {db_name}.rb_kw_olap
    WHERE DATE BETWEEN '{start_date}' AND '{end_date}'
      {plat_condition}
    """

    try:
        rows = execute_select_query(query, database=db_name)
        if rows and rows[0]:
            r = rows[0]
            return {
                "overall_sos": float(r[0]) if r[0] is not None else None,
                "sponsored_sos": float(r[1]) if r[1] is not None else None,
                "organic_sos": float(r[2]) if r[2] is not None else None,
            }
    except Exception as e:
        print(f"[DS Tester] Error in step2_logic for visibility_analysis: {e}")

    return {
        "overall_sos": None,
        "sponsored_sos": None,
        "organic_sos": None,
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
    Step 3: Selenium UI scraping.
    Navigates to /visibility-anlysis, applies period & platform, and scrapes the live
    SnapshotOverview cards.
    """
    target_client = client or "boat"
    info = _get_segment_info(segment, client=target_client)
    target_plat = info.get("platform")

    # 1. Authenticate and navigate to Visibility Analysis page
    target_url = f"{FRONTEND_URL}/visibility-anlysis"
    if on_live_step:
        on_live_step(f"Opening Visibility Analysis page for client '{target_client}'...")
    if not headless:
        show_live_step_banner(driver, f"Navigating to Visibility Analysis ({target_client})...")

    ensure_authenticated(driver, target_url, client=target_client)
    wait_for_loading_complete(driver, timeout=25)

    if not headless:
        bring_chrome_to_top(driver)

    # 2. Select Segment Platform (e.g. Blinkit, Instamart, or All)
    if target_plat and target_plat != "all":
        p_label = format_platform_label(target_plat)
        if on_live_step:
            on_live_step(f"Selecting platform '{p_label}' in UI...")
        if not headless:
            show_live_step_banner(driver, f"Switching Platform to {p_label}...")

        success, err = apply_segment_platform(driver, target_plat)
        if not success:
            if on_live_step:
                on_live_step(f"Notice: {err}")
            return {
                "overall_sos": "—",
                "sponsored_sos": "—",
                "organic_sos": "—",
            }
    else:
        if on_live_step:
            on_live_step("Ensuring All Platforms are selected...")
        apply_segment_platform(driver, "all")

    # 3. Apply Time Period in UI
    start_str = period.get("startDate") if isinstance(period, dict) else str(period)
    end_str = period.get("endDate") if isinstance(period, dict) else str(period)
    if on_live_step:
        on_live_step(f"Setting date range: {start_str} → {end_str}...")
    if not headless:
        show_live_step_banner(driver, f"Setting Dashboard Period: {start_str} to {end_str}...")

    apply_dashboard_period(driver, period)
    time.sleep(1.0)
    wait_for_loading_complete(driver, timeout=25)

    # 4. Scrape SnapshotOverview cards
    if on_live_step:
        on_live_step("Extracting live Overview SOS cards...")
    if not headless:
        bring_chrome_to_top(driver)
        show_live_step_banner(driver, "Scraping Visibility Overview Cards...")

    results: Dict[str, Optional[str]] = {
        "overall_sos": None,
        "sponsored_sos": None,
        "organic_sos": None,
    }

    try:
        cards_scraped = driver.execute_script(r"""
            const titles = [
                "Overall SOS",
                "Sponsored SOS",
                "Organic SOS"
            ];
            const res = {};
            const headings = Array.from(document.querySelectorAll("h3, h2, div"));
            titles.forEach(title => {
                const h = headings.find(el => el.innerText && el.innerText.trim().toLowerCase() === title.toLowerCase());
                if (h) {
                    const card = h.closest(".group") || h.closest("div.rounded-2xl") || h.parentElement?.parentElement?.parentElement;
                    if (card) {
                        card.style.outline = '2px solid #0284c7';
                        const valEl = card.querySelector(".text-3xl span, .text-3xl, div[class*='text-3xl'] span, div[class*='text-3xl']");
                        if (valEl && valEl.innerText.trim()) {
                            res[title] = valEl.innerText.trim();
                        }
                    }
                }
            });
            return res;
        """)

        if isinstance(cards_scraped, dict):
            if cards_scraped.get("Overall SOS"):
                results["overall_sos"] = cards_scraped["Overall SOS"]
            if cards_scraped.get("Sponsored SOS"):
                results["sponsored_sos"] = cards_scraped["Sponsored SOS"]
            if cards_scraped.get("Organic SOS"):
                results["organic_sos"] = cards_scraped["Organic SOS"]

        # Fallback card scan if headings weren't matched
        if not results["overall_sos"] or not results["sponsored_sos"] or not results["organic_sos"]:
            fallback = driver.execute_script(r"""
                const res = {};
                const cards = Array.from(document.querySelectorAll("div.rounded-2xl, div[class*='rounded-2xl']"));
                for (const c of cards) {
                    const txt = c.innerText || '';
                    if (txt.includes("Overall SOS") && !res.overall_sos) {
                        const m = txt.match(/(\d+\.?\d*)%/);
                        if (m) res.overall_sos = m[0];
                    }
                    if (txt.includes("Sponsored SOS") && !res.sponsored_sos) {
                        const m = txt.match(/(\d+\.?\d*)%/);
                        if (m) res.sponsored_sos = m[0];
                    }
                    if (txt.includes("Organic SOS") && !res.organic_sos) {
                        const m = txt.match(/(\d+\.?\d*)%/);
                        if (m) res.organic_sos = m[0];
                    }
                }
                return res;
            """)
            if isinstance(fallback, dict):
                for k, v in fallback.items():
                    if not results.get(k) and v:
                        results[k] = v

    except Exception as e:
        print(f"[DS Tester] Error scraping Visibility Overview cards: {e}")

    if not headless:
        try:
            bring_chrome_to_top(driver)
            show_live_step_banner(driver, "✅ Visibility Verification Complete!")
            time.sleep(2.0)
        except Exception:
            pass

    return results


class VisibilityAnalysisModule:
    name = "visibility_analysis"
    segments = CORE_SECTIONS
    kpis = KPIS_BY_SECTION["overview"]

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
