"""
Word Frequency Matrix Analysis
Identify high-frequency words that should be in ML dictionary vs noise words.
"""
import json
import re
from collections import Counter

# Load all reviews
with open('src/data/reviews_ml_enriched.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

print(f"Analyzing {len(reviews):,} reviews...")

# Common stopwords that don't add value
STOPWORDS = {
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
    'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
    'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
    'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
    'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
    'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'also', 've', 'd', 'll', 'm',
    're', 'would', 'could', 'n', 'got', 'get', 'getting', 'one', 'two', 'using', 'used',
    'use', 'like', 'much', 'even', 'really', 'first', 'well', 'still', 'every', 'since',
    'went', 'came', 'come', 'coming', 'ive', 'im', 'thats', 'dont', 'cant', 'wont',
    'its', 'bit', 'time', 'times', 'day', 'days', 'month', 'week', 'bought', 'buy',
    'buying', 'purchased', 'purchase', 'ordering', 'ordered', 'order', 'received'
}

# Count all words
all_words = Counter()
general_words = Counter()  # Words from General category reviews

for r in reviews:
    text = r.get('text', '').lower()
    # Extract words (alphanumeric only)
    words = re.findall(r'\b[a-z]{3,}\b', text)  # min 3 chars
    words = [w for w in words if w not in STOPWORDS]
    
    all_words.update(words)
    
    if r.get('sentimentCategory') == 'General':
        general_words.update(words)

print("\n" + "="*70)
print("TOP 100 MOST FREQUENT WORDS (ALL REVIEWS)")
print("="*70)
print("Word                Freq    In General?  Actionable?")
print("-"*70)

# Get words that are in dictionary already from learned_keywords.json
try:
    with open('ml_pipeline/learned_keywords.json', 'r', encoding='utf-8') as f:
        learned = json.load(f)
        existing_keywords = set()
        for cat_keywords in learned.get('LEARNED_KEYWORDS', {}).values():
            for subcat_keywords in cat_keywords.values():
                for kw in subcat_keywords:
                    for word in kw.lower().split():
                        existing_keywords.add(word)
except:
    existing_keywords = set()

# Also add hardcoded keywords from taxonomy
taxonomy_keywords = [
    'quality', 'build', 'sturdy', 'flimsy', 'durable', 'reliable', 'broke', 'broken',
    'cooking', 'heats', 'heating', 'boils', 'fast', 'slow', 'efficient', 'motor', 'power',
    'easy', 'clean', 'handle', 'grip', 'size', 'capacity', 'design', 'heavy', 'light',
    'value', 'money', 'price', 'worth', 'expensive', 'cheap', 'affordable',
    'delivery', 'delivered', 'packaging', 'damaged', 'arrived',
    'customer', 'service', 'support', 'refund', 'return', 'warranty',
    'shock', 'electric', 'safe', 'unsafe', 'dangerous',
    'accessories', 'missing', 'included', 'jar', 'blade', 'lid',
    'prestige', 'brand', 'trust', 'recommend', 'satisfied', 'happy'
]
existing_keywords.update(taxonomy_keywords)

for word, count in all_words.most_common(100):
    in_general_pct = general_words.get(word, 0) / count * 100 if count > 0 else 0
    in_dict = "✓" if word in existing_keywords else ""
    
    # Heuristic: if word appears mostly in General (>50%), it might need to be added to specific category
    flag = ""
    if in_general_pct > 40 and word not in existing_keywords and count > 500:
        flag = "⚠️ ADD TO DICT"
    elif in_general_pct < 20 and word not in existing_keywords and count > 300:
        flag = "✅ WORKS"
    
    print(f"{word:20} {count:6,}   ({in_general_pct:4.1f}% gen)  {in_dict:3} {flag}")

print("\n" + "="*70)
print("WORDS THAT SHOULD BE ADDED TO DICTIONARY (high freq + high general%)")
print("="*70)

candidates = []
for word, count in all_words.most_common(500):
    in_general_pct = general_words.get(word, 0) / count * 100 if count > 0 else 0
    
    if word not in existing_keywords and count > 300 and in_general_pct > 35:
        candidates.append((word, count, in_general_pct))

print(f"\n{len(candidates)} candidates found:\n")
for word, count, gen_pct in sorted(candidates, key=lambda x: -x[1])[:50]:
    print(f"  '{word}': {count:,} occurrences, {gen_pct:.1f}% in General")

# Categorize candidates by likely category
print("\n" + "="*70)
print("SUGGESTED CATEGORY ASSIGNMENTS")
print("="*70)

# Quality indicators
quality_words = ['nice', 'best', 'excellent', 'super', 'perfect', 'amazing', 'great', 
                 'bad', 'worst', 'poor', 'terrible', 'horrible', 'awesome', 'wonderful',
                 'superb', 'fantastic', 'brilliant']

# Performance indicators  
performance_words = ['works', 'working', 'work', 'heat', 'hot', 'cook', 'cooked',
                    'boil', 'boiled', 'whistle']

# Usability indicators
usability_words = ['easy', 'clean', 'heavy', 'light', 'handle', 'grip', 'size']

print("\nFor QUALITY category:")
for word, count, _ in candidates:
    if word in quality_words or any(q in word for q in ['good', 'bad', 'quality', 'nice', 'best']):
        print(f"  - '{word}': {count:,}")

print("\nFor PERFORMANCE category:")
for word, count, _ in candidates:
    if word in performance_words or any(p in word for p in ['work', 'heat', 'cook', 'boil']):
        print(f"  - '{word}': {count:,}")

print("\nFor USABILITY category:")
for word, count, _ in candidates:
    if word in usability_words or any(u in word for u in ['easy', 'clean', 'size', 'heavy']):
        print(f"  - '{word}': {count:,}")
