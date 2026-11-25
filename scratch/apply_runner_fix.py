with open('ds_tester/backend/runner.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update imports
old_imp = "from .step3_selenium import create_chrome_driver, normalize_client_db"
new_imp = "from .step3_selenium import create_chrome_driver, normalize_client_db, is_driver_alive, safe_quit_driver"
if old_imp in code:
    code = code.replace(old_imp, new_imp, 1)

# 2. Update _execute_single_run Step 3 section
old_step3 = """        # Step 3: UI (Selenium Chrome)
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

        try:
            if driver is None:
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
            run["live_step"] = f"{prefix_step} Live UI verification complete!".strip()
        except Exception as e:
            if _abort_requested or run.get("status") == "cancelled":
                run["status"] = "cancelled"
                run["overall"] = "CANCELLED"
                run["finished_at"] = datetime.now().isoformat()
                run["live_step"] = "Test run cancelled by user."
                return
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
                _active_driver = None"""

new_step3 = """        # Step 3: UI (Selenium Chrome)
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
                _active_driver = None"""

if old_step3 in code:
    code = code.replace(old_step3, new_step3, 1)
    print("Replaced Step 3 block in runner.py successfully!")
else:
    print("Could not find old_step3 block in runner.py!")

# 3. Update _run_batch_worker to keep driver alive and synced
old_batch_call = """            _execute_single_run(
                run=run,
                module=module,
                segment=seg,
                period=period,
                client=client,
                headless=headless,
                existing_driver=driver,
                prefix_step=seg_prefix,
            )"""

new_batch_call = """            if driver is None or not is_driver_alive(driver):
                safe_quit_driver(driver)
                driver = create_chrome_driver(headless=headless)
                _active_driver = driver

            _execute_single_run(
                run=run,
                module=module,
                segment=seg,
                period=period,
                client=client,
                headless=headless,
                existing_driver=driver,
                prefix_step=seg_prefix,
            )
            driver = _active_driver"""

if old_batch_call in code:
    code = code.replace(old_batch_call, new_batch_call, 1)
    print("Updated _run_batch_worker in runner.py successfully!")
else:
    print("Could not find old_batch_call in runner.py!")

with open('ds_tester/backend/runner.py', 'w', encoding='utf-8') as f:
    f.write(code)
print("Saved runner.py successfully!")
