import { KpisOverview } from '../controllers/performanceMarketingController.js';

export default (app) => {
    /**
     * @swagger
     * /api/performance-marketing:
     *   get:
     *     summary: Get Performance Marketing metrics
     *     description: Retrieve metrics for Performance Marketing (KPIs Overview).
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
    app.get('/api/performance-marketing', KpisOverview);
};
