"""
Test newer Gemini models (2.5, 3.0) that have available quota.
"""
import json
import time

GEMINI_API_KEY = "AIzaSyDpdnRoif3rpflBSqciQUPP3vJ6visqVDU"

# Models from the user's rate limit page with available quota
GEMINI_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-flash",
    "gemma-3-12b",
    "gemma-3-27b",
    "gemma-3-4b",
]

def test_model(model_name, text, product, rating):
    """Test a single model."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(model_name)
        
        prompt = f"""Classify this product review into a category and subcategory.

Review: "{text[:500]}"
Product: {product}
Rating: {rating}/5

Return ONLY valid JSON (no markdown):
{{"category": "...", "subcategory": "...", "sentiment": "positive/negative/neutral", "key_points": ["...", "..."]}}"""
        
        response = model.generate_content(prompt)
        result_text = response.text.strip()
        
        # Clean up markdown if present
        if "```" in result_text:
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        result_text = result_text.strip()
        
        return {"status": "success", "result": json.loads(result_text)}
    except json.JSONDecodeError as e:
        return {"status": "json_error", "error": f"Invalid JSON: {str(e)[:50]}", "raw": result_text[:200] if 'result_text' in dir() else "N/A"}
    except Exception as e:
        error_str = str(e)
        if "429" in error_str:
            return {"status": "rate_limited", "error": "429 quota exceeded"}
        elif "404" in error_str or "not found" in error_str.lower():
            return {"status": "not_found", "error": "Model not found"}
        else:
            return {"status": "error", "error": error_str[:150]}


def main():
    # Load sample reviews
    with open('src/data/processed_reviews.json', 'r', encoding='utf-8') as f:
        reviews = json.load(f)
    
    # Get 10 longest reviews
    reviews_sorted = sorted(reviews, key=lambda r: len(r.get('text', '')), reverse=True)
    test_reviews = reviews_sorted[:10]
    
    print("="*70)
    print("TESTING NEWER GEMINI MODELS (2.5, 3.0)")
    print("="*70)
    
    all_results = {}
    
    for model_name in GEMINI_MODELS:
        print(f"\n{'='*70}")
        print(f"MODEL: {model_name}")
        print("="*70)
        
        model_results = []
        success_count = 0
        
        for i, review in enumerate(test_reviews[:3]):  # Test 3 reviews per model
            text = review.get('text', '')
            product = review.get('product', 'Unknown')
            rating = review.get('rating', 3)
            
            print(f"\n  Review {i+1}: {text[:80]}...")
            
            result = test_model(model_name, text, product, rating)
            model_results.append(result)
            
            if result['status'] == 'success':
                success_count += 1
                cat = result['result'].get('category', 'N/A')
                subcat = result['result'].get('subcategory', 'N/A')
                print(f"    ✅ Category: {cat} / {subcat}")
            else:
                print(f"    ❌ {result['status']}: {result.get('error', 'Unknown')[:60]}")
            
            time.sleep(3)  # 3 second delay between requests
        
        all_results[model_name] = {
            'success_rate': f"{success_count}/3",
            'results': model_results
        }
        
        print(f"\n  Success rate: {success_count}/3")
        
        # If model not found, skip to next
        if model_results and model_results[0]['status'] == 'not_found':
            print(f"  Skipping remaining reviews for {model_name}")
            continue
    
    print("\n" + "="*70)
    print("FINAL SUMMARY")
    print("="*70)
    
    for model, data in all_results.items():
        print(f"  {model}: {data['success_rate']}")
    
    # Save results
    with open('gemini_new_models_test.json', 'w', encoding='utf-8') as f:
        json.dump(all_results, f, indent=2)
    
    print(f"\nResults saved to gemini_new_models_test.json")


if __name__ == "__main__":
    main()
