import {
    VisibilityWorkspace,
    getVisibilityOverview,
    getVisibilityPlatformKpiMatrix,
    getVisibilityKeywordsAtGlance,
    getVisibilityFilterOptions,
    getVisibilityBrandDrilldown,
    getVisibilityLatestAvailableDates,
    getVisibilityKpiTrends,
    getVisibilityCompetition,
    getBrandComparisonTrends,
    getVisibilityCategories,
    getVisibilityKeywords,
    getVisibilityKeywordTypes,
    getVisibilitySkuDrilldown,
    getVisibilityCityDrilldown,
    getVisibilityGainersAndDrainers,
    getSearchTermsPerformance,
    getSearchTermsLocationDrilldown,
    getSearchTermsBrandBreakdown,
    getVisibilityBSRData,
    getVisibilityBSRTrends
} from '../controllers/visibilityAnalysisController.js';
import { getSalesVisibilitySignalCityDetails, getSalesVisibilitySignals } from '../controllers/salesSignalLabController.js';


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

    /**
     * @swagger
     * /api/visibility-analysis/latest-available-dates:
     *   get:
     *     summary: Get latest available dates for Visibility Analysis
     *     description: Returns the date range of the latest month that has data in rb_kw_olap table. Call this first before fetching visibility data.
     *     responses:
     *       200:
     *         description: Date range for available visibility data
     */
    app.get('/api/visibility-analysis/latest-available-dates', getVisibilityLatestAvailableDates);

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
     * /api/visibility-analysis/brand-drilldown:
     *   get:
     *     summary: Get Brand Visibility Drilldown for a keyword
     *     description: Retrieve SOS metrics for all brands associated with a specific keyword, including delta changes.
     *     parameters:
     *       - in: query
     *         name: keyword
     *         required: true
     *         schema:
     *           type: string
     *         description: The keyword to drill down into
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *     responses:
     *       200:
     *         description: Successful response with brands array and top losers
     */
    app.get('/api/visibility-analysis/brand-drilldown', getVisibilityBrandDrilldown);

    /**
     * @swagger
     * /api/visibility-analysis/kpi-trends:
     *   get:
     *     summary: Get Visibility KPI Trends for chart display
     *     description: Returns daily SOS trends for Overall, Sponsored, Organic, and Display metrics
     *     parameters:
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
     *         name: period
     *         schema:
     *           type: string
     *           enum: [1M, 3M, 6M, 1Y]
     *         description: Time period for trends
     *     responses:
     *       200:
     *         description: Successful response with timeSeries array
     */
    app.get('/api/visibility-analysis/kpi-trends', getVisibilityKpiTrends);

    /**
     * @swagger
     * /api/visibility-analysis/competition:
     *   get:
     *     summary: Get Visibility Competition data
     *     description: Returns brand and SKU competition data with SOS metrics and delta values
     *     parameters:
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
     *         name: period
     *         schema:
     *           type: string
     *           enum: [1M, 3M, 6M, 1Y]
     *         description: Time period for comparison
     *     responses:
     *       200:
     *         description: Successful response with brands and skus arrays
     */
    app.get('/api/visibility-analysis/competition', getVisibilityCompetition);

    /**
     * @swagger
     * /api/visibility-analysis/brand-comparison-trends:
     *   get:
     *     summary: Get Brand Comparison Trends
     *     description: Returns daily SOS trends for multiple selected brands for chart comparison
     *     parameters:
     *       - in: query
     *         name: brands
     *         schema:
     *           type: string
     *         description: Comma-separated list of brand names to compare
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *       - in: query
     *         name: period
     *         schema:
     *           type: string
     *           enum: [1M, 3M, 6M, 1Y]
     *         description: Time period for trends
     *     responses:
     *       200:
     *         description: Successful response with brands trends and days array
     */
    app.get('/api/visibility-analysis/brand-comparison-trends', getBrandComparisonTrends);

    // Alias routes for frontend compatibility
    app.get('/api/visibility-analysis/visibility-signals', getSalesVisibilitySignals);
    app.get('/api/visibility-analysis/visibility-signals/city-details', getSalesVisibilitySignalCityDetails);

    // Dynamic dropdown routes for Visibility Analysis
    app.get('/api/visibility-analysis/categories', getVisibilityCategories);
    app.get('/api/visibility-analysis/keywords', getVisibilityKeywords);
    app.get('/api/visibility-analysis/keyword-types', getVisibilityKeywordTypes);
    app.get('/api/visibility-analysis/sku-drilldown', getVisibilitySkuDrilldown);
    app.get('/api/visibility-analysis/city-drilldown', getVisibilityCityDrilldown);

    // SOS Gainers & Drainers
    app.get('/api/visibility-analysis/gainers-drainers', getVisibilityGainersAndDrainers);

    // Search Terms Performance (Top Search Terms segment with keyword/SKU modes)
    app.get('/api/visibility-analysis/search-terms-performance', getSearchTermsPerformance);
    app.get('/api/visibility-analysis/search-terms-locations', getSearchTermsLocationDrilldown);
    app.get('/api/visibility-analysis/search-terms-brand-breakdown', getSearchTermsBrandBreakdown);

    // BSR Data for Ecommerce
    app.get('/api/visibility-analysis/bsr-data', getVisibilityBSRData);

    // BSR Trends (daily KPI trends per category)
    app.get('/api/visibility-analysis/bsr-trends', getVisibilityBSRTrends);
};

