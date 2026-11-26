import threading
import os
import sys
import subprocess
from urllib.parse import quote
import time
from datetime import datetime
from typing import Dict, Any, List, Optional, Literal
from fastapi import FastAPI, APIRouter, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .modules import MODULES
from .step1_api import call_platform_api
from .step3_selenium import normalize_client_db
from .anomaly_engine import anomaly_sentinel
from .anomaly_mailer import (
    render_anomaly_email_html,
    send_anomaly_assignment_email,
    DEFAULT_FROM_EMAIL
)
from .runner import (
    start_test_run,
    start_module_batch_run,
    get_run,
    get_latest_runs,
    is_runner_busy,
    get_active_run,
    cancel_active_run,
    clear_all_runs,
)


# ---------------------------------------------------------------------------
# Pydantic Models (as specified in Section 5)
# ---------------------------------------------------------------------------

class ClientInfo(BaseModel):
    id: str
    label: str
    category: Optional[str] = None


class SegmentInfo(BaseModel):
    id: str
    label: str


class ModuleInfo(BaseModel):
    id: str
    name: str
    segments: List[SegmentInfo]


class RunRequest(BaseModel):
    module: str = Field(..., description="Target module, e.g. 'pricing'")
    segment: str = Field(..., description="Target segment, e.g. 'pricing_overview', 'insights', 'platform_overview'")
    period: Dict[str, Any] = Field(..., description="Time period object with startDate and endDate")
    client: Optional[str] = Field("drl", description="Target client database, e.g. 'drl', 'prestige', 'boat', 'pidilite', 'mars'")
    headless: Optional[bool] = Field(False, description="Whether to run Selenium invisibly in headless mode (False = visible live Chrome)")
    filters: Optional[Dict[str, Any]] = Field(None, description="Active custom filters (e.g. brandName, retailerName, product, division, zone)")


class StepStatus(BaseModel):
    status: Literal["pending", "running", "done", "failed"]
    error: Optional[str] = None


class KpiResult(BaseModel):
    key: str
    label: str
    api: Optional[float] = None
    logic: Optional[float] = None
    ui: Optional[float] = None
    ui_raw: Optional[str] = None
    status: Literal["PASS", "FAIL", "ERROR"]
    reason: Optional[str] = None


class RunResult(BaseModel):
    run_id: str
    module: str
    segment: str
    period: Any
    client: Optional[str] = "drl"
    headless: Optional[bool] = False
    filters: Optional[Dict[str, Any]] = None
    started_at: str
    finished_at: Optional[str] = None
    status: Literal["pending", "running", "done", "error", "cancelled"]
    overall: Literal["PENDING", "RUNNING", "PASS", "FAIL", "ERROR", "CANCELLED"]
    steps: Dict[str, StepStatus]
    kpis: List[KpiResult]
    live_step: Optional[str] = None
    live_screenshot: Optional[str] = None


class RunResponse(BaseModel):
    busy: bool
    run_id: Optional[str] = None
    message: Optional[str] = None


class BatchRunRequest(BaseModel):
    module: str = Field(..., description="Target module, e.g. 'business_overview'")
    period: Any = Field(None, description="Time period object with startDate and endDate, or preset")
    client: Optional[str] = Field("drl", description="Target client database, e.g. 'drl', 'prestige', 'boat', 'pidilite', 'mars'")
    headless: Optional[bool] = Field(False, description="Whether to run Selenium invisibly in headless mode")
    segments: Optional[List[str]] = Field(None, description="Optional subset of segment IDs; if omitted, runs all segments")

    filters: Optional[Dict[str, Any]] = Field(None, description="Active custom filters (e.g. brandName, retailerName, product, division, zone)")


class BatchRunResponse(BaseModel):
    busy: bool
    batch_id: Optional[str] = None
    run_ids: Optional[List[str]] = None
    total_segments: Optional[int] = None
    message: Optional[str] = None


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/ds-tester", tags=["DS Tester"])


CLIENTS = [
    {"id": "drl", "label": "Dr. Reddy's", "category": "Pharmaceuticals"},
    {"id": "boat", "label": "boAt", "category": "Audio & Wearables"},
    {"id": "prestige", "label": "Prestige", "category": "Kitchen & Home"},
    {"id": "pidilite", "label": "Pidilite", "category": "Adhesives & Chemicals"},
    {"id": "mars", "label": "Mars Snacking", "category": "Confectionery"},
    {"id": "mars_petcare", "label": "Mars Petcare", "category": "Pet Care"},
    {"id": "emami", "label": "Emami", "category": "Personal Care"},
    {"id": "mamaearth", "label": "Mamaearth", "category": "Personal Care"},
    {"id": "sugar", "label": "Sugar Cosmetics", "category": "Beauty"},
    {"id": "danone", "label": "Danone", "category": "Nutrition"},
    {"id": "zydus", "label": "Zydus", "category": "Healthcare"},
    {"id": "colpal", "label": "Colgate-Palmolive", "category": "Oral Care"},
    {"id": "kelloggs", "label": "Kellogg's", "category": "Breakfast Foods"},
    {"id": "gcpl", "label": "Godrej Consumer", "category": "FMCG"},
    {"id": "hayatna", "label": "Hayatna", "category": "Dairy & Beverages"},
    {"id": "suhana_masala", "label": "Suhana Masala", "category": "Spices & Food"},
]

_cached_dynamic_clients: Optional[List[Dict[str, Any]]] = list(CLIENTS)
_cached_clients_time: float = 0.0

def get_dynamic_clients() -> List[Dict[str, Any]]:
    """
    Fetches all active client workspaces dynamically from admin_master.tb_database in ClickHouse,
    joining admin_master.tb_user on db_id so every workspace is backed by a real database record.
    Caches results in-memory so /clients returns instantly (0.1ms) without remote ClickHouse stalls.
    """
    global _cached_dynamic_clients, _cached_clients_time
    now = time.time()
    if _cached_dynamic_clients and (now - _cached_clients_time < 3600):
        return _cached_dynamic_clients

    try:
        from .step2_logic import execute_select_query
        # Connect to the admin_master database (the 'boat' default DB does not exist on this ClickHouse)
        rows = execute_select_query(
            """
            SELECT d.db_name, d.db_id, any(u.user_name) AS sample_user
            FROM admin_master.tb_database d
            LEFT JOIN admin_master.tb_user u ON u.db_id = d.db_id
            WHERE d.status = 'active'
            GROUP BY d.db_name, d.db_id
            ORDER BY d.db_name
            """,
            database="admin_master",
        )
        if rows:
            label_map = {
                "boat": "boAt",
                "mars": "Mars Snacking",
                "mars_petcare": "Mars Petcare",
                "drl": "Dr. Reddy's",
                "prestige": "Prestige",
                "pidilite": "Pidilite",
                "emami": "Emami",
                "mamaearth": "Mamaearth",
                "sugar": "Sugar Cosmetics",
                "danone": "Danone",
                "zydus": "Zydus",
                "colpal": "Colgate-Palmolive",
                "kelloggs": "Kellogg's",
                "gcpl": "Godrej Consumer",
                "hayatna": "Hayatna",
                "suhana_masala": "Suhana Masala",
            }
            results = []
            for r in rows:
                db_name = str(r[0]).strip().lower() if r and r[0] else ""
                if not db_name or db_name in ("system", "default", "information_schema", "demo", "testing", "trailytics"):
                    continue
                label = label_map.get(db_name, db_name.replace("_", " ").title())
                results.append({"id": db_name, "label": label, "category": None})
            if results:
                _cached_dynamic_clients = results
                _cached_clients_time = now
                return results
    except Exception as e:
        logger.warning(f"Error fetching dynamic clients from ClickHouse: {e}")

    if _cached_dynamic_clients:
        return _cached_dynamic_clients
    return CLIENTS


MODULE_PERMISSION_KEY_MAP = {
    "business_overview": ["Business Overview", "Watch Tower"],
    "pricing": ["Pricing Analysis", "Pricing"],
    "cross_platform_pricing": ["Cross Platform Pricing"],
    "availability_analysis": ["Availability Analysis", "Availability", "On Shelf Availability"],
    "visibility_analysis": ["Visibility Analysis", "Visibility"],
    "market_share": ["Market Share"],
    "performance_marketing": ["Performance Marketing", "Performance", "Ads"],
    "review_rating": ["Review Rating", "Review & Rating", "Rating"],
    "content_analysis": ["Content Analysis"],
    "content_score": ["Content Score"],
    "pds_score": ["PDS Score"],
    "geo_intelligence": ["India Overview", "Geo Intelligence"],
    "insights": ["Insights"],
    "primary_summary": ["Primary Summary", "Primary Sales"],
    "secondary_summary": ["Secondary Summary", "Secondary Sales"],
}

_client_perms_cache: Dict[str, Dict[str, Any]] = {}
_client_perms_cache_time: float = 0.0

def get_client_permissions(client_db: str) -> Optional[Dict[str, Any]]:
    """
    Fetches real tab permissions for a client from admin_master.tb_user joined with admin_master.tb_database.
    Caches results in-memory with a 1-hour TTL for ultra-fast, dynamic module resolution.
    """
    global _client_perms_cache, _client_perms_cache_time
    now = time.time()
    c = client_db.lower().strip()

    if _client_perms_cache and (now - _client_perms_cache_time < 3600):
        if c in _client_perms_cache:
            return _client_perms_cache[c]

    try:
        from .step2_logic import execute_select_query
        rows = execute_select_query("""
            SELECT lower(d.db_name), u.tab_permissions 
            FROM admin_master.tb_user u 
            JOIN admin_master.tb_database d ON toString(u.db_id) = toString(d.db_id) 
            WHERE u.tab_permissions != ''
            ORDER BY u.last_login DESC
        """)
        new_cache: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            db_name = str(r[0]).strip().lower()
            if db_name not in new_cache:
                try:
                    p = json.loads(r[1])
                    if isinstance(p, dict) and p:
                        new_cache[db_name] = p
                except Exception:
                    pass
        if new_cache:
            _client_perms_cache = new_cache
            _client_perms_cache_time = now
            return _client_perms_cache.get(c)
    except Exception as e:
        logger.warning(f"Error fetching dynamic client tab permissions: {e}")

    return _client_perms_cache.get(c)

def is_module_active_for_client(client_db: str, mod_id: str) -> bool:
    """
    Determines whether a module is genuinely active and enabled for the specific client brand.
    100% dynamic based on ClickHouse admin_master workspace permissions.
    """
    c = client_db.lower().strip()
    perms = get_client_permissions(c)
    if not perms:
        # Fallback when workspace has no explicit perms in tb_user:
        # Specialized modules require explicit opt-in
        return mod_id not in ("primary_summary", "secondary_summary", "pds_score", "performance_marketing")

    possible_keys = MODULE_PERMISSION_KEY_MAP.get(mod_id, [mod_id])
    for k in possible_keys:
        val = perms.get(k)
        if val is True or (isinstance(val, dict) and val.get("access") is True):
            return True
        if val is False:
            return False

    # If key is completely absent from permissions, it is NOT configured/enabled for this client
    if mod_id in ("primary_summary", "secondary_summary", "pds_score", "performance_marketing", "content_score", "content_analysis", "review_rating", "market_share"):
        return False
    return True


@router.get("/clients", response_model=List[ClientInfo])
def list_clients():
    """
    Returns available client workspaces backed by real ClickHouse databases.
    Dynamically queried from admin_master.tb_database.
    """
    return [ClientInfo(**c) for c in get_dynamic_clients()]


@router.get("/filters")
def get_module_filter_options(module: str, client: Optional[str] = "drl"):
    """
    Returns dynamic filter options directly from the client's database via backend API.
    """
    target_client = normalize_client_db(client)
    mod_name = module.lower().strip()

    try:
        if mod_name == "secondary_summary":
            resp = call_platform_api("/api/secondary-sales/filters", db_name=target_client)
            data = resp.get("data", {}) if isinstance(resp, dict) else {}
            return {"success": True, "data": data}

        elif mod_name == "primary_summary":
            resp = call_platform_api("/api/primary-sales/filters", db_name=target_client)
            data = resp.get("data", {}) if isinstance(resp, dict) else {}
            return {"success": True, "data": data}

        elif mod_name == "geo_intelligence":
            brands_resp = call_platform_api("/api/map-intellect/brands", db_name=target_client)
            cats_resp = call_platform_api("/api/map-intellect/categories", db_name=target_client)
            plats_resp = call_platform_api("/api/watchtower/platforms", db_name=target_client)
            brands = brands_resp if isinstance(brands_resp, list) else []
            cats = cats_resp if isinstance(cats_resp, list) else []
            plats = plats_resp if isinstance(plats_resp, list) else []

            from .step2_logic import execute_select_query
            raw_chans = execute_select_query(
                f"SELECT DISTINCT channel, platform FROM {target_client}.rca_sku_dim WHERE channel IS NOT NULL AND channel != ''",
                database=target_client,
            )
            channels = ["All"]
            channel_plats = {}
            for r in raw_chans:
                if r and r[0]:
                    ch_str = str(r[0]).strip()
                    pl_str = str(r[1]).strip() if len(r) > 1 and r[1] else None
                    if "quick" in ch_str.lower() or "qcomm" in ch_str.lower():
                        lbl = "Quick Commerce"
                    elif "ecom" in ch_str.lower():
                        lbl = "E-Commerce"
                    else:
                        lbl = ch_str
                    channels.append(lbl)
                    if pl_str:
                        channel_plats.setdefault(lbl, []).append(pl_str)

            channels = list(dict.fromkeys(channels))
            for k in channel_plats:
                channel_plats[k] = list(dict.fromkeys(channel_plats[k]))

            return {
                "success": True,
                "data": {
                    "channels": channels,
                    "channelPlatforms": channel_plats,
                    "brands": brands,
                    "categories": cats,
                    "platforms": plats,
                    "metrics": ["OSA %", "Market Share", "Sales", "Orders"],
                    "msls": ["All", "0", "1"],
                    "timePeriods": ["MTD", "7D", "14D", "31D", "Custom"],
                },
            }

        elif mod_name == "insights":
            filters_resp = call_platform_api("/api/insights/filters", db_name=target_client)
            filter_data = filters_resp.get("data", {}) if isinstance(filters_resp, dict) else {}
            brands = filter_data.get("brands", [])
            categories = filter_data.get("categories", [])
            geographies = filter_data.get("geographies", [])
            platforms = filter_data.get("platforms", [])

            from .step2_logic import execute_select_query
            raw_chans = execute_select_query(
                f"SELECT DISTINCT channel, platform FROM {target_client}.rca_sku_dim WHERE channel IS NOT NULL AND channel != ''",
                database=target_client,
            )
            channels = ["All"]
            channel_plats = {}
            for r in raw_chans:
                if r and r[0]:
                    ch_str = str(r[0]).strip()
                    pl_str = str(r[1]).strip() if len(r) > 1 and r[1] else None
                    if "quick" in ch_str.lower() or "qcomm" in ch_str.lower():
                        lbl = "Quick Commerce"
                    elif "ecom" in ch_str.lower():
                        lbl = "E-Commerce"
                    else:
                        lbl = ch_str
                    channels.append(lbl)
                    if pl_str:
                        channel_plats.setdefault(lbl, []).append(pl_str)

            channels = list(dict.fromkeys(channels))
            for k in channel_plats:
                channel_plats[k] = list(dict.fromkeys(channel_plats[k]))

            return {
                "success": True,
                "data": {
                    "channels": channels,
                    "channelPlatforms": channel_plats,
                    "brands": brands,
                    "categories": categories,
                    "platforms": platforms,
                    "cities": geographies,
                },
            }
        else:
            from .step2_logic import execute_select_query
            plats_raw = execute_select_query(
                f"SELECT DISTINCT platform FROM {target_client}.rca_sku_dim WHERE platform IS NOT NULL AND platform != '' ORDER BY platform ASC",
                database=target_client,
            )
            chans_raw = execute_select_query(
                f"SELECT DISTINCT channel FROM {target_client}.rca_sku_dim WHERE channel IS NOT NULL AND channel != '' ORDER BY channel ASC",
                database=target_client,
            )
            brands_raw = execute_select_query(
                f"SELECT DISTINCT brand_name FROM {target_client}.rca_sku_dim WHERE brand_name IS NOT NULL AND brand_name != '' ORDER BY brand_name ASC LIMIT 50",
                database=target_client,
            )
            cats_raw = execute_select_query(
                f"SELECT DISTINCT category FROM {target_client}.rca_sku_dim WHERE category IS NOT NULL AND category != '' ORDER BY category ASC LIMIT 50",
                database=target_client,
            )
            return {
                "success": True,
                "data": {
                    "platforms": ["All"] + [r[0] for r in plats_raw if r and r[0]],
                    "channels": ["All"] + [r[0] for r in chans_raw if r and r[0]],
                    "brands": ["All"] + [r[0] for r in brands_raw if r and r[0]],
                    "categories": ["All"] + [r[0] for r in cats_raw if r and r[0]],
                }
            }
    except Exception as e:
        return {"success": False, "error": str(e), "data": {}}

    return {"success": True, "data": {}}


_MODULES_CACHE: Dict[str, Any] = {}
_MODULES_CACHE_TTL = 600.0  # 10 min TTL so modules respond instantly (<1ms) on client switch

@router.get("/modules", response_model=List[ModuleInfo])
def list_modules(client: Optional[str] = "drl"):
    """
    Returns available modules and their selectable segments dynamically for the client.
    100% dynamic: only modules genuinely active and provisioned for that brand in ClickHouse
    permissions are returned, and individual failing modules are skipped gracefully.
    """
    target_client = normalize_client_db(client)
    now = time.time()
    if target_client in _MODULES_CACHE:
        cached_time, cached_list = _MODULES_CACHE[target_client]
        if now - cached_time < _MODULES_CACHE_TTL and len(cached_list) > 0:
            return cached_list

    modules_list = []
    for mod_id, mod_cls in MODULES.items():
        # Check dynamic workspace permissions: only include modules active for this brand
        if not is_module_active_for_client(target_client, mod_id):
            continue

        raw_segments = []
        try:
            if hasattr(mod_cls, "get_segments"):
                raw_segments = mod_cls.get_segments(client=target_client) or []
            else:
                raw_segments = list(getattr(mod_cls, "SEGMENTS", getattr(mod_cls, "segments", [])) or [])
        except Exception as exc:
            logger.warning(f"[DsTester] Skipping module '{mod_id}' (get_segments failed for client '{target_client}'): {exc}")
            continue

        segments_list = [
            SegmentInfo(id=s["id"], label=s["label"])
            for s in raw_segments
            if isinstance(s, dict) and s.get("id") and s.get("label")
        ]
        if not segments_list:
            continue
        mod_display_name = getattr(mod_cls, "display_name", None) or getattr(mod_cls, "name", mod_id).replace("_", " ").title()
        modules_list.append(
            ModuleInfo(id=mod_id, name=mod_display_name, segments=segments_list)
        )

    if modules_list:
        _MODULES_CACHE[target_client] = (now, modules_list)
    elif target_client in _MODULES_CACHE:
        return _MODULES_CACHE[target_client][1]

    return modules_list


@router.post("/run", response_model=RunResponse)
def trigger_run(payload: RunRequest):
    """
    Starts a test run for a module, segment, period, and client in a background worker.
    Returns 409 Conflict if a test is already running.
    """
    mod_name = payload.module.lower()
    if mod_name not in MODULES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module '{payload.module}' not found.",
        )

    res = start_test_run(
        module_name=mod_name,
        segment=payload.segment,
        period=payload.period,
        client=normalize_client_db(payload.client),
        headless=bool(payload.headless),
        filters=payload.filters,
    )
    if res.get("busy"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=res["message"],
        )

    return RunResponse(busy=False, run_id=res["run_id"])


@router.post("/run-all", response_model=BatchRunResponse)
def trigger_batch_run(payload: BatchRunRequest):
    """
    Starts a sequential batch run for ALL segments in the module with the given filters.
    Executes in a single continuous Selenium Chrome session for maximum speed.
    """
    mod_name = payload.module.lower()
    if mod_name not in MODULES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module '{payload.module}' not found.",
        )

    res = start_module_batch_run(
        module_name=mod_name,
        period=payload.period,
        client=normalize_client_db(payload.client),
        headless=bool(payload.headless),
        segments=payload.segments,
        filters=payload.filters,
    )
    if res.get("busy"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=res["message"],
        )

    return BatchRunResponse(
        busy=False,
        batch_id=res.get("batch_id"),
        run_ids=res.get("run_ids"),
        total_segments=res.get("total"),
    )


@router.get("/runs/{run_id}", response_model=RunResult)
def get_run_status(run_id: str):
    """
    Retrieves the status, per-step progress, and result of a run.
    """
    run_data = get_run(run_id)
    if not run_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{run_id}' not found.",
        )
    return run_data


@router.get("/runs", response_model=List[RunResult])
def list_latest_runs():
    """
    Retrieves the latest result per module+segment in the current session.
    """
    return get_latest_runs()


@router.get("/active")
def get_active_test_status():
    """
    Checks if a test is currently running and returns the active run data if present.
    Allows reconnected browser tabs to seamlessly attach to running tests.
    """
    active_run = get_active_run()
    return {
        "busy": is_runner_busy(),
        "has_active_run": active_run is not None,
        "run": active_run,
    }


@router.post("/cancel")
def cancel_active_test():
    """
    Cancels any active running test run, immediately terminating Selenium Chrome
    and releasing the runner mutex so a new test can be started right away.
    """
    return cancel_active_run()


@router.post("/runs/clear")
def clear_session_runs():
    """Clears all session run history for a clean test restart from 0."""
    return clear_all_runs()



# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Continuous Anomaly Sentinel Endpoints (2-Hour Cycle, 10% Threshold, 5 Levels)
# ---------------------------------------------------------------------------

@router.get("/anomaly/status")
def get_anomaly_status():
    """Returns status of the 2-hour Anomaly Sentinel scheduler."""
    anomaly_sentinel.refresh_store()
    return anomaly_sentinel.get_status()


@router.post("/anomaly/cancel")
def cancel_anomaly_scan():
    """Cancels active Sentinel sweep immediately, terminates Chrome driver, and releases runner."""
    anomaly_sentinel.cancel_pipeline()
    return cancel_active_run()


@router.post("/anomaly/clear")
def clear_anomalies_endpoint(client: Optional[str] = None):
    """Clears anomalies from the store for a given client or all clients."""
    anomaly_sentinel.clear_anomalies(client=client)
    return {
        "success": True,
        "message": f"Anomalies cleared for client={client or 'all'}",
        "anomalies_count": len(anomaly_sentinel.anomalies)
    }


@router.post("/anomaly/trigger")
def trigger_anomaly_scan(payload: Optional[Dict[str, Any]] = None):
    """Manually triggers an immediate 2-stage verification & anomaly sentinel pipeline in a background thread."""
    clients = payload.get("clients") if payload else None
    headless = payload.get("headless", True) if payload else True
    custom_filters = payload.get("custom_filters") if payload else None
    if is_runner_busy():
        return {
            "status": "busy",
            "message": "Another test run or sweep is currently active. Please stop it first or wait for completion."
        }
    anomaly_sentinel.last_pipeline_status = "Initializing 2-Stage Verification Pipeline..."
    worker = threading.Thread(
        target=anomaly_sentinel.run_chained_pipeline,
        args=(clients, headless, custom_filters),
        daemon=True,
        name="ManualSentinelTriggerWorker"
    )
    worker.start()
    return {
        "status": "started",
        "message": "Full Fleet 2-Stage Pipeline (Stage 1 DS Tester -> Stage 2 Sentinel) initiated in background."
    }


@router.get("/anomaly/results")
def get_anomaly_results(
    client: Optional[str] = None,
    module: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 200,
):
    """Fetches recorded anomalies with RCA, Playbook, and Hierarchical Breakdown."""
    anomaly_sentinel.refresh_store()
    res = anomaly_sentinel.anomalies
    if client and client.lower() != "all":
        target_client = normalize_client_db(client)
        res = [a for a in res if normalize_client_db(a.get("client")) == target_client]
    if module and module.lower() != "all":
        res = [a for a in res if str(a.get("module", "")).lower() == module.lower()]
    if severity and severity.lower() != "all":
        res = [a for a in res if str(a.get("severity", "")).lower() == severity.lower()]
    return {
        "total": len(res),
        "anomalies": res[:limit],
    }


@router.get("/anomaly/chart")
def get_anomaly_chart(
    client: str = "drl",
    metric: str = "offtakes",
    days: int = 30,
    granularity: str = "daily",
    platform: Optional[str] = None,
    kpi: Optional[str] = None,
    actual: Optional[float] = None,
    baseline: Optional[float] = None,
    deviation_pct: Optional[float] = None,
    severity: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    Returns time-series baseline corridor with +-10% bounds
    and 5-level hierarchical decomposition (Platform, City, Brand, Category, SKU).
    Supports granularity='daily' (30-day view) or granularity='2hour' (2-hour pulse checkpoints).
    """
    return anomaly_sentinel.get_kpi_time_series(
        client=client,
        metric=metric,
        days=days,
        granularity=granularity,
        platform=platform,
        kpi=kpi,
        verified_actual=actual,
        verified_baseline=baseline,
        verified_dev=deviation_pct,
        verified_severity=severity,
        start_date=start_date,
        end_date=end_date,
    )

class EmailAssignRequest(BaseModel):
    client: str = Field(..., description="Target client workspace, e.g. 'prestige', 'drl', 'boat'")
    recipients: Optional[List[str]] = Field(default=None, description="List of tester/engineer email addresses")
    anomaly_ids: Optional[List[str]] = Field(None, description="Optional subset of anomaly IDs")
    notes: Optional[str] = Field(None, description="Optional instructions or notes from assigner")
    priority: Optional[str] = Field("P1 - Critical", description="Priority level")
    from_email: Optional[str] = Field(DEFAULT_FROM_EMAIL, description="Sender email, defaults to business@trailytics.com")
    from_password: Optional[str] = Field(None, description="Optional custom SMTP password")
    smtp_host: Optional[str] = Field(None, description="Optional custom SMTP host")
    smtp_port: Optional[int] = Field(None, description="Optional custom SMTP port")


@router.post("/anomaly/preview-email")
def preview_anomaly_email(payload: EmailAssignRequest):
    """Generates and returns the full rendered Outlook HTML email for live preview before sending."""
    anomaly_sentinel.refresh_store()
    target_client = normalize_client_db(payload.client)
    all_anoms = [a for a in anomaly_sentinel.anomalies if normalize_client_db(a.get("client")) == target_client]
    
    if payload.anomaly_ids:
        selected_anoms = [a for a in all_anoms if a.get("id") in payload.anomaly_ids]
    else:
        selected_anoms = all_anoms

    if not selected_anoms and all_anoms:
        selected_anoms = all_anoms
    elif not selected_anoms:
        selected_anoms = []

    recip = ", ".join(payload.recipients) if payload.recipients else "abhishek.j@trailytics.com"
    assigner = payload.from_email or DEFAULT_FROM_EMAIL
    now_ts = datetime.now().strftime("%d %b %Y, %I:%M %p")
    for a in selected_anoms:
        a["assigned_to"] = recip
        a["assigned_by"] = assigner
        a["assigned_at"] = now_ts
        a["priority"] = payload.priority or "P1 - Critical"
        a["assignment_status"] = "ASSIGNED"
        if payload.notes:
            a["notes"] = payload.notes
    anomaly_sentinel._save_store()

    html = render_anomaly_email_html(
        client=target_client,
        anomalies=selected_anoms,
        notes=payload.notes,
        priority=payload.priority or "P1 - Critical",
        from_email=assigner,
        assignee_email=recip,
        embed_base64_charts=True
    )
    return {
        "success": True,
        "client": target_client,
        "count": len(selected_anoms),
        "html": html
    }


class OpenDesktopOutlookRequest(BaseModel):
    to: str = Field(..., description="Recipient email address")
    subject: str = Field(..., description="Subject line")
    body: str = Field(..., description="Body text")


@router.post("/anomaly/open-desktop-outlook")
def open_desktop_outlook(payload: OpenDesktopOutlookRequest):
    """Launches local Microsoft Outlook Desktop on Windows host via ShellExecute / explorer.exe."""
    try:
        clean_to = payload.to.strip()
        sub = quote(payload.subject)
        bod = quote(payload.body)
        mailto_url = f"mailto:{clean_to}?subject={sub}&body={bod}"
        if sys.platform == "win32":
            subprocess.Popen(["explorer.exe", mailto_url])
            return {"success": True, "message": "Launched Outlook Desktop on Windows host.", "mailto_url": mailto_url}
        else:
            return {"success": True, "mailto_url": mailto_url}
    except Exception as e:
        return {"success": False, "error": str(e)}


class MarkAnomalyDoneRequest(BaseModel):
    anomaly_id: Optional[str] = None
    anomaly_ids: Optional[List[str]] = None
    status: Optional[str] = "FIXED"
    fixed_by: Optional[str] = None
    notes: Optional[str] = None


@router.post("/anomaly/mark-done")
@router.post("/anomaly/resolve")
def mark_anomaly_done_endpoint(payload: MarkAnomalyDoneRequest):
    """
    Marks an assigned anomaly as FIXED or moves it back to ASSIGNED.
    Persists resolution metadata into the persistent anomaly store.
    """
    anomaly_sentinel.refresh_store()
    ids_to_update = set()
    if payload.anomaly_id:
        ids_to_update.add(payload.anomaly_id)
    if payload.anomaly_ids:
        ids_to_update.update(payload.anomaly_ids)

    if not ids_to_update:
        raise HTTPException(status_code=400, detail="No anomaly_id or anomaly_ids specified.")

    updated_count = 0
    now_ts = datetime.now().strftime("%d %b %Y, %I:%M %p")
    target_status = (payload.status or "FIXED").upper()

    with anomaly_sentinel._lock:
        for a in anomaly_sentinel.anomalies:
            if a.get("id") in ids_to_update:
                a["assignment_status"] = target_status
                a["status"] = target_status
                if target_status == "FIXED":
                    a["fixed_at"] = now_ts
                    a["fixed_by"] = payload.fixed_by or a.get("assigned_to") or "abhishek.j@trailytics.com"
                    if payload.notes:
                        a["resolution_notes"] = payload.notes
                else:
                    a["assignment_status"] = "ASSIGNED"
                    a["fixed_at"] = None
                    a["fixed_by"] = None
                updated_count += 1
        anomaly_sentinel._save_store()

    return {
        "success": True,
        "updated_count": updated_count,
        "status": target_status,
        "timestamp": now_ts
    }


@router.post("/anomaly/assign-email")
def assign_anomaly_email_endpoint(payload: EmailAssignRequest):
    """
    Dispatches Outlook-optimized HTML email with embedded trend chart to assigned tester(s).
    Also updates the anomaly store with assignment audit metadata.
    """
    anomaly_sentinel.refresh_store()
    target_client = normalize_client_db(payload.client)
    all_anoms = [a for a in anomaly_sentinel.anomalies if normalize_client_db(a.get("client")) == target_client]
    
    if payload.anomaly_ids:
        selected_anoms = [a for a in all_anoms if a.get("id") in payload.anomaly_ids]
    else:
        selected_anoms = all_anoms

    if not selected_anoms and all_anoms:
        selected_anoms = all_anoms
    elif not selected_anoms:
        return {
            "success": False,
            "error": f"No active anomalies found for client '{target_client}' to forward."
        }

    res = send_anomaly_assignment_email(
        client=target_client,
        recipients=payload.recipients,
        anomalies=selected_anoms,
        notes=payload.notes,
        priority=payload.priority or "P1 - Critical",
        from_email=payload.from_email or DEFAULT_FROM_EMAIL,
        from_password=payload.from_password,
        smtp_host=payload.smtp_host,
        smtp_port=payload.smtp_port
    )
    return res


# Standalone Application Mount
# ---------------------------------------------------------------------------

app = FastAPI(
    title="DS Tester API",
    description="Automated validation comparing API, ClickHouse OLAP, and live UI metrics.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)



@app.on_event("startup")
def on_startup():
    # Automated background scheduling disabled: all runs are initiated manually on-demand
    pass


@app.on_event("shutdown")
def on_shutdown():
    anomaly_sentinel.stop_scheduler()

@app.get("/health")
def health_check():
    return {"status": "ok", "busy": is_runner_busy()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ds_tester.backend.routes:app", host="0.0.0.0", port=8002, reload=True)
