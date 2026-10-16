import clickhouse from './src/config/clickhouse.js';

async function run() {
    try {
        const queryParams = { 
            companyId: '297e37ea-a5ac-47df-bebd-ac44e52b7979'
        };

        const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp, price_sp, category, pareto_status, rating, rating_count
                    FROM product_snapshots
                    WHERE company_id = {companyId:String} AND snapshot_date >= addMonths(today(), -6)
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY lower(platform), web_pid
            ),
            snap_cats AS (
                SELECT
                    ls.web_pid, lower(ls.platform) as platform_key,
                    nullIf(mp.sku_code, '') AS sku_code,
                    coalesce(nullIf(ls.category, ''), nullIf(mp.category, '')) AS raw_category,
                    coalesce(nullIf(mp.pareto_status, ''), nullIf(ls.pareto_status, '')) AS raw_pareto_status,
                    coalesce(ls.price_rp, mp.mrp) AS price_rp,
                    coalesce(ls.price_sp, mp.selling_price, mp.mop) AS price_sp
                FROM latest_snapshots ls
                LEFT JOIN products mp ON mp.company_id = {companyId:String} AND mp.product_external_id = ls.web_pid AND lower(mp.platform) = lower(ls.platform)
                WHERE coalesce(nullIf(ls.category, ''), nullIf(mp.category, '')) != ''
                  AND coalesce(mp.is_competitor, 0) = 0
            ),
            review_only_cats AS (
                SELECT * FROM (
                    SELECT
                        r.web_pid, lower(r.platform) as platform_key,
                        nullIf(mp.sku_code, '') AS sku_code,
                        coalesce(nullIf(r.category, ''), nullIf(mp.category, '')) AS raw_category,
                        coalesce(nullIf(mp.pareto_status, ''), nullIf(r.pareto_status, '')) AS raw_pareto_status,
                        mp.mrp AS price_rp,
                        coalesce(mp.selling_price, mp.mop) AS price_sp
                    FROM ml_reviews r
                    LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                    WHERE r.company_id = {companyId:String}
                      AND coalesce(r.is_competitor, 0) = 0
                      AND coalesce(nullIf(r.category, ''), nullIf(mp.category, '')) != ''
                      AND r.review_date >= subtractMonths(today(), 6)
                      AND r.web_pid NOT IN (SELECT web_pid FROM snap_cats)
                    ORDER BY r.review_date DESC
                ) LIMIT 1 BY web_pid
            ),
            sku_category_map AS (
                SELECT web_pid, platform_key, sku_code, coalesce(sku_code, web_pid) AS canonical_sku,
                    multiIf(trim(lower(raw_category)) IN ('other', 'others'), 'Others', initcap(trim(raw_category))) AS category,
                    raw_pareto_status AS pareto_status,
                    price_rp, price_sp
                FROM (
                    SELECT * FROM snap_cats
                    UNION ALL
                    SELECT * FROM review_only_cats
                )
            ),
            cat_sku_counts AS (
                SELECT category,
                    count(DISTINCT canonical_sku) AS sku_count,
                    count(DISTINCT canonical_sku) FILTER (WHERE pareto_status = 'Pareto') AS pareto_count,
                    count(DISTINCT canonical_sku) FILTER (WHERE pareto_status IN ('Non-Pareto', 'Non-Pareto (Unclassified)') OR pareto_status IS NULL) AS non_pareto_count,
                    count(DISTINCT canonical_sku) FILTER (WHERE pareto_status = 'NPD') AS npd_count
                FROM sku_category_map
                GROUP BY category
            ),
            cat_reviews AS (
                SELECT
                    scm.category AS cat_name,
                    count() AS review_count,
                    count(DISTINCT r.web_pid) AS sku_count,
                    round(avg(r.rating), 2) AS avg_review_rating,
                    round(avg(r.ml_inferred_rating), 2) AS avg_ml_rating,
                    countIf(r.sentiment = 'Positive') AS positive_count,
                    countIf(r.sentiment = 'Negative') AS negative_count,
                    countIf(r.sentiment = 'Neutral') AS neutral_count
                FROM ml_reviews r
                JOIN sku_category_map scm ON scm.web_pid = r.web_pid AND scm.platform_key = lower(r.platform)
                WHERE r.company_id = {companyId:String} AND coalesce(r.is_competitor, 0) = 0   AND r.review_date >= subtractMonths(today(), 3)
                GROUP BY scm.category
            ),
            cat_growth AS (
                SELECT scm.category AS cat_name,
                    countIf(1=1 AND r.review_date >= subtractMonths(today(), 3)) AS recent_reviews,
                    countIf(1=1 AND r.review_date >= subtractMonths(today(), 6) AND r.review_date < subtractMonths(today(), 3)) AS prior_reviews,
                    round(avgIf(r.rating, 1=1 AND r.review_date >= subtractMonths(today(), 3)), 2) AS recent_rating,
                    round(avgIf(r.rating, 1=1 AND r.review_date >= subtractMonths(today(), 6) AND r.review_date < subtractMonths(today(), 3)), 2) AS prior_rating
                FROM ml_reviews r
                JOIN sku_category_map scm ON scm.web_pid = r.web_pid AND scm.platform_key = lower(r.platform)
                WHERE r.company_id = {companyId:String} AND coalesce(r.is_competitor, 0) = 0   AND r.review_date >= subtractMonths(today(), 6)
                GROUP BY scm.category
            ),
            cat_products AS (
                SELECT
                    scm.category AS cat_name,
                    sum(ls.rating_count) AS total_ratings,
                    round(sum(ls.rating * ls.rating_count) / nullIf(sum(ls.rating_count), 0), 2) AS avg_platform_rating
                FROM sku_category_map scm
                JOIN latest_snapshots ls ON ls.web_pid = scm.web_pid AND lower(ls.platform) = scm.platform_key
                GROUP BY scm.category
            ),
            cat_catalogue AS (
                SELECT
                    multiIf(trim(lower(mp.category)) IN ('other', 'others'), 'Others', initcap(trim(mp.category))) AS cat_name,
                    count(DISTINCT mp.product_external_id) AS catalogue_sku_count
                FROM products mp
                WHERE mp.company_id = {companyId:String} AND mp.platform != '' AND mp.category != '' AND coalesce(mp.is_competitor, 0) = 0
                GROUP BY cat_name
            ),
            combined_cats AS (
                SELECT c.category AS category, c.sku_count AS sku_count, c.pareto_count AS pareto_count, c.non_pareto_count AS non_pareto_count, c.npd_count AS npd_count,
                    coalesce(cc.catalogue_sku_count, c.sku_count) AS catalogue_sku_count,
                    coalesce(r.review_count, 0) AS review_count,
                    coalesce(r.sku_count, 0) AS review_sku_count,
                    r.avg_review_rating, r.avg_ml_rating, r.positive_count, r.negative_count, r.neutral_count,
                    coalesce(cp.total_ratings, 0) AS total_ratings,
                    cp.avg_platform_rating,
                    g.recent_reviews, g.prior_reviews, g.recent_rating, g.prior_rating,
                    multiIf(g.prior_reviews > 0, toFloat64(g.recent_reviews - g.prior_reviews) / g.prior_reviews * 100, 0.0) AS growth_pct,
                    multiIf(r.review_count > 0, (toFloat64(r.positive_count) - r.negative_count) / r.review_count * 50 + 50, 50.0) AS health_score
                FROM cat_sku_counts c
                LEFT JOIN cat_reviews r ON c.category = r.cat_name
                LEFT JOIN cat_growth g ON c.category = g.cat_name
                LEFT JOIN cat_products cp ON c.category = cp.cat_name
                LEFT JOIN cat_catalogue cc ON c.category = cc.cat_name
                WHERE c.sku_count > 0 OR r.review_count > 0
            )
            SELECT * FROM combined_cats ORDER BY review_count DESC
        `;
        const chRes = await clickhouse.query({ database: 'prestige', query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();
        console.log("Returned rows count:", rows.length);
        if (rows.length > 0) {
            console.log(rows[0]);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
