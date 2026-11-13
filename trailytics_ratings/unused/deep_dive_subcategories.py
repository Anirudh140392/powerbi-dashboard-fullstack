"""
Deep dive into review content for each top subcategory to find patterns.
"""
import json
import random
import re
from collections import Counter

with open('src/data/reviews_ml_enriched.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

# Group by subcategory
by_subcat = {}
for r in reviews:
    subcat = r.get('subcategory', 'Unknown')
    if subcat not in by_subcat:
        by_subcat[subcat] = []
    by_subcat[subcat].append(r)

random.seed(42)

def analyze_subcategory(name, sample_size=30):
    if name not in by_subcat:
        print(f"\n{name}: NOT FOUND")
        return
    
    reviews_list = by_subcat[name]
    print(f"\n{'='*70}")
    print(f"{name}: {len(reviews_list):,} reviews")
    print(f"{'='*70}")
    
    # Sample reviews
    sample = random.sample(reviews_list, min(sample_size, len(reviews_list)))
    
    # Show samples grouped by rating
    positive = [r for r in sample if r.get('rating', 0) >= 4]
    negative = [r for r in sample if r.get('rating', 0) <= 2]
    neutral = [r for r in sample if 2 < r.get('rating', 0) < 4]
    
    print("\n--- POSITIVE (4-5 stars) ---")
    for r in positive[:10]:
        print(f"  [{r.get('rating')}★] {r.get('text', '')[:100]}")
    
    print("\n--- NEGATIVE (1-2 stars) ---")
    for r in negative[:10]:
        print(f"  [{r.get('rating')}★] {r.get('text', '')[:100]}")
    
    # Find common words
    all_words = Counter()
    for r in reviews_list:
        text = r.get('text', '').lower()
        words = re.findall(r'\b[a-z]{4,}\b', text)
        all_words.update(words)
    
    stopwords = {'this', 'that', 'with', 'from', 'have', 'been', 'were', 'they', 'very', 'really', 'just', 'also', 'product', 'good', 'nice', 'best', 'excellent'}
    print("\n--- TOP WORDS ---")
    for word, count in all_words.most_common(20):
        if word not in stopwords and count > 50:
            print(f"  {word}: {count}")

# Analyze top subcategories
analyze_subcategory('Overall_Quality')
analyze_subcategory('Satisfaction')
analyze_subcategory('General_Feedback')
analyze_subcategory('Value_for_Money')
analyze_subcategory('Cooking_Performance')
