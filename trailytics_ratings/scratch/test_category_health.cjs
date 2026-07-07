const { Pool } = require('pg');
require('dotenv').config();

async function test() {
    const pool = new Pool({
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT
    });

    const companyId = '297e37ea-a5ac-47df-bebd-ac44e52b7979'; // Prestige
    const platform = 'all';
    const is_competitor = 'all'; // Scope: All
    const price_min = 1795;
    const price_max = 2895;
    const price_mode = 'sp';

    console.log('Testing /category-health logic with All Scope + Price...');

    const sqlParams = [companyId];
    let competitorFilter = '';
    let snapshotCompetitorFilter = '';
    let snapshotPlatformFilter = '';
    let snapshotPriceFilter = '';
    let snapshotPriceExpr = 'COALESCE(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';
    let reviewPriceFilter = '';
    let reviewPriceExpr = 'COALESCE(ps_latest.price_sp, mp.selling_price, mp.mop, ps_latest.price_rp, mp.mrp)';

    // Scope: All -> filters remain empty

    if (price_min !== undefined) {
        snapshotPriceFilter += ` AND ${snapshotPriceExpr} >= $${sqlParams.length + 1}`;
        reviewPriceFilter += ` AND ${reviewPriceExpr} >= $${sqlParams.length + 1}`;
        sqlParams.push(Number(price_min));
    }
    if (price_max !== undefined) {
        snapshotPriceFilter += ` AND ${snapshotPriceExpr} <= $${sqlParams.length + 1}`;
        reviewPriceFilter += ` AND ${reviewPriceExpr} <= $${sqlParams.length + 1}`;
        sqlParams.push(Number(price_max));
    }

    const sql = `
        WITH cat_reviews AS (
            SELECT
                COALESCE(NULLIF(ps_latest.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) AS category,
                COUNT(*) AS review_count
            FROM ratings.reviews r
            LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
            LEFT JOIN LATERAL (
                SELECT ps2.category, ps2.price_rp, ps2.price_sp FROM ratings.product_snapshots ps2
                WHERE ps2.company_id = r.company_id AND ps2.web_pid = r.web_pid AND LOWER(ps2.platform) = LOWER(r.platform)
                ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST LIMIT 1
            ) ps_latest ON true
            WHERE r.company_id = $1
              ${competitorFilter}
              ${reviewPriceFilter}
            GROUP BY 1
        ),
        cat_products AS (
            SELECT
                COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, '')) AS category,
                COUNT(DISTINCT ls.web_pid) AS sku_count
            FROM (
                SELECT DISTINCT ON (ps.company_id, ps.platform, ps.web_pid)
                    ps.company_id, ps.platform, ps.web_pid, ps.category, ps.price_rp, ps.price_sp, ps.is_competitor
                FROM ratings.product_snapshots ps
                WHERE ps.company_id = $1
                  ${snapshotCompetitorFilter}
                ORDER BY ps.company_id, ps.platform, ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
            ) ls
            LEFT JOIN masters.products mp ON mp.company_id = ls.company_id AND mp.product_external_id = ls.web_pid AND LOWER(mp.platform) = LOWER(ls.platform)
            WHERE COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, '')) IS NOT NULL
              ${snapshotPlatformFilter}
              ${snapshotPriceFilter}
            GROUP BY 1
        )
        SELECT COALESCE(cr.category, cp.category) AS category, cr.review_count, cp.sku_count
        FROM cat_products cp
        FULL OUTER JOIN cat_reviews cr ON cr.category = cp.category
        WHERE COALESCE(cr.category, cp.category) IS NOT NULL
    `;

    try {
        console.log('Running main query...');
        const res = await pool.query(sql, sqlParams);
        console.log('Main query result count:', res.rowCount);
        if (res.rowCount > 0) console.log('Sample row:', res.rows[0]);
    } catch (err) {
        console.error('Main query FAILED:', err.message);
    }

    await pool.end();
}

test();
