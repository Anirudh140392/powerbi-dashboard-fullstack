const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: { rejectUnauthorized: false }
});

async function checkReviews() {
    try {
        const res = await pool.query(`
            SELECT r.company_id, count(*) 
            FROM ratings.reviews r
            LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
            LEFT JOIN LATERAL (
                SELECT ps2.category
                FROM ratings.product_snapshots ps2
                WHERE ps2.company_id = r.company_id AND ps2.web_pid = r.web_pid
                ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
                LIMIT 1
            ) ps ON true
            WHERE TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''), NULLIF(r.category, ''))) ILIKE 'Pressure Cooker'
              AND r.review_date >= '2025-11-01'
              AND r.is_competitor = false
            GROUP BY r.company_id
        `);
        console.log('Counts per company:', res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

checkReviews();
