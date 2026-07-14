import pool from "../config/db.js";
export 
async function authenticateApi(req, res, next) {
    if (!req.path.startsWith('/api/')) {
        return next();
    }

    if (req.method === 'OPTIONS') {
        return next();
    }

    // Unauthenticated auth endpoints: password login, MFA challenge completion,
    // password-reset request and submit. Each carries its own short-lived
    // challenge / reset token verified inline.
    const UNAUTH_AUTH_PATHS = new Set([
        '/api/auth/login',
        '/api/auth/mfa/enrol/start',
        '/api/auth/mfa/enrol/confirm',
        '/api/auth/mfa/verify',
        '/api/auth/password/forgot',
        '/api/auth/password/reset',
        '/api/auth/password/reset/validate',
        // Warm-on-crawl trigger: the temporal worker (non-loopback) calls this
        // after the pipeline; it verifies its own WARM_CACHE_TOKEN inline and
        // exposes no data, so it bypasses session auth here.
        '/api/ratings/internal/warm-cache',
    ]);
    if (UNAUTH_AUTH_PATHS.has(req.path)) {
        return next();
    }

    // Internal cache pre-warmer authenticates with a shared secret + an
    // explicit company_id query param (not a session). Localhost-only —
    // the requesting socket must be loopback. Lets the prewarmer hit any
    // company's cacheable endpoints without juggling user sessions.
    const prewarmToken = req.headers['x-internal-prewarm'];
    if (prewarmToken && prewarmToken === process.env.INTERNAL_PREWARM_TOKEN) {
        const remoteIp = req.socket?.remoteAddress || '';
        const isLoopback = remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';
        if (isLoopback && req.query.company_id) {
            req.companyId = req.query.company_id;
            return next();
        }
    }

    const rawToken = getBearerToken(req);
    if (!rawToken) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const tokenHash = hashSessionToken(rawToken);
        const nowMs = Date.now();
        let cacheEntry = sessionCache.get(tokenHash);
        let sessionRow, membership;
        if (cacheEntry
            && (nowMs - cacheEntry.cachedAt) < SESSION_CACHE_TTL_MS
            && new Date(cacheEntry.sessionRow.expires_at).getTime() > nowMs) {
            // Fast path — reuse the DB-validated principal (no query this request).
            sessionRow = cacheEntry.sessionRow;
            membership = cacheEntry.membership;
        } else {
            const result = await pool.query(`
                SELECT
                    s.id AS session_id, s.user_id, s.membership_id, s.company_id, s.expires_at,
                    u.id, u.username, u.email, u.full_name, u.role, u.status
                FROM ratings.auth_sessions s
                JOIN ratings.users u ON u.id = s.user_id
                WHERE s.session_token_hash = $1
                  AND s.purpose = 'full' AND s.revoked_at IS NULL
                  AND s.expires_at > now() AND u.status = 'active'
                LIMIT 1
            `, [tokenHash]);
            if (result.rowCount === 0) {
                sessionCache.delete(tokenHash);
                return res.status(401).json({ error: 'Session expired or invalid' });
            }
            sessionRow = result.rows[0];
            membership = await loadMembershipContext(sessionRow.membership_id);
            if (!membership || membership.company_id !== sessionRow.company_id) {
                return res.status(403).json({ error: 'Membership is not active for this session' });
            }
            if (sessionCache.size > 5000) sessionCache.clear(); // simple unbounded-growth guard
            cacheEntry = { sessionRow, membership, cachedAt: nowMs, lastActivityAt: 0 };
            sessionCache.set(tokenHash, cacheEntry);
        }

        const requestedCompanyId = req.query.company_id || req.headers['x-company-id'];
        if (requestedCompanyId && requestedCompanyId !== membership.company_id) {
            return res.status(403).json({ error: 'Requested company is not permitted for this session' });
        }

        if (membership.platform_scope === 'restricted' && membership.allowed_platforms.length > 0) {
            const requestedPlatform = typeof req.query.platform === 'string' ? req.query.platform.trim().toLowerCase() : '';
            const requestedPlatformUuid = typeof req.query.platform_uuid === 'string' ? req.query.platform_uuid.trim().toLowerCase() : '';
            if (requestedPlatformUuid) {
                const permittedByUuid = membership.allowed_platforms.some(platform =>
                    String(platform.uuid).trim().toLowerCase() === requestedPlatformUuid
                );
                if (!permittedByUuid) {
                    return res.status(403).json({ error: 'Platform is not permitted for this session' });
                }
            }
            if (requestedPlatform && requestedPlatform !== 'all') {
                const permitted = membership.allowed_platforms.some(platform => {
                    return [platform.name, platform.code, platform.slug]
                        .filter(Boolean)
                        .map(value => String(value).trim().toLowerCase())
                        .includes(requestedPlatform);
                });
                if (!permitted) {
                    return res.status(403).json({ error: 'Platform is not permitted for this session' });
                }
            }
        }

        // Throttled, fire-and-forget last-activity write — kept off the hot path
        // so it never adds latency to a request (was an awaited UPDATE per call).
        if (nowMs - (cacheEntry.lastActivityAt || 0) > LAST_ACTIVITY_THROTTLE_MS) {
            cacheEntry.lastActivityAt = nowMs;
            pool.query(`UPDATE ratings.auth_sessions SET last_activity_at = now() WHERE id = $1`, [sessionRow.session_id]).catch(() => {});
        }

        req.sessionToken = rawToken;
        req.sessionId = sessionRow.session_id;
        req.sessionExpiresAt = sessionRow.expires_at;
        req.companyId = membership.company_id;
        req.authPrincipal = sessionRow;
        req.authUser = buildAuthUser(sessionRow, membership);
        req.authMembership = membership;

        return next();
    } catch (error) {
        console.error('Auth middleware failed:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
}

