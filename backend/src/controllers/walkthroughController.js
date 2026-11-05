
import * as walkthroughService from '../services/walkthroughService.js';

/**
 * GET /api/walkthroughs/active
 * Returns all active walkthroughs for the authenticated user's current route
 * that were created after the user's last_login.
 */
export const getActiveWalkthrough = async (req, res) => {
    try {
        const { route } = req.query;
        const clientDb = req.user.dbName; // From JWT
        const userEmail = req.user.email; // From JWT
        const userName = req.user.userName || req.user.name; // From JWT

        console.log(`[WalkthroughController] Checking active walkthrough for route: ${route}, clientDb: ${clientDb}, userName: ${userName}`);

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

        const walkthroughs = await walkthroughService.getActiveWalkthroughs({ clientDb, route, userName });

        return res.status(200).json({
            success: true,
            data: walkthroughs
        });
    } catch (error) {
        console.error('[WalkthroughController] getActiveWalkthrough failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * POST /api/walkthroughs/acknowledge
 * Called after the user has seen ALL pending walkthrough notifications.
 * Updates the user's last_login to now() so they won't see them again.
 */
export const acknowledgeWalkthroughs = async (req, res) => {
    try {
        const userName = req.user.userName || req.user.name; // From JWT

        console.log(`[WalkthroughController] Acknowledging walkthroughs for user: ${userName}`);

        await walkthroughService.acknowledgeWalkthroughs({ userName });

        return res.status(200).json({
            success: true,
            message: 'Walkthroughs acknowledged successfully'
        });
    } catch (error) {
        console.error('[WalkthroughController] acknowledgeWalkthroughs failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};
