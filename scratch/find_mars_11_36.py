import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step1_api import call_platform_api

ranges = [
    ("2026-10-21", "2026-11-04"),
    ("2026-10-20", "2026-11-03"),
    ("2026-10-01", "2026-10-31"),
    ("2026-03-01", "2026-03-31"),
    ("2026-10-18", "2026-11-01"),
    ("2026-10-19", "2026-11-02"),
    ("2026-10-21", "2026-11-02"),
]

for s, e in ranges:
    try:
        res = call_platform_api("/api/pricing-analysis/kpis", params={"startDate": s, "endDate": e, "channel": "quickcomm"}, db_name="mars")
        d_val = res.get("discount", {}).get("value")
        print(f"Mars ({s} to {e}) channel=quickcomm -> Discount: {d_val}")

        res_no_ch = call_platform_api("/api/pricing-analysis/kpis", params={"startDate": s, "endDate": e}, db_name="mars")
        d_no_ch = res_no_ch.get("discount", {}).get("value")
        print(f"Mars ({s} to {e}) no channel -> Discount: {d_no_ch}")
    except Exception as err:
        print(f"Error {s}..{e}:", err)
