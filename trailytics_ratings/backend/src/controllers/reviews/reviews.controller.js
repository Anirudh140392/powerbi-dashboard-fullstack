import pool from '../../config/db.js';

export const getReviews = async (req, res) => {
    try {
        const {
            platform,           // 'amazon', 'flipkart', 'all'
            is_competitor,      // 'true', 'false', 'all'
            category,           // category name
            material,           // material type
            pareto_status,      // 'Pareto', 'Non-Pareto', etc.
            brand,              // brand name
            date_from,          // YYYY-MM-DD
            date_to,            // YYYY-MM-DD
            web_pid,            // specific product ASIN/FSN
            sentiment_category, // sentiment category (Quality, Performance, etc.)
            limit: queryLimit,
            offset: queryOffset,
            price_mode,
            price_min,
            price_max,
        } = req.query;

        let where = ['r.company_id = $1'];
        let params = [req.companyId];
        let idx = 2;

        if (platform && platform !== 'all') {
            where.push(`r.platform ILIKE $${idx++}`);
            params.push(platform);
        }
        if (is_competitor && is_competitor !== 'all') {
            where.push(`r.is_competitor = $${idx++}`);
            params.push(is_competitor === 'true');
        }
        if (category) {
            where.push(`COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE $${idx++}`);
            params.push(category);
        }
        if (sentiment_category) {
            where.push(`r.sentiment_category ILIKE $${idx++}`);
            params.push(sentiment_category);
        }
        // categories_in: comma-separated list of categories (used for competitor roll-up)
        const categories_in = req.query.categories_in;
        if (categories_in && !category) {
            const catList = categories_in.split(',').map(c => c.trim()).filter(Boolean);
            if (catList.length > 0) {
                const placeholders = catList.map((_, i) => `$${idx + i}`).join(', ');
            where.push(`COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) IN (${placeholders})`);
                params.push(...catList);
                idx += catList.length;
            }
        }
        if (material) {
            where.push(`COALESCE(NULLIF(mp.material, ''), NULLIF(r.material, '')) = $${idx++}`);
            params.push(material);
        }
        if (pareto_status) {
            where.push(`COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, ''), NULLIF(r.pareto_status, '')) = $${idx++}`);
            params.push(pareto_status);
        }
        if (brand) {
            where.push(`r.brand = $${idx++}`);
            params.push(brand);
        }
        if (date_from) {
            where.push(`r.review_date >= $${idx++}`);
            params.push(date_from);
        }
        if (date_to) {
            where.push(`r.review_date <= $${idx++}`);
            params.push(date_to);
        }
        // Default the on-mount load to a 6-month window (clamped 1-24 via
        // period_months) when no explicit range is chosen. Previously this
        // endpoint pulled ALL-TIME reviews to the browser — the single heaviest
        // uncached query (full scan + per-row snapshot LATERAL + 30-50MB payload).
        // The date filter still widens it. pm is a clamped int -> safe to inline.
        if (!date_from && !date_to) {
            const pm = Math.max(1, Math.min(parseInt(req.query.period_months, 10) || 6, 24));
            where.push(`r.review_date >= (CURRENT_DATE - INTERVAL '${pm} months')`);
        }
        if (web_pid) {
            where.push(`r.web_pid = $${idx++}`);
            params.push(web_pid);
        }
        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'COALESCE(ps.price_rp, mp.mrp)'
                : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            where.push(`${priceExpr} >= $${idx++}`);
            params.push(Number(price_min));
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'COALESCE(ps.price_rp, mp.mrp)'
                : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            where.push(`${priceExpr} <= $${idx++}`);
            params.push(Number(price_max));
        }

        const limit = queryLimit === undefined ? 100000 : Math.max(0, parseInt(queryLimit, 10) || 0);
        const offset = queryOffset === undefined ? 0 : Math.max(0, parseInt(queryOffset, 10) || 0);

        const paginationClause = queryLimit === undefined
            ? ''
            : ` LIMIT ${limit} OFFSET ${offset}`;

        // Each SKU's latest snapshot computed ONCE (was a per-review correlated
        // LATERAL — the dominant cost over a large 6-month window). Same selection
        // as the old LATERAL (latest snapshot_date, then created_at); a SKU with no
        // snapshot simply has no row, so the LEFT JOIN yields the same NULLs.
        const latestSnapshotsCTE = `latest_snapshots AS (
                SELECT DISTINCT ON (web_pid, LOWER(platform))
                    web_pid, platform, price_rp, price_sp, rating, rating_count, category, pareto_status
                FROM ratings.product_snapshots
                WHERE company_id = $1
                ORDER BY web_pid, LOWER(platform), snapshot_date DESC, created_at DESC NULLS LAST
            )`;
        const sql = `
            WITH ${latestSnapshotsCTE}
            SELECT
                r.id, r.platform, r.web_pid, r.product_name, r.brand,
                r.rating, r.ml_inferred_rating, r.review_title, r.review_text, r.review_date,
                r.is_verified_purchase, COALESCE(ps.rating, r.pdp_rating) as pdp_rating, COALESCE(ps.rating_count, r.pdp_rating_count) as pdp_rating_count,
                r.sentiment, r.sentiment_category, r.sentiment_subcategory,
                r.sentiment_score, r.quality_score, r.specific_issue,
                COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) as category,
                COALESCE(mp.material, r.material) as material,
                COALESCE(mp.wattage, r.wattage) as wattage,
                r.is_competitor, COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, ''), NULLIF(r.pareto_status, '')) as pareto_status,
                mua.id as ml_audit_id, mua.ml_sentiment, mua.ml_issue, mua.ml_category,
                COALESCE(ps.price_rp, mp.mrp) AS price_rp,
                COALESCE(ps.price_sp, mp.selling_price, mp.mop) AS price_sp,
                ps.rating AS pdp_platform_rating,
                ps.rating_count AS pdp_total_rating_count
            FROM ratings.reviews r
            LEFT JOIN ratings.reviews_ml_audit mua ON mua.review_id = r.id AND mua.company_id = r.company_id
            LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
            LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND LOWER(ps.platform) = LOWER(r.platform)
            WHERE ${where.join(' AND ')}
            ORDER BY r.review_date DESC NULLS LAST
            ${paginationClause}
        `;


        const { rows } = await pool.query(sql, params);

        // OPTIMIZATION: To allow unlimited data fetching without crashing the browser or Vercel payload limits,
        // we strip the heavy text fields from all rows except the 500 most recent ones.
        // The charts/graphs only use numeric & categorical data, so they will calculate perfectly accurately
        // without downloading 40MB of text.
        for (let i = 500; i < rows.length; i++) {
            rows[i].review_text = "";
            rows[i].review_title = "";
            rows[i].specific_issue = "";
        }

        // Also get total count for pagination
        const countSql = `
            WITH ${latestSnapshotsCTE}
            SELECT count(*)
            FROM ratings.reviews r
            LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
            LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND LOWER(ps.platform) = LOWER(r.platform)
            WHERE ${where.join(' AND ')}
        `;
        const { rows: countRows } = await pool.query(countSql, params);

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

// ============================================================================
// GET /api/ratings/product-categories — Distinct product categories with counts
// ============================================================================

export const searchReviews = async (req, res) => {
    try {
        const { q, platform, brand_scope, date_from, date_to, rating_min, rating_max,
                sentiment, limit = 100, offset = 0 } = req.query;
        if (!q || String(q).trim().length < 2) {
            return res.status(400).json({ error: 'Query must be at least 2 chars' });
        }
        const term = `%${String(q).trim()}%`;
        const where = ['r.company_id = $1'];
        const params = [req.companyId, term, term, term];
        where.push('(r.review_text ILIKE $2 OR r.review_title ILIKE $3 OR r.product_name ILIKE $4)');
        let idx = 5;
        if (platform && platform !== 'all') { where.push(`LOWER(r.platform) = LOWER($${idx++})`); params.push(platform); }
        if (brand_scope === 'prestige')     { where.push(`r.is_competitor = false`); }
        if (brand_scope === 'competition')  { where.push(`r.is_competitor = true`);  }
        if (date_from)                      { where.push(`r.review_date >= $${idx++}`); params.push(date_from); }
        if (date_to)                        { where.push(`r.review_date <= $${idx++}`); params.push(date_to); }
        if (rating_min)                     { where.push(`r.rating >= $${idx++}`);      params.push(rating_min); }
        if (rating_max)                     { where.push(`r.rating <= $${idx++}`);      params.push(rating_max); }
        if (sentiment)                      { where.push(`r.sentiment = $${idx++}`);    params.push(sentiment); }

        const lim = Math.min(parseInt(limit, 10) || 100, 500);
        const off = Math.max(parseInt(offset, 10) || 0, 0);

        const [results, total] = await Promise.all([
            pool.query(`
                SELECT r.id, r.web_pid, r.product_name, r.brand, r.platform,
                       r.rating, r.review_title, r.review_text, r.review_date,
                       r.sentiment, r.specific_issue, r.is_competitor
                  FROM ratings.reviews r
                 WHERE ${where.join(' AND ')}
                 ORDER BY r.review_date DESC NULLS LAST
                 LIMIT ${lim} OFFSET ${off}
            `, params),
            pool.query(`SELECT COUNT(*)::int AS n FROM ratings.reviews r WHERE ${where.join(' AND ')}`, params),
        ]);

        res.json({
            query: q,
            total: total.rows[0].n,
            limit: lim,
            offset: off,
            results: results.rows,
        });
    } catch (err) {
        console.error('review-search error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// 2) Theme drill-down — clicking on a Categories card jumps here.
//    Returns: top affected SKUs, brand breakdown, trend, suggested team.
// ============================================================================

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

// ============================================================================
// GET /api/ratings/products — Product catalog with classification
// ============================================================================

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

// ============================================================================
// POST /api/ml-audit/product-inspect — AI Extraction for Masters
// ============================================================================

export const classifyReview = async (req, res) => {
    try {
        const { text, product_name, rating } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Review text is required' });
        }

        const railwayEndpoint = "https://review-rating-api-production.up.railway.app/classify";
        
        if (!process.env.ML_API_SECRET) {
            return res.status(500).json({ error: 'ML_API_SECRET is not configured' });
        }

        const railwayRes = await fetch(railwayEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.ML_API_SECRET}`
            },
            body: JSON.stringify({
                text,
                rating: parseFloat(rating) || 3.0,
                product_name: product_name || ""
            })
        });

        if (!railwayRes.ok) {
            throw new Error(`Railway ML Engine responded with HTTP ${railwayRes.status}`);
        }

        const mlData = await railwayRes.json();
        
        res.json({ success: true, mlData });

    } catch (err) {
        console.error('Classification proxy error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// GET /api/ratings/summary — Aggregated KPIs
// ============================================================================

