with open('ds_tester/backend/runner.py', 'r', encoding='utf-8') as f:
    code = f.read()

target = """            _execute_single_run(
                run,
                module,
                seg,
                period,
                client=client,
                headless=headless,
                existing_driver=driver,
                prefix_step=f"[{idx + 1}/{len(segments)}]",
            )"""

replacement = """            if driver is None or not is_driver_alive(driver):
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
            driver = _active_driver"""

if target in code:
    code = code.replace(target, replacement, 1)
    with open('ds_tester/backend/runner.py', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Updated _run_batch_worker in runner.py successfully!")
else:
    print("Target not found in runner.py")
