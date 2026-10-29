"""Analyze subcategory distribution to identify imbalances."""
import json
from collections import Counter

# Load enriched reviews
with open('src/data/reviews_ml_enriched.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

print(f"Total reviews: {len(reviews):,}")

# Count categories and subcategories
cats = Counter(r.get('sentimentCategory', 'Unknown') for r in reviews)
subcats = Counter(r.get('subcategory', 'Unknown') for r in reviews)

# Group subcategories by parent category
cat_subcats = {}
for r in reviews:
    cat = r.get('sentimentCategory', 'Unknown')
    subcat = r.get('subcategory', 'Unknown')
    if cat not in cat_subcats:
        cat_subcats[cat] = Counter()
    cat_subcats[cat][subcat] += 1

print("\n" + "="*70)
print("CATEGORY DISTRIBUTION")
print("="*70)
for cat, count in cats.most_common():
    pct = count / len(reviews) * 100
    print(f"\n{cat}: {count:,} ({pct:.1f}%)")
    
    # Show subcategories for this category
    for subcat, scount in cat_subcats[cat].most_common(10):
        spct = scount / count * 100
        print(f"  └─ {subcat}: {scount:,} ({spct:.1f}%)")

print("\n" + "="*70)
print("TOP 30 SUBCATEGORIES (ALL)")
print("="*70)
for subcat, count in subcats.most_common(30):
    pct = count / len(reviews) * 100
    print(f"{subcat}: {count:,} ({pct:.1f}%)")
