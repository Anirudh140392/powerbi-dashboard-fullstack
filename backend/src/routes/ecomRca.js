import { EcomRcaTree } from '../controllers/ecomRcaController.js';

export default (app) => {
    /**
     * @swagger
     * /api/ecom-rca:
     *   get:
     *     summary: Get E-com RCA metrics
     *     description: Retrieve tree metrics for E-com RCA.
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
    app.get('/api/ecom-rca', EcomRcaTree);
};
