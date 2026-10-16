/**
 * MySQL → PostgreSQL Price/Rating Snapshot Sync
 *
 * Source: Prestige.rb_pdp  (~124M rows; the ONLY usable index is the
 *         pdp_data_id auto-increment PK — no index on web_pid or any
 *         timestamp, so a full scan / window-sort is not viable: it times
 *         out with ECONNRESET)
 * Target: ratings.product_snapshots
 *
 * Strategy:
 * - Target list = all products in masters.products (not just rows that
 *   already exist in product_snapshots). The previous version only UPDATEd
 *   existing rows, so any product added to masters.products after the
 *   initial seed was permanently invisible from the rating dashboards.
 * - Higher pdp_data_id == inserted later == more recent crawl, so scan the
 *   table DESCENDING by pdp_data_id in indexed keyset pages (fast PK range
 *   scans, no sort) and keep the first row seen per tracked web_pid.
 * - Stop as soon as every tracked web_pid is captured, or a safety page cap.
 * - Daily-snapshot semantics: one row per (web_pid, platform, snapshot_date).
 *   For today: UPDATE today's row if it exists, INSERT one if not — idempotent
 *   re-runs in the same day, and a clean time-series across days that
 *   makes rating trends queryable.
 */
const mysql = require('mysql2/promise');
const { Pool } = require('pg');
require('dotenv').config();

function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

const pgPool = new Pool({
    host: requireEnv('DB_HOST'),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    max: 5,
});

const COMPANY_ID = requireEnv('COMPANY_ID');
const MYSQL_CONFIG = {
    host: requireEnv('PRESTIGE_MYSQL_HOST'),
    port: parseInt(requireEnv('PRESTIGE_MYSQL_PORT'), 10),
    user: requireEnv('PRESTIGE_MYSQL_USER'),
    password: requireEnv('PRESTIGE_MYSQL_PASSWORD'),
    database: requireEnv('PRESTIGE_MYSQL_DATABASE'),
    connectTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
};

const PAGE = 20000;       // rows per indexed keyset page
const MAX_PAGES = 400;    // safety cap (~8M most-recent rb_pdp rows)

// MySQL pf_id → product_snapshots.platform string (consistent with sync_mysql_reviews)
const PF_MAP = { 1: 'amazon', 5: 'flipkart', 2: 'blinkit', 3: 'zepto', 4: 'instamart' };

function toPositiveNumber(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Validate rating is in 1..5 OR null — rb_pdp can have 0 as a "no rating captured" sentinel.
function toRating(value) {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

async function main() {
    console.log('=== MySQL → PostgreSQL PRICE/RATING SNAPSHOT Sync ===\n');
    const startedAt = Date.now();

    const mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
    console.log('Connected to MySQL');

    // 1) Target = every product in masters.products (not just existing snapshot rows).
    //    This is the fix for the "1,950 products with reviews but no snapshot" gap.
    const { rows: pgMasters } = await pgPool.query(`
        SELECT product_external_id AS web_pid,
               LOWER(COALESCE(platform, '')) AS platform,
               product_name, brand_name, category, master_category, pareto_status, is_competitor
        FROM masters.products
        WHERE company_id = $1
          AND product_external_id IS NOT NULL
          AND product_external_id != ''
    `, [COMPANY_ID]);

    const masterByKey = new Map();    // 'web_pid|platform' -> master row (preferred match)
    const masterByPid = new Map();    // 'web_pid' -> any master row (fallback when master has no platform)
    const targetPids = new Set();
    for (const m of pgMasters) {
        if (m.platform) masterByKey.set(`${m.web_pid}|${m.platform}`, m);
        if (!masterByPid.has(m.web_pid)) masterByPid.set(m.web_pid, m);
        targetPids.add(m.web_pid);
    }
    console.log(`Tracked web_pids: ${targetPids.size} (across ${pgMasters.length} master rows)`);
    if (targetPids.size === 0) {
        await mysqlConn.end();
        await pgPool.end();
        return;
    }

    // 2) Existing snapshot rows for TODAY (used to decide UPDATE vs INSERT below).
    const { rows: pgTodaySnaps } = await pgPool.query(`
        SELECT id, web_pid, LOWER(COALESCE(platform,'')) AS platform
        FROM ratings.product_snapshots
        WHERE company_id = $1 AND snapshot_date = CURRENT_DATE
    `, [COMPANY_ID]);
    const todayIdByKey = new Map();
    for (const s of pgTodaySnaps) todayIdByKey.set(`${s.web_pid}|${s.platform}`, s.id);

    // 3) Newest-first keyset scan on the pdp_data_id PK index.
    const [[{ hi }]] = await mysqlConn.query('SELECT MAX(pdp_data_id) hi FROM rb_pdp');
    let cursor = Number(hi) + 1;

    // 'web_pid|platform' -> { values, platform, webPid }
    const latest = new Map();
    let scanned = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
        const [rows] = await mysqlConn.query(`
            SELECT pdp_data_id, web_pid, pf_id, price_rp, price_sp,
                   pdp_rating_value, pdp_review_count, pdp_rating_count
            FROM rb_pdp
            WHERE pdp_data_id < ?
            ORDER BY pdp_data_id DESC
            LIMIT ?
        `, [cursor, PAGE]);

        if (rows.length === 0) break;

        for (const row of rows) {
            const webPid = String(row.web_pid || '').trim();
            if (!webPid || !targetPids.has(webPid)) continue;

            const platform = PF_MAP[row.pf_id] || 'amazon';
            const key = `${webPid}|${platform}`;
            if (latest.has(key)) continue; // we already captured a NEWER row for this product/platform

            const priceRp = toPositiveNumber(row.price_rp);
            const priceSp = toPositiveNumber(row.price_sp);
            const rating = toRating(row.pdp_rating_value);
            const reviewCount = toPositiveNumber(row.pdp_review_count);
            const ratingCount = toPositiveNumber(row.pdp_rating_count);

            // Skip rows that carry no useful data — keep scanning for a richer one.
            if (priceRp == null && priceSp == null && rating == null &&
                reviewCount == null && ratingCount == null) continue;

            latest.set(key, { webPid, platform, priceRp, priceSp, rating, reviewCount, ratingCount });
        }

        cursor = rows[rows.length - 1].pdp_data_id;
        scanned += rows.length;
        if ((page + 1) % 10 === 0) {
            console.log(`page ${page + 1}: scanned ${scanned}, captured ${latest.size} (web_pid, platform) keys`);
        }
    }
    await mysqlConn.end();
    console.log(`Captured latest rb_pdp data for ${latest.size} (web_pid, platform) keys (scanned ${scanned} rows)`);

    // 4) Apply to product_snapshots. UPSERT into TODAY's row for each captured key.
    let inserted = 0;
    let updated = 0;
    const pgClient = await pgPool.connect();
    try {
        await pgClient.query('BEGIN');
        for (const [key, v] of latest) {
            const todayId = todayIdByKey.get(key);
            if (todayId) {
                await pgClient.query(`
                    UPDATE ratings.product_snapshots
                    SET
                        price_rp     = COALESCE($1, price_rp),
                        price_sp     = COALESCE($2, price_sp),
                        rating       = COALESCE($3, rating),
                        review_count = COALESCE($4, review_count),
                        rating_count = COALESCE($5, rating_count)
                    WHERE id = $6
                `, [v.priceRp, v.priceSp, v.rating, v.reviewCount, v.ratingCount, todayId]);
                updated++;
            } else {
                const m = masterByKey.get(key) || masterByPid.get(v.webPid) || null;
                await pgClient.query(`
                    INSERT INTO ratings.product_snapshots (
                        company_id, platform, web_pid, product_name, brand,
                        category, pareto_status, is_competitor,
                        price_rp, price_sp, rating, review_count, rating_count,
                        snapshot_date, created_at
                    ) VALUES (
                        $1, $2, $3, $4, $5,
                        $6, $7, $8,
                        $9, $10, $11, $12, $13,
                        CURRENT_DATE, NOW()
                    )
                `, [
                    COMPANY_ID,
                    v.platform,
                    v.webPid,
                    m?.product_name || v.webPid,
                    m?.brand_name || null,
                    m?.category || m?.master_category || null,
                    m?.pareto_status || null,
                    !!m?.is_competitor,
                    v.priceRp, v.priceSp, v.rating, v.reviewCount, v.ratingCount,
                ]);
                inserted++;
            }
        }
        await pgClient.query('COMMIT');
    } catch (err) {
        await pgClient.query('ROLLBACK');
        throw err;
    } finally {
        pgClient.release();
    }

    const missing = targetPids.size === 0 ? 0 : (() => {
        // Count distinct web_pids we *didn't* find any rb_pdp data for in the scan window.
        const capturedPids = new Set(Array.from(latest.values()).map(v => v.webPid));
        let n = 0;
        for (const p of targetPids) if (!capturedPids.has(p)) n++;
        return n;
    })();

    console.log(`\nPrice sync complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    console.log(`Today's snapshot rows: ${inserted} inserted, ${updated} updated`);
    console.log(`Tracked products with no rb_pdp data found in scan: ${missing}`);

    await pgPool.end();
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
