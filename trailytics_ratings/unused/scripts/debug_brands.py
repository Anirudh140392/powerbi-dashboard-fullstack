"""Analyze brand detection effectiveness across all 70K reviews."""
import json, sys
from collections import Counter, defaultdict

# Read the actual output
with open('src/data/competitor_reviews.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

print(f"Total reviews: {len(reviews):,}")

# Brand distribution
brand_dist = Counter(r['brand'] for r in reviews)
print(f"\nBrand Distribution:")
for brand, count in brand_dist.most_common(30):
    pct = count / len(reviews) * 100
    print(f"  {brand:20s} {count:6,} ({pct:5.1f}%)")

# How many PIDs have at least SOME reviews with brand detected?
pid_brands = defaultdict(Counter)
for r in reviews:
    pid_brands[r['productId']][r['brand']] += 1

pids_with_brand = sum(1 for pid, brd in pid_brands.items() 
                      if any(b != 'Unknown' for b in brd.keys()))
total_pids = len(pid_brands)
print(f"\nPIDs with any brand detected: {pids_with_brand}/{total_pids} ({pids_with_brand/total_pids*100:.1f}%)")

# Show PIDs where brand was detected from review text
print(f"\nSample PIDs with brand detected:")
count = 0
for pid, brands in pid_brands.items():
    non_unknown = {b: c for b, c in brands.items() if b != 'Unknown'}
    if non_unknown and count < 20:
        total = sum(brands.values())
        detected = sum(non_unknown.values())
        print(f"  {pid:20s} ({total} reviews) brands: {dict(non_unknown)} ({detected/total*100:.0f}% detected)")
        count += 1

# Show 5 reviews where brand IS detected
print(f"\nSample reviews WITH brand:")
shown = 0
for r in reviews:
    if r['brand'] != 'Unknown' and shown < 5:
        print(f"  Brand: {r['brand']} | Text: {r['text'][:100]}")
        shown += 1

# Check how many reviews mention brand names at all
brands_to_check = ['prestige', 'hawkins', 'pigeon', 'butterfly', 'preethi', 
                   'bajaj', 'philips', 'wonderchef', 'bosch', 'panasonic', 
                   'sujata', 'maharaja', 'usha', 'crompton', 'havells',
                   'glen', 'vinod', 'inalsa', 'kenstar', 'morphy']

brand_mentions = Counter()
for r in reviews:
    text = r['text'].lower()
    for b in brands_to_check:
        if b in text:
            brand_mentions[b] += 1

print(f"\nBrand mentions in review TEXT:")
for brand, count in brand_mentions.most_common():
    pct = count / len(reviews) * 100
    print(f"  {brand:15s} {count:5,} ({pct:4.1f}%)")
