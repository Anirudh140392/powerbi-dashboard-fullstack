// src/routes/visitors.js
import express from 'express';
import { trackVisit, getVisitors } from '../controllers/visitorController.js';
import { verifyToken } from '../services/authService.js';

const router = express.Router();

/**
 * Optional authentication middleware:
 * If Authorization: Bearer <token> is present, decode it and attach payload to req.user.
 * If not present or invalid, do not fail - allow req.body / fallback handling.
 */
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            req.user = verifyToken(token);
        }
    } catch (e) {
        // Continue without req.user; controller will use req.body
    }
    next();
};

// Route to record user page visits
router.post('/track', optionalAuth, trackVisit);

// Route to get recent visitor logs
router.get('/', optionalAuth, getVisitors);

export default router;
