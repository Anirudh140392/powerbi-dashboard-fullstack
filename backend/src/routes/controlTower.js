import { watchTowerOverview } from '../controllers/watchTowerController.js';

export default (app) => {
    /**
     * @swagger
     * /api/watchtower:
     *   get:
     *     summary: Get Watch Tower overview metrics
     *     description: Retrieve summary metrics, top metrics, and SKU table data for the Watch Tower dashboard.
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform (e.g., Blinkit, Zepto)
     *       - in: query
     *         name: months
     *         schema:
     *           type: integer
     *         description: Number of months to look back
     *       - in: query
     *         name: timeStep
     *         schema:
     *           type: string
     *         description: Time granularity (e.g., Monthly)
     *     responses:
     *       200:
     *         description: Successful response with dashboard data
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 summaryMetrics:
     *                   type: object
     *                 topMetrics:
     *                   type: array
     *                 skuTable:
     *                   type: array
     */
    app.get('/api/watchtower', watchTowerOverview);

};
