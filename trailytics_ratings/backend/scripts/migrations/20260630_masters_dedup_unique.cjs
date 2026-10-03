/**
 * Theme A fix — eliminate masters.products duplicate-SKU fan-out.
 *
 * masters.products had 795 duplicate (company_id, product_external_id, platform)
 * groups (all amazon), with no unique constraint, so the plain LEFT JOINs in
 * ~30 query sites fanned out review rows — inflating /summary (+59-95%),
 * /reviews (+57% amazon), /timeline (+31-51%), /trends, /products.
 *
 * Fix: keep the most-complete row per key (verified zero complementary-data
 * loss), delete the rest, then add a UNIQUE index so dups can never recur and
 * the sync can upsert against it.
 *
 * Idempotent: re-running deletes nothing (already deduped) and the index is
 * created IF NOT EXISTS.
 */
require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        host: process.env.DB_HOST, database: process.env.DB_NAME, user: process.env.DB_USER,
        password: process.env.DB_PASSWORD, port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: process.env.DB_HOST && !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)
            ? { rejectUnauthorized: false } : false,
    });

    const before = await pool.query('SELECT count(*) c FROM masters.products');
    const del = await pool.query(`
        WITH ranked AS (
            SELECT id,
                row_number() OVER (
                    PARTITION BY company_id, product_external_id, platform
                    ORDER BY (master_category IS NOT NULL) DESC,
                             (category IS NOT NULL) DESC,
                             (selling_price IS NOT NULL) DESC,
                             (pareto_status IS NOT NULL) DESC,
                             created_at DESC NULLS LAST,
                             id DESC
                ) AS rn
            FROM masters.products
        )
        DELETE FROM masters.products WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    `);
    console.log(`Deleted ${del.rowCount} duplicate rows (kept most-complete per key).`);

    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_masters_products_company_extid_platform
        ON masters.products (company_id, product_external_id, platform)
    `);
    const after = await pool.query('SELECT count(*) c FROM masters.products');
    const chk = await pool.query(`
        SELECT count(*) rows, count(DISTINCT (company_id, product_external_id, platform)) keys
        FROM masters.products`);
    console.log(`Rows ${before.rows[0].c} -> ${after.rows[0].c}. Distinct keys=${chk.rows[0].keys}, rows=${chk.rows[0].rows} (equal = no dups).`);
    console.log('UNIQUE index uq_masters_products_company_extid_platform ready.');
    await pool.end();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
