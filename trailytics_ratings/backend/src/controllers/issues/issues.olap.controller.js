/**
 * Issues OLAP controller — uses rb_review_olap.
 *
 * stakeholder_mappings no longer queried from ClickHouse.
 * Instead we group directly on sentiment_subcategory + stakeholder columns
 * that are already embedded in each OLAP row.
 */

import clickhouse from '../../config/clickhouse.js';

const OLAP_TABLE = 'rb_review_olap';

const getTargetDb = (req) =>
    req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] ||
    (req.authUser && req.authUser.dbName) ||
    process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || 'prestige';

// shared filter builder
function buildFilters(req, alias = 'o') {
    const a = alias;
    const { category: filterCategory, rating_bifurcation, platform, date_from, date_to,
            period_months, price_mode, price_min, price_max, is_competitor,
            sentiment_category, web_pid, pareto_status, brand } = req.query;
    const extraFilters = [];
    const queryParams = { companyId: String(req.companyId) };

    if (web_pid) { extraFilters.push(`${a}.web_pid = {webPid:String}`); queryParams.webPid = web_pid; }
    if (is_competitor === 'true' || is_competitor === 'false') {
        extraFilters.push(`coalesce(${a}.is_competitor, 0) = {isCompetitor:UInt8}`);
        queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
    } else if (is_competitor !== 'all') {
        extraFilters.push(`coalesce(${a}.is_competitor, 0) = 0`);
    }
    if (sentiment_category && sentiment_category !== 'all') { extraFilters.push(`ilike(${a}.sentiment_category, {sentimentCategory:String})`); queryParams.sentimentCategory = sentiment_category; }
    if (platform && platform !== 'all') { extraFilters.push(`ilike(${a}.platform, {platform:String})`); queryParams.platform = platform; }
    if (brand && brand !== 'all') { extraFilters.push(`ilike(${a}.brand, {brand:String})`); queryParams.brand = brand; }
    if (date_from) { extraFilters.push(`${a}.review_date >= toDate({dateFrom:String})`); queryParams.dateFrom = date_from; }
    if (date_to) { extraFilters.push(`${a}.review_date <= toDate({dateTo:String})`); queryParams.dateTo = date_to; }
    if (!date_from && !date_to) {
        const pm = Math.max(1, Math.min(parseInt(period_months) || 6, 24));
        extraFilters.push(`${a}.review_date >= subtractMonths(today(), ${pm})`);
    }
    if (filterCategory) { extraFilters.push(`ilike(${a}.product_category, {category:String})`); queryParams.category = filterCategory; }
    if (rating_bifurcation === 'NP') extraFilters.push(`${a}.pdp_rating >= 4.2`);
    else if (rating_bifurcation === 'Issue') extraFilters.push(`${a}.pdp_rating < 4.0`);
    else if (rating_bifurcation === 'NI') extraFilters.push(`${a}.pdp_rating >= 4.0 AND ${a}.pdp_rating < 4.2`);
    if (price_min !== undefined && price_min !== '') {
        const pe = price_mode === 'rp' ? `${a}.price_rp` : `${a}.price_sp`;
        extraFilters.push(`${pe} >= {priceMin:Float64}`); queryParams.priceMin = Number(price_min);
    }
    if (price_max !== undefined && price_max !== '') {
        const pe = price_mode === 'rp' ? `${a}.price_rp` : `${a}.price_sp`;
        extraFilters.push(`${pe} <= {priceMax:Float64}`); queryParams.priceMax = Number(price_max);
    }
    return { extraFilters, queryParams };
}

const formatStakeholder = (name) => {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    if (lower === 'r&d') return 'R&D';
    if (lower === 'qc') return 'QC';
    if (lower === 'it') return 'IT';
    return lower.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

// ── getIssuesBreakdown ─────────────────────────────────────────────────────

export const getIssuesBreakdown = async (req, res) => {
    try {
        const { extraFilters, queryParams } = buildFilters(req);
        const extraWhere = extraFilters.length > 0 ? `AND ${extraFilters.join(' AND ')}` : '';

        const sql = `
            SELECT
                o.sentiment_subcategory,
                any(o.stakeholder) AS stakeholder,
                any(o.sentiment_display_label) AS display_label,
                count() AS total_count,
                countIf(o.sentiment = 'negative') AS negative_count,
                uniqExact(o.web_pid) AS sku_count,
                round(avg(o.rating), 2) AS avg_rating
            FROM ${OLAP_TABLE} o
            WHERE o.company_id = {companyId:String}
              AND isNotNull(o.sentiment_subcategory) AND o.sentiment_subcategory != ''
              AND o.sentiment_subcategory != 'General_Feedback'
              ${extraWhere}
            GROUP BY o.sentiment_subcategory
            ORDER BY negative_count DESC
        `;

        const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const issuesMap = {};
        rows.forEach(r => {
            if (r.stakeholder) {
                issuesMap[r.sentiment_subcategory] = {
                    subcategory: r.sentiment_subcategory,
                    label: r.display_label || r.sentiment_subcategory.replace(/_/g, ' '),
                    stakeholder: formatStakeholder(r.stakeholder),
                    negativeCount: parseInt(r.negative_count),
                    totalCount: parseInt(r.total_count),
                    skuCount: parseInt(r.sku_count),
                    avgRating: parseFloat(r.avg_rating)
                };
            }
        });

        const issues = Object.values(issuesMap).sort((a, b) => b.negativeCount - a.negativeCount);
        res.json({ issues, totalIssues: issues.length });
    } catch (err) {
        console.error('[OLAP] Issues breakdown error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── getIssueDetail ─────────────────────────────────────────────────────────

export const getIssueDetail = async (req, res) => {
    try {
        const { subcategory, is_competitor = 'false' } = req.query;
        if (!subcategory) return res.status(400).json({ error: 'subcategory param required' });

        let compFilter = '';
        if (is_competitor === 'true') compFilter = 'AND coalesce(is_competitor, 0) = 1';
        else if (is_competitor === 'false') compFilter = 'AND coalesce(is_competitor, 0) = 0';

        const sql = `
            SELECT web_pid, product_name,
                argMax(pdp_rating, review_date) AS pdp_rating,
                count() AS review_count,
                countIf(sentiment = 'negative') AS negative_count,
                round(avg(rating), 2) AS avg_review_rating
            FROM ${OLAP_TABLE}
            WHERE company_id = {companyId:String}
              AND sentiment_subcategory = {subcategory:String}
              ${compFilter}
            GROUP BY web_pid, product_name
            ORDER BY negative_count DESC
            LIMIT 200
        `;

        const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: { companyId: String(req.companyId), subcategory }, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const products = rows.map(r => ({
            web_pid: r.web_pid, product_name: r.product_name,
            pdp_rating: r.pdp_rating ? parseFloat(r.pdp_rating) : null,
            reviewCount: parseInt(r.review_count), negativeCount: parseInt(r.negative_count),
            avgReviewRating: parseFloat(r.avg_review_rating),
        }));
        res.json({ subcategory, products, total: products.length });
    } catch (err) {
        console.error('[OLAP] Issue detail error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── getReviewsByIssue ──────────────────────────────────────────────────────

export const getReviewsByIssue = async (req, res) => {
    try {
        const { web_pid, subcategory, limit = 50, offset = 0, sort = 'rating_asc',
                date_from, date_to, period_months, is_competitor, platform,
                category, price_mode, price_min, price_max, rating_bifurcation, sentiment_category } = req.query;
        if (!web_pid || !subcategory) return res.status(400).json({ error: 'web_pid and subcategory required' });

        let orderClause = 'ORDER BY o.review_date DESC';
        if (sort === 'rating_asc') orderClause = 'ORDER BY o.rating ASC, o.review_date DESC';
        else if (sort === 'rating_desc') orderClause = 'ORDER BY o.rating DESC, o.review_date DESC';

        const queryParams = { companyId: String(req.companyId), webPid: web_pid, subcategory, limit: parseInt(limit), offset: parseInt(offset) };
        const where = [`o.company_id = {companyId:String}`, `o.web_pid = {webPid:String}`, `o.sentiment_subcategory = {subcategory:String}`, `o.sentiment = 'negative'`];

        if (platform && platform !== 'all') { where.push(`ilike(o.platform, {platform:String})`); queryParams.platform = platform; }
        if (is_competitor && is_competitor !== 'all') { where.push(`coalesce(o.is_competitor, 0) = {isCompetitor:UInt8}`); queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0; }
        else if (!is_competitor) { where.push(`coalesce(o.is_competitor, 0) = 0`); }
        if (date_from) { where.push(`o.review_date >= toDate({dateFrom:String})`); queryParams.dateFrom = date_from; }
        if (date_to) { where.push(`o.review_date <= toDate({dateTo:String})`); queryParams.dateTo = date_to; }
        if (!date_from && !date_to) {
            const pm = Math.max(1, Math.min(parseInt(period_months, 10) || 6, 24));
            where.push(`o.review_date >= addMonths(today(), -${pm})`);
        }
        if (category) { where.push(`ilike(o.product_category, {category:String})`); queryParams.category = category; }
        if (rating_bifurcation === 'NP') where.push(`o.pdp_rating >= 4.2`);
        else if (rating_bifurcation === 'Issue') where.push(`o.pdp_rating < 4.0`);
        else if (rating_bifurcation === 'NI') where.push(`o.pdp_rating >= 4.0 AND o.pdp_rating < 4.2`);
        if (price_min !== undefined && price_min !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            where.push(`${pe} >= {priceMin:Float64}`); queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            where.push(`${pe} <= {priceMax:Float64}`); queryParams.priceMax = Number(price_max);
        }
        if (sentiment_category) { where.push(`ilike(o.sentiment_category, {sentimentCategory:String})`); queryParams.sentimentCategory = sentiment_category; }

        const whereStr = where.join(' AND ');
        const sql = `
            SELECT o.review_id AS id, o.rating, o.review_title, o.review_text, o.review_date,
                   o.reviewer_name, o.is_verified_purchase, initcap(o.sentiment) AS sentiment,
                   o.sentiment_subcategory, o.specific_issue,
                   o.ml_inferred_rating AS sentiment_score, o.quality_score,
                   o.product_name, o.pdp_rating
            FROM ${OLAP_TABLE} o
            WHERE ${whereStr}
            ${orderClause}
            LIMIT {limit:UInt32} OFFSET {offset:UInt32}
        `;
        const countSql = `SELECT count() AS count FROM ${OLAP_TABLE} o WHERE ${whereStr}`;

        const [chRes, chCount] = await Promise.all([
            clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' }),
            clickhouse.query({ database: getTargetDb(req), query: countSql, query_params: queryParams, format: 'JSONEachRow' })
        ]);
        const rows = await chRes.json();
        const countRows = await chCount.json();
        res.json({ reviews: rows, total: parseInt(countRows[0]?.count || 0), limit: parseInt(limit), offset: parseInt(offset) });
    } catch (err) {
        console.error('[OLAP] Reviews by issue error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── getAsinIssues ──────────────────────────────────────────────────────────

export const getAsinIssues = async (req, res) => {
    try {
        const { web_pid, platform, category, date_from, date_to, period_months,
                is_competitor, sentiment_category, price_mode, price_min, price_max, rating_bifurcation } = req.query;
        if (!web_pid) return res.status(400).json({ error: 'web_pid param required' });

        const queryParams = { companyId: String(req.companyId), webPid: web_pid };

        // Product info
        const productSql = `
            SELECT product_name, argMax(pdp_rating, review_date) AS pdp_rating,
                   max(pdp_rating_count) AS rating_count,
                   argMax(star_distribution, review_date) AS star_distribution
            FROM ${OLAP_TABLE}
            WHERE company_id = {companyId:String} AND web_pid = {webPid:String}
              AND coalesce(is_competitor, 0) = 0
            GROUP BY product_name
            ORDER BY count() DESC
            LIMIT 1
        `;
        const chProduct = await clickhouse.query({ database: getTargetDb(req), query: productSql, query_params: queryParams, format: 'JSONEachRow' });
        const productRows = await chProduct.json();
        const product = productRows[0] || { product_name: 'Unknown', pdp_rating: null, rating_count: 0, star_distribution: '{}' };

        const where = [`o.company_id = {companyId:String}`, `o.web_pid = {webPid:String}`];
        if (platform && platform !== 'all') { where.push(`ilike(o.platform, {platform:String})`); queryParams.platform = platform; }
        if (is_competitor && is_competitor !== 'all') { where.push(`coalesce(o.is_competitor, 0) = {isCompetitor:UInt8}`); queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0; }
        else if (!is_competitor) { where.push(`coalesce(o.is_competitor, 0) = 0`); }
        if (date_from) { where.push(`o.review_date >= toDate({dateFrom:String})`); queryParams.dateFrom = date_from; }
        if (date_to) { where.push(`o.review_date <= toDate({dateTo:String})`); queryParams.dateTo = date_to; }
        if (!date_from && !date_to) {
            const pm = Math.max(1, Math.min(parseInt(period_months, 10) || 6, 24));
            where.push(`o.review_date >= addMonths(today(), -${pm})`);
        }
        if (category) { where.push(`ilike(o.product_category, {category:String})`); queryParams.category = category; }
        if (rating_bifurcation === 'NP') where.push(`o.pdp_rating >= 4.2`);
        else if (rating_bifurcation === 'Issue') where.push(`o.pdp_rating < 4.0`);
        else if (rating_bifurcation === 'NI') where.push(`o.pdp_rating >= 4.0 AND o.pdp_rating < 4.2`);
        if (price_min !== undefined && price_min !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            where.push(`${pe} >= {priceMin:Float64}`); queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            where.push(`${pe} <= {priceMax:Float64}`); queryParams.priceMax = Number(price_max);
        }
        if (sentiment_category) { where.push(`ilike(o.sentiment_category, {sentimentCategory:String})`); queryParams.sentimentCategory = sentiment_category; }

        const whereStr = where.join(' AND ');

        const issueSql = `
            SELECT o.sentiment_subcategory,
                any(o.sentiment_display_label) AS display_label,
                any(o.stakeholder) AS stakeholder,
                count() AS total_count,
                countIf(o.sentiment = 'negative') AS negative_count,
                countIf(o.sentiment = 'positive') AS positive_count,
                round(avg(o.rating), 2) AS avg_rating,
                round(avg(o.ml_inferred_rating), 2) AS avg_ml_rating
            FROM ${OLAP_TABLE} o
            WHERE ${whereStr}
              AND isNotNull(o.sentiment_subcategory) AND o.sentiment_subcategory != ''
              AND o.sentiment_subcategory != 'General_Feedback'
            GROUP BY o.sentiment_subcategory
            ORDER BY negative_count DESC
        `;

        const reviewSumSql = `
            SELECT count() AS total,
                countIf(sentiment = 'negative') AS negative,
                countIf(sentiment = 'positive') AS positive,
                countIf(sentiment = 'neutral') AS neutral,
                round(avg(rating), 2) AS avg_rating,
                round(avg(ml_inferred_rating), 2) AS avg_ml_rating
            FROM ${OLAP_TABLE} o
            WHERE ${whereStr}
        `;

        const [chIssues, chSum] = await Promise.all([
            clickhouse.query({ database: getTargetDb(req), query: issueSql, query_params: queryParams, format: 'JSONEachRow' }),
            clickhouse.query({ database: getTargetDb(req), query: reviewSumSql, query_params: queryParams, format: 'JSONEachRow' })
        ]);
        const issueRows = await chIssues.json();
        const sumRows = await chSum.json();
        const reviewSummary = sumRows[0] || {};

        const issues = issueRows.map(r => ({
            subcategory: r.sentiment_subcategory,
            label: r.display_label || r.sentiment_subcategory.replace(/_/g, ' '),
            stakeholder: formatStakeholder(r.stakeholder) || null,
            negativeCount: parseInt(r.negative_count), positiveCount: parseInt(r.positive_count),
            totalCount: parseInt(r.total_count), avgRating: parseFloat(r.avg_rating),
            avgMlRating: parseFloat(r.avg_ml_rating || 0),
            negativeRate: parseInt(r.total_count) > 0 ? parseInt(r.negative_count) / parseInt(r.total_count) : 0
        }));

        res.json({
            product: { ...product, pdp_rating: product.pdp_rating ? parseFloat(product.pdp_rating) : null, rating_count: parseInt(product.rating_count || 0) },
            issues,
            reviewSummary: {
                total: parseInt(reviewSummary.total || 0),
                negative: parseInt(reviewSummary.negative || 0),
                positive: parseInt(reviewSummary.positive || 0),
                neutral: parseInt(reviewSummary.neutral || 0),
                avg_rating: parseFloat(reviewSummary.avg_rating || 0),
                avg_ml_rating: parseFloat(reviewSummary.avg_ml_rating || 0)
            }
        });
    } catch (err) {
        console.error('[OLAP] Asin issues error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── getIssueDrilldown / getIssueStatuses / createIssueStatus — unchanged (Postgres-based) ──
export { getIssueDrilldown, getIssueStatuses, createIssueStatus } from './issues.controller.js';
