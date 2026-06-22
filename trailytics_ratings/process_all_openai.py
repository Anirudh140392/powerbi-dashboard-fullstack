"""
Process ALL reviews with OpenAI API - With proper error handling and rate limiting.
"""
import json
import os
import time
from openai import OpenAI
from tqdm import tqdm

# OpenAI configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
client = OpenAI(api_key=OPENAI_API_KEY)

PROMPT_TEMPLATE = """Classify this product review into ONE category.

IMPORTANT: 
- If review only has generic words like "good", "nice", "bad", "worst", "awesome" WITHOUT specific context about WHAT aspect, classify as "General".
- Only classify as specific categories if the review mentions specific aspects.

Categories:
- Quality: Build quality, durability, materials (e.g., "broke after 2 months", "sturdy build")  
- Performance: How well it works (e.g., "cooks fast", "motor stopped", "heats evenly")
- Usability: Ease of use, cleaning, size, design (e.g., "easy to clean", "heavy handle")
- Value: Price, value for money (e.g., "worth the price", "too expensive")
- Delivery: Shipping, packaging (e.g., "arrived damaged", "fast delivery")
- Customer Service: Support, returns, warranty (e.g., "no refund", "helpful support")
- Safety: Safety issues (e.g., "electric shock", "burns")
- Features: Accessories, missing items (e.g., "no spatula included")
- Brand: Brand trust (e.g., "trust Prestige brand")
- Competitor: Comparison with other brands
- General: Vague reviews like "Good", "Nice product", "Awesome" without context

Review: "{text}"
Rating: {rating}/5

Respond in JSON: {{"category": "...", "subcategory": "...", "keywords": [], "sentiment": "positive/negative/neutral"}}"""


def classify_review(text: str, rating: int, max_retries: int = 3) -> dict:
    """Classify a single review using OpenAI with retries."""
    if not text or len(text.strip()) < 3:
        return {"category": "General", "subcategory": "Empty", "keywords": [], "sentiment": "neutral"}
    
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a product review classifier. Be strict: only classify into specific categories if the review gives specific context. Generic praise/criticism goes to General."},
                    {"role": "user", "content": PROMPT_TEMPLATE.format(text=text[:500], rating=rating)}
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=100
            )
            
            result = json.loads(response.choices[0].message.content)
            return result
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # exponential backoff
            else:
                return {"category": "General", "subcategory": "Error", "keywords": [], "sentiment": "neutral", "error": str(e)[:50]}
    
    return {"category": "General", "subcategory": "Error", "keywords": [], "sentiment": "neutral"}


def main():
    print("="*70)
    print("OPENAI FULL REVIEW CLASSIFICATION (Sequential)")
    print("="*70)
    
    # Load reviews
    with open('src/data/processed_reviews.json', 'r', encoding='utf-8') as f:
        reviews = json.load(f)
    
    total = len(reviews)
    print(f"\nTotal reviews to process: {total:,}")
    
    # Process reviews sequentially
    enriched_reviews = []
    category_counts = {}
    errors = 0
    
    start_time = time.time()
    
    for review in tqdm(reviews, desc="Processing reviews"):
        text = review.get('text', '').strip()
        rating = review.get('rating', 3)
        
        result = classify_review(text, rating)
        
        enriched = {
            **review,
            "sentimentCategory": result.get("category", "General"),
            "subcategory": result.get("subcategory", "General"),
            "aiKeywords": result.get("keywords", []),
            "sentiment": result.get("sentiment", "neutral").upper() if result.get("sentiment") else "NEUTRAL",
            "aiConfidence": 0.9 if result.get("subcategory") != "Error" else 0.0
        }
        enriched_reviews.append(enriched)
        
        cat = result.get("category", "General")
        category_counts[cat] = category_counts.get(cat, 0) + 1
        
        if result.get("subcategory") == "Error":
            errors += 1
    
    elapsed = time.time() - start_time
    
    # Save results
    print(f"\n💾 Saving results...")
    with open('src/data/reviews_openai_classified.json', 'w', encoding='utf-8') as f:
        json.dump(enriched_reviews, f, ensure_ascii=False, indent=2)
    
    # Print stats
    print(f"\n{'='*70}")
    print("CLASSIFICATION COMPLETE")
    print(f"{'='*70}")
    print(f"\n⏱️  Time: {elapsed:.1f}s ({elapsed/60:.1f} min)")
    print(f"📊 Processed: {len(enriched_reviews):,}")
    print(f"❌ Errors: {errors}")
    
    print(f"\n📈 Category Distribution:")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        pct = count / len(enriched_reviews) * 100
        bar = "█" * int(pct / 2)
        print(f"   {cat:20} {count:6,} ({pct:5.1f}%) {bar}")


if __name__ == "__main__":
    main()
