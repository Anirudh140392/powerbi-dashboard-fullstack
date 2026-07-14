// /**
//  * Ratings API Server
//  * Multi-tenant, multi-platform API for the Ratings & Reviews dashboard.
//  * Queries PostgreSQL directly — no JSON file loading.
//  *
//  * Usage: node server/api.cjs
//  * Endpoints:
//  *   GET /api/ratings/reviews     — Prestige + competitor reviews with filters
//  *   GET /api/ratings/products    — Product catalog with classification
//  *   GET /api/ratings/summary     — Aggregated KPI metrics
//  *   GET /api/ratings/categories  — Available categories/materials for filters
//  */

// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const { Pool } = require('pg');
// const crypto = require('crypto');
// const bcrypt = require('bcryptjs');
// const mfaLib = require('./auth/mfa.cjs');
// const challengeLib = require('./auth/challengeToken.cjs');
// const { sendAlertEmail, isMailerConfigured } = require('./automation/mailer.cjs');

// // Database config — reads from .env
// // SSL is enabled for any non-localhost connection (Railway, Vercel, or any remote host)
// const isRemoteDb = process.env.DB_HOST && !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST);
// const pool = new Pool({
//     host: process.env.DB_HOST,
//     database: process.env.DB_NAME,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     port: parseInt(process.env.DB_PORT || '5432'),
//     max: parseInt(process.env.DB_POOL_MAX || '10'),
//     // Recycle idle connections sooner (was 60s). The Railway->EC2 path silently
//     // drops long-idle sockets; a shorter idle window means fewer dead sockets
//     // accumulate in the pool between health pings.
//     idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000'),
//     connectionTimeoutMillis: 30000,  // Increased from 10s to 30s to handle slow DB connections
//     // Hard ceiling on any single API query. Backstop against the pile-up that
//     // wedged the dashboard: an aborted pre-warm fetch leaves its SQL running on
//     // the server, and without a cap those orphans accumulated to 12+ minutes
//     // each until the DB thrashed. Now any query exceeding this self-cancels.
//     // Generous enough for the heaviest legit query (the 100k-row /reviews
//     // export); batch jobs run in separate processes with no timeout.
//     statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '120000'),
//     // TCP keepalive so the OS keeps idle DB sockets warm and detects half-open
//     // connections, instead of them being silently dropped by NAT/firewall (the
//     // failure that wedged the pool: every checkout returned a dead socket and
//     // queries hung the full connectionTimeout before failing).
//     keepAlive: true,
//     keepAliveInitialDelayMillis: 10000,
//     // Enable SSL for any remote DB host (Vercel, Railway, or direct EC2 connections)
//     ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
// });

// // Catch idle connection errors to prevent unhandled rejections crashing the Node process
// pool.on('error', (err, client) => {
//     console.error('Unexpected error on idle client', err);
// });

// // Warm up pool connection on startup with retry — prevents cold-start 57P03 race condition
// // where the DB replica hasn't reached a consistent recovery state yet
// (async function warmUpPool(retries = 5, delayMs = 3000) {
//     for (let attempt = 1; attempt <= retries; attempt++) {
//         try {
//             const client = await pool.connect();
//             client.release();
//             console.log(`[DB] Pool warm-up successful (attempt ${attempt})`);
//             return;
//         } catch (err) {
//             const isRecovering = err.code === '57P03';
//             console.warn(`[DB] Pool warm-up attempt ${attempt}/${retries} failed: [${err.code}] ${err.message}`);
//             if (attempt < retries) {
//                 const backoff = isRecovering ? delayMs * attempt : delayMs;
//                 console.log(`[DB] Retrying in ${backoff}ms...`);
//                 await new Promise(r => setTimeout(r, backoff));
//             } else {
//                 console.error('[DB] Pool warm-up exhausted all retries. Proceeding — queries will fail until DB recovers.');
//             }
//         }
//     }
// })();

// // Periodic health ping — the pool's self-heal. A cheap `SELECT 1` exercises an
// // idle pooled connection; if it has gone dead (silently dropped on the
// // Railway->EC2 path), the query errors and node-pg evicts it from the pool, so
// // the next real request gets a fresh connection instead of hanging the full
// // 30s connectionTimeout on a wedged socket. Runs every 25s (< idleTimeout so it
// // keeps at least one connection warm). unref() so it never blocks shutdown.
// const DB_HEALTH_PING_MS = parseInt(process.env.DB_HEALTH_PING_MS || '25000');
// const dbHealthTimer = setInterval(() => {
//     pool.query('SELECT 1').catch((err) => {
//         console.warn(`[DB] health ping failed (dead connection evicted): [${err.code || '?'}] ${err.message}`);
//     });
// }, DB_HEALTH_PING_MS);
// dbHealthTimer.unref();

// const compression = require('compression');

// const app = express();
// // gzip every response above ~1 KB. The /api/ratings/reviews payload is
// // ~30-50MB of JSON; gzip cuts that to ~3-5MB and the 98-second download
// // drops to a few seconds. Costs single-digit ms of CPU per request.
// app.use(compression({ threshold: 1024 }));
// app.use(cors({
//     origin: true,  // Reflect requesting origin (supports Vercel, localhost, Railway)
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'X-Company-ID', 'Authorization'],
//     credentials: true,
// }));
// app.use(express.json({ limit: '10mb' }));

// // ─── Tiny in-memory response cache ──────────────────────────────────────────
// // Most users hit the same default filters on dashboard load (Prestige + 6M)
// // and the heavy /category-health, /executive-health, /summary queries each
// // cost 2–20s. Caching the last response for 60s eliminates near-duplicate
// // work without changing data freshness in any meaningful way.
// //
// // Single middleware (HIT + MISS) is registered AFTER authenticateApi so that
// // req.companyId is populated. Two separate middlewares fought each other —
// // the HIT path's res.json call would re-trigger the MISS wrapper and reset
// // the X-Cache header back to MISS.
// const RESPONSE_CACHE = new Map(); // key -> { body, expires }
// // The underlying data only changes on the ~15-day crawl cadence, so heavy
// // aggregation responses can be cached for hours, not a minute. This is the
// // single biggest lever against the shared-DB contention: once an entry is warm,
// // users are served from cache and never wait on the saturated Postgres. Tunable
// // via RESPONSE_CACHE_TTL_MS (ms); default 6h. Lower it if admin edits need to
// // reflect faster, or wire cache invalidation into the write paths.
// const RESPONSE_CACHE_TTL_MS = parseInt(process.env.RESPONSE_CACHE_TTL_MS || String(6 * 60 * 60 * 1000));
// // Filter-OPTION endpoints (platform/category/brand lists etc.) are derived from
// // the full review/snapshot corpus and barely change day-to-day, yet their DISTINCT/
// // GROUP BY scans are among the heaviest. Cache them far longer so the pre-warmer
// // (and users) re-run that SQL rarely instead of every minute.
// const STABLE_CACHE_TTL_MS = parseInt(process.env.STABLE_CACHE_TTL_MS || String(15 * 60 * 1000));
// const STABLE_PATH_RE = /^\/api\/ratings\/(categories|sentiment-categories|platform-options|price-ranges|competitor-brands|brand-config|spec-type-mappings|product-categories|alert-scope-options)$/;
// const RESPONSE_CACHE_MAX = parseInt(process.env.RESPONSE_CACHE_MAX || '3000');

// // ── Shared L2 cache (Dragonfly/Redis on the EC2) ────────────────────────────
// // Survives API redeploys and is shared across instances, so a warm entry keeps
// // serving even right after a deploy — unlike the in-memory L1 above. Fully
// // graceful: if REDIS_URL is unset or the server is unreachable, every call
// // silently falls back to L1 + the DB. Keys are namespaced so we never collide
// // with the ads platform's own keys on the same Dragonfly instance.
// let redis = null;
// if (process.env.REDIS_URL) {
//     try {
//         const IORedis = require('ioredis');
//         redis = new IORedis(process.env.REDIS_URL, {
//             keyPrefix: process.env.REDIS_KEY_PREFIX || 'ratcache:',
//             connectTimeout: 3000,
//             maxRetriesPerRequest: 1,
//             enableOfflineQueue: false, // fail fast to L1/DB instead of queueing when down
//             retryStrategy: (times) => Math.min(times * 300, 5000),
//         });
//         let redisErrLogged = false;
//         redis.on('error', (e) => { if (!redisErrLogged) { console.error('[redis] L2 cache unavailable, using memory/DB:', e.message); redisErrLogged = true; } });
//         redis.on('ready', () => { redisErrLogged = false; console.log('[redis] L2 cache connected'); });
//     } catch (e) { console.error('[redis] init failed:', e.message); redis = null; }
// }
// const CACHEABLE_PATH_RE = /^\/api\/ratings\/(summary|category-health|executive-health|product-health|trends|issues-breakdown|stakeholder-detail|asin-issues|sku-list|timeline|rating-trend|categories|sentiment-categories|platform-options|price-ranges|competitor-brands|brand-config|spec-type-mappings|product-categories|review-timeline|rating-mismatch|star-distribution|price-variance|benchmark-data|competitor-matrix|alert-scope-options|issue\/[^/]+\/drilldown)$/;
// function responseCacheKey(req) {
//     // Normalize so a PRE-WARM request and a real USER request for the same data
//     // produce the SAME key — otherwise the warm-up warms keys nobody hits and
//     // every first load is cold:
//     //  - drop `_refresh` (pre-warmer flag)
//     //  - drop `company_id` (the pre-warmer appends it; it's already the key
//     //    prefix via req.companyId, and users pass it via header, not query)
//     //  - SORT params so `a=1&b=2` and `b=2&a=1` collapse to one key
//     const params = new URLSearchParams(req.query);
//     params.delete('_refresh');
//     params.delete('company_id');
//     params.delete('companyId');
//     params.sort();
//     return `${req.companyId}|${req.path}|${params.toString()}`;
// }

// const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

// function createSessionToken() {
//     return crypto.randomBytes(48).toString('hex');
// }

// function createUuid() {
//     return crypto.randomUUID();
// }

// function hashSessionToken(token) {
//     return crypto.createHash('sha256').update(token).digest('hex');
// }

// function getBearerToken(req) {
//     const authHeader = req.headers.authorization;
//     if (!authHeader || typeof authHeader !== 'string') return null;
//     if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
//     return authHeader.slice(7).trim();
// }

// function getClientIp(req) {
//     const forwarded = req.headers['x-forwarded-for'];
//     if (typeof forwarded === 'string' && forwarded.trim()) {
//         return forwarded.split(',')[0].trim();
//     }
//     if (req.socket?.remoteAddress) {
//         return req.socket.remoteAddress;
//     }
//     return null;
// }

// async function loadMembershipContext(membershipId) {
//     const result = await pool.query(`
//         SELECT
//             m.id,
//             m.user_id,
//             m.company_id,
//             m.role,
//             m.status,
//             m.is_primary,
//             m.platform_scope,
//             c.name AS company_name,
//             COALESCE(
//                 array_agg(DISTINCT upa.platform_uuid) FILTER (WHERE upa.platform_uuid IS NOT NULL),
//                 '{}'::uuid[]
//             ) AS allowed_platform_uuids
//         FROM ratings.user_company_memberships m
//         JOIN public.companies c
//           ON c.id = m.company_id
//         LEFT JOIN ratings.user_platform_access upa
//           ON upa.membership_id = m.id
//         WHERE m.id = $1
//           AND m.status = 'active'
//         GROUP BY m.id, m.user_id, m.company_id, m.role, m.status, m.is_primary, m.platform_scope, c.name
//     `, [membershipId]);

//     if (result.rowCount === 0) {
//         return null;
//     }

//     const membership = result.rows[0];
//     let allowedPlatforms = [];
//     if (membership.platform_scope === 'restricted' && membership.allowed_platform_uuids.length > 0) {
//         const platformRes = await pool.query(`
//             SELECT uuid, name, code, slug
//             FROM public.platforms
//             WHERE uuid = ANY($1::uuid[])
//         `, [membership.allowed_platform_uuids]);
//         allowedPlatforms = platformRes.rows.map(row => ({
//             uuid: row.uuid,
//             name: row.name,
//             code: row.code,
//             slug: row.slug,
//         }));
//     }

//     return {
//         ...membership,
//         allowed_platforms: allowedPlatforms,
//     };
// }

// function buildAuthUser(userRow, membership) {
//     return {
//         id: userRow.id,
//         username: userRow.username,
//         email: userRow.email,
//         displayName: userRow.full_name,
//         role: membership.role || userRow.role,
//         companyId: membership.company_id,
//         companyName: membership.company_name,
//         allowedPlatformUuids: membership.allowed_platform_uuids || [],
//         platformScope: membership.platform_scope,
//     };
// }

// // In-memory session cache. Validating the Bearer token against the DB on EVERY
// // request (a SELECT on auth_sessions + a membership load + an UPDATE of
// // last_activity_at) was the dominant per-request cost — on the ETL-contended
// // shared DB it added 1-5s to EVERY call, including cache HITs. We now resolve
// // the session from the DB at most once per SESSION_CACHE_TTL_MS and reuse the
// // cached principal in between; a revoked/expired session is picked up within
// // that window. last_activity_at is written at most once per throttle window,
// // fire-and-forget, off the hot path.
// const SESSION_CACHE_TTL_MS = 60_000;
// const LAST_ACTIVITY_THROTTLE_MS = 5 * 60_000;
// const sessionCache = new Map(); // tokenHash -> { sessionRow, membership, cachedAt, lastActivityAt }

// async function authenticateApi(req, res, next) {
//     if (!req.path.startsWith('/api/')) {
//         return next();
//     }

//     if (req.method === 'OPTIONS') {
//         return next();
//     }

//     // Unauthenticated auth endpoints: password login, MFA challenge completion,
//     // password-reset request and submit. Each carries its own short-lived
//     // challenge / reset token verified inline.
//     const UNAUTH_AUTH_PATHS = new Set([
//         '/api/auth/login',
//         '/api/auth/mfa/enrol/start',
//         '/api/auth/mfa/enrol/confirm',
//         '/api/auth/mfa/verify',
//         '/api/auth/password/forgot',
//         '/api/auth/password/reset',
//         '/api/auth/password/reset/validate',
//         // Warm-on-crawl trigger: the temporal worker (non-loopback) calls this
//         // after the pipeline; it verifies its own WARM_CACHE_TOKEN inline and
//         // exposes no data, so it bypasses session auth here.
//         '/api/ratings/internal/warm-cache',
//     ]);
//     if (UNAUTH_AUTH_PATHS.has(req.path)) {
//         return next();
//     }

//     // Internal cache pre-warmer authenticates with a shared secret + an
//     // explicit company_id query param (not a session). Localhost-only —
//     // the requesting socket must be loopback. Lets the prewarmer hit any
//     // company's cacheable endpoints without juggling user sessions.
//     const prewarmToken = req.headers['x-internal-prewarm'];
//     if (prewarmToken && prewarmToken === process.env.INTERNAL_PREWARM_TOKEN) {
//         const remoteIp = req.socket?.remoteAddress || '';
//         const isLoopback = remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';
//         if (isLoopback && req.query.company_id) {
//             req.companyId = req.query.company_id;
//             return next();
//         }
//     }

//     const rawToken = getBearerToken(req);
//     if (!rawToken) {
//         return res.status(401).json({ error: 'Authentication required' });
//     }

//     try {
//         const tokenHash = hashSessionToken(rawToken);
//         const nowMs = Date.now();
//         let cacheEntry = sessionCache.get(tokenHash);
//         let sessionRow, membership;
//         if (cacheEntry
//             && (nowMs - cacheEntry.cachedAt) < SESSION_CACHE_TTL_MS
//             && new Date(cacheEntry.sessionRow.expires_at).getTime() > nowMs) {
//             // Fast path — reuse the DB-validated principal (no query this request).
//             sessionRow = cacheEntry.sessionRow;
//             membership = cacheEntry.membership;
//         } else {
//             const result = await pool.query(`
//                 SELECT
//                     s.id AS session_id, s.user_id, s.membership_id, s.company_id, s.expires_at,
//                     u.id, u.username, u.email, u.full_name, u.role, u.status
//                 FROM ratings.auth_sessions s
//                 JOIN ratings.users u ON u.id = s.user_id
//                 WHERE s.session_token_hash = $1
//                   AND s.purpose = 'full' AND s.revoked_at IS NULL
//                   AND s.expires_at > now() AND u.status = 'active'
//                 LIMIT 1
//             `, [tokenHash]);
//             if (result.rowCount === 0) {
//                 sessionCache.delete(tokenHash);
//                 return res.status(401).json({ error: 'Session expired or invalid' });
//             }
//             sessionRow = result.rows[0];
//             membership = await loadMembershipContext(sessionRow.membership_id);
//             if (!membership || membership.company_id !== sessionRow.company_id) {
//                 return res.status(403).json({ error: 'Membership is not active for this session' });
//             }
//             if (sessionCache.size > 5000) sessionCache.clear(); // simple unbounded-growth guard
//             cacheEntry = { sessionRow, membership, cachedAt: nowMs, lastActivityAt: 0 };
//             sessionCache.set(tokenHash, cacheEntry);
//         }

//         const requestedCompanyId = req.query.company_id || req.headers['x-company-id'];
//         if (requestedCompanyId && requestedCompanyId !== membership.company_id) {
//             return res.status(403).json({ error: 'Requested company is not permitted for this session' });
//         }

//         if (membership.platform_scope === 'restricted' && membership.allowed_platforms.length > 0) {
//             const requestedPlatform = typeof req.query.platform === 'string' ? req.query.platform.trim().toLowerCase() : '';
//             const requestedPlatformUuid = typeof req.query.platform_uuid === 'string' ? req.query.platform_uuid.trim().toLowerCase() : '';
//             if (requestedPlatformUuid) {
//                 const permittedByUuid = membership.allowed_platforms.some(platform =>
//                     String(platform.uuid).trim().toLowerCase() === requestedPlatformUuid
//                 );
//                 if (!permittedByUuid) {
//                     return res.status(403).json({ error: 'Platform is not permitted for this session' });
//                 }
//             }
//             if (requestedPlatform && requestedPlatform !== 'all') {
//                 const permitted = membership.allowed_platforms.some(platform => {
//                     return [platform.name, platform.code, platform.slug]
//                         .filter(Boolean)
//                         .map(value => String(value).trim().toLowerCase())
//                         .includes(requestedPlatform);
//                 });
//                 if (!permitted) {
//                     return res.status(403).json({ error: 'Platform is not permitted for this session' });
//                 }
//             }
//         }

//         // Throttled, fire-and-forget last-activity write — kept off the hot path
//         // so it never adds latency to a request (was an awaited UPDATE per call).
//         if (nowMs - (cacheEntry.lastActivityAt || 0) > LAST_ACTIVITY_THROTTLE_MS) {
//             cacheEntry.lastActivityAt = nowMs;
//             pool.query(`UPDATE ratings.auth_sessions SET last_activity_at = now() WHERE id = $1`, [sessionRow.session_id]).catch(() => {});
//         }

//         req.sessionToken = rawToken;
//         req.sessionId = sessionRow.session_id;
//         req.sessionExpiresAt = sessionRow.expires_at;
//         req.companyId = membership.company_id;
//         req.authPrincipal = sessionRow;
//         req.authUser = buildAuthUser(sessionRow, membership);
//         req.authMembership = membership;

//         return next();
//     } catch (error) {
//         console.error('Auth middleware failed:', error);
//         return res.status(500).json({ error: 'Authentication failed' });
//     }
// }

// app.use(authenticateApi);

// // ─── Response cache (HIT short-circuit + MISS write-through) ───────────────
// app.use(async (req, res, next) => {
//     if (req.method !== 'GET' || !CACHEABLE_PATH_RE.test(req.path) || !req.companyId) return next();
//     const key = responseCacheKey(req);
//     // `?_refresh=1` is reserved for the cache pre-warmer — skip HIT lookup so
//     // the query always runs and re-writes the cache, guaranteeing fresh TTL.
//     const forceRefresh = req.query._refresh === '1';
//     const ttl = STABLE_PATH_RE.test(req.path) ? STABLE_CACHE_TTL_MS : RESPONSE_CACHE_TTL_MS;
//     const swrHeader = `public, max-age=60, stale-while-revalidate=300`;

//     if (!forceRefresh) {
//         // L1: in-memory (fastest, per-instance)
//         const l1 = RESPONSE_CACHE.get(key);
//         if (l1 && l1.expires > Date.now()) {
//             res.set('Cache-Control', swrHeader);
//             res.set('X-Cache', 'HIT');
//             return res.json(l1.body);
//         }
//         if (l1) RESPONSE_CACHE.delete(key);
//         // L2: Dragonfly/Redis (shared, survives redeploys). Never let it block or
//         // throw — a down cache falls straight through to the DB.
//         if (redis) {
//             try {
//                 const raw = await redis.get(key);
//                 if (raw) {
//                     const body = JSON.parse(raw);
//                     RESPONSE_CACHE.set(key, { body, expires: Date.now() + ttl }); // promote to L1
//                     res.set('Cache-Control', swrHeader);
//                     res.set('X-Cache', 'HIT-L2');
//                     return res.json(body);
//                 }
//             } catch { /* redis unavailable — fall through to compute */ }
//         }
//     }
//     // Miss (or forced refresh): wrap res.json to capture the body and stash it.
//     const originalJson = res.json.bind(res);
//     res.json = (body) => {
//         try {
//             // NEVER cache non-2xx responses. A single transient 500 (e.g. a DB
//             // timeout under contention) would otherwise be stored for the full
//             // TTL and served to every client — which then crashes on the missing
//             // success shape (e.g. `benchmarks` undefined -> `.find` of undefined).
//             const ok = res.statusCode >= 200 && res.statusCode < 300;
//             if (ok) {
//                 if (RESPONSE_CACHE.size >= RESPONSE_CACHE_MAX) {
//                     const oldest = RESPONSE_CACHE.keys().next().value;
//                     RESPONSE_CACHE.delete(oldest);
//                 }
//                 RESPONSE_CACHE.set(key, { body, expires: Date.now() + ttl });
//                 // write-through to L2, fire-and-forget so it never delays the response
//                 if (redis) { redis.set(key, JSON.stringify(body), 'PX', ttl).catch(() => {}); }
//             }
//             res.set('Cache-Control', swrHeader);
//             res.set('X-Cache', ok ? (forceRefresh ? 'REFRESH' : 'MISS') : 'BYPASS-ERR');
//         } catch {}
//         return originalJson(body);
//     };
//     next();
// });

// // ─── MFA helpers ────────────────────────────────────────────────────────────
// async function logMfaEvent(userId, event, req, { actorId, metadata } = {}) {
//     try {
//         await pool.query(
//             `INSERT INTO ratings.mfa_audit_log (user_id, event, ip_address, user_agent, actor_id, metadata)
//              VALUES ($1, $2, $3, $4, $5, $6)`,
//             [userId || null, event, getClientIp(req), req.headers['user-agent'] || null, actorId || null, metadata || null]
//         );
//     } catch (e) {
//         console.warn('[mfa] audit log write failed:', e.message);
//     }
// }

// async function createFullSession(user, membership, req) {
//     const token = createSessionToken();
//     const tokenHash = hashSessionToken(token);
//     const sessionId = createUuid();
//     const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
//     await pool.query(`
//         INSERT INTO ratings.auth_sessions
//             (id, user_id, membership_id, company_id, session_token_hash, expires_at,
//              last_activity_at, ip_address, user_agent, purpose)
//         VALUES ($1, $2, $3, $4, $5, $6, now(), $7, $8, 'full')
//     `, [
//         sessionId, user.id, membership.id, membership.company_id, tokenHash,
//         expiresAt.toISOString(), getClientIp(req), req.headers['user-agent'] || null,
//     ]);
//     await pool.query(`UPDATE ratings.users SET last_login_at = now(), updated_at = now() WHERE id = $1`, [user.id]);
//     return { token, expiresAt: expiresAt.toISOString(), user: buildAuthUser(user, membership) };
// }

// async function resolveMembershipForLogin(userId, requestedCompanyId) {
//     const membershipsRes = await pool.query(`
//         SELECT id, company_id FROM ratings.user_company_memberships
//         WHERE user_id = $1 AND status = 'active'
//         ORDER BY
//           CASE
//             WHEN $2::uuid IS NOT NULL AND company_id = $2::uuid THEN 0
//             WHEN is_primary THEN 1
//             ELSE 2
//           END,
//           created_at ASC
//     `, [userId, requestedCompanyId || null]);
//     if (membershipsRes.rowCount === 0) return null;
//     const selectedRow = membershipsRes.rows.find(row => !requestedCompanyId || row.company_id === requestedCompanyId) || membershipsRes.rows[0];
//     if (requestedCompanyId && !membershipsRes.rows.some(row => row.company_id === requestedCompanyId)) return null;
//     return loadMembershipContext(selectedRow.id);
// }

// // ─── POST /api/ratings/internal/warm-cache — warm-on-crawl ──────────────────
// // Called by the temporal worker at the end of the daily/crawl pipeline (data is
// // fresh, DB is relatively free) to pre-compute every heavy dashboard response
// // into the L1+L2 cache, so real users never pay a cold recompute against the
// // ETL-saturated DB. Auth: shared WARM_CACHE_TOKEN header (worker is non-loopback).
// // Exposes no data — only kicks off server-side warming, fire-and-forget.
// app.post('/api/ratings/internal/warm-cache', (req, res) => {
//     if (!process.env.WARM_CACHE_TOKEN || req.headers['x-warm-token'] !== process.env.WARM_CACHE_TOKEN) {
//         return res.status(401).json({ error: 'unauthorized' });
//     }
//     try {
//         const { warmAll } = require('./cachePrewarmer.cjs');
//         const port = process.env.PORT || process.env.API_PORT || 3001;
//         warmAll({ port, pool, internalToken: process.env.INTERNAL_PREWARM_TOKEN, companyId: req.query.company_id })
//             .then(s => console.log('[warm-cache] done:', JSON.stringify(s)))
//             .catch(e => console.error('[warm-cache] failed:', e.message));
//         res.json({ ok: true, started: true });
//     } catch (e) {
//         console.error('[warm-cache] failed:', e.message);
//         res.status(500).json({ error: e.message });
//     }
// });

// // ─── POST /api/auth/login — verifies password, returns MFA challenge ────────
// app.post('/api/auth/login', async (req, res) => {
//     try {
//         const username = String(req.body?.username || '').trim().toLowerCase();
//         const password = String(req.body?.password || '');
//         const requestedCompanyId = String(req.body?.company_id || '').trim() || null;

//         if (!username || !password) {
//             return res.status(400).json({ error: 'username and password are required' });
//         }

//         const userResult = await pool.query(`
//             SELECT id, username, email, full_name, password_hash, role, status,
//                    mfa_enabled, mfa_locked_until
//             FROM ratings.users
//             WHERE lower(username) = $1 OR lower(email) = $1
//             LIMIT 1
//         `, [username]);

//         if (userResult.rowCount === 0) {
//             return res.status(401).json({ error: 'Invalid username or password' });
//         }

//         const user = userResult.rows[0];
//         if (user.status !== 'active') {
//             return res.status(403).json({ error: 'User account is not active' });
//         }

//         const isValidPassword = await bcrypt.compare(password, user.password_hash);
//         if (!isValidPassword) {
//             return res.status(401).json({ error: 'Invalid username or password' });
//         }

//         // Lockout from too-many failed MFA codes. Don't burn a challenge token
//         // until the lockout clears — that way we don't leak which users have MFA.
//         if (user.mfa_locked_until && new Date(user.mfa_locked_until) > new Date()) {
//             return res.status(423).json({
//                 error: 'Account temporarily locked due to too many failed MFA attempts.',
//                 lockedUntil: user.mfa_locked_until,
//             });
//         }

//         // Membership is required even at challenge-time so the auth_sessions FK holds.
//         const membership = await resolveMembershipForLogin(user.id, requestedCompanyId);
//         if (!membership) {
//             return res.status(403).json({ error: 'No active company membership for this user' });
//         }

//         if (!user.mfa_enabled) {
//             const { token } = await challengeLib.mintChallenge(pool, {
//                 userId: user.id,
//                 membershipId: membership.id,
//                 companyId: membership.company_id,
//                 purpose: 'mfa_enrolment',
//                 ip: getClientIp(req),
//                 userAgent: req.headers['user-agent'],
//             });
//             return res.json({
//                 step: 'enrol',
//                 challengeToken: token,
//                 email: user.email,
//                 displayName: user.full_name,
//             });
//         }

//         const { token } = await challengeLib.mintChallenge(pool, {
//             userId: user.id,
//             membershipId: membership.id,
//             companyId: membership.company_id,
//             purpose: 'mfa_challenge',
//             ip: getClientIp(req),
//             userAgent: req.headers['user-agent'],
//         });
//         return res.json({
//             step: 'verify',
//             challengeToken: token,
//         });
//     } catch (error) {
//         console.error('Login failed:', error);
//         return res.status(500).json({ error: 'Login failed' });
//     }
// });

// // ─── POST /api/auth/mfa/enrol/start ─────────────────────────────────────────
// // Burns the enrolment challenge from /login, generates a fresh secret, stores
// // it in mfa_secret (but leaves mfa_enabled=false until confirm), and mints a
// // follow-up challenge for /enrol/confirm.
// app.post('/api/auth/mfa/enrol/start', async (req, res) => {
//     try {
//         const challengeToken = String(req.body?.challengeToken || '');
//         const consumed = await challengeLib.consumeChallenge(pool, challengeToken, 'mfa_enrolment');
//         if (!consumed) return res.status(401).json({ error: 'Enrolment session expired. Sign in again.' });

//         const { rows: userRows } = await pool.query(
//             `SELECT id, email, full_name FROM ratings.users WHERE id = $1`, [consumed.user_id]
//         );
//         if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
//         const user = userRows[0];

//         const { secret, otpauthUri } = mfaLib.generateSecret({ email: user.email });
//         const qrDataUri = await mfaLib.renderQrDataUri(otpauthUri);

//         await pool.query(
//             `UPDATE ratings.users SET mfa_secret = $1, updated_at = now() WHERE id = $2`,
//             [secret, user.id]
//         );

//         const { token: nextToken } = await challengeLib.mintChallenge(pool, {
//             userId: user.id,
//             membershipId: consumed.membership_id,
//             companyId: consumed.company_id,
//             purpose: 'mfa_enrolment',
//             ip: getClientIp(req),
//             userAgent: req.headers['user-agent'],
//         });

//         return res.json({
//             challengeToken: nextToken,
//             otpauthUri,
//             qrDataUri,
//             manualSecret: secret,
//             email: user.email,
//             issuer: process.env.MFA_ISSUER || 'Rating Intelligence',
//         });
//     } catch (error) {
//         console.error('[mfa/enrol/start] failed:', error);
//         return res.status(500).json({ error: 'Failed to start MFA enrolment' });
//     }
// });

// // ─── POST /api/auth/mfa/enrol/confirm ───────────────────────────────────────
// // Verifies the first TOTP code, sets mfa_enabled=true, generates 10 backup
// // codes (returned plaintext exactly once), creates the full session.
// app.post('/api/auth/mfa/enrol/confirm', async (req, res) => {
//     try {
//         const challengeToken = String(req.body?.challengeToken || '');
//         const code = String(req.body?.code || '').trim();
//         const consumed = await challengeLib.consumeChallenge(pool, challengeToken, 'mfa_enrolment');
//         if (!consumed) return res.status(401).json({ error: 'Enrolment session expired. Sign in again.' });

//         const { rows: userRows } = await pool.query(
//             `SELECT id, username, email, full_name, role, status, mfa_secret
//              FROM ratings.users WHERE id = $1`,
//             [consumed.user_id]
//         );
//         if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
//         const user = userRows[0];
//         if (!user.mfa_secret) return res.status(400).json({ error: 'No MFA secret pending — restart enrolment.' });

//         if (!mfaLib.verifyTotp(user.mfa_secret, code)) {
//             await logMfaEvent(user.id, 'enrol_failed', req);
//             return res.status(401).json({ error: 'Code is incorrect. Check your authenticator app and try again.' });
//         }

//         const backupCodes = mfaLib.generateBackupCodes();
//         const hashes = await Promise.all(backupCodes.map(c => mfaLib.hashBackupCode(c)));

//         const client = await pool.connect();
//         try {
//             await client.query('BEGIN');
//             await client.query(
//                 `UPDATE ratings.users
//                  SET mfa_enabled = true,
//                      mfa_enrolled_at = now(),
//                      mfa_failed_attempts = 0,
//                      mfa_locked_until = NULL,
//                      updated_at = now()
//                  WHERE id = $1`,
//                 [user.id]
//             );
//             await client.query(`DELETE FROM ratings.mfa_backup_codes WHERE user_id = $1`, [user.id]);
//             for (const hash of hashes) {
//                 await client.query(
//                     `INSERT INTO ratings.mfa_backup_codes (user_id, code_hash) VALUES ($1, $2)`,
//                     [user.id, hash]
//                 );
//             }
//             await client.query('COMMIT');
//         } catch (txErr) {
//             await client.query('ROLLBACK');
//             throw txErr;
//         } finally {
//             client.release();
//         }

//         const membership = await loadMembershipContext(consumed.membership_id);
//         if (!membership) return res.status(403).json({ error: 'Membership could not be loaded' });

//         const sessionPayload = await createFullSession(user, membership, req);
//         await logMfaEvent(user.id, 'enrolled', req);

//         return res.json({ ...sessionPayload, backupCodes });
//     } catch (error) {
//         console.error('[mfa/enrol/confirm] failed:', error);
//         return res.status(500).json({ error: 'Failed to confirm MFA enrolment' });
//     }
// });

// // ─── POST /api/auth/mfa/verify ──────────────────────────────────────────────
// // Returning-user MFA step. Accepts a 6-digit TOTP or a backup code. Locks the
// // user for 15 min after 5 failed attempts.
// app.post('/api/auth/mfa/verify', async (req, res) => {
//     try {
//         const challengeToken = String(req.body?.challengeToken || '');
//         const code = String(req.body?.code || '').trim();
//         const isBackupCode = Boolean(req.body?.isBackupCode);
//         const consumed = await challengeLib.consumeChallenge(pool, challengeToken, 'mfa_challenge');
//         if (!consumed) return res.status(401).json({ error: 'Challenge expired. Sign in again.' });

//         const { rows: userRows } = await pool.query(
//             `SELECT id, username, email, full_name, role, status,
//                     mfa_secret, mfa_enabled, mfa_last_used_code, mfa_last_used_at,
//                     mfa_failed_attempts, mfa_locked_until
//              FROM ratings.users WHERE id = $1`,
//             [consumed.user_id]
//         );
//         if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
//         const user = userRows[0];
//         if (!user.mfa_enabled || !user.mfa_secret) {
//             return res.status(400).json({ error: 'MFA is not enabled for this account.' });
//         }
//         if (user.mfa_locked_until && new Date(user.mfa_locked_until) > new Date()) {
//             return res.status(423).json({
//                 error: 'Account temporarily locked due to too many failed MFA attempts.',
//                 lockedUntil: user.mfa_locked_until,
//             });
//         }

//         let ok = false;
//         let reason = null;
//         if (isBackupCode) {
//             const match = await mfaLib.findMatchingBackupCode(pool, user.id, code);
//             if (match) {
//                 await pool.query(
//                     `UPDATE ratings.mfa_backup_codes SET used_at = now() WHERE id = $1`,
//                     [match.id]
//                 );
//                 ok = true;
//                 reason = 'backup_used';
//             }
//         } else {
//             // Replay protection: same 6-digit code reused within the current 30s
//             // step is rejected even though the secret would still validate it.
//             const reusingRecent = user.mfa_last_used_code === code
//                 && user.mfa_last_used_at
//                 && (Date.now() - new Date(user.mfa_last_used_at).getTime()) < 60_000;
//             if (!reusingRecent && mfaLib.verifyTotp(user.mfa_secret, code)) {
//                 await pool.query(
//                     `UPDATE ratings.users SET mfa_last_used_code = $1, mfa_last_used_at = now() WHERE id = $2`,
//                     [code, user.id]
//                 );
//                 ok = true;
//                 reason = 'verify_success';
//             }
//         }

//         if (!ok) {
//             const failed = (user.mfa_failed_attempts || 0) + 1;
//             const shouldLock = failed >= 5;
//             await pool.query(
//                 `UPDATE ratings.users
//                  SET mfa_failed_attempts = $1,
//                      mfa_locked_until = CASE WHEN $2::bool THEN now() + interval '15 minutes' ELSE mfa_locked_until END
//                  WHERE id = $3`,
//                 [failed, shouldLock, user.id]
//             );
//             await logMfaEvent(user.id, shouldLock ? 'locked' : 'verify_failure', req, { metadata: { isBackupCode } });
//             if (shouldLock) {
//                 return res.status(423).json({
//                     error: 'Too many failed attempts. Account locked for 15 minutes.',
//                     lockedUntil: new Date(Date.now() + 15 * 60_000).toISOString(),
//                 });
//             }
//             return res.status(401).json({
//                 error: 'Code is incorrect.',
//                 attemptsRemaining: Math.max(0, 5 - failed),
//             });
//         }

//         await pool.query(
//             `UPDATE ratings.users SET mfa_failed_attempts = 0, mfa_locked_until = NULL WHERE id = $1`,
//             [user.id]
//         );
//         const membership = await loadMembershipContext(consumed.membership_id);
//         if (!membership) return res.status(403).json({ error: 'Membership could not be loaded' });

//         const sessionPayload = await createFullSession(user, membership, req);
//         await logMfaEvent(user.id, reason, req);
//         return res.json(sessionPayload);
//     } catch (error) {
//         console.error('[mfa/verify] failed:', error);
//         return res.status(500).json({ error: 'MFA verification failed' });
//     }
// });

// // ─── GET /api/auth/mfa/status — for the profile/security panel ──────────────
// app.get('/api/auth/mfa/status', async (req, res) => {
//     try {
//         const { rows } = await pool.query(
//             `SELECT mfa_enabled, mfa_enrolled_at,
//                     (SELECT COUNT(*) FROM ratings.mfa_backup_codes
//                      WHERE user_id = $1 AND used_at IS NULL) AS remaining_backup_codes
//              FROM ratings.users WHERE id = $1`,
//             [req.authUser.id]
//         );
//         if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
//         const row = rows[0];
//         return res.json({
//             enrolled: row.mfa_enabled,
//             enrolledAt: row.mfa_enrolled_at,
//             remainingBackupCodes: Number(row.remaining_backup_codes || 0),
//         });
//     } catch (error) {
//         console.error('[mfa/status] failed:', error);
//         return res.status(500).json({ error: 'Failed to load MFA status' });
//     }
// });

// // ─── POST /api/auth/mfa/backup-codes/regenerate ─────────────────────────────
// // Authenticated. Requires the user to enter their current TOTP code (proves
// // possession of the authenticator app) before issuing a fresh set of 10
// // backup codes. Old codes are deleted.
// app.post('/api/auth/mfa/backup-codes/regenerate', async (req, res) => {
//     try {
//         const code = String(req.body?.code || '').trim();
//         const { rows } = await pool.query(
//             `SELECT mfa_enabled, mfa_secret FROM ratings.users WHERE id = $1`,
//             [req.authUser.id]
//         );
//         if (rows.length === 0 || !rows[0].mfa_enabled) {
//             return res.status(400).json({ error: 'MFA is not enabled for this account.' });
//         }
//         if (!mfaLib.verifyTotp(rows[0].mfa_secret, code)) {
//             return res.status(401).json({ error: 'Code is incorrect.' });
//         }
//         const backupCodes = mfaLib.generateBackupCodes();
//         const hashes = await Promise.all(backupCodes.map(c => mfaLib.hashBackupCode(c)));
//         const client = await pool.connect();
//         try {
//             await client.query('BEGIN');
//             await client.query(`DELETE FROM ratings.mfa_backup_codes WHERE user_id = $1`, [req.authUser.id]);
//             for (const hash of hashes) {
//                 await client.query(
//                     `INSERT INTO ratings.mfa_backup_codes (user_id, code_hash) VALUES ($1, $2)`,
//                     [req.authUser.id, hash]
//                 );
//             }
//             await client.query('COMMIT');
//         } catch (txErr) {
//             await client.query('ROLLBACK');
//             throw txErr;
//         } finally {
//             client.release();
//         }
//         await logMfaEvent(req.authUser.id, 'backup_regenerated', req);
//         return res.json({ backupCodes });
//     } catch (error) {
//         console.error('[mfa/backup-codes/regenerate] failed:', error);
//         return res.status(500).json({ error: 'Failed to regenerate backup codes' });
//     }
// });

// // ─── POST /api/auth/mfa/reset — super_admin only ────────────────────────────
// // Resets another user's MFA so they can re-enrol on next login. Revokes all
// // existing full sessions for that user so any stolen pre-reset session can't
// // bypass re-enrolment.
// app.post('/api/auth/mfa/reset', async (req, res) => {
//     try {
//         if (req.authUser.role !== 'super_admin') {
//             return res.status(403).json({ error: 'super_admin role required' });
//         }
//         const targetUserId = String(req.body?.targetUserId || '').trim();
//         if (!targetUserId) return res.status(400).json({ error: 'targetUserId is required' });

//         const client = await pool.connect();
//         try {
//             await client.query('BEGIN');
//             await client.query(
//                 `UPDATE ratings.users
//                  SET mfa_enabled = false,
//                      mfa_secret = NULL,
//                      mfa_enrolled_at = NULL,
//                      mfa_last_used_code = NULL,
//                      mfa_last_used_at = NULL,
//                      mfa_failed_attempts = 0,
//                      mfa_locked_until = NULL,
//                      updated_at = now()
//                  WHERE id = $1`,
//                 [targetUserId]
//             );
//             await client.query(`DELETE FROM ratings.mfa_backup_codes WHERE user_id = $1`, [targetUserId]);
//             await client.query(
//                 `UPDATE ratings.auth_sessions SET revoked_at = now()
//                  WHERE user_id = $1 AND purpose = 'full' AND revoked_at IS NULL`,
//                 [targetUserId]
//             );
//             await client.query('COMMIT');
//         } catch (txErr) {
//             await client.query('ROLLBACK');
//             throw txErr;
//         } finally {
//             client.release();
//         }
//         await logMfaEvent(targetUserId, 'reset_by_admin', req, { actorId: req.authUser.id });
//         return res.json({ success: true });
//     } catch (error) {
//         console.error('[mfa/reset] failed:', error);
//         return res.status(500).json({ error: 'Failed to reset MFA' });
//     }
// });

// // ─── POST /api/auth/password/forgot ─────────────────────────────────────────
// // Always returns 200 — never leaks which emails exist. If a user matches, an
// // email with a single-use 30-min token is sent. The token is the same
// // hash-stored shape as MFA challenges, with purpose='password_reset'.
// app.post('/api/auth/password/forgot', async (req, res) => {
//     try {
//         const email = String(req.body?.email || '').trim().toLowerCase();
//         if (!email) return res.status(400).json({ error: 'email is required' });

//         // Always send the same success response, regardless of whether the user
//         // exists. This prevents enumeration of valid account emails.
//         const respond = () => res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });

//         if (!isMailerConfigured()) {
//             console.warn('[auth/password/forgot] SMTP not configured — cannot send reset emails.');
//             return respond();
//         }

//         const { rows } = await pool.query(
//             `SELECT id, email, full_name FROM ratings.users
//              WHERE lower(email) = $1 AND status = 'active' LIMIT 1`,
//             [email]
//         );
//         if (rows.length === 0) return respond();
//         const user = rows[0];

//         const { token } = await challengeLib.mintChallenge(pool, {
//             userId: user.id,
//             purpose: 'password_reset',
//             ip: getClientIp(req),
//             userAgent: req.headers['user-agent'],
//         });

//         const dashboard = process.env.PUBLIC_DASHBOARD_URL || 'https://prestige-review.up.railway.app';
//         const resetUrl = `${dashboard}/reset-password?token=${encodeURIComponent(token)}`;
//         const html = `
//             <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e293b">
//               <h2 style="color:#4f46e5;margin:0 0 12px">Reset your Rating Intelligence password</h2>
//               <p style="font-size:14px;line-height:1.5">Hi ${user.full_name || ''},</p>
//               <p style="font-size:14px;line-height:1.5">We received a request to reset your password. Click the button below within 30 minutes to set a new one:</p>
//               <p style="margin:24px 0"><a href="${resetUrl}" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Reset password</a></p>
//               <p style="font-size:13px;color:#64748b">If the button doesn't work, paste this link into your browser:<br><a href="${resetUrl}" style="color:#4f46e5;word-break:break-all">${resetUrl}</a></p>
//               <p style="font-size:13px;color:#64748b;margin-top:24px">If you didn't request this, you can safely ignore this email — your password is unchanged.</p>
//               <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
//               <p style="font-size:11px;color:#94a3b8">Rating Intelligence · TTK Prestige</p>
//             </div>`;
//         try {
//             await sendAlertEmail({
//                 to: user.email,
//                 subject: 'Reset your Rating Intelligence password',
//                 html,
//                 text: `Reset your password: ${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, you can ignore this email.`,
//                 priority: 'high',
//             });
//         } catch (mailErr) {
//             console.error('[auth/password/forgot] mailer failed:', mailErr.message);
//         }
//         return respond();
//     } catch (error) {
//         console.error('[auth/password/forgot] failed:', error);
//         // Still send the generic success to avoid leaking info, but log the error.
//         return res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
//     }
// });

// // ─── POST /api/auth/password/reset/validate ─────────────────────────────────
// // Lightweight token validity check used by the ResetPasswordPage on mount,
// // so the user sees "this link expired" immediately rather than after typing
// // a new password.
// app.post('/api/auth/password/reset/validate', async (req, res) => {
//     try {
//         const token = String(req.body?.token || '');
//         const peek = await challengeLib.peekChallenge(pool, token, 'password_reset');
//         if (!peek || !peek.valid) return res.status(400).json({ valid: false });
//         const { rows } = await pool.query(`SELECT email FROM ratings.users WHERE id = $1`, [peek.user_id]);
//         return res.json({ valid: true, email: rows[0]?.email || null });
//     } catch {
//         return res.status(400).json({ valid: false });
//     }
// });

// // ─── POST /api/auth/password/reset ──────────────────────────────────────────
// app.post('/api/auth/password/reset', async (req, res) => {
//     try {
//         const token = String(req.body?.token || '');
//         const newPassword = String(req.body?.newPassword || '');
//         if (newPassword.length < 8) {
//             return res.status(400).json({ error: 'Password must be at least 8 characters' });
//         }
//         const consumed = await challengeLib.consumeChallenge(pool, token, 'password_reset');
//         if (!consumed) return res.status(401).json({ error: 'Reset link is invalid or has expired.' });

//         const hash = await bcrypt.hash(newPassword, 10);
//         const client = await pool.connect();
//         try {
//             await client.query('BEGIN');
//             await client.query(
//                 `UPDATE ratings.users
//                  SET password_hash = $1,
//                      mfa_failed_attempts = 0,
//                      mfa_locked_until = NULL,
//                      updated_at = now()
//                  WHERE id = $2`,
//                 [hash, consumed.user_id]
//             );
//             // Revoke all existing full sessions so a stolen-token attacker is logged out.
//             await client.query(
//                 `UPDATE ratings.auth_sessions SET revoked_at = now()
//                  WHERE user_id = $1 AND purpose = 'full' AND revoked_at IS NULL`,
//                 [consumed.user_id]
//             );
//             await client.query('COMMIT');
//         } catch (txErr) {
//             await client.query('ROLLBACK');
//             throw txErr;
//         } finally {
//             client.release();
//         }
//         await logMfaEvent(consumed.user_id, 'password_reset', req);
//         return res.json({ success: true });
//     } catch (error) {
//         console.error('[auth/password/reset] failed:', error);
//         return res.status(500).json({ error: 'Failed to reset password' });
//     }
// });

// // ─── POST /api/auth/password/change — authenticated ─────────────────────────
// app.post('/api/auth/password/change', async (req, res) => {
//     try {
//         const currentPassword = String(req.body?.currentPassword || '');
//         const newPassword = String(req.body?.newPassword || '');
//         if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

//         const { rows } = await pool.query(
//             `SELECT password_hash FROM ratings.users WHERE id = $1`, [req.authUser.id]
//         );
//         if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
//         const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
//         if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });

//         const hash = await bcrypt.hash(newPassword, 10);
//         await pool.query(
//             `UPDATE ratings.users SET password_hash = $1, updated_at = now() WHERE id = $2`,
//             [hash, req.authUser.id]
//         );
//         await logMfaEvent(req.authUser.id, 'password_changed', req);
//         return res.json({ success: true });
//     } catch (error) {
//         console.error('[auth/password/change] failed:', error);
//         return res.status(500).json({ error: 'Failed to change password' });
//     }
// });

// // ─── GET /api/notifications — current user's in-app inbox ─────────────────
// app.get('/api/notifications', async (req, res) => {
//     try {
//         const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
//         const onlyUnread = req.query.unread === 'true' || req.query.unread === '1';
//         const { rows } = await pool.query(`
//             SELECT id, kind, title, body, payload, link_url, read_at, dismissed_at, created_at
//             FROM ratings.notifications
//             WHERE user_id = $1 AND dismissed_at IS NULL
//               ${onlyUnread ? 'AND read_at IS NULL' : ''}
//             ORDER BY created_at DESC LIMIT $2
//         `, [req.authUser.id, limit]);
//         const { rows: countRows } = await pool.query(
//             `SELECT COUNT(*) AS n FROM ratings.notifications
//              WHERE user_id = $1 AND read_at IS NULL AND dismissed_at IS NULL`,
//             [req.authUser.id]
//         );
//         return res.json({
//             notifications: rows,
//             unreadCount: Number(countRows[0]?.n || 0),
//         });
//     } catch (err) {
//         console.error('[notifications] list failed:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// app.post('/api/notifications/:id/read', async (req, res) => {
//     try {
//         const { rowCount } = await pool.query(
//             `UPDATE ratings.notifications SET read_at = NOW()
//              WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
//             [req.params.id, req.authUser.id]
//         );
//         return res.json({ updated: rowCount });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// app.post('/api/notifications/mark-all-read', async (req, res) => {
//     try {
//         const { rowCount } = await pool.query(
//             `UPDATE ratings.notifications SET read_at = NOW()
//              WHERE user_id = $1 AND read_at IS NULL`,
//             [req.authUser.id]
//         );
//         return res.json({ updated: rowCount });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// app.post('/api/notifications/:id/dismiss', async (req, res) => {
//     try {
//         const { rowCount } = await pool.query(
//             `UPDATE ratings.notifications SET dismissed_at = NOW()
//              WHERE id = $1 AND user_id = $2 AND dismissed_at IS NULL`,
//             [req.params.id, req.authUser.id]
//         );
//         return res.json({ updated: rowCount });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // ─── GET /api/auth/users — super_admin only ────────────────────────────────
// // Powers the Rules → Users admin panel. Returns enough state to render the
// // MFA reset button per row.
// app.get('/api/auth/users', async (req, res) => {
//     try {
//         if (req.authUser.role !== 'super_admin') {
//             return res.status(403).json({ error: 'super_admin role required' });
//         }
//         const { rows } = await pool.query(`
//             SELECT u.id, u.username, u.email, u.full_name, u.status,
//                    u.mfa_enabled, u.mfa_enrolled_at, u.last_login_at,
//                    u.mfa_locked_until,
//                    COALESCE(m.role, u.role) AS role
//             FROM ratings.users u
//             LEFT JOIN ratings.user_company_memberships m
//               ON m.user_id = u.id AND m.company_id = $1 AND m.status = 'active'
//             ORDER BY u.full_name ASC
//         `, [req.companyId]);
//         return res.json({ users: rows });
//     } catch (error) {
//         console.error('[auth/users] failed:', error);
//         return res.status(500).json({ error: 'Failed to load users' });
//     }
// });

// // ─── POST /api/auth/users — super_admin only (create + invite) ─────────────
// // Upserts a user, grants company membership, mints a password-set token, and
// // emails an invitation. Returns the token URL in the response too so the
// // super_admin can copy/paste it if SMTP isn't configured.
// async function sendInvitationEmail({ user, resetUrl, isNewUser }) {
//     if (!isMailerConfigured()) return { sent: false, reason: 'SMTP not configured' };
//     const dashboard = process.env.PUBLIC_DASHBOARD_URL || 'https://prestige-review.up.railway.app';
//     const subject = isNewUser
//         ? 'You have access to Rating Intelligence'
//         : 'Your Rating Intelligence access was updated';
//     const html = `
//         <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e293b">
//           <h2 style="color:#4f46e5;margin:0 0 12px">${isNewUser ? 'Welcome to Rating Intelligence' : 'Access updated'}</h2>
//           <p style="font-size:14px;line-height:1.5">Hi ${user.full_name || user.email},</p>
//           <p style="font-size:14px;line-height:1.5">
//             ${isNewUser
//                 ? `An admin has set up an account for you on <strong>Rating Intelligence</strong>. Click the button below within 30 minutes to set your password and sign in.`
//                 : `Your access on <strong>Rating Intelligence</strong> was updated. Click below within 30 minutes to set or reset your password.`}
//           </p>
//           <p style="margin:24px 0">
//             <a href="${resetUrl}" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Set my password</a>
//           </p>
//           <p style="font-size:13px;color:#64748b">
//             <strong>Your sign-in details</strong><br>
//             Login ID: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">${user.username}</code><br>
//             Sign-in URL: <a href="${dashboard}" style="color:#4f46e5">${dashboard}</a>
//           </p>
//           <p style="font-size:13px;color:#64748b">After setting your password, your first sign-in will walk you through setting up two-factor authentication (you'll need an authenticator app like Google Authenticator or Microsoft Authenticator).</p>
//           <p style="font-size:13px;color:#64748b">If the button doesn't work, paste this link into your browser:<br><a href="${resetUrl}" style="color:#4f46e5;word-break:break-all">${resetUrl}</a></p>
//           <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
//           <p style="font-size:11px;color:#94a3b8">Rating Intelligence · TTK Prestige</p>
//         </div>`;
//     try {
//         await sendAlertEmail({
//             to: user.email,
//             subject,
//             html,
//             text: `${isNewUser ? 'Welcome' : 'Access updated'}\n\nLogin ID: ${user.username}\nSet your password: ${resetUrl}\n\nThis link expires in 30 minutes.`,
//             priority: 'high',
//         });
//         return { sent: true };
//     } catch (e) {
//         return { sent: false, reason: e.message };
//     }
// }

// app.post('/api/auth/users', async (req, res) => {
//     try {
//         if (req.authUser.role !== 'super_admin') {
//             return res.status(403).json({ error: 'super_admin role required' });
//         }
//         const email = String(req.body?.email || '').trim().toLowerCase();
//         const fullName = String(req.body?.fullName || '').trim();
//         const role = String(req.body?.role || 'viewer').trim();
//         const platformScope = String(req.body?.platformScope || 'all').trim();
//         const sendInvite = req.body?.sendInvite !== false; // default true

//         if (!email || !fullName) {
//             return res.status(400).json({ error: 'email and fullName are required' });
//         }
//         if (!['super_admin', 'company_admin', 'viewer'].includes(role)) {
//             return res.status(400).json({ error: 'role must be super_admin, company_admin, or viewer' });
//         }
//         if (!['all', 'restricted'].includes(platformScope)) {
//             return res.status(400).json({ error: 'platformScope must be all or restricted' });
//         }

//         const username = email.split('@')[0].toLowerCase();
//         // Random placeholder hash — user sets a real password via the
//         // emailed reset link. They can't sign in until they do.
//         const placeholderHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);

//         const client = await pool.connect();
//         let userId, isNewUser = true;
//         try {
//             await client.query('BEGIN');
//             // Upsert the user. If they already exist we update name + role but
//             // leave password alone (admin can use Reset password to rotate).
//             const userIns = await client.query(`
//                 INSERT INTO ratings.users
//                     (id, username, email, full_name, password_hash, status, role,
//                      must_reset_password, mfa_enabled, timezone, updated_at)
//                 VALUES ($1, $2, $3, $4, $5, 'active', $6, false, false, 'Asia/Kolkata', now())
//                 ON CONFLICT ((lower(username)))
//                 DO UPDATE SET
//                     email = EXCLUDED.email,
//                     full_name = EXCLUDED.full_name,
//                     status = 'active',
//                     role = EXCLUDED.role,
//                     updated_at = now()
//                 RETURNING id, (xmax = 0) AS inserted
//             `, [crypto.randomUUID(), username, email, fullName, placeholderHash, role]);
//             userId = userIns.rows[0].id;
//             isNewUser = userIns.rows[0].inserted;

//             await client.query(`
//                 INSERT INTO ratings.user_company_memberships
//                     (id, user_id, company_id, role, status, is_primary, platform_scope, updated_at)
//                 VALUES ($1, $2, $3, $4, 'active', true, $5, now())
//                 ON CONFLICT (user_id, company_id)
//                 DO UPDATE SET role = EXCLUDED.role, status = 'active', is_primary = true,
//                               platform_scope = EXCLUDED.platform_scope, updated_at = now()
//             `, [crypto.randomUUID(), userId, req.companyId, role, platformScope]);

//             await client.query('COMMIT');
//         } catch (txErr) {
//             await client.query('ROLLBACK');
//             throw txErr;
//         } finally {
//             client.release();
//         }

//         // Mint a password-reset token so the invitation email links to a
//         // self-serve password setter — no need to ship plaintext credentials.
//         const { token } = await challengeLib.mintChallenge(pool, {
//             userId,
//             purpose: 'password_reset',
//             ip: getClientIp(req),
//             userAgent: req.headers['user-agent'],
//         });
//         const dashboard = process.env.PUBLIC_DASHBOARD_URL || 'https://prestige-review.up.railway.app';
//         const resetUrl = `${dashboard}/reset-password?token=${encodeURIComponent(token)}`;

//         let mailResult = { sent: false, reason: 'invite skipped' };
//         if (sendInvite) {
//             mailResult = await sendInvitationEmail({
//                 user: { id: userId, username, email, full_name: fullName },
//                 resetUrl,
//                 isNewUser,
//             });
//         }

//         await logMfaEvent(userId, isNewUser ? 'user_created' : 'user_updated', req, {
//             actorId: req.authUser.id,
//             metadata: { role, platformScope, sendInvite, mailSent: mailResult.sent, mailReason: mailResult.reason },
//         });

//         return res.json({
//             success: true,
//             userId,
//             username,
//             isNewUser,
//             invitation: {
//                 sent: mailResult.sent,
//                 reason: mailResult.reason,
//                 resetUrl, // returned so super_admin can copy if SMTP not configured
//                 expiresInMinutes: 30,
//             },
//         });
//     } catch (error) {
//         console.error('[auth/users POST] failed:', error);
//         return res.status(500).json({ error: error.message || 'Failed to create user' });
//     }
// });

// // ─── PUT /api/auth/users/:id — super_admin only ─────────────────────────────
// // Update role / status / platformScope. Username and email are immutable here
// // to avoid accidental account-takeover via typos — delete + recreate instead.
// app.put('/api/auth/users/:id', async (req, res) => {
//     try {
//         if (req.authUser.role !== 'super_admin') {
//             return res.status(403).json({ error: 'super_admin role required' });
//         }
//         const targetUserId = String(req.params.id || '').trim();
//         const patch = req.body || {};

//         const { rows: existing } = await pool.query(
//             `SELECT id FROM ratings.users WHERE id = $1`, [targetUserId]
//         );
//         if (existing.length === 0) return res.status(404).json({ error: 'User not found' });

//         const fields = [];
//         const values = [];
//         let idx = 1;
//         if (typeof patch.fullName === 'string') {
//             fields.push(`full_name = $${idx++}`); values.push(patch.fullName.trim());
//         }
//         if (typeof patch.status === 'string' && ['active', 'disabled'].includes(patch.status)) {
//             fields.push(`status = $${idx++}`); values.push(patch.status);
//         }
//         if (typeof patch.role === 'string' && ['super_admin', 'company_admin', 'viewer'].includes(patch.role)) {
//             fields.push(`role = $${idx++}`); values.push(patch.role);
//         }

//         if (fields.length > 0) {
//             fields.push(`updated_at = now()`);
//             values.push(targetUserId);
//             await pool.query(
//                 `UPDATE ratings.users SET ${fields.join(', ')} WHERE id = $${idx}`,
//                 values
//             );
//         }

//         // Mirror role/platform changes onto the active membership row for this company.
//         const membershipPatches = [];
//         const memberValues = [];
//         let mi = 1;
//         if (typeof patch.role === 'string' && ['super_admin', 'company_admin', 'viewer'].includes(patch.role)) {
//             membershipPatches.push(`role = $${mi++}`); memberValues.push(patch.role);
//         }
//         if (typeof patch.platformScope === 'string' && ['all', 'restricted'].includes(patch.platformScope)) {
//             membershipPatches.push(`platform_scope = $${mi++}`); memberValues.push(patch.platformScope);
//         }
//         if (typeof patch.status === 'string' && ['active', 'disabled'].includes(patch.status)) {
//             membershipPatches.push(`status = $${mi++}`); memberValues.push(patch.status === 'disabled' ? 'disabled' : 'active');
//         }
//         if (membershipPatches.length > 0) {
//             membershipPatches.push(`updated_at = now()`);
//             memberValues.push(targetUserId, req.companyId);
//             await pool.query(
//                 `UPDATE ratings.user_company_memberships SET ${membershipPatches.join(', ')}
//                  WHERE user_id = $${mi} AND company_id = $${mi + 1}`,
//                 memberValues
//             );
//         }

//         // Disabling a user should also revoke their active sessions immediately.
//         if (patch.status === 'disabled') {
//             await pool.query(
//                 `UPDATE ratings.auth_sessions SET revoked_at = now()
//                  WHERE user_id = $1 AND purpose = 'full' AND revoked_at IS NULL`,
//                 [targetUserId]
//             );
//         }

//         await logMfaEvent(targetUserId, 'user_updated', req, {
//             actorId: req.authUser.id,
//             metadata: patch,
//         });
//         return res.json({ success: true });
//     } catch (error) {
//         console.error('[auth/users PUT] failed:', error);
//         return res.status(500).json({ error: error.message || 'Failed to update user' });
//     }
// });

// // ─── POST /api/auth/users/:id/invite — re-send the invitation email ─────────
// app.post('/api/auth/users/:id/invite', async (req, res) => {
//     try {
//         if (req.authUser.role !== 'super_admin') {
//             return res.status(403).json({ error: 'super_admin role required' });
//         }
//         const targetUserId = String(req.params.id || '').trim();
//         const { rows } = await pool.query(
//             `SELECT id, username, email, full_name FROM ratings.users WHERE id = $1`,
//             [targetUserId]
//         );
//         if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
//         const user = rows[0];

//         const { token } = await challengeLib.mintChallenge(pool, {
//             userId: user.id,
//             purpose: 'password_reset',
//             ip: getClientIp(req),
//             userAgent: req.headers['user-agent'],
//         });
//         const dashboard = process.env.PUBLIC_DASHBOARD_URL || 'https://prestige-review.up.railway.app';
//         const resetUrl = `${dashboard}/reset-password?token=${encodeURIComponent(token)}`;

//         const mailResult = await sendInvitationEmail({ user, resetUrl, isNewUser: false });
//         await logMfaEvent(user.id, 'invitation_resent', req, {
//             actorId: req.authUser.id,
//             metadata: { mailSent: mailResult.sent, mailReason: mailResult.reason },
//         });
//         return res.json({
//             success: true,
//             invitation: {
//                 sent: mailResult.sent,
//                 reason: mailResult.reason,
//                 resetUrl,
//                 expiresInMinutes: 30,
//             },
//         });
//     } catch (error) {
//         console.error('[auth/users/invite] failed:', error);
//         return res.status(500).json({ error: error.message || 'Failed to send invite' });
//     }
// });

// // ─── GET /api/auth/mailer/status — super_admin only — diagnostics ───────────
// app.get('/api/auth/mailer/status', async (req, res) => {
//     if (req.authUser.role !== 'super_admin') {
//         return res.status(403).json({ error: 'super_admin role required' });
//     }
//     return res.json({
//         configured: isMailerConfigured(),
//         smtpHost: process.env.SMTP_HOST || null,
//         smtpUser: process.env.SMTP_USER ? `${process.env.SMTP_USER.slice(0, 3)}…@${(process.env.SMTP_USER.split('@')[1] || '')}` : null,
//         smtpFrom: process.env.SMTP_FROM || null,
//         dashboardUrl: process.env.PUBLIC_DASHBOARD_URL || null,
//         hint: isMailerConfigured()
//             ? 'SMTP looks good. Forgot-password and invites will send.'
//             : 'Set SMTP_HOST, SMTP_USER, SMTP_PASS (and optionally SMTP_FROM) on Railway. Until then, copy reset URLs from the invite dialog.',
//     });
// });

// app.get('/api/auth/me', async (req, res) => {
//     return res.json({
//         token: req.sessionToken,
//         expiresAt: req.sessionExpiresAt,
//         user: req.authUser,
//     });
// });

// app.post('/api/auth/logout', async (req, res) => {
//     try {
//         await pool.query(`
//             UPDATE ratings.auth_sessions
//             SET revoked_at = now()
//             WHERE id = $1
//         `, [req.sessionId]);
//         return res.json({ success: true });
//     } catch (error) {
//         console.error('Logout failed:', error);
//         return res.status(500).json({ error: 'Logout failed' });
//     }
// });

// app.post('/api/auth/switch-company', async (req, res) => {
//     try {
//         const targetCompanyId = String(req.body?.company_id || '').trim();
//         if (!targetCompanyId) {
//             return res.status(400).json({ error: 'company_id is required' });
//         }

//         const membershipRes = await pool.query(`
//             SELECT id
//             FROM ratings.user_company_memberships
//             WHERE user_id = $1
//               AND company_id = $2
//               AND status = 'active'
//             LIMIT 1
//         `, [req.authUser.id, targetCompanyId]);

//         if (membershipRes.rowCount === 0) {
//             return res.status(403).json({ error: 'No active membership for requested company' });
//         }

//         const membership = await loadMembershipContext(membershipRes.rows[0].id);
//         if (!membership) {
//             return res.status(403).json({ error: 'Membership could not be loaded' });
//         }

//         await pool.query(`
//             UPDATE ratings.auth_sessions
//             SET membership_id = $1,
//                 company_id = $2,
//                 last_activity_at = now()
//             WHERE id = $3
//         `, [membership.id, membership.company_id, req.sessionId]);

//         return res.json({
//             token: req.sessionToken,
//             expiresAt: req.sessionExpiresAt,
//             user: buildAuthUser(req.authPrincipal, membership),
//         });
//     } catch (error) {
//         console.error('Company switch failed:', error);
//         return res.status(500).json({ error: 'Company switch failed' });
//     }
// });

// function getLatestSnapshotOrder(columns = []) {
//     if (columns.includes('updated_at')) return 'updated_at DESC, created_on DESC, created_at DESC';
//     if (columns.includes('created_on')) return 'created_on DESC, created_at DESC';
//     if (columns.includes('created_at')) return 'created_at DESC';
//     return 'web_pid DESC';
// }

// function buildPriceBuckets(values) {
//     const sorted = values
//         .map(v => Number(v))
//         .filter(v => Number.isFinite(v) && v > 0)
//         .sort((a, b) => a - b);

//     if (sorted.length === 0) {
//         return { min: 0, max: 0, slabs: [] };
//     }

//     const percentiles = [0, 0.25, 0.5, 0.75, 1];
//     const edges = percentiles.map(p => {
//         const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
//         return sorted[idx];
//     });

//     const deduped = [sorted[0]];
//     for (const edge of edges.slice(1)) {
//         if (edge > deduped[deduped.length - 1]) deduped.push(edge);
//     }
//     if (deduped[deduped.length - 1] !== sorted[sorted.length - 1]) {
//         deduped.push(sorted[sorted.length - 1]);
//     }

//     const slabs = [];
//     for (let i = 0; i < deduped.length - 1; i++) {
//         const min = deduped[i];
//         const max = deduped[i + 1];
//         if (!(max > min)) continue;
//         const count = sorted.filter(v => i === deduped.length - 2 ? v >= min && v <= max : v >= min && v < max).length;
//         slabs.push({
//             min,
//             max,
//             count,
//             label: `₹${Math.round(min).toLocaleString('en-IN')} - ₹${Math.round(max).toLocaleString('en-IN')}`,
//         });
//     }

//     if (slabs.length === 0) {
//         slabs.push({
//             min: sorted[0],
//             max: sorted[sorted.length - 1],
//             count: sorted.length,
//             label: `₹${Math.round(sorted[0]).toLocaleString('en-IN')} - ₹${Math.round(sorted[sorted.length - 1]).toLocaleString('en-IN')}`,
//         });
//     }

//     return {
//         min: sorted[0],
//         max: sorted[sorted.length - 1],
//         slabs,
//     };
// }

// // ============================================================================
// // GET /api/ratings/reviews — Main reviews endpoint with full filtering
// // ============================================================================
// app.get('/api/ratings/reviews', async (req, res) => {
//     try {
//         const {
//             platform,           // 'amazon', 'flipkart', 'all'
//             is_competitor,      // 'true', 'false', 'all'
//             category,           // category name
//             material,           // material type
//             pareto_status,      // 'Pareto', 'Non-Pareto', etc.
//             brand,              // brand name
//             date_from,          // YYYY-MM-DD
//             date_to,            // YYYY-MM-DD
//             web_pid,            // specific product ASIN/FSN
//             sentiment_category, // sentiment category (Quality, Performance, etc.)
//             limit: queryLimit,
//             offset: queryOffset,
//             price_mode,
//             price_min,
//             price_max,
//         } = req.query;

//         let where = ['r.company_id = $1'];
//         let params = [req.companyId];
//         let idx = 2;

//         if (platform && platform !== 'all') {
//             where.push(`r.platform ILIKE $${idx++}`);
//             params.push(platform);
//         }
//         if (is_competitor && is_competitor !== 'all') {
//             where.push(`r.is_competitor = $${idx++}`);
//             params.push(is_competitor === 'true');
//         }
//         if (category) {
//             where.push(`COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE $${idx++}`);
//             params.push(category);
//         }
//         if (sentiment_category) {
//             where.push(`r.sentiment_category ILIKE $${idx++}`);
//             params.push(sentiment_category);
//         }
//         // categories_in: comma-separated list of categories (used for competitor roll-up)
//         const categories_in = req.query.categories_in;
//         if (categories_in && !category) {
//             const catList = categories_in.split(',').map(c => c.trim()).filter(Boolean);
//             if (catList.length > 0) {
//                 const placeholders = catList.map((_, i) => `$${idx + i}`).join(', ');
//             where.push(`COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) IN (${placeholders})`);
//                 params.push(...catList);
//                 idx += catList.length;
//             }
//         }
//         if (material) {
//             where.push(`COALESCE(NULLIF(mp.material, ''), NULLIF(r.material, '')) = $${idx++}`);
//             params.push(material);
//         }
//         if (pareto_status) {
//             where.push(`COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, ''), NULLIF(r.pareto_status, '')) = $${idx++}`);
//             params.push(pareto_status);
//         }
//         if (brand) {
//             where.push(`r.brand = $${idx++}`);
//             params.push(brand);
//         }
//         if (date_from) {
//             where.push(`r.review_date >= $${idx++}`);
//             params.push(date_from);
//         }
//         if (date_to) {
//             where.push(`r.review_date <= $${idx++}`);
//             params.push(date_to);
//         }
//         // Default the on-mount load to a 6-month window (clamped 1-24 via
//         // period_months) when no explicit range is chosen. Previously this
//         // endpoint pulled ALL-TIME reviews to the browser — the single heaviest
//         // uncached query (full scan + per-row snapshot LATERAL + 30-50MB payload).
//         // The date filter still widens it. pm is a clamped int -> safe to inline.
//         if (!date_from && !date_to) {
//             const pm = Math.max(1, Math.min(parseInt(req.query.period_months, 10) || 6, 24));
//             where.push(`r.review_date >= (CURRENT_DATE - INTERVAL '${pm} months')`);
//         }
//         if (web_pid) {
//             where.push(`r.web_pid = $${idx++}`);
//             params.push(web_pid);
//         }
//         if (price_min !== undefined && price_min !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             where.push(`${priceExpr} >= $${idx++}`);
//             params.push(Number(price_min));
//         }
//         if (price_max !== undefined && price_max !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             where.push(`${priceExpr} <= $${idx++}`);
//             params.push(Number(price_max));
//         }

//         const limit = queryLimit === undefined ? 100000 : Math.max(0, parseInt(queryLimit, 10) || 0);
//         const offset = queryOffset === undefined ? 0 : Math.max(0, parseInt(queryOffset, 10) || 0);

//         const paginationClause = queryLimit === undefined
//             ? ''
//             : ` LIMIT ${limit} OFFSET ${offset}`;

//         // Each SKU's latest snapshot computed ONCE (was a per-review correlated
//         // LATERAL — the dominant cost over a large 6-month window). Same selection
//         // as the old LATERAL (latest snapshot_date, then created_at); a SKU with no
//         // snapshot simply has no row, so the LEFT JOIN yields the same NULLs.
//         const latestSnapshotsCTE = `latest_snapshots AS (
//                 SELECT DISTINCT ON (web_pid, LOWER(platform))
//                     web_pid, platform, price_rp, price_sp, rating, rating_count, category, pareto_status
//                 FROM ratings.product_snapshots
//                 WHERE company_id = $1
//                 ORDER BY web_pid, LOWER(platform), snapshot_date DESC, created_at DESC NULLS LAST
//             )`;
//         const sql = `
//             WITH ${latestSnapshotsCTE}
//             SELECT
//                 r.id, r.platform, r.web_pid, r.product_name, r.brand,
//                 r.rating, r.ml_inferred_rating, r.review_title, r.review_text, r.review_date,
//                 r.is_verified_purchase, COALESCE(ps.rating, r.pdp_rating) as pdp_rating, COALESCE(ps.rating_count, r.pdp_rating_count) as pdp_rating_count,
//                 r.sentiment, r.sentiment_category, r.sentiment_subcategory,
//                 r.sentiment_score, r.quality_score, r.specific_issue,
//                 COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) as category,
//                 COALESCE(mp.material, r.material) as material,
//                 COALESCE(mp.wattage, r.wattage) as wattage,
//                 r.is_competitor, COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, ''), NULLIF(r.pareto_status, '')) as pareto_status,
//                 mua.id as ml_audit_id, mua.ml_sentiment, mua.ml_issue, mua.ml_category,
//                 COALESCE(ps.price_rp, mp.mrp) AS price_rp,
//                 COALESCE(ps.price_sp, mp.selling_price, mp.mop) AS price_sp,
//                 ps.rating AS pdp_platform_rating,
//                 ps.rating_count AS pdp_total_rating_count
//             FROM ratings.reviews r
//             LEFT JOIN ratings.reviews_ml_audit mua ON mua.review_id = r.id AND mua.company_id = r.company_id
//             LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
//             LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND LOWER(ps.platform) = LOWER(r.platform)
//             WHERE ${where.join(' AND ')}
//             ORDER BY r.review_date DESC NULLS LAST
//             ${paginationClause}
//         `;


//         const { rows } = await pool.query(sql, params);

//         // OPTIMIZATION: To allow unlimited data fetching without crashing the browser or Vercel payload limits,
//         // we strip the heavy text fields from all rows except the 500 most recent ones.
//         // The charts/graphs only use numeric & categorical data, so they will calculate perfectly accurately
//         // without downloading 40MB of text.
//         for (let i = 500; i < rows.length; i++) {
//             rows[i].review_text = "";
//             rows[i].review_title = "";
//             rows[i].specific_issue = "";
//         }

//         // Also get total count for pagination
//         const countSql = `
//             WITH ${latestSnapshotsCTE}
//             SELECT count(*)
//             FROM ratings.reviews r
//             LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
//             LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND LOWER(ps.platform) = LOWER(r.platform)
//             WHERE ${where.join(' AND ')}
//         `;
//         const { rows: countRows } = await pool.query(countSql, params);

//         res.json({
//             data: rows,
//             total: parseInt(countRows[0].count),
//             limit,
//             offset,
//         });
//     } catch (err) {
//         console.error('Reviews error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/product-categories — Distinct product categories with counts
// // ============================================================================
// app.get('/api/ratings/product-categories', async (req, res) => {
//     try {
//         const { platform, is_competitor } = req.query;
//         // Count catalogue SKUs per category straight from the MASTER
//         // (masters.products) — the authoritative RB-SKU catalogue — and using
//         // the master's category. Previously this counted from product_snapshots
//         // by the snapshot's category, which undercounted (a SKU with no snapshot
//         // category was dropped) and put SKUs in different categories than the
//         // Overview governance cards. Counting from the master keeps the category
//         // dropdown and the Competition product chips consistent with governance:
//         // one SKU, one category, the same number everywhere. Grain matches the
//         // governance count — DISTINCT product_external_id (deduped across
//         // platforms unless a platform filter is applied). masters.products is
//         // ~21k rows, so this stays sub-second.
//         const params = [req.companyId];
//         let where = `mp.company_id = $1 AND mp.platform IS NOT NULL AND mp.category IS NOT NULL AND TRIM(mp.category) <> ''`;
//         let idx = 2;
//         if (platform && platform !== 'all') {
//             where += ` AND LOWER(mp.platform) = LOWER($${idx++})`;
//             params.push(platform);
//         }
//         if (is_competitor && is_competitor !== 'all') {
//             where += ` AND COALESCE(mp.is_competitor, false) = $${idx++}`;
//             params.push(is_competitor === 'true');
//         }
//         const { rows } = await pool.query(`
//             SELECT
//                 CASE WHEN TRIM(LOWER(mp.category)) IN ('other','others') THEN 'Others'
//                      ELSE INITCAP(TRIM(mp.category)) END AS category,
//                 COUNT(DISTINCT mp.product_external_id) AS count
//             FROM masters.products mp
//             WHERE ${where}
//             GROUP BY 1
//             ORDER BY 2 DESC
//         `, params);
//         res.json({ data: rows });
//     } catch (err) {
//         console.error('Product categories error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/products — Product catalog with classification
// // ============================================================================
// app.get('/api/ratings/products', async (req, res) => {
//     try {
//         const {
//             platform,
//             pareto_status,
//             category,
//             material,
//             is_competitor,
//             limit: queryLimit,
//             offset: queryOffset,
//             searchQuery,
//             price_mode,
//             price_min,
//             price_max,
//         } = req.query;

//         let where = ['company_id = $1'];
//         let params = [req.companyId];
//         let idx = 2;

//         if (platform && platform !== 'all') {
//             where.push(`platform ILIKE $${idx++}`);
//             params.push(platform);
//         }
//         if (pareto_status) {
//             where.push(`pareto_status = $${idx++}`);
//             params.push(pareto_status);
//         }
//         if (category) {
//             // Filter on the resolved category (which now prefers master_category
//             // over brand_category when master is specific). master_category is
//             // null for ~80% of rows so filtering on it directly hides everything.
//             where.push(`(category ILIKE $${idx} OR master_category ILIKE $${idx})`);
//             params.push(category);
//             idx++;
//         }
//         if (material) {
//             where.push(`material = $${idx++}`);
//             params.push(material);
//         }
//         if (is_competitor !== undefined) {
//             where.push(`is_competitor = $${idx++}`);
//             params.push(is_competitor === 'true');
//         }
//         if (searchQuery) {
//             where.push(`(product_name ILIKE $${idx} OR asin ILIKE $${idx} OR sku_code ILIKE $${idx})`);
//             params.push(`%${searchQuery}%`);
//             idx++;
//         }
//         if (price_min !== undefined && price_min !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, p.mrp)'
//                 : 'COALESCE(ps.price_sp, p.selling_price, p.mop, ps.price_rp, p.mrp)';
//             where.push(`${priceExpr} >= $${idx++}`);
//             params.push(Number(price_min));
//         }
//         if (price_max !== undefined && price_max !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, p.mrp)'
//                 : 'COALESCE(ps.price_sp, p.selling_price, p.mop, ps.price_rp, p.mrp)';
//             where.push(`${priceExpr} <= $${idx++}`);
//             params.push(Number(price_max));
//         }

//         const limit = queryLimit === undefined ? 100 : Math.max(0, parseInt(queryLimit, 10) || 0);
//         const offset = queryOffset === undefined ? 0 : Math.max(0, parseInt(queryOffset, 10) || 0);

//         const countSql = `
//             SELECT count(*)
//             FROM masters.products p
//             LEFT JOIN LATERAL (
//                 SELECT ps2.price_rp, ps2.price_sp, ps2.rating, ps2.rating_count
//                 FROM ratings.product_snapshots ps2
//                 WHERE ps2.company_id = p.company_id
//                   AND ps2.web_pid = p.product_external_id
//                   AND (LOWER(ps2.platform) = LOWER(p.platform) OR p.platform IS NULL)
//                 ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
//                 LIMIT 1
//             ) ps ON true
//             WHERE ${where.map(clause => clause.replace(/(^|[\s(])company_id\b/g, '$1p.company_id')).join(' AND ')}
//         `;
//         const { rows: countRows } = await pool.query(countSql, params);

//         const sql = `
//             SELECT 
//                 p.id, p.product_external_id, p.product_name, p.description, p.brand_name,
//                 p.category_path, p.platform, p.asin,
//                 COALESCE(ps.rating, p.rating) AS rating,
//                 COALESCE(NULLIF(rv.review_count, 0), p.review_count, 0) AS review_count,
//                 ps.rating_count,
//                 rv.user_rating,
//                 rv.ml_rating,
//                 p.pareto_status, p.material, p.wattage, p.capacity, p.litre, p.master_category, p.category,
//                 p.business_segment, p.sku_code, p.mrp, p.mop, p.is_competitor,
//                 COALESCE(ps.price_rp, p.mrp) AS price_rp,
//                 COALESCE(ps.price_sp, p.selling_price, p.mop) AS price_sp
//             FROM masters.products p
//             LEFT JOIN LATERAL (
//                 SELECT ps2.price_rp, ps2.price_sp, ps2.rating, ps2.rating_count
//                 FROM ratings.product_snapshots ps2
//                 WHERE ps2.company_id = p.company_id
//                   AND ps2.web_pid = p.product_external_id
//                   AND (LOWER(ps2.platform) = LOWER(p.platform) OR p.platform IS NULL)
//                 ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
//                 LIMIT 1
//             ) ps ON true
//             LEFT JOIN LATERAL (
//                 SELECT
//                     COUNT(*) AS review_count,
//                     ROUND(AVG(rv.rating)::numeric, 2) AS user_rating,
//                     ROUND(AVG(rv.ml_inferred_rating)::numeric, 2) AS ml_rating
//                 FROM ratings.reviews rv
//                 WHERE rv.company_id = p.company_id
//                   AND rv.web_pid = p.product_external_id
//                   AND (LOWER(rv.platform) = LOWER(p.platform) OR p.platform IS NULL)
//                   AND rv.is_competitor = COALESCE(p.is_competitor, false)
//             ) rv ON true
//             WHERE ${where.map(clause => clause.replace(/(^|[\s(])company_id\b/g, '$1p.company_id')).join(' AND ')}
//             ORDER BY p.product_name, p.id
//             LIMIT $${idx++} OFFSET $${idx++}
//         `;
//         params.push(limit, offset);
//         const { rows } = await pool.query(sql, params);

//         res.json({ data: rows, total: parseInt(countRows[0].count), limit, offset });
//     } catch (err) {
//         console.error('Products error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // POST /api/ml-audit/product-inspect — AI Extraction for Masters
// // ============================================================================
// app.post('/api/ml-audit/product-inspect', async (req, res) => {
//     try {
//         const { id, product_name, brand_name, description, asin, sku } = req.body;
//         if (!id || !product_name) {
//             return res.status(400).json({ error: 'id and product_name required' });
//         }

//         const apiKey = process.env.GEMINI_API_KEY;
//         if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });

//         // Fetch authorized categories from ML dictionary to prevent AI hallucination
//         const { rows } = await pool.query(`SELECT dict_value FROM ratings.ml_dictionary WHERE dict_type = 'category' AND company_id = $1`, [req.companyId]);
//         const validCategories = rows.map(r => r.dict_value).join('", "');

//         const promptText = `
//         Analyze the following product exactly:
//         Brand: "${brand_name || ''}"
//         Product Name: "${product_name}"
//         ${asin ? `ASIN/FSIN: "${asin}"\n` : ''}${sku ? `SKU: "${sku}"\n` : ''}${description ? `Description/Specs: "${description}"\n` : ''}
        
//         Extract information formatted exclusively as JSON with the following keys:
//         - "category" (STRICTLY ONE OF: ["${validCategories}"]. Do not invent new categories. Find the best fit.)
//         - "material" (e.g. "Glass", "Stainless Steel", "Cast Iron", "Hard Anodised". If none found, return null.)
//         - "wattage" (e.g. "500W", "750W", "1200W". If none found, return null.)
//         - "capacity" (e.g. "1.5 Litre", "3L", "26cm". If none found, return null.)
//         - "color" (e.g. "Black", "Silver", "Red". If none found, return null.)
//         - "warranty" (e.g. "1 Year", "5 Years". If none found, return null.)
        
//         If missing from the provided text, use your internal knowledge of the exact ASIN/SKU or Brand Name to deduce accurate specs.
//         Rules: Output ONLY valid JSON, absolutely no markdown wrapping, no \`\`\`.
//         `;

//         const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + apiKey, {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({
//                 contents: [{ parts: [{ text: promptText }] }],
//                 generationConfig: { temperature: 0.1 }
//             })
//         });

//         if (!aiRes.ok) throw new Error("Google AI Error: " + aiRes.statusText);
//         const aiJson = await aiRes.json();
//         const rawResponse = aiJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        
//         // Clean markdown if accidentally returned
//         const cleanResponse = rawResponse.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
//         const extracted = JSON.parse(cleanResponse);

//         res.json({
//             success: true,
//             persisted: false,
//             ai_extraction: extracted,
//             message: 'Preview generated. Production master data was not changed because no audited master QC store is configured.'
//         });
//     } catch (err) {
//         console.error('AI Product Extraction error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/competitor-mentions — server-side scan results
// // Replaces the in-browser competitor scanner in src/utils/competitorDetection.ts
// // (which only saw the currently-rendered review page so the UI used to read 0
// // mentions on most filters). Returned shape mirrors aggregateMentionsByBrand
// // for drop-in compatibility with VerbatimMentionsCard.
// // ============================================================================
// app.get('/api/ratings/competitor-mentions', async (req, res) => {
//     try {
//         const { brand, platform, date_from, date_to, limit = 100 } = req.query;
//         const params = [req.companyId];
//         const where = ['company_id = $1'];
//         let idx = 2;
//         if (brand)     { where.push(`LOWER(brand) = LOWER($${idx++})`); params.push(brand); }
//         if (platform)  { where.push(`LOWER(platform) = LOWER($${idx++})`); params.push(platform); }
//         if (date_from) { where.push(`review_date >= $${idx++}`);     params.push(date_from); }
//         if (date_to)   { where.push(`review_date <= $${idx++}`);     params.push(date_to); }
//         // Default to a 6-month window like the rest of the dashboard, so undated /
//         // ancient rows don't fold into an all-time headline.
//         if (!date_from && !date_to) { where.push(`review_date >= (CURRENT_DATE - INTERVAL '6 months')`); }
//         const whereSql = where.join(' AND ');

//         const [agg, sample] = await Promise.all([
//             pool.query(`
//                 -- Collapse case-variant brand rows (e.g. 'hawkins' + 'Hawkins') that the
//                 -- scanner stored verbatim, and de-dupe the same review counted under both
//                 -- variants: group on LOWER(brand) and count DISTINCT review_id (not COUNT(*)).
//                 SELECT LOWER(brand) AS brand,
//                        COUNT(DISTINCT review_id) AS total,
//                        COUNT(DISTINCT review_id) FILTER (WHERE is_favorable) AS favorable,
//                        COUNT(DISTINCT review_id) FILTER (WHERE sentiment = 'Negative' AND NOT is_favorable) AS unfavorable,
//                        COUNT(DISTINCT review_id) FILTER (WHERE NOT is_favorable AND sentiment <> 'Negative') AS neutral
//                 FROM ratings.competitor_mentions
//                 WHERE ${whereSql}
//                 GROUP BY LOWER(brand)
//                 ORDER BY total DESC
//             `, params),
//             pool.query(`
//                 SELECT id, review_id, web_pid, platform, brand, context, sentiment,
//                        is_favorable, review_date, review_rating, scanned_at
//                 FROM ratings.competitor_mentions
//                 WHERE ${whereSql}
//                 ORDER BY review_date DESC NULLS LAST, id DESC
//                 LIMIT $${idx}
//             `, [...params, Math.min(parseInt(limit, 10) || 100, 500)]),
//         ]);

//         const total = agg.rows.reduce((s, r) => s + parseInt(r.total, 10), 0);
//         res.json({
//             total,
//             byBrand: agg.rows.map(r => ({
//                 brand: r.brand,
//                 total: parseInt(r.total, 10),
//                 favorable: parseInt(r.favorable, 10),
//                 unfavorable: parseInt(r.unfavorable, 10),
//                 neutral: parseInt(r.neutral, 10),
//                 favorableRate: parseInt(r.total, 10) > 0 ? parseInt(r.favorable, 10) / parseInt(r.total, 10) : 0,
//             })),
//             sample: sample.rows.map(r => ({
//                 id: r.id,
//                 reviewId: r.review_id,
//                 brand: r.brand,
//                 context: r.context,
//                 sentiment: r.sentiment,
//                 isFavorable: r.is_favorable,
//                 reviewDate: r.review_date,
//                 reviewRating: r.review_rating,
//                 webPid: r.web_pid,
//                 platform: r.platform,
//             })),
//         });
//     } catch (err) {
//         console.error('competitor-mentions error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // PATCH /api/ratings/products/:id/pareto-status — manual classification override
// // Lets admins flip a SKU between Pareto / Non-Pareto / NPD from the master table.
// // normalizePareto() in sync_mysql_master.cjs already preserves NPD across syncs.
// // ============================================================================
// app.patch('/api/ratings/products/:id/pareto-status', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { pareto_status } = req.body || {};
//         const ALLOWED = ['Pareto', 'Non-Pareto', 'NPD'];
//         if (!ALLOWED.includes(pareto_status)) {
//             return res.status(400).json({ error: `pareto_status must be one of ${ALLOWED.join(', ')}` });
//         }
//         const { rows } = await pool.query(
//             `UPDATE masters.products
//                 SET pareto_status = $1
//               WHERE id = $2 AND company_id = $3
//               RETURNING id, pareto_status`,
//             [pareto_status, id, req.companyId]
//         );
//         if (!rows.length) return res.status(404).json({ error: 'Product not found' });
//         res.json({ success: true, ...rows[0] });
//     } catch (err) {
//         console.error('pareto-status update error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // POST /api/ratings/classify-review — Direct ping to Railway ML Microservice
// // ============================================================================
// app.post('/api/ratings/classify-review', async (req, res) => {
//     try {
//         const { text, product_name, rating } = req.body;
        
//         if (!text) {
//             return res.status(400).json({ error: 'Review text is required' });
//         }

//         const railwayEndpoint = "https://review-rating-api-production.up.railway.app/classify";
        
//         if (!process.env.ML_API_SECRET) {
//             return res.status(500).json({ error: 'ML_API_SECRET is not configured' });
//         }

//         const railwayRes = await fetch(railwayEndpoint, {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json",
//                 "Authorization": `Bearer ${process.env.ML_API_SECRET}`
//             },
//             body: JSON.stringify({
//                 text,
//                 rating: parseFloat(rating) || 3.0,
//                 product_name: product_name || ""
//             })
//         });

//         if (!railwayRes.ok) {
//             throw new Error(`Railway ML Engine responded with HTTP ${railwayRes.status}`);
//         }

//         const mlData = await railwayRes.json();
        
//         res.json({ success: true, mlData });

//     } catch (err) {
//         console.error('Classification proxy error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/summary — Aggregated KPIs
// // ============================================================================
// app.get('/api/ratings/summary', async (req, res) => {
//     try {
//         const {
//             platform,
//             category,
//             pareto_status,
//             web_pid,
//             date_from,
//             date_to,
//             price_mode,
//             price_min,
//             price_max,
//             is_competitor,
//             sentiment_category,
//         } = req.query;
//         // Review-count window anchor. Standardized on CURRENT_DATE (rolling
//         // "last N months from today") so EVERY surface — header, category strip,
//         // governance cards, benchmark — reports the SAME number. A MAX(review_date)
//         // anchor pulled in a ~5.4K review cluster near the year boundary and made
//         // the strip/cards read ~26.5K while the header read ~21K.
//         const anchorDateExpr = 'CURRENT_DATE';
//         let where = ['rs.company_id = $1'];
//         let params = [req.companyId];
//         let idx = 2;

//         if (is_competitor && is_competitor !== 'all') {
//             where.push(`rs.is_competitor = $${idx++}`);
//             params.push(is_competitor === 'true');
//         } else if (is_competitor === undefined || is_competitor === '') {
//             // Default to ALL for summary if not specified, to match dashboard default
//             // where.push(`rs.is_competitor = false`);
//         }

//         if (platform && platform !== 'all') {
//             where.push(`rs.platform ILIKE $${idx++}`);
//             params.push(platform);
//         }
//         if (category) {
//             where.push(`TRIM(rs.resolved_category) ILIKE $${idx++}`);
//             params.push(category);
//         }
//         if (sentiment_category) {
//             where.push(`rs.sentiment_category ILIKE $${idx++}`);
//             params.push(sentiment_category);
//         }
//         if (pareto_status) {
//             where.push(`rs.resolved_pareto_status = $${idx++}`);
//             params.push(pareto_status);
//         }
//         if (web_pid) {
//             where.push(`rs.web_pid = $${idx++}`);
//             params.push(web_pid);
//         }
//         if (date_from) {
//             where.push(`rs.review_date >= $${idx++}`);
//             params.push(date_from);
//         }
//         if (date_to) {
//             where.push(`rs.review_date <= $${idx++}`);
//             params.push(date_to);
//         }
//         if (!date_from && !date_to) {
//             // Sanitize: req.query.period_months was interpolated raw into SQL — clamp to 1-24.
//             const period_months = Math.max(1, Math.min(parseInt(req.query.period_months, 10) || 6, 24));
//             where.push(`rs.review_date >= (${anchorDateExpr} - INTERVAL '${period_months} months')`);
//         }
//         const hasPriceFilter = (price_min !== undefined && price_min !== '') || (price_max !== undefined && price_max !== '');
//         const reviewScopeParams = [...params];
//         const reviewPriceExpr = price_mode === 'rp'
//             ? 'COALESCE(rs.resolved_price_rp, rs.base_mrp)'
//             : 'COALESCE(rs.resolved_price_sp, rs.base_selling_price, rs.base_mop, rs.resolved_price_rp, rs.base_mrp)';
//         if (price_min !== undefined && price_min !== '') {
//             where.push(`${reviewPriceExpr} >= $${idx++}`);
//             reviewScopeParams.push(Number(price_min));
//         }
//         if (price_max !== undefined && price_max !== '') {
//             where.push(`${reviewPriceExpr} <= $${idx++}`);
//             reviewScopeParams.push(Number(price_max));
//         }
//         const whereClause = where.join(' AND ');

//         const baseScopeSql = `
//             WITH latest_snapshots AS (
//                 SELECT DISTINCT ON (ps.company_id, LOWER(ps.platform), ps.web_pid)
//                     ps.company_id,
//                     ps.platform,
//                     ps.web_pid,
//                     ps.price_rp,
//                     ps.price_sp,
//                     ps.rating,
//                     ps.rating_count,
//                     ps.review_count,
//                     ps.category,
//                     ps.pareto_status
//                 FROM ratings.product_snapshots ps
//                 WHERE ps.company_id = $1
//                 ORDER BY ps.company_id, LOWER(ps.platform), ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
//             ),
//             review_scope AS (
//                 SELECT
//                     r.*,
//                     CASE 
//                         WHEN TRIM(LOWER(COALESCE(NULLIF(ls.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')))) IN ('other', 'others') THEN 'Others'
//                         ELSE INITCAP(TRIM(COALESCE(NULLIF(ls.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))))
//                     END AS resolved_category,
//                     COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ls.pareto_status, ''), NULLIF(r.pareto_status, '')) AS resolved_pareto_status,
//                     COALESCE(NULLIF(mp.material, ''), NULLIF(r.material, '')) AS resolved_material,
//                     COALESCE(ls.price_rp, mp.mrp) AS resolved_price_rp,
//                     COALESCE(ls.price_sp, mp.selling_price, mp.mop) AS resolved_price_sp,
//                     mp.mrp AS base_mrp,
//                     mp.selling_price AS base_selling_price,
//                     mp.mop AS base_mop,
//                     ls.rating AS resolved_pdp_rating,
//                     ls.rating_count AS resolved_pdp_rating_count
//                 FROM ratings.reviews r
//                 LEFT JOIN masters.products mp
//                     ON mp.company_id = r.company_id
//                    AND mp.product_external_id = r.web_pid
//                    AND LOWER(mp.platform) = LOWER(r.platform)
//                 LEFT JOIN latest_snapshots ls
//                     ON ls.company_id = r.company_id
//                    AND ls.web_pid = r.web_pid
//                    AND LOWER(ls.platform) = LOWER(r.platform)
//             )
//         `;

//         const combinedMetrics = await pool.query(`
//             ${baseScopeSql},
//             filtered_reviews AS (
//                 SELECT *
//                 FROM review_scope rs
//                 WHERE ${whereClause}
//             ),
//             filtered_products AS (
//                 SELECT DISTINCT
//                     fr.web_pid,
//                     fr.platform,
//                     fr.resolved_pdp_rating,
//                     fr.resolved_pdp_rating_count
//                 FROM filtered_reviews fr
//             )
//             SELECT
//                 count(*)::text AS total_reviews,
//                 round(avg(fr.rating)::numeric, 2)::text AS avg_review_rating,
//                 round(avg(fr.ml_inferred_rating)::numeric, 2)::text AS avg_ml_rating,
//                 count(DISTINCT fr.web_pid)::text AS unique_products,
//                 count(DISTINCT fr.resolved_category)::text AS unique_categories,
//                 count(*) FILTER (WHERE fr.sentiment = 'Positive')::text AS positive_count,
//                 count(*) FILTER (WHERE fr.sentiment = 'Negative')::text AS negative_count,
//                 count(*) FILTER (WHERE fr.sentiment = 'Neutral')::text AS neutral_count,
//                 COALESCE((
//                     SELECT sum(COALESCE(fp.resolved_pdp_rating_count, 0))::text
//                     FROM filtered_products fp
//                 ), '0') AS total_ratings,
//                 (
//                     SELECT round(
//                         sum(COALESCE(fp.resolved_pdp_rating, 0) * COALESCE(fp.resolved_pdp_rating_count, 0))
//                         / NULLIF(sum(COALESCE(fp.resolved_pdp_rating_count, 0)), 0)::numeric,
//                         2
//                     )::text
//                     FROM filtered_products fp
//                 ) AS avg_platform_rating,
//                 COALESCE((SELECT count(*)::text FROM filtered_products), '0') AS total_products
//             FROM filtered_reviews fr
//         `, reviewScopeParams);

//         const metrics = combinedMetrics.rows[0] || {};

//         // ── PDP Rating + Rating Count: snapshot-direct (catalog), not review-gated ──
//         // Deriving these from reviewed-products-in-window silently returned 0 for
//         // platforms whose recent review web_pids don't match snapshot web_pids
//         // (Flipkart). Rating Count is a catalogue metric, so compute it straight
//         // from the latest product_snapshots scoped by the same catalogue filters
//         // (platform / scope / category / pareto / SKU / price) — no review-window,
//         // no sentiment. Review-based tiles (user/ml rating, review count) are
//         // unchanged.
//         const snapWhere = [];
//         const snapParams = [req.companyId];
//         let si = 2;
//         if (is_competitor && is_competitor !== 'all') {
//             snapWhere.push(`sc.is_competitor = $${si++}`);
//             snapParams.push(is_competitor === 'true');
//         }
//         if (platform && platform !== 'all') {
//             snapWhere.push(`sc.platform ILIKE $${si++}`);
//             snapParams.push(platform);
//         }
//         if (category) {
//             snapWhere.push(`TRIM(sc.resolved_category) ILIKE $${si++}`);
//             snapParams.push(category);
//         }
//         if (pareto_status) {
//             snapWhere.push(`sc.resolved_pareto_status = $${si++}`);
//             snapParams.push(pareto_status);
//         }
//         if (web_pid) {
//             snapWhere.push(`sc.web_pid = $${si++}`);
//             snapParams.push(web_pid);
//         }
//         const snapPriceExpr = price_mode === 'rp'
//             ? 'sc.resolved_price_rp'
//             : 'COALESCE(sc.resolved_price_sp, sc.resolved_price_rp)';
//         if (price_min !== undefined && price_min !== '') {
//             snapWhere.push(`${snapPriceExpr} >= $${si++}`);
//             snapParams.push(Number(price_min));
//         }
//         if (price_max !== undefined && price_max !== '') {
//             snapWhere.push(`${snapPriceExpr} <= $${si++}`);
//             snapParams.push(Number(price_max));
//         }
//         const snapWhereSql = snapWhere.length ? `WHERE ${snapWhere.join(' AND ')}` : '';

//         let pdpMetrics = {};
//         try {
//             const snapRes = await pool.query(`
//                 WITH latest_snapshots AS (
//                     SELECT DISTINCT ON (ps.company_id, LOWER(ps.platform), ps.web_pid)
//                         ps.company_id, ps.platform, ps.web_pid, ps.is_competitor,
//                         ps.price_rp, ps.price_sp, ps.rating, ps.rating_count,
//                         ps.category, ps.pareto_status
//                     FROM ratings.product_snapshots ps
//                     WHERE ps.company_id = $1
//                     ORDER BY ps.company_id, LOWER(ps.platform), ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
//                 ),
//                 sc AS (
//                     SELECT ls.web_pid, ls.platform, ls.is_competitor, ls.rating, ls.rating_count,
//                         CASE
//                             WHEN TRIM(LOWER(COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, '')))) IN ('other', 'others') THEN 'Others'
//                             ELSE INITCAP(TRIM(COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, ''))))
//                         END AS resolved_category,
//                         COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ls.pareto_status, '')) AS resolved_pareto_status,
//                         COALESCE(ls.price_rp, mp.mrp) AS resolved_price_rp,
//                         COALESCE(ls.price_sp, mp.selling_price, mp.mop) AS resolved_price_sp
//                     FROM latest_snapshots ls
//                     LEFT JOIN masters.products mp
//                         ON mp.company_id = $1
//                        AND mp.product_external_id = ls.web_pid
//                        AND LOWER(mp.platform) = LOWER(ls.platform)
//                 )
//                 SELECT
//                     COALESCE(sum(COALESCE(sc.rating_count, 0)), 0)::text AS total_ratings,
//                     round(
//                         sum(COALESCE(sc.rating, 0) * COALESCE(sc.rating_count, 0))
//                         / NULLIF(sum(COALESCE(sc.rating_count, 0)), 0)::numeric,
//                     2)::text AS avg_platform_rating,
//                     count(*)::text AS total_products
//                 FROM sc
//                 ${snapWhereSql}
//             `, snapParams);
//             pdpMetrics = snapRes.rows[0] || {};
//         } catch (snapErr) {
//             console.error('Summary snapshot-PDP error (falling back to review-derived):', snapErr.message);
//             pdpMetrics = {
//                 total_ratings: metrics.total_ratings,
//                 avg_platform_rating: metrics.avg_platform_rating,
//             };
//         }

//         res.json({
//             metrics: {
//                 ...metrics,
//                 user_rating: metrics.avg_review_rating || null,
//                 ml_rating: metrics.avg_ml_rating || null,
//                 pdp_rating: pdpMetrics.avg_platform_rating || null,
//                 review_count: metrics.total_reviews || '0',
//                 rating_count: pdpMetrics.total_ratings || '0',
//                 total_ratings: pdpMetrics.total_ratings || '0',
//                 avg_platform_rating: pdpMetrics.avg_platform_rating || null,
//             },
//             ratingDistribution: [],
//             sentimentDistribution: [],
//             materialDistribution: [],
//             categoryDistribution: [],
//         });
//     } catch (err) {
//         console.error('Summary error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/platform-options — Lightweight platform list for topbar
// // ============================================================================
// app.get('/api/ratings/platform-options', async (req, res) => {
//     try {
//         const { is_competitor } = req.query;
//         const params = [req.companyId];
//         let competitorFilter = '';

//         if (is_competitor !== undefined) {
//             competitorFilter = 'AND r.is_competitor = $2';
//             params.push(is_competitor === 'true');
//         }

//         // Recursive index skip-scan over idx_reviews_platform (company_id,
//         // platform): jump from one distinct platform to the next via ~N index
//         // lookups instead of a DISTINCT scan over all 4.2M rows. Same result,
//         // 62s -> ~0.2s. (Postgres has no native loose index scan.)
//         const { rows } = await pool.query(`
//             WITH RECURSIVE p AS (
//                 (SELECT r.platform
//                    FROM ratings.reviews r
//                   WHERE r.company_id = $1 AND r.platform IS NOT NULL AND r.platform <> '' ${competitorFilter}
//                   ORDER BY r.platform LIMIT 1)
//                 UNION ALL
//                 SELECT (SELECT r.platform
//                           FROM ratings.reviews r
//                          WHERE r.company_id = $1 AND r.platform IS NOT NULL AND r.platform <> '' ${competitorFilter}
//                            AND r.platform > p.platform
//                          ORDER BY r.platform LIMIT 1)
//                 FROM p WHERE p.platform IS NOT NULL
//             )
//             SELECT platform FROM p WHERE platform IS NOT NULL ORDER BY platform
//         `, params);

//         res.json({ platforms: rows.map(row => row.platform) });
//     } catch (err) {
//         console.error('Platform options error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/categories — Available filter options (config-driven)
// // ============================================================================
// app.get('/api/ratings/categories', async (req, res) => {
//     try {
//         const { is_competitor } = req.query;
//         let competitorFilter = '';
//         const params = [req.companyId];

//         if (is_competitor !== undefined) {
//             competitorFilter = 'AND r.is_competitor = $2';
//             params.push(is_competitor === 'true');
//         }

//         const [categories, materials, brands, platforms, paretoStatuses] = await Promise.all([
//             pool.query(`
//                 WITH latest_snapshots AS (
//                     SELECT DISTINCT ON (ps.company_id, LOWER(ps.platform), ps.web_pid)
//                         ps.company_id,
//                         ps.platform,
//                         ps.web_pid,
//                         ps.category,
//                         ps.brand
//                     FROM ratings.product_snapshots ps
//                     WHERE ps.company_id = $1
//                     ORDER BY ps.company_id, LOWER(ps.platform), ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
//                 )
//                 SELECT DISTINCT 
//                     CASE 
//                         WHEN TRIM(LOWER(COALESCE(NULLIF(ls.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')))) IN ('other', 'others') THEN 'Others'
//                         ELSE INITCAP(TRIM(COALESCE(NULLIF(ls.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))))
//                     END AS category
//                 FROM ratings.reviews r
//                 LEFT JOIN masters.products mp
//                     ON mp.company_id = r.company_id
//                    AND mp.product_external_id = r.web_pid
//                    AND LOWER(mp.platform) = LOWER(r.platform)
//                 LEFT JOIN latest_snapshots ls
//                     ON ls.company_id = r.company_id
//                    AND ls.web_pid = r.web_pid
//                    AND LOWER(ls.platform) = LOWER(r.platform)
//                 WHERE r.company_id = $1 ${competitorFilter}
//                   AND COALESCE(NULLIF(ls.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) IS NOT NULL
//                 ORDER BY category
//             `, params),
//             pool.query(`
//                 SELECT DISTINCT material
//                 FROM masters.products
//                 WHERE company_id = $1
//                   AND material IS NOT NULL
//                   AND material <> ''
//                 ORDER BY material
//             `, [req.companyId]),
//             pool.query(`
//                 WITH latest_snapshots AS (
//                     SELECT DISTINCT ON (ps.company_id, LOWER(ps.platform), ps.web_pid)
//                         ps.company_id,
//                         ps.platform,
//                         ps.web_pid,
//                         ps.brand
//                     FROM ratings.product_snapshots ps
//                     WHERE ps.company_id = $1
//                     ORDER BY ps.company_id, LOWER(ps.platform), ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
//                 )
//                 SELECT DISTINCT COALESCE(NULLIF(mp.brand_name, ''), NULLIF(ls.brand, ''), NULLIF(r.brand, '')) AS brand
//                 FROM ratings.reviews r
//                 LEFT JOIN masters.products mp
//                     ON mp.company_id = r.company_id
//                    AND mp.product_external_id = r.web_pid
//                    AND LOWER(mp.platform) = LOWER(r.platform)
//                 LEFT JOIN latest_snapshots ls
//                     ON ls.company_id = r.company_id
//                    AND ls.web_pid = r.web_pid
//                    AND LOWER(ls.platform) = LOWER(r.platform)
//                 WHERE r.company_id = $1 ${competitorFilter}
//                   AND COALESCE(NULLIF(mp.brand_name, ''), NULLIF(ls.brand, ''), NULLIF(r.brand, '')) IS NOT NULL
//                 ORDER BY brand
//             `, params),
//             // Skip-scan instead of DISTINCT over 4.2M rows (see platform-options).
//             pool.query(`
//                 WITH RECURSIVE p AS (
//                     (SELECT r.platform FROM ratings.reviews r WHERE r.company_id = $1 ${competitorFilter} AND r.platform IS NOT NULL ORDER BY r.platform LIMIT 1)
//                     UNION ALL
//                     SELECT (SELECT r.platform FROM ratings.reviews r WHERE r.company_id = $1 ${competitorFilter} AND r.platform IS NOT NULL AND r.platform > p.platform ORDER BY r.platform LIMIT 1)
//                     FROM p WHERE p.platform IS NOT NULL
//                 )
//                 SELECT platform FROM p WHERE platform IS NOT NULL ORDER BY platform`, params),
//             pool.query(`
//                 SELECT DISTINCT pareto_status
//                 FROM masters.products
//                 WHERE company_id = $1
//                   AND pareto_status IS NOT NULL
//                   AND pareto_status <> ''
//                 ORDER BY pareto_status
//             `, [req.companyId]),
//         ]);

//         res.json({
//             categories: categories.rows.map(r => r.category),
//             materials: materials.rows.map(r => r.material),
//             brands: brands.rows.map(r => r.brand),
//             platforms: platforms.rows.map(r => r.platform),
//             paretoStatuses: paretoStatuses.rows.map(r => r.pareto_status),
//         });
//     } catch (err) {
//         console.error('Categories error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/price-ranges — Fetch DB-driven slabs for MRP and Selling Price
// // ============================================================================
// app.get('/api/ratings/price-ranges', async (req, res) => {
//     try {
//         const sql = `
//             SELECT
//                 COALESCE(ps.price_rp, p.mrp) AS price_rp,
//                 COALESCE(ps.price_sp, p.selling_price, p.mop) AS price_sp
//             FROM masters.products p
//             LEFT JOIN LATERAL (
//                 SELECT ps2.price_rp, ps2.price_sp
//                 FROM ratings.product_snapshots ps2
//                 WHERE ps2.company_id = p.company_id
//                   AND ps2.web_pid = p.product_external_id
//                   AND (ps2.platform = p.platform OR p.platform IS NULL)
//                 ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
//                 LIMIT 1
//             ) ps ON true
//             WHERE p.company_id = $1
//               AND (CASE 
//                 WHEN $2 = 'true' THEN p.is_competitor = true
//                 WHEN $2 = 'false' THEN p.is_competitor = false
//                 ELSE true
//               END)
//         `;
//         const { rows } = await pool.query(sql, [req.companyId, String(req.query.is_competitor || 'all')]);
//         const rp = buildPriceBuckets(rows.map(row => row.price_rp));
//         const sp = buildPriceBuckets(rows.map(row => row.price_sp));
//         res.json({
//             minRp: rp.min,
//             maxRp: rp.max,
//             minSp: sp.min,
//             maxSp: sp.max,
//             modes: {
//                 rp: { label: 'MRP', min: rp.min, max: rp.max, slabs: rp.slabs },
//                 sp: { label: 'Selling Price', min: sp.min, max: sp.max, slabs: sp.slabs },
//             },
//         });
//     } catch (err) {
//         console.error('Price ranges error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/trends — Escalating/Improving issues (server-side)
// // ============================================================================
// app.get('/api/ratings/trends', async (req, res) => {
//     try {
//         const periodMonths = parseInt(req.query.period_months) || 6;
//         const { category, pareto_status, web_pid, date_from, date_to, platform, price_mode, price_min, price_max, is_competitor } = req.query;
//         const safePeriodMonths = Math.max(1, Math.min(periodMonths, 24));
//         // Review-count window anchor. Standardized on CURRENT_DATE (rolling
//         // "last N months from today") so EVERY surface — header, category strip,
//         // governance cards, benchmark — reports the SAME number. A MAX(review_date)
//         // anchor pulled in a ~5.4K review cluster near the year boundary and made
//         // the strip/cards read ~26.5K while the header read ~21K.
//         const anchorDateExpr = 'CURRENT_DATE';
//         const params = [req.companyId];
//         let idx = 2;
//         const extraFilters = [];

//         if (is_competitor && is_competitor !== 'all') {
//             extraFilters.push(`COALESCE(r.is_competitor, false) = $${idx++}`);
//             params.push(is_competitor === 'true');
//         } else if (is_competitor === undefined || is_competitor === '') {
//             // Default to Prestige-only — competitor brands (e.g. iBELL) must not leak
//             // into "Growth Opportunities" / characteristic trends / product-health rankings.
//             extraFilters.push(`COALESCE(r.is_competitor, false) = false`);
//         }

//         if (platform && platform !== 'all') {
//             extraFilters.push(`r.platform ILIKE $${idx++}`);
//             params.push(platform);
//         }
//         if (category) {
//             extraFilters.push(`COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE $${idx++}`);
//             params.push(category);
//         }
//         const sentiment_category = req.query.sentiment_category;
//         if (sentiment_category && sentiment_category !== 'all') {
//             extraFilters.push(`r.sentiment_category ILIKE $${idx++}`);
//             params.push(sentiment_category);
//         }
//         if (pareto_status) {
//             extraFilters.push(`COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, ''), NULLIF(r.pareto_status, '')) = $${idx++}`);
//             params.push(pareto_status);
//         }
//         if (web_pid) {
//             extraFilters.push(`r.web_pid = $${idx++}`);
//             params.push(web_pid);
//         }
//         if (price_min !== undefined && price_min !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             extraFilters.push(`${priceExpr} >= $${idx++}`);
//             params.push(Number(price_min));
//         }
//         if (price_max !== undefined && price_max !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             extraFilters.push(`${priceExpr} <= $${idx++}`);
//             params.push(Number(price_max));
//         }

//         let recentPeriodFilter;
//         let priorPeriodFilter;
//         let combinedWindowFilter;

//         if (date_from && date_to) {
//             params.push(date_from, date_to);
//             const fromIdx = params.length - 1;
//             const toIdx = params.length;
//             const midpointExpr = `($${fromIdx}::date + ($${toIdx}::date - $${fromIdx}::date) / 2)`;
//             recentPeriodFilter = `r.review_date >= ${midpointExpr} AND r.review_date <= $${toIdx}::date`;
//             priorPeriodFilter = `r.review_date >= $${fromIdx}::date AND r.review_date < ${midpointExpr}`;
//             combinedWindowFilter = `r.review_date >= $${fromIdx}::date AND r.review_date <= $${toIdx}::date`;
//         } else {
//             const recentStartExpr = `${anchorDateExpr} - INTERVAL '${safePeriodMonths} months'`;
//             const priorStartExpr = `${anchorDateExpr} - INTERVAL '${safePeriodMonths * 2} months'`;
//             recentPeriodFilter = `r.review_date >= ${recentStartExpr}`;
//             priorPeriodFilter = `r.review_date >= ${priorStartExpr} AND r.review_date < ${recentStartExpr}`;
//             combinedWindowFilter = `r.review_date >= ${priorStartExpr}`;
//         }

//         const extraWhere = extraFilters.length > 0 ? `AND ${extraFilters.join(' AND ')}` : '';

//         const sql = `
//             WITH latest_snapshots AS (
//                 SELECT DISTINCT ON (web_pid, LOWER(platform))
//                     web_pid, platform, price_rp, price_sp, category, pareto_status
//                 FROM ratings.product_snapshots
//                 WHERE company_id = $1
//                 ORDER BY web_pid, LOWER(platform), snapshot_date DESC, created_at DESC NULLS LAST
//             ),
//             scoped_reviews AS (
//                 SELECT
//                     REPLACE(COALESCE(NULLIF(r.sentiment_subcategory, ''), NULLIF(r.sentiment_category, ''), 'General'), '_', ' ') AS characteristic,
//                     CASE
//                         WHEN ${recentPeriodFilter} THEN 'recent'
//                         WHEN ${priorPeriodFilter} THEN 'prior'
//                         ELSE NULL
//                     END AS period,
//                     r.sentiment
//                 FROM ratings.reviews r
//                 LEFT JOIN masters.products mp
//                     ON mp.company_id = r.company_id
//                    AND mp.product_external_id = r.web_pid
//                    AND LOWER(mp.platform) = LOWER(r.platform)
//                 LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND LOWER(ps.platform) = LOWER(r.platform)
//                 WHERE r.company_id = $1
//                   AND r.review_date IS NOT NULL
//                   AND ${combinedWindowFilter}
//                   ${extraWhere}
//             ),
//             aggregated AS (
//                 SELECT
//                     characteristic,
//                     COUNT(*) FILTER (WHERE period = 'recent') AS recent_total,
//                     COUNT(*) FILTER (WHERE period = 'recent' AND sentiment = 'Negative') AS recent_neg,
//                     COUNT(*) FILTER (WHERE period = 'recent' AND sentiment = 'Positive') AS recent_pos,
//                     COUNT(*) FILTER (WHERE period = 'prior') AS prior_total,
//                     COUNT(*) FILTER (WHERE period = 'prior' AND sentiment = 'Negative') AS prior_neg,
//                     COUNT(*) FILTER (WHERE period = 'prior' AND sentiment = 'Positive') AS prior_pos
//                 FROM scoped_reviews
//                 WHERE period IS NOT NULL
//                 GROUP BY characteristic
//             )
//             SELECT
//                 characteristic,
//                 recent_total,
//                 recent_neg,
//                 recent_pos,
//                 prior_total,
//                 prior_neg,
//                 prior_pos,
//                 CASE WHEN recent_total > 0 THEN recent_neg::float / recent_total ELSE 0 END AS recent_neg_rate,
//                 CASE WHEN prior_total > 0 THEN prior_neg::float / prior_total ELSE 0 END AS prior_neg_rate,
//                 CASE WHEN recent_total > 0 THEN recent_neg::float / recent_total ELSE 0 END
//                     - CASE WHEN prior_total > 0 THEN prior_neg::float / prior_total ELSE 0 END AS change
//             FROM aggregated
//             WHERE characteristic NOT IN ('General Feedback', 'Overall Quality', 'General')
//               AND recent_total >= 15
//               AND prior_total >= 15
//             ORDER BY change DESC
//         `;

//         const { rows } = await pool.query(sql, params);

//         const escalating = rows
//             .filter(r => r.change > 0.05 && r.recent_neg_rate > 0.25)
//             .slice(0, 10)
//             .map(r => ({
//                 characteristic: r.characteristic,
//                 recentNegativeRate: parseFloat(r.recent_neg_rate),
//                 olderNegativeRate: parseFloat(r.prior_neg_rate),
//                 change: parseFloat(r.change),
//                 recentCount: parseInt(r.recent_total),
//                 totalCount: parseInt(r.recent_total) + parseInt(r.prior_total),
//                 isEscalating: true,
//                 isImproving: false,
//             }));

//         const improving = rows
//             .filter(r => r.change < -0.05)
//             .sort((a, b) => parseFloat(a.change) - parseFloat(b.change))
//             .slice(0, 10)
//             .map(r => ({
//                 characteristic: r.characteristic,
//                 recentNegativeRate: parseFloat(r.recent_neg_rate),
//                 olderNegativeRate: parseFloat(r.prior_neg_rate),
//                 change: parseFloat(r.change),
//                 recentCount: parseInt(r.recent_total),
//                 totalCount: parseInt(r.recent_total) + parseInt(r.prior_total),
//                 isEscalating: false,
//                 isImproving: true,
//             }));

//         res.json({ escalating, improving });
//     } catch (err) {
//         console.error('Trends error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/timeline — Monthly aggregated timeline (server-side)
// // ============================================================================
// app.get('/api/ratings/timeline', async (req, res) => {
//     try {
//         const { category: filterCategory, pareto_status, web_pid, date_from, date_to, platform, price_mode, price_min, price_max } = req.query;

//         // Review-count window anchor. Standardized on CURRENT_DATE (rolling
//         // "last N months from today") so EVERY surface — header, category strip,
//         // governance cards, benchmark — reports the SAME number. A MAX(review_date)
//         // anchor pulled in a ~5.4K review cluster near the year boundary and made
//         // the strip/cards read ~26.5K while the header read ~21K.
//         const anchorDateExpr = 'CURRENT_DATE';
//         const params = [req.companyId];
//         let idx = 2;
//         const extraFilters = [];
//         if (platform && platform !== 'all') { extraFilters.push(`r.platform ILIKE $${idx++}`); params.push(platform); }
//         if (filterCategory) { extraFilters.push(`r.category ILIKE $${idx++}`); params.push(filterCategory); }
//         if (pareto_status) { extraFilters.push(`r.pareto_status = $${idx++}`); params.push(pareto_status); }
//         if (web_pid) { extraFilters.push(`r.web_pid = $${idx++}`); params.push(web_pid); }
//         if (date_from) { extraFilters.push(`r.review_date >= $${idx++}`); params.push(date_from); }
//         if (date_to) { extraFilters.push(`r.review_date <= $${idx++}`); params.push(date_to); }
        
//         const { is_competitor } = req.query;
//         if (is_competitor && is_competitor !== 'all') {
//             extraFilters.push(`r.is_competitor = $${idx++}`);
//             params.push(is_competitor === 'true');
//         } else if (is_competitor === undefined || is_competitor === '') {
//             // Default to ALL for timeline
//         }
//         if (price_min !== undefined && price_min !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             extraFilters.push(`${priceExpr} >= $${idx++}`);
//             params.push(Number(price_min));
//         }
//         if (price_max !== undefined && price_max !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             extraFilters.push(`${priceExpr} <= $${idx++}`);
//             params.push(Number(price_max));
//         }
//         // Bound the scan to the requested window. This endpoint previously
//         // ignored period_months and aggregated ALL history (~6M rows) on every
//         // call — the bulk of its cost — while the frontend only renders recent
//         // months. Honor period_months (clamped 1-24) when no explicit range is
//         // given. pm is a clamped integer, so direct interpolation is safe.
//         if (!date_from && !date_to && req.query.period_months) {
//             const pm = Math.max(1, Math.min(parseInt(req.query.period_months, 10) || 6, 24));
//             extraFilters.push(`r.review_date >= (${anchorDateExpr} - INTERVAL '${pm} months')`);
//         }
//         const extraWhere = extraFilters.length > 0 ? 'AND ' + extraFilters.join(' AND ') : '';

//         // mp + the per-row product_snapshots LATERAL are ONLY referenced by the
//         // price filters. When no price filter is set (the dashboard/pre-warmer
//         // default), joining them runs a correlated snapshot lookup for EVERY
//         // review row across the whole table — millions of wasted lookups that
//         // turned this query into a multi-minute scan. Add the joins only when a
//         // price bound is actually present.
//         const needsPriceJoins = (price_min !== undefined && price_min !== '') || (price_max !== undefined && price_max !== '');
//         const priceJoins = needsPriceJoins ? `
//             LEFT JOIN masters.products mp
//                 ON mp.company_id = r.company_id
//                AND mp.product_external_id = r.web_pid
//                AND LOWER(mp.platform) = LOWER(r.platform)
//             LEFT JOIN LATERAL (
//                 SELECT ps2.price_rp, ps2.price_sp
//                 FROM ratings.product_snapshots ps2
//                 WHERE ps2.company_id = r.company_id AND UPPER(ps2.web_pid) = UPPER(r.web_pid)
//                   AND LOWER(ps2.platform) = LOWER(r.platform)
//                 ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
//                 LIMIT 1
//             ) ps ON true` : '';

//         const sql = `
//             SELECT
//                 TO_CHAR(r.review_date, 'YYYY-MM') AS month,
//                 r.sentiment_category AS category,
//                 COUNT(*) AS total,
//                 COUNT(*) FILTER (WHERE r.sentiment = 'Positive') AS positive,
//                 COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS negative,
//                 COUNT(*) FILTER (WHERE r.sentiment = 'Neutral') AS neutral,
//                 ROUND(AVG(r.rating)::numeric, 2) AS avg_rating
//             FROM ratings.reviews r
//             ${priceJoins}
//             WHERE r.company_id = $1 AND r.review_date IS NOT NULL
//               ${extraWhere}
//             GROUP BY month, r.sentiment_category
//             ORDER BY month, r.sentiment_category
//         `;
//         const { rows } = await pool.query(sql, params);

//         // Group by month
//         const monthMap = {};
//         rows.forEach(r => {
//             if (!monthMap[r.month]) {
//                 monthMap[r.month] = { month: r.month, categories: {}, totalReviews: 0, avgRating: 0 };
//             }
//             // NULL sentiment_category is unclassified — label it distinctly, not as the
//             // real "General" theme (recent months are ~100% NULL and would masquerade as General).
//             const cat = r.category || 'Uncategorized';
//             monthMap[r.month].categories[cat] = {
//                 positive: parseInt(r.positive),
//                 negative: parseInt(r.negative),
//                 neutral: parseInt(r.neutral),
//                 total: parseInt(r.total),
//             };
//             monthMap[r.month].totalReviews += parseInt(r.total);
//             // weighted avg
//             monthMap[r.month].avgRating += parseFloat(r.avg_rating || 0) * parseInt(r.total);
//         });

//         // Finalize avg
//         Object.values(monthMap).forEach(m => {
//             m.avgRating = m.totalReviews > 0 ? m.avgRating / m.totalReviews : 0;
//         });

//         const timeline = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
//         res.json({ timeline });
//     } catch (err) {
//         console.error('Timeline error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/competitor-matrix — Pre-calculated matrix aggregated metrics
// // ============================================================================
// // GET /api/ratings/rating-trend — daily rating/rating_count time-series for a single SKU.
// // Pulls one row per snapshot_date from ratings.product_snapshots. Useful once the
// // daily-snapshot sync has accumulated 2+ days; with one point we just show the dot.
// app.get('/api/ratings/rating-trend', async (req, res) => {
//     try {
//         const { web_pid, platform, days } = req.query;
//         if (!web_pid) return res.status(400).json({ error: 'web_pid param required' });
//         const daysClamped = Math.max(1, Math.min(parseInt(days, 10) || 180, 365));

//         const params = [req.companyId, String(web_pid)];
//         let platformClause = '';
//         if (platform && platform !== 'all') {
//             params.push(String(platform));
//             platformClause = `AND LOWER(platform) = LOWER($${params.length})`;
//         }

//         // Weekly bucket mode — reads ratings.weekly_rating_trend so callers get
//         // week-over-week deltas and a discontinuity flag instead of raw daily
//         // points. crosses_discontinuity = true means the delta spans a known
//         // measurement break (e.g. the source swap) and should be shown as a
//         // gap, not a real movement.
//         if (String(req.query.bucket) === 'week') {
//             const { rows: wrows } = await pool.query(`
//                 SELECT week_start, platform, rating, rating_count, review_count,
//                        prev_rating, prev_rating_count,
//                        rating_wow_delta, rating_count_wow_delta, crosses_discontinuity
//                 FROM ratings.weekly_rating_trend
//                 WHERE company_id = $1
//                   AND web_pid = $2
//                   ${platformClause}
//                   AND week_start >= (CURRENT_DATE - INTERVAL '${daysClamped} days')
//                 ORDER BY week_start ASC, platform ASC
//             `, params);
//             return res.json({
//                 bucket: 'week',
//                 points: wrows.map(r => ({
//                     week_start: r.week_start,
//                     platform: r.platform,
//                     rating: r.rating != null ? Number(r.rating) : null,
//                     rating_count: r.rating_count,
//                     review_count: r.review_count,
//                     prev_rating: r.prev_rating != null ? Number(r.prev_rating) : null,
//                     prev_rating_count: r.prev_rating_count,
//                     rating_wow_delta: r.rating_wow_delta != null ? Number(r.rating_wow_delta) : null,
//                     rating_count_wow_delta: r.rating_count_wow_delta,
//                     // Null out deltas that straddle a break so the UI shows a gap.
//                     crosses_discontinuity: r.crosses_discontinuity,
//                 })),
//             });
//         }

//         const { rows } = await pool.query(`
//             SELECT snapshot_date, platform,
//                    AVG(rating)::numeric(3,2)        AS rating,
//                    MAX(rating_count)::int           AS rating_count,
//                    MAX(review_count)::int           AS review_count,
//                    AVG(price_rp)::numeric(10,2)     AS price_rp,
//                    AVG(price_sp)::numeric(10,2)     AS price_sp
//             FROM ratings.product_snapshots
//             WHERE company_id = $1
//               AND web_pid = $2
//               ${platformClause}
//               AND snapshot_date >= CURRENT_DATE - INTERVAL '${daysClamped} days'
//             GROUP BY snapshot_date, platform
//             ORDER BY snapshot_date ASC, platform ASC
//         `, params);

//         res.json({
//             points: rows.map(r => ({
//                 date: r.snapshot_date,
//                 platform: r.platform,
//                 rating: r.rating != null ? Number(r.rating) : null,
//                 rating_count: r.rating_count,
//                 review_count: r.review_count,
//                 price_rp: r.price_rp != null ? Number(r.price_rp) : null,
//                 price_sp: r.price_sp != null ? Number(r.price_sp) : null,
//             })),
//         });
//     } catch (err) {
//         console.error('rating-trend error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// app.get('/api/ratings/competitor-matrix', async (req, res) => {
//     try {
//         const { platform, category, date_from, date_to, period_months } = req.query;
//         let where = ['company_id = $1'];
//         let params = [req.companyId];
//         let idx = 2;

//         if (platform && platform !== 'all') { where.push(`platform ILIKE $${idx++}`); params.push(platform); }
//         if (category) { where.push(`category ILIKE $${idx++}`); params.push(category); }
//         if (date_from) { where.push(`review_date >= $${idx++}`); params.push(date_from); }
//         if (date_to) { where.push(`review_date <= $${idx++}`); params.push(date_to); }
//         // Default 6-month window when no explicit dates — the Competition tab used
//         // to show ALL-TIME here (no date filter), so it never matched the exec's
//         // 6-month pull. Mirrors the window used by summary/category-health/etc.
//         if (!date_from && !date_to) {
//             const pm = Math.max(1, Math.min(parseInt(period_months, 10) || 6, 24));
//             where.push(`review_date >= CURRENT_DATE - INTERVAL '${pm} months'`);
//         }

//         const sql = `
//             SELECT
//                 INITCAP(LOWER(brand)) AS brand,
//                 is_competitor,
//                 COUNT(*) as total_reviews,
//                 ROUND(AVG(rating)::numeric, 2) as avg_rating,
//                 ROUND(AVG(quality_score)::numeric, 2) as avg_quality,
//                 category as primary_category
//             FROM ratings.reviews
//             WHERE ${where.join(' AND ')}
//             GROUP BY INITCAP(LOWER(brand)), is_competitor, category
//             ORDER BY total_reviews DESC
//             LIMIT 50
//         `;
        
//         const { rows } = await pool.query(sql, params);
//         res.json({ success: true, matrix: rows });
//     } catch (err) {
//         console.error('Competitor Matrix error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/product-health — Product health scores (server-side)
// // ============================================================================
// app.get('/api/ratings/product-health', async (req, res) => {
//     try {
//         const { category, pareto_status, web_pid, date_from, date_to, platform, period_months, price_mode, price_min, price_max, is_competitor, sentiment_category } = req.query;
//         const trendPeriod = Math.max(1, Math.min(parseInt(period_months) || 3, 24));
//         // Review-count window anchor. Standardized on CURRENT_DATE (rolling
//         // "last N months from today") so EVERY surface — header, category strip,
//         // governance cards, benchmark — reports the SAME number. A MAX(review_date)
//         // anchor pulled in a ~5.4K review cluster near the year boundary and made
//         // the strip/cards read ~26.5K while the header read ~21K.
//         const anchorDateExpr = 'CURRENT_DATE';

//         const params = [req.companyId];
//         let idx = 2;
//         const extraFilters = [];

//         if (is_competitor && is_competitor !== 'all') {
//             extraFilters.push(`COALESCE(r.is_competitor, false) = $${idx++}`);
//             params.push(is_competitor === 'true');
//         } else if (is_competitor === undefined || is_competitor === '') {
//             // Default to Prestige-only — competitor brands (e.g. iBELL) must not leak
//             // into "Growth Opportunities" / characteristic trends / product-health rankings.
//             extraFilters.push(`COALESCE(r.is_competitor, false) = false`);
//         }
//         if (platform && platform !== 'all') { extraFilters.push(`r.platform ILIKE $${idx++}`); params.push(platform); }
//         if (category) {
//             extraFilters.push(`COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE $${idx++}`);
//             params.push(category);
//         }
//         if (sentiment_category && sentiment_category !== 'all') {
//             extraFilters.push(`r.sentiment_category ILIKE $${idx++}`);
//             params.push(sentiment_category);
//         }
//         if (pareto_status) {
//             extraFilters.push(`COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, ''), NULLIF(r.pareto_status, '')) = $${idx++}`);
//             params.push(pareto_status);
//         }
//         if (web_pid) { extraFilters.push(`r.web_pid = $${idx++}`); params.push(web_pid); }
//         if (price_min !== undefined && price_min !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             extraFilters.push(`${priceExpr} >= $${idx++}`);
//             params.push(Number(price_min));
//         }
//         if (price_max !== undefined && price_max !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             extraFilters.push(`${priceExpr} <= $${idx++}`);
//             params.push(Number(price_max));
//         }
//         const extraWhere = extraFilters.length > 0 ? 'AND ' + extraFilters.join(' AND ') : '';
//         let recentPeriodFilter;
//         let priorPeriodFilter;
//         let combinedWindowFilter;

//         if (date_from && date_to) {
//             params.push(date_from, date_to);
//             const fromIdx = params.length - 1;
//             const toIdx = params.length;
//             const midpointExpr = `($${fromIdx}::date + ($${toIdx}::date - $${fromIdx}::date) / 2)`;
//             recentPeriodFilter = `r.review_date >= ${midpointExpr} AND r.review_date <= $${toIdx}::date`;
//             priorPeriodFilter = `r.review_date >= $${fromIdx}::date AND r.review_date < ${midpointExpr}`;
//             combinedWindowFilter = `AND r.review_date >= $${fromIdx}::date AND r.review_date <= $${toIdx}::date`;
//         } else {
//             const recentStartExpr = `${anchorDateExpr} - INTERVAL '${trendPeriod} months'`;
//             const priorStartExpr = `${anchorDateExpr} - INTERVAL '${trendPeriod * 2} months'`;
//             recentPeriodFilter = `r.review_date >= ${recentStartExpr}`;
//             priorPeriodFilter = `r.review_date >= ${priorStartExpr} AND r.review_date < ${recentStartExpr}`;
//             combinedWindowFilter = `AND r.review_date >= ${priorStartExpr}`;
//         }

//         const sql = `
//             WITH latest_snapshots AS (
//                 SELECT DISTINCT ON (web_pid)
//                     web_pid, price_rp, price_sp, category, pareto_status
//                 FROM ratings.product_snapshots
//                 WHERE company_id = $1
//                 ORDER BY web_pid, snapshot_date DESC, created_at DESC NULLS LAST
//             ),
//             product_stats AS (
//                 SELECT
//                     LEFT(r.product_name, 80) AS product,
//                     COUNT(*) AS total,
//                     COUNT(*) FILTER (WHERE r.sentiment = 'Positive') AS positive,
//                     COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS negative,
//                     COUNT(*) FILTER (WHERE r.sentiment = 'Neutral') AS neutral,
//                     COUNT(*) FILTER (WHERE ${recentPeriodFilter}) AS recent_total,
//                     COUNT(*) FILTER (WHERE ${recentPeriodFilter} AND r.sentiment = 'Negative') AS recent_neg,
//                     COUNT(*) FILTER (WHERE ${priorPeriodFilter}) AS older_total,
//                     COUNT(*) FILTER (WHERE ${priorPeriodFilter} AND r.sentiment = 'Negative') AS older_neg
//                 FROM ratings.reviews r
//                 LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
//                 LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid
//                 WHERE r.company_id = $1 AND r.product_name IS NOT NULL
//                   AND r.review_date IS NOT NULL
//                   ${combinedWindowFilter}
//                   ${extraWhere}
//                 GROUP BY LEFT(r.product_name, 80)
//                 HAVING COUNT(*) >= 10
//             )
//             SELECT
//                 product, total, positive, negative, neutral,
//                 recent_total, recent_neg, older_total, older_neg,
//                 CASE WHEN total > 0 THEN positive::float / total ELSE 0 END AS positive_rate,
//                 CASE WHEN total > 0 THEN negative::float / total ELSE 0 END AS negative_rate,
//                 ROUND((CASE WHEN total > 0 THEN (positive - negative)::float / total * 50 + 50 ELSE 50 END)::numeric, 0) AS health_score,
//                 CASE
//                     WHEN recent_total > 0 AND older_total > 0
//                          AND (recent_neg::float / recent_total - older_neg::float / older_total) > 0.05 THEN 'declining'
//                     WHEN recent_total > 0 AND older_total > 0
//                          AND (recent_neg::float / recent_total - older_neg::float / older_total) < -0.05 THEN 'improving'
//                     ELSE 'stable'
//                 END AS trend
//             FROM product_stats
//             ORDER BY total DESC
//             LIMIT 30
//         `;
//         const { rows } = await pool.query(sql, params);

//         // Also get monthly ratings per product (top 20 only)
//         const topProducts = rows.slice(0, 20).map(r => r.product);
//         let monthlyData = {};

//         if (topProducts.length > 0) {
//             // Monthly breakdown uses same base filters
//             const monthParams = [req.companyId, topProducts];
//             let mIdx = 3;
//             const monthFilters = [];
//             if (category) {
//                 monthFilters.push(`COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE $${mIdx++}`);
//                 monthParams.push(category);
//             }
//             if (pareto_status) {
//                 monthFilters.push(`COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, ''), NULLIF(r.pareto_status, '')) = $${mIdx++}`);
//                 monthParams.push(pareto_status);
//             }
//             if (date_from) { monthFilters.push(`r.review_date >= $${mIdx++}`); monthParams.push(date_from); }
//             if (date_to) { monthFilters.push(`r.review_date <= $${mIdx++}`); monthParams.push(date_to); }
//             if (price_min !== undefined && price_min !== '') {
//                 const priceExpr = price_mode === 'rp'
//                     ? 'COALESCE(ps.price_rp, mp.mrp)'
//                     : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//                 monthFilters.push(`${priceExpr} >= $${mIdx++}`);
//                 monthParams.push(Number(price_min));
//             }
//             if (price_max !== undefined && price_max !== '') {
//                 const priceExpr = price_mode === 'rp'
//                     ? 'COALESCE(ps.price_rp, mp.mrp)'
//                     : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//                 monthFilters.push(`${priceExpr} <= $${mIdx++}`);
//                 monthParams.push(Number(price_max));
//             }
//             const monthExtraWhere = monthFilters.length > 0 ? 'AND ' + monthFilters.join(' AND ') : '';

//             // mp + the per-row product_snapshots LATERAL feed ONLY the category/
//             // pareto/price filters. Without them the joins run a correlated
//             // snapshot lookup per review row for nothing — skip when unfiltered.
//             const monthPriceJoins = monthFilters.length > 0 ? `
//                 LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
//                 LEFT JOIN LATERAL (
//                     SELECT ps2.price_rp, ps2.price_sp, ps2.category, ps2.pareto_status
//                     FROM ratings.product_snapshots ps2
//                     WHERE ps2.company_id = r.company_id AND ps2.web_pid = r.web_pid
//                     ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
//                     LIMIT 1
//                 ) ps ON true` : '';

//             const monthSql = `
//                 SELECT
//                     LEFT(r.product_name, 80) AS product,
//                     TO_CHAR(r.review_date, 'YYYY-MM') AS month,
//                     ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
//                     COUNT(*) AS count
//                 FROM ratings.reviews r
//                 ${monthPriceJoins}
//                 WHERE r.company_id = $1
//                   ${is_competitor && is_competitor !== 'all' ? `AND r.is_competitor = ${is_competitor === 'true'}` : ''}
//                   AND LEFT(r.product_name, 80) = ANY($2)
//                   AND r.review_date IS NOT NULL
//                   ${monthExtraWhere}
//                 GROUP BY product, month
//                 ORDER BY product, month
//             `;
//             const { rows: mRows } = await pool.query(monthSql, monthParams);
//             mRows.forEach(r => {
//                 if (!monthlyData[r.product]) monthlyData[r.product] = [];
//                 monthlyData[r.product].push({
//                     month: r.month,
//                     avg: parseFloat(r.avg_rating),
//                     count: parseInt(r.count),
//                 });
//             });
//         }

//         const products = rows.map(r => ({
//             product: r.product,
//             healthScore: parseInt(r.health_score),
//             totalMentions: parseInt(r.total),
//             positiveRate: parseFloat(r.positive_rate),
//             negativeRate: parseFloat(r.negative_rate),
//             trend: r.trend,
//             monthlyRatings: (monthlyData[r.product] || []).slice(-12),
//         }));

//         res.json({ products });
//     } catch (err) {
//         console.error('Product health error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/category-health — Category-level KPIs for cards strip
// // ============================================================================
// app.get('/api/ratings/category-health', async (req, res) => {
//     try {
//         const { date_from, date_to, platform, period_months, price_mode, price_min, price_max, is_competitor, sentiment_category, category } = req.query;
//         const trendPeriod = parseInt(period_months) || 3;

//         // Build parameterized growth filter.
//         // When the user selects a date range, split it at the midpoint:
//         //   recent  = midpoint  → date_to   (second half of range)
//         //   prior   = date_from → midpoint  (first half of range)
//         // PostgreSQL: date - date = int (days); date + int = date — so /2 works.
//         const sqlParams = [req.companyId];
//         let currentScopeFilter, growthRangeFilter, recentFilter, priorFilter;
//         let platformFilter = '';
//         let snapshotPlatformFilter = '';
//         let reviewPriceFilter = '';
//         let snapshotPriceFilter = ''; // For 'ls' alias in cat_products
//         let competitorFilter = '';
//         let snapshotCompetitorFilter = '';
//         let sentimentCategoryFilter = '';

//         if (is_competitor === 'true' || is_competitor === 'false') {
//             competitorFilter = `AND COALESCE(r.is_competitor, false) = $${sqlParams.length + 1}`;
//             // For the SKU-count path (snap_cats / review_only_cats), require explicit mp.is_competitor
//             // match. Orphan rows with NULL is_competitor are EXCLUDED so the Prestige count doesn't
//             // inflate beyond the confirmed masters.products count.
//             snapshotCompetitorFilter = `AND mp.is_competitor = $${sqlParams.length + 1}`;
//             sqlParams.push(is_competitor === 'true');
//         } else if (is_competitor === 'all') {
//             competitorFilter = '';
//             snapshotCompetitorFilter = '';
//         } else {
//             // Default to Prestige — strict on the SKU-count path, lenient on review-side (so reviews
//             // without a masters mapping are still counted in totals).
//             competitorFilter = `AND COALESCE(r.is_competitor, false) = false`;
//             snapshotCompetitorFilter = `AND mp.is_competitor = false`;
//         }

//         if (sentiment_category && sentiment_category !== 'all') {
//             sentimentCategoryFilter = `AND r.sentiment_category ILIKE $${sqlParams.length + 1}`;
//             sqlParams.push(sentiment_category);
//         }

//         let categoryFilter = '';
//         let snapshotCategoryFilter = '';
//         if (category) {
//             categoryFilter = `AND COALESCE(NULLIF(ps_latest.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE $${sqlParams.length + 1}`;
//             snapshotCategoryFilter = `AND COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, '')) ILIKE $${sqlParams.length + 1}`;
//             sqlParams.push(category);
//         }

//         if (platform && platform !== 'all') {
//             platformFilter = `AND r.platform ILIKE $${sqlParams.length + 1}`;
//             snapshotPlatformFilter = `AND ls.platform ILIKE $${sqlParams.length + 1}`;
//             sqlParams.push(platform);
//         }

//         if (price_min !== undefined && price_min !== '') {
//             // cat_reviews: use pre-resolved prices from lateral join (resolved_price_sp/rp includes mp fallback)
//             const reviewPriceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps_latest.resolved_price_rp, mp.mrp)'
//                 : 'COALESCE(ps_latest.resolved_price_sp, mp.selling_price, mp.mop, ps_latest.resolved_price_rp, mp.mrp)';
//             // cat_products: ls is the inner DISTINCT ON snapshot, mp is outer join
//             const snapshotPriceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ls.price_rp, mp.mrp)'
//                 : 'COALESCE(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';

//             reviewPriceFilter += ` AND ${reviewPriceExpr} >= $${sqlParams.length + 1}`;
//             snapshotPriceFilter += ` AND ${snapshotPriceExpr} >= $${sqlParams.length + 1}`;
//             sqlParams.push(Number(price_min));
//         }
//         if (price_max !== undefined && price_max !== '') {
//             const reviewPriceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps_latest.resolved_price_rp, mp.mrp)'
//                 : 'COALESCE(ps_latest.resolved_price_sp, mp.selling_price, mp.mop, ps_latest.resolved_price_rp, mp.mrp)';
//             const snapshotPriceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ls.price_rp, mp.mrp)'
//                 : 'COALESCE(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';

//             reviewPriceFilter += ` AND ${reviewPriceExpr} <= $${sqlParams.length + 1}`;
//             snapshotPriceFilter += ` AND ${snapshotPriceExpr} <= $${sqlParams.length + 1}`;
//             sqlParams.push(Number(price_max));
//         }

//         // Get latest review date to anchor trends (prevents 0% trends when data is stale)
//         // Review-count window anchor. Standardized on CURRENT_DATE (rolling
//         // "last N months from today") so EVERY surface — header, category strip,
//         // governance cards, benchmark — reports the SAME number. A MAX(review_date)
//         // anchor pulled in a ~5.4K review cluster near the year boundary and made
//         // the strip/cards read ~26.5K while the header read ~21K.
//         const anchorDateExpr = 'CURRENT_DATE';

//         if (date_from && date_to) {
//             sqlParams.push(date_from, date_to);
//             const fromIdx = sqlParams.length - 1;
//             const toIdx = sqlParams.length;
//             currentScopeFilter = `AND r.review_date >= $${fromIdx}::date AND r.review_date <= $${toIdx}::date`;
//             growthRangeFilter = `AND r.review_date >= $${fromIdx}::date AND r.review_date <= $${toIdx}::date`;
//             recentFilter      = `AND r.review_date >= ($${fromIdx}::date + ($${toIdx}::date - $${fromIdx}::date) / 2) AND r.review_date <= $${toIdx}::date`;
//             priorFilter       = `AND r.review_date >= $${fromIdx}::date AND r.review_date <  ($${fromIdx}::date + ($${toIdx}::date - $${fromIdx}::date) / 2)`;
//         } else {
//             // Dynamic: use period_months from global filter (default 3) anchored to LATEST DATA
//             const lookbackMonths = trendPeriod * 2;
//             currentScopeFilter = `AND r.review_date >= (${anchorDateExpr} - INTERVAL '${trendPeriod} months')`;
//             growthRangeFilter = `AND r.review_date >= (${anchorDateExpr} - INTERVAL '${lookbackMonths} months')`;
//             recentFilter      = `AND r.review_date >= (${anchorDateExpr} - INTERVAL '${trendPeriod} months')`;
//             priorFilter       = `AND r.review_date >= (${anchorDateExpr} - INTERVAL '${lookbackMonths} months') AND r.review_date < (${anchorDateExpr} - INTERVAL '${trendPeriod} months')`;
//         }


//         const sql = `
//             WITH snap_cats AS (
//                 SELECT DISTINCT ON (ps.company_id, ps.web_pid)
//                     ps.web_pid,
//                     NULLIF(mp.sku_code, '') AS sku_code,
//                     COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) as raw_category,
//                     COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, '')) AS raw_pareto_status
//                 FROM ratings.product_snapshots ps
//                 LEFT JOIN masters.products mp ON mp.company_id = ps.company_id AND mp.product_external_id = ps.web_pid AND LOWER(mp.platform) = LOWER(ps.platform)
//                 WHERE ps.company_id = $1
//                   ${snapshotCompetitorFilter}
//                   ${snapshotPlatformFilter.replace('ls.', 'ps.')}
//                   AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) != ''
//                   AND ps.snapshot_date >= (${anchorDateExpr} - INTERVAL '${trendPeriod} months')
//                 ORDER BY ps.company_id, ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC
//             ),
//             review_only_cats AS (
//                 SELECT DISTINCT ON (r.web_pid)
//                     r.web_pid,
//                     NULLIF(mp.sku_code, '') AS sku_code,
//                     COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) as raw_category,
//                     COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(r.pareto_status, '')) AS raw_pareto_status
//                 FROM ratings.reviews r
//                 LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
//                 WHERE r.company_id = $1
//                   ${competitorFilter}
//                   ${platformFilter}
//                   AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) IS NOT NULL
//                   AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) != ''
//                   ${currentScopeFilter}
//                   AND NOT EXISTS (SELECT 1 FROM snap_cats sc WHERE sc.web_pid = r.web_pid)
//                 ORDER BY r.web_pid, r.review_date DESC
//             ),
//             sku_category_map AS (
//                 SELECT
//                     web_pid,
//                     sku_code,
//                     -- Canonical SKU: prefer masters.sku_code (one row per product across platforms),
//                     -- fall back to web_pid for unmapped products so they're still counted.
//                     COALESCE(sku_code, web_pid) AS canonical_sku,
//                     CASE
//                         WHEN TRIM(LOWER(raw_category)) IN ('other', 'others') THEN 'Others'
//                         ELSE INITCAP(TRIM(raw_category))
//                     END AS category,
//                     raw_pareto_status AS pareto_status
//                 FROM (
//                     SELECT web_pid, sku_code, raw_category, raw_pareto_status FROM snap_cats
//                     UNION ALL
//                     SELECT web_pid, sku_code, raw_category, raw_pareto_status FROM review_only_cats
//                 ) all_c
//             ),
//             cat_sku_counts AS (
//                 SELECT
//                     category,
//                     COUNT(DISTINCT canonical_sku) AS sku_count,
//                     COUNT(DISTINCT canonical_sku) FILTER (WHERE pareto_status = 'Pareto') AS pareto_count,
//                     COUNT(DISTINCT canonical_sku) FILTER (WHERE pareto_status IN ('Non-Pareto', 'Non-Pareto (Unclassified)') OR pareto_status IS NULL) AS non_pareto_count,
//                     COUNT(DISTINCT canonical_sku) FILTER (WHERE pareto_status = 'NPD') AS npd_count
//                 FROM sku_category_map
//                 WHERE 1=1
//                   ${snapshotCategoryFilter.replace("COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, ''))", "category")}
//                 GROUP BY 1
//             ),
//             cat_reviews AS (
//                 SELECT
//                     scm.category,
//                     COUNT(*) AS review_count,
//                     COUNT(DISTINCT r.web_pid) AS sku_count,
//                     ROUND(AVG(r.rating)::numeric, 2) AS avg_review_rating,
//                     ROUND(AVG(r.ml_inferred_rating)::numeric, 2) AS avg_ml_rating,
//                     COUNT(*) FILTER (WHERE r.sentiment = 'Positive') AS positive_count,
//                     COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS negative_count,
//                     COUNT(*) FILTER (WHERE r.sentiment = 'Neutral') AS neutral_count
//                 FROM ratings.reviews r
//                 JOIN sku_category_map scm ON scm.web_pid = r.web_pid
//                 WHERE r.company_id = $1
//                   ${competitorFilter}
//                   ${currentScopeFilter}
//                   ${platformFilter}
//                   ${sentimentCategoryFilter}
//                   ${categoryFilter.replace("COALESCE(NULLIF(ps_latest.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))", "scm.category")}
//                 GROUP BY 1
//             ),
//             cat_products AS (
//                 SELECT
//                     scm.category,
//                     SUM(ls.rating_count) AS total_ratings,
//                     ROUND(
//                         SUM(ls.rating * ls.rating_count) / NULLIF(SUM(ls.rating_count), 0)::numeric,
//                         2
//                     ) AS avg_platform_rating
//                 FROM sku_category_map scm
//                 JOIN (
//                     SELECT DISTINCT ON (ps.company_id, LOWER(ps.platform), ps.web_pid)
//                         ps.web_pid,
//                         ps.rating,
//                         ps.rating_count
//                     FROM ratings.product_snapshots ps
//                     WHERE ps.company_id = $1
//                     ORDER BY ps.company_id, LOWER(ps.platform), ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC
//                 ) ls ON ls.web_pid = scm.web_pid
//                 WHERE 1=1
//                   ${snapshotCategoryFilter.replace("COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, ''))", "scm.category")}
//                 GROUP BY 1
//             ),
//             cat_growth AS (
//                 SELECT
//                     scm.category,
//                     COUNT(*) FILTER (WHERE true ${recentFilter}) AS recent_count,
//                     COUNT(*) FILTER (WHERE true ${priorFilter}) AS prior_count,
//                     ROUND(AVG(r.rating) FILTER (WHERE true ${recentFilter})::numeric, 2) AS recent_avg_rating,
//                     ROUND(AVG(r.rating) FILTER (WHERE true ${priorFilter})::numeric, 2) AS prior_avg_rating
//                 FROM ratings.reviews r
//                 JOIN sku_category_map scm ON scm.web_pid = r.web_pid
//                 WHERE r.company_id = $1
//                   ${competitorFilter}
//                   ${growthRangeFilter}
//                   ${platformFilter}
//                   ${sentimentCategoryFilter}
//                   ${categoryFilter.replace("COALESCE(NULLIF(ps_latest.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))", "scm.category")}
//                 GROUP BY 1
//             ),
//             cat_catalogue AS (
//                 -- Authoritative CATALOGUE SKU count per category, straight from the
//                 -- master (same source as the governance cards + category dropdown).
//                 -- csc.sku_count above is the ACTIVE population (snapshot/review in
//                 -- window); this is the full listed catalogue, so the strip can show
//                 -- "X listed · Y active" instead of a bare active count.
//                 SELECT
//                     CASE WHEN TRIM(LOWER(mp.category)) IN ('other','others') THEN 'Others'
//                          ELSE INITCAP(TRIM(mp.category)) END AS category,
//                     COUNT(DISTINCT mp.product_external_id) AS catalogue_sku_count
//                 FROM masters.products mp
//                 WHERE mp.company_id = $1 AND mp.platform IS NOT NULL
//                   AND mp.category IS NOT NULL AND TRIM(mp.category) <> ''
//                   ${snapshotCompetitorFilter}
//                   ${snapshotPlatformFilter.replace(/ls\./g, 'mp.')}
//                   ${snapshotCategoryFilter.replace("COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, ''))", "mp.category")}
//                 GROUP BY 1
//             )
//             SELECT
//                 csc.category,
//                 COALESCE(cr.review_count, 0) AS review_count,
//                 csc.sku_count,
//                 COALESCE(cc.catalogue_sku_count, csc.sku_count) AS catalogue_sku_count,
//                 -- SKUs with a review in the window (same web_pid grain as the
//                 -- catalogue count) — the honest "with recent reviews" number.
//                 COALESCE(cr.sku_count, 0) AS review_sku_count,
//                 COALESCE(cr.avg_review_rating, 0) AS avg_review_rating,
//                 cr.avg_ml_rating,
//                 COALESCE(cr.positive_count, 0) AS positive_count,
//                 COALESCE(cr.negative_count, 0) AS negative_count,
//                 COALESCE(cr.neutral_count, 0) AS neutral_count,
//                 COALESCE(cp.total_ratings, 0) AS total_ratings,
//                 cp.avg_platform_rating,
//                 csc.pareto_count,
//                 csc.non_pareto_count,
//                 csc.npd_count,
//                 COALESCE(cg.recent_count, 0) AS recent_count,
//                 COALESCE(cg.prior_count, 0) AS prior_count,
//                 COALESCE(cg.recent_avg_rating, 0) AS recent_avg_rating,
//                 COALESCE(cg.prior_avg_rating, 0) AS prior_avg_rating
//             FROM cat_sku_counts csc
//             LEFT JOIN cat_products cp ON cp.category = csc.category
//             LEFT JOIN cat_reviews cr ON cr.category = csc.category
//             LEFT JOIN cat_growth cg ON cg.category = csc.category
//             LEFT JOIN cat_catalogue cc ON cc.category = csc.category
//             ORDER BY csc.sku_count DESC, COALESCE(cr.review_count, 0) DESC
//         `;
//         const { rows } = await pool.query(sql, sqlParams);


//         const categories = rows.map(r => {
//             const recent = parseInt(r.recent_count || 0);
//             const prior = parseInt(r.prior_count || 0);
//             const growthPct = prior > 0
//                 ? Math.round(((recent - prior) / prior) * 100)
//                 : (recent > 0 ? 100 : 0);

//             const recentRating = parseFloat(r.recent_avg_rating || 0);
//             const priorRating = parseFloat(r.prior_avg_rating || 0);
//             const ratingGrowthDiff = (recent > 0 && prior > 0)
//                 ? Math.round((recentRating - priorRating) * 100) / 100
//                 : 0;

//             return {
//                 category: r.category,
//                 reviewCount: parseInt(r.review_count),
//                 skuCount: parseInt(r.sku_count),
//                 catalogueSkuCount: parseInt(r.catalogue_sku_count || r.sku_count),
//                 reviewSkuCount: parseInt(r.review_sku_count || 0),
//                 avgReviewRating: parseFloat(r.avg_review_rating || 0),
//                 avgMlRating: r.avg_ml_rating ? parseFloat(r.avg_ml_rating) : null,
//                 positiveCount: parseInt(r.positive_count),
//                 negativeCount: parseInt(r.negative_count),
//                 neutralCount: parseInt(r.neutral_count),
//                 totalRatings: parseInt(r.total_ratings || 0),
//                 avgPlatformRating: r.avg_platform_rating ? parseFloat(r.avg_platform_rating) : null,
//                 paretoCount: parseInt(r.pareto_count || 0),
//                 nonParetoCount: parseInt(r.non_pareto_count || 0),
//                 npdCount: parseInt(r.npd_count || 0),
//                 growthPct,
//                 recentReviewCount: recent,
//                 priorReviewCount: prior,
//                 recentAvgRating: recentRating,
//                 priorAvgRating: priorRating,
//                 ratingGrowthDiff,
//             };
//         });

//         // -------------------------------------------------------------
//         // Calculate totals by aggregating category-level metrics to ensure perfect parity.
//         // Since each SKU is mapped to exactly one category (via DISTINCT ON), 
//         // the sum of category SKUs equals the total unique SKUs.
//         // -------------------------------------------------------------
//         const totalSkuCount = categories.reduce((sum, c) => sum + (c.skuCount || 0), 0);
//         const totalCatalogueSkuCount = categories.reduce((sum, c) => sum + (c.catalogueSkuCount || 0), 0);
//         const totalReviewSkuCount = categories.reduce((sum, c) => sum + (c.reviewSkuCount || 0), 0);
//         const totalReviewCount = categories.reduce((sum, c) => sum + (c.reviewCount || 0), 0);
//         const totalRatingsCount = categories.reduce((sum, c) => sum + (c.totalRatings || 0), 0);
//         const totalParetoCount = categories.reduce((sum, c) => sum + (c.paretoCount || 0), 0);
//         const totalNonParetoCount = categories.reduce((sum, c) => sum + (c.nonParetoCount || 0), 0);
//         const totalNpdCount = categories.reduce((sum, c) => sum + (c.npdCount || 0), 0);

//         const totalRecentReviewCount = categories.reduce((sum, c) => sum + (c.recentReviewCount || 0), 0);
//         const totalPriorReviewCount = categories.reduce((sum, c) => sum + (c.priorReviewCount || 0), 0);
        
//         const totalGrowthPct = totalPriorReviewCount > 0
//             ? Math.round(((totalRecentReviewCount - totalPriorReviewCount) / totalPriorReviewCount) * 100)
//             : (totalRecentReviewCount > 0 ? 100 : 0);

//         const totalAvgPlatformRating = totalRatingsCount > 0
//             ? categories.reduce((sum, c) => sum + (c.avgPlatformRating || 0) * (c.totalRatings || 0), 0) / totalRatingsCount
//             : 0;

//         const totalAvgReviewRating = totalReviewCount > 0
//             ? categories.reduce((sum, c) => sum + (c.avgReviewRating || 0) * (c.reviewCount || 0), 0) / totalReviewCount
//             : 0;
            
//         const totalPositiveCount = categories.reduce((sum, c) => sum + (c.positiveCount || 0), 0);
//         const totalNegativeCount = categories.reduce((sum, c) => sum + (c.negativeCount || 0), 0);
//         const totalNeutralCount = categories.reduce((sum, c) => sum + (c.neutralCount || 0), 0);


//         res.json({
//             categories,
//             total: {
//                 skuCount: totalSkuCount,
//                 catalogueSkuCount: totalCatalogueSkuCount,
//                 reviewSkuCount: totalReviewSkuCount,
//                 totalRatings: totalRatingsCount,
//                 reviewCount: totalReviewCount,
//                 paretoCount: totalParetoCount,
//                 nonParetoCount: totalNonParetoCount,
//                 npdCount: totalNpdCount
//             }
//         });
//     } catch (err) {
//         console.error('Category health error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/asin-issues — Issue types + RCA for a specific ASIN
// // ============================================================================
// app.get('/api/ratings/asin-issues', async (req, res) => {
//     try {
//         const { web_pid } = req.query;
//         if (!web_pid) return res.status(400).json({ error: 'web_pid param required' });

//         // Get product info
//         const productSql = `
//             SELECT product_name, rating AS pdp_rating, rating_count, star_distribution
//             FROM ratings.product_snapshots
//             WHERE company_id = $1 AND web_pid = $2 AND is_competitor = false
//             ORDER BY snapshot_date DESC LIMIT 1
//         `;
//         const { rows: productRows } = await pool.query(productSql, [req.companyId, web_pid]);
//         const product = productRows[0] || { product_name: 'Unknown', pdp_rating: null, rating_count: 0, star_distribution: {} };


//         // Get issue breakdown
//         const issuesSql = `
//             SELECT
//                 r.sentiment_category AS issue_category,
//                 r.sentiment_subcategory AS issue_type,
//                 r.specific_issue AS rca,
//                 COUNT(*) AS total_count,
//                 COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS negative_count,
//                 COUNT(*) FILTER (WHERE r.sentiment = 'Positive') AS positive_count,
//                 ROUND(AVG(r.rating)::numeric, 2) AS avg_rating
//             FROM ratings.reviews r
//             WHERE r.company_id = $1
//               AND r.web_pid = $2
//               AND r.is_competitor = false
//               AND r.sentiment_subcategory IS NOT NULL
//               AND r.sentiment_subcategory != ''
//             GROUP BY r.sentiment_category, r.sentiment_subcategory, r.specific_issue
//             ORDER BY negative_count DESC, total_count DESC
//         `;
//         const { rows: issueRows } = await pool.query(issuesSql, [req.companyId, web_pid]);

//         // Total reviews for this ASIN
//         const totalSql = `
//             SELECT
//                 COUNT(*) AS total,
//                 ROUND(AVG(rating)::numeric, 2) AS user_rating,
//                 ROUND(AVG(ml_inferred_rating)::numeric, 2) AS ml_rating
//             FROM ratings.reviews
//             WHERE company_id = $1 AND web_pid = $2 AND is_competitor = false
//         `;
//         const { rows: totalRows } = await pool.query(totalSql, [req.companyId, web_pid]);
//         const totalReviews = parseInt(totalRows[0]?.total || 0);

//         const issues = issueRows.map(r => ({
//             issueCategory: r.issue_category || 'General',
//             issueType: (r.issue_type || '').replace(/_/g, ' '),
//             issueTypeRaw: r.issue_type,
//             rca: r.rca || 'Not classified',
//             totalCount: parseInt(r.total_count),
//             negativeCount: parseInt(r.negative_count),
//             positiveCount: parseInt(r.positive_count),
//             avgRating: parseFloat(r.avg_rating),
//             pctOfTotal: totalReviews > 0 ? Math.round((parseInt(r.total_count) / totalReviews) * 100) : 0,
//         }));

//         // AI Distribution mapping
//         const aiDistSql = `
//             SELECT 
//                 CASE 
//                     WHEN quality_score <= 2 THEN '1'
//                     WHEN quality_score <= 4 THEN '2'
//                     WHEN quality_score <= 6 THEN '3'
//                     WHEN quality_score <= 8 THEN '4'
//                     ELSE '5' 
//                 END AS ai_star,
//                 COUNT(*) as count
//             FROM ratings.reviews
//             WHERE company_id = $1 AND web_pid = $2 AND is_competitor = false AND quality_score IS NOT NULL
//             GROUP BY CASE 
//                 WHEN quality_score <= 2 THEN '1'
//                 WHEN quality_score <= 4 THEN '2'
//                 WHEN quality_score <= 6 THEN '3'
//                 WHEN quality_score <= 8 THEN '4'
//                 ELSE '5' 
//             END
//         `;
//         const { rows: aiDistRows } = await pool.query(aiDistSql, [req.companyId, web_pid]);
//         const aiDistribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
//         let totalAiCount = 0;
//         let aiSum = 0;
//         aiDistRows.forEach(row => {
//             aiDistribution[row.ai_star] = parseInt(row.count);
//             totalAiCount += parseInt(row.count);
//             aiSum += parseInt(row.count) * parseInt(row.ai_star);
//         });
//         const aiAvg = totalAiCount > 0 ? aiSum / totalAiCount : null;
        
//         let discrepancyFlag = false;
//         // high discrepancy fake review detection
//         if (product.pdp_rating && parseFloat(product.pdp_rating) >= 4.0 && aiAvg !== null && aiAvg < 3.0) {
//             discrepancyFlag = true;
//         }

//         const platformDistributionStr = product.star_distribution || {};
//         const platformDistribution = typeof platformDistributionStr === 'string' ? JSON.parse(platformDistributionStr) : platformDistributionStr;

//         res.json({
//             webPid: web_pid,
//             productName: product.product_name,
//             pdpRating: product.pdp_rating ? parseFloat(product.pdp_rating) : null,
//             userRating: totalRows[0]?.user_rating ? parseFloat(totalRows[0].user_rating) : null,
//             mlRating: totalRows[0]?.ml_rating ? parseFloat(totalRows[0].ml_rating) : null,
//             ratingCount: parseInt(product.rating_count || 0),
//             totalReviews,
//             issues,
//             platformDistribution,
//             aiDistribution,
//             discrepancyFlag
//         });
//     } catch (err) {
//         console.error('ASIN issues error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/executive-health — Pareto/Non-Pareto/NPD → NP/Issue/NI
// // ============================================================================
// app.get('/api/ratings/executive-health', async (req, res) => {
//     try {
//         const {
//             category: filterCategory,
//             pareto_status: filterParetoStatus,
//             rating_bifurcation,
//             platform,
//             period_months,
//             date_from,
//             date_to,
//             price_mode,
//             price_min,
//             price_max,
//             is_competitor,
//             sentiment_category,
//         } = req.query;
//         const trendPeriod = parseInt(period_months) || 3;

//         // Review-count window anchor. Standardized on CURRENT_DATE (rolling
//         // "last N months from today") so EVERY surface — header, category strip,
//         // governance cards, benchmark — reports the SAME number. A MAX(review_date)
//         // anchor pulled in a ~5.4K review cluster near the year boundary and made
//         // the strip/cards read ~26.5K while the header read ~21K.
//         const anchorDateExpr = 'CURRENT_DATE';

//         const params = [req.companyId];
//         let latestSnapshotFilters = '';
//         let categoryFilter = '';
//         let ratingFilter = '';
//         let paretoFilter = '';
//         let priceFilter = '';
//         let reviewScopeFilter = '';
//         let recentReviewFilter = '';
//         let priorReviewFilter = '';
//         let competitorFilter = '';
//         let sentimentCategoryFilter = '';

//         if (is_competitor === 'true' || is_competitor === 'false') {
//             competitorFilter = `AND COALESCE(is_competitor, false) = $${params.length + 1}`;
//             params.push(is_competitor === 'true');
//         } else if (is_competitor === 'all') {
//             competitorFilter = '';
//         } else {
//             // Default to Prestige
//             competitorFilter = `AND COALESCE(is_competitor, false) = false`;
//         }
//         // Apply aliases for CTEs
//         const snapshotCompetitorFilter = competitorFilter
//             .replace('COALESCE(is_competitor', 'COALESCE(ps.is_competitor, mp.is_competitor');
//         const reviewCompetitorFilter = competitorFilter
//             .replace('COALESCE(is_competitor', 'COALESCE(r.is_competitor');
//         // For the master-catalogue scope (NPD/Pareto counts must reflect the full
//         // catalogue, not just SKUs reviewed/snapshotted in the window).
//         const masterCompetitorFilter = competitorFilter
//             .replace('COALESCE(is_competitor', 'COALESCE(mp.is_competitor');
//         let masterPlatformFilter = '';
//         let masterCategoryFilter = '';

//         if (sentiment_category && sentiment_category !== 'all') {
//             sentimentCategoryFilter = `AND r.sentiment_category ILIKE $${params.length + 1}`;
//             params.push(sentiment_category);
//         }

//         if (platform && platform !== 'all') {
//             params.push(platform);
//             latestSnapshotFilters += ` AND ps.platform ILIKE $${params.length}`;
//             reviewScopeFilter += ` AND r.platform ILIKE $${params.length}`;
//             masterPlatformFilter += ` AND mp.platform ILIKE $${params.length}`;
//         }

//         if (date_from && date_to) {
//             params.push(date_from, date_to);
//             const fromIdx = params.length - 1;
//             const toIdx = params.length;
//             reviewScopeFilter += ` AND r.review_date >= $${fromIdx}::date AND r.review_date <= $${toIdx}::date`;
//             recentReviewFilter = `r.review_date >= ($${fromIdx}::date + ($${toIdx}::date - $${fromIdx}::date) / 2) AND r.review_date <= $${toIdx}::date`;
//             priorReviewFilter = `r.review_date >= $${fromIdx}::date AND r.review_date < ($${fromIdx}::date + ($${toIdx}::date - $${fromIdx}::date) / 2)`;
//         } else {
//             // Dynamic: use period_months from global filter (default 3) anchored to LATEST DATA
//             const lookbackMonths = trendPeriod * 2;
//             reviewScopeFilter += ` AND r.review_date >= (${anchorDateExpr} - INTERVAL '${trendPeriod} months')`;
//             recentReviewFilter = `r.review_date >= (${anchorDateExpr} - INTERVAL '${trendPeriod} months')`;
//             priorReviewFilter = `r.review_date >= (${anchorDateExpr} - INTERVAL '${lookbackMonths} months') AND r.review_date < (${anchorDateExpr} - INTERVAL '${trendPeriod} months')`;
//         }
//         const reviewJoinFilter = reviewScopeFilter.replaceAll('r.', 'r2.');

//         if (filterCategory) {
//             params.push(filterCategory);
//             const catIdx = params.length;
//             latestSnapshotFilters += ` AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) ILIKE $${catIdx}`;
//             reviewScopeFilter += ` AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE $${catIdx}`;
//             masterCategoryFilter += ` AND COALESCE(NULLIF(mp.category, ''), '') ILIKE $${catIdx}`;
//         }

//         if (rating_bifurcation === 'NP') {
//             ratingFilter = `AND ls.rating >= 4.2`;
//         } else if (rating_bifurcation === 'Issue') {
//             ratingFilter = `AND ls.rating < 4.0`;
//         } else if (rating_bifurcation === 'NI') {
//             ratingFilter = `AND ls.rating >= 4.0 AND ls.rating < 4.2`;
//         }

//         if (filterParetoStatus) {
//             params.push(filterParetoStatus);
//             paretoFilter = `AND COALESCE(mp.pareto_status, ls.pareto_status) = $${params.length}`;
//         }

//         if (price_min !== undefined && price_min !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ls.price_rp, mp.mrp)'
//                 : 'COALESCE(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';
//             params.push(Number(price_min));
//             priceFilter += ` AND ${priceExpr} >= $${params.length}`;
//         }
//         if (price_max !== undefined && price_max !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ls.price_rp, mp.mrp)'
//                 : 'COALESCE(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';
//             params.push(Number(price_max));
//             priceFilter += ` AND ${priceExpr} <= $${params.length}`;
//         }

//         const sql = `
//               WITH all_snapshot_pids AS (
//                   SELECT DISTINCT ps.web_pid
//                   FROM ratings.product_snapshots ps
//                   LEFT JOIN masters.products mp
//                     ON mp.company_id = ps.company_id
//                    AND mp.product_external_id = ps.web_pid
//                    AND LOWER(mp.platform) = LOWER(ps.platform)
//                   WHERE ps.company_id = $1
//                     ${snapshotCompetitorFilter}
//                     AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) != ''
//                     AND ps.snapshot_date >= (${anchorDateExpr} - INTERVAL '${trendPeriod} months')
//               ),
//               latest_snapshots AS (
//                   SELECT DISTINCT ON (ps.web_pid)
//                       ps.web_pid,
//                       LOWER(ps.platform) AS platform_key,
//                       ps.product_name,
//                       ps.rating,
//                       ps.rating_count,
//                       ps.price_rp,
//                     ps.price_sp,
//                     ps.pareto_status,
//                     ps.category,
//                     ps.star_distribution
//                   FROM ratings.product_snapshots ps
//                   LEFT JOIN masters.products mp
//                     ON mp.company_id = ps.company_id
//                    AND mp.product_external_id = ps.web_pid
//                    AND LOWER(mp.platform) = LOWER(ps.platform)
//                   WHERE ps.company_id = $1
//                     ${snapshotCompetitorFilter}
//                     AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) != ''
//                     AND ps.snapshot_date >= (${anchorDateExpr} - INTERVAL '${trendPeriod} months')
//                     ${latestSnapshotFilters}
//                   ORDER BY ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
//               ),
//               review_stats AS (
//                   SELECT DISTINCT ON (r.web_pid)
//                        r.web_pid,
//                        MAX(LOWER(r.platform)) AS platform_key,
//                        MAX(r.product_name) AS review_product_name,
//                        COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(r.pareto_status, '')) AS pareto_status,
//                        MAX(CASE
//                         WHEN TRIM(LOWER(COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')))) IN ('other', 'others') THEN 'Others'
//                         ELSE INITCAP(TRIM(COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, ''))))
//                       END) AS resolved_category,
//                       ROUND(AVG(r.rating)::numeric, 2) AS scoped_avg_rating,
//                     ROUND(AVG(r.rating) FILTER (WHERE ${recentReviewFilter})::numeric, 2) AS recent_avg_rating,
//                     ROUND(AVG(r.rating) FILTER (WHERE ${priorReviewFilter})::numeric, 2) AS older_avg_rating,
//                     COUNT(*) AS total_reviews,
//                     MAX(r.review_date) AS latest_review_date,
//                     COUNT(*) FILTER (WHERE ${recentReviewFilter}) AS recent_review_count,
//                     COUNT(*) FILTER (WHERE ${priorReviewFilter}) AS older_review_count
//                 FROM ratings.reviews r
//                 LEFT JOIN masters.products mp
//                     ON mp.company_id = r.company_id
//                    AND mp.product_external_id = r.web_pid
//                    AND LOWER(mp.platform) = LOWER(r.platform)
//                   WHERE r.company_id = $1
//                     ${reviewCompetitorFilter}
//                     AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) IS NOT NULL
//                     AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) != ''
//                     ${reviewScopeFilter}
//                     ${sentimentCategoryFilter}
//                   GROUP BY r.web_pid, mp.pareto_status, r.pareto_status
//               ),
//               sku_scope AS (
//                   -- Snapshot SKUs (category-authoritative)
//                   SELECT web_pid FROM latest_snapshots
//                   UNION
//                   -- Review-only SKUs: reviews in this category but NO recent snapshot in ANY category
//                   -- Uses all_snapshot_pids (unfiltered) so products with snapshots in other
//                   -- categories are excluded — matching category-health's logic exactly
//                   SELECT web_pid FROM review_stats
//                   WHERE NOT EXISTS (
//                       SELECT 1 FROM all_snapshot_pids asp WHERE asp.web_pid = review_stats.web_pid
//                   )
//               ),
//               product_health AS (
//                   SELECT
//                       ss.web_pid,
//                       COALESCE(ls.product_name, rs.review_product_name, ss.web_pid) AS product_name,
//                     ls.rating AS pdp_rating,
//                     ls.rating_count,
//                     ls.price_rp,
//                     ls.price_sp,
//                     COALESCE(mp.pareto_status, ls.pareto_status, rs.pareto_status) AS pareto_status,
//                     COALESCE(NULLIF(ls.category, ''), NULLIF(rs.resolved_category, ''), NULLIF(mp.category, '')) AS category,
//                     mp.subcategory AS subcategory_l1,
//                     mp.business_segment,
//                     COALESCE((ls.star_distribution->>'1')::numeric, 0) / NULLIF(ls.rating_count, 0) AS one_star_pct,
//                     rs.scoped_avg_rating,
//                     ROUND(AVG(r2.ml_inferred_rating)::numeric, 2) AS scoped_ml_rating,
//                     rs.recent_avg_rating,
//                     rs.older_avg_rating,
//                     COALESCE(rs.total_reviews, 0) AS total_reviews,
//                     rs.latest_review_date,
//                     COALESCE(rs.recent_review_count, 0) AS recent_review_count,
//                     COALESCE(rs.older_review_count, 0) AS older_review_count
//                   FROM sku_scope ss
//                   LEFT JOIN latest_snapshots ls ON ls.web_pid = ss.web_pid
//                   LEFT JOIN masters.products mp
//                       ON mp.company_id = $1
//                      AND mp.product_external_id = ss.web_pid
//                      AND LOWER(mp.platform) = ls.platform_key
//                   LEFT JOIN review_stats rs ON rs.web_pid = ss.web_pid
//                   LEFT JOIN ratings.reviews r2
//                       ON r2.company_id = $1
//                      AND r2.web_pid = ss.web_pid
//                      AND LOWER(r2.platform) = COALESCE(ls.platform_key, rs.platform_key)
//                      ${reviewCompetitorFilter.replace('r.', 'r2.')}
//                      ${reviewJoinFilter}
//                 WHERE 1=1
//                   /* Category filter applied in CTEs */
//                   ${ratingFilter}
//                   ${paretoFilter}
//                   ${priceFilter}
//                 GROUP BY
//                     ss.web_pid,
//                     ls.product_name,
//                     ls.rating,
//                     ls.rating_count,
//                     ls.price_rp,
//                     ls.price_sp,
//                     mp.pareto_status,
//                     ls.pareto_status,
//                     rs.pareto_status,
//                     ls.category,
//                     rs.resolved_category,
//                     rs.review_product_name,
//                     mp.category,
//                     mp.subcategory,
//                     mp.business_segment,
//                     ls.star_distribution,
//                     rs.scoped_avg_rating,
//                     rs.recent_avg_rating,
//                     rs.older_avg_rating,
//                     rs.total_reviews,
//                     rs.latest_review_date,
//                     rs.recent_review_count,
//                     rs.older_review_count
//             )
//             SELECT *,
//                 CASE
//                     WHEN one_star_pct > 0.15 THEN 'Critical'
//                     WHEN pdp_rating >= 4.2 THEN 'NP'
//                     WHEN pdp_rating < 4.0 THEN 'Issue'
//                     WHEN pdp_rating IS NULL THEN 'NI'
//                     ELSE 'NI'
//                 END AS health_status
//             FROM product_health
//             ORDER BY pdp_rating ASC NULLS LAST
//         `;
//         const { rows } = await pool.query(sql, params);

//         // Normalize pareto_status into 3 buckets
//         // Unclassified = not in master catalog → club with Non-Pareto
//         const classifyPareto = (status) => {
//             if (status === 'Pareto') return 'Pareto';
//             if (status === 'NPD') return 'NPD';
//             // Everything else (Non-Pareto, Non-Pareto (Unclassified), NULL/missing) → Non-Pareto
//             return 'Non-Pareto';
//         };

//         // Deduplicate by web_pid — a SKU may appear once per platform in the SQL result.
//         // Keep the row with the highest-priority pareto_status (Pareto > NPD > Non-Pareto)
//         // so each web_pid lands in exactly one bucket, matching the category-health SKU count.
//         const paretoPriority = (status) => {
//             if (status === 'Pareto') return 3;
//             if (status === 'NPD') return 2;
//             return 1;
//         };
//         const dedupedMap = new Map();
//         for (const r of rows) {
//             const existing = dedupedMap.get(r.web_pid);
//             if (!existing || paretoPriority(r.pareto_status) > paretoPriority(existing.pareto_status)) {
//                 dedupedMap.set(r.web_pid, r);
//             }
//         }
//         const dedupedRows = Array.from(dedupedMap.values());

//         // Build nested structure: pareto_bucket → health_status → SKUs
//         const buckets = { Pareto: {}, 'Non-Pareto': {}, NPD: {} };
//         dedupedRows.forEach(r => {
//             const bucket = classifyPareto(r.pareto_status);
//             const status = r.health_status;
//             if (!buckets[bucket][status]) buckets[bucket][status] = [];

//             // Compute trend direction for sorting
//             const recent = r.recent_avg_rating ? parseFloat(r.recent_avg_rating) : null;
//             const older = r.older_avg_rating ? parseFloat(r.older_avg_rating) : null;
//             let trend_direction = 'stable';
//             if (recent !== null && older !== null) {
//                 if (recent > older + 0.1) trend_direction = 'up';
//                 else if (recent < older - 0.1) trend_direction = 'down';
//             }

//             buckets[bucket][status].push({
//                 web_pid: r.web_pid,
//                 product_name: r.product_name,
//                 pdp_rating: r.pdp_rating ? parseFloat(r.pdp_rating) : null,
//                 rating_count: parseInt(r.rating_count || 0),
//                 price_rp: r.price_rp ? parseFloat(r.price_rp) : null,
//                 price_sp: r.price_sp ? parseFloat(r.price_sp) : null,
//                 category: r.category || 'Uncategorized',
//                 ml_rating: r.scoped_ml_rating ? parseFloat(r.scoped_ml_rating) : null,
//                 recent_avg_rating: recent,
//                 older_avg_rating: older,
//                 trend_direction,
//                 total_reviews: parseInt(r.total_reviews || 0),
//                 user_rating: r.scoped_avg_rating ? parseFloat(r.scoped_avg_rating) : null,
//                 ml_rating: r.scoped_ml_rating ? parseFloat(r.scoped_ml_rating) : null,
//                 latest_review_date: r.latest_review_date || null,
//                 recent_review_count: parseInt(r.recent_review_count || 0),
//                 older_review_count: parseInt(r.older_review_count || 0),
//             });
//         });

//         const computeGroupKpis = (skus) => {
//             const totalRatings = skus.reduce((sum, s) => sum + (s.rating_count || 0), 0);
//             const totalReviewCount = skus.reduce((sum, s) => sum + (s.total_reviews || 0), 0);
//             const ratedSkus = skus.filter(s => s.pdp_rating !== null);
//             const weightedSum = ratedSkus.reduce((sum, s) => sum + (s.pdp_rating * (s.rating_count || 1)), 0);
//             const weightedDenom = ratedSkus.reduce((sum, s) => sum + (s.rating_count || 1), 0);
//             const avgPlatformRating = weightedDenom > 0 ? Math.round((weightedSum / weightedDenom) * 100) / 100 : null;
//             const reviewWeightedSum = skus.reduce((sum, s) => sum + ((s.user_rating || 0) * (s.total_reviews || 0)), 0);
//             const mlWeightedSum = skus.reduce((sum, s) => sum + ((s.ml_rating || 0) * (s.total_reviews || 0)), 0);
//             const reviewWeightedDenom = skus.reduce((sum, s) => sum + (s.user_rating !== null && s.user_rating !== undefined ? (s.total_reviews || 0) : 0), 0);
//             const mlWeightedDenom = skus.reduce((sum, s) => sum + (s.ml_rating !== null && s.ml_rating !== undefined ? (s.total_reviews || 0) : 0), 0);
//             const userRating = reviewWeightedDenom > 0 ? Math.round((reviewWeightedSum / reviewWeightedDenom) * 100) / 100 : null;
//             const mlRating = mlWeightedDenom > 0 ? Math.round((mlWeightedSum / mlWeightedDenom) * 100) / 100 : null;
//             // pdpHealthRate: % of SKUs with platform rating >= 4.0 (quality signal, NOT review growth)
//             const aboveThreshold = ratedSkus.filter(s => s.pdp_rating >= 4.0).length;
//             const pdpHealthRate = ratedSkus.length > 0 ? Math.round((aboveThreshold / ratedSkus.length) * 100) : 0;
//             // reviewGrowthPct: last-3M reviews vs prior-3M reviews (same method as category-health strip)
//             const recentTotal = skus.reduce((sum, s) => sum + (s.recent_review_count || 0), 0);
//             const olderTotal  = skus.reduce((sum, s) => sum + (s.older_review_count  || 0), 0);
//             const reviewGrowthPct = olderTotal > 0
//                 ? Math.round(((recentTotal - olderTotal) / olderTotal) * 100)
//                 : (recentTotal > 0 ? 100 : 0);

//             // Compute rating average growth (difference)
//             const recentSumRating = skus.reduce((sum, s) => sum + ((s.recent_avg_rating || 0) * (s.recent_review_count || 0)), 0);
//             const olderSumRating = skus.reduce((sum, s) => sum + ((s.older_avg_rating || 0) * (s.older_review_count || 0)), 0);
//             const recentAvgRating = recentTotal > 0 ? Math.round((recentSumRating / recentTotal) * 100) / 100 : null;
//             const olderAvgRating = olderTotal > 0 ? Math.round((olderSumRating / olderTotal) * 100) / 100 : null;
//             const ratingGrowthDiff = (recentAvgRating !== null && olderAvgRating !== null)
//                 ? Math.round((recentAvgRating - olderAvgRating) * 100) / 100
//                 : 0;

//             return { totalRatings, totalReviewCount, avgPlatformRating, userRating, mlRating, pdpHealthRate, reviewGrowthPct, recentReviewCount: recentTotal, olderReviewCount: olderTotal, ratingGrowthDiff, recentAvgRating, olderAvgRating };
//         };

//         const formatBucket = (name, data) => {
//             const np = data['NP'] || [];
//             const issue = data['Issue'] || [];
//             const ni = data['NI'] || [];
//             const critical = data['Critical'] || [];
//             const allSkus = [...np, ...issue, ...ni, ...critical];
//             const bucketKpis = computeGroupKpis(allSkus);
//             const npKpis = computeGroupKpis(np);
//             const issueKpis = computeGroupKpis(issue);
//             const niKpis = computeGroupKpis(ni);
//             const criticalKpis = computeGroupKpis(critical);
//             const uniqueSkusCount = new Set(allSkus.map(s => s.web_pid)).size;
//             return {
//                 name,
//                 total: uniqueSkusCount,
//                 totalRatings: bucketKpis.totalRatings,
//                 totalReviewCount: bucketKpis.totalReviewCount,
//                 avgPlatformRating: bucketKpis.avgPlatformRating,
//                 userRating: bucketKpis.userRating,
//                 mlRating: bucketKpis.mlRating,
//                 pdpHealthRate: bucketKpis.pdpHealthRate,
//                 reviewGrowthPct: bucketKpis.reviewGrowthPct,
//                 recentReviewCount: bucketKpis.recentReviewCount,
//                 olderReviewCount: bucketKpis.olderReviewCount,
//                 ratingGrowthDiff: bucketKpis.ratingGrowthDiff,
//                 recentAvgRating: bucketKpis.recentAvgRating,
//                 olderAvgRating: bucketKpis.olderAvgRating,
//                 // keep positiveRate as alias for backwards compat
//                 positiveRate: bucketKpis.pdpHealthRate,
//                 np: { count: np.length, skus: np, ...npKpis },
//                 issue: { count: issue.length, skus: issue, ...issueKpis },
//                 ni: { count: ni.length, skus: ni, ...niKpis },
//                 critical: { count: critical.length, skus: critical, ...criticalKpis },
//             };
//         };

//         // Ensure total matches the sum of unique SKUs across all buckets to prevent display discrepancies
//         const allBucketSkus = new Set();
//         [...buckets['Pareto'].NI || [], ...buckets['Pareto'].Issue || [], ...buckets['Pareto'].NP || [], ...buckets['Pareto'].Critical || [],
//          ...buckets['Non-Pareto'].NI || [], ...buckets['Non-Pareto'].Issue || [], ...buckets['Non-Pareto'].NP || [], ...buckets['Non-Pareto'].Critical || [],
//          ...buckets['NPD'].NI || [], ...buckets['NPD'].Issue || [], ...buckets['NPD'].NP || [], ...buckets['NPD'].Critical || []]
//          .forEach(s => allBucketSkus.add(s.web_pid));

//         // Authoritative catalogue SKU counts from the master (NOT gated by review/
//         // snapshot activity) — so NPD/Pareto/Non-Pareto totals match the catalogue.
//         // NPD products are new and often have no reviews yet; the review-scoped
//         // buckets above undercount them. These give the true catalogue denominator.
//         const catalogueCounts = { Pareto: 0, 'Non-Pareto': 0, NPD: 0 };
//         try {
//             // IMPORTANT: build a DEDICATED param list for this query. Reusing the
//             // main `params` array breaks the bind: `params` accumulates date /
//             // price / sentiment / pareto placeholders that this query never
//             // references, so Postgres rejects it ("bind message supplies N
//             // parameters, but prepared statement requires M") and the counts
//             // silently fall back to 0 for every filter combination that carries a
//             // date range or price band. Only the columns this query actually uses
//             // (company, competitor, platform, category) are bound here.
//             const catParams = [req.companyId];
//             let cCompetitor = '', cPlatform = '', cCategory = '';
//             if (is_competitor === 'true' || is_competitor === 'false') {
//                 catParams.push(is_competitor === 'true');
//                 cCompetitor = ` AND COALESCE(mp.is_competitor, false) = $${catParams.length}`;
//             } else if (is_competitor !== 'all') {
//                 cCompetitor = ` AND COALESCE(mp.is_competitor, false) = false`;
//             }
//             if (platform && platform !== 'all') {
//                 catParams.push(platform);
//                 cPlatform = ` AND mp.platform ILIKE $${catParams.length}`;
//             }
//             if (filterCategory) {
//                 catParams.push(filterCategory);
//                 cCategory = ` AND COALESCE(NULLIF(mp.category, ''), '') ILIKE $${catParams.length}`;
//             }
//             const { rows: catRows } = await pool.query(`
//                 SELECT CASE WHEN pareto_status = 'Pareto' THEN 'Pareto'
//                             WHEN pareto_status = 'NPD' THEN 'NPD'
//                             ELSE 'Non-Pareto' END AS bucket,
//                        count(DISTINCT product_external_id) AS skus
//                 FROM masters.products mp
//                 WHERE mp.company_id = $1 ${cCompetitor}
//                   AND mp.platform IS NOT NULL
//                   ${cPlatform} ${cCategory}
//                 GROUP BY 1
//             `, catParams);
//             catRows.forEach(r => { catalogueCounts[r.bucket] = parseInt(r.skus); });
//         } catch (e) { console.error('catalogue count error:', e.message); }

//         // Reviews per pareto bucket over the FULL windowed review set (NOT the
//         // active SKU scope), resolved with the SAME snapshot-first category and
//         // pareto logic as the summary header — so Pareto + Non-Pareto + NPD equals
//         // the header/strip total under EVERY filter combination (platform,
//         // category, …), not just the default view. Using review.category alone
//         // over-counted a category filter (e.g. review.category='Cookware' rows
//         // whose latest snapshot says 'Other Cookware' were wrongly counted as
//         // Cookware). Dedicated param list — never reuse `params` (bind footgun).
//         const paretoReviewCounts = { Pareto: 0, 'Non-Pareto': 0, NPD: 0 };
//         try {
//             const prParams = [req.companyId];
//             let prWhere = 'r.company_id = $1';
//             if (is_competitor === 'true' || is_competitor === 'false') {
//                 prParams.push(is_competitor === 'true');
//                 prWhere += ` AND COALESCE(r.is_competitor, false) = $${prParams.length}`;
//             } else if (is_competitor !== 'all') {
//                 prWhere += ` AND COALESCE(r.is_competitor, false) = false`;
//             }
//             if (platform && platform !== 'all') { prParams.push(platform); prWhere += ` AND r.platform ILIKE $${prParams.length}`; }
//             if (date_from && date_to) {
//                 prParams.push(date_from, date_to);
//                 prWhere += ` AND r.review_date >= $${prParams.length - 1}::date AND r.review_date <= $${prParams.length}::date`;
//             } else {
//                 prWhere += ` AND r.review_date >= (${anchorDateExpr} - INTERVAL '${trendPeriod} months')`;
//             }
//             // Category filter applies to the RESOLVED (snapshot-first) category —
//             // exactly like the header — so it counts the same reviews the header does.
//             let prCatClause = '';
//             if (filterCategory) { prParams.push(filterCategory); prCatClause = ` WHERE TRIM(rev.resolved_category) ILIKE $${prParams.length}`; }
//             const { rows: prRows } = await pool.query(`
//                 WITH latest_snapshots AS (
//                     SELECT DISTINCT ON (ps.web_pid, LOWER(ps.platform))
//                         ps.web_pid, ps.platform, ps.category, ps.pareto_status
//                     FROM ratings.product_snapshots ps
//                     WHERE ps.company_id = $1
//                     ORDER BY ps.web_pid, LOWER(ps.platform), ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
//                 ),
//                 rev AS (
//                     SELECT
//                         COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ls.pareto_status, ''), NULLIF(r.pareto_status, '')) AS resolved_pareto,
//                         CASE WHEN TRIM(LOWER(COALESCE(NULLIF(ls.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')))) IN ('other', 'others') THEN 'Others'
//                              ELSE INITCAP(TRIM(COALESCE(NULLIF(ls.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')))) END AS resolved_category
//                     FROM ratings.reviews r
//                     LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
//                     LEFT JOIN latest_snapshots ls ON ls.web_pid = r.web_pid AND LOWER(ls.platform) = LOWER(r.platform)
//                     WHERE ${prWhere}
//                 )
//                 SELECT CASE WHEN resolved_pareto = 'Pareto' THEN 'Pareto'
//                             WHEN resolved_pareto = 'NPD' THEN 'NPD'
//                             ELSE 'Non-Pareto' END AS bucket,
//                        count(*) AS reviews
//                 FROM rev${prCatClause}
//                 GROUP BY 1
//             `, prParams);
//             prRows.forEach(x => { paretoReviewCounts[x.bucket] = parseInt(x.reviews); });
//         } catch (e) { console.error('pareto review count error:', e.message); }

//         const pareto = formatBucket('Pareto', buckets['Pareto']);
//         const nonPareto = formatBucket('Non-Pareto', buckets['Non-Pareto']);
//         const npd = formatBucket('NPD', buckets['NPD']);
//         // Override the active-scope review count with the full windowed per-bucket
//         // count so the three cards sum to the header/strip total.
//         pareto.totalReviewCount = paretoReviewCounts['Pareto'];
//         nonPareto.totalReviewCount = paretoReviewCounts['Non-Pareto'];
//         npd.totalReviewCount = paretoReviewCounts['NPD'];
//         // catalogueTotal = full-catalogue SKU count for the bucket; total = SKUs
//         // with review/snapshot activity in the window (the health breakdown).
//         pareto.catalogueTotal = catalogueCounts['Pareto'];
//         nonPareto.catalogueTotal = catalogueCounts['Non-Pareto'];
//         npd.catalogueTotal = catalogueCounts['NPD'];

//         res.json({
//             pareto, nonPareto, npd,
//             total: allBucketSkus.size || dedupedRows.length,
//             catalogueCounts,
//             catalogueTotal: catalogueCounts['Pareto'] + catalogueCounts['Non-Pareto'] + catalogueCounts['NPD'],
//         });
//     } catch (err) {
//         console.error('Executive health error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/issues-breakdown — NLP issues grid (replaces stakeholder-summary)
// // ============================================================================
// app.get('/api/ratings/issues-breakdown', async (req, res) => {
//     try {
//         const { category: filterCategory, pareto_status: filterParetoStatus, rating_bifurcation, platform, date_from, date_to, period_months, price_mode, price_min, price_max, is_competitor, sentiment_category } = req.query;

//         // Anchor the default window to the latest DATA date (not CURRENT_DATE) so
//         // this tab reconciles with /category-health beside it when ingestion lags.
//         // Review-count window anchor. Standardized on CURRENT_DATE (rolling
//         // "last N months from today") so EVERY surface — header, category strip,
//         // governance cards, benchmark — reports the SAME number. A MAX(review_date)
//         // anchor pulled in a ~5.4K review cluster near the year boundary and made
//         // the strip/cards read ~26.5K while the header read ~21K.
//         const anchorDateExpr = 'CURRENT_DATE';
//         const params = [req.companyId];
//         let categoryFilter = '';
//         let paretoFilter = '';
//         let ratingFilter = '';
//         let platformFilter = '';
//         let dateFilter = '';
//         let priceFilter = '';
//         let competitorFilter = '';
//         let sentimentCategoryFilter = '';

//         if (is_competitor === 'true' || is_competitor === 'false') {
//             competitorFilter = `AND COALESCE(r.is_competitor, mp.is_competitor, false) = $${params.length + 1}`;
//             params.push(is_competitor === 'true');
//         } else if (is_competitor === 'all') {
//             competitorFilter = '';
//         } else {
//             // Default to Prestige
//             competitorFilter = `AND COALESCE(r.is_competitor, mp.is_competitor, false) = false`;
//         }

//         if (sentiment_category && sentiment_category !== 'all') {
//             sentimentCategoryFilter = `AND r.sentiment_category ILIKE $${params.length + 1}`;
//             params.push(sentiment_category);
//         }

//         if (platform && platform !== 'all') {
//             params.push(platform);
//             platformFilter = `AND r.platform ILIKE $${params.length}`;
//         }
//         if (date_from) {
//             params.push(date_from);
//             dateFilter += ` AND r.review_date >= $${params.length}`;
//         }
//         if (date_to) {
//             params.push(date_to);
//             dateFilter += ` AND r.review_date <= $${params.length}`;
//         }
//         // No explicit range → default window (was previously an all-time scan,
//         // inconsistent with /category-health on the same tab).
//         if (!date_from && !date_to) {
//             const pm = Math.max(1, Math.min(parseInt(period_months) || 6, 24));
//             dateFilter += ` AND r.review_date >= (${anchorDateExpr} - INTERVAL '${pm} months')`;
//         }

//         if (filterCategory) {
//             params.push(filterCategory);
//             categoryFilter = `AND TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))) ILIKE $${params.length}`;
//         }
//         if (filterParetoStatus) {
//             if (filterParetoStatus === 'Non-Pareto') {
//                 paretoFilter = `AND (COALESCE(mp.pareto_status, ps.pareto_status, r.pareto_status) NOT IN ('Pareto', 'NPD') OR COALESCE(mp.pareto_status, ps.pareto_status, r.pareto_status) IS NULL)`;
//             } else {
//                 params.push(filterParetoStatus);
//                 paretoFilter = `AND COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, ''), NULLIF(r.pareto_status, '')) = $${params.length}`;
//             }
//         }
//         if (rating_bifurcation === 'NP') {
//             ratingFilter = `AND ps.rating >= 4.2`;
//         } else if (rating_bifurcation === 'Issue') {
//             ratingFilter = `AND ps.rating < 4.0`;
//         } else if (rating_bifurcation === 'NI') {
//             ratingFilter = `AND ps.rating >= 4.0 AND ps.rating < 4.2`;
//         }
//         if (price_min !== undefined && price_min !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             params.push(Number(price_min));
//             priceFilter += ` AND ${priceExpr} >= $${params.length}`;
//         }
//         if (price_max !== undefined && price_max !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             params.push(Number(price_max));
//             priceFilter += ` AND ${priceExpr} <= $${params.length}`;
//         }

//         // Fetch subcategories for mapping config
//         const mappingResult = await pool.query(
//             `SELECT sentiment_subcategory, display_label, stakeholder FROM ratings.stakeholder_mappings WHERE company_id = $1`,
//             [req.companyId]
//         );
//         const mappingMap = {};
//         mappingResult.rows.forEach(r => { mappingMap[r.sentiment_subcategory] = { label: r.display_label, stakeholder: r.stakeholder }; });

//         // The per-row product_snapshots LATERAL (ps) feeds ONLY the category/
//         // pareto/rating/price filters. When none are set (the dashboard/pre-warm
//         // default) it ran a correlated snapshot lookup for every review row for
//         // nothing. Skip it then. mp stays — the competitor fallback needs it.
//         const needsSnapshotJoin = !!(filterCategory || filterParetoStatus || rating_bifurcation
//             || (price_min !== undefined && price_min !== '') || (price_max !== undefined && price_max !== ''));
//         const snapshotJoin = needsSnapshotJoin ? `
//             LEFT JOIN LATERAL (
//                 SELECT
//                     ps2.price_rp,
//                     ps2.price_sp,
//                     ps2.category,
//                     ps2.pareto_status,
//                     ps2.rating
//                 FROM ratings.product_snapshots ps2
//                 WHERE ps2.company_id = r.company_id
//                   AND ps2.web_pid = r.web_pid
//                   AND LOWER(ps2.platform) = LOWER(r.platform)
//                 ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
//                 LIMIT 1
//             ) ps ON true` : '';

//         const sql = `
//             SELECT
//                 r.sentiment_subcategory,
//                 COUNT(*) AS total_count,
//                 COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS negative_count,
//                 COUNT(DISTINCT r.web_pid) AS sku_count,
//                 ROUND(AVG(r.rating)::numeric, 2) AS avg_rating
//             FROM ratings.reviews r
//             LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
//             ${snapshotJoin}
//             WHERE r.company_id = $1
//               ${competitorFilter}
//               AND r.sentiment_subcategory IS NOT NULL
//               AND r.sentiment_subcategory != ''
//               -- Exclude the General_Feedback sink: it's the "no specific aspect"
//               -- bucket, not an actionable issue, and otherwise dominates the ranking.
//               AND r.sentiment_subcategory != 'General_Feedback'
//               ${categoryFilter}
//               ${paretoFilter}
//               ${ratingFilter}
//               ${platformFilter}
//               ${dateFilter}
//               ${priceFilter}
//               ${competitorFilter}
//               ${sentimentCategoryFilter}
//             GROUP BY r.sentiment_subcategory
//             ORDER BY negative_count DESC
//         `;

//         const { rows } = await pool.query(sql, params);
        
//         const issues = rows.map(r => ({
//             subcategory: r.sentiment_subcategory,
//             label: mappingMap[r.sentiment_subcategory]?.label || r.sentiment_subcategory.replace(/_/g, ' '),
//             stakeholder: mappingMap[r.sentiment_subcategory]?.stakeholder || null,
//             negativeCount: parseInt(r.negative_count),
//             totalCount: parseInt(r.total_count),
//             skuCount: parseInt(r.sku_count),
//             avgRating: parseFloat(r.avg_rating),
//         }));

//         res.json({ issues, totalIssues: issues.length });
//     } catch (err) {
//         console.error('Issues breakdown error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/issue-detail — SKUs affected by a specific NLP issue
// // ============================================================================
// app.get('/api/ratings/issue-detail', async (req, res) => {
//     try {
//         const { subcategory } = req.query;
//         if (!subcategory) return res.status(400).json({ error: 'subcategory param required' });

//         const sql = `
//             SELECT
//                 r.web_pid,
//                 r.product_name,
//                 MAX(r.pdp_rating) AS pdp_rating,
//                 COUNT(*) AS review_count,
//                 COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS negative_count,
//                 ROUND(AVG(r.rating)::numeric, 2) AS avg_review_rating
//             FROM ratings.reviews r
//             WHERE r.company_id = $1
//               AND r.sentiment_subcategory = $2
//               AND (CASE 
//                 WHEN $3 = 'true' THEN r.is_competitor = true
//                 WHEN $3 = 'false' THEN r.is_competitor = false
//                 ELSE true
//               END)
//             GROUP BY r.web_pid, r.product_name
//             ORDER BY negative_count DESC
//             LIMIT 200
//         `;
//         const { is_competitor = 'false' } = req.query;
//         const { rows } = await pool.query(sql, [req.companyId, subcategory, is_competitor]);

//         const products = rows.map(r => ({
//             web_pid: r.web_pid,
//             product_name: r.product_name,
//             pdp_rating: r.pdp_rating ? parseFloat(r.pdp_rating) : null,
//             reviewCount: parseInt(r.review_count),
//             negativeCount: parseInt(r.negative_count),
//             avgReviewRating: parseFloat(r.avg_review_rating),
//         }));

//         res.json({ subcategory, products, total: products.length });
//     } catch (err) {
//         console.error('Issue detail error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/reviews-by-issue — Fetch actual reviews for a specific issue
// // ============================================================================
// app.get('/api/ratings/reviews-by-issue', async (req, res) => {
//     try {
//         const { web_pid, subcategory, limit = 50, offset = 0, sort = 'rating_asc', date_from, date_to, is_competitor = 'false' } = req.query;
//         if (!web_pid || !subcategory) return res.status(400).json({ error: 'web_pid and subcategory required' });

//         let orderClause = 'ORDER BY r.review_date DESC NULLS LAST';
//         if (sort === 'rating_asc') orderClause = 'ORDER BY r.rating ASC, r.review_date DESC NULLS LAST';
//         else if (sort === 'rating_desc') orderClause = 'ORDER BY r.rating DESC, r.review_date DESC NULLS LAST';

//         const params = [req.companyId, web_pid, subcategory, parseInt(limit), parseInt(offset), is_competitor];
//         let dateFilterMain = '';
//         if (date_from) {
//             params.push(date_from);
//             dateFilterMain += ` AND r.review_date >= $${params.length}`;
//         }
//         if (date_to) {
//             params.push(date_to);
//             dateFilterMain += ` AND r.review_date <= $${params.length}`;
//         }

//         const sql = `
//             SELECT
//                 r.id, r.rating, r.review_title, r.review_text, r.review_date,
//                 r.reviewer_name, r.is_verified_purchase, r.sentiment,
//                 r.sentiment_subcategory, r.specific_issue,
//                 r.sentiment_score, r.quality_score,
//                 r.product_name, r.pdp_rating,
//                 mua.id as ml_audit_id, mua.ml_sentiment, mua.ml_issue, mua.ml_category
//             FROM ratings.reviews r
//             LEFT JOIN ratings.reviews_ml_audit mua ON mua.review_id = r.id AND mua.company_id = r.company_id
//             WHERE r.company_id = $1
//               AND r.web_pid = $2
//               AND r.sentiment_subcategory = $3
//               ${dateFilterMain}
//               AND (CASE
//                 WHEN $6 = 'true' THEN r.is_competitor = true
//                 WHEN $6 = 'false' THEN r.is_competitor = false
//                 ELSE true
//               END)
//             ${orderClause}
//             LIMIT $4 OFFSET $5
//         `;
//         const { rows } = await pool.query(sql, params);

//         // Count query uses a DIFFERENT params array (no limit/offset), so rebuild the date filter
//         // with positions matching countParams ($5, $6) — reusing dateFilterMain's $7/$8 placeholders
//         // would crash with "could not determine parameter $7" and hide all reviews behind a 500.
//         const countParams = [req.companyId, web_pid, subcategory, is_competitor];
//         let dateFilterCount = '';
//         if (date_from) {
//             countParams.push(date_from);
//             dateFilterCount += ` AND r.review_date >= $${countParams.length}`;
//         }
//         if (date_to) {
//             countParams.push(date_to);
//             dateFilterCount += ` AND r.review_date <= $${countParams.length}`;
//         }

//         const countSql = `
//             SELECT COUNT(*) FROM ratings.reviews r
//             WHERE r.company_id = $1 AND r.web_pid = $2
//               AND r.sentiment_subcategory = $3
//               ${dateFilterCount}
//               AND (CASE
//                 WHEN $4 = 'true' THEN r.is_competitor = true
//                 WHEN $4 = 'false' THEN r.is_competitor = false
//                 ELSE true
//               END)
//         `;

//         const { rows: countRows } = await pool.query(countSql, countParams);

//         res.json({
//             reviews: rows,
//             total: parseInt(countRows[0].count),
//             limit,
//             offset,
//         });
//     } catch (err) {
//         console.error('Reviews by issue error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/stakeholder-detail — Issues + SKUs for a specific stakeholder
// // ============================================================================
// // NOTE: Stakeholder mappings come from DB table ratings.stakeholder_mappings (config-driven, multi-tenant)
// app.get('/api/ratings/stakeholder-detail', async (req, res) => {
//     try {
//         const { stakeholder, category: filterCategory, pareto_status: filterParetoStatus, rating_bifurcation, platform, date_from, date_to, price_mode, price_min, price_max, sentiment_category } = req.query;
//         if (!stakeholder) return res.status(400).json({ error: 'stakeholder param required' });

//         const mappingResult = await pool.query(
//             `SELECT sentiment_subcategory, display_label FROM ratings.stakeholder_mappings 
//              WHERE company_id = $1 AND stakeholder = $2 ORDER BY sort_order`,
//             [req.companyId, stakeholder]
//         );
//         const subcategories = mappingResult.rows.map(r => r.sentiment_subcategory);
//         const labelMap = {};
//         mappingResult.rows.forEach(r => { labelMap[r.sentiment_subcategory] = r.display_label; });

//         if (subcategories.length === 0) return res.json({ issues: [] });

//         const params = [req.companyId, ...subcategories];
//         const subPlaceholders = subcategories.map((_, i) => `$${i + 2}`).join(',');

//         let categoryFilter = '';
//         let paretoFilter = '';
//         let ratingFilter = '';
//         let platformFilter = '';
//         let dateFilter = '';
//         let priceFilter = '';
//         let sentimentCategoryFilter = '';

//         if (sentiment_category && sentiment_category !== 'all') {
//             params.push(sentiment_category);
//             sentimentCategoryFilter = `AND r.sentiment_category ILIKE $${params.length}`;
//         }

//         if (platform && platform !== 'all') {
//             params.push(platform);
//             platformFilter = `AND r.platform ILIKE $${params.length}`;
//         }
//         if (date_from) {
//             params.push(date_from);
//             dateFilter += ` AND r.review_date >= $${params.length}`;
//         }
//         if (date_to) {
//             params.push(date_to);
//             dateFilter += ` AND r.review_date <= $${params.length}`;
//         }
//         if (filterCategory) {
//             params.push(filterCategory);
//             categoryFilter = `AND TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))) ILIKE $${params.length}`;
//         }
//         if (filterParetoStatus) {
//             if (filterParetoStatus === 'Non-Pareto') {
//                 paretoFilter = `AND (COALESCE(mp.pareto_status, ps.pareto_status, r.pareto_status) NOT IN ('Pareto', 'NPD') OR COALESCE(mp.pareto_status, ps.pareto_status, r.pareto_status) IS NULL)`;
//             } else {
//                 params.push(filterParetoStatus);
//                 paretoFilter = `AND COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, ''), NULLIF(r.pareto_status, '')) = $${params.length}`;
//             }
//         }
//         if (rating_bifurcation === 'NP') {
//             ratingFilter = `AND ps.rating >= 4.2`;
//         } else if (rating_bifurcation === 'Issue') {
//             ratingFilter = `AND ps.rating < 4.0`;
//         } else if (rating_bifurcation === 'NI') {
//             ratingFilter = `AND ps.rating >= 4.0 AND ps.rating < 4.2`;
//         }
//         if (price_min !== undefined && price_min !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             params.push(Number(price_min));
//             priceFilter += ` AND ${priceExpr} >= $${params.length}`;
//         }
//         if (price_max !== undefined && price_max !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             params.push(Number(price_max));
//             priceFilter += ` AND ${priceExpr} <= $${params.length}`;
//         }

//         const sql = `
//             WITH latest_snapshots AS (
//                 SELECT DISTINCT ON (web_pid, LOWER(platform))
//                     web_pid, platform, price_rp, price_sp, category, pareto_status, rating
//                 FROM ratings.product_snapshots
//                 WHERE company_id = $1
//                 ORDER BY web_pid, LOWER(platform), snapshot_date DESC, created_at DESC NULLS LAST
//             ),
//             sku_issues AS (
//                 SELECT
//                     r.sentiment_subcategory,
//                     r.web_pid,
//                     MAX(r.product_name) AS product_name,
//                     MAX(ps.rating) AS pdp_rating,
//                     COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS neg_count,
//                     COUNT(*) AS total_count
//                 FROM ratings.reviews r
//                 LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
//                 LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND LOWER(ps.platform) = LOWER(r.platform)
//                 WHERE r.company_id = $1
//                   AND (CASE
//                     WHEN $${params.length + 1} = 'true' THEN r.is_competitor = true
//                     WHEN $${params.length + 1} = 'false' THEN r.is_competitor = false
//                     ELSE true
//                   END)
//                   AND r.sentiment_subcategory IN (${subPlaceholders})
//                   ${categoryFilter}
//                   ${paretoFilter}
//                   ${ratingFilter}
//                   ${platformFilter}
//                   ${dateFilter}
//                   ${priceFilter}
//                   ${sentimentCategoryFilter}
//                 GROUP BY r.sentiment_subcategory, r.web_pid
//             )
//             SELECT
//                 sentiment_subcategory,
//                 SUM(neg_count)::int AS negative_count,
//                 SUM(total_count)::int AS total_count,
//                 COUNT(DISTINCT web_pid)::int AS sku_count,
//                 json_agg(json_build_object(
//                     'web_pid', web_pid,
//                     'product_name', product_name,
//                     'pdp_rating', pdp_rating,
//                     'negCount', neg_count,
//                     'totalCount', total_count
//                 ) ORDER BY neg_count DESC) AS skus
//             FROM sku_issues
//             GROUP BY sentiment_subcategory
//             ORDER BY SUM(neg_count) DESC
//         `;

//         const { is_competitor = 'false' } = req.query;
//         params.push(is_competitor);
//         const { rows } = await pool.query(sql, params);
//         const issues = rows.map(r => ({
//             subcategory: r.sentiment_subcategory,
//             label: labelMap[r.sentiment_subcategory] || r.sentiment_subcategory.replace(/_/g, ' '),
//             negativeCount: r.negative_count,
//             totalCount: r.total_count,
//             skuCount: r.sku_count,
//             skus: r.skus.map(s => ({
//                 web_pid: s.web_pid,
//                 product_name: s.product_name,
//                 pdp_rating: s.pdp_rating ? parseFloat(s.pdp_rating) : null,
//                 negCount: parseInt(s.negCount),
//                 totalCount: parseInt(s.totalCount),
//             })),
//         }));
        
//         const uniqueSkuCount = new Set(
//             issues.flatMap(issue => issue.skus.map(sku => sku.web_pid)).filter(Boolean)
//         ).size;

//         res.json({ issues, uniqueSkuCount });
//     } catch (err) {
//         console.error('Stakeholder detail error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });


// // ============================================================================
// // GET /api/ratings/sku-list — Filtered SKU list for dropdown (drill-down aware)
// // Params: category, pareto_status, rating_bifurcation (NP/Issue/NI), platform
// // ============================================================================
// app.get('/api/ratings/sku-list', async (req, res) => {
//     try {
//         const { category, pareto_status, rating_bifurcation, platform, price_mode, price_min, price_max } = req.query;

//         const params = [req.companyId];
//         const filters = [];

//         // Category filter via reviews join
//         if (category) {
//             params.push(category);
//             filters.push(`EXISTS (
//                 SELECT 1 FROM ratings.reviews rv
//                 LEFT JOIN masters.products mp2
//                     ON mp2.company_id = rv.company_id
//                    AND mp2.product_external_id = rv.web_pid
//                    AND LOWER(mp2.platform) = LOWER(rv.platform)
//                 LEFT JOIN LATERAL (
//                     SELECT ps3.category
//                     FROM ratings.product_snapshots ps3
//                     WHERE ps3.company_id = rv.company_id
//                       AND ps3.web_pid = rv.web_pid
//                       AND LOWER(ps3.platform) = LOWER(rv.platform)
//                     ORDER BY ps3.snapshot_date DESC, ps3.created_at DESC NULLS LAST
//                     LIMIT 1
//                 ) snap ON true
//                 WHERE rv.company_id = ps.company_id AND rv.web_pid = ps.web_pid
//                   AND LOWER(rv.platform) = LOWER(ps.platform)
//                   -- rv is already tied to this exact SKU (web_pid+platform), whose
//                   -- reviews all share its scope — the hardcoded is_competitor=false
//                   -- wrongly dropped competitor SKUs under a category filter.
//                   AND LOWER(TRIM(COALESCE(NULLIF(snap.category, ''), NULLIF(mp2.category, ''), NULLIF(rv.category, '')))) = LOWER(TRIM($${params.length}))
//             )`);
//         }

//         // Pareto status filter (Pareto / Non-Pareto / NPD)
//         if (pareto_status) {
//             if (pareto_status === 'Non-Pareto') {
//                 // Non-Pareto includes: Non-Pareto, Non-Pareto (Unclassified), NULL
//                 filters.push(`(COALESCE(mp.pareto_status, ps.pareto_status) NOT IN ('Pareto', 'NPD') OR COALESCE(mp.pareto_status, ps.pareto_status) IS NULL)`);
//             } else {
//                 params.push(pareto_status);
//                 filters.push(`COALESCE(mp.pareto_status, ps.pareto_status) = $${params.length}`);
//             }
//         }

//         // Rating bifurcation filter on PDP rating
//         if (rating_bifurcation === 'NP') {
//             filters.push(`ps.rating >= 4.2`);
//         } else if (rating_bifurcation === 'Issue') {
//             filters.push(`ps.rating < 4.0`);
//         } else if (rating_bifurcation === 'NI') {
//             filters.push(`ps.rating >= 4.0 AND ps.rating < 4.2`);
//         }

//         // Platform filter
//         if (platform && platform !== 'all') {
//             params.push(platform);
//             filters.push(`ps.platform ILIKE $${params.length}`);
//         }
//         if (price_min !== undefined && price_min !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             params.push(Number(price_min));
//             filters.push(`${priceExpr} >= $${params.length}`);
//         }
//         if (price_max !== undefined && price_max !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             params.push(Number(price_max));
//             filters.push(`${priceExpr} <= $${params.length}`);
//         }

//         const whereClause = filters.length > 0 ? 'AND ' + filters.join(' AND ') : '';

//         // Direct category guard on the snapshot/product row to prevent cross-category leakage
//         // Append category as a separate param for the main query guard
//         let categoryGuard = '';
//         if (category) {
//             params.push(category);
//             categoryGuard = `AND LOWER(TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''), NULLIF(mp.master_category, '')))) = LOWER(TRIM($${params.length}))`;
//         }

//         const sql = `
//             SELECT
//                 ps.web_pid,
//                 COALESCE(NULLIF(TRIM(mp.product_name), ''), NULLIF(TRIM(ps.product_name), ''), ps.web_pid) AS product_name,
//                 ps.rating                                    AS pdp_rating,
//                 COALESCE(mp.pareto_status, ps.pareto_status) AS pareto_status,
//                 COALESCE(ps.price_rp, mp.mrp)               AS price_rp,
//                 COALESCE(ps.price_sp, mp.selling_price, mp.mop) AS price_sp,
//                 (
//                     SELECT COUNT(*) FROM ratings.reviews rv
//                     WHERE rv.company_id = ps.company_id AND rv.web_pid = ps.web_pid
//                       AND (CASE 
//                         WHEN $${params.length + 1} = 'true' THEN rv.is_competitor = true
//                         WHEN $${params.length + 1} = 'false' THEN rv.is_competitor = false
//                         ELSE true
//                       END)
//                 ) AS review_count
//             FROM ratings.product_snapshots ps
//             LEFT JOIN masters.products mp
//                 ON mp.company_id = ps.company_id
//                AND mp.product_external_id = ps.web_pid
//                AND LOWER(mp.platform) = LOWER(ps.platform)
//             WHERE ps.company_id = $1
//               AND (CASE 
//                 WHEN $${params.length + 1} = 'true' THEN ps.is_competitor = true
//                 WHEN $${params.length + 1} = 'false' THEN ps.is_competitor = false
//                 ELSE true
//               END)
//               AND ps.snapshot_date = (
//                   SELECT MAX(snapshot_date) FROM ratings.product_snapshots
//                   WHERE company_id = $1
//                     AND web_pid = ps.web_pid
//                     AND LOWER(platform) = LOWER(ps.platform)
//                     AND (CASE 
//                       WHEN $${params.length + 1} = 'true' THEN is_competitor = true
//                       WHEN $${params.length + 1} = 'false' THEN is_competitor = false
//                       ELSE true
//                     END)
//               )
//               ${whereClause}
//               ${categoryGuard}
//             ORDER BY review_count DESC, ps.product_name
//             LIMIT 500
//         `;

//         const { is_competitor = 'false' } = req.query;
//         params.push(is_competitor);
//         const { rows } = await pool.query(sql, params);
//         const skus = rows.map(r => ({
//             web_pid: r.web_pid,
//             product_name: r.product_name,
//             pdp_rating: r.pdp_rating ? parseFloat(r.pdp_rating) : null,
//             pareto_status: r.pareto_status || null,
//             review_count: parseInt(r.review_count || 0),
//         }));

//         res.json({ skus, total: skus.length });
//     } catch (err) {
//         console.error('SKU list error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // CATEGORY RULES CRUD
// // ============================================================================
// app.get('/api/ratings/category-rules', async (req, res) => {
//     try {
//         const { rows } = await pool.query(`
//             SELECT id, category, include_keywords, exclude_keywords, priority, spec_type
//             FROM ratings.category_rules 
//             WHERE company_id = $1 ORDER BY priority ASC, id ASC
//         `, [req.companyId]);
//         res.json({ rules: rows });
//     } catch (err) {
//         console.error('Fetch category-rules error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// app.post('/api/ratings/category-rules', async (req, res) => {
//     try {
//         const { category, include_keywords, exclude_keywords, priority } = req.body;
//         const sql = `
//             INSERT INTO ratings.category_rules (company_id, category, include_keywords, exclude_keywords, priority)
//             VALUES ($1, $2, $3, $4, $5)
//             RETURNING *
//         `;
//         const params = [req.companyId, category, include_keywords || [], exclude_keywords || [], priority || 0];
//         const { rows } = await pool.query(sql, params);
//         res.json({ rule: rows[0] });
//     } catch (err) {
//         console.error('Create category-rule error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// app.put('/api/ratings/category-rules/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { category, include_keywords, exclude_keywords, priority } = req.body;
//         const sql = `
//             UPDATE ratings.category_rules
//             SET category = $1, include_keywords = $2, exclude_keywords = $3, priority = $4
//             WHERE id = $5 AND company_id = $6
//             RETURNING *
//         `;
//         const params = [category, include_keywords || [], exclude_keywords || [], priority || 0, id, req.companyId];
//         const { rows } = await pool.query(sql, params);
//         res.json({ rule: rows[0] });
//     } catch (err) {
//         console.error('Update category-rule error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// app.delete('/api/ratings/category-rules/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         await pool.query(`DELETE FROM ratings.category_rules WHERE id = $1 AND company_id = $2`, [id, req.companyId]);
//         res.json({ success: true });
//     } catch (err) {
//         console.error('Delete category-rule error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // --- Stakeholder mappings: simple upsert by (company_id, sentiment_subcategory) ---
// // The frontend StakeholderMappingTable surfaces issues from the NLP output and
// // lets users assign each subcategory to a department. One endpoint covers both
// // create + update by upserting on the natural key.
// /**
//  * Stakeholder mappings GET — surfaces the live DB rows so client UIs
//  * (ActionIntelligenceHub, etc.) can route issues without hardcoded
//  * subcategory lists in JS. Returns one row per (stakeholder, subcategory)
//  * pair so the caller can group by stakeholder.
//  */
// app.get('/api/ratings/stakeholder-mappings', async (req, res) => {
//     try {
//         const { rows } = await pool.query(
//             `SELECT id, sentiment_subcategory, stakeholder, display_label, sort_order
//              FROM ratings.stakeholder_mappings
//              WHERE company_id = $1
//              ORDER BY stakeholder NULLS LAST, sort_order, sentiment_subcategory`,
//             [req.companyId]
//         );
//         // Group by stakeholder for convenient client consumption.
//         const grouped = {};
//         for (const r of rows) {
//             const sh = r.stakeholder || '_unassigned';
//             if (!grouped[sh]) grouped[sh] = { stakeholder: r.stakeholder, subcategories: [], display_labels: {} };
//             grouped[sh].subcategories.push(r.sentiment_subcategory);
//             if (r.display_label) grouped[sh].display_labels[r.sentiment_subcategory] = r.display_label;
//         }
//         res.json({ mappings: rows, grouped });
//     } catch (err) {
//         console.error('Get stakeholder-mappings error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// app.post('/api/ratings/stakeholder-mappings', async (req, res) => {
//     try {
//         const { sentiment_subcategory, stakeholder, display_label, sort_order } = req.body;
//         if (!sentiment_subcategory || typeof sentiment_subcategory !== 'string') {
//             return res.status(400).json({ error: 'sentiment_subcategory is required' });
//         }
//         const cleanedStakeholder = stakeholder && String(stakeholder).trim() !== '' ? String(stakeholder).trim() : null;
//         // Only overwrite stakeholder when the caller actually sent the key — a
//         // label-only POST must not null out an existing stakeholder assignment.
//         const stakeholderProvided = Object.prototype.hasOwnProperty.call(req.body, 'stakeholder');
//         const cleanedLabel = display_label && String(display_label).trim() !== '' ? String(display_label).trim() : null;
//         const order = Number.isFinite(parseInt(sort_order, 10)) ? parseInt(sort_order, 10) : 0;

//         // Two-query upsert (no unique constraint guaranteed on the table).
//         const existing = await pool.query(
//             `SELECT id FROM ratings.stakeholder_mappings WHERE company_id = $1 AND sentiment_subcategory = $2 LIMIT 1`,
//             [req.companyId, sentiment_subcategory]
//         );
//         let row;
//         if (existing.rows.length > 0) {
//             const { rows } = await pool.query(
//                 `UPDATE ratings.stakeholder_mappings
//                  SET stakeholder = CASE WHEN $6 THEN $1 ELSE stakeholder END,
//                      display_label = COALESCE($2, display_label),
//                      sort_order = $3
//                  WHERE id = $4 AND company_id = $5
//                  RETURNING *`,
//                 [cleanedStakeholder, cleanedLabel, order, existing.rows[0].id, req.companyId, stakeholderProvided]
//             );
//             row = rows[0];
//         } else {
//             const { rows } = await pool.query(
//                 `INSERT INTO ratings.stakeholder_mappings
//                    (company_id, sentiment_subcategory, stakeholder, display_label, sort_order)
//                  VALUES ($1, $2, $3, $4, $5)
//                  RETURNING *`,
//                 [req.companyId, sentiment_subcategory, cleanedStakeholder, cleanedLabel || sentiment_subcategory, order]
//             );
//             row = rows[0];
//         }
//         res.json({ mapping: row });
//     } catch (err) {
//         console.error('Upsert stakeholder-mapping error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// app.delete('/api/ratings/stakeholder-mappings/:id', async (req, res) => {
//     try {
//         const { rowCount } = await pool.query(
//             `DELETE FROM ratings.stakeholder_mappings WHERE id = $1 AND company_id = $2`,
//             [req.params.id, req.companyId]
//         );
//         if (rowCount === 0) return res.status(404).json({ error: 'Mapping not found' });
//         res.json({ success: true });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });


// // ============================================================================
// // ISSUE STATUSES — DB-backed replacement for the localStorage-only
// // 'aih_issue_statuses' key in ActionIntelligenceHub. The issue_key is a
// // stable slug computed client-side from the subcategory name (e.g.
// // "issue-build-quality") so multiple users see and edit the same status.
// // ============================================================================
// app.get('/api/ratings/issue-statuses', async (req, res) => {
//     try {
//         const { rows } = await pool.query(
//             `SELECT issue_key, status, updated_by, updated_at
//              FROM ratings.issue_statuses WHERE company_id = $1`,
//             [req.companyId]
//         );
//         // Return as a flat map for direct drop-in replacement of the
//         // localStorage shape: { [issueKey]: 'open' | 'in_progress' | 'resolved' }.
//         const map = {};
//         rows.forEach(r => { map[r.issue_key] = r.status; });
//         res.json({ statuses: map, rows });
//     } catch (err) {
//         // Table may not exist on a fresh DB — return empty so the UI
//         // degrades gracefully (localStorage still works as a fallback).
//         if (/relation .* does not exist/i.test(err.message)) {
//             return res.json({ statuses: {}, rows: [] });
//         }
//         res.status(500).json({ error: err.message });
//     }
// });

// app.post('/api/ratings/issue-statuses', async (req, res) => {
//     try {
//         const { issue_key, status } = req.body || {};
//         if (!issue_key || typeof issue_key !== 'string') {
//             return res.status(400).json({ error: 'issue_key required' });
//         }
//         if (!['open', 'in_progress', 'resolved'].includes(status)) {
//             return res.status(400).json({ error: 'status must be open|in_progress|resolved' });
//         }
//         const updatedBy = req.authUser?.id || null;
//         const { rows } = await pool.query(
//             `INSERT INTO ratings.issue_statuses (company_id, issue_key, status, updated_by, updated_at)
//              VALUES ($1, $2, $3, $4, NOW())
//              ON CONFLICT (company_id, issue_key)
//              DO UPDATE SET status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = NOW()
//              RETURNING *`,
//             [req.companyId, issue_key, status, updatedBy]
//         );
//         res.json({ row: rows[0] });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // COMPETITOR MAPPINGS CRUD
// // ============================================================================
// app.get('/api/ratings/competitor-mappings', async (req, res) => {
//     try {
//         const { rows } = await pool.query(`
//             SELECT
//                 MIN(id) AS id,
//                 our_sku,
//                 our_product_name,
//                 our_category AS shared_category,
//                 json_agg(
//                     json_build_object(
//                         'sku', comp_sku,
//                         'productName', comp_product_name,
//                         'brand', comp_brand,
//                         'mappingType', match_type
//                     )
//                     ORDER BY comp_brand, comp_product_name
//                 ) AS competitors
//             FROM ratings.competitor_mapping_pairs
//             WHERE company_id = $1
//             GROUP BY our_sku, our_product_name, our_category
//             ORDER BY our_category, our_product_name
//         `, [req.companyId]);
//         res.json({ mappings: rows });
//     } catch (err) {
//         console.error('Fetch competitor-mappings error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// app.post('/api/ratings/competitor-mappings', async (req, res) => {
//     try {
//         const { our_sku, our_product_name, shared_category, competitors } = req.body;
//         const inserted = [];
//         for (const competitor of competitors || []) {
//             const { rows } = await pool.query(`
//                 INSERT INTO ratings.competitor_mapping_pairs (
//                     company_id, our_sku, our_product_name, our_category,
//                     comp_brand, comp_sku, comp_product_name,
//                     match_type, notes
//                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
//                 RETURNING *
//             `, [
//                 req.companyId,
//                 our_sku,
//                 our_product_name,
//                 shared_category,
//                 competitor.brand || null,
//                 competitor.sku || null,
//                 competitor.productName || null,
//                 competitor.mappingType || 'PEER',
//                 null,
//             ]);
//             inserted.push(rows[0]);
//         }
//         res.json({ mapping: { id: inserted[0]?.id || null, our_sku, our_product_name, shared_category, competitors: competitors || [] } });
//     } catch (err) {
//         console.error('Create competitor-mapping error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// app.put('/api/ratings/competitor-mappings/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { our_sku, our_product_name, shared_category, competitors } = req.body;
//         const lookup = await pool.query(`
//             SELECT our_sku
//             FROM ratings.competitor_mapping_pairs
//             WHERE id = $1 AND company_id = $2
//         `, [id, req.companyId]);
//         const targetSku = lookup.rows[0]?.our_sku || our_sku;

//         await pool.query(`
//             DELETE FROM ratings.competitor_mapping_pairs
//             WHERE company_id = $1 AND our_sku = $2
//         `, [req.companyId, targetSku]);

//         const inserted = [];
//         for (const competitor of competitors || []) {
//             const { rows } = await pool.query(`
//                 INSERT INTO ratings.competitor_mapping_pairs (
//                     company_id, our_sku, our_product_name, our_category,
//                     comp_brand, comp_sku, comp_product_name,
//                     match_type, notes
//                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
//                 RETURNING *
//             `, [
//                 req.companyId,
//                 our_sku,
//                 our_product_name,
//                 shared_category,
//                 competitor.brand || null,
//                 competitor.sku || null,
//                 competitor.productName || null,
//                 competitor.mappingType || 'PEER',
//                 null,
//             ]);
//             inserted.push(rows[0]);
//         }
//         res.json({ mapping: { id: inserted[0]?.id || id, our_sku, our_product_name, shared_category, competitors: competitors || [] } });
//     } catch (err) {
//         console.error('Update competitor-mapping error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// app.delete('/api/ratings/competitor-mappings/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const lookup = await pool.query(`
//             SELECT our_sku
//             FROM ratings.competitor_mapping_pairs
//             WHERE id = $1 AND company_id = $2
//         `, [id, req.companyId]);
//         const targetSku = lookup.rows[0]?.our_sku;
//         if (targetSku) {
//             await pool.query(`
//                 DELETE FROM ratings.competitor_mapping_pairs
//                 WHERE company_id = $1 AND our_sku = $2
//             `, [req.companyId, targetSku]);
//         }
//         res.json({ success: true });
//     } catch (err) {
//         console.error('Delete competitor-mapping error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // COMPETITOR MAPPING PAIRS — Flat table CRUD (industry-standard)
// // ============================================================================

// // GET /api/ratings/competitor-mapping-types — Match type config for dropdowns
// app.get('/api/ratings/competitor-mapping-types', async (req, res) => {
//     try {
//         const { rows } = await pool.query(
//             `SELECT code, label, color, sort_order FROM ratings.competitor_mapping_types
//              WHERE company_id = $1 ORDER BY sort_order`, [req.companyId]
//         );
//         res.json({ types: rows });
//     } catch (err) {
//         console.error('competitor-mapping-types error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // GET /api/ratings/competitor-mapping-options — Distinct filter options
// app.get('/api/ratings/competitor-mapping-options', async (req, res) => {
//     try {
//         const catRes = await pool.query(`SELECT DISTINCT our_category FROM ratings.competitor_mapping_pairs WHERE company_id = $1 AND our_category IS NOT NULL ORDER BY our_category`, [req.companyId]);
//         const brandRes = await pool.query(`SELECT DISTINCT comp_brand FROM ratings.competitor_mapping_pairs WHERE company_id = $1 AND comp_brand IS NOT NULL ORDER BY comp_brand`, [req.companyId]);
//         res.json({
//             categories: catRes.rows.map(r => r.our_category),
//             brands: brandRes.rows.map(r => r.comp_brand)
//         });
//     } catch (err) {
//         console.error('competitor-mapping-options error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // GET /api/ratings/competitor-mapping-pairs — List all flat pairs with filters
// app.get('/api/ratings/competitor-mapping-pairs', async (req, res) => {
//     try {
//         const { search, category, brand, match_type, page = '1', limit = '50' } = req.query;
//         const conditions = [`p.company_id = $1`];
//         const params = [req.companyId];
//         let idx = 2;

//         if (search) {
//             conditions.push(`(p.our_sku ILIKE $${idx} OR p.our_product_name ILIKE $${idx} OR p.comp_brand ILIKE $${idx} OR p.comp_sku ILIKE $${idx} OR p.comp_product_name ILIKE $${idx})`);
//             params.push(`%${search}%`);
//             idx++;
//         }
//         if (category) {
//             conditions.push(`p.our_category = $${idx}`);
//             params.push(category);
//             idx++;
//         }
//         if (brand) {
//             conditions.push(`p.comp_brand = $${idx}`);
//             params.push(brand);
//             idx++;
//         }
//         if (match_type) {
//             conditions.push(`p.match_type = $${idx}`);
//             params.push(match_type);
//             idx++;
//         }

//         const offset = (parseInt(page) - 1) * parseInt(limit);

//         // Count query
//         const countRes = await pool.query(
//             `SELECT COUNT(*) FROM ratings.competitor_mapping_pairs p WHERE ${conditions.join(' AND ')}`, params
//         );
//         const total = parseInt(countRes.rows[0].count);

//         // Data query
//         const { rows } = await pool.query(
//             `SELECT p.id, p.our_sku, p.our_product_name, p.our_category, p.our_material, p.our_wattage, p.our_platform,
//                     p.comp_brand, p.comp_sku, p.comp_product_name, p.comp_category, p.comp_material, p.comp_wattage, p.comp_platform,
//                     p.match_type, p.is_active, p.notes, p.created_at
//              FROM ratings.competitor_mapping_pairs p
//              WHERE ${conditions.join(' AND ')}
//              ORDER BY p.our_category, p.our_sku, p.comp_brand
//              LIMIT $${idx} OFFSET $${idx + 1}`,
//             [...params, parseInt(limit), offset]
//         );

//         res.json({ pairs: rows, total, page: parseInt(page), limit: parseInt(limit) });
//     } catch (err) {
//         console.error('competitor-mapping-pairs list error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // POST /api/ratings/competitor-mapping-pairs — Create a new mapping
// app.post('/api/ratings/competitor-mapping-pairs', async (req, res) => {
//     try {
//         const { our_sku, our_product_name, our_category, our_material, our_wattage, our_platform,
//                 comp_brand, comp_sku, comp_product_name, comp_category, comp_material, comp_wattage, comp_platform,
//                 match_type, notes } = req.body;

//         const { rows } = await pool.query(
//             `INSERT INTO ratings.competitor_mapping_pairs
//              (company_id, our_sku, our_product_name, our_category, our_material, our_wattage, our_platform,
//               comp_brand, comp_sku, comp_product_name, comp_category, comp_material, comp_wattage, comp_platform,
//               match_type, notes)
//              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
//              RETURNING *`,
//             [req.companyId, our_sku, our_product_name, our_category, our_material, our_wattage, our_platform || 'amazon',
//              comp_brand, comp_sku, comp_product_name, comp_category, comp_material, comp_wattage, comp_platform || 'amazon',
//              match_type || 'PEER', notes]
//         );
//         res.json({ pair: rows[0] });
//     } catch (err) {
//         console.error('competitor-mapping-pairs create error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // PUT /api/ratings/competitor-mapping-pairs/:id — Update a mapping
// app.put('/api/ratings/competitor-mapping-pairs/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const fields = req.body;
//         const setClauses = [];
//         const params = [];
//         let idx = 1;

//         const allowedFields = ['our_sku','our_product_name','our_category','our_material','our_wattage','our_platform',
//                                 'comp_brand','comp_sku','comp_product_name','comp_category','comp_material','comp_wattage','comp_platform',
//                                 'match_type','is_active','notes'];

//         for (const f of allowedFields) {
//             if (fields[f] !== undefined) {
//                 setClauses.push(`${f} = $${idx}`);
//                 params.push(fields[f]);
//                 idx++;
//             }
//         }
//         setClauses.push(`updated_at = NOW()`);

//         params.push(id);
//         params.push(req.companyId);

//         const { rows } = await pool.query(
//             `UPDATE ratings.competitor_mapping_pairs SET ${setClauses.join(', ')}
//              WHERE id = $${idx} AND company_id = $${idx + 1} RETURNING *`, params
//         );
//         res.json({ pair: rows[0] });
//     } catch (err) {
//         console.error('competitor-mapping-pairs update error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // DELETE /api/ratings/competitor-mapping-pairs/:id — Delete a mapping
// app.delete('/api/ratings/competitor-mapping-pairs/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         await pool.query(
//             `DELETE FROM ratings.competitor_mapping_pairs WHERE id = $1 AND company_id = $2`,
//             [id, req.companyId]
//         );
//         res.json({ success: true });
//     } catch (err) {
//         console.error('competitor-mapping-pairs delete error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // GET /api/ratings/competitor-mapping-pairs/export — CSV export
// app.get('/api/ratings/competitor-mapping-pairs/export', async (req, res) => {
//     try {
//         const { rows } = await pool.query(
//             `SELECT p.our_sku, p.our_product_name, p.our_category, p.our_material, p.our_wattage, p.our_platform,
//                     p.comp_brand, p.comp_sku, p.comp_product_name, p.comp_category, p.comp_material, p.comp_wattage, p.comp_platform,
//                     p.match_type, p.notes
//              FROM ratings.competitor_mapping_pairs p
//              WHERE p.company_id = $1 AND p.is_active = true
//              ORDER BY p.our_category, p.our_sku, p.comp_brand`,
//             [req.companyId]
//         );

//         // Build CSV
//         const headers = ['Our SKU','Our Product','Our Category','Our Material','Our Wattage','Our Platform',
//                           'Comp Brand','Comp SKU','Comp Product','Comp Category','Comp Material','Comp Wattage','Comp Platform',
//                           'Match Type','Notes'];
//         const csvRows = [headers.join(',')];
//         for (const r of rows) {
//             csvRows.push(Object.values(r).map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));
//         }

//         res.setHeader('Content-Type', 'text/csv');
//         res.setHeader('Content-Disposition', 'attachment; filename=competitor_mappings.csv');
//         res.send(csvRows.join('\n'));
//     } catch (err) {
//         console.error('competitor-mapping-pairs export error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/sentiment-categories — Derived from actual review data
// // ============================================================================
// app.get('/api/ratings/sentiment-categories', async (req, res) => {
//     try {
//         const { rows } = await pool.query(
//             `SELECT sentiment_category AS category, COUNT(*) AS cnt
//              FROM ratings.reviews
//              WHERE company_id = $1 AND sentiment_category IS NOT NULL AND sentiment_category != ''
//              GROUP BY sentiment_category
//              ORDER BY cnt DESC`,
//             [req.companyId]
//         );
//         res.json({ categories: rows.map(r => r.category) });
//     } catch (err) {
//         console.error('Sentiment-categories error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/competitor-brands — Derived from actual review data
// // ============================================================================
// app.get('/api/ratings/competitor-brands', async (req, res) => {
//     try {
//         // Defensive filter: legacy text-extraction left junk like "The", "not",
//         // "Gas", "Extracted" in ratings.reviews.brand for thousands of rows.
//         // Constrain to brands that look real: >= 3 chars, not in a stop-word
//         // list, and present on at least 3 reviews (to drop one-off noise).
//         const { rows } = await pool.query(
//             `SELECT brand FROM (
//                 SELECT INITCAP(LOWER(brand)) AS brand, COUNT(*) n FROM ratings.reviews
//                 WHERE company_id = $1 AND is_competitor = true
//                   AND brand IS NOT NULL AND brand != ''
//                   AND LENGTH(brand) >= 3
//                   AND LOWER(brand) NOT IN ('the','not','and','gas','extracted','none','null','n/a','other','unknown','etc','for','was','were','our','your','its')
//                 GROUP BY INITCAP(LOWER(brand))
//                 HAVING COUNT(*) >= 3
//             ) t ORDER BY brand ASC`,
//             [req.companyId]
//         );
//         res.json({ brands: rows.map(r => r.brand) });
//     } catch (err) {
//         console.error('Competitor-brands error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/spec-type-mappings — From category_rules.spec_type column
// // ============================================================================
// app.get('/api/ratings/spec-type-mappings', async (req, res) => {
//     try {
//         const { rows } = await pool.query(
//             `SELECT category, spec_type FROM ratings.category_rules
//              WHERE company_id = $1
//              ORDER BY category ASC`,
//             [req.companyId]
//         );
//         const mappings = {};
//         rows.forEach(r => { mappings[r.category] = r.spec_type || 'generic'; });
//         res.json({ mappings });
//     } catch (err) {
//         console.error('Spec-type-mappings error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // NOTE: /api/ratings/category-rules GET is defined above in the CATEGORY RULES CRUD section (L1738).
// // Duplicate removed during audit 2026-04-10.

// // ============================================================================
// // GET /api/ratings/company-config — Tenant brand name, color, etc.
// // ============================================================================
// app.get('/api/ratings/company-config', async (req, res) => {
//     try {
//         const { rows } = await pool.query(
//             `SELECT brand_name, brand_color, logo_url FROM ratings.company_config WHERE company_id = $1`,
//             [req.companyId]
//         );
//         res.json({ config: rows[0] || { brand_name: 'Our Brand', brand_color: '#6366f1' } });
//     } catch (err) {
//         console.error('company-config error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/brand-config — Dynamic brand colors for all brands
// // ============================================================================
// app.get('/api/ratings/brand-config', async (req, res) => {
//     try {
//         const { rows } = await pool.query(
//             `SELECT brand_name, display_color, is_own_brand, sort_order 
//              FROM ratings.brand_config WHERE company_id = $1 ORDER BY sort_order`,
//             [req.companyId]
//         );
//         res.json({ brands: rows });
//     } catch (err) {
//         console.error('brand-config error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/benchmark-data — Real sentiment scores for competitor benchmark
// // Computes actual scores from reviews, NOT fake/random data
// // ============================================================================
// app.get('/api/ratings/benchmark-data', async (req, res) => {
//     try {
//         const { category, platform, date_from, date_to, period_months, price_mode, price_min, price_max } = req.query;
//         const conditions = [`r.company_id = $1`,
//             // Our own reviews (is_competitor=false) are ALWAYS Prestige — attribute
//             // ALL of them (below) so the benchmark "Prestige" total reconciles with
//             // the header / strip / governance cards (~21K). The junk-brand guard
//             // (legacy text-extraction noise like "The"/"Gas"/"Extracted", 1-2 char
//             // strings) applies ONLY to competitor rows, so it still stops fake
//             // competitor columns without dropping our own noisy-brand reviews.
//             `(COALESCE(r.is_competitor, false) = false OR (r.brand IS NOT NULL AND r.brand <> '' AND LENGTH(TRIM(r.brand)) >= 3 AND LOWER(TRIM(r.brand)) NOT IN ('the','not','and','gas','extracted','none','null','n/a','other','unknown','etc','for','was','were','our','your','its')))`];
//         const params = [req.companyId];
//         let idx = 2;

//         if (category) {
//             conditions.push(`TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))) ILIKE $${idx}`);
//             params.push(category);
//             idx++;
//         }
//         if (platform && platform !== 'all') {
//             conditions.push(`r.platform ILIKE $${idx}`);
//             params.push(platform);
//             idx++;
//         }
//         if (date_from) {
//             conditions.push(`r.review_date >= $${idx}`);
//             params.push(date_from);
//             idx++;
//         }
//         if (date_to) {
//             conditions.push(`r.review_date <= $${idx}`);
//             params.push(date_to);
//             idx++;
//         } else if (!date_from && period_months) {
//             const safePeriodMonths = Math.max(1, Math.min(parseInt(period_months) || 6, 24));
//             conditions.push(`r.review_date >= CURRENT_DATE - INTERVAL '${safePeriodMonths} months'`);
//         }
//         if (price_min !== undefined && price_min !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             conditions.push(`${priceExpr} >= $${idx}`);
//             params.push(Number(price_min));
//             idx++;
//         }
//         if (price_max !== undefined && price_max !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             conditions.push(`${priceExpr} <= $${idx}`);
//             params.push(Number(price_max));
//             idx++;
//         }

//         const { rows } = await pool.query(
//             `WITH latest_snapshots AS (
//                 -- Each SKU's latest snapshot computed ONCE (was a per-review
//                 -- correlated LATERAL — the dominant cost of this endpoint). Same
//                 -- selection as the old LATERAL: latest snapshot_date, then latest
//                 -- created_at. A SKU with no snapshot simply has no row here, so the
//                 -- LEFT JOIN below yields the same NULLs the LATERAL did.
//                 SELECT DISTINCT ON (web_pid, LOWER(platform))
//                     web_pid, platform, price_rp, price_sp, category, rating, rating_count
//                 FROM ratings.product_snapshots
//                 WHERE company_id = $1
//                 ORDER BY web_pid, LOWER(platform), snapshot_date DESC, created_at DESC NULLS LAST
//             ),
//             scoped_reviews AS (
//                 SELECT
//                     -- Our side (is_competitor=false) → always 'Prestige' so ALL our
//                     -- reviews aggregate into one row that matches the header/strip
//                     -- (~21K), never fragmented by noisy r.brand text. Competitors keep
//                     -- canonicalised casing so 'Pigeon'/'pigeon', 'BUTTERFLY'/'Butterfly'
//                     -- collapse to ONE brand instead of duplicate matrix columns.
//                     CASE WHEN COALESCE(r.is_competitor, false) = false THEN 'Prestige'
//                          ELSE INITCAP(LOWER(r.brand)) END AS brand,
//                     r.is_competitor,
//                     COALESCE(r.sentiment_category, 'General') AS sentiment_category,
//                     r.rating,
//                     r.ml_inferred_rating,
//                     r.sentiment
//                     ,r.web_pid
//                     ,r.platform
//                     ,ps.rating AS pdp_rating
//                     ,ps.rating_count AS rating_count
//                 FROM ratings.reviews r
//                 LEFT JOIN masters.products mp
//                     ON mp.company_id = r.company_id
//                    AND mp.product_external_id = r.web_pid
//                    AND LOWER(mp.platform) = LOWER(r.platform)
//                 LEFT JOIN latest_snapshots ps
//                     ON ps.web_pid = r.web_pid
//                    AND LOWER(ps.platform) = LOWER(r.platform)
//                 WHERE ${conditions.join(' AND ')}
//             ),
//             brand_totals AS (
//                 SELECT
//                     brand,
//                     is_competitor,
//                     COUNT(*) AS total_reviews,
//                     ROUND(AVG(rating)::numeric, 2) AS avg_rating,
//                     ROUND(AVG(ml_inferred_rating)::numeric, 2) AS avg_ml_rating,
//                     COUNT(*) FILTER (WHERE sentiment = 'Positive') AS positive_count,
//                     COUNT(*) FILTER (WHERE sentiment = 'Negative') AS negative_count,
//                     COUNT(*) FILTER (WHERE sentiment = 'Neutral') AS neutral_count
//                 FROM scoped_reviews
//                 GROUP BY brand, is_competitor
//                 HAVING COUNT(*) >= 3
//             ),
//             brand_listing_metrics AS (
//                 SELECT
//                     sr.brand,
//                     sr.is_competitor,
//                     SUM(COALESCE(sr.rating_count, 0)) AS total_rating_count,
//                     ROUND(
//                         SUM(COALESCE(sr.pdp_rating, 0) * COALESCE(sr.rating_count, 0))
//                         / NULLIF(SUM(COALESCE(sr.rating_count, 0)), 0)::numeric,
//                         2
//                     ) AS avg_pdp_rating
//                 FROM (
//                     SELECT DISTINCT
//                         brand,
//                         is_competitor,
//                         web_pid,
//                         platform,
//                         pdp_rating,
//                         rating_count
//                     FROM scoped_reviews
//                 ) sr
//                 GROUP BY sr.brand, sr.is_competitor
//             ),
//             category_agg AS (
//                 SELECT
//                     brand,
//                     is_competitor,
//                     sentiment_category,
//                     COUNT(*) AS cat_total,
//                     COUNT(*) FILTER (WHERE sentiment = 'Positive') AS cat_positive,
//                     COUNT(*) FILTER (WHERE sentiment = 'Negative') AS cat_negative,
//                     ROUND(AVG(rating)::numeric, 2) AS cat_avg_rating
//                 FROM scoped_reviews
//                 GROUP BY brand, is_competitor, sentiment_category
//             )
//             SELECT
//                 bt.brand,
//                 bt.is_competitor,
//                 bt.total_reviews,
//                 bt.avg_rating,
//                 blm.avg_pdp_rating AS pdp_rating,
//                 bt.avg_rating AS user_rating,
//                 bt.avg_ml_rating AS ml_rating,
//                 bt.total_reviews AS review_count,
//                 blm.total_rating_count AS rating_count,
//                 bt.positive_count,
//                 bt.negative_count,
//                 bt.neutral_count,
//                 jsonb_object_agg(
//                     ca.sentiment_category,
//                     jsonb_build_object(
//                         'total', ca.cat_total,
//                         'positive', ca.cat_positive,
//                         'negative', ca.cat_negative,
//                         'avg_rating', ca.cat_avg_rating
//                     )
//                 ) FILTER (WHERE ca.cat_total IS NOT NULL) AS category_scores
//             FROM brand_totals bt
//             LEFT JOIN brand_listing_metrics blm
//               ON blm.brand = bt.brand
//              AND blm.is_competitor = bt.is_competitor
//             LEFT JOIN category_agg ca
//               ON ca.brand = bt.brand
//              AND ca.is_competitor = bt.is_competitor
//             GROUP BY
//                 bt.brand,
//                 bt.is_competitor,
//                 bt.total_reviews,
//                 bt.avg_rating,
//                 bt.avg_ml_rating,
//                 blm.avg_pdp_rating,
//                 blm.total_rating_count,
//                 bt.positive_count,
//                 bt.negative_count,
//                 bt.neutral_count
//             ORDER BY bt.total_reviews DESC`,
//             params
//         );

//         res.json({ benchmarks: rows });
//     } catch (err) {
//         console.error('benchmark-data error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // ML QUALITY CONTROL (QC) ENDPOINTS
// // ============================================================================

// // 1. Fetch all pending ML audits
// app.get('/api/ml-audit/pending', async (req, res) => {
//     try {
//         const { rows } = await pool.query(`
//             SELECT 
//                 m.*,
//                 r.rating as original_rating
//             FROM ratings.reviews_ml_audit m
//             JOIN ratings.reviews r ON r.id = m.review_id
//             WHERE m.company_id = $1 
//               -- Only flag discrepancies in fields /approve actually merges (category,
//               -- material, wattage, rating). Sentiment / issue fields are owned by the
//               -- in-house classifier and are NOT written on approve, so flagging them
//               -- produced no-op audits that re-appeared in the queue forever.
//               AND (
//                     COALESCE(m.ml_category, m.rules_category) IS DISTINCT FROM r.category
//                  OR COALESCE(m.ml_material, m.rules_material) IS DISTINCT FROM r.material
//                  OR COALESCE(m.ml_wattage, m.rules_wattage) IS DISTINCT FROM r.wattage
//                  OR m.ml_inferred_rating IS DISTINCT FROM r.ml_inferred_rating
//               )
//             ORDER BY m.audit_date DESC
//             LIMIT 100
//         `, [req.companyId]);
//         res.json({ audits: rows });
//     } catch (err) {
//         console.error('ml-audit pending error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // 2. Approve ML recommendations and merge into Master
// app.post('/api/ml-audit/approve', async (req, res) => {
//     try {
//         const { audit_ids } = req.body;
//         if (!Array.isArray(audit_ids) || audit_ids.length === 0) {
//             return res.status(400).json({ error: 'Provide an array of audit_ids' });
//         }

//         // Single bulk UPDATE-FROM replacing the previous N+1 (one SELECT + one UPDATE per audit).
//         // ml_* fields are preferred over rules_* fields (matches the prior JS `||` coalescing,
//         // including treating empty strings as null via NULLIF). Source columns are stamped
//         // 'ml_approved' on any field where the audit actually contributed a non-null value.
//         const result = await pool.query(`
//             UPDATE ratings.reviews r
//             SET
//                 category              = COALESCE(NULLIF(a.ml_category,''),    NULLIF(a.rules_category,''),  r.category),
//                 category_source       = CASE WHEN COALESCE(NULLIF(a.ml_category,''), NULLIF(a.rules_category,'')) IS NOT NULL
//                                              THEN 'ml_approved' ELSE r.category_source END,
//                 material              = COALESCE(NULLIF(a.ml_material,''),    NULLIF(a.rules_material,''),  r.material),
//                 wattage               = COALESCE(NULLIF(a.ml_wattage,''),     NULLIF(a.rules_wattage,''),   r.wattage),
//                 -- sentiment / sentiment_category / sentiment_subcategory are now owned by the
//                 -- in-house SetFit classifier + gold-star sentiment (loaded directly into reviews).
//                 -- Approving the legacy DeBERTa audit must NOT overwrite them, or it reverts the
//                 -- new classifications. Approval still curates category / material / wattage / rating.
//                 ml_inferred_rating    = COALESCE(CASE WHEN a.ml_inferred_rating BETWEEN 1 AND 5
//                                                       THEN a.ml_inferred_rating END,                       r.ml_inferred_rating),
//                 updated_at            = NOW()
//             FROM ratings.reviews_ml_audit a
//             WHERE a.id = ANY($1::uuid[])
//               AND a.company_id = $2
//               AND r.id = a.review_id
//         `, [audit_ids, req.companyId]);

//         // Capture the human-approved labels into ratings.ml_training_set so we
//         // can fine-tune the rating + category models on Prestige-specific data
//         // once we cross ~3K rows. Best-effort: ignore failures here so a
//         // training-set write error never blocks an approval.
//         try {
//             await pool.query(`
//                 INSERT INTO ratings.ml_training_set (
//                     company_id, review_id, product_name, review_text, user_rating,
//                     approved_rating, approved_sentiment, approved_category,
//                     approved_subcategory, approved_material, approved_wattage,
//                     source_audit_id, ml_confidence, ml_reasoning
//                 )
//                 SELECT
//                     a.company_id, a.review_id, a.product_name, a.review_text,
//                     a.original_user_rating,
//                     CASE WHEN a.ml_inferred_rating BETWEEN 1 AND 5
//                          THEN a.ml_inferred_rating ELSE NULL END,
//                     a.ml_sentiment,
//                     COALESCE(NULLIF(a.ml_category,''), NULLIF(a.rules_category,'')),
//                     COALESCE(NULLIF(a.ml_issue_subcategory,''), NULLIF(a.ml_issue,'')),
//                     NULLIF(a.ml_material,''),
//                     NULLIF(a.ml_wattage,''),
//                     a.id, a.ml_confidence_score, a.ml_reasoning
//                   FROM ratings.reviews_ml_audit a
//                  WHERE a.id = ANY($1::uuid[])
//                    AND a.company_id = $2
//                    -- Don't double-insert if the same audit was approved before
//                    AND NOT EXISTS (
//                        SELECT 1 FROM ratings.ml_training_set t
//                         WHERE t.source_audit_id = a.id
//                    )
//             `, [audit_ids, req.companyId]);
//         } catch (e) {
//             console.warn('[ml-audit/approve] training-set capture failed (non-fatal):', e.message);
//         }

//         res.json({ success: true, message: `Approved ${result.rowCount} ML records.`, count: result.rowCount });
//     } catch (err) {
//         console.error('ml-audit approve error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // 3. Reject ML recommendations
// app.post('/api/ml-audit/reject', async (req, res) => {
//     try {
//         const { audit_ids } = req.body;
//         if (!Array.isArray(audit_ids) || audit_ids.length === 0) {
//             return res.status(400).json({ error: 'Provide an array of audit_ids' });
//         }

//         const placeholders = audit_ids.map((_, i) => `$${i + 2}`).join(',');
//         await pool.query(`DELETE FROM ratings.reviews_ml_audit WHERE company_id = $1 AND id IN (${placeholders})`, [req.companyId, ...audit_ids]);
        
//         res.json({ success: true, message: `Rejected ${audit_ids.length} ML records.` });
//     } catch (err) {
//         console.error('ml-audit reject error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ML job spawn + ml_jobs_log bookkeeping lives in a shared module so the
// // Temporal worker activity (runMlJob) reuses the exact same implementation.
// const { spawnJob, KNOWN_JOBS } = require('./automation/spawnJob.cjs');

// app.post('/api/ml/jobs/spawn', async (req, res) => {
//     try {
//         const { jobName, ids } = req.body;
//         if (!KNOWN_JOBS.includes(jobName)) {
//             return res.status(400).json({ error: 'Unknown jobName' });
//         }
//         // Fire-and-forget: spawnJob inserts the RUNNING row and detaches the
//         // child from the request lifecycle. `done` is intentionally not awaited.
//         const { jobId } = await spawnJob({ pool, companyId: req.companyId, jobName, ids });
//         res.json({ success: true, message: `Job ${jobName} spawned.`, jobId });
//     } catch (err) {
//         console.error('Job Spawn Error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// app.get('/api/ml/jobs', async (req, res) => {
//     try {
//         const { rows } = await pool.query(`
//             SELECT id, job_name, status, logs, started_at, completed_at
//             FROM ratings.ml_jobs_log
//             WHERE company_id = $1
//             ORDER BY started_at DESC LIMIT 50
//         `, [req.companyId]);
//         res.json({ jobs: rows });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // AUTOMATION — scheduled pipeline status, run history, rating-drop alert rules
// // ============================================================================
// const { runAlertsForCompany, testRule } = require('./automation/alertEngine.cjs');
// const { getTemporalClient, getTemporalConfig } = require('./automation/temporalClient.cjs');

// const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// const scheduleIdFor = (companyId) => `rating-daily-${companyId}`;

// // Validate + normalize an alert-rule payload. Returns { value } or { error }.
// function normalizeRuleInput(body) {
//     if (!body || typeof body !== 'object') return { error: 'Body required' };
//     const name = typeof body.name === 'string' ? body.name.trim() : '';
//     if (!name) return { error: 'name is required' };

//     const scope_type = body.scope_type;
//     if (!['product', 'brand', 'category'].includes(scope_type)) {
//         return { error: "scope_type must be 'product', 'brand', or 'category'" };
//     }
//     const scope_value = body.scope_value != null && String(body.scope_value).trim() !== ''
//         ? String(body.scope_value).trim() : null;
//     const platform = body.platform != null && String(body.platform).trim() !== ''
//         ? String(body.platform).trim() : null;

//     const parseNum = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
//     const absolute_floor = parseNum(body.absolute_floor);
//     const drop_delta = parseNum(body.drop_delta);
//     if (absolute_floor === null && drop_delta === null) {
//         return { error: 'At least one of absolute_floor or drop_delta is required' };
//     }
//     if (absolute_floor !== null && (Number.isNaN(absolute_floor) || absolute_floor < 1 || absolute_floor > 5)) {
//         return { error: 'absolute_floor must be between 1 and 5' };
//     }
//     if (drop_delta !== null && (Number.isNaN(drop_delta) || drop_delta <= 0)) {
//         return { error: 'drop_delta must be greater than 0' };
//     }

//     const comparison_window = body.comparison_window || 'previous_snapshot';
//     if (!['previous_snapshot', '7day_avg', '30day_avg'].includes(comparison_window)) {
//         return { error: "comparison_window must be 'previous_snapshot', '7day_avg', or '30day_avg'" };
//     }

//     let min_rating_count = body.min_rating_count != null ? parseInt(body.min_rating_count, 10) : 0;
//     if (Number.isNaN(min_rating_count) || min_rating_count < 0) min_rating_count = 0;

//     const recipients = Array.isArray(body.recipients)
//         ? body.recipients.map((r) => String(r).trim()).filter(Boolean)
//         : [];
//     const badEmail = recipients.find((r) => !EMAIL_RE.test(r));
//     if (badEmail) return { error: `Invalid recipient email: ${badEmail}` };

//     const enabled = body.enabled === undefined ? true : Boolean(body.enabled);

//     // v2 optional fields — empty/missing means "no extra filter".
//     const brand_filter = body.brand_filter != null && String(body.brand_filter).trim() !== ''
//         ? String(body.brand_filter).trim() : null;
//     const category_filter = body.category_filter != null && String(body.category_filter).trim() !== ''
//         ? String(body.category_filter).trim() : null;
//     const classification = ['Pareto', 'Non-Pareto', 'NPD'].includes(body.classification)
//         ? body.classification : null;
//     const sentiment_category = body.sentiment_category != null && String(body.sentiment_category).trim() !== ''
//         ? String(body.sentiment_category).trim() : null;
//     let min_review_count = body.min_review_count != null ? parseInt(body.min_review_count, 10) : 0;
//     if (Number.isNaN(min_review_count) || min_review_count < 0) min_review_count = 0;
//     const trigger_mode = ['on_schedule', 'on_event', 'manual_only', 'custom_cron'].includes(body.trigger_mode)
//         ? body.trigger_mode : 'on_schedule';
//     // 5-field cron, only used when trigger_mode = 'custom_cron'. Light syntax
//     // check: 5 whitespace-separated tokens of permitted chars. Full validation
//     // happens server-side when the schedule is registered.
//     const cron_expression = (trigger_mode === 'custom_cron' && typeof body.cron_expression === 'string')
//         ? body.cron_expression.trim() : null;
//     if (trigger_mode === 'custom_cron' && cron_expression) {
//         const parts = cron_expression.split(/\s+/);
//         if (parts.length !== 5) {
//             return { error: 'cron_expression must be a 5-field cron string (minute hour day month weekday)' };
//         }
//         if (!/^[\d*,\-/]+(\s+[\d*,\-/]+){4}$/.test(cron_expression)) {
//             return { error: 'cron_expression contains invalid characters' };
//         }
//     }
//     // v4 — competitor scope + multi-select arrays.
//     const is_competitor_scope = ['all', 'prestige', 'competitors'].includes(body.is_competitor_scope)
//         ? body.is_competitor_scope : 'prestige';
//     const cleanArr = (arr) => Array.isArray(arr)
//         ? Array.from(new Set(arr.map(v => String(v).trim()).filter(Boolean)))
//         : [];
//     const platforms  = cleanArr(body.platforms);
//     const brands     = cleanArr(body.brands);
//     const categories = cleanArr(body.categories);
//     const web_pids   = cleanArr(body.web_pids);

//     // Optional OR-group: second filter set with its own scope/brand/category/etc.
//     let or_group = null;
//     if (body.or_group && typeof body.or_group === 'object') {
//         const og = body.or_group;
//         const trimmed = {
//             scope_type: ['product', 'brand', 'category'].includes(og.scope_type) ? og.scope_type : null,
//             scope_value: og.scope_value ? String(og.scope_value).trim() || null : null,
//             platform: og.platform ? String(og.platform).trim() || null : null,
//             brand_filter: og.brand_filter ? String(og.brand_filter).trim() || null : null,
//             category_filter: og.category_filter ? String(og.category_filter).trim() || null : null,
//             classification: ['Pareto', 'Non-Pareto', 'NPD'].includes(og.classification) ? og.classification : null,
//         };
//         // Drop the OR-group entirely if it carries no actual filter.
//         const hasAny = trimmed.scope_value || trimmed.platform || trimmed.brand_filter
//             || trimmed.category_filter || trimmed.classification;
//         if (hasAny) or_group = trimmed;
//     }
//     const validActions = Array.isArray(body.actions)
//         ? body.actions.filter(a => ['email', 'in_app'].includes(a))
//         : null;
//     const actions = validActions && validActions.length ? validActions : ['email'];

//     return {
//         value: {
//             name, scope_type, scope_value, platform, absolute_floor, drop_delta,
//             comparison_window, min_rating_count, recipients, enabled,
//             brand_filter, category_filter, classification, sentiment_category,
//             min_review_count, trigger_mode, actions,
//             cron_expression, or_group,
//             is_competitor_scope, platforms, brands, categories, web_pids,
//         },
//     };
// }

// // --- Alert rules CRUD ---
// app.get('/api/automation/alert-rules', async (req, res) => {
//     try {
//         const { rows } = await pool.query(
//             `SELECT * FROM ratings.alert_rules WHERE company_id = $1 ORDER BY created_at DESC`,
//             [req.companyId]
//         );
//         res.json({ rules: rows });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// /**
//  * Fire-and-forget Temporal workflow to evaluate one rule the moment it's
//  * created or activated. Doesn't block the API response — if Temporal is
//  * unreachable we just log a warning so rule creation still succeeds.
//  */
// async function startInstantRuleWorkflow({ companyId, ruleId, reason }) {
//     try {
//         const client = await getTemporalClient();
//         const { taskQueue } = getTemporalConfig();
//         const workflowId = `instant-rule-${ruleId}-${Date.now()}`;
//         await client.workflow.start('runRuleInstantWorkflow', {
//             args: [{ companyId, ruleId }],
//             taskQueue,
//             workflowId,
//         });
//         console.log(`[alert-rule] ${reason} → fired ${workflowId}`);
//     } catch (e) {
//         // Temporal unreachable / namespace missing / worker down — non-fatal.
//         // The rule still saved; the next daily-pipeline run will pick it up.
//         console.warn(`[alert-rule] instant trigger skipped (${reason}): ${e.message}`);
//     }
// }

// app.post('/api/automation/alert-rules', async (req, res) => {
//     try {
//         const { value, error } = normalizeRuleInput(req.body);
//         if (error) return res.status(400).json({ error });
//         const { rows } = await pool.query(
//             `INSERT INTO ratings.alert_rules
//                (company_id, name, scope_type, scope_value, platform, absolute_floor,
//                 drop_delta, comparison_window, min_rating_count, recipients, enabled, created_by,
//                 brand_filter, category_filter, classification, sentiment_category,
//                 min_review_count, trigger_mode, actions, cron_expression, or_group,
//                 is_competitor_scope, platforms, brands, categories, web_pids)
//              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,$21::jsonb,
//                      $22,$23::text[],$24::text[],$25::text[],$26::text[])
//              RETURNING *`,
//             [
//                 req.companyId, value.name, value.scope_type, value.scope_value, value.platform,
//                 value.absolute_floor, value.drop_delta, value.comparison_window,
//                 value.min_rating_count, value.recipients, value.enabled,
//                 req.authUser ? req.authUser.id : null,
//                 value.brand_filter, value.category_filter, value.classification, value.sentiment_category,
//                 value.min_review_count, value.trigger_mode, JSON.stringify(value.actions),
//                 value.cron_expression, value.or_group ? JSON.stringify(value.or_group) : null,
//                 value.is_competitor_scope, value.platforms, value.brands, value.categories, value.web_pids,
//             ]
//         );
//         const rule = rows[0];
//         // Newly-created rule with enabled=true → evaluate immediately so the
//         // admin gets the first email within seconds (not on next pipeline run).
//         if (rule.enabled) {
//             startInstantRuleWorkflow({ companyId: req.companyId, ruleId: rule.id, reason: `rule "${rule.name}" created` })
//                 .catch(() => {/* already logged */});
//         }
//         res.status(201).json({ rule });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// app.put('/api/automation/alert-rules/:id', async (req, res) => {
//     try {
//         const { value, error } = normalizeRuleInput(req.body);
//         if (error) return res.status(400).json({ error });

//         // Read previous enabled state so we can detect ON-flip transitions.
//         const prevRes = await pool.query(
//             `SELECT enabled FROM ratings.alert_rules WHERE id=$1 AND company_id=$2`,
//             [req.params.id, req.companyId]
//         );
//         const wasEnabled = prevRes.rows[0]?.enabled === true;

//         const { rows } = await pool.query(
//             `UPDATE ratings.alert_rules
//              SET name=$1, scope_type=$2, scope_value=$3, platform=$4, absolute_floor=$5,
//                  drop_delta=$6, comparison_window=$7, min_rating_count=$8, recipients=$9,
//                  enabled=$10,
//                  brand_filter=$11, category_filter=$12, classification=$13, sentiment_category=$14,
//                  min_review_count=$15, trigger_mode=$16, actions=$17::jsonb,
//                  cron_expression=$18, or_group=$19::jsonb,
//                  is_competitor_scope=$20, platforms=$21::text[], brands=$22::text[],
//                  categories=$23::text[], web_pids=$24::text[],
//                  updated_at=now()
//              WHERE id=$25 AND company_id=$26
//              RETURNING *`,
//             [
//                 value.name, value.scope_type, value.scope_value, value.platform,
//                 value.absolute_floor, value.drop_delta, value.comparison_window,
//                 value.min_rating_count, value.recipients, value.enabled,
//                 value.brand_filter, value.category_filter, value.classification, value.sentiment_category,
//                 value.min_review_count, value.trigger_mode, JSON.stringify(value.actions),
//                 value.cron_expression, value.or_group ? JSON.stringify(value.or_group) : null,
//                 value.is_competitor_scope, value.platforms, value.brands, value.categories, value.web_pids,
//                 req.params.id, req.companyId,
//             ]
//         );
//         if (rows.length === 0) return res.status(404).json({ error: 'Alert rule not found' });
//         const rule = rows[0];

//         // Fire instant evaluation when:
//         //   - rule transitioned from disabled → enabled (activation), or
//         //   - rule was edited while already enabled (definition changed,
//         //     re-eval against the new threshold/scope so admin gets feedback)
//         if (rule.enabled) {
//             const reason = wasEnabled
//                 ? `rule "${rule.name}" updated`
//                 : `rule "${rule.name}" activated`;
//             startInstantRuleWorkflow({ companyId: req.companyId, ruleId: rule.id, reason })
//                 .catch(() => {/* already logged */});
//         }
//         res.json({ rule });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// app.delete('/api/automation/alert-rules/:id', async (req, res) => {
//     try {
//         const { rowCount } = await pool.query(
//             `DELETE FROM ratings.alert_rules WHERE id=$1 AND company_id=$2`,
//             [req.params.id, req.companyId]
//         );
//         if (rowCount === 0) return res.status(404).json({ error: 'Alert rule not found' });
//         res.json({ success: true });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // Preview a rule — returns the events it would fire now, no insert/email.
// app.post('/api/automation/alert-rules/:id/test', async (req, res) => {
//     try {
//         const result = await testRule(pool, req.params.id, req.companyId);
//         // `send=true` (body or query) → after the dry-run preview, actually
//         // email the digest to the rule's recipients. Uses the same renderer
//         // as the daily flow so what you see in your inbox = what real alerts
//         // will look like. Does NOT insert alert_events rows (no dedup pollution).
//         const wantSend = req.body?.send === true || req.query?.send === 'true' || req.query?.send === '1';
//         if (wantSend && result.events.length > 0) {
//             try {
//                 const { renderDigestHtml } = require('./automation/alertEngine.cjs');
//                 const { sendAlertEmail, isMailerConfigured } = require('./automation/mailer.cjs');
//                 if (!isMailerConfigured()) {
//                     return res.json({ ...result, sent: false, sendError: 'SMTP not configured on this deploy.' });
//                 }
//                 // Load the rule's recipients (testRule strips them; re-read here).
//                 const { rows: ruleRows } = await pool.query(
//                     `SELECT recipients FROM ratings.alert_rules WHERE id = $1 AND company_id = $2`,
//                     [req.params.id, req.companyId]
//                 );
//                 const recipients = ruleRows[0]?.recipients || [];
//                 const html = await renderDigestHtml(
//                     { ...result.rule, absolute_floor: null, drop_delta: null }, // formatting only
//                     result.events
//                 );
//                 await sendAlertEmail({
//                     to: recipients.length ? recipients : [],
//                     subject: `[Ratings TEST] ${result.events.length} match(es) — ${result.rule.name}`,
//                     html,
//                     priority: 'normal',
//                     threadKey: `test-rule-${req.params.id}`,
//                 });
//                 return res.json({ ...result, sent: true, sentTo: recipients.length ? recipients : '(default recipients)' });
//             } catch (mailErr) {
//                 console.error('[alert-rule test] send failed:', mailErr);
//                 return res.json({ ...result, sent: false, sendError: mailErr.message });
//             }
//         }
//         res.json(result);
//     } catch (err) {
//         if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
//         res.status(500).json({ error: err.message });
//     }
// });

// app.get('/api/automation/alert-events', async (req, res) => {
//     try {
//         const params = [req.companyId];
//         let where = 'company_id = $1';
//         if (req.query.rule_id) {
//             params.push(req.query.rule_id);
//             where += ` AND rule_id = $${params.length}`;
//         }
//         const { rows } = await pool.query(
//             `SELECT * FROM ratings.alert_events WHERE ${where}
//              ORDER BY triggered_at DESC LIMIT 100`,
//             params
//         );
//         res.json({ events: rows });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // --- Pipeline status / history / manual trigger ---
// app.get('/api/automation/status', async (req, res) => {
//     try {
//         const { rows: runRows } = await pool.query(
//             `SELECT * FROM ratings.automation_runs
//              WHERE company_id = $1 ORDER BY started_at DESC LIMIT 1`,
//             [req.companyId]
//         );
//         const { rows: jobRows } = await pool.query(
//             `SELECT id, job_name, status, started_at, completed_at
//              FROM ratings.ml_jobs_log WHERE company_id = $1
//              ORDER BY started_at DESC LIMIT 10`,
//             [req.companyId]
//         );

//         // Temporal schedule health — degrade gracefully if the cluster is unreachable.
//         let schedule = { status: 'unreachable' };
//         try {
//             const client = await getTemporalClient();
//             const handle = client.schedule.getHandle(scheduleIdFor(req.companyId));
//             const desc = await handle.describe();
//             schedule = {
//                 status: desc.state.paused ? 'paused' : 'active',
//                 nextActionTimes: (desc.info.nextActionTimes || []).slice(0, 3),
//                 recentActions: (desc.info.recentActions || []).slice(-3),
//             };
//         } catch (e) {
//             schedule = { status: 'unreachable', detail: e.message };
//         }

//         res.json({
//             lastRun: runRows[0] || null,
//             recentJobs: jobRows,
//             schedule,
//         });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// app.get('/api/automation/runs', async (req, res) => {
//     try {
//         const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
//         const offset = parseInt(req.query.offset, 10) || 0;
//         const { rows } = await pool.query(
//             `SELECT * FROM ratings.automation_runs WHERE company_id = $1
//              ORDER BY started_at DESC LIMIT $2 OFFSET $3`,
//             [req.companyId, limit, offset]
//         );
//         res.json({ runs: rows });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// app.post('/api/automation/trigger', async (req, res) => {
//     try {
//         const { rows: running } = await pool.query(
//             `SELECT id FROM ratings.automation_runs
//              WHERE company_id = $1 AND status = 'RUNNING' LIMIT 1`,
//             [req.companyId]
//         );
//         if (running.length > 0) {
//             return res.status(409).json({ error: 'A pipeline run is already in progress for this company.' });
//         }

//         let client;
//         try {
//             client = await getTemporalClient();
//         } catch (e) {
//             return res.status(503).json({ error: `Temporal unreachable: ${e.message}` });
//         }

//         const { taskQueue } = getTemporalConfig();
//         const workflowId = `manual-${req.companyId}-${Date.now()}`;
//         const handle = await client.workflow.start('dailyPipelineWorkflow', {
//             taskQueue,
//             workflowId,
//             args: [{ companyId: req.companyId, triggerType: 'manual' }],
//         });
//         res.json({ success: true, workflowId: handle.workflowId, runId: handle.firstExecutionRunId });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // Per-job triggers — let admins fire individual ML jobs from /settings without
// // going through the hidden /ml-control page. Backed by spawnJob.cjs (same path
// // the Temporal activities use), so behaviour is identical to the scheduled run.
// // ============================================================================
// // (spawnJob + KNOWN_JOBS imported above near /api/ml/jobs/spawn)

// app.get('/api/automation/jobs/known', (req, res) => {
//     res.json({ jobs: KNOWN_JOBS });
// });

// app.get('/api/automation/jobs/recent', async (req, res) => {
//     try {
//         const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
//         const { rows } = await pool.query(
//             `SELECT id, job_name, status, started_at, completed_at,
//                     EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at))::int AS duration_seconds,
//                     LENGTH(COALESCE(logs,'')) AS log_size
//                FROM ratings.ml_jobs_log
//               WHERE company_id = $1
//               ORDER BY started_at DESC
//               LIMIT $2`,
//             [req.companyId, limit]
//         );
//         res.json({ jobs: rows });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// app.get('/api/automation/jobs/:id', async (req, res) => {
//     try {
//         const { rows } = await pool.query(
//             `SELECT id, job_name, status, started_at, completed_at,
//                     EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at))::int AS duration_seconds,
//                     RIGHT(COALESCE(logs,''), 8000) AS log_tail
//                FROM ratings.ml_jobs_log
//               WHERE company_id = $1 AND id = $2`,
//             [req.companyId, req.params.id]
//         );
//         if (!rows.length) return res.status(404).json({ error: 'Job not found' });
//         res.json(rows[0]);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// app.post('/api/automation/jobs/trigger', async (req, res) => {
//     try {
//         const { jobName, ids, viaTemporal = true } = req.body || {};
//         if (!KNOWN_JOBS.includes(jobName)) {
//             return res.status(400).json({ error: `Unknown jobName. Allowed: ${KNOWN_JOBS.join(', ')}` });
//         }
//         // Block if the same job is already running for this company.
//         const { rows: running } = await pool.query(
//             `SELECT id FROM ratings.ml_jobs_log
//               WHERE company_id = $1 AND job_name = $2 AND status = 'RUNNING' LIMIT 1`,
//             [req.companyId, jobName]
//         );
//         if (running.length > 0) {
//             return res.status(409).json({
//                 error: `${jobName} is already running.`,
//                 jobId: running[0].id,
//             });
//         }

//         // Prefer Temporal so the job runs on the worker (proper heartbeats,
//         // retries, and the long-running BERT job doesn't tax the API service).
//         // Falls back to a local spawn if Temporal is unreachable.
//         if (viaTemporal) {
//             try {
//                 const client = await getTemporalClient();
//                 const { taskQueue } = getTemporalConfig();
//                 const workflowId = `manual-job-${jobName.replace(/\s+/g, '-')}-${req.companyId}-${Date.now()}`;
//                 const handle = await client.workflow.start('singleJobWorkflow', {
//                     taskQueue,
//                     workflowId,
//                     args: [{ companyId: req.companyId, jobName }],
//                 });
//                 return res.json({
//                     success: true,
//                     via: 'temporal',
//                     workflowId: handle.workflowId,
//                     runId: handle.firstExecutionRunId,
//                     jobName,
//                 });
//             } catch (e) {
//                 console.warn(`[jobs/trigger] Temporal unavailable, falling back to local spawn: ${e.message}`);
//             }
//         }

//         // Fallback: spawn locally on the API service (existing behaviour).
//         const { jobId } = await spawnJob({ pool, companyId: req.companyId, jobName, ids });
//         res.json({ success: true, via: 'local', jobId, jobName });
//     } catch (err) {
//         console.error('jobs/trigger error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// const { buildDigestHtml, renderDigestHtml } = require('./automation/alertEngine.cjs');
// const { getMailerSettings, putMailerSettings, resolveScheduledAt, DEFAULTS: MAILER_DEFAULTS } = require('./automation/mailerSettings.cjs');

// app.get('/api/automation/mailer-settings', async (req, res) => {
//     try {
//         const settings = await getMailerSettings(pool, req.companyId);
//         res.json({ settings, defaults: MAILER_DEFAULTS });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // 1) Full-text review search — investigation tool for QA / product teams.
// //    Searches across review_text + review_title + product_name with ILIKE.
// //    Filters: platform, brand_scope, date range, rating bucket, sentiment.
// // ============================================================================
// app.get('/api/ratings/reviews/search', async (req, res) => {
//     try {
//         const { q, platform, brand_scope, date_from, date_to, rating_min, rating_max,
//                 sentiment, limit = 100, offset = 0 } = req.query;
//         if (!q || String(q).trim().length < 2) {
//             return res.status(400).json({ error: 'Query must be at least 2 chars' });
//         }
//         const term = `%${String(q).trim()}%`;
//         const where = ['r.company_id = $1'];
//         const params = [req.companyId, term, term, term];
//         where.push('(r.review_text ILIKE $2 OR r.review_title ILIKE $3 OR r.product_name ILIKE $4)');
//         let idx = 5;
//         if (platform && platform !== 'all') { where.push(`LOWER(r.platform) = LOWER($${idx++})`); params.push(platform); }
//         if (brand_scope === 'prestige')     { where.push(`r.is_competitor = false`); }
//         if (brand_scope === 'competition')  { where.push(`r.is_competitor = true`);  }
//         if (date_from)                      { where.push(`r.review_date >= $${idx++}`); params.push(date_from); }
//         if (date_to)                        { where.push(`r.review_date <= $${idx++}`); params.push(date_to); }
//         if (rating_min)                     { where.push(`r.rating >= $${idx++}`);      params.push(rating_min); }
//         if (rating_max)                     { where.push(`r.rating <= $${idx++}`);      params.push(rating_max); }
//         if (sentiment)                      { where.push(`r.sentiment = $${idx++}`);    params.push(sentiment); }

//         const lim = Math.min(parseInt(limit, 10) || 100, 500);
//         const off = Math.max(parseInt(offset, 10) || 0, 0);

//         const [results, total] = await Promise.all([
//             pool.query(`
//                 SELECT r.id, r.web_pid, r.product_name, r.brand, r.platform,
//                        r.rating, r.review_title, r.review_text, r.review_date,
//                        r.sentiment, r.specific_issue, r.is_competitor
//                   FROM ratings.reviews r
//                  WHERE ${where.join(' AND ')}
//                  ORDER BY r.review_date DESC NULLS LAST
//                  LIMIT ${lim} OFFSET ${off}
//             `, params),
//             pool.query(`SELECT COUNT(*)::int AS n FROM ratings.reviews r WHERE ${where.join(' AND ')}`, params),
//         ]);

//         res.json({
//             query: q,
//             total: total.rows[0].n,
//             limit: lim,
//             offset: off,
//             results: results.rows,
//         });
//     } catch (err) {
//         console.error('review-search error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // 2) Theme drill-down — clicking on a Categories card jumps here.
// //    Returns: top affected SKUs, brand breakdown, trend, suggested team.
// // ============================================================================
// app.get('/api/ratings/issue/:name/drilldown', async (req, res) => {
//     try {
//         const name = req.params.name;
//         const { platform, date_from, date_to } = req.query;
//         const where = ['company_id = $1', '(specific_issue = $2 OR sentiment_category = $2 OR sentiment_subcategory = $2)'];
//         const params = [req.companyId, name];
//         let idx = 3;
//         if (platform && platform !== 'all') { where.push(`LOWER(platform) = LOWER($${idx++})`); params.push(platform); }
//         if (date_from) { where.push(`review_date >= $${idx++}`); params.push(date_from); }
//         if (date_to)   { where.push(`review_date <= $${idx++}`); params.push(date_to); }
//         const w = where.join(' AND ');

//         const [skus, brands, trend, samples] = await Promise.all([
//             // Top affected SKUs
//             pool.query(`
//                 SELECT web_pid, product_name, brand, platform,
//                        COUNT(*) AS reviews,
//                        ROUND(AVG(rating)::numeric, 2) AS avg_rating,
//                        COUNT(*) FILTER (WHERE sentiment = 'Negative') AS neg
//                   FROM ratings.reviews
//                  WHERE ${w} AND is_competitor = false
//                  GROUP BY web_pid, product_name, brand, platform
//                  ORDER BY reviews DESC LIMIT 20
//             `, params),
//             // Brand breakdown (Prestige vs competitors)
//             pool.query(`
//                 SELECT COALESCE(brand, 'Unknown') AS brand, is_competitor,
//                        COUNT(*) AS reviews,
//                        ROUND(AVG(rating)::numeric, 2) AS avg_rating
//                   FROM ratings.reviews
//                  WHERE ${w}
//                  GROUP BY brand, is_competitor
//                  ORDER BY reviews DESC LIMIT 15
//             `, params),
//             // Monthly trend
//             pool.query(`
//                 SELECT DATE_TRUNC('month', review_date)::date AS month,
//                        COUNT(*) AS reviews,
//                        ROUND(AVG(rating)::numeric, 2) AS avg_rating
//                   FROM ratings.reviews
//                  WHERE ${w} AND review_date IS NOT NULL
//                  GROUP BY 1 ORDER BY 1 DESC LIMIT 12
//             `, params),
//             // Sample verbatims (most recent negatives)
//             pool.query(`
//                 SELECT review_text, rating, review_date, brand, web_pid, product_name
//                   FROM ratings.reviews
//                  WHERE ${w} AND review_text IS NOT NULL
//                    AND LENGTH(review_text) > 20 AND rating <= 2
//                  ORDER BY review_date DESC NULLS LAST LIMIT 8
//             `, params),
//         ]);

//         // Suggested team — same mapping the email uses.
//         const TEAM_MAP = {
//             Stopped_Working:'QC', Manufacturing_Defects:'Production', Build_Quality:'Production',
//             Cheap_Quality:'Production', Coating_Issues:'Production', Lid_Issues:'Production',
//             Handle_Issues:'Production', Whistle_Issues:'QC',
//             Gas_Leakage:'QC (Safety)', Steam_Leakage:'QC',
//             Heating_Performance:'R&D', Cooking_Performance:'R&D', Motor_Performance:'R&D',
//             Poor_Service:'Customer Service',
//             Delivery_Issues:'Logistics', Damaged_In_Transit:'Logistics',
//             Overpriced:'Marketing',
//         };
//         res.json({
//             issue: name,
//             suggestedTeam: TEAM_MAP[name] || 'Quality / R&D',
//             topSkus: skus.rows,
//             brandBreakdown: brands.rows,
//             monthlyTrend: trend.rows,
//             sampleVerbatims: samples.rows,
//         });
//     } catch (err) {
//         console.error('issue-drilldown error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // 3) Bulk import for master_category / NPD designation. Accepts JSON body:
// //    { rows: [{ web_pid, master_category?, is_npd? }, ...] }
// //    Returns per-row status so the UI can show a preview / confirmation.
// // ============================================================================
// app.post('/api/ratings/products/bulk-import', async (req, res) => {
//     try {
//         const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
//         if (!rows) return res.status(400).json({ error: 'Body must include `rows: []`' });
//         if (rows.length > 10000) return res.status(400).json({ error: 'Max 10,000 rows per import' });

//         const ALLOWED_CATS = new Set([
//             'Pressure Cooker','Kadai','Fry Pan','Tawa','Dosa Tawa',
//             'Other Cookware','Cookware','Cookware Set','Gas Stove',
//             'Mixer Grinder','Kettle','Rice Cooker','Toaster & OTG','Air Fryer',
//             'Wet Grinder','Induction Cooktop','Sandwich Maker','Grill & Sandwich Maker',
//             'Hand Blender','Glasstops and Hobs','Food Processor','Juicer','Iron',
//             'Waffle Maker','Air Oven','Combo','Bottle',
//         ]);

//         const results = [];
//         let updated = 0, errored = 0, skipped = 0;
//         for (const row of rows) {
//             const webPid = String(row.web_pid || '').trim();
//             const masterCat = row.master_category ? String(row.master_category).trim() : null;
//             const isNpd = row.is_npd === true || row.is_npd === 'true' || row.is_npd === 1 || row.is_npd === '1';

//             if (!webPid) { results.push({ web_pid: webPid, status: 'error', reason: 'missing web_pid' }); errored++; continue; }
//             if (masterCat && !ALLOWED_CATS.has(masterCat)) {
//                 results.push({ web_pid: webPid, status: 'error', reason: `unknown category "${masterCat}"` });
//                 errored++; continue;
//             }

//             const sets = [];
//             const params = [req.companyId, webPid];
//             let pi = 3;
//             if (masterCat) {
//                 sets.push(`master_category = $${pi}`);
//                 sets.push(`category = $${pi}`);
//                 params.push(masterCat);
//                 pi++;
//             }
//             if (row.is_npd !== undefined) {
//                 // Setting NPD is fine; CLEARING the flag must revert NPD→Non-Pareto
//                 // WITHOUT demoting a genuine Pareto SKU (this toggle only governs NPD).
//                 sets.push(isNpd
//                     ? `pareto_status = 'NPD'`
//                     : `pareto_status = CASE WHEN pareto_status = 'NPD' THEN 'Non-Pareto' ELSE pareto_status END`);
//             }
//             if (sets.length === 0) {
//                 results.push({ web_pid: webPid, status: 'skipped', reason: 'no fields provided' });
//                 skipped++; continue;
//             }

//             const r = await pool.query(
//                 `UPDATE masters.products
//                     SET ${sets.join(', ')}, last_synced_at = NOW()
//                   WHERE company_id = $1 AND product_external_id = $2
//                  RETURNING id`,
//                 params
//             );
//             if (r.rowCount === 0) {
//                 results.push({ web_pid: webPid, status: 'error', reason: 'web_pid not found in master' });
//                 errored++;
//             } else {
//                 results.push({ web_pid: webPid, status: 'updated', changes: { masterCat, isNpd: row.is_npd !== undefined ? isNpd : undefined } });
//                 updated++;
//             }
//         }
//         res.json({ totalRows: rows.length, updated, errored, skipped, allowedCategories: [...ALLOWED_CATS], results });
//     } catch (err) {
//         console.error('bulk-import error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // 4a) Scope options for the alert-rule form. Drives the searchable dropdown
// //     that replaces the free-text scope_value input.
// //       type=product   -> {value: web_pid, label: product_name + (web_pid)}
// //       type=brand     -> {value: brand,   label: brand}
// //       type=category  -> {value: category, label: category}
// //     Optional ?q= filter, capped at 200 results.
// // ============================================================================
// app.get('/api/ratings/alert-scope-options', async (req, res) => {
//     try {
//         const { type, q } = req.query;
//         const term = q ? `%${String(q).trim()}%` : null;
//         let sql, params;
//         switch (type) {
//             case 'product': {
//                 sql = `
//                     SELECT product_external_id AS value,
//                            COALESCE(product_name, product_external_id) AS label,
//                            platform, brand_name AS brand, is_competitor
//                       FROM masters.products
//                      WHERE company_id = $1
//                        ${term ? 'AND (product_name ILIKE $2 OR product_external_id ILIKE $2 OR sku_code ILIKE $2)' : ''}
//                      ORDER BY product_name ASC NULLS LAST
//                      LIMIT 200`;
//                 params = term ? [req.companyId, term] : [req.companyId];
//                 break;
//             }
//             case 'brand': {
//                 sql = `
//                     SELECT DISTINCT brand_name AS value, brand_name AS label,
//                            BOOL_OR(is_competitor) AS is_competitor
//                       FROM masters.products
//                      WHERE company_id = $1 AND brand_name IS NOT NULL AND brand_name <> ''
//                        ${term ? 'AND brand_name ILIKE $2' : ''}
//                      GROUP BY brand_name
//                      ORDER BY brand_name ASC
//                      LIMIT 200`;
//                 params = term ? [req.companyId, term] : [req.companyId];
//                 break;
//             }
//             case 'category': {
//                 sql = `
//                     SELECT DISTINCT
//                        COALESCE(NULLIF(master_category,''), NULLIF(category,'')) AS value,
//                        COALESCE(NULLIF(master_category,''), NULLIF(category,'')) AS label
//                       FROM masters.products
//                      WHERE company_id = $1
//                        AND COALESCE(NULLIF(master_category,''), NULLIF(category,'')) IS NOT NULL
//                        ${term ? "AND COALESCE(NULLIF(master_category,''), NULLIF(category,'')) ILIKE $2" : ''}
//                      ORDER BY 1 ASC
//                      LIMIT 200`;
//                 params = term ? [req.companyId, term] : [req.companyId];
//                 break;
//             }
//             default:
//                 return res.status(400).json({ error: 'type must be product | brand | category' });
//         }
//         const { rows } = await pool.query(sql, params);
//         res.json({ options: rows });
//     } catch (err) {
//         console.error('alert-scope-options error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // 4) Price variance by brand within a master_category.
// //    Shows median MRP per brand + delta vs Prestige's median in the same segment.
// //    Drives the "₹X cheaper / costlier" chip in Competitor Insights.
// // ============================================================================
// app.get('/api/ratings/price-variance', async (req, res) => {
//     try {
//         const { category, platform } = req.query;
//         const where = ['mp.company_id = $1', 'mp.mrp IS NOT NULL', 'mp.mrp > 0'];
//         const params = [req.companyId];
//         let idx = 2;
//         if (category) { where.push(`mp.master_category ILIKE $${idx++}`); params.push(category); }
//         if (platform && platform !== 'all') {
//             where.push(`LOWER(mp.platform) = LOWER($${idx++})`);
//             params.push(platform);
//         }
//         const result = await pool.query(`
//             WITH base AS (
//                 SELECT mp.brand_name, mp.is_competitor, mp.master_category,
//                        COALESCE(ps.price_sp, mp.selling_price, ps.price_rp, mp.mrp) AS effective_price,
//                        mp.mrp
//                   FROM masters.products mp
//                   LEFT JOIN LATERAL (
//                       SELECT ps2.price_rp, ps2.price_sp
//                         FROM ratings.product_snapshots ps2
//                        WHERE ps2.company_id = mp.company_id
//                          AND ps2.web_pid = mp.product_external_id
//                          AND LOWER(ps2.platform) = LOWER(mp.platform)
//                        ORDER BY ps2.snapshot_date DESC LIMIT 1
//                   ) ps ON true
//                  WHERE ${where.join(' AND ')}
//                    AND mp.brand_name IS NOT NULL
//             ),
//             agg AS (
//                 SELECT brand_name, is_competitor, master_category,
//                        COUNT(*) AS sku_count,
//                        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY effective_price) AS median_price,
//                        MIN(effective_price) AS min_price,
//                        MAX(effective_price) AS max_price,
//                        AVG(effective_price) AS avg_price
//                   FROM base
//                  GROUP BY 1, 2, 3
//             ),
//             prestige_baseline AS (
//                 SELECT master_category, median_price
//                   FROM agg WHERE LOWER(brand_name) = 'prestige'
//             )
//             SELECT a.brand_name AS brand, a.is_competitor, a.master_category AS category,
//                    a.sku_count, ROUND(a.median_price::numeric, 0) AS median_price,
//                    ROUND(a.min_price::numeric, 0) AS min_price,
//                    ROUND(a.max_price::numeric, 0) AS max_price,
//                    ROUND(a.avg_price::numeric, 0) AS avg_price,
//                    ROUND(pb.median_price::numeric, 0) AS prestige_median,
//                    CASE WHEN pb.median_price IS NOT NULL AND pb.median_price > 0
//                         THEN ROUND(((a.median_price - pb.median_price) / pb.median_price * 100)::numeric, 1)
//                         ELSE NULL END AS pct_vs_prestige
//               FROM agg a
//               LEFT JOIN prestige_baseline pb ON pb.master_category = a.master_category
//              ORDER BY a.master_category, a.sku_count DESC
//         `, params);
//         res.json({ rows: result.rows });
//     } catch (err) {
//         console.error('price-variance error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // 4b) Star distribution per brand (or per SKU) in a category — drives the
// //     1★/2★/3★/4★/5★ comparison chart on Competitor Insights.
// //     Filter by category and (optionally) platform/web_pid.
// // ============================================================================
// app.get('/api/ratings/star-distribution', async (req, res) => {
//     try {
//         const { category, platform, web_pid } = req.query;
//         // Star distribution = the PDP's actual 5/4/3/2/1 rating breakdown (from
//         // ClickHouse five_star..one_star, stored in product_snapshots.star_distribution),
//         // NOT a count of the review rows we happened to crawl. The old review-count
//         // version badly under-represented Amazon (millions of PDP ratings vs ~7K
//         // crawled reviews) — which is why exec Amazon numbers never matched. PDP
//         // rating counts are cumulative/current, so this is not date-windowed.
//         const where = ['ps.company_id = $1', 'ps.star_distribution IS NOT NULL'];
//         const params = [req.companyId];
//         let idx = 2;
//         if (category) {
//             where.push(`COALESCE(NULLIF(mp.master_category,''), NULLIF(mp.category,''), NULLIF(ps.category,'')) ILIKE $${idx++}`);
//             params.push(category);
//         }
//         if (platform && platform !== 'all') {
//             where.push(`LOWER(ps.platform) = LOWER($${idx++})`);
//             params.push(platform);
//         }
//         if (web_pid) {
//             where.push(`UPPER(ps.web_pid) = UPPER($${idx++})`);
//             params.push(web_pid);
//         }
//         const { rows } = await pool.query(`
//             WITH latest AS (
//                 SELECT DISTINCT ON (ps.web_pid, LOWER(ps.platform))
//                     COALESCE(NULLIF(mp.brand_name,''), NULLIF(ps.brand,''), 'Unknown') AS brand,
//                     COALESCE(ps.is_competitor, mp.is_competitor, false) AS is_competitor,
//                     ps.star_distribution AS sd
//                 FROM ratings.product_snapshots ps
//                 LEFT JOIN masters.products mp
//                     ON mp.company_id = ps.company_id
//                    AND mp.product_external_id = ps.web_pid
//                    AND LOWER(mp.platform) = LOWER(ps.platform)
//                 WHERE ${where.join(' AND ')}
//                 ORDER BY ps.web_pid, LOWER(ps.platform), ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
//             )
//             SELECT brand, is_competitor,
//                 COALESCE(SUM((sd->>'1')::bigint),0) AS s1,
//                 COALESCE(SUM((sd->>'2')::bigint),0) AS s2,
//                 COALESCE(SUM((sd->>'3')::bigint),0) AS s3,
//                 COALESCE(SUM((sd->>'4')::bigint),0) AS s4,
//                 COALESCE(SUM((sd->>'5')::bigint),0) AS s5
//             FROM latest
//             GROUP BY brand, is_competitor
//         `, params);
//         // Pivot into per-brand distribution (merge by brand across is_competitor,
//         // matching the previous response shape).
//         const byBrand = new Map();
//         for (const r of rows) {
//             if (!byBrand.has(r.brand)) {
//                 byBrand.set(r.brand, { brand: r.brand, is_competitor: r.is_competitor, dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, total: 0 });
//             }
//             const e = byBrand.get(r.brand);
//             for (const s of [1, 2, 3, 4, 5]) {
//                 const c = parseInt(r['s' + s], 10) || 0;
//                 e.dist[s] += c;
//                 e.total += c;
//             }
//         }
//         const result = [...byBrand.values()].map(b => ({
//             brand: b.brand,
//             is_competitor: b.is_competitor,
//             total: b.total,
//             distribution: [1, 2, 3, 4, 5].map(s => ({
//                 star: s, count: b.dist[s] || 0,
//                 pct: b.total > 0 ? Math.round(100 * (b.dist[s] || 0) / b.total) : 0,
//             })),
//         })).sort((a, b) => b.total - a.total);
//         res.json({ brands: result });
//     } catch (err) {
//         console.error('star-distribution error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // GET /api/ratings/rating-mismatch — text-vs-star discrepancy detector.
// // The actual star is the customer's; ml_inferred_rating is the in-house model's
// // INDEPENDENT read of the review text, so the GAP between them is the signal:
// //   star_high_text_low (rating - ml >= gap): a hidden complaint behind a high
// //     star — quality/QC issue the rating masks.
// //   star_low_text_high (ml - rating >= gap): likely mis-rated / fake /
// //     delivery-anger review (text is positive, star isn't).
// // Filters mirror the rest of the dashboard. ?direction= filters one side;
// // ?min_gap= (default 2). Always returns a summary count of both sides.
// // ============================================================================
// app.get('/api/ratings/rating-mismatch', async (req, res) => {
//     try {
//         const { platform, category, web_pid, is_competitor, date_from, date_to, direction } = req.query;
//         const minGap = Math.max(1, Math.min(parseInt(req.query.min_gap, 10) || 2, 4));
//         const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 100, 500));

//         const baseWhere = ['r.company_id = $1', 'r.rating IS NOT NULL', 'r.ml_inferred_rating IS NOT NULL'];
//         const params = [req.companyId];
//         const add = (sqlFn, val) => { params.push(val); baseWhere.push(sqlFn(params.length)); };
//         if (platform && platform !== 'all') add(i => `LOWER(r.platform) = LOWER($${i})`, platform);
//         if (category) add(i => `COALESCE(NULLIF(mp.master_category,''), NULLIF(mp.category,''), NULLIF(r.category,'')) ILIKE $${i}`, category);
//         if (web_pid) add(i => `UPPER(r.web_pid) = UPPER($${i})`, web_pid);
//         if (is_competitor === 'true' || is_competitor === 'false') add(i => `r.is_competitor = $${i}`, is_competitor === 'true');
//         if (date_from) add(i => `r.review_date >= $${i}`, date_from);
//         if (date_to) add(i => `r.review_date <= $${i}`, date_to);
//         params.push(minGap); const gp = params.length;

//         let dirClause = `abs(r.rating - r.ml_inferred_rating) >= $${gp}`;
//         if (direction === 'star_high_text_low') dirClause = `(r.rating - r.ml_inferred_rating) >= $${gp}`;
//         else if (direction === 'star_low_text_high') dirClause = `(r.ml_inferred_rating - r.rating) >= $${gp}`;
//         params.push(limit); const lp = params.length;

//         const mp_join = `LEFT JOIN masters.products mp ON mp.product_external_id = r.web_pid AND mp.company_id = r.company_id AND LOWER(mp.platform) = LOWER(r.platform)`;
//         const { rows } = await pool.query(`
//             SELECT r.web_pid, r.product_name, r.platform, r.brand,
//                    r.rating, r.ml_inferred_rating,
//                    (r.rating - r.ml_inferred_rating) AS gap,
//                    r.sentiment, r.sentiment_category, r.review_title,
//                    left(r.review_text, 300) AS review_text, r.review_date,
//                    COALESCE(NULLIF(mp.master_category,''), NULLIF(mp.category,''), NULLIF(r.category,'')) AS category
//               FROM ratings.reviews r ${mp_join}
//              WHERE ${[...baseWhere, dirClause].join(' AND ')}
//              ORDER BY abs(r.rating - r.ml_inferred_rating) DESC, r.review_date DESC NULLS LAST
//              LIMIT $${lp}
//         `, params);

//         const sum = await pool.query(`
//             SELECT count(*) FILTER (WHERE (r.rating - r.ml_inferred_rating) >= $${gp}) AS star_high_text_low,
//                    count(*) FILTER (WHERE (r.ml_inferred_rating - r.rating) >= $${gp}) AS star_low_text_high
//               FROM ratings.reviews r ${mp_join}
//              WHERE ${baseWhere.join(' AND ')}
//         `, params.slice(0, gp));

//         res.json({
//             minGap,
//             summary: {
//                 star_high_text_low: parseInt(sum.rows[0].star_high_text_low, 10),
//                 star_low_text_high: parseInt(sum.rows[0].star_low_text_high, 10),
//             },
//             reviews: rows.map(r => ({
//                 ...r,
//                 rating: Number(r.rating),
//                 ml_inferred_rating: Number(r.ml_inferred_rating),
//                 gap: Number(r.gap),
//             })),
//         });
//     } catch (err) {
//         console.error('rating-mismatch error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // 4c) Review timeline — chronological reviews for one SKU with sentiment +
// //     rating, used by the "review timeline" drawer on the master tab.
// //     Limited to last 365 days to keep payload sane.
// // ============================================================================
// app.get('/api/ratings/review-timeline', async (req, res) => {
//     try {
//         const { web_pid, platform, limit = 500 } = req.query;
//         if (!web_pid) return res.status(400).json({ error: 'web_pid is required' });
//         const where = ['company_id = $1', 'web_pid = $2', "review_date >= NOW() - INTERVAL '365 days'"];
//         const params = [req.companyId, web_pid];
//         let idx = 3;
//         if (platform && platform !== 'all') {
//             where.push(`LOWER(platform) = LOWER($${idx++})`);
//             params.push(platform);
//         }
//         const lim = Math.min(parseInt(limit, 10) || 500, 2000);
//         const { rows } = await pool.query(`
//             SELECT id, rating, sentiment, review_date, review_title, review_text,
//                    specific_issue, sentiment_category, platform
//               FROM ratings.reviews
//              WHERE ${where.join(' AND ')}
//              ORDER BY review_date ASC
//              LIMIT ${lim}
//         `, params);

//         // Bucket by month for the chart line
//         const monthly = new Map();
//         for (const r of rows) {
//             if (!r.review_date) continue;
//             const m = String(r.review_date).slice(0, 7);
//             if (!monthly.has(m)) monthly.set(m, { month: m, count: 0, ratingSum: 0, neg: 0, pos: 0 });
//             const e = monthly.get(m);
//             e.count++;
//             if (r.rating != null) e.ratingSum += Number(r.rating);
//             if (r.sentiment === 'Negative') e.neg++;
//             if (r.sentiment === 'Positive') e.pos++;
//         }
//         const monthlyArr = [...monthly.values()].map(e => ({
//             month: e.month,
//             count: e.count,
//             avg_rating: e.count > 0 ? Math.round((e.ratingSum / e.count) * 100) / 100 : null,
//             neg_pct: e.count > 0 ? Math.round(100 * e.neg / e.count) : 0,
//             pos_pct: e.count > 0 ? Math.round(100 * e.pos / e.count) : 0,
//         }));

//         res.json({
//             web_pid,
//             total: rows.length,
//             monthly: monthlyArr,
//             reviews: rows,
//         });
//     } catch (err) {
//         console.error('review-timeline error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // 5) Weekly digest — Monday-morning style summary. Aggregates last 7d:
// //      - Top 5 declining SKUs (biggest week-over-week rating drop)
// //      - Top 5 improving SKUs
// //      - Top 5 issue categories by negative-review volume
// //      - Total review count, average rating, sentiment ratio
// //    Sends the same MJML digest framework. Triggerable manually now;
// //    a Temporal weekly schedule will wrap this later.
// // ============================================================================
// app.post('/api/automation/weekly-digest/send', async (req, res) => {
//     try {
//         const recipient = (req.body && req.body.to) || (req.authUser && req.authUser.email) || null;
//         const dashboardBase = process.env.PUBLIC_DASHBOARD_URL || 'https://prestige-review.up.railway.app';

//         // Top declining SKUs: compare last 7d avg rating vs prior 7d
//         const { rows: decliners } = await pool.query(`
//             WITH last_7 AS (
//               SELECT web_pid, product_name, brand, platform,
//                      AVG(rating)::numeric AS r, COUNT(*) AS n
//                 FROM ratings.reviews
//                WHERE company_id = $1 AND is_competitor = false
//                  AND review_date >= NOW() - INTERVAL '7 days'
//                  AND rating IS NOT NULL
//                GROUP BY 1,2,3,4 HAVING COUNT(*) >= 3
//             ),
//             prior_7 AS (
//               SELECT web_pid, AVG(rating)::numeric AS r
//                 FROM ratings.reviews
//                WHERE company_id = $1 AND is_competitor = false
//                  AND review_date >= NOW() - INTERVAL '14 days' AND review_date < NOW() - INTERVAL '7 days'
//                  AND rating IS NOT NULL
//                GROUP BY 1
//             )
//             SELECT l.web_pid, l.product_name, l.brand, l.platform,
//                    ROUND(p.r,2) AS prev_rating, ROUND(l.r,2) AS now_rating,
//                    ROUND((p.r - l.r),2) AS delta, l.n AS recent_reviews
//               FROM last_7 l JOIN prior_7 p ON p.web_pid = l.web_pid
//              WHERE p.r - l.r >= 0.3
//              ORDER BY (p.r - l.r) DESC LIMIT 5
//         `, [req.companyId]);

//         // Top improving SKUs
//         const { rows: improvers } = await pool.query(`
//             WITH last_7 AS (
//               SELECT web_pid, product_name, brand, platform,
//                      AVG(rating)::numeric AS r, COUNT(*) AS n
//                 FROM ratings.reviews
//                WHERE company_id = $1 AND is_competitor = false
//                  AND review_date >= NOW() - INTERVAL '7 days' AND rating IS NOT NULL
//                GROUP BY 1,2,3,4 HAVING COUNT(*) >= 3
//             ),
//             prior_7 AS (
//               SELECT web_pid, AVG(rating)::numeric AS r
//                 FROM ratings.reviews
//                WHERE company_id = $1 AND is_competitor = false
//                  AND review_date >= NOW() - INTERVAL '14 days' AND review_date < NOW() - INTERVAL '7 days'
//                  AND rating IS NOT NULL
//                GROUP BY 1
//             )
//             SELECT l.web_pid, l.product_name, l.brand, l.platform,
//                    ROUND(p.r,2) AS prev_rating, ROUND(l.r,2) AS now_rating,
//                    ROUND((l.r - p.r),2) AS delta, l.n AS recent_reviews
//               FROM last_7 l JOIN prior_7 p ON p.web_pid = l.web_pid
//              WHERE l.r - p.r >= 0.3
//              ORDER BY (l.r - p.r) DESC LIMIT 5
//         `, [req.companyId]);

//         // Top issue categories by negative-review volume
//         const { rows: hotIssues } = await pool.query(`
//             SELECT COALESCE(specific_issue, sentiment_category, 'Unknown') AS issue,
//                    COUNT(*) AS reviews,
//                    ROUND(AVG(rating)::numeric, 2) AS avg_rating
//               FROM ratings.reviews
//              WHERE company_id = $1
//                AND is_competitor = false
//                AND review_date >= NOW() - INTERVAL '7 days'
//                AND sentiment = 'Negative'
//                AND (specific_issue IS NOT NULL OR sentiment_category IS NOT NULL)
//              GROUP BY 1 ORDER BY reviews DESC LIMIT 5
//         `, [req.companyId]);

//         // Overall stats
//         const { rows: overall } = await pool.query(`
//             SELECT COUNT(*) AS reviews,
//                    ROUND(AVG(rating)::numeric, 2) AS avg_rating,
//                    ROUND(100.0 * COUNT(*) FILTER (WHERE sentiment='Positive') / NULLIF(COUNT(*),0), 0) AS pct_positive
//               FROM ratings.reviews
//              WHERE company_id = $1 AND is_competitor = false
//                AND review_date >= NOW() - INTERVAL '7 days'
//         `, [req.companyId]);

//         // Map the digest into the same event shape so we can reuse the MJML
//         // renderer. The "rule" header is synthetic.
//         const events = decliners.map((d, i) => ({
//             web_pid: d.web_pid,
//             product_name: d.product_name,
//             platform: d.platform,
//             previous_rating: Number(d.prev_rating),
//             current_rating: Number(d.now_rating),
//             delta: Number(d.delta),
//             reason: 'drop_delta',
//             specific_issue: hotIssues[i]?.issue,
//             sample_negatives: [],
//             rule_drop_delta: 0.3,
//         }));

//         const fakeRule = {
//             name: 'Weekly Rating Pulse',
//             scope_type: 'company',
//             scope_value: 'all',
//             drop_delta: 0.3,
//             absolute_floor: null,
//         };
//         const html = events.length > 0
//             ? await renderDigestHtml(fakeRule, events)
//             : `<p style="font-family:Arial">No notable declines this week. Average rating: ${overall[0].avg_rating}★ across ${overall[0].reviews} reviews.</p>`;

//         await sendAlertEmail({
//             to: recipient ? [recipient] : [],
//             subject: `[Ratings] Weekly pulse · ${overall[0].reviews} reviews · ${overall[0].pct_positive}% positive`,
//             html,
//             priority: 'normal',
//             threadKey: `weekly-digest-${req.companyId}`,
//         });

//         res.json({
//             success: true,
//             sentTo: recipient || '(default recipients)',
//             stats: {
//                 reviewsLast7d: parseInt(overall[0].reviews, 10),
//                 avgRating: Number(overall[0].avg_rating),
//                 pctPositive: parseInt(overall[0].pct_positive, 10),
//             },
//             decliners,
//             improvers,
//             hotIssues,
//         });
//     } catch (err) {
//         console.error('weekly-digest error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // Training-set size / readiness — admins watch this to know when fine-tuning is viable.
// app.get('/api/automation/training-set/stats', async (req, res) => {
//     try {
//         const { rows } = await pool.query(`
//             SELECT
//                 COUNT(*) AS total,
//                 COUNT(*) FILTER (WHERE approved_rating IS NOT NULL) AS with_rating,
//                 COUNT(*) FILTER (WHERE approved_sentiment IS NOT NULL) AS with_sentiment,
//                 COUNT(*) FILTER (WHERE approved_category IS NOT NULL) AS with_category,
//                 MIN(captured_at) AS first_at,
//                 MAX(captured_at) AS last_at
//               FROM ratings.ml_training_set
//              WHERE company_id = $1`,
//             [req.companyId]
//         );
//         const stats = rows[0];
//         // Conventional fine-tune viability cutoff: 3000 labelled rows per task.
//         const fineTuneViable = parseInt(stats.with_rating, 10) >= 3000;
//         res.json({ ...stats, fineTuneViable, fineTuneThreshold: 3000 });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // Export training set as JSONL for fine-tuning offline. Admins can pull a
// // snapshot whenever they want to run a fine-tune off-cluster.
// app.get('/api/automation/training-set/export', async (req, res) => {
//     try {
//         const { rows } = await pool.query(`
//             SELECT review_text, approved_rating, approved_sentiment,
//                    approved_category, approved_subcategory,
//                    user_rating, ml_confidence
//               FROM ratings.ml_training_set
//              WHERE company_id = $1
//              ORDER BY captured_at DESC`,
//             [req.companyId]
//         );
//         res.setHeader('Content-Type', 'application/x-ndjson');
//         res.setHeader('Content-Disposition', `attachment; filename="training-set-${Date.now()}.jsonl"`);
//         for (const r of rows) {
//             res.write(JSON.stringify({
//                 text: r.review_text,
//                 rating: r.approved_rating ? Number(r.approved_rating) : null,
//                 sentiment: r.approved_sentiment || null,
//                 category: r.approved_category || null,
//                 subcategory: r.approved_subcategory || null,
//                 user_rating: r.user_rating ? Number(r.user_rating) : null,
//                 ml_confidence: r.ml_confidence ? Number(r.ml_confidence) : null,
//             }) + '\n');
//         }
//         res.end();
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// app.put('/api/automation/mailer-settings', async (req, res) => {
//     try {
//         const updated = await putMailerSettings(pool, req.companyId, req.body || {});
//         res.json({ settings: updated });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // Send a test alert email — verifies SMTP works and shows the rich HTML
// // digest to the user without waiting for a real rating drop.
// app.post('/api/automation/test-mail', async (req, res) => {
//     try {
//         const { sendAlertEmail, isMailerConfigured } = require('./automation/mailer.cjs');
//         if (!isMailerConfigured()) {
//             return res.status(503).json({ error: 'SMTP not configured (set SMTP_HOST/USER/PASS env vars)' });
//         }

//         // Multi-SKU preview when caller asks for >1; default = 5 so admins
//         // see the consolidated digest layout (top stats + compact rows).
//         const requestedCount = Math.max(1, Math.min(parseInt(req.body?.count, 10) || 5, 10));

//         const { rows } = await pool.query(`
//             SELECT mp.product_external_id AS web_pid,
//                    mp.product_name,
//                    mp.platform,
//                    ps.rating         AS current_rating,
//                    ps.rating_count   AS rating_count,
//                    COALESCE(ps.category, mp.category)           AS category,
//                    COALESCE(ps.pareto_status, mp.pareto_status) AS pareto_status
//               FROM masters.products mp
//               JOIN ratings.product_snapshots ps
//                 ON ps.web_pid = mp.product_external_id
//                AND ps.company_id = mp.company_id
//                AND LOWER(ps.platform) = LOWER(mp.platform)
//              WHERE mp.company_id = $1
//                AND mp.is_competitor = false
//                AND ps.rating IS NOT NULL
//                AND ps.rating BETWEEN 1 AND 4
//              ORDER BY ps.rating ASC, ps.snapshot_date DESC
//              LIMIT $2
//         `, [req.companyId, requestedCount]);

//         const samples = rows.length ? rows : [{
//             web_pid: 'B0SAMPLE',
//             product_name: 'Sample Pressure Cooker',
//             platform: 'Amazon',
//             current_rating: 3.2,
//             rating_count: 1240,
//             category: 'Pressure Cooker',
//             pareto_status: 'Pareto',
//         }];

//         const issueRotation = ['Build_Quality', 'Stopped_Working', 'Heating_Performance',
//                                'Manufacturing_Defects', 'Whistle_Issues', 'Coating_Issues'];

//         // Build one event per sample SKU. For each, pull its real negative
//         // verbatim reviews so the digest is grounded in actual data.
//         const events = await Promise.all(samples.map(async (s, idx) => {
//             const previousRating = Math.min(5, Number(s.current_rating) + 0.6 + (idx * 0.05));
//             const trend = [];
//             for (let i = 13; i >= 0; i--) {
//                 const ratio = i / 13;
//                 trend.push(Number((previousRating - (previousRating - s.current_rating) * (1 - ratio)).toFixed(2)));
//             }
//             // 8-week trend: start a bit higher than previous_rating, smoothly drop to now
//             const weeklyTrend = [];
//             const weekStart = Math.min(5, previousRating + 0.3);
//             for (let w = 7; w >= 0; w--) {
//                 const ratio = w / 7;
//                 const noise = ((idx * 7 + w) % 5) * 0.02 - 0.04;
//                 weeklyTrend.push(Number((weekStart - (weekStart - s.current_rating) * (1 - ratio) + noise).toFixed(2)));
//             }
//             const { rows: negRows } = await pool.query(`
//                 SELECT review_text FROM ratings.reviews
//                  WHERE company_id = $1 AND web_pid = $2
//                    AND rating IS NOT NULL AND rating <= 2
//                    AND review_text IS NOT NULL AND LENGTH(review_text) > 20
//                  ORDER BY review_date DESC NULLS LAST LIMIT 3
//             `, [req.companyId, s.web_pid]);

//             return {
//                 web_pid: s.web_pid,
//                 product_name: s.product_name,
//                 platform: s.platform,
//                 previous_rating: previousRating,
//                 current_rating: Number(s.current_rating),
//                 delta: previousRating - Number(s.current_rating),
//                 reason: 'both',
//                 specific_issue: issueRotation[idx % issueRotation.length],
//                 trend,
//                 weekly_trend: weeklyTrend,
//                 sample_negatives: negRows.map(r => r.review_text),
//                 rule_absolute_floor: 4.0,
//                 rule_drop_delta: 0.5,
//                 // Fields that drive the grouped digest + Ratings column.
//                 category: s.category || null,
//                 pareto_status: s.pareto_status || null,
//                 rating_count: s.rating_count != null ? Number(s.rating_count) : null,
//             };
//         }));

//         const fakeRule = {
//             name: events.length > 1 ? `Multi-SKU test alert (${events.length} products)` : 'Test alert (preview)',
//             scope_type: events.length > 1 ? 'category' : 'product',
//             scope_value: events.length > 1 ? 'all' : events[0].web_pid,
//             absolute_floor: 4.0,
//             drop_delta: 0.5,
//         };

//         const html = await renderDigestHtml(fakeRule, events);
//         const recipient = (req.body && req.body.to) || (req.authUser && req.authUser.email) || null;

//         const subj = events.length > 1
//             ? `[Ratings TEST] ${events.length} products tripped · sample digest`
//             : `[Ratings TEST] Sample alert · ${events[0].product_name}`;

//         const forceCritical = req.body?.forceCritical === true;
//         if (forceCritical && events.length) {
//             events[0].current_rating = 1.5;
//             events[0].delta = (events[0].previous_rating || 4) - 1.5;
//         }
//         const worst = events.reduce((m, e) => {
//             const r = e.current_rating;
//             return r != null && r < (m ?? 99) ? r : m;
//         }, null);
//         const priority = (forceCritical || (worst != null && worst < 2)) ? 'high' : 'normal';

//         // Mailer settings drive everything from here — calendar opt-in,
//         // schedule preset, priority threshold, etc.
//         const mailerSettings = await getMailerSettings(pool, req.companyId);
//         const calCfg = mailerSettings.calendarInvite;
//         const shouldAttachCalendar = calCfg.enabled
//             && (!calCfg.onlyForCritical || priority === 'high');

//         let icsAttachment = null;
//         if (shouldAttachCalendar) {
//             const { buildCriticalAlertIcs } = require('./automation/icsBuilder.cjs');
//             icsAttachment = buildCriticalAlertIcs({
//                 ruleId: 'test-' + req.companyId,
//                 ruleName: fakeRule.name,
//                 events,
//                 dashboardUrl: events[0]?.web_pid
//                     ? `https://prestige-review.up.railway.app/?tab=master&web_pid=${encodeURIComponent(events[0].web_pid)}`
//                     : 'https://prestige-review.up.railway.app',
//                 organizerEmail: process.env.SMTP_USER,
//                 attendeeEmail: recipient || undefined,
//                 scheduledAt: resolveScheduledAt(calCfg.schedulePreset, calCfg.scheduleTimeHHMM),
//                 durationMinutes: calCfg.durationMinutes,
//                 reminderMinutes: calCfg.reminderMinutes,
//             });
//         }
//         await sendAlertEmail({
//             to: recipient ? [recipient] : [],
//             subject: subj.slice(0, 120),
//             html,
//             priority,
//             threadKey: `test-${req.companyId}`,
//             attachments: icsAttachment ? [icsAttachment] : undefined,
//         });

//         res.json({
//             success: true,
//             sentTo: recipient || '(default recipients)',
//             skuCount: events.length,
//             priority,
//             calendarInviteAttached: !!icsAttachment,
//         });
//     } catch (err) {
//         console.error('test-mail error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // Stage-scoped triggers — give /settings precise control over which stage of
// // the pipeline runs. All routed through Temporal (workflows defined in
// // temporal/src/workflows.ts).
// app.post('/api/automation/trigger-stage', async (req, res) => {
//     try {
//         const { stage } = req.body || {};
//         const STAGE_TO_WORKFLOW = {
//             sync:   'syncOnlyWorkflow',
//             alerts: 'alertCheckOnlyWorkflow',
//             full:   'dailyPipelineWorkflow',
//         };
//         const workflowName = STAGE_TO_WORKFLOW[stage];
//         if (!workflowName) {
//             return res.status(400).json({ error: `Unknown stage. Allowed: ${Object.keys(STAGE_TO_WORKFLOW).join(', ')}` });
//         }
//         let client;
//         try {
//             client = await getTemporalClient();
//         } catch (e) {
//             return res.status(503).json({ error: `Temporal unreachable: ${e.message}` });
//         }
//         const { taskQueue } = getTemporalConfig();
//         const workflowId = `manual-${stage}-${req.companyId}-${Date.now()}`;
//         const args = stage === 'full'
//             ? [{ companyId: req.companyId, triggerType: 'manual' }]
//             : [{ companyId: req.companyId }];
//         const handle = await client.workflow.start(workflowName, {
//             taskQueue,
//             workflowId,
//             args,
//         });
//         res.json({ success: true, stage, workflowId: handle.workflowId, runId: handle.firstExecutionRunId });
//     } catch (err) {
//         console.error('trigger-stage error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// app.post('/api/automation/jobs/:id/cancel', async (req, res) => {
//     // We can't actually SIGTERM a child process from a stateless HTTP handler
//     // (the spawn lives in a different request's closure), so cancellation is
//     // recorded as "marked failed" — the next health-poll will surface this and
//     // any future Temporal redeploy reaps the actual process. This matches the
//     // pattern we already use for stale jobs.
//     try {
//         const { rows } = await pool.query(
//             `UPDATE ratings.ml_jobs_log
//                 SET status = 'FAILED',
//                     completed_at = NOW(),
//                     logs = COALESCE(logs,'') || E'\n[System] Cancelled by user.\n'
//               WHERE id = $1 AND company_id = $2 AND status = 'RUNNING'
//               RETURNING id`,
//             [req.params.id, req.companyId]
//         );
//         if (!rows.length) return res.status(404).json({ error: 'Job not running or not found' });
//         res.json({ success: true, jobId: rows[0].id });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // MASTER CONFIG INTELLIGENCE
// // ============================================================================

// app.post('/api/ml/master-enrich', async (req, res) => {
//     try {
//         const { product_description, product_name } = req.body;
//         if (!product_description && !product_name) {
//             return res.json({ error: 'not enough data to detect' });
//         }
        
//         const combined = `${product_name || ''} ${product_description || ''}`;
        
//         // Dynamically source the Material domain from the authoritative ML Config dictionary
//         const matRes = await pool.query(`SELECT dict_value as material FROM ratings.ml_dictionary WHERE dict_type = 'material'`);
//         const MATERIALS = matRes.rows.map(r => r.material).filter(m => m.trim().length > 0);
        
//         let ml_material = null;
//         if (MATERIALS.length > 0) {
//             // Sort by length descending to match larger phrases first ('Stainless Steel' before 'Steel')
//             const sortedMaterials = MATERIALS.sort((a,b) => b.length - a.length);
//             const matMatch = combined.match(new RegExp(`\\b(${sortedMaterials.join('|')})\\b`, 'i'));
//             if (matMatch) {
//                 ml_material = matMatch[1].replace(/\w\S*/g, w => (w.replace(/^\w/, c => c.toUpperCase())));
//             }
//         }
        
//         const watMatch = combined.match(/\b(\d+(?:[.,]\d+)?\s*(?:W|Watts|kw|kilowatt))\b/i);
//         const ml_wattage = watMatch ? watMatch[1].toUpperCase() : null;

//         // If either is completely missing, explicitly fail safely rather than hallucinating
//         if (!ml_material || !ml_wattage) {
//             return res.json({ 
//                 success: false, 
//                 error: 'not enough data to detect',
//                 details: { found_material: ml_material, found_wattage: ml_wattage }
//             });
//         }

//         res.json({
//             success: true,
//             material: ml_material,
//             wattage: ml_wattage
//         });

//     } catch (err) {
//         console.error('Master Enrich Error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // DATA LAKE / RAW EDITOR ENDPOINTS
// // ============================================================================

// // 1. Export Full Data Lake Results as CSV (Paginated Server-Stream)
// app.get('/api/data-lake/export', async (req, res) => {
//     try {
//         const {
//             filterBlankCategory,
//             filterBlankSentiment,
//             filterCompetitor,
//             searchQuery,
//             price_mode,
//             price_min,
//             price_max,
//             platform,
//             category
//         } = req.query;

//         let where = ['r.company_id = $1'];
//         let params = [req.companyId];
//         let idx = 2;

//         if (filterBlankCategory === 'true') {
//             where.push(`(TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''), NULLIF(r.category, ''))) IS NULL OR TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''), NULLIF(r.category, ''))) ILIKE '%Uncategorized%')`);
//         }
//         if (filterBlankSentiment === 'true') {
//             where.push(`(r.sentiment_subcategory IS NULL OR r.sentiment_subcategory = '')`);
//         }
//         if (filterCompetitor === 'true') {
//             where.push(`r.is_competitor = true`);
//         }
//         if (searchQuery) {
//             where.push(`(r.review_text ILIKE $${idx} OR r.product_name ILIKE $${idx} OR r.web_pid ILIKE $${idx} OR r.brand ILIKE $${idx})`);
//             params.push(`%${searchQuery}%`);
//             idx++;
//         }
//         if (platform && platform !== 'all') {
//             where.push(`r.platform ILIKE $${idx}`);
//             params.push(platform);
//             idx++;
//         }
//         if (category) {
//             where.push(`TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''), NULLIF(r.category, ''))) ILIKE $${idx}`);
//             params.push(category);
//             idx++;
//         }
//         if (price_min !== undefined && price_min !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             where.push(`${priceExpr} >= $${idx}`);
//             params.push(Number(price_min));
//             idx++;
//         }
//         if (price_max !== undefined && price_max !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             where.push(`${priceExpr} <= $${idx}`);
//             params.push(Number(price_max));
//             idx++;
//         }

//         const sql = `
//             WITH latest_snapshots AS (
//                 SELECT DISTINCT ON (company_id, LOWER(platform), web_pid) *
//                 FROM ratings.product_snapshots
//                 WHERE company_id = $1
//                 ORDER BY company_id, LOWER(platform), web_pid, snapshot_date DESC, created_at DESC NULLS LAST
//             )
//             SELECT 
//                 r.web_pid as "ID",
//                 COALESCE(ps.product_name, r.product_name) as "Description",
//                 COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''), NULLIF(r.category, '')) as "Product Category",
//                 r.platform as "Platform",
//                 r.id as "Review ID",
//                 r.review_text as "Review Text",
//                 r.rating as "Review Rating",
//                 r.ml_inferred_rating as "AI Imputed Rating",
//                 COALESCE(ps.rating, r.pdp_rating) as "PDP Rating",
//                 COALESCE(ps.rating_count, r.pdp_rating_count) as "Global Rating Count",
//                 COALESCE((ps.star_distribution->>'1'), (r.star_distribution->>'1')) as "1 Star Count",
//                 COALESCE((ps.star_distribution->>'2'), (r.star_distribution->>'2')) as "2 Star Count",
//                 COALESCE((ps.star_distribution->>'3'), (r.star_distribution->>'3')) as "3 Star Count",
//                 COALESCE((ps.star_distribution->>'4'), (r.star_distribution->>'4')) as "4 Star Count",
//                 COALESCE((ps.star_distribution->>'5'), (r.star_distribution->>'5')) as "5 Star Count",
//                 r.review_date as "Review Date",
//                 r.sentiment as "Sentiment Category",
//                 mp.subcategory as "Subcategory L1",
//                 r.brand as "Brand",
//                 r.is_competitor as "Is Competitor"
//             FROM ratings.reviews r
//             LEFT JOIN latest_snapshots ps ON ps.company_id = r.company_id AND ps.web_pid = r.web_pid AND LOWER(ps.platform) = LOWER(r.platform)
//             LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
//             WHERE ${where.join(' AND ')}
//             ORDER BY r.review_date DESC NULLS LAST
//             LIMIT $${idx++} OFFSET $${idx++}
//         `;
        
//         res.setHeader('Content-Type', 'text/csv; charset=utf-8');
//         res.setHeader('Content-Disposition', `attachment; filename="datalake_export_${Date.now()}.csv"`);
        
//         const headers = [
//             'ID', 'Description', 'Product Category', 'Platform', 'Review ID', 'Review Text', 
//             'Review Rating', 'AI Imputed Rating', 'PDP Rating', 'Global Rating Count', 
//             '1 Star Count', '2 Star Count', '3 Star Count', '4 Star Count', '5 Star Count', 
//             'Review Date', 'Sentiment Category', 'Subcategory L1', 'Brand', 'Is Competitor'
//         ];
//         res.write(headers.join(',') + '\n');

//         const limit = 20000;
//         let offset = 0;
//         let keepFetching = true;

//         while (keepFetching) {
//             const batchParams = [...params, limit, offset];
//             const { rows } = await pool.query(sql, batchParams);
            
//             if (rows.length === 0) {
//                 keepFetching = false;
//                 break;
//             }
            
//             let chunk = '';
//             for (const row of rows) {
//                 const rowData = headers.map(h => {
//                     const val = row[h];
//                     if (val === null || val === undefined) return '';
//                     return `"${String(val).replace(/"/g, '""')}"`;
//                 });
//                 chunk += rowData.join(',') + '\n';
//             }
//             res.write(chunk);
//             offset += limit;
//         }
//         res.end();
//     } catch (err) {
//         console.error('Data Lake export error:', err);
//         if (!res.headersSent) res.status(500).json({ error: err.message });
//         else res.end();
//     }
// });

// // 1. Fetch Paginated Raw Data (With Filters for "Blank" / "Uncategorized")
// app.get('/api/data-lake/reviews', async (req, res) => {
//     try {
//         const {
//             limit: queryLimit,
//             offset: queryOffset,
//             filterBlankCategory,
//             filterBlankSentiment,
//             filterCompetitor,
//             searchQuery,
//             price_mode,
//             price_min,
//             price_max,
//             platform,
//             category,
//             date_from,
//             date_to
//         } = req.query;

//         let where = ['r.company_id = $1'];
//         let params = [req.companyId];
//         let idx = 2;

//         if (filterBlankCategory === 'true') {
//             where.push(`(TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''), NULLIF(r.category, ''))) IS NULL OR TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''), NULLIF(r.category, ''))) ILIKE '%Uncategorized%')`);
//         }
//         if (filterBlankSentiment === 'true') {
//             where.push(`(r.sentiment_subcategory IS NULL OR r.sentiment_subcategory = '')`);
//         }
//         if (filterCompetitor === 'true') {
//             where.push(`r.is_competitor = true`);
//         }
//         if (searchQuery) {
//             where.push(`(r.review_text ILIKE $${idx} OR r.product_name ILIKE $${idx} OR r.web_pid ILIKE $${idx} OR r.brand ILIKE $${idx})`);
//             params.push(`%${searchQuery}%`);
//             idx++;
//         }
//         if (platform && platform !== 'all') {
//             where.push(`r.platform ILIKE $${idx}`);
//             params.push(platform);
//             idx++;
//         }
//         if (category) {
//             where.push(`COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE $${idx}`);
//             params.push(category);
//             idx++;
//         }
//         if (date_from) {
//             where.push(`r.review_date >= $${idx}`);
//             params.push(date_from);
//             idx++;
//         }
//         if (date_to) {
//             where.push(`r.review_date <= $${idx}`);
//             params.push(date_to);
//             idx++;
//         }
//         if (price_min !== undefined && price_min !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             where.push(`${priceExpr} >= $${idx}`);
//             params.push(Number(price_min));
//             idx++;
//         }
//         if (price_max !== undefined && price_max !== '') {
//             const priceExpr = price_mode === 'rp'
//                 ? 'COALESCE(ps.price_rp, mp.mrp)'
//                 : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
//             where.push(`${priceExpr} <= $${idx}`);
//             params.push(Number(price_max));
//             idx++;
//         }

//         const limit = parseInt(queryLimit) || 100;
//         const offset = parseInt(queryOffset) || 0;

//         const sql = `
//             SELECT r.*,
//                    COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) as derived_category
//             FROM ratings.reviews r
//             LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
//             LEFT JOIN LATERAL (
//                 SELECT ps2.price_rp, ps2.price_sp, ps2.category
//                 FROM ratings.product_snapshots ps2
//                 WHERE ps2.company_id = r.company_id AND ps2.web_pid = r.web_pid
//                 ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
//                 LIMIT 1
//             ) ps ON true
//             WHERE ${where.join(' AND ')}
//             ORDER BY r.review_date DESC NULLS LAST
//             LIMIT $${idx++} OFFSET $${idx++}
//         `;
//         params.push(limit, offset);

//         const { rows } = await pool.query(sql, params);

//         const countSql = `
//             SELECT 
//                 count(*) as total,
//                 avg(r.rating) as avg_rating,
//                 count(DISTINCT COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))) as unique_categories,
//                 sum(CASE WHEN COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) IS NULL OR COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) = '' OR COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE '%Uncategorized%' THEN 1 ELSE 0 END) as blank_categories,
//                 sum(CASE WHEN r.sentiment_subcategory IS NULL OR r.sentiment_subcategory = '' THEN 1 ELSE 0 END) as blank_sentiments
//             FROM ratings.reviews r
//               LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
//               LEFT JOIN LATERAL (
//                   SELECT ps2.price_rp, ps2.price_sp, ps2.category, ps2.pareto_status, ps2.rating
//                   FROM ratings.product_snapshots ps2
//                   WHERE ps2.company_id = r.company_id AND ps2.web_pid = r.web_pid
//                   ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
//                   LIMIT 1
//             ) ps ON true
//             WHERE ${where.join(' AND ')}
//         `;
//         const countParams = params.slice(0, params.length - 2);
//         const { rows: countRows } = await pool.query(countSql, countParams);

//         res.json({
//             data: rows,
//             total: parseInt(countRows[0].total) || 0,
//             metrics: {
//                 avgRating: parseFloat(countRows[0].avg_rating) || 0,
//                 uniqueCategories: parseInt(countRows[0].unique_categories) || 0,
//                 blankCategories: parseInt(countRows[0].blank_categories) || 0,
//                 blankSentiments: parseInt(countRows[0].blank_sentiments) || 0
//             },
//             limit,
//             offset,
//         });
//     } catch (err) {
//         console.error('Data Lake read error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // 2. Edit a single row directly
// app.post('/api/data-lake/reviews/edit', async (req, res) => {
//     try {
//         const { id, category, sentiment, specific_issue, material, wattage } = req.body;
//         if (!id) return res.status(400).json({ error: 'id is required' });

//         // Manual user edit — stamp the source so the next sync/ML run won't clobber it.
//         await pool.query(`
//             UPDATE ratings.reviews
//             SET
//                 category              = $1,
//                 category_source       = CASE WHEN $1 IS DISTINCT FROM category THEN 'user' ELSE category_source END,
//                 sentiment             = $2,
//                 sentiment_source      = CASE WHEN $2 IS DISTINCT FROM sentiment THEN 'user' ELSE sentiment_source END,
//                 specific_issue        = $3,
//                 specific_issue_source = CASE WHEN $3 IS DISTINCT FROM specific_issue THEN 'user' ELSE specific_issue_source END,
//                 material              = $4,
//                 wattage               = $5,
//                 updated_at            = NOW()
//             WHERE id = $6 AND company_id = $7
//         `, [category, sentiment, specific_issue, material, wattage, id, req.companyId]);

//         res.json({ success: true, message: 'Row updated.' });
//     } catch (err) {
//         console.error('Data Lake edit error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // 3. Bulk Delete rows
// app.post('/api/data-lake/reviews/bulk-delete', async (req, res) => {
//     try {
//         const { ids } = req.body;
//         if (!Array.isArray(ids) || ids.length === 0) {
//             return res.status(400).json({ error: 'Array of ids required' });
//         }

//         const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
//         await pool.query(`DELETE FROM ratings.reviews WHERE company_id = $1 AND id IN (${placeholders})`, [req.companyId, ...ids]);
        
//         res.json({ success: true, message: `Deleted ${ids.length} rows.` });
//     } catch (err) {
//         console.error('Data Lake delete error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // 4. Trigger ML Bulk Process against Specific IDs (Inline for Vercel Serverless)
// app.post('/api/ml-audit/bulk-trigger', async (req, res) => {
//     try {
//         const { ids } = req.body;
//         if (!Array.isArray(ids) || ids.length === 0) {
//             return res.status(400).json({ error: 'Array of ids required' });
//         }
        
//         // 1. Fetch source rows
//         const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
//         const { rows } = await pool.query(
//             `SELECT id, product_name, review_text, rating, sentiment, specific_issue, category, material, wattage 
//              FROM ratings.reviews 
//              WHERE company_id = $1 AND id IN (${placeholders})`,
//             [req.companyId, ...ids]
//         );

//         if (rows.length === 0) {
//             return res.json({ success: true, message: 'No rows found.' });
//         }

//         // 2. Prepare API Call to Gemini
//         const apiKey = process.env.GEMINI_API_KEY;
//         if (!apiKey) {
//             return res.status(500).json({ error: 'GEMINI_API_KEY is missing.' });
//         }

//         console.log(`[ML Bulk] Sending ${rows.length} rows to Gemini...`);
//         const payloadData = rows.map(r => ({
//             id: r.id, 
//             product: r.product_name, 
//             text: r.review_text, 
//             rating: r.rating 
//         }));

//         // 1.5 Fetch Stakeholder Subcategories to enforce strict mapping
//         const { rows: ruleRows } = await pool.query(
//             `SELECT sentiment_subcategory FROM ratings.stakeholder_mappings WHERE company_id = $1`,
//             [req.companyId]
//         );
//         const subcategoriesList = ruleRows.map(r => r.sentiment_subcategory).join("', '");
//         const subcategoriesGuidance = ruleRows.length > 0 
//             ? `If an issue is present, MUST STRICTLY be one of the following exact strings: ['${subcategoriesList}']. If no issue, return empty string.` 
//             : `If a problem is discussed. Else empty string.`;

//         const prompt = `
//         You are a Data Quality Auditor for an E-Commerce Analytics platform.
//         You are given a JSON array of product reviews.
//         For each review, analyze it and return a strict JSON array of objects.
//         Required JSON Object keys for each array item:
//         - id: Exact string id provided
//         - category: The assigned product category based on product name (e.g. 'Mixer Grinder', 'Cookware Set', 'Gas Stove', 'Kettle'). MUST NOT BE EMPTY.
//         - material: If Cookware, extract exact material ('Aluminium', 'Stainless Steel', 'Hard Anodised', 'Cast Iron', 'Triply'). Else empty string.
//         - wattage: If Electric Appliance, exact wattage ('500W', '750W', '1000W', '1200W'). Else empty string.
//         - sentiment: Strictly 'Positive', 'Negative', or 'Neutral' based on review text. MUST NOT BE EMPTY. Format in Title Case.
//         - specific_issue: ${subcategoriesGuidance}
//         - confidence_score: 1 to 10 numerical quality score based on your classification confidence.
//         - reasoning: Brief 1-sentence reasoning for the classification.
        
//         Reviews to analyze:
//         ${JSON.stringify(payloadData)}
//         `;

//         const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 contents: [{ parts: [{ text: prompt }] }],
//                 generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
//             })
//         });

//         const gRes = await response.json();
//         const rawText = gRes.candidates?.[0]?.content?.parts?.[0]?.text;
        
//         if (!rawText) {
//             throw new Error('Gemini API did not return readable text.');
//         }

//         const mlResults = JSON.parse(rawText);
//         let inserted = 0;
//         const { rows: existingAuditRows } = await pool.query(
//             `SELECT review_id FROM ratings.reviews_ml_audit WHERE company_id = $1 AND review_id = ANY($2::uuid[])`,
//             [req.companyId, rows.map(r => r.id)]
//         );
//         const existingAuditIds = new Set(existingAuditRows.map(r => String(r.review_id)));

//         // 3. Insert into the safe QC Tracker table
//         for (const mlResult of mlResults) {
//             const originalRow = rows.find(r => r.id === mlResult.id);
//             if (!originalRow || existingAuditIds.has(String(originalRow.id))) continue;

//             await pool.query(`
//                 INSERT INTO ratings.reviews_ml_audit (
//                     review_id, company_id, product_name, review_text,
//                     original_category, ml_category,
//                     original_material, ml_material,
//                     original_wattage, ml_wattage,
//                     original_user_rating, original_sentiment, ml_sentiment,
//                     original_issue, ml_issue, ml_confidence_score, ml_reasoning
//                 ) VALUES (
//                     $1, $2, $3, $4,
//                     $5, $6, $7, $8, $9, $10,
//                     $11, $12, $13, $14, $15, $16, $17
//                 )
//             `, [
//                 originalRow.id, req.companyId, originalRow.product_name, originalRow.review_text,
//                 originalRow.category, mlResult.category,
//                 originalRow.material, mlResult.material || null,
//                 originalRow.wattage, mlResult.wattage || null,
//                 originalRow.rating, originalRow.sentiment, mlResult.sentiment,
//                 originalRow.specific_issue, mlResult.specific_issue || null, mlResult.confidence_score, mlResult.reasoning
//             ]);
//             inserted++;
//         }

//         res.json({ success: true, message: `Audited ${inserted} rows successfully and pushed to QC Tracker.` });
//     } catch (err) {
//         console.error('Data Lake bulk trigger error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================================
// // START SERVER (local development) or EXPORT (Vercel/Railway serverless)
// // ============================================================================
// if (!process.env.VERCEL) {
//     const path = require('path');
    
//     // Serve static files from the React dist directory
//     app.use(express.static(path.join(__dirname, '../dist')));
    
//     // Catch-all route to serve index.html for React Router (skip API routes)
//     app.use((req, res, next) => {
//         if (req.path.startsWith('/api/')) return next();
//         res.sendFile(path.join(__dirname, '../dist', 'index.html'));
//     });

//     const PORT = process.env.PORT || process.env.API_PORT || 3001;
//     app.listen(PORT, () => {
//         console.log(`Ratings Platform running on port ${PORT}`);
//         console.log(`  DB: ${pool.options.host}/${pool.options.database}`);

//         // Reconcile any ml_jobs_log rows still marked RUNNING from a previous
//         // process — they're orphaned because the close/timeout handlers in
//         // spawnJob.cjs never fired across the restart boundary.
//         try {
//             const { reconcileOrphanedJobs } = require('./automation/spawnJob.cjs');
//             reconcileOrphanedJobs({ pool, reason: 'api server restarted' }).catch(e =>
//                 console.error('[ml-jobs] reconcile failed:', e.message)
//             );
//         } catch (e) {
//             console.error('[ml-jobs] reconcile import failed:', e.message);
//         }

//         // Boot the cache pre-warmer. Auto-generates a per-process token if
//         // INTERNAL_PREWARM_TOKEN isn't set, so the warmer works out of the
//         // box without any env config — token never leaves this process.
//         if (!process.env.INTERNAL_PREWARM_TOKEN) {
//             process.env.INTERNAL_PREWARM_TOKEN = crypto.randomBytes(32).toString('hex');
//         }
//         try {
//             const { start: startPrewarmer } = require('./cachePrewarmer.cjs');
//             startPrewarmer({ port: PORT, pool, internalToken: process.env.INTERNAL_PREWARM_TOKEN });
//         } catch (e) {
//             console.error('[prewarm] failed to start:', e.message);
//         }
//     });
// }

// module.exports = app;
