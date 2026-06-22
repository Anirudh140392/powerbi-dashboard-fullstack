"""
Competitor Detector Module
Detects competitor brand mentions in review text and analyzes context sentiment.
"""

import re
import sys
from pathlib import Path
from typing import List, Dict, Literal

# Handle imports for both package and standalone usage
try:
    from .sentiment_analyzer import analyze_sentiment_local
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from sentiment_analyzer import analyze_sentiment_local

# Competitor brands to detect (case-insensitive)
COMPETITOR_BRANDS = [
    "Butterfly",
    "Preethi",
    "Bajaj",
    "Philips",
    "Pigeon",
    "Crompton",
    "Morphy Richards",
    "Morphy",
    "Wonderchef",
    "Havells",
    "Bosch",
    "Panasonic",
    "Kenstar",
    "Usha",
    "Orient",
    "Maharaja",
    "Sujata",
    "CK",  # Common abbreviation
]

# Prestige variations (to detect self-mentions)
PRESTIGE_VARIANTS = ["prestige", "prs", "prestige appliances"]


def detect_competitor_mentions(review_text: str, review_id: str = "", review_date: str = "") -> List[Dict]:
    """
    Detect competitor brand mentions in review text.
    
    Returns list of detected mentions with:
    - brand: Competitor brand name
    - context: Text snippet around mention (±50 chars)
    - sentiment: Sentiment of the context
    - isFavorable: True if customer prefers Prestige over competitor
    """
    if not review_text:
        return []
    
    mentions = []
    text_lower = review_text.lower()
    
    for brand in COMPETITOR_BRANDS:
        brand_lower = brand.lower()
        
        # Find all occurrences
        pattern = r'\b' + re.escape(brand_lower) + r'\b'
        for match in re.finditer(pattern, text_lower):
            idx = match.start()
            
            # Extract context (±60 chars around mention)
            start = max(0, idx - 60)
            end = min(len(review_text), idx + len(brand) + 60)
            context = review_text[start:end].strip()
            
            # Analyze sentiment of context
            sentiment, confidence, _ = analyze_sentiment_local(context)
            
            # Determine if favorable to Prestige
            # Check for comparison patterns
            is_favorable = _analyze_favorability(context, brand)
            
            mentions.append({
                "brand": brand,
                "context": context,
                "sentiment": sentiment,
                "reviewId": review_id,
                "reviewText": review_text[:200] if len(review_text) > 200 else review_text,
                "reviewDate": review_date,
                "isFavorable": is_favorable,
                "confidence": confidence
            })
    
    return mentions


def _analyze_favorability(context: str, competitor: str) -> bool:
    """
    Determine if the mention is favorable to Prestige (our brand).
    
    Favorable patterns:
    - "better than [competitor]"
    - "unlike [competitor], this works"
    - "[competitor] broke, but Prestige works"
    
    Unfavorable patterns:
    - "[competitor] is better"
    - "should have bought [competitor]"
    - "switching to [competitor]"
    """
    context_lower = context.lower()
    competitor_lower = competitor.lower()
    
    # Favorable patterns (Prestige > Competitor)
    favorable_patterns = [
        f"better than {competitor_lower}",
        f"better than my {competitor_lower}",
        f"better than the {competitor_lower}",
        f"unlike {competitor_lower}",
        f"unlike my {competitor_lower}",
        f"{competitor_lower} broke",
        f"{competitor_lower} stopped",
        f"{competitor_lower} failed",
        f"replaced {competitor_lower}",
        f"switched from {competitor_lower}",
        f"upgraded from {competitor_lower}",
    ]
    
    # Unfavorable patterns (Competitor > Prestige)
    unfavorable_patterns = [
        f"{competitor_lower} is better",
        f"{competitor_lower} was better",
        f"should have bought {competitor_lower}",
        f"prefer {competitor_lower}",
        f"switching to {competitor_lower}",
        f"going back to {competitor_lower}",
        f"buy {competitor_lower} instead",
        f"{competitor_lower} works better",
    ]
    
    # Check patterns
    for pattern in favorable_patterns:
        if pattern in context_lower:
            return True
    
    for pattern in unfavorable_patterns:
        if pattern in context_lower:
            return False
    
    # Default: if competitor mentioned in negative context, assume favorable to Prestige
    sentiment, _, _ = analyze_sentiment_local(context)
    return sentiment == 'NEGATIVE'


def get_all_competitor_brands() -> List[str]:
    """Return list of all tracked competitor brands."""
    return COMPETITOR_BRANDS.copy()


def aggregate_competitor_mentions(mentions: List[Dict]) -> Dict[str, Dict]:
    """
    Aggregate competitor mentions by brand.
    
    Returns dict with brand as key and stats as value:
    - total: Total mentions
    - favorable: Favorable mentions (Prestige preferred)
    - unfavorable: Unfavorable mentions
    - favorable_rate: % favorable
    """
    aggregated = {}
    
    for mention in mentions:
        brand = mention["brand"]
        if brand not in aggregated:
            aggregated[brand] = {
                "total": 0,
                "favorable": 0,
                "unfavorable": 0,
            }
        
        aggregated[brand]["total"] += 1
        if mention["isFavorable"]:
            aggregated[brand]["favorable"] += 1
        else:
            aggregated[brand]["unfavorable"] += 1
    
    # Calculate rates
    for brand, stats in aggregated.items():
        stats["favorable_rate"] = stats["favorable"] / stats["total"] if stats["total"] > 0 else 0
    
    return aggregated


if __name__ == "__main__":
    # Test examples
    test_reviews = [
        "Much better than my old Butterfly mixer. This Prestige one is quieter.",
        "Should have bought Preethi instead. This stopped working in 2 months.",
        "Unlike Bajaj products, this actually has good build quality.",
        "Comparing with Philips, the price is much better.",
        "My previous Pigeon pressure cooker lasted longer than this.",
    ]
    
    print("Testing competitor detection:\n")
    for review in test_reviews:
        mentions = detect_competitor_mentions(review)
        print(f"Review: {review[:50]}...")
        for m in mentions:
            print(f"  Brand: {m['brand']}")
            print(f"  Favorable to Prestige: {m['isFavorable']}")
            print(f"  Context sentiment: {m['sentiment']}")
        print()
