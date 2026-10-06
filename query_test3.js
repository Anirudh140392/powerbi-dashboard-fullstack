import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';
async function test() {
    const qp = { companyId: '297e37ea-a5ac-47df-bebd-ac44e52b7979', sentimentCategory: 'Brand', dateFrom: '2025-01-21', dateTo: '2025-07-21' };
    const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp, price_sp, category, pareto_status, rating, rating_count
                    FROM product_snapshots
                    WHERE company_id = {companyId:String} AND snapshot_date >= toDate({dateFrom:String})
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
                  
                  AND ls.web_pid IN (SELECT r.web_pid FROM ml_reviews r WHERE r.company_id = {companyId:String} AND r.sentiment_category ILIKE {sentimentCategory:String} AND r.review_date >= toDate({dateFrom:String}) AND r.review_date <= toDate({dateTo:String}))
            )
            SELECT count() as c FROM snap_cats
    `;
    const res = await clickhouse.query({
        database: 'prestige',
        query: sql,
        query_params: qp,
        format: 'JSONEachRow'
    });
    console.log(await res.json());
}
test().catch(console.error);
