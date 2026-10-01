"""
Create SKU mappings between Prestige products and competitor products.
"""
import json

# Load catalogs
with open('src/data/prestige_catalog.json', 'r', encoding='utf-8') as f:
    prestige_products = json.load(f)

with open('src/data/competitor_products.json', 'r', encoding='utf-8') as f:
    competitor_data = json.load(f)
    competitor_products = competitor_data['competitors']

# Create mappings by category
category_competitor_map = {}
for cp in competitor_products:
    cat = cp['category']
    if cat not in category_competitor_map:
        category_competitor_map[cat] = []
    category_competitor_map[cat].append(cp)

# Map each Prestige product to competitor products in same category
sku_mappings = []

for pp in prestige_products:
    category = pp['category']
    
    # Find competitor products in same category
    competitors = category_competitor_map.get(category, [])
    
    # Map up to 5 competitor products
    competitor_ids = [c['productId'] for c in competitors[:5]]
    
    if competitor_ids:
        sku_mappings.append({
            'prestigeProductId': pp['productId'],
            'prestigeProductName': pp['name'],
            'category': category,
            'subcategory1': pp['subcategory1'],
            'subcategory2': pp['subcategory2'],
            'competitorProductIds': competitor_ids,
            'reviewCount': pp['reviewCount']
        })

# Save mappings
with open('src/data/sku_mappings.json', 'w', encoding='utf-8') as f:
    json.dump(sku_mappings, f, indent=2, ensure_ascii=False)

print(f"Created {len(sku_mappings)} SKU mappings")

# Summary by category
cat_counts = {}
for m in sku_mappings:
    cat_counts[m['category']] = cat_counts.get(m['category'], 0) + 1

print("\nMappings by Category:")
for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
    competitors = len(category_competitor_map.get(cat, []))
    print(f"  {cat}: {count} Prestige products → {competitors} competitors")

print(f"\n✅ Saved to src/data/sku_mappings.json")
