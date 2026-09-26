"""Analyze which words in Overall_Quality are matching most reviews."""
import json
import re
from collections import Counter

# Load reviews
with open('src/data/reviews_ml_enriched.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

# Get Overall_Quality reviews
oq_reviews = [r for r in reviews if r.get('subcategory') == 'Overall_Quality']

print(f"Total reviews: {len(reviews):,}")
print(f"Overall_Quality reviews: {len(oq_reviews):,} ({len(oq_reviews)/len(reviews)*100:.1f}%)")

# Overall_Quality keywords from classifier
overall_quality_keywords = [
    "good product", "nice product", "excellent product", "best product", "quality", 
    "superb", "awesome", "amazing", "fantastic", "wonderful", "great product",
    "bad product", "worst product", "poor quality", "low quality", "high quality",
    "good quality", "poor product", "terrible product", "pathetic", "useless product",
    "terrific", "fabulous", "classy", "pretty good", "decent", "decent product",
    "mind blowing", "blowing", "wow", "highly recommend", "highly",
    "best in market", "market", "just wow", "fair", "job done", "does the job",
    "super", "super product", "brilliant", "brilliant product", "choice", "good choice",
    "must have", "must", "useful", "delightful"
]

# Count which keywords match
keyword_counts = Counter()

for r in oq_reviews:
    text = r.get('text', '').lower()
    for kw in overall_quality_keywords:
        if kw in text:
            keyword_counts[kw] += 1

print("\n" + "="*70)
print("KEYWORD MATCH COUNTS IN OVERALL_QUALITY")
print("="*70)
for kw, count in keyword_counts.most_common():
    pct = count / len(oq_reviews) * 100
    print(f"  '{kw}': {count:,} matches ({pct:.1f}%)")

# Check text length distribution
print("\n" + "="*70)
print("TEXT LENGTH DISTRIBUTION (Overall_Quality)")
print("="*70)
lengths = [len(r.get('text', '')) for r in oq_reviews]
print(f"  Min: {min(lengths)}")
print(f"  Max: {max(lengths)}")
print(f"  Avg: {sum(lengths)/len(lengths):.1f}")
print(f"  Median: {sorted(lengths)[len(lengths)//2]}")

# Sample very short ones
print("\n" + "="*70)
print("SAMPLE VERY SHORT OVERALL_QUALITY REVIEWS (<30 chars)")
print("="*70)
short_reviews = [r for r in oq_reviews if len(r.get('text', '')) < 30]
print(f"Short reviews (<30 chars): {len(short_reviews):,}")
import random
random.seed(42)
for r in random.sample(short_reviews, min(20, len(short_reviews))):
    print(f"  '{r.get('text', '')}'")
