import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.step2_logic import execute_select_query

# Test different combinations of Channel, Category, Brand in drl.rb_pdp_olap
# to see which one produces ASP = 526.93 and Discount = 12.3%
print("Testing combinations...")

q = """
SELECT Platform, Category, Brand, 
       ROUND(AVG(if(toFloat64OrZero(toString(Selling_Price)) > 0, toFloat64OrZero(toString(Selling_Price)), NULL)), 2) as asp,
       ROUND((SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(MRP)), 0)) - SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(Selling_Price)), 0))) / NULLIF(SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(MRP)), 0)), 0) * 100, 1) as disc,
       count()
FROM drl.rb_pdp_olap
WHERE DATE >= '2026-11-01' AND DATE <= '2026-11-23' AND Comp_flag = 0
GROUP BY Platform, Category, Brand
HAVING abs(asp - 526.93) < 1.0 OR abs(disc - 12.3) < 0.2
"""
try:
    rows = execute_select_query(q)
    for r in rows:
        print("MATCH GROUP:", r)
except Exception as e:
    print("ERR:", e)

# Also test by Category only:
q2 = """
SELECT Category, 
       ROUND(AVG(if(toFloat64OrZero(toString(Selling_Price)) > 0, toFloat64OrZero(toString(Selling_Price)), NULL)), 2) as asp,
       ROUND((SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(MRP)), 0)) - SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(Selling_Price)), 0))) / NULLIF(SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(MRP)), 0)), 0) * 100, 1) as disc
FROM drl.rb_pdp_olap
WHERE DATE >= '2026-11-01' AND DATE <= '2026-11-23' AND Comp_flag = 0
GROUP BY Category
"""
try:
    rows2 = execute_select_query(q2)
    for r in rows2:
        print("CATEGORY:", r)
except Exception as e:
    print("ERR2:", e)
