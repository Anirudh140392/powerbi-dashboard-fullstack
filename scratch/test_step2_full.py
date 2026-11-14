import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query, resolve_table_column

def test_client(client, start, end):
    print(f"=== Testing Step 2 SQL for {client} ({start} to {end}) ===")
    
    # 1. Overview
    try:
        disc_col = resolve_table_column(client, "rb_pdp_olap", "Discount")
        sales_col = resolve_table_column(client, "rb_pdp_olap", "Sales")
        q1 = f"""
        SELECT 
            sum(ifNull(toFloat64OrZero(toString({sales_col})), 0)) / 10000000.0 as offtake_cr,
            sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullIf(sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0) * 100 as osa,
            avg(ifNull(toFloat64OrZero(toString({disc_col})), 0)) as discount
        FROM {client}.rb_pdp_olap
        WHERE toDate(DATE) BETWEEN '{start}' AND '{end}'
          AND toString(Comp_flag) = '0'
        """
        res1 = execute_select_query(q1, database=client)
        print("  1. Overview (PDP):", res1[0])
    except Exception as e:
        print("  1. Overview PDP err:", e)

    # 1b. SOS
    try:
        q_sos = f"""
        SELECT 
            (sumIf(toInt32(overall), POSITION <= 10 AND toString(flag) = '1') / nullIf(sumIf(toInt32(overall), POSITION <= 10), 0)) * 100 as sos
        FROM {client}.rb_kw_olap
        WHERE toDate(date) BETWEEN '{start}' AND '{end}'
        """
        res_sos = execute_select_query(q_sos, database=client)
        print("  1b. Overview (SOS):", res_sos[0])
    except Exception as e:
        print("  1b. Overview SOS err:", e)

    # 2. Platform Overview
    try:
        q_plat = f"""
        SELECT 
            count(DISTINCT lower(Platform)) as num_platforms,
            sum(ifNull(toFloat64OrZero(toString({sales_col})), 0)) / 10000000.0 as offtake_cr,
            sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullIf(sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0) * 100 as osa
        FROM {client}.rb_pdp_olap
        WHERE toDate(DATE) BETWEEN '{start}' AND '{end}'
          AND toString(Comp_flag) = '0'
        """
        res_plat = execute_select_query(q_plat, database=client)
        print("  2. Platform overview:", res_plat[0])
    except Exception as e:
        print("  2. Platform overview err:", e)

    # 3. Category performance
    try:
        cat_col = resolve_table_column(client, "rb_pdp_olap", "Category")
        q_cat = f"""
        SELECT 
            count(DISTINCT lower({cat_col})) as num_cats,
            sum(ifNull(toFloat64OrZero(toString({sales_col})), 0)) / 10000000.0 as offtake_cr
        FROM {client}.rb_pdp_olap
        WHERE toDate(DATE) BETWEEN '{start}' AND '{end}'
          AND toString(Comp_flag) = '0'
          AND {cat_col} IS NOT NULL AND {cat_col} != ''
        """
        res_cat = execute_select_query(q_cat, database=client)
        print("  3. Category performance:", res_cat[0])
    except Exception as e:
        print("  3. Category err:", e)

    # 4. Performance Breakdown
    try:
        tables = [t[0] for t in execute_select_query(f"SELECT name FROM system.tables WHERE database = '{client}'", database=client)]
        pm_table = next((t for t in tables if "pm_olap" in t or "rb_pm" in t), None)
        if pm_table:
            date_col = resolve_table_column(client, pm_table, "date")
            spends_col = resolve_table_column(client, pm_table, "spend")
            sales_col_pm = resolve_table_column(client, pm_table, "adSales")
            impr_col = resolve_table_column(client, pm_table, "impressions")
            clicks_col = resolve_table_column(client, pm_table, "clicks")
            q_pm = f"""
            SELECT 
                sum(ifNull(toFloat64OrZero(toString({impr_col})), 0)) / 1000000.0 as impressions_m,
                sum(ifNull(toFloat64OrZero(toString({spends_col})), 0)) / 100000.0 as spends_lac,
                sum(ifNull(toFloat64OrZero(toString({sales_col_pm})), 0)) / 100000.0 as sales_lac,
                sum(ifNull(toFloat64OrZero(toString({sales_col_pm})), 0)) / nullIf(sum(ifNull(toFloat64OrZero(toString({spends_col})), 0)), 0) as roas,
                sum(ifNull(toFloat64OrZero(toString({clicks_col})), 0)) / nullIf(sum(ifNull(toFloat64OrZero(toString({impr_col})), 0)), 0) * 100 as ctr
            FROM {client}.{pm_table}
            WHERE toDate({date_col}) BETWEEN '{start}' AND '{end}'
            """
            res_pm = execute_select_query(q_pm, database=client)
            print("  4. Performance breakdown:", res_pm[0])
        else:
            print("  4. No PM table found")
    except Exception as e:
        print("  4. PM Breakdown err:", e)

test_client("boat", "2026-10-01", "2026-10-31")
test_client("mars", "2026-10-04", "2026-10-31")

