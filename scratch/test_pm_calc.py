import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

for client, (start, end) in [("boat", ("2026-10-01", "2026-10-31")), ("mars", ("2026-10-04", "2026-10-31"))]:
    q = f"""
    SELECT 
        sum(ifNull(toFloat64OrZero(toString(impressions)), 0)) / 1000000.0 as impressions_m,
        sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) / 100000.0 as spends_lac,
        sum(ifNull(toFloat64OrZero(toString(ad_sales)), 0)) / 100000.0 as sales_lac,
        sum(ifNull(toFloat64OrZero(toString(ad_sales)), 0)) / nullIf(sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)), 0) as roas,
        (sum(ifNull(toFloat64OrZero(toString(ad_click)), 0)) / nullIf(sum(ifNull(toFloat64OrZero(toString(impressions)), 0)), 0)) * 100 as ctr
    FROM {client}.rb_pm_olap
    WHERE toDate(DATE) BETWEEN '{start}' AND '{end}'
    """
    print(f"[{client}] PM calculation:", execute_select_query(q, database=client))

