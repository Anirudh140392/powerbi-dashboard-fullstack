import os
import time
import math
import requests
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from ..step1_api import call_platform_api
from ..step2_logic import execute_select_query, resolve_table_column
from ..step3_selenium import (
    FRONTEND_URL,
    ensure_authenticated,
    apply_segment_platform,
    apply_dashboard_period,
    apply_dashboard_channel,
    wait_for_loading_complete,
    bring_chrome_to_top,
    show_live_step_banner,
)

# ---------------------------------------------------------------------------
# Metric Definitions for Content Score (rb_product_verify)
# ---------------------------------------------------------------------------

BASE_SCORE_KPIS = [
    {
        "key": "title_score",
        "label": "Title Score",
        "unit": "%",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "image_score",
        "label": "Image Score",
        "unit": "%",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "si_score",
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
        "key": "overall_score",
        "label": "Overall Score",
        "unit": "%",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
]

DETAIL_VIEW_KPIS = [
    {
        "key": "sku_count",
        "label": "Verified Entities / Platforms",
        "unit": "",
        "decimals": 0,
        "abs_tol": 0.0,
        "rel_tol": 0.0,
    },
    {
        "key": "title_score",
        "label": "Title Score",
        "unit": "%",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "image_score",
        "label": "Images Score",
        "unit": "%",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "si_score",
        "label": "Secondary Images Score",
        "unit": "%",
        "decimals": 1,
        "abs_tol": 0.5,
        "rel_tol": 0.02,
    },
    {
        "key": "description_score",
        "label": "Features & Benefits Score",
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
]

PLATFORMS_SUPPORTING_RATINGS = {"bigbasket", "flipkart", "amazon"}


def has_product_verify_table(client: Optional[str] = "mars") -> bool:
    """Checks if rb_product_verify exists for the given client in ClickHouse."""
    db_name = client or "mars"
    try:
        query = f"SELECT count() FROM system.tables WHERE database = '{db_name}' AND name = 'rb_product_verify'"
        rows = execute_select_query(query, database=db_name)
        if rows and rows[0][0] > 0:
            return True
    except Exception:
        pass
    return False


def get_platforms_for_client(client: Optional[str] = "mars") -> List[str]:
    """Dynamically queries ClickHouse for distinct platforms in rb_product_verify."""
    db_name = client or "mars"
    if not has_product_verify_table(db_name):
        return []

    try:
        query = f"""
            SELECT DISTINCT lower(Platform) 
            FROM {db_name}.rb_product_verify 
            WHERE isNotNull(Platform) AND Platform != '' AND lower(Platform) NOT IN ('\\\\n', '\\\\N', 'null', 'none') 
            ORDER BY lower(Platform)
        """
        rows = execute_select_query(query, database=db_name)
        return [str(r[0]).strip() for r in rows if r and r[0] and str(r[0]).strip() not in ('\\n', '\\N', 'null', 'none', '')]
    except Exception as e:
        print(f"[Content Score] Error querying platforms from {db_name}.rb_product_verify: {e}")
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
    """Resolves Quick Commerce vs E-Commerce for a platform."""
    p = (platform or "").lower().strip()
    if p in ("amazon", "flipkart", "flipkart national", "myntra", "nykaa"):
        return "E-Commerce"
    if p in ("blinkit", "zepto", "instamart", "bigbasket", "bbnow", "flipkart minutes", "amazon now", "swiggy"):
        return "Quick Commerce"
    return "All Channels"


def get_segments(client: Optional[str] = "mars") -> List[Dict[str, Any]]:
    """
    Dynamically returns the list of segments for this client:
    1. Content Analysis Overview (All Platforms + each available platform)
    2. Cross Platform Overview (All Platforms Matrix)
    3. Platform Performance (Active Platform Studio)
    4. Content Analysis Detail View (SKU Paginated Table)
    """
    if not has_product_verify_table(client):
        return []

    platforms = get_platforms_for_client(client)
    
    # 1. Content Analysis Overview
    segs = [
        {
            "id": "content_overview",
            "label": "Content Analysis Overview (All Platforms)",
            "section": "content_overview",
            "platform": "all",
        }
    ]

    for p in platforms:
        p_clean = p.strip().lower()
        if not p_clean:
            continue
        p_label = format_platform_label(p)
        segs.append({
            "id": f"content_overview_{p_clean.replace(' ', '_').replace('-', '_')}",
            "label": f"Content Analysis Overview ({p_label})",
            "section": "content_overview",
            "platform": p_clean,
        })

    # 2. Cross Platform Overview
    segs.append({
        "id": "cross_platform_overview",
        "label": "Cross Platform Overview (All Platforms Matrix)",
        "section": "cross_platform_overview",
        "platform": "all",
    })

    # 3. Platform Performance
    segs.append({
        "id": "platform_performance",
        "label": "Platform Performance (Active Platform Studio)",
        "section": "platform_performance",
        "platform": "all",
    })

    # 4. Content Analysis Detail View
    segs.append({
        "id": "content_detail_view",
        "label": "Content Analysis Detail View (SKU Paginated Table)",
        "section": "content_detail_view",
        "platform": "all",
    })

    return segs


def _get_segment_info(segment_id: str, client: Optional[str] = None) -> Dict[str, Any]:
    seg_clean = segment_id.lower().strip()

    if seg_clean in ("cross_platform_overview", "cross platform overview"):
        return {
            "id": "cross_platform_overview",
            "label": "Cross Platform Overview (All Platforms Matrix)",
            "section": "cross_platform_overview",
            "platform": "all",
        }

    if seg_clean in ("platform_performance", "platform performance"):
        return {
            "id": "platform_performance",
            "label": "Platform Performance (Active Platform Studio)",
            "section": "platform_performance",
            "platform": "all",
        }

    if seg_clean in ("content_detail_view", "content analysis detail view", "detail_view"):
        return {
            "id": "content_detail_view",
            "label": "Content Analysis Detail View (SKU Paginated Table)",
            "section": "content_detail_view",
            "platform": "all",
        }

    if seg_clean.startswith("content_overview_"):
        plat = seg_clean.replace("content_overview_", "").replace("_", " ").strip()
        return {
            "id": seg_clean,
            "label": f"Content Analysis Overview ({format_platform_label(plat)})",
            "section": "content_overview",
            "platform": plat,
        }

    for s in get_segments(client):
        if s["id"] == seg_clean or s["label"].lower() == seg_clean:
            return s

    return {
        "id": "content_overview",
        "label": "Content Analysis Overview (All Platforms)",
        "section": "content_overview",
        "platform": "all",
    }


def get_kpis_for_segment(segment_id: str, client: Optional[str] = None) -> List[Dict[str, Any]]:
    info = _get_segment_info(segment_id, client=client)
    section = info.get("section", "content_overview")
    plat = (info.get("platform") or "").lower()

    if section == "content_detail_view":
        return DETAIL_VIEW_KPIS

    if plat and plat != "all" and plat not in PLATFORMS_SUPPORTING_RATINGS:
        return [k for k in BASE_SCORE_KPIS if k["key"] != "rating_score"]

    return BASE_SCORE_KPIS


# ---------------------------------------------------------------------------
# Step 1: API Execution
# ---------------------------------------------------------------------------

def run_step1_api(
    segment: str,
    period: Any,
    client: Optional[str] = "mars",
) -> Dict[str, Any]:
    db_name = client or "mars"
    info = _get_segment_info(segment, client=db_name)
    section = info.get("section", "content_overview")
    plat = info.get("platform", "all")

    start_date = period.get("startDate") or period.get("start")
    end_date = period.get("endDate") or period.get("end")

    params: Dict[str, Any] = {
        "startDate": str(start_date)[:10],
        "endDate": str(end_date)[:10],
    }

    def safe_f(v, default=0.0):
        if v is None:
            return default
        try:
            f = float(v)
            return default if math.isnan(f) or math.isinf(f) else f
        except Exception:
            return default

    # SECTION 1: Content Analysis Overview
    if section == "content_overview":
        if plat and plat != "all":
            params["platform"] = plat

        api_res = call_platform_api(
            endpoint="/api/content-analysis/overview",
            params=params,
            period=period,
            db_name=db_name,
        )
        curr = api_res.get("current") if isinstance(api_res, dict) else api_res
        if not isinstance(curr, dict):
            raise ValueError(f"Unexpected response from /api/content-analysis/overview: {api_res}")

        out = {
            "title_score": safe_f(curr.get("titleScore")),
            "image_score": safe_f(curr.get("imageScore")),
            "si_score": safe_f(curr.get("siScore")),
            "description_score": safe_f(curr.get("descScore")),
        }
        if "ratingScore" in curr and curr["ratingScore"] is not None:
            r_val = safe_f(curr["ratingScore"], default=None)
            if r_val is not None:
                out["rating_score"] = r_val

        if "overallScore" in curr and curr["overallScore"] is not None:
            out["overall_score"] = safe_f(curr["overallScore"])
        else:
            vals = [v for k, v in out.items() if v is not None and isinstance(v, (int, float))]
            out["overall_score"] = sum(vals) / len(vals) if vals else 0.0

        return out

    # SECTION 2: Cross Platform Overview
    elif section == "cross_platform_overview":
        api_res = call_platform_api(
            endpoint="/api/content-analysis/platform-breakdown",
            params=params,
            period=period,
            db_name=db_name,
        )
        overall = api_res.get("overall", {}).get("current", {}) if isinstance(api_res, dict) else {}
        return {
            "title_score": safe_f(overall.get("titleScore")),
            "image_score": safe_f(overall.get("imageScore")),
            "si_score": safe_f(overall.get("siScore")),
            "description_score": safe_f(overall.get("descScore")),
            "rating_score": safe_f(overall.get("ratingScore")),
            "overall_score": safe_f(overall.get("overallScore")),
        }

    # SECTION 3: Platform Performance
    elif section == "platform_performance":
        api_res = call_platform_api(
            endpoint="/api/content-analysis/platform-breakdown",
            params=params,
            period=period,
            db_name=db_name,
        )
        platforms = api_res.get("platforms", []) if isinstance(api_res, dict) else []
        target_p = None
        if plat and plat != "all":
            target_p = next((p for p in platforms if p.get("platform", "").lower() == plat.lower()), None)
        if not target_p and platforms:
            target_p = next((p for p in platforms if p.get("platform", "").lower() == "amazon"), platforms[0])

        curr = target_p.get("current", {}) if target_p else {}
        return {
            "title_score": safe_f(curr.get("titleScore")),
            "image_score": safe_f(curr.get("imageScore")),
            "si_score": safe_f(curr.get("siScore")),
            "description_score": safe_f(curr.get("descScore")),
            "rating_score": safe_f(curr.get("ratingScore")),
            "overall_score": safe_f(curr.get("overallScore")),
        }

    # SECTION 4: Detail View
    elif section == "content_detail_view":
        api_res = call_platform_api(
            endpoint="/api/content-analysis/platform-breakdown",
            params=params,
            period=period,
            db_name=db_name,
        )
        raw_platforms = api_res.get("platforms", []) if isinstance(api_res, dict) else []
        platforms = [
            p for p in raw_platforms
            if p.get("platform") and p["platform"].strip() not in ('', '\n', '\\n', '\\N', 'null', 'none')
        ]
        if not platforms:
            return {"sku_count": 0, "title_score": 0.0, "image_score": 0.0, "si_score": 0.0, "description_score": 0.0, "rating_score": 0.0}

        count = len(platforms)
        t_sum = sum(safe_f(p.get("current", {}).get("titleScore")) for p in platforms)
        img_sum = sum(safe_f(p.get("current", {}).get("imageScore")) for p in platforms)
        si_sum = sum(safe_f(p.get("current", {}).get("siScore")) for p in platforms)
        desc_sum = sum(safe_f(p.get("current", {}).get("descScore")) for p in platforms)
        
        ratings = [safe_f(p.get("current", {}).get("ratingScore")) for p in platforms if p.get("current", {}).get("ratingScore") is not None]
        rating_avg = sum(ratings) / len(ratings) if ratings else 0.0

        return {
            "sku_count": count,
            "title_score": round(t_sum / count, 2),
            "image_score": round(img_sum / count, 2),
            "si_score": round(si_sum / count, 2),
            "description_score": round(desc_sum / count, 2),
            "rating_score": round(rating_avg, 2),
        }

    return {}


# ---------------------------------------------------------------------------
# Step 2: Logic (OLAP ClickHouse Query)
# ---------------------------------------------------------------------------

def run_step2_logic(
    segment: str,
    period: Any,
    client: Optional[str] = "mars",
) -> Dict[str, Any]:
    db_name = client or "mars"
    info = _get_segment_info(segment, client=db_name)
    section = info.get("section", "content_overview")
    plat = info.get("platform", "all")

    start_date = period.get("startDate") or period.get("start")
    end_date = period.get("endDate") or period.get("end")

    where_clauses = [
        f"toDate(created_on) BETWEEN '{str(start_date)[:10]}' AND '{str(end_date)[:10]}'"
    ]

    def safe_row_f(r, idx, default=0.0):
        val = r[idx]
        if val is None:
            return default
        try:
            f = float(val)
            return default if math.isnan(f) or math.isinf(f) else f
        except Exception:
            return default

    # SECTION 1: Content Analysis Overview
    if section == "content_overview":
        if plat and plat != "all":
            if plat == "instamart":
                where_clauses.append("(lower(Platform) = 'instamart' OR lower(Platform) = 'swiggy')")
            else:
                where_clauses.append(f"lower(Platform) = '{plat}'")

        where_str = " AND ".join(where_clauses)
        query = f"""
            SELECT 
                AVG(verification_title) * 100 AS titleScore,
                AVG(verification_image) * 100 AS imageScore,
                AVG(
                    multiIf(
                        pf_id = 6, (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0)) / 5.0,
                        pf_id IN (1, 2, 3, 4, 7, 9), (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0) + coalesce(secondary_verification_image_7,0)) / 6.0,
                        0.0
                    )
                ) * 100 AS siScore,
                AVG(
                    multiIf(
                        pf_id IN (2, 6, 7, 9), description_verification / 1.0,
                        pf_id IN (1, 3, 4), (bulletin_verification + description_verification) / 2.0,
                        (bulletin_verification + description_verification) / 2.0
                    )
                ) * 100 AS descScore,
                AVG(IF(lower(Platform) IN ('bigbasket', 'flipkart', 'amazon'), IF(pdp_rating_value >= 4.2, 1.0, 0.0), NULL)) * 100 AS ratingScore
            FROM {db_name}.rb_product_verify
            WHERE {where_str}
        """
        rows = execute_select_query(query, database=db_name)
        if not rows or not rows[0]:
            return {"title_score": 0.0, "image_score": 0.0, "si_score": 0.0, "description_score": 0.0, "rating_score": None, "overall_score": 0.0}

        r = rows[0]
        t = safe_row_f(r, 0, 0.0)
        img = safe_row_f(r, 1, 0.0)
        si = safe_row_f(r, 2, 0.0)
        desc = safe_row_f(r, 3, 0.0)
        rating = safe_row_f(r, 4, None) if r[4] is not None else None

        active_scores = [t, img, si, desc]
        if rating is not None and (plat == "all" or plat in PLATFORMS_SUPPORTING_RATINGS):
            active_scores.append(rating)

        overall = sum(active_scores) / len(active_scores) if active_scores else 0.0
        out = {
            "title_score": round(t, 2),
            "image_score": round(img, 2),
            "si_score": round(si, 2),
            "description_score": round(desc, 2),
            "overall_score": round(overall, 2),
        }
        if plat == "all" or plat in PLATFORMS_SUPPORTING_RATINGS:
            out["rating_score"] = round(rating, 2) if rating is not None else None
        return out

    # SECTION 2: Cross Platform Overview
    elif section == "cross_platform_overview":
        where_str = " AND ".join(where_clauses)
        query = f"""
            SELECT 
                AVG(verification_title) * 100 AS titleScore,
                AVG(verification_image) * 100 AS imageScore,
                AVG(
                    multiIf(
                        pf_id = 6, (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0)) / 5.0,
                        pf_id IN (1, 2, 3, 4, 7, 9), (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0) + coalesce(secondary_verification_image_7,0)) / 6.0,
                        0.0
                    )
                ) * 100 AS siScore,
                AVG(
                    multiIf(
                        pf_id IN (2, 6, 7, 9), description_verification / 1.0,
                        pf_id IN (1, 3, 4), (bulletin_verification + description_verification) / 2.0,
                        (bulletin_verification + description_verification) / 2.0
                    )
                ) * 100 AS descScore,
                AVG(IF(lower(Platform) IN ('bigbasket', 'flipkart', 'amazon'), IF(pdp_rating_value >= 4.2, 1.0, 0.0), NULL)) * 100 AS ratingScore
            FROM {db_name}.rb_product_verify
            WHERE {where_str}
        """
        rows = execute_select_query(query, database=db_name)
        if not rows or not rows[0]:
            return {"title_score": 0.0, "image_score": 0.0, "si_score": 0.0, "description_score": 0.0, "rating_score": 0.0, "overall_score": 0.0}

        r = rows[0]
        t = safe_row_f(r, 0, 0.0)
        img = safe_row_f(r, 1, 0.0)
        si = safe_row_f(r, 2, 0.0)
        desc = safe_row_f(r, 3, 0.0)
        rating = safe_row_f(r, 4, 0.0)
        active_scores = [t, img, si, desc, rating]
        overall = sum(active_scores) / len(active_scores) if active_scores else 0.0

        return {
            "title_score": round(t, 2),
            "image_score": round(img, 2),
            "si_score": round(si, 2),
            "description_score": round(desc, 2),
            "rating_score": round(rating, 2),
            "overall_score": round(overall, 2),
        }

    # SECTION 3: Platform Performance
    elif section == "platform_performance":
        target_p = plat if (plat and plat != "all") else "amazon"
        where_clauses.append(f"lower(Platform) = '{target_p}'")
        where_str = " AND ".join(where_clauses)
        query = f"""
            SELECT 
                AVG(verification_title) * 100 AS titleScore,
                AVG(verification_image) * 100 AS imageScore,
                AVG((coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0) + coalesce(secondary_verification_image_7,0)) / 6.0) * 100 AS siScore,
                AVG((bulletin_verification + description_verification) / 2.0) * 100 AS descScore,
                AVG(IF(pdp_rating_value >= 4.2, 1.0, 0.0)) * 100 AS ratingScore
            FROM {db_name}.rb_product_verify
            WHERE {where_str}
        """
        rows = execute_select_query(query, database=db_name)
        if not rows or not rows[0]:
            return {"title_score": 0.0, "image_score": 0.0, "si_score": 0.0, "description_score": 0.0, "rating_score": 0.0, "overall_score": 0.0}

        r = rows[0]
        t = safe_row_f(r, 0, 0.0)
        img = safe_row_f(r, 1, 0.0)
        si = safe_row_f(r, 2, 0.0)
        desc = safe_row_f(r, 3, 0.0)
        rating = safe_row_f(r, 4, 0.0)
        active_scores = [t, img, si, desc, rating]
        overall = sum(active_scores) / len(active_scores)

        return {
            "title_score": round(t, 2),
            "image_score": round(img, 2),
            "si_score": round(si, 2),
            "description_score": round(desc, 2),
            "rating_score": round(rating, 2),
            "overall_score": round(overall, 2),
        }

    # SECTION 4: Detail View
    elif section == "content_detail_view":
        where_str = " AND ".join(where_clauses)
        query = f"""
            SELECT 
                lower(Platform) as plat,
                AVG(verification_title) * 100 AS titleScore,
                AVG(verification_image) * 100 AS imageScore,
                AVG(
                    multiIf(
                        pf_id = 6, (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0)) / 5.0,
                        pf_id IN (1, 2, 3, 4, 7, 9), (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0) + coalesce(secondary_verification_image_7,0)) / 6.0,
                        0.0
                    )
                ) * 100 AS siScore,
                AVG(
                    multiIf(
                        pf_id IN (2, 6, 7, 9), description_verification / 1.0,
                        pf_id IN (1, 3, 4), (bulletin_verification + description_verification) / 2.0,
                        (bulletin_verification + description_verification) / 2.0
                    )
                ) * 100 AS descScore,
                AVG(IF(lower(Platform) IN ('bigbasket', 'flipkart', 'amazon'), IF(pdp_rating_value >= 4.2, 1.0, 0.0), NULL)) * 100 AS ratingScore
            FROM {db_name}.rb_product_verify
            WHERE {where_str} AND isNotNull(Platform) AND Platform != ''
            GROUP BY lower(Platform)
        """
        rows = execute_select_query(query, database=db_name)
        if not rows:
            return {"sku_count": 0, "title_score": 0.0, "image_score": 0.0, "si_score": 0.0, "description_score": 0.0, "rating_score": 0.0}

        count = len(rows)
        t_sum = sum(safe_row_f(r, 1, 0.0) for r in rows)
        img_sum = sum(safe_row_f(r, 2, 0.0) for r in rows)
        si_sum = sum(safe_row_f(r, 3, 0.0) for r in rows)
        desc_sum = sum(safe_row_f(r, 4, 0.0) for r in rows)

        ratings = [safe_row_f(r, 5, 0.0) for r in rows if r[5] is not None]
        rating_avg = sum(ratings) / len(ratings) if ratings else 0.0

        return {
            "sku_count": count,
            "title_score": round(t_sum / count, 2),
            "image_score": round(img_sum / count, 2),
            "si_score": round(si_sum / count, 2),
            "description_score": round(desc_sum / count, 2),
            "rating_score": round(rating_avg, 2),
        }

    return {}


# ---------------------------------------------------------------------------
# Step 3: UI Execution (Live Selenium Scrape from /content-score)
# ---------------------------------------------------------------------------

def run_step3_ui(
    driver: Any,
    segment: str,
    period: Any,
    client: Optional[str] = "mars",
    headless: bool = False,
    on_live_step: Optional[Any] = None,
) -> Dict[str, Optional[str]]:
    db_name = client or "mars"
    info = _get_segment_info(segment, client=db_name)
    section = info.get("section", "content_overview")
    plat = info.get("platform", "all")
    target_url = f"{FRONTEND_URL}/content-score"

    if on_live_step:
        on_live_step(f"Opening Content Score dashboard for {db_name.capitalize()}...")

    ensure_authenticated(driver, target_url, client=db_name)
    wait_for_loading_complete(driver)

    if not headless:
        bring_chrome_to_top(driver)

    # 0. Apply Platform (or Reset to All)
    if plat and plat != "all":
        apply_segment_platform(driver, plat)
    else:
        apply_segment_platform(driver, "all")
    time.sleep(1.0)
    wait_for_loading_complete(driver)

    # 1. Apply Date Range
    if on_live_step:
        on_live_step(f"Setting date filter: {period.get('startDate')} to {period.get('endDate')}...")
    apply_dashboard_period(driver, period)
    time.sleep(2.5)
    wait_for_loading_complete(driver)

    if on_live_step:
        on_live_step(f"Extracting live data for {info.get('label')}...")

    # Scrape Cross Platform Overview matrix first
    cross_matrix = driver.execute_script(r"""
        const result = {};
        const crossSec = Array.from(document.querySelectorAll("*")).find(el => 
            el.innerText && el.innerText.includes("Cross Platform Overview") && el.querySelector(".overflow-x-auto")
        );
        if (!crossSec) return result;

        const headerDivs = Array.from(crossSec.querySelectorAll(".overflow-x-auto .flex.items-center.gap-2.mb-4 > div"));
        const platforms = headerDivs.slice(1).map(d => d.innerText.trim().toLowerCase());
        platforms.forEach(p => result[p] = {});

        const rows = Array.from(crossSec.querySelectorAll(".space-y-3 > div"));
        rows.forEach(r => {
            const rowText = r.innerText || "";
            const kpiNames = ["Overall Score", "Title Score", "Image Score", "SI Score", "Description Score", "Rating Score"];
            const matchedKpi = kpiNames.find(k => rowText.toLowerCase().includes(k.toLowerCase()));
            if (!matchedKpi) return;

            const cols = Array.from(r.querySelectorAll("button.flex-1, [class*='min-w-']"));
            cols.forEach((col, idx) => {
                if (idx < platforms.length) {
                    const platKey = platforms[idx];
                    const match = (col.innerText || "").match(/(\d+\.?\d*)%/);
                    if (match) {
                        result[platKey][matchedKpi] = match[0];
                    } else if (col.innerText.includes("—")) {
                        result[platKey][matchedKpi] = "—";
                    }
                }
            });
        });

        return result;
    """)

    results: Dict[str, Optional[str]] = {}

    # SECTION 1: Content Analysis Overview
    if section == "content_overview":
        plat_clean = plat.lower().strip()
        # If specific platform (e.g. bigbasket, flipkart), read directly from cross_matrix!
        if plat_clean and plat_clean != "all" and plat_clean in cross_matrix and len(cross_matrix[plat_clean]) > 0:
            p_data = cross_matrix[plat_clean]
            if "Title Score" in p_data:
                results["title_score"] = p_data["Title Score"]
            if "Image Score" in p_data:
                results["image_score"] = p_data["Image Score"]
            if "SI Score" in p_data:
                results["si_score"] = p_data["SI Score"]
            if "Description Score" in p_data:
                results["description_score"] = p_data["Description Score"]
            if "Rating Score" in p_data:
                results["rating_score"] = p_data["Rating Score"]
            if "Overall Score" in p_data:
                results["overall_score"] = p_data["Overall Score"]
        else:
            # Scrape top SnapshotOverview cards
            cards = driver.execute_script(r"""
                const res = {};
                const headings = Array.from(document.querySelectorAll("h3, h4, .text-xs, div, p, span"));
                const targetTitles = ["Title Score", "Image Score", "SI Score", "Description Score", "Rating Score", "Overall Score"];
                targetTitles.forEach(t => {
                    const h = headings.find(el => el.innerText && el.innerText.trim().toLowerCase() === t.toLowerCase());
                    if (h) {
                        const card = h.closest("div.rounded-2xl, div.rounded-3xl, .group") || h.parentElement?.parentElement;
                        if (card) {
                            const match = card.innerText.match(/(\d+\.?\d*)%/);
                            if (match) res[t] = match[0];
                        }
                    }
                });
                return res;
            """)
            if isinstance(cards, dict):
                if "Title Score" in cards: results["title_score"] = cards["Title Score"]
                if "Image Score" in cards: results["image_score"] = cards["Image Score"]
                if "SI Score" in cards: results["si_score"] = cards["SI Score"]
                if "Description Score" in cards: results["description_score"] = cards["Description Score"]
                if "Rating Score" in cards: results["rating_score"] = cards["Rating Score"]
                if "Overall Score" in cards: results["overall_score"] = cards["Overall Score"]

    # SECTION 2: Cross Platform Overview
    elif section == "cross_platform_overview":
        odd_data = cross_matrix.get("odd overall", {})
        if "Title Score" in odd_data: results["title_score"] = odd_data["Title Score"]
        if "Image Score" in odd_data: results["image_score"] = odd_data["Image Score"]
        if "SI Score" in odd_data: results["si_score"] = odd_data["SI Score"]
        if "Description Score" in odd_data: results["description_score"] = odd_data["Description Score"]
        if "Rating Score" in odd_data: results["rating_score"] = odd_data["Rating Score"]
        if "Overall Score" in odd_data: results["overall_score"] = odd_data["Overall Score"]

    # SECTION 3: Platform Performance
    elif section == "platform_performance":
        studio_data = driver.execute_script(r"""
            const studio = Array.from(document.querySelectorAll("*")).find(el => 
                el.innerText && el.innerText.includes("Platform performance") && el.querySelector("svg")
            );
            if (!studio) return {};

            const overallDiv = studio.querySelector(".text-lg.font-semibold");
            const metrics = {};
            if (overallDiv) metrics["overall_score"] = overallDiv.innerText.trim();

            const rows = Array.from(studio.querySelectorAll(".space-y-3 > div"));
            rows.forEach(r => {
                const labelEl = r.querySelector(".text-slate-600.font-medium");
                const valEl = r.querySelector(".font-bold");
                if (labelEl && valEl) {
                    const l = labelEl.innerText.trim();
                    if (l === "Title Score") metrics["title_score"] = valEl.innerText.trim();
                    else if (l === "Images Score") metrics["image_score"] = valEl.innerText.trim();
                    else if (l === "Secondary Images Score") metrics["si_score"] = valEl.innerText.trim();
                    else if (l === "Description Score") metrics["description_score"] = valEl.innerText.trim();
                    else if (l === "Rating Score") metrics["rating_score"] = valEl.innerText.trim();
                }
            });
            return metrics;
        """)
        if isinstance(studio_data, dict):
            results.update(studio_data)

    # SECTION 4: Detail View
    elif section == "content_detail_view":
        detail_data = driver.execute_script(r"""
            const detailSec = Array.from(document.querySelectorAll("*")).find(el => 
                el.innerText && el.innerText.includes("Content Analysis Detail View") && el.querySelector("table")
            );
            if (!detailSec) return {};

            const rows = Array.from(detailSec.querySelectorAll("tbody tr"));
            const parsed = [];
            rows.forEach(r => {
                const cells = Array.from(r.querySelectorAll("td")).map(c => c.innerText.trim());
                parsed.push(cells);
            });

            let titleSum = 0, imgSum = 0, siSum = 0, descSum = 0, ratingSum = 0, ratingCount = 0;
            parsed.forEach(p => {
                const t = parseFloat((p[1] || "").replace("%", ""));
                const im = parseFloat((p[2] || "").replace("%", ""));
                const si = parseFloat((p[3] || "").replace("%", ""));
                const d = parseFloat((p[4] || "").replace("%", ""));
                const rat = parseFloat((p[5] || "").replace("%", ""));

                if (!isNaN(t)) titleSum += t;
                if (!isNaN(im)) imgSum += im;
                if (!isNaN(si)) siSum += si;
                if (!isNaN(d)) descSum += d;
                if (!isNaN(rat)) { ratingSum += rat; ratingCount++; }
            });

            const count = parsed.length;
            return {
                sku_count: String(count),
                title_score: count ? (titleSum / count).toFixed(2) + "%" : "0%",
                image_score: count ? (imgSum / count).toFixed(2) + "%" : "0%",
                si_score: count ? (siSum / count).toFixed(2) + "%" : "0%",
                description_score: count ? (descSum / count).toFixed(2) + "%" : "0%",
                rating_score: ratingCount ? (ratingSum / ratingCount).toFixed(2) + "%" : "—",
            };
        """)
        if isinstance(detail_data, dict):
            results.update(detail_data)

    if not headless:
        try:
            bring_chrome_to_top(driver)
            show_live_step_banner(driver, f"Live Verification Complete! {info.get('label')} Verified")
            time.sleep(1.5)
        except Exception:
            pass

    return results


# ---------------------------------------------------------------------------
# Module Class Definition
# ---------------------------------------------------------------------------

class ContentScoreModule:
    id = "content_score"
    name = "Content Score"
    has_date = True

    @staticmethod
    def get_segments(client: Optional[str] = "mars") -> List[Dict[str, Any]]:
        return get_segments(client)

    @staticmethod
    def get_kpis(segment: str, client: Optional[str] = "mars") -> List[Dict[str, Any]]:
        return get_kpis_for_segment(segment, client=client)

    get_kpis_for_segment = get_kpis

    @staticmethod
    def _get_segment_info(segment: str, client: Optional[str] = "mars") -> Dict[str, Any]:
        return _get_segment_info(segment, client=client)

    @staticmethod
    def get_channel_for_platform(client: Optional[str], platform: str) -> str:
        return get_channel_for_platform(client, platform)

    @staticmethod
    def step1_fetch(segment: str, period: Any, client: Optional[str] = "mars") -> Dict[str, Any]:
        return run_step1_api(segment, period, client=client)

    @staticmethod
    def step2_logic(segment: str, period: Any, client: Optional[str] = "mars") -> Dict[str, Any]:
        return run_step2_logic(segment, period, client=client)

    @staticmethod
    def step3_ui(
        driver: Any,
        segment: str,
        period: Any,
        client: Optional[str] = "mars",
        headless: bool = False,
        on_live_step: Optional[Any] = None,
    ) -> Dict[str, Optional[str]]:
        return run_step3_ui(
            driver,
            segment,
            period,
            client=client,
            headless=headless,
            on_live_step=on_live_step,
        )

    # Aliases
    run_step1_api = step1_fetch
    run_step2_logic = step2_logic
    run_step3_ui = step3_ui
