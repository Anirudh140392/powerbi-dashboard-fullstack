with open("ds_tester/backend/modules/primary_summary.py", "r", encoding="utf-8") as f:
    text = f.read()

old_code = """    driver.get(target_url)
    wait_for_loading_complete(driver, timeout=20)
    time.sleep(0.25)

    if on_live_step:
        on_live_step("Applying verification period to dashboard...")
    apply_dashboard_period(driver, period)"""

new_code = """    start_date, end_date = _resolve_dates(period, db_name)
    driver.get(target_url)
    wait_for_loading_complete(driver, timeout=20)
    time.sleep(0.25)

    if on_live_step:
        on_live_step(f"Applying verified period ({start_date} to {end_date}) to dashboard...")
    apply_dashboard_period(driver, {"startDate": start_date, "endDate": end_date})"""

text_crlf = "\r\n" in text
text_norm = text.replace("\r\n", "\n")
old_norm = old_code.replace("\r\n", "\n")
assert old_norm in text_norm, "old_code not found in primary_summary.py"
text_norm = text_norm.replace(old_norm, new_code.replace("\r\n", "\n"))

final_text = text_norm.replace("\n", "\r\n") if text_crlf else text_norm
with open("ds_tester/backend/modules/primary_summary.py", "w", encoding="utf-8") as f:
    f.write(final_text)

print("Updated apply_dashboard_period in primary_summary.py")
