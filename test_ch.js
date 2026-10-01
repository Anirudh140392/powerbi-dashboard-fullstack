const clickhouse = require('./trailytics_ratings/backend/src/config/clickhouse.js').default;
async function test() {
  const res = await clickhouse.query({
    query: `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp, price_sp, category, pareto_status, rating, rating_count
                    FROM product_snapshots
                    WHERE company_id = 'c1'
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY lower(platform), web_pid
            ),
            snap_cats AS (
                SELECT web_pid, coalesce(sku_code, '') AS sku_code, raw_category, raw_pareto_status FROM (
                    SELECT ls.web_pid, mp.sku_code,
                        coalesce(nullIf(ls.category, ''), nullIf(mp.category, '')) AS raw_category,
                        coalesce(nullIf(mp.pareto_status, ''), nullIf(ls.pareto_status, '')) AS raw_pareto_status,
                        ls.platform, ls.price_rp, ls.price_sp
                    FROM latest_snapshots ls
                    LEFT JOIN products mp ON mp.company_id = 'c1' AND mp.product_external_id = ls.web_pid AND lower(mp.platform) = lower(ls.platform)
                ) WHERE 1=1 
            ),
            review_only_cats AS (
                SELECT r.web_pid, mp.sku_code,
                    coalesce(nullIf(r.category, ''), nullIf(mp.category, '')) AS raw_category,
                    coalesce(nullIf(mp.pareto_status, ''), nullIf(r.pareto_status, '')) AS raw_pareto_status
                FROM ml_reviews r
                LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ls ON ls.web_pid = r.web_pid AND lower(ls.platform) = lower(r.platform)
                WHERE r.company_id = 'c1' AND ls.web_pid IS NULL 
            ),
            sku_category_map AS (
                SELECT web_pid, sku_code, coalesce(nullIf(sku_code,''), web_pid) AS canonical_sku,
                    multiIf(trim(lower(raw_category)) IN ('other', 'others'), 'Others', initcap(trim(raw_category))) AS category,
                    raw_pareto_status AS pareto_status
                FROM (
                    SELECT * FROM snap_cats UNION ALL SELECT * FROM review_only_cats
                )
            ),
            cat_sku_counts AS (
                SELECT category, count(DISTINCT canonical_sku) AS sku_count,
                    count(DISTINCT canonical_sku) FILTER (WHERE pareto_status = 'Pareto') AS pareto_count,
                    count(DISTINCT canonical_sku) FILTER (WHERE pareto_status IN ('Non-Pareto', 'Non-Pareto (Unclassified)') OR pareto_status IS NULL OR pareto_status = '') AS non_pareto_count,
                    count(DISTINCT canonical_sku) FILTER (WHERE pareto_status = 'NPD') AS npd_count
                FROM sku_category_map WHERE 1=1 GROUP BY category
            ),
            cat_reviews AS (
                SELECT scm.category AS cat_name, count() AS review_count, count(DISTINCT r.web_pid) AS sku_count,
                    round(avg(r.rating), 2) AS avg_review_rating, round(avg(r.ml_inferred_rating), 2) AS avg_ml_rating,
                    countIf(r.sentiment = 'Positive') AS positive_count, countIf(r.sentiment = 'Negative') AS negative_count, countIf(r.sentiment = 'Neutral') AS neutral_count
                FROM ml_reviews r
                LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ps_latest ON ps_latest.web_pid = r.web_pid AND lower(ps_latest.platform) = lower(r.platform)
                JOIN sku_category_map scm ON scm.web_pid = r.web_pid
                WHERE r.company_id = 'c1' 
                GROUP BY scm.category
            ),
            cat_growth AS (
                SELECT scm.category AS cat_name,
                    countIf(1=1 AND r.review_date >= addMonths(today(), -3)) AS recent_reviews,
                    countIf(1=1 AND r.review_date >= addMonths(today(), -6) AND r.review_date < addMonths(today(), -3)) AS prior_reviews,
                    round(avgIf(r.rating, 1=1 AND r.review_date >= addMonths(today(), -3)), 2) AS recent_rating,
                    round(avgIf(r.rating, 1=1 AND r.review_date >= addMonths(today(), -6) AND r.review_date < addMonths(today(), -3)), 2) AS prior_rating
                FROM ml_reviews r
                JOIN sku_category_map scm ON scm.web_pid = r.web_pid
                WHERE r.company_id = 'c1' 
                GROUP BY scm.category
            ),
            cat_products AS (
                SELECT scm.category AS cat_name, sum(ls.rating_count) AS total_ratings,
                    round(sum(ls.rating * ls.rating_count) / nullIf(sum(ls.rating_count), 0), 2) AS avg_platform_rating
                FROM sku_category_map scm
                JOIN latest_snapshots ls ON ls.web_pid = scm.web_pid
                GROUP BY scm.category
            ),
            cat_catalogue AS (
                SELECT multiIf(trim(lower(mp.category)) IN ('other', 'others'), 'Others', initcap(trim(mp.category))) AS cat_name,
                    count(DISTINCT mp.product_external_id) AS catalogue_sku_count
                FROM products mp
                WHERE mp.company_id = 'c1' AND mp.platform != '' AND mp.category != '' 
                GROUP BY cat_name
            ),
            combined_cats AS (
                SELECT c.category AS category, c.sku_count AS sku_count, coalesce(cc.catalogue_sku_count, c.sku_count) AS catalogue_sku_count,
                    coalesce(r.review_count, 0) AS review_count, coalesce(cp.total_ratings, 0) AS total_ratings, cp.avg_platform_rating AS avg_platform_rating
                FROM cat_sku_counts c
                LEFT JOIN cat_reviews r ON c.category = r.cat_name
                LEFT JOIN cat_products cp ON c.category = cp.cat_name
                LEFT JOIN cat_catalogue cc ON c.category = cc.cat_name
                WHERE c.sku_count > 0 OR r.review_count > 0
            )
            SELECT * FROM combined_cats ORDER BY review_count DESC LIMIT 2
    `,
    format: 'JSONEachRow'
  });
  console.log(await res.json());
}
test();
