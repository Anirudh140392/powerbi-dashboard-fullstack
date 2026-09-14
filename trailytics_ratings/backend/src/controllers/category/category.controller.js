import pool from '../../config/db.js';
import clickhouse from '../../config/clickhouse.js';

const getTargetDb = (req) => {
    return req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] || (req.authUser && req.authUser.dbName) || process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || 'prestige';
};

export const getProductCategories = async (req, res) => {
    try {
        const { platform, is_competitor } = req.query;
        let where = `company_id = {companyId:String} AND platform != '' AND category != ''`;
        let params = { companyId: String(req.companyId) };

        if (platform && platform !== 'all') {
            where += ` AND lower(platform) = {platform:String}`;
            params.platform = platform.toLowerCase();
        }
        if (is_competitor && is_competitor !== 'all') {
            where += ` AND coalesce(is_competitor, 0) = {isCompetitor:UInt8}`;
            params.isCompetitor = is_competitor === 'true' ? 1 : 0;
        }

        const rows = await clickhouse.query({
            database: getTargetDb(req),
            query: `
                SELECT
                    multiIf(trim(lower(category)) IN ('other','others'), 'Others', initcap(trim(category))) AS category,
                    count(DISTINCT product_external_id) AS count
                FROM products
                WHERE ${where}
                GROUP BY 1
                ORDER BY 2 DESC
            `,
            query_params: params,
            format: 'JSONEachRow'
        }).then(r => r.json());

        res.json({ data: rows });
    } catch (err) {
        console.error('Product categories error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getProducts = async (req, res) => {
    try {
        const {
            platform, pareto_status, category, material, is_competitor,
            limit: queryLimit, offset: queryOffset, searchQuery,
            price_mode, price_min, price_max,
        } = req.query;

        let where = ['p.company_id = {companyId:String}'];
        let params = { companyId: String(req.companyId) };

        if (platform && platform !== 'all') {
            where.push(`lower(p.platform) = {platform:String}`);
            params.platform = platform.toLowerCase();
        }
        if (pareto_status) {
            where.push(`p.pareto_status = {pareto_status:String}`);
            params.pareto_status = pareto_status;
        }
        if (category) {
            where.push(`(lower(p.category) = lower({category:String}) OR lower(p.master_category) = lower({category:String}))`);
            params.category = category;
        }
        if (material) {
            where.push(`p.material = {material:String}`);
            params.material = material;
        }
        if (is_competitor !== undefined) {
            where.push(`coalesce(p.is_competitor, 0) = {isCompetitor:UInt8}`);
            params.isCompetitor = is_competitor === 'true' ? 1 : 0;
        }
        if (searchQuery) {
            where.push(`(lower(p.product_name) LIKE lower({searchQuery:String}) OR lower(p.asin) LIKE lower({searchQuery:String}) OR lower(p.sku_code) LIKE lower({searchQuery:String}))`);
            params.searchQuery = `%${searchQuery}%`;
        }

        let priceFilter = '';
        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps_price_rp, p.mrp)' : 'coalesce(ps_price_sp, p.selling_price, p.mop, ps_price_rp, p.mrp)';
            priceFilter += ` AND ${priceExpr} >= ${Number(price_min)}`;
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps_price_rp, p.mrp)' : 'coalesce(ps_price_sp, p.selling_price, p.mop, ps_price_rp, p.mrp)';
            priceFilter += ` AND ${priceExpr} <= ${Number(price_max)}`;
        }

        const limit = queryLimit === undefined ? 100 : Math.max(0, parseInt(queryLimit, 10) || 0);
        const offset = queryOffset === undefined ? 0 : Math.max(0, parseInt(queryOffset, 10) || 0);
        params.limit = limit;
        params.offset = offset;

        const countQuery = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp AS ps_price_rp, price_sp AS ps_price_sp, rating AS ps_rating, rating_count AS ps_rating_count
                    FROM product_snapshots
                    WHERE company_id = {companyId:String}
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY lower(platform), web_pid
            )
            SELECT count() AS count
            FROM products p
            LEFT JOIN latest_snapshots ps ON ps.web_pid = p.product_external_id AND lower(ps.platform) = lower(p.platform)
            WHERE ${where.join(' AND ')} ${priceFilter}
        `;

        const countRows = await clickhouse.query({
            database: getTargetDb(req),
            query: countQuery,
            query_params: params,
            format: 'JSONEachRow'
        }).then(r => r.json());

        const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp AS ps_price_rp, price_sp AS ps_price_sp, rating AS ps_rating, rating_count AS ps_rating_count
                    FROM product_snapshots
                    WHERE company_id = {companyId:String}
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY lower(platform), web_pid
            ),
            review_aggs AS (
                SELECT web_pid, platform,
                    count() AS review_count,
                    round(avg(rating), 2) AS user_rating,
                    round(avg(ml_inferred_rating), 2) AS ml_rating
                FROM ml_reviews
                WHERE company_id = {companyId:String}
                GROUP BY web_pid, platform
            )
            SELECT 
                toString(p.id) AS id, p.product_external_id, p.product_name, p.description, p.brand_name,
                p.category_path, p.platform, p.asin,
                coalesce(ps.ps_rating, p.rating) AS rating,
                coalesce(nullIf(rv.review_count, 0), p.review_count, 0) AS review_count,
                ps.ps_rating_count AS rating_count,
                rv.user_rating,
                rv.ml_rating,
                p.pareto_status, p.material, p.wattage, toString(p.capacity) AS capacity, toString(p.litre) AS litre, p.master_category, p.category,
                p.business_segment, p.sku_code, p.mrp, p.mop, p.is_competitor,
                coalesce(ps.ps_price_rp, p.mrp) AS price_rp,
                coalesce(ps.ps_price_sp, p.selling_price, p.mop) AS price_sp
            FROM products p
            LEFT JOIN latest_snapshots ps ON ps.web_pid = p.product_external_id AND lower(ps.platform) = lower(p.platform)
            LEFT JOIN review_aggs rv ON rv.web_pid = p.product_external_id AND lower(rv.platform) = lower(p.platform)
            WHERE ${where.join(' AND ')} ${priceFilter}
            ORDER BY p.product_name, p.id
            LIMIT {limit:UInt32} OFFSET {offset:UInt32}
        `;

        const rows = await clickhouse.query({
            database: getTargetDb(req),
            query: sql,
            query_params: params,
            format: 'JSONEachRow'
        }).then(r => r.json());

        res.json({ data: rows, total: parseInt(countRows[0].count), limit, offset });
    } catch (err) {
        console.error('Products error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getCategories = async (req, res) => {
    try {
        const { is_competitor } = req.query;
        let competitorFilter = '';
        const params = { companyId: String(req.companyId) };

        if (is_competitor === 'true' || is_competitor === 'false') {
            competitorFilter = 'AND coalesce(r.is_competitor, 0) = {isCompetitor:UInt8}';
            params.isCompetitor = is_competitor === 'true' ? 1 : 0;
        }

        const categoriesPromise = clickhouse.query({
            database: getTargetDb(req),
            query: `
                WITH latest_snapshots AS (
                    SELECT * FROM (
                        SELECT web_pid, platform, category FROM product_snapshots
                        WHERE company_id = {companyId:String}
                        ORDER BY snapshot_date DESC, created_at DESC
                    ) LIMIT 1 BY lower(platform), web_pid
                )
                SELECT DISTINCT 
                    multiIf(trim(lower(coalesce(nullIf(ls.category, ''), nullIf(r.category, ''), nullIf(mp.category, '')))) IN ('other', 'others'), 'Others', initcap(trim(coalesce(nullIf(ls.category, ''), nullIf(r.category, ''), nullIf(mp.category, ''))))) AS category
                FROM ml_reviews r
                LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ls ON ls.web_pid = r.web_pid AND lower(ls.platform) = lower(r.platform)
                WHERE r.company_id = {companyId:String} ${competitorFilter}
                  AND coalesce(nullIf(ls.category, ''), nullIf(r.category, ''), nullIf(mp.category, '')) != ''
                ORDER BY category
            `,
            query_params: params,
            format: 'JSONEachRow'
        }).then(r => r.json());

        const materialsPromise = clickhouse.query({
            database: getTargetDb(req),
            query: `SELECT DISTINCT material FROM products WHERE company_id = {companyId:String} AND material != '' ORDER BY material`,
            query_params: { companyId: String(req.companyId) },
            format: 'JSONEachRow'
        }).then(r => r.json());

        const brandsPromise = clickhouse.query({
            database: getTargetDb(req),
            query: `
                WITH latest_snapshots AS (
                    SELECT * FROM (
                        SELECT web_pid, platform, brand FROM product_snapshots
                        WHERE company_id = {companyId:String}
                        ORDER BY snapshot_date DESC, created_at DESC
                    ) LIMIT 1 BY lower(platform), web_pid
                )
                SELECT DISTINCT coalesce(nullIf(mp.brand_name, ''), nullIf(ls.brand, ''), nullIf(r.brand, '')) AS brand
                FROM ml_reviews r
                LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ls ON ls.web_pid = r.web_pid AND lower(ls.platform) = lower(r.platform)
                WHERE r.company_id = {companyId:String} ${competitorFilter}
                  AND coalesce(nullIf(mp.brand_name, ''), nullIf(ls.brand, ''), nullIf(r.brand, '')) != ''
                ORDER BY brand
            `,
            query_params: params,
            format: 'JSONEachRow'
        }).then(r => r.json());

        const platformsPromise = clickhouse.query({
            database: getTargetDb(req),
            query: `SELECT DISTINCT platform FROM ml_reviews r WHERE r.company_id = {companyId:String} ${competitorFilter} AND r.platform != '' ORDER BY platform`,
            query_params: params,
            format: 'JSONEachRow'
        }).then(r => r.json());

        const paretoStatusesPromise = clickhouse.query({
            database: getTargetDb(req),
            query: `
                WITH latest_snapshots AS (
                    SELECT * FROM (
                        SELECT web_pid, platform, pareto_status FROM product_snapshots
                        WHERE company_id = {companyId:String}
                        ORDER BY snapshot_date DESC, created_at DESC
                    ) LIMIT 1 BY lower(platform), web_pid
                )
                SELECT DISTINCT coalesce(nullIf(mp.pareto_status, ''), nullIf(ls.pareto_status, '')) AS pareto_status
                FROM ml_reviews r
                LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ls ON ls.web_pid = r.web_pid AND lower(ls.platform) = lower(r.platform)
                WHERE r.company_id = {companyId:String} ${competitorFilter}
                  AND coalesce(nullIf(mp.pareto_status, ''), nullIf(ls.pareto_status, '')) != ''
                ORDER BY pareto_status
            `,
            query_params: params,
            format: 'JSONEachRow'
        }).then(r => r.json());

        const [catRows, matRows, brandRows, platRows, paretoRows] = await Promise.all([categoriesPromise, materialsPromise, brandsPromise, platformsPromise, paretoStatusesPromise]);

        res.json({
            categories: catRows.map(r => r.category),
            materials: matRows.map(r => r.material),
            brands: brandRows.map(r => r.brand),
            platforms: platRows.map(r => r.platform),
            paretoStatuses: paretoRows.map(r => r.pareto_status)
        });

    } catch (err) {
        console.error('Categories error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const createCategoryRule = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, category, include_keywords, exclude_keywords, priority, spec_type
            FROM ratings.category_rules 
            WHERE company_id = $1 ORDER BY priority ASC, id ASC
        `, [req.companyId]);
        res.json({ rules: rows });
    } catch (err) {
        console.error('Fetch category-rules error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getCategoryRules = async (req, res) => {
    try {
        const { category, include_keywords, exclude_keywords, priority } = req.body;
        const sql = `
            INSERT INTO ratings.category_rules (company_id, category, include_keywords, exclude_keywords, priority)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        const params = [req.companyId, category, include_keywords || [], exclude_keywords || [], priority || 0];
        const { rows } = await pool.query(sql, params);
        res.json({ rule: rows[0] });
    } catch (err) {
        console.error('Create category-rule error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const updateCategoryRule = async (req, res) => {
    try {
        const { id } = req.params;
        const { category, include_keywords, exclude_keywords, priority } = req.body;
        const sql = `
            UPDATE ratings.category_rules
            SET category = $1, include_keywords = $2, exclude_keywords = $3, priority = $4
            WHERE id = $5 AND company_id = $6
            RETURNING *
        `;
        const params = [category, include_keywords || [], exclude_keywords || [], priority || 0, id, req.companyId];
        const { rows } = await pool.query(sql, params);
        res.json({ rule: rows[0] });
    } catch (err) {
        console.error('Update category-rule error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const deleteCategoryRule = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`DELETE FROM ratings.category_rules WHERE id = $1 AND company_id = $2`, [id, req.companyId]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete category-rule error:', err);
        res.status(500).json({ error: err.message });
    }
};

