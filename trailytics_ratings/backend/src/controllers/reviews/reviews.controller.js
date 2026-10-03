import pool from '../../config/db.js';
import clickhouse from '../../config/clickhouse.js';

const getTargetDb = (req) => {
    return req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] || (req.authUser && req.authUser.dbName) || process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || 'prestige';
};

export const getReviews = async (req, res) => {
    try {
        const {
            platform, is_competitor, category, material, pareto_status, brand,
            date_from, date_to, web_pid, sentiment_category,
            limit: queryLimit, offset: queryOffset, price_mode, price_min, price_max, rating_bifurcation
        } = req.query;

        let where = ['r.company_id = {companyId:String}'];
        let params = { companyId: String(req.companyId) };

        if (platform && platform !== 'all') {
            where.push(`ilike(r.platform, {platform:String})`);
            params.platform = platform;
        }
        if (is_competitor && is_competitor !== 'all') {
            where.push(`r.is_competitor = {isCompetitor:UInt8}`);
            params.isCompetitor = is_competitor === 'true' ? 1 : 0;
        }
        if (category) {
            where.push(`ilike(coalesce(nullIf(ps.category, ''), nullIf(r.category, ''), nullIf(mp.category, '')), {category:String})`);
            params.category = category;
        }
        if (sentiment_category) {
            where.push(`ilike(r.sentiment_category, {sentimentCategory:String})`);
            params.sentimentCategory = sentiment_category;
        }
        const categories_in = req.query.categories_in;
        if (categories_in && !category) {
            const catList = categories_in.split(',').map(c => c.trim()).filter(Boolean);
            if (catList.length > 0) {
                where.push(`coalesce(nullIf(ps.category, ''), nullIf(r.category, ''), nullIf(mp.category, '')) IN ({categoriesIn:Array(String)})`);
                params.categoriesIn = catList;
            }
        }
        if (material) {
            where.push(`coalesce(nullIf(mp.material, ''), nullIf(r.material, '')) = {material:String}`);
            params.material = material;
        }
        if (pareto_status) {
            where.push(`coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) = {paretoStatus:String}`);
            params.paretoStatus = pareto_status;
        }
        if (brand) {
            where.push(`(r.brand = {brand:String} OR coalesce(r.is_competitor, 0) = 1)`);
            params.brand = brand;
        }
        if (date_from) {
            where.push(`r.review_date >= toDate({dateFrom:String})`);
            params.dateFrom = date_from;
        }
        if (date_to) {
            where.push(`r.review_date <= toDate({dateTo:String})`);
            params.dateTo = date_to;
        }
        if (!date_from && !date_to) {
            const pm = Math.max(1, Math.min(parseInt(req.query.period_months, 10) || 6, 24));
            where.push(`r.review_date >= addMonths(today(), -${pm})`);
        }
        if (web_pid) {
            where.push(`r.web_pid = {webPid:String}`);
            params.webPid = web_pid;
        }
        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'coalesce(ps.price_rp, mp.mrp)'
                : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            where.push(`${priceExpr} >= {priceMin:Float64}`);
            params.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'coalesce(ps.price_rp, mp.mrp)'
                : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            where.push(`${priceExpr} <= {priceMax:Float64}`);
            params.priceMax = Number(price_max);
        }
        if (rating_bifurcation) {
            if (rating_bifurcation === 'NP') { where.push(`ps.rating >= 4.2`); }
            else if (rating_bifurcation === 'Issue') { where.push(`ps.rating < 4.0`); }
            else if (rating_bifurcation === 'NI') { where.push(`ps.rating >= 4.0 AND ps.rating < 4.2`); }
        }

        const limit = queryLimit === undefined ? 100000 : Math.max(0, parseInt(queryLimit, 10) || 0);
        const offset = queryOffset === undefined ? 0 : Math.max(0, parseInt(queryOffset, 10) || 0);
        params.limit = limit;
        params.offset = offset;

        const latestSnapshotsCTE = `latest_snapshots AS (
            SELECT * FROM (
                SELECT web_pid, platform, price_rp, price_sp, rating, rating_count, category, pareto_status
                FROM product_snapshots
                WHERE company_id = {companyId:String}
                ORDER BY snapshot_date DESC, created_at DESC
            )
            LIMIT 1 BY lower(platform), web_pid
        )`;

        const sql = `
            WITH ${latestSnapshotsCTE}
            SELECT
                toString(r.id) as id, r.platform AS platform, r.web_pid AS web_pid, r.product_name AS product_name, r.brand AS brand,
                r.rating AS rating, r.ml_inferred_rating AS ml_inferred_rating, r.review_title AS review_title, r.review_text AS review_text, r.review_date AS review_date,
                r.is_verified_purchase AS is_verified_purchase, coalesce(ps.rating, r.pdp_rating) as pdp_rating, coalesce(ps.rating_count, r.pdp_rating_count) as pdp_rating_count,
                r.sentiment AS sentiment, r.sentiment_category AS sentiment_category, r.sentiment_subcategory AS sentiment_subcategory,
                r.sentiment_score AS sentiment_score, r.quality_score AS quality_score, r.specific_issue AS specific_issue,
                coalesce(nullIf(ps.category, ''), nullIf(r.category, ''), nullIf(mp.category, '')) as category,
                coalesce(nullIf(mp.material, ''), nullIf(r.material, '')) as material,
                coalesce(nullIf(mp.wattage, ''), nullIf(r.wattage, '')) as wattage,
                r.is_competitor AS is_competitor, coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) as pareto_status,
                r.sentiment AS ml_sentiment, r.specific_issue AS ml_issue, r.category AS ml_category,
                coalesce(ps.price_rp, mp.mrp) AS price_rp,
                coalesce(ps.price_sp, mp.selling_price, mp.mop) AS price_sp,
                ps.rating AS pdp_platform_rating,
                ps.rating_count AS pdp_total_rating_count
            FROM ml_reviews r
            LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
            LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND lower(ps.platform) = lower(r.platform)
            WHERE ${where.join(' AND ')}
            ORDER BY r.review_date DESC
            LIMIT {limit:UInt32} OFFSET {offset:UInt32}
        `;

        // ClickHouse imports should be added at the top if missing
        const { default: clickhouse } = await import('../../config/clickhouse.js');
        
        // Helper function for DB target
        const getTargetDb = (req) => {
            return req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] || (req.authUser && req.authUser.dbName) || process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || 'prestige';
        };

        const dbName = getTargetDb(req);
console.log('GET REVIEWS QUERY:', sql);
console.log('PARAMS:', params);

        const rows = await clickhouse.query({
            database: dbName,
            query: sql,
            query_params: params,
            format: 'JSONEachRow'
        }).then(r => r.json());

        for (let i = 500; i < rows.length; i++) {
            rows[i].review_text = "";
            rows[i].review_title = "";
            rows[i].specific_issue = "";
        }

        const countSql = `
            WITH ${latestSnapshotsCTE}
            SELECT count() as count
            FROM ml_reviews r
            LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
            LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND lower(ps.platform) = lower(r.platform)
            WHERE ${where.join(' AND ')}
        `;
        
        const countRows = await clickhouse.query({
            database: dbName,
            query: countSql,
            query_params: params,
            format: 'JSONEachRow'
        }).then(r => r.json());

        res.json({
            data: rows,
            total: parseInt(countRows[0].count),
            limit,
            offset,
        });
    } catch (err) {
        console.error('Reviews error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const searchReviews = async (req, res) => {
    try {
        const { q, platform, brand_scope, date_from, date_to, rating_min, rating_max,
                sentiment, limit = 100, offset = 0 } = req.query;
        if (!q || String(q).trim().length < 2) {
            return res.status(400).json({ error: 'Query must be at least 2 chars' });
        }
        
        let where = ['company_id = {companyId:String}'];
        let params = {
            companyId: String(req.companyId),
            term: `%${String(q).trim()}%`
        };

        where.push('(ilike(review_text, {term:String}) OR ilike(review_title, {term:String}) OR ilike(product_name, {term:String}))');

        if (platform && platform !== 'all') {
            where.push(`lower(platform) = {platform:String}`);
            params.platform = platform.toLowerCase();
        }
        if (brand_scope === 'prestige')     { where.push(`is_competitor = 0`); }
        if (brand_scope === 'competition')  { where.push(`is_competitor = 1`); }
        if (date_from)                      { where.push(`review_date >= toDate({dateFrom:String})`); params.dateFrom = date_from; }
        if (date_to)                        { where.push(`review_date <= toDate({dateTo:String})`); params.dateTo = date_to; }
        if (rating_min)                     { where.push(`rating >= {ratingMin:Float64}`); params.ratingMin = Number(rating_min); }
        if (rating_max)                     { where.push(`rating <= {ratingMax:Float64}`); params.ratingMax = Number(rating_max); }
        if (sentiment)                      { where.push(`sentiment = {sentiment:String}`); params.sentiment = sentiment; }

        const lim = Math.min(parseInt(limit, 10) || 100, 500);
        const off = Math.max(parseInt(offset, 10) || 0, 0);

        const countQuery = `SELECT COUNT(*) AS count FROM ml_reviews WHERE ${where.join(' AND ')}`;
        const searchSql = `
            SELECT toString(id) as id, web_pid, product_name, brand, platform,
                   rating, review_title, review_text, review_date,
                   sentiment, specific_issue, is_competitor
            FROM ml_reviews
            WHERE ${where.join(' AND ')}
            ORDER BY review_date DESC NULLS LAST
            LIMIT ${lim} OFFSET ${off}
        `;

        const [results, countRows] = await Promise.all([
            clickhouse.query({
                database: getTargetDb(req),
                query: searchSql,
                query_params: params,
                format: 'JSONEachRow'
            }).then(r => r.json()),
            clickhouse.query({
                database: getTargetDb(req),
                query: countQuery,
                query_params: params,
                format: 'JSONEachRow'
            }).then(r => r.json())
        ]);

        res.json({
            query: q,
            total: parseInt(countRows[0].count),
            limit: lim,
            offset: off,
            results,
        });
    } catch (err) {
        console.error('review-search error:', err);
        res.status(500).json({ error: err.message });
    }
};
