"""
Product Enrichment Engine
=========================
Enriches competitor reviews with:
1. Product type detection from review text + PID codes
2. Spec extraction (capacity, wattage, burner count)
3. Proper productName for SegmentMatrixView

Strategy:
- Flipkart PIDs have category prefixes (GSTH=Gas Stove, ICT=Induction, AFR=Air Fryer, etc.)
- Review text often mentions product type ("cooker", "stove", "mixer", "induction", "grinder")
- Reviews mention specs ("5 litre", "3 burner", "750 watt")
- Per-PID majority voting: if 60% of reviews for a PID say "pressure cooker", all get that label
"""

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent

# ============================================================
# Flipkart PID → Category mapping (based on PID prefixes)
# Verified from actual Flipkart PID patterns
# ============================================================
FLIPKART_PID_CATEGORY = {
    "GST":  "Gas Stove",
    "ICT":  "Induction Cooktop",
    "AFR":  "Air Fryer",
    "ECK":  "Electric Kettle",
    "KTL":  "Kettle",
    "MXG":  "Mixer Grinder",
    "PRC":  "Pressure Cooker",
    "PRK":  "Pressure Cooker",
    "PCK":  "Pressure Cooker",
    "TWA":  "Tawa",
    "FRP":  "Fry Pan",
    "KDA":  "Kadai",
    "CKS":  "Cookware Set",
    "OTG":  "Toaster & OTG",
    "IRN":  "Iron",
    "SIM":  "Sandwich Maker",
    "RCK":  "Rice Cooker",
    "JCR":  "Juicer",
    "CHP":  "Chimney",
    "WPU":  "Water Purifier",
    "HND":  "Handi",
    "SPN":  "Saucepan",
    "CSR":  "Casserole",
    "STR":  "Steamer",
}


# ============================================================
# Product type detection from review text
# ============================================================
PRODUCT_DETECTION_RULES = [
    # Multi-word (most specific first)
    ("Pressure Cooker",  [
        r'\bpressure\s+cook(?:er|ing)\b', r'\bcooker\b', r'\bprestige\s+popular\b',
        r'\bprestige\s+deluxe\b', r'\bprestige\s+nakshatra\b', r'\bprestige\s+svachh\b',
        r'\bautoclave\b', r'\bwhist(?:le|ling)\b', r'\bgasket\b', r'\bpressure\s+lid\b',
        r'\bsealing\s+ring\b', r'\bpressure\s+valve\b', r'\bsafety\s+valve\b',
        r'\balumini?um\s+cook(?:er|ware)\b', r'\bhard\s+anodi[sz]ed\s+cook(?:er|ware)\b',
    ]),
    ("Gas Stove",  [
        r'\bgas\s+stove\b', r'\bgas\s+hob\b', r'\bburner\s+(?:stove|gas)\b',
        r'\b(?:2|3|4)\s*burner\b', r'\bgas\s+table\b', r'\bstove\s+top\b',
        r'\bflame\b', r'\bignit(?:ion|er)\b', r'\bgas\s*(?:pipe|regulator)\b',
        r'\blpg\b', r'\bcook\s*top\b(?!.*induction)',
    ]),
    ("Induction Cooktop", [
        r'\binduction\s+cook\s*top\b', r'\binduction\s+stove\b',
        r'\binduction\s+plate\b', r'\belectromagnetic\s+cook\b',
    ]),
    ("Mixer Grinder", [
        r'\bmixer\s*grinder\b', r'\bmixer\s*-\s*grinder\b', r'\bjuicer\s*mixer\b',
        r'\bgrinder\b(?!.*coffee)', r'\bmixie\b', r'\bblender\b',
        r'\bjar(?:s)?\b.*(?:wet|dry|chutney)', r'\bwet\s+grind(?:ing|er)\b',
    ]),
    ("Non-Stick Cookware", [
        r'\bnon[\s-]*stick\b', r'\bnonstick\b', r'\bcoating\b.*(?:pan|tawa|kadai)',
        r'\bteflon\b', r'\bceramic\s+coat\b', r'\bgranite\s+coat\b',
    ]),
    ("Air Fryer", [
        r'\bair\s*fryer\b', r'\bair\s*fry(?:ing|er)\b', r'\bdigital\s+fryer\b',
    ]),
    ("Electric Kettle", [
        r'\belectric\s+kettle\b', r'\bkettle\b', r'\bhot\s+water\s+(?:pot|jug)\b',
    ]),
    ("Tawa",  [
        r'\btawa\b', r'\bdosa\s+tawa\b', r'\broti\s+tawa\b', r'\bflat\s+tawa\b',
        r'\bchapati\s+tawa\b', r'\bconcave\s+tawa\b',
    ]),
    ("Fry Pan",  [
        r'\bfry(?:ing)?\s*pan\b', r'\bfrypan\b', r'\bsaute\s*pan\b', r'\bomelet\s*pan\b',
    ]),
    ("Kadai",  [
        r'\bkadai\b', r'\bkadhai\b', r'\bkarahi\b', r'\bwok\b',
    ]),
    ("Toaster & OTG", [
        r'\btoaster\b', r'\botg\b', r'\boven\s+toaster\b', r'\bsandwich\s+maker\b',
        r'\bsandwich\s+grill\b',
    ]),
    ("Cookware Set",  [
        r'\bcookware\s+set\b', r'\bcookware\s+combo\b', r'\bkitchen\s+set\b',
    ]),
    ("Kettle",  [
        r'\bkettle\b',
    ]),
    ("Stainless Steel Cookware", [
        r'\bstainless\s+steel\b(?!.*cooker)',
    ]),
]

INDUCTION_FALSE_POSITIVE_PATTERNS = [
    r'\binduction\s+compatible\b',
    r'\binduction\s+base\b',
    r'\bcompatible\s+with\s+induction\b',
    r'\bworks?\s+on\s+induction\b',
    r'\binduction\s+friendly\b',
]

# ============================================================
# Spec extraction from review text
# ============================================================
SPEC_PATTERNS = {
    "Pressure Cooker": [
        (r'(\d+\.?\d*)\s*(?:litre|liter|ltr|l\b)', lambda m: f"{m.group(1)}L"),
    ],
    "Gas Stove": [
        (r'(\d)\s*(?:-\s*)?burner', lambda m: f"{m.group(1)}-Burner"),
    ],
    "Induction Cooktop": [
        (r'(\d{3,4})\s*(?:watt|w\b)', lambda m: f"{m.group(1)}W"),
    ],
    "Mixer Grinder": [
        (r'(\d{3,4})\s*(?:watt|w\b)', lambda m: f"{m.group(1)}W"),
    ],
    "Air Fryer": [
        (r'(\d+\.?\d*)\s*(?:litre|liter|ltr|l\b)', lambda m: f"{m.group(1)}L"),
    ],
    "Electric Kettle": [
        (r'(\d+\.?\d*)\s*(?:litre|liter|ltr|l\b)', lambda m: f"{m.group(1)}L"),
    ],
    "Tawa": [
        (r'(\d+)\s*(?:cm|mm|inch)', lambda m: f"{m.group(1)}{m.group(0).split(m.group(1))[-1].strip()}"),
    ],
    "Fry Pan": [
        (r'(\d+)\s*(?:cm|mm)', lambda m: f"{m.group(1)}cm"),
    ],
    "Kadai": [
        (r'(\d+\.?\d*)\s*(?:litre|liter|ltr|l\b)', lambda m: f"{m.group(1)}L"),
    ],
    "Toaster & OTG": [
        (r'(\d+)\s*(?:litre|liter|ltr|l\b)', lambda m: f"{m.group(1)}L"),
    ],
}


def detect_product_type(text: str) -> list:
    """Detect product type from review text. Returns list of (category, confidence)."""
    text_lower = text.lower()
    matches = []
    
    for category, patterns in PRODUCT_DETECTION_RULES:
        if category == "Induction Cooktop" and any(re.search(pattern, text_lower) for pattern in INDUCTION_FALSE_POSITIVE_PATTERNS):
            continue
        for pattern in patterns:
            if re.search(pattern, text_lower):
                # Count how many patterns match for confidence
                match_count = sum(1 for p in patterns if re.search(p, text_lower))
                confidence = min(0.5 + match_count * 0.15, 1.0)
                matches.append((category, confidence))
                break  # Only count this category once
    
    return matches


def detect_flipkart_category(pid: str) -> str | None:
    """Detect product category from Flipkart PID prefix."""
    for prefix, category in FLIPKART_PID_CATEGORY.items():
        if pid.startswith(prefix):
            return category
    return None


def extract_spec(text: str, category: str) -> str | None:
    """Extract spec (capacity/wattage/size) from text for a given category."""
    text_lower = text.lower()
    patterns = SPEC_PATTERNS.get(category, [])
    
    for pattern, formatter in patterns:
        match = re.search(pattern, text_lower)
        if match:
            return formatter(match)
    
    return None


def enrich_products():
    """Main enrichment pipeline."""
    print("=" * 60)
    print("PRODUCT ENRICHMENT ENGINE")
    print("=" * 60)
    
    # Load reviews
    reviews_path = PROJECT_ROOT / "src" / "data" / "competitor_reviews.json"
    with open(reviews_path, "r", encoding="utf-8") as f:
        reviews = json.load(f)
    print(f"\nLoaded {len(reviews):,} reviews")
    
    # Phase 1: Detect product type for each review
    print("\nPhase 1: Detecting product types from review text + PID codes...")
    pid_categories = defaultdict(Counter)  # PID → {category: count}
    pid_specs = defaultdict(Counter)       # PID → {spec: count}
    
    for r in reviews:
        pid = r.get("productId", "")
        text = r.get("text", "")
        platform = r.get("platform", "")
        
        # 1. Flipkart PID prefix detection
        if platform == "flipkart":
            fk_cat = detect_flipkart_category(pid)
            if fk_cat:
                pid_categories[pid][fk_cat] += 3  # Extra weight for PID prefix
        
        # 2. Text-based detection
        matches = detect_product_type(text)
        for category, conf in matches:
            pid_categories[pid][category] += 1
            
            # 3. Extract spec from same text
            spec = extract_spec(text, category)
            if spec:
                pid_specs[pid][spec] += 1
    
    # Phase 2: Majority vote per PID
    print("\nPhase 2: Resolving product type per PID via majority voting...")
    pid_product_map = {}
    pid_spec_map = {}
    
    for pid in set(r["productId"] for r in reviews):
        if pid in pid_categories and pid_categories[pid]:
            best_cat = pid_categories[pid].most_common(1)[0][0]
            pid_product_map[pid] = best_cat
        else:
            pid_product_map[pid] = "Other"
        
        if pid in pid_specs and pid_specs[pid]:
            best_spec = pid_specs[pid].most_common(1)[0][0]
            pid_spec_map[pid] = best_spec
    
    # Stats
    resolved = Counter(pid_product_map.values())
    total_pids = len(pid_product_map)
    print(f"\n  Product type distribution ({total_pids} PIDs):")
    for cat, count in resolved.most_common():
        pct = count / total_pids * 100
        print(f"    {cat:25s} {count:5} ({pct:5.1f}%)")
    
    pids_with_spec = sum(1 for pid in pid_spec_map if pid_spec_map[pid])
    print(f"\n  PIDs with spec detected: {pids_with_spec}/{total_pids} ({pids_with_spec/total_pids*100:.1f}%)")
    
    spec_dist = Counter(pid_spec_map.values())
    print(f"\n  Spec distribution:")
    for spec, count in spec_dist.most_common(20):
        print(f"    {spec:10s} {count:5}")
    
    # Phase 3: Apply to all reviews
    print("\nPhase 3: Applying product type + spec to all reviews...")
    updates = 0
    category_review_counts = Counter()
    
    for r in reviews:
        pid = r["productId"]
        product_type = pid_product_map.get(pid, "Other")
        spec = pid_spec_map.get(pid)
        brand = r.get("brand", "Unknown")
        
        # Build a proper productName for extractProductCategory
        parts = [brand]
        if spec:
            parts.append(spec)
        parts.append(product_type)
        product_name = " ".join(parts)
        
        # Update fields
        old_cat = r.get("category", "General")
        r["category"] = product_type
        r["productName"] = product_name
        if spec:
            r["specTier"] = spec
        
        if old_cat != product_type:
            updates += 1
        
        category_review_counts[product_type] += 1
    
    print(f"  Updated {updates:,} reviews with resolved product types")
    
    print(f"\n  Final category distribution (by review count):")
    for cat, count in category_review_counts.most_common():
        pct = count / len(reviews) * 100
        print(f"    {cat:25s} {count:6,} ({pct:5.1f}%)")
    
    still_other = category_review_counts.get("Other", 0)
    print(f"\n  Still 'Other': {still_other:,} ({still_other/len(reviews)*100:.1f}%)")
    
    # Phase 4: Update competitor_products.json
    print("\nPhase 4: Updating competitor_products.json...")
    products_path = PROJECT_ROOT / "src" / "data" / "competitor_products.json"
    with open(products_path, "r", encoding="utf-8") as f:
        products_data = json.load(f)
    
    for prod in products_data.get("competitors", []):
        pid = prod.get("platformId", "")
        if pid in pid_product_map:
            prod["category"] = pid_product_map[pid]
            brand = prod.get("brand", "Unknown")
            spec = pid_spec_map.get(pid, "")
            prod["name"] = f"{brand} {spec} {pid_product_map[pid]}".strip()
    
    # Save
    print("\nSaving updated files...")
    with open(reviews_path, "w", encoding="utf-8") as f:
        json.dump(reviews, f, ensure_ascii=False, indent=2)
    size_mb = reviews_path.stat().st_size / (1024 * 1024)
    print(f"  💾 competitor_reviews.json: {len(reviews):,} reviews ({size_mb:.1f} MB)")
    
    with open(products_path, "w", encoding="utf-8") as f:
        json.dump(products_data, f, ensure_ascii=False, indent=2)
    print(f"  💾 competitor_products.json updated")
    
    print(f"\n{'='*60}")
    print("PRODUCT ENRICHMENT COMPLETE")
    print(f"{'='*60}")


if __name__ == "__main__":
    enrich_products()
