require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    port: 5432, ssl: { rejectUnauthorized: false }
});

async function run() {
    const totalParams = ['297e37ea-a5ac-47df-bebd-ac44e52b7979'];
    let totalWhere = 'AND ps.is_competitor = false';
    let totalReviewsWhere = 'AND r.is_competitor = false';
    
    // Simulate adding category
    const catExpr = `COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''))`;
    totalWhere += ` AND ${catExpr} ILIKE $${totalParams.length + 1}`;
    totalReviewsWhere += ` AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE $${totalParams.length + 1}`;
    totalParams.push('Kettle');

    const totalSqlFinal = `
        WITH latest_snaps AS (
            SELECT DISTINCT ON (ps.company_id, ps.platform, ps.web_pid)
                ps.company_id,
                ps.platform,
                ps.web_pid,
                ps.rating_count,
                ps.price_rp,
                ps.price_sp,
                COALESCE(ps.is_competitor, false) AS is_competitor
            FROM ratings.product_snapshots ps
            WHERE ps.company_id = $1
            ORDER BY ps.company_id, ps.platform, ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
        ),
        snap_skus AS (
            SELECT ps.web_pid, ps.platform, ps.rating_count
            FROM latest_snaps ps
            LEFT JOIN masters.products mp
                ON mp.company_id = $1
               AND mp.product_external_id = ps.web_pid
               AND LOWER(mp.platform) = LOWER(ps.platform)
            WHERE 1=1
              ${totalWhere}
        )
        SELECT COUNT(*) FROM snap_skus
    `;
    
    try {
        const res = await pool.query(totalSqlFinal, totalParams);
        console.log(res.rows);
    } catch (err) {
        console.error("SQL ERROR:", err.message);
    }
    await pool.end();
}

run().catch(console.error);
