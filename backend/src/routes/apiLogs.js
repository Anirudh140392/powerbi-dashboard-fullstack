import { 
    getApiLogs, 
    getApiLogsSummary, 
    getApiLogsFilters, 
    triggerApiLogsRun,
    getApiLogsDistribution
} from '../controllers/apiLogsController.js';

export default (app) => {
    // Restrict all /api/api-logs endpoints strictly to Admin users
    app.use('/api/api-logs', (req, res, next) => {
        const userRole = (req.user?.role || '').toLowerCase();
        const isAdmin = userRole.includes('admin') || userRole.includes('super');
        const isTrailytics = (req.user?.email || '').toLowerCase().endsWith('@trailytics.com');
        if (!isAdmin && !isTrailytics) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required to view API monitoring logs.',
            });
        }
        next();
    });

    /**
     * @swagger
     * /api/api-logs:
     *   get:
     *     summary: Get Paginated API Health and Latency Logs
     *     description: Retrieve historical logs of tested endpoints with filtering by date, page, segment, and status.
     *     tags: [API Logger]
     *     parameters:
     *       - in: query
     *         name: date
     *         schema:
     *           type: string
     *           format: date
     *         description: Filter by run date (YYYY-MM-DD)
     *       - in: query
     *         name: page
     *         schema:
     *           type: string
     *         description: Filter by page name (e.g., Pricing Analysis)
     *       - in: query
     *         name: segment
     *         schema:
     *           type: string
     *         description: Filter by page segment/tab (e.g., KPIs, Insights, ECP Comparison)
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [All, Success, Slow, Failed]
     *         description: Filter by response status
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *         description: Search API endpoint paths
     *       - in: query
     *         name: pageNumber
     *         schema:
     *           type: integer
     *           default: 1
     *       - in: query
     *         name: pageSize
     *         schema:
     *           type: integer
     *           default: 20
     *       - in: query
     *         name: sortBy
     *         schema:
     *           type: string
     *           default: Date
     *       - in: query
     *         name: sortOrder
     *         schema:
     *           type: string
     *           enum: [ASC, DESC]
     *           default: DESC
     *     responses:
     *       200:
     *         description: Paginated logs response
     */
    app.get('/api/api-logs', getApiLogs);

    /**
     * @swagger
     * /api/api-logs/summary:
     *   get:
     *     summary: Get API Logs Summary Metrics
     *     description: Retrieve total endpoints tested, success count, failure count, slow count, and average response time.
     *     tags: [API Logger]
     *     parameters:
     *       - in: query
     *         name: date
     *         schema:
     *           type: string
     *           format: date
     *         description: Run date (YYYY-MM-DD)
     *       - in: query
     *         name: page
     *         schema:
     *           type: string
     *         description: Page name (default Pricing Analysis)
     *     responses:
     *       200:
     *         description: Summary metrics response
     */
    app.get('/api/api-logs/summary', getApiLogsSummary);

    /**
     * @swagger
     * /api/api-logs/filters:
     *   get:
     *     summary: Get Filter Options for API Logs
     *     description: Retrieve distinct available dates, pages, and segments for filter dropdowns.
     *     tags: [API Logger]
     *     responses:
     *       200:
     *         description: Filter dropdown options
     */
    app.get('/api/api-logs/filters', getApiLogsFilters);

    /**
     * @swagger
     * /api/api-logs/run:
     *   post:
     *     summary: Trigger Manual API Health Test Run
     *     description: Starts an asynchronous test execution of all endpoints for the specified page.
     *     tags: [API Logger]
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               page:
     *                 type: string
     *                 example: Pricing Analysis
     *     responses:
     *       202:
     *         description: Test run accepted and started in background
     *       409:
     *         description: A test run is already currently executing
     */
    /**
     * @swagger
     * /api/api-logs/distribution:
     *   get:
     *     summary: Get 2-Day Health Distribution and API listings
     *     description: Retrieve status distribution (Success, Slow, Failed) and complete list of tested endpoints for pie chart and hover cards.
     *     tags: [API Logger]
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: string
     *         description: Filter by page name (optional)
     *       - in: query
     *         name: days
     *         schema:
     *           type: integer
     *           default: 2
     *         description: Number of days to aggregate (default 2)
     *     responses:
     *       200:
     *         description: Health distribution and categorized API list
     */
    app.get('/api/api-logs/distribution', getApiLogsDistribution);

    app.post('/api/api-logs/run', triggerApiLogsRun);
};
