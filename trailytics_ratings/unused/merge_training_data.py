"""
Merge OpenAI and Gemini training results to create unified keyword dictionary.
Then update the rules-based classifier with learned keywords.
"""
import json
from collections import defaultdict

print("="*70)
print("MERGING TRAINING DATA FROM OPENAI + GEMINI")
print("="*70)

# Load OpenAI results
with open('openai_ml_training.json', 'r', encoding='utf-8') as f:
    openai_data = json.load(f)

# Try to load Gemini results if exists
gemini_data = None
try:
    with open('gemini_ml_training.json', 'r', encoding='utf-8') as f:
        gemini_data = json.load(f)
except FileNotFoundError:
    print("Note: Gemini training file not found, using OpenAI data only")

print(f"\nOpenAI: {openai_data['training_stats']['successful']} reviews processed")
if gemini_data:
    print(f"Gemini: {gemini_data['training_stats']['successful']} reviews processed")

# Merge category distributions
merged_categories = defaultdict(int)
merged_subcategories = defaultdict(lambda: defaultdict(int))
merged_keywords = defaultdict(lambda: defaultdict(set))
merged_good = set()
merged_bad = set()

# Add OpenAI data
for cat, count in openai_data['category_distribution'].items():
    merged_categories[cat] += count

for cat, subcats in openai_data['subcategory_distribution'].items():
    for subcat, count in subcats.items():
        merged_subcategories[cat][subcat] += count

for cat, subcats in openai_data['keyword_dictionary'].items():
    for subcat, keywords in subcats.items():
        for kw in keywords:
            merged_keywords[cat][subcat].add(kw.lower())

for word in openai_data.get('good_indicators', []):
    merged_good.add(word.lower())

for word in openai_data.get('bad_indicators', []):
    merged_bad.add(word.lower())

# Add Gemini data if available
if gemini_data:
    for cat, count in gemini_data.get('category_distribution', {}).items():
        merged_categories[cat] += count
    
    for cat, subcats in gemini_data.get('subcategory_distribution', {}).items():
        for subcat, count in subcats.items():
            merged_subcategories[cat][subcat] += count
    
    for cat, subcats in gemini_data.get('keyword_dictionary', {}).items():
        for subcat, keywords in subcats.items():
            for kw in keywords:
                merged_keywords[cat][subcat].add(kw.lower())
    
    for word in gemini_data.get('good_indicators', []):
        merged_good.add(word.lower())
    
    for word in gemini_data.get('bad_indicators', []):
        merged_bad.add(word.lower())

# Print merged stats
print(f"\n📊 MERGED CATEGORY DISTRIBUTION:")
for cat, count in sorted(merged_categories.items(), key=lambda x: -x[1]):
    print(f"  {cat}: {count}")
    for subcat, subcount in sorted(merged_subcategories[cat].items(), key=lambda x: -x[1])[:5]:
        print(f"    └─ {subcat}: {subcount}")

print(f"\n📖 KEYWORD COUNTS PER CATEGORY:")
for cat in sorted(merged_keywords.keys()):
    total_keywords = sum(len(kws) for kws in merged_keywords[cat].values())
    print(f"  {cat}: {total_keywords} unique keywords")

print(f"\n✅ Total good indicators: {len(merged_good)}")
print(f"❌ Total bad indicators: {len(merged_bad)}")

# Create the merged output
output = {
    'category_distribution': dict(merged_categories),
    'subcategory_distribution': {cat: dict(subcats) for cat, subcats in merged_subcategories.items()},
    'keyword_dictionary': {cat: {subcat: sorted(list(kws)) for subcat, kws in subcats.items()} 
                           for cat, subcats in merged_keywords.items()},
    'good_indicators': sorted(list(merged_good)),
    'bad_indicators': sorted(list(merged_bad))
}

# Save merged results
with open('merged_ml_training.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2)

print(f"\n💾 Merged training data saved to: merged_ml_training.json")

# Generate Python code for the updated classifier
print("\n" + "="*70)
print("GENERATING UPDATED CLASSIFIER CODE")
print("="*70)

# Create a simplified taxonomy from the learned data
simplified_taxonomy = {}

# Map to our standard categories
category_mapping = {
    'Functionality': 'Functionality',
    'Customer Service': 'Customer Service', 
    'Usability': 'Usability',
    'Packaging': 'Packaging',
    'Pricing': 'Pricing',
    'Quality': 'Functionality',  # Merge into Functionality
    'Build Quality': 'Functionality',  # Merge into Functionality
    'Brand': 'Brand Perception',
    'Competitor': 'Competitor Comparison',
    'General': 'General'
}

for cat, subcats in merged_keywords.items():
    # Map to standard category
    std_cat = category_mapping.get(cat, cat)
    if std_cat not in simplified_taxonomy:
        simplified_taxonomy[std_cat] = {}
    
    for subcat, keywords in subcats.items():
        # Simplify subcategory name
        simple_subcat = subcat.replace(' and ', '/').replace('/', '-').replace(' ', '_')[:30]
        if simple_subcat not in simplified_taxonomy[std_cat]:
            simplified_taxonomy[std_cat][simple_subcat] = set()
        simplified_taxonomy[std_cat][simple_subcat].update(keywords)

print("\nSimplified taxonomy for classifier:")
for cat in sorted(simplified_taxonomy.keys()):
    total = sum(len(kws) for kws in simplified_taxonomy[cat].values())
    print(f"  {cat}: {len(simplified_taxonomy[cat])} subcategories, {total} keywords")

# Save as Python-importable format
py_output = {
    'LEARNED_KEYWORDS': {cat: {subcat: sorted(list(kws))[:30] for subcat, kws in subcats.items()}
                         for cat, subcats in simplified_taxonomy.items()},
    'GOOD_INDICATORS': sorted(list(merged_good))[:100],
    'BAD_INDICATORS': sorted(list(merged_bad))[:100]
}

with open('ml_pipeline/learned_keywords.json', 'w', encoding='utf-8') as f:
    json.dump(py_output, f, indent=2)

print(f"\n💾 Classifier keywords saved to: ml_pipeline/learned_keywords.json")
print("\nReady to update category_classifier.py with learned keywords!")
