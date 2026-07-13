const { Pool } = require('pg');
require('dotenv').config();

const isRemoteDb = process.env.DB_HOST && !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST);
const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
});

async function debugInductionCounts() {
    const cid = '297e37ea-a5ac-47df-bebd-ac44e52b7979';
    const category = 'Induction Cooktop';

    // Method 1: Category Health Logic
    const sql1 = `
        WITH snap_cats AS (
            SELECT DISTINCT ON (ps.web_pid)
                ps.web_pid,
                COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) as category,
                COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, '')) AS pareto_status
            FROM ratings.product_snapshots ps
            LEFT JOIN masters.products mp ON mp.company_id = ps.company_id AND mp.product_external_id = ps.web_pid
            WHERE ps.company_id = $1
              AND COALESCE(ps.is_competitor, false) = false
              AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) ILIKE $2
            ORDER BY ps.web_pid, ps.snapshot_date DESC
        ),
        review_only_cats AS (
            SELECT DISTINCT ON (r.web_pid)
                r.web_pid,
                COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) as category,
                COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(r.pareto_status, '')) AS pareto_status
            FROM ratings.reviews r
            LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid
            WHERE r.company_id = $1
              AND COALESCE(r.is_competitor, false) = false
              AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE $2
              AND NOT EXISTS (SELECT 1 FROM snap_cats sc WHERE sc.web_pid = r.web_pid)
            ORDER BY r.web_pid, r.review_date DESC
        ),
        sku_pool AS (
            SELECT * FROM snap_cats UNION ALL SELECT * FROM review_only_cats
        )
        SELECT 
            pareto_status, COUNT(*) 
        FROM sku_pool 
        GROUP BY 1
    `;

    // Method 2: Executive Health Logic
    const sql2 = `
        WITH latest_snapshots AS (
            SELECT DISTINCT ON (ps.web_pid)
                ps.web_pid,
                COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) as category,
                COALESCE(mp.pareto_status, ps.pareto_status) as pareto_status
            FROM ratings.product_snapshots ps
            LEFT JOIN masters.products mp ON mp.company_id = ps.company_id AND mp.product_external_id = ps.web_pid
            WHERE ps.company_id = $1
              AND COALESCE(ps.is_competitor, false) = false
              AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) ILIKE $2
            ORDER BY ps.web_pid, ps.snapshot_date DESC
        )
        SELECT pareto_status, COUNT(*) FROM latest_snapshots GROUP BY 1
    `;

    const res1 = await pool.query(sql1, [cid, category]);
    console.log('Method 1 (Category Pills) Results:', res1.rows);

    const res2 = await pool.query(sql2, [cid, category]);
    console.log('Method 2 (Executive Cards) Results:', res2.rows);

    pool.end();
}

debugInductionCounts().catch(console.error);
