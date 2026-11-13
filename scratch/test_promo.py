import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query, resolve_table_column

for client, (start, end) in [("boat", ("2026-10-01", "2026-10-31")), ("mars", ("2026-10-04", "2026-10-31"))]:
    mrp_col = resolve_table_column(client, "rb_pdp_olap", "MRP")
    sp_col = resolve_table_column(client, "rb_pdp_olap", "Selling_Price")
    q = f"""
    SELECT 
        (SUM(ifNull(toFloat64OrZero(toString({mrp_col})), 0)) - SUM(ifNull(toFloat64OrZero(toString({sp_col})), 0))) / NULLIF(SUM(ifNull(toFloat64OrZero(toString({mrp_col})), 0)), 0) * 100 as avg_promo
    FROM {client}.rb_pdp_olap
    WHERE toDate(DATE) BETWEEN '{start}' AND '{end}'
      AND toString(Comp_flag) = '0'
      AND neno_osa > 0
    """
    print(f"[{client}] Promo calculation:", execute_select_query(q, database=client))

