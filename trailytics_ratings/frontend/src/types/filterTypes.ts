/**
 * Global Filter System — Type Definitions
 * Config-driven, multi-tenant filter types for the Prestige Dashboard V2
 */

// ============================================================================
// PLATFORM TYPES
// ============================================================================

export interface PlatformOption {
    id: string;
    label: string;
    icon: string;       // emoji or icon key
    isActive: boolean;  // has data available
    color: string;      // brand color
}

// ============================================================================
// BRAND FILTER TYPES
// ============================================================================

export type BrandScope = 'all' | 'prestige' | 'competition';

// ============================================================================
// CATEGORY FILTER TYPES  
// ============================================================================

export interface CategoryNode {
    id: string;
    label: string;
    parentId: string | null;
    reviewCount: number;
    children: CategoryNode[];
    classification?: ProductClassification;
}

export type ProductClassification = 'pareto' | 'non-pareto' | 'non-pareto-unclassified' | 'npd' | 'healthy' | 'needs-attention' | 'ni';

/**
 * Rating Bifurcation — sub-filter within a Pareto/Non-Pareto/NPD bucket.
 * Maps to the executive-health health_status values.
 *   NP    = No Problem  (pdp_rating >= 4.2)
 *   Issue = Has Issues  (pdp_rating <  4.0)
 *   NI    = No Issue    (4.0 <= pdp_rating < 4.2)
 */
export type RatingBifurcation = 'NP' | 'Issue' | 'NI';

export interface CategoryFilterState {
    selectedCategory: string | null;
    selectedSubcategory: string | null;
    classification: ProductClassification | 'all';
}

// ============================================================================
// SKU FILTER TYPES
// ============================================================================

export interface SkuOption {
    id: string;
    label: string;
    product: string;
    category: string;
    brand: string;
    reviewCount: number;
}

// ============================================================================
// DATE RANGE TYPES
// ============================================================================

export type DatePreset = '1M' | '3M' | '6M' | '12M' | '2Y' | 'MAX' | 'custom';

export interface DateRangeState {
    preset: DatePreset;
    startDate: Date;
    endDate: Date;
}

// ============================================================================
// COMPOSITE FILTER STATE
// ============================================================================

export type CompetitorPlatformFilter = 'all' | 'Amazon' | 'Flipkart';
export type PriceFilterMode = 'rp' | 'sp';

export interface GlobalFilterState {
    platform: string;
    brandScope: BrandScope;
    category: CategoryFilterState;
    productCategory: string | null;  // Product type: Pressure Cooker, Gas Stove, etc.
    sku: string | null;
    /** Rating Bifurcation drill-down: NP / Issue / NI (null = show all) */
    ratingBifurcation: RatingBifurcation | null;
    dateRange: DateRangeState;
    competitorPlatform: CompetitorPlatformFilter;
    /** Trend comparison delta in months (e.g., compare last 3 months vs previous 3 months) */
    trendPeriodMonths?: number;
    priceMode: PriceFilterMode;
    priceRange: { min: number; max: number } | null;
    searchTerm: string;
    brand: string | null;
}

export interface FilteredDataResult {
    prestigeReviews: unknown[];
    competitorReviews: unknown[];
    totalPrestigeCount: number;
    totalCompetitorCount: number;
    availableCategories: string[];
    availableSubcategories: string[];
    availableSkus: SkuOption[];
    availableBrands: string[];
}

// ============================================================================
// PRODUCT SPEC TYPES (for Segment Matrix)
// ============================================================================

export interface ProductSpec {
    wattage: number | null;
    capacity: number | null;      // in Liters
    burners: number | null;       // for gas stoves
    priceRange: string | null;    // e.g., "₹1000-2000"
    specTier: string;             // e.g., "500W", "2L", "3-Burner"
    specType: 'wattage' | 'capacity' | 'burners' | 'generic';
}

export interface SegmentCell {
    specTier: string;
    priceRange: string;
    products: SegmentProduct[];
}

export interface SegmentProduct {
    brand: string;
    productName: string;
    rating: number;
    reviewCount: number;
    qualityScore: number;
    sentimentPositive: number;
    product: string;
}

// ============================================================================
// QUALITY BUCKET TYPES (for drill-down)
// ============================================================================

export interface QualityBucket {
    id: string;
    label: string;
    count: number;
    percentage: number;        // % of total reviews
    trend: 'up' | 'down' | 'stable';
    trendDelta: number;        // % change from previous period
    severity: 'critical' | 'warning' | 'info';
    keywords: string[];
    sampleReviews: string[];
}

export interface CategoryDrilldownState {
    level: 'overview' | 'buckets' | 'reviews';
    selectedCategory: string | null;
    selectedBucket: string | null;
}
