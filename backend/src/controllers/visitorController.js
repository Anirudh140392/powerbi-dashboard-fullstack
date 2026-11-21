// src/controllers/visitorController.js
import { recordVisitor, getRecentVisitors } from '../services/visitorService.js';

/**
 * POST /api/visitors/track
 * Body: { page, email, client_db }
 * Headers: optional Authorization: Bearer <token>
 */
export const trackVisit = async (req, res) => {
    try {
        const email = req.user?.email || req.body?.email || null;
        const client_db = req.user?.dbName || req.body?.client_db || req.body?.clientDb || req.body?.dbName || null;
        const page = req.body?.page || req.query?.page || null;

        if (!email && !page) {
            return res.status(400).json({
                success: false,
                error: 'Page or email is required to record visit',
            });
        }

        await recordVisitor({ email, client_db, page });

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('[VisitorController] trackVisit error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to record visit',
        });
    }
};

/**
 * GET /api/visitors
 * Query: ?limit=100
 */
export const getVisitors = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 100;
        const data = await getRecentVisitors(limit);
        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('[VisitorController] getVisitors error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch visitors',
        });
    }
};
