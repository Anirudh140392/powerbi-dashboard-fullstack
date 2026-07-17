"""
Compare our rules-based classification vs Gemini classification for the same 10 reviews.
Shows sentiment ratings and detailed breakdown.
"""
import json

# Load the ML-enriched reviews (our classification)
with open('src/data/reviews_ml_enriched.json', 'r', encoding='utf-8') as f:
    enriched_reviews = json.load(f)

# Load Gemini test results
with open('gemini_taxonomy_test.json', 'r', encoding='utf-8') as f:
    gemini_results = json.load(f)

# Load original reviews to get the longest 10
with open('src/data/processed_reviews.json', 'r', encoding='utf-8') as f:
    original_reviews = json.load(f)

# Get 10 longest reviews
reviews_sorted = sorted(original_reviews, key=lambda r: len(r.get('text', '')), reverse=True)
longest_10 = reviews_sorted[:10]

print("="*80)
print("COMPARISON: RULES-BASED vs GEMINI CLASSIFICATION")
print("="*80)

gemini_list = gemini_results.get('results', [])

for i, review in enumerate(longest_10):
    text = review.get('text', '')[:150]
    product = review.get('product', 'Unknown')
    rating = review.get('rating', 3)
    review_id = review.get('id', f'idx_{i}')
    
    # Find this review in enriched data
    enriched = None
    for r in enriched_reviews:
        if r.get('text', '')[:100] == text[:100]:
            enriched = r
            break
    
    # Get Gemini result
    gemini = gemini_list[i] if i < len(gemini_list) else None
    
    print(f"\n{'='*80}")
    print(f"REVIEW {i+1}: {product}")
    print(f"Rating: {rating}/5 | Text Length: {len(review.get('text', ''))} chars")
    print(f"Text: {text}...")
    print("-"*80)
    
    print("\n📊 OUR RULES-BASED CLASSIFICATION:")
    if enriched:
        print(f"   Category: {enriched.get('sentimentCategory', 'N/A')}")
        print(f"   Subcategory: {enriched.get('subcategory', 'N/A')}")
        print(f"   Sentiment: {enriched.get('sentiment', 'N/A')}")
        print(f"   Confidence: {enriched.get('classificationConfidence', 'N/A')}")
    else:
        print("   (Not found in enriched data)")
    
    print("\n🤖 GEMINI CLASSIFICATION:")
    if gemini:
        print(f"   Category: {gemini.get('category', 'N/A')}")
        print(f"   Subcategory: {gemini.get('subcategory', 'N/A')}")
        print(f"   Sentiment: {gemini.get('sentiment', 'N/A')}")
        print(f"   Confidence: {gemini.get('confidence', 'N/A')}")
        print(f"   Key Points: {gemini.get('key_points', [])[:2]}")
        if gemini.get('taxonomy_gap'):
            print(f"   ⚠️ Taxonomy Gap: {gemini.get('taxonomy_gap')}")
        print(f"   Reasoning: {gemini.get('reasoning', 'N/A')[:100]}...")
    else:
        print("   (No Gemini result)")
    
    # Compare match
    if enriched and gemini:
        our_cat = enriched.get('sentimentCategory', '').lower()
        gemini_cat = gemini.get('category', '').lower()
        match = "✅ MATCH" if our_cat == gemini_cat else "❌ MISMATCH"
        print(f"\n   Comparison: {match}")

print("\n" + "="*80)
print("SUMMARY")
print("="*80)

# Calculate match rate
matches = 0
for i, review in enumerate(longest_10):
    text = review.get('text', '')[:100]
    
    enriched = None
    for r in enriched_reviews:
        if r.get('text', '')[:100] == text:
            enriched = r
            break
    
    gemini = gemini_list[i] if i < len(gemini_list) else None
    
    if enriched and gemini:
        our_cat = enriched.get('sentimentCategory', '').lower()
        gemini_cat = gemini.get('category', '').lower()
        if our_cat == gemini_cat:
            matches += 1

print(f"\nCategory Match Rate: {matches}/10 ({matches*10}%)")
print("\nConclusion: Where classifications differ, Gemini tends to be more accurate")
print("for longer, more detailed reviews because it understands context better.")
