/**
 * Cache pre-warmer — keeps the heavy aggregation endpoints permanently
 * warm in RESPONSE_CACHE so even the first user of the minute gets a
 * sub-second response instead of paying the 1-3s SQL cost.
 *
 * Strategy: every 50s (just under the 60s cache TTL), enumerate active
 * companies and replay the dashboard's default-load query set against
 * each company's cache namespace. Calls back into the same Express
 * server over HTTP using a shared internal token, so the same cache
 * middleware that serves real users populates the cache here.
 */
const PREWARM_INTERVAL_MS = 50 * 1000;
const REQUEST_TIMEOUT_MS = 30 * 1000;

// The set of endpoints + default query strings that the dashboard fires on
// first paint. Order matters for serial execution: cheapest first so any
// catastrophic failure is visible early.
const PREWARM_QUERIES = [
    '/api/ratings/platform-options',
    '/api/ratings/categories',
    '/api/ratings/sentiment-categories',
    '/api/ratings/price-ranges',
    '/api/ratings/competitor-brands',
    '/api/ratings/brand-config',
    '/api/ratings/spec-type-mappings',
    '/api/ratings/product-categories',
    '/api/ratings/summary?period_months=6&is_competitor=all',
    '/api/ratings/summary?period_months=6&is_competitor=false',
    '/api/ratings/summary?period_months=6&is_competitor=true',
    '/api/ratings/category-health?period_months=6&is_competitor=false',
    '/api/ratings/category-health?period_months=6&is_competitor=all',
    '/api/ratings/executive-health?period_months=6&is_competitor=false',
    '/api/ratings/issues-breakdown?period_months=6&is_competitor=false',
    '/api/ratings/trends?period_months=6&is_competitor=false',
    '/api/ratings/product-health?period_months=6&is_competitor=false',
    '/api/ratings/timeline?period_months=6&is_competitor=false',
    '/api/ratings/benchmark-data?period_months=6&is_competitor=false',
    '/api/ratings/competitor-matrix',
];

async function fetchActiveCompanyIds(pool) {
    // Companies that have at least one user attached are the only ones whose
    // dashboards anyone can load — no point pre-warming the rest.
    const { rows } = await pool.query(`
        SELECT DISTINCT c.id
        FROM companies c
        WHERE EXISTS (SELECT 1 FROM ratings.user_company_memberships m WHERE m.company_id = c.id)
    `);
    return rows.map(r => r.id);
}

async function warmOne(baseUrl, companyId, path, internalToken) {
    // ?_refresh=1 tells the cache middleware to ALWAYS run the MISS path and
    // re-write the entry — otherwise pre-warm cycles 2+ would hit the cache,
    // return 138ms (HIT), and never refresh the TTL. Cache would expire
    // mid-day and the first real user pays the cold cost.
    const sep = path.includes('?') ? '&' : '?';
    const url = `${baseUrl}${path}${sep}company_id=${companyId}&_refresh=1`;
    const t = Date.now();
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
        const res = await fetch(url, {
            headers: {
                'x-internal-prewarm': internalToken,
                'x-company-id': companyId,
                'accept-encoding': 'gzip, br',
            },
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        // Drain body so the server actually finishes the response cycle.
        await res.arrayBuffer();
        return { ok: res.ok, ms: Date.now() - t, status: res.status };
    } catch (e) {
        return { ok: false, ms: Date.now() - t, error: e.message };
    }
}

let runningCycle = false;
async function runCycle({ baseUrl, pool, internalToken }) {
    if (runningCycle) return; // skip if previous cycle still in flight
    runningCycle = true;
    const startedAt = Date.now();
    try {
        const companyIds = await fetchActiveCompanyIds(pool);
        // PARALLEL fan-out — was sequential (~38s/cycle); now ~5s for the
        // longest single query. Postgres pool sized to handle 20 concurrent
        // reads with margin.
        const tasks = [];
        for (const cid of companyIds) {
            for (const path of PREWARM_QUERIES) {
                tasks.push(warmOne(baseUrl, cid, path, internalToken));
            }
        }
        const results = await Promise.all(tasks);
        const warmed = results.filter(r => r.ok).length;
        const failed = results.length - warmed;
        const slowest = results.reduce((m, r) => Math.max(m, r.ms || 0), 0);
        console.log(`[prewarm] ${companyIds.length} co × ${PREWARM_QUERIES.length} paths · ${warmed} ok / ${failed} fail · ${Date.now() - startedAt}ms (slowest: ${slowest}ms)`);
    } catch (e) {
        console.log('[prewarm] cycle failed:', e.message);
    } finally {
        runningCycle = false;
    }
}

function start({ port, pool, internalToken }) {
    const baseUrl = `http://127.0.0.1:${port}`;
    // First cycle 5s after start so the server has finished binding + auth setup.
    setTimeout(() => {
        runCycle({ baseUrl, pool, internalToken });
        setInterval(() => runCycle({ baseUrl, pool, internalToken }), PREWARM_INTERVAL_MS);
    }, 5000);
    console.log(`[prewarm] scheduled — ${PREWARM_QUERIES.length} queries × N companies every ${PREWARM_INTERVAL_MS}ms`);
}

module.exports = { start, PREWARM_QUERIES };
