import pool from '../config/db.js';
import clickhouse from '../config/clickhouse.js';
import { getOlapTableName } from '../utils/olapResolver.js';

const getTargetDb = (req) => {
    return (req.query.db && req.query.db.toLowerCase() === 'danone') ? 'danone' : 'loreal';
};

export const getProductHealth = async (req, res) => {
    try {
        const { category, pareto_status, web_pid, date_from, date_to, platform, period_months, price_mode, price_min, price_max, is_competitor, sentiment_category } = req.query;
        const trendPeriod = Math.max(1, Math.min(parseInt(period_months) || 3, 24));
        // Review-count window anchor. Standardized on CURRENT_DATE (rolling
        // "last N months from today") so EVERY surface — header, category strip,
        // governance cards, benchmark — reports the SAME number. A MAX(review_date)
        // anchor pulled in a ~5.4K review cluster near the year boundary and made
        // the strip/cards read ~26.5K while the header read ~21K.
        const anchorDateExpr = 'CURRENT_DATE';

        const params = [req.companyId];
        let idx = 2;
        const extraFilters = [];

        if (is_competitor && is_competitor !== 'all') {
            extraFilters.push(`COALESCE(r.is_competitor, false) = $${idx++}`);
            params.push(is_competitor === 'true');
        } else if (is_competitor === undefined || is_competitor === '') {
            // Default to Prestige-only — competitor brands (e.g. iBELL) must not leak
            // into "Growth Opportunities" / characteristic trends / product-health rankings.
            extraFilters.push(`COALESCE(r.is_competitor, false) = false`);
        }
        if (platform && platform !== 'all') { extraFilters.push(`r.platform ILIKE $${idx++}`); params.push(platform); }
        if (category) {
            extraFilters.push(`COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE $${idx++}`);
            params.push(category);
        }
        if (sentiment_category && sentiment_category !== 'all') {
            extraFilters.push(`r.sentiment_category ILIKE $${idx++}`);
            params.push(sentiment_category);
        }
        if (pareto_status) {
            extraFilters.push(`COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, ''), NULLIF(r.pareto_status, '')) = $${idx++}`);
            params.push(pareto_status);
        }
        if (web_pid) { extraFilters.push(`r.web_pid = $${idx++}`); params.push(web_pid); }
        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'COALESCE(ps.price_rp, mp.mrp)'
                : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            extraFilters.push(`${priceExpr} >= $${idx++}`);
            params.push(Number(price_min));
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'COALESCE(ps.price_rp, mp.mrp)'
                : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            extraFilters.push(`${priceExpr} <= $${idx++}`);
            params.push(Number(price_max));
        }
        const extraWhere = extraFilters.length > 0 ? 'AND ' + extraFilters.join(' AND ') : '';
        let recentPeriodFilter;
        let priorPeriodFilter;
        let combinedWindowFilter;

        if (date_from && date_to) {
            params.push(date_from, date_to);
            const fromIdx = params.length - 1;
            const toIdx = params.length;
            const midpointExpr = `($${fromIdx}::date + ($${toIdx}::date - $${fromIdx}::date) / 2)`;
            recentPeriodFilter = `r.review_date >= ${midpointExpr} AND r.review_date <= $${toIdx}::date`;
            priorPeriodFilter = `r.review_date >= $${fromIdx}::date AND r.review_date < ${midpointExpr}`;
            combinedWindowFilter = `AND r.review_date >= $${fromIdx}::date AND r.review_date <= $${toIdx}::date`;
        } else {
            const recentStartExpr = `${anchorDateExpr} - INTERVAL '${trendPeriod} months'`;
            const priorStartExpr = `${anchorDateExpr} - INTERVAL '${trendPeriod * 2} months'`;
            recentPeriodFilter = `r.review_date >= ${recentStartExpr}`;
            priorPeriodFilter = `r.review_date >= ${priorStartExpr} AND r.review_date < ${recentStartExpr}`;
            combinedWindowFilter = `AND r.review_date >= ${priorStartExpr}`;
        }

        const sql = `
            WITH latest_snapshots AS (
                SELECT DISTINCT ON (web_pid)
                    web_pid, price_rp, price_sp, category, pareto_status
                FROM ratings.product_snapshots
                WHERE company_id = $1
                ORDER BY web_pid, snapshot_date DESC, created_at DESC NULLS LAST
            ),
            product_stats AS (
                SELECT
                    LEFT(r.product_name, 80) AS product,
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE r.sentiment = 'Positive') AS positive,
                    COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS negative,
                    COUNT(*) FILTER (WHERE r.sentiment = 'Neutral') AS neutral,
                    COUNT(*) FILTER (WHERE ${recentPeriodFilter}) AS recent_total,
                    COUNT(*) FILTER (WHERE ${recentPeriodFilter} AND r.sentiment = 'Negative') AS recent_neg,
                    COUNT(*) FILTER (WHERE ${priorPeriodFilter}) AS older_total,
                    COUNT(*) FILTER (WHERE ${priorPeriodFilter} AND r.sentiment = 'Negative') AS older_neg
                FROM ratings.reviews r
                LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
                LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid
                WHERE r.company_id = $1 AND r.product_name IS NOT NULL
                  AND r.review_date IS NOT NULL
                  ${combinedWindowFilter}
                  ${extraWhere}
                GROUP BY LEFT(r.product_name, 80)
                HAVING COUNT(*) >= 10
            )
            SELECT
                product, total, positive, negative, neutral,
                recent_total, recent_neg, older_total, older_neg,
                CASE WHEN total > 0 THEN positive::float / total ELSE 0 END AS positive_rate,
                CASE WHEN total > 0 THEN negative::float / total ELSE 0 END AS negative_rate,
                ROUND((CASE WHEN total > 0 THEN (positive - negative)::float / total * 50 + 50 ELSE 50 END)::numeric, 0) AS health_score,
                CASE
                    WHEN recent_total > 0 AND older_total > 0
                         AND (recent_neg::float / recent_total - older_neg::float / older_total) > 0.05 THEN 'declining'
                    WHEN recent_total > 0 AND older_total > 0
                         AND (recent_neg::float / recent_total - older_neg::float / older_total) < -0.05 THEN 'improving'
                    ELSE 'stable'
                END AS trend
            FROM product_stats
            ORDER BY total DESC
            LIMIT 30
        `;
        const { rows } = await pool.query(sql, params);

        // Also get monthly ratings per product (top 20 only)
        const topProducts = rows.slice(0, 20).map(r => r.product);
        let monthlyData = {};

        if (topProducts.length > 0) {
            // Monthly breakdown uses same base filters
            const monthParams = [req.companyId, topProducts];
            let mIdx = 3;
            const monthFilters = [];
            if (category) {
                monthFilters.push(`COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE $${mIdx++}`);
                monthParams.push(category);
            }
            if (pareto_status) {
                monthFilters.push(`COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, ''), NULLIF(r.pareto_status, '')) = $${mIdx++}`);
                monthParams.push(pareto_status);
            }
            if (date_from) { monthFilters.push(`r.review_date >= $${mIdx++}`); monthParams.push(date_from); }
            if (date_to) { monthFilters.push(`r.review_date <= $${mIdx++}`); monthParams.push(date_to); }
            if (price_min !== undefined && price_min !== '') {
                const priceExpr = price_mode === 'rp'
                    ? 'COALESCE(ps.price_rp, mp.mrp)'
                    : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
                monthFilters.push(`${priceExpr} >= $${mIdx++}`);
                monthParams.push(Number(price_min));
            }
            if (price_max !== undefined && price_max !== '') {
                const priceExpr = price_mode === 'rp'
                    ? 'COALESCE(ps.price_rp, mp.mrp)'
                    : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
                monthFilters.push(`${priceExpr} <= $${mIdx++}`);
                monthParams.push(Number(price_max));
            }
            const monthExtraWhere = monthFilters.length > 0 ? 'AND ' + monthFilters.join(' AND ') : '';

            // mp + the per-row product_snapshots LATERAL feed ONLY the category/
            // pareto/price filters. Without them the joins run a correlated
            // snapshot lookup per review row for nothing — skip when unfiltered.
            const monthPriceJoins = monthFilters.length > 0 ? `
                LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
                LEFT JOIN LATERAL (
                    SELECT ps2.price_rp, ps2.price_sp, ps2.category, ps2.pareto_status
                    FROM ratings.product_snapshots ps2
                    WHERE ps2.company_id = r.company_id AND ps2.web_pid = r.web_pid
                    ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
                    LIMIT 1
                ) ps ON true` : '';

            const monthSql = `
                SELECT
                    LEFT(r.product_name, 80) AS product,
                    TO_CHAR(r.review_date, 'YYYY-MM') AS month,
                    ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
                    COUNT(*) AS count
                FROM ratings.reviews r
                ${monthPriceJoins}
                WHERE r.company_id = $1
                  ${is_competitor && is_competitor !== 'all' ? `AND r.is_competitor = ${is_competitor === 'true'}` : ''}
                  AND LEFT(r.product_name, 80) = ANY($2)
                  AND r.review_date IS NOT NULL
                  ${monthExtraWhere}
                GROUP BY product, month
                ORDER BY product, month
            `;
            const { rows: mRows } = await pool.query(monthSql, monthParams);
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

  export const getSkuListLegacy = async (req, res) => {
    try {
        const { category, pareto_status, rating_bifurcation, platform, price_mode, price_min, price_max, is_competitor } = req.query;

        let extraFilters = '';
        const queryParams = { companyId: String(req.companyId) };

        if (is_competitor === 'true' || is_competitor === 'false') {
            extraFilters += ' AND coalesce(r.is_competitor, 0) = {isCompetitor:UInt8}';
            queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        }

        if (platform && platform !== 'all') {
            extraFilters += ' AND ilike(r.platform, {platform:String})';
            queryParams.platform = platform;
        }

        if (category) {
            extraFilters += ` AND ilike(trim(coalesce(nullIf(ls.category, ''), nullIf(r.category, ''), nullIf(mp.category, ''))), {category:String})`;
            queryParams.category = category;
        }

        if (req.query.searchQuery) {
            extraFilters += ` AND (ilike(r.product_name, {searchQuery:String}) OR ilike(r.web_pid, {searchQuery:String}) OR ilike(mp.product_sku_code, {searchQuery:String}))`;
            queryParams.searchQuery = `%${req.query.searchQuery}%`;
        }

        if (pareto_status) {
            if (pareto_status === 'Non-Pareto') {
                extraFilters += ` AND (coalesce(nullIf(mp.pareto_status, ''), nullIf(ls.pareto_status, '')) NOT IN ('Pareto', 'NPD') OR coalesce(nullIf(mp.pareto_status, ''), nullIf(ls.pareto_status, '')) IS NULL)`;
            } else {
                extraFilters += ` AND coalesce(nullIf(mp.pareto_status, ''), nullIf(ls.pareto_status, '')) = {paretoStatus:String}`;
                queryParams.paretoStatus = pareto_status;
            }
        }

        if (rating_bifurcation === 'NP') {
            extraFilters += ` AND ls.rating >= 4.2`;
        } else if (rating_bifurcation === 'Issue') {
            extraFilters += ` AND ls.rating < 4.0`;
        } else if (rating_bifurcation === 'NI') {
            extraFilters += ` AND ls.rating >= 4.0 AND ls.rating < 4.2`;
        }

        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ls.price_rp, mp.mrp)' : 'coalesce(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';
            extraFilters += ` AND ${priceExpr} >= {priceMin:Float64}`;
            queryParams.priceMin = Number(price_min);
        }

        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ls.price_rp, mp.mrp)' : 'coalesce(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';
            extraFilters += ` AND ${priceExpr} <= {priceMax:Float64}`;
            queryParams.priceMax = Number(price_max);
        }

        const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, product_name, pareto_status, rating, price_rp, price_sp, category
                    FROM product_snapshots
                    WHERE company_id = {companyId:String}
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY lower(platform), web_pid
            )
            SELECT
                r.web_pid AS web_pid,
                any(coalesce(nullIf(mp.product_name, ''), nullIf(ls.product_name, ''), r.web_pid)) AS product_name,
                any(ls.rating) AS pdp_rating,
                any(coalesce(nullIf(mp.pareto_status, ''), nullIf(ls.pareto_status, ''))) AS pareto_status,
                count() AS review_count
            FROM ml_reviews r
            LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
            LEFT JOIN latest_snapshots ls ON ls.web_pid = r.web_pid AND lower(ls.platform) = lower(r.platform)
            WHERE r.company_id = {companyId:String} ${extraFilters}
            GROUP BY r.web_pid
            ORDER BY review_count DESC, product_name
        `;

        const chRes = await clickhouse.query({
            database: getTargetDb(req),
            query: sql,
            query_params: queryParams,
            format: 'JSONEachRow'
        });
        
        const skus = await chRes.json();
        res.json({ skus: skus.map(r => ({
            ...r,
            review_count: parseInt(r.review_count || 0),
            pdp_rating: r.pdp_rating ? parseFloat(r.pdp_rating) : null,
        })) });
    } catch (err) {
        console.error('Sku list error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getBenchmarkData = async (req, res) => {
    try {
        const { category, platform, date_from, date_to, period_months, price_mode, price_min, price_max } = req.query;
        const conditions = [`r.company_id = $1`,
            // Our own reviews (is_competitor=false) are ALWAYS Prestige — attribute
            // ALL of them (below) so the benchmark "Prestige" total reconciles with
            // the header / strip / governance cards (~21K). The junk-brand guard
            // (legacy text-extraction noise like "The"/"Gas"/"Extracted", 1-2 char
            // strings) applies ONLY to competitor rows, so it still stops fake
            // competitor columns without dropping our own noisy-brand reviews.
            `(COALESCE(r.is_competitor, false) = false OR (r.brand IS NOT NULL AND r.brand <> '' AND LENGTH(TRIM(r.brand)) >= 3 AND LOWER(TRIM(r.brand)) NOT IN ('the','not','and','gas','extracted','none','null','n/a','other','unknown','etc','for','was','were','our','your','its')))`];
        const params = [req.companyId];
        let idx = 2;

        if (category) {
            conditions.push(`TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))) ILIKE $${idx}`);
            params.push(category);
            idx++;
        }
        if (platform && platform !== 'all') {
            conditions.push(`r.platform ILIKE $${idx}`);
            params.push(platform);
            idx++;
        }
        if (date_from) {
            conditions.push(`r.review_date >= $${idx}`);
            params.push(date_from);
            idx++;
        }
        if (date_to) {
            conditions.push(`r.review_date <= $${idx}`);
            params.push(date_to);
            idx++;
        } else if (!date_from && period_months) {
            const safePeriodMonths = Math.max(1, Math.min(parseInt(period_months) || 6, 24));
            conditions.push(`r.review_date >= CURRENT_DATE - INTERVAL '${safePeriodMonths} months'`);
        }
        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'COALESCE(ps.price_rp, mp.mrp)'
                : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            conditions.push(`${priceExpr} >= $${idx}`);
            params.push(Number(price_min));
            idx++;
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'COALESCE(ps.price_rp, mp.mrp)'
                : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            conditions.push(`${priceExpr} <= $${idx}`);
            params.push(Number(price_max));
            idx++;
        }

        const { rows } = await pool.query(
            `WITH latest_snapshots AS (
                -- Each SKU's latest snapshot computed ONCE (was a per-review
                -- correlated LATERAL — the dominant cost of this endpoint). Same
                -- selection as the old LATERAL: latest snapshot_date, then latest
                -- created_at. A SKU with no snapshot simply has no row here, so the
                -- LEFT JOIN below yields the same NULLs the LATERAL did.
                SELECT DISTINCT ON (web_pid, LOWER(platform))
                    web_pid, platform, price_rp, price_sp, category, rating, rating_count
                FROM ratings.product_snapshots
                WHERE company_id = $1
                ORDER BY web_pid, LOWER(platform), snapshot_date DESC, created_at DESC NULLS LAST
            ),
            scoped_reviews AS (
                SELECT
                    -- Our side (is_competitor=false) → always 'Prestige' so ALL our
                    -- reviews aggregate into one row that matches the header/strip
                    -- (~21K), never fragmented by noisy r.brand text. Competitors keep
                    -- canonicalised casing so 'Pigeon'/'pigeon', 'BUTTERFLY'/'Butterfly'
                    -- collapse to ONE brand instead of duplicate matrix columns.
                    CASE WHEN COALESCE(r.is_competitor, false) = false THEN 'Prestige'
                         ELSE INITCAP(LOWER(r.brand)) END AS brand,
                    r.is_competitor,
                    COALESCE(r.sentiment_category, 'General') AS sentiment_category,
                    r.rating,
                    r.ml_inferred_rating,
                    r.sentiment
                    ,r.web_pid
                    ,r.platform
                    ,ps.rating AS pdp_rating
                    ,ps.rating_count AS rating_count
                FROM ratings.reviews r
                LEFT JOIN masters.products mp
                    ON mp.company_id = r.company_id
                   AND mp.product_external_id = r.web_pid
                   AND LOWER(mp.platform) = LOWER(r.platform)
                LEFT JOIN latest_snapshots ps
                    ON ps.web_pid = r.web_pid
                   AND LOWER(ps.platform) = LOWER(r.platform)
                WHERE ${conditions.join(' AND ')}
            ),
            brand_totals AS (
                SELECT
                    brand,
                    is_competitor,
                    COUNT(*) AS total_reviews,
                    ROUND(AVG(rating)::numeric, 2) AS avg_rating,
                    ROUND(AVG(ml_inferred_rating)::numeric, 2) AS avg_ml_rating,
                    COUNT(*) FILTER (WHERE sentiment = 'Positive') AS positive_count,
                    COUNT(*) FILTER (WHERE sentiment = 'Negative') AS negative_count,
                    COUNT(*) FILTER (WHERE sentiment = 'Neutral') AS neutral_count
                FROM scoped_reviews
                GROUP BY brand, is_competitor
                HAVING COUNT(*) >= 3
            ),
            brand_listing_metrics AS (
                SELECT
                    sr.brand,
                    sr.is_competitor,
                    SUM(COALESCE(sr.rating_count, 0)) AS total_rating_count,
                    ROUND(
                        SUM(COALESCE(sr.pdp_rating, 0) * COALESCE(sr.rating_count, 0))
                        / NULLIF(SUM(COALESCE(sr.rating_count, 0)), 0)::numeric,
                        2
                    ) AS avg_pdp_rating
                FROM (
                    SELECT DISTINCT
                        brand,
                        is_competitor,
                        web_pid,
                        platform,
                        pdp_rating,
                        rating_count
                    FROM scoped_reviews
                ) sr
                GROUP BY sr.brand, sr.is_competitor
            ),
            category_agg AS (
                SELECT
                    brand,
                    is_competitor,
                    sentiment_category,
                    COUNT(*) AS cat_total,
                    COUNT(*) FILTER (WHERE sentiment = 'Positive') AS cat_positive,
                    COUNT(*) FILTER (WHERE sentiment = 'Negative') AS cat_negative,
                    ROUND(AVG(rating)::numeric, 2) AS cat_avg_rating
                FROM scoped_reviews
                GROUP BY brand, is_competitor, sentiment_category
            )
            SELECT
                bt.brand,
                bt.is_competitor,
                bt.total_reviews,
                bt.avg_rating,
                blm.avg_pdp_rating AS pdp_rating,
                bt.avg_rating AS user_rating,
                bt.avg_ml_rating AS ml_rating,
                bt.total_reviews AS review_count,
                blm.total_rating_count AS rating_count,
                bt.positive_count,
                bt.negative_count,
                bt.neutral_count,
                jsonb_object_agg(
                    ca.sentiment_category,
                    jsonb_build_object(
                        'total', ca.cat_total,
                        'positive', ca.cat_positive,
                        'negative', ca.cat_negative,
                        'avg_rating', ca.cat_avg_rating
                    )
                ) FILTER (WHERE ca.cat_total IS NOT NULL) AS category_scores
            FROM brand_totals bt
            LEFT JOIN brand_listing_metrics blm
              ON blm.brand = bt.brand
             AND blm.is_competitor = bt.is_competitor
            LEFT JOIN category_agg ca
              ON ca.brand = bt.brand
             AND ca.is_competitor = bt.is_competitor
            GROUP BY
                bt.brand,
                bt.is_competitor,
                bt.total_reviews,
                bt.avg_rating,
                bt.avg_ml_rating,
                blm.avg_pdp_rating,
                blm.total_rating_count,
                bt.positive_count,
                bt.negative_count,
                bt.neutral_count
            ORDER BY bt.total_reviews DESC`,
            params
        );

        res.json({ benchmarks: rows });
    } catch (err) {
        console.error('benchmark-data error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const bulkImportProducts = async (req, res) => {
    try {
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
        if (!rows) return res.status(400).json({ error: 'Body must include `rows: []`' });
        if (rows.length > 10000) return res.status(400).json({ error: 'Max 10,000 rows per import' });

        const ALLOWED_CATS = new Set([
            'Pressure Cooker','Kadai','Fry Pan','Tawa','Dosa Tawa',
            'Other Cookware','Cookware','Cookware Set','Gas Stove',
            'Mixer Grinder','Kettle','Rice Cooker','Toaster & OTG','Air Fryer',
            'Wet Grinder','Induction Cooktop','Sandwich Maker','Grill & Sandwich Maker',
            'Hand Blender','Glasstops and Hobs','Food Processor','Juicer','Iron',
            'Waffle Maker','Air Oven','Combo','Bottle',
        ]);

        const results = [];
        let updated = 0, errored = 0, skipped = 0;
        for (const row of rows) {
            const webPid = String(row.web_pid || '').trim();
            const masterCat = row.master_category ? String(row.master_category).trim() : null;
            const isNpd = row.is_npd === true || row.is_npd === 'true' || row.is_npd === 1 || row.is_npd === '1';

            if (!webPid) { results.push({ web_pid: webPid, status: 'error', reason: 'missing web_pid' }); errored++; continue; }
            if (masterCat && !ALLOWED_CATS.has(masterCat)) {
                results.push({ web_pid: webPid, status: 'error', reason: `unknown category "${masterCat}"` });
                errored++; continue;
            }

            const sets = [];
            const params = [req.companyId, webPid];
            let pi = 3;
            if (masterCat) {
                sets.push(`master_category = $${pi}`);
                sets.push(`category = $${pi}`);
                params.push(masterCat);
                pi++;
            }
            if (row.is_npd !== undefined) {
                // Setting NPD is fine; CLEARING the flag must revert NPD→Non-Pareto
                // WITHOUT demoting a genuine Pareto SKU (this toggle only governs NPD).
                sets.push(isNpd
                    ? `pareto_status = 'NPD'`
                    : `pareto_status = CASE WHEN pareto_status = 'NPD' THEN 'Non-Pareto' ELSE pareto_status END`);
            }
            if (sets.length === 0) {
                results.push({ web_pid: webPid, status: 'skipped', reason: 'no fields provided' });
                skipped++; continue;
            }

            const r = await pool.query(
                `UPDATE masters.products
                    SET ${sets.join(', ')}, last_synced_at = NOW()
                  WHERE company_id = $1 AND product_external_id = $2
                 RETURNING id`,
                params
            );
            if (r.rowCount === 0) {
                results.push({ web_pid: webPid, status: 'error', reason: 'web_pid not found in master' });
                errored++;
            } else {
                results.push({ web_pid: webPid, status: 'updated', changes: { masterCat, isNpd: row.is_npd !== undefined ? isNpd : undefined } });
                updated++;
            }
        }
        res.json({ totalRows: rows.length, updated, errored, skipped, allowedCategories: [...ALLOWED_CATS], results });
    } catch (err) {
        console.error('bulk-import error:', err);
        res.status(500).json({ error: err.message });
    }
};

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

export const getCategoryHealth = async (req, res) => {
    try {
        const { date_from, date_to, platform, period_months, price_mode, price_min, price_max, is_competitor, sentiment_category, category } = req.query;
        const trendPeriod = parseInt(period_months) || 3;

        // Build parameterized growth filter.
        // When the user selects a date range, split it at the midpoint:
        //   recent  = midpoint  → date_to   (second half of range)
        //   prior   = date_from → midpoint  (first half of range)
        // PostgreSQL: date - date = int (days); date + int = date — so /2 works.
        const sqlParams = [req.companyId];
        let currentScopeFilter, growthRangeFilter, recentFilter, priorFilter;
        let platformFilter = '';
        let snapshotPlatformFilter = '';
        let reviewPriceFilter = '';
        let snapshotPriceFilter = ''; // For 'ls' alias in cat_products
        let competitorFilter = '';
        let snapshotCompetitorFilter = '';
        let sentimentCategoryFilter = '';

        if (is_competitor === 'true' || is_competitor === 'false') {
            competitorFilter = `AND COALESCE(r.is_competitor, false) = $${sqlParams.length + 1}`;
            // For the SKU-count path (snap_cats / review_only_cats), require explicit mp.is_competitor
            // match. Orphan rows with NULL is_competitor are EXCLUDED so the Prestige count doesn't
            // inflate beyond the confirmed masters.products count.
            snapshotCompetitorFilter = `AND mp.is_competitor = $${sqlParams.length + 1}`;
            sqlParams.push(is_competitor === 'true');
        } else if (is_competitor === 'all') {
            competitorFilter = '';
            snapshotCompetitorFilter = '';
        } else {
            // Default to Prestige — strict on the SKU-count path, lenient on review-side (so reviews
            // without a masters mapping are still counted in totals).
            competitorFilter = `AND COALESCE(r.is_competitor, false) = false`;
            snapshotCompetitorFilter = `AND mp.is_competitor = false`;
        }

        if (sentiment_category && sentiment_category !== 'all') {
            sentimentCategoryFilter = `AND r.sentiment_category ILIKE $${sqlParams.length + 1}`;
            sqlParams.push(sentiment_category);
        }

        let categoryFilter = '';
        let snapshotCategoryFilter = '';
        if (category) {
            categoryFilter = `AND COALESCE(NULLIF(ps_latest.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE $${sqlParams.length + 1}`;
            snapshotCategoryFilter = `AND COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, '')) ILIKE $${sqlParams.length + 1}`;
            sqlParams.push(category);
        }

        if (platform && platform !== 'all') {
            platformFilter = `AND r.platform ILIKE $${sqlParams.length + 1}`;
            snapshotPlatformFilter = `AND ls.platform ILIKE $${sqlParams.length + 1}`;
            sqlParams.push(platform);
        }

        if (price_min !== undefined && price_min !== '') {
            // cat_reviews: use pre-resolved prices from lateral join (resolved_price_sp/rp includes mp fallback)
            const reviewPriceExpr = price_mode === 'rp'
                ? 'COALESCE(ps_latest.resolved_price_rp, mp.mrp)'
                : 'COALESCE(ps_latest.resolved_price_sp, mp.selling_price, mp.mop, ps_latest.resolved_price_rp, mp.mrp)';
            // cat_products: ls is the inner DISTINCT ON snapshot, mp is outer join
            const snapshotPriceExpr = price_mode === 'rp'
                ? 'COALESCE(ls.price_rp, mp.mrp)'
                : 'COALESCE(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';

            reviewPriceFilter += ` AND ${reviewPriceExpr} >= $${sqlParams.length + 1}`;
            snapshotPriceFilter += ` AND ${snapshotPriceExpr} >= $${sqlParams.length + 1}`;
            sqlParams.push(Number(price_min));
        }
        if (price_max !== undefined && price_max !== '') {
            const reviewPriceExpr = price_mode === 'rp'
                ? 'COALESCE(ps_latest.resolved_price_rp, mp.mrp)'
                : 'COALESCE(ps_latest.resolved_price_sp, mp.selling_price, mp.mop, ps_latest.resolved_price_rp, mp.mrp)';
            const snapshotPriceExpr = price_mode === 'rp'
                ? 'COALESCE(ls.price_rp, mp.mrp)'
                : 'COALESCE(ls.price_sp, mp.selling_price, mp.mop, ls.price_rp, mp.mrp)';

            reviewPriceFilter += ` AND ${reviewPriceExpr} <= $${sqlParams.length + 1}`;
            snapshotPriceFilter += ` AND ${snapshotPriceExpr} <= $${sqlParams.length + 1}`;
            sqlParams.push(Number(price_max));
        }

        // Get latest review date to anchor trends (prevents 0% trends when data is stale)
        // Review-count window anchor. Standardized on CURRENT_DATE (rolling
        // "last N months from today") so EVERY surface — header, category strip,
        // governance cards, benchmark — reports the SAME number. A MAX(review_date)
        // anchor pulled in a ~5.4K review cluster near the year boundary and made
        // the strip/cards read ~26.5K while the header read ~21K.
        const anchorDateExpr = 'CURRENT_DATE';

        if (date_from && date_to) {
            sqlParams.push(date_from, date_to);
            const fromIdx = sqlParams.length - 1;
            const toIdx = sqlParams.length;
            currentScopeFilter = `AND r.review_date >= $${fromIdx}::date AND r.review_date <= $${toIdx}::date`;
            growthRangeFilter = `AND r.review_date >= $${fromIdx}::date AND r.review_date <= $${toIdx}::date`;
            recentFilter      = `AND r.review_date >= ($${fromIdx}::date + ($${toIdx}::date - $${fromIdx}::date) / 2) AND r.review_date <= $${toIdx}::date`;
            priorFilter       = `AND r.review_date >= $${fromIdx}::date AND r.review_date <  ($${fromIdx}::date + ($${toIdx}::date - $${fromIdx}::date) / 2)`;
        } else {
            // Dynamic: use period_months from global filter (default 3) anchored to LATEST DATA
            const lookbackMonths = trendPeriod * 2;
            currentScopeFilter = `AND r.review_date >= (${anchorDateExpr} - INTERVAL '${trendPeriod} months')`;
            growthRangeFilter = `AND r.review_date >= (${anchorDateExpr} - INTERVAL '${lookbackMonths} months')`;
            recentFilter      = `AND r.review_date >= (${anchorDateExpr} - INTERVAL '${trendPeriod} months')`;
            priorFilter       = `AND r.review_date >= (${anchorDateExpr} - INTERVAL '${lookbackMonths} months') AND r.review_date < (${anchorDateExpr} - INTERVAL '${trendPeriod} months')`;
        }


        const sql = `
            WITH snap_cats AS (
                SELECT DISTINCT ON (ps.company_id, ps.web_pid)
                    ps.web_pid,
                    NULLIF(mp.sku_code, '') AS sku_code,
                    COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) as raw_category,
                    COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, '')) AS raw_pareto_status
                FROM ratings.product_snapshots ps
                LEFT JOIN masters.products mp ON mp.company_id = ps.company_id AND mp.product_external_id = ps.web_pid AND LOWER(mp.platform) = LOWER(ps.platform)
                WHERE ps.company_id = $1
                  ${snapshotCompetitorFilter}
                  ${snapshotPlatformFilter.replace('ls.', 'ps.')}
                  AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) != ''
                  AND ps.snapshot_date >= (${anchorDateExpr} - INTERVAL '${trendPeriod} months')
                ORDER BY ps.company_id, ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC
            ),
            review_only_cats AS (
                SELECT DISTINCT ON (r.web_pid)
                    r.web_pid,
                    NULLIF(mp.sku_code, '') AS sku_code,
                    COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) as raw_category,
                    COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(r.pareto_status, '')) AS raw_pareto_status
                FROM ratings.reviews r
                LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
                WHERE r.company_id = $1
                  ${competitorFilter}
                  ${platformFilter}
                  AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) IS NOT NULL
                  AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) != ''
                  ${currentScopeFilter}
                  AND NOT EXISTS (SELECT 1 FROM snap_cats sc WHERE sc.web_pid = r.web_pid)
                ORDER BY r.web_pid, r.review_date DESC
            ),
            sku_category_map AS (
                SELECT
                    web_pid,
                    sku_code,
                    -- Canonical SKU: prefer masters.sku_code (one row per product across platforms),
                    -- fall back to web_pid for unmapped products so they're still counted.
                    COALESCE(sku_code, web_pid) AS canonical_sku,
                    CASE
                        WHEN TRIM(LOWER(raw_category)) IN ('other', 'others') THEN 'Others'
                        ELSE INITCAP(TRIM(raw_category))
                    END AS category,
                    raw_pareto_status AS pareto_status
                FROM (
                    SELECT web_pid, sku_code, raw_category, raw_pareto_status FROM snap_cats
                    UNION ALL
                    SELECT web_pid, sku_code, raw_category, raw_pareto_status FROM review_only_cats
                ) all_c
            ),
            cat_sku_counts AS (
                SELECT
                    category,
                    COUNT(DISTINCT canonical_sku) AS sku_count,
                    COUNT(DISTINCT canonical_sku) FILTER (WHERE pareto_status = 'Pareto') AS pareto_count,
                    COUNT(DISTINCT canonical_sku) FILTER (WHERE pareto_status IN ('Non-Pareto', 'Non-Pareto (Unclassified)') OR pareto_status IS NULL) AS non_pareto_count,
                    COUNT(DISTINCT canonical_sku) FILTER (WHERE pareto_status = 'NPD') AS npd_count
                FROM sku_category_map
                WHERE 1=1
                  ${snapshotCategoryFilter.replace("COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, ''))", "category")}
                GROUP BY 1
            ),
            cat_reviews AS (
                SELECT
                    scm.category,
                    COUNT(*) AS review_count,
                    COUNT(DISTINCT r.web_pid) AS sku_count,
                    ROUND(AVG(r.rating)::numeric, 2) AS avg_review_rating,
                    ROUND(AVG(r.ml_inferred_rating)::numeric, 2) AS avg_ml_rating,
                    COUNT(*) FILTER (WHERE r.sentiment = 'Positive') AS positive_count,
                    COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS negative_count,
                    COUNT(*) FILTER (WHERE r.sentiment = 'Neutral') AS neutral_count
                FROM ratings.reviews r
                JOIN sku_category_map scm ON scm.web_pid = r.web_pid
                WHERE r.company_id = $1
                  ${competitorFilter}
                  ${currentScopeFilter}
                  ${platformFilter}
                  ${sentimentCategoryFilter}
                  ${categoryFilter.replace("COALESCE(NULLIF(ps_latest.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))", "scm.category")}
                GROUP BY 1
            ),
            cat_products AS (
                SELECT
                    scm.category,
                    SUM(ls.rating_count) AS total_ratings,
                    ROUND(
                        SUM(ls.rating * ls.rating_count) / NULLIF(SUM(ls.rating_count), 0)::numeric,
                        2
                    ) AS avg_platform_rating
                FROM sku_category_map scm
                JOIN (
                    SELECT DISTINCT ON (ps.company_id, LOWER(ps.platform), ps.web_pid)
                        ps.web_pid,
                        ps.rating,
                        ps.rating_count
                    FROM ratings.product_snapshots ps
                    WHERE ps.company_id = $1
                    ORDER BY ps.company_id, LOWER(ps.platform), ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC
                ) ls ON ls.web_pid = scm.web_pid
                WHERE 1=1
                  ${snapshotCategoryFilter.replace("COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, ''))", "scm.category")}
                GROUP BY 1
            ),
            cat_growth AS (
                SELECT
                    scm.category,
                    COUNT(*) FILTER (WHERE true ${recentFilter}) AS recent_count,
                    COUNT(*) FILTER (WHERE true ${priorFilter}) AS prior_count,
                    ROUND(AVG(r.rating) FILTER (WHERE true ${recentFilter})::numeric, 2) AS recent_avg_rating,
                    ROUND(AVG(r.rating) FILTER (WHERE true ${priorFilter})::numeric, 2) AS prior_avg_rating
                FROM ratings.reviews r
                JOIN sku_category_map scm ON scm.web_pid = r.web_pid
                WHERE r.company_id = $1
                  ${competitorFilter}
                  ${growthRangeFilter}
                  ${platformFilter}
                  ${sentimentCategoryFilter}
                  ${categoryFilter.replace("COALESCE(NULLIF(ps_latest.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))", "scm.category")}
                GROUP BY 1
            ),
            cat_catalogue AS (
                -- Authoritative CATALOGUE SKU count per category, straight from the
                -- master (same source as the governance cards + category dropdown).
                -- csc.sku_count above is the ACTIVE population (snapshot/review in
                -- window); this is the full listed catalogue, so the strip can show
                -- "X listed · Y active" instead of a bare active count.
                SELECT
                    CASE WHEN TRIM(LOWER(mp.category)) IN ('other','others') THEN 'Others'
                         ELSE INITCAP(TRIM(mp.category)) END AS category,
                    COUNT(DISTINCT mp.product_external_id) AS catalogue_sku_count
                FROM masters.products mp
                WHERE mp.company_id = $1 AND mp.platform IS NOT NULL
                  AND mp.category IS NOT NULL AND TRIM(mp.category) <> ''
                  ${snapshotCompetitorFilter}
                  ${snapshotPlatformFilter.replace(/ls\./g, 'mp.')}
                  ${snapshotCategoryFilter.replace("COALESCE(NULLIF(ls.category, ''), NULLIF(mp.category, ''))", "mp.category")}
                GROUP BY 1
            )
            SELECT
                csc.category,
                COALESCE(cr.review_count, 0) AS review_count,
                csc.sku_count,
                COALESCE(cc.catalogue_sku_count, csc.sku_count) AS catalogue_sku_count,
                -- SKUs with a review in the window (same web_pid grain as the
                -- catalogue count) — the honest "with recent reviews" number.
                COALESCE(cr.sku_count, 0) AS review_sku_count,
                COALESCE(cr.avg_review_rating, 0) AS avg_review_rating,
                cr.avg_ml_rating,
                COALESCE(cr.positive_count, 0) AS positive_count,
                COALESCE(cr.negative_count, 0) AS negative_count,
                COALESCE(cr.neutral_count, 0) AS neutral_count,
                COALESCE(cp.total_ratings, 0) AS total_ratings,
                cp.avg_platform_rating,
                csc.pareto_count,
                csc.non_pareto_count,
                csc.npd_count,
                COALESCE(cg.recent_count, 0) AS recent_count,
                COALESCE(cg.prior_count, 0) AS prior_count,
                COALESCE(cg.recent_avg_rating, 0) AS recent_avg_rating,
                COALESCE(cg.prior_avg_rating, 0) AS prior_avg_rating
            FROM cat_sku_counts csc
            LEFT JOIN cat_products cp ON cp.category = csc.category
            LEFT JOIN cat_reviews cr ON cr.category = csc.category
            LEFT JOIN cat_growth cg ON cg.category = csc.category
            LEFT JOIN cat_catalogue cc ON cc.category = csc.category
            ORDER BY csc.sku_count DESC, COALESCE(cr.review_count, 0) DESC
        `;
        const { rows } = await pool.query(sql, sqlParams);


        const categories = rows.map(r => {
            const recent = parseInt(r.recent_count || 0);
            const prior = parseInt(r.prior_count || 0);
            const growthPct = prior > 0
                ? Math.round(((recent - prior) / prior) * 100)
                : (recent > 0 ? 100 : 0);

            const recentRating = parseFloat(r.recent_avg_rating || 0);
            const priorRating = parseFloat(r.prior_avg_rating || 0);
            const ratingGrowthDiff = (recent > 0 && prior > 0)
                ? Math.round((recentRating - priorRating) * 100) / 100
                : 0;

            return {
                category: r.category,
                reviewCount: parseInt(r.review_count),
                skuCount: parseInt(r.sku_count),
                catalogueSkuCount: parseInt(r.catalogue_sku_count || r.sku_count),
                reviewSkuCount: parseInt(r.review_sku_count || 0),
                avgReviewRating: parseFloat(r.avg_review_rating || 0),
                avgMlRating: r.avg_ml_rating ? parseFloat(r.avg_ml_rating) : null,
                positiveCount: parseInt(r.positive_count),
                negativeCount: parseInt(r.negative_count),
                neutralCount: parseInt(r.neutral_count),
                totalRatings: parseInt(r.total_ratings || 0),
                avgPlatformRating: r.avg_platform_rating ? parseFloat(r.avg_platform_rating) : null,
                paretoCount: parseInt(r.pareto_count || 0),
                nonParetoCount: parseInt(r.non_pareto_count || 0),
                npdCount: parseInt(r.npd_count || 0),
                growthPct,
                recentReviewCount: recent,
                priorReviewCount: prior,
                recentAvgRating: recentRating,
                priorAvgRating: priorRating,
                ratingGrowthDiff,
            };
        });

        // -------------------------------------------------------------
        // Calculate totals by aggregating category-level metrics to ensure perfect parity.
        // Since each SKU is mapped to exactly one category (via DISTINCT ON), 
        // the sum of category SKUs equals the total unique SKUs.
        // -------------------------------------------------------------
        const totalSkuCount = categories.reduce((sum, c) => sum + (c.skuCount || 0), 0);
        const totalCatalogueSkuCount = categories.reduce((sum, c) => sum + (c.catalogueSkuCount || 0), 0);
        const totalReviewSkuCount = categories.reduce((sum, c) => sum + (c.reviewSkuCount || 0), 0);
        const totalReviewCount = categories.reduce((sum, c) => sum + (c.reviewCount || 0), 0);
        const totalRatingsCount = categories.reduce((sum, c) => sum + (c.totalRatings || 0), 0);
        const totalParetoCount = categories.reduce((sum, c) => sum + (c.paretoCount || 0), 0);
        const totalNonParetoCount = categories.reduce((sum, c) => sum + (c.nonParetoCount || 0), 0);
        const totalNpdCount = categories.reduce((sum, c) => sum + (c.npdCount || 0), 0);

        const totalRecentReviewCount = categories.reduce((sum, c) => sum + (c.recentReviewCount || 0), 0);
        const totalPriorReviewCount = categories.reduce((sum, c) => sum + (c.priorReviewCount || 0), 0);
        
        const totalGrowthPct = totalPriorReviewCount > 0
            ? Math.round(((totalRecentReviewCount - totalPriorReviewCount) / totalPriorReviewCount) * 100)
            : (totalRecentReviewCount > 0 ? 100 : 0);

        const totalAvgPlatformRating = totalRatingsCount > 0
            ? categories.reduce((sum, c) => sum + (c.avgPlatformRating || 0) * (c.totalRatings || 0), 0) / totalRatingsCount
            : 0;

        const totalAvgReviewRating = totalReviewCount > 0
            ? categories.reduce((sum, c) => sum + (c.avgReviewRating || 0) * (c.reviewCount || 0), 0) / totalReviewCount
            : 0;
            
        const totalPositiveCount = categories.reduce((sum, c) => sum + (c.positiveCount || 0), 0);
        const totalNegativeCount = categories.reduce((sum, c) => sum + (c.negativeCount || 0), 0);
        const totalNeutralCount = categories.reduce((sum, c) => sum + (c.neutralCount || 0), 0);


        res.json({
            categories,
            total: {
                skuCount: totalSkuCount,
                catalogueSkuCount: totalCatalogueSkuCount,
                reviewSkuCount: totalReviewSkuCount,
                totalRatings: totalRatingsCount,
                reviewCount: totalReviewCount,
                paretoCount: totalParetoCount,
                nonParetoCount: totalNonParetoCount,
                npdCount: totalNpdCount
            }
        });
    } catch (err) {
        console.error('Category health error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getSkuListOlap = async (req, res) => {
    try {
        const { category, pareto_status, rating_bifurcation, platform, price_mode, price_min, price_max, is_competitor, brand } = req.query;

        let extraFilters = '';
        const queryParams = { companyId: String(req.companyId) };

        if (is_competitor === 'true' || is_competitor === 'false') {
            extraFilters += ' AND coalesce(r.is_competitor, 0) = {isCompetitor:UInt8}';
            queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        }

        if (brand) {
            extraFilters += ` AND ilike(r.brand, {brand:String})`;
            queryParams.brand = brand;
        }

        if (platform && platform !== 'all') {
            extraFilters += ' AND ilike(r.platform, {platform:String})';
            queryParams.platform = platform;
        }

        if (category) {
            extraFilters += ` AND ilike(trim(r.category), {category:String})`;
            queryParams.category = category;
        }

        if (req.query.searchQuery) {
            extraFilters += ` AND (ilike(r.product_name, {searchQuery:String}) OR ilike(r.web_pid, {searchQuery:String}) OR ilike(r.product_sku_code, {searchQuery:String}))`;
            queryParams.searchQuery = `%${req.query.searchQuery}%`;
        }

        // Pareto status is not in rb_review_olap for some clients, so we ignore it if it's passed or try to use a fallback if it exists.
        // The safest thing is to NOT filter by pareto_status if the client is fully OLAP and relies solely on rb_review_olap.

        if (rating_bifurcation === 'NP') {
            extraFilters += ` AND r.pdp_rating >= 4.2`;
        } else if (rating_bifurcation === 'Issue') {
            extraFilters += ` AND r.pdp_rating < 4.0`;
        } else if (rating_bifurcation === 'NI') {
            extraFilters += ` AND r.pdp_rating >= 4.0 AND r.pdp_rating < 4.2`;
        }

        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp' ? 'r.price_rp' : 'coalesce(r.price_sp, r.price_rp)';
            extraFilters += ` AND ${priceExpr} >= {priceMin:Float64}`;
            queryParams.priceMin = Number(price_min);
        }

        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp' ? 'r.price_rp' : 'coalesce(r.price_sp, r.price_rp)';
            extraFilters += ` AND ${priceExpr} <= {priceMax:Float64}`;
            queryParams.priceMax = Number(price_max);
        }

        const sql = `
            SELECT
                r.web_pid AS web_pid,
                any(r.product_name) AS product_name,
                any(r.pdp_rating) AS pdp_rating,
                'Non-Pareto' AS pareto_status,
                count() AS review_count
            FROM ${getOlapTableName(getTargetDb(req))} r
            WHERE r.company_id = {companyId:String} ${extraFilters}
            GROUP BY r.web_pid
            ORDER BY review_count DESC, product_name
        `;

        const chRes = await clickhouse.query({
            database: getTargetDb(req),
            query: sql,
            query_params: queryParams,
            format: 'JSONEachRow'
        });
        
        const skus = await chRes.json();
        res.json({ skus: skus.map(r => ({
            ...r,
            review_count: parseInt(r.review_count || 0),
            pdp_rating: r.pdp_rating ? parseFloat(r.pdp_rating) : null,
        })) });
    } catch (err) {
        console.error('Sku list olap error:', err);
        res.status(500).json({ error: err.message });
    }
};
