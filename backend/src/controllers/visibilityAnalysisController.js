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
 * Get Keyword & SKU Visibility Metrics from rb_kw table
 * Returns: Keyword and SKU level visibility metrics with filters
 */
export const getKeywordSkuVisibilityMetrics = async (req, res) => {
    const startTime = Date.now();
    try {
        console.log('\n========== KEYWORD-SKU VISIBILITY METRICS API ==========');
        const filters = {
            keyword: req.query.keyword || null,
            sku: req.query.sku || null,
            platform: req.query.platform || 'All',
            location: req.query.location || 'All',
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null
        };
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

        const data = await visibilityService.getKeywordSkuVisibilityMetrics(filters);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Keywords count:', data.keywords?.length);
        console.log('[RESPONSE]: Summary -', JSON.stringify(data.summary, null, 2));
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('========================================================\n');

        res.json({
            success: true,
            data,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ERROR] Keyword-SKU Visibility Metrics:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({
            success: false,
            error: 'Failed to fetch keyword-SKU visibility metrics',
            message: error.message
        });
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
 * Get Visibility Signals for Keyword & SKU (Drainers/Gainers)
 * Returns: Signals with impact metrics, KPIs, and city-level data
 */
export const getVisibilitySignals = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            level: req.query.level || 'keyword',  // 'keyword' or 'sku'
            signalType: req.query.signalType || 'drainer',  // 'drainer' or 'gainer'
            platform: req.query.platform || 'All',
            location: req.query.location || 'All',
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null,
            compareStartDate: req.query.compareStartDate || null,
            compareEndDate: req.query.compareEndDate || null
        };
        console.log('\n========== VISIBILITY SIGNALS API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

        const data = await visibilityService.getVisibilitySignals(filters);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Signals count:', data.signals?.length);
        console.log('[RESPONSE]: Summary -', JSON.stringify(data.summary, null, 2));
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('=============================================\n');

        res.json({
            success: true,
            ...data,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ERROR] Visibility Signals:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({
            success: false,
            error: 'Failed to fetch visibility signals',
            message: error.message,
            signals: []
        });
    }
};

/**
 * Get city-level KPI details for a specific keyword or SKU visibility signal
 * Returns: City-level metrics from both rb_kw and rb_pdp_olap tables
 */
export const getVisibilitySignalCityDetails = async (req, res) => {
    const startTime = Date.now();
    try {
        const params = {
            keyword: req.query.keyword || null,
            skuName: req.query.skuName || null,
            level: req.query.level || 'keyword',
            platform: req.query.platform || 'All',
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null
        };
        console.log('\n========== VISIBILITY SIGNAL CITY DETAILS API ==========');
        console.log('[REQUEST] Params:', JSON.stringify(params, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

        const data = await visibilityService.getVisibilitySignalCityDetails(params);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Cities count:', data.cities?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('=========================================================\n');

        res.json({
            success: true,
            ...data,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ERROR] Visibility Signal City Details:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({
            success: false,
            error: 'Failed to fetch visibility signal city details',
            message: error.message,
            cities: []
        });
    }
};


