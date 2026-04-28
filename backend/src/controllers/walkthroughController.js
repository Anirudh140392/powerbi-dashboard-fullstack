
import * as walkthroughService from '../services/walkthroughService.js';

/**
 * GET /api/walkthroughs/active
 * Returns an active walkthrough for the authenticated user's current route
 */
export const getActiveWalkthrough = async (req, res) => {
    try {
        const { route } = req.query;
        const clientDb = req.user.dbName; // From JWT

        console.log(`[WalkthroughController] Checking active walkthrough for route: ${route}, clientDb: ${clientDb}`);

        if (!route) {
            return res.status(400).json({
                success: false,
                error: 'route parameter is required'
            });
        }

        if (!clientDb) {
            return res.status(400).json({
                success: false,
                error: 'Client database not found for user'
            });
        }

        const walkthrough = await walkthroughService.getActiveWalkthroughs({ clientDb, route });

        return res.status(200).json({
            success: true,
            data: walkthrough
        });
    } catch (error) {
        console.error('[WalkthroughController] getActiveWalkthrough failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};
