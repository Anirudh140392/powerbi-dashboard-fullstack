import { ContentAnalysis } from '../controllers/contentAnalysisController.js';

export default (app) => {
    /**
     * @swagger
     * /api/content-analysis:
     *   get:
     *     summary: Get Content Analysis metrics
     *     description: Retrieve metrics for Content Analysis.
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
    app.get('/api/content-analysis', ContentAnalysis);
};
