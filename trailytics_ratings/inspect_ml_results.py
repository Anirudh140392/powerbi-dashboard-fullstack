"""Inspect ML-enriched reviews to validate classification quality."""
import json

# Load enriched reviews
with open('src/data/reviews_ml_enriched.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

print(f"Total reviews: {len(reviews)}")
print("\n=== Sample Reviews by Category ===\n")

# Get samples from different categories
categories = {}
for r in reviews:
    cat = r.get('sentimentCategory', 'Unknown')
    if cat not in categories:
        categories[cat] = []
    if len(categories[cat]) < 3:
        categories[cat].append(r)

for cat, samples in categories.items():
    print(f"\n{'='*60}")
    print(f"CATEGORY: {cat} (Total: {sum(1 for r in reviews if r.get('sentimentCategory') == cat)})")
    print(f"{'='*60}")
    for r in samples:
        print(f"\nRating: {r.get('rating')} | Sentiment: {r.get('sentiment')} | Subcategory: {r.get('subcategory')}")
        text = r.get('text', '')[:300]
        print(f"Text: {text}...")
        print(f"Reasoning: {r.get('classificationReasoning', 'N/A')}")

# Check for obvious misclassifications
print("\n\n=== VALIDATION CHECK ===")
print("\nReviews in 'General' that might be misclassified:")
general_reviews = [r for r in reviews if r.get('sentimentCategory') == 'General']
for r in general_reviews[:5]:
    text = r.get('text', '').lower()
    # Check if it has clear keywords that should be in other categories
    has_functionality = any(kw in text for kw in ['motor', 'working', 'broken', 'stopped', 'noise', 'leak'])
    has_packaging = any(kw in text for kw in ['delivery', 'damaged', 'box', 'package', 'arrived'])
    has_pricing = any(kw in text for kw in ['price', 'expensive', 'cheap', 'value', 'worth'])
    
    if has_functionality or has_packaging or has_pricing:
        print(f"\n[POTENTIAL MISCLASSIFICATION]")
        print(f"Rating: {r.get('rating')} | Sentiment: {r.get('sentiment')}")
        print(f"Text: {r.get('text', '')[:200]}...")
        print(f"Has functionality keywords: {has_functionality}")
        print(f"Has packaging keywords: {has_packaging}")
        print(f"Has pricing keywords: {has_pricing}")
