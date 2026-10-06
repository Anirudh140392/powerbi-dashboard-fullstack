"""
Phase 1: Product Categorization
Extract categories from Prestige product names to build hierarchy.
"""
import json
import re
from collections import Counter, defaultdict

# Load reviews
with open('src/data/processed_reviews.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)

# Extract unique products
products = {}
for r in reviews:
    product = r.get('product', '').strip()
    if product and product not in products:
        products[product] = {
            'name': product,
            'reviewCount': 0,
            'avgRating': 0,
            'ratings': []
        }
    if product:
        products[product]['reviewCount'] += 1
        if r.get('rating'):
            products[product]['ratings'].append(float(r.get('rating', 3)))

# Calculate avg rating
for p in products.values():
    if p['ratings']:
        p['avgRating'] = round(sum(p['ratings']) / len(p['ratings']), 2)
    del p['ratings']

print(f"Found {len(products)} unique products\n")

# Category patterns (order matters - more specific first)
CATEGORY_PATTERNS = {
    'Pressure Cooker': [
        r'pressure.*cook', r'cooker.*pressure', r'svachh', r'alpha', r'nakshatra',
        r'popular.*\d+\s*l', r'deluxe.*\d+\s*l'
    ],
    'Induction Cooktop': [r'induction\s*cook', r'induction\s*top', r'pic\s*\d+'],
    'Gas Stove': [r'gas\s*stove', r'burner', r'glass\s*top\s*stove', r'marvel', r'magic'],
    'Mixer Grinder': [r'mixer.*grinder', r'grinder.*mixer', r'iris', r'deluxe.*grinder'],
    'Rice Cooker': [r'rice.*cook', r'prwo', r'delight.*rice'],
    'Electric Kettle': [r'kettle', r'pkoss', r'pkok'],
    'Tawa': [r'\btawa\b', r'dosa\s*tawa', r'roti\s*tawa', r'omega.*tawa'],
    'Kadai': [r'\bkadai\b', r'\bkadhai\b'],
    'Fry Pan': [r'fry\s*pan', r'frying\s*pan', r'omega.*fry'],
    'Pressure Pan': [r'pressure\s*pan', r'hard\s*anodised.*pan'],
    'Cookware Set': [r'cookware.*set', r'set.*cookware', r'combo'],
    'Casserole': [r'casserole'],
    'Appam Maker': [r'appam\s*maker', r'appachetty'],
    'Idli Maker': [r'idli\s*maker', r'idli\s*cooker'],
    'Dosa Maker': [r'dosa\s*maker', r'dosa\s*tawa'],
    'Toaster': [r'toaster', r'sandwich\s*maker', r'grill'],
    'Blender': [r'blender', r'hand\s*blender'],
    'Juicer': [r'juicer', r'citrus'],
    'Coffee Maker': [r'coffee\s*maker', r'coffee\s*percol'],
    'Air Fryer': [r'air\s*fryer'],
    'OTG': [r'\botg\b', r'oven\s*toaster'],
    'Hob': [r'\bhob\b', r'hobtop'],
    'Wet Grinder': [r'wet\s*grinder'],
    'Choppers': [r'chopper', r'veggie\s*cutter'],
}

# Subcategory patterns
SUBCATEGORY_PATTERNS = {
    # By power/wattage
    'wattage': r'(\d+)\s*w(?:att)?(?:s)?',
    # By capacity
    'capacity_liters': r'(\d+\.?\d*)\s*(?:l(?:tr|itre|iter)?s?)',
    # By material
    'stainless_steel': r'stainless\s*steel|ss\s*',
    'hard_anodised': r'hard\s*anodi[sz]ed',
    'non_stick': r'non[- ]?stick',
    'aluminium': r'aluminium|aluminum',
    'cast_iron': r'cast\s*iron',
    # By feature
    'induction_bottom': r'induction\s*bottom|ib\s*',
    'inner_lid': r'inner\s*lid',
    'outer_lid': r'outer\s*lid',
    'glass_lid': r'glass\s*lid',
    # By burner count
    'burners': r'(\d+)\s*burner',
}

def categorize_product(name):
    """Extract category and subcategories from product name."""
    name_lower = name.lower()
    
    # Find category
    category = 'Other'
    for cat, patterns in CATEGORY_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, name_lower):
                category = cat
                break
        if category != 'Other':
            break
    
    # Find subcategories
    subcategory1 = ''
    subcategory2 = ''
    
    # Capacity
    capacity_match = re.search(SUBCATEGORY_PATTERNS['capacity_liters'], name_lower)
    if capacity_match:
        subcategory1 = f"{capacity_match.group(1)}L"
    
    # Wattage
    watt_match = re.search(SUBCATEGORY_PATTERNS['wattage'], name_lower)
    if watt_match:
        subcategory1 = f"{watt_match.group(1)}W"
    
    # Burners
    burner_match = re.search(SUBCATEGORY_PATTERNS['burners'], name_lower)
    if burner_match:
        subcategory1 = f"{burner_match.group(1)} Burner"
    
    # Material as subcategory2
    if re.search(SUBCATEGORY_PATTERNS['stainless_steel'], name_lower):
        subcategory2 = 'Stainless Steel'
    elif re.search(SUBCATEGORY_PATTERNS['hard_anodised'], name_lower):
        subcategory2 = 'Hard Anodised'
    elif re.search(SUBCATEGORY_PATTERNS['non_stick'], name_lower):
        subcategory2 = 'Non-Stick'
    elif re.search(SUBCATEGORY_PATTERNS['aluminium'], name_lower):
        subcategory2 = 'Aluminium'
    
    # Lid type
    if re.search(SUBCATEGORY_PATTERNS['inner_lid'], name_lower):
        if subcategory2:
            subcategory2 += ' - Inner Lid'
        else:
            subcategory2 = 'Inner Lid'
    elif re.search(SUBCATEGORY_PATTERNS['outer_lid'], name_lower):
        if subcategory2:
            subcategory2 += ' - Outer Lid'
        else:
            subcategory2 = 'Outer Lid'
    
    return category, subcategory1, subcategory2

# Categorize all products
catalog = []
category_counts = Counter()
subcategory_counts = defaultdict(Counter)

for name, data in products.items():
    category, subcat1, subcat2 = categorize_product(name)
    
    catalog.append({
        'productId': f"PRESTIGE-{len(catalog)+1:04d}",
        'name': name,
        'brand': 'Prestige',
        'category': category,
        'subcategory1': subcat1,
        'subcategory2': subcat2,
        'reviewCount': data['reviewCount'],
        'avgRating': data['avgRating'],
        'competitorMappings': []  # To be filled in Phase 4
    })
    
    category_counts[category] += 1
    if subcat1:
        subcategory_counts[category][subcat1] += 1

# Save catalog
with open('src/data/prestige_catalog.json', 'w', encoding='utf-8') as f:
    json.dump(catalog, f, indent=2, ensure_ascii=False)

# Print summary
print("=" * 70)
print("CATEGORY DISTRIBUTION")
print("=" * 70)
for cat, count in category_counts.most_common():
    pct = count / len(catalog) * 100
    print(f"  {cat}: {count} ({pct:.1f}%)")
    for subcat, subcount in subcategory_counts[cat].most_common(5):
        print(f"    └─ {subcat}: {subcount}")

print(f"\n✅ Saved {len(catalog)} products to src/data/prestige_catalog.json")
