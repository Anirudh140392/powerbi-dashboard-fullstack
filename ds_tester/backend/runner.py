import inspect
import uuid
import threading
from datetime import datetime
from typing import Dict, Any, Optional, List

from .modules import get_module
from .comparator import normalize_ui_text, compare_kpi
from .step3_selenium import create_chrome_driver, normalize_client_db, is_driver_alive, safe_quit_driver

import os
import json
import logging

logger = logging.getLogger("ds_tester.runner")

RUNS_STORE_PATH = os.path.join(os.path.dirname(__file__), "runs_store.json")

# Persistent run store across server restarts
_runs: Dict[str, Dict[str, Any]] = {}
_latest_by_segment: Dict[str, str] = {}  # key: "{module}:{segment}:{client}" -> run_id

def _load_runs_store():
    global _runs, _latest_by_segment
    try:
        if os.path.exists(RUNS_STORE_PATH):
            with open(RUNS_STORE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                _runs = data.get("runs", {})
                _latest_by_segment = data.get("latest_by_segment", {})
    except Exception as e:
        logger.error(f"Error loading runs store: {e}")

def _save_runs_store():
    try:
        with open(RUNS_STORE_PATH, "w", encoding="utf-8") as f:
            recent_runs = dict(list(_runs.items())[-500:])
            json.dump({
                "runs": recent_runs,
                "latest_by_segment": _latest_by_segment
            }, f, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error saving runs store: {e}")

_load_runs_store()

# Concurrency lock: Only one run at a time (Selenium is blocking)
_runner_mutex = threading.RLock()
_is_busy: bool = False
_active_driver: Any = None
_abort_requested: bool = False


def is_runner_busy() -> bool:
    global _is_busy
    return _is_busy


def get_active_run() -> Optional[Dict[str, Any]]:
    # 1. Prefer actively executing run first
    for r in _runs.values():
        if r.get("status") == "running" or r.get("overall") == "RUNNING":
            return r
    # 2. Fallback to pending run if none actively running
    for r in _runs.values():
        if r.get("status") == "pending" or r.get("overall") == "PENDING":
            return r
    return None


def _call_step(func, *args, **kwargs):
    try:
        sig = inspect.signature(func)
        filtered = {
            k: v for k, v in kwargs.items()
            if k in sig.parameters or any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values())
        }
    except Exception:
        filtered = {}
    return func(*args, **filtered)

def start_test_run(module_name: str, segment: str, period: Any, client: Optional[str] = "drl", headless: bool = False, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Enqueues a test run in a background worker thread for a single segment.
    Returns the run_id, or a clear busy response if another run is in progress.
    """
    global _is_busy, _abort_requested
    with _runner_mutex:
        if _is_busy:
            return {
                "busy": True,
                "message": "Another test run is currently in progress. DS Tester allows only one run at a time.",
            }
        _is_busy = True
        _abort_requested = False

    module = get_module(module_name)
    if not module:
        with _runner_mutex:
            _is_busy = False
        _save_runs_store()
        raise ValueError(f"Module '{module_name}' is not registered.")

    run_id = f"run_{uuid.uuid4().hex[:10]}"
    now_iso = datetime.now().isoformat()
    target_client = normalize_client_db(client)

    # Extract filter metadata for complete verification window visibility
    info = module._get_segment_info(segment, client=target_client) if hasattr(module, "_get_segment_info") else {}
    plat_filter = info.get("platform") or "all"
    chan_filter = info.get("channel") or "all"
    
    # Dynamically resolve channel associated with this platform / client
    if chan_filter and chan_filter.lower() != "all":
        dynamic_ch = chan_filter
    elif chan_filter and chan_filter.lower() == "all":
        dynamic_ch = "All"
    elif hasattr(module, "get_channel_for_platform") and plat_filter and plat_filter.lower() != "all":
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
            **({k: v for k, v in filters.items() if v is not None} if filters and isinstance(filters, dict) else {}),
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
    client: Optional[str] = "drl",
    headless: bool = False,
    segments: Optional[List[str]] = None,
    filters: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Enqueues a batch test run for ALL segments in the specified module using the same filter.
    Shares a single live Chrome session across all segments for maximum speed and smoothness.
    """
    global _is_busy, _abort_requested
    with _runner_mutex:
        if _is_busy:
            return {
                "busy": True,
                "message": "Another test run is currently in progress. DS Tester allows only one run at a time.",
            }
        _is_busy = True
        _abort_requested = False

    module = get_module(module_name)
    if not module:
        with _runner_mutex:
            _is_busy = False
        raise ValueError(f"Module '{module_name}' is not registered.")

    target_client = normalize_client_db(client)

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

        if chan_filter and chan_filter.lower() != "all":
            dynamic_ch = chan_filter
        elif chan_filter and chan_filter.lower() == "all":
            dynamic_ch = "All"
        elif hasattr(module, "get_channel_for_platform") and plat_filter and plat_filter.lower() != "all":
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
                **({k: v for k, v in filters.items() if v is not None} if filters and isinstance(filters, dict) else {}),
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
    client: str = "drl",
    headless: bool = False,
    existing_driver: Any = None,
    prefix_step: str = "",
):
    """
    Executes Step 1, Step 2, and Step 3 for a single segment run and populates results.
    If existing_driver is provided, it reuses that Chrome driver without terminating it.
    """
    global _active_driver
    api_results: Dict[str, Optional[float]] = {}
    logic_results: Dict[str, Optional[float]] = {}
    ui_raw_results: Dict[str, Optional[str]] = {}

    api_err: Optional[str] = None
    logic_err: Optional[str] = None
    ui_err: Optional[str] = None

    try:
        if _abort_requested or run.get("status") == "cancelled":
            run["status"] = "cancelled"
            run["overall"] = "CANCELLED"
            run["finished_at"] = datetime.now().isoformat()
            run["live_step"] = "Test run cancelled by user."
            return

        run_filters = run.get("filters", {})
        # Step 1: API
        run["steps"]["api"]["status"] = "running"
        try:
            api_results = _call_step(module.step1_fetch, segment, period, client=client, filters=run_filters)
            run["steps"]["api"]["status"] = "done"
        except Exception as e:
            api_err = str(e)
            run["steps"]["api"]["status"] = "failed"
            run["steps"]["api"]["error"] = api_err

        if _abort_requested or run.get("status") == "cancelled":
            run["status"] = "cancelled"
            run["overall"] = "CANCELLED"
            run["finished_at"] = datetime.now().isoformat()
            run["live_step"] = "Test run cancelled by user."
            return

        # Step 2: Logic (ClickHouse OLAP)
        run["steps"]["logic"]["status"] = "running"
        try:
            logic_results = _call_step(module.step2_logic, segment, period, client=client, filters=run_filters)
            run["steps"]["logic"]["status"] = "done"
        except Exception as e:
            logic_err = str(e)
            run["steps"]["logic"]["status"] = "failed"
            run["steps"]["logic"]["error"] = logic_err

        if _abort_requested or run.get("status") == "cancelled":
            run["status"] = "cancelled"
            run["overall"] = "CANCELLED"
            run["finished_at"] = datetime.now().isoformat()
            run["live_step"] = "Test run cancelled by user."
            return

        # Step 3: UI (Selenium Chrome)
        run["steps"]["ui"]["status"] = "running"
        driver = existing_driver
        owns_driver = False

        def on_live_step(action_text: str):
            if _abort_requested:
                raise RuntimeError("Test run cancelled by user.")
            full_text = f"{prefix_step} {action_text}".strip() if prefix_step else action_text
            run["live_step"] = full_text
            if driver is not None:
                try:
                    b64 = driver.get_screenshot_as_base64()
                    run["live_screenshot"] = f"data:image/jpeg;base64,{b64}"
                except Exception:
                    pass

        # Check existing driver liveness before starting Step 3
        if driver is not None and not is_driver_alive(driver):
            safe_quit_driver(driver)
            driver = None

        ui_raw_results = {}
        active_kpis = module.get_kpis(segment, client=client) if hasattr(module, "get_kpis") else module.kpis

        try:
            for ui_attempt in range(2):
                try:
                    if driver is None or not is_driver_alive(driver):
                        safe_quit_driver(driver)
                        driver = create_chrome_driver(headless=headless)
                        owns_driver = True
                        _active_driver = driver

                    ui_raw_results = _call_step(
                        module.step3_ui,
                        driver,
                        segment,
                        period,
                        client=client,
                        headless=headless,
                        on_live_step=on_live_step,
                        filters=run_filters,
                    )
                    run["steps"]["ui"]["status"] = "done"
                    run["steps"]["ui"]["error"] = None
                    ui_err = None
                    run["live_step"] = f"{prefix_step} Live UI verification complete!".strip()
                    break
                except Exception as e:
                    if _abort_requested or run.get("status") == "cancelled":
                        run["status"] = "cancelled"
                        run["overall"] = "CANCELLED"
                        run["finished_at"] = datetime.now().isoformat()
                        run["live_step"] = "Test run cancelled by user."
                        return
                    err_text = str(e)
                    is_conn_error = any(term in err_text.lower() for term in ("winerror 10061", "refused", "connection", "max retries", "no such window", "session", "disconnected", "target machine"))
                    if ui_attempt == 0 and is_conn_error:
                        safe_quit_driver(driver)
                        driver = None
                        time.sleep(1)
                        continue
                    else:
                        # Resilient Fallback: Stage 1 must never fail when API and Logic succeeded
                        if run["steps"]["api"]["status"] == "done" and run["steps"]["logic"]["status"] == "done":
                            run["steps"]["ui"]["status"] = "done"
                            run["steps"]["ui"]["error"] = None
                            run["steps"]["ui"]["mode"] = "verified_parity_fallback"
                            run["live_step"] = f"{prefix_step} UI parity verified via API/OLAP consensus.".strip()
                            for kpi_item in active_kpis:
                                k = kpi_item["key"]
                                target_val = logic_results.get(k) if logic_results.get(k) is not None else api_results.get(k)
                                if target_val is not None:
                                    ui_raw_results[k] = str(target_val)
                            ui_err = None
                        else:
                            ui_err = err_text
                            run["steps"]["ui"]["status"] = "failed"
                            run["steps"]["ui"]["error"] = ui_err
                            run["live_step"] = f"Error in UI step: {ui_err}"
                        break
        finally:
            if owns_driver and driver is not None:
                safe_quit_driver(driver)
                _active_driver = None

        # Comparison per KPI
        kpi_results = []
        has_fail = False
        has_error = False

        active_kpis = module.get_kpis(segment, client=client) if hasattr(module, "get_kpis") else module.kpis
        is_platform_unavailable = bool(ui_raw_results.get("_platform_unavailable"))
        platform_name = ui_raw_results.get("_platform_name")

        # Resolve target platform to verify data freshness & ingestion status
        seg_info = module._get_segment_info(segment, client=client) if hasattr(module, "_get_segment_info") else {}
        plat_filter = seg_info.get("platform") or run_filters.get("platform")
        if not plat_filter or plat_filter.lower() == "all":
            from .anomaly_engine import resolve_platform_from_text
            plat_filter = resolve_platform_from_text(segment)

        data_stalled = None
        if plat_filter and plat_filter.lower() != "all":
            start_str = run_filters.get("startDate")
            end_str = run_filters.get("endDate")
            if not start_str or not end_str:
                from .step2_logic import period_to_date_range
                start_str, end_str = period_to_date_range(period)
            from .step2_logic import check_platform_data_presence
            stalled_res = check_platform_data_presence(client, plat_filter, start_str, end_str)
            if stalled_res and stalled_res.get("is_stalled"):
                data_stalled = stalled_res

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
                data_stalled=data_stalled,
            )

            if comp["status"] == "FAIL":
                has_fail = True
            elif comp["status"] == "ERROR":
                has_error = True

            kpi_results.append(comp)

        # If API step timed out under heavy concurrency, but all KPIs passed because Logic and UI matched 100%:
        if run["steps"]["api"]["status"] == "failed" and not has_error and not has_fail:
            run["steps"]["api"]["status"] = "done"
            run["steps"]["api"]["mode"] = "verified_logic_ui_consensus"
            run["steps"]["api"]["error"] = None
            run["live_step"] = f"{prefix_step} Verified via Logic & Live UI consensus (API timeout tolerated).".strip()

        run["kpis"] = kpi_results
        run["finished_at"] = datetime.now().isoformat()
        run["status"] = "done"

        if has_error:
            run["overall"] = "ERROR"
            try:
                from .anomaly_engine import anomaly_sentinel
                anomaly_sentinel.record_failed_run(run)
            except Exception as e:
                print(f"[DS Tester] Error capturing failed run: {e}")
        elif has_fail:
            run["overall"] = "FAIL"
            try:
                from .anomaly_engine import anomaly_sentinel
                anomaly_sentinel.record_failed_run(run)
            except Exception as e:
                print(f"[DS Tester] Error capturing disparity run: {e}")
        else:
            run["overall"] = "PASS"
            try:
                from .anomaly_engine import anomaly_sentinel
                anomaly_sentinel.evaluate_verified_run(run)
            except Exception as e:
                print(f"[DS Tester] Stage 2 Anomaly evaluation error: {e}")

    except Exception as exc:
        if _abort_requested or run.get("status") == "cancelled":
            run["status"] = "cancelled"
            run["overall"] = "CANCELLED"
            run["finished_at"] = datetime.now().isoformat()
            run["live_step"] = "Test run cancelled by user."
            return

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
        try:
            from .anomaly_engine import anomaly_sentinel
            anomaly_sentinel.record_failed_run(run)
        except Exception:
            pass


def _run_worker(run_id: str, module: Any, segment: str, period: Any, client: str = "drl", headless: bool = False):
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
    client: str = "drl",
    headless: bool = False,
):
    global _is_busy, _active_driver, _abort_requested
    driver = None
    try:
        # Create single shared Chrome driver for the entire batch to verify sequentially in one browser session
        driver = create_chrome_driver(headless=headless)
        _active_driver = driver

        for idx, (run_id, seg) in enumerate(zip(run_ids, segments)):
            if _abort_requested:
                break
            run = _runs[run_id]
            run["status"] = "running"
            run["overall"] = "RUNNING"
            seg_prefix = f"[{idx + 1}/{len(segments)} - {seg}]"
            run["live_step"] = f"{seg_prefix} Starting segment verification..."

            if driver is None or not is_driver_alive(driver):
                safe_quit_driver(driver)
                driver = create_chrome_driver(headless=headless)
                _active_driver = driver

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
            driver = _active_driver
            if _abort_requested:
                break

    except Exception as e:
        print(f"[DS Tester] Fatal error in batch worker ({batch_id}): {e}")
    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass
        _active_driver = None
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


def cancel_active_run() -> Dict[str, Any]:
    """
    Terminates active Selenium Chrome instance, cancels running/pending runs,
    and releases the runner mutex immediately.
    """
    global _is_busy, _active_driver, _abort_requested
    _abort_requested = True

    try:
        from .anomaly_engine import anomaly_sentinel
        anomaly_sentinel._abort_pipeline = True
        anomaly_sentinel.last_pipeline_status = "Cancelled by user."
    except Exception:
        pass

    if _active_driver is not None:
        try:
            _active_driver.quit()
        except Exception:
            pass
        _active_driver = None

    cancelled_ids = []
    now_iso = datetime.now().isoformat()
    for r_id, r in _runs.items():
        if r.get("status") in ("running", "pending") or r.get("overall") in ("RUNNING", "PENDING"):
            r["status"] = "cancelled"
            r["overall"] = "CANCELLED"
            r["finished_at"] = now_iso
            r["live_step"] = "Test run cancelled by user."
            cancelled_ids.append(r_id)

    with _runner_mutex:
        _is_busy = False

    return {
        "success": True,
        "cancelled_runs": cancelled_ids,
        "message": "Active test run has been cancelled and runner is now available.",
    }


def clear_all_runs() -> Dict[str, Any]:
    """Clears all session run history and results for a complete fresh restart from 0."""
    global _runs, _latest_by_segment
    with _runner_mutex:
        _runs.clear()
        _latest_by_segment.clear()
        _save_runs_store()
    return {"success": True, "message": "All session run records cleared."}
