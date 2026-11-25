path = 'ds_tester/backend/anomaly_engine.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update line 560 to pass start_date
old_call = """            baseline_val = self.get_kpi_30d_baseline(
                client=client,
                kpi_key=kpi_key,
                kpi_label=kpi_label,
                unit=unit,
                platform=detected_plat
            )"""

new_call = """            baseline_val = self.get_kpi_30d_baseline(
                client=client,
                kpi_key=kpi_key,
                kpi_label=kpi_label,
                unit=unit,
                platform=detected_plat,
                start_date=period.get("startDate") if isinstance(period, dict) else None,
            )"""

if old_call in content:
    content = content.replace(old_call, new_call, 1)
    print("Replaced baseline call!")
else:
    print("old_call not found!")

# 2. Replace today() - 30 in get_kpi_30d_baseline
start_marker = 'def get_kpi_30d_baseline('
end_marker = 'def evaluate_verified_run('
if start_marker in content and end_marker in content:
    idx1 = content.index(start_marker)
    idx2 = content.index(end_marker)

    sub = content[idx1:idx2]
    # In lines 340-344, date_clause definition had: date_clause = "DATE BETWEEN today() - 30 AND today() - 1"
    # Keep the default definition!
    # Only replace in SQL queries where WHERE DATE BETWEEN today() - 30 AND today() - 1 is used
    sub = sub.replace("WHERE DATE BETWEEN today() - 30 AND today() - 1", "WHERE {date_clause}")
    sub = sub.replace("WHERE toDate(DATE) BETWEEN today() - 30 AND today() - 1", "WHERE {date_clause_bm}")

    content = content[:idx1] + sub + content[idx2:]
    print("Replaced SQL queries with dynamic date_clause!")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Saved anomaly_engine.py!")
