"""
Use Gemini API to analyze sample reviews and extract:
- Category & Subcategory classifications
- Sentiment rating (1-5)
- Good/Bad/Neutral classification
- Dictionary keywords for each category

This will be used to train/improve the rules-based ML classifier.
Rate limited to respect Gemini API quotas.
"""
import json
import time
import random
from collections import defaultdict
from typing import Dict, List, Optional

GEMINI_API_KEY = "AIzaSyAo1IFP-b3lfEg572HI0z3xDn-o3ZjdXss"
GEMINI_MODEL = "gemini-2.5-flash-lite"

# Rate limiting settings (conservative to avoid 429 errors)
DELAY_BETWEEN_REQUESTS = 20  # 20 seconds = 3 requests/minute (staying under 5 RPM limit)
MAX_RETRIES = 3
BATCH_SIZE = 50  # Reduced batch size for safety

def analyze_review_with_gemini(text: str, product: str, rating: int, retry_count: int = 0) -> Optional[Dict]:
    """Ask Gemini to analyze a review and extract classification + keywords."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        
        prompt = f"""Analyze this customer product review and provide detailed classification.

REVIEW:
Product: {product}
Rating: {rating}/5
Text: "{text[:1000]}"

TASK: Classify this review and extract the keywords that indicate this classification.

Return ONLY valid JSON (no markdown):
{{
    "category": "main aspect being discussed (e.g., Functionality, Pricing, Usability, Packaging, Customer Service, Brand, Competitor, General)",
    "subcategory": "specific aspect within category",
    "sentiment": "positive/negative/neutral/mixed",
    "sentiment_score": 1-5 (1=very negative, 3=neutral, 5=very positive),
    "keywords": ["list", "of", "keywords", "that", "indicate", "this", "category"],
    "good_indicators": ["words", "phrases", "indicating", "positive", "feedback"],
    "bad_indicators": ["words", "phrases", "indicating", "negative", "feedback"],
    "reasoning": "brief explanation"
}}"""
        
        response = model.generate_content(prompt)
        result_text = response.text.strip()
        
        # Clean markdown if present
        if "```" in result_text:
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        
        return json.loads(result_text.strip())
    except json.JSONDecodeError:
        return {"error": "JSON parse error", "raw": result_text[:200] if 'result_text' in dir() else "N/A"}
    except Exception as e:
        error_str = str(e)
        if "429" in error_str and retry_count < MAX_RETRIES:
            # Exponential backoff: 30s, 60s, 120s
            wait_time = 30 * (2 ** retry_count)
            print(f"  ⏳ Rate limited. Waiting {wait_time}s before retry {retry_count + 1}/{MAX_RETRIES}...")
            time.sleep(wait_time)
            return analyze_review_with_gemini(text, product, rating, retry_count + 1)
        return {"error": error_str[:150]}


def main():
    print("="*70)
    print("GEMINI-POWERED ML TRAINING")
    print("="*70)
    print(f"Model: {GEMINI_MODEL}")
    print(f"Rate limit: {DELAY_BETWEEN_REQUESTS}s between requests ({60//DELAY_BETWEEN_REQUESTS} RPM)")
    print(f"Batch size: {BATCH_SIZE} reviews")
    print()
    
    # Load reviews
    with open('src/data/processed_reviews.json', 'r', encoding='utf-8') as f:
        all_reviews = json.load(f)
    
    print(f"Total reviews available: {len(all_reviews)}")
    
    # Sample reviews strategically:
    # - Include longest reviews (most informative)
    # - Include random sample across ratings
    # - Include some short reviews to understand handling
    
    reviews_sorted = sorted(all_reviews, key=lambda r: len(r.get('text', '')), reverse=True)
    
    sample = []
    # Top 30 longest reviews
    sample.extend(reviews_sorted[:30])
    # Random 50 from remaining
    remaining = reviews_sorted[30:]
    random.seed(42)  # Reproducible
    sample.extend(random.sample(remaining, min(50, len(remaining))))
    # 20 short reviews (< 50 chars)
    short_reviews = [r for r in all_reviews if len(r.get('text', '')) < 50 and len(r.get('text', '')) > 10]
    sample.extend(random.sample(short_reviews, min(20, len(short_reviews))))
    
    print(f"Sample selected: {len(sample)} reviews")
    print(f"  - {len([r for r in sample if len(r.get('text', '')) > 200])} long reviews (>200 chars)")
    print(f"  - {len([r for r in sample if len(r.get('text', '')) < 50])} short reviews (<50 chars)")
    print()
    
    # Process with Gemini
    results = []
    category_keywords = defaultdict(lambda: defaultdict(set))
    good_words = set()
    bad_words = set()
    category_counts = defaultdict(int)
    subcategory_counts = defaultdict(lambda: defaultdict(int))
    
    print("Starting Gemini analysis...")
    print("-"*70)
    
    for i, review in enumerate(sample):
        text = review.get('text', '')
        product = review.get('product', 'Unknown')
        rating = review.get('rating', 3)
        
        print(f"[{i+1}/{len(sample)}] Processing: {text[:50]}...")
        
        result = analyze_review_with_gemini(text, product, rating)
        
        if result and 'error' not in result:
            cat = result.get('category', 'Unknown')
            subcat = result.get('subcategory', 'Unknown')
            
            print(f"  ✅ {cat}/{subcat} | Sentiment: {result.get('sentiment')} ({result.get('sentiment_score')})")
            
            # Collect keywords
            for kw in result.get('keywords', []):
                if kw and len(kw) > 2:
                    category_keywords[cat][subcat].add(kw.lower())
            
            for w in result.get('good_indicators', []):
                if w and len(w) > 2:
                    good_words.add(w.lower())
            
            for w in result.get('bad_indicators', []):
                if w and len(w) > 2:
                    bad_words.add(w.lower())
            
            category_counts[cat] += 1
            subcategory_counts[cat][subcat] += 1
            
            results.append({
                'review_text': text[:200],
                'product': product,
                'rating': rating,
                'gemini_result': result
            })
        else:
            error = result.get('error', 'Unknown error') if result else 'No result'
            print(f"  ❌ Error: {error[:60]}")
        
        # Rate limiting
        if i < len(sample) - 1:
            print(f"  ⏳ Waiting {DELAY_BETWEEN_REQUESTS}s...")
            time.sleep(DELAY_BETWEEN_REQUESTS)
    
    # Generate keyword dictionary
    print("\n" + "="*70)
    print("TRAINING COMPLETE - RESULTS")
    print("="*70)
    
    print(f"\nSuccessful analyses: {len(results)}/{len(sample)}")
    
    print("\n📊 Category Distribution:")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")
        for subcat, subcount in sorted(subcategory_counts[cat].items(), key=lambda x: -x[1])[:5]:
            print(f"    └─ {subcat}: {subcount}")
    
    print("\n📖 Learned Keyword Dictionary:")
    keyword_dict = {}
    for cat, subcats in category_keywords.items():
        keyword_dict[cat] = {}
        print(f"\n  {cat}:")
        for subcat, keywords in subcats.items():
            keyword_list = sorted(list(keywords))[:20]  # Top 20 per subcat
            keyword_dict[cat][subcat] = keyword_list
            print(f"    {subcat}: {keyword_list[:10]}...")
    
    print(f"\n✅ Good indicators ({len(good_words)} words):")
    print(f"  {sorted(list(good_words))[:20]}...")
    
    print(f"\n❌ Bad indicators ({len(bad_words)} words):")
    print(f"  {sorted(list(bad_words))[:20]}...")
    
    # Save results
    output = {
        'training_stats': {
            'total_processed': len(sample),
            'successful': len(results),
            'model': GEMINI_MODEL
        },
        'category_distribution': dict(category_counts),
        'subcategory_distribution': {cat: dict(subcats) for cat, subcats in subcategory_counts.items()},
        'keyword_dictionary': keyword_dict,
        'good_indicators': sorted(list(good_words)),
        'bad_indicators': sorted(list(bad_words)),
        'detailed_results': results
    }
    
    with open('gemini_ml_training.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n💾 Full results saved to: gemini_ml_training.json")
    print("\nUse this to update ml_pipeline/category_classifier.py")


if __name__ == "__main__":
    main()
