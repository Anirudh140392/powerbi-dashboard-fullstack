/**
 * Map Intellect Routes
 * API endpoints for the Map Intellect (Geo Intelligence) page
 */

import { getMapIntellectData } from '../controllers/mapIntellectController.js';

export default (app) => {
    /**
     * @swagger
     * /api/map-intellect/data:
     *   get:
     *     summary: Get city-level KPI data for Map Intellect
     *     description: Returns per-city metrics (Sales, OSA%, Orders, Market Share) from ClickHouse
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform (e.g., Blinkit, Zepto, All)
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
     *         name: months
     *         schema:
     *           type: integer
     *         description: Number of months to look back (default 1)
     *     responses:
     *       200:
     *         description: Successful response with city-level map data
     *     tags: [MapIntellect]
     */
    app.get('/api/map-intellect/data', getMapIntellectData);
};
