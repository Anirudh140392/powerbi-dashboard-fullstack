import pool from '../../config/db.js';

export const getProductCategories = async (req, res) => {
    try {
        const { platform, is_competitor } = req.query;
        // Count catalogue SKUs per category straight from the MASTER
        // (masters.products) — the authoritative RB-SKU catalogue — and using
        // the master's category. Previously this counted from product_snapshots
        // by the snapshot's category, which undercounted (a SKU with no snapshot
        // category was dropped) and put SKUs in different categories than the
        // Overview governance cards. Counting from the master keeps the category
        // dropdown and the Competition product chips consistent with governance:
        // one SKU, one category, the same number everywhere. Grain matches the
        // governance count — DISTINCT product_external_id (deduped across
        // platforms unless a platform filter is applied). masters.products is
        // ~21k rows, so this stays sub-second.
        const params = [req.companyId];
        let where = `mp.company_id = $1 AND mp.platform IS NOT NULL AND mp.category IS NOT NULL AND TRIM(mp.category) <> ''`;
        let idx = 2;
        if (platform && platform !== 'all') {
            where += ` AND LOWER(mp.platform) = LOWER($${idx++})`;
            params.push(platform);
        }
        if (is_competitor && is_competitor !== 'all') {
            where += ` AND COALESCE(mp.is_competitor, false) = $${idx++}`;
            params.push(is_competitor === 'true');
        }
        const { rows } = await pool.query(`
            SELECT
                CASE WHEN TRIM(LOWER(mp.category)) IN ('other','others') THEN 'Others'
                     ELSE INITCAP(TRIM(mp.category)) END AS category,
                COUNT(DISTINCT mp.product_external_id) AS count
            FROM masters.products mp
            WHERE ${where}
            GROUP BY 1
            ORDER BY 2 DESC
        `, params);
        res.json({ data: rows });
    } catch (err) {
        console.error('Product categories error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getProducts = async (req, res) => {
    try {
        const {
            platform,
            pareto_status,
            category,
            material,
            is_competitor,
            limit: queryLimit,
            offset: queryOffset,
            searchQuery,
            price_mode,
            price_min,
            price_max,
        } = req.query;

        let where = ['company_id = $1'];
        let params = [req.companyId];
        let idx = 2;

        if (platform && platform !== 'all') {
            where.push(`platform ILIKE $${idx++}`);
            params.push(platform);
        }
        if (pareto_status) {
            where.push(`pareto_status = $${idx++}`);
            params.push(pareto_status);
        }
        if (category) {
            // Filter on the resolved category (which now prefers master_category
            // over brand_category when master is specific). master_category is
            // null for ~80% of rows so filtering on it directly hides everything.
            where.push(`(category ILIKE $${idx} OR master_category ILIKE $${idx})`);
            params.push(category);
            idx++;
        }
        if (material) {
            where.push(`material = $${idx++}`);
            params.push(material);
        }
        if (is_competitor !== undefined) {
            where.push(`is_competitor = $${idx++}`);
            params.push(is_competitor === 'true');
        }
        if (searchQuery) {
            where.push(`(product_name ILIKE $${idx} OR asin ILIKE $${idx} OR sku_code ILIKE $${idx})`);
            params.push(`%${searchQuery}%`);
            idx++;
        }
        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'COALESCE(ps.price_rp, p.mrp)'
                : 'COALESCE(ps.price_sp, p.selling_price, p.mop, ps.price_rp, p.mrp)';
            where.push(`${priceExpr} >= $${idx++}`);
            params.push(Number(price_min));
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'COALESCE(ps.price_rp, p.mrp)'
                : 'COALESCE(ps.price_sp, p.selling_price, p.mop, ps.price_rp, p.mrp)';
            where.push(`${priceExpr} <= $${idx++}`);
            params.push(Number(price_max));
        }

        const limit = queryLimit === undefined ? 100 : Math.max(0, parseInt(queryLimit, 10) || 0);
        const offset = queryOffset === undefined ? 0 : Math.max(0, parseInt(queryOffset, 10) || 0);

        const countSql = `
            SELECT count(*)
            FROM masters.products p
            LEFT JOIN LATERAL (
                SELECT ps2.price_rp, ps2.price_sp, ps2.rating, ps2.rating_count
                FROM ratings.product_snapshots ps2
                WHERE ps2.company_id = p.company_id
                  AND ps2.web_pid = p.product_external_id
                  AND (LOWER(ps2.platform) = LOWER(p.platform) OR p.platform IS NULL)
                ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
                LIMIT 1
            ) ps ON true
            WHERE ${where.map(clause => clause.replace(/(^|[\s(])company_id\b/g, '$1p.company_id')).join(' AND ')}
        `;
        const { rows: countRows } = await pool.query(countSql, params);

        const sql = `
            SELECT 
                p.id, p.product_external_id, p.product_name, p.description, p.brand_name,
                p.category_path, p.platform, p.asin,
                COALESCE(ps.rating, p.rating) AS rating,
                COALESCE(NULLIF(rv.review_count, 0), p.review_count, 0) AS review_count,
                ps.rating_count,
                rv.user_rating,
                rv.ml_rating,
                p.pareto_status, p.material, p.wattage, p.capacity, p.litre, p.master_category, p.category,
                p.business_segment, p.sku_code, p.mrp, p.mop, p.is_competitor,
                COALESCE(ps.price_rp, p.mrp) AS price_rp,
                COALESCE(ps.price_sp, p.selling_price, p.mop) AS price_sp
            FROM masters.products p
            LEFT JOIN LATERAL (
                SELECT ps2.price_rp, ps2.price_sp, ps2.rating, ps2.rating_count
                FROM ratings.product_snapshots ps2
                WHERE ps2.company_id = p.company_id
                  AND ps2.web_pid = p.product_external_id
                  AND (LOWER(ps2.platform) = LOWER(p.platform) OR p.platform IS NULL)
                ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
                LIMIT 1
            ) ps ON true
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*) AS review_count,
                    ROUND(AVG(rv.rating)::numeric, 2) AS user_rating,
                    ROUND(AVG(rv.ml_inferred_rating)::numeric, 2) AS ml_rating
                FROM ratings.reviews rv
                WHERE rv.company_id = p.company_id
                  AND rv.web_pid = p.product_external_id
                  AND (LOWER(rv.platform) = LOWER(p.platform) OR p.platform IS NULL)
                  AND rv.is_competitor = COALESCE(p.is_competitor, false)
            ) rv ON true
            WHERE ${where.map(clause => clause.replace(/(^|[\s(])company_id\b/g, '$1p.company_id')).join(' AND ')}
            ORDER BY p.product_name, p.id
            LIMIT $${idx++} OFFSET $${idx++}
        `;
        params.push(limit, offset);
        const { rows } = await pool.query(sql, params);

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
        const params = [req.companyId];

        if (is_competitor !== undefined) {
            competitorFilter = 'AND r.is_competitor = $2';
            params.push(is_competitor === 'true');
        }

        const [categories, materials, brands, platforms, paretoStatuses] = await Promise.all([
            pool.query(`
                WITH latest_snapshots AS (
                    SELECT DISTINCT ON (ps.company_id, LOWER(ps.platform), ps.web_pid)
                        ps.company_id,
                        ps.platform,
                        ps.web_pid,
                        ps.category,
                        ps.brand
                    FROM ratings.product_snapshots ps
                    WHERE ps.company_id = $1
                    ORDER BY ps.company_id, LOWER(ps.platform), ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
                )
                SELECT DISTINCT 
                    CASE 
                        WHEN TRIM(LOWER(COALESCE(NULLIF(ls.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')))) IN ('other', 'others') THEN 'Others'
                        ELSE INITCAP(TRIM(COALESCE(NULLIF(ls.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))))
                    END AS category
                FROM ratings.reviews r
                LEFT JOIN masters.products mp
                    ON mp.company_id = r.company_id
                   AND mp.product_external_id = r.web_pid
                   AND LOWER(mp.platform) = LOWER(r.platform)
                LEFT JOIN latest_snapshots ls
                    ON ls.company_id = r.company_id
                   AND ls.web_pid = r.web_pid
                   AND LOWER(ls.platform) = LOWER(r.platform)
                WHERE r.company_id = $1 ${competitorFilter}
                  AND COALESCE(NULLIF(ls.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) IS NOT NULL
                ORDER BY category
            `, params),
            pool.query(`
                SELECT DISTINCT material
                FROM masters.products
                WHERE company_id = $1
                  AND material IS NOT NULL
                  AND material <> ''
                ORDER BY material
            `, [req.companyId]),
            pool.query(`
                WITH latest_snapshots AS (
                    SELECT DISTINCT ON (ps.company_id, LOWER(ps.platform), ps.web_pid)
                        ps.company_id,
                        ps.platform,
                        ps.web_pid,
                        ps.brand
                    FROM ratings.product_snapshots ps
                    WHERE ps.company_id = $1
                    ORDER BY ps.company_id, LOWER(ps.platform), ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
                )
                SELECT DISTINCT COALESCE(NULLIF(mp.brand_name, ''), NULLIF(ls.brand, ''), NULLIF(r.brand, '')) AS brand
                FROM ratings.reviews r
                LEFT JOIN masters.products mp
                    ON mp.company_id = r.company_id
                   AND mp.product_external_id = r.web_pid
                   AND LOWER(mp.platform) = LOWER(r.platform)
                LEFT JOIN latest_snapshots ls
                    ON ls.company_id = r.company_id
                   AND ls.web_pid = r.web_pid
                   AND LOWER(ls.platform) = LOWER(r.platform)
                WHERE r.company_id = $1 ${competitorFilter}
                  AND COALESCE(NULLIF(mp.brand_name, ''), NULLIF(ls.brand, ''), NULLIF(r.brand, '')) IS NOT NULL
                ORDER BY brand
            `, params),
            // Skip-scan instead of DISTINCT over 4.2M rows (see platform-options).
            pool.query(`
                WITH RECURSIVE p AS (
                    (SELECT r.platform FROM ratings.reviews r WHERE r.company_id = $1 ${competitorFilter} AND r.platform IS NOT NULL ORDER BY r.platform LIMIT 1)
                    UNION ALL
                    SELECT (SELECT r.platform FROM ratings.reviews r WHERE r.company_id = $1 ${competitorFilter} AND r.platform IS NOT NULL AND r.platform > p.platform ORDER BY r.platform LIMIT 1)
                    FROM p WHERE p.platform IS NOT NULL
                )
                SELECT platform FROM p WHERE platform IS NOT NULL ORDER BY platform`, params),
            pool.query(`
                SELECT DISTINCT pareto_status
                FROM masters.products
                WHERE company_id = $1
                  AND pareto_status IS NOT NULL
                  AND pareto_status <> ''
                ORDER BY pareto_status
            `, [req.companyId]),
        ]);

        res.json({
            categories: categories.rows.map(r => r.category),
            materials: materials.rows.map(r => r.material),
            brands: brands.rows.map(r => r.brand),
            platforms: platforms.rows.map(r => r.platform),
            paretoStatuses: paretoStatuses.rows.map(r => r.pareto_status),
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

