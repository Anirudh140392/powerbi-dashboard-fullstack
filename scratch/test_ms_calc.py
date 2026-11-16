import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

for c, (s, e) in [("boat", ("2026-10-01", "2026-10-31")), ("mars", ("2026-10-04", "2026-10-31"))]:
    try:
        tables = [t[0] for t in execute_select_query(f"SELECT name FROM system.tables WHERE database = '{c}'", database=c)]
        if "rb_ms_olap" in tables:
            cols = [r[0] for r in execute_select_query(f"SELECT name FROM system.columns WHERE table = 'rb_ms_olap' AND database = '{c}'", database=c)]
            q = f"""
            SELECT 
                (sumIf(toFloat64OrZero(toString(estimated_sales)), toString(comp_flag) = '0') / nullIf(sum(toFloat64OrZero(toString(estimated_sales))), 0)) * 100 as ms
            FROM {c}.rb_ms_olap
            WHERE toDate(date) BETWEEN '{s}' AND '{e}'
            """
            print(f"[{c}] MS result:", execute_select_query(q, database=c))
        else:
            print(f"[{c}] No rb_ms_olap")
    except Exception as err:
        print(f"[{c}] MS err:", err)

