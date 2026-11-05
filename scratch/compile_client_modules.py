import sys
import json
sys.path.insert(0, ".")
from ds_tester.backend.step2_logic import execute_select_query
from ds_tester.backend.modules import MODULES

dbs_raw = execute_select_query("SELECT id, db_name FROM admin_master.tb_database WHERE status = 'active' ORDER BY db_name")
db_list = [r[1] for r in dbs_raw]

def get_sidebar_modules(db):
    db_lower = db.lower()
    mods = [
        "Business Overview (Watch Tower)",
        "India Overview (Geo Intelligence)",
        "Insights",
        "Availability Analysis",
        "Market Coverage (On Shelf Availability)",
        "Visibility Analysis",
    ]
    
    # Market Share
    if db_lower not in ['mars_petcare', 'sugar']:
        mods.append("Market Share")
        
    # Performance Marketing
    if db_lower not in ['mamaearth', 'boat']:
        mods.append("Performance Marketing")
        
    # Content Score vs Content Analysis
    if db_lower == 'mars':
        mods.append("Content Score")
    else:
        # Check if client has rb_content_olap or rb_product_verify
        mods.append("Content Analysis")
        
    # Inventory Analysis
    if db_lower not in ['mamaearth', 'boat']:
        mods.append("Inventory Analysis")
        
    mods.append("PDS Score")
    mods.append("Review Rating")
    
    # Ad Auto
    if db_lower not in ['mars', 'boat', 'zydus', 'hm_zydus', 'mars_petcare']:
        mods.append("Ad Auto (Campaigns)")
        
    mods.append("Download Report")
    
    # DRL specific
    if db_lower == 'drl':
        mods.append("Primary Summary")
        mods.append("Secondary Summary")
        
    # Pricing subpages
    if db_lower not in ['mamaearth']:
        mods.append("Pricing Analysis")
    mods.append("Cross Platform Pricing")
    
    # Pidilite specific
    if db_lower == 'pidilite':
        mods.append("MOP Analysis")
        
    # Supply Chain
    mods.append("Priority Action (Supply Chain)")
    
    # Advanced
    mods.append("Report Studio")
    mods.append("Scheduled Reports")
    mods.append("DS Tester (Data Science Verification)")
    
    return mods

def get_ds_tester_modules(db):
    res = []
    for mod_id, mod_cls in MODULES.items():
        if hasattr(mod_cls, "get_segments"):
            segs = mod_cls.get_segments(client=db)
        else:
            segs = getattr(mod_cls, "segments", [])
        if segs:
            res.append({
                "id": mod_id,
                "name": getattr(mod_cls, "name", mod_id).replace("_", " ").title(),
                "segments": [s["label"] for s in segs]
            })
    return res

output = {}
for db in db_list:
    output[db] = {
        "sidebar_modules": get_sidebar_modules(db),
        "ds_tester_modules": get_ds_tester_modules(db)
    }

with open("scratch/all_clients_modules.json", "w") as f:
    json.dump(output, f, indent=2)

print(f"Compiled modules for {len(db_list)} clients successfully.")
