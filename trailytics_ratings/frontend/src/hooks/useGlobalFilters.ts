/**
 * useGlobalFilters — Custom Hook
 * Encapsulates all global filter state and derived filtered data
 * Every page receives pre-filtered reviews from this hook
 * 
 * Classification now uses master-driven paretoStatus (Pareto/Non-Pareto/NPD)
 * instead of regex-based patterns.
 */

import { useState, useMemo, useCallback } from 'react';
import { getActiveBrandName } from '../utils/tenant';
import type { Review } from '../types';
import type {
    GlobalFilterState,
    BrandScope,
    DatePreset,
    SkuOption,
    ProductClassification,
    CompetitorPlatformFilter,
    RatingBifurcation,
    PriceFilterMode,
} from '../types/filterTypes';
import { CLASSIFICATION_RULES, PARETO_HEALTH_THRESHOLD, NI_RATING_THRESHOLD } from '../config/productClassifications';

// ============================================================================
// DATE UTILITIES
// ============================================================================

function getDateRangeForPreset(preset: DatePreset): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (preset) {
        case '1M': startDate.setMonth(startDate.getMonth() - 1); break;
        case '3M': startDate.setMonth(startDate.getMonth() - 3); break;
        case '6M': startDate.setMonth(startDate.getMonth() - 6); break;
        case '12M': startDate.setFullYear(startDate.getFullYear() - 1); break;
        case '2Y': startDate.setFullYear(startDate.getFullYear() - 2); break;
        case 'MAX': startDate.setFullYear(2000); break;
        default: startDate.setFullYear(startDate.getFullYear() - 1);
    }

    return { startDate, endDate };
}

// ============================================================================
// HOOK
// ============================================================================

interface UseGlobalFiltersProps {
    allPrestigeReviews: Review[];
    allCompetitorReviews: Array<{
        date: string;
        brand?: string;
        rating: number;
        sentiment?: string;
        sentimentCategory?: string;
        subcategory?: string;
        product?: string;
        productName?: string;
        text?: string;
        platform?: string;
    }>;
    /** Sentiment categories from the server summary API — used when review arrays are empty */
    serverSentimentCategories?: string[];
    serverPlatforms?: string[];
    serverParetoStatuses?: string[];
}

export interface GlobalFilterResult {
    // Filter state
    filters: GlobalFilterState;

    // Setters
    setPlatform: (platform: string) => void;
    setBrandScope: (scope: BrandScope) => void;
    setCategory: (category: string | null) => void;
    setProductCategory: (productCategory: string | null) => void;
    setSubcategory: (subcategory: string | null) => void;
    setClassification: (classification: ProductClassification | 'all') => void;
    setSku: (sku: string | null) => void;
    setRatingBifurcation: (bifurcation: RatingBifurcation | null) => void;
    setDatePreset: (preset: DatePreset) => void;
    setTrendPeriodMonths: (months: number | undefined) => void;
    setCompetitorPlatform: (platform: CompetitorPlatformFilter) => void;
    setPriceMode: (mode: PriceFilterMode) => void;
    setPriceRange: (priceRange: { min: number; max: number } | null) => void;
    setSearchTerm: (term: string) => void;
    resetFilters: () => void;

    // Filtered data
    filteredPrestigeReviews: Review[];
    filteredCompetitorReviews: typeof allCompetitorReviewsType;

    // Derived options (for dropdowns)
    availablePlatforms: { id: string; label: string; icon: string; isActive: boolean; color: string }[];
    availableCategories: string[];
    availableSubcategories: string[];
    availableSkus: SkuOption[];
    availableBrands: string[];
    availableParetoStatuses: string[];

    // Metrics
    totalPrestigeCount: number;
    totalCompetitorCount: number;
}

// Type ref for competitor reviews
type CompetitorReviewType = UseGlobalFiltersProps['allCompetitorReviews'][0];
const allCompetitorReviewsType: CompetitorReviewType[] = [];
void allCompetitorReviewsType; // suppress unused

const DEFAULT_FILTERS: GlobalFilterState = {
    // Was hardcoded to 'Amazon' (capital A) which the platform-options dropdown
    // (lowercase 'amazon'/'flipkart') failed to find — so the pill label fell
    // back to "All" while the backend was silently filtered to Amazon-only,
    // hiding 335K Flipkart reviews. 'all' is the sentinel every endpoint
    // already special-cases as "no platform filter".
    platform: 'all',
    // Default scope = Prestige so the dashboard opens on the brand the user owns.
    // SCOPE=All mixes competitor data into the header strip without labeling it,
    // which confuses the SKU count (3,418 mixed vs 960 Prestige-only) and every
    // weighted average. Users can still flip to All / Competition explicitly.
    brandScope: 'prestige',
    category: {
        selectedCategory: null,
        selectedSubcategory: null,
        classification: 'all',
    },
    productCategory: null,
    sku: null,
    ratingBifurcation: null,
    dateRange: {
        preset: '6M',
        ...getDateRangeForPreset('6M'),
    },
    trendPeriodMonths: 6,
    competitorPlatform: 'all',
    priceMode: 'sp',
    priceRange: null,
    searchTerm: '',
};

export function useGlobalFilters({ allPrestigeReviews, allCompetitorReviews, serverSentimentCategories, serverPlatforms, serverParetoStatuses }: UseGlobalFiltersProps): GlobalFilterResult {
    const [filters, setFilters] = useState<GlobalFilterState>(DEFAULT_FILTERS);

    // --- Setters ---
    const setPlatform = useCallback((platform: string) => {
        setFilters(prev => ({ ...prev, platform }));
    }, []);

    const setBrandScope = useCallback((brandScope: BrandScope) => {
        setFilters(prev => ({ ...prev, brandScope }));
    }, []);

    const setCategory = useCallback((selectedCategory: string | null) => {
        setFilters(prev => ({
            ...prev,
            category: { ...prev.category, selectedCategory, selectedSubcategory: null },
            sku: null,
        }));
    }, []);

    const setProductCategory = useCallback((productCategory: string | null) => {
        setFilters(prev => ({
            ...prev,
            productCategory,
            sku: null,
            category: {
                ...prev.category,
                selectedCategory: null
            }
        }));
    }, []);

    const setSubcategory = useCallback((selectedSubcategory: string | null) => {
        setFilters(prev => ({
            ...prev,
            category: { ...prev.category, selectedSubcategory },
            sku: null,
        }));
    }, []);

    const setClassification = useCallback((classification: ProductClassification | 'all') => {
        setFilters(prev => ({
            ...prev,
            category: { ...prev.category, classification },
            // Reset bifurcation when classification changes
            ratingBifurcation: null,
            sku: null,
        }));
    }, []);

    const setRatingBifurcation = useCallback((ratingBifurcation: RatingBifurcation | null) => {
        setFilters(prev => ({ ...prev, ratingBifurcation, sku: null }));
    }, []);

    const setSku = useCallback((sku: string | null) => {
        setFilters(prev => ({ ...prev, sku }));
    }, []);

    const setDatePreset = useCallback((preset: DatePreset) => {
        const range = getDateRangeForPreset(preset);
        setFilters(prev => ({
            ...prev,
            dateRange: { preset, ...range },
        }));
    }, []);

    const setTrendPeriodMonths = useCallback((months: number | undefined) => {
        setFilters(prev => ({ ...prev, trendPeriodMonths: months }));
    }, []);

    const setCompetitorPlatform = useCallback((competitorPlatform: CompetitorPlatformFilter) => {
        setFilters(prev => ({ ...prev, competitorPlatform }));
    }, []);

    const setPriceMode = useCallback((priceMode: PriceFilterMode) => {
        setFilters(prev => ({
            ...prev,
            priceMode,
            priceRange: null,
        }));
    }, []);

    const setPriceRange = useCallback((priceRange: { min: number; max: number } | null) => {
        setFilters(prev => ({ ...prev, priceRange }));
    }, []);
    
    const setSearchTerm = useCallback((searchTerm: string) => {
        setFilters(prev => ({ ...prev, searchTerm }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    // --- Date-filtered Prestige reviews ---
    const dateFilteredPrestige = useMemo(() => {
        const { startDate: sDate, endDate: eDate } = filters.dateRange;
        return allPrestigeReviews.filter(r => {
            const d = new Date(r.date);
            const inDate = d >= sDate && d <= eDate;
            if (!inDate) return false;
            if (filters.priceRange) {
                const price = filters.priceMode === 'rp'
                    ? (r.priceRp ?? undefined)
                    : (r.priceSp ?? r.priceRp ?? undefined);
                // Only exclude if price data is present AND outside the selected range
                // Reviews with no price data pass through (API handles server-side filtering)
                if (price !== undefined && price !== null && (price < filters.priceRange.min || price > filters.priceRange.max)) {
                    return false;
                }
            }
            return true;
        });
    }, [allPrestigeReviews, filters.dateRange, filters.priceMode, filters.priceRange]);

    // --- Date-filtered Competitor reviews ---
    const dateFilteredCompetitor = useMemo(() => {
        const { startDate: sDate, endDate: eDate } = filters.dateRange;
        return allCompetitorReviews.filter(r => {
            const d = new Date(r.date);
            return d >= sDate && d <= eDate;
        });
    }, [allCompetitorReviews, filters.dateRange]);

    // --- Available categories (server-driven only) ---
    const availableCategories = useMemo(() => {
        return Array.from(new Set((serverSentimentCategories || []).filter(Boolean))).sort();
    }, [serverSentimentCategories]);

    // --- Available subcategories ---
    const availableSubcategories = useMemo(() => {
        const subs = new Set<string>();
        const catFilter = filters.category.selectedCategory;
        dateFilteredPrestige.forEach(r => {
            if (catFilter && String(r.sentimentCategory) !== catFilter) return;
            if (r.subcategory) subs.add(r.subcategory);
        });
        return Array.from(subs).sort();
    }, [dateFilteredPrestige, filters.category.selectedCategory]);

    // --- Available SKUs — drill-down respecting: productCategory → classification → ratingBifurcation ---
    const availableSkus = useMemo((): SkuOption[] => {
        const skuMap = new Map<string, SkuOption & { actualProductRating?: number }>();

        let pool = dateFilteredPrestige;

        // Level 1: Category filter
        const pc = filters.productCategory;
        if (pc) {
            pool = pool.filter(r => String(r.category).toLowerCase() === pc.toLowerCase());
        }

        // Level 2: Classification (paretoStatus) filter
        const { classification } = filters.category;
        if (classification !== 'all') {
            const rule = CLASSIFICATION_RULES.find(r => r.type === classification);
            if (rule && !rule.virtual) {
                const targetStatus = rule.dataValue;
                if (targetStatus) {
                    pool = pool.filter(r => r.paretoStatus === targetStatus);
                }
            }
        }

        // Level 3: Rating Bifurcation — uses actualProductRating (platform PDP rating)
        if (filters.ratingBifurcation) {
            pool = pool.filter(r => {
                const rating = r.actualProductRating;
                if (rating == null) return false;
                if (filters.ratingBifurcation === 'NP')    return rating >= NI_RATING_THRESHOLD;  // >= 4.2
                if (filters.ratingBifurcation === 'Issue') return rating < PARETO_HEALTH_THRESHOLD; // < 4.0
                if (filters.ratingBifurcation === 'NI')   return rating >= PARETO_HEALTH_THRESHOLD && rating < NI_RATING_THRESHOLD; // 4.0–4.2
                return true;
            });
        }

        pool.forEach(r => {
            const product = r.product;
            if (!product) return;
            if (skuMap.has(product)) {
                skuMap.get(product)!.reviewCount++;
            } else {
                skuMap.set(product, {
                    id: product,
                    label: product,
                    product,
                    category: String(r.sentimentCategory || ''),
                    brand: getActiveBrandName(),
                    reviewCount: 1,
                });
            }
        });
        return Array.from(skuMap.values()).sort((a, b) => b.reviewCount - a.reviewCount);
    }, [dateFilteredPrestige, filters.productCategory, filters.category, filters.ratingBifurcation]);

    // --- Available competitor brands ---
    const availableBrands = useMemo(() => {
        const brands = new Set<string>();
        dateFilteredCompetitor.forEach(r => {
            if (r.brand) brands.add(r.brand);
        });
        return Array.from(brands).sort();
    }, [dateFilteredCompetitor]);

    // --- Apply category, SKU, and classification filters to prestige reviews ---
    // Classification now uses paretoStatus from enriched data (master-driven)
    const filteredPrestigeReviews = useMemo(() => {
        let result = dateFilteredPrestige;

        const { selectedCategory, selectedSubcategory, classification } = filters.category;

        // Sentiment category filter (Quality, Performance, Value, etc.)
        if (selectedCategory) {
            result = result.filter(r => String(r.sentimentCategory) === selectedCategory);
        }
        // Product category filter (Pressure Cooker, Gas Stove, etc.)
        const pc = filters.productCategory;
        if (pc) {
            result = result.filter(r => String(r.category).toLowerCase() === pc.toLowerCase());
        }
        if (selectedSubcategory) {
            result = result.filter(r => r.subcategory === selectedSubcategory);
        }
        if (filters.sku) {
            result = result.filter(r => r.product === filters.sku);
        }
        if (classification !== 'all') {
            const rule = CLASSIFICATION_RULES.find(r => r.type === classification);
            if (rule && !rule.virtual) {
                // DB-backed classification — filter by paretoStatus
                const targetStatus = rule.dataValue;
                if (targetStatus) {
                    result = result.filter(r => r.paretoStatus === targetStatus);
                }
            } else if (classification === 'healthy') {
                // ≥4.0 Healthy: products with actualProductRating >= 4.0
                result = result.filter(r => (r.actualProductRating || r.rating) >= PARETO_HEALTH_THRESHOLD);
            } else if (classification === 'needs-attention') {
                // <4.0 Needs Attention: products with actualProductRating < 4.0
                result = result.filter(r => (r.actualProductRating || r.rating) < PARETO_HEALTH_THRESHOLD);
            } else if (classification === 'ni') {
                // NI: products with actualProductRating >= 4.2
                result = result.filter(r => (r.actualProductRating || r.rating) >= NI_RATING_THRESHOLD);
            }
        }

        // Search Term filter
        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            result = result.filter(r => 
                (r.product?.toLowerCase().includes(term)) ||
                (r.productName?.toLowerCase().includes(term)) ||
                (r.text?.toLowerCase().includes(term)) ||
                (r.title?.toLowerCase().includes(term)) ||
                (r.sentimentCategory?.toLowerCase().includes(term)) ||
                (r.subcategory?.toLowerCase().includes(term))
            );
        }

        // Rating Bifurcation — further narrows within Pareto/Non-Pareto/NPD buckets
        if (filters.ratingBifurcation) {
            result = result.filter(r => {
                const rating = r.actualProductRating;
                if (rating == null) return false;
                if (filters.ratingBifurcation === 'NP')    return rating >= NI_RATING_THRESHOLD;
                if (filters.ratingBifurcation === 'Issue') return rating < PARETO_HEALTH_THRESHOLD;
                if (filters.ratingBifurcation === 'NI')   return rating >= PARETO_HEALTH_THRESHOLD && rating < NI_RATING_THRESHOLD;
                return true;
            });
        }

        return result;
    }, [dateFilteredPrestige, filters.category, filters.productCategory, filters.sku, filters.ratingBifurcation]);

    // --- Apply filters to competitor reviews (including platform filter) ---
    const filteredCompetitorReviews = useMemo(() => {
        let result = dateFilteredCompetitor;

        const { selectedCategory } = filters.category;
        if (selectedCategory) {
            result = result.filter(r => r.sentimentCategory === selectedCategory);
        }

        // Apply competitor platform filter
        if (filters.competitorPlatform !== 'all') {
            result = result.filter(r => r.platform === filters.competitorPlatform);
        }

        // Apply Search Term filter
        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            result = result.filter(r => 
                (r.product?.toLowerCase().includes(term)) ||
                (r.productName?.toLowerCase().includes(term)) ||
                (r.text?.toLowerCase().includes(term)) ||
                (r.sentimentCategory?.toLowerCase().includes(term)) ||
                (r.subcategory?.toLowerCase().includes(term))
            );
        }

        return result;
    }, [dateFilteredCompetitor, filters.category, filters.competitorPlatform, filters.searchTerm]);

    // --- Available platforms (config-driven) ---
    const PLATFORM_METADATA: Record<string, { label: string; icon: string; color: string }> = {
        'all':      { label: 'All Platforms', icon: '🌐', color: '#6366f1' },
        'amazon':   { label: 'Amazon',        icon: '📦', color: '#FF9900' },
        'flipkart': { label: 'Flipkart',      icon: '🛍️', color: '#2874F0' },
        'blinkit':  { label: 'Blinkit',       icon: '⚡', color: '#F7EC1E' },
        'bigbasket':{ label: 'BigBasket',     icon: '🥦', color: '#84c225' },
    };

    const serverAvailablePlatforms = useMemo(() => {
        const dynamicPlatforms = Array.from(new Set((serverPlatforms || []).filter(Boolean))).sort();
        
        const platforms = ['all', ...dynamicPlatforms];
        
        return platforms.map(id => {
            const lowerId = id.toLowerCase();
            const meta = PLATFORM_METADATA[lowerId] || { 
                label: id.charAt(0).toUpperCase() + id.slice(1), 
                icon: '•', 
                color: 'currentColor' 
            };
            
            return {
                id: id, // Keep original ID for filtering
                label: meta.label,
                icon: meta.icon,
                isActive: true,
                color: meta.color,
            };
        });
    }, [serverPlatforms]);

    return {
        filters,
        setPlatform,
        setBrandScope,
        setCategory,
        setProductCategory,
        setSubcategory,
        setClassification,
        setSku,
        setRatingBifurcation,
        setDatePreset,
        setTrendPeriodMonths,
        setCompetitorPlatform,
        setPriceMode,
        setPriceRange,
        setSearchTerm,
        resetFilters,
        filteredPrestigeReviews,
        filteredCompetitorReviews,
        availablePlatforms: serverAvailablePlatforms,
        availableCategories,
        availableSubcategories,
        availableSkus,
        availableBrands,
        availableParetoStatuses: serverParetoStatuses || [],
        totalPrestigeCount: filteredPrestigeReviews.length,
        totalCompetitorCount: filteredCompetitorReviews.length,
    };
}
