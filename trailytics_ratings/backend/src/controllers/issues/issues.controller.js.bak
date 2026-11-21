import pool from '../../config/db.js';

export const getIssuesBreakdown = async (req, res) => {
    try {
        const { category: filterCategory, pareto_status: filterParetoStatus, rating_bifurcation, platform, date_from, date_to, period_months, price_mode, price_min, price_max, is_competitor, sentiment_category } = req.query;

        // Anchor the default window to the latest DATA date (not CURRENT_DATE) so
        // this tab reconciles with /category-health beside it when ingestion lags.
        // Review-count window anchor. Standardized on CURRENT_DATE (rolling
        // "last N months from today") so EVERY surface — header, category strip,
        // governance cards, benchmark — reports the SAME number. A MAX(review_date)
        // anchor pulled in a ~5.4K review cluster near the year boundary and made
        // the strip/cards read ~26.5K while the header read ~21K.
        const anchorDateExpr = 'CURRENT_DATE';
        const params = [req.companyId];
        let categoryFilter = '';
        let paretoFilter = '';
        let ratingFilter = '';
        let platformFilter = '';
        let dateFilter = '';
        let priceFilter = '';
        let competitorFilter = '';
        let sentimentCategoryFilter = '';

        if (is_competitor === 'true' || is_competitor === 'false') {
            competitorFilter = `AND COALESCE(r.is_competitor, mp.is_competitor, false) = $${params.length + 1}`;
            params.push(is_competitor === 'true');
        } else if (is_competitor === 'all') {
            competitorFilter = '';
        } else {
            // Default to Prestige
            competitorFilter = `AND COALESCE(r.is_competitor, mp.is_competitor, false) = false`;
        }

        if (sentiment_category && sentiment_category !== 'all') {
            sentimentCategoryFilter = `AND r.sentiment_category ILIKE $${params.length + 1}`;
            params.push(sentiment_category);
        }

        if (platform && platform !== 'all') {
            params.push(platform);
            platformFilter = `AND r.platform ILIKE $${params.length}`;
        }
        if (date_from) {
            params.push(date_from);
            dateFilter += ` AND r.review_date >= $${params.length}`;
        }
        if (date_to) {
            params.push(date_to);
            dateFilter += ` AND r.review_date <= $${params.length}`;
        }
        // No explicit range → default window (was previously an all-time scan,
        // inconsistent with /category-health on the same tab).
        if (!date_from && !date_to) {
            const pm = Math.max(1, Math.min(parseInt(period_months) || 6, 24));
            dateFilter += ` AND r.review_date >= (${anchorDateExpr} - INTERVAL '${pm} months')`;
        }

        if (filterCategory) {
            params.push(filterCategory);
            categoryFilter = `AND TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))) ILIKE $${params.length}`;
        }
        if (filterParetoStatus) {
            if (filterParetoStatus === 'Non-Pareto') {
                paretoFilter = `AND (COALESCE(mp.pareto_status, ps.pareto_status, r.pareto_status) NOT IN ('Pareto', 'NPD') OR COALESCE(mp.pareto_status, ps.pareto_status, r.pareto_status) IS NULL)`;
            } else {
                params.push(filterParetoStatus);
                paretoFilter = `AND COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ps.pareto_status, ''), NULLIF(r.pareto_status, '')) = $${params.length}`;
            }
        }
        if (rating_bifurcation === 'NP') {
            ratingFilter = `AND ps.rating >= 4.2`;
        } else if (rating_bifurcation === 'Issue') {
            ratingFilter = `AND ps.rating < 4.0`;
        } else if (rating_bifurcation === 'NI') {
            ratingFilter = `AND ps.rating >= 4.0 AND ps.rating < 4.2`;
        }
        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'COALESCE(ps.price_rp, mp.mrp)'
                : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            params.push(Number(price_min));
            priceFilter += ` AND ${priceExpr} >= $${params.length}`;
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'COALESCE(ps.price_rp, mp.mrp)'
                : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            params.push(Number(price_max));
            priceFilter += ` AND ${priceExpr} <= $${params.length}`;
        }

        // Fetch subcategories for mapping config
        const mappingResult = await pool.query(
            `SELECT sentiment_subcategory, display_label, stakeholder FROM ratings.stakeholder_mappings WHERE company_id = $1`,
            [req.companyId]
        );
        const mappingMap = {};
        mappingResult.rows.forEach(r => { mappingMap[r.sentiment_subcategory] = { label: r.display_label, stakeholder: r.stakeholder }; });

        // The per-row product_snapshots LATERAL (ps) feeds ONLY the category/
        // pareto/rating/price filters. When none are set (the dashboard/pre-warm
        // default) it ran a correlated snapshot lookup for every review row for
        // nothing. Skip it then. mp stays — the competitor fallback needs it.
        const needsSnapshotJoin = !!(filterCategory || filterParetoStatus || rating_bifurcation
            || (price_min !== undefined && price_min !== '') || (price_max !== undefined && price_max !== ''));
        const snapshotJoin = needsSnapshotJoin ? `
            LEFT JOIN LATERAL (
                SELECT
                    ps2.price_rp,
                    ps2.price_sp,
                    ps2.category,
                    ps2.pareto_status,
                    ps2.rating
                FROM ratings.product_snapshots ps2
                WHERE ps2.company_id = r.company_id
                  AND ps2.web_pid = r.web_pid
                  AND LOWER(ps2.platform) = LOWER(r.platform)
                ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
                LIMIT 1
            ) ps ON true` : '';

        const sql = `
            SELECT
                r.sentiment_subcategory,
                COUNT(*) AS total_count,
                COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS negative_count,
                COUNT(DISTINCT r.web_pid) AS sku_count,
                ROUND(AVG(r.rating)::numeric, 2) AS avg_rating
            FROM ratings.reviews r
            LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
            ${snapshotJoin}
            WHERE r.company_id = $1
              ${competitorFilter}
              AND r.sentiment_subcategory IS NOT NULL
              AND r.sentiment_subcategory != ''
              -- Exclude the General_Feedback sink: it's the "no specific aspect"
              -- bucket, not an actionable issue, and otherwise dominates the ranking.
              AND r.sentiment_subcategory != 'General_Feedback'
              ${categoryFilter}
              ${paretoFilter}
              ${ratingFilter}
              ${platformFilter}
              ${dateFilter}
              ${priceFilter}
              ${competitorFilter}
              ${sentimentCategoryFilter}
            GROUP BY r.sentiment_subcategory
            ORDER BY negative_count DESC
        `;

        const { rows } = await pool.query(sql, params);
        
        const issues = rows.map(r => ({
            subcategory: r.sentiment_subcategory,
            label: mappingMap[r.sentiment_subcategory]?.label || r.sentiment_subcategory.replace(/_/g, ' '),
            stakeholder: mappingMap[r.sentiment_subcategory]?.stakeholder || null,
            negativeCount: parseInt(r.negative_count),
            totalCount: parseInt(r.total_count),
            skuCount: parseInt(r.sku_count),
            avgRating: parseFloat(r.avg_rating),
        }));

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
        const { subcategory } = req.query;
        if (!subcategory) return res.status(400).json({ error: 'subcategory param required' });

        const sql = `
            SELECT
                r.web_pid,
                r.product_name,
                MAX(r.pdp_rating) AS pdp_rating,
                COUNT(*) AS review_count,
                COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS negative_count,
                ROUND(AVG(r.rating)::numeric, 2) AS avg_review_rating
            FROM ratings.reviews r
            WHERE r.company_id = $1
              AND r.sentiment_subcategory = $2
              AND (CASE 
                WHEN $3 = 'true' THEN r.is_competitor = true
                WHEN $3 = 'false' THEN r.is_competitor = false
                ELSE true
              END)
            GROUP BY r.web_pid, r.product_name
            ORDER BY negative_count DESC
            LIMIT 200
        `;
        const { is_competitor = 'false' } = req.query;
        const { rows } = await pool.query(sql, [req.companyId, subcategory, is_competitor]);

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

        let orderClause = 'ORDER BY r.review_date DESC NULLS LAST';
        if (sort === 'rating_asc') orderClause = 'ORDER BY r.rating ASC, r.review_date DESC NULLS LAST';
        else if (sort === 'rating_desc') orderClause = 'ORDER BY r.rating DESC, r.review_date DESC NULLS LAST';

        const params = [req.companyId, web_pid, subcategory, parseInt(limit), parseInt(offset), is_competitor];
        let dateFilterMain = '';
        if (date_from) {
            params.push(date_from);
            dateFilterMain += ` AND r.review_date >= $${params.length}`;
        }
        if (date_to) {
            params.push(date_to);
            dateFilterMain += ` AND r.review_date <= $${params.length}`;
        }

        const sql = `
            SELECT
                r.id, r.rating, r.review_title, r.review_text, r.review_date,
                r.reviewer_name, r.is_verified_purchase, r.sentiment,
                r.sentiment_subcategory, r.specific_issue,
                r.sentiment_score, r.quality_score,
                r.product_name, r.pdp_rating,
                mua.id as ml_audit_id, mua.ml_sentiment, mua.ml_issue, mua.ml_category
            FROM ratings.reviews r
            LEFT JOIN ratings.reviews_ml_audit mua ON mua.review_id = r.id AND mua.company_id = r.company_id
            WHERE r.company_id = $1
              AND r.web_pid = $2
              AND r.sentiment_subcategory = $3
              ${dateFilterMain}
              AND (CASE
                WHEN $6 = 'true' THEN r.is_competitor = true
                WHEN $6 = 'false' THEN r.is_competitor = false
                ELSE true
              END)
            ${orderClause}
            LIMIT $4 OFFSET $5
        `;
        const { rows } = await pool.query(sql, params);

        // Count query uses a DIFFERENT params array (no limit/offset), so rebuild the date filter
        // with positions matching countParams ($5, $6) — reusing dateFilterMain's $7/$8 placeholders
        // would crash with "could not determine parameter $7" and hide all reviews behind a 500.
        const countParams = [req.companyId, web_pid, subcategory, is_competitor];
        let dateFilterCount = '';
        if (date_from) {
            countParams.push(date_from);
            dateFilterCount += ` AND r.review_date >= $${countParams.length}`;
        }
        if (date_to) {
            countParams.push(date_to);
            dateFilterCount += ` AND r.review_date <= $${countParams.length}`;
        }

        const countSql = `
            SELECT COUNT(*) FROM ratings.reviews r
            WHERE r.company_id = $1 AND r.web_pid = $2
              AND r.sentiment_subcategory = $3
              ${dateFilterCount}
              AND (CASE
                WHEN $4 = 'true' THEN r.is_competitor = true
                WHEN $4 = 'false' THEN r.is_competitor = false
                ELSE true
              END)
        `;

        const { rows: countRows } = await pool.query(countSql, countParams);

        res.json({
            reviews: rows,
            total: parseInt(countRows[0].count),
            limit,
            offset,
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

        // Get product info
        const productSql = `
            SELECT product_name, rating AS pdp_rating, rating_count, star_distribution
            FROM ratings.product_snapshots
            WHERE company_id = $1 AND web_pid = $2 AND is_competitor = false
            ORDER BY snapshot_date DESC LIMIT 1
        `;
        const { rows: productRows } = await pool.query(productSql, [req.companyId, web_pid]);
        const product = productRows[0] || { product_name: 'Unknown', pdp_rating: null, rating_count: 0, star_distribution: {} };


        // Get issue breakdown
        const issuesSql = `
            SELECT
                r.sentiment_category AS issue_category,
                r.sentiment_subcategory AS issue_type,
                r.specific_issue AS rca,
                COUNT(*) AS total_count,
                COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS negative_count,
                COUNT(*) FILTER (WHERE r.sentiment = 'Positive') AS positive_count,
                ROUND(AVG(r.rating)::numeric, 2) AS avg_rating
            FROM ratings.reviews r
            WHERE r.company_id = $1
              AND r.web_pid = $2
              AND r.is_competitor = false
              AND r.sentiment_subcategory IS NOT NULL
              AND r.sentiment_subcategory != ''
            GROUP BY r.sentiment_category, r.sentiment_subcategory, r.specific_issue
            ORDER BY negative_count DESC, total_count DESC
        `;
        const { rows: issueRows } = await pool.query(issuesSql, [req.companyId, web_pid]);

        // Total reviews for this ASIN
        const totalSql = `
            SELECT
                COUNT(*) AS total,
                ROUND(AVG(rating)::numeric, 2) AS user_rating,
                ROUND(AVG(ml_inferred_rating)::numeric, 2) AS ml_rating
            FROM ratings.reviews
            WHERE company_id = $1 AND web_pid = $2 AND is_competitor = false
        `;
        const { rows: totalRows } = await pool.query(totalSql, [req.companyId, web_pid]);
        const totalReviews = parseInt(totalRows[0]?.total || 0);

        const issues = issueRows.map(r => ({
            issueCategory: r.issue_category || 'General',
            issueType: (r.issue_type || '').replace(/_/g, ' '),
            issueTypeRaw: r.issue_type,
            rca: r.rca || 'Not classified',
            totalCount: parseInt(r.total_count),
            negativeCount: parseInt(r.negative_count),
            positiveCount: parseInt(r.positive_count),
            avgRating: parseFloat(r.avg_rating),
            pctOfTotal: totalReviews > 0 ? Math.round((parseInt(r.total_count) / totalReviews) * 100) : 0,
        }));

        // AI Distribution mapping
        const aiDistSql = `
            SELECT 
                CASE 
                    WHEN quality_score <= 2 THEN '1'
                    WHEN quality_score <= 4 THEN '2'
                    WHEN quality_score <= 6 THEN '3'
                    WHEN quality_score <= 8 THEN '4'
                    ELSE '5' 
                END AS ai_star,
                COUNT(*) as count
            FROM ratings.reviews
            WHERE company_id = $1 AND web_pid = $2 AND is_competitor = false AND quality_score IS NOT NULL
            GROUP BY CASE 
                WHEN quality_score <= 2 THEN '1'
                WHEN quality_score <= 4 THEN '2'
                WHEN quality_score <= 6 THEN '3'
                WHEN quality_score <= 8 THEN '4'
                ELSE '5' 
            END
        `;
        const { rows: aiDistRows } = await pool.query(aiDistSql, [req.companyId, web_pid]);
        const aiDistribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
        let totalAiCount = 0;
        let aiSum = 0;
        aiDistRows.forEach(row => {
            aiDistribution[row.ai_star] = parseInt(row.count);
            totalAiCount += parseInt(row.count);
            aiSum += parseInt(row.count) * parseInt(row.ai_star);
        });
        const aiAvg = totalAiCount > 0 ? aiSum / totalAiCount : null;
        
        let discrepancyFlag = false;
        // high discrepancy fake review detection
        if (product.pdp_rating && parseFloat(product.pdp_rating) >= 4.0 && aiAvg !== null && aiAvg < 3.0) {
            discrepancyFlag = true;
        }

        const platformDistributionStr = product.star_distribution || {};
        const platformDistribution = typeof platformDistributionStr === 'string' ? JSON.parse(platformDistributionStr) : platformDistributionStr;

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
        const where = ['company_id = $1', '(specific_issue = $2 OR sentiment_category = $2 OR sentiment_subcategory = $2)'];
        const params = [req.companyId, name];
        let idx = 3;
        if (platform && platform !== 'all') { where.push(`LOWER(platform) = LOWER($${idx++})`); params.push(platform); }
        if (date_from) { where.push(`review_date >= $${idx++}`); params.push(date_from); }
        if (date_to)   { where.push(`review_date <= $${idx++}`); params.push(date_to); }
        const w = where.join(' AND ');

        const [skus, brands, trend, samples] = await Promise.all([
            // Top affected SKUs
            pool.query(`
                SELECT web_pid, product_name, brand, platform,
                       COUNT(*) AS reviews,
                       ROUND(AVG(rating)::numeric, 2) AS avg_rating,
                       COUNT(*) FILTER (WHERE sentiment = 'Negative') AS neg
                  FROM ratings.reviews
                 WHERE ${w} AND is_competitor = false
                 GROUP BY web_pid, product_name, brand, platform
                 ORDER BY reviews DESC LIMIT 20
            `, params),
            // Brand breakdown (Prestige vs competitors)
            pool.query(`
                SELECT COALESCE(brand, 'Unknown') AS brand, is_competitor,
                       COUNT(*) AS reviews,
                       ROUND(AVG(rating)::numeric, 2) AS avg_rating
                  FROM ratings.reviews
                 WHERE ${w}
                 GROUP BY brand, is_competitor
                 ORDER BY reviews DESC LIMIT 15
            `, params),
            // Monthly trend
            pool.query(`
                SELECT DATE_TRUNC('month', review_date)::date AS month,
                       COUNT(*) AS reviews,
                       ROUND(AVG(rating)::numeric, 2) AS avg_rating
                  FROM ratings.reviews
                 WHERE ${w} AND review_date IS NOT NULL
                 GROUP BY 1 ORDER BY 1 DESC LIMIT 12
            `, params),
            // Sample verbatims (most recent negatives)
            pool.query(`
                SELECT review_text, rating, review_date, brand, web_pid, product_name
                  FROM ratings.reviews
                 WHERE ${w} AND review_text IS NOT NULL
                   AND LENGTH(review_text) > 20 AND rating <= 2
                 ORDER BY review_date DESC NULLS LAST LIMIT 8
            `, params),
        ]);

        // Suggested team — same mapping the email uses.
        const TEAM_MAP = {
            Stopped_Working:'QC', Manufacturing_Defects:'Production', Build_Quality:'Production',
            Cheap_Quality:'Production', Coating_Issues:'Production', Lid_Issues:'Production',
            Handle_Issues:'Production', Whistle_Issues:'QC',
            Gas_Leakage:'QC (Safety)', Steam_Leakage:'QC',
            Heating_Performance:'R&D', Cooking_Performance:'R&D', Motor_Performance:'R&D',
            Poor_Service:'Customer Service',
            Delivery_Issues:'Logistics', Damaged_In_Transit:'Logistics',
            Overpriced:'Marketing',
        };
        res.json({
            issue: name,
            suggestedTeam: TEAM_MAP[name] || 'Quality / R&D',
            topSkus: skus.rows,
            brandBreakdown: brands.rows,
            monthlyTrend: trend.rows,
            sampleVerbatims: samples.rows,
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

