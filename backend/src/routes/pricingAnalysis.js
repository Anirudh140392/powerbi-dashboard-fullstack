import { PriceAndDiscountIntelligence } from '../controllers/pricingAnalysisController.js';

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
};
