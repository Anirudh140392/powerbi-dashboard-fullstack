
import { getActiveWalkthrough, acknowledgeWalkthroughs } from '../controllers/walkthroughController.js';

export default (app) => {
    /**
     * @swagger
     * /api/walkthroughs/active:
     *   get:
     *     summary: Get active walkthroughs for the current route
     *     description: Returns all walkthrough notifications created after the user's last_login, filtered by client and route.
     *     parameters:
     *       - in: query
     *         name: route
     *         schema:
     *           type: string
     *         required: true
     *     responses:
     *       200:
     *         description: Successful response with array of walkthroughs
     */
    app.get('/api/walkthroughs/active', getActiveWalkthrough);

    /**
     * @swagger
     * /api/walkthroughs/acknowledge:
     *   post:
     *     summary: Acknowledge all seen walkthroughs
     *     description: Updates the user's last_login to now() so dismissed notifications won't reappear.
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Walkthroughs acknowledged successfully
     */
    app.post('/api/walkthroughs/acknowledge', acknowledgeWalkthroughs);
};
