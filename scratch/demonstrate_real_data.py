import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

print("=== REAL DYNAMIC CLICKHOUSE DATA (ZERO DUMMY DATA) ===")
for cl in ['boat', 'mars', 'pidilite']:
    q = f"""
    SELECT
        platform_name,
        ROUND(sumIf(overall, flag = 1) * 100.0 / nullIf(sum(overall), 0), 2) AS overall_sos,
        ROUND(sumIf(spons, flag = 1) * 100.0 / nullIf(sum(spons), 0), 2) AS sponsored_sos,
        ROUND(sumIf(organic, flag = 1) * 100.0 / nullIf(sum(organic), 0), 2) AS organic_sos
    FROM {cl}.rb_kw_olap
    WHERE DATE = '2026-11-01'
    GROUP BY platform_name
    ORDER BY platform_name
    """
    rows = execute_select_query(q)
    print(f"\n[{cl.upper()}] 2026-11-01 SOS by Platform:")
    for r in rows:
        print(f"  Platform: {r[0]:<12} | Overall SOS: {r[1]}% | Sponsored SOS: {r[2]}% | Organic SOS: {r[3]}%")

