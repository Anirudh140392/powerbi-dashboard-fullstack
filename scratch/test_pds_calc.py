import sys, os
sys.path.insert(0, os.path.abspath('.'))
from ds_tester.backend.step2_logic import execute_select_query

for platform in ['blinkit', 'zepto', 'instamart']:
    q_osa = f"""
    WITH pds_skus AS (
        SELECT DISTINCT lower(web_pid) as web_pid 
        FROM mars.rb_sku_platform 
        WHERE is_pds = 1 AND lower(platform_name) = '{platform}'
    )
    SELECT 
        (countIf(neno_osa > 0) / NULLIF(countIf(deno_osa > 0), 0)) * 100 AS osa
    FROM mars.rb_pdp_olap
    WHERE DATE BETWEEN '2026-10-01' AND '2026-10-31'
      AND lower(Platform) = '{platform}'
      AND lower(Web_Pid) IN (SELECT web_pid FROM pds_skus)
    """
    res = execute_select_query(q_osa, database='mars')
    val = float(res[0][0]) if res and res[0] and res[0][0] is not None else 0.0
    print(f"{platform.upper()} PDS OSA: {val:.2f}%")
