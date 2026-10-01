"""Analyze why so many reviews fall into General category."""
import json
from collections import Counter

# Load enriched reviews
with open('src/data/reviews_ml_enriched.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

# Get General reviews
general_reviews = [r for r in reviews if r.get('sentimentCategory') == 'General']
other_reviews = [r for r in reviews if r.get('sentimentCategory') != 'General']

print(f"Total reviews: {len(reviews):,}")
print(f"General reviews: {len(general_reviews):,} ({len(general_reviews)/len(reviews)*100:.1f}%)")
print(f"Other reviews: {len(other_reviews):,}")

# Check text lengths
general_lengths = [len(r.get('text', '')) for r in general_reviews]
other_lengths = [len(r.get('text', '')) for r in other_reviews]

print(f"\nAvg text length:")
print(f"  General: {sum(general_lengths)/len(general_lengths):.1f} chars")
print(f"  Other: {sum(other_lengths)/len(other_lengths):.1f} chars")

# Sample of General reviews
print("\n" + "="*70)
print("SAMPLE GENERAL REVIEWS (to understand why they're General)")
print("="*70)
import random
random.seed(42)
sample = random.sample(general_reviews, min(30, len(general_reviews)))

for i, r in enumerate(sample[:20]):
    text = r.get('text', '')[:100]
    subcat = r.get('subcategory', 'Unknown')
    rating = r.get('rating', 0)
    print(f"\n{i+1}. [{rating}★] {subcat}: '{text}'")

# Check subcategory distribution in General
subcats = Counter(r.get('subcategory', '') for r in general_reviews)
print("\n" + "="*70)
print("SUBCATEGORY DISTRIBUTION IN GENERAL")
print("="*70)
for sub, count in subcats.most_common():
    print(f"  {sub}: {count:,} ({count/len(general_reviews)*100:.1f}%)")
