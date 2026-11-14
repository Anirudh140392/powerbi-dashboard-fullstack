import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query, resolve_table_column

disc_col = resolve_table_column("boat", "rb_pdp_olap", "Discount")
sales_col = resolve_table_column("boat", "rb_pdp_olap", "Sales")
print(f"Boat resolved: disc={disc_col}, sales={sales_col}")

q = f"""
SELECT 
    sum(ifNull(toFloat64OrZero(toString({sales_col})), 0)) / 10000000.0 as offtake_cr,
    sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullIf(sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0) * 100 as osa,
    avg(ifNull(toFloat64OrZero(toString({disc_col})), 0)) as discount
FROM boat.rb_pdp_olap
WHERE toDate(DATE) BETWEEN '2026-10-01' AND '2026-10-31'
  AND toString(Comp_flag) = '0'
"""
print("Boat result:", execute_select_query(q, database="boat"))

q_kw = """
SELECT 
    (countIf(toString(Comp_flag) = '0') / nullIf(count(), 0)) * 100 as sos
FROM boat.rb_kw_olap
WHERE toDate(date) BETWEEN '2026-10-01' AND '2026-10-31'
"""
try:
    print("Boat KW result:", execute_select_query(q_kw, database="boat"))
except Exception as e:
    print("Boat KW err:", e)
