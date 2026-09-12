import requests
import json

url = "http://13.203.251.97:8123/"
auth = ('yash_user', 'yash@Gautam0100')

query = """
    SELECT * FROM (
        SELECT web_pid, platform, price_rp, price_sp, category, pareto_status
        FROM danone.product_snapshots
        WHERE company_id = 'fb064e5d-7e70-4cf1-b09b-e2428d8a1c9b'
        ORDER BY snapshot_date DESC, created_at DESC
    ) LIMIT 1 BY lower(platform), web_pid
"""

r = requests.post(url, auth=auth, data=query + " FORMAT JSON")
print(json.dumps(r.json(), indent=2)[:500])
