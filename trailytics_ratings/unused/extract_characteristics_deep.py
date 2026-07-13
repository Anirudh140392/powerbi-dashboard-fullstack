"""
Extract specific product characteristics from ALL reviews.
Find: lid, gasket, knob, handle, size, warranty, colours, faults, etc.
"""
import json
import re
from collections import Counter, defaultdict

with open('src/data/reviews_ml_enriched.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

print(f"Analyzing {len(reviews):,} reviews for product characteristics...\n")

# Specific product characteristics to extract
CHARACTERISTICS = {
    # Physical Parts
    "lid": ["lid", "cover", "top cover", "cap"],
    "gasket": ["gasket", "rubber ring", "sealing ring", "seal"],
    "knob": ["knob", "handle knob", "lid knob"],
    "handle": ["handle", "grip", "side handle", "bakelite handle"],
    "whistle": ["whistle", "pressure whistle", "weight valve"],
    "valve": ["valve", "safety valve", "pressure valve"],
    "body": ["body", "outer body", "base", "bottom"],
    "burner": ["burner", "brass burner", "gas burner"],
    "coil": ["coil", "heating coil", "heating element"],
    "cord": ["cord", "power cord", "wire", "cable"],
    "blade": ["blade", "blades", "cutting blade"],
    "jar": ["jar", "jars", "grinding jar", "wet jar", "dry jar"],
    
    # Attributes
    "size": ["size", "litre", "liter", "liters", "litres", "capacity", "volume"],
    "weight": ["weight", "heavy", "lightweight", "light weight", "portable"],
    "colour": ["colour", "color", "black", "silver", "red", "blue", "white"],
    "coating": ["coating", "non-stick", "nonstick", "teflon", "anodized"],
    "material": ["stainless steel", "steel", "aluminium", "aluminum", "glass", "plastic"],
    
    # Issues
    "crack": ["crack", "cracked", "broken", "shattered"],
    "leak": ["leak", "leaking", "leakage", "spill", "spillage"],
    "rust": ["rust", "rusted", "rusting", "corrosion"],
    "burn": ["burn", "burnt", "burning", "overheating", "overheat"],
    "noise": ["noise", "noisy", "loud", "sound", "silent"],
    
    # Service
    "warranty": ["warranty", "guarantee", "service", "repair", "replacement"],
    "delivery": ["delivery", "packaging", "packing", "shipping", "arrived"],
    
    # Performance
    "cooking_time": ["fast", "quick", "slow", "time", "minutes"],
    "heating": ["heat", "heating", "heats", "temperature", "even heating", "uneven"],
    "induction": ["induction", "induction compatible", "induction base"],
    "gas": ["gas", "gas stove", "lpg", "flame"]
}

# Extract characteristics with sentiment
char_data = defaultdict(lambda: {"positive": [], "negative": [], "count": 0})

for r in reviews:
    text = r.get('text', '').lower()
    rating = r.get('rating', 3)
    sentiment = "positive" if rating >= 4 else "negative" if rating <= 2 else "neutral"
    
    for char_name, keywords in CHARACTERISTICS.items():
        for kw in keywords:
            if kw in text:
                char_data[char_name]["count"] += 1
                if sentiment != "neutral":
                    # Extract sentence containing the keyword
                    sentences = re.split(r'[.!?]', text)
                    for sent in sentences:
                        if kw in sent and len(sent.strip()) > 10:
                            sample = sent.strip()[:100]
                            char_data[char_name][sentiment].append(sample)
                            break
                break  # Count each characteristic once per review

# Print results
print("="*70)
print("PRODUCT CHARACTERISTICS ANALYSIS")
print("="*70)

# Sort by count
sorted_chars = sorted(char_data.items(), key=lambda x: -x[1]["count"])

for char_name, data in sorted_chars:
    if data["count"] >= 50:  # Only show characteristics with 50+ mentions
        pos_count = len(data["positive"])
        neg_count = len(data["negative"])
        total = data["count"]
        
        print(f"\n{'='*60}")
        print(f"{char_name.upper()}: {total:,} mentions")
        print(f"  Positive: {pos_count:,} | Negative: {neg_count:,}")
        print(f"{'='*60}")
        
        # Show sample positive reviews
        print("\n  GOOD (what customers liked):")
        for sample in data["positive"][:5]:
            print(f"    + {sample}")
        
        # Show sample negative reviews
        print("\n  BAD (complaints):")
        for sample in data["negative"][:5]:
            print(f"    - {sample}")

# Summary
print("\n\n" + "="*70)
print("SUMMARY: TOP CHARACTERISTICS BY MENTION COUNT")
print("="*70)
for char_name, data in sorted_chars[:20]:
    pos = len(data["positive"])
    neg = len(data["negative"])
    total = data["count"]
    ratio = pos / (pos + neg) if (pos + neg) > 0 else 0.5
    sentiment_bar = "+" * int(ratio * 10) + "-" * int((1-ratio) * 10)
    print(f"  {char_name:15} {total:5,} mentions  [{sentiment_bar}]  {pos:4}+ {neg:4}-")
