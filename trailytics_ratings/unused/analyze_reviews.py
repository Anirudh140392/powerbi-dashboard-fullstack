"""Analyze review data patterns to understand classification issues."""
import json
from collections import Counter

# Load reviews
with open('src/data/processed_reviews.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

print(f"Total reviews: {len(reviews)}")
print(f"\n=== TEXT LENGTH ANALYSIS ===")

text_lengths = [len(r.get('text', '')) for r in reviews]
print(f"Min length: {min(text_lengths)}")
print(f"Max length: {max(text_lengths)}")
print(f"Avg length: {sum(text_lengths) / len(text_lengths):.1f}")

# Distribution
empty = sum(1 for l in text_lengths if l == 0)
short = sum(1 for l in text_lengths if 0 < l < 50)
medium = sum(1 for l in text_lengths if 50 <= l < 200)
long_texts = sum(1 for l in text_lengths if l >= 200)

print(f"\nEmpty (0 chars): {empty} ({empty/len(reviews)*100:.1f}%)")
print(f"Short (<50 chars): {short} ({short/len(reviews)*100:.1f}%)")
print(f"Medium (50-200 chars): {medium} ({medium/len(reviews)*100:.1f}%)")
print(f"Long (200+ chars): {long_texts} ({long_texts/len(reviews)*100:.1f}%)")

print(f"\n=== SAMPLE REVIEWS (10 random) ===")
import random
random.seed(42)
samples = random.sample(reviews, 10)
for r in samples:
    text = r.get('text', '')
    rating = r.get('rating', 'N/A')
    sentiment = r.get('sentiment', 'N/A')
    print(f"\nRating: {rating} | Sentiment: {sentiment}")
    print(f"Text ({len(text)} chars): {text[:300]}")

print(f"\n=== KEYWORD FREQUENCY ===")
keywords = ['good', 'bad', 'quality', 'price', 'value', 'delivery', 'packaging', 
            'motor', 'work', 'easy', 'use', 'nice', 'excellent', 'poor', 'broken']
for kw in keywords:
    count = sum(1 for r in reviews if kw.lower() in r.get('text', '').lower())
    pct = count / len(reviews) * 100
    print(f"  '{kw}': {count} ({pct:.1f}%)")
