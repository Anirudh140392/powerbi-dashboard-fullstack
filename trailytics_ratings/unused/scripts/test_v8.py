"""Test the v8 classifier with edge cases."""
import sys
sys.path.insert(0, 'ml_pipeline')
from category_classifier import classify_all_labels, detect_indirect_sentiment

tests = [
    ("lid broke, handle is cheap, and delivery was late", 1),
    ("Not bad. Could have been better quality but does the job", 3),
    ("No complaints! Working perfectly. Worth every penny", 5),
    ("Gasket leaked causing steam burns on my hand. Dangerous!", 1),
    ("Good product but delivery was damaged. Had to return.", 3),
    ("Nothing special. Just okay.", 3),
    ("Excellent build quality, easy to clean, value for money", 5),
    ("Coating peeling after 2 months. Handle also loose. Not safe for cooking.", 1),
    ("Induction compatible, good for daily use. But packaging could be better", 4),
    ("Waste of money. Motor stopped working in 1 week. Customer service not responding", 1),
    ("ok", 3),
    ("nice", 4),
]

for text, rating in tests:
    labels = classify_all_labels(text, rating)
    print(f"\nR={rating} | {text[:70]}")
    for i, l in enumerate(labels[:5]):
        neg = " [NEG]" if l["is_negated"] else ""
        arrow = ">>" if i == 0 else "  "
        print(f"  {arrow} {l['category']}/{l['subcategory']} "
              f"(conf={l['confidence']:.2f}, impact={l['impact']:.2f}, "
              f"dir={l['sentiment_direction']}{neg}) keys={l['keywords_matched'][:3]}")
    ind = detect_indirect_sentiment(text)
    if ind:
        print(f"  Indirect: {ind}")
