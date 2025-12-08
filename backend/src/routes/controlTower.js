import { watchTowerOverview, getBrands, getKeywords, getLocations, getPlatforms, debugAvailability, getTrendData } from '../controllers/watchTowerController.js';

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
    app.get('/api/watchtower/summary-metrics', watchTowerOverview);

    /**
     * @swagger
     * /api/watchtower/brands:
     *   get:
     *     summary: Get list of available brands
     *     description: Retrieve a list of distinct brands from the database.
     *     responses:
     *       200:
     *         description: Successful response with list of brands
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: string
     */
    app.get('/api/watchtower/brands', getBrands);

    /**
     * @swagger
     * /api/watchtower/keywords:
     *   get:
     *     summary: Get list of available keywords
     *     description: Retrieve a list of distinct keywords from the database, optionally filtered by brand.
     *     parameters:
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *         description: Filter keywords by brand
     *     responses:
     *       200:
     *         description: Successful response with list of keywords
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: string
     */
    app.get('/api/watchtower/keywords', getKeywords);

    /**
     * @swagger
     * /api/watchtower/locations:
     *   get:
     *     summary: Get list of available locations
     *     description: Retrieve a list of distinct locations from the database, optionally filtered by brand.
     *     parameters:
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *         description: Filter locations by brand
     *     responses:
     *       200:
     *         description: Successful response with list of locations
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: string
     */
    app.get('/api/watchtower/locations', getLocations);

    /**
     * @swagger
     * /api/watchtower/platforms:
     *   get:
     *     summary: Get list of available platforms
     *     description: Retrieve a list of distinct platforms from the database.
     *     responses:
     *       200:
     *         description: Successful response with list of platforms
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: string
     *     tags: [WatchTower]
     */
    app.get('/api/watchtower/platforms', getPlatforms);

    app.get('/api/watchtower/debug', debugAvailability);
    app.get('/api/watchtower/trend', getTrendData);

};
