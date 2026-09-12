import { QualityProducts } from '../controllers/portfoliosAnalysisController.js';

export default (app) => {
    /**
     * @swagger
     * /api/portfolios-analysis:
     *   get:
     *     summary: Get Portfolios Analysis metrics
     *     description: Retrieve metrics for Portfolios Analysis (Quality Products).
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
    app.get('/api/portfolios-analysis', QualityProducts);
};
