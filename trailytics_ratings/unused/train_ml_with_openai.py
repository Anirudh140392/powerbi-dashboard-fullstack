"""
Use OpenAI GPT-4o-mini to analyze sample reviews in parallel with Gemini.
Extracts categories, subcategories, sentiment, and keywords for ML training.
"""
import json
import time
import random
from collections import defaultdict
from typing import Dict, List, Optional
from openai import OpenAI

OPENAI_API_KEY = "YOUR_OPENAI_API_KEY"
OPENAI_MODEL = "gpt-4o-mini"

# Rate limiting (OpenAI is more generous but still be careful)
DELAY_BETWEEN_REQUESTS = 2  # 2 seconds between requests
BATCH_SIZE = 100  # Process 100 reviews

def analyze_review_with_openai(text: str, product: str, rating: int) -> Optional[Dict]:
    """Ask OpenAI to analyze a review and extract classification + keywords."""
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        
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
        
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Clean markdown if present
        if "```" in result_text:
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        
        return json.loads(result_text.strip())
    except json.JSONDecodeError:
        return {"error": "JSON parse error", "raw": result_text[:200] if 'result_text' in dir() else "N/A"}
    except Exception as e:
        return {"error": str(e)[:150]}


def main():
    print("="*70)
    print("OPENAI GPT-4o-mini ML TRAINING")
    print("="*70)
    print(f"Model: {OPENAI_MODEL}")
    print(f"Rate limit: {DELAY_BETWEEN_REQUESTS}s between requests")
    print(f"Batch size: {BATCH_SIZE} reviews")
    print()
    
    # Load reviews
    with open('src/data/processed_reviews.json', 'r', encoding='utf-8') as f:
        all_reviews = json.load(f)
    
    print(f"Total reviews available: {len(all_reviews)}")
    
    # Sample different reviews than Gemini (use second half of sorted list)
    reviews_sorted = sorted(all_reviews, key=lambda r: len(r.get('text', '')), reverse=True)
    
    sample = []
    # Reviews 30-80 (different from Gemini's 0-30)
    sample.extend(reviews_sorted[30:80])
    # Random 30 from middle
    middle = reviews_sorted[100:1000]
    random.seed(43)  # Different seed than Gemini
    sample.extend(random.sample(middle, min(30, len(middle))))
    # 20 medium-short reviews
    short_medium = [r for r in all_reviews if 30 < len(r.get('text', '')) < 100]
    sample.extend(random.sample(short_medium, min(20, len(short_medium))))
    
    print(f"Sample selected: {len(sample)} reviews")
    print()
    
    # Process with OpenAI
    results = []
    category_keywords = defaultdict(lambda: defaultdict(set))
    good_words = set()
    bad_words = set()
    category_counts = defaultdict(int)
    subcategory_counts = defaultdict(lambda: defaultdict(int))
    
    print("Starting OpenAI analysis...")
    print("-"*70)
    
    for i, review in enumerate(sample):
        text = review.get('text', '')
        product = review.get('product', 'Unknown')
        rating = review.get('rating', 3)
        
        print(f"[{i+1}/{len(sample)}] Processing: {text[:50]}...")
        
        result = analyze_review_with_openai(text, product, rating)
        
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
                'openai_result': result
            })
        else:
            error = result.get('error', 'Unknown error') if result else 'No result'
            print(f"  ❌ Error: {error[:60]}")
        
        # Rate limiting
        if i < len(sample) - 1:
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
            keyword_list = sorted(list(keywords))[:20]
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
            'model': OPENAI_MODEL
        },
        'category_distribution': dict(category_counts),
        'subcategory_distribution': {cat: dict(subcats) for cat, subcats in subcategory_counts.items()},
        'keyword_dictionary': keyword_dict,
        'good_indicators': sorted(list(good_words)),
        'bad_indicators': sorted(list(bad_words)),
        'detailed_results': results
    }
    
    with open('openai_ml_training.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n💾 Full results saved to: openai_ml_training.json")


if __name__ == "__main__":
    main()
