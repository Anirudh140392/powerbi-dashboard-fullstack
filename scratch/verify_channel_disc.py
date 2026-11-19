import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step2_logic import execute_select_query

# Query discount on boat or mars for all channels vs specific channels
for client in ["boat", "mars"]:
    print(f"\n=== Client: {client} ===")
    channels = execute_select_query(f"SELECT DISTINCT channel FROM {client}.rca_sku_dim WHERE channel IS NOT NULL AND channel != ''", database=client)
    ch_list = [c[0] for c in channels if c and c[0]]
    print("Channels:", ch_list)

    # 1. All channels
    q_all = f"""
        SELECT 
            (SUM(ifNull(toFloat64OrZero(toString(MRP)), 0)) - SUM(ifNull(toFloat64OrZero(toString(Selling_Price)), 0))) / NULLIF(SUM(ifNull(toFloat64OrZero(toString(MRP)), 0)), 0) * 100 as disc
        FROM {client}.rb_pdp_olap
        WHERE Comp_flag = '0' AND ifNull(toFloat64OrZero(toString(MRP)), 0) > 0
    """
    try:
        res_all = execute_select_query(q_all, database=client)
        print(f"  All channels discount: {res_all[0][0]}")
    except Exception as e:
        print("  Error:", e)

    # 2. Per channel
    for ch in ch_list:
        q_ch = f"""
            SELECT 
                (SUM(ifNull(toFloat64OrZero(toString(MRP)), 0)) - SUM(ifNull(toFloat64OrZero(toString(Selling_Price)), 0))) / NULLIF(SUM(ifNull(toFloat64OrZero(toString(MRP)), 0)), 0) * 100 as disc
            FROM {client}.rb_pdp_olap
            WHERE Comp_flag = '0' AND ifNull(toFloat64OrZero(toString(MRP)), 0) > 0
              AND lower(channel) = '{ch.lower()}'
        """
        try:
            res_ch = execute_select_query(q_ch, database=client)
            print(f"  Channel '{ch}' discount: {res_ch[0][0]}")
        except Exception as e:
            pass

