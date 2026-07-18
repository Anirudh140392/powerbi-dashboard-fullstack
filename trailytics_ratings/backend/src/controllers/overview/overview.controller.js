import clickhouse from '../../config/clickhouse.js';

const getTargetDb = (req) => {
    return req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] || (req.authUser && req.authUser.dbName) || process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || 'prestige';
};

export const getSummary = async (req, res) => {
    try {
        const { platform, category, pareto_status, web_pid, date_from, date_to, price_mode, price_min, price_max, is_competitor, sentiment_category } = req.query;

        const queryParams = { companyId: String(req.companyId) };
        let where = ['rs.company_id = {companyId:String}'];

        if (is_competitor && is_competitor !== 'all') {
            where.push(`rs.is_competitor = {isCompetitor:UInt8}`);
            queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        }

        if (platform && platform !== 'all') {
            where.push(`ilike(rs.platform, {platform:String})`);
            queryParams.platform = platform;
        }
        if (category) {
            where.push(`ilike(trim(rs.resolved_category), {category:String})`);
            queryParams.category = category;
        }
        if (sentiment_category) {
            where.push(`ilike(rs.sentiment_category, {sentimentCategory:String})`);
            queryParams.sentimentCategory = sentiment_category;
        }
        if (pareto_status) {
            where.push(`rs.resolved_pareto_status = {paretoStatus:String}`);
            queryParams.paretoStatus = pareto_status;
        }
        if (web_pid) {
            where.push(`rs.web_pid = {webPid:String}`);
            queryParams.webPid = web_pid;
        }

        let dateWhere = [];
        if (date_from) {
            dateWhere.push(`rs.review_date >= toDate({dateFrom:String})`);
            queryParams.dateFrom = date_from;
        } else {
            dateWhere.push(`rs.review_date >= addMonths(today(), -3)`);
        }
        if (date_to) {
            dateWhere.push(`rs.review_date <= toDate({dateTo:String})`);
            queryParams.dateTo = date_to;
        }
        if (dateWhere.length > 0) {
            where.push('(' + dateWhere.join(' AND ') + ')');
        }

        const priceExpr = price_mode === 'rp' ? 'rs.resolved_price_rp' : 'rs.resolved_price_sp';
        if (price_min !== undefined && price_min !== '') {
            where.push(`${priceExpr} >= {priceMin:Float64}`);
            queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            where.push(`${priceExpr} <= {priceMax:Float64}`);
            queryParams.priceMax = Number(price_max);
        }

        const whereClause = where.join(' AND ');

        if (!req.companyId) {
            return res.status(401).json({ error: 'Company context required' });
        }

        const baseScopeSql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT 
                        company_id, platform, web_pid, is_competitor,
                        price_rp, price_sp, rating, rating_count,
                        category, pareto_status
                    FROM product_snapshots
                    WHERE company_id = {companyId:String}
                    ORDER BY snapshot_date DESC, created_at DESC
                )
                LIMIT 1 BY company_id, lower(platform), web_pid
            ),
            review_scope AS (
                SELECT r.id AS id, r.company_id AS company_id, r.platform AS platform, r.product_id AS product_id, r.web_pid AS web_pid, r.product_name AS product_name, r.brand AS brand, r.review_external_id AS review_external_id, r.reviewer_name AS reviewer_name, r.rating AS rating, r.review_title AS review_title, r.review_text AS review_text, r.review_date AS review_date, r.is_verified_purchase AS is_verified_purchase, r.pdp_rating AS pdp_rating, r.pdp_rating_count AS pdp_rating_count, r.star_distribution AS star_distribution, r.sentiment_category AS sentiment_category, r.sentiment_subcategory AS sentiment_subcategory, r.sentiment_score AS sentiment_score, r.category AS category, r.material AS material, r.wattage AS wattage, r.is_competitor AS is_competitor, r.pareto_status AS pareto_status, r.crawl_id AS crawl_id, r.created_at AS created_at, r.updated_at AS updated_at, r.sentiment AS sentiment, r.quality_score AS quality_score, r.specific_issue AS specific_issue, r.ml_inferred_rating AS ml_inferred_rating, r.category_source AS category_source, r.sentiment_source AS sentiment_source, r.specific_issue_source AS specific_issue_source,
                    coalesce(nullIf(mp.pareto_status, ''), nullIf(ls.pareto_status, '')) AS resolved_pareto_status,
                    CASE
                        WHEN trim(lower(coalesce(nullIf(ls.category, ''), nullIf(mp.category, '')))) IN ('other', 'others') THEN 'Others'
                        ELSE initcap(trim(coalesce(nullIf(ls.category, ''), nullIf(mp.category, ''))))
                    END AS resolved_category,
                    coalesce(ls.price_rp, mp.mrp) AS resolved_price_rp,
                    coalesce(ls.price_sp, mp.selling_price, mp.mop) AS resolved_price_sp,
                    mp.mrp AS base_mrp,
                    mp.selling_price AS base_selling_price,
                    mp.mop AS base_mop,
                    ls.rating AS resolved_pdp_rating,
                    ls.rating_count AS resolved_pdp_rating_count
                FROM ml_reviews r
                LEFT JOIN products mp
                    ON mp.company_id = r.company_id
                   AND mp.product_external_id = r.web_pid
                   AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ls
                    ON ls.company_id = r.company_id
                   AND ls.web_pid = r.web_pid
                   AND lower(ls.platform) = lower(r.platform)
            ),
            filtered_reviews AS (
                SELECT *
                FROM review_scope rs
                WHERE ${whereClause}
            ),
            filtered_products AS (
                SELECT DISTINCT
                    web_pid,
                    platform,
                    resolved_pdp_rating,
                    resolved_pdp_rating_count
                FROM filtered_reviews
            )
            SELECT
                toString(count()) AS total_reviews,
                toString(round(avg(rating), 2)) AS avg_review_rating,
                toString(round(avg(ml_inferred_rating), 2)) AS avg_ml_rating,
                toString(count(DISTINCT web_pid)) AS unique_products,
                toString(count(DISTINCT resolved_category)) AS unique_categories,
                toString(countIf(sentiment = 'Positive')) AS positive_count,
                toString(countIf(sentiment = 'Negative')) AS negative_count,
                toString(countIf(sentiment = 'Neutral')) AS neutral_count,
                coalesce((SELECT toString(sum(coalesce(resolved_pdp_rating_count, 0))) FROM filtered_products), '0') AS total_ratings,
                (SELECT toString(round(sum(coalesce(resolved_pdp_rating, 0) * coalesce(resolved_pdp_rating_count, 0)) / nullIf(sum(coalesce(resolved_pdp_rating_count, 0)), 0), 2)) FROM filtered_products) AS avg_platform_rating,
                coalesce((SELECT toString(count()) FROM filtered_products), '0') AS total_products
            FROM filtered_reviews
        `;

        const combinedMetricsResult = await clickhouse.query({ database: getTargetDb(req), query: baseScopeSql, query_params: queryParams, format: 'JSONEachRow' });
        const combinedMetricsRows = await combinedMetricsResult.json();
        const metrics = combinedMetricsRows[0] || {};

        const snapWhere = [];
        let snapParams = { companyId: String(req.companyId) };
        if (is_competitor && is_competitor !== 'all') {
            snapWhere.push(`sc.is_competitor = {isCompetitor:UInt8}`);
            snapParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        }
        if (platform && platform !== 'all') {
            snapWhere.push(`ilike(sc.platform, {platform:String})`);
            snapParams.platform = platform;
        }
        if (category) {
            snapWhere.push(`ilike(trim(sc.resolved_category), {category:String})`);
            snapParams.category = category;
        }
        if (pareto_status) {
            snapWhere.push(`sc.resolved_pareto_status = {paretoStatus:String}`);
            snapParams.paretoStatus = pareto_status;
        }
        if (web_pid) {
            snapWhere.push(`sc.web_pid = {webPid:String}`);
            snapParams.webPid = web_pid;
        }
        const snapPriceExpr = price_mode === 'rp' ? 'sc.resolved_price_rp' : 'coalesce(sc.resolved_price_sp, sc.resolved_price_rp)';
        if (price_min !== undefined && price_min !== '') {
            snapWhere.push(`${snapPriceExpr} >= {priceMin:Float64}`);
            snapParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            snapWhere.push(`${snapPriceExpr} <= {priceMax:Float64}`);
            snapParams.priceMax = Number(price_max);
        }
        const snapWhereSql = snapWhere.length ? `WHERE ${snapWhere.join(' AND ')}` : '';

        let pdpMetrics = {};
        try {
            const snapRes = await clickhouse.query({
                database: getTargetDb(req),
                query: `
                    WITH latest_snapshots AS (
                        SELECT * FROM (
                            SELECT company_id, platform, web_pid, is_competitor, price_rp, price_sp, rating, rating_count, category, pareto_status
                            FROM product_snapshots
                            WHERE company_id = {companyId:String}
                            ORDER BY snapshot_date DESC, created_at DESC
                        )
                        LIMIT 1 BY company_id, lower(platform), web_pid
                    ),
                    sc AS (
                        SELECT ls.web_pid, ls.platform, ls.is_competitor, ls.rating, ls.rating_count,
                            CASE WHEN trim(lower(coalesce(nullIf(ls.category, ''), nullIf(mp.category, '')))) IN ('other', 'others') THEN 'Others'
                                 ELSE initcap(trim(coalesce(nullIf(ls.category, ''), nullIf(mp.category, '')))) END AS resolved_category,
                            coalesce(nullIf(mp.pareto_status, ''), nullIf(ls.pareto_status, '')) AS resolved_pareto_status,
                            coalesce(ls.price_rp, mp.mrp) AS resolved_price_rp,
                            coalesce(ls.price_sp, mp.selling_price, mp.mop) AS resolved_price_sp
                        FROM latest_snapshots ls
                        LEFT JOIN products mp
                            ON mp.company_id = {companyId:String}
                           AND mp.product_external_id = ls.web_pid
                           AND lower(mp.platform) = lower(ls.platform)
                    )
                    SELECT
                        toString(coalesce(sum(coalesce(sc.rating_count, 0)), 0)) AS total_ratings,
                        toString(round(sum(coalesce(sc.rating, 0) * coalesce(sc.rating_count, 0)) / nullIf(sum(coalesce(sc.rating_count, 0)), 0), 2)) AS avg_platform_rating,
                        toString(count()) AS total_products
                    FROM sc
                    ${snapWhereSql}
                `,
                query_params: snapParams,
                format: 'JSONEachRow'
            });
            const snapRows = await snapRes.json();
            pdpMetrics = snapRows[0] || {};
        } catch (snapErr) {
            console.error('Summary snapshot-PDP error (falling back to review-derived):', snapErr.message);
            pdpMetrics = { total_ratings: metrics.total_ratings, avg_platform_rating: metrics.avg_platform_rating };
        }

        res.json({
            metrics: {
                ...metrics,
                user_rating: metrics.avg_review_rating || null,
                ml_rating: metrics.avg_ml_rating || null,
                pdp_rating: pdpMetrics.avg_platform_rating || null,
                review_count: metrics.total_reviews || '0',
                rating_count: pdpMetrics.total_ratings || '0',
                total_ratings: pdpMetrics.total_ratings || '0',
                avg_platform_rating: pdpMetrics.avg_platform_rating || null,
            },
            ratingDistribution: [], sentimentDistribution: [], materialDistribution: [], categoryDistribution: [],
        });
    } catch (error) {
        console.error('Error fetching summary:', error);
        res.json({
            metrics: { user_rating: null, ml_rating: null, pdp_rating: null, review_count: '0', rating_count: '0', total_ratings: '0', avg_platform_rating: null, total_reviews: '0', avg_review_rating: null, avg_ml_rating: null, unique_products: '0', unique_categories: '0', positive_count: '0', negative_count: '0', neutral_count: '0', total_products: '0' },
            ratingDistribution: [], sentimentDistribution: [], materialDistribution: [], categoryDistribution: [],
        });
    }
};

export const getTrends = async (req, res) => {
    try {
        const periodMonths = parseInt(req.query.period_months) || 6;
        const { category, pareto_status, web_pid, date_from, date_to, platform, price_mode, price_min, price_max, is_competitor } = req.query;
        const safePeriodMonths = Math.max(1, Math.min(periodMonths, 24));
        const queryParams = { companyId: String(req.companyId) };
        const extraFilters = [];

        if (is_competitor && is_competitor !== 'all') {
            extraFilters.push(`coalesce(r.is_competitor, 0) = {isCompetitor:UInt8}`);
            queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        } else if (is_competitor === undefined || is_competitor === '') {
            extraFilters.push(`coalesce(r.is_competitor, 0) = 0`);
        }

        if (platform && platform !== 'all') {
            extraFilters.push(`ilike(r.platform, {platform:String})`);
            queryParams.platform = platform;
        }
        if (category) {
            extraFilters.push(`ilike(coalesce(nullIf(ps.category, ''), nullIf(r.category, ''), nullIf(mp.category, '')), {category:String})`);
            queryParams.category = category;
        }
        const sentiment_category = req.query.sentiment_category;
        if (sentiment_category && sentiment_category !== 'all') {
            extraFilters.push(`ilike(r.sentiment_category, {sentimentCategory:String})`);
            queryParams.sentimentCategory = sentiment_category;
        }
        if (pareto_status) {
            extraFilters.push(`coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) = {paretoStatus:String}`);
            queryParams.paretoStatus = pareto_status;
        }
        if (web_pid) {
            extraFilters.push(`r.web_pid = {webPid:String}`);
            queryParams.webPid = web_pid;
        }
        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            extraFilters.push(`${priceExpr} >= {priceMin:Float64}`);
            queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            extraFilters.push(`${priceExpr} <= {priceMax:Float64}`);
            queryParams.priceMax = Number(price_max);
        }

        let recentPeriodFilter; let priorPeriodFilter; let combinedWindowFilter;
        if (date_from && date_to) {
            queryParams.dateFrom = date_from; queryParams.dateTo = date_to;
            const midpointExpr = `(toDate({dateFrom:String}) + toUInt32((toDate({dateTo:String}) - toDate({dateFrom:String})) / 2))`;
            recentPeriodFilter = `r.review_date >= ${midpointExpr} AND r.review_date <= toDate({dateTo:String})`;
            priorPeriodFilter = `r.review_date >= toDate({dateFrom:String}) AND r.review_date < ${midpointExpr}`;
            combinedWindowFilter = `r.review_date >= toDate({dateFrom:String}) AND r.review_date <= toDate({dateTo:String})`;
        } else {
            const recentStartExpr = `addMonths(today(), -${safePeriodMonths})`;
            const priorStartExpr = `addMonths(today(), -${safePeriodMonths * 2})`;
            recentPeriodFilter = `r.review_date >= ${recentStartExpr}`;
            priorPeriodFilter = `r.review_date >= ${priorStartExpr} AND r.review_date < ${recentStartExpr}`;
            combinedWindowFilter = `r.review_date >= ${priorStartExpr}`;
        }
        const extraWhere = extraFilters.length > 0 ? `AND ${extraFilters.join(' AND ')}` : '';

        const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp, price_sp, category, pareto_status
                    FROM product_snapshots
                    WHERE company_id = {companyId:String}
                    ORDER BY snapshot_date DESC, created_at DESC
                )
                LIMIT 1 BY web_pid, lower(platform)
            ),
            scoped_reviews AS (
                SELECT
                    REPLACE(coalesce(nullIf(r.sentiment_subcategory, ''), nullIf(r.sentiment_category, ''), 'General'), '_', ' ') AS characteristic,
                    CASE WHEN ${recentPeriodFilter} THEN 'recent' WHEN ${priorPeriodFilter} THEN 'prior' ELSE NULL END AS period,
                    r.sentiment
                FROM ml_reviews r
                LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND lower(ps.platform) = lower(r.platform)
                WHERE r.company_id = {companyId:String} AND isNotNull(r.review_date) AND ${combinedWindowFilter} ${extraWhere}
            ),
            aggregated AS (
                SELECT characteristic, countIf(period = 'recent') AS recent_total, countIf(period = 'recent' AND sentiment = 'Negative') AS recent_neg, countIf(period = 'recent' AND sentiment = 'Positive') AS recent_pos, countIf(period = 'prior') AS prior_total, countIf(period = 'prior' AND sentiment = 'Negative') AS prior_neg, countIf(period = 'prior' AND sentiment = 'Positive') AS prior_pos
                FROM scoped_reviews WHERE isNotNull(period) GROUP BY characteristic
            )
            SELECT characteristic, recent_total, recent_neg, recent_pos, prior_total, prior_neg, prior_pos,
                CASE WHEN recent_total > 0 THEN toFloat64(recent_neg) / recent_total ELSE 0 END AS recent_neg_rate,
                CASE WHEN prior_total > 0 THEN toFloat64(prior_neg) / prior_total ELSE 0 END AS prior_neg_rate,
                (CASE WHEN recent_total > 0 THEN toFloat64(recent_neg) / recent_total ELSE 0 END) - (CASE WHEN prior_total > 0 THEN toFloat64(prior_neg) / prior_total ELSE 0 END) AS change
            FROM aggregated
            WHERE characteristic NOT IN ('General Feedback', 'Overall Quality', 'General') AND recent_total >= 5 AND prior_total >= 5
            ORDER BY change DESC
        `;

        console.log("SQL:", sql); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const escalating = rows.filter(r => r.change > 0.01 && r.recent_neg_rate > 0.10).slice(0, 10).map(r => ({
            characteristic: r.characteristic, recentNegativeRate: parseFloat(r.recent_neg_rate), olderNegativeRate: parseFloat(r.prior_neg_rate), change: parseFloat(r.change), recentCount: parseInt(r.recent_total), totalCount: parseInt(r.recent_total) + parseInt(r.prior_total), isEscalating: true, isImproving: false,
        }));
        const improving = rows.filter(r => r.change < -0.01).sort((a, b) => parseFloat(a.change) - parseFloat(b.change)).slice(0, 10).map(r => ({
            characteristic: r.characteristic, recentNegativeRate: parseFloat(r.recent_neg_rate), olderNegativeRate: parseFloat(r.prior_neg_rate), change: parseFloat(r.change), recentCount: parseInt(r.recent_total), totalCount: parseInt(r.recent_total) + parseInt(r.prior_total), isEscalating: false, isImproving: true,
        }));
        res.json({ escalating, improving });
    } catch (err) {
        console.error('Trends error:', err);
        res.json({ escalating: [], improving: [] });
    }
};

export const getTimeline = async (req, res) => {
    try {
        const { category: filterCategory, pareto_status, web_pid, date_from, date_to, platform, price_mode, price_min, price_max, is_competitor } = req.query;
        const queryParams = { companyId: String(req.companyId) };
        const extraFilters = [];
        
        if (platform && platform !== 'all') { extraFilters.push(`ilike(r.platform, {platform:String})`); queryParams.platform = platform; }
        if (filterCategory) { extraFilters.push(`ilike(r.category, {category:String})`); queryParams.category = filterCategory; }
        if (pareto_status) { extraFilters.push(`r.pareto_status = {paretoStatus:String}`); queryParams.paretoStatus = pareto_status; }
        if (web_pid) { extraFilters.push(`r.web_pid = {webPid:String}`); queryParams.webPid = web_pid; }
        if (date_from) { extraFilters.push(`r.review_date >= toDate({dateFrom:String})`); queryParams.dateFrom = date_from; }
        if (date_to) { extraFilters.push(`r.review_date <= toDate({dateTo:String})`); queryParams.dateTo = date_to; }
        
        if (is_competitor && is_competitor !== 'all') {
            extraFilters.push(`r.is_competitor = {isCompetitor:UInt8}`); queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        }
        
        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            extraFilters.push(`${priceExpr} >= {priceMin:Float64}`); queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            extraFilters.push(`${priceExpr} <= {priceMax:Float64}`); queryParams.priceMax = Number(price_max);
        }
        
        if (!date_from && !date_to && req.query.period_months) {
            const pm = Math.max(1, Math.min(parseInt(req.query.period_months, 10) || 6, 24));
            extraFilters.push(`r.review_date >= addMonths(today(), -${pm})`);
        }
        
        const extraWhere = extraFilters.length > 0 ? 'AND ' + extraFilters.join(' AND ') : '';
        const needsPriceJoins = (price_min !== undefined && price_min !== '') || (price_max !== undefined && price_max !== '');
        
        // ClickHouse doesn't support LATERAL JOIN in the same way, but since we just need the latest price_rp/price_sp per product,
        // we can join on a subquery that gets the latest snapshot per product.
        const priceJoins = needsPriceJoins ? `
            LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
            LEFT JOIN (
                SELECT * FROM (
                    SELECT company_id, web_pid, platform, price_rp, price_sp
                    FROM product_snapshots
                    WHERE company_id = {companyId:String}
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY company_id, web_pid, lower(platform)
            ) ps ON ps.company_id = r.company_id AND upper(ps.web_pid) = upper(r.web_pid) AND lower(ps.platform) = lower(r.platform)
        ` : '';

        const sql = `
            SELECT
                formatDateTime(r.review_date, '%Y-%m') AS month,
                r.sentiment_category AS category,
                count() AS total,
                countIf(r.sentiment = 'Positive') AS positive,
                countIf(r.sentiment = 'Negative') AS negative,
                countIf(r.sentiment = 'Neutral') AS neutral,
                round(avg(r.rating), 2) AS avg_rating
            FROM ml_reviews r
            ${priceJoins}
            WHERE r.company_id = {companyId:String} AND isNotNull(r.review_date)
              ${extraWhere}
            GROUP BY month, category
            ORDER BY month, category
        `;
        
        console.log("SQL:", sql); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const monthMap = {};
        rows.forEach(r => {
            if (!monthMap[r.month]) { monthMap[r.month] = { month: r.month, categories: {}, totalReviews: 0, avgRating: 0 }; }
            const cat = r.category || 'Uncategorized';
            monthMap[r.month].categories[cat] = { positive: parseInt(r.positive), negative: parseInt(r.negative), neutral: parseInt(r.neutral), total: parseInt(r.total) };
            monthMap[r.month].totalReviews += parseInt(r.total);
            monthMap[r.month].avgRating += parseFloat(r.avg_rating || 0) * parseInt(r.total);
        });

        Object.values(monthMap).forEach(m => { m.avgRating = m.totalReviews > 0 ? m.avgRating / m.totalReviews : 0; });
        const timeline = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
        res.json({ timeline });
    } catch (err) {
        console.error('Timeline error:', err);
        res.json({ timeline: [] });
    }
};

export const getRatingTrend = async (req, res) => {
    try {
        const { web_pid, platform, days } = req.query;
        if (!web_pid) return res.status(400).json({ error: 'web_pid param required' });
        const daysClamped = Math.max(1, Math.min(parseInt(days, 10) || 180, 365));

        const queryParams = { companyId: String(req.companyId), webPid: String(web_pid), daysClamped: Number(daysClamped) };
        let platformClause = '';
        if (platform && platform !== 'all') {
            queryParams.platform = String(platform);
            platformClause = `AND lower(platform) = lower({platform:String})`;
        }

        if (String(req.query.bucket) === 'week') {
            const sql = `
                SELECT week_start, platform, rating, rating_count, review_count,
                       prev_rating, prev_rating_count,
                       rating_wow_delta, rating_count_wow_delta, crosses_discontinuity
                FROM weekly_rating_trend
                WHERE company_id = {companyId:String}
                  AND web_pid = {webPid:String}
                  ${platformClause}
                  AND week_start >= addDays(today(), -{daysClamped:Int32})
                ORDER BY week_start ASC, platform ASC
            `;
            console.log("SQL:", sql); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const wrows = await chRes.json();
            
            return res.json({
                bucket: 'week',
                points: wrows.map(r => ({
                    week_start: r.week_start,
                    platform: r.platform,
                    rating: r.rating != null ? Number(r.rating) : null,
                    rating_count: r.rating_count,
                    review_count: r.review_count,
                    prev_rating: r.prev_rating != null ? Number(r.prev_rating) : null,
                    prev_rating_count: r.prev_rating_count,
                    rating_wow_delta: r.rating_wow_delta != null ? Number(r.rating_wow_delta) : null,
                    rating_count_wow_delta: r.rating_count_wow_delta,
                    crosses_discontinuity: r.crosses_discontinuity,
                })),
            });
        }

        const sql = `
            SELECT snapshot_date, platform,
                   round(avg(rating), 2) AS rating,
                   max(rating_count) AS rating_count,
                   max(review_count) AS review_count,
                   round(avg(price_rp), 2) AS price_rp,
                   round(avg(price_sp), 2) AS price_sp
            FROM product_snapshots
            WHERE company_id = {companyId:String}
              AND web_pid = {webPid:String}
              ${platformClause}
              AND snapshot_date >= addDays(today(), -{daysClamped:Int32})
            GROUP BY snapshot_date, platform
            ORDER BY snapshot_date ASC, platform ASC
        `;
        console.log("SQL:", sql); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        res.json({
            points: rows.map(r => ({
                date: r.snapshot_date,
                platform: r.platform,
                rating: r.rating != null ? Number(r.rating) : null,
                rating_count: r.rating_count,
                review_count: r.review_count,
                price_rp: r.price_rp != null ? Number(r.price_rp) : null,
                price_sp: r.price_sp != null ? Number(r.price_sp) : null,
            })),
        });
    } catch (err) {
        console.error('rating-trend error:', err);
        res.json({ points: [] });
    }
};

export const getExecutiveHealth = async (req, res) => {
    try {
        const { category: filterCategory, pareto_status: filterParetoStatus, rating_bifurcation, platform, period_months, date_from, date_to, price_mode, price_min, price_max, is_competitor, sentiment_category } = req.query;
        const trendPeriod = parseInt(period_months) || 3;

        const queryParams = { companyId: String(req.companyId) };
        let latestSnapshotFilters = ''; let categoryFilter = ''; let ratingFilter = ''; let paretoFilter = ''; let priceFilter = ''; let reviewScopeFilter = ''; let recentReviewFilter = ''; let priorReviewFilter = ''; let competitorFilter = ''; let sentimentCategoryFilter = '';

        if (is_competitor === 'true' || is_competitor === 'false') {
            competitorFilter = `AND coalesce(is_competitor, 0) = {isCompetitor:UInt8}`;
            queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        } else if (is_competitor === 'all') {
            competitorFilter = '';
        } else {
            competitorFilter = `AND coalesce(is_competitor, 0) = 0`;
        }
        
        const snapshotCompetitorFilter = competitorFilter.replace('coalesce(is_competitor', 'coalesce(ps.is_competitor, mp.is_competitor');
        const reviewCompetitorFilter = competitorFilter.replace('coalesce(is_competitor', 'coalesce(r.is_competitor');
        const masterCompetitorFilter = competitorFilter.replace('coalesce(is_competitor', 'coalesce(mp.is_competitor');
        let masterPlatformFilter = ''; let masterCategoryFilter = '';

        if (sentiment_category && sentiment_category !== 'all') {
            sentimentCategoryFilter = `AND ilike(r.sentiment_category, {sentimentCategory:String})`;
            queryParams.sentimentCategory = sentiment_category;
        }

        if (platform && platform !== 'all') {
            queryParams.platform = platform;
            latestSnapshotFilters += ` AND ilike(ps.platform, {platform:String})`;
            reviewScopeFilter += ` AND ilike(r.platform, {platform:String})`;
            masterPlatformFilter += ` AND ilike(mp.platform, {platform:String})`;
        }

        if (date_from && date_to) {
            queryParams.dateFrom = date_from; queryParams.dateTo = date_to;
            reviewScopeFilter += ` AND r.review_date >= toDate({dateFrom:String}) AND r.review_date <= toDate({dateTo:String})`;
            recentReviewFilter = `r.review_date >= (toDate({dateFrom:String}) + toUInt32((toDate({dateTo:String}) - toDate({dateFrom:String})) / 2)) AND r.review_date <= toDate({dateTo:String})`;
            priorReviewFilter = `r.review_date >= toDate({dateFrom:String}) AND r.review_date < (toDate({dateFrom:String}) + toUInt32((toDate({dateTo:String}) - toDate({dateFrom:String})) / 2))`;
        } else {
            const lookbackMonths = trendPeriod * 2;
            reviewScopeFilter += ` AND r.review_date >= addMonths(today(), -${trendPeriod})`;
            recentReviewFilter = `r.review_date >= addMonths(today(), -${trendPeriod})`;
            priorReviewFilter = `r.review_date >= addMonths(today(), -${lookbackMonths}) AND r.review_date < addMonths(today(), -${trendPeriod})`;
        }
        const reviewJoinFilter = reviewScopeFilter.replaceAll('r.', 'r3.');

        if (filterCategory) {
            queryParams.filterCategory = filterCategory;
            latestSnapshotFilters += ` AND ilike(coalesce(nullIf(ps.category, ''), nullIf(mp.category, '')), {filterCategory:String})`;
            reviewScopeFilter += ` AND ilike(coalesce(nullIf(r.category, ''), nullIf(mp.category, '')), {filterCategory:String})`;
            masterCategoryFilter += ` AND ilike(coalesce(nullIf(mp.category, ''), ''), {filterCategory:String})`;
        }

        if (rating_bifurcation === 'NP') { ratingFilter = `AND ls.rating >= 4.2`; }
        else if (rating_bifurcation === 'Issue') { ratingFilter = `AND ls.rating < 4.0`; }
        else if (rating_bifurcation === 'NI') { ratingFilter = `AND ls.rating >= 4.0 AND ls.rating < 4.2`; }

        if (filterParetoStatus) {
            queryParams.filterParetoStatus = filterParetoStatus;
            paretoFilter = `AND coalesce(mp.pareto_status, ls.pareto_status) = {filterParetoStatus:String}`;
        }

        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ls.price_rp, mp.mrp)' : 'coalesce(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';
            queryParams.priceMin = Number(price_min); priceFilter += ` AND ${priceExpr} >= {priceMin:Float64}`;
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ls.price_rp, mp.mrp)' : 'coalesce(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';
            queryParams.priceMax = Number(price_max); priceFilter += ` AND ${priceExpr} <= {priceMax:Float64}`;
        }

        const sql = `
              WITH all_snapshot_pids AS (
                  SELECT DISTINCT ps.web_pid
                  FROM product_snapshots ps
                  LEFT JOIN products mp ON mp.company_id = ps.company_id AND mp.product_external_id = ps.web_pid AND lower(mp.platform) = lower(ps.platform)
                  WHERE ps.company_id = {companyId:String} ${snapshotCompetitorFilter} AND coalesce(nullIf(ps.category, ''), nullIf(mp.category, '')) != '' AND ps.snapshot_date >= addMonths(today(), -${trendPeriod})
              ),
              latest_snapshots AS (
                  SELECT * FROM (
                      SELECT
                          ps.web_pid, lower(ps.platform) AS platform_key, ps.product_name, ps.rating, ps.rating_count, ps.price_rp, ps.price_sp, ps.pareto_status, ps.category, ps.star_distribution, mp.category as mp_category, mp.pareto_status as mp_pareto_status
                      FROM product_snapshots ps
                      LEFT JOIN products mp ON mp.company_id = ps.company_id AND mp.product_external_id = ps.web_pid AND lower(mp.platform) = lower(ps.platform)
                      WHERE ps.company_id = {companyId:String} ${snapshotCompetitorFilter} AND coalesce(nullIf(ps.category, ''), nullIf(mp.category, '')) != '' AND ps.snapshot_date >= addMonths(today(), -${trendPeriod}) ${latestSnapshotFilters}
                      ORDER BY ps.snapshot_date DESC, ps.created_at DESC
                  ) LIMIT 1 BY web_pid
              ),
              review_stats AS (
                  SELECT * FROM (
                      SELECT
                          r.web_pid, max(lower(r.platform)) AS platform_key, max(r.product_name) AS review_product_name,
                          coalesce(nullIf(mp.pareto_status, ''), nullIf(r.pareto_status, '')) AS pareto_status,
                          max(CASE WHEN trim(lower(coalesce(nullIf(r.category, ''), nullIf(mp.category, '')))) IN ('other', 'others') THEN 'Others' ELSE initcap(trim(coalesce(nullIf(r.category, ''), nullIf(mp.category, '')))) END) AS resolved_category,
                          round(avg(r.rating), 2) AS scoped_avg_rating,
                          round(avgIf(r.rating, ${recentReviewFilter}), 2) AS recent_avg_rating,
                          round(avgIf(r.rating, ${priorReviewFilter}), 2) AS older_avg_rating,
                          count() AS total_reviews,
                          max(r.review_date) AS latest_review_date,
                          countIf(${recentReviewFilter}) AS recent_review_count,
                          countIf(${priorReviewFilter}) AS older_review_count
                      FROM ml_reviews r
                      LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                      WHERE r.company_id = {companyId:String} ${reviewCompetitorFilter} AND coalesce(nullIf(r.category, ''), nullIf(mp.category, '')) != '' ${reviewScopeFilter} ${sentimentCategoryFilter}
                      GROUP BY r.web_pid, mp.pareto_status, r.pareto_status
                  ) LIMIT 1 BY web_pid
              ),
              sku_scope AS (
                  SELECT web_pid FROM latest_snapshots
                  UNION DISTINCT
                  SELECT web_pid FROM review_stats WHERE web_pid NOT IN (SELECT web_pid FROM all_snapshot_pids)
              ),
              product_health AS (
                  SELECT
                      ss.web_pid AS web_pid, coalesce(ls.product_name, rs.review_product_name, ss.web_pid) AS product_name,
                      ls.rating AS pdp_rating, ls.rating_count, ls.price_rp, ls.price_sp,
                      coalesce(mp.pareto_status, ls.pareto_status, rs.pareto_status) AS pareto_status,
                      coalesce(nullIf(ls.category, ''), nullIf(rs.resolved_category, ''), nullIf(mp.category, '')) AS category,
                      mp.subcategory AS subcategory_l1, mp.business_segment,
                      coalesce(toFloat64(JSONExtractString(ls.star_distribution, '1')), 0) / nullIf(ls.rating_count, 0) AS one_star_pct,
                      rs.scoped_avg_rating,
                      round(avg(r3.ml_inferred_rating), 2) AS scoped_ml_rating,
                      rs.recent_avg_rating, rs.older_avg_rating,
                      coalesce(rs.total_reviews, 0) AS total_reviews,
                      rs.latest_review_date,
                      coalesce(rs.recent_review_count, 0) AS recent_review_count,
                      coalesce(rs.older_review_count, 0) AS older_review_count
                  FROM sku_scope ss
                  LEFT JOIN latest_snapshots ls ON ls.web_pid = ss.web_pid
                  LEFT JOIN products mp ON mp.company_id = {companyId:String} AND mp.product_external_id = ss.web_pid AND lower(mp.platform) = ls.platform_key
                  LEFT JOIN review_stats rs ON rs.web_pid = ss.web_pid
                  LEFT JOIN ml_reviews r3 ON r3.company_id = {companyId:String} AND r3.web_pid = ss.web_pid AND lower(r3.platform) = coalesce(ls.platform_key, rs.platform_key) ${reviewCompetitorFilter.replace('r.', 'r3.')} ${reviewJoinFilter}
                  WHERE 1=1 ${ratingFilter} ${paretoFilter} ${priceFilter}
                  GROUP BY ss.web_pid, ls.product_name, ls.rating, ls.rating_count, ls.price_rp, ls.price_sp, mp.pareto_status, ls.pareto_status, rs.pareto_status, ls.category, rs.resolved_category, rs.review_product_name, mp.category, mp.subcategory, mp.business_segment, ls.star_distribution, rs.scoped_avg_rating, rs.recent_avg_rating, rs.older_avg_rating, rs.total_reviews, rs.latest_review_date, rs.recent_review_count, rs.older_review_count
              )
              SELECT *,
                  CASE
                      WHEN pdp_rating IS NULL THEN 'NoRating'
                      WHEN one_star_pct > 0.15 THEN 'Critical'
                      WHEN pdp_rating >= 4.2 THEN 'NP'
                      WHEN pdp_rating < 4.0 THEN 'Issue'
                      ELSE 'NI'
                  END AS health_status
              FROM product_health
              ORDER BY pdp_rating ASC
        `;
        console.log("SQL:", sql); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const classifyPareto = (status) => {
            if (status === 'Pareto') return 'Pareto';
            if (status === 'NPD') return 'NPD';
            return 'Non-Pareto';
        };

        const paretoPriority = (status) => {
            if (status === 'Pareto') return 3;
            if (status === 'NPD') return 2;
            return 1;
        };
        const dedupedMap = new Map();
        for (const r of rows) {
            const existing = dedupedMap.get(r.web_pid);
            if (!existing || paretoPriority(r.pareto_status) > paretoPriority(existing.pareto_status)) {
                dedupedMap.set(r.web_pid, r);
            }
        }
        const dedupedRows = Array.from(dedupedMap.values());

        const buckets = { Pareto: {}, 'Non-Pareto': {}, NPD: {} };
        dedupedRows.forEach(r => {
            const bucket = classifyPareto(r.pareto_status);
            const status = r.health_status;
            if (!buckets[bucket][status]) buckets[bucket][status] = [];

            const recent = r.recent_avg_rating ? parseFloat(r.recent_avg_rating) : null;
            const older = r.older_avg_rating ? parseFloat(r.older_avg_rating) : null;
            let trend_direction = 'stable';
            if (recent !== null && older !== null) {
                if (recent > older + 0.1) trend_direction = 'up';
                else if (recent < older - 0.1) trend_direction = 'down';
            }

            buckets[bucket][status].push({
                web_pid: r.web_pid, product_name: r.product_name, pdp_rating: r.pdp_rating ? parseFloat(r.pdp_rating) : null, rating_count: parseInt(r.rating_count || 0), price_rp: r.price_rp ? parseFloat(r.price_rp) : null, price_sp: r.price_sp ? parseFloat(r.price_sp) : null, category: r.category || 'Uncategorized', ml_rating: r.scoped_ml_rating ? parseFloat(r.scoped_ml_rating) : null, recent_avg_rating: recent, older_avg_rating: older, trend_direction, total_reviews: parseInt(r.total_reviews || 0), user_rating: r.scoped_avg_rating ? parseFloat(r.scoped_avg_rating) : null, latest_review_date: r.latest_review_date || null, recent_review_count: parseInt(r.recent_review_count || 0), older_review_count: parseInt(r.older_review_count || 0),
            });
        });

        const computeGroupKpis = (skus) => {
            if (!skus || skus.length === 0) {
                return { 
                    totalRatings: 0, 
                    totalReviewCount: 0, 
                    reviewSkuCount: 0,
                    avgPlatformRating: null, 
                    userRating: null, 
                    mlRating: null, 
                    pdpHealthRate: 0, 
                    reviewGrowthPct: 0, 
                    recentReviewCount: 0, 
                    olderReviewCount: 0, 
                    ratingGrowthDiff: 0, 
                    recentAvgRating: null, 
                    olderAvgRating: null 
                };
            }
            const totalRatings = skus.reduce((sum, s) => sum + (s.rating_count || 0), 0);
            const totalReviewCount = skus.reduce((sum, s) => sum + (s.total_reviews || 0), 0);
            const reviewSkuCount = new Set(skus.filter(s => s.total_reviews > 0).map(s => s.web_pid)).size;
            const ratedSkus = skus.filter(s => s.pdp_rating !== null && s.pdp_rating !== undefined);
            const weightedSum = ratedSkus.reduce((sum, s) => sum + (s.pdp_rating * (s.rating_count || 1)), 0);
            const weightedDenom = ratedSkus.reduce((sum, s) => sum + (s.rating_count || 1), 0);
            const avgPlatformRating = weightedDenom > 0 ? Math.round((weightedSum / weightedDenom) * 100) / 100 : null;
            const reviewWeightedSum = skus.reduce((sum, s) => sum + ((s.user_rating || 0) * (s.total_reviews || 0)), 0);
            const mlWeightedSum = skus.reduce((sum, s) => sum + ((s.ml_rating || 0) * (s.total_reviews || 0)), 0);
            const reviewWeightedDenom = skus.reduce((sum, s) => sum + (s.user_rating !== null && s.user_rating !== undefined ? (s.total_reviews || 0) : 0), 0);
            const mlWeightedDenom = skus.reduce((sum, s) => sum + (s.ml_rating !== null && s.ml_rating !== undefined ? (s.total_reviews || 0) : 0), 0);
            const userRating = reviewWeightedDenom > 0 ? Math.round((reviewWeightedSum / reviewWeightedDenom) * 100) / 100 : null;
            const mlRating = mlWeightedDenom > 0 ? Math.round((mlWeightedSum / mlWeightedDenom) * 100) / 100 : null;
            const aboveThreshold = ratedSkus.filter(s => s.pdp_rating >= 4.0).length;
            const pdpHealthRate = ratedSkus.length > 0 ? Math.round((aboveThreshold / ratedSkus.length) * 100) : 0;
            const recentTotal = skus.reduce((sum, s) => sum + (s.recent_review_count || 0), 0);
            const olderTotal  = skus.reduce((sum, s) => sum + (s.older_review_count  || 0), 0);
            const reviewGrowthPct = olderTotal > 0 ? Math.round(((recentTotal - olderTotal) / olderTotal) * 100) : (recentTotal > 0 ? 100 : 0);
            const recentSumRating = skus.reduce((sum, s) => sum + ((s.recent_avg_rating || 0) * (s.recent_review_count || 0)), 0);
            const olderSumRating = skus.reduce((sum, s) => sum + ((s.older_avg_rating || 0) * (s.older_review_count || 0)), 0);
            const recentAvgRating = recentTotal > 0 ? Math.round((recentSumRating / recentTotal) * 100) / 100 : null;
            const olderAvgRating = olderTotal > 0 ? Math.round((olderSumRating / olderTotal) * 100) / 100 : null;
            const ratingGrowthDiff = (recentAvgRating !== null && olderAvgRating !== null && recentTotal > 0 && olderTotal > 0) ? Math.round((recentAvgRating - olderAvgRating) * 100) / 100 : 0;
            return { totalRatings, totalReviewCount, reviewSkuCount, avgPlatformRating, userRating, mlRating, pdpHealthRate, reviewGrowthPct, recentReviewCount: recentTotal, olderReviewCount: olderTotal, ratingGrowthDiff, recentAvgRating, olderAvgRating };
        };

        const formatBucket = (name, data) => {
            const np = data['NP'] || []; const issue = data['Issue'] || []; const ni = data['NI'] || []; const critical = data['Critical'] || []; const noRating = data['NoRating'] || [];
            const allSkus = [...np, ...issue, ...ni, ...critical, ...noRating];
            const bucketKpis = computeGroupKpis(allSkus);
            const uniqueSkusCount = new Set(allSkus.map(s => s.web_pid)).size;
            return {
                name, total: uniqueSkusCount, ...bucketKpis, positiveRate: bucketKpis.pdpHealthRate,
                np: { count: np.length, skus: np, ...computeGroupKpis(np) },
                issue: { count: issue.length, skus: issue, ...computeGroupKpis(issue) },
                ni: { count: ni.length, skus: ni, ...computeGroupKpis(ni) },
                critical: { count: critical.length, skus: critical, ...computeGroupKpis(critical) },
                noRating: { count: noRating.length, skus: noRating, ...computeGroupKpis(noRating) },
            };
        };

        const allBucketSkus = new Set();
        [...buckets['Pareto'].NI || [], ...buckets['Pareto'].Issue || [], ...buckets['Pareto'].NP || [], ...buckets['Pareto'].Critical || [], ...buckets['Pareto'].NoRating || [], ...buckets['Non-Pareto'].NI || [], ...buckets['Non-Pareto'].Issue || [], ...buckets['Non-Pareto'].NP || [], ...buckets['Non-Pareto'].Critical || [], ...buckets['Non-Pareto'].NoRating || [], ...buckets['NPD'].NI || [], ...buckets['NPD'].Issue || [], ...buckets['NPD'].NP || [], ...buckets['NPD'].Critical || [], ...buckets['NPD'].NoRating || []].forEach(s => allBucketSkus.add(s.web_pid));

        const catalogueCounts = { Pareto: 0, 'Non-Pareto': 0, NPD: 0 };
        try {
            const catParams = { companyId: String(req.companyId) };
            let cCompetitor = '', cPlatform = '', cCategory = '';
            if (is_competitor === 'true' || is_competitor === 'false') {
                catParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
                cCompetitor = ` AND coalesce(mp.is_competitor, 0) = {isCompetitor:UInt8}`;
            } else if (is_competitor !== 'all') {
                cCompetitor = ` AND coalesce(mp.is_competitor, 0) = 0`;
            }
            if (platform && platform !== 'all') { catParams.platform = platform; cPlatform = ` AND ilike(mp.platform, {platform:String})`; }
            if (filterCategory) { catParams.filterCategory = filterCategory; cCategory = ` AND ilike(coalesce(nullIf(mp.category, ''), ''), {filterCategory:String})`; }
            
            const catRes = await clickhouse.query({ database: getTargetDb(req), query: `
                SELECT CASE WHEN pareto_status = 'Pareto' THEN 'Pareto' WHEN pareto_status = 'NPD' THEN 'NPD' ELSE 'Non-Pareto' END AS bucket, count(DISTINCT product_external_id) AS skus
                FROM products mp WHERE mp.company_id = {companyId:String} ${cCompetitor} AND isNotNull(mp.platform) ${cPlatform} ${cCategory} GROUP BY 1
            `, query_params: catParams, format: 'JSONEachRow' });
            const catRows = await catRes.json();
            catRows.forEach(r => { catalogueCounts[r.bucket] = parseInt(r.skus); });
        } catch (e) { console.error('catalogue count error:', e.message); }

        const paretoReviewCounts = { Pareto: 0, 'Non-Pareto': 0, NPD: 0 };
        try {
            const prParams = { companyId: String(req.companyId) };
            let prWhere = 'r.company_id = {companyId:String}';
            if (is_competitor === 'true' || is_competitor === 'false') { prParams.isCompetitor = is_competitor === 'true' ? 1 : 0; prWhere += ` AND coalesce(r.is_competitor, 0) = {isCompetitor:UInt8}`; }
            else if (is_competitor !== 'all') { prWhere += ` AND coalesce(r.is_competitor, 0) = 0`; }
            if (platform && platform !== 'all') { prParams.platform = platform; prWhere += ` AND ilike(r.platform, {platform:String})`; }
            if (date_from && date_to) {
                prParams.dateFrom = date_from; prParams.dateTo = date_to;
                prWhere += ` AND r.review_date >= toDate({dateFrom:String}) AND r.review_date <= toDate({dateTo:String})`;
            } else {
                prWhere += ` AND r.review_date >= addMonths(today(), -${trendPeriod})`;
            }
            let prCatClause = '';
            if (filterCategory) { prParams.filterCategory = filterCategory; prCatClause = ` WHERE ilike(trim(rev.resolved_category), {filterCategory:String})`; }
            
            const prRes = await clickhouse.query({ database: getTargetDb(req), query: `
                WITH latest_snapshots AS (
                    SELECT * FROM (SELECT web_pid, platform, category, pareto_status FROM product_snapshots WHERE company_id = {companyId:String} ORDER BY snapshot_date DESC, created_at DESC) LIMIT 1 BY web_pid, lower(platform)
                ),
                rev AS (
                    SELECT coalesce(nullIf(mp.pareto_status, ''), nullIf(ls.pareto_status, ''), nullIf(r.pareto_status, '')) AS resolved_pareto,
                           CASE WHEN trim(lower(coalesce(nullIf(ls.category, ''), nullIf(r.category, ''), nullIf(mp.category, '')))) IN ('other', 'others') THEN 'Others' ELSE initcap(trim(coalesce(nullIf(ls.category, ''), nullIf(r.category, ''), nullIf(mp.category, '')))) END AS resolved_category
                    FROM ml_reviews r LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform) LEFT JOIN latest_snapshots ls ON ls.web_pid = r.web_pid AND lower(ls.platform) = lower(r.platform) WHERE ${prWhere}
                )
                SELECT CASE WHEN resolved_pareto = 'Pareto' THEN 'Pareto' WHEN resolved_pareto = 'NPD' THEN 'NPD' ELSE 'Non-Pareto' END AS bucket, count() AS reviews FROM rev ${prCatClause} GROUP BY 1
            `, query_params: prParams, format: 'JSONEachRow' });
            const prRows = await prRes.json();
            prRows.forEach(x => { paretoReviewCounts[x.bucket] = parseInt(x.reviews); });
        } catch (e) { console.error('pareto review count error:', e.message); }

        const pareto = formatBucket('Pareto', buckets['Pareto']); const nonPareto = formatBucket('Non-Pareto', buckets['Non-Pareto']); const npd = formatBucket('NPD', buckets['NPD']);
        pareto.totalReviewCount = paretoReviewCounts['Pareto']; nonPareto.totalReviewCount = paretoReviewCounts['Non-Pareto']; npd.totalReviewCount = paretoReviewCounts['NPD'];
        pareto.catalogueTotal = catalogueCounts['Pareto']; nonPareto.catalogueTotal = catalogueCounts['Non-Pareto']; npd.catalogueTotal = catalogueCounts['NPD'];

        res.json({ pareto, nonPareto, npd, total: allBucketSkus.size || dedupedRows.length, catalogueCounts, catalogueTotal: catalogueCounts['Pareto'] + catalogueCounts['Non-Pareto'] + catalogueCounts['NPD'] });
    } catch (err) {
        console.error('Executive health error:', err);
        res.json({ pareto: { total: 0 }, nonPareto: { total: 0 }, npd: { total: 0 }, total: 0, catalogueCounts: {}, catalogueTotal: 0 });
    }
};

export const getRatingMismatch = async (req, res) => {
    try {
        const { platform, category, web_pid, is_competitor, date_from, date_to, direction } = req.query;
        const minGap = Math.max(1, Math.min(parseInt(req.query.min_gap, 10) || 2, 4));
        const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 100, 500));

        const baseWhere = ['r.company_id = {companyId:String}', 'isNotNull(r.rating)', 'isNotNull(r.ml_inferred_rating)'];
        const queryParams = { companyId: String(req.companyId), minGap: Number(minGap), limit: Number(limit) };
        if (platform && platform !== 'all') { queryParams.platform = platform; baseWhere.push(`lower(r.platform) = lower({platform:String})`); }
        if (category) { queryParams.category = category; baseWhere.push(`ilike(coalesce(nullIf(mp.master_category,''), nullIf(mp.category,''), nullIf(r.category,'')), {category:String})`); }
        if (web_pid) { queryParams.webPid = web_pid; baseWhere.push(`upper(r.web_pid) = upper({webPid:String})`); }
        if (is_competitor === 'true' || is_competitor === 'false') { queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0; baseWhere.push(`r.is_competitor = {isCompetitor:UInt8}`); }
        if (date_from) { queryParams.dateFrom = date_from; baseWhere.push(`r.review_date >= toDate({dateFrom:String})`); }
        if (date_to) { queryParams.dateTo = date_to; baseWhere.push(`r.review_date <= toDate({dateTo:String})`); }

        let dirClause = `abs(r.rating - r.ml_inferred_rating) >= {minGap:Float64}`;
        if (direction === 'star_high_text_low') dirClause = `(r.rating - r.ml_inferred_rating) >= {minGap:Float64}`;
        else if (direction === 'star_low_text_high') dirClause = `(r.ml_inferred_rating - r.rating) >= {minGap:Float64}`;

        const mp_join = `LEFT JOIN products mp ON mp.product_external_id = r.web_pid AND mp.company_id = r.company_id AND lower(mp.platform) = lower(r.platform)`;
        
        const sql = `
            SELECT r.web_pid, r.product_name, r.platform, r.brand,
                   r.rating, r.ml_inferred_rating,
                   (r.rating - r.ml_inferred_rating) AS gap,
                   r.sentiment, r.sentiment_category, r.review_title,
                   substring(r.review_text, 1, 300) AS review_text, r.review_date,
                   coalesce(nullIf(mp.master_category,''), nullIf(mp.category,''), nullIf(r.category,'')) AS category
              FROM ml_reviews r ${mp_join}
             WHERE ${[...baseWhere, dirClause].join(' AND ')}
             ORDER BY abs(r.rating - r.ml_inferred_rating) DESC, r.review_date DESC
             LIMIT {limit:Int32}
        `;
        console.log("SQL:", sql); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const sumSql = `
            SELECT countIf((r.rating - r.ml_inferred_rating) >= {minGap:Float64}) AS star_high_text_low,
                   countIf((r.ml_inferred_rating - r.rating) >= {minGap:Float64}) AS star_low_text_high
              FROM ml_reviews r ${mp_join}
             WHERE ${baseWhere.join(' AND ')}
        `;
        const sumRes = await clickhouse.query({ database: getTargetDb(req), query: sumSql, query_params: queryParams, format: 'JSONEachRow' });
        const sumRows = await sumRes.json();

        res.json({
            minGap,
            summary: { star_high_text_low: parseInt(sumRows[0]?.star_high_text_low || 0, 10), star_low_text_high: parseInt(sumRows[0]?.star_low_text_high || 0, 10) },
            reviews: rows.map(r => ({ ...r, rating: Number(r.rating), ml_inferred_rating: Number(r.ml_inferred_rating), gap: Number(r.gap) })),
        });
    } catch (err) {
        console.error('rating-mismatch error:', err);
        res.json({ minGap: 2, summary: { star_high_text_low: 0, star_low_text_high: 0 }, reviews: [] });
    }
};

export const getReviewTimeline = async (req, res) => {
    try {
        const { web_pid, platform, limit = 500 } = req.query;
        if (!web_pid) return res.status(400).json({ error: 'web_pid is required' });
        const where = ['company_id = {companyId:String}', 'web_pid = {webPid:String}', "review_date >= addDays(today(), -365)"];
        const queryParams = { companyId: String(req.companyId), webPid: String(web_pid) };
        if (platform && platform !== 'all') { where.push(`lower(platform) = lower({platform:String})`); queryParams.platform = platform; }
        const lim = Math.min(parseInt(limit, 10) || 500, 2000);
        queryParams.limit = lim;

        console.log("SQL:", sql); const chRes = await clickhouse.query({ database: getTargetDb(req), query: `
            SELECT id, rating, sentiment, review_date, review_title, review_text,
                   specific_issue, sentiment_category, platform
              FROM reviews
             WHERE ${where.join(' AND ')}
             ORDER BY review_date ASC
             LIMIT {limit:Int32}
        `, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const monthly = new Map();
        for (const r of rows) {
            if (!r.review_date) continue;
            const m = String(r.review_date).slice(0, 7);
            if (!monthly.has(m)) monthly.set(m, { month: m, count: 0, ratingSum: 0, neg: 0, pos: 0 });
            const e = monthly.get(m);
            e.count++;
            if (r.rating != null) e.ratingSum += Number(r.rating);
            if (r.sentiment === 'Negative') e.neg++;
            if (r.sentiment === 'Positive') e.pos++;
        }
        const monthlyArr = [...monthly.values()].map(e => ({ month: e.month, count: e.count, avg_rating: e.count > 0 ? Math.round((e.ratingSum / e.count) * 100) / 100 : null, neg_pct: e.count > 0 ? Math.round(100 * e.neg / e.count) : 0, pos_pct: e.count > 0 ? Math.round(100 * e.pos / e.count) : 0 }));

        res.json({ web_pid, total: rows.length, monthly: monthlyArr, reviews: rows });
    } catch (err) {
        console.error('review-timeline error:', err);
        res.json({ web_pid: req.query.web_pid, total: 0, monthly: [], reviews: [] });
    }
};

export const getPriceVariance = async (req, res) => {
    try {
        const { category, platform } = req.query;
        const where = ['mp.company_id = {companyId:String}', 'isNotNull(mp.mrp)', 'mp.mrp > 0'];
        const queryParams = { companyId: String(req.companyId) };
        if (category) { where.push(`ilike(mp.master_category, {category:String})`); queryParams.category = category; }
        if (platform && platform !== 'all') { where.push(`lower(mp.platform) = lower({platform:String})`); queryParams.platform = platform; }

        const sql = `
            WITH base AS (
                SELECT mp.brand_name, mp.is_competitor, mp.master_category,
                       coalesce(ps.price_sp, mp.selling_price, ps.price_rp, mp.mrp) AS effective_price, mp.mrp
                FROM products mp
                LEFT JOIN (
                    SELECT * FROM (
                        SELECT company_id, web_pid, platform, price_rp, price_sp
                        FROM product_snapshots
                        WHERE company_id = {companyId:String}
                        ORDER BY snapshot_date DESC, created_at DESC
                    ) LIMIT 1 BY company_id, web_pid, lower(platform)
                ) ps ON ps.company_id = mp.company_id AND ps.web_pid = mp.product_external_id AND lower(ps.platform) = lower(mp.platform)
                WHERE ${where.join(' AND ')} AND isNotNull(mp.brand_name)
            ),
            agg AS (
                SELECT brand_name, is_competitor, master_category, count() AS sku_count,
                       quantile(0.5)(effective_price) AS median_price,
                       min(effective_price) AS min_price, max(effective_price) AS max_price, avg(effective_price) AS avg_price
                FROM base GROUP BY brand_name, is_competitor, master_category
            ),
            -- Own-brand baseline: any product where is_competitor = 0 (not hardcoded to 'prestige')
            own_brand_baseline AS (SELECT master_category, median_price FROM agg WHERE is_competitor = 0)
            SELECT a.brand_name AS brand, a.is_competitor, a.master_category AS category,
                   a.sku_count, round(a.median_price, 0) AS median_price, round(a.min_price, 0) AS min_price,
                   round(a.max_price, 0) AS max_price, round(a.avg_price, 0) AS avg_price,
                   round(ob.median_price, 0) AS own_brand_median,
                   CASE WHEN isNotNull(ob.median_price) AND ob.median_price > 0 THEN round(((a.median_price - ob.median_price) / ob.median_price * 100), 1) ELSE NULL END AS pct_vs_own_brand
            FROM agg a LEFT JOIN own_brand_baseline ob ON ob.master_category = a.master_category
            ORDER BY a.master_category, a.sku_count DESC
        `;
        console.log("SQL:", sql); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();
        res.json({ rows });
    } catch (err) {
        console.error('price-variance error:', err);
        res.json({ rows: [] });
    }
};
export const getProductHealth = async (req, res) => {
    try {
        const { category, pareto_status, web_pid, date_from, date_to, platform, period_months, price_mode, price_min, price_max, is_competitor, sentiment_category } = req.query;
        const trendPeriod = Math.max(1, Math.min(parseInt(period_months) || 3, 24));
        const queryParams = { companyId: String(req.companyId) };
        const where = ['r.company_id = {companyId:String}', 'isNotNull(r.product_name)', 'isNotNull(r.review_date)'];

        if (is_competitor && is_competitor !== 'all') {
            where.push(`coalesce(r.is_competitor, 0) = {isCompetitor:UInt8}`);
            queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        } else if (is_competitor === undefined || is_competitor === '') {
            where.push(`coalesce(r.is_competitor, 0) = 0`);
        }
        if (platform && platform !== 'all') { where.push(`ilike(r.platform, {platform:String})`); queryParams.platform = platform; }
        if (category) {
            where.push(`ilike(coalesce(nullIf(ps.category, ''), nullIf(r.category, ''), nullIf(mp.category, '')), {category:String})`);
            queryParams.category = category;
        }
        if (sentiment_category && sentiment_category !== 'all') {
            where.push(`ilike(r.sentiment_category, {sentimentCategory:String})`);
            queryParams.sentimentCategory = sentiment_category;
        }
        if (pareto_status) {
            where.push(`coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) = {paretoStatus:String}`);
            queryParams.paretoStatus = pareto_status;
        }
        if (web_pid) { where.push(`r.web_pid = {webPid:String}`); queryParams.webPid = web_pid; }

        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            where.push(`${priceExpr} >= {priceMin:Float64}`);
            queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            where.push(`${priceExpr} <= {priceMax:Float64}`);
            queryParams.priceMax = Number(price_max);
        }

        let recentPeriodFilter, priorPeriodFilter, combinedWindowFilter;
        if (date_from && date_to) {
            queryParams.dateFrom = date_from;
            queryParams.dateTo = date_to;
            const midpointExpr = `(toDate({dateFrom:String}) + toUInt32((toDate({dateTo:String}) - toDate({dateFrom:String})) / 2))`;
            recentPeriodFilter = `r.review_date >= ${midpointExpr} AND r.review_date <= toDate({dateTo:String})`;
            priorPeriodFilter = `r.review_date >= toDate({dateFrom:String}) AND r.review_date < ${midpointExpr}`;
            combinedWindowFilter = `r.review_date >= toDate({dateFrom:String}) AND r.review_date <= toDate({dateTo:String})`;
        } else {
            const recentStartExpr = `subtractMonths(today(), ${trendPeriod})`;
            const priorStartExpr = `subtractMonths(today(), ${trendPeriod * 2})`;
            recentPeriodFilter = `r.review_date >= ${recentStartExpr}`;
            priorPeriodFilter = `r.review_date >= ${priorStartExpr} AND r.review_date < ${recentStartExpr}`;
            combinedWindowFilter = `r.review_date >= ${priorStartExpr}`;
        }
        where.push(combinedWindowFilter);

        const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp, price_sp, category, pareto_status
                    FROM product_snapshots
                    WHERE company_id = {companyId:String}
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY lower(platform), web_pid
            ),
            product_stats AS (
                SELECT
                    substring(r.product_name, 1, 80) AS product,
                    count() AS total,
                    countIf(r.sentiment = 'Positive') AS positive,
                    countIf(r.sentiment = 'Negative') AS negative,
                    countIf(r.sentiment = 'Neutral') AS neutral,
                    countIf(${recentPeriodFilter}) AS recent_total,
                    countIf(${recentPeriodFilter} AND r.sentiment = 'Negative') AS recent_neg,
                    countIf(${priorPeriodFilter}) AS older_total,
                    countIf(${priorPeriodFilter} AND r.sentiment = 'Negative') AS older_neg
                FROM ml_reviews r
                LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND lower(ps.platform) = lower(r.platform)
                WHERE ${where.join(' AND ')}
                GROUP BY substring(r.product_name, 1, 80)
                HAVING count() >= 10
            )
            SELECT
                product, total, positive, negative, neutral,
                recent_total, recent_neg, older_total, older_neg,
                multiIf(total > 0, toFloat64(positive) / total, 0.0) AS positive_rate,
                multiIf(total > 0, toFloat64(negative) / total, 0.0) AS negative_rate,
                round(multiIf(total > 0, (toFloat64(positive) - negative) / total * 50 + 50, 50.0), 0) AS health_score,
                multiIf(
                    recent_total > 0 AND older_total > 0 AND (toFloat64(recent_neg) / recent_total - toFloat64(older_neg) / older_total) > 0.05, 'declining',
                    recent_total > 0 AND older_total > 0 AND (toFloat64(recent_neg) / recent_total - toFloat64(older_neg) / older_total) < -0.05, 'improving',
                    'stable'
                ) AS trend
            FROM product_stats
            ORDER BY total DESC
            LIMIT 30
        `;
        console.log("SQL:", sql); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        // Also get monthly ratings per product (top 20 only)
        const topProducts = rows.slice(0, 20).map(r => r.product);
        let monthlyData = {};

        if (topProducts.length > 0) {
            const mParams = { companyId: String(req.companyId), topProducts };
            const mWhere = ['r.company_id = {companyId:String}', 'substring(r.product_name, 1, 80) IN {topProducts:Array(String)}', 'isNotNull(r.review_date)'];

            if (is_competitor && is_competitor !== 'all') {
                mWhere.push(`coalesce(r.is_competitor, 0) = {isCompetitor:UInt8}`);
                mParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
            }
            if (category) {
                mWhere.push(`ilike(coalesce(nullIf(ps.category, ''), nullIf(r.category, ''), nullIf(mp.category, '')), {category:String})`);
                mParams.category = category;
            }
            if (pareto_status) {
                mWhere.push(`coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) = {paretoStatus:String}`);
                mParams.paretoStatus = pareto_status;
            }
            if (date_from) { mWhere.push(`r.review_date >= toDate({dateFrom:String})`); mParams.dateFrom = date_from; }
            if (date_to) { mWhere.push(`r.review_date <= toDate({dateTo:String})`); mParams.dateTo = date_to; }
            
            if (price_min !== undefined && price_min !== '') {
                const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
                mWhere.push(`${priceExpr} >= {priceMin:Float64}`);
                mParams.priceMin = Number(price_min);
            }
            if (price_max !== undefined && price_max !== '') {
                const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
                mWhere.push(`${priceExpr} <= {priceMax:Float64}`);
                mParams.priceMax = Number(price_max);
            }

            const monthSql = `
                WITH latest_snapshots AS (
                    SELECT * FROM (
                        SELECT web_pid, platform, price_rp, price_sp, category, pareto_status
                        FROM product_snapshots
                        WHERE company_id = {companyId:String}
                        ORDER BY snapshot_date DESC, created_at DESC
                    ) LIMIT 1 BY lower(platform), web_pid
                )
                SELECT
                    substring(r.product_name, 1, 80) AS product,
                    substring(toString(r.review_date), 1, 7) AS month,
                    round(avg(r.rating), 2) AS avg_rating,
                    count() AS count
                FROM ml_reviews r
                LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND lower(ps.platform) = lower(r.platform)
                WHERE ${mWhere.join(' AND ')}
                GROUP BY product, month
                ORDER BY product, month
            `;
            const mRes = await clickhouse.query({ database: getTargetDb(req), query: monthSql, query_params: mParams, format: 'JSONEachRow' });
            const mRows = await mRes.json();
            mRows.forEach(r => {
                if (!monthlyData[r.product]) monthlyData[r.product] = [];
                monthlyData[r.product].push({
                    month: r.month,
                    avg: parseFloat(r.avg_rating),
                    count: parseInt(r.count),
                });
            });
        }

        const products = rows.map(r => ({
            product: r.product,
            healthScore: parseInt(r.health_score),
            totalMentions: parseInt(r.total),
            positiveRate: parseFloat(r.positive_rate),
            negativeRate: parseFloat(r.negative_rate),
            trend: r.trend,
            monthlyRatings: (monthlyData[r.product] || []).slice(-12),
        }));

        res.json({ products });
    } catch (err) {
        console.error('Product health error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getBenchmarkData = async (req, res) => {
    try {
        const { category, platform, date_from, date_to, period_months, price_mode, price_min, price_max } = req.query;
        const targetDb = getTargetDb(req);
        const queryParams = { companyId: String(req.companyId), dbName: targetDb };
        const conditions = [
            'r.company_id = {companyId:String}',
            `(coalesce(r.is_competitor, 0) = 0 OR (isNotNull(r.brand) AND r.brand <> '' AND length(trim(r.brand)) >= 3 AND lower(trim(r.brand)) NOT IN ('the','not','and','gas','extracted','none','null','n/a','other','unknown','etc','for','was','were','our','your','its')))`
        ];

        if (category) {
            conditions.push(`ilike(trim(coalesce(nullIf(ps.category, ''), nullIf(r.category, ''), nullIf(mp.category, ''))), {category:String})`);
            queryParams.category = category;
        }
        if (platform && platform !== 'all') {
            conditions.push(`ilike(r.platform, {platform:String})`);
            queryParams.platform = platform;
        }
        if (date_from) { conditions.push(`r.review_date >= toDate({dateFrom:String})`); queryParams.dateFrom = date_from; }
        if (date_to) { conditions.push(`r.review_date <= toDate({dateTo:String})`); queryParams.dateTo = date_to; }
        else if (!date_from && period_months) {
            const safePeriodMonths = Math.max(1, Math.min(parseInt(period_months) || 6, 24));
            conditions.push(`r.review_date >= subtractMonths(today(), ${safePeriodMonths})`);
        }
        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            conditions.push(`${priceExpr} >= {priceMin:Float64}`);
            queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            conditions.push(`${priceExpr} <= {priceMax:Float64}`);
            queryParams.priceMax = Number(price_max);
        }

        const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp, price_sp, category, rating, rating_count
                    FROM product_snapshots
                    WHERE company_id = {companyId:String}
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY lower(platform), web_pid
            ),
            scoped_reviews AS (
                SELECT
                    multiIf(coalesce(r.is_competitor, 0) = 0, initcap({dbName:String}), initcap(lower(r.brand))) AS brand,
                    coalesce(r.is_competitor, 0) AS is_competitor,
                    coalesce(nullIf(r.sentiment_category, ''), 'General') AS sentiment_category,
                    r.rating AS rev_rating, r.ml_inferred_rating AS rev_ml_rating, r.sentiment AS rev_sentiment, r.web_pid AS rev_web_pid, r.platform AS rev_platform,
                    ps.rating AS pdp_rating, ps.rating_count AS rating_count
                FROM ml_reviews r
                LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND lower(ps.platform) = lower(r.platform)
                WHERE ${conditions.join(' AND ')}
            ),
            brand_totals AS (
                SELECT
                    brand, is_competitor,
                    count() AS total_reviews,
                    round(avg(rev_rating), 2) AS avg_rating,
                    round(avg(rev_ml_rating), 2) AS avg_ml_rating,
                    countIf(rev_sentiment = 'Positive') AS positive_count,
                    countIf(rev_sentiment = 'Negative') AS negative_count,
                    countIf(rev_sentiment = 'Neutral') AS neutral_count
                FROM scoped_reviews
                GROUP BY brand, is_competitor
                HAVING count() >= 3
            ),
            brand_listing_metrics AS (
                SELECT
                    sr.brand, sr.is_competitor,
                    sum(coalesce(sr.rating_count, 0)) AS total_rating_count,
                    round(sum(coalesce(sr.pdp_rating, 0) * coalesce(sr.rating_count, 0)) / nullIf(sum(coalesce(sr.rating_count, 0)), 0), 2) AS avg_pdp_rating
                FROM (
                    SELECT DISTINCT brand, is_competitor, rev_web_pid, rev_platform, pdp_rating, rating_count
                    FROM scoped_reviews
                ) sr
                GROUP BY sr.brand, sr.is_competitor
            ),
            category_agg AS (
                SELECT brand, is_competitor, sentiment_category,
                    count() AS cat_total,
                    countIf(rev_sentiment = 'Positive') AS cat_positive,
                    countIf(rev_sentiment = 'Negative') AS cat_negative,
                    round(avg(rev_rating), 2) AS cat_avg_rating,
                    round(avg(rev_ml_rating), 2) AS cat_avg_ml_rating
                FROM scoped_reviews
                GROUP BY brand, is_competitor, sentiment_category
            ),
            category_json AS (
                SELECT brand, is_competitor,
                    groupArray(tuple(sentiment_category, cat_total, cat_positive, cat_negative, cat_avg_rating, cat_avg_ml_rating)) AS cat_arr
                FROM category_agg
                GROUP BY brand, is_competitor
            )
            SELECT
                t.brand AS brand, t.is_competitor AS is_competitor, t.total_reviews, t.avg_rating, t.avg_ml_rating,
                t.positive_count, t.negative_count, t.neutral_count,
                l.total_rating_count AS rating_count, l.avg_pdp_rating AS pdp_rating,
                c.cat_arr AS category_scores
            FROM brand_totals t
            LEFT JOIN brand_listing_metrics l ON t.brand = l.brand AND t.is_competitor = l.is_competitor
            LEFT JOIN category_json c ON t.brand = c.brand AND t.is_competitor = c.is_competitor
            ORDER BY t.total_reviews DESC
        `;
        
        console.log("SQL:", sql); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rawRows = await chRes.json();
        const rows = rawRows.map(row => {
            const category_scores = {};
            if (row.category_scores) {
                row.category_scores.forEach(cat => {
                    category_scores[cat[0]] = {
                        total: cat[1],
                        positive: cat[2],
                        negative: cat[3],
                        avg_rating: cat[4],
                        avg_ml_rating: cat[5]
                    };
                });
            }
            return {
                brand: row.brand,
                is_competitor: row.is_competitor === 1 || row.is_competitor === true,
                total_reviews: row.total_reviews,
                avg_rating: row.avg_rating,
                ml_rating: row.avg_ml_rating,
                positive_count: row.positive_count,
                negative_count: row.negative_count,
                neutral_count: row.neutral_count,
                rating_count: row.rating_count,
                pdp_rating: row.pdp_rating,
                category_scores
            };
        });
        res.json({ benchmarks: rows });
    } catch (err) {
        console.error('Benchmark data error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getCategoryHealth = async (req, res) => {
    try {
        const { date_from, date_to, platform, period_months, price_mode, price_min, price_max, is_competitor, sentiment_category, category } = req.query;
        const trendPeriod = parseInt(period_months) || 3;

        const queryParams = { companyId: String(req.companyId) };
        let currentScopeFilter, growthRangeFilter, recentFilter, priorFilter;
        const platformFilters = [];
        const snapPlatformFilters = [];
        const reviewPriceFilters = [];
        const snapPriceFilters = [];
        let competitorFilter = '';
        let snapCompetitorFilter = '';
        const sentimentCategoryFilters = [];
        const catFilters = [];
        const snapCatFilters = [];

        if (is_competitor === 'true' || is_competitor === 'false') {
            competitorFilter = `AND coalesce(r.is_competitor, 0) = {isCompetitor:UInt8}`;
            snapCompetitorFilter = `AND coalesce(mp.is_competitor, 0) = {isCompetitor:UInt8}`;
            queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        } else if (is_competitor === 'all') {
            competitorFilter = '';
            snapCompetitorFilter = '';
        } else {
            competitorFilter = `AND coalesce(r.is_competitor, 0) = 0`;
            snapCompetitorFilter = `AND coalesce(mp.is_competitor, 0) = 0`;
        }

        if (sentiment_category && sentiment_category !== 'all') {
            sentimentCategoryFilters.push(`r.sentiment_category ILIKE {sentimentCategory:String}`);
            queryParams.sentimentCategory = sentiment_category;
        }

        if (category) {
            catFilters.push(`coalesce(nullIf(ps_latest.category, ''), nullIf(r.category, ''), nullIf(mp.category, '')) ILIKE {category:String}`);
            snapCatFilters.push(`coalesce(nullIf(ls.category, ''), nullIf(mp.category, '')) ILIKE {category:String}`);
            queryParams.category = category;
        }

        if (platform && platform !== 'all') {
            platformFilters.push(`ilike(r.platform, {platform:String})`);
            snapPlatformFilters.push(`ilike(ls.platform, {platform:String})`);
            queryParams.platform = platform;
        }

        if (price_min !== undefined && price_min !== '') {
            const reviewPriceExpr = price_mode === 'rp' ? 'coalesce(ps_latest.price_rp, mp.mrp)' : 'coalesce(ps_latest.price_sp, mp.selling_price, mp.mop, ps_latest.price_rp, mp.mrp)';
            const snapPriceExpr = price_mode === 'rp' ? 'coalesce(ls.price_rp, mp.mrp)' : 'coalesce(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';
            reviewPriceFilters.push(`${reviewPriceExpr} >= {priceMin:Float64}`);
            snapPriceFilters.push(`${snapPriceExpr} >= {priceMin:Float64}`);
            queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const reviewPriceExpr = price_mode === 'rp' ? 'coalesce(ps_latest.price_rp, mp.mrp)' : 'coalesce(ps_latest.price_sp, mp.selling_price, mp.mop, ps_latest.price_rp, mp.mrp)';
            const snapPriceExpr = price_mode === 'rp' ? 'coalesce(ls.price_rp, mp.mrp)' : 'coalesce(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';
            reviewPriceFilters.push(`${reviewPriceExpr} <= {priceMax:Float64}`);
            snapPriceFilters.push(`${snapPriceExpr} <= {priceMax:Float64}`);
            queryParams.priceMax = Number(price_max);
        }

        if (date_from && date_to) {
            queryParams.dateFrom = date_from;
            queryParams.dateTo = date_to;
            const midpointExpr = `(toDate({dateFrom:String}) + toUInt32((toDate({dateTo:String}) - toDate({dateFrom:String})) / 2))`;
            currentScopeFilter = `AND r.review_date >= toDate({dateFrom:String}) AND r.review_date <= toDate({dateTo:String})`;
            growthRangeFilter = currentScopeFilter;
            recentFilter = `AND r.review_date >= ${midpointExpr} AND r.review_date <= toDate({dateTo:String})`;
            priorFilter = `AND r.review_date >= toDate({dateFrom:String}) AND r.review_date < ${midpointExpr}`;
        } else {
            const lookbackMonths = trendPeriod * 2;
            currentScopeFilter = `AND r.review_date >= subtractMonths(today(), ${trendPeriod})`;
            growthRangeFilter = `AND r.review_date >= subtractMonths(today(), ${lookbackMonths})`;
            recentFilter = `AND r.review_date >= subtractMonths(today(), ${trendPeriod})`;
            priorFilter = `AND r.review_date >= subtractMonths(today(), ${lookbackMonths}) AND r.review_date < subtractMonths(today(), ${trendPeriod})`;
        }
        
        const reviewPriceFiltStr = reviewPriceFilters.length ? 'AND ' + reviewPriceFilters.join(' AND ') : '';
        const snapPriceFiltStr = snapPriceFilters.length ? 'AND ' + snapPriceFilters.join(' AND ') : '';
        const platformFiltStr = platformFilters.length ? 'AND ' + platformFilters.join(' AND ') : '';
        const snapPlatformFiltStr = snapPlatformFilters.length ? 'AND ' + snapPlatformFilters.join(' AND ') : '';
        const catFiltStr = catFilters.length ? 'AND ' + catFilters.join(' AND ') : '';
        const snapCatFiltStr = snapCatFilters.length ? 'AND ' + snapCatFilters.join(' AND ') : '';

        const snapshotDateFilter = date_from 
            ? `AND snapshot_date >= toDate({dateFrom:String})`
            : `AND snapshot_date >= subtractMonths(today(), ${trendPeriod * 2})`;

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
                FROM sku_category_map scm
                WHERE 1=1 ${snapCatFiltStr.replace("coalesce(nullIf(ls.category, ''), nullIf(mp.category, ''))", "category")} ${snapPriceFiltStr.replace(/ls\./g, 'scm.').replace(/mp\.mrp/g, 'scm.price_rp').replace(/mp\.selling_price/g, 'scm.price_sp').replace(/mp\.mop/g, 'scm.price_sp')}
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
                WHERE r.company_id = {companyId:String} ${competitorFilter} ${currentScopeFilter}
                ${sentimentCategoryFilters.length ? 'AND ' + sentimentCategoryFilters.join(' AND ') : ''}
                GROUP BY scm.category
            ),
            cat_growth AS (
                SELECT scm.category AS cat_name,
                    countIf(1=1 ${recentFilter}) AS recent_reviews,
                    countIf(1=1 ${priorFilter}) AS prior_reviews,
                    round(avgIf(r.rating, 1=1 ${recentFilter}), 2) AS recent_rating,
                    round(avgIf(r.rating, 1=1 ${priorFilter}), 2) AS prior_rating
                FROM ml_reviews r
                JOIN sku_category_map scm ON scm.web_pid = r.web_pid AND scm.platform_key = lower(r.platform)
                WHERE r.company_id = {companyId:String} ${competitorFilter} ${growthRangeFilter}
                ${sentimentCategoryFilters.length ? 'AND ' + sentimentCategoryFilters.join(' AND ') : ''}
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
                WHERE mp.company_id = {companyId:String} AND mp.platform != '' AND mp.category != '' ${snapCompetitorFilter}
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
        
        console.log("SQL:", sql);
        console.log("PARAMS:", queryParams);
        const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();
        console.log("FIRST ROW:", rows[0]);
        
        const totals = { skuCount: 0, catalogueSkuCount: 0, reviewSkuCount: 0, totalRatings: 0, reviewCount: 0, paretoCount: 0, nonParetoCount: 0, npdCount: 0, totalAvgPlatformRatingNumerator: 0, totalAvgPlatformRatingDenominator: 0 };
        const categories = rows.map(r => {
            totals.skuCount += Number(r.sku_count || 0);
            totals.catalogueSkuCount += Number(r.catalogue_sku_count || r.sku_count || 0);
            totals.reviewSkuCount += Number(r.review_sku_count || 0);
            totals.totalRatings += Number(r.total_ratings || 0);
            totals.reviewCount += Number(r.review_count || 0);
            totals.paretoCount += Number(r.pareto_count || 0);
            totals.nonParetoCount += Number(r.non_pareto_count || 0);
            totals.npdCount += Number(r.npd_count || 0);
            
            if (r.avg_platform_rating !== null && r.total_ratings) {
                totals.totalAvgPlatformRatingNumerator += Number(r.avg_platform_rating) * Number(r.total_ratings);
                totals.totalAvgPlatformRatingDenominator += Number(r.total_ratings);
            }
            
            return {
                category: r.category,
                catalogueSkuCount: Number(r.catalogue_sku_count || r.sku_count || 0),
                skuCount: Number(r.sku_count || 0),
                reviewCount: Number(r.review_count || 0),
                reviewSkuCount: Number(r.review_sku_count || 0),
                avgReviewRating: r.avg_review_rating !== null ? Number(r.avg_review_rating) : 0,
                avgMlRating: r.avg_ml_rating !== null ? Number(r.avg_ml_rating) : null,
                positiveCount: Number(r.positive_count || 0),
                negativeCount: Number(r.negative_count || 0),
                neutralCount: Number(r.neutral_count || 0),
                totalRatings: Number(r.total_ratings || 0),
                avgPlatformRating: r.avg_platform_rating !== null ? Number(r.avg_platform_rating) : null,
                paretoCount: Number(r.pareto_count || 0),
                nonParetoCount: Number(r.non_pareto_count || 0),
                npdCount: Number(r.npd_count || 0),
                growthPct: r.growth_pct !== null ? Number(r.growth_pct) : 0,
                recentReviewCount: Number(r.recent_reviews || 0),
                priorReviewCount: Number(r.prior_reviews || 0),
                ratingGrowthDiff: (r.recent_rating || 0) - (r.prior_rating || 0),
                recentAvgRating: r.recent_rating !== null ? Number(r.recent_rating) : 0,
                priorAvgRating: r.prior_rating !== null ? Number(r.prior_rating) : 0
            };
        });
        
        totals.avgPlatformRating = totals.totalAvgPlatformRatingDenominator > 0 
            ? totals.totalAvgPlatformRatingNumerator / totals.totalAvgPlatformRatingDenominator 
            : null;
        
        delete totals.totalAvgPlatformRatingNumerator;
        delete totals.totalAvgPlatformRatingDenominator;
        res.json({ categories, total: totals });
    } catch (err) {
        console.error('Category health error:', err);
        res.status(500).json({ error: err.message });
    }
};

