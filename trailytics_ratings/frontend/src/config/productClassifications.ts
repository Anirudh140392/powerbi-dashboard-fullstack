/**
 * Product Classifications Config
 * Config-driven classifications: Pareto, Non-Pareto, Non-Pareto (Unclassified), NPD
 * Data comes from SKU Master (Excel), NOT regex patterns
 */

// ============================================================================
// CLASSIFICATION TYPES
// ============================================================================

export type ProductClassification = 'pareto' | 'non-pareto' | 'non-pareto-unclassified' | 'npd' | 'healthy' | 'needs-attention' | 'ni';

interface ClassificationRule {
    type: ProductClassification;
    /** The exact value stored in paretoStatus field from the data pipeline */
    dataValue: string;
    label: string;
    description: string;
    color: string;
    bgColor: string;
    darkBgColor: string;
    icon: string;
    /** If true, this is a virtual filter (client-side rating-based), not a DB pareto_status value */
    virtual?: boolean;
}

export const CLASSIFICATION_RULES: ClassificationRule[] = [
    {
        type: 'pareto',
        dataValue: 'Pareto',
        label: 'Pareto',
        description: 'Top-selling, high-impact SKUs',
        color: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-50',
        darkBgColor: 'dark:bg-emerald-900/20',
        icon: '🏆',
    },
    {
        type: 'non-pareto',
        dataValue: 'Non-Pareto',
        label: 'Non-Pareto',
        description: 'Classified catalog products (in SKU master)',
        color: 'text-slate-600 dark:text-slate-400',
        bgColor: 'bg-slate-50',
        darkBgColor: 'dark:bg-slate-800',
        icon: '📦',
    },
    {
        type: 'non-pareto-unclassified',
        dataValue: 'Non-Pareto (Unclassified)',
        label: 'Unclassified',
        description: 'Products not in SKU master — treated as Non-Pareto',
        color: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-50',
        darkBgColor: 'dark:bg-amber-900/20',
        icon: '❓',
    },
    {
        type: 'npd',
        dataValue: 'NPD',
        label: 'NPD',
        description: 'New Product Development — recently launched',
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50',
        darkBgColor: 'dark:bg-purple-900/20',
        icon: '🆕',
    },
    {
        type: 'healthy',
        dataValue: '__healthy__',
        label: '≥4.0 Healthy',
        description: 'Products with platform rating ≥4.0',
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50',
        darkBgColor: 'dark:bg-green-900/20',
        icon: '💚',
        virtual: true,
    },
    {
        type: 'needs-attention',
        dataValue: '__needs_attention__',
        label: '<4.0 Attention',
        description: 'Products with platform rating <4.0 — needs improvement',
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50',
        darkBgColor: 'dark:bg-red-900/20',
        icon: '⚠️',
        virtual: true,
    },
    {
        type: 'ni',
        dataValue: '__ni__',
        label: 'NI (≥4.2)',
        description: 'No Issues — consistently rated ≥4.2, can be skipped',
        color: 'text-teal-600 dark:text-teal-400',
        bgColor: 'bg-teal-50',
        darkBgColor: 'dark:bg-teal-900/20',
        icon: '✅',
        virtual: true,
    },
];

// ============================================================================
// CATEGORY CLASSIFICATION BASIS — per-category sub-segmentation rules
// Defines what dimension (material, wattage, capacity, size, burner count)
// is used to sub-classify products within each product category.
// ============================================================================

export interface CategoryClassificationBasis {
    /** The segmentation dimension: Material (cookware) or Wattage (appliances) */
    basis: 'material' | 'wattage';
    /** Human-readable label for the dimension */
    label: string;
    /** Allowed values (used for grouping; unmatched reviews fall into "Other") */
    values: string[];
}

/**
 * Classification basis per product category — the SINGLE SOURCE OF TRUTH.
 *
 * User-defined classification (Kathirvel / Prestige):
 *   Material: Pressure Cooker, Cookware (all sub-types), Gas Stove
 *   Wattage:  Mixer Grinder, Wet Grinder, Nutri Mix, Induction, all other appliances
 */
export const CATEGORY_CLASSIFICATION_BASIS: Record<string, CategoryClassificationBasis> = {
    // ── Material-basis categories (cookware) ──
    'Pressure Cooker':    { basis: 'material',  label: 'Material',  values: ['Aluminium', 'Hard Anodised', 'Stainless Steel', 'Triply'] },
    'Other Cookware':     { basis: 'material',  label: 'Material',  values: ['Aluminium', 'Hard Anodised', 'Stainless Steel', 'Triply', 'Cast Iron', 'Non-Stick'] },
    'Fry Pan':            { basis: 'material',  label: 'Material',  values: ['Aluminium', 'Hard Anodised', 'Stainless Steel', 'Non-Stick'] },
    'Kadai':              { basis: 'material',  label: 'Material',  values: ['Aluminium', 'Hard Anodised', 'Stainless Steel', 'Non-Stick'] },
    'Tawa':               { basis: 'material',  label: 'Material',  values: ['Aluminium', 'Hard Anodised', 'Stainless Steel', 'Non-Stick'] },
    'Dosa Tawa':          { basis: 'material',  label: 'Material',  values: ['Aluminium', 'Hard Anodised', 'Non-Stick'] },
    'Cookware Set':       { basis: 'material',  label: 'Material',  values: ['Aluminium', 'Hard Anodised', 'Stainless Steel', 'Non-Stick'] },
    'Gas Stove':          { basis: 'material',  label: 'Material',  values: ['Glass Top', 'Stainless Steel', 'Hobs'] },

    // ── Wattage-basis categories (appliances) ──
    'Mixer Grinder':      { basis: 'wattage',   label: 'Wattage',   values: ['500W', '750W', '1000W'] },
    'Wet Grinder':        { basis: 'wattage',   label: 'Wattage',   values: ['150W', '200W', '250W'] },
    'Induction Cooktop':  { basis: 'wattage',   label: 'Wattage',   values: ['1200W', '1600W', '1800W', '2000W'] },
    'Iron':               { basis: 'wattage',   label: 'Wattage',   values: ['750W', '1000W', '1200W', '1600W'] },
    'Air Fryer':          { basis: 'wattage',   label: 'Wattage',   values: ['1200W', '1400W', '1500W', '1700W'] },
    'Rice Cooker':        { basis: 'wattage',   label: 'Wattage',   values: ['350W', '500W', '700W', '900W'] },
    'Kettle':             { basis: 'wattage',   label: 'Wattage',   values: ['1000W', '1500W', '1800W', '2000W'] },
    'Toaster & OTG':      { basis: 'wattage',   label: 'Wattage',   values: ['800W', '1200W', '1500W', '1800W', '2000W'] },
};

/**
 * Get classification basis for a product category.
 * Returns null if no specific sub-segmentation is defined.
 */
export function getCategoryClassificationBasis(category: string): CategoryClassificationBasis | null {
    return CATEGORY_CLASSIFICATION_BASIS[category] || null;
}

/**
 * Convenience: get just the basis type ('material' | 'wattage') for a category.
 * Defaults to 'wattage' for unconfigured categories (other appliances).
 */
export function getBasisType(category: string): 'material' | 'wattage' {
    return CATEGORY_CLASSIFICATION_BASIS[category]?.basis || 'wattage';
}

// ============================================================================
// MATERIAL NORMALIZATION — maps raw DB values → client classification buckets
// ============================================================================

/**
 * Per-category mapping of raw DB material values → client classification values.
 * Keys are lowercase for case-insensitive matching.
 * Only categories with non-obvious mappings need entries here.
 */
const MATERIAL_NORMALIZATION_MAP: Record<string, Record<string, string>> = {
    'Gas Stove': {
        'glass':            'Glass Top',
        'toughened glass':  'Glass Top',
        'glass-ceramic':    'Glass Top',
        'glass top':        'Glass Top',
        'stainless steel':  'Stainless Steel',
        // Hobs detected from product name, not material field
    },
    'Pressure Cooker': {
        'aluminium':        'Aluminium',
        'aluminum':         'Aluminium',
        'hard anodised':    'Hard Anodised',
        'hard anodized':    'Hard Anodised',
        'stainless steel':  'Stainless Steel',
        'triply':           'Triply',
        'tri-ply':          'Triply',
        'tri ply':          'Triply',
    },
};

/**
 * Normalize a raw DB material value to the client's classification bucket.
 * Returns null if the value doesn't map to any configured bucket (should be skipped).
 *
 * @param category  - Product category (e.g. "Gas Stove")
 * @param rawMaterial - Raw material field from DB (e.g. "Toughened Glass")
 * @param productName - Product name (used for Hobs detection in Gas Stove)
 */
export function normalizeMaterial(
    category: string,
    rawMaterial: string,
    productName?: string,
): string | null {
    const config = CATEGORY_CLASSIFICATION_BASIS[category];
    if (!config || config.basis !== 'material') return rawMaterial || null;

    // Gas Stove special: detect Hobs from product name first
    if (category === 'Gas Stove' && productName) {
        if (/\bhob\b|hobtop/i.test(productName)) return 'Hobs';
    }

    const normalizedRaw = (rawMaterial || '').trim().toLowerCase();
    if (!normalizedRaw || normalizedRaw === 'unknown' || normalizedRaw === 'n/a') return null;

    // Check per-category normalization map first
    const catMap = MATERIAL_NORMALIZATION_MAP[category];
    if (catMap && catMap[normalizedRaw]) {
        return catMap[normalizedRaw];
    }

    // Fallback: check if the raw value is in the allowed values list (case-insensitive)
    const allowedLower = config.values.map(v => v.toLowerCase());
    const matchIdx = allowedLower.indexOf(normalizedRaw);
    if (matchIdx >= 0) return config.values[matchIdx];

    // Partial match: "non-stick" → "Non-Stick", "cast iron" → "Cast Iron"
    for (const allowed of config.values) {
        if (normalizedRaw.includes(allowed.toLowerCase()) || allowed.toLowerCase().includes(normalizedRaw)) {
            return allowed;
        }
    }

    // No match — skip this review from classification breakdown
    return null;
}

// ============================================================================
// RATING HEALTH THRESHOLDS
// ============================================================================

/** Products with rating >= this are flagged "No Issues" (NI) */
export const NI_RATING_THRESHOLD = 4.2;

/** Pareto sub-split threshold: ≥4.0 vs <4.0 */
export const PARETO_HEALTH_THRESHOLD = 4.0;

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Get classification metadata for display
 */
export function getClassificationMeta(type: ProductClassification): ClassificationRule {
    return CLASSIFICATION_RULES.find(r => r.type === type) || CLASSIFICATION_RULES[1];
}

/**
 * Get all classification options for filter dropdown
 * Groups: Base classifications, then separator, then Health sub-splits
 */
export function getClassificationOptions(): { value: ProductClassification | 'all'; label: string; icon: string; group?: string }[] {
    const base = CLASSIFICATION_RULES.filter(r => !r.virtual).map(r => ({
        value: r.type,
        label: r.label,
        icon: r.icon,
        group: 'classification',
    }));
    const health = CLASSIFICATION_RULES.filter(r => r.virtual).map(r => ({
        value: r.type,
        label: r.label,
        icon: r.icon,
        group: 'health',
    }));
    return [
        { value: 'all', label: 'All Types', icon: '📋' },
        ...base,
        ...health,
    ];
}

/**
 * Map a paretoStatus data value to its classification type
 */
export function getClassificationFromStatus(paretoStatus: string | null | undefined): ProductClassification {
    if (!paretoStatus) return 'non-pareto-unclassified';
    const rule = CLASSIFICATION_RULES.find(r => r.dataValue === paretoStatus);
    return rule?.type || 'non-pareto-unclassified';
}
