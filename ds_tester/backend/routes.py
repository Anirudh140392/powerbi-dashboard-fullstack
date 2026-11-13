from typing import Dict, Any, List, Optional, Literal
from fastapi import FastAPI, APIRouter, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .modules import MODULES
from .runner import (
    start_test_run,
    start_module_batch_run,
    get_run,
    get_latest_runs,
    is_runner_busy,
    get_active_run,
    cancel_active_run,
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
    client: Optional[str] = Field("boat", description="Target client database, e.g. 'boat', 'pidilite', 'mars'")
    headless: Optional[bool] = Field(False, description="Whether to run Selenium invisibly in headless mode (False = visible live Chrome)")


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
    client: Optional[str] = "boat"
    headless: Optional[bool] = False
    filters: Optional[Dict[str, Any]] = None
    started_at: str
    finished_at: Optional[str] = None
    status: Literal["pending", "running", "done", "error"]
    overall: Literal["PENDING", "RUNNING", "PASS", "FAIL", "ERROR"]
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
    client: Optional[str] = Field("boat", description="Target client database, e.g. 'boat', 'pidilite', 'mars'")
    headless: Optional[bool] = Field(False, description="Whether to run Selenium invisibly in headless mode")
    segments: Optional[List[str]] = Field(None, description="Optional subset of segment IDs; if omitted, runs all segments")


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
    {"id": "boat", "label": "boAt", "category": "Audio & Wearables"},
    {"id": "pidilite", "label": "Pidilite", "category": "Adhesives & Chemicals"},
    {"id": "mars", "label": "Mars Snacking", "category": "Confectionery"},
    {"id": "mars_petcare", "label": "Mars Petcare", "category": "Pet Care"},
    {"id": "drl", "label": "Dr. Reddy's", "category": "Pharmaceuticals"},
    {"id": "emami", "label": "Emami", "category": "Personal Care"},
    {"id": "mamaearth", "label": "Mamaearth", "category": "Personal Care"},
    {"id": "sugar", "label": "Sugar Cosmetics", "category": "Beauty"},
    {"id": "danone", "label": "Danone", "category": "Nutrition"},
    {"id": "zydus", "label": "Zydus", "category": "Healthcare"},
]


def get_dynamic_clients() -> List[Dict[str, Any]]:
    """
    Fetches all active client workspaces dynamically from admin_master.tb_database,
    joining admin_master.tb_user on db_id so every workspace is backed by a real
    database + user record instead of a hardcoded list.
    """
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
            results = []
            for r in rows:
                db_name = str(r[0]).strip().lower() if r and r[0] else ""
                if not db_name or db_name in ("system", "default", "information_schema"):
                    continue
                # Human-friendly label from the database name (e.g. "marico_beardo" -> "Marico Beardo")
                label = db_name.replace("_", " ").title()
                results.append({"id": db_name, "label": label, "category": None})
            if results:
                return results
    except Exception:
        pass

    return CLIENTS


@router.get("/clients", response_model=List[ClientInfo])
def list_clients():
    """
    Returns available client workspaces backed by real ClickHouse databases.
    Dynamically queried from admin_master.tb_database.
    """
    return [ClientInfo(**c) for c in get_dynamic_clients()]


@router.get("/modules", response_model=List[ModuleInfo])
def list_modules(client: Optional[str] = "boat"):
    """
    Returns available modules and their selectable segments dynamically for the client.
    Platforms are extracted dynamically from ClickHouse rca_sku_dim for that client.
    A single module that fails to load its segments is skipped instead of breaking the
    whole endpoint (e.g. when the client database is missing or ClickHouse is unreachable).
    """
    target_client = client or "boat"
    modules_list = []
    for mod_id, mod_cls in MODULES.items():
        try:
            if hasattr(mod_cls, "get_segments"):
                raw_segments = mod_cls.get_segments(client=target_client) or []
            else:
                raw_segments = list(getattr(mod_cls, "segments", []) or [])
        except Exception as exc:
            # One failing module must not 500 the entire /modules endpoint
            print(f"[DsTester] Skipping module '{mod_id}' (get_segments failed for client '{target_client}'): {exc}")
            continue

        segments_list = [
            SegmentInfo(id=s["id"], label=s["label"])
            for s in raw_segments
            if isinstance(s, dict) and s.get("id") and s.get("label")
        ]
        if not segments_list:
            continue
        mod_display_name = getattr(mod_cls, "display_name", None) or mod_cls.name.replace("_", " ").title()
        modules_list.append(
            ModuleInfo(id=mod_id, name=mod_display_name, segments=segments_list)
        )
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
        client=payload.client or "boat",
        headless=bool(payload.headless),
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
        client=payload.client or "boat",
        headless=bool(payload.headless),
        segments=payload.segments,
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


# ---------------------------------------------------------------------------
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


@app.get("/health")
def health_check():
    return {"status": "ok", "busy": is_runner_busy()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ds_tester.backend.routes:app", host="0.0.0.0", port=8002, reload=True)
