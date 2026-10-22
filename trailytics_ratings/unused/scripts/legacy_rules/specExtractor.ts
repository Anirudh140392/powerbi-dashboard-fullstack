/**
 * Product Spec Extractor
 * Parses product specifications (wattage, capacity, burners, price range) from product titles
 * Used for the Segment Matrix competitor comparison
 */

import type { ProductSpec } from '../types/filterTypes';

// ============================================================================
// SPEC EXTRACTION PATTERNS
// ============================================================================

const WATTAGE_PATTERN = /(\d+)\s*[Ww](?:att)?(?:s)?\b/i;
const CAPACITY_PATTERN = /(\d+\.?\d*)\s*(?:[Ll](?:i?t?r?e?s?)?|LTR)\b/i;
const BURNER_PATTERN = /(\d+)\s*[Bb]urner/i;



// Price range buckets — derived from market segments
const PRICE_RANGES = [
    { label: '₹0-1000', min: 0, max: 1000 },
    { label: '₹1000-2000', min: 1000, max: 2000 },
    { label: '₹2000-3000', min: 2000, max: 3000 },
    { label: '₹3000-5000', min: 3000, max: 5000 },
    { label: '₹5000-8000', min: 5000, max: 8000 },
    { label: '₹8000-12000', min: 8000, max: 12000 },
    { label: '₹12000+', min: 12000, max: Infinity },
];

// Category → spec type mapping (config-driven, no hardcoded assumptions)
const CATEGORY_SPEC_MAP: Record<string, 'wattage' | 'capacity' | 'burners' | 'generic'> = {
    'mixer grinder': 'wattage',
    'mixer': 'wattage',
    'juicer mixer grinder': 'wattage',
    'hand blender': 'wattage',
    'electric kettle': 'capacity',
    'kettle': 'capacity',
    'rice cooker': 'capacity',
    'pressure cooker': 'capacity',
    'cooker': 'capacity',
    'induction cooktop': 'wattage',
    'induction': 'wattage',
    'sandwich maker': 'wattage',
    'toaster': 'wattage',
    'air fryer': 'capacity',
    'oven toaster grill': 'capacity',
    'otg': 'capacity',
    'gas stove': 'burners',
    'gas table': 'burners',
    'hob': 'burners',
    'stainless steel': 'capacity',
    'cookware': 'generic',
    'pan': 'generic',
    'tawa': 'generic',
    'kadai': 'generic',
};

/**
 * Extract product specs from a product title string
 */
export function extractSpecs(productTitle: string, price?: number): ProductSpec {
    const title = productTitle || '';

    // Extract wattage
    const wattMatch = title.match(WATTAGE_PATTERN);
    const wattage = wattMatch ? parseInt(wattMatch[1], 10) : null;

    // Extract capacity
    const capMatch = title.match(CAPACITY_PATTERN);
    const capacity = capMatch ? parseFloat(capMatch[1]) : null;

    // Extract burners
    const burnerMatch = title.match(BURNER_PATTERN);
    const burners = burnerMatch ? parseInt(burnerMatch[1], 10) : null;

    // Determine price range
    const priceRange = price != null
        ? PRICE_RANGES.find(r => price >= r.min && price < r.max)?.label || '₹12000+'
        : null;

    // Determine spec tier
    let specTier = 'Other';
    let specType: ProductSpec['specType'] = 'generic';

    if (wattage) {
        specTier = `${wattage}W`;
        specType = 'wattage';
    } else if (capacity) {
        specTier = `${capacity}L`;
        specType = 'capacity';
    } else if (burners) {
        specTier = `${burners}-Burner`;
        specType = 'burners';
    }

    return { wattage, capacity, burners, priceRange, specTier, specType };
}

/**
 * Determine the expected spec type for a given category name
 */
export function getSpecTypeForCategory(categoryName: string): 'wattage' | 'capacity' | 'burners' | 'generic' {
    const lower = (categoryName || '').toLowerCase().trim();
    for (const [key, type] of Object.entries(CATEGORY_SPEC_MAP)) {
        if (lower.includes(key)) return type;
    }
    return 'generic';
}

/**
 * Get spec tier label for display
 */
export function getSpecTierLabel(specType: 'wattage' | 'capacity' | 'burners' | 'generic'): string {
    switch (specType) {
        case 'wattage': return 'Power (Watts)';
        case 'capacity': return 'Capacity (Litres)';
        case 'burners': return 'Burners';
        default: return 'Specification';
    }
}

/**
 * Sort spec tiers naturally (numeric order)
 */
export function sortSpecTiers(tiers: string[]): string[] {
    return [...tiers].sort((a, b) => {
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });
}

/**
 * Get all price ranges (config-driven)
 */
export function getPriceRanges(): { label: string; min: number; max: number }[] {
    return [...PRICE_RANGES];
}

/**
 * Get price range for a value
 */
export function getPriceRangeLabel(price: number): string {
    return PRICE_RANGES.find(r => price >= r.min && price < r.max)?.label || '₹12000+';
}
