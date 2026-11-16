import sys
sys.path.append('.')
from ds_tester.backend.modules.pricing import step1_fetch, step2_logic, _get_segment_info

period = {'startDate': '2026-10-01', 'endDate': '2026-10-29'}

for client in ['boat', 'pidilite', 'mars']:
    print(f"\n=================== CLIENT: {client} ===================")
    for seg in ['pricing_overview', 'pricing_overview_amazon']:
        try:
            print(f"\n--- Segment: {seg} ---")
            s1 = step1_fetch(seg, period, client=client)
            print("Step 1 (API):", s1)
            s2 = step2_logic(seg, period, client=client)
            print("Step 2 (Logic):", s2)
        except Exception as e:
            print(f"Error on {seg}: {e}")

