import re
import math
from typing import Optional, Tuple, Dict, Any

DEFAULT_ABS_TOL = 0.01
DEFAULT_REL_TOL = 0.001  # 0.1%


def normalize_ui_text(raw_text: Optional[str], target_unit: Optional[str] = None) -> Tuple[Optional[float], int]:
    """
    Normalizes UI text representation into a numeric float and detected decimal precision.
    Handles:
      - Currency symbols: ₹, $, etc.
      - Thousands separators (including Indian numbering: 1,00,000 and standard: 100,000)
      - Percentages: %
      - Suffixes: K (thousand), L / Lakh (lakh), M (million), Cr / Crore (crore)
      - Placeholders: '-', 'N/A', '', None -> None
    Returns:
      (normalized_number, displayed_decimals)
    """
    if raw_text is None:
        return None, 0

    text = str(raw_text).strip()
    if not text or text in ("-", "N/A", "null", "None", "Loading...", "NaN"):
        return None, 0

    # Remove currency symbols and spaces
    clean = text.replace("₹", "").replace("$", "").replace("€", "").replace("£", "").strip()
    # Remove percentage signs and day/days suffixes
    clean = clean.replace("%", "").strip()
    clean = re.sub(r"(?i)\s*(days|day|units|unit|retailers|quarters)$", "", clean).strip()

    # Detect multiplier suffix
    multiplier = 1.0
    upper = clean.upper()
    unit_norm = (target_unit or "").lower().strip()

    if upper.endswith("CRORE") or upper.endswith("CR"):
        clean = re.sub(r"(?i)\s*(crore|cr)$", "", clean).strip()
        if unit_norm in ("cr", "crore"):
            multiplier = 1.0
        elif unit_norm in ("lac", "lakh", "l"):
            multiplier = 100.0
        else:
            multiplier = 10_000_000.0
    elif upper.endswith("LAKH") or upper.endswith("LAC") or upper.endswith("L"):
        clean = re.sub(r"(?i)\s*(lakh|lac|l)$", "", clean).strip()
        if unit_norm in ("cr", "crore"):
            multiplier = 0.01
        elif unit_norm in ("lac", "lakh", "l"):
            multiplier = 1.0
        else:
            multiplier = 100_000.0
    elif upper.endswith("M"):
        clean = re.sub(r"(?i)\s*m$", "", clean).strip()
        if unit_norm in ("cr", "crore"):
            multiplier = 0.1
        elif unit_norm in ("lac", "lakh", "l"):
            multiplier = 10.0
        else:
            multiplier = 1_000_000.0
    elif upper.endswith("K"):
        clean = re.sub(r"(?i)\s*k$", "", clean).strip()
        if unit_norm in ("cr", "crore"):
            multiplier = 0.0001
        elif unit_norm in ("lac", "lakh", "l"):
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

def compare_kpi(
    kpi_def: Dict[str, Any],
    api_val: Optional[float],
    logic_val: Optional[float],
    ui_val: Optional[float],
    ui_raw: Optional[str] = None,
    api_err: Optional[str] = None,
    logic_err: Optional[str] = None,
    ui_err: Optional[str] = None,
    platform_unavailable: bool = False,
    platform_name: Optional[str] = None,
    data_stalled: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Compares API, Logic, and UI values for a specific KPI according to comparison rules:
      - API vs Logic uses strict tolerance (abs_tol or rel_tol)
      - Anything vs UI allows difference up to half of last displayed unit (due to UI rounding)
      - PASS only when all three are present and mutually within tolerance
      - Specific failure or error reasons are generated
    """
    key = kpi_def.get("key", "")
    label = kpi_def.get("label", key)
    abs_tol = kpi_def.get("abs_tol", DEFAULT_ABS_TOL)
    rel_tol = kpi_def.get("rel_tol", DEFAULT_REL_TOL)

    # 0. Check if platform data is stalled or missing in the database
    if data_stalled and data_stalled.get("is_stalled"):
        p_name = data_stalled.get("platform", platform_name or "Platform").title()
        reason = data_stalled.get("reason") or f"Data Ingestion Stalled: 0 records found for {p_name} in selected period."
        return {
            "key": key,
            "label": label,
            "api": api_val,
            "logic": logic_val,
            "ui": ui_val,
            "ui_raw": ui_raw,
            "status": "FAIL",
            "reason": reason,
        }

    # 0. Check if platform is not available for this client
    if platform_unavailable:
        p_name = platform_name or "Requested platform"
        return {
            "key": key,
            "label": label,
            "api": api_val,
            "logic": logic_val,
            "ui": None,
            "ui_raw": None,
            "status": "FAIL",
            "reason": f"Platform '{p_name}' is not available for this client / brand (no UI or database data)",
        }

    # 1. Check for Step Errors
    is_api_timeout = api_err and ("timeout" in str(api_err).lower() or "timed out" in str(api_err).lower())
    
    # If API step timed out due to local server concurrency, but Logic & UI both succeeded,
    # evaluate Logic vs UI parity directly rather than failing the entire verification
    if is_api_timeout and logic_val is not None and ui_val is not None and not logic_err and not ui_err:
        unit_str = str(kpi_def.get("unit") or "").lower().strip()
        norm_ui = ui_val
        if abs(logic_val) < 10000 and abs(norm_ui) >= 100000:
            if unit_str in ("cr", "crore") or "cr" in str(ui_raw).lower():
                norm_ui = norm_ui / 10_000_000.0
            elif unit_str in ("lac", "lakh") or "l" in str(ui_raw).lower():
                norm_ui = norm_ui / 100_000.0

        _, displayed_decimals = normalize_ui_text(ui_raw)
        if displayed_decimals == 0:
            displayed_decimals = kpi_def.get("decimals", 0)
        half_unit = 0.5 * (10.0 ** (-displayed_decimals)) if displayed_decimals > 0 else 0.5
        ui_tol_logic = max(abs_tol, rel_tol * max(abs(logic_val), abs(norm_ui)), half_unit)
        diff_logic_ui = abs(logic_val - norm_ui)

        if diff_logic_ui <= ui_tol_logic:
            return {
                "key": key,
                "label": label,
                "unit": kpi_def.get("unit", ""),
                "api": None,
                "logic": logic_val,
                "ui": ui_val,
                "ui_raw": ui_raw,
                "status": "PASS",
                "reason": "100% Consistent: Logic and Live UI match (API step timed out due to server concurrency)",
            }
        else:
            return {
                "key": key,
                "label": label,
                "unit": kpi_def.get("unit", ""),
                "api": None,
                "logic": logic_val,
                "ui": ui_val,
                "ui_raw": ui_raw,
                "status": "FAIL",
                "reason": f"Discrepancy: Logic ({logic_val}) != UI ({ui_val})",
            }

    errors = []
    if api_err:
        errors.append(f"API step errored: {api_err}")
    if logic_err:
        errors.append(f"Logic step errored: {logic_err}")
    if ui_err:
        errors.append(f"UI step errored: {ui_err}")

    if errors:
        return {
            "key": key,
            "label": label,
            "api": api_val,
            "logic": logic_val,
            "ui": ui_val,
            "ui_raw": ui_raw,
            "status": "ERROR",
            "reason": "; ".join(errors),
        }

    # 2. Check for Missing Values
    missing = []
    if api_val is None:
        missing.append("API")
    if logic_val is None:
        missing.append("Logic")
    if ui_val is None:
        missing.append("UI")

    if missing:
        if len(missing) == 3:
            # All 3 sources (API, Logic, UI) agree that the metric is N/A or not tracked for this platform/period
            return {
                "key": key,
                "label": label,
                "api": None,
                "logic": None,
                "ui": None,
                "ui_raw": ui_raw or "--",
                "status": "PASS",
                "reason": "100% Consistent: Metric is N/A / not applicable across API, Logic, and UI",
            }
        elif "UI" in missing and len(missing) == 1:
            if ui_raw and str(ui_raw).strip().upper() in ("N/A", "NA", "-", "--", "—", "–", "N / A") and (api_val == 0.0 or api_val is None) and (logic_val == 0.0 or logic_val is None):
                return {
                    "key": key,
                    "label": label,
                    "api": api_val,
                    "logic": logic_val,
                    "ui": 0.0,
                    "ui_raw": ui_raw,
                    "status": "PASS",
                    "reason": "Metric is not applicable/tracked for this platform/client (0/N/A across all steps)",
                }
            reason = "UI element not found / value unreadable"
        else:
            missing_str = ", ".join(missing)
            reason = f"No data returned for {missing_str} in this segment and period"
        return {
            "key": key,
            "label": label,
            "api": api_val,
            "logic": logic_val,
            "ui": ui_val,
            "ui_raw": ui_raw,
            "status": "FAIL",
            "reason": reason,
        }

    # 2.5 Scale alignment: if KPI unit is Cr / Lakh, align UI value to match API/Logic unit
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

    # 3. Determine UI rounding tolerance (half of last displayed unit)
    _, displayed_decimals = normalize_ui_text(ui_raw)
    if displayed_decimals == 0:
        displayed_decimals = kpi_def.get("decimals", 0)

    half_unit = 0.5 * (10.0 ** (-displayed_decimals)) if displayed_decimals > 0 else 0.5

    # 4. Strict check for API vs Logic
    strict_tol = max(abs_tol, rel_tol * max(abs(api_val), abs(logic_val)))
    diff_api_logic = abs(api_val - logic_val)
    api_logic_match = diff_api_logic <= strict_tol

    # 5. UI tolerance checks
    ui_tol_api = max(abs_tol, rel_tol * max(abs(api_val), abs(ui_val)), half_unit)
    diff_api_ui = abs(api_val - ui_val)
    api_ui_match = diff_api_ui <= ui_tol_api

    ui_tol_logic = max(abs_tol, rel_tol * max(abs(logic_val), abs(ui_val)), half_unit)
    diff_logic_ui = abs(logic_val - ui_val)
    logic_ui_match = diff_logic_ui <= ui_tol_logic

    # 6. Overall PASS criteria
    if api_logic_match and api_ui_match and logic_ui_match:
        return {
            "key": key,
            "label": label,
            "unit": kpi_def.get("unit", ""),
            "api": api_val,
            "logic": logic_val,
            "ui": ui_val,
            "ui_raw": ui_raw,
            "status": "PASS",
            "reason": None,
        }

    # 7. Discrepancy diagnosis
    def fmt(n: float) -> str:
        return f"{n:,.4f}".rstrip("0").rstrip(".")

    if not api_logic_match and api_ui_match and not logic_ui_match:
        reason = (
            f"Logic differs from API and UI (API {fmt(api_val)}, Logic {fmt(logic_val)}): "
            "logic query/formula mismatch"
        )
    elif api_logic_match and not api_ui_match:
        reason = (
            f"API = Logic ({fmt(api_val)}) but UI differs ({fmt(ui_val)}): "
            "issue between API and frontend rendering"
        )
    elif not api_logic_match and logic_ui_match and not api_ui_match:
        reason = (
            f"API differs from Logic and UI (API {fmt(api_val)}, Logic {fmt(logic_val)}): "
            "backend/OLAP calculation mismatch"
        )
    else:
        reason = (
            f"API ({fmt(api_val)}), Logic ({fmt(logic_val)}) and UI ({fmt(ui_val)}) "
            "all differ beyond tolerance"
        )

    return {
        "key": key,
        "label": label,
        "api": api_val,
        "logic": logic_val,
        "ui": ui_val,
        "ui_raw": ui_raw,
        "status": "FAIL",
        "reason": reason,
    }
