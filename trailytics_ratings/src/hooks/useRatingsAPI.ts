/**
 * useRatingsAPI — React hook for fetching ratings data from the API
 * Replaces static JSON imports with DB-backed API calls.
 * Multi-tenant: company_id is derived from the authenticated Ratings session.
 *
 * Caching strategy:
 *  • Static ref data (platforms/config/brands) → sessionStorage 30 min TTL
 *  • Aggregated filter results (summary/health/issues) → in-memory 5 min TTL
 *  • Drill-down lists (skus/products) → in-memory 3 min TTL
 *  • Paginated reviews → NO cache (abort-controlled, always fresh)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { resolveCompanyId } from '../utils/tenant';
import { buildAuthHeaders } from '../utils/auth';
import { getCached, setCached, sessionGet, sessionSet, buildCacheKey, TTL } from '../utils/apiCache';
import { RATINGS_API_BASE } from '../config/apiBase';

const API_ROOT = RATINGS_API_BASE;
const API_BASE = `${API_ROOT}/api/ratings`;

export interface ReviewRow {
    id: string;
    platform: string;
    web_pid: string;
    product_name: string;
    brand: string;
    rating: number;
    ml_inferred_rating?: number | null;
    review_title: string | null;
    review_text: string | null;
    review_date: string | null;
    is_verified_purchase: boolean;
    pdp_rating: number | null;
    pdp_rating_count: number | null;
    sentiment: string | null;
    sentiment_category: string | null;
    sentiment_subcategory: string | null;
    sentiment_score: number | null;
    quality_score: number | null;
    specific_issue: string | null;
    category: string | null;
    material: string | null;
    wattage: string | null;
    is_competitor: boolean;
    pareto_status: string | null;
    // Price fields from product_snapshots
    price_rp: number | null;
    price_sp: number | null;
    // Extended PDP metrics from product_snapshots
    pdp_platform_rating: number | null;
    pdp_total_rating_count: number | null;
}

export interface RatingsSummary {
    metrics: {
        total_reviews: string;
        avg_review_rating: string;
        avg_ml_rating: string | null;
        unique_products: string;
        unique_categories: string;
        total_ratings: string | null;
        avg_platform_rating: string | null;
        total_products: string;
        positive_count: string;
        negative_count: string;
        neutral_count: string;
        user_rating: string | null;
        ml_rating: string | null;
        pdp_rating: string | null;
        review_count: string;
        rating_count: string | null;
    };
    ratingDistribution: Array<{ rating: number; count: string }>;
    sentimentDistribution: Array<{ sentiment_category: string; count: string }>;
    materialDistribution: Array<{ material: string; count: string }>;
    categoryDistribution: Array<{ category: string; count: string }>;
}

export interface FilterOptions {
    categories: string[];
    materials: string[];
    brands: string[];
    platforms: string[];
    paretoStatuses: string[];
}

interface ReviewFilters {
    platform?: string;
    is_competitor?: string;
    category?: string;
    categories_in?: string;
    sentiment_category?: string;
    material?: string;
    pareto_status?: string;
    brand?: string;
    date_from?: string;
    date_to?: string;
    web_pid?: string;
    limit?: number;
    offset?: number;
    rating_bifurcation?: string;
    price_mode?: 'rp' | 'sp';
    price_min?: number;
    price_max?: number;
}

export async function fetchAPI<T>(
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
    fetchOptions?: RequestInit
): Promise<T> {
    const query = new URLSearchParams();
    query.set('company_id', resolveCompanyId());

    for (const [key, value] of Object.entries(params || {})) {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    }

    const url = `${API_BASE}${endpoint}?${query.toString()}`;
    const res = await fetch(url, {
        ...fetchOptions,
        headers: buildAuthHeaders(fetchOptions?.headers, resolveCompanyId()),
    });

    if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    return res.json();
}

interface HookOptions {
    enabled?: boolean;
}

// ============================================================================
// Hook: useReviews — Fetch reviews with filters
// ============================================================================
export function useReviews(filters: ReviewFilters = {}, options: HookOptions = {}) {
    const [data, setData] = useState<ReviewRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | undefined>(undefined);
    const enabled = options.enabled ?? true;

    const fetchReviews = useCallback(async () => {
        if (!enabled) {
            abortRef.current?.abort();
            setData([]);
            setTotal(0);
            setLoading(false);
            return;
        }

        abortRef.current?.abort();
        abortRef.current = new AbortController();

        setLoading(true);
        setError(null);

        try {
            const result = await fetchAPI<{ data: ReviewRow[]; total: number }>('/reviews', filters as Record<string, string | number | undefined>);
            setData(result.data);
            setTotal(result.total);
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                setError((err as Error).message);
            }
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, JSON.stringify(filters)]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    return { data, total, loading, error, refetch: fetchReviews };
}

// ============================================================================
// Hook: useSummary — Fetch aggregated KPI metrics (in-memory cache 5 min)
// ============================================================================
export function useSummary(filters: Record<string, string | number | undefined> = {}) {
    const [data, setData] = useState<RatingsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cacheKey = useMemo(
        () => buildCacheKey('/summary', filters),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [JSON.stringify(filters)],
    );

    useEffect(() => {
        const cached = getCached<RatingsSummary>(cacheKey);
        if (cached) { setData(cached); setLoading(false); return; }
        setLoading(true);
        fetchAPI<RatingsSummary>('/summary', filters)
            .then(result => { setData(result); setCached(cacheKey, result, TTL.FILTER); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cacheKey]);

    return { data, loading, error };
}

// ============================================================================
// Hook: useFilterOptions — Fetch available filter options (sessionStorage 30 min)
// ============================================================================
export function useFilterOptions(isCompetitor?: boolean) {
    const [data, setData] = useState<FilterOptions>({
        categories: [], materials: [], brands: [], platforms: [], paretoStatuses: [],
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const params: Record<string, string> = {};
        if (isCompetitor !== undefined) params.is_competitor = String(isCompetitor);
        const key = buildCacheKey('/categories', params);
        const cached = sessionGet<FilterOptions>(key);
        if (cached) { setData(cached); setLoading(false); return; }

        fetchAPI<FilterOptions>('/categories', params)
            .then(result => { setData(result); sessionSet(key, result, TTL.STATIC); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [isCompetitor]);

    return { ...data, loading };
}

// ============================================================================
// Hook: useProducts — Fetch product catalog (in-memory 5 min)
// ============================================================================
export function useProducts(filters: {
    platform?: string;
    pareto_status?: string;
    category?: string;
    material?: string;
    price_mode?: 'rp' | 'sp';
    price_min?: number;
    price_max?: number;
} = {}) {
    const [data, setData] = useState<Array<Record<string, unknown>>>([]);
    const [loading, setLoading] = useState(true);
    const cacheKey = useMemo(
        () => buildCacheKey('/products', filters as Record<string, string | number | undefined>),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [JSON.stringify(filters)],
    );

    useEffect(() => {
        const cached = getCached<{ data: Array<Record<string, unknown>> }>(cacheKey);
        if (cached) { setData(cached.data); setLoading(false); return; }
        fetchAPI<{ data: Array<Record<string, unknown>> }>('/products', filters as Record<string, string | number | undefined>)
            .then(result => { setData(result.data); setCached(cacheKey, result, TTL.FILTER); })
            .catch(console.error)
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cacheKey]);

    return { data, loading };
}

// ============================================================================
// Shared interfaces for server-side aggregated data
// ============================================================================
export interface TrendItem {
    characteristic: string;
    recentNegativeRate: number;
    olderNegativeRate: number;
    change: number;
    recentCount: number;
    totalCount: number;
    isEscalating: boolean;
    isImproving: boolean;
}

export interface TrendsResponse {
    escalating: TrendItem[];
    improving: TrendItem[];
}

export interface TimelineMonth {
    month: string;
    categories: Record<string, { positive: number; negative: number; neutral: number; total: number }>;
    totalReviews: number;
    avgRating: number;
}

export interface ProductHealthItem {
    product: string;
    healthScore: number;
    totalMentions: number;
    positiveRate: number;
    negativeRate: number;
    trend: 'improving' | 'stable' | 'declining';
    monthlyRatings: { month: string; avg: number; count: number }[];
}

// ============================================================================
// Hook: useTrends — Fetch escalating/improving issue trends (in-memory 5 min)
// ============================================================================
export function useTrends(
    periodMonths: number = 6,
    filters: Record<string, string | number | undefined> = {},
    options: HookOptions = {},
) {
    const [data, setData] = useState<TrendsResponse>({ escalating: [], improving: [] });
    const [loading, setLoading] = useState(true);
    const enabled = options.enabled ?? true;
    const cacheKey = useMemo(
        () => buildCacheKey('/trends', { period_months: periodMonths, ...filters }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [enabled, periodMonths, JSON.stringify(filters)],
    );

    useEffect(() => {
        if (!enabled) {
            setData({ escalating: [], improving: [] });
            setLoading(false);
            return;
        }
        const cached = getCached<TrendsResponse>(cacheKey);
        if (cached) { setData(cached); setLoading(false); return; }
        setLoading(true);
        fetchAPI<TrendsResponse>('/trends', { period_months: periodMonths, ...filters })
            .then(result => { setData(result); setCached(cacheKey, result, TTL.FILTER); })
            .catch(console.error)
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, cacheKey]);

    return { data, loading };
}

export function usePlatformOptions(isCompetitor?: boolean, options: HookOptions = {}) {
    const [platforms, setPlatforms] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const enabled = options.enabled ?? true;

    useEffect(() => {
        if (!enabled) { setLoading(false); setPlatforms([]); return; }
        const params: Record<string, string> = {};
        if (isCompetitor !== undefined) params.is_competitor = String(isCompetitor);
        const key = buildCacheKey('/platform-options', params);
        const cached = sessionGet<{ platforms: string[] }>(key);
        if (cached) { setPlatforms(cached.platforms); setLoading(false); return; }

        fetchAPI<{ platforms: string[] }>('/platform-options', params)
            .then(result => { setPlatforms(result.platforms); sessionSet(key, result, TTL.STATIC); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [enabled, isCompetitor]);

    return { platforms, loading };
}

// ============================================================================
// Hook: useTimeline — Fetch monthly aggregated timeline (in-memory 5 min)
// ============================================================================
export function useTimeline(filters: Record<string, string | number | undefined> = {}, options: HookOptions = {}) {
    const [data, setData] = useState<TimelineMonth[]>([]);
    const [loading, setLoading] = useState(true);
    const enabled = options.enabled ?? true;
    const cacheKey = useMemo(
        () => buildCacheKey('/timeline', filters),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [enabled, JSON.stringify(filters)],
    );

    useEffect(() => {
        if (!enabled) { setData([]); setLoading(false); return; }
        const cached = getCached<{ timeline: TimelineMonth[] }>(cacheKey);
        if (cached) { setData(cached.timeline); setLoading(false); return; }
        setLoading(true);
        fetchAPI<{ timeline: TimelineMonth[] }>('/timeline', filters)
            .then(result => { setData(result.timeline); setCached(cacheKey, result, TTL.FILTER); })
            .catch(console.error)
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, cacheKey]);

    return { data, loading };
}

// ============================================================================
// Hook: useProductHealth — Fetch product health scores (in-memory 5 min)
// ============================================================================
export function useProductHealth(filters: Record<string, string | number | undefined> = {}, options: HookOptions = {}) {
    const [data, setData] = useState<ProductHealthItem[]>([]);
    const [loading, setLoading] = useState(true);
    const enabled = options.enabled ?? true;
    const cacheKey = useMemo(
        () => buildCacheKey('/product-health', filters),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [enabled, JSON.stringify(filters)],
    );

    useEffect(() => {
        if (!enabled) { setData([]); setLoading(false); return; }
        const cached = getCached<{ products: ProductHealthItem[] }>(cacheKey);
        if (cached) { setData(cached.products); setLoading(false); return; }
        setLoading(true);
        fetchAPI<{ products: ProductHealthItem[] }>('/product-health', filters)
            .then(result => { setData(result.products); setCached(cacheKey, result, TTL.FILTER); })
            .catch(console.error)
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, cacheKey]);

    return { data, loading };
}

// ============================================================================
// Hook: useProductCategories — Fetch distinct product categories with counts
// ============================================================================
export interface ProductCategory {
    category: string;
    count: number;
}

export function useProductCategories(filters: Record<string, string | number | undefined> = {}, options: HookOptions = {}) {
    const [data, setData] = useState<ProductCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const enabled = options.enabled ?? true;

    const cacheKey = useMemo(
        () => buildCacheKey('/product-categories', filters),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [JSON.stringify(filters)],
    );

    useEffect(() => {
        if (!enabled) { setLoading(false); setData([]); return; }
        
        // Use in-memory cache for dynamic categories (TTL.FILTER = 5 min)
        const cached = getCached<{ data: { category: string; count: string }[] }>(cacheKey);
        if (cached) {
            const raw = cached.data.map(d => ({ category: d.category, count: parseInt(d.count) }));
            const normalized = raw.reduce((acc: ProductCategory[], curr) => {
                const label = curr.category.trim();
                if (!label) return acc;
                const normalizedLabel = label.split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
                const existing = acc.find(a => a.category === normalizedLabel);
                if (existing) {
                    existing.count += curr.count;
                } else {
                    acc.push({ category: normalizedLabel, count: curr.count });
                }
                return acc;
            }, []);
            setData(normalized.sort((a, b) => b.count - a.count));
            setLoading(false);
            return;
        }

        setLoading(true);
        fetchAPI<{ data: { category: string; count: string }[] }>('/product-categories', filters)
            .then(result => {
                setCached(cacheKey, result, TTL.FILTER);
                const raw = result.data.map(d => ({ category: d.category, count: parseInt(d.count) }));
                const normalized = raw.reduce((acc: ProductCategory[], curr) => {
                    const label = curr.category.trim();
                    if (!label) return acc;

                    let normalizedLabel = ['other', 'others'].includes(label.toLowerCase()) ? 'Others' : label;
                    normalizedLabel = normalizedLabel.split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');

                    const existing = acc.find(a => a.category === normalizedLabel);
                    if (existing) {
                        existing.count += curr.count;
                    } else {
                        acc.push({ category: normalizedLabel, count: curr.count });
                    }
                    return acc;
                }, []);
                setData(normalized.sort((a, b) => b.count - a.count));
            })
            .catch(console.error)
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, cacheKey]);

    return { data, loading };
}

// ============================================================================
// Executive Insight V2 — Interfaces & Hooks
// ============================================================================

export interface HealthSku {
    web_pid: string;
    product_name: string;
    pdp_rating: number | null;
    user_rating?: number | null;
    ml_rating?: number | null;
    rating_count: number;
    category: string;
    recent_avg_rating: number | null;
    older_avg_rating: number | null;
    trend_direction: 'up' | 'down' | 'stable';
    total_reviews: number;
    latest_review_date: string | null;
}

export interface HealthStatusGroup {
    count: number;
    skus: HealthSku[];
    totalRatings: number;
    totalReviewCount?: number;
    avgPlatformRating: number | null;
    userRating?: number | null;
    mlRating?: number | null;
    /** % of SKUs in this group with PDP rating >= 4.0 (platform quality signal) */
    positiveRate: number;
    pdpHealthRate: number;
    reviewGrowthPct: number;
    recentReviewCount: number;
    olderReviewCount: number;
    ratingGrowthDiff: number;
    recentAvgRating: number;
    olderAvgRating: number;
}

export interface ParetoBucket {
    name: string;
    total: number;
    totalRatings: number;
    totalReviewCount?: number;
    avgPlatformRating: number | null;
    userRating?: number | null;
    mlRating?: number | null;
    /** % of SKUs with PDP rating >= 4.0 — a platform quality signal */
    positiveRate: number;
    pdpHealthRate: number;
    /** Period-over-period review COUNT growth: last 3M vs prior 3M (same calc as category strip) */
    reviewGrowthPct: number;
    recentReviewCount: number;
    olderReviewCount: number;
    ratingGrowthDiff: number;
    recentAvgRating: number;
    olderAvgRating: number;
    np: HealthStatusGroup;
    issue: HealthStatusGroup;
    ni: HealthStatusGroup;
    critical: HealthStatusGroup;
    noRating: HealthStatusGroup;

}

export interface ExecutiveHealthData {
    pareto: ParetoBucket;
    nonPareto: ParetoBucket;
    npd: ParetoBucket;
    total: number;
}

export function useExecutiveHealth(
    category?: string | null,
    paretoStatus?: string | null,
    ratingBifurcation?: string | null,
    platform?: string | null,
    periodMonths?: number,
    dateFrom?: string | null,
    dateTo?: string | null,
    priceMode?: 'rp' | 'sp' | null,
    priceRange?: { min: number; max: number } | null,
    brandScope?: string | null,
    sentimentCategory?: string | null,
    options: HookOptions = {},
) {
    const [data, setData] = useState<ExecutiveHealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const enabled = options.enabled ?? true;

    useEffect(() => {
        if (!enabled) { setLoading(false); setData(null); return; }
        const params: Record<string, string> = {};
        if (category) params.category = category;
        if (paretoStatus) params.pareto_status = paretoStatus;
        if (ratingBifurcation) params.rating_bifurcation = ratingBifurcation;
        if (platform && platform !== 'all') params.platform = platform;
        if (periodMonths) params.period_months = String(periodMonths);
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        if (priceMode) params.price_mode = priceMode;
        if (priceRange) {
            params.price_min = String(priceRange.min);
            params.price_max = String(priceRange.max);
        }
        if (brandScope === 'prestige') params.is_competitor = 'false';
        else if (brandScope === 'competition') params.is_competitor = 'true';
        else if (brandScope === 'all') params.is_competitor = 'all';
        if (sentimentCategory) params.sentiment_category = sentimentCategory;
        const key = buildCacheKey('/executive-health', params);
        const cached = getCached<ExecutiveHealthData>(key);
        if (cached) { setData(cached); setLoading(false); return; }
        setLoading(true);
        fetchAPI<ExecutiveHealthData>('/executive-health', params)
            .then(result => { setData(result); setCached(key, result, TTL.FILTER); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [enabled, category, paretoStatus, ratingBifurcation, platform, periodMonths, dateFrom, dateTo, priceMode, priceRange?.min, priceRange?.max, brandScope, sentimentCategory]);

    return { data, loading };
}

// ============================================================================
// Category Health — Per-category KPIs for cards strip
// ============================================================================
export interface CategoryHealthItem {
    category: string;
    reviewCount: number;
    skuCount: number;
    avgReviewRating: number;
    avgMlRating?: number | null;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    totalRatings: number;
    avgPlatformRating: number | null;
    paretoCount: number;
    nonParetoCount: number;
    npdCount: number;
    growthPct: number;
    recentReviewCount: number;
    priorReviewCount: number;
    ratingGrowthDiff: number;
    recentAvgRating: number;
    priorAvgRating: number;
}

export interface GlobalCategoryMetadata {
    skuCount: number;
    reviewCount: number;
    totalRatings: number;
    avgReviewRating: number;
    avgPlatformRating: number | null;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    paretoCount: number;
    nonParetoCount: number;
    npdCount: number;
    growthPct: number;
    recentReviewCount: number;
    priorReviewCount: number;
}


export function useCategoryHealth(
    platform?: string | null,
    periodMonths?: number,
    dateFrom?: string | null,
    dateTo?: string | null,
    priceMode?: 'rp' | 'sp' | null,
    priceRange?: { min: number; max: number } | null,
    brandScope?: string | null,
    sentimentCategory?: string | null,
    category?: string | null,
) {
    const [data, setData] = useState<CategoryHealthItem[]>([]);
    const [globalMetadata, setGlobalMetadata] = useState<GlobalCategoryMetadata>({ 
        skuCount: 0, 
        reviewCount: 0, 
        totalRatings: 0,
        avgReviewRating: 0,
        avgPlatformRating: null,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        paretoCount: 0,
        nonParetoCount: 0,
        npdCount: 0,
        growthPct: 0,
        recentReviewCount: 0,
        priorReviewCount: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const params: Record<string, string> = {};
        if (platform && platform !== 'all') params.platform = platform;
        if (periodMonths) params.period_months = String(periodMonths);
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        if (priceMode) params.price_mode = priceMode;
        if (priceRange) {
            params.price_min = String(priceRange.min);
            params.price_max = String(priceRange.max);
        }
        if (brandScope === 'prestige') params.is_competitor = 'false';
        else if (brandScope === 'competition') params.is_competitor = 'true';
        else if (brandScope === 'all') params.is_competitor = 'all';

        if (sentimentCategory) params.sentiment_category = sentimentCategory;
        if (category) params.category = category;
        const key = buildCacheKey('/category-health', params);
        const cached = getCached<{ categories: CategoryHealthItem[]; total?: GlobalCategoryMetadata }>(key);
        if (cached) {
            setData(cached.categories);
            if (cached.total) setGlobalMetadata(cached.total);
            setLoading(false);
            return;
        }
        setLoading(true);
        fetchAPI<{ categories: CategoryHealthItem[], total?: GlobalCategoryMetadata }>('/category-health', params)
            .then(result => {
                setCached(key, result, TTL.FILTER);
                const normalizedCategories = result.categories.map(cat => ({
                    ...cat,
                    category: normalizeCategory(cat.category)
                }));
                setData(normalizedCategories);
                if (result.total) setGlobalMetadata(result.total);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [platform, periodMonths, dateFrom, dateTo, priceMode, priceRange?.min, priceRange?.max, brandScope, sentimentCategory, category]);


    return { data, globalMetadata, loading };
}

// ============================================================================
// ASIN Issues — Issue types + RCA for a specific ASIN
// ============================================================================
export interface AsinIssueItem {
    issueCategory: string;
    issueType: string;
    issueTypeRaw: string;
    rca: string;
    totalCount: number;
    negativeCount: number;
    positiveCount: number;
    avgRating: number;
    pctOfTotal: number;
}

export interface AsinIssuesResponse {
    webPid: string;
    productName: string;
    pdpRating: number | null;
    userRating?: number | null;
    mlRating?: number | null;
    ratingCount: number;
    totalReviews: number;
    issues: AsinIssueItem[];
    platformDistribution?: Record<string, number>;
    aiDistribution?: Record<string, number>;
    discrepancyFlag?: boolean;
}

export function useAsinIssues(webPid: string | null) {
    const [data, setData] = useState<AsinIssuesResponse | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!webPid) { setData(null); return; }
        const key = buildCacheKey('/asin-issues', { web_pid: webPid });
        const cached = getCached<AsinIssuesResponse>(key);
        if (cached) { setData(cached); return; }
        setLoading(true);
        fetchAPI<AsinIssuesResponse>('/asin-issues', { web_pid: webPid })
            .then(result => { setData(result); setCached(key, result, TTL.FILTER); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [webPid]);

    return { data, loading };
}

// NLP Issues Breakdown
export interface NlpIssue {
    subcategory: string;
    label: string;
    stakeholder: string | null;
    negativeCount: number;
    totalCount: number;
    skuCount: number;
    avgRating: number;
}

export function useIssuesBreakdown(
    category?: string | null,
    paretoStatus?: string | null,
    ratingBifurcation?: string | null,
    platform?: string | null,
    periodMonths?: number,
    dateFrom?: string | null,
    dateTo?: string | null,
    priceMode?: 'rp' | 'sp' | null,
    priceRange?: { min: number; max: number } | null,
    brandScope?: string | null,
    sentimentCategory?: string | null,
    options: HookOptions = {},
) {
    const [data, setData] = useState<NlpIssue[]>([]);
    const [loading, setLoading] = useState(true);
    const enabled = options.enabled ?? true;

    useEffect(() => {
        if (!enabled) { setLoading(false); setData([]); return; }
        const params: Record<string, string> = {};
        if (category) params.category = category;
        if (paretoStatus) params.pareto_status = paretoStatus;
        if (ratingBifurcation) params.rating_bifurcation = ratingBifurcation;
        if (platform && platform !== 'all') params.platform = platform;
        if (periodMonths) params.period_months = String(periodMonths);
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        if (priceMode) params.price_mode = priceMode;
        if (priceRange) {
            params.price_min = String(priceRange.min);
            params.price_max = String(priceRange.max);
        }
        if (brandScope === 'prestige') params.is_competitor = 'false';
        else if (brandScope === 'competition') params.is_competitor = 'true';
        else if (brandScope === 'all') params.is_competitor = 'all';
        if (sentimentCategory) params.sentiment_category = sentimentCategory;
        const key = buildCacheKey('/issues-breakdown', params);
        const cached = getCached<{ issues: NlpIssue[] }>(key);
        if (cached) { setData(cached.issues); setLoading(false); return; }
        setLoading(true);
        fetchAPI<{ issues: NlpIssue[] }>('/issues-breakdown', params)
            .then(result => { setData(result.issues); setCached(key, result, TTL.FILTER); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [enabled, category, paretoStatus, ratingBifurcation, platform, periodMonths, dateFrom, dateTo, priceMode, priceRange?.min, priceRange?.max, brandScope, sentimentCategory]);

    return { data, loading };
}

// Issue Detail — SKUs for a specific NLP issue
export interface IssueProduct {
    web_pid: string;
    product_name: string;
    pdp_rating: number | null;
    reviewCount: number;
    negativeCount: number;
    avgReviewRating: number;
}

export function useIssueDetail(subcategory: string | null) {
    const [data, setData] = useState<IssueProduct[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!subcategory) { setData([]); return; }
        const key = buildCacheKey('/issue-detail', { subcategory });
        const cached = getCached<{ products: IssueProduct[] }>(key);
        if (cached) { setData(cached.products); return; }
        setLoading(true);
        fetchAPI<{ products: IssueProduct[] }>('/issue-detail', { subcategory })
            .then(result => { setData(result.products); setCached(key, result, TTL.FILTER); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [subcategory]);

    return { data, loading };
}

// Reviews by issue (unchanged)
export interface IssueReview {
    id: string;
    rating: number;
    review_title: string | null;
    review_text: string | null;
    review_date: string | null;
    reviewer_name: string | null;
    is_verified_purchase: boolean;
    sentiment: string;
    sentiment_subcategory: string;
    specific_issue: string | null;
    sentiment_score: number | null;
    quality_score: number | null;
    product_name: string;
    pdp_rating: number | null;

    // ML Audit Injection 
    ml_audit_id?: string;
    ml_sentiment?: string;
    ml_issue?: string;
    ml_category?: string;
}

export function useReviewsByIssue(
    webPid: string | null, 
    subcategory: string | null, 
    sort: string = 'rating_asc',
    filters?: {
        date_from?: string | null;
        date_to?: string | null;
        is_competitor?: string | null;
    }
) {
    const [data, setData] = useState<IssueReview[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!webPid || !subcategory) { setData([]); return; }
        const params: Record<string, string> = { web_pid: webPid, subcategory, sort };
        if (filters?.date_from) params.date_from = filters.date_from;
        if (filters?.date_to) params.date_to = filters.date_to;
        if (filters?.is_competitor) params.is_competitor = filters.is_competitor;

        setLoading(true);
        fetchAPI<{ reviews: IssueReview[]; total: number }>('/reviews-by-issue', params)
            .then(result => { setData(result.reviews); setTotal(result.total); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [webPid, subcategory, sort]);

    return { data, total, loading };
}

// ============================================================================
// Stakeholder Detail — Issues + SKUs for a specific stakeholder (issue-first)
// ============================================================================
export interface StakeholderIssueSku {
    web_pid: string;
    product_name: string;
    pdp_rating: number | null;
    negCount: number;
    totalCount: number;
}

export interface StakeholderIssue {
    subcategory: string;
    label: string;
    negativeCount: number;
    totalCount: number;
    skuCount: number;
    skus: StakeholderIssueSku[];
}

export interface StakeholderDetailResponse {
    issues: StakeholderIssue[];
    uniqueSkuCount: number;
}

// Keep old exports as aliases for backward compatibility
export type StakeholderProductIssue = { subcategory: string; label: string; negativeCount: number; totalCount: number };
export type StakeholderProduct = { web_pid: string; product_name: string; pdp_rating: number | null; totalReviews: number; totalNegative: number; issues: StakeholderProductIssue[] };

export function useStakeholderDetail(
    stakeholderName: string | null,
    filters?: {
        category?: string | null;
        pareto_status?: string | null;
        rating_bifurcation?: string | null;
        platform?: string | null;
        date_from?: string | null;
        date_to?: string | null;
        price_mode?: 'rp' | 'sp' | null;
        price_min?: number | null;
        price_max?: number | null;
        sentiment_category?: string | null;
        is_competitor?: string | null;
    }
) {
    const [data, setData] = useState<StakeholderIssue[]>([]);
    const [uniqueSkuCount, setUniqueSkuCount] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!stakeholderName) {
            setData([]);
            setUniqueSkuCount(0);
            return;
        }
        const params: Record<string, string> = { stakeholder: stakeholderName };
        if (filters?.category) params.category = filters.category;
        if (filters?.pareto_status) params.pareto_status = filters.pareto_status;
        if (filters?.rating_bifurcation) params.rating_bifurcation = filters.rating_bifurcation;
        if (filters?.platform && filters.platform !== 'all') params.platform = filters.platform;
        if (filters?.date_from) params.date_from = filters.date_from;
        if (filters?.date_to) params.date_to = filters.date_to;
        if (filters?.price_mode) params.price_mode = filters.price_mode;
        if (filters?.price_min !== undefined && filters?.price_min !== null) params.price_min = String(filters.price_min);
        if (filters?.price_max !== undefined && filters?.price_max !== null) params.price_max = String(filters.price_max);
        if (filters?.sentiment_category) params.sentiment_category = filters.sentiment_category;
        if (filters?.is_competitor) params.is_competitor = filters.is_competitor;

        const key = buildCacheKey('/stakeholder-detail', params);
        const cached = getCached<StakeholderDetailResponse>(key);
        if (cached) { setData(cached.issues); setUniqueSkuCount(cached.uniqueSkuCount); return; }
        setLoading(true);
        fetchAPI<StakeholderDetailResponse>('/stakeholder-detail', params)
            .then(result => {
                setCached(key, result, TTL.FILTER);
                setData(result.issues);
                setUniqueSkuCount(result.uniqueSkuCount);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [stakeholderName, filters?.category, filters?.pareto_status, filters?.rating_bifurcation, filters?.platform, filters?.date_from, filters?.date_to, filters?.price_mode, filters?.price_min, filters?.price_max, filters?.sentiment_category, filters?.is_competitor]);

    return { data, uniqueSkuCount, loading };
}

// ============================================================================
// Hook: useSkuList — Server-side filtered SKU list respecting full drill-down
// Category → pareto_status → rating_bifurcation
// ============================================================================
export interface SkuListItem {
    web_pid: string;
    product_name: string;
    pdp_rating: number | null;
    pareto_status: string | null;
    review_count: number;
}

export function useSkuList(filters: {
    category?: string | null;
    pareto_status?: string | null;
    rating_bifurcation?: 'NP' | 'Issue' | 'NI' | null;
    platform?: string | null;
    price_mode?: 'rp' | 'sp';
    price_min?: number | null;
    price_max?: number | null;
} = {}, options: HookOptions = {}) {
    const [data, setData] = useState<SkuListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const enabled = options.enabled ?? true;

    useEffect(() => {
        if (!enabled) { setLoading(false); setData([]); return; }
        const params: Record<string, string> = {};
        if (filters.category) params.category = filters.category;
        if (filters.pareto_status) params.pareto_status = filters.pareto_status;
        if (filters.rating_bifurcation) params.rating_bifurcation = filters.rating_bifurcation;
        if (filters.platform) params.platform = filters.platform;
        if (filters.price_mode) params.price_mode = filters.price_mode;
        if (filters.price_min !== null && filters.price_min !== undefined) params.price_min = String(filters.price_min);
        if (filters.price_max !== null && filters.price_max !== undefined) params.price_max = String(filters.price_max);
        const key = buildCacheKey('/sku-list', params);
        const cached = getCached<{ skus: SkuListItem[] }>(key);
        if (cached) { setData(cached.skus); setLoading(false); return; }
        setLoading(true);
        fetchAPI<{ skus: SkuListItem[] }>('/sku-list', params)
            .then(result => { setData(result.skus); setCached(key, result, TTL.DRILLDOWN); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [enabled, filters.category, filters.pareto_status, filters.rating_bifurcation, filters.platform, filters.price_mode, filters.price_min, filters.price_max]);

    return { data, loading };
}

// ============================================================================
// Hook: useSentimentCategories — sessionStorage 30 min
// ============================================================================
export function useSentimentCategories() {
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const key = '_sentiment_categories';
        const cached = sessionGet<{ categories: string[] }>(key);
        if (cached) { setCategories(cached.categories); setLoading(false); return; }
        fetchAPI<{ categories: string[] }>('/sentiment-categories')
            .then(result => { setCategories(result.categories); sessionSet(key, result, TTL.STATIC); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);
    return { categories, loading };
}

// ============================================================================
// Hook: useCompetitorBrands — sessionStorage 30 min
// ============================================================================
export function useCompetitorBrands() {
    const [brands, setBrands] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const key = '_competitor_brands';
        const cached = sessionGet<{ brands: string[] }>(key);
        if (cached) { setBrands(cached.brands); setLoading(false); return; }
        fetchAPI<{ brands: string[] }>('/competitor-brands')
            .then(result => { setBrands(result.brands); sessionSet(key, result, TTL.STATIC); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);
    return { brands, loading };
}

// ============================================================================
// Hook: useSpecTypeMappings — sessionStorage 30 min
// ============================================================================
export function useSpecTypeMappings() {
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const key = '_spec_type_mappings';
        const cached = sessionGet<{ mappings: Record<string, string> }>(key);
        if (cached) { setMappings(cached.mappings); setLoading(false); return; }
        fetchAPI<{ mappings: Record<string, string> }>('/spec-type-mappings')
            .then(result => { setMappings(result.mappings); sessionSet(key, result, TTL.STATIC); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);
    return { mappings, loading };
}

// ============================================================================
// Hook: useCompanyConfig — sessionStorage 30 min
// ============================================================================
export interface CompanyConfig {
    brand_name: string;
    brand_color: string;
    logo_url?: string;
}

export function useCompanyConfig() {
    const [config, setConfig] = useState<CompanyConfig>({ brand_name: '', brand_color: '#6366f1' });
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const key = '_company_config';
        const cached = sessionGet<{ config: CompanyConfig }>(key);
        if (cached) { setConfig(cached.config); setLoading(false); return; }
        fetchAPI<{ config: CompanyConfig }>('/company-config')
            .then(result => { setConfig(result.config); sessionSet(key, result, TTL.STATIC); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);
    return { config, loading };
}

// ============================================================================
// Hook: useBrandConfig — sessionStorage 30 min
// ============================================================================
export interface BrandConfigItem {
    brand_name: string;
    display_color: string;
    is_own_brand: boolean;
    sort_order: number;
}

export function useBrandConfig() {
    const [brands, setBrands] = useState<BrandConfigItem[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const key = '_brand_config';
        const cached = sessionGet<{ brands: BrandConfigItem[] }>(key);
        if (cached) { setBrands(cached.brands); setLoading(false); return; }
        fetchAPI<{ brands: BrandConfigItem[] }>('/brand-config')
            .then(result => { setBrands(result.brands); sessionSet(key, result, TTL.STATIC); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const getColor = useCallback((brandName: string): string => {
        const found = brands.find(b => b.brand_name.toLowerCase() === brandName.toLowerCase());
        return found?.display_color || '#64748b';
    }, [brands]);
    const ownBrand = useMemo(() => brands.find(b => b.is_own_brand)?.brand_name || '', [brands]);
    return { brands, loading, getColor, ownBrand };
}

// ============================================================================
// Hook: useBenchmarkData — Real sentiment scores from reviews
// ============================================================================
export interface BenchmarkRow {
    brand: string;
    is_competitor: boolean;
    total_reviews: string;
    avg_rating: string;
    pdp_rating?: string | null;
    user_rating?: string | null;
    ml_rating?: string | null;
    review_count?: string;
    rating_count?: string;
    positive_count: string;
    negative_count: string;
    neutral_count: string;
    category_scores?: Record<string, { total: number; positive: number; negative: number; avg_rating: number }>;
}

export function useBenchmarkData(
    category?: string,
    filters: Record<string, string | number | undefined> = {},
    options: HookOptions = {},
) {
    const [benchmarks, setBenchmarks] = useState<BenchmarkRow[]>([]);
    const [loading, setLoading] = useState(true);
    const enabled = options.enabled ?? true;
    const cacheKey = useMemo(
        () => buildCacheKey('/benchmark-data', { ...(category ? { category } : {}), ...filters }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [enabled, category, JSON.stringify(filters)],
    );

    useEffect(() => {
        if (!enabled) { setLoading(false); setBenchmarks([]); return; }
        const cached = getCached<{ benchmarks: BenchmarkRow[] }>(cacheKey);
        if (cached) { setBenchmarks(cached.benchmarks); setLoading(false); return; }
        const params: Record<string, string | number | undefined> = { ...filters };
        if (category) params.category = category;
        fetchAPI<{ benchmarks: BenchmarkRow[] }>('/benchmark-data', params)
            .then(result => { setBenchmarks(result.benchmarks); setCached(cacheKey, result, TTL.FILTER); })
            .catch(console.error)
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, cacheKey]);

    return { benchmarks, loading };
}

// ============================================================================
// Hook: usePriceRanges — sessionStorage 30 min
// ============================================================================
export interface PriceRanges {
    minRp: number;
    maxRp: number;
    minSp: number;
    maxSp: number;
    modes?: Record<'rp' | 'sp', {
        label: string;
        min: number;
        max: number;
        slabs: Array<{ min: number; max: number; label: string; count: number }>;
    }>;
}

export function usePriceRanges(options: HookOptions = {}) {
    const [ranges, setRanges] = useState<PriceRanges | null>(null);
    const [loading, setLoading] = useState(true);
    const enabled = options.enabled ?? true;
    useEffect(() => {
        if (!enabled) { setLoading(false); setRanges(null); return; }
        const key = '_price_ranges';
        const cached = sessionGet<PriceRanges>(key);
        if (cached) { setRanges(cached); setLoading(false); return; }
        fetchAPI<PriceRanges>('/price-ranges')
            .then(result => { setRanges(result); sessionSet(key, result, TTL.STATIC); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [enabled]);
    return { ranges, loading };
}

// ============================================================================
// Helper: normalizeCategory
// ============================================================================
export function normalizeCategory(category: string): string {
    const trimmed = category.trim();
    if (!trimmed) return 'Others';

    // Normalize "other"/"others" -> "Others"
    if (['other', 'others'].includes(trimmed.toLowerCase())) {
        return 'Others';
    }

    // Consistent Title Case for grouping
    return trimmed.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}
