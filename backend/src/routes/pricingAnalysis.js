import { PriceAndDiscountIntelligence, getEcpComparison, getEcpByBrand } from '../controllers/pricingAnalysisController.js';

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
};
