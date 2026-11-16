import sys
sys.path.insert(0, '.')
from ds_tester.backend.step2_logic import execute_select_query
print('ECOM PLATS IN rca_sku_dim:', execute_select_query("SELECT DISTINCT platform FROM mars.rca_sku_dim WHERE lower(channel) LIKE '%ecom%'", database='mars'))
print('QC PLATS IN rca_sku_dim:', execute_select_query("SELECT DISTINCT platform FROM mars.rca_sku_dim WHERE lower(channel) LIKE '%quick%'", database='mars'))
print('ALL CHANNELS IN rca_sku_dim:', execute_select_query("SELECT DISTINCT channel FROM mars.rca_sku_dim", database='mars'))
print('PLATFORMS IN rb_pdp_olap BY CHANNEL:', execute_select_query("SELECT DISTINCT platform, channel FROM mars.rb_pdp_olap", database='mars'))
