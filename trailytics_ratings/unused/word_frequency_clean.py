"""
Clean Word Frequency Analysis - ALL 68,976 reviews
Removes stopwords, special characters, and counts word frequencies.
"""
import json
import re
from collections import Counter

# Load reviews
with open('src/data/reviews_ml_enriched.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

print(f"Analyzing {len(reviews):,} reviews for word frequency...\n")

# Extended stopwords list
STOPWORDS = {
    # Articles, pronouns, prepositions
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
    'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her',
    'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
    'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
    'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with',
    'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over',
    'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
    'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's',
    't', 'can', 'will', 'just', 'don', 'should', 'now', 'd', 'll', 'm', 'o', 're',
    've', 'y', 'ain', 'aren', 'couldn', 'didn', 'doesn', 'hadn', 'hasn', 'haven',
    'isn', 'ma', 'mightn', 'mustn', 'needn', 'shan', 'shouldn', 'wasn', 'weren',
    'won', 'wouldn', 'also', 'get', 'got', 'getting', 'one', 'two', 'first',
    
    # Common but non-actionable words
    'product', 'item', 'thing', 'stuff', 'products', 'items', 'things',
    'good', 'nice', 'great', 'best', 'excellent', 'awesome', 'amazing', 'fantastic',
    'bad', 'worst', 'terrible', 'poor', 'horrible',
    'buy', 'bought', 'purchase', 'purchased', 'order', 'ordered',
    'use', 'used', 'using', 'work', 'works', 'working', 'worked',
    'like', 'liked', 'love', 'loved', 'want', 'wanted', 'need', 'needed',
    'day', 'days', 'week', 'weeks', 'month', 'months', 'year', 'years', 'time',
    'amazon', 'flipkart', 'online', 'seller', 'shop', 'store',
    'thanks', 'thank', 'please', 'sorry', 'hello', 'hi',
    'review', 'reviews', 'rating', 'ratings', 'star', 'stars',
    'really', 'very', 'much', 'even', 'still', 'ever', 'always', 'never',
    'back', 'going', 'came', 'come', 'coming', 'take', 'took', 'taking',
    'way', 'lot', 'bit', 'little', 'big', 'small', 'long', 'short',
    'made', 'make', 'makes', 'making', 'say', 'says', 'said', 'saying',
    'see', 'saw', 'seen', 'seeing', 'look', 'looks', 'looking', 'looked',
    'give', 'gave', 'given', 'giving', 'try', 'tried', 'trying',
    'find', 'found', 'finding', 'keep', 'kept', 'keeping',
    'let', 'put', 'seem', 'seemed', 'seems', 'think', 'thought', 'thinking',
    'tell', 'told', 'telling', 'ask', 'asked', 'asking',
    'show', 'showed', 'shown', 'showing', 'feel', 'felt', 'feeling',
    'know', 'knew', 'known', 'knowing', 'become', 'became', 'becoming',
    'leave', 'left', 'leaving', 'call', 'called', 'calling',
    'anything', 'everything', 'something', 'nothing', 'anyone', 'everyone',
    'someone', 'nobody', 'everybody', 'somebody', 'however', 'although',
    'though', 'whether', 'either', 'neither', 'both', 'already', 'yet',
    'since', 'unless', 'without', 'within', 'along', 'around', 'upon',
    'next', 'last', 'another', 'second', 'third', 'every', 'per', 'each',
}

# Count words
all_words = Counter()
positive_words = Counter()
negative_words = Counter()

for r in reviews:
    text = r.get('text', '').lower()
    # Remove special characters, keep only letters
    text = re.sub(r'[^a-z\s]', ' ', text)
    words = text.split()
    
    # Filter words: min 3 chars, not stopwords
    words = [w for w in words if len(w) >= 3 and w not in STOPWORDS]
    
    all_words.update(words)
    
    rating = r.get('rating', 3)
    if rating >= 4:
        positive_words.update(words)
    elif rating <= 2:
        negative_words.update(words)

# Output results
print("="*70)
print("TOP 150 MOST FREQUENT WORDS (excluding stopwords)")
print("="*70)
print(f"{'Word':<20} {'Total':>8} {'Positive':>8} {'Negative':>8} {'% Neg':>8}")
print("-"*70)

for word, count in all_words.most_common(150):
    pos = positive_words.get(word, 0)
    neg = negative_words.get(word, 0)
    pct_neg = (neg / (pos + neg) * 100) if (pos + neg) > 0 else 0
    sentiment = "🔴" if pct_neg > 60 else "🟢" if pct_neg < 30 else "⚪"
    print(f"{word:<20} {count:>8,} {pos:>8,} {neg:>8,} {pct_neg:>7.1f}% {sentiment}")

# Group by themes
print("\n\n" + "="*70)
print("PRODUCT PARTS (potential subcategories)")
print("="*70)
parts = ['lid', 'handle', 'gasket', 'whistle', 'knob', 'valve', 'body', 'base', 'bottom',
         'burner', 'coil', 'cord', 'wire', 'blade', 'jar', 'pan', 'pot', 'tawa', 'kadai',
         'cooker', 'stove', 'induction', 'mixer', 'grinder', 'kettle', 'rice']
for word in sorted(parts):
    if word in all_words:
        count = all_words[word]
        pos = positive_words.get(word, 0)
        neg = negative_words.get(word, 0)
        pct_neg = (neg / (pos + neg) * 100) if (pos + neg) > 0 else 0
        print(f"  {word:<15} {count:>6,}  ({pct_neg:.0f}% negative)")

print("\n" + "="*70)
print("QUALITY ISSUES (potential subcategories)")
print("="*70)
issues = ['crack', 'cracked', 'broken', 'break', 'leak', 'leaking', 'leakage',
          'rust', 'rusted', 'rusting', 'burn', 'burnt', 'burning', 'overheat',
          'defect', 'defective', 'faulty', 'damage', 'damaged', 'scratch',
          'peel', 'peeling', 'coating', 'nonstick', 'sticky']
for word in sorted(issues):
    if word in all_words:
        count = all_words[word]
        pos = positive_words.get(word, 0)
        neg = negative_words.get(word, 0)
        pct_neg = (neg / (pos + neg) * 100) if (pos + neg) > 0 else 0
        print(f"  {word:<15} {count:>6,}  ({pct_neg:.0f}% negative)")

print("\n" + "="*70)
print("ATTRIBUTES (potential subcategories)")
print("="*70)
attrs = ['size', 'capacity', 'litre', 'liter', 'weight', 'heavy', 'light', 'lightweight',
         'colour', 'color', 'black', 'silver', 'white', 'red', 'steel', 'stainless',
         'aluminium', 'aluminum', 'glass', 'plastic', 'thick', 'thin', 'durable']
for word in sorted(attrs):
    if word in all_words:
        count = all_words[word]
        pos = positive_words.get(word, 0)
        neg = negative_words.get(word, 0)
        pct_neg = (neg / (pos + neg) * 100) if (pos + neg) > 0 else 0
        print(f"  {word:<15} {count:>6,}  ({pct_neg:.0f}% negative)")

print("\n" + "="*70)
print("PERFORMANCE (potential subcategories)")
print("="*70)
perf = ['fast', 'quick', 'slow', 'heat', 'heating', 'heats', 'cook', 'cooks', 'cooking',
        'boil', 'boils', 'boiling', 'pressure', 'temperature', 'flame', 'gas', 'electric',
        'efficient', 'power', 'motor', 'speed', 'rpm', 'watt', 'noise', 'noisy', 'silent', 'quiet']
for word in sorted(perf):
    if word in all_words:
        count = all_words[word]
        pos = positive_words.get(word, 0)
        neg = negative_words.get(word, 0)
        pct_neg = (neg / (pos + neg) * 100) if (pos + neg) > 0 else 0
        print(f"  {word:<15} {count:>6,}  ({pct_neg:.0f}% negative)")

print("\n" + "="*70)
print("SERVICE (potential subcategories)")
print("="*70)
service = ['warranty', 'guarantee', 'service', 'repair', 'replacement', 'refund', 'return',
           'exchange', 'support', 'customer', 'response', 'delivery', 'packaging', 'packing',
           'shipping', 'arrived', 'received', 'missing', 'wrong', 'delayed']
for word in sorted(service):
    if word in all_words:
        count = all_words[word]
        pos = positive_words.get(word, 0)
        neg = negative_words.get(word, 0)
        pct_neg = (neg / (pos + neg) * 100) if (pos + neg) > 0 else 0
        print(f"  {word:<15} {count:>6,}  ({pct_neg:.0f}% negative)")
