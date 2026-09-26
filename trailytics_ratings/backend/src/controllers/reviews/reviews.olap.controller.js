/**
 * Reviews OLAP controller — uses rb_review_olap.
 * Replaces multi-table joins (ml_reviews + products + product_snapshots) with
 * a single flat table query.
 */

import clickhouse from '../../config/clickhouse.js';
import { getOlapTableName } from '../../utils/olapResolver.js';

const getTargetDb = (req) =>
    req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] ||
    (req.authUser && req.authUser.dbName) ||
    process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || 'prestige';

const getOlapTable = (req) => getOlapTableName(getTargetDb(req));

// ── getReviews ─────────────────────────────────────────────────────────────

export const getReviews = async (req, res) => {
    try {
        const { platform, is_competitor, category, pareto_status, brand,
                date_from, date_to, web_pid, sentiment_category,
                limit: queryLimit, offset: queryOffset, price_mode, price_min, price_max,
                rating_bifurcation } = req.query;

        let where = ['o.company_id = {companyId:String}'];
        let params = { companyId: String(req.companyId) };

        if (platform && platform !== 'all') { where.push(`ilike(o.platform, {platform:String})`); params.platform = platform; }
        if (is_competitor && is_competitor !== 'all') { where.push(`o.is_competitor = {isCompetitor:UInt8}`); params.isCompetitor = is_competitor === 'true' ? 1 : 0; }
        if (category) { where.push(`ilike(o.product_category, {category:String})`); params.category = category; }
        if (sentiment_category) { where.push(`ilike(o.sentiment_category, {sentimentCategory:String})`); params.sentimentCategory = sentiment_category; }
        const categories_in = req.query.categories_in;
        if (categories_in && !category) {
            const catList = categories_in.split(',').map(c => c.trim()).filter(Boolean);
            if (catList.length > 0) { where.push(`o.product_category IN ({categoriesIn:Array(String)})`); params.categoriesIn = catList; }
        }
        if (brand && brand !== 'all') { where.push(`ilike(o.brand, {brand:String})`); params.brand = brand; }
        if (date_from) { where.push(`o.review_date >= toDate({dateFrom:String})`); params.dateFrom = date_from; }
        if (date_to) { where.push(`o.review_date <= toDate({dateTo:String})`); params.dateTo = date_to; }
        if (!date_from && !date_to) {
            const pm = Math.max(1, Math.min(parseInt(req.query.period_months, 10) || 6, 24));
            where.push(`o.review_date >= addMonths(today(), -${pm})`);
        }
        if (web_pid) { where.push(`o.web_pid = {webPid:String}`); params.webPid = web_pid; }
        if (price_min !== undefined && price_min !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            where.push(`${pe} >= {priceMin:Float64}`); params.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            where.push(`${pe} <= {priceMax:Float64}`); params.priceMax = Number(price_max);
        }
        if (rating_bifurcation === 'NP') where.push(`o.pdp_rating >= 4.2`);
        else if (rating_bifurcation === 'Issue') where.push(`o.pdp_rating < 4.0`);
        else if (rating_bifurcation === 'NI') where.push(`o.pdp_rating >= 4.0 AND o.pdp_rating < 4.2`);

        const limit = queryLimit === undefined ? 100000 : Math.max(0, parseInt(queryLimit, 10) || 0);
        const offset = queryOffset === undefined ? 0 : Math.max(0, parseInt(queryOffset, 10) || 0);
        params.limit = limit;
        params.offset = offset;

        const whereStr = where.join(' AND ');

        const sql = `
            SELECT
                toString(o.review_id) AS id, o.platform, o.web_pid, o.product_name, o.brand,
                o.rating, o.ml_inferred_rating, o.review_title, o.review_text, o.review_date,
                o.is_verified_purchase, o.pdp_rating, o.pdp_rating_count,
                initcap(o.sentiment) AS sentiment, o.sentiment_category, o.sentiment_subcategory,
                o.sentiment_score, o.quality_score, o.specific_issue,
                o.product_category AS category,
                o.is_competitor, '' AS pareto_status,
                initcap(o.sentiment) AS ml_sentiment, o.specific_issue AS ml_issue,
                o.product_category AS ml_category,
                o.price_rp, o.price_sp,
                o.pdp_rating AS pdp_platform_rating,
                o.pdp_rating_count AS pdp_total_rating_count
            FROM ${getOlapTable(req)} o
            WHERE ${whereStr}
            ORDER BY o.review_date DESC
            LIMIT {limit:UInt32} OFFSET {offset:UInt32}
        `;
        const countSql = `SELECT count() AS count FROM ${getOlapTable(req)} o WHERE ${whereStr}`;

        const db = getTargetDb(req);
        const [rowsRes, countRes] = await Promise.all([
            clickhouse.query({ database: db, query: sql, query_params: params, format: 'JSONEachRow' }).then(r => r.json()),
            clickhouse.query({ database: db, query: countSql, query_params: params, format: 'JSONEachRow' }).then(r => r.json())
        ]);

        for (let i = 500; i < rowsRes.length; i++) { rowsRes[i].review_text = ''; rowsRes[i].review_title = ''; rowsRes[i].specific_issue = ''; }

        res.json({ data: rowsRes, total: parseInt(countRes[0].count), limit, offset });
    } catch (err) {
        console.error('[OLAP] Reviews error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── searchReviews ──────────────────────────────────────────────────────────

export const searchReviews = async (req, res) => {
    try {
        const { q, platform, brand_scope, date_from, date_to, rating_min, rating_max, sentiment, limit = 100, offset = 0 } = req.query;
        if (!q || String(q).trim().length < 2) return res.status(400).json({ error: 'Query must be at least 2 chars' });

        let where = ['company_id = {companyId:String}'];
        let params = { companyId: String(req.companyId), term: `%${String(q).trim()}%` };
        where.push('(ilike(review_text, {term:String}) OR ilike(review_title, {term:String}) OR ilike(product_name, {term:String}))');
        if (platform && platform !== 'all') { where.push(`lower(platform) = {platform:String}`); params.platform = platform.toLowerCase(); }
        if (brand_scope === 'own') where.push(`is_competitor = 0`);
        if (brand_scope === 'competition') where.push(`is_competitor = 1`);
        if (date_from) { where.push(`review_date >= toDate({dateFrom:String})`); params.dateFrom = date_from; }
        if (date_to) { where.push(`review_date <= toDate({dateTo:String})`); params.dateTo = date_to; }
        if (rating_min) { where.push(`rating >= {ratingMin:Float64}`); params.ratingMin = Number(rating_min); }
        if (rating_max) { where.push(`rating <= {ratingMax:Float64}`); params.ratingMax = Number(rating_max); }
        if (sentiment) { where.push(`sentiment = {sentiment:String}`); params.sentiment = sentiment; }

        const lim = Math.min(parseInt(limit, 10) || 100, 500);
        const off = Math.max(parseInt(offset, 10) || 0, 0);
        const whereStr = where.join(' AND ');
        const db = getTargetDb(req);

        const [results, countRows] = await Promise.all([
            clickhouse.query({ database: db, query: `SELECT toString(review_id) AS id, web_pid, product_name, brand, platform, rating, review_title, review_text, review_date, initcap(sentiment) AS sentiment, specific_issue, is_competitor FROM ${getOlapTable(req)} WHERE ${whereStr} ORDER BY review_date DESC LIMIT ${lim} OFFSET ${off}`, query_params: params, format: 'JSONEachRow' }).then(r => r.json()),
            clickhouse.query({ database: db, query: `SELECT COUNT(*) AS count FROM ${getOlapTable(req)} WHERE ${whereStr}`, query_params: params, format: 'JSONEachRow' }).then(r => r.json())
        ]);

        res.json({ query: q, total: parseInt(countRows[0].count), limit: lim, offset: off, results });
    } catch (err) {
        console.error('[OLAP] review-search error:', err);
        res.status(500).json({ error: err.message });
    }
};
