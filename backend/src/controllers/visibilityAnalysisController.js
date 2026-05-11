import visibilityService from '../services/visibilityService.js';
import { generateCacheKey, getCachedOrCompute, CACHE_TTL } from '../utils/cacheHelper.js';

/**
 * Legacy endpoint - kept for backward compatibility
 */
export const VisibilityWorkspace = async (req, res) => {
    try {
        const filters = req.query;
        console.log("Visibility Workspace api request received", filters);

        // Mock response for now
        res.json({
            message: "Visibility Analysis API called successfully",
            filters: filters
        });
    } catch (error) {
        console.error('Error in Visibility Analysis:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// ==================== Visibility Analysis APIs ====================

/**
 * Get Visibility Overview - KPI cards data
 * Returns: Overall SOS, Sponsored SOS, Organic SOS
 */
export const getVisibilityOverview = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            keyword: req.query.keyword || 'All',
            keywordType: req.query.keywordType || 'All',
            category: req.query.category || 'All',
            channel: req.query.channel || 'All',
            pincode: req.query.pincode || 'All',
            zone: req.query.zone || 'All',
            metroFlag: req.query.metroFlag || 'All',
            rank: req.query.rank || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            sku: req.query.sku || 'All'
        };
        console.log('\n========== VISIBILITY OVERVIEW API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

        // Disabled caching for Visibility Overview to ensure fresh rank-based results
        const data = await visibilityService.getVisibilityOverview(filters);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Cards count:', data.cards?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('[DATA SAMPLE]:', JSON.stringify(data.cards?.[0]?.title || 'No cards'));
        console.log('==============================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Visibility Overview:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({ error: 'Internal Server Error', cards: [] });
    }
};

/**
 * Get Platform KPI Matrix
 * Returns: Platform/Format/City breakdown with SOS metrics
 */
export const getVisibilityPlatformKpiMatrix = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            viewMode: req.query.viewMode || 'Platform',  // Platform, Format, or City
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            keyword: req.query.keyword || 'All',
            keywordType: req.query.keywordType || 'All',
            category: req.query.category || 'All',
            channel: req.query.channel || 'All',
            pincode: req.query.pincode || 'All',
            zone: req.query.zone || 'All',
            metroFlag: req.query.metroFlag || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            rank: req.query.rank || 'All',
            sku: req.query.sku || 'All'
        };
        console.log('\n========== VISIBILITY PLATFORM KPI MATRIX API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

        // Disabled caching for Visibility Platform KPI Matrix to ensure fresh rank-based results
        const data = await visibilityService.getPlatformKpiMatrix(filters);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Platform rows:', data.platformData?.rows?.length, 'Format rows:', data.formatData?.rows?.length, 'City rows:', data.cityData?.rows?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('[DATA SAMPLE]: First platform column:', data.platformData?.columns?.[1] || 'N/A');
        console.log('=========================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Visibility Platform KPI Matrix:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({ error: 'Internal Server Error', platformData: {}, formatData: {}, cityData: {} });
    }
};

/**
 * Get Keywords at a Glance
 * Returns: Hierarchical keyword/SKU drill data
 */
export const getVisibilityKeywordsAtGlance = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            keyword: req.query.keyword || 'All',
            keywordType: req.query.keywordType || 'All',
            category: req.query.category || 'All',
            sku: req.query.sku || 'All',
            city: req.query.city || 'All',
            view: req.query.view || 'keywords', // keywords, skus, platforms
            pincode: req.query.pincode || 'All',
            zone: req.query.zone || 'All',
            metroFlag: req.query.metroFlag || 'All',
            rank: req.query.rank || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            channel: req.query.channel || 'All'
        };
        console.log('\n========== VISIBILITY KEYWORDS AT GLANCE API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

        // Disabled caching for Visibility Keywords At Glance to ensure fresh results
        const data = await visibilityService.getKeywordsAtGlance(filters);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Hierarchy items:', data.hierarchy?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('[DATA SAMPLE]: First keyword type:', data.hierarchy?.[0]?.label || 'N/A');
        console.log('========================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Visibility Keywords at Glance:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({ error: 'Internal Server Error', hierarchy: [] });
    }
};



/**
 * Get Filter Options for Advanced Filters modal (cascading filters)
 * Returns: Dynamic options based on selected filters
 */
export const getVisibilityFilterOptions = async (req, res) => {
    const startTime = Date.now();
    try {
        const params = {
            filterType: req.query.filterType,
            platform: req.query.platform || 'All',
            format: req.query.format || 'All',
            city: req.query.city || 'All',
            metroFlag: req.query.metroFlag || 'All',
            brand: req.query.brand || 'All',
            keywordType: req.query.keywordType || 'All',
            keyword: req.query.keyword || 'All',
            sku: req.query.sku || 'All',
            ownBrandsOnly: req.query.ownBrandsOnly === 'true' || req.query.ownOnly === 'true',
            channel: req.query.channel || 'All'
        };
        console.log('\n========== VISIBILITY FILTER OPTIONS API ==========');
        console.log('[REQUEST] Params:', JSON.stringify(params, null, 2));

        const cacheKey = generateCacheKey('visibility_filters_v5', params);
        const data = await getCachedOrCompute(cacheKey, async () => {
            return await visibilityService.getVisibilityFilterOptions(params);
        }, CACHE_TTL.STATIC);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Options count:', data.options?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('===================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Visibility Filter Options:', error);
        res.status(500).json({ error: 'Internal Server Error', options: [] });
    }
};

/**
 * Get Brand Visibility Drilldown for a keyword
 * Returns: Brand SOS metrics with delta and top losers
 */
export const getVisibilityBrandDrilldown = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            keyword: req.query.keyword,
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            keywordType: req.query.keywordType || 'All',
            category: req.query.category || 'All',
            rank: req.query.rank || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        if (!filters.keyword) {
            return res.status(400).json({ error: 'Keyword is required' });
        }

        console.log('\n========== VISIBILITY BRAND DRILLDOWN API ==========');
        console.log('[REQUEST] Keyword:', filters.keyword);
        console.log('[REQUEST] Platform:', filters.platform);

        const cacheKey = generateCacheKey('visibility_brand_drill', filters);
        const data = await getCachedOrCompute(cacheKey, async () => {
            return await visibilityService.getBrandDrilldown(filters);
        }, CACHE_TTL.METRICS);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Brands count:', data.brands?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('====================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Visibility Brand Drilldown:', error);
        res.status(500).json({ error: 'Internal Server Error', brands: [], topLosers: [] });
    }
};

/**
 * Get Latest Available Dates for Visibility Analysis
 * Returns: Date range of the latest month with available data in rb_kw_olap table
 */
export const getVisibilityLatestAvailableDates = async (req, res) => {
    const startTime = Date.now();
    try {
        console.log('\n========== VISIBILITY LATEST AVAILABLE DATES API ==========');
        console.log('[TIMING] Request received at:', new Date().toISOString());

        const cacheKey = generateCacheKey('visibility_dates', {});
        const data = await getCachedOrCompute(cacheKey, async () => {
            return await visibilityService.getLatestAvailableDates();
        }, CACHE_TTL.SHORT);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Available:', data.available, 'Date range:', data.startDate, 'to', data.endDate);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('============================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Visibility Latest Available Dates:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({ error: 'Internal Server Error', available: false });
    }
};

/**
 * Get Visibility KPI Trends for trend chart display
 * Returns: Time series data for Overall SOS, Sponsored SOS, Organic SOS
 */
export const getVisibilityKpiTrends = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || req.query.city || 'All',
            keyword: req.query.keyword || 'All',
            keywordType: req.query.keywordType || 'All',
            category: req.query.category || req.query.format || 'All',
            period: req.query.period || '1M',
            timeStep: req.query.timeStep || 'Daily',
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            sku: req.query.sku || req.query.skus || 'All',
            rank: req.query.rank || 'All'
        };
        console.log('\n========== VISIBILITY KPI TRENDS API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

        const data = await visibilityService.getVisibilityKpiTrends(filters);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Data points:', data.timeSeries?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('[DATA SAMPLE]: First point:', data.timeSeries?.[0]?.date || 'N/A');
        console.log('================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Visibility KPI Trends:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({ error: 'Internal Server Error', timeSeries: [] });
    }
};

/**
 * Get Visibility Competition data for brand/SKU comparison
 * Returns: Brands and SKUs with SOS metrics and delta values
 */
export const getVisibilityCompetition = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            platform: req.query.platform || 'All',
            location: req.query.location || req.query.city || 'All',  // Support both 'location' and 'city' params
            productName: req.query.productName || req.query.keyword || 'All',
            keyword: req.query.keyword || req.query.productName || 'All',
            keywordType: req.query.keywordType || 'All',
            category: req.query.category || req.query.format || 'All',
            brand: req.query.brand || 'All',  // Filter by specific competitor brand
            period: req.query.period || '1M',
            sku: req.query.sku || req.query.skus || 'All',
            rank: req.query.rank || 'All'
        };
        console.log('\n========== VISIBILITY COMPETITION API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

        const data = await visibilityService.getVisibilityCompetition(filters);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Brands:', data.brands?.length, 'SKUs:', data.skus?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('[DATA SAMPLE]: First brand:', data.brands?.[0]?.brand || 'N/A');
        console.log('=================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Visibility Competition:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({ error: 'Internal Server Error', brands: [], skus: [] });
    }
};

/**
 * Get Brand Comparison Trends for chart display
 * Returns: Daily SOS trends for multiple selected brands
 */
export const getBrandComparisonTrends = async (req, res) => {
    const startTime = Date.now();
    try {
        // Parse brands from query - can be comma-separated string or array
        let brandsParam = req.query.brands;
        let brands = [];
        if (brandsParam) {
            if (Array.isArray(brandsParam)) {
                brands = brandsParam;
            } else {
                brands = brandsParam.split(',').map(b => b.trim()).filter(Boolean);
            }
        }

        let skusParam = req.query.skus || req.query.sku;
        let skus = [];
        if (skusParam) {
            if (Array.isArray(skusParam)) {
                skus = skusParam;
            } else {
                skus = skusParam.split(',').map(s => s.trim()).filter(Boolean);
            }
        }

        const filters = {
            brands,
            skus: skus,
            platform: req.query.platform || 'All',
            location: req.query.location || req.query.city || 'All',
            keyword: req.query.keyword || req.query.productName || 'All',
            keywordType: req.query.keywordType || 'All',
            category: req.query.category || req.query.format || 'All',
            format: req.query.format || req.query.category || 'All',
            channel: req.query.channel || 'All',
            period: req.query.period || '1M',
            timeStep: req.query.timeStep || 'Daily',
            dimension: req.query.dimension || 'brand',
            startDate: req.query.startDate,
            endDate: req.query.endDate || null,
            rank: req.query.rank || 'All'
        };

        console.log('\n========== BRAND COMPARISON TRENDS API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

        const data = await visibilityService.getBrandComparisonTrends(filters);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Brands:', Object.keys(data.brands || {}).length, 'Days:', data.days?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('==================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Brand Comparison Trends:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({ error: 'Internal Server Error', brands: {}, days: [] });
    }
};

/**
 * Get dynamic categories specifically for Visibility Analysis
 */
export const getVisibilityCategories = async (req, res) => {
    try {
        const { platform } = req.query;
        const categories = await visibilityService.getVisibilityCategories(platform);
        res.json(categories);
    } catch (error) {
        console.error('[ERROR] Visibility Categories:', error);
        res.status(500).json({ error: 'Internal Server Error', categories: [] });
    }
};

/**
 * Get dynamic keywords specifically for Visibility Analysis
 */
export const getVisibilityKeywords = async (req, res) => {
    try {
        const { platform, category, brand, ownBrandsOnly } = req.query;
        const keywords = await visibilityService.getVisibilityKeywords(platform, category, brand, ownBrandsOnly === 'true');
        res.json(keywords);
    } catch (error) {
        console.error('[ERROR] Visibility Keywords:', error);
        res.status(500).json({ error: 'Internal Server Error', keywords: [] });
    }
};

/**
 * Get dynamic keyword types specifically for Visibility Analysis
 * Returns distinct keyword_type values from rb_pm_olap
 */
export const getVisibilityKeywordTypes = async (req, res) => {
    try {
        const { platform } = req.query;
        const keywordTypes = await visibilityService.getVisibilityKeywordTypes(platform);
        res.json(keywordTypes);
    } catch (error) {
        console.error('[ERROR] Visibility Keyword Types:', error);
        res.status(500).json({ error: 'Internal Server Error', keywordTypes: [] });
    }
};

/**
 * Get SKU-level Visibility Drilldown for a specific keyword
 */
export const getVisibilitySkuDrilldown = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            keyword: req.query.keyword,
            platform: req.query.platform || 'All',
            location: req.query.location || 'All',
            brand: req.query.brand || 'All',
            keywordType: req.query.keywordType || 'All',
            category: req.query.category || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            rank: req.query.rank || 'All',
            ownBrandsOnly: req.query.ownBrandsOnly === 'true'
        };


        if (!filters.keyword) {
            return res.status(400).json({ error: 'Keyword is required' });
        }

        console.log('\n========== VISIBILITY SKU DRILLDOWN API ==========');
        console.log('[REQUEST] Keyword:', filters.keyword);

        const cacheKey = generateCacheKey('visibility_sku_drill', filters);
        const data = await getCachedOrCompute(cacheKey, async () => {
            return await visibilityService.getSkuDrilldown(filters);
        }, CACHE_TTL.METRICS);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: SKUs count:', data.skus?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('==================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Visibility SKU Drilldown:', error);
        res.status(500).json({ error: 'Internal Server Error', skus: [] });
    }
};

/**
 * Get City-level Visibility Drilldown for a specific SKU and Keyword
 */
export const getVisibilityCityDrilldown = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            keyword: req.query.keyword,
            sku: req.query.sku,
            platform: req.query.platform || 'All',
            location: req.query.location || 'All',
            brand: req.query.brand || 'All',
            keywordType: req.query.keywordType || 'All',
            category: req.query.category || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            rank: req.query.rank || 'All'
        };


        if (!filters.keyword || !filters.sku) {
            return res.status(400).json({ error: 'Keyword and SKU are required' });
        }

        console.log('\n========== VISIBILITY CITY DRILLDOWN API ==========');
        console.log('[REQUEST] SKU:', filters.sku, 'Keyword:', filters.keyword);

        const cacheKey = generateCacheKey('visibility_city_drill', filters);
        const data = await getCachedOrCompute(cacheKey, async () => {
            return await visibilityService.getCityDrilldown(filters);
        }, CACHE_TTL.METRICS);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Cities count:', data.cities?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('===================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Visibility City Drilldown:', error);
        res.status(500).json({ error: 'Internal Server Error', cities: [] });
    }
};

/**
 * Get SOS Gainers & Drainers
 * Returns: Top 5 gainers and drainers with Brand → Keyword → Location hierarchy
 */
export const getVisibilityGainersAndDrainers = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            keyword: req.query.keyword || 'All',
            keywordType: req.query.keywordType || 'All',
            category: req.query.category || 'All',
            pincode: req.query.pincode || 'All',
            zone: req.query.zone || 'All',
            metroFlag: req.query.metroFlag || 'All',
            rank: req.query.rank || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            channel: req.query.channel || 'All'
        };
        console.log('\n========== VISIBILITY GAINERS & DRAINERS API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

        // Disabled caching for Visibility Gainers & Drainers to ensure fresh results
        const data = await visibilityService.getSOSGainersAndDrainers(filters);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Gainers:', data.gain?.length, 'Drainers:', data.drain?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('========================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Visibility Gainers & Drainers:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({ error: 'Internal Server Error', gain: [], drain: [] });
    }
};

/**
 * Get Search Terms Performance (Top Search Terms segment with Keyword/SKU modes)
 * Returns: Items with SOS metrics, leading brand, volume share
 */
export const getSearchTermsPerformance = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            viewMode: req.query.viewMode || 'keyword',
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            keyword: req.query.keyword || 'All',
            keywordType: req.query.keywordType || 'All',
            keywordTypeFilter: req.query.keywordTypeFilter || 'All',
            category: req.query.category || 'All',
            ownBrandsOnly: req.query.ownBrandsOnly === 'true',
            rank: req.query.rank || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            channel: req.query.channel || 'All',
            sku: req.query.sku || 'All'
        };
        console.log('\n========== SEARCH TERMS PERFORMANCE API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

        // Disabled caching for Search Terms Performance to ensure fresh results
        const data = await visibilityService.getSearchTermsPerformance(filters);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Items count:', data.items?.length, 'Mode:', data.mode);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('===================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Search Terms Performance:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({ error: 'Internal Server Error', items: [], mode: 'keyword' });
    }
};

/**
 * Get Search Terms Location Drilldown
 * Returns: Location-level SOS breakdown for a keyword or SKU
 */
export const getSearchTermsLocationDrilldown = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            keyword: req.query.keyword,
            sku: req.query.sku,
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            channel: req.query.channel || 'All',
            category: req.query.category || 'All',
            keywordType: req.query.keywordType || 'All',
            keywordTypeFilter: req.query.keywordTypeFilter || 'All',
            rank: req.query.rank || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        if (!filters.keyword && !filters.sku) {
            return res.status(400).json({ error: 'Keyword or SKU is required' });
        }

        console.log('\n========== SEARCH TERMS LOCATION DRILLDOWN API ==========');
        console.log('[REQUEST] Keyword:', filters.keyword, 'SKU:', filters.sku);

        const cacheKey = generateCacheKey('search_terms_loc_ctrl', filters);
        const data = await getCachedOrCompute(cacheKey, async () => {
            return await visibilityService.getSearchTermsLocationDrilldown(filters);
        }, CACHE_TTL.METRICS);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Locations count:', data.locations?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('=========================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Search Terms Location Drilldown:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({ error: 'Internal Server Error', locations: [] });
    }
};

/**
 * Get Search Terms Brand Breakdown
 * Returns SOS for all brands for a specific keyword
 */
export const getSearchTermsBrandBreakdown = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            platform: req.query.platform || 'All',
            keyword: req.query.keyword || 'All',
            channel: req.query.channel || 'All',
            location: req.query.location || 'All',
            category: req.query.category || 'All',
            keywordType: req.query.keywordType || 'All',
            keywordTypeFilter: req.query.keywordTypeFilter || 'All',
            rank: req.query.rank || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        console.log('\n========== SEARCH TERMS BRAND BREAKDOWN API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const cacheKey = generateCacheKey('search_terms_brand_breakdown_v1', filters);
        const data = await getCachedOrCompute(cacheKey, async () => {
            return await visibilityService.getSearchTermsBrandBreakdown(filters);
        }, CACHE_TTL.METRICS);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Brands count:', data?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('=========================================================\n');

        res.json({ brands: data });
    } catch (error) {
        console.error('[ERROR] Search Terms Brand Breakdown:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({ error: 'Internal Server Error', brands: [] });
    }
};

/**
 * Get BSR Data - AVG of best_seller_rank (Min_Rank) as integer
 * Returns: SKU-level table data with Current/Prev BSR and Discount
 */
export const getVisibilityBSRData = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || req.query.city || 'All',
            category: req.query.category || req.query.format || 'All',
            channel: req.query.channel || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        console.log('\n========== VISIBILITY BSR DATA API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const cacheKey = generateCacheKey('visibility_bsr_v2', filters);
        const data = await getCachedOrCompute(cacheKey, async () => {
            return await visibilityService.getBSRData(filters);
        }, CACHE_TTL.METRICS);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Rows count:', data?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('==============================================\n');

        res.json({ data });
    } catch (error) {
        console.error('[ERROR] Visibility BSR Data:', error);
        res.status(500).json({ error: 'Internal Server Error', data: [] });
    }
};


export const getVisibilityBSRTrends = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || req.query.city || 'All',
            category: req.query.category || req.query.format || 'All',
            channel: req.query.channel || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        console.log('\n========== VISIBILITY BSR TRENDS API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await visibilityService.getBSRTrends(filters);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE] Days:', data?.days?.length, 'Categories:', Object.keys(data?.categories || {}).length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('==============================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Visibility BSR Trends:', error);
        res.status(500).json({ error: 'Internal Server Error', days: [], categories: {} });
    }
};


