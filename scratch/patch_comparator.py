import re

with open(r'ds_tester/backend/comparator.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_func = False
skip = False

new_func = """def normalize_ui_text(raw_text: Optional[str], target_unit: Optional[str] = None) -> Tuple[Optional[float], int]:
    \"\"\"
    Normalizes UI text representation into a numeric float and detected decimal precision.
    Handles:
      - Currency symbols: \u20b9, $, etc.
      - Thousands separators (including Indian numbering: 1,00,000 and standard: 100,000)
      - Percentages: %
      - Suffixes: K (thousand), L / Lakh (lakh), M (million), Cr / Crore (crore)
      - Placeholders: '-', 'N/A', '', None -> None
    Returns:
      (normalized_number, displayed_decimals)
    \"\"\"
    if raw_text is None:
        return None, 0

    text = str(raw_text).strip()
    if not text or text in ("-", "N/A", "null", "None", "Loading...", "NaN"):
        return None, 0

    # Remove currency symbols and spaces
    clean = text.replace("\u20b9", "").replace("$", "").replace("\u20ac", "").replace("\u00a3", "").strip()
    # Remove percentage signs and day/days suffixes
    clean = clean.replace("%", "").strip()
    clean = re.sub(r"(?i)\s*(days|day)$", "", clean).strip()

    # Detect multiplier suffix
    multiplier = 1.0
    upper = clean.upper()
    unit_norm = (target_unit or "").lower().strip()

    if upper.endswith("CRORE") or upper.endswith("CR"):
        clean = re.sub(r"(?i)\s*(crore|cr)$", "", clean).strip()
        if unit_norm in ("cr", "crore"):
            multiplier = 1.0
        elif unit_norm in ("lac", "lakh"):
            multiplier = 100.0
        else:
            multiplier = 10_000_000.0
    elif upper.endswith("LAKH") or upper.endswith("LAC") or upper.endswith("L"):
        clean = re.sub(r"(?i)\s*(lakh|lac|l)$", "", clean).strip()
        if unit_norm in ("cr", "crore"):
            multiplier = 0.01
        elif unit_norm in ("lac", "lakh"):
            multiplier = 1.0
        else:
            multiplier = 100_000.0
    elif upper.endswith("M"):
        clean = re.sub(r"(?i)\s*m$", "", clean).strip()
        if unit_norm in ("cr", "crore"):
            multiplier = 0.1
        elif unit_norm in ("lac", "lakh"):
            multiplier = 10.0
        else:
            multiplier = 1_000_000.0
    elif upper.endswith("K"):
        clean = re.sub(r"(?i)\s*k$", "", clean).strip()
        if unit_norm in ("cr", "crore"):
            multiplier = 0.0001
        elif unit_norm in ("lac", "lakh"):
            multiplier = 0.01
        else:
            multiplier = 1_000.0

    # Remove commas (both standard 1,000,000 and Indian 1,00,000 grouping)
    clean = clean.replace(",", "").strip()

    # Count displayed decimal places before scaling
    displayed_decimals = 0
    if "." in clean:
        parts = clean.split(".")
        if len(parts) == 2 and parts[1].isdigit():
            displayed_decimals = len(parts[1])

    try:
        val = float(clean) * multiplier
        if math.isnan(val) or math.isinf(val):
            return None, 0
        return val, displayed_decimals
    except (ValueError, TypeError):
        return None, 0
"""

i = 0
while i < len(lines):
    line = lines[i]
    if line.startswith("def normalize_ui_text("):
        new_lines.append(new_func + "\n")
        # skip old function until def compare_kpi
        while i < len(lines) and not lines[i].startswith("def compare_kpi("):
            i += 1
        continue
    
    if "# 3. Determine UI rounding tolerance" in line:
        hook = """    # 2.5 Scale alignment: if KPI unit is Cr / Lakh, align UI value to match API/Logic unit
    unit_str = str(kpi_def.get("unit") or "").lower().strip()
    if ui_val is not None:
        ref_val = api_val if api_val is not None else logic_val
        if ref_val is not None:
            if unit_str in ("cr", "crore"):
                if abs(ref_val) < 10000 and abs(ui_val) >= 100000:
                    ui_val = ui_val / 10_000_000.0
            elif unit_str in ("lac", "lakh"):
                if abs(ref_val) < 10000 and abs(ui_val) >= 100000:
                    ui_val = ui_val / 100_000.0

"""
        new_lines.append(hook)
        new_lines.append(line)
        i += 1
        continue

    new_lines.append(line)
    i += 1

with open(r'ds_tester/backend/comparator.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("comparator.py updated successfully!")

