"""
Main Review Processing Pipeline
Orchestrates sentiment analysis, category classification, and competitor detection.
Supports multiple LLM providers: Gemini, OpenAI, OpenRouter.
"""

import json
import argparse
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Literal
from datetime import datetime
from tqdm import tqdm

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from sentiment_analyzer import analyze_sentiment_local, get_polarity_score
from category_classifier import classify_review, FULL_TAXONOMY
from competitor_detector import detect_competitor_mentions

ProviderType = Literal["gemini", "openai", "openrouter", "rules"]


def process_single_review(
    review: Dict,
    provider: ProviderType = "gemini",
    api_key: Optional[str] = None,
    use_llm_for_all: bool = False
) -> Dict:
    """Process a single review through the ML pipeline."""
    text = review.get("text", "")
    rating = review.get("rating", 3)
    product = review.get("product", "Unknown")
    review_id = review.get("id", "")
    review_date = review.get("date", "")
    
    # 1. Sentiment Analysis (always local - fast)
    sentiment, sentiment_confidence, is_complex = analyze_sentiment_local(text)
    polarity = get_polarity_score(text)
    
    # 2. Category Classification (LLM for complex, rules for simple)
    use_llm = use_llm_for_all or is_complex or sentiment_confidence < 0.6
    
    if use_llm and provider != "rules":
        category, subcategory, cat_confidence, reasoning = classify_review(
            text, product, rating, provider, api_key
        )
    else:
        category, subcategory, cat_confidence, reasoning = classify_review(
            text, product, rating, "rules"
        )
    
    # 3. Competitor Detection
    competitor_mentions = detect_competitor_mentions(text, str(review_id), review_date)
    
    # Override to Competitor Comparison if mentions found and low confidence
    if competitor_mentions and category != "Competitor Comparison" and cat_confidence < 0.7:
        category = "Competitor Comparison"
        subcategory = "Direct Mention"
    
    # Build enriched review
    return {
        **review,
        "sentiment": sentiment,
        "sentimentConfidence": round(sentiment_confidence, 3),
        "polarity": round(polarity, 3),
        "sentimentCategory": category,
        "subcategory": subcategory,
        "categoryConfidence": round(cat_confidence, 3),
        "classificationReasoning": reasoning,
        "competitorMentions": competitor_mentions,
        "processedAt": datetime.now().isoformat()
    }


def process_reviews(
    input_path: str,
    output_path: str,
    provider: ProviderType = "gemini",
    api_key: Optional[str] = None,
    use_llm_for_all: bool = False,
    sample_size: Optional[int] = None,
    batch_size: int = 10
):
    """Process all reviews through the ML pipeline."""
    print(f"\n{'='*60}")
    print("ML Review Processing Pipeline")
    print(f"{'='*60}")
    print(f"Provider: {provider.upper()}")
    
    # Load reviews
    print(f"\n📂 Loading reviews from: {input_path}")
    with open(input_path, 'r', encoding='utf-8') as f:
        reviews = json.load(f)
    
    total_reviews = len(reviews)
    print(f"   Found {total_reviews:,} reviews")
    
    # Sample if requested
    if sample_size and sample_size < total_reviews:
        print(f"   Sampling {sample_size} reviews for testing")
        reviews = reviews[:sample_size]
    
    # Check API key
    if provider != "rules" and not api_key:
        env_var = f"{provider.upper()}_API_KEY"
        api_key = os.environ.get(env_var)
        if api_key:
            print(f"\n🔑 Using API key from environment ({env_var})")
        else:
            print(f"\n⚠️  No API key found - using rule-based classification")
            provider = "rules"
    
    # Process reviews
    print(f"\n🔄 Processing {len(reviews):,} reviews...")
    enriched_reviews = []
    stats = {
        "total": len(reviews),
        "llm_used": 0,
        "rules_used": 0,
        "competitor_mentions": 0,
        "categories": {},
        "subcategories": {},
        "sentiments": {"POSITIVE": 0, "NEGATIVE": 0, "NEUTRAL": 0},
        "errors": 0
    }
    
    for review in tqdm(reviews, desc="Processing"):
        try:
            enriched = process_single_review(review, provider, api_key, use_llm_for_all)
            enriched_reviews.append(enriched)
            
            # Update stats
            category = enriched.get("sentimentCategory", "General")
            subcategory = enriched.get("subcategory", "General Feedback")
            stats["categories"][category] = stats["categories"].get(category, 0) + 1
            stats["subcategories"][subcategory] = stats["subcategories"].get(subcategory, 0) + 1
            stats["sentiments"][enriched.get("sentiment", "NEUTRAL")] += 1
            
            if enriched.get("competitorMentions"):
                stats["competitor_mentions"] += 1
            
            reasoning = enriched.get("classificationReasoning", "")
            if "[Gemini]" in reasoning or "[OpenAI]" in reasoning or "[OpenRouter]" in reasoning:
                stats["llm_used"] += 1
            else:
                stats["rules_used"] += 1
                
        except Exception as e:
            stats["errors"] += 1
            print(f"\n❌ Error processing review {review.get('id')}: {e}")
            enriched_reviews.append(review)
    
    # Save output
    print(f"\n💾 Saving enriched reviews to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(enriched_reviews, f, ensure_ascii=False, indent=2)
    
    # Print summary
    print(f"\n{'='*60}")
    print("PROCESSING COMPLETE")
    print(f"{'='*60}")
    
    print(f"\n📊 Processing Stats:")
    print(f"   Total processed: {stats['total']:,}")
    print(f"   LLM classifications: {stats['llm_used']:,}")
    print(f"   Rule-based: {stats['rules_used']:,}")
    print(f"   Competitor mentions: {stats['competitor_mentions']:,}")
    print(f"   Errors: {stats['errors']:,}")
    
    print(f"\n📈 Category Distribution:")
    for cat, count in sorted(stats["categories"].items(), key=lambda x: -x[1]):
        pct = count / stats["total"] * 100
        bar = "█" * int(pct / 3)
        print(f"   {cat:25} {count:5,} ({pct:5.1f}%) {bar}")
    
    print(f"\n😊 Sentiment Distribution:")
    for sent, count in stats["sentiments"].items():
        pct = count / stats["total"] * 100
        print(f"   {sent}: {count:,} ({pct:.1f}%)")
    
    return enriched_reviews, stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process reviews with ML pipeline")
    parser.add_argument("--input", "-i", required=True, help="Input JSON file path")
    parser.add_argument("--output", "-o", required=True, help="Output JSON file path")
    parser.add_argument("--provider", "-p", default="gemini", 
                        choices=["gemini", "openai", "openrouter", "rules"],
                        help="LLM provider to use")
    parser.add_argument("--api-key", "-k", help="API key for the provider")
    parser.add_argument("--sample", "-s", type=int, help="Sample size for testing")
    parser.add_argument("--llm-all", action="store_true", help="Use LLM for all reviews")
    
    args = parser.parse_args()
    
    process_reviews(
        input_path=args.input,
        output_path=args.output,
        provider=args.provider,
        api_key=args.api_key,
        use_llm_for_all=args.llm_all,
        sample_size=args.sample
    )
