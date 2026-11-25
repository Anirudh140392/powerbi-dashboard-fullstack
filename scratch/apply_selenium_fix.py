import re

# 1. Update step3_selenium.py
with open('ds_tester/backend/step3_selenium.py', 'r', encoding='utf-8') as f:
    code = f.read()

if 'def is_driver_alive' not in code:
    old_target = """    if not headless:
        bring_chrome_to_top(driver)

    return driver"""

    new_replacement = """    if not headless:
        bring_chrome_to_top(driver)

    return driver


def is_driver_alive(driver) -> bool:
    \"\"\"Checks whether the Chrome driver session is alive, responsive, and connected.\"\"\"
    if driver is None:
        return False
    try:
        _ = driver.window_handles
        return True
    except Exception:
        return False


def safe_quit_driver(driver):
    \"\"\"Safely closes and quits a Chrome driver session without raising errors.\"\"\"
    if driver is not None:
        try:
            driver.quit()
        except Exception:
            pass"""

    if old_target in code:
        code = code.replace(old_target, new_replacement, 1)
        with open('ds_tester/backend/step3_selenium.py', 'w', encoding='utf-8') as f:
            f.write(code)
        print("Updated step3_selenium.py successfully!")
    else:
        print("Target not found in step3_selenium.py")
else:
    print("step3_selenium.py already has is_driver_alive")
