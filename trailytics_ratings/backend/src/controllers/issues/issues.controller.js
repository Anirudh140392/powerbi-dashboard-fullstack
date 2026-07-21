import pool from '../../config/db.js';
import clickhouse from '../../config/clickhouse.js';

const getTargetDb = (req) => {
    return req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] || (req.authUser && req.authUser.dbName) || process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || 'prestige';
};

export const getIssuesBreakdown = async (req, res) => {
    try {
        const { category: filterCategory, pareto_status: filterParetoStatus, rating_bifurcation, platform, date_from, date_to, period_months, price_mode, price_min, price_max, is_competitor, sentiment_category, web_pid } = req.query;

        const queryParams = { companyId: String(req.companyId) };
        const extraFilters = [];

        if (web_pid) {
            queryParams.webPid = String(web_pid);
            extraFilters.push(`r.web_pid = {webPid:String}`);
        }

        if (is_competitor === 'true' || is_competitor === 'false') {
            extraFilters.push(`coalesce(r.is_competitor, 0) = {isCompetitor:UInt8}`);
            queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        } else if (is_competitor !== 'all') {
            extraFilters.push(`coalesce(r.is_competitor, 0) = 0`);
        }

        if (sentiment_category && sentiment_category !== 'all') {
            extraFilters.push(`ilike(r.sentiment_category, {sentimentCategory:String})`);
            queryParams.sentimentCategory = sentiment_category;
        }

        if (platform && platform !== 'all') {
            extraFilters.push(`ilike(r.platform, {platform:String})`);
            queryParams.platform = platform;
        }

        if (date_from) {
            extraFilters.push(`r.review_date >= toDate({dateFrom:String})`);
            queryParams.dateFrom = date_from;
        }
        if (date_to) {
            extraFilters.push(`r.review_date <= toDate({dateTo:String})`);
            queryParams.dateTo = date_to;
        }
        if (!date_from && !date_to) {
            const pm = Math.max(1, Math.min(parseInt(period_months) || 6, 24));
            extraFilters.push(`r.review_date >= subtractMonths(today(), ${pm})`);
        }

        if (filterCategory) {
            extraFilters.push(`ilike(trim(coalesce(nullIf(ps.category, ''), nullIf(r.category, ''), nullIf(mp.category, ''))), {category:String})`);
            queryParams.category = filterCategory;
        }
        if (filterParetoStatus) {
            if (filterParetoStatus === 'Non-Pareto') {
                extraFilters.push(`(coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) NOT IN ('Pareto', 'NPD') OR coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) = '')`);
            } else {
                extraFilters.push(`coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) = {paretoStatus:String}`);
                queryParams.paretoStatus = filterParetoStatus;
            }
        }
        if (rating_bifurcation === 'NP') {
            extraFilters.push(`ps.rating >= 4.2`);
        } else if (rating_bifurcation === 'Issue') {
            extraFilters.push(`ps.rating < 4.0`);
        } else if (rating_bifurcation === 'NI') {
            extraFilters.push(`ps.rating >= 4.0 AND ps.rating < 4.2`);
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

        const chMappingSql = `
            SELECT sentiment_subcategory, any(display_label) AS display_label, any(stakeholder) AS stakeholder
            FROM stakeholder_mappings
            WHERE company_id = {companyId:String}
            GROUP BY sentiment_subcategory
        `;
        const chMappingRes = await clickhouse.query({
            database: getTargetDb(req),
            query: chMappingSql,
            query_params: { companyId: String(req.companyId) },
            format: 'JSONEachRow'
        });
        const mappingRows = await chMappingRes.json();
        const issuesMap = {};
        mappingRows.forEach(r => {
            if (r.stakeholder) {
                issuesMap[r.sentiment_subcategory] = {
                    subcategory: r.sentiment_subcategory,
                    label: r.display_label || r.sentiment_subcategory.replace(/_/g, ' '),
                    stakeholder: r.stakeholder,
                    negativeCount: 0,
                    totalCount: 0,
                    skuCount: 0,
                    avgRating: 0
                };
            }
        });

        const extraWhere = extraFilters.length > 0 ? `AND ${extraFilters.join(' AND ')}` : '';

        const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp, price_sp, category, pareto_status, rating
                    FROM product_snapshots
                    WHERE company_id = {companyId:String}
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY lower(platform), web_pid
            )
            SELECT
                r.sentiment_subcategory AS sentiment_subcategory,
                count() AS total_count,
                countIf(r.sentiment = 'Negative') AS negative_count,
                uniqExact(r.web_pid) AS sku_count,
                round(avg(r.rating), 2) AS avg_rating
            FROM ml_reviews r
            LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
            LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND lower(ps.platform) = lower(r.platform)
            WHERE r.company_id = {companyId:String}
              AND isNotNull(r.sentiment_subcategory) AND r.sentiment_subcategory != ''
              AND r.sentiment_subcategory != 'General_Feedback'
              ${extraWhere}
            GROUP BY r.sentiment_subcategory
            ORDER BY negative_count DESC
        `;

        const chRes = await clickhouse.query({
            database: getTargetDb(req),
            query: sql,
            query_params: queryParams,
            format: 'JSONEachRow'
        });
        const rows = await chRes.json();
        
        rows.forEach(r => {
            if (issuesMap[r.sentiment_subcategory]) {
                issuesMap[r.sentiment_subcategory].negativeCount = parseInt(r.negative_count);
                issuesMap[r.sentiment_subcategory].totalCount = parseInt(r.total_count);
                issuesMap[r.sentiment_subcategory].skuCount = parseInt(r.sku_count);
                issuesMap[r.sentiment_subcategory].avgRating = parseFloat(r.avg_rating);
            }
        });

        const issues = Object.values(issuesMap).sort((a,b) => b.negativeCount - a.negativeCount);

        res.json({ issues, totalIssues: issues.length });
    } catch (err) {
        console.error('Issues breakdown error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// GET /api/ratings/issue-detail — SKUs affected by a specific NLP issue
// ============================================================================

export const getIssueDetail = async (req, res) => {
    try {
        const { subcategory, is_competitor = 'false' } = req.query;
        if (!subcategory) return res.status(400).json({ error: 'subcategory param required' });

        const targetDb = getTargetDb(req);

        let compFilter = '';
        if (is_competitor === 'true') compFilter = 'AND coalesce(is_competitor, false) = true';
        else if (is_competitor === 'false') compFilter = 'AND coalesce(is_competitor, false) = false';

        const sql = `
            SELECT
                web_pid,
                product_name,
                MAX(pdp_rating) AS pdp_rating,
                COUNT(*) AS review_count,
                countIf(sentiment = 'Negative') AS negative_count,
                ROUND(AVG(rating), 2) AS avg_review_rating
            FROM ml_reviews
            WHERE company_id = {companyId:String}
              AND sentiment_subcategory = {subcategory:String}
              ${compFilter}
            GROUP BY web_pid, product_name
            ORDER BY negative_count DESC
            LIMIT 200
        `;
        
        const chRes = await clickhouse.query({
            database: targetDb,
            query: sql,
            query_params: { companyId: String(req.companyId), subcategory },
            format: 'JSONEachRow'
        });
        const rows = await chRes.json();

        const products = rows.map(r => ({
            web_pid: r.web_pid,
            product_name: r.product_name,
            pdp_rating: r.pdp_rating ? parseFloat(r.pdp_rating) : null,
            reviewCount: parseInt(r.review_count),
            negativeCount: parseInt(r.negative_count),
            avgReviewRating: parseFloat(r.avg_review_rating),
        }));

        res.json({ subcategory, products, total: products.length });
    } catch (err) {
        console.error('Issue detail error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// GET /api/ratings/reviews-by-issue — Fetch actual reviews for a specific issue
// ============================================================================

export const getReviewsByIssue = async (req, res) => {
    try {
        const { web_pid, subcategory, limit = 50, offset = 0, sort = 'rating_asc', date_from, date_to, is_competitor = 'false' } = req.query;
        if (!web_pid || !subcategory) return res.status(400).json({ error: 'web_pid and subcategory required' });

        const targetDb = getTargetDb(req);
        
        let orderClause = 'ORDER BY review_date DESC NULLS LAST';
        if (sort === 'rating_asc') orderClause = 'ORDER BY rating ASC, review_date DESC NULLS LAST';
        else if (sort === 'rating_desc') orderClause = 'ORDER BY rating DESC, review_date DESC NULLS LAST';

        const queryParams = { 
            companyId: String(req.companyId), 
            webPid: web_pid, 
            subcategory, 
            limit: parseInt(limit), 
            offset: parseInt(offset) 
        };

        let dateFilter = '';
        if (date_from) {
            dateFilter += ' AND review_date >= {dateFrom:String}';
            queryParams.dateFrom = date_from;
        }
        if (date_to) {
            dateFilter += ' AND review_date <= {dateTo:String}';
            queryParams.dateTo = date_to;
        }

        let compFilter = '';
        if (is_competitor === 'true') compFilter = 'AND coalesce(is_competitor, false) = true';
        else if (is_competitor === 'false') compFilter = 'AND coalesce(is_competitor, false) = false';

        const sql = `
            SELECT
                id, rating, review_title, review_text, review_date,
                reviewer_name, is_verified_purchase, sentiment,
                sentiment_subcategory, specific_issue,
                ml_inferred_rating AS sentiment_score, quality_score,
                product_name, pdp_rating
            FROM ml_reviews
            WHERE company_id = {companyId:String}
              AND web_pid = {webPid:String}
              AND (specific_issue = {subcategory:String} OR sentiment_category = {subcategory:String} OR sentiment_subcategory = {subcategory:String})
              ${dateFilter}
              ${compFilter}
            ${orderClause}
            LIMIT {limit:UInt32} OFFSET {offset:UInt32}
        `;
        
        const countSql = `
            SELECT count() AS count
            FROM ml_reviews
            WHERE company_id = {companyId:String}
              AND web_pid = {webPid:String}
              AND (specific_issue = {subcategory:String} OR sentiment_category = {subcategory:String} OR sentiment_subcategory = {subcategory:String})
              ${dateFilter}
              ${compFilter}
        `;

        const [chRes, chCount] = await Promise.all([
            clickhouse.query({ database: targetDb, query: sql, query_params: queryParams, format: 'JSONEachRow' }),
            clickhouse.query({ database: targetDb, query: countSql, query_params: queryParams, format: 'JSONEachRow' })
        ]);

        const rows = await chRes.json();
        const countRows = await chCount.json();

        res.json({
            reviews: rows,
            total: parseInt(countRows[0]?.count || 0),
            limit: parseInt(limit),
            offset: parseInt(offset),
        });
    } catch (err) {
        console.error('Reviews by issue error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// GET /api/ratings/stakeholder-detail — Issues + SKUs for a specific stakeholder
// ============================================================================
// NOTE: Stakeholder mappings come from DB table ratings.stakeholder_mappings (config-driven, multi-tenant)

export const getAsinIssues = async (req, res) => {
    try {
        const { web_pid } = req.query;
        if (!web_pid) return res.status(400).json({ error: 'web_pid param required' });

        const targetDb = getTargetDb(req);
        const queryParams = { companyId: String(req.companyId), webPid: web_pid };

        // Get product info
        const productSql = `
            SELECT product_name, rating AS pdp_rating, rating_count, star_distribution
            FROM product_snapshots
            WHERE company_id = {companyId:String} AND web_pid = {webPid:String} AND coalesce(is_competitor, false) = false
            ORDER BY snapshot_date DESC, created_at DESC LIMIT 1
        `;
        const chProduct = await clickhouse.query({ database: targetDb, query: productSql, query_params: queryParams, format: 'JSONEachRow' });
        const productRows = await chProduct.json();
        const product = productRows[0] || { product_name: 'Unknown', pdp_rating: null, rating_count: 0, star_distribution: '{}' };

        // Get issue breakdown
        const issuesSql = `
            SELECT
                sentiment_category AS issue_category,
                sentiment_subcategory AS issue_type,
                specific_issue AS rca,
                count() AS total_count,
                countIf(sentiment = 'Negative') AS negative_count,
                countIf(sentiment = 'Positive') AS positive_count,
                round(avg(rating), 2) AS avg_rating
            FROM ml_reviews
            WHERE company_id = {companyId:String}
              AND web_pid = {webPid:String}
              AND coalesce(is_competitor, false) = false
              AND isNotNull(sentiment_subcategory)
              AND sentiment_subcategory != ''
            GROUP BY sentiment_category, sentiment_subcategory, specific_issue
            ORDER BY negative_count DESC, total_count DESC
        `;
        const chIssues = await clickhouse.query({ database: targetDb, query: issuesSql, query_params: queryParams, format: 'JSONEachRow' });
        const issueRows = await chIssues.json();

        // Total reviews + distribution
        const totalSql = `
            SELECT
                count() AS total,
                round(avg(rating), 2) AS user_rating,
                round(avg(ml_inferred_rating), 2) AS ml_rating,
                groupArray(tuple(platform, 1)) as platforms,
                groupArray(tuple(multiIf(quality_score <= 2, '1', quality_score <= 4, '2', quality_score <= 6, '3', quality_score <= 8, '4', '5'), 1)) as ai_stars
            FROM ml_reviews
            WHERE company_id = {companyId:String} AND web_pid = {webPid:String} AND coalesce(is_competitor, false) = false
        `;
        const chTotal = await clickhouse.query({ database: targetDb, query: totalSql, query_params: queryParams, format: 'JSONEachRow' });
        const totalRows = await chTotal.json();
        
        const totalReviews = parseInt(totalRows[0]?.total || 0);

        const issues = issueRows.map(r => ({
            issueCategory: (r.issue_category || '').replace(/_/g, ' '),
            issueType: (r.issue_type || '').replace(/_/g, ' '),
            issueTypeRaw: r.issue_type || '',
            rca: (r.rca || 'Not classified').replace(/_/g, ' '),
            totalCount: parseInt(r.total_count),
            negativeCount: parseInt(r.negative_count),
            positiveCount: parseInt(r.positive_count),
            avgRating: parseFloat(r.avg_rating),
            pctOfTotal: totalReviews > 0 ? Math.round((parseInt(r.total_count) / totalReviews) * 100) : 0,
        }));

        let platformDistribution = {};
        if (totalRows[0]?.platforms) {
            totalRows[0].platforms.forEach(p => {
                platformDistribution[p[0]] = (platformDistribution[p[0]] || 0) + 1;
            });
        }
        
        let aiDistribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
        let totalAiCount = 0;
        let aiSum = 0;
        if (totalRows[0]?.ai_stars) {
            totalRows[0].ai_stars.forEach(a => {
                aiDistribution[a[0]] = (aiDistribution[a[0]] || 0) + 1;
                totalAiCount += 1;
                aiSum += parseInt(a[0]);
            });
        }
        const aiAvg = totalAiCount > 0 ? aiSum / totalAiCount : null;

        let discrepancyFlag = false;
        if (product.pdp_rating && parseFloat(product.pdp_rating) >= 4.0 && aiAvg !== null && aiAvg < 3.0) {
            discrepancyFlag = true;
        }

        res.json({
            webPid: web_pid,
            productName: product.product_name,
            pdpRating: product.pdp_rating ? parseFloat(product.pdp_rating) : null,
            userRating: totalRows[0]?.user_rating ? parseFloat(totalRows[0].user_rating) : null,
            mlRating: totalRows[0]?.ml_rating ? parseFloat(totalRows[0].ml_rating) : null,
            ratingCount: parseInt(product.rating_count || 0),
            totalReviews,
            issues,
            platformDistribution,
            aiDistribution,
            discrepancyFlag
        });
    } catch (err) {
        console.error('ASIN issues error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// GET /api/ratings/executive-health — Pareto/Non-Pareto/NPD → NP/Issue/NI
// ============================================================================

export const getIssueDrilldown = async (req, res) => {
    try {
        const name = req.params.name;
        const { platform, date_from, date_to } = req.query;
        
        const targetDb = getTargetDb(req);
        
        let extraWhere = '';
        const queryParams = { companyId: String(req.companyId), name };
        
        if (platform && platform !== 'all') {
            extraWhere += ' AND LOWER(platform) = LOWER({platform:String})';
            queryParams.platform = platform;
        }
        if (date_from) {
            extraWhere += ' AND review_date >= {dateFrom:String}';
            queryParams.dateFrom = date_from;
        }
        if (date_to) {
            extraWhere += ' AND review_date <= {dateTo:String}';
            queryParams.dateTo = date_to;
        }
        
        const w = `company_id = {companyId:String} AND (specific_issue = {name:String} OR sentiment_category = {name:String} OR sentiment_subcategory = {name:String}) ${extraWhere}`;

        const [skus, brands, trend, samples] = await Promise.all([
            // Top affected SKUs
            clickhouse.query({
                database: targetDb,
                query: `
                    SELECT web_pid, product_name, brand, platform,
                           COUNT(*) AS reviews,
                           ROUND(AVG(rating), 2) AS avg_rating,
                           countIf(sentiment = 'Negative') AS neg
                      FROM ml_reviews
                     WHERE ${w} AND coalesce(is_competitor, false) = false
                     GROUP BY web_pid, product_name, brand, platform
                     ORDER BY reviews DESC LIMIT 20
                `,
                query_params: queryParams,
                format: 'JSONEachRow'
            }),
            // Brand breakdown (Prestige vs competitors)
            clickhouse.query({
                database: targetDb,
                query: `
                    SELECT COALESCE(brand, 'Unknown') AS brand, is_competitor,
                           COUNT(*) AS reviews,
                           ROUND(AVG(rating), 2) AS avg_rating
                      FROM ml_reviews
                     WHERE ${w}
                     GROUP BY brand, is_competitor
                     ORDER BY reviews DESC LIMIT 15
                `,
                query_params: queryParams,
                format: 'JSONEachRow'
            }),
            // Monthly trend
            clickhouse.query({
                database: targetDb,
                query: `
                    SELECT toStartOfMonth(review_date) AS month,
                           COUNT(*) AS reviews,
                           ROUND(AVG(rating), 2) AS avg_rating
                      FROM ml_reviews
                     WHERE ${w} AND isNotNull(review_date)
                     GROUP BY month ORDER BY month DESC LIMIT 12
                `,
                query_params: queryParams,
                format: 'JSONEachRow'
            }),
            // Sample verbatims (most recent negatives)
            clickhouse.query({
                database: targetDb,
                query: `
                    SELECT review_text, rating, review_date, brand, web_pid, product_name
                      FROM ml_reviews
                     WHERE ${w} AND isNotNull(review_text)
                       AND LENGTH(review_text) > 20 AND rating <= 2
                     ORDER BY review_date DESC NULLS LAST LIMIT 8
                `,
                query_params: queryParams,
                format: 'JSONEachRow'
            }),
        ]);

        const skusRows = await skus.json();
        const brandsRows = await brands.json();
        const trendRows = await trend.json();
        const samplesRows = await samples.json();

        // Fetch suggested team dynamically from database
        const chMappingSql = `
            SELECT sentiment_subcategory, any(stakeholder) AS stakeholder
            FROM stakeholder_mappings
            WHERE company_id = {companyId:String}
            GROUP BY sentiment_subcategory
        `;
        const chMappingRes = await clickhouse.query({
            database: getTargetDb(req),
            query: chMappingSql,
            query_params: { companyId: String(req.companyId) },
            format: 'JSONEachRow'
        });
        const mappings = await chMappingRes.json();
        const teamMap = {};
        mappings.forEach(m => {
            teamMap[m.sentiment_subcategory] = m.stakeholder;
        });

        res.json({
            issue: name,
            suggestedTeam: teamMap[name] || 'Quality / R&D',
            topSkus: skusRows.map(r => ({ ...r, neg: parseInt(r.neg), reviews: parseInt(r.reviews), avg_rating: parseFloat(r.avg_rating) })),
            brandBreakdown: brandsRows.map(r => ({ ...r, reviews: parseInt(r.reviews), avg_rating: parseFloat(r.avg_rating) })),
            monthlyTrend: trendRows.map(r => ({ ...r, month: r.month, reviews: parseInt(r.reviews), avg_rating: parseFloat(r.avg_rating) })),
            sampleVerbatims: samplesRows.map(r => ({ ...r, rating: parseFloat(r.rating) })),
        });
    } catch (err) {
        console.error('issue-drilldown error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// 3) Bulk import for master_category / NPD designation. Accepts JSON body:
//    { rows: [{ web_pid, master_category?, is_npd? }, ...] }
//    Returns per-row status so the UI can show a preview / confirmation.
// ============================================================================

export const getIssueStatuses = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT issue_key, status, updated_by, updated_at
             FROM ratings.issue_statuses WHERE company_id = $1`,
            [req.companyId]
        );
        // Return as a flat map for direct drop-in replacement of the
        // localStorage shape: { [issueKey]: 'open' | 'in_progress' | 'resolved' }.
        const map = {};
        rows.forEach(r => { map[r.issue_key] = r.status; });
        res.json({ statuses: map, rows });
    } catch (err) {
        // Table may not exist on a fresh DB — return empty so the UI
        // degrades gracefully (localStorage still works as a fallback).
        if (/relation .* does not exist/i.test(err.message)) {
            return res.json({ statuses: {}, rows: [] });
        }
        res.status(500).json({ error: err.message });
    }
};

export const createIssueStatus = async (req, res) => {
    try {
        const { issue_key, status } = req.body || {};
        if (!issue_key || typeof issue_key !== 'string') {
            return res.status(400).json({ error: 'issue_key required' });
        }
        if (!['open', 'in_progress', 'resolved'].includes(status)) {
            return res.status(400).json({ error: 'status must be open|in_progress|resolved' });
        }
        const updatedBy = req.authUser?.id || null;
        const { rows } = await pool.query(
            `INSERT INTO ratings.issue_statuses (company_id, issue_key, status, updated_by, updated_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (company_id, issue_key)
             DO UPDATE SET status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = NOW()
             RETURNING *`,
            [req.companyId, issue_key, status, updatedBy]
        );
        res.json({ row: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// COMPETITOR MAPPINGS CRUD
// ============================================================================
