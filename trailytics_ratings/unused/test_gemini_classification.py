"""
Test Gemini API with 10 longest reviews - with longer delays to avoid rate limits.
"""
import json
import time

GEMINI_API_KEY = "AIzaSyDpdnRoif3rpflBSqciQUPP3vJ6visqVDU"

OUR_CATEGORIES = {
    "General": ["Overall Satisfaction", "Product Quality", "Recommendation", "Expectations Met", "General Feedback"],
    "Functionality": ["Performance", "Features", "Durability", "Reliability", "Efficiency"],
    "Pricing": ["Value for Money", "Expensive", "Affordable", "Deal Quality", "Worth"],
    "Usability": ["Ease of Use", "Ergonomics", "Learning Curve", "User Experience", "Convenience"],
    "Packaging": ["Delivery Condition", "Missing Parts", "Unboxing Experience", "Protection", "Accessories"],
    "Customer Service": ["Support Response", "Resolution", "Returns", "Warranty Claims", "Service Quality"],
    "Brand Perception": ["Trust", "Reputation", "Loyalty", "Brand Comparison", "Legacy"],
    "Competitor Comparison": ["Direct Mention", "Feature Comparison", "Switch Reason", "Better Than", "Worse Than"]
}

def test_gemini(text: str, product: str, rating: int) -> dict:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        prompt = f"""Analyze this product review and classify it.

Review: "{text[:800]}"
Product: {product}
Rating: {rating}/5

Provide classification in JSON format:
{{
    "main_category": "category name",
    "subcategory": "specific topic",
    "key_points": ["point1", "point2"],
    "sentiment": "positive/negative/neutral",
    "confidence": 0.0-1.0
}}"""
        
        response = model.generate_content(prompt)
        result_text = response.text
        
        if "```" in result_text:
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        
        return json.loads(result_text.strip())
    except Exception as e:
        return {"error": str(e)[:100]}


def main():
    with open('src/data/processed_reviews.json', 'r', encoding='utf-8') as f:
        reviews = json.load(f)
    
    # Get 10 longest reviews
    reviews_sorted = sorted(reviews, key=lambda r: len(r.get('text', '')), reverse=True)
    longest_10 = reviews_sorted[:10]
    
    print(f"Testing 10 longest reviews with Gemini API")
    print(f"Delay: 5 seconds between requests to avoid rate limits")
    print("="*60)
    
    all_results = []
    new_categories = set()
    new_subcategories = set()
    
    for i, review in enumerate(longest_10):
        text = review.get('text', '')
        product = review.get('product', 'Unknown')
        rating = review.get('rating', 3)
        
        print(f"\n[{i+1}/10] Product: {product}")
        print(f"Text ({len(text)} chars): {text[:150]}...")
        
        # Wait 5 seconds between calls
        if i > 0:
            print(f"  Waiting 5 seconds...")
            time.sleep(5)
        
        result = test_gemini(text, product, rating)
        print(f"  Result: {json.dumps(result, indent=2)[:300]}")
        
        if 'error' not in result:
            all_results.append({
                'product': product,
                'rating': rating,
                'text_length': len(text),
                'gemini_result': result
            })
            
            main_cat = result.get('main_category', '')
            if main_cat and main_cat not in OUR_CATEGORIES:
                new_categories.add(main_cat)
                print(f"  ⚠️ NEW CATEGORY: {main_cat}")
            
            subcat = result.get('subcategory', '')
            all_subs = [s for subs in OUR_CATEGORIES.values() for s in subs]
            if subcat and subcat not in all_subs:
                new_subcategories.add(subcat)
                print(f"  ⚠️ NEW SUBCATEGORY: {subcat}")
        else:
            print(f"  ❌ Error: {result['error']}")
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Successful classifications: {len(all_results)}/10")
    print(f"\nNew categories suggested: {list(new_categories) if new_categories else 'None'}")
    print(f"New subcategories suggested: {list(new_subcategories) if new_subcategories else 'None'}")
    
    with open('gemini_test_results.json', 'w', encoding='utf-8') as f:
        json.dump({
            'successful': len(all_results),
            'new_categories': list(new_categories),
            'new_subcategories': list(new_subcategories),
            'results': all_results
        }, f, indent=2)
    
    print(f"\nResults saved to gemini_test_results.json")


if __name__ == "__main__":
    main()
