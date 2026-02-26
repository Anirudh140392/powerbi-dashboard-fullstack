import { PriceAndDiscountIntelligence, getEcpComparison, getEcpByBrand, getDiscountByCategory, getDiscountByBrand, getEcpWeekdayWeekend, getBrandPriceOverview, getBrandDiscountTrend, getEcpByCity, getPricingOverviewKpis, getCategoryOverviewKpis, getPricingInsights, getKpiTrends, getTrendsFilterOptions } from '../controllers/pricingAnalysisController.js';

import { getOneViewPriceGrid } from '../controllers/oneViewPriceGridController.js';

export default (app) => {
    /**
     * @swagger
     * /api/pricing-analysis:
     *   get:
     *     summary: Get Pricing Analysis metrics
     *     description: Retrieve metrics for Pricing Analysis (Price & Discount Intelligence).
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
    app.get('/api/pricing-analysis', PriceAndDiscountIntelligence);

    app.get('/api/pricing-analysis/kpi-trends', getKpiTrends);
    app.get('/api/pricing-analysis/trends-filter-options', getTrendsFilterOptions);

    /**
     * @swagger
     * /api/pricing-analysis/ecp-comparison:
     *   get:
     *     summary: Get ECP Comparison between two time periods
     *     description: Compares ECP (Effective Consumer Price) between selected and comparison date ranges, grouped by Platform and Brand.
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform (e.g., Blinkit, Instamart, Zepto)
     *       - in: query
     *         name: location
     *         schema:
     *           type: string
     *         description: Filter by location/city
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *         description: Start date of current period (YYYY-MM-DD)
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *         description: End date of current period (YYYY-MM-DD)
     *       - in: query
     *         name: compareStartDate
     *         schema:
     *           type: string
     *           format: date
     *         description: Start date of comparison period (YYYY-MM-DD)
     *       - in: query
     *         name: compareEndDate
     *         schema:
     *           type: string
     *           format: date
     *         description: End date of comparison period (YYYY-MM-DD)
     *     responses:
     *       200:
     *         description: Successful response with ECP comparison data
     */
    app.get('/api/pricing-analysis/ecp-comparison', getEcpComparison);

    /**
     * @swagger
     * /api/pricing-analysis/ecp-by-brand:
     *   get:
     *     summary: Get ECP by Brand data
     *     description: Returns average MRP and ECP (Selling Price) grouped by Brand for a platform.
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform (required)
     *       - in: query
     *         name: location
     *         schema:
     *           type: string
     *         description: Filter by location/city
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
     *         description: Successful response with ECP by Brand data
     */
    app.get('/api/pricing-analysis/ecp-by-brand', getEcpByBrand);

    /**
     * @swagger
     * /api/pricing-analysis/discount-by-category:
     *   get:
     *     summary: Get average discount by Category per Platform
     *     description: Returns average discount % for each category across all platforms (Blinkit, Instamart, Zepto).
     *     parameters:
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
     *         description: Successful response with discount by category data
     */
    app.get('/api/pricing-analysis/discount-by-category', getDiscountByCategory);

    /**
     * @swagger
     * /api/pricing-analysis/discount-by-brand:
     *   get:
     *     summary: Get average discount by Brand within a Category per Platform
     *     description: Returns average discount % for each brand in a specific category across all platforms.
     *     parameters:
     *       - in: query
     *         name: category
     *         required: true
     *         schema:
     *           type: string
     *         description: Category to drill down into
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
     *         description: Successful response with discount by brand data
     */
    app.get('/api/pricing-analysis/discount-by-brand', getDiscountByBrand);

    /**
     * @swagger
     * /api/pricing-analysis/ecp-weekday-weekend:
     *   get:
     *     summary: Get ECP by Brand split by Weekday vs Weekend
     *     description: Returns average ECP (Selling Price) for each brand, split by weekday (Mon-Fri) and weekend (Sat-Sun).
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
     *         description: Filter by location/city
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
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *         description: Filter by specific brand
     *     responses:
     *       200:
     *         description: Successful response with ECP weekday/weekend data
     */
    app.get('/api/pricing-analysis/ecp-weekday-weekend', getEcpWeekdayWeekend);

    /**
     * @swagger
     * /api/pricing-analysis/brand-price-overview:
     *   get:
     *     summary: Get Brand Price Overview data
     *     description: Returns ECP data grouped by Brand, Platform, and Gram Size
     *     parameters:
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
     *         description: Successful response with brand price overview data
     */
    app.get('/api/pricing-analysis/brand-price-overview', getBrandPriceOverview);

    /**
     * @swagger
     * /api/pricing-analysis/one-view-price-grid:
     *   get:
     *     summary: Get One View Price Grid data
     *     description: Returns date-wise product pricing data with all columns filterable
     *     parameters:
     *       - in: query
     *         name: startDate
     *         required: true
     *         schema:
     *           type: string
     *           format: date
     *         description: Start date (YYYY-MM-DD)
     *       - in: query
     *         name: endDate
     *         required: true
     *         schema:
     *           type: string
     *           format: date
     *         description: End date (YYYY-MM-DD)
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
     *         name: product
     *         schema:
     *           type: string
     *         description: Filter by product name (partial match)
     *       - in: query
     *         name: skuType
     *         schema:
     *           type: string
     *           enum: [Own, Competition]
     *         description: Filter by SKU type (Own/Competition)
     *       - in: query
     *         name: format
     *         schema:
     *           type: string
     *         description: Filter by format (Category)
     *       - in: query
     *         name: ml
     *         schema:
     *           type: string
     *         description: Filter by ML/quantity
     *     responses:
     *       200:
     *         description: Successful response with one view price grid data
     */
    app.get('/api/pricing-analysis/one-view-price-grid', getOneViewPriceGrid);

    /**
     * @swagger
     * /api/pricing-analysis/brand-discount-trend:
     *   get:
     *     summary: Get Brand Discount Trend on monthly basis
     *     description: Returns brand-wise average discount data grouped by month for chart visualization
     *     parameters:
     *       - in: query
     *         name: startDate
     *         required: true
     *         schema:
     *           type: string
     *           format: date
     *         description: Start date (YYYY-MM-DD)
     *       - in: query
     *         name: endDate
     *         required: true
     *         schema:
     *           type: string
     *           format: date
     *         description: End date (YYYY-MM-DD)
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform (e.g., Blinkit, Zepto, Instamart)
     *     responses:
     *       200:
     *         description: Successful response with brand discount trend data
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   type: object
     *                   properties:
     *                     months:
     *                       type: array
     *                       items:
     *                         type: string
     *                     series:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           name:
     *                             type: string
     *                           data:
     *                             type: array
     *                             items:
     *                               type: number
     */
    app.get('/api/pricing-analysis/brand-discount-trend', getBrandDiscountTrend);

    /**
     * @swagger
     * /api/pricing-analysis/ecp-by-city:
     *   get:
     *     summary: Get ECP and Discount by City and Brand
     *     description: Returns average ECP and Discount grouped by City, Brand, and Platform.
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: city
     *         schema:
     *           type: string
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response with ECP by city data
     */
    app.get('/api/pricing-analysis/ecp-by-city', getEcpByCity);

    /**
     * @swagger
     * /api/pricing-analysis/overview-kpis:
     *   get:
     *     summary: Get Pricing Overview KPIs
     *     description: Returns Discount, Price Per Unit, RPI, and Average Selling Price KPIs from rb_pdp_olap, with current vs previous period comparison.
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
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: compareStartDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: compareEndDate
     *         schema:
     *           type: string
     *           format: date
     *     responses:
     *       200:
     *         description: Successful response with pricing overview KPIs
     */
    app.get('/api/pricing-analysis/overview-kpis', getPricingOverviewKpis);

    /**
     * @swagger
     * /api/pricing-analysis/category-overview-kpis:
     *   get:
     *     summary: Get KPIs grouped by Category or City
     *     parameters:
     *       - in: query
     *         name: dimension
     *         schema:
     *           type: string
     *           enum: [category, city]
     *       - in: query
     *         name: platform
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
     *       - in: query
     *         name: filterCategories
     *         schema:
     *           type: string
     *       - in: query
     *         name: filterCities
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: KPIs grouped by Category or City
     */
    app.get('/api/pricing-analysis/category-overview-kpis', getCategoryOverviewKpis);

    /**
     * @swagger
     * /api/pricing-analysis/insights:
     *   get:
     *     summary: Get pricing insights (price drop/increase for own and competitor SKUs)
     *     parameters:
     *       - in: query
     *         name: type
     *         schema:
     *           type: string
     *           enum: [pd_my, pi_my, pd_comp, pi_comp]
     *         description: pd_my=price drop own, pi_my=price increase own, pd_comp=price drop comp, pi_comp=price increase comp
     */
    app.get('/api/pricing-analysis/insights', getPricingInsights);
};


