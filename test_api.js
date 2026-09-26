import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';

async function test() {
    const queryParams = { companyId: '297e37ea-a5ac-47df-bebd-ac44e52b7979', sentimentCategory: 'Brand', dateFrom: '2025-01-21', dateTo: '2025-07-21' };
    
    // Copy the entire SQL from getCategoryHealth
    const trendPeriod = 3;
    const lookbackMonths = 6;
    const currentScopeFilter = `AND r.review_date >= subtractMonths(today(), 6)`;
    const growthRangeFilter = `AND r.review_date >= subtractMonths(today(), 12)`;
    const snapRatingFilter = '';
    const snapPlatformFiltStr = '';
    const snapParetoFilter = '';
    const snapCompetitorFilter = `AND coalesce(mp.is_competitor, 0) = 0`;
    const competitorFilter = `AND coalesce(r.is_competitor, 0) = 0`;
    const platformFiltStr = '';
    const reviewParetoFilter = '';
    const rating_bifurcation = '';
    const revCompetitorFilter = `AND coalesce(r.is_competitor, 0) = 0`;
    const revSentimentFilter = `AND r.sentiment_category ILIKE {sentimentCategory:String}`;
    const snapCatFiltStr = '';
    const snapPriceFiltStr = '';
    const snapshotDateFilter = `AND snapshot_date >= subtractMonths(today(), 6)`;

    const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp, price_sp, category, pareto_status, rating, rating_count
                    FROM product_snapshots
                    WHERE company_id = {companyId:String} ${snapshotDateFilter}
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
                  ${snapCompetitorFilter}
                  ${snapPlatformFiltStr}
                  ${snapParetoFilter}
                  ${snapRatingFilter}
                  AND ls.web_pid IN (SELECT r.web_pid FROM ml_reviews r WHERE r.company_id = {companyId:String} AND r.sentiment_category ILIKE {sentimentCategory:String} ${growthRangeFilter})
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
                      ${competitorFilter}
                      ${platformFiltStr}
                      AND coalesce(nullIf(r.category, ''), nullIf(mp.category, '')) != ''
                      ${growthRangeFilter}
                      ${reviewParetoFilter}
                      
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
                    uniqExact(canonical_sku) AS sku_count,
                    uniqExactIf(canonical_sku, pareto_status = 'Pareto') AS pareto_count,
                    uniqExactIf(canonical_sku, pareto_status IN ('Non-Pareto', 'Non-Pareto (Unclassified)') OR pareto_status IS NULL) AS non_pareto_count,
                    uniqExactIf(canonical_sku, pareto_status = 'NPD') AS npd_count
                FROM sku_category_map scm
                WHERE 1=1 ${snapCatFiltStr.replace("coalesce(nullIf(ls.category, ''), nullIf(mp.category, ''))", "category")} ${snapPriceFiltStr.replace(/ls\./g, 'scm.').replace(/mp\.mrp/g, 'scm.price_rp').replace(/mp\.selling_price/g, 'scm.price_sp').replace(/mp\.mop/g, 'scm.price_sp')}
                GROUP BY category
            )
            SELECT * FROM cat_sku_counts
    `;
    
    try {
        const res = await clickhouse.query({
            database: 'prestige',
            query: sql,
            query_params: queryParams,
            format: 'JSONEachRow'
        });
        console.log(await res.json());
    } catch(e) {
        console.error("ERROR:", e.message);
    }
}
test().catch(console.error);
