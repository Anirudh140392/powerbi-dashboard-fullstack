"""
Brand Resolution Engine — Infer brands from review corpus
==========================================================
Strategy:
1. For each ASIN/PID, scan ALL reviews for brand mentions
2. If ANY review for an ASIN mentions a brand, that becomes the ASIN's brand (majority vote)
3. For ASINs with no brand mentions, use the existing competitor_products.json mapping
4. For remaining unknowns, label as "Competitor-{category}" for dashboard grouping
5. Update competitor_reviews.json and competitor_products.json with resolved brands
"""

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent

# Complete brand list with all known kitchen appliance brands in India
KNOWN_BRANDS = [
    # Multi-word (check first)
    "morphy richards", "morphy-richards",
    "black decker", "black+decker", "black & decker",
    "euro guard", "euro-guard",
    "glen india", "glen appliances",
    "kent ro", "kent atta",
    "stovekraft", "stove kraft",
    "ttk prestige",
    "eureka forbes",
    "borosil glass", "borosil prima",
    "hamilton beach",
    "food grade",  # skip false positive
    # Single-word brands
    "prestige", "hawkins", "pigeon", "butterfly", "preethi", "bajaj",
    "philips", "wonderchef", "bosch", "panasonic", "sujata", "maharaja",
    "usha", "crompton", "havells", "orient", "kenstar", "inalsa", "glen",
    "vinod", "nirlep", "cello", "elica", "faber", "kaff", "hindware",
    "sunflame", "milton", "signora", "ganesh", "sumeet", "vidiem",
    "premier", "futura", "hamilton", "cuisinart", "kitchenaid",
    "thermador", "whirlpool", "lg", "samsung", "ifb", "godrej", "voltas",
    "kent", "aquaguard", "livpure", "borosil", "bergner", "amazon basics",
    "solimo", "lifelong", "agaro", "longway", "tefal", "blowhot",
    "crystal", "surya", "greenchef", "eveready", "candes", "v-guard",
    "singer", "rico", "sowbaghya", "ultra", "renberg",
]

# Skip these - too generic, cause false positives
SKIP_BRANDS = {"food grade", "ultra", "premier", "crystal", "singer", "lg", "orient"}

# Normalization map
BRAND_NORMALIZE = {
    "morphy richards": "Morphy Richards",
    "morphy-richards": "Morphy Richards",
    "black decker": "Black & Decker",
    "black+decker": "Black & Decker",
    "black & decker": "Black & Decker",
    "ttk prestige": "Prestige",
    "stovekraft": "Pigeon",
    "stove kraft": "Pigeon",
    "eureka forbes": "Eureka Forbes",
    "glen india": "Glen",
    "glen appliances": "Glen",
    "kent ro": "Kent",
    "kent atta": "Kent",
    "borosil glass": "Borosil",
    "borosil prima": "Borosil",
    "hamilton beach": "Hamilton Beach",
    "amazon basics": "Amazon Basics",
    "v-guard": "V-Guard",
    "euro guard": "Euro Guard",
    "euro-guard": "Euro Guard",
}


def detect_brands_in_text(text: str) -> list:
    """Find ALL brand mentions in text. Returns list of normalized brand names."""
    text_lower = text.lower()
    found = []
    
    # Sort by length (longest first) to avoid partial matches
    sorted_brands = sorted(KNOWN_BRANDS, key=len, reverse=True)
    
    for brand in sorted_brands:
        if brand in SKIP_BRANDS:
            continue
        
        # Use word boundary matching
        pattern = r'\b' + re.escape(brand) + r'\b'
        if re.search(pattern, text_lower):
            normalized = BRAND_NORMALIZE.get(brand, brand.title())
            if normalized not in found:
                found.append(normalized)
    
    return found


def resolve_brands():
    """Main brand resolution pipeline."""
    print("=" * 60)
    print("BRAND RESOLUTION ENGINE")
    print("=" * 60)
    
    # Load current competitor reviews
    reviews_path = PROJECT_ROOT / "src" / "data" / "competitor_reviews.json"
    with open(reviews_path, "r", encoding="utf-8") as f:
        reviews = json.load(f)
    print(f"\nLoaded {len(reviews):,} reviews")
    
    # Load existing competitor products mapping (has known ASINs)
    products_path = PROJECT_ROOT / "src" / "data" / "competitor_products.json"
    with open(products_path, "r", encoding="utf-8") as f:
        products_data = json.load(f)
    
    # Phase 1: Scan ALL reviews per ASIN for brand mentions
    print("\nPhase 1: Scanning all reviews for brand mentions...")
    pid_brands = defaultdict(Counter)  # PID -> {brand: count}
    pid_reviews = defaultdict(list)    # PID -> [review indices]
    
    for idx, r in enumerate(reviews):
        pid = r.get("productId", "")
        pid_reviews[pid].append(idx)
        
        # Detect brands in review text
        brands = detect_brands_in_text(r.get("text", ""))
        for brand in brands:
            pid_brands[pid][brand] += 1
    
    total_pids = len(pid_reviews)
    pids_with_brand = sum(1 for pid in pid_brands if pid_brands[pid])
    print(f"  Total PIDs: {total_pids}")
    print(f"  PIDs with brand detected in reviews: {pids_with_brand} ({pids_with_brand/total_pids*100:.1f}%)")
    
    # Phase 2: Determine best brand per PID using majority voting
    print("\nPhase 2: Resolving brands via majority voting...")
    pid_brand_map = {}
    
    for pid in pid_reviews:
        if pid in pid_brands and pid_brands[pid]:
            # Use most mentioned brand for this PID
            # But exclude "Prestige" if it's a competitor review (likely comparison mention)
            brands = pid_brands[pid]
            # If only brand is "Prestige", likely a competitor's review mentioning Prestige
            non_prestige = {b: c for b, c in brands.items() if b != "Prestige"}
            
            if non_prestige:
                best = max(non_prestige, key=non_prestige.get)
                pid_brand_map[pid] = best
            elif len(brands) == 1 and "Prestige" in brands:
                # Only Prestige mentioned — this IS Prestige's product from competitor data
                # Keep as Unknown for now, it's likely a comparison mention
                pid_brand_map[pid] = "Unknown"
            else:
                best = max(brands, key=brands.get)
                pid_brand_map[pid] = best
        else:
            pid_brand_map[pid] = "Unknown"
    
    # Brand resolution stats
    resolved_brands = Counter(pid_brand_map.values())
    print(f"\n  Resolved brand distribution (by PID count):")
    for brand, count in resolved_brands.most_common(20):
        pct = count / total_pids * 100
        print(f"    {brand:20s} {count:5} PIDs ({pct:5.1f}%)")
    
    # Phase 3: Apply resolved brands to all reviews
    print("\nPhase 3: Applying resolved brands to reviews...")
    updates = 0
    brand_review_counts = Counter()
    
    for pid, indices in pid_reviews.items():
        resolved = pid_brand_map.get(pid, "Unknown")
        for idx in indices:
            old_brand = reviews[idx]["brand"]
            if old_brand == "Unknown" and resolved != "Unknown":
                reviews[idx]["brand"] = resolved
                updates += 1
            elif old_brand != "Unknown":
                # Keep already-detected brand
                resolved = old_brand
            
            brand_review_counts[reviews[idx]["brand"]] += 1
    
    print(f"  Updated {updates:,} reviews with resolved brands")
    
    # Final brand distribution
    print(f"\n  Final brand distribution (by review count):")
    for brand, count in brand_review_counts.most_common(20):
        pct = count / len(reviews) * 100
        print(f"    {brand:20s} {count:6,} ({pct:5.1f}%)")
    
    still_unknown = brand_review_counts.get("Unknown", 0)
    print(f"\n  Still unknown: {still_unknown:,} reviews ({still_unknown/len(reviews)*100:.1f}%)")
    
    # Phase 4: For unknown PIDs, use product CATEGORY as group label
    print("\nPhase 4: Labeling remaining unknowns by category...")
    for pid, indices in pid_reviews.items():
        if pid_brand_map.get(pid) == "Unknown":
            # Get the most common category for this PID's reviews
            cats = Counter(reviews[idx].get("category", "General") for idx in indices)
            top_cat = cats.most_common(1)[0][0] if cats else "General"
            
            # Label as "Competitor-{Category}"
            label = f"Competitor ({top_cat})"
            for idx in indices:
                if reviews[idx]["brand"] == "Unknown":
                    reviews[idx]["brand"] = label
            pid_brand_map[pid] = label
    
    # Final stats
    final_brands = Counter(r["brand"] for r in reviews)
    print(f"\n  Final (after category labeling):")
    for brand, count in final_brands.most_common(25):
        pct = count / len(reviews) * 100
        print(f"    {brand:30s} {count:6,} ({pct:5.1f}%)")
    
    # Phase 5: Update competitor_products.json
    print("\nPhase 5: Updating competitor_products.json...")
    for prod in products_data.get("competitors", []):
        pid = prod.get("platformId", "")
        if pid in pid_brand_map:
            prod["brand"] = pid_brand_map[pid]
            # Update product name if it was generic
            if prod["name"].startswith("Unknown") or prod["name"].startswith("Competitor"):
                prod["name"] = f"{pid_brand_map[pid]} {prod.get('category', 'Product')}"
    
    # Save updated files
    print("\nSaving updated files...")
    with open(reviews_path, "w", encoding="utf-8") as f:
        json.dump(reviews, f, ensure_ascii=False, indent=2)
    size_mb = reviews_path.stat().st_size / (1024 * 1024)
    print(f"  💾 competitor_reviews.json: {len(reviews):,} reviews ({size_mb:.1f} MB)")
    
    with open(products_path, "w", encoding="utf-8") as f:
        json.dump(products_data, f, ensure_ascii=False, indent=2)
    print(f"  💾 competitor_products.json: {len(products_data.get('competitors', []))} products")
    
    print(f"\n{'='*60}")
    print("BRAND RESOLUTION COMPLETE")
    print(f"{'='*60}")


if __name__ == "__main__":
    resolve_brands()
