import { VisibilityWorkspace } from '../controllers/visibilityAnalysisController.js';

export default (app) => {
    /**
     * @swagger
     * /api/visibility-analysis:
     *   get:
     *     summary: Get Visibility Analysis metrics
     *     description: Retrieve metrics for Visibility Analysis.
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
    app.get('/api/visibility-analysis', VisibilityWorkspace);
};
