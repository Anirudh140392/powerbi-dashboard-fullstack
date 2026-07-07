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
// Must exceed the server's statement_timeout (120s) so a slow warm waits for the
// query to finish (or be cancelled) instead of aborting early. An early abort
// here does NOT stop the SQL on the server — that orphaned query was exactly the
// pile-up that wedged the dashboard (every 50s another copy stacked on top).
const REQUEST_TIMEOUT_MS = 125 * 1000;
// Max warm requests in flight at once. Bounds the burst so a cycle can't saturate
// the DB pool the moment it fires.
const MAX_CONCURRENCY = 6;
// Single-flight guard: a (company|path) still running from a previous cycle is
// skipped this cycle instead of firing a duplicate on top of it.
const inFlight = new Set();

// Filter-OPTION endpoints: heavy DISTINCT/GROUP BY scans whose results barely
// change day-to-day. They get a long server cache TTL (STABLE_CACHE_TTL_MS, 15m)
// and are only re-warmed every STABLE_EVERY cycles (~10m) instead of every 50s —
// the single biggest cut to steady-state background DB load.
const STABLE_QUERIES = [
    '/api/ratings/platform-options',
    '/api/ratings/categories',
    '/api/ratings/sentiment-categories',
    '/api/ratings/price-ranges',
    '/api/ratings/competitor-brands',
    '/api/ratings/brand-config',
    '/api/ratings/spec-type-mappings',
    '/api/ratings/product-categories',
];
const STABLE_EVERY = 12; // 12 × 50s = 10m, comfortably under the 15m stable TTL

// Hot endpoints: the live dashboard data, re-warmed every cycle to stay under the
// 60s cache TTL.
const HOT_QUERIES = [
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

// Full set, for reference/export. Each cycle warms HOT_QUERIES; STABLE_QUERIES
// are folded in only every STABLE_EVERY cycles.
const PREWARM_QUERIES = [...STABLE_QUERIES, ...HOT_QUERIES];
let cycleCount = 0;

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
        // Warm hot endpoints every cycle; fold in the stable (filter-option)
        // endpoints only every STABLE_EVERY cycles — their 15m cache TTL covers
        // the gap, so their heavy scans run ~10m apart instead of every 50s.
        const includeStable = (cycleCount % STABLE_EVERY) === 0;
        cycleCount++;
        const cyclePaths = includeStable ? PREWARM_QUERIES : HOT_QUERIES;
        // Build the work list, dropping any (company|path) still running from a
        // previous cycle (single-flight) so slow queries can't pile up.
        const jobs = [];
        let skipped = 0;
        for (const cid of companyIds) {
            for (const path of cyclePaths) {
                const key = `${cid}|${path}`;
                if (inFlight.has(key)) { skipped++; continue; }
                jobs.push({ cid, path, key });
            }
        }
        // Concurrency-limited fan-out (was unbounded Promise.all, which could
        // fire 20×N queries simultaneously and saturate the pool in one burst).
        const results = [];
        let cursor = 0;
        const worker = async () => {
            while (cursor < jobs.length) {
                const job = jobs[cursor++];
                inFlight.add(job.key);
                try {
                    results.push(await warmOne(baseUrl, job.cid, job.path, internalToken));
                } finally {
                    inFlight.delete(job.key);
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, jobs.length) }, worker));
        const warmed = results.filter(r => r.ok).length;
        const failed = results.length - warmed;
        const slowest = results.reduce((m, r) => Math.max(m, r.ms || 0), 0);
        console.log(`[prewarm] ${companyIds.length} co × ${cyclePaths.length} paths${includeStable ? '+stable' : ''} · ${warmed} ok / ${failed} fail · ${skipped} skipped(in-flight) · ${Date.now() - startedAt}ms (slowest: ${slowest}ms)`);
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
