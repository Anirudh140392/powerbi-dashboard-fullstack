with open(r'ds_tester/backend/runner.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('ui_val, _ = normalize_ui_text(raw_ui)', 'ui_val, _ = normalize_ui_text(raw_ui, target_unit=kpi_def.get("unit"))')

with open(r'ds_tester/backend/runner.py', 'w', encoding='utf-8') as f:
    f.write(text)

print('runner.py updated successfully!')

