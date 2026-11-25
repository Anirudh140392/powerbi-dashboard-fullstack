import requests
import json

base_url = 'http://127.0.0.1:8002/ds-tester'

for m in ['discount', 'sos', 'roas', 'offtakes', 'osa', 'wt_osa', 'qty_sold', 'asp_ppu']:
    try:
        res = requests.get(f'{base_url}/anomaly/chart', params={'client': 'drl', 'metric': m, 'days': 30}, timeout=15)
        print(f'Metric {m}: status={res.status_code}')
        if res.status_code == 200:
            data = res.json()
            pts = data.get('points', [])
            decomp = data.get('decomposition', {})
            l1 = decomp.get('level1_platforms', [])
            l5 = decomp.get('level5_skus', [])
            top_p = l1[0] if l1 else {}
            print(f'   Points: {len(pts)} | Level 1: {len(l1)} | Level 5: {len(l5)}')
            print(f'   Top platform: {top_p.get("name")} -> val={top_p.get("value")}, sales={top_p.get("sales")}, disc={top_p.get("discount")}, osa={top_p.get("osa")}, status={top_p.get("status_label")}')
    except Exception as e:
        print(f'Metric {m} failed: {e}')
