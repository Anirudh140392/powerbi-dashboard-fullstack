"""
Analyze General category reviews to find patterns for better categorization.
"""
import json
import re
from collections import Counter

# Load enriched reviews
with open('src/data/reviews_ml_enriched.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

# Get General reviews
general_reviews = [r for r in reviews if r.get('sentimentCategory') == 'General']
print(f"Total General reviews: {len(general_reviews):,}")

# Extract all words from General reviews
all_words = Counter()
bigrams = Counter()
trigrams = Counter()

for r in general_reviews:
    text = r.get('text', '').lower()
    words = re.findall(r'\b[a-z]{3,}\b', text)
    all_words.update(words)
    
    # Bigrams
    for i in range(len(words)-1):
        bigrams[f"{words[i]} {words[i+1]}"] += 1
    
    # Trigrams
    for i in range(len(words)-2):
        trigrams[f"{words[i]} {words[i+1]} {words[i+2]}"] += 1

# Common stopwords to filter
stopwords = {'the', 'and', 'for', 'with', 'this', 'that', 'its', 'was', 'are', 'has', 'have', 'had',
             'very', 'really', 'just', 'also', 'but', 'not', 'all', 'can', 'will', 'more', 'than',
             'from', 'been', 'they', 'them', 'their', 'what', 'which', 'who', 'when', 'where', 'how',
             'one', 'two', 'three', 'only', 'other', 'some', 'any', 'each', 'after', 'before', 'than'}

print("\n" + "="*70)
print("TOP PHRASES IN GENERAL REVIEWS (Bigrams/Trigrams)")
print("="*70)
print("\nMost common bigrams (phrases):")
for phrase, count in bigrams.most_common(50):
    if not any(w in stopwords for w in phrase.split()):
        print(f"  '{phrase}': {count}")

print("\nMost common trigrams (3-word phrases):")
for phrase, count in trigrams.most_common(50):
    words = phrase.split()
    if not all(w in stopwords for w in words):
        print(f"  '{phrase}': {count}")

# Sample reviews by length buckets
print("\n" + "="*70)
print("SAMPLE GENERAL REVIEWS BY LENGTH")
print("="*70)

short = [r for r in general_reviews if len(r.get('text', '')) < 30]
medium = [r for r in general_reviews if 30 <= len(r.get('text', '')) < 100]
long = [r for r in general_reviews if len(r.get('text', '')) >= 100]

import random
random.seed(42)

print(f"\n--- SHORT REVIEWS (<30 chars): {len(short):,} ---")
for r in random.sample(short, min(30, len(short))):
    print(f"  [{r.get('rating')}★] '{r.get('text', '')}'")

print(f"\n--- MEDIUM REVIEWS (30-100 chars): {len(medium):,} ---")
for r in random.sample(medium, min(30, len(medium))):
    print(f"  [{r.get('rating')}★] '{r.get('text', '')}'")

print(f"\n--- LONG REVIEWS (>100 chars): {len(long):,} ---")
for r in random.sample(long, min(20, len(long))):
    print(f"  [{r.get('rating')}★] '{r.get('text', '')[:150]}...'")

# Look for product-specific words
print("\n" + "="*70)
print("PRODUCT-SPECIFIC WORDS IN GENERAL REVIEWS")
print("="*70)

product_indicators = {
    'Performance': ['heats', 'heating', 'cooks', 'cooking', 'boils', 'boiling', 'grinds', 'grinding', 'chops', 'blend', 'mixing'],
    'Usability': ['easy', 'handle', 'size', 'clean', 'heavy', 'light', 'grip', 'design', 'compact'],
    'Quality': ['broke', 'broken', 'lasted', 'durable', 'sturdy', 'flimsy', 'solid'],
    'Value': ['price', 'worth', 'money', 'expensive', 'cheap', 'affordable', 'value'],
    'Delivery': ['delivery', 'delivered', 'packaging', 'packed', 'arrived', 'shipped'],
    'Safety': ['shock', 'burn', 'dangerous', 'safe', 'unsafe']
}

for category, indicators in product_indicators.items():
    found = []
    for word in indicators:
        count = all_words.get(word, 0)
        if count > 0:
            found.append(f"{word}({count})")
    if found:
        print(f"\n{category}: {', '.join(found)}")
