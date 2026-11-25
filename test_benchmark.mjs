import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';
async function run() {
    const cid = 'fb064e5d-7e70-4cf1-b09b-e2428d8a1c9b';
    const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp, price_sp, category, rating, rating_count
                    FROM product_snapshots
                    WHERE company_id = '${cid}'
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY lower(platform), web_pid
            ),
            scoped_reviews AS (
                SELECT
                    multiIf(coalesce(r.is_competitor, 0) = 0, initcap('danone'), initcap(lower(r.brand))) AS brand,
                    coalesce(r.is_competitor, 0) AS is_competitor,
                    coalesce(nullIf(r.sentiment_category, ''), 'General') AS sentiment_category,
                    r.rating AS rev_rating, r.ml_inferred_rating AS rev_ml_rating, r.sentiment AS rev_sentiment, r.web_pid AS rev_web_pid, r.platform AS rev_platform,
                    ps.rating AS pdp_rating, ps.rating_count AS rating_count
                FROM ml_reviews r
                LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND lower(ps.platform) = lower(r.platform)
                WHERE r.company_id = '${cid}' AND (coalesce(r.is_competitor, 0) = 0 OR (isNotNull(r.brand) AND r.brand <> '' AND length(trim(r.brand)) >= 3 AND lower(trim(r.brand)) NOT IN ('the','not','and','gas','extracted','none','null','n/a','other','unknown','etc','for','was','were','our','your','its')))
            ),
            brand_totals AS (
                SELECT
                    brand, is_competitor,
                    count() AS total_reviews,
                    round(avg(rev_rating), 2) AS avg_rating,
                    round(avg(rev_ml_rating), 2) AS avg_ml_rating
                FROM scoped_reviews
                GROUP BY brand, is_competitor
                HAVING count() >= 3
            )
            SELECT t.brand, t.is_competitor, t.total_reviews FROM brand_totals t
    `;
    const chRes = await clickhouse.query({
        database: 'prestige',
        query: sql,
        format: 'JSONEachRow'
    });
    console.log(await chRes.json());
    process.exit(0);
}
run();
