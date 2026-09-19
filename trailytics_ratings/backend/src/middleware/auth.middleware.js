import jwt from 'jsonwebtoken';
import clickhouse from '../config/clickhouse.js';

// Simple LRU cache for JWT verification to avoid hitting ClickHouse on every request
const sessionCache = new Map();
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function authenticateApi(req, res, next) {
    if (!req.path.startsWith('/api/')) {
        return next();
    }

    if (req.method === 'OPTIONS') {
        return next();
    }

    const UNAUTH_AUTH_PATHS = new Set([
        '/api/auth/login',
        '/api/ratings/internal/warm-cache'
    ]);
    if (UNAUTH_AUTH_PATHS.has(req.path)) {
        return next();
    }

    // Prewarm token logic
    const prewarmToken = req.headers['x-internal-prewarm'];
    if (prewarmToken && prewarmToken === process.env.INTERNAL_PREWARM_TOKEN) {
        const remoteIp = req.socket?.remoteAddress || '';
        const isLoopback = remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';
        if (isLoopback && req.query.company_id) {
            req.companyId = req.query.company_id;
            return next();
        }
    }

    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    
    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'trailytics_secret_key_2024';
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const nowMs = Date.now();
        let cacheEntry = sessionCache.get(token);
        
        if (cacheEntry && (nowMs - cacheEntry.cachedAt) < SESSION_CACHE_TTL_MS) {
            req.authUser = cacheEntry.authUser;
            req.companyId = cacheEntry.companyId;
            return next();
        }

        // Verify with ClickHouse admin_master
        const userEmail = decoded.email || decoded.user_email;
        if (!userEmail) {
             return res.status(401).json({ error: 'Invalid token payload' });
        }

        const userRows = await clickhouse.query({
            query: `SELECT access, status FROM admin_master.tb_user WHERE user_email = {email:String} LIMIT 1`,
            query_params: { email: userEmail },
            format: 'JSONEachRow'
        }).then(res => res.json());

        if (!userRows || userRows.length === 0) {
            return res.status(401).json({ error: 'User not found in system' });
        }

        const user = userRows[0];
        const status = (user.status || '').toLowerCase().trim();
        const access = (user.access || '').toLowerCase().trim();

        if (status === 'inactive' || access !== 'allow') {
            return res.status(403).json({ error: 'User access is not allowed' });
        }

        // Check if database is active (optional, fallback to payload)
        let dbName = decoded.dbName || process.env.CLICKHOUSE_DB || 'colpal';
        let companyId = decoded.companyId || process.env.RATINGS_COMPANY_ID || '';
        
        try {
            const dbRows = await clickhouse.query({
                query: `SELECT company_id, status FROM admin_master.tb_database WHERE lower(db_name) = {dbName:String} LIMIT 1`,
                query_params: { dbName: dbName.toLowerCase() },
                format: 'JSONEachRow'
            }).then(res => res.json());

            if (dbRows.length > 0) {
                if ((dbRows[0].status || '').toLowerCase() !== 'active') {
                    return res.status(403).json({ error: 'Database is inactive' });
                }
                const rawCid = dbRows[0].company_id || '';
                if (rawCid && rawCid !== '00000000-0000-0000-0000-000000000000') {
                    companyId = rawCid;
                }
            }
        } catch (e) {
            console.warn('[Auth] Failed to verify tb_database in ClickHouse:', e.message);
        }

        const authUser = {
            id: decoded.id || decoded.user_id,
            email: userEmail,
            role: decoded.role || 'user',
            dbName: dbName
        };

        if (sessionCache.size > 5000) sessionCache.clear();
        sessionCache.set(token, { authUser, companyId, cachedAt: nowMs });

        req.authUser = authUser;
        req.companyId = companyId;

        return next();
    } catch (error) {
        console.error('Auth middleware failed:', error.message);
        return res.status(401).json({ error: 'Authentication failed' });
    }
}
