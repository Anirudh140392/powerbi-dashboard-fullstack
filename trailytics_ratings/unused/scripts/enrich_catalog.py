"""
Enrich Prestige Catalog with SKU Master Data
Maps prestige_catalog.json products to sku_master.json by ASIN matching,
then by fuzzy name matching for remaining products.
Adds: paretoStatus, material, masterCategory, subcategoryL1, subcategoryL2, skuCode, asin
"""
import json
import os
import re
from difflib import SequenceMatcher

SCRIPT_DIR = os.path.dirname(__file__)
CATALOG_PATH = os.path.join(SCRIPT_DIR, "..", "src", "data", "prestige_catalog.json")
SKU_MASTER_PATH = os.path.join(SCRIPT_DIR, "..", "src", "data", "sku_master.json")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "..", "src", "data", "prestige_catalog_enriched.json")


def normalize_name(name: str) -> str:
    """Normalize product name for matching."""
    name = name.lower().strip()
    # Remove common prefixes
    name = re.sub(r'^prestige\s+', '', name)
    # Remove special chars
    name = re.sub(r'[^\w\s]', ' ', name)
    # Collapse whitespace
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def extract_model_key(model: str) -> str:
    """Extract key from model string for matching."""
    if not model:
        return ""
    return model.lower().strip()


def find_best_match(product_name: str, master_skus: list, asin_index: dict) -> dict | None:
    """Find the best matching SKU master entry for a product.
    
    Strategy:
    1. Try ASIN match from competitor_sku_mappings if available
    2. Try fuzzy name matching against model + category
    """
    norm_name = normalize_name(product_name)
    
    best_match = None
    best_score = 0.0
    
    for sku in master_skus:
        model = sku.get("model", "") or ""
        category = sku.get("category", "") or ""
        subcat_l1 = sku.get("subcategoryL1", "") or ""
        subcat_l2 = sku.get("subcategoryL2", "") or ""
        
        # Build a composite match string from master
        master_str = normalize_name(f"{model} {subcat_l2}")
        
        # Calculate similarity
        score = SequenceMatcher(None, norm_name, master_str).ratio()
        
        # Boost score if category keywords match
        cat_lower = category.lower()
        if cat_lower in norm_name or any(kw in norm_name for kw in cat_lower.split()):
            score += 0.1
        
        # Boost for model number match
        model_lower = model.lower() if model else ""
        if model_lower and model_lower in norm_name:
            score += 0.2
            
        if score > best_score:
            best_score = score
            best_match = sku
    
    # Only accept matches above threshold
    if best_score > 0.4:
        return best_match
    return None


def main():
    # Load files
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)
    with open(SKU_MASTER_PATH, "r", encoding="utf-8") as f:
        master_skus = json.load(f)
    
    print(f"Catalog: {len(catalog)} products")
    print(f"Master: {len(master_skus)} SKUs")
    
    # Build ASIN index from master
    asin_index = {}
    for sku in master_skus:
        asin = sku.get("platformIds", {}).get("amazon")
        if asin:
            asin_index[asin.upper()] = sku
    print(f"Master ASINs indexed: {len(asin_index)}")
    
    # Enrich catalog
    matched = 0
    unmatched = []
    
    for product in catalog:
        # Try matching by product name
        match = find_best_match(product["name"], master_skus, asin_index)
        
        if match:
            matched += 1
            product["paretoStatus"] = match.get("status")
            product["material"] = match.get("material", "Other")
            product["masterCategory"] = match.get("category")
            product["subcategoryL1"] = match.get("subcategoryL1")
            product["subcategoryL2"] = match.get("subcategoryL2")
            product["skuCode"] = match.get("skuCode")
            product["businessSegment"] = match.get("businessSegment")
            product["wattage"] = match.get("wattage")
            product["mrp"] = match.get("mrp")
            product["mop"] = match.get("mop")
            asin = match.get("platformIds", {}).get("amazon")
            if asin:
                product["asin"] = asin
            fsn = match.get("platformIds", {}).get("flipkart")
            if fsn:
                product["fsn"] = fsn
        else:
            unmatched.append(product["name"])
            # Set defaults
            product["paretoStatus"] = None
            product["material"] = "Other"
            product["masterCategory"] = product.get("category")
    
    print(f"\nMatched: {matched}/{len(catalog)}")
    print(f"Unmatched: {len(unmatched)}")
    if unmatched:
        print("\nUnmatched products:")
        for name in unmatched[:30]:
            print(f"  - {name[:80]}")
    
    # Write enriched catalog
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
    print(f"\nWritten enriched catalog to: {OUTPUT_PATH}")
    
    # Stats
    from collections import Counter
    pareto_dist = Counter(p.get("paretoStatus") for p in catalog)
    material_dist = Counter(p.get("material") for p in catalog)
    print(f"\nPareto distribution: {dict(pareto_dist)}")
    print(f"Material distribution: {dict(material_dist)}")


if __name__ == "__main__":
    main()
