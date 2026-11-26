import sys, os
sys.path.insert(0, os.path.abspath("."))
from ds_tester.backend.modules.pds_score import step1_fetch, step2_logic

p6 = {"platform": "Blinkit", "year": "2026", "period": "Period 6"}
print("Step 1:", step1_fetch("pds_score_blinkit", p6))
print("Step 2:", step2_logic("pds_score_blinkit", p6))

