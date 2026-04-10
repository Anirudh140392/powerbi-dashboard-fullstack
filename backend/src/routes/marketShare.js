import { Platform, SubCategoryKpi, CrossPlatformOverview, MarketShareTrends, MarketShareCompetition, MarketShareCompetitionFilterOptions, MarketShareTopFilterOptions, MarketShareCompetitionTrends, MarketShareDrilldown, MarketShareLatestDate } from '../controllers/marketShareController.js';

export default (app) => {
    /**
     * @swagger
     * /api/market-share:
     *   get:
     *     summary: Get Market Share metrics
     *     description: Retrieve metrics for Market Share (Platform).
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
    app.get('/api/market-share', Platform);

    /**
     * @swagger
     * /api/market-share/sub-category-kpi:
     *   get:
     *     summary: Get Sub-Category KPI data
     *     description: Retrieve brand-level KPIs grouped by sub-category from rb_brand_ms.
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *       - in: query
     *         name: category
     *         schema:
     *           type: string
     *       - in: query
     *         name: subCategory
     *         schema:
     *           type: string
     *         description: Specific sub-category to get brand data for
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
     *         description: Successful response with subCategories, brands, selectedSubCategory
     */
    app.get('/api/market-share/sub-category-kpi', SubCategoryKpi);

    /**
     * @swagger
     * /api/market-share/cross-platform:
     *   get:
     *     summary: Get Cross Platform Overview KPIs
     *     description: Per-platform KPIs (categorySize, mwMarketShare, mwSales, mlMarketShare, mlSales) with deltas
     *     responses:
     *       200:
     *         description: Successful response with platform-keyed KPI data
     */
    app.get('/api/market-share/cross-platform', CrossPlatformOverview);

    /**
     * @swagger
     * /api/market-share/trends:
     *   get:
     *     summary: Get Market Share Trends (Time Series)
     *     description: Retrieve time-series data for Market Share metrics based on filters.
     *     responses:
     *       200:
     *         description: Successful response with timeSeries array.
     */
    app.get('/api/market-share/trends', MarketShareTrends);

    /**
     * @swagger
     * /api/market-share/competition:
     *   get:
     *     summary: Get Market Share Competition (Brands View)
     *     description: Retrieve generic KPIs like Market Share and Sales for top brands to populate competition tables.
     *     responses:
     *       200:
     *         description: Successful response with brands array.
     */
    app.get('/api/market-share/competition', MarketShareCompetition);

    /**
     * @swagger
     * /api/market-share/competition-filter-options:
     *   get:
     *     summary: Get Market Share cascading filter options
     *     description: Retrieve cascading categories, brands for the Competition drawer.
     *     responses:
     *       200:
     *         description: Successful response.
     */
    app.get('/api/market-share/competition-filter-options', MarketShareCompetitionFilterOptions);

    /**
     * @swagger
     * /api/market-share/top-filter-options:
     *   get:
     *     summary: Get top-level filter options (Platform, Category, Channel)
     *     description: Retrieve filter options for the main Header dropdowns from rb_ms_olap.
     *     responses:
     *       200:
     *         description: Successful response.
     */
    app.get('/api/market-share/top-filter-options', MarketShareTopFilterOptions);

    /**
     * @swagger
     * /api/market-share/competition-trends:
     *   get:
     *     summary: Get Market Share Competition Trends (Time Series)
     *     description: Retrieve time-series data for multiple brands/SKUs.
     *     responses:
     *       200:
     *         description: Successful response.
     */
    app.get('/api/market-share/competition-trends', MarketShareCompetitionTrends);

    /**
     * @swagger
     * /api/market-share/drilldown:
     *   get:
     *     summary: Get Hierarchical Market Share Drilldown
     *     description: Retrieve Brand -> Sub-Brand -> SKU hierarchy with share and mrp.
     *     responses:
     *       200:
     *         description: Successful response.
     */
    app.get('/api/market-share/drilldown', MarketShareDrilldown);
    app.get('/api/market-share/latest-date', MarketShareLatestDate);
};
