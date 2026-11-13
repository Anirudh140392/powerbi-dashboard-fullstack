import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))

from ds_tester.backend.step2_logic import execute_select_query

print("=== Check Categories in rb_ms_olap for March 2026 ===")
cats = execute_select_query("""
    SELECT 
        category,
        count(),
        SUM(toFloat64OrZero(toString(sales))) as cat_sales,
        SUM(IF(lower(group_brand) = 'mars', toFloat64OrZero(toString(sales)), 0)) as mars_sales
    FROM mars.rb_ms_olap
    WHERE toDate(created_on) >= '2026-03-01' AND toDate(created_on) <= '2026-03-31'
    GROUP BY category
""", database='mars')
for c in cats:
    print(f"Cat: '{c[0]}' | Rows: {c[1]} | Cat Sales: ₹{c[2]/1e7:.2f} Cr | Mars Sales: ₹{c[3]/1e7:.2f} Cr")

print("\n=== Check Platforms in rb_ms_olap for March 2026 ===")
plats = execute_select_query("""
    SELECT 
        platform,
        count(),
        SUM(toFloat64OrZero(toString(sales))) as cat_sales,
        SUM(IF(lower(group_brand) = 'mars', toFloat64OrZero(toString(sales)), 0)) as mars_sales
    FROM mars.rb_ms_olap
    WHERE toDate(created_on) >= '2026-03-01' AND toDate(created_on) <= '2026-03-31'
    GROUP BY platform
""", database='mars')
for p in plats:
    print(f"Plat: '{p[0]}' | Rows: {p[1]} | Cat Sales: ₹{p[2]/1e7:.2f} Cr | Mars Sales: ₹{p[3]/1e7:.2f} Cr")

