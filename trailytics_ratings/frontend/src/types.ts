/**
 * Rating Intelligence System - Type Definitions
 * Multi-tenant, production-level interfaces for review analysis and competitor comparison
 */

// ============================================================================
// CORE REVIEW TYPES
// ============================================================================

export type SentimentLabel = 'Positive' | 'Negative' | 'Neutral';

/**
 * Base review structure from processed JSON data
 */
export interface Review {
    id: number | string;
    date: string;
    rating: number;
    text: string;
    title?: string;
    reviewer?: string;
    verified?: boolean;
    sentiment: SentimentLabel | string;
    polarity: number;
    characteristics: string[];
    product: string;
    category?: string;
    // ML-enhanced fields from pipeline
    sentimentCategory?: SentimentCategory | string;
    subcategory?: string;
    specificIssue?: string;
    qualityScore?: number;
    sentimentScore?: number;
    sentimentConfidence?: number;
    categoryConfidence?: number;
    classificationReasoning?: string;
    competitorMentions?: CompetitorMention[];
    processedAt?: string;
    mlInferredRating?: number;
    // Master-enriched fields (from data pipeline)
    asin?: string;
    actualProductRating?: number;    // Actual platform rating (e.g., Amazon's 3.8★)
    totalRatingCount?: number;       // Total ratings on platform
    paretoStatus?: string;           // 'Pareto' | 'Non-Pareto' | 'NPD' | null
    material?: string;               // Material type from SKU master
    wattage?: string;                // Wattage from SKU master
    masterCategory?: string;         // Category from SKU master
    brand?: string;                  // Brand name from db
    is_competitor?: boolean;         // Is this a competitor review
    platform?: string;               // Platform name
    productName?: string;            // Product name
    // Price fields from product_snapshots
    priceRp?: number;                // MRP (retail price)
    priceSp?: number;                // Selling price
    // Extended PDP metrics from product_snapshots
    pdpPlatformRating?: number;      // Latest PDP rating from snapshot
    pdpTotalRatingCount?: number;    // Total ratings count from PDP
}

/**
 * 8 Core Sentiment Categories for aggregation
 */
export type SentimentCategory =
    | 'General'
    | 'Functionality'
    | 'Pricing'
    | 'Usability'
    | 'Packaging'
    | 'Customer Service'
    | 'Brand Perception'
    | 'Competitor Comparison';

// ============================================================================
// COMPETITOR COMPARISON TYPES
// ============================================================================

/**
 * Competitor brand type — dynamic from DB, not a static const
 */
export type CompetitorBrand = string;

/**
 * Verbatim competitor mention detected in review text
 */
export interface CompetitorMention {
    brand: string;
    context: string;           // Text snippet around mention (±50 chars)
    sentiment: SentimentLabel;
    reviewId: number | string;
    reviewText: string;
    reviewDate: string;
    isFavorable: boolean;      // True if customer prefers Prestige over competitor
}

/**
 * SKU-level mapping: One Prestige product → Multiple competitor products
 */
export interface CompetitorMapping {
    id: string;
    companyId: string;
    ourSku: string;
    ourAsin?: string;
    ourProductName: string;
    competitors: CompetitorProduct[];
    sharedCategory: string;
    createdAt: string;
    updatedAt: string;
}

export interface CompetitorProduct {
    brand: string;
    sku: string;
    asin?: string;
    productName: string;
    mappingType: 'DIRECT_MATCH' | 'CATEGORY_PEER';
}

/**
 * Competitor review (same structure as our reviews)
 */
export interface CompetitorReview {
    id: string;
    companyId: string;
    competitorBrand: string;
    sku: string;
    asin?: string;
    productName: string;
    reviewText: string;
    rating: number;
    date: string;
    characteristics: string[];
    sentiment: SentimentLabel;
    sentimentCategory?: SentimentCategory;
    sentimentScore?: number;
}

// ============================================================================
// BENCHMARKING & ANALYSIS TYPES
// ============================================================================

/**
 * Sentiment comparison between our product and competitor
 */
export interface CompetitorComparison {
    competitorBrand: string;
    competitorProductName: string;
    ourScore: number;           // 0-100 sentiment score
    competitorScore: number;    // 0-100 sentiment score
    delta: number;              // positive = we're winning
    characteristics: CharacteristicGap[];
    reviewQuotes: CompetitorQuote[];
}

export interface CharacteristicGap {
    name: string;
    ourSentiment: SentimentLabel;
    competitorSentiment: SentimentLabel;
    ourScore: number;           // 0-100 based on positive%
    compScore: number;          // 0-100 based on positive%
    gap: number;                // ourScore - compScore
    ourMentions: number;
    compMentions: number;
    isWinning: boolean;
    actionPriority: 'high' | 'medium' | 'low';
}

export interface CompetitorQuote {
    text: string;
    sentiment: SentimentLabel;
    date: string;
    rating: number;
    source: 'our_reviews' | 'competitor_reviews';
    highlightedBrand?: string;
}

/**
 * Category-level aggregated comparison (e.g., all Mixers vs market)
 */
export interface CategoryBenchmark {
    category: string;
    ourProducts: number;
    competitorProducts: number;
    ourAverageScore: number;
    marketAverageScore: number;
    gap: number;
    topGaps: CharacteristicGap[];
    topStrengths: CharacteristicGap[];
}

// ============================================================================
// RADAR CHART DATA
// ============================================================================

/**
 * Data structure for radar/spider chart visualization
 */
export interface RadarChartData {
    category: SentimentCategory | string;
    ourScore: number;       // 0-100
    competitorScore: number; // 0-100
}

// ============================================================================
// DASHBOARD STATE TYPES
// ============================================================================

export interface CompetitorDashboardState {
    selectedProduct: string | null;
    selectedCompetitor: string | null;
    activePanel: 'benchmark' | 'verbatim' | 'category' | null;
    isSlideOutOpen: boolean;
    viewMode: 'sku' | 'category' | 'verbatim';
}

// ============================================================================
// API / CONFIG TYPES
// ============================================================================

export interface CompetitorConfig {
    companyId: string;
    enabledBrands: string[];
    defaultCompetitors: string[];   // Top 3-5 to compare by default
    categoryMappings: Record<string, string[]>; // Product category → competitor brands
}

// ============================================================================
// PERIOD FILTER TYPES
// ============================================================================

export type PeriodKey = '3M' | '6M' | '12M' | '2Y' | '5Y' | 'MAX';

export interface PeriodConfig {
    key: PeriodKey;
    label: string;
    shortLabel: string;
    months: number | null;  // null = MAX (all time)
}

export const PERIOD_OPTIONS: PeriodConfig[] = [
    { key: '3M', label: '3 Months', shortLabel: '3M', months: 3 },
    { key: '6M', label: '6 Months', shortLabel: '6M', months: 6 },
    { key: '12M', label: '1 Year', shortLabel: '12M', months: 12 },
    { key: '2Y', label: '2 Years', shortLabel: '2Y', months: 24 },
    { key: '5Y', label: '5 Years', shortLabel: '5Y', months: 60 },
    { key: 'MAX', label: 'All Time', shortLabel: 'MAX', months: null }
];

export interface PeriodFilterState {
    selectedPeriod: PeriodKey;
    dateRange: { start: Date; end: Date };
    comparisonRange: { start: Date; end: Date };  // For delta calculations
}

