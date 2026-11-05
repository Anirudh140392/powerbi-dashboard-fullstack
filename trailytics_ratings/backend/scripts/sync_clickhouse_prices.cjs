/**
 * ClickHouse -> PostgreSQL Price/Rating Snapshot Sync
 *
 * Source: prestige.rb_pdp_week (rolling 1-week window, ~12M rows)
 * Target: ratings.product_snapshots (today's row per web_pid+platform)
 *
 * Drop-in replacement for sync_prices_from_mysql.cjs. The MySQL version
 * keyset-scanned a 124M-row index-less table to find the latest row per
 * product. ClickHouse is OLAP — one GROUP BY + argMax() returns the same
 * result in a few seconds.
 *
 * Header mapping verified 2026-05-19. Columns selected:
 *   web_pid, pf_id, price_rp, price_sp, pdp_rating_value,
 *   pdp_review_count, pdp_rating_count — all present in prestige.rb_pdp_week
 *   with the same names. pdp_data_id is the monotonic PK (Int32, non-nullable)
 *   used to disambiguate the latest row.
 *
 * Daily-snapshot semantics unchanged: one row per (web_pid, platform,
 * snapshot_date). Re-runs in the same day UPDATE that day's row.
 */
const { createClient } = require('@clickhouse/client');
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
    ssl: process.env.DB_HOST && !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)
        ? { rejectUnauthorized: false } : false,
});

const COMPANY_ID = requireEnv('COMPANY_ID');
const chClient = createClient({
    url: requireEnv('CLICKHOUSE_HOST'),
    username: requireEnv('CLICKHOUSE_USER'),
    password: requireEnv('CLICKHOUSE_PASSWORD'),
    database: requireEnv('CLICKHOUSE_DB'),
    request_timeout: 180_000,
});

const PF_MAP = { 1: 'amazon', 5: 'flipkart', 2: 'blinkit', 3: 'zepto', 4: 'instamart' };

function toPositiveNumber(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toRating(value) {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

async function main() {
    console.log('=== ClickHouse -> PostgreSQL PRICE/RATING SNAPSHOT Sync ===');
    console.log(`Source: ${process.env.CLICKHOUSE_HOST} db=${process.env.CLICKHOUSE_DB} table=rb_pdp_week`);
    const startedAt = Date.now();

    const { rows: pgMasters } = await pgPool.query(`
        SELECT product_external_id AS web_pid,
               LOWER(COALESCE(platform, '')) AS platform,
               product_name, brand_name, category, master_category, pareto_status, is_competitor
        FROM masters.products
        WHERE company_id = $1
          AND product_external_id IS NOT NULL
          AND product_external_id != ''
    `, [COMPANY_ID]);

    // Lower-case both sides for matching. rb_pdp_week stores Flipkart FSNs in
    // mixed case; masters.products stores Amazon ASINs in upper case. Without
    // this normalization, ~95% of CH PDP rows fail the targetPids.has() check
    // and the daily snapshot ends up with 237 rows instead of ~3,600.
    const masterByKey = new Map();
    const masterByPid = new Map();
    const targetPids = new Set();
    for (const m of pgMasters) {
        const lowPid = (m.web_pid || '').toLowerCase();
        if (m.platform) masterByKey.set(`${lowPid}|${m.platform.toLowerCase()}`, m);
        if (!masterByPid.has(lowPid)) masterByPid.set(lowPid, m);
        targetPids.add(lowPid);
    }
    console.log(`Tracked web_pids: ${targetPids.size} (across ${pgMasters.length} master rows)`);
    if (targetPids.size === 0) {
        await chClient.close();
        await pgPool.end();
        return;
    }

    const { rows: pgTodaySnaps } = await pgPool.query(`
        SELECT id, web_pid, LOWER(COALESCE(platform,'')) AS platform
        FROM ratings.product_snapshots
        WHERE company_id = $1 AND snapshot_date = CURRENT_DATE
    `, [COMPANY_ID]);
    const todayIdByKey = new Map();
    // Lower-case both sides so the lookup matches the same key shape the
    // sync loop uses (`webPidLow|platform`).
    for (const s of pgTodaySnaps) todayIdByKey.set(`${(s.web_pid || '').toLowerCase()}|${s.platform}`, s.id);

    // ClickHouse argMax(field, pdp_data_id) returns `field` from the row with
    // the highest pdp_data_id — i.e. most recent crawl per (web_pid, pf_id).
    // Replaces the MySQL keyset-pagination hack with a single OLAP query.
    console.log('Querying ClickHouse for latest values per (web_pid, pf_id)...');
    const rs = await chClient.query({
        query: `
            SELECT
                web_pid,
                pf_id,
                argMax(price_rp,         pdp_data_id) AS price_rp,
                argMax(price_sp,         pdp_data_id) AS price_sp,
                argMax(pdp_rating_value, pdp_data_id) AS pdp_rating_value,
                argMax(pdp_review_count, pdp_data_id) AS pdp_review_count,
                argMax(pdp_rating_count, pdp_data_id) AS pdp_rating_count
            FROM rb_pdp_week
            WHERE web_pid IS NOT NULL AND web_pid != ''
            GROUP BY web_pid, pf_id
        `,
        format: 'JSONEachRow',
    });
    const chRows = await rs.json();
    console.log(`ClickHouse returned ${chRows.length} (web_pid, pf_id) groups`);

    // Star breakdown (5/4/3/2/1) lives in prestige.reviews' denormalised PDP
    // fields, NOT rb_pdp_week — fetch it separately and attach, so
    // product_snapshots.star_distribution carries the real PDP distribution.
    // (The dashboard used to count review rows, which under-represented Amazon:
    //  millions of PDP ratings vs ~7K crawled reviews.)
    const starRs = await chClient.query({
        query: `
            SELECT web_pid, pf_id,
                toInt64(argMax(five_star,  created_on)) AS s5,
                toInt64(argMax(four_star,  created_on)) AS s4,
                toInt64(argMax(three_star, created_on)) AS s3,
                toInt64(argMax(two_star,   created_on)) AS s2,
                toInt64(argMax(one_star,   created_on)) AS s1
            FROM reviews
            WHERE five_star > 0 OR four_star > 0 OR three_star > 0 OR two_star > 0 OR one_star > 0
            GROUP BY web_pid, pf_id
        `,
        format: 'JSONEachRow',
    });
    const starRows = await starRs.json();
    const starByKey = new Map();
    for (const r of starRows) {
        starByKey.set(`${String(r.web_pid || '').toLowerCase()}|${r.pf_id}`,
            JSON.stringify({ 1: +r.s1, 2: +r.s2, 3: +r.s3, 4: +r.s4, 5: +r.s5 }));
    }
    console.log(`ClickHouse star breakdown for ${starByKey.size} SKUs`);

    const latest = new Map();
    for (const row of chRows) {
        const webPidRaw = String(row.web_pid || '').trim();
        const webPidLow = webPidRaw.toLowerCase();
        if (!webPidLow || !targetPids.has(webPidLow)) continue;
        // Same fix as the reviews sync: don't blindly default unmapped pf_id to
        // 'amazon' (that mislabeled Flipkart FSNs). Map by pf_id, reconcile with
        // web_pid format (B0…=Amazon, 16-char FSN=Flipkart), skip if unknown.
        const looksAmazon = /^B0/i.test(webPidRaw);
        const looksFlipkart = !looksAmazon && /^[A-Za-z0-9]{14,}$/.test(webPidRaw);
        let platform = PF_MAP[row.pf_id] || null;
        if (!platform) platform = looksAmazon ? 'amazon' : (looksFlipkart ? 'flipkart' : null);
        else if (platform === 'amazon' && looksFlipkart) platform = 'flipkart';
        if (!platform) continue;
        // Use the master's stored casing for web_pid so snapshot rows
        // continue to match prior days' rows (no duplicates).
        const master = masterByPid.get(webPidLow);
        const webPid = master?.web_pid || webPidRaw;
        const key = `${webPidLow}|${platform}`;
        const priceRp = toPositiveNumber(row.price_rp);
        const priceSp = toPositiveNumber(row.price_sp);
        const rating = toRating(row.pdp_rating_value);
        const reviewCount = toPositiveNumber(row.pdp_review_count);
        const ratingCount = toPositiveNumber(row.pdp_rating_count);
        const starDist = starByKey.get(`${webPidLow}|${row.pf_id}`) || null;
        if (priceRp == null && priceSp == null && rating == null &&
            reviewCount == null && ratingCount == null && starDist == null) continue;
        latest.set(key, { webPid, platform, priceRp, priceSp, rating, reviewCount, ratingCount, starDist });
    }
    await chClient.close();
    console.log(`Captured latest data for ${latest.size} (web_pid, platform) keys`);

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
                    SET price_rp = COALESCE($1, price_rp),
                        price_sp = COALESCE($2, price_sp),
                        rating = COALESCE($3, rating),
                        review_count = COALESCE($4, review_count),
                        rating_count = COALESCE($5, rating_count),
                        star_distribution = COALESCE($7::jsonb, star_distribution)
                    WHERE id = $6
                `, [v.priceRp, v.priceSp, v.rating, v.reviewCount, v.ratingCount, todayId, v.starDist]);
                updated++;
            } else {
                const m = masterByKey.get(key) || masterByPid.get(v.webPid) || null;
                await pgClient.query(`
                    INSERT INTO ratings.product_snapshots (
                        company_id, platform, web_pid, product_name, brand,
                        category, pareto_status, is_competitor,
                        price_rp, price_sp, rating, review_count, rating_count,
                        star_distribution, snapshot_date, created_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                        $14::jsonb, CURRENT_DATE, NOW()
                    )
                `, [
                    COMPANY_ID, v.platform, v.webPid,
                    m?.product_name || v.webPid,
                    m?.brand_name || null,
                    m?.category || m?.master_category || null,
                    m?.pareto_status || null,
                    !!m?.is_competitor,
                    v.priceRp, v.priceSp, v.rating, v.reviewCount, v.ratingCount,
                    v.starDist,
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

    const capturedPids = new Set(Array.from(latest.values()).map(v => v.webPid));
    let missing = 0;
    for (const p of targetPids) if (!capturedPids.has(p)) missing++;

    console.log(`\nPrice sync complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    console.log(`Today's snapshot rows: ${inserted} inserted, ${updated} updated`);
    console.log(`Tracked products with no PDP data in last week: ${missing}`);

    await pgPool.end();
}

main().catch(err => { console.error('Fatal:', err.stack || err.message); process.exit(1); });
