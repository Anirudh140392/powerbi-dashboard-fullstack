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
