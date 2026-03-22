/**
 * Insights Routes
 * API endpoints for the Insights page
 */

import { getInsights } from '../controllers/insightsController.js';

export default (app) => {
    /**
     * @swagger
     * /api/insights:
     *   get:
     *     summary: Get generated insights for the Insights page
     *     description: Retrieve all anomalies, recommendations, and KPI overviews
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *       - in: query
     *         name: city
     *         schema:
     *           type: string
     *       - in: query
     *         name: category
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response
     */
    app.get('/api/insights', getInsights);
};
