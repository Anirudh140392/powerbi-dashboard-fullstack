import {
    AvailabilityControlTower,
    getAvailabilityOverview,
    getPlatformKpiMatrix,
    getOsaPercentageDetail,
    getDOI,
    getMetroCityStockAvailability,
    getAvailabilityFilterOptions,
    getOsaDetailByCategory,
    getAvailabilityKpiTrends,
    getAvailabilityCompetition,
    getAvailabilityCompetitionFilterOptions,
    getAvailabilityCompetitionBrandTrends,
    getSignalLabData
} from '../controllers/availabilityAnalysisController.js';

export default (app) => {
    /**
     * @swagger
     * /api/availability-analysis:
     *   get:
     *     summary: Get Availability Analysis metrics
     *     description: Retrieve metrics for Availability Analysis.
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
    app.get('/api/availability-analysis', AvailabilityControlTower);

    // ==================== Absolute OSA Section APIs ====================

    /**
     * @swagger
     * /api/availability-analysis/absolute-osa/availability-overview:
     *   get:
     *     summary: Get Availability Overview for Absolute OSA page
     *     description: Retrieve availability overview data with applied filters.
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *       - in: query
     *         name: location
     *         schema:
     *           type: string
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response
     */
    app.get('/api/availability-analysis/absolute-osa/availability-overview', getAvailabilityOverview);

    /**
     * @swagger
     * /api/availability-analysis/absolute-osa/platform-kpi-matrix:
     *   get:
     *     summary: Get Platform KPI Matrix for Absolute OSA page
     *     description: Retrieve platform KPI matrix data with applied filters.
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *       - in: query
     *         name: location
     *         schema:
     *           type: string
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response
     */
    app.get('/api/availability-analysis/absolute-osa/platform-kpi-matrix', getPlatformKpiMatrix);

    /**
     * @swagger
     * /api/availability-analysis/absolute-osa/osa-percentage-detail:
     *   get:
     *     summary: Get OSA Percentage Detail View for Absolute OSA page
     *     description: Retrieve OSA percentage detail view data with applied filters.
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *       - in: query
     *         name: location
     *         schema:
     *           type: string
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response
     */
    app.get('/api/availability-analysis/absolute-osa/osa-percentage-detail', getOsaPercentageDetail);

    /**
     * @swagger
     * /api/availability-analysis/absolute-osa/doi:
     *   get:
     *     summary: Get Days of Inventory (DOI) for Availability Overview
     *     description: Calculate DOI using formula [[MRP * Inventory] / last 30 days Sales] * 30
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *       - in: query
     *         name: location
     *         schema:
     *           type: string
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response with DOI value
     */
    app.get('/api/availability-analysis/absolute-osa/doi', getDOI);

    /**
     * @swagger
     * /api/availability-analysis/absolute-osa/metro-city-stock-availability:
     *   get:
     *     summary: Get Metro City Stock Availability for Availability Overview
     *     description: Calculate Stock Availability only for Tier 1 (Metro) cities
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *       - in: query
     *         name: location
     *         schema:
     *           type: string
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response with Metro City Stock Availability value
     */
    app.get('/api/availability-analysis/absolute-osa/metro-city-stock-availability', getMetroCityStockAvailability);

    /**
     * @swagger
     * /api/availability-analysis/filter-options:
     *   get:
     *     summary: Get dynamic filter options for availability analysis
     *     description: Fetch filter options from rca_sku_dim (for Platform, City, Category) and rb_pdp_olap (for Date, Month)
     *     parameters:
     *       - in: query
     *         name: filterType
     *         schema:
     *           type: string
     *           enum: [platforms, categories, products, cities, months, dates, zones, metroFlags]
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *       - in: query
     *         name: category
     *         schema:
     *           type: string
     *         description: Filter for cascading - applies to cities filter
     *       - in: query
     *         name: city
     *         schema:
     *           type: string
     *         description: Filter for cascading
     *     responses:
     *       200:
     *         description: Successful response with filter options
     */
    app.get('/api/availability-analysis/filter-options', getAvailabilityFilterOptions);

    // OSA Detail by Category - Returns categories with daily OSA % for last 31 days
    app.get('/api/availability-analysis/osa-detail-by-category', getOsaDetailByCategory);

    /**
     * @swagger
     * /api/availability-analysis/kpi-trends:
     *   get:
     *     summary: Get KPI Trends for Trends/Competition Drawer
     *     description: Returns time-series data for OSA, DOI, Fillrate, Assortment
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *       - in: query
     *         name: period
     *         schema:
     *           type: string
     *           enum: [1M, 3M, 6M, 1Y, Custom]
     *       - in: query
     *         name: timeStep
     *         schema:
     *           type: string
     *           enum: [Daily, Weekly, Monthly]
     *     responses:
     *       200:
     *         description: Successful response with trend points
     */
    app.get('/api/availability-analysis/kpi-trends', getAvailabilityKpiTrends);

    // ==================== Competition APIs ====================

    /**
     * @swagger
     * /api/availability-analysis/competition:
     *   get:
     *     summary: Get Competition Brand Data
     *     description: Returns top 10 brands with OSA, DOI, Fillrate, Assortment metrics
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *       - in: query
     *         name: location
     *         schema:
     *           type: string
     *       - in: query
     *         name: category
     *         schema:
     *           type: string
     *       - in: query
     *         name: period
     *         schema:
     *           type: string
     *           enum: [1M, 3M, 6M, 1Y]
     *     responses:
     *       200:
     *         description: Successful response with brand data
     */
    app.get('/api/availability-analysis/competition', getAvailabilityCompetition);

    /**
     * @swagger
     * /api/availability-analysis/competition-filter-options:
     *   get:
     *     summary: Get Competition Filter Options
     *     description: Returns cascading filter options for locations, categories, brands, skus
     */
    app.get('/api/availability-analysis/competition-filter-options', getAvailabilityCompetitionFilterOptions);

    /**
     * @swagger
     * /api/availability-analysis/competition-brand-trends:
     *   get:
     *     summary: Get Competition Brand Trends
     *     description: Returns time-series data for comparing multiple brands
     */
    app.get('/api/availability-analysis/competition-brand-trends', getAvailabilityCompetitionBrandTrends);

    /**
     * @swagger
     * /api/availability-analysis/signal-lab:
     *   get:
     *     summary: Get Signal Lab Data for Availability Analysis
     *     description: Returns SKU-level OSA and DOI metrics with formulas - OSA = sum(neno_osa)/sum(deno_osa), DOI = Inventory/(sum(Qty_Sold in 30 days)/30)
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *       - in: query
     *         name: location
     *         schema:
     *           type: string
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response with SKU data
     */
    app.get('/api/availability-analysis/signal-lab', getSignalLabData);
};

