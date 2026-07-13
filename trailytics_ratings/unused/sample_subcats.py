"""Show sample reviews from each subcategory - with encoding fix"""
import json
import random

with open('src/data/reviews_ml_enriched.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

by_subcat = {}
for r in reviews:
    subcat = r.get('subcategory', 'Unknown')
    if subcat not in by_subcat:
        by_subcat[subcat] = []
    by_subcat[subcat].append(r)

random.seed(42)

with open('subcategory_samples.txt', 'w', encoding='utf-8') as out:
    def show_samples(name, n=20):
        if name not in by_subcat:
            return
        out.write(f"\n{'='*60}\n")
        out.write(f"{name}: {len(by_subcat[name]):,} reviews\n")
        out.write('='*60 + '\n')
        
        sample = random.sample(by_subcat[name], min(n, len(by_subcat[name])))
        for r in sample:
            rating = r.get('rating', 0)
            # Clean text - remove non-ascii
            text = r.get('text', '')[:150]
            text = ''.join(c if ord(c) < 128 else '?' for c in text)
            text = text.replace('\n', ' ').strip()
            out.write(f"[{rating}] {text}\n")

    show_samples('Overall_Quality', 25)
    out.write("\n\n")
    show_samples('Satisfaction', 25)
    out.write("\n\n")
    show_samples('Cooking_Performance', 20)
    out.write("\n\n")
    show_samples('General_Feedback', 20)
    out.write("\n\n")
    show_samples('Value_for_Money', 20)

print("Samples written to subcategory_samples.txt")
