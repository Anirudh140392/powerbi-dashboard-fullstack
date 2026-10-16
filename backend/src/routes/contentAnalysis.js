import { ContentAnalysis, ContentAnalysisOverview, ContentAnalysisPlatformBreakdownController, ContentAnalysisPlatformsController, ContentAnalysisTrendsController, ContentAnalysisCategoriesController, ContentAnalysisBrandsController, ContentAnalysisZonesController } from '../controllers/contentAnalysisController.js';

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
    app.get('/api/content-analysis/overview', ContentAnalysisOverview);
    app.get('/api/content-analysis/platform-breakdown', ContentAnalysisPlatformBreakdownController);
    app.get('/api/content-analysis/platforms', ContentAnalysisPlatformsController);
    app.get('/api/content-analysis/categories', ContentAnalysisCategoriesController);
    app.get('/api/content-analysis/brands', ContentAnalysisBrandsController);
    app.get('/api/content-analysis/zones', ContentAnalysisZonesController);
    app.get('/api/content-analysis/trends', ContentAnalysisTrendsController);
};
