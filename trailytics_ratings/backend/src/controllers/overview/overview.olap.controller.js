/**
 * Overview OLAP controller — uses the single `rb_review_olap` table.
 *
 * Activated when the logged-in db is listed in the OLAP_ENABLED_DBS env var.
 * Every query here mirrors the KPI logic of overview.controller.js but
 * reads from `rb_review_olap` instead of joining across six legacy tables.
 *
 * Column reference for rb_review_olap:
 *   review_id, company_id, pf_id, platform, web_pid, product_id, product_name, brand,
 *   review_external_id, reviewer_name, rating, review_title, review_text, review_date,
 *   is_verified_purchase, pdp_rating, pdp_rating_count, star_distribution, category,
 *   is_competitor, sentiment, sentiment_category, sentiment_subcategory, sentiment_score,
 *   specific_issue, quality_score, ml_inferred_rating, stakeholder, sentiment_display_label,
 *   product_category, product_subcategory, product_brand_name, product_image_url,
 *   product_sku_code, product_is_active, price_rp, price_sp, created_on
 */

import clickhouse from '../../config/clickhouse.js';

// ── helpers ────────────────────────────────────────────────────────────────

const OLAP_TABLE = 'rb_review_olap';

const getTargetDb = (req) =>
    req.query.db_name ||
    req.headers['x-db-name'] ||
    req.headers['x-database-name'] ||
    (req.authUser && req.authUser.dbName) ||
    process.env.CLICKHOUSE_DATABASE ||
    process.env.CLICKHOUSE_DB ||
    'prestige';

/**
 * Build base WHERE conditions for the OLAP table from request query params.
 * Returns { where: string[], queryParams: object }
 */
function buildOlapWhere(req, tableAlias = 'o') {
    const a = tableAlias;
    const { platform, category, is_competitor, sentiment_category, web_pid, brand,
            date_from, date_to, price_mode, price_min, price_max, rating_bifurcation } = req.query;

    const where = [`${a}.company_id = {companyId:String}`];
    const queryParams = { companyId: String(req.companyId) };

    if (is_competitor && is_competitor !== 'all') {
        where.push(`${a}.is_competitor = {isCompetitor:UInt8}`);
        queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
    }
    if (platform && platform !== 'all') {
        where.push(`ilike(${a}.platform, {platform:String})`);
        queryParams.platform = platform;
    }
    if (category) {
        where.push(`ilike(${a}.product_category, {category:String})`);
        queryParams.category = category;
    }
    if (sentiment_category && sentiment_category !== 'all') {
        where.push(`ilike(${a}.sentiment_category, {sentimentCategory:String})`);
        queryParams.sentimentCategory = sentiment_category;
    }
    if (web_pid) {
        where.push(`${a}.web_pid = {webPid:String}`);
        queryParams.webPid = web_pid;
    }
    if (brand && brand !== 'all') {
        where.push(`ilike(${a}.brand, {brand:String})`);
        queryParams.brand = brand;
    }

    // Date range
    if (date_from) {
        where.push(`${a}.review_date >= toDate({dateFrom:String})`);
        queryParams.dateFrom = date_from;
    } else if (!date_to) {
        where.push(`${a}.review_date >= addMonths(today(), -3)`);
    }
    if (date_to) {
        where.push(`${a}.review_date <= toDate({dateTo:String})`);
        queryParams.dateTo = date_to;
    }

    // Price filters
    const priceCol = price_mode === 'rp' ? `${a}.price_rp` : `${a}.price_sp`;
    if (price_min !== undefined && price_min !== '') {
        where.push(`${priceCol} >= {priceMin:Float64}`);
        queryParams.priceMin = Number(price_min);
    }
    if (price_max !== undefined && price_max !== '') {
        where.push(`${priceCol} <= {priceMax:Float64}`);
        queryParams.priceMax = Number(price_max);
    }

    // Rating bifurcation — filters on pdp_rating (per-product)
    if (rating_bifurcation) {
        if (rating_bifurcation === 'NP')    where.push(`${a}.pdp_rating >= 4.2`);
        else if (rating_bifurcation === 'Issue') where.push(`${a}.pdp_rating < 4.0`);
        else if (rating_bifurcation === 'NI')  where.push(`${a}.pdp_rating >= 4.0 AND ${a}.pdp_rating < 4.2`);
    }

    return { where, queryParams };
}

// ── getSummary ─────────────────────────────────────────────────────────────

export const getSummary = async (req, res) => {
    try {
        if (!req.companyId) return res.status(401).json({ error: 'Company context required' });

        const { where, queryParams } = buildOlapWhere(req);
        const whereClause = where.join(' AND ');
        const db = getTargetDb(req);

        // Review-level aggregates
        const reviewSql = `
            SELECT
                toString(count()) AS total_reviews,
                toString(round(avg(rating), 2)) AS avg_review_rating,
                toString(round(avg(ml_inferred_rating), 2)) AS avg_ml_rating,
                toString(count(DISTINCT web_pid)) AS unique_products,
                toString(count(DISTINCT product_category)) AS unique_categories,
                toString(countIf(sentiment = 'positive')) AS positive_count,
                toString(countIf(sentiment = 'negative')) AS negative_count,
                toString(countIf(sentiment = 'neutral')) AS neutral_count
            FROM ${OLAP_TABLE} o
            WHERE ${whereClause}
        `;
        const reviewRes = await clickhouse.query({ database: db, query: reviewSql, query_params: queryParams, format: 'JSONEachRow' });
        const reviewRows = await reviewRes.json();
        const metrics = reviewRows[0] || {};

        // Product-level: latest pdp_rating / pdp_rating_count per (web_pid, platform)
        // Use LIMIT 1 BY to deduplicate rows to one per product listing
        const pdpSql = `
            WITH latest_by_product AS (
                SELECT web_pid, platform, pdp_rating, pdp_rating_count
                FROM ${OLAP_TABLE} o
                WHERE ${whereClause} AND isNotNull(pdp_rating)
                ORDER BY review_date DESC
                LIMIT 1 BY web_pid, lower(platform)
            )
            SELECT
                toString(sum(coalesce(pdp_rating_count, 0))) AS total_ratings,
                toString(round(sum(pdp_rating * coalesce(pdp_rating_count, 0)) / nullIf(sum(coalesce(pdp_rating_count, 0)), 0), 2)) AS avg_platform_rating,
                toString(count()) AS total_products
            FROM latest_by_product
        `;
        const pdpRes = await clickhouse.query({ database: db, query: pdpSql, query_params: queryParams, format: 'JSONEachRow' });
        const pdpRows = await pdpRes.json();
        const pdpMetrics = pdpRows[0] || {};

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
                total_products: pdpMetrics.total_products || '0',
            },
            ratingDistribution: [], sentimentDistribution: [], materialDistribution: [], categoryDistribution: [],
        });
    } catch (err) {
        console.error('[OLAP] getSummary error:', err);
        res.json({
            metrics: { user_rating: null, ml_rating: null, pdp_rating: null, review_count: '0', rating_count: '0', total_ratings: '0', avg_platform_rating: null, total_reviews: '0', avg_review_rating: null, avg_ml_rating: null, unique_products: '0', unique_categories: '0', positive_count: '0', negative_count: '0', neutral_count: '0', total_products: '0' },
            ratingDistribution: [], sentimentDistribution: [], materialDistribution: [], categoryDistribution: [],
        });
    }
};

// ── getTrends ──────────────────────────────────────────────────────────────

export const getTrends = async (req, res) => {
    try {
        const periodMonths = parseInt(req.query.period_months) || 6;
        const safePeriodMonths = Math.max(1, Math.min(periodMonths, 24));
        const { date_from, date_to, platform, is_competitor, category, sentiment_category, web_pid, brand, price_mode, price_min, price_max, rating_bifurcation } = req.query;

        const queryParams = { companyId: String(req.companyId) };
        const extraFilters = [`o.company_id = {companyId:String}`, 'isNotNull(o.review_date)'];

        if (is_competitor && is_competitor !== 'all') {
            extraFilters.push(`coalesce(o.is_competitor, 0) = {isCompetitor:UInt8}`);
            queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        } else if (is_competitor === undefined || is_competitor === '') {
            extraFilters.push(`coalesce(o.is_competitor, 0) = 0`);
        }
        if (platform && platform !== 'all') { extraFilters.push(`ilike(o.platform, {platform:String})`); queryParams.platform = platform; }
        if (brand && brand !== 'all') { extraFilters.push(`ilike(o.brand, {brand:String})`); queryParams.brand = brand; }
        if (category) { extraFilters.push(`ilike(o.product_category, {category:String})`); queryParams.category = category; }
        if (sentiment_category && sentiment_category !== 'all') { extraFilters.push(`ilike(o.sentiment_category, {sentimentCategory:String})`); queryParams.sentimentCategory = sentiment_category; }
        if (web_pid) { extraFilters.push(`o.web_pid = {webPid:String}`); queryParams.webPid = web_pid; }
        if (price_min !== undefined && price_min !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            extraFilters.push(`${pe} >= {priceMin:Float64}`); queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            extraFilters.push(`${pe} <= {priceMax:Float64}`); queryParams.priceMax = Number(price_max);
        }
        if (rating_bifurcation) {
            if (rating_bifurcation === 'NP') extraFilters.push(`o.pdp_rating >= 4.2`);
            else if (rating_bifurcation === 'Issue') extraFilters.push(`o.pdp_rating < 4.0`);
            else if (rating_bifurcation === 'NI') extraFilters.push(`o.pdp_rating >= 4.0 AND o.pdp_rating < 4.2`);
        }

        let recentPeriodFilter, priorPeriodFilter, combinedWindowFilter;
        if (date_from && date_to) {
            queryParams.dateFrom = date_from; queryParams.dateTo = date_to;
            const midExpr = `(toDate({dateFrom:String}) + toUInt32((toDate({dateTo:String}) - toDate({dateFrom:String})) / 2))`;
            recentPeriodFilter = `o.review_date >= ${midExpr} AND o.review_date <= toDate({dateTo:String})`;
            priorPeriodFilter = `o.review_date >= toDate({dateFrom:String}) AND o.review_date < ${midExpr}`;
            combinedWindowFilter = `o.review_date >= toDate({dateFrom:String}) AND o.review_date <= toDate({dateTo:String})`;
        } else {
            const recentStart = `addMonths(today(), -${safePeriodMonths})`;
            const priorStart = `addMonths(today(), -${safePeriodMonths * 2})`;
            recentPeriodFilter = `o.review_date >= ${recentStart}`;
            priorPeriodFilter = `o.review_date >= ${priorStart} AND o.review_date < ${recentStart}`;
            combinedWindowFilter = `o.review_date >= ${priorStart}`;
        }

        const extraWhere = extraFilters.length > 0 ? `AND ${extraFilters.join(' AND ')}` : '';

        const sql = `
            WITH scoped_reviews AS (
                SELECT
                    REPLACE(coalesce(nullIf(o.sentiment_subcategory, ''), nullIf(o.sentiment_category, ''), 'General'), '_', ' ') AS characteristic,
                    CASE WHEN ${recentPeriodFilter} THEN 'recent' WHEN ${priorPeriodFilter} THEN 'prior' ELSE NULL END AS period,
                    o.sentiment
                FROM ${OLAP_TABLE} o
                WHERE o.company_id = {companyId:String} AND isNotNull(o.review_date) AND ${combinedWindowFilter} ${extraWhere}
            ),
            aggregated AS (
                SELECT characteristic,
                    countIf(period = 'recent') AS recent_total,
                    countIf(period = 'recent' AND sentiment = 'negative') AS recent_neg,
                    countIf(period = 'recent' AND sentiment = 'positive') AS recent_pos,
                    countIf(period = 'prior') AS prior_total,
                    countIf(period = 'prior' AND sentiment = 'negative') AS prior_neg,
                    countIf(period = 'prior' AND sentiment = 'positive') AS prior_pos
                FROM scoped_reviews WHERE isNotNull(period) GROUP BY characteristic
            )
            SELECT characteristic, recent_total, recent_neg, recent_pos, prior_total, prior_neg, prior_pos,
                CASE WHEN recent_total > 0 THEN toFloat64(recent_neg) / recent_total ELSE 0 END AS recent_neg_rate,
                CASE WHEN prior_total > 0 THEN toFloat64(prior_neg) / prior_total ELSE 0 END AS prior_neg_rate,
                (CASE WHEN recent_total > 0 THEN toFloat64(recent_neg) / recent_total ELSE 0 END) -
                (CASE WHEN prior_total > 0 THEN toFloat64(prior_neg) / prior_total ELSE 0 END) AS change
            FROM aggregated
            WHERE characteristic NOT IN ('General Feedback', 'Overall Quality', 'General') AND recent_total >= 5 AND prior_total >= 5
            ORDER BY change DESC
        `;

        console.log(sql, queryParams); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const escalating = rows.filter(r => r.change > 0.01 && r.recent_neg_rate > 0.10).slice(0, 10).map(r => ({
            characteristic: r.characteristic, recentNegativeRate: parseFloat(r.recent_neg_rate), olderNegativeRate: parseFloat(r.prior_neg_rate), change: parseFloat(r.change), recentCount: parseInt(r.recent_total), totalCount: parseInt(r.recent_total) + parseInt(r.prior_total), isEscalating: true, isImproving: false,
        }));
        const improving = rows.filter(r => r.change < -0.01).sort((a, b) => parseFloat(a.change) - parseFloat(b.change)).slice(0, 10).map(r => ({
            characteristic: r.characteristic, recentNegativeRate: parseFloat(r.recent_neg_rate), olderNegativeRate: parseFloat(r.prior_neg_rate), change: parseFloat(r.change), recentCount: parseInt(r.recent_total), totalCount: parseInt(r.recent_total) + parseInt(r.prior_total), isEscalating: false, isImproving: true,
        }));
        res.json({ escalating, improving });
    } catch (err) {
        console.error('[OLAP] getTrends error:', err);
        res.json({ escalating: [], improving: [] });
    }
};

// ── getTimeline ────────────────────────────────────────────────────────────

export const getTimeline = async (req, res) => {
    try {
        const { category, pareto_status, web_pid, date_from, date_to, platform, price_mode, price_min, price_max, is_competitor, rating_bifurcation } = req.query;
        const queryParams = { companyId: String(req.companyId) };
        const extraFilters = [];

        if (platform && platform !== 'all') { extraFilters.push(`ilike(o.platform, {platform:String})`); queryParams.platform = platform; }
        if (category) { extraFilters.push(`ilike(o.product_category, {category:String})`); queryParams.category = category; }
        if (web_pid) { extraFilters.push(`o.web_pid = {webPid:String}`); queryParams.webPid = web_pid; }
        if (date_from) { extraFilters.push(`o.review_date >= toDate({dateFrom:String})`); queryParams.dateFrom = date_from; }
        if (date_to) { extraFilters.push(`o.review_date <= toDate({dateTo:String})`); queryParams.dateTo = date_to; }
        if (is_competitor && is_competitor !== 'all') {
            extraFilters.push(`o.is_competitor = {isCompetitor:UInt8}`); queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        }
        if (price_min !== undefined && price_min !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            extraFilters.push(`${pe} >= {priceMin:Float64}`); queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            extraFilters.push(`${pe} <= {priceMax:Float64}`); queryParams.priceMax = Number(price_max);
        }
        if (rating_bifurcation) {
            if (rating_bifurcation === 'NP') extraFilters.push(`o.pdp_rating >= 4.2`);
            else if (rating_bifurcation === 'Issue') extraFilters.push(`o.pdp_rating < 4.0`);
            else if (rating_bifurcation === 'NI') extraFilters.push(`o.pdp_rating >= 4.0 AND o.pdp_rating < 4.2`);
        }
        if (!date_from && !date_to && req.query.period_months) {
            const pm = Math.max(1, Math.min(parseInt(req.query.period_months, 10) || 6, 24));
            extraFilters.push(`o.review_date >= addMonths(today(), -${pm})`);
        }

        const extraWhere = extraFilters.length > 0 ? 'AND ' + extraFilters.join(' AND ') : '';

        const sql = `
            SELECT
                formatDateTime(o.review_date, '%Y-%m') AS month,
                o.sentiment_category AS category,
                count() AS total,
                countIf(o.sentiment = 'positive') AS positive,
                countIf(o.sentiment = 'negative') AS negative,
                countIf(o.sentiment = 'neutral') AS neutral,
                round(avg(o.rating), 2) AS avg_rating
            FROM ${OLAP_TABLE} o
            WHERE o.company_id = {companyId:String} AND isNotNull(o.review_date)
              ${extraWhere}
            GROUP BY month, category
            ORDER BY month, category
        `;

        console.log(sql, queryParams); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const monthMap = {};
        rows.forEach(r => {
            if (!monthMap[r.month]) monthMap[r.month] = { month: r.month, categories: {}, totalReviews: 0, avgRating: 0 };
            const cat = r.category || 'Uncategorized';
            monthMap[r.month].categories[cat] = { positive: parseInt(r.positive), negative: parseInt(r.negative), neutral: parseInt(r.neutral), total: parseInt(r.total) };
            monthMap[r.month].totalReviews += parseInt(r.total);
            monthMap[r.month].avgRating += parseFloat(r.avg_rating || 0) * parseInt(r.total);
        });
        Object.values(monthMap).forEach(m => { m.avgRating = m.totalReviews > 0 ? m.avgRating / m.totalReviews : 0; });
        const timeline = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
        res.json({ timeline });
    } catch (err) {
        console.error('[OLAP] getTimeline error:', err);
        res.json({ timeline: [] });
    }
};

// ── getRatingTrend ─────────────────────────────────────────────────────────
// Note: rb_review_olap has no snapshot-history table equivalent.
// We derive a monthly PDP rating trend from the review rows (review_date bucketed).

export const getRatingTrend = async (req, res) => {
    try {
        const { web_pid, platform, days } = req.query;
        if (!web_pid) return res.status(400).json({ error: 'web_pid param required' });
        const daysClamped = Math.max(1, Math.min(parseInt(days, 10) || 180, 365));
        const queryParams = { companyId: String(req.companyId), webPid: String(web_pid), daysClamped: Number(daysClamped) };
        let platformClause = '';
        if (platform && platform !== 'all') { queryParams.platform = String(platform); platformClause = `AND lower(platform) = lower({platform:String})`; }

        const sql = `
            SELECT
                toStartOfMonth(review_date) AS snapshot_date,
                platform,
                round(avg(pdp_rating), 2) AS rating,
                max(pdp_rating_count) AS rating_count,
                count() AS review_count,
                round(avg(price_rp), 2) AS price_rp,
                round(avg(price_sp), 2) AS price_sp
            FROM ${OLAP_TABLE}
            WHERE company_id = {companyId:String}
              AND web_pid = {webPid:String}
              ${platformClause}
              AND review_date >= addDays(today(), -{daysClamped:Int32})
            GROUP BY snapshot_date, platform
            ORDER BY snapshot_date ASC, platform ASC
        `;
        console.log(sql, queryParams); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        res.json({
            points: rows.map(r => ({
                date: r.snapshot_date, platform: r.platform,
                rating: r.rating != null ? Number(r.rating) : null,
                rating_count: r.rating_count, review_count: r.review_count,
                price_rp: r.price_rp != null ? Number(r.price_rp) : null,
                price_sp: r.price_sp != null ? Number(r.price_sp) : null,
            })),
        });
    } catch (err) {
        console.error('[OLAP] getRatingTrend error:', err);
        res.json({ points: [] });
    }
};

// ── getExecutiveHealth ─────────────────────────────────────────────────────

export const getExecutiveHealth = async (req, res) => {
    try {
        const { category: filterCategory, rating_bifurcation, platform, period_months,
                date_from, date_to, price_mode, price_min, price_max,
                is_competitor, sentiment_category, web_pid } = req.query;
        const trendPeriod = parseInt(period_months) || 3;
        const queryParams = { companyId: String(req.companyId) };

        const baseFilters = [`o.company_id = {companyId:String}`];

        // competitor
        let competitorFilter = '';
        if (is_competitor === 'true' || is_competitor === 'false') {
            competitorFilter = `AND coalesce(o.is_competitor, 0) = {isCompetitor:UInt8}`;
            queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        } else if (is_competitor === 'all') {
            competitorFilter = '';
        } else {
            competitorFilter = `AND coalesce(o.is_competitor, 0) = 0`;
        }

        if (platform && platform !== 'all') { baseFilters.push(`ilike(o.platform, {platform:String})`); queryParams.platform = platform; }
        if (web_pid) { baseFilters.push(`o.web_pid = {webPid:String}`); queryParams.webPid = web_pid; }
        if (filterCategory) { baseFilters.push(`ilike(o.product_category, {filterCategory:String})`); queryParams.filterCategory = filterCategory; }
        if (sentiment_category && sentiment_category !== 'all') { baseFilters.push(`ilike(o.sentiment_category, {sentimentCategory:String})`); queryParams.sentimentCategory = sentiment_category; }
        if (price_min !== undefined && price_min !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            baseFilters.push(`${pe} >= {priceMin:Float64}`); queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            baseFilters.push(`${pe} <= {priceMax:Float64}`); queryParams.priceMax = Number(price_max);
        }

        let ratingFilter = '';
        if (rating_bifurcation === 'NP') ratingFilter = `AND pdp_rating >= 4.2`;
        else if (rating_bifurcation === 'Issue') ratingFilter = `AND pdp_rating < 4.0`;
        else if (rating_bifurcation === 'NI') ratingFilter = `AND pdp_rating >= 4.0 AND pdp_rating < 4.2`;

        let primaryReviewFilter, recentReviewFilter, priorReviewFilter, reviewScopeFilter;
        if (date_from && date_to) {
            queryParams.dateFrom = date_from; queryParams.dateTo = date_to;
            const midExpr = `(toDate({dateFrom:String}) + toUInt32((toDate({dateTo:String}) - toDate({dateFrom:String})) / 2))`;
            reviewScopeFilter = `o.review_date >= toDate({dateFrom:String}) AND o.review_date <= toDate({dateTo:String})`;
            primaryReviewFilter = reviewScopeFilter;
            recentReviewFilter = `o.review_date >= ${midExpr} AND o.review_date <= toDate({dateTo:String})`;
            priorReviewFilter = `o.review_date >= toDate({dateFrom:String}) AND o.review_date < ${midExpr}`;
        } else {
            const lookbackMonths = trendPeriod * 2;
            reviewScopeFilter = `o.review_date >= addMonths(today(), -${lookbackMonths})`;
            primaryReviewFilter = `o.review_date >= addMonths(today(), -${trendPeriod})`;
            recentReviewFilter = `o.review_date >= addMonths(today(), -${trendPeriod})`;
            priorReviewFilter = `o.review_date >= addMonths(today(), -${lookbackMonths}) AND o.review_date < addMonths(today(), -${trendPeriod})`;
        }

        const baseWhere = baseFilters.join(' AND ');

        const sql = `
            WITH -- latest pdp info per product
            product_latest AS (
                SELECT web_pid, platform,
                    argMax(pdp_rating, review_date) AS pdp_rating,
                    argMax(pdp_rating_count, review_date) AS rating_count,
                    argMax(price_rp, review_date) AS price_rp,
                    argMax(price_sp, review_date) AS price_sp,
                    argMax(product_name, review_date) AS product_name,
                    argMax(product_category, review_date) AS category,
                    argMax(star_distribution, review_date) AS star_distribution
                FROM ${OLAP_TABLE} o
                WHERE ${baseWhere} ${competitorFilter}
                  AND ${reviewScopeFilter}
                GROUP BY web_pid, platform
            ),
            review_stats AS (
                SELECT
                    o.web_pid,
                    round(avgIf(o.rating, ${primaryReviewFilter}), 2) AS primary_avg_rating,
                    round(avgIf(o.ml_inferred_rating, ${primaryReviewFilter}), 2) AS primary_ml_rating,
                    round(avgIf(o.rating, ${recentReviewFilter}), 2) AS recent_avg_rating,
                    round(avgIf(o.rating, ${priorReviewFilter}), 2) AS older_avg_rating,
                    countIf(${primaryReviewFilter}) AS primary_total_reviews,
                    countIf(${recentReviewFilter}) AS recent_review_count,
                    countIf(${priorReviewFilter}) AS older_review_count,
                    maxIf(o.review_date, ${primaryReviewFilter}) AS latest_review_date
                FROM ${OLAP_TABLE} o
                WHERE ${baseWhere} ${competitorFilter}
                  AND ${reviewScopeFilter}
                GROUP BY o.web_pid
            ),
            product_health AS (
                SELECT
                    pl.web_pid, pl.platform, pl.product_name, pl.category,
                    pl.pdp_rating, pl.rating_count, pl.price_rp, pl.price_sp,
                    coalesce(toFloat64(JSONExtractString(pl.star_distribution, '1')), 0) / nullIf(pl.rating_count, 0) AS one_star_pct,
                    rs.primary_avg_rating AS scoped_avg_rating,
                    rs.primary_ml_rating AS scoped_ml_rating,
                    rs.recent_avg_rating, rs.older_avg_rating,
                    coalesce(rs.primary_total_reviews, 0) AS total_reviews,
                    rs.latest_review_date,
                    coalesce(rs.recent_review_count, 0) AS recent_review_count,
                    coalesce(rs.older_review_count, 0) AS older_review_count
                FROM product_latest pl
                LEFT JOIN review_stats rs ON rs.web_pid = pl.web_pid
                WHERE 1=1 ${ratingFilter}
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
            SETTINGS max_memory_usage = 2000000000;
        `;

        console.log(sql, queryParams); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const dedupedMap = new Map();
        for (const r of rows) {
            const existing = dedupedMap.get(r.web_pid);
            if (!existing) dedupedMap.set(r.web_pid, r);
        }
        const dedupedRows = Array.from(dedupedMap.values());

        // In OLAP table we have no pareto_status column — classify all as 'Non-Pareto'
        // (extend later when pareto_status is added to the OLAP table)
        const buckets = { Pareto: {}, 'Non-Pareto': {}, NPD: {} };

        dedupedRows.forEach(r => {
            const bucket = 'Non-Pareto'; // no pareto_status in OLAP v1
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
                web_pid: r.web_pid, product_name: r.product_name, pdp_rating: r.pdp_rating ? parseFloat(r.pdp_rating) : null,
                rating_count: parseInt(r.rating_count || 0), price_rp: r.price_rp ? parseFloat(r.price_rp) : null,
                price_sp: r.price_sp ? parseFloat(r.price_sp) : null, category: r.category || 'Uncategorized',
                ml_rating: r.scoped_ml_rating ? parseFloat(r.scoped_ml_rating) : null,
                recent_avg_rating: recent, older_avg_rating: older, trend_direction,
                total_reviews: parseInt(r.total_reviews || 0),
                user_rating: r.scoped_avg_rating ? parseFloat(r.scoped_avg_rating) : null,
                latest_review_date: r.latest_review_date || null,
                recent_review_count: parseInt(r.recent_review_count || 0),
                older_review_count: parseInt(r.older_review_count || 0),
            });
        });

        const computeGroupKpis = (skus) => {
            if (!skus || skus.length === 0) return { totalRatings: 0, totalReviewCount: 0, reviewSkuCount: 0, avgPlatformRating: null, userRating: null, mlRating: null, pdpHealthRate: 0, reviewGrowthPct: 0, recentReviewCount: 0, olderReviewCount: 0, ratingGrowthDiff: 0, recentAvgRating: null, olderAvgRating: null };
            const totalRatings = skus.reduce((s, x) => s + (x.rating_count || 0), 0);
            const totalReviewCount = skus.reduce((s, x) => s + (x.total_reviews || 0), 0);
            const reviewSkuCount = new Set(skus.filter(x => x.total_reviews > 0).map(x => x.web_pid)).size;
            const ratedSkus = skus.filter(x => x.pdp_rating !== null && x.pdp_rating !== undefined);
            const weightedSum = ratedSkus.reduce((s, x) => s + (x.pdp_rating * (x.rating_count || 1)), 0);
            const weightedDenom = ratedSkus.reduce((s, x) => s + (x.rating_count || 1), 0);
            const avgPlatformRating = weightedDenom > 0 ? Math.round((weightedSum / weightedDenom) * 100) / 100 : null;
            const reviewWeightedSum = skus.reduce((s, x) => s + ((x.user_rating || 0) * (x.total_reviews || 0)), 0);
            const mlWeightedSum = skus.reduce((s, x) => s + ((x.ml_rating || 0) * (x.total_reviews || 0)), 0);
            const reviewWeightedDenom = skus.reduce((s, x) => s + (x.user_rating !== null && x.user_rating !== undefined ? (x.total_reviews || 0) : 0), 0);
            const mlWeightedDenom = skus.reduce((s, x) => s + (x.ml_rating !== null && x.ml_rating !== undefined ? (x.total_reviews || 0) : 0), 0);
            const userRating = reviewWeightedDenom > 0 ? Math.round((reviewWeightedSum / reviewWeightedDenom) * 100) / 100 : null;
            const mlRating = mlWeightedDenom > 0 ? Math.round((mlWeightedSum / mlWeightedDenom) * 100) / 100 : null;
            const aboveThreshold = ratedSkus.filter(x => x.pdp_rating >= 4.0).length;
            const pdpHealthRate = ratedSkus.length > 0 ? Math.round((aboveThreshold / ratedSkus.length) * 100) : 0;
            const recentTotal = skus.reduce((s, x) => s + (x.recent_review_count || 0), 0);
            const olderTotal = skus.reduce((s, x) => s + (x.older_review_count || 0), 0);
            const reviewGrowthPct = olderTotal > 0 ? Math.round(((recentTotal - olderTotal) / olderTotal) * 100) : (recentTotal > 0 ? 100 : 0);
            const recentSumRating = skus.reduce((s, x) => s + ((x.recent_avg_rating || 0) * (x.recent_review_count || 0)), 0);
            const olderSumRating = skus.reduce((s, x) => s + ((x.older_avg_rating || 0) * (x.older_review_count || 0)), 0);
            const recentAvgRating = recentTotal > 0 ? Math.round((recentSumRating / recentTotal) * 100) / 100 : null;
            const olderAvgRating = olderTotal > 0 ? Math.round((olderSumRating / olderTotal) * 100) / 100 : null;
            const ratingGrowthDiff = (recentAvgRating !== null && olderAvgRating !== null && recentTotal > 0 && olderTotal > 0) ? Math.round((recentAvgRating - olderAvgRating) * 100) / 100 : 0;
            return { totalRatings, totalReviewCount, reviewSkuCount, avgPlatformRating, userRating, mlRating, pdpHealthRate, reviewGrowthPct, recentReviewCount: recentTotal, olderReviewCount: olderTotal, ratingGrowthDiff, recentAvgRating, olderAvgRating };
        };

        const formatBucket = (name, data) => {
            const np = data['NP'] || []; const issue = data['Issue'] || []; const ni = data['NI'] || [];
            const critical = data['Critical'] || []; const noRating = data['NoRating'] || [];
            const allSkus = [...np, ...issue, ...ni, ...critical, ...noRating];
            const bucketKpis = computeGroupKpis(allSkus);
            return {
                name, total: new Set(allSkus.map(s => s.web_pid)).size, ...bucketKpis, positiveRate: bucketKpis.pdpHealthRate,
                np: { count: np.length, skus: np, ...computeGroupKpis(np) },
                issue: { count: issue.length, skus: issue, ...computeGroupKpis(issue) },
                ni: { count: ni.length, skus: ni, ...computeGroupKpis(ni) },
                critical: { count: critical.length, skus: critical, ...computeGroupKpis(critical) },
                noRating: { count: noRating.length, skus: noRating, ...computeGroupKpis(noRating) },
            };
        };

        const pareto = formatBucket('Pareto', buckets['Pareto']);
        const nonPareto = formatBucket('Non-Pareto', buckets['Non-Pareto']);
        const npd = formatBucket('NPD', buckets['NPD']);
        const allBucketSkus = new Set(dedupedRows.map(r => r.web_pid));
        const catalogueCounts = { Pareto: 0, 'Non-Pareto': allBucketSkus.size, NPD: 0 };

        res.json({ pareto, nonPareto, npd, total: allBucketSkus.size, catalogueCounts, catalogueTotal: allBucketSkus.size });
    } catch (err) {
        console.error('[OLAP] getExecutiveHealth error:', err);
        res.json({ pareto: { total: 0 }, nonPareto: { total: 0 }, npd: { total: 0 }, total: 0, catalogueCounts: {}, catalogueTotal: 0 });
    }
};

// ── getRatingMismatch ──────────────────────────────────────────────────────

export const getRatingMismatch = async (req, res) => {
    try {
        const { platform, category, web_pid, is_competitor, date_from, date_to, direction } = req.query;
        const minGap = Math.max(1, Math.min(parseInt(req.query.min_gap, 10) || 2, 4));
        const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 100, 500));

        const baseWhere = ['o.company_id = {companyId:String}', 'isNotNull(o.rating)', 'isNotNull(o.ml_inferred_rating)'];
        const queryParams = { companyId: String(req.companyId), minGap: Number(minGap), limit: Number(limit) };

        if (platform && platform !== 'all') { queryParams.platform = platform; baseWhere.push(`lower(o.platform) = lower({platform:String})`); }
        if (category) { queryParams.category = category; baseWhere.push(`ilike(o.product_category, {category:String})`); }
        if (web_pid) { queryParams.webPid = web_pid; baseWhere.push(`upper(o.web_pid) = upper({webPid:String})`); }
        if (is_competitor === 'true' || is_competitor === 'false') { queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0; baseWhere.push(`o.is_competitor = {isCompetitor:UInt8}`); }
        if (date_from) { queryParams.dateFrom = date_from; baseWhere.push(`o.review_date >= toDate({dateFrom:String})`); }
        if (date_to) { queryParams.dateTo = date_to; baseWhere.push(`o.review_date <= toDate({dateTo:String})`); }

        let dirClause = `abs(o.rating - o.ml_inferred_rating) >= {minGap:Float64}`;
        if (direction === 'star_high_text_low') dirClause = `(o.rating - o.ml_inferred_rating) >= {minGap:Float64}`;
        else if (direction === 'star_low_text_high') dirClause = `(o.ml_inferred_rating - o.rating) >= {minGap:Float64}`;

        const sql = `
            SELECT o.web_pid, o.product_name, o.platform, o.brand,
                   o.rating, o.ml_inferred_rating,
                   (o.rating - o.ml_inferred_rating) AS gap,
                   o.sentiment, o.sentiment_category, o.review_title,
                   substring(o.review_text, 1, 300) AS review_text, o.review_date,
                   o.product_category AS category
              FROM ${OLAP_TABLE} o
             WHERE ${[...baseWhere, dirClause].join(' AND ')}
             ORDER BY abs(o.rating - o.ml_inferred_rating) DESC, o.review_date DESC
             LIMIT {limit:Int32}
        `;
        console.log(sql, queryParams); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const sumSql = `
            SELECT countIf((o.rating - o.ml_inferred_rating) >= {minGap:Float64}) AS star_high_text_low,
                   countIf((o.ml_inferred_rating - o.rating) >= {minGap:Float64}) AS star_low_text_high
              FROM ${OLAP_TABLE} o
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
        console.error('[OLAP] getRatingMismatch error:', err);
        res.json({ minGap: 2, summary: { star_high_text_low: 0, star_low_text_high: 0 }, reviews: [] });
    }
};

// ── getReviewTimeline ──────────────────────────────────────────────────────

export const getReviewTimeline = async (req, res) => {
    try {
        const { web_pid, platform, limit = 500 } = req.query;
        if (!web_pid) return res.status(400).json({ error: 'web_pid is required' });

        const where = ['company_id = {companyId:String}', 'web_pid = {webPid:String}', 'review_date >= addDays(today(), -365)'];
        const queryParams = { companyId: String(req.companyId), webPid: String(web_pid) };
        if (platform && platform !== 'all') { where.push(`lower(platform) = lower({platform:String})`); queryParams.platform = platform; }
        const lim = Math.min(parseInt(limit, 10) || 500, 2000);
        queryParams.limit = lim;

        console.log(sql, queryParams); const chRes = await clickhouse.query({
            database: getTargetDb(req),
            query: `
                SELECT review_id AS id, rating, sentiment, review_date, review_title, review_text,
                       specific_issue, sentiment_category, platform
                  FROM ${OLAP_TABLE}
                 WHERE ${where.join(' AND ')}
                 ORDER BY review_date ASC
                 LIMIT {limit:Int32}
            `,
            query_params: queryParams, format: 'JSONEachRow'
        });
        const rows = await chRes.json();

        const monthly = new Map();
        for (const r of rows) {
            if (!r.review_date) continue;
            const m = String(r.review_date).slice(0, 7);
            if (!monthly.has(m)) monthly.set(m, { month: m, count: 0, ratingSum: 0, neg: 0, pos: 0 });
            const e = monthly.get(m);
            e.count++;
            if (r.rating != null) e.ratingSum += Number(r.rating);
            if (r.sentiment === 'negative') e.neg++;
            if (r.sentiment === 'positive') e.pos++;
        }
        const monthlyArr = [...monthly.values()].map(e => ({ month: e.month, count: e.count, avg_rating: e.count > 0 ? Math.round((e.ratingSum / e.count) * 100) / 100 : null, neg_pct: e.count > 0 ? Math.round(100 * e.neg / e.count) : 0, pos_pct: e.count > 0 ? Math.round(100 * e.pos / e.count) : 0 }));

        res.json({ web_pid, total: rows.length, monthly: monthlyArr, reviews: rows });
    } catch (err) {
        console.error('[OLAP] getReviewTimeline error:', err);
        res.json({ web_pid: req.query.web_pid, total: 0, monthly: [], reviews: [] });
    }
};

// ── getPriceVariance ───────────────────────────────────────────────────────

export const getPriceVariance = async (req, res) => {
    try {
        const { category, platform } = req.query;
        const where = ['o.company_id = {companyId:String}', 'isNotNull(o.price_rp)', 'o.price_rp > 0'];
        const queryParams = { companyId: String(req.companyId) };
        if (category) { where.push(`ilike(o.product_category, {category:String})`); queryParams.category = category; }
        if (platform && platform !== 'all') { where.push(`lower(o.platform) = lower({platform:String})`); queryParams.platform = platform; }

        const sql = `
            WITH base AS (
                SELECT o.brand, o.is_competitor, o.product_category AS master_category,
                       coalesce(o.price_sp, o.price_rp) AS effective_price, o.price_rp AS mrp
                FROM (
                    SELECT brand, is_competitor, product_category, price_sp, price_rp
                    FROM ${OLAP_TABLE} o
                    WHERE ${where.join(' AND ')}
                    LIMIT 1 BY web_pid, lower(platform)
                ) o
                WHERE isNotNull(o.brand)
            ),
            agg AS (
                SELECT brand, is_competitor, master_category, count() AS sku_count,
                       quantile(0.5)(effective_price) AS median_price,
                       min(effective_price) AS min_price, max(effective_price) AS max_price, avg(effective_price) AS avg_price
                FROM base GROUP BY brand, is_competitor, master_category
            ),
            own_brand_baseline AS (SELECT master_category, median_price FROM agg WHERE is_competitor = 0)
            SELECT a.brand AS brand, a.is_competitor, a.master_category AS category,
                   a.sku_count, round(a.median_price, 0) AS median_price, round(a.min_price, 0) AS min_price,
                   round(a.max_price, 0) AS max_price, round(a.avg_price, 0) AS avg_price,
                   round(ob.median_price, 0) AS own_brand_median,
                   CASE WHEN isNotNull(ob.median_price) AND ob.median_price > 0 THEN round(((a.median_price - ob.median_price) / ob.median_price * 100), 1) ELSE NULL END AS pct_vs_own_brand
            FROM agg a LEFT JOIN own_brand_baseline ob ON ob.master_category = a.master_category
            ORDER BY a.master_category, a.sku_count DESC
        `;
        console.log(sql, queryParams); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();
        res.json({ rows });
    } catch (err) {
        console.error('[OLAP] getPriceVariance error:', err);
        res.json({ rows: [] });
    }
};

// ── getProductHealth ───────────────────────────────────────────────────────

export const getProductHealth = async (req, res) => {
    try {
        const { category, web_pid, date_from, date_to, platform, period_months, price_mode, price_min, price_max, is_competitor, sentiment_category, brand, rating_bifurcation } = req.query;
        const trendPeriod = Math.max(1, Math.min(parseInt(period_months) || 3, 24));
        const queryParams = { companyId: String(req.companyId) };
        const where = ['o.company_id = {companyId:String}', 'isNotNull(o.product_name)', 'isNotNull(o.review_date)'];

        if (is_competitor && is_competitor !== 'all') { where.push(`coalesce(o.is_competitor, 0) = {isCompetitor:UInt8}`); queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0; }
        else if (is_competitor === undefined || is_competitor === '') { where.push(`coalesce(o.is_competitor, 0) = 0`); }
        if (platform && platform !== 'all') { where.push(`ilike(o.platform, {platform:String})`); queryParams.platform = platform; }
        if (brand && brand !== 'all') { where.push(`ilike(o.brand, {brand:String})`); queryParams.brand = brand; }
        if (category) { where.push(`ilike(o.product_category, {category:String})`); queryParams.category = category; }
        if (sentiment_category && sentiment_category !== 'all') { where.push(`ilike(o.sentiment_category, {sentimentCategory:String})`); queryParams.sentimentCategory = sentiment_category; }
        if (web_pid) { where.push(`o.web_pid = {webPid:String}`); queryParams.webPid = web_pid; }
        if (price_min !== undefined && price_min !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            where.push(`${pe} >= {priceMin:Float64}`); queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            where.push(`${pe} <= {priceMax:Float64}`); queryParams.priceMax = Number(price_max);
        }
        if (rating_bifurcation) {
            if (rating_bifurcation === 'NP') where.push(`o.pdp_rating >= 4.2`);
            else if (rating_bifurcation === 'Issue') where.push(`o.pdp_rating < 4.0`);
            else if (rating_bifurcation === 'NI') where.push(`o.pdp_rating >= 4.0 AND o.pdp_rating < 4.2`);
        }

        let recentPeriodFilter, priorPeriodFilter, combinedWindowFilter;
        if (date_from && date_to) {
            queryParams.dateFrom = date_from; queryParams.dateTo = date_to;
            const midExpr = `(toDate({dateFrom:String}) + toUInt32((toDate({dateTo:String}) - toDate({dateFrom:String})) / 2))`;
            recentPeriodFilter = `o.review_date >= ${midExpr} AND o.review_date <= toDate({dateTo:String})`;
            priorPeriodFilter = `o.review_date >= toDate({dateFrom:String}) AND o.review_date < ${midExpr}`;
            combinedWindowFilter = `o.review_date >= toDate({dateFrom:String}) AND o.review_date <= toDate({dateTo:String})`;
        } else {
            const recentStart = `subtractMonths(today(), ${trendPeriod})`;
            const priorStart = `subtractMonths(today(), ${trendPeriod * 2})`;
            recentPeriodFilter = `o.review_date >= ${recentStart}`;
            priorPeriodFilter = `o.review_date >= ${priorStart} AND o.review_date < ${recentStart}`;
            combinedWindowFilter = `o.review_date >= ${priorStart}`;
        }
        where.push(combinedWindowFilter);

        const sql = `
            WITH product_stats AS (
                SELECT
                    substring(o.product_name, 1, 80) AS product,
                    count() AS total,
                    countIf(o.sentiment = 'positive') AS positive,
                    countIf(o.sentiment = 'negative') AS negative,
                    countIf(o.sentiment = 'neutral') AS neutral,
                    countIf(${recentPeriodFilter}) AS recent_total,
                    countIf(${recentPeriodFilter} AND o.sentiment = 'negative') AS recent_neg,
                    countIf(${priorPeriodFilter}) AS older_total,
                    countIf(${priorPeriodFilter} AND o.sentiment = 'negative') AS older_neg
                FROM ${OLAP_TABLE} o
                WHERE ${where.join(' AND ')}
                GROUP BY substring(o.product_name, 1, 80)
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
        console.log(sql, queryParams); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const topProducts = rows.slice(0, 20).map(r => r.product);
        let monthlyData = {};
        if (topProducts.length > 0) {
            const mParams = { companyId: String(req.companyId), topProducts };
            const mWhere = ['o.company_id = {companyId:String}', 'substring(o.product_name, 1, 80) IN {topProducts:Array(String)}', 'isNotNull(o.review_date)'];
            if (is_competitor && is_competitor !== 'all') { mWhere.push(`coalesce(o.is_competitor, 0) = {isCompetitor:UInt8}`); mParams.isCompetitor = is_competitor === 'true' ? 1 : 0; }
            if (category) { mWhere.push(`ilike(o.product_category, {category:String})`); mParams.category = category; }
            if (date_from) { mWhere.push(`o.review_date >= toDate({dateFrom:String})`); mParams.dateFrom = date_from; }
            if (date_to) { mWhere.push(`o.review_date <= toDate({dateTo:String})`); mParams.dateTo = date_to; }
            if (price_min !== undefined && price_min !== '') {
                const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
                mWhere.push(`${pe} >= {priceMin:Float64}`); mParams.priceMin = Number(price_min);
            }
            if (price_max !== undefined && price_max !== '') {
                const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
                mWhere.push(`${pe} <= {priceMax:Float64}`); mParams.priceMax = Number(price_max);
            }

            const monthSql = `
                SELECT substring(o.product_name, 1, 80) AS product,
                       substring(toString(o.review_date), 1, 7) AS month,
                       round(avg(o.rating), 2) AS avg_rating,
                       count() AS count
                FROM ${OLAP_TABLE} o
                WHERE ${mWhere.join(' AND ')}
                GROUP BY product, month
                ORDER BY product, month
            `;
            const mRes = await clickhouse.query({ database: getTargetDb(req), query: monthSql, query_params: mParams, format: 'JSONEachRow' });
            const mRows = await mRes.json();
            mRows.forEach(r => {
                if (!monthlyData[r.product]) monthlyData[r.product] = [];
                monthlyData[r.product].push({ month: r.month, avg: parseFloat(r.avg_rating), count: parseInt(r.count) });
            });
        }

        const products = rows.map(r => ({
            product: r.product, healthScore: parseInt(r.health_score), totalMentions: parseInt(r.total),
            positiveRate: parseFloat(r.positive_rate), negativeRate: parseFloat(r.negative_rate),
            trend: r.trend, monthlyRatings: (monthlyData[r.product] || []).slice(-12),
        }));
        res.json({ products });
    } catch (err) {
        console.error('[OLAP] getProductHealth error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── getBenchmarkData ───────────────────────────────────────────────────────

export const getBenchmarkData = async (req, res) => {
    try {
        console.log('[OLAP] getBenchmarkData CALLED');
        const { category, platform, date_from, date_to, period_months, price_mode, price_min, price_max, web_pid, sentiment_category } = req.query;
        const db = getTargetDb(req);
        const queryParams = { companyId: String(req.companyId), dbName: db };
        const conditions = [
            'o.company_id = {companyId:String}',
            `(coalesce(o.is_competitor, 0) = 0 OR (isNotNull(o.brand) AND o.brand <> '' AND length(trim(o.brand)) >= 3 AND lower(trim(o.brand)) NOT IN ('the','not','and','gas','extracted','none','null','n/a','other','unknown','etc','for','was','were','our','your','its')))`
        ];

        if (category) { conditions.push(`ilike(trim(o.product_category), {category:String})`); queryParams.category = category; }
        if (platform && platform !== 'all') { conditions.push(`ilike(o.platform, {platform:String})`); queryParams.platform = platform; }
        if (date_from) { conditions.push(`o.review_date >= toDate({dateFrom:String})`); queryParams.dateFrom = date_from; }
        if (date_to) { conditions.push(`o.review_date <= toDate({dateTo:String})`); queryParams.dateTo = date_to; }
        else if (!date_from && period_months) {
            const safePeriodMonths = Math.max(1, Math.min(parseInt(period_months) || 6, 24));
            conditions.push(`o.review_date >= subtractMonths(today(), ${safePeriodMonths})`);
        }
        if (price_min !== undefined && price_min !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            conditions.push(`${pe} >= {priceMin:Float64}`); queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            conditions.push(`${pe} <= {priceMax:Float64}`); queryParams.priceMax = Number(price_max);
        }
        if (sentiment_category && sentiment_category !== 'all') { conditions.push(`ilike(o.sentiment_category, {sentimentCategory:String})`); queryParams.sentimentCategory = sentiment_category; }

        let skuCondition = '';
        if (web_pid) {
            queryParams.webPid = String(web_pid);
            skuCondition = `AND (
                (coalesce(o.is_competitor, 0) = 0 AND o.web_pid = {webPid:String})
                OR (coalesce(o.is_competitor, 0) = 1 AND o.product_category IN (
                    SELECT product_category FROM ${OLAP_TABLE}
                    WHERE company_id = {companyId:String} AND web_pid = {webPid:String}
                    LIMIT 1
                ))
            )`;
        }

        const sql = `
            WITH scoped_reviews AS (
                SELECT
                    multiIf(coalesce(o.is_competitor, 0) = 0, initcap({dbName:String}), initcap(lower(o.brand))) AS brand,
                    coalesce(o.is_competitor, 0) AS is_competitor,
                    coalesce(nullIf(o.sentiment_category, ''), 'General') AS sentiment_category,
                    o.rating AS rev_rating, o.ml_inferred_rating AS rev_ml_rating, o.sentiment AS rev_sentiment,
                    o.web_pid AS rev_web_pid, o.platform AS rev_platform,
                    o.pdp_rating AS pdp_rating, o.pdp_rating_count AS rating_count
                FROM ${OLAP_TABLE} o
                WHERE ${conditions.join(' AND ')}
                ${skuCondition}
            ),
            brand_totals AS (
                SELECT brand, is_competitor,
                    count() AS total_reviews,
                    round(avg(rev_rating), 2) AS avg_rating,
                    round(avg(rev_ml_rating), 2) AS avg_ml_rating,
                    countIf(rev_sentiment = 'positive') AS positive_count,
                    countIf(rev_sentiment = 'negative') AS negative_count,
                    countIf(rev_sentiment = 'neutral') AS neutral_count
                FROM scoped_reviews GROUP BY brand, is_competitor HAVING count() >= 3
            ),
            brand_listing_metrics AS (
                SELECT sr.brand, sr.is_competitor,
                    sum(coalesce(sr.rating_count, 0)) AS total_rating_count,
                    round(sum(coalesce(sr.pdp_rating, 0) * coalesce(sr.rating_count, 0)) / nullIf(sum(coalesce(sr.rating_count, 0)), 0), 2) AS avg_pdp_rating
                FROM (SELECT DISTINCT brand, is_competitor, rev_web_pid, rev_platform, pdp_rating, rating_count FROM scoped_reviews) sr
                GROUP BY sr.brand, sr.is_competitor
            ),
            category_agg AS (
                SELECT brand, is_competitor, sentiment_category,
                    count() AS cat_total, countIf(rev_sentiment = 'positive') AS cat_positive, countIf(rev_sentiment = 'negative') AS cat_negative,
                    round(avg(rev_rating), 2) AS cat_avg_rating, round(avg(rev_ml_rating), 2) AS cat_avg_ml_rating
                FROM scoped_reviews GROUP BY brand, is_competitor, sentiment_category
            ),
            category_json AS (
                SELECT brand, is_competitor, groupArray(tuple(sentiment_category, cat_total, cat_positive, cat_negative, cat_avg_rating, cat_avg_ml_rating)) AS cat_arr
                FROM category_agg GROUP BY brand, is_competitor
            )
            SELECT t.brand, t.is_competitor, t.total_reviews, t.avg_rating, t.avg_ml_rating,
                   t.positive_count, t.negative_count, t.neutral_count,
                   l.total_rating_count AS rating_count, l.avg_pdp_rating AS pdp_rating,
                   c.cat_arr AS category_scores
            FROM brand_totals t
            LEFT JOIN brand_listing_metrics l ON t.brand = l.brand AND t.is_competitor = l.is_competitor
            LEFT JOIN category_json c ON t.brand = c.brand AND t.is_competitor = c.is_competitor
            ORDER BY t.total_reviews DESC
        `;

        console.log(sql, queryParams); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rawRows = await chRes.json();
        console.log('[OLAP] rawRows[0]:', rawRows[0]);
        const rows = rawRows.map(row => {
            const category_scores = {};
            if (row.category_scores) {
                row.category_scores.forEach(cat => {
                    category_scores[cat[0]] = { total: cat[1], positive: cat[2], negative: cat[3], avg_rating: cat[4], avg_ml_rating: cat[5] };
                });
            }
            return {
                brand: row.brand || row['t.brand'], is_competitor: Number(row.is_competitor || row['t.is_competitor']) === 1 || row.is_competitor === true,
                total_reviews: Number(row.total_reviews), avg_rating: row.avg_rating, ml_rating: row.avg_ml_rating,
                positive_count: Number(row.positive_count), negative_count: Number(row.negative_count), neutral_count: Number(row.neutral_count),
                rating_count: Number(row.rating_count), pdp_rating: row.pdp_rating, category_scores,
            };
        });
        res.json({ benchmarks: rows });
    } catch (err) {
        console.error('[OLAP] getBenchmarkData error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── getCategoryHealth ──────────────────────────────────────────────────────

export const getCategoryHealth = async (req, res) => {
    try {
        const { date_from, date_to, platform, brand, period_months, price_mode, price_min, price_max, is_competitor, sentiment_category, category, rating_bifurcation, web_pid } = req.query;
        const trendPeriod = parseInt(period_months) || 3;
        
        console.log('[OLAP] getCategoryHealth invoked with query:', req.query);

        const queryParams = { companyId: String(req.companyId) };

        // Build flat WHERE conditions
        const baseWhereParts = [`company_id = {companyId:String}`];

        if (is_competitor === 'true' || is_competitor === 'false') {
            baseWhereParts.push(`coalesce(is_competitor, 0) = {isCompetitor:UInt8}`);
            queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        } else if (is_competitor !== 'all') {
            baseWhereParts.push(`coalesce(is_competitor, 0) = 0`);
        }

        if (platform && platform !== 'all') { baseWhereParts.push(`ilike(platform, {platform:String})`); queryParams.platform = platform; }
        if (brand && brand !== 'all') { baseWhereParts.push(`ilike(brand, {brand:String})`); queryParams.brand = brand; }
        if (sentiment_category && sentiment_category !== 'all') { baseWhereParts.push(`ilike(sentiment_category, {sentimentCategory:String})`); queryParams.sentimentCategory = sentiment_category; }
        if (category) { baseWhereParts.push(`ilike(product_category, {category:String})`); queryParams.category = category; }
        if (web_pid) { baseWhereParts.push(`web_pid = {webPid:String}`); queryParams.webPid = web_pid; }
        if (price_min !== undefined && price_min !== '') {
            const pe = price_mode === 'rp' ? 'price_rp' : 'price_sp';
            baseWhereParts.push(`${pe} >= {priceMin:Float64}`); queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const pe = price_mode === 'rp' ? 'price_rp' : 'price_sp';
            baseWhereParts.push(`${pe} <= {priceMax:Float64}`); queryParams.priceMax = Number(price_max);
        }
        if (rating_bifurcation === 'NP') baseWhereParts.push(`pdp_rating >= 4.2`);
        else if (rating_bifurcation === 'Issue') baseWhereParts.push(`pdp_rating < 4.0`);
        else if (rating_bifurcation === 'NI') baseWhereParts.push(`pdp_rating >= 4.0 AND pdp_rating < 4.2`);

        // Date range
        let recentDateFilter, priorDateFilter, combinedDateFilter;
        if (date_from && date_to) {
            queryParams.dateFrom = date_from; queryParams.dateTo = date_to;
            const midExpr = `(toDate({dateFrom:String}) + toUInt32((toDate({dateTo:String}) - toDate({dateFrom:String})) / 2))`;
            combinedDateFilter = `review_date >= toDate({dateFrom:String}) AND review_date <= toDate({dateTo:String})`;
            recentDateFilter = `review_date >= ${midExpr} AND review_date <= toDate({dateTo:String})`;
            priorDateFilter = `review_date >= toDate({dateFrom:String}) AND review_date < ${midExpr}`;
        } else {
            const lookbackMonths = trendPeriod * 2;
            combinedDateFilter = `review_date >= subtractMonths(today(), ${lookbackMonths})`;
            recentDateFilter = `review_date >= subtractMonths(today(), ${trendPeriod})`;
            priorDateFilter = `review_date >= subtractMonths(today(), ${lookbackMonths}) AND review_date < subtractMonths(today(), ${trendPeriod})`;
        }

        const baseWhere = baseWhereParts.join(' AND ');

        // Single clean query
        const sql = `
            SELECT
                multiIf(trim(lower(category)) IN ('other','others'), 'Others', initcap(trim(category))) AS category,
                count() AS review_count,
                count(DISTINCT web_pid) AS sku_count,
                round(avg(rating), 2) AS avg_review_rating,
                round(avg(ml_inferred_rating), 2) AS avg_ml_rating,
                countIf(sentiment = 'positive') AS positive_count,
                countIf(sentiment = 'negative') AS negative_count,
                countIf(sentiment = 'neutral') AS neutral_count,
                countIf(${recentDateFilter}) AS recent_reviews,
                countIf(${priorDateFilter}) AS prior_reviews,
                round(avgIf(rating, ${recentDateFilter}), 2) AS recent_rating,
                round(avgIf(rating, ${priorDateFilter}), 2) AS prior_rating,
                toUInt64(sum(toUInt64(coalesce(pdp_rating_count, 0)))) AS total_ratings,
                round(sum(pdp_rating * toUInt64(coalesce(pdp_rating_count, 0))) / nullIf(sum(toUInt64(coalesce(pdp_rating_count, 0))), 0), 2) AS avg_platform_rating
            FROM ${OLAP_TABLE}
            WHERE ${baseWhere}
              AND category != ''
              AND ${combinedDateFilter}
            GROUP BY category
            ORDER BY review_count DESC
            SETTINGS max_memory_usage = 2000000000;
        `;

        console.log(sql, queryParams); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const totals = { skuCount: 0, catalogueSkuCount: 0, reviewSkuCount: 0, totalRatings: 0, reviewCount: 0, paretoCount: 0, nonParetoCount: 0, npdCount: 0, totalAvgPlatformRatingNumerator: 0, totalAvgPlatformRatingDenominator: 0 };
        const categories = rows.map(r => {
            const skuCnt = Number(r.sku_count || 0);
            const revCnt = Number(r.review_count || 0);
            const totRat = Number(r.total_ratings || 0);
            totals.skuCount += skuCnt;
            totals.catalogueSkuCount += skuCnt;
            totals.reviewSkuCount += skuCnt;
            totals.totalRatings += totRat;
            totals.reviewCount += revCnt;
            totals.nonParetoCount += skuCnt;
            if (r.avg_platform_rating !== null && totRat > 0) {
                totals.totalAvgPlatformRatingNumerator += Number(r.avg_platform_rating) * totRat;
                totals.totalAvgPlatformRatingDenominator += totRat;
            }
            const recentRat = r.recent_rating !== null ? Number(r.recent_rating) : 0;
            const priorRat = r.prior_rating !== null ? Number(r.prior_rating) : 0;
            return {
                category: r.category,
                catalogueSkuCount: skuCnt,
                skuCount: skuCnt,
                reviewCount: revCnt,
                reviewSkuCount: skuCnt,
                avgReviewRating: r.avg_review_rating !== null ? Number(r.avg_review_rating) : 0,
                avgMlRating: r.avg_ml_rating !== null ? Number(r.avg_ml_rating) : null,
                positiveCount: Number(r.positive_count || 0),
                negativeCount: Number(r.negative_count || 0),
                neutralCount: Number(r.neutral_count || 0),
                totalRatings: totRat,
                avgPlatformRating: r.avg_platform_rating !== null ? Number(r.avg_platform_rating) : null,
                paretoCount: 0, nonParetoCount: skuCnt, npdCount: 0,
                growthPct: Number(r.prior_reviews) > 0 ? Math.round(((Number(r.recent_reviews) - Number(r.prior_reviews)) / Number(r.prior_reviews)) * 100) : (Number(r.recent_reviews) > 0 ? 100 : 0),
                recentReviewCount: Number(r.recent_reviews || 0),
                priorReviewCount: Number(r.prior_reviews || 0),
                ratingGrowthDiff: Math.round((recentRat - priorRat) * 100) / 100,
                recentAvgRating: recentRat,
                priorAvgRating: priorRat,
            };
        });

        totals.avgPlatformRating = totals.totalAvgPlatformRatingDenominator > 0 ? totals.totalAvgPlatformRatingNumerator / totals.totalAvgPlatformRatingDenominator : null;
        delete totals.totalAvgPlatformRatingNumerator;
        delete totals.totalAvgPlatformRatingDenominator;
        res.json({ categories, total: totals });
    } catch (err) {
        console.error('[OLAP] getCategoryHealth error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── getStarDistribution ────────────────────────────────────────────────────

export const getStarDistribution = async (req, res) => {
    try {
        const { category, platform, web_pid } = req.query;
        const queryParams = { companyId: String(req.companyId) };
        const conditions = [
            'ps.company_id = {companyId:String}',
            "ps.star_distribution != ''",
            "ps.star_distribution != '{}'"
        ];

        if (category) { conditions.push(`ilike(ps.product_category, {category:String})`); queryParams.category = category; }
        if (platform && platform !== 'all') { conditions.push(`lower(ps.platform) = lower({platform:String})`); queryParams.platform = platform; }
        if (web_pid) { conditions.push(`upper(ps.web_pid) = upper({webPid:String})`); queryParams.webPid = web_pid; }

        // Deduplicate to latest row per (web_pid, platform)
        const sql = `
            WITH latest AS (
                SELECT * FROM (
                    SELECT web_pid, platform, star_distribution, product_category AS category, brand,
                           coalesce(o.is_competitor, 0) AS is_competitor
                    FROM ${OLAP_TABLE} o
                    WHERE ${conditions.join(' AND ')}
                    ORDER BY review_date DESC
                ) LIMIT 1 BY web_pid, lower(platform)
            )
            SELECT brand, is_competitor,
                sum(coalesce(toFloat64(nullIf(JSONExtractString(star_distribution, '1'), '')), 0)) AS s1,
                sum(coalesce(toFloat64(nullIf(JSONExtractString(star_distribution, '2'), '')), 0)) AS s2,
                sum(coalesce(toFloat64(nullIf(JSONExtractString(star_distribution, '3'), '')), 0)) AS s3,
                sum(coalesce(toFloat64(nullIf(JSONExtractString(star_distribution, '4'), '')), 0)) AS s4,
                sum(coalesce(toFloat64(nullIf(JSONExtractString(star_distribution, '5'), '')), 0)) AS s5
            FROM latest
            GROUP BY brand, is_competitor
        `;

        console.log(sql, queryParams); const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const byBrand = new Map();
        for (const r of rows) {
            if (!byBrand.has(r.brand)) {
                byBrand.set(r.brand, { brand: r.brand, is_competitor: r.is_competitor === 1 || r.is_competitor === true, dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, total: 0 });
            }
            const e = byBrand.get(r.brand);
            for (const s of [1, 2, 3, 4, 5]) {
                const c = parseInt(r['s' + s], 10) || 0;
                e.dist[s] += c; e.total += c;
            }
        }

        const result = [...byBrand.values()].map(b => ({
            brand: b.brand, is_competitor: b.is_competitor, total: b.total,
            distribution: [1, 2, 3, 4, 5].map(s => ({ star: s, count: b.dist[s] || 0, pct: b.total > 0 ? Math.round(100 * (b.dist[s] || 0) / b.total) : 0 })),
        })).sort((a, b) => b.total - a.total);

        res.json({ brands: result });
    } catch (err) {
        console.error('[OLAP] getStarDistribution error:', err);
        res.status(500).json({ error: err.message });
    }
};
