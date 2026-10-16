import { getInsights, getInsightsFilters, getCorrelations, getCorrelationsTrend } from '../controllers/insightsController.js';
import { createAlertHandler, getAlertsHandler, deleteAlertHandler, updateAlertHandler, testWhatsappAlertHandler } from '../controllers/alertController.js';

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

    app.post('/api/insights/alerts', createAlertHandler);
    app.post('/api/insights/alerts/test-whatsapp', testWhatsappAlertHandler);
    app.get('/api/insights/alerts', getAlertsHandler);
    app.put('/api/insights/alerts/:id', updateAlertHandler);
    app.delete('/api/insights/alerts/:id', deleteAlertHandler);

    app.get('/api/insights/filters', getInsightsFilters);
    app.get('/api/insights/correlations', getCorrelations);
    app.get('/api/insights/correlations/trend', getCorrelationsTrend);
    app.get('/api/insights', getInsights);
};
