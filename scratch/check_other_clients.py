import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

clients = ['prestige', 'boat', 'pidilite', 'mars', 'drl']
for cl in clients:
    try:
        q = f"""
        SELECT ROUND(AVG(if(toFloat64OrZero(toString(Selling_Price)) > 0, toFloat64OrZero(toString(Selling_Price)), NULL)), 2) as asp,
               ROUND((SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(MRP)), 0)) - SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(Selling_Price)), 0))) / NULLIF(SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(MRP)), 0)), 0) * 100, 1) as disc
        FROM {cl}.rb_pdp_olap
        WHERE DATE >= '2026-11-01' AND DATE <= '2026-11-23' AND Comp_flag = 0
        """
        rows = execute_select_query(q)
        print(f"{cl} (overall):", rows)
        
        # Also check with platforms for this client
        q_plat = f"""
        SELECT Platform,
               ROUND(AVG(if(toFloat64OrZero(toString(Selling_Price)) > 0, toFloat64OrZero(toString(Selling_Price)), NULL)), 2) as asp,
               ROUND((SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(MRP)), 0)) - SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(Selling_Price)), 0))) / NULLIF(SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(MRP)), 0)), 0) * 100, 1) as disc
        FROM {cl}.rb_pdp_olap
        WHERE DATE >= '2026-11-01' AND DATE <= '2026-11-23' AND Comp_flag = 0
        GROUP BY Platform
        HAVING abs(asp - 526.93) < 1.0 OR abs(disc - 12.3) < 0.2
        """
        rows_p = execute_select_query(q_plat)
        if rows_p:
            print(f"  {cl} platform matches:", rows_p)
    except Exception as e:
        print(f"{cl} err:", e)
