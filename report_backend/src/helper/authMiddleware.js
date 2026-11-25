import { verifyToken } from '../services/authService.js';
import { setCurrentDbName } from '../config/clickhouse.js';

/**
 * JWT Authentication Middleware for report_backend
 */
export const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Access denied. No token provided.',
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);

        // Set user context on request
        req.user = decoded;

        let dbName = decoded.dbName;

        const userRole = (decoded.role || '').toLowerCase();
        const isAdmin = userRole.includes('admin') || userRole.includes('super');
        const isTrailytics = (decoded.email || '').toLowerCase().endsWith('@trailytics.com');

        if (isAdmin || isTrailytics) {
            const overrideDb = req.headers['x-db-name'] || req.headers['x-database'] || req.query.db || req.query.dbName;
            if (overrideDb) {
                dbName = overrideDb;
                req.user.dbName = dbName;
            }
        }

        setCurrentDbName(dbName);
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token',
        });
    }
};
