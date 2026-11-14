import sys
sys.path.append('.')
from ds_tester.backend.step2_logic import execute_select_query

for db in ['boat', 'mars', 'pidilite']:
    print(f"\n=================== CLIENT: {db} ===================")
    # Check distinct platforms and sales per platform
    query = f"""
    SELECT 
        Platform,
        count() as total_rows,
        countIf(Comp_flag = '0') as our_rows,
        sum(CASE WHEN Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(Sales)), 0) ELSE 0 END) as our_sales_sum,
        sum(CASE WHEN Comp_flag = '0' AND ifNull(toFloat64OrZero(toString(Sales)), 0) > 0 THEN 1 ELSE 0 END) as our_sales_positive_count,
        SUM(CASE WHEN Comp_flag = '0' THEN ((ifNull(toFloat64OrZero(toString(MRP)), 0) - ifNull(toFloat64OrZero(toString(Selling_Price)), 0)) / NULLIF(ifNull(toFloat64OrZero(toString(MRP)), 0), 0)) * ifNull(toFloat64OrZero(toString(Sales)), 0) ELSE 0 END) / NULLIF(SUM(CASE WHEN Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(Sales)), 0) ELSE 0 END), 0) * 100 AS weighted_discount
    FROM rb_pdp_olap
    GROUP BY Platform
    ORDER BY total_rows DESC
    """
    try:
        rows = execute_select_query(query, database=db)
        for r in rows:
            print(f"Platform: {r[0]} | Total rows: {r[1]} | Our rows: {r[2]} | Sales Sum: {r[3]} | Sales > 0 count: {r[4]} | Weighted Discount: {r[5]}")
    except Exception as e:
        print(f"Error on {db}: {e}")

