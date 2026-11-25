require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    port: 5432, ssl: { rejectUnauthorized: false }
});
const COMPANY_ID = '297e37ea-a5ac-47df-bebd-ac44e52b7979'; // Prestige

async function run() {
    // Simulate: price_mode=sp, price_min=35, price_max=1795, is_competitor=all
    const price_mode = 'sp';
    const price_min = '35';
    const price_max = '1795';
    const is_competitor = 'all'; // "all" means no competitor filter
    const platform = undefined;

    const totalParams = [COMPANY_ID];
    let totalWhere = '';
    let totalReviewsWhere = '';

    // is_competitor='all' → no filter
    if (is_competitor && is_competitor !== 'all') {
        totalWhere += ` AND COALESCE(ps.is_competitor, mp.is_competitor, false) = $${totalParams.length + 1}`;
        totalReviewsWhere += ` AND r.is_competitor = $${totalParams.length + 1}`;
        totalParams.push(is_competitor === 'true');
    } else if (!is_competitor || is_competitor === '') {
        totalWhere += ` AND COALESCE(ps.is_competitor, mp.is_competitor, false) = false`;
        totalReviewsWhere += ` AND r.is_competitor = false`;
    }

    if (platform && platform !== 'all') {
        totalWhere += ` AND ps.platform ILIKE $${totalParams.length + 1}`;
        totalReviewsWhere += ` AND r.platform ILIKE $${totalParams.length + 1}`;
        totalParams.push(platform);
    }

    const totalPriceExpr = price_mode === 'rp'
        ? 'COALESCE(ps.price_rp, mp.mrp)'
        : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
    const totalReviewPriceExpr = price_mode === 'rp'
        ? 'COALESCE(mp.mrp)'
        : 'COALESCE(mp.selling_price, mp.mop, mp.mrp)';

    if (price_min !== undefined && price_min !== '') {
        totalWhere += ` AND ${totalPriceExpr} >= $${totalParams.length + 1}`;
        totalReviewsWhere += ` AND ${totalReviewPriceExpr} >= $${totalParams.length + 1}`;
        totalParams.push(Number(price_min));
    }
    if (price_max !== undefined && price_max !== '') {
        totalWhere += ` AND ${totalPriceExpr} <= $${totalParams.length + 1}`;
        totalReviewsWhere += ` AND ${totalReviewPriceExpr} <= $${totalParams.length + 1}`;
        totalParams.push(Number(price_max));
    }

    const totalSqlFinal = `
        WITH latest_snaps AS (
            SELECT DISTINCT ON (ps.company_id, ps.platform, ps.web_pid)
                ps.company_id, ps.platform, ps.web_pid, ps.rating_count,
                ps.price_rp, ps.price_sp,
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
        ),
        review_only_skus AS (
            SELECT DISTINCT r.web_pid, r.platform, 0::bigint AS rating_count
            FROM ratings.reviews r
            LEFT JOIN masters.products mp
                ON mp.company_id = r.company_id
               AND mp.product_external_id = r.web_pid
               AND LOWER(mp.platform) = LOWER(r.platform)
            WHERE r.company_id = $1
              ${totalReviewsWhere}
              AND NOT EXISTS (
                  SELECT 1 FROM latest_snaps ps
                  WHERE ps.company_id = $1 AND ps.web_pid = r.web_pid AND LOWER(ps.platform) = LOWER(r.platform)
              )
        ),
        all_skus AS (
            SELECT web_pid, platform, rating_count FROM snap_skus
            UNION ALL
            SELECT web_pid, platform, rating_count FROM review_only_skus
        )
        SELECT
            COUNT(DISTINCT web_pid) AS unique_skus,
            COALESCE(SUM(rating_count), 0) AS total_ratings
        FROM all_skus
    `;

    console.log('=== New totalSql test ===');
    console.log('Params:', totalParams);
    console.log('totalWhere:', totalWhere);
    console.log('totalReviewsWhere:', totalReviewsWhere);

    try {
        const { rows } = await pool.query(totalSqlFinal, totalParams);
        console.log('\n✅ Result:', rows[0]);
        if (parseInt(rows[0].unique_skus) > 0) {
            console.log('✅ SUCCESS: uniqueSkus > 0, All Categories card will show data!');
        } else {
            console.log('❌ FAIL: uniqueSkus = 0');
        }
    } catch (err) {
        console.error('❌ SQL Error:', err.message);
    }

    // Also test without price filter
    console.log('\n=== Without price filter ===');
    const noFilterResult = await pool.query(`
        WITH latest_snaps AS (
            SELECT DISTINCT ON (ps.company_id, ps.platform, ps.web_pid)
                ps.company_id, ps.platform, ps.web_pid, ps.rating_count,
                COALESCE(ps.is_competitor, false) AS is_competitor
            FROM ratings.product_snapshots ps
            WHERE ps.company_id = $1
            ORDER BY ps.company_id, ps.platform, ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
        )
        SELECT
            COUNT(DISTINCT web_pid) AS unique_skus,
            COALESCE(SUM(rating_count), 0) AS total_ratings
        FROM latest_snaps
    `, [COMPANY_ID]);
    console.log('Result (no filter):', noFilterResult.rows[0]);

    await pool.end();
}

run().catch(e => { console.error('FATAL:', e.message); pool.end(); });
