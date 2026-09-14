require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    port: 5432, ssl: { rejectUnauthorized: false }
});

async function run() {
    const params = [
        '297e37ea-a5ac-47df-bebd-ac44e52b7979', // $1
        false, // $2 competitor
        'Kettle', // $3 category
        35, // $4 price min
        1795 // $5 price max
        // let's say 6 months for period
    ];
    
    // Simulate what the category-health endpoint does for cat_products
    const sql = `
        SELECT
            CASE 
                WHEN TRIM(LOWER(COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, '')))) IN ('other', 'others') THEN 'Others'
                ELSE INITCAP(TRIM(COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, ''))))
            END AS category,
            COUNT(DISTINCT ls.web_pid) AS sku_count,
            SUM(ls.rating_count) AS total_ratings
        FROM (
            SELECT DISTINCT ON (ps.company_id, ps.platform, ps.web_pid)
                ps.company_id, ps.platform, ps.web_pid, ps.rating, ps.rating_count,
                ps.price_rp, ps.price_sp, ps.pareto_status, ps.category
            FROM ratings.product_snapshots ps
            WHERE ps.company_id = $1
              AND ps.is_competitor = $2
            ORDER BY ps.company_id, ps.platform, ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
        ) ls
        LEFT JOIN masters.products mp
            ON mp.company_id = ls.company_id
           AND mp.product_external_id = ls.web_pid
           AND LOWER(mp.platform) = LOWER(ls.platform)
        WHERE COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, '')) IS NOT NULL
          AND COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, '')) != ''
          AND COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, '')) ILIKE $3
          AND COALESCE(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp) >= $4
          AND COALESCE(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp) <= $5
        GROUP BY 1
    `;
    
    const res = await pool.query(sql, params);
    console.log('cat_products result:');
    console.table(res.rows);

    await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
