import os
import time
import requests
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from ..step1_api import call_platform_api
from ..step2_logic import execute_select_query, resolve_table_column
from ..step3_selenium import (
    FRONTEND_URL,
    ensure_authenticated,
    apply_segment_platform,
    wait_for_loading_complete,
    bring_chrome_to_top,
    show_live_step_banner,
)

# ---------------------------------------------------------------------------
# Metric Definitions for Catalog Analysis
# ---------------------------------------------------------------------------

CATALOG_KPIS = [
    {
        "key": "total_score",
        "label": "Total Score",
        "unit": "%",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "title_score",
        "label": "Title Score",
        "unit": "",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "thumbnail_score",
        "label": "Thumbnail Image Score",
        "unit": "",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "thumbnail_video_score",
        "label": "Thumbnail Video Score",
        "unit": "",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "bullet_score",
        "label": "Bullet Score",
        "unit": "",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "description_score",
        "label": "Description Score",
        "unit": "",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "aplus_score",
        "label": "A+ Image Score",
        "unit": "",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
]

# Legacy rb_product_verify KPIs (for Mars)
PRODUCT_VERIFY_KPIS = [
    {
        "key": "title_score",
        "label": "Title Score",
        "unit": "%",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "thumbnail_score",
        "label": "Image Score",
        "unit": "%",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "bullet_score",
        "label": "SI Score",
        "unit": "%",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "description_score",
        "label": "Description Score",
        "unit": "%",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "rating_score",
        "label": "Rating Score",
        "unit": "%",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "total_score",
        "label": "Overall Score",
        "unit": "%",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
]

PLATFORMS_SUPPORTING_RATINGS = {"bigbasket", "flipkart", "amazon"}


def get_content_table(client: Optional[str] = "pidilite") -> Optional[str]:
    """
    Dynamically detects which content table exists for the given client:
    either 'rb_product_verify' or 'rb_content_olap'.
    Zero hardcoding of table names.
    """
    db_name = client or "pidilite"
    try:
        query = f"SELECT name FROM system.tables WHERE database = '{db_name}' AND name IN ('rb_content_olap', 'rb_product_verify')"
        rows = execute_select_query(query, database=db_name)
        if rows:
            found = [str(r[0]).strip() for r in rows if r and r[0]]
            if "rb_content_olap" in found:
                return "rb_content_olap"
            if "rb_product_verify" in found:
                return "rb_product_verify"
    except Exception as e:
        print(f"[DS Tester] Error checking content tables for {db_name}: {e}")
    return None


def get_platforms_for_client(client: Optional[str] = "pidilite") -> List[str]:
    """
    Dynamically queries ClickHouse to find distinct platforms available
    for this client in their content table. Zero hardcoding.
    """
    db_name = client or "pidilite"
    table = get_content_table(db_name)
    if not table:
        return []

    try:
        col = resolve_table_column(db_name, table, "Platform") or "Platform"
        query = f"SELECT DISTINCT lower({col}) FROM {db_name}.{table} WHERE isNotNull({col}) AND {col} != '' AND lower({col}) NOT IN ('\\\\n', '\\\\N', 'null', 'none') ORDER BY lower({col})"
        rows = execute_select_query(query, database=db_name)
        platforms = [str(r[0]).strip() for r in rows if r and r[0] and str(r[0]).strip() not in ('\\n', '\\N', 'null', 'none', '')]
        if platforms:
            return platforms
    except Exception as e:
        print(f"[DS Tester] Error querying platforms from {db_name}.{table}: {e}")

    return []


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
        elif wl == "bigbasket":
            capitalized.append("BigBasket")
        elif wl == "bbnow":
            capitalized.append("BBNow")
        else:
            capitalized.append(w.capitalize())
    return " ".join(capitalized)


def get_channel_for_platform(client: Optional[str], platform: str) -> str:
    """
    Resolves the exact commercial channel (Quick Commerce vs E-Commerce)
    for each platform dynamically.
    """
    p = (platform or "").lower().strip()
    if p in ("amazon", "flipkart", "flipkart national", "myntra", "nykaa"):
        return "E-Commerce"
    if p in ("blinkit", "zepto", "instamart", "bigbasket", "bbnow", "flipkart minutes", "amazon now", "swiggy"):
        return "Quick Commerce"
    return "All Channels"


def get_segments(client: Optional[str] = "pidilite") -> List[Dict[str, Any]]:
    """
    Dynamically returns the list of segments for this client:
    - Catalog Analysis (All Platforms + each available platform)
    - Content Coverage Breakdown (All Platforms + each available platform)
    Only active for clients that have 'rb_content_olap' (e.g. Pidilite, Danone).
    """
    table = get_content_table(client)
    if table != "rb_content_olap":
        return []

    platforms = get_platforms_for_client(client)
    segs = [
        {
            "id": "catalog_analysis",
            "label": "Catalog Analysis (All Platforms)",
            "section": "catalog_analysis",
            "platform": "all",
        }
    ]

    for p in platforms:
        p_clean = p.strip().lower()
        if not p_clean:
            continue
        p_label = format_platform_label(p)
        segs.append({
            "id": f"catalog_analysis_{p_clean.replace(' ', '_').replace('-', '_')}",
            "label": f"Catalog Analysis ({p_label})",
            "section": "catalog_analysis",
            "platform": p_clean,
        })

    segs.append({
        "id": "content_coverage",
        "label": "Content Coverage Breakdown (All Platforms)",
        "section": "content_coverage",
        "platform": "all",
    })

    for p in platforms:
        p_clean = p.strip().lower()
        if not p_clean:
            continue
        p_label = format_platform_label(p)
        segs.append({
            "id": f"content_coverage_{p_clean.replace(' ', '_').replace('-', '_')}",
            "label": f"Content Coverage Breakdown ({p_label})",
            "section": "content_coverage",
            "platform": p_clean,
        })

    return segs


def _get_segment_info(segment_id: str, client: Optional[str] = None) -> Dict[str, Any]:
    seg_clean = segment_id.lower().strip()

    # Aliases for backward compatibility
    if seg_clean in ("catalog_analysis", "catalog analysis (all platforms)", "content_overview", "content overview (all platforms)"):
        return {
            "id": "catalog_analysis",
            "label": "Catalog Analysis (All Platforms)",
            "section": "catalog_analysis",
            "platform": "all",
        }

    if seg_clean in ("content_coverage", "content coverage breakdown (all platforms)"):
        return {
            "id": "content_coverage",
            "label": "Content Coverage Breakdown (All Platforms)",
            "section": "content_coverage",
            "platform": "all",
        }

    # Dynamic platform segment from ID
    for prefix, section, title_prefix in [
        ("catalog_analysis_", "catalog_analysis", "Catalog Analysis"),
        ("content_coverage_", "content_coverage", "Content Coverage Breakdown"),
        ("content_overview_", "catalog_analysis", "Catalog Analysis"),
    ]:
        if seg_clean.startswith(prefix):
            plat = seg_clean.replace(prefix, "").replace("_", " ").strip()
            return {
                "id": seg_clean,
                "label": f"{title_prefix} ({format_platform_label(plat)})",
                "section": section,
                "platform": plat,
            }

    # Check client dynamic segments
    for s in get_segments(client):
        if s["id"] == seg_clean or s["label"].lower() == seg_clean:
            return s

    return {
        "id": "catalog_analysis",
        "label": "Catalog Analysis (All Platforms)",
        "section": "catalog_analysis",
        "platform": "all",
    }


def get_kpis_for_segment(segment_id: str, client: Optional[str] = None) -> List[Dict[str, Any]]:
    db_name = client or "pidilite"
    table = get_content_table(db_name)
    info = _get_segment_info(segment_id, client=client)
    plat = (info.get("platform") or "").lower()

    if table == "rb_product_verify":
        # rb_product_verify (e.g. Mars)
        if plat and plat != "all" and plat not in PLATFORMS_SUPPORTING_RATINGS:
            return [k for k in PRODUCT_VERIFY_KPIS if k["key"] != "rating_score"]
        return PRODUCT_VERIFY_KPIS

    # rb_content_olap (e.g. Pidilite, Danone)
    # Filter applicable metrics based on platform scoring rules:
    active = [k for k in CATALOG_KPIS if k["key"] in ("total_score", "title_score")]

    # Thumbnail Image Score
    active.append(next(k for k in CATALOG_KPIS if k["key"] == "thumbnail_score"))

    # Thumbnail Video Score (supported on Amazon, Zepto, Instamart, Blinkit, Flipkart; omitted on BigBasket)
    if plat not in ("bigbasket",):
        active.append(next(k for k in CATALOG_KPIS if k["key"] == "thumbnail_video_score"))

    # Bullet Score (supported on Amazon, BigBasket, Blinkit, Flipkart, Zepto; omitted on Instamart)
    if plat not in ("instamart",):
        active.append(next(k for k in CATALOG_KPIS if k["key"] == "bullet_score"))

    # Description Score (supported on Amazon, BigBasket, Blinkit, Flipkart, Instamart; omitted on Zepto)
    if plat not in ("zepto",):
        active.append(next(k for k in CATALOG_KPIS if k["key"] == "description_score"))

    # A+ Image Score (supported on Amazon, BigBasket, Blinkit, Flipkart, Zepto; omitted on Instamart)
    if plat not in ("instamart",):
        active.append(next(k for k in CATALOG_KPIS if k["key"] == "aplus_score"))

    return active


def call_content_dashboard_api(company: str, platform: Optional[str] = None) -> Dict[str, Any]:
    """
    Calls the dedicated content dashboard API on port 8000 (or via port 9500 proxy).
    Content Analysis operates on the active catalog snapshot, so no date filtering is required.
    """
    params = {"company": company, "page": "1", "limit": "1"}
    if platform and platform.lower() != "all":
        params["platform"] = format_platform_label(platform)

    for base_url in ("http://localhost:8000", "http://localhost:9500"):
        try:
            r = requests.get(f"{base_url}/api/content-dashboard", params=params, timeout=12)
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, dict):
                    return data
        except Exception:
            continue
    return {}


def step1_fetch(segment: str, period: Any = None, client: Optional[str] = "pidilite") -> Dict[str, Optional[float]]:
    """
    Step 1: API. Fetches Content Analysis KPI cards from the live API.
    Does not restrict by date (Content Analysis is an active catalog audit).
    """
    info = _get_segment_info(segment, client=client)
    db_name = client or "pidilite"
    plat = info.get("platform")
    table = get_content_table(db_name)

    def _to_float(v: Any) -> Optional[float]:
        if v is None:
            return None
        try:
            return round(float(v), 2)
        except (ValueError, TypeError):
            return None

    if table == "rb_content_olap":
        data = call_content_dashboard_api(company=db_name, platform=plat)
        summary = data.get("summary", {}) if isinstance(data, dict) else {}
        return {
            "total_score": _to_float(summary.get("averageScore")),
            "title_score": _to_float(summary.get("avgTitleScore")),
            "thumbnail_score": _to_float(summary.get("avgThumbnailScore")),
            "thumbnail_video_score": _to_float(summary.get("avgThumbnailVideoScore")),
            "bullet_score": _to_float(summary.get("avgBulletScore")),
            "description_score": _to_float(summary.get("avgDescriptionScore")),
            "aplus_score": _to_float(summary.get("avgAplusScore")),
        }

    # Fallback to rb_product_verify API for Mars
    api_params: Dict[str, Any] = {}
    if plat and plat != "all":
        api_params["platform"] = format_platform_label(plat)
    else:
        api_params["platform"] = "All"

    data = call_platform_api(
        endpoint="/api/content-analysis/overview",
        period=period,
        params=api_params,
        db_name=db_name,
    )
    current = data.get("current", {}) if isinstance(data, dict) else {}

    return {
        "total_score": _to_float(current.get("overallScore")),
        "title_score": _to_float(current.get("titleScore")),
        "thumbnail_score": _to_float(current.get("imageScore")),
        "bullet_score": _to_float(current.get("siScore")),
        "description_score": _to_float(current.get("descScore")),
        "rating_score": _to_float(current.get("ratingScore")),
    }


def step2_logic(segment: str, period: Any = None, client: Optional[str] = "pidilite") -> Dict[str, Optional[float]]:
    """
    Step 2: Logic query. Independently computes the Content Analysis KPIs directly from ClickHouse.
    Does not filter out catalog products by date range (evaluates the full catalog snapshot).
    """
    info = _get_segment_info(segment, client=client)
    db_name = client or "pidilite"
    table = get_content_table(db_name)

    if not table:
        print(f"[DS Tester] Notice: Client '{db_name}' has no content table in ClickHouse.")
        return {k["key"]: None for k in CATALOG_KPIS}

    plat = info.get("platform")
    plat_clean = (plat or "").strip().lower()

    plat_condition = ""
    if plat_clean and plat_clean != "all":
        if plat_clean == "instamart":
            plat_condition = "AND lower(platform) IN ('instamart', 'swiggy')"
        elif plat_clean in ("flipkart", "flipkart national", "flipkart minutes"):
            plat_condition = f"AND lower(platform) = '{plat_clean}'"
        else:
            plat_condition = f"AND lower(platform) = '{plat_clean}'"

    if table == "rb_content_olap":
        query = f"""
        SELECT
            ROUND(AVG(tot), 2) AS total_score,
            ROUND(AVG(t), 2) AS title_score,
            ROUND(AVG(th), 2) AS thumbnail_score,
            ROUND(AVG(v), 2) AS thumbnail_video_score,
            ROUND(AVG(b), 2) AS bullet_score,
            ROUND(AVG(d), 2) AS description_score,
            ROUND(AVG(a), 2) AS aplus_score
        FROM (
            SELECT
                CASE
                    WHEN lower(platform) = 'zepto' THEN
                        coalesce(title_score, 0) + coalesce(bullet_score, 0) + coalesce(thumbnail_image_score, 0) + coalesce(thumbnail_video_score, 0) + coalesce(aplus_image_score, 0)
                    WHEN lower(platform) = 'bigbasket' THEN
                        coalesce(title_score, 0) + coalesce(bullet_score, 0) + coalesce(description_score, 0) + coalesce(aplus_image_score, 0) + coalesce(thumbnail_image_score, 0)
                    WHEN lower(platform) IN ('instamart', 'swiggy') THEN
                        coalesce(title_score, 0) + coalesce(description_score, 0) + coalesce(thumbnail_image_score, 0) + coalesce(thumbnail_video_score, 0)
                    ELSE
                        coalesce(title_score, 0) + coalesce(bullet_score, 0) + coalesce(description_score, 0) + coalesce(aplus_image_score, 0) + coalesce(thumbnail_image_score, 0) + coalesce(thumbnail_video_score, 0)
                END AS tot,
                coalesce(title_score, 0) AS t,
                coalesce(thumbnail_image_score, 0) AS th,
                coalesce(thumbnail_video_score, 0) AS v,
                coalesce(bullet_score, 0) AS b,
                coalesce(description_score, 0) AS d,
                coalesce(aplus_image_score, 0) AS a
            FROM {db_name}.rb_content_olap
            WHERE 1=1 {plat_condition}
        )
        """
        try:
            rows = execute_select_query(query, database=db_name)
            if rows and rows[0]:
                r = rows[0]
                return {
                    "total_score": float(r[0]) if r[0] is not None else None,
                    "title_score": float(r[1]) if r[1] is not None else None,
                    "thumbnail_score": float(r[2]) if r[2] is not None else None,
                    "thumbnail_video_score": float(r[3]) if r[3] is not None else None,
                    "bullet_score": float(r[4]) if r[4] is not None else None,
                    "description_score": float(r[5]) if r[5] is not None else None,
                    "aplus_score": float(r[6]) if r[6] is not None else None,
                }
        except Exception as e:
            print(f"[DS Tester] Error in step2_logic for rb_content_olap: {e}")

    elif table == "rb_product_verify":
        query = f"""
        SELECT 
            ROUND(AVG(verification_title) * 100, 2) AS title_score,
            ROUND(AVG(verification_image) * 100, 2) AS image_score,
            ROUND(AVG(
                multiIf(
                    pf_id = 6, (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0)) / 5.0,
                    pf_id IN (1, 2, 3, 4, 7, 9), (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0) + coalesce(secondary_verification_image_7,0)) / 6.0,
                    0.0
                )
            ) * 100, 2) AS si_score,
            ROUND(AVG(
                multiIf(
                    pf_id IN (2, 6, 7, 9), description_verification / 1.0,
                    pf_id IN (1, 3, 4), (bulletin_verification + description_verification) / 2.0,
                    (bulletin_verification + description_verification) / 2.0
                )
            ) * 100, 2) AS desc_score,
            ROUND(AVG(multiIf(
                lower(Platform) NOT IN ('bigbasket', 'flipkart', 'amazon'), NULL,
                pdp_rating_value IS NULL OR pdp_rating_value = 0, NULL,
                pdp_rating_value >= 4.2, 100.0,
                0.0
            )), 2) AS rating_score
        FROM {db_name}.rb_product_verify
        WHERE 1=1 {plat_condition.replace('platform', 'Platform')}
        """
        try:
            rows = execute_select_query(query, database=db_name)
            if rows and rows[0]:
                r = rows[0]
                title = float(r[0]) if r[0] is not None else 0.0
                image = float(r[1]) if r[1] is not None else 0.0
                si = float(r[2]) if r[2] is not None else 0.0
                desc = float(r[3]) if r[3] is not None else 0.0
                rating = float(r[4]) if r[4] is not None else None

                scores = [title, image, si, desc]
                if rating is not None:
                    scores.append(rating)
                overall = round(sum(scores) / len(scores), 2) if scores else 0.0

                return {
                    "total_score": overall,
                    "title_score": title,
                    "thumbnail_score": image,
                    "bullet_score": si,
                    "description_score": desc,
                    "rating_score": rating,
                }
        except Exception as e:
            print(f"[DS Tester] Error in step2_logic for rb_product_verify: {e}")

    return {k["key"]: None for k in CATALOG_KPIS}


def step3_ui(
    driver: Any,
    segment: str,
    period: Any = None,
    client: Optional[str] = "pidilite",
    headless: bool = False,
    on_live_step: Optional[Any] = None,
) -> Dict[str, Optional[str]]:
    """
    Step 3: Selenium UI scraping.
    Navigates to /content-analysis (or /content-score), applies platform, and scrapes the live
    Catalog Analysis MetricCards.
    """
    target_client = client or "pidilite"
    info = _get_segment_info(segment, client=target_client)
    target_plat = info.get("platform")
    table = get_content_table(target_client)

    target_url = f"{FRONTEND_URL}/content-analysis" if table == "rb_content_olap" else f"{FRONTEND_URL}/content-score"

    if on_live_step:
        on_live_step(f"Opening Content Analysis for '{target_client}'...")
    if not headless:
        show_live_step_banner(driver, f"Navigating to Content Analysis ({target_client})...")

    ensure_authenticated(driver, target_url, client=target_client)
    time.sleep(3.0)
    wait_for_loading_complete(driver, timeout=25)

    if not headless:
        bring_chrome_to_top(driver)

    # Apply Segment Platform if targeted
    if target_plat and target_plat != "all":
        p_label = format_platform_label(target_plat)
        if on_live_step:
            on_live_step(f"Selecting platform '{p_label}'...")
        if not headless:
            show_live_step_banner(driver, f"Selecting Platform: {p_label}...")

        apply_segment_platform(driver, target_plat)
        time.sleep(2.0)
        wait_for_loading_complete(driver, timeout=20)

    # Scrape Catalog Analysis cards
    if on_live_step:
        on_live_step("Extracting live Catalog Analysis cards...")
    if not headless:
        bring_chrome_to_top(driver)
        show_live_step_banner(driver, "Scraping Catalog Analysis Cards...")

    results: Dict[str, Optional[str]] = {
        "total_score": None,
        "title_score": None,
        "thumbnail_score": None,
        "thumbnail_video_score": None,
        "bullet_score": None,
        "description_score": None,
        "aplus_score": None,
        "rating_score": None,
    }

    try:
        # 1. Scrape MetricCards (used by /content-analysis Dashboard.tsx)
        cards_scraped = driver.execute_script(r"""
            const res = {};
            document.querySelectorAll('h4').forEach(h => {
                const title = h.innerText.trim().toUpperCase();
                const card = h.parentElement;
                if (!card) return;
                const valEl = card.querySelector('p.text-2xl, p[class*="text-2xl"]');
                if (valEl && valEl.innerText.trim()) {
                    res[title] = valEl.innerText.trim();
                }
            });
            return res;
        """)

        if cards_scraped and len(cards_scraped) > 0:
            results["total_score"] = cards_scraped.get("TOTAL SCORE")
            results["title_score"] = cards_scraped.get("TITLE SCORE")
            results["thumbnail_score"] = cards_scraped.get("THUMBNAIL IMAGE SCORE")
            results["thumbnail_video_score"] = cards_scraped.get("THUMBNAIL VIDEO SCORE")
            results["bullet_score"] = cards_scraped.get("BULLET SCORE")
            results["description_score"] = cards_scraped.get("DESCRIPTION SCORE")
            results["aplus_score"] = cards_scraped.get("A+ IMAGE SCORE")
            return results

        # 2. Fallback to SnapshotOverview (used by /content-score)
        legacy_scraped = driver.execute_script(r"""
            const titles = ["Title Score", "Image Score", "SI Score", "Description Score", "Rating Score", "Overall Score"];
            const res = {};
            const headings = Array.from(document.querySelectorAll("h3, h2, div"));
            titles.forEach(title => {
                const h = headings.find(el => el.innerText && el.innerText.trim().toLowerCase() === title.toLowerCase());
                if (h) {
                    const card = h.closest(".group") || h.closest("div.rounded-2xl") || h.parentElement?.parentElement?.parentElement;
                    if (card) {
                        const valEl = card.querySelector(".text-3xl span, .text-3xl, div[class*='text-3xl'] span, div[class*='text-3xl']");
                        if (valEl && valEl.innerText.trim()) {
                            res[title] = valEl.innerText.trim();
                        }
                    }
                }
            });
            return res;
        """)

        if legacy_scraped:
            results["title_score"] = legacy_scraped.get("Title Score")
            results["thumbnail_score"] = legacy_scraped.get("Image Score")
            results["bullet_score"] = legacy_scraped.get("SI Score")
            results["description_score"] = legacy_scraped.get("Description Score")
            results["rating_score"] = legacy_scraped.get("Rating Score")
            results["total_score"] = legacy_scraped.get("Overall Score")

    except Exception as e:
        print(f"[DS Tester] Error scraping cards in step3_ui: {e}")

    return results


class ContentAnalysisModule:
    name = "content_analysis"
    has_date = False  # Content Analysis is an active catalog audit (no date filter needed)
    segments = [
        {
            "id": "catalog_analysis",
            "label": "Catalog Analysis (All Platforms)",
            "section": "catalog_analysis",
            "platform": "all",
        }
    ]
    kpis = CATALOG_KPIS

    @staticmethod
    def get_segments(client: Optional[str] = "pidilite") -> List[Dict[str, Any]]:
        return get_segments(client)

    @staticmethod
    def _get_segment_info(segment: str, client: Optional[str] = "pidilite") -> Dict[str, Any]:
        return _get_segment_info(segment, client)

    @staticmethod
    def get_channel_for_platform(client: Optional[str], platform: str) -> str:
        return get_channel_for_platform(client, platform)

    @staticmethod
    def get_kpis(segment: str, client: Optional[str] = "pidilite") -> List[Dict[str, Any]]:
        return get_kpis_for_segment(segment, client)

    @staticmethod
    def get_kpis_for_segment(segment_id: str, client: Optional[str] = "pidilite") -> List[Dict[str, Any]]:
        return get_kpis_for_segment(segment_id, client)

    @staticmethod
    def step1_fetch(segment: str, period: Any = None, client: Optional[str] = "pidilite") -> Dict[str, Optional[float]]:
        return step1_fetch(segment, period, client)

    @staticmethod
    def step2_logic(segment: str, period: Any = None, client: Optional[str] = "pidilite") -> Dict[str, Optional[float]]:
        return step2_logic(segment, period, client)

    @staticmethod
    def step3_ui(
        driver: Any,
        segment: str,
        period: Any = None,
        client: Optional[str] = "pidilite",
        headless: bool = False,
        on_live_step: Optional[Any] = None,
    ) -> Dict[str, Optional[str]]:
        return step3_ui(driver, segment, period, client, headless, on_live_step)
