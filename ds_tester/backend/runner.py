import uuid
import threading
from datetime import datetime
from typing import Dict, Any, Optional, List

from .modules import get_module
from .comparator import normalize_ui_text, compare_kpi
from .step3_selenium import create_chrome_driver

# In-memory session store (results kept for current server session only)
_runs: Dict[str, Dict[str, Any]] = {}
_latest_by_segment: Dict[str, str] = {}  # key: "{module}:{segment}" -> run_id

# Concurrency lock: Only one run at a time (Selenium is blocking)
_runner_mutex = threading.Lock()
_is_busy: bool = False


def is_runner_busy() -> bool:
    global _is_busy
    return _is_busy


def start_test_run(module_name: str, segment: str, period: Any, client: Optional[str] = "boat", headless: bool = False) -> Dict[str, Any]:
    """
    Enqueues a test run in a background worker thread.
    Returns the run_id, or a clear busy response if another run is in progress.
    """
    global _is_busy
    with _runner_mutex:
        if _is_busy:
            return {
                "busy": True,
                "message": "Another test run is currently in progress. DS Tester allows only one run at a time.",
            }
        _is_busy = True

    module = get_module(module_name)
    if not module:
        with _runner_mutex:
            _is_busy = False
        raise ValueError(f"Module '{module_name}' is not registered.")

    run_id = f"run_{uuid.uuid4().hex[:10]}"
    now_iso = datetime.now().isoformat()
    target_client = client or "boat"

    # Extract filter metadata for complete verification window visibility
    info = module._get_segment_info(segment, client=target_client) if hasattr(module, "_get_segment_info") else {}
    plat_filter = info.get("platform") or "all"
    
    # Dynamically resolve channel associated with this platform / client
    if hasattr(module, "get_channel_for_platform") and plat_filter:
        dynamic_ch = module.get_channel_for_platform(target_client, plat_filter)
    elif hasattr(module, "get_default_channel_for_client"):
        dynamic_ch = module.get_default_channel_for_client(target_client)
    else:
        dynamic_ch = None

    start_str = period.get("startDate") if isinstance(period, dict) else str(period)
    end_str = period.get("endDate") if isinstance(period, dict) else str(period)

    run_record: Dict[str, Any] = {
        "run_id": run_id,
        "module": module_name,
        "segment": segment,
        "period": period,
        "client": target_client,
        "headless": headless,
        "filters": {
            "client": target_client,
            "module": module_name,
            "segment": segment,
            "platform": plat_filter,
            "channel": dynamic_ch.capitalize() if dynamic_ch else "All",
            "startDate": start_str,
            "endDate": end_str,
        },
        "started_at": now_iso,
        "finished_at": None,
        "status": "running",
        "overall": "RUNNING",
        "live_step": "Initializing 3-Way verification...",
        "live_screenshot": None,
        "steps": {
            "api": {"status": "pending", "error": None},
            "logic": {"status": "pending", "error": None},
            "ui": {"status": "pending", "error": None, "mode": "headless" if headless else "visible"},
        },
        "kpis": [],
    }

    _runs[run_id] = run_record
    seg_key = f"{module_name.lower()}:{segment.lower()}:{target_client.lower()}"
    _latest_by_segment[seg_key] = run_id

    # Spawn background worker
    worker = threading.Thread(
        target=_run_worker,
        args=(run_id, module, segment, period, target_client, headless),
        daemon=True,
    )
    worker.start()

    return {"busy": False, "run_id": run_id}


def _run_worker(run_id: str, module: Any, segment: str, period: Any, client: str = "boat", headless: bool = False):
    global _is_busy
    run = _runs[run_id]

    api_results: Dict[str, Optional[float]] = {}
    logic_results: Dict[str, Optional[float]] = {}
    ui_raw_results: Dict[str, Optional[str]] = {}

    api_err: Optional[str] = None
    logic_err: Optional[str] = None
    ui_err: Optional[str] = None

    try:
        # Step 1: API
        run["steps"]["api"]["status"] = "running"
        try:
            api_results = module.step1_fetch(segment, period, client=client)
            run["steps"]["api"]["status"] = "done"
        except Exception as e:
            api_err = str(e)
            run["steps"]["api"]["status"] = "failed"
            run["steps"]["api"]["error"] = api_err

        # Step 2: Logic (ClickHouse OLAP)
        run["steps"]["logic"]["status"] = "running"
        try:
            logic_results = module.step2_logic(segment, period, client=client)
            run["steps"]["logic"]["status"] = "done"
        except Exception as e:
            logic_err = str(e)
            run["steps"]["logic"]["status"] = "failed"
            run["steps"]["logic"]["error"] = logic_err

        # Step 3: UI (Selenium Chrome)
        run["steps"]["ui"]["status"] = "running"
        driver = None

        def on_live_step(action_text: str):
            run["live_step"] = action_text
            if driver is not None:
                try:
                    b64 = driver.get_screenshot_as_base64()
                    run["live_screenshot"] = f"data:image/jpeg;base64,{b64}"
                except Exception:
                    pass

        try:
            driver = create_chrome_driver(headless=headless)
            ui_raw_results = module.step3_ui(
                driver,
                segment,
                period,
                client=client,
                headless=headless,
                on_live_step=on_live_step,
            )
            run["steps"]["ui"]["status"] = "done"
            run["live_step"] = "Live UI verification complete!"
        except Exception as e:
            ui_err = str(e)
            run["steps"]["ui"]["status"] = "failed"
            run["steps"]["ui"]["error"] = ui_err
            run["live_step"] = f"Error in UI step: {ui_err}"
        finally:
            if driver is not None:
                try:
                    driver.quit()
                except Exception:
                    pass

        # Comparison per KPI
        kpi_results = []
        has_fail = False
        has_error = bool(api_err or logic_err or ui_err)

        active_kpis = module.get_kpis(segment, client=client) if hasattr(module, "get_kpis") else module.kpis
        is_platform_unavailable = bool(ui_raw_results.get("_platform_unavailable"))
        platform_name = ui_raw_results.get("_platform_name")

        for kpi_def in active_kpis:
            key = kpi_def["key"]
            api_val = api_results.get(key)
            logic_val = logic_results.get(key)
            raw_ui = ui_raw_results.get(key)
            ui_val, _ = normalize_ui_text(raw_ui, target_unit=kpi_def.get("unit"))

            # For platform overview table, omit platform metrics that are not part of this client's ecosystem
            if segment == "platform_overview" and api_val is None and logic_val is None and ui_val is None and not raw_ui:
                continue

            comp = compare_kpi(
                kpi_def=kpi_def,
                api_val=api_val,
                logic_val=logic_val,
                ui_val=ui_val,
                ui_raw=raw_ui,
                api_err=api_err,
                logic_err=logic_err,
                ui_err=ui_err,
                platform_unavailable=is_platform_unavailable,
                platform_name=platform_name,
            )

            if comp["status"] == "FAIL":
                has_fail = True
            elif comp["status"] == "ERROR":
                has_error = True

            kpi_results.append(comp)

        run["kpis"] = kpi_results
        run["finished_at"] = datetime.now().isoformat()
        run["status"] = "done"

        if has_error:
            run["overall"] = "ERROR"
        elif has_fail:
            run["overall"] = "FAIL"
        else:
            run["overall"] = "PASS"

    except Exception as exc:
        run["status"] = "error"
        run["overall"] = "ERROR"
        run["finished_at"] = datetime.now().isoformat()
        if not run["steps"]["api"].get("error") and run["steps"]["api"]["status"] == "running":
            run["steps"]["api"]["status"] = "failed"
            run["steps"]["api"]["error"] = str(exc)
        if not run["steps"]["logic"].get("error") and run["steps"]["logic"]["status"] == "running":
            run["steps"]["logic"]["status"] = "failed"
            run["steps"]["logic"]["error"] = str(exc)
        if not run["steps"]["ui"].get("error") and run["steps"]["ui"]["status"] == "running":
            run["steps"]["ui"]["status"] = "failed"
            run["steps"]["ui"]["error"] = str(exc)
    finally:
        with _runner_mutex:
            _is_busy = False


def get_run(run_id: str) -> Optional[Dict[str, Any]]:
    return _runs.get(run_id)


def get_latest_runs() -> List[Dict[str, Any]]:
    """
    Returns latest run result per module+segment stored in current session.
    """
    latest = []
    for seg_key, r_id in _latest_by_segment.items():
        if r_id in _runs:
            latest.append(_runs[r_id])
    return latest
