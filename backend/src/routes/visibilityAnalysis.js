import {
    VisibilityWorkspace,
    getVisibilityOverview,
    getVisibilityPlatformKpiMatrix,
    getVisibilityKeywordsAtGlance,
    getVisibilityTopSearchTerms,
    getKeywordSkuVisibilityMetrics,
    getVisibilityFilterOptions,
    getVisibilitySignals,
    getVisibilitySignalCityDetails
} from '../controllers/visibilityAnalysisController.js';

export default (app) => {
    /**
     * @swagger
     * /api/visibility-analysis:
     *   get:
     *     summary: Get Visibility Analysis metrics (legacy)
     *     description: Retrieve metrics for Visibility Analysis.
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *     responses:
     *       200:
     *         description: Successful response
     */
    app.get('/api/visibility-analysis', VisibilityWorkspace);

    // ==================== Visibility Analysis APIs ====================

    /**
     * @swagger
     * /api/visibility-analysis/visibility-overview:
     *   get:
     *     summary: Get Visibility Overview KPI cards
     *     description: Retrieve SOS metrics cards (Overall, Sponsored, Organic, Display)
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *         description: Filter by brand
     *       - in: query
     *         name: location
     *         schema:
     *           type: string
     *         description: Filter by location
     *       - in: query
     *         name: keyword
     *         schema:
     *           type: string
     *         description: Filter by keyword
     *     responses:
     *       200:
     *         description: Successful response with cards array
     */
    app.get('/api/visibility-analysis/visibility-overview', getVisibilityOverview);

    /**
     * @swagger
     * /api/visibility-analysis/platform-kpi-matrix:
     *   get:
     *     summary: Get Platform KPI Matrix
     *     description: Retrieve Platform/Format/City breakdown with SOS metrics
     *     parameters:
     *       - in: query
     *         name: viewMode
     *         schema:
     *           type: string
     *           enum: [Platform, Format, City]
     *         description: View mode for matrix
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *         description: Filter by brand
     *     responses:
     *       200:
     *         description: Successful response with platform, format, city data
     */
    app.get('/api/visibility-analysis/platform-kpi-matrix', getVisibilityPlatformKpiMatrix);

    /**
     * @swagger
     * /api/visibility-analysis/keywords-at-glance:
     *   get:
     *     summary: Get Keywords at a Glance
     *     description: Retrieve hierarchical keyword/SKU drill data
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *       - in: query
     *         name: view
     *         schema:
     *           type: string
     *           enum: [keywords, skus, platforms]
     *         description: View mode for hierarchy
     *     responses:
     *       200:
     *         description: Successful response with hierarchy array
     */
    app.get('/api/visibility-analysis/keywords-at-glance', getVisibilityKeywordsAtGlance);

    /**
     * @swagger
     * /api/visibility-analysis/top-search-terms:
     *   get:
     *     summary: Get Top Search Terms
     *     description: Retrieve search terms with SOS metrics
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *       - in: query
     *         name: filter
     *         schema:
     *           type: string
     *           enum: [All, Branded, Competitor, Generic]
     *         description: Filter by term type
     *     responses:
     *       200:
     *         description: Successful response with terms array
     */
    app.get('/api/visibility-analysis/top-search-terms', getVisibilityTopSearchTerms);

    /**
     * @swagger
     * /api/visibility-analysis/keyword-sku-metrics:
     *   get:
     *     summary: Get Keyword & SKU Visibility Metrics
     *     description: Retrieve keyword and SKU level visibility metrics from rb_kw table
     *     parameters:
     *       - in: query
     *         name: keyword
     *         schema:
     *           type: string
     *         description: Filter by keyword (supports partial match)
     *       - in: query
     *         name: sku
     *         schema:
     *           type: string
     *         description: Filter by SKU/keyword_search_product (supports partial match)
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *       - in: query
     *         name: location
     *         schema:
     *           type: string
     *         description: Filter by location
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *         description: Start date (YYYY-MM-DD)
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *         description: End date (YYYY-MM-DD)
     *     responses:
     *       200:
     *         description: Successful response with keywords array and summary
     */
    app.get('/api/visibility-analysis/keyword-sku-metrics', getKeywordSkuVisibilityMetrics);

    /**
     * @swagger
     * /api/visibility-analysis/filter-options:
     *   get:
     *     summary: Get dynamic filter options for Advanced Filters modal
     *     description: Cascading filter options - selected filters narrow down options for dependent filters
     *     parameters:
     *       - in: query
     *         name: filterType
     *         required: true
     *         schema:
     *           type: string
     *           enum: [platforms, months, formats, cities, pincodes, metroFlags, kpis]
     *         description: Type of filter options to fetch
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Selected platform (for cascading)
     *       - in: query
     *         name: format
     *         schema:
     *           type: string
     *         description: Selected format/category (for cascading)
     *       - in: query
     *         name: city
     *         schema:
     *           type: string
     *         description: Selected city (for cascading)
     *       - in: query
     *         name: metroFlag
     *         schema:
     *           type: string
     *         description: Selected metro flag/tier (for cascading)
     *     responses:
     *       200:
     *         description: Successful response with options array
     */
    app.get('/api/visibility-analysis/filter-options', getVisibilityFilterOptions);

    /**
     * @swagger
     * /api/visibility-analysis/visibility-signals:
     *   get:
     *     summary: Get Visibility Signals for Keyword & SKU (Drainers/Gainers)
     *     description: Retrieve signals with impact metrics, SOS KPIs, and city-level data from rb_kw table
     *     parameters:
     *       - in: query
     *         name: level
     *         schema:
     *           type: string
     *           enum: [keyword, sku]
     *           default: keyword
     *         description: Level to analyze - keyword (uses keyword column) or sku (uses keyword_search_product column)
     *       - in: query
     *         name: signalType
     *         schema:
     *           type: string
     *           enum: [drainer, gainer]
     *           default: drainer
     *         description: Type of signal - drainer (declining) or gainer (improving)
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *       - in: query
     *         name: location
     *         schema:
     *           type: string
     *         description: Filter by location
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *         description: Start date (YYYY-MM-DD)
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *         description: End date (YYYY-MM-DD)
     *     responses:
     *       200:
     *         description: Successful response with signals array and summary
     */
    app.get('/api/visibility-analysis/visibility-signals', getVisibilitySignals);

    /**
     * @swagger
     * /api/visibility-analysis/visibility-signals/city-details:
     *   get:
     *     summary: Get city-level KPI details for a visibility signal
     *     description: Retrieve city-level metrics from rb_kw (visibility) and rb_pdp_olap (sales) for a specific keyword or SKU
     *     parameters:
     *       - in: query
     *         name: keyword
     *         schema:
     *           type: string
     *         description: Keyword to get city details for (when level=keyword)
     *       - in: query
     *         name: skuName
     *         schema:
     *           type: string
     *         description: SKU name to get city details for (when level=sku)
     *       - in: query
     *         name: level
     *         schema:
     *           type: string
     *           enum: [keyword, sku]
     *         description: Level of the signal (keyword or sku)
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *         description: Start date (YYYY-MM-DD)
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *         description: End date (YYYY-MM-DD)
     *     responses:
     *       200:
     *         description: Successful response with cities array containing KPIs
     */
    app.get('/api/visibility-analysis/visibility-signals/city-details', getVisibilitySignalCityDetails);
};
