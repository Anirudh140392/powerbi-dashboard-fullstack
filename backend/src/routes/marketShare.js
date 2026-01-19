import { Platform } from '../controllers/marketShareController.js';

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
};
