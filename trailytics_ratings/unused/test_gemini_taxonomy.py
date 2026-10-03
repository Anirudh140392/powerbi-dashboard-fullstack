"""
Test Gemini with OUR category taxonomy for REVIEW classification.
Ask Gemini to validate if categories are sufficient or suggest new ones.
"""
import json
import time

GEMINI_API_KEY = "AIzaSyDpdnRoif3rpflBSqciQUPP3vJ6visqVDU"

# Our taxonomy for REVIEW classification (not product classification)
OUR_TAXONOMY = """
REVIEW CATEGORIES (what aspect of the product experience is being discussed):

1. General - Generic satisfaction feedback
   Subcategories: Overall Satisfaction, Product Quality, Recommendation, Expectations Met, General Feedback

2. Functionality - Product performance, features, durability
   Subcategories: Performance, Features, Durability, Reliability, Efficiency

3. Pricing - Value perception, cost, deals
   Subcategories: Value for Money, Expensive, Affordable, Deal Quality, Worth

4. Usability - Ease of use, ergonomics, user experience
   Subcategories: Ease of Use, Ergonomics, Learning Curve, User Experience, Convenience

5. Packaging - Delivery, packaging, unboxing, missing parts
   Subcategories: Delivery Condition, Missing Parts, Unboxing Experience, Protection, Accessories

6. Customer Service - Support, warranty, returns
   Subcategories: Support Response, Resolution, Returns, Warranty Claims, Service Quality

7. Brand Perception - Brand trust, reputation, loyalty
   Subcategories: Trust, Reputation, Loyalty, Brand Comparison, Legacy

8. Competitor Comparison - Direct comparison with other brands
   Subcategories: Direct Mention, Feature Comparison, Switch Reason, Better Than, Worse Than
"""

def classify_with_taxonomy(text, product, rating):
    """Ask Gemini to classify using our taxonomy."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = f"""You are classifying a CUSTOMER REVIEW to understand what aspect of the product experience the customer is discussing.

{OUR_TAXONOMY}

REVIEW TO CLASSIFY:
Product: {product}
Rating: {rating}/5
Review Text: "{text[:800]}"

TASK:
1. Classify this review into ONE of the 8 categories above
2. Select the most appropriate subcategory
3. If the review discusses aspects NOT covered by our taxonomy, suggest a new category

Return JSON:
{{
    "category": "one of the 8 categories above",
    "subcategory": "one of the subcategories",
    "confidence": 0.0-1.0,
    "sentiment": "positive/negative/neutral",
    "key_points": ["main point 1", "main point 2"],
    "taxonomy_gap": null or "suggested new category if needed",
    "reasoning": "brief explanation of classification"
}}"""
        
        response = model.generate_content(prompt)
        result_text = response.text.strip()
        
        if "```" in result_text:
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        
        return {"status": "success", "result": json.loads(result_text.strip())}
    except Exception as e:
        return {"status": "error", "error": str(e)[:150]}


def main():
    with open('src/data/processed_reviews.json', 'r', encoding='utf-8') as f:
        reviews = json.load(f)
    
    # Get 10 longest reviews for testing
    reviews_sorted = sorted(reviews, key=lambda r: len(r.get('text', '')), reverse=True)
    test_reviews = reviews_sorted[:10]
    
    print("="*70)
    print("TESTING GEMINI WITH OUR REVIEW TAXONOMY")
    print("="*70)
    
    results = []
    taxonomy_gaps = set()
    category_counts = {}
    
    for i, review in enumerate(test_reviews):
        text = review.get('text', '')
        product = review.get('product', 'Unknown')
        rating = review.get('rating', 3)
        
        print(f"\n[{i+1}/10] {product} (Rating: {rating})")
        print(f"Text: {text[:120]}...")
        
        if i > 0:
            time.sleep(3)
        
        result = classify_with_taxonomy(text, product, rating)
        
        if result['status'] == 'success':
            r = result['result']
            cat = r.get('category', 'Unknown')
            subcat = r.get('subcategory', 'N/A')
            gap = r.get('taxonomy_gap')
            reasoning = r.get('reasoning', 'N/A')[:80]
            
            print(f"  ✅ Category: {cat} / {subcat}")
            print(f"     Confidence: {r.get('confidence', 'N/A')}")
            print(f"     Reasoning: {reasoning}...")
            
            if gap:
                if isinstance(gap, list):
                    gap = ', '.join(str(g) for g in gap)
                taxonomy_gaps.add(gap)
                print(f"  ⚠️ TAXONOMY GAP: {gap}")
            
            category_counts[cat] = category_counts.get(cat, 0) + 1
            results.append(r)
        else:
            print(f"  ❌ Error: {result.get('error', 'Unknown')[:80]}")
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    
    print(f"\nSuccessful: {len(results)}/10")
    print(f"\nCategory Distribution:")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")
    
    print(f"\nTaxonomy Gaps Identified:")
    if taxonomy_gaps:
        for gap in taxonomy_gaps:
            print(f"  - {gap}")
    else:
        print("  None - our taxonomy covers all aspects!")
    
    with open('gemini_taxonomy_test.json', 'w', encoding='utf-8') as f:
        json.dump({
            'successful': len(results),
            'category_counts': category_counts,
            'taxonomy_gaps': list(taxonomy_gaps),
            'results': results
        }, f, indent=2)
    
    print(f"\nResults saved to gemini_taxonomy_test.json")


if __name__ == "__main__":
    main()
