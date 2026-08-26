/**
 * Category OLAP controller — uses rb_review_olap.
 *
 * getProductCategories  → from OLAP table (no products table)
 * getProducts           → from OLAP table (deduplicated per web_pid+platform)
 * getCategories         → from OLAP table (categories, brands, platforms)
 * CRUD rules (createCategoryRule etc.) → still Postgres, re-exported unchanged.
 */

import clickhouse from '../../config/clickhouse.js';

const OLAP_TABLE = 'rb_review_olap';

const getTargetDb = (req) =>
    req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] ||
    (req.authUser && req.authUser.dbName) ||
    process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || 'prestige';

// ── getProductCategories ───────────────────────────────────────────────────

export const getProductCategories = async (req, res) => {
    try {
        const { platform, is_competitor } = req.query;
        let where = `company_id = {companyId:String} AND category != ''`;
        let params = { companyId: String(req.companyId) };

        if (platform && platform !== 'all') { where += ` AND lower(platform) = {platform:String}`; params.platform = platform.toLowerCase(); }
        if (is_competitor && is_competitor !== 'all') { where += ` AND coalesce(is_competitor, 0) = {isCompetitor:UInt8}`; params.isCompetitor = is_competitor === 'true' ? 1 : 0; }

        const rows = await clickhouse.query({
            database: getTargetDb(req),
            query: `
                SELECT
                    multiIf(trim(lower(category)) IN ('other','others'), 'Others', initcap(trim(category))) AS category,
                    count(DISTINCT web_pid) AS count
                FROM ${OLAP_TABLE}
                WHERE ${where}
                GROUP BY 1 ORDER BY 2 DESC
            `,
            query_params: params, format: 'JSONEachRow'
        }).then(r => r.json());

        res.json({ data: rows });
    } catch (err) {
        console.error('[OLAP] Product categories error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── getProducts ────────────────────────────────────────────────────────────

export const getProducts = async (req, res) => {
    try {
        const { platform, category, is_competitor, limit: queryLimit, offset: queryOffset, searchQuery, price_mode, price_min, price_max, brand } = req.query;

        let where = ['p.company_id = {companyId:String}'];
        let params = { companyId: String(req.companyId) };

        if (platform && platform !== 'all') { where.push(`lower(p.platform) = {platform:String}`); params.platform = platform.toLowerCase(); }
        if (category) { where.push(`(ilike(p.category, {category:String}) OR ilike(p.product_subcategory, {category:String}))`); params.category = category; }
        if (brand && brand !== 'all') { where.push(`ilike(p.brand, {brand:String})`); params.brand = brand; }
        if (is_competitor !== undefined) { where.push(`coalesce(p.is_competitor, 0) = {isCompetitor:UInt8}`); params.isCompetitor = is_competitor === 'true' ? 1 : 0; }
        if (searchQuery) { where.push(`(ilike(p.product_name, {searchQuery:String}) OR ilike(p.web_pid, {searchQuery:String}) OR ilike(p.product_sku_code, {searchQuery:String}))`); params.searchQuery = `%${searchQuery}%`; }

        let priceFilter = '';
        if (price_min !== undefined && price_min !== '') {
            const pe = price_mode === 'rp' ? 'p.price_rp' : 'p.price_sp';
            priceFilter += ` AND ${pe} >= ${Number(price_min)}`;
        }
        if (price_max !== undefined && price_max !== '') {
            const pe = price_mode === 'rp' ? 'p.price_rp' : 'p.price_sp';
            priceFilter += ` AND ${pe} <= ${Number(price_max)}`;
        }

        const limit = queryLimit === undefined ? 100 : Math.max(0, parseInt(queryLimit, 10) || 0);
        const offset = queryOffset === undefined ? 0 : Math.max(0, parseInt(queryOffset, 10) || 0);
        params.limit = limit;
        params.offset = offset;

        const db = getTargetDb(req);

        // Deduplicate to one row per (web_pid, platform) using latest review date
        const countSql = `
            WITH deduped AS (
                SELECT web_pid, platform,
                    argMax(product_name, review_date) AS product_name, argMax(brand, review_date) AS brand,
                    argMax(category, review_date) AS category, argMax(is_competitor, review_date) AS is_competitor,
                    argMax(pdp_rating, review_date) AS rating, max(pdp_rating_count) AS rating_count,
                    argMax(price_rp, review_date) AS price_rp, argMax(price_sp, review_date) AS price_sp,
                    argMax(product_sku_code, review_date) AS sku_code, argMax(product_is_active, review_date) AS is_active,
                    count() AS review_count, round(avg(rating), 2) AS user_rating, round(avg(ml_inferred_rating), 2) AS ml_rating
                FROM ${OLAP_TABLE} p
                WHERE ${where.join(' AND ')}
                GROUP BY web_pid, platform
            )
            SELECT count() AS count FROM deduped WHERE 1=1 ${priceFilter}
        `;
        const sql = `
            WITH deduped AS (
                SELECT web_pid, platform,
                    argMax(product_name, review_date) AS product_name, argMax(brand, review_date) AS brand,
                    argMax(category, review_date) AS category, argMax(product_subcategory, review_date) AS product_subcategory,
                    argMax(is_competitor, review_date) AS is_competitor,
                    argMax(pdp_rating, review_date) AS rating, max(pdp_rating_count) AS rating_count,
                    argMax(price_rp, review_date) AS price_rp, argMax(price_sp, review_date) AS price_sp,
                    argMax(product_sku_code, review_date) AS sku_code, argMax(product_is_active, review_date) AS is_active,
                    argMax(product_image_url, review_date) AS product_image_url,
                    count() AS review_count, round(avg(rating), 2) AS user_rating, round(avg(ml_inferred_rating), 2) AS ml_rating
                FROM ${OLAP_TABLE} p
                WHERE ${where.join(' AND ')}
                GROUP BY web_pid, platform
            )
            SELECT
                web_pid AS product_external_id, web_pid, product_name, brand AS brand_name,
                platform, rating, rating_count, review_count, user_rating, ml_rating,
                category, product_subcategory, is_competitor,
                '' AS pareto_status, '' AS material,
                sku_code, price_rp AS mrp, price_sp, price_rp, product_image_url
            FROM deduped
            WHERE 1=1 ${priceFilter}
            ORDER BY product_name, web_pid
            LIMIT {limit:UInt32} OFFSET {offset:UInt32}
        `;

        const [rows, countRows] = await Promise.all([
            clickhouse.query({ database: db, query: sql, query_params: params, format: 'JSONEachRow' }).then(r => r.json()),
            clickhouse.query({ database: db, query: countSql, query_params: params, format: 'JSONEachRow' }).then(r => r.json())
        ]);

        res.json({ data: rows, total: parseInt(countRows[0].count), limit, offset });
    } catch (err) {
        console.error('[OLAP] Products error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── getCategories ──────────────────────────────────────────────────────────

export const getCategories = async (req, res) => {
    try {
        const { is_competitor } = req.query;
        let competitorFilter = '';
        const params = { companyId: String(req.companyId) };
        if (is_competitor === 'true' || is_competitor === 'false') {
            competitorFilter = 'AND coalesce(is_competitor, 0) = {isCompetitor:UInt8}';
            params.isCompetitor = is_competitor === 'true' ? 1 : 0;
        }

        const db = getTargetDb(req);
        const base = `FROM ${OLAP_TABLE} WHERE company_id = {companyId:String} ${competitorFilter}`;

        const [catRows, brandRows, platRows] = await Promise.all([
            clickhouse.query({ database: db, query: `SELECT DISTINCT multiIf(trim(lower(category)) IN ('other','others'), 'Others', initcap(trim(category))) AS category ${base} AND category != '' ORDER BY category`, query_params: params, format: 'JSONEachRow' }).then(r => r.json()),
            clickhouse.query({ database: db, query: `SELECT DISTINCT brand ${base} AND brand != '' ORDER BY brand`, query_params: params, format: 'JSONEachRow' }).then(r => r.json()),
            clickhouse.query({ database: db, query: `SELECT DISTINCT platform ${base} AND platform != '' ORDER BY platform`, query_params: params, format: 'JSONEachRow' }).then(r => r.json()),
        ]);

        res.json({
            categories: catRows.map(r => r.category),
            materials: [],
            brands: brandRows.map(r => r.brand),
            platforms: platRows.map(r => r.platform),
            paretoStatuses: []  // no pareto_status in OLAP v1
        });
    } catch (err) {
        console.error('[OLAP] Categories error:', err);
        res.status(500).json({ error: err.message });
    }
};

// CRUD stays on Postgres — re-export unchanged
export { createCategoryRule, getCategoryRules, updateCategoryRule, deleteCategoryRule } from './category.controller.js';
