with open('ds_tester/backend/anomaly_engine.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update _load_store
code = code.replace(
    'a.get("assignment_status") == "ASSIGNED"',
    'a.get("assignment_status") in ("ASSIGNED", "FIXED")'
)

# 2. Update evaluate_verified_run
code = code.replace(
    'a.get("assignment_status") != "ASSIGNED"',
    'a.get("assignment_status") not in ("ASSIGNED", "FIXED")'
)

with open('ds_tester/backend/anomaly_engine.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated anomaly_engine.py for FIXED status support successfully!")
