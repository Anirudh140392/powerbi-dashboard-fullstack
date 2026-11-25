import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step2_logic import execute_select_query

clients_rows = execute_select_query("SELECT db_name FROM admin_master.tb_database WHERE status = 'active'", database="admin_master")
clients = [r[0] for r in clients_rows if r and r[0]]

print(f"Scanning {len(clients)} clients for 11.3694 or ~11.37 / 11.2...")

for client in clients:
    try:
        tables = [t[0] for t in execute_select_query(f"SHOW TABLES FROM {client}", database=client)]
        if "rb_pdp_olap" not in tables:
            continue
        
        # Check discount on rb_pdp_olap
        q = f"""
            SELECT 
                (SUM(ifNull(toFloat64OrZero(toString(MRP)), 0)) - SUM(ifNull(toFloat64OrZero(toString(Selling_Price)), 0))) / NULLIF(SUM(ifNull(toFloat64OrZero(toString(MRP)), 0)), 0) * 100 as disc
            FROM {client}.rb_pdp_olap
            WHERE Comp_flag = '0' AND ifNull(toFloat64OrZero(toString(MRP)), 0) > 0
        """
        rows = execute_select_query(q, database=client)
        if rows and rows[0] and rows[0][0] is not None:
            val = float(rows[0][0])
            if abs(val - 11.3694) < 0.2 or abs(val - 11.2) < 0.2:
                print(f"FOUND MATCH in {client}: all-time={val}")

        # Check with specific date ranges
        for m in ("2026-03", "2026-10", "2026-11"):
            q_m = f"""
                SELECT 
                    (SUM(ifNull(toFloat64OrZero(toString(MRP)), 0)) - SUM(ifNull(toFloat64OrZero(toString(Selling_Price)), 0))) / NULLIF(SUM(ifNull(toFloat64OrZero(toString(MRP)), 0)), 0) * 100 as disc
                FROM {client}.rb_pdp_olap
                WHERE Comp_flag = '0' AND ifNull(toFloat64OrZero(toString(MRP)), 0) > 0
                  AND toDate(DATE) >= '{m}-01' AND toDate(DATE) <= '{m}-31'
            """
            try:
                res_m = execute_select_query(q_m, database=client)
                if res_m and res_m[0] and res_m[0][0] is not None:
                    val_m = float(res_m[0][0])
                    if abs(val_m - 11.3694) < 0.2 or abs(val_m - 11.2) < 0.2:
                        print(f"FOUND MATCH in {client} ({m}): {val_m}")
            except Exception:
                pass

    except Exception:
        pass
print("Scan complete.")
