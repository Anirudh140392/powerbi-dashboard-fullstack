import { AvailabilityControlTower } from '../controllers/availabilityAnalysisController.js';

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
};
