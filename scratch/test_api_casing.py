import sys, os, urllib.request, json
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.modules.pricing import call_platform_api

period = {'startDate': '2026-11-01', 'endDate': '2026-11-23'}
print("Calling with platform='Flipkart':")
res1 = call_platform_api("/api/pricing-analysis/kpis", params={'platform': 'Flipkart'}, period=period, db_name='drl')
print("Flipkart (capital):", res1.get('data', {}).get('discount'), res1.get('data', {}).get('asp'))

print("Calling with platform='flipkart':")
res2 = call_platform_api("/api/pricing-analysis/kpis", params={'platform': 'flipkart'}, period=period, db_name='drl')
print("flipkart (lower):", res2.get('data', {}).get('discount'), res2.get('data', {}).get('asp'))
