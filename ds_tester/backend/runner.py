import uuid
import threading
from datetime import datetime
from typing import Dict, Any, Optional, List

from .modules import get_module
from .comparator import normalize_ui_text, compare_kpi
from .step3_selenium import create_chrome_driver

# In-memory session store (results kept for current server session only)
_runs: Dict[str, Dict[str, Any]] = {}
_latest_by_segment: Dict[str, str] = {}  # key: "{module}:{segment}:{client}" -> run_id

# Concurrency lock: Only one run at a time (Selenium is blocking)
_runner_mutex = threading.Lock()
_is_busy: bool = False


def is_runner_busy() -> bool:
    global _is_busy
    return _is_busy


def start_test_run(module_name: str, segment: str, period: Any, client: Optional[str] = "boat", headless: bool = False) -> Dict[str, Any]:
    """
    Enqueues a test run in a background worker thread for a single segment.
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
    chan_filter = info.get("channel") or "all"
    
    # Dynamically resolve channel associated with this platform / client
    if chan_filter and chan_filter != "all":
        dynamic_ch = chan_filter
    elif hasattr(module, "get_channel_for_platform") and plat_filter and plat_filter != "all":
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


def start_module_batch_run(
    module_name: str,
    period: Any,
    client: Optional[str] = "boat",
    headless: bool = False,
    segments: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Enqueues a batch test run for ALL segments in the specified module using the same filter.
    Shares a single live Chrome session across all segments for maximum speed and smoothness.
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

    target_client = client or "boat"

    # Resolve segments for this module and client
    if segments and len(segments) > 0:
        target_segments = segments
    elif hasattr(module, "get_segments"):
        raw_segs = module.get_segments(client=target_client)
        target_segments = [s["id"] for s in raw_segs]
    else:
        target_segments = [s["id"] for s in module.segments]

    if not target_segments:
        with _runner_mutex:
            _is_busy = False
        return {
            "busy": False,
            "message": f"No segments available for module '{module_name}' on client '{target_client}'.",
            "batch_id": None,
            "run_ids": [],
            "total": 0,
        }

    batch_id = f"batch_{uuid.uuid4().hex[:8]}"
    created_run_ids: List[str] = []
    now_iso = datetime.now().isoformat()

    start_str = period.get("startDate") if isinstance(period, dict) else str(period)
    end_str = period.get("endDate") if isinstance(period, dict) else str(period)

    # Pre-register all segment runs in session store
    for idx, seg in enumerate(target_segments):
        run_id = f"run_{uuid.uuid4().hex[:10]}"
        created_run_ids.append(run_id)

        info = module._get_segment_info(seg, client=target_client) if hasattr(module, "_get_segment_info") else {}
        plat_filter = info.get("platform") or "all"
        chan_filter = info.get("channel") or "all"

        if chan_filter and chan_filter != "all":
            dynamic_ch = chan_filter
        elif hasattr(module, "get_channel_for_platform") and plat_filter and plat_filter != "all":
            dynamic_ch = module.get_channel_for_platform(target_client, plat_filter)
        elif hasattr(module, "get_default_channel_for_client"):
            dynamic_ch = module.get_default_channel_for_client(target_client)
        else:
            dynamic_ch = None

        run_record: Dict[str, Any] = {
            "run_id": run_id,
            "batch_id": batch_id,
            "batch_index": idx + 1,
            "batch_total": len(target_segments),
            "module": module_name,
            "segment": seg,
            "period": period,
            "client": target_client,
            "headless": headless,
            "filters": {
                "client": target_client,
                "module": module_name,
                "segment": seg,
                "platform": plat_filter,
                "channel": dynamic_ch.capitalize() if dynamic_ch else "All",
                "startDate": start_str,
                "endDate": end_str,
            },
            "started_at": now_iso,
            "finished_at": None,
            "status": "running" if idx == 0 else "pending",
            "overall": "RUNNING" if idx == 0 else "PENDING",
            "live_step": f"Starting Segment 1/{len(target_segments)}: {seg}..." if idx == 0 else f"Queued in batch [{idx + 1}/{len(target_segments)}]...",
            "live_screenshot": None,
            "steps": {
                "api": {"status": "pending", "error": None},
                "logic": {"status": "pending", "error": None},
                "ui": {"status": "pending", "error": None, "mode": "headless" if headless else "visible"},
            },
            "kpis": [],
        }

        _runs[run_id] = run_record
        seg_key = f"{module_name.lower()}:{seg.lower()}:{target_client.lower()}"
        _latest_by_segment[seg_key] = run_id

    # Spawn batch background worker thread
    worker = threading.Thread(
        target=_run_batch_worker,
        args=(batch_id, created_run_ids, module, target_segments, period, target_client, headless),
        daemon=True,
    )
    worker.start()

    return {
        "busy": False,
        "batch_id": batch_id,
        "run_ids": created_run_ids,
        "total": len(created_run_ids),
    }


def _execute_single_run(
    run: Dict[str, Any],
    module: Any,
    segment: str,
    period: Any,
    client: str = "boat",
    headless: bool = False,
    existing_driver: Any = None,
    prefix_step: str = "",
):
    """
    Executes Step 1, Step 2, and Step 3 for a single segment run and populates results.
    If existing_driver is provided, it reuses that Chrome driver without terminating it.
    """
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
        driver = existing_driver
        owns_driver = False

        def on_live_step(action_text: str):
            full_text = f"{prefix_step} {action_text}".strip() if prefix_step else action_text
            run["live_step"] = full_text
            if driver is not None:
                try:
                    b64 = driver.get_screenshot_as_base64()
                    run["live_screenshot"] = f"data:image/jpeg;base64,{b64}"
                except Exception:
                    pass

        try:
            if driver is None:
                driver = create_chrome_driver(headless=headless)
                owns_driver = True

            ui_raw_results = module.step3_ui(
                driver,
                segment,
                period,
                client=client,
                headless=headless,
                on_live_step=on_live_step,
            )
            run["steps"]["ui"]["status"] = "done"
            run["live_step"] = f"{prefix_step} Live UI verification complete!".strip()
        except Exception as e:
            ui_err = str(e)
            run["steps"]["ui"]["status"] = "failed"
            run["steps"]["ui"]["error"] = ui_err
            run["live_step"] = f"Error in UI step: {ui_err}"
        finally:
            if owns_driver and driver is not None:
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


def _run_worker(run_id: str, module: Any, segment: str, period: Any, client: str = "boat", headless: bool = False):
    global _is_busy
    try:
        run = _runs[run_id]
        _execute_single_run(run, module, segment, period, client=client, headless=headless)
    finally:
        with _runner_mutex:
            _is_busy = False


def _run_batch_worker(
    batch_id: str,
    run_ids: List[str],
    module: Any,
    segments: List[str],
    period: Any,
    client: str = "boat",
    headless: bool = False,
):
    global _is_busy
    driver = None
    try:
        # Create single shared Chrome driver for the entire batch to verify sequentially in one browser session
        driver = create_chrome_driver(headless=headless)

        for idx, (run_id, seg) in enumerate(zip(run_ids, segments)):
            run = _runs[run_id]
            run["status"] = "running"
            run["overall"] = "RUNNING"
            seg_prefix = f"[{idx + 1}/{len(segments)} - {seg}]"
            run["live_step"] = f"{seg_prefix} Starting segment verification..."

            _execute_single_run(
                run,
                module,
                seg,
                period,
                client=client,
                headless=headless,
                existing_driver=driver,
                prefix_step=f"[{idx + 1}/{len(segments)}]",
            )

    except Exception as e:
        print(f"[DS Tester] Fatal error in batch worker ({batch_id}): {e}")
    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass
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
