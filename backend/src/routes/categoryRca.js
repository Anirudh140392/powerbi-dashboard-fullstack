import { Categories } from '../controllers/categoryRcaController.js';

export default (app) => {
    /**
     * @swagger
     * /api/category-rca:
     *   get:
     *     summary: Get Category RCA metrics
     *     description: Retrieve metrics for Category RCA.
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
    app.get('/api/category-rca', Categories);
};
