/**
 * Product Category Extractor
 * Extracts product categories and subcategories from product names
 * Used for the dual-hierarchy drill-down in Categories tab
 * 
 * Hierarchy: Product Category → Product Subcategory (from product name)
 * Example: "Prestige Iris 750 Watt Mixer Grinder" → Category: "Mixer Grinder", Subcategory: "750W"
 */

export interface ProductCategoryRule {
    category: string;
    keywords: string[];          // match any of these in product name (case-insensitive)
    excludeKeywords?: string[];  // exclude if any of these match
    specExtractor?: (productName: string) => string | null;  // extract spec/subcategory
}

/**
 * Product category rules — config-driven, no hardcoded logic
 * Order matters: first match wins
 */
export const PRODUCT_CATEGORY_RULES: ProductCategoryRule[] = [
    // ── Specific categories FIRST so they match before broad Prestige-prefix rules ──
    {
        category: 'Gas Stove',
        keywords: ['gas stove', 'gas table', 'gas hob', 'burner gas', 'gtsd', 'manual gas', 'hobtop', 'hob cooktop', 'cooktop'],
        excludeKeywords: ['induction'],
        specExtractor: (name) => {
            const lower = name.toLowerCase();
            // Hobs: "hobtop", "hob cooktop", "hob", "top hob" — premium built-in style
            if (/\bhob\b|hobtop/i.test(lower)) return 'Hobs';
            // Glass Top: "glass top", "toughened glass", "glass gas stove"
            if (/glass\s*top|toughened\s+glass|glass\s+(manual|auto|gas)/i.test(lower)) return 'Glass Top';
            // Stainless Steel: explicit mention or default for steel body stoves
            if (/stainless\s+steel/i.test(lower)) return 'Stainless Steel';
            return null;
        },
    },
    {
        category: 'Induction Cooktop',
        keywords: ['induction cooktop', 'induction cook top', 'induction cook-top', 'induction stove', 'induction plate'],
        excludeKeywords: [
            'induction bottom',       // "Induction Bottom Pressure Cooker" is a cooker, not a cooktop
            'induction base',         // "Induction Base" = cookware feature
            'induction compatible',   // cookware feature
            'pressure cooker',
            'tawa', 'kadai', 'kadhai', 'fry pan', 'frying pan',
        ],
        specExtractor: (name) => {
            const wattMatch = name.match(/(\d{3,4})\s*(watt|w\b)/i);
            if (wattMatch) return `${wattMatch[1]}W`;
            return null;
        },
    },
    {
        category: 'Dosa Tawa',
        keywords: ['dosa tawa', 'dosa maker', 'dosa pan'],
        specExtractor: (name) => {
            const sizeMatch = name.match(/(\d+)\s*(cm|mm|inch)/i);
            if (sizeMatch) return `${sizeMatch[1]}${sizeMatch[2]}`;
            return null;
        },
    },
    // ── Cookware Set BEFORE Tawa so "3 Pc Cookware Set with...Tawa" matches Set ──
    {
        category: 'Cookware Set',
        keywords: ['cookware set', 'cookware combo', 'kitchen set', 'non-stick set', 'nonstick set', 'pc set', 'pc cookware'],
    },
    {
        category: 'Tawa',
        keywords: ['tawa', 'roti tawa', 'concave tawa', 'flat tawa', 'pathiri tawa', 'chapati tawa'],
        excludeKeywords: ['cookware set', 'cookware combo', 'pc set'],  // cookware sets sometimes mention tawa
        specExtractor: (name) => {
            const sizeMatch = name.match(/(\d+)\s*(cm|mm|inch)/i);
            if (sizeMatch) return `${sizeMatch[1]}${sizeMatch[2]}`;
            return null;
        },
    },
    {
        category: 'Fry Pan',
        keywords: ['fry pan', 'frying pan', 'frypan'],
        excludeKeywords: ['cookware set', 'cookware combo', 'pc set'],
        specExtractor: (name) => {
            const sizeMatch = name.match(/(\d+)\s*(cm|mm)/i);
            if (sizeMatch) return `${sizeMatch[1]}${sizeMatch[2]}`;
            return null;
        },
    },
    {
        category: 'Kadai',
        keywords: ['kadai', 'kadhai', 'karahi'],
        excludeKeywords: ['cookware set', 'cookware combo', 'pc set'],
        specExtractor: (name) => {
            const sizeMatch = name.match(/(\d+\.?\d*)\s*(litre|liter|ltr|l\b|cm)/i);
            if (sizeMatch) return `${sizeMatch[1]}${sizeMatch[2].toUpperCase()}`;
            return null;
        },
    },
    {
        category: 'Mixer Grinder',
        keywords: ['mixer grinder', 'mixer-grinder'],
        specExtractor: (name) => {
            const wattMatch = name.match(/(\d{3,4})\s*(watt|w\b)/i);
            if (wattMatch) return `${wattMatch[1]}W`;
            return null;
        },
    },
    // ── Pressure Cooker — broad Prestige prefixes AFTER specific types ──
    // Note: 'handi' removed from excludes — "Handi Pressure Cooker" is a valid pressure cooker variant
    // Note: 'pressure pan' added as keyword — "Deep Pressure Pan" is a pressure cooker variant
    {
        category: 'Pressure Cooker',
        keywords: ['pressure cooker', 'pressure pan', 'prestige popular', 'prestige deluxe', 'prestige nakshatra', 'prestige svachh'],
        excludeKeywords: [
            'induction cooktop', 'induction cook',
            'tawa', 'gas stove', 'gas table', 'gas hob', 'gtsd',
            'fry pan', 'frying pan', 'frypan',
            'kadai', 'kadhai', 'karahi',
            'mixer grinder', 'mixer-grinder',
            'kettle', 'toaster', 'otg', 'sandwich',
            'iron box', 'steam iron', 'dry iron',
            'cookware set', 'cookware combo',
            'rice cooker',
        ],
        specExtractor: (name) => {
            // Extract capacity: "3 Litre", "5 L", etc.
            const capMatch = name.match(/(\d+\.?\d*)\s*(litre|liter|ltr|l\b)/i);
            if (capMatch) return `${capMatch[1]}L`;
            return null;
        },
    },
    {
        category: 'Air Fryer',
        keywords: ['air fryer', 'airfryer'],
        specExtractor: (name) => {
            const wattMatch = name.match(/(\d{3,4})\s*(watt|w\b)/i);
            if (wattMatch) return `${wattMatch[1]}W`;
            return null;
        },
    },
    {
        category: 'Rice Cooker',
        keywords: ['rice cooker', 'electric rice'],
        specExtractor: (name) => {
            const wattMatch = name.match(/(\d{3,4})\s*(watt|w\b)/i);
            if (wattMatch) return `${wattMatch[1]}W`;
            return null;
        },
    },
    {
        category: 'Kettle',
        keywords: ['kettle', 'electric kettle', 'multi cooker kettle'],
        specExtractor: (name) => {
            const wattMatch = name.match(/(\d{3,4})\s*(watt|w\b)/i);
            if (wattMatch) return `${wattMatch[1]}W`;
            return null;
        },
    },
    {
        category: 'Wet Grinder',
        keywords: ['wet grinder', 'table top grinder'],
        specExtractor: (name) => {
            const wattMatch = name.match(/(\d{3,4})\s*(watt|w\b)/i);
            if (wattMatch) return `${wattMatch[1]}W`;
            return null;
        },
    },
    {
        category: 'Toaster & OTG',
        keywords: ['toaster', 'otg', 'oven toaster', 'sandwich maker'],
        specExtractor: (name) => {
            const wattMatch = name.match(/(\d{3,4})\s*(watt|w\b)/i);
            if (wattMatch) return `${wattMatch[1]}W`;
            return null;
        },
    },
    {
        category: 'Iron',
        keywords: ['iron', 'steam iron', 'dry iron'],
        excludeKeywords: ['cast iron'],  // cast iron cookware is not an iron appliance
        specExtractor: (name) => {
            const wattMatch = name.match(/(\d{3,4})\s*(watt|w\b)/i);
            if (wattMatch) return `${wattMatch[1]}W`;
            return null;
        },
    },
    {
        category: 'Other Cookware',
        keywords: ['pan', 'pot', 'saucepan', 'handi', 'casserole', 'appachetty', 'steamer',
            'non-stick cookware', 'stainless steel cookware', 'cookware'],
        excludeKeywords: ['pressure cooker', 'pressure pan', 'cookware set', 'cookware combo'],
    },
];

/**
 * Extract product category and optional spec subcategory from product name
 */
export function extractProductCategory(productName: string, dbCategory?: string): { category: string; spec: string | null } {
    const nameLower = productName.toLowerCase();

    // 1. If we have a reliable database category, use it and extract its specific metric
    if (dbCategory && dbCategory !== 'Other' && dbCategory !== 'Uncategorized') {
        const exactRule = PRODUCT_CATEGORY_RULES.find(r => r.category === dbCategory);
        if (exactRule) {
            const spec = exactRule.specExtractor ? exactRule.specExtractor(productName) : null;
            return { category: dbCategory, spec };
        }
        return { category: dbCategory, spec: null };
    }

    // 2. Fallback to regex heuristic extraction
    for (const rule of PRODUCT_CATEGORY_RULES) {
        // Check exclude keywords first
        if (rule.excludeKeywords?.some(kw => nameLower.includes(kw.toLowerCase()))) {
            continue;
        }

        // Check match keywords
        if (rule.keywords.some(kw => nameLower.includes(kw.toLowerCase()))) {
            const spec = rule.specExtractor ? rule.specExtractor(productName) : null;
            return { category: rule.category, spec };
        }
    }

    return { category: 'Other', spec: null };
}

/**
 * Get all unique product categories from a list of product names
 */
export function getProductCategories(productNames: string[]): Map<string, number> {
    const catMap = new Map<string, number>();
    productNames.forEach(name => {
        const { category } = extractProductCategory(name);
        catMap.set(category, (catMap.get(category) || 0) + 1);
    });
    return catMap;
}
