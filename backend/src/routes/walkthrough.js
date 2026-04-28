
import { getActiveWalkthrough } from '../controllers/walkthroughController.js';

export default (app) => {
    /**
     * @swagger
     * /api/walkthroughs/active:
     *   get:
     *     summary: Get an active walkthrough for the current route
     *     parameters:
     *       - in: query
     *         name: route
     *         schema:
     *           type: string
     *         required: true
     *     responses:
     *       200:
     *         description: Successful response
     */
    app.get('/api/walkthroughs/active', getActiveWalkthrough);
};
