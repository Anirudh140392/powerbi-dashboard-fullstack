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

async function checkCounts() {
    console.log('Connecting to:', process.env.DB_HOST);
    
    // Get company ID from reviews
    const compRes = await pool.query("SELECT company_id FROM ratings.reviews WHERE brand ILIKE '%Prestige%' LIMIT 1");
    if (compRes.rowCount === 0) {
        console.error('No Prestige data found in reviews');
        process.exit(1);
    }
    const cid = compRes.rows[0].company_id;
    console.log('Checking counts for company:', cid);

    const trendPeriod = 3; 
    
    const sql = `
        WITH snap_cats AS (
            SELECT DISTINCT ON (ps.company_id, ps.web_pid)
                ps.web_pid,
                COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) as raw_category,
                COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, '')) AS raw_pareto_status
            FROM ratings.product_snapshots ps
            LEFT JOIN masters.products mp ON mp.company_id = ps.company_id AND mp.product_external_id = ps.web_pid AND LOWER(mp.platform) = LOWER(ps.platform)
            WHERE ps.company_id = $1
              AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) IS NOT NULL
              AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) != ''
              AND COALESCE(ps.is_competitor, mp.is_competitor, false) = false
            ORDER BY ps.company_id, ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC
        ),
        review_only_cats AS (
            SELECT DISTINCT ON (r.web_pid)
                r.web_pid,
                COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) as raw_category,
                COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(r.pareto_status, '')) AS raw_pareto_status
            FROM ratings.reviews r
            LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
            WHERE r.company_id = $1
              AND COALESCE(r.is_competitor, false) = false
              AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) IS NOT NULL
              AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) != ''
              AND NOT EXISTS (SELECT 1 FROM snap_cats sc WHERE sc.web_pid = r.web_pid)
            ORDER BY r.web_pid, r.review_date DESC
        ),
        sku_category_map AS (
            SELECT 
                web_pid,
                CASE 
                    WHEN TRIM(LOWER(raw_category)) IN ('other', 'others') THEN 'Others'
                    ELSE INITCAP(TRIM(raw_category))
                END AS category,
                raw_pareto_status AS pareto_status
            FROM (
                SELECT web_pid, raw_category, raw_pareto_status FROM snap_cats
                UNION ALL
                SELECT web_pid, raw_category, raw_pareto_status FROM review_only_cats
            ) all_c
        ),
        cat_sku_counts AS (
            SELECT 
                category, 
                COUNT(DISTINCT web_pid) AS sku_count
            FROM sku_category_map
            GROUP BY 1
        )
        SELECT 
            (SELECT SUM(sku_count) FROM cat_sku_counts) as sum_categories,
            (SELECT COUNT(DISTINCT web_pid) FROM sku_category_map) as total_distinct_skus_in_map
    `;

    const { rows } = await pool.query(sql, [cid]);
    console.log('Category Breakdown Logic:', rows[0]);
    
    // Now check the "All Categories" logic from api.cjs
    const totalSql = `
        WITH latest_snaps AS (
            SELECT DISTINCT ON (ps.company_id, LOWER(ps.platform), ps.web_pid)
                ps.company_id,
                LOWER(ps.platform) AS platform,
                ps.web_pid,
                ps.rating_count,
                ps.category,
                COALESCE(ps.is_competitor, false) AS is_competitor
            FROM ratings.product_snapshots ps
            WHERE ps.company_id = $1
            ORDER BY ps.company_id, LOWER(ps.platform), ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
        ),
        snap_skus AS (
            SELECT ps.web_pid, ps.platform, ps.rating_count
            FROM latest_snaps ps
            LEFT JOIN masters.products mp
                ON mp.company_id = $1
               AND mp.product_external_id = ps.web_pid
               AND LOWER(mp.platform) = LOWER(ps.platform)
            WHERE 1=1
              AND COALESCE(ps.is_competitor, mp.is_competitor, false) = false
              AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) IS NOT NULL 
              AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) != ''
        ),
        review_only_skus AS (
            SELECT DISTINCT r.web_pid, r.platform, 0::bigint AS rating_count
            FROM ratings.reviews r
            LEFT JOIN masters.products mp
                ON mp.company_id = r.company_id
               AND mp.product_external_id = r.web_pid
               AND LOWER(mp.platform) = LOWER(r.platform)
            WHERE r.company_id = $1
              AND COALESCE(r.is_competitor, false) = false
              AND r.review_date >= (CURRENT_DATE - INTERVAL '3 months')
              AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) IS NOT NULL 
              AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) != ''
              AND NOT EXISTS (
                  SELECT 1 FROM latest_snaps ps
                  WHERE ps.company_id = $1 AND ps.web_pid = r.web_pid AND ps.platform = LOWER(r.platform)
              )
        ),
        all_skus AS (
            SELECT web_pid, platform, rating_count FROM snap_skus
            UNION ALL
            SELECT web_pid, platform, rating_count FROM review_only_skus
        )
        SELECT
            COUNT(DISTINCT web_pid) AS all_categories_card_sku_count
        FROM all_skus
    `;
    const totalRes = await pool.query(totalSql, [cid]);
    console.log('All Categories Card Logic:', totalRes.rows[0]);

    pool.end();
}

checkCounts().catch(console.error);
