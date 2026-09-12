"""Show sample reviews for each characteristic with sentiment"""
import json
import re
from collections import Counter, defaultdict

with open('src/data/reviews_ml_enriched.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

CHARACTERISTICS = {
    "lid": ["lid", "cover", "top cover"],
    "gasket": ["gasket", "rubber ring", "sealing ring"],
    "knob": ["knob", "lid knob"],
    "handle": ["handle", "grip", "side handle"],
    "whistle": ["whistle", "pressure whistle"],
    "valve": ["valve", "safety valve"],
    "body": ["body", "outer body", "base"],
    "burner": ["burner", "brass burner"],
    "coil": ["coil", "heating coil"],
    "cord": ["cord", "power cord"],
    "blade": ["blade", "blades"],
    "jar": ["jar", "jars", "grinding jar"],
    "size": ["size", "litre", "liter", "capacity"],
    "weight": ["weight", "heavy", "lightweight"],
    "colour": ["colour", "color", "black", "silver"],
    "coating": ["coating", "non-stick", "nonstick", "teflon"],
    "material": ["stainless steel", "steel", "aluminium"],
    "crack": ["crack", "cracked", "broken"],
    "leak": ["leak", "leaking", "leakage"],
    "rust": ["rust", "rusted", "corrosion"],
    "burn": ["burn", "burnt", "burning", "overheat"],
    "noise": ["noise", "noisy", "loud", "sound"],
    "warranty": ["warranty", "guarantee", "service"],
}

# Extract with samples
char_samples = defaultdict(lambda: {"good": [], "bad": []})

for r in reviews:
    text = r.get('text', '').lower()
    text_clean = ''.join(c if ord(c) < 128 else '?' for c in text)
    rating = r.get('rating', 3)
    sentiment = "good" if rating >= 4 else "bad" if rating <= 2 else None
    
    if sentiment:
        for char_name, keywords in CHARACTERISTICS.items():
            for kw in keywords:
                if kw in text and len(char_samples[char_name][sentiment]) < 8:
                    sample = text_clean[:120].replace('\n', ' ')
                    char_samples[char_name][sentiment].append(f"[{rating}] {sample}")
                    break

# Output
with open('characteristic_samples.txt', 'w', encoding='utf-8') as f:
    for char_name in sorted(char_samples.keys()):
        data = char_samples[char_name]
        f.write(f"\n{'='*60}\n")
        f.write(f"{char_name.upper()}\n")
        f.write(f"{'='*60}\n")
        
        f.write("\nGOOD (what customers liked):\n")
        for sample in data["good"][:5]:
            f.write(f"  {sample}\n")
        
        f.write("\nBAD (complaints):\n")
        for sample in data["bad"][:5]:
            f.write(f"  {sample}\n")

print("Written to characteristic_samples.txt")
