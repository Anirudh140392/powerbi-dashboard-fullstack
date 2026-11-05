import json
import re
from collections import Counter
import random

with open('src/data/reviews_ml_enriched.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

general_reviews = [r for r in reviews if r.get('sentimentCategory') == 'General']
print(f'Total General reviews: {len(general_reviews)}')

# Sample short reviews to see patterns
random.seed(42)
short = [r for r in general_reviews if len(r.get('text', '')) < 50]
print(f'\nSampling {min(50, len(short))} short General reviews:')
for r in random.sample(short, min(50, len(short))):
    rating = r.get('rating', 0)
    text = r.get('text', '')[:80]
    print(f'  [{rating}] {text}')

# Also check for Usability words
print('\n\nUsability-related words in General:')
all_words = Counter()
for r in general_reviews:
    text = r.get('text', '').lower()
    words = re.findall(r'\b[a-z]{3,}\b', text)
    all_words.update(words)

usability_words = ['simple', 'beautiful', 'attractive', 'kitchen', 'use', 'using', 'used', 'easy', 'convenient']
for word in usability_words:
    count = all_words.get(word, 0)
    if count > 30:
        print(f'  {word}: {count}')
