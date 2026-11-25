with open('ds_tester/backend/runner.py', 'r', encoding='utf-8') as f:
    content = f.read()

fn = """

def clear_all_runs() -> Dict[str, Any]:
    \"\"\"Clears all session run history and results for a complete fresh restart from 0.\"\"\"
    global _runs, _latest_by_segment
    with _runner_mutex:
        _runs.clear()
        _latest_by_segment.clear()
    return {"success": True, "message": "All session run records cleared."}
"""

if 'def clear_all_runs' not in content:
    with open('ds_tester/backend/runner.py', 'w', encoding='utf-8') as f:
        f.write(content + fn)
    print("Appended clear_all_runs successfully.")
else:
    print("clear_all_runs already present.")
