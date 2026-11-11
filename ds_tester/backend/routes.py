from typing import Dict, Any, List, Optional, Literal
from fastapi import FastAPI, APIRouter, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .modules import MODULES
from .runner import start_test_run, start_module_batch_run, get_run, get_latest_runs, is_runner_busy


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
    status: Literal["running", "done", "error"]
    overall: Literal["RUNNING", "PASS", "FAIL", "ERROR"]
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
    Fetches all active client workspaces dynamically from admin_master.tb_database in ClickHouse.
    Ensures newly onboarded clients appear in DS Tester automatically without code changes.
    """
    try:
        from .step2_logic import execute_select_query
        rows = execute_select_query("SELECT DISTINCT db_name FROM admin_master.tb_database WHERE status = 'active' ORDER BY db_name")
        if rows:
            label_map = {
                "boat": "boAt",
                "mars": "Mars Snacking",
                "mars_petcare": "Mars Petcare",
                "drl": "Dr. Reddy's",
                "pidilite": "Pidilite",
                "emami": "Emami",
                "mamaearth": "Mamaearth",
                "sugar": "Sugar Cosmetics",
                "danone": "Danone",
                "zydus": "Zydus",
            }
            results = []
            for r in rows:
                db_id = str(r[0]).strip().lower()
                if not db_id or db_id in ("system", "default", "information_schema"):
                    continue
                label = label_map.get(db_id, db_id.replace("_", " ").title())
                results.append({"id": db_id, "label": label, "category": None})
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
    """
    target_client = client or "boat"
    modules_list = []
    for mod_id, mod_cls in MODULES.items():
        if hasattr(mod_cls, "get_segments"):
            raw_segments = mod_cls.get_segments(client=target_client)
        else:
            raw_segments = mod_cls.segments

        segments_list = [
            SegmentInfo(id=s["id"], label=s["label"])
            for s in raw_segments
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
