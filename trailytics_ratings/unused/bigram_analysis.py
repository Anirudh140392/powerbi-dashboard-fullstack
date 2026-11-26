"""
Bigram Analysis - Output to file for clean reading
"""
import json
import re
from collections import Counter, defaultdict

with open('src/data/reviews_ml_enriched.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

# Count what comes BEFORE and AFTER key issue words
issue_words = ['broken', 'damaged', 'defective', 'faulty', 'cracked', 'leaking', 'missing', 'peeling', 'rusted']
before_issue = defaultdict(Counter)
after_issue = defaultdict(Counter)

# All bigrams
all_bigrams = Counter()

# Competitor mentions
competitor_brands = ['butterfly', 'pigeon', 'philips', 'bajaj', 'hawkins', 'preethi', 
                     'morphy', 'wonderchef', 'bosch', 'panasonic', 'samsung',
                     'havells', 'usha', 'sujata', 'maharaja', 'crompton', 'orient', 'vinod']
competitor_mentions = Counter()
competitor_context = []

STOPWORDS = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its', 'i', 'my', 'we', 'our',
             'this', 'that', 'and', 'but', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'at', 'by', 'from',
             'not', 'no', 'so', 'very', 'too', 'just', 'also', 'have', 'has', 'had', 'do', 'does', 'did',
             'will', 'would', 'could', 'should', 'can', 'may', 'might', 'as', 'if', 'when', 'than', 'then',
             'product', 'products', 'item', 'items'}

for r in reviews:
    text = r.get('text', '').lower()
    rating = r.get('rating', 3)
    text = re.sub(r'[^a-z\s]', ' ', text)
    words = text.split()
    words = [w for w in words if len(w) >= 2]
    
    # Create bigrams
    for i in range(len(words) - 1):
        w1, w2 = words[i], words[i+1]
        if w1 not in STOPWORDS and w2 not in STOPWORDS:
            all_bigrams[(w1, w2)] += 1
        
        # What is broken/damaged/faulty?
        for issue in issue_words:
            if w2 == issue and w1 not in STOPWORDS and len(w1) > 2:
                before_issue[issue][w1] += 1
            if w1 == issue and w2 not in STOPWORDS and len(w2) > 2:
                after_issue[issue][w2] += 1
    
    # Competitor mentions
    for comp in competitor_brands:
        if comp in text:
            competitor_mentions[comp] += 1
            if len(competitor_context) < 30:
                clean_text = ''.join(c if ord(c) < 128 else '' for c in r.get('text', '')[:120])
                competitor_context.append((comp, rating, clean_text))

# Write to file
with open('bigram_analysis_results.txt', 'w', encoding='utf-8') as f:
    f.write("="*70 + "\n")
    f.write("WHAT IS BROKEN / DAMAGED / FAULTY / MISSING?\n")
    f.write("="*70 + "\n\n")
    
    for issue in issue_words:
        f.write(f"\n{issue.upper()}:\n")
        f.write(f"  What is {issue}? (before word): ")
        f.write(", ".join([f"{w}({c})" for w, c in before_issue[issue].most_common(12)]) + "\n")
        f.write(f"  {issue} what? (after word): ")
        f.write(", ".join([f"{w}({c})" for w, c in after_issue[issue].most_common(12)]) + "\n")
    
    f.write("\n\n" + "="*70 + "\n")
    f.write("COMPETITOR MENTIONS\n")
    f.write("="*70 + "\n\n")
    for comp, count in competitor_mentions.most_common(20):
        f.write(f"  {comp}: {count}\n")
    
    f.write("\nSample competitor reviews:\n")
    for comp, rating, text in competitor_context[:15]:
        f.write(f"  [{rating}] [{comp}] {text}\n")
    
    # Product characteristics bigrams
    f.write("\n\n" + "="*70 + "\n")
    f.write("PRODUCT PART BIGRAMS\n")
    f.write("="*70 + "\n\n")
    
    parts = ['lid', 'handle', 'gasket', 'whistle', 'knob', 'valve', 'body', 'base',
             'burner', 'coil', 'cord', 'blade', 'jar', 'coating', 'glass', 'steel', 'motor']
    
    for part in parts:
        related = []
        for (w1, w2), c in all_bigrams.items():
            if w1 == part or w2 == part:
                other = w2 if w1 == part else w1
                if other not in STOPWORDS and c > 20:
                    related.append((other, c))
        related = sorted(related, key=lambda x: -x[1])[:10]
        if related:
            f.write(f"{part.upper()}: " + ", ".join([f"{w}({c})" for w, c in related]) + "\n")
    
    # Delivery patterns
    f.write("\n\n" + "="*70 + "\n")
    f.write("DELIVERY PATTERNS\n")
    f.write("="*70 + "\n\n")
    
    for kw in ['delivery', 'packaging', 'packing', 'shipped', 'received']:
        related = []
        for (w1, w2), c in all_bigrams.items():
            if w1 == kw or w2 == kw:
                other = w2 if w1 == kw else w1
                if other not in STOPWORDS and c > 15:
                    related.append((other, c))
        related = sorted(related, key=lambda x: -x[1])[:8]
        if related:
            f.write(f"{kw}: " + ", ".join([f"{w}({c})" for w, c in related]) + "\n")
    
    # Value patterns
    f.write("\n\n" + "="*70 + "\n")
    f.write("VALUE PATTERNS\n")
    f.write("="*70 + "\n\n")
    
    for kw in ['price', 'money', 'worth', 'value', 'expensive', 'cheap', 'affordable']:
        related = []
        for (w1, w2), c in all_bigrams.items():
            if w1 == kw or w2 == kw:
                other = w2 if w1 == kw else w1
                if other not in STOPWORDS and c > 10:
                    related.append((other, c))
        related = sorted(related, key=lambda x: -x[1])[:8]
        if related:
            f.write(f"{kw}: " + ", ".join([f"{w}({c})" for w, c in related]) + "\n")
    
    # Usability patterns
    f.write("\n\n" + "="*70 + "\n")
    f.write("USABILITY PATTERNS\n")
    f.write("="*70 + "\n\n")
    
    for kw in ['easy', 'clean', 'cleaning', 'use', 'heavy', 'light', 'size', 'capacity', 'fits']:
        related = []
        for (w1, w2), c in all_bigrams.items():
            if w1 == kw or w2 == kw:
                other = w2 if w1 == kw else w1
                if other not in STOPWORDS and c > 15:
                    related.append((other, c))
        related = sorted(related, key=lambda x: -x[1])[:8]
        if related:
            f.write(f"{kw}: " + ", ".join([f"{w}({c})" for w, c in related]) + "\n")
    
    # Performance patterns
    f.write("\n\n" + "="*70 + "\n")
    f.write("PERFORMANCE PATTERNS\n")
    f.write("="*70 + "\n\n")
    
    for kw in ['fast', 'slow', 'heat', 'heating', 'cooking', 'works', 'working', 'performance']:
        related = []
        for (w1, w2), c in all_bigrams.items():
            if w1 == kw or w2 == kw:
                other = w2 if w1 == kw else w1
                if other not in STOPWORDS and c > 15:
                    related.append((other, c))
        related = sorted(related, key=lambda x: -x[1])[:8]
        if related:
            f.write(f"{kw}: " + ", ".join([f"{w}({c})" for w, c in related]) + "\n")
    
    # Features patterns
    f.write("\n\n" + "="*70 + "\n")
    f.write("FEATURES PATTERNS\n")
    f.write("="*70 + "\n\n")
    
    for kw in ['feature', 'features', 'auto', 'ignition', 'timer', 'temperature', 'setting', 'induction']:
        related = []
        for (w1, w2), c in all_bigrams.items():
            if w1 == kw or w2 == kw:
                other = w2 if w1 == kw else w1
                if other not in STOPWORDS and c > 8:
                    related.append((other, c))
        related = sorted(related, key=lambda x: -x[1])[:8]
        if related:
            f.write(f"{kw}: " + ", ".join([f"{w}({c})" for w, c in related]) + "\n")

print("Results written to bigram_analysis_results.txt")
