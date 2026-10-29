/**
 * Performance indexes — kill the 19s /category-health latency.
 *
 * The hot-path joins all use `LOWER(platform) = LOWER(platform)` between
 * ratings.reviews / ratings.product_snapshots / masters.products. Postgres
 * cannot use a regular index on `platform` for that — it needs an index on
 * the *expression* `LOWER(platform)`.
 *
 * Also adds a covering index for the canonical SKU CTE which scans
 * product_snapshots by company_id + snapshot_date + the LOWER(platform) join.
 */
require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
    });

    const indexes = [
        // Functional indexes for LOWER(platform) join keys
        `CREATE INDEX IF NOT EXISTS idx_reviews_company_lowerplat_pid
            ON ratings.reviews (company_id, LOWER(platform), web_pid)`,
        `CREATE INDEX IF NOT EXISTS idx_snapshots_company_lowerplat_pid
            ON ratings.product_snapshots (company_id, LOWER(platform), web_pid)`,
        `CREATE INDEX IF NOT EXISTS idx_products_company_lowerplat_extid
            ON masters.products (company_id, LOWER(platform), product_external_id)`,
        // sku_code is the canonical product key after the recent collapse fix.
        `CREATE INDEX IF NOT EXISTS idx_products_company_skucode
            ON masters.products (company_id, sku_code) WHERE sku_code IS NOT NULL AND sku_code != ''`,
        // Snapshot date filter is the primary range predicate on category-health.
        // Existing idx_snapshots_company_date helps but a (company_id, snapshot_date DESC, web_pid)
        // covering index lets the DISTINCT ON skip the heap entirely for snap_cats.
        `CREATE INDEX IF NOT EXISTS idx_snapshots_company_date_pid
            ON ratings.product_snapshots (company_id, snapshot_date DESC, web_pid)`,
        // Reviews date+company is already covered by idx_reviews_company_comp_date,
        // but a covering (company_id, is_competitor, review_date DESC, web_pid)
        // would let aggregations use index-only scan.
        `CREATE INDEX IF NOT EXISTS idx_reviews_company_comp_date_pid
            ON ratings.reviews (company_id, is_competitor, review_date DESC, web_pid)`,
    ];

    for (const sql of indexes) {
        const t = Date.now();
        const name = sql.match(/idx_\w+/)[0];
        process.stdout.write(`  ${name.padEnd(45)} `);
        try {
            await pool.query(sql);
            console.log(`OK (${Date.now() - t}ms)`);
        } catch (e) {
            console.log(`FAIL: ${e.message}`);
        }
    }

    // Refresh planner stats so the new indexes are actually picked
    console.log('\n  ANALYZE...');
    for (const tbl of ['ratings.reviews', 'ratings.product_snapshots', 'masters.products']) {
        const t = Date.now();
        await pool.query(`ANALYZE ${tbl}`);
        console.log(`    ${tbl.padEnd(35)} OK (${Date.now() - t}ms)`);
    }

    await pool.end();
    console.log('\nDone.');
})().catch(e => { console.error(e); process.exit(1); });
