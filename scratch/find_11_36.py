import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step2_logic import execute_select_query

# Let's check boat and mars for discount or other metrics around 11.3694
clients = ["boat", "mars", "mamaearth", "garnier", "maybelline"]
for c in clients:
    try:
        # Check overall discount for March 2026 or last 30 days or October 2026
        q = f"""
            SELECT 
                (SUM(toFloat64OrZero(toString(MRP))) - SUM(toFloat64OrZero(toString(Selling_Price)))) / NULLIF(SUM(toFloat64OrZero(toString(MRP))), 0) * 100 as disc
            FROM {c}.rb_pdp_olap
            WHERE (toString(Comp_flag) = '0' OR Comp_flag = 0) AND neno_osa > 0
        """
        res = execute_select_query(q, database=c)
        if res and res[0] and res[0][0] is not None:
            print(f"Client {c} all-time discount: {res[0][0]}")

        # Check for specific months
        for m in ("2026-03", "2026-10", "2026-11", "2025-10"):
            q_m = f"""
                SELECT 
                    (SUM(toFloat64OrZero(toString(MRP))) - SUM(toFloat64OrZero(toString(Selling_Price)))) / NULLIF(SUM(toFloat64OrZero(toString(MRP))), 0) * 100 as disc
                FROM {c}.rb_pdp_olap
                WHERE (toString(Comp_flag) = '0' OR Comp_flag = 0) AND neno_osa > 0
                  AND toDate(DATE) >= '{m}-01' AND toDate(DATE) <= '{m}-31'
            """
            try:
                res_m = execute_select_query(q_m, database=c)
                if res_m and res_m[0] and res_m[0][0] is not None:
                    val = res_m[0][0]
                    if abs(val - 11.3694) < 0.1 or abs(val - 11.2) < 0.1:
                        print(f"!!! MATCH in {c} for month {m}: {val}")
                    else:
                        print(f"  {c} {m}: {val}")
            except Exception:
                pass
    except Exception as e:
        pass

