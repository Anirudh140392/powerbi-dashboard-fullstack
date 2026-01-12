import visibilityService from '../services/visibilityService.js';

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
 * Returns: Overall SOS, Sponsored SOS, Organic SOS, Display SOS
 */
export const getVisibilityOverview = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            keyword: req.query.keyword || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        console.log('\n========== VISIBILITY OVERVIEW API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

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
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        console.log('\n========== VISIBILITY PLATFORM KPI MATRIX API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

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
            view: req.query.view || 'keywords', // keywords, skus, platforms
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        console.log('\n========== VISIBILITY KEYWORDS AT GLANCE API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

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
 * Get Top Search Terms
 * Returns: Search terms with SOS metrics
 */
export const getVisibilityTopSearchTerms = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            filter: req.query.filter || 'All', // All, Branded, Competitor, Generic
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        console.log('\n========== VISIBILITY TOP SEARCH TERMS API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

        const data = await visibilityService.getTopSearchTerms(filters);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Terms count:', data.terms?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('[DATA SAMPLE]: First term:', data.terms?.[0]?.keyword || 'N/A');
        console.log('=====================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Visibility Top Search Terms:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({ error: 'Internal Server Error', terms: [] });
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
            metroFlag: req.query.metroFlag || 'All'
        };
        console.log('\n========== VISIBILITY FILTER OPTIONS API ==========');
        console.log('[REQUEST] Params:', JSON.stringify(params, null, 2));

        const data = await visibilityService.getVisibilityFilterOptions(params);

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
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        if (!filters.keyword) {
            return res.status(400).json({ error: 'Keyword is required' });
        }

        console.log('\n========== VISIBILITY BRAND DRILLDOWN API ==========');
        console.log('[REQUEST] Keyword:', filters.keyword);
        console.log('[REQUEST] Platform:', filters.platform);

        const data = await visibilityService.getBrandDrilldown(filters);

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
 * Returns: Date range of the latest month with available data in rb_kw table
 */
export const getVisibilityLatestAvailableDates = async (req, res) => {
    const startTime = Date.now();
    try {
        console.log('\n========== VISIBILITY LATEST AVAILABLE DATES API ==========');
        console.log('[TIMING] Request received at:', new Date().toISOString());

        const data = await visibilityService.getLatestAvailableDates();

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
 * Returns: Time series data for Overall SOS, Sponsored SOS, Organic SOS, Display SOS
 */
export const getVisibilityKpiTrends = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            period: req.query.period || '1M',
            timeStep: req.query.timeStep || 'Daily',
            startDate: req.query.startDate,
            endDate: req.query.endDate
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
            location: req.query.location || 'All',
            period: req.query.period || '1M'
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

