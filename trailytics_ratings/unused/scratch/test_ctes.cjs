require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    port: 5432, ssl: { rejectUnauthorized: false }
});

const PRESTIGE_ID = '297e37ea-a5ac-47df-bebd-ac44e52b7979';

async function run() {
    console.log('=== TESTING EXACT CATEGORY-HEALTH SQL (simulating UI: price 35-1795, is_competitor=all) ===\n');

    // Simulate the actual API params
    const price_min = '35';
    const price_max = '1795';
    const price_mode = 'sp';
    const is_competitor = 'all';
    const period_months = '6';

    const sqlParams = [PRESTIGE_ID];
    const trendPeriod = 6;

    let competitorFilter = '';
    let snapshotCompetitorFilter = '';
    let platformFilter = '';
    let snapshotPlatformFilter = '';
    let reviewPriceFilter = '';
    let snapshotPriceFilter = '';
    let sentimentCategoryFilter = '';

    // is_competitor = 'all' → no filter added, no param pushed
    if (is_competitor !== undefined && is_competitor !== '' && is_competitor !== 'all') {
        competitorFilter = `AND r.is_competitor = $${sqlParams.length + 1}`;
        snapshotCompetitorFilter = `AND ps.is_competitor = $${sqlParams.length + 1}`;
        sqlParams.push(is_competitor === 'true');
    } else if (is_competitor === undefined || is_competitor === '') {
        competitorFilter = `AND r.is_competitor = false`;
        snapshotCompetitorFilter = `AND ps.is_competitor = false`;
    }

    if (price_min !== undefined && price_min !== '') {
        const reviewPriceExpr = price_mode === 'rp'
            ? 'COALESCE(ps_latest.price_rp, mp.mrp)'
            : 'COALESCE(ps_latest.price_sp, mp.selling_price, mp.mop, ps_latest.price_rp, mp.mrp)';
        const snapshotPriceExpr = price_mode === 'rp'
            ? 'COALESCE(ls.price_rp, mp.mrp)'
            : 'COALESCE(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';
        reviewPriceFilter += ` AND ${reviewPriceExpr} >= $${sqlParams.length + 1}`;
        snapshotPriceFilter += ` AND ${snapshotPriceExpr} >= $${sqlParams.length + 1}`;
        sqlParams.push(Number(price_min));
    }
    if (price_max !== undefined && price_max !== '') {
        const reviewPriceExpr = price_mode === 'rp'
            ? 'COALESCE(ps_latest.price_rp, mp.mrp)'
            : 'COALESCE(ps_latest.price_sp, mp.selling_price, mp.mop, ps_latest.price_rp, mp.mrp)';
        const snapshotPriceExpr = price_mode === 'rp'
            ? 'COALESCE(ls.price_rp, mp.mrp)'
            : 'COALESCE(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';
        reviewPriceFilter += ` AND ${reviewPriceExpr} <= $${sqlParams.length + 1}`;
        snapshotPriceFilter += ` AND ${snapshotPriceExpr} <= $${sqlParams.length + 1}`;
        sqlParams.push(Number(price_max));
    }

    const currentScopeFilter = `AND r.review_date >= (CURRENT_DATE - INTERVAL '${trendPeriod} months')`;
    const growthRangeFilter   = `AND r.review_date >= (CURRENT_DATE - INTERVAL '${trendPeriod * 2} months')`;
    const recentFilter        = `AND r.review_date >= (CURRENT_DATE - INTERVAL '${trendPeriod} months')`;
    const priorFilter         = `AND r.review_date >= (CURRENT_DATE - INTERVAL '${trendPeriod * 2} months') AND r.review_date < (CURRENT_DATE - INTERVAL '${trendPeriod} months')`;

    console.log('sqlParams:', sqlParams);
    console.log('competitorFilter:', competitorFilter || '(none)');
    console.log('snapshotCompetitorFilter:', snapshotCompetitorFilter || '(none)');
    console.log('reviewPriceFilter:', reviewPriceFilter);
    console.log('snapshotPriceFilter:', snapshotPriceFilter);

    // ---- Test cat_reviews alone ----
    console.log('\n--- Testing cat_reviews CTE ---');
    const catReviewsSql = `
        SELECT
            CASE 
                WHEN TRIM(LOWER(COALESCE(NULLIF(ps_latest.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')))) IN ('other', 'others') THEN 'Others'
                ELSE INITCAP(TRIM(COALESCE(NULLIF(ps_latest.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))))
            END AS category,
            COUNT(*) AS review_count,
            COUNT(DISTINCT r.web_pid) AS sku_count
        FROM ratings.reviews r
        LEFT JOIN masters.products mp
            ON mp.company_id = r.company_id
           AND mp.product_external_id = r.web_pid
           AND LOWER(mp.platform) = LOWER(r.platform)
        LEFT JOIN LATERAL (
            SELECT ps2.price_rp, ps2.price_sp, ps2.category, ps2.rating, ps2.rating_count
            FROM ratings.product_snapshots ps2
            WHERE ps2.company_id = r.company_id AND ps2.web_pid = r.web_pid AND LOWER(ps2.platform) = LOWER(r.platform)
            ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
            LIMIT 1
        ) ps_latest ON true
        WHERE r.company_id = $1
          ${competitorFilter}
          AND COALESCE(NULLIF(ps_latest.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) IS NOT NULL
          AND COALESCE(NULLIF(ps_latest.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) != ''
          ${currentScopeFilter}
          ${reviewPriceFilter}
          ${sentimentCategoryFilter}
        GROUP BY 1
        LIMIT 20
    `;
    const catReviewsResult = await pool.query(catReviewsSql, sqlParams);
    console.log(`cat_reviews returned ${catReviewsResult.rows.length} categories`);
    console.table(catReviewsResult.rows);

    // ---- Test cat_products alone ----
    console.log('\n--- Testing cat_products CTE ---');
    const catProductsSql = `
        SELECT
            CASE 
                WHEN TRIM(LOWER(COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, '')))) IN ('other', 'others') THEN 'Others'
                ELSE INITCAP(TRIM(COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, ''))))
            END AS category,
            COUNT(DISTINCT ls.web_pid) AS sku_count,
            SUM(ls.rating_count) AS total_ratings
        FROM (
            SELECT DISTINCT ON (ps.company_id, ps.platform, ps.web_pid)
                ps.company_id, ps.platform, ps.web_pid, ps.rating,
                ps.rating_count, ps.price_rp, ps.price_sp, ps.pareto_status, ps.category
            FROM ratings.product_snapshots ps
            WHERE ps.company_id = $1
              ${snapshotCompetitorFilter}
            ORDER BY ps.company_id, ps.platform, ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
        ) ls
        LEFT JOIN masters.products mp
            ON mp.company_id = ls.company_id
           AND mp.product_external_id = ls.web_pid
           AND LOWER(mp.platform) = LOWER(ls.platform)
        WHERE COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, '')) IS NOT NULL
          AND COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, '')) != ''
          ${snapshotPlatformFilter}
          ${snapshotPriceFilter}
        GROUP BY 1
        LIMIT 20
    `;
    const catProductsResult = await pool.query(catProductsSql, sqlParams);
    console.log(`cat_products returned ${catProductsResult.rows.length} categories`);
    console.table(catProductsResult.rows);

    // ---- Check price data availability in the joined tables ----
    console.log('\n--- Checking price availability for products in both tables ---');
    const priceCheck = await pool.query(`
        SELECT 
            COUNT(*) as total_reviews,
            COUNT(mp.product_external_id) as reviews_with_mp_match,
            COUNT(ps_latest.category) as reviews_with_snapshot,
            COUNT(mp.selling_price) as reviews_with_mp_sp,
            COUNT(mp.mrp) as reviews_with_mp_mrp,
            COUNT(COALESCE(ps_latest.price_sp, mp.selling_price, mp.mop, ps_latest.price_rp, mp.mrp)) as reviews_with_any_price,
            COUNT(*) FILTER (
                WHERE COALESCE(ps_latest.price_sp, mp.selling_price, mp.mop, ps_latest.price_rp, mp.mrp) >= 35
                  AND COALESCE(ps_latest.price_sp, mp.selling_price, mp.mop, ps_latest.price_rp, mp.mrp) <= 1795
            ) as reviews_in_price_range
        FROM ratings.reviews r
        LEFT JOIN masters.products mp
            ON mp.company_id = r.company_id
           AND mp.product_external_id = r.web_pid
           AND LOWER(mp.platform) = LOWER(r.platform)
        LEFT JOIN LATERAL (
            SELECT ps2.price_rp, ps2.price_sp, ps2.category
            FROM ratings.product_snapshots ps2
            WHERE ps2.company_id = r.company_id AND ps2.web_pid = r.web_pid AND LOWER(ps2.platform) = LOWER(r.platform)
            ORDER BY ps2.snapshot_date DESC LIMIT 1
        ) ps_latest ON true
        WHERE r.company_id = $1
          AND r.review_date >= (CURRENT_DATE - INTERVAL '6 months')
    `, [PRESTIGE_ID]);
    console.log('Price availability in reviews (last 6 months):');
    console.table(priceCheck.rows);

    // ---- Check if NaN prices are the issue ----
    console.log('\n--- Checking NaN prices in masters.products ---');
    const nanCheck = await pool.query(`
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE selling_price IS NOT NULL AND selling_price::text != 'NaN') as valid_sp,
            COUNT(*) FILTER (WHERE selling_price::text = 'NaN') as nan_sp,
            COUNT(*) FILTER (WHERE mrp IS NOT NULL AND mrp::text != 'NaN') as valid_mrp,
            COUNT(*) FILTER (WHERE mrp::text = 'NaN') as nan_mrp,
            COUNT(*) FILTER (WHERE 
                COALESCE(selling_price, mop, mrp) > 0 
                AND COALESCE(selling_price, mop, mrp)::text != 'NaN'
                AND COALESCE(selling_price, mop, mrp) >= 35
                AND COALESCE(selling_price, mop, mrp) <= 1795
            ) as in_range_35_1795
        FROM masters.products
        WHERE company_id = $1
    `, [PRESTIGE_ID]);
    console.log('masters.products price analysis:');
    console.table(nanCheck.rows);

    await pool.end();
}

run().catch(e => { console.error('FATAL:', e.message, e.stack); pool.end(); });
