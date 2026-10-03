import pool from '../../config/db.js';
import clickhouse from '../../config/clickhouse.js';

const getTargetDb = (req) => {
    return req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] || (req.authUser && req.authUser.dbName) || process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || 'prestige';
};

export const getStakeholderDetail = async (req, res) => {
    try {
        const { stakeholder, category: filterCategory, pareto_status: filterParetoStatus, rating_bifurcation, platform, date_from, date_to, price_mode, price_min, price_max, sentiment_category, web_pid, brand } = req.query;
        if (!stakeholder) return res.status(400).json({ error: 'stakeholder param required' });

        const chMappingSql = `
            SELECT sentiment_subcategory, any(display_label) AS display_label, any(stakeholder) AS stakeholder
            FROM stakeholder_mappings
            WHERE company_id = {companyId:String} AND stakeholder_mappings.stakeholder = {stakeholder:String}
            GROUP BY sentiment_subcategory
        `;
        const chMappingRes = await clickhouse.query({
            database: getTargetDb(req),
            query: chMappingSql,
            query_params: { companyId: String(req.companyId), stakeholder },
            format: 'JSONEachRow'
        });
        const mappingRows = await chMappingRes.json();
        const subcategories = mappingRows
            .map(r => r.sentiment_subcategory)
            .filter(s => s !== 'General_Feedback');
        console.log('Subcategories:', subcategories, 'for companyId:', req.companyId, 'stakeholder:', stakeholder);
        const labelMap = {};
        mappingRows.forEach(r => { labelMap[r.sentiment_subcategory] = r.display_label; });

        if (subcategories.length === 0) return res.json({ issues: [] });

        const queryParams = { companyId: String(req.companyId), subcategories };
        let extraFilters = [];

        if (sentiment_category && sentiment_category !== 'all') {
            queryParams.sentimentCategory = sentiment_category;
            extraFilters.push(`ilike(r.sentiment_category, {sentimentCategory:String})`);
        }

        if (platform && platform !== 'all') {
            queryParams.platform = platform;
            extraFilters.push(`ilike(r.platform, {platform:String})`);
        }
        if (brand && brand !== 'all') {
            queryParams.brand = brand;
            extraFilters.push(`ilike(r.brand, {brand:String})`);
        }
        if (date_from) {
            queryParams.dateFrom = date_from;
            extraFilters.push(`r.review_date >= toDate({dateFrom:String})`);
        }
        if (date_to) {
            queryParams.dateTo = date_to;
            extraFilters.push(`r.review_date <= toDate({dateTo:String})`);
        }
        if (!date_from && !date_to) {
            const pm = Math.max(1, Math.min(parseInt(req.query.period_months, 10) || 6, 24));
            extraFilters.push(`r.review_date >= addMonths(today(), -${pm})`);
        }
        if (filterCategory) {
            queryParams.filterCategory = filterCategory;
            extraFilters.push(`ilike(trim(coalesce(nullIf(ps.category, ''), nullIf(r.category, ''), nullIf(mp.category, ''))), {filterCategory:String})`);
        }
        if (filterParetoStatus) {
            if (filterParetoStatus === 'Non-Pareto') {
                extraFilters.push(`(coalesce(mp.pareto_status, ps.pareto_status, r.pareto_status) NOT IN ('Pareto', 'NPD') OR coalesce(mp.pareto_status, ps.pareto_status, r.pareto_status) IS NULL)`);
            } else {
                queryParams.filterParetoStatus = filterParetoStatus;
                extraFilters.push(`coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) = {filterParetoStatus:String}`);
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
            queryParams.priceMin = Number(price_min);
            extraFilters.push(`${priceExpr} >= {priceMin:Float64}`);
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            queryParams.priceMax = Number(price_max);
            extraFilters.push(`${priceExpr} <= {priceMax:Float64}`);
        }

        const { is_competitor = 'false' } = req.query;
        if (is_competitor === 'true') extraFilters.push(`coalesce(r.is_competitor, false) = true`);
        else if (is_competitor === 'false') extraFilters.push(`coalesce(r.is_competitor, false) = false`);

        if (web_pid) {
            queryParams.webPid = String(web_pid);
            extraFilters.push(`r.web_pid = {webPid:String}`);
        }

        const extraWhere = extraFilters.length > 0 ? `AND ${extraFilters.join(' AND ')}` : '';

        const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, category, pareto_status, rating, price_rp, price_sp
                    FROM product_snapshots
                    WHERE company_id = {companyId:String}
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY web_pid, lower(platform)
            )
            SELECT
                r.sentiment_subcategory,
                r.web_pid AS web_pid,
                any(r.product_name) AS product_name,
                any(ps.rating) AS pdp_rating,
                countIf(r.sentiment = 'Negative') AS neg_count,
                countIf(r.sentiment = 'Positive') AS pos_count,
                round(avg(r.rating), 1) AS issue_rating,
                count() AS total_count
            FROM ml_reviews r
            LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
            LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND lower(ps.platform) = lower(r.platform)
            WHERE r.company_id = {companyId:String}
              AND r.sentiment_subcategory IN ({subcategories:Array(String)})
              ${extraWhere}
            GROUP BY r.sentiment_subcategory, r.web_pid
        `;

        const chRes = await clickhouse.query({
            database: getTargetDb(req),
            query: sql,
            query_params: queryParams,
            format: 'JSONEachRow'
        });
        const rows = await chRes.json();

        const subcatMap = {};
        const uniqueSkus = new Set();

        rows.forEach(r => {
            if (!subcatMap[r.sentiment_subcategory]) {
                subcatMap[r.sentiment_subcategory] = {
                    subcategory: r.sentiment_subcategory,
                    label: labelMap[r.sentiment_subcategory] || r.sentiment_subcategory.replace(/_/g, ' '),
                    negativeCount: 0,
                    positiveCount: 0,
                    totalCount: 0,
                    skuCount: 0,
                    skus: []
                };
            }

            subcatMap[r.sentiment_subcategory].negativeCount += parseInt(r.neg_count || 0);
            subcatMap[r.sentiment_subcategory].positiveCount += parseInt(r.pos_count || 0);
            subcatMap[r.sentiment_subcategory].totalCount += parseInt(r.total_count || 0);

            uniqueSkus.add(r.web_pid);

            subcatMap[r.sentiment_subcategory].skus.push({
                web_pid: r.web_pid,
                product_name: r.product_name,
                pdp_rating: r.pdp_rating !== null ? parseFloat(r.pdp_rating) : null,
                issue_rating: r.issue_rating !== null ? parseFloat(r.issue_rating) : null,
                negCount: parseInt(r.neg_count || 0),
                posCount: parseInt(r.pos_count || 0),
                totalCount: parseInt(r.total_count || 0)
            });
        });

        const issues = Object.values(subcatMap)
            .filter(issue => issue.negativeCount > 0)
            .map(issue => {
                issue.skuCount = issue.skus.length;
                issue.skus.sort((a, b) => b.negCount - a.negCount);
                return issue;
            }).sort((a, b) => b.negativeCount - a.negativeCount);

        res.json({ issues, uniqueSkuCount: uniqueSkus.size });
    } catch (err) {
        console.error('Stakeholder detail error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getStakeholderMappings = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, sentiment_subcategory, stakeholder, display_label, sort_order
             FROM ratings.stakeholder_mappings
             WHERE company_id = $1
             ORDER BY stakeholder NULLS LAST, sort_order, sentiment_subcategory`,
            [req.companyId]
        );
        // Group by stakeholder for convenient client consumption.
        const grouped = {};
        for (const r of rows) {
            const sh = r.stakeholder || '_unassigned';
            if (!grouped[sh]) grouped[sh] = { stakeholder: r.stakeholder, subcategories: [], display_labels: {} };
            grouped[sh].subcategories.push(r.sentiment_subcategory);
            if (r.display_label) grouped[sh].display_labels[r.sentiment_subcategory] = r.display_label;
        }
        res.json({ mappings: rows, grouped });
    } catch (err) {
        console.error('Get stakeholder-mappings error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const createStakeholderMapping = async (req, res) => {
    try {
        const { sentiment_subcategory, stakeholder, display_label, sort_order } = req.body;
        if (!sentiment_subcategory || typeof sentiment_subcategory !== 'string') {
            return res.status(400).json({ error: 'sentiment_subcategory is required' });
        }
        const cleanedStakeholder = stakeholder && String(stakeholder).trim() !== '' ? String(stakeholder).trim() : null;
        // Only overwrite stakeholder when the caller actually sent the key — a
        // label-only POST must not null out an existing stakeholder assignment.
        const stakeholderProvided = Object.prototype.hasOwnProperty.call(req.body, 'stakeholder');
        const cleanedLabel = display_label && String(display_label).trim() !== '' ? String(display_label).trim() : null;
        const order = Number.isFinite(parseInt(sort_order, 10)) ? parseInt(sort_order, 10) : 0;

        // Two-query upsert (no unique constraint guaranteed on the table).
        const existing = await pool.query(
            `SELECT id FROM ratings.stakeholder_mappings WHERE company_id = $1 AND sentiment_subcategory = $2 LIMIT 1`,
            [req.companyId, sentiment_subcategory]
        );
        let row;
        if (existing.rows.length > 0) {
            const { rows } = await pool.query(
                `UPDATE ratings.stakeholder_mappings
                 SET stakeholder = CASE WHEN $6 THEN $1 ELSE stakeholder END,
                     display_label = COALESCE($2, display_label),
                     sort_order = $3
                 WHERE id = $4 AND company_id = $5
                 RETURNING *`,
                [cleanedStakeholder, cleanedLabel, order, existing.rows[0].id, req.companyId, stakeholderProvided]
            );
            row = rows[0];
        } else {
            const { rows } = await pool.query(
                `INSERT INTO ratings.stakeholder_mappings
                   (company_id, sentiment_subcategory, stakeholder, display_label, sort_order)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [req.companyId, sentiment_subcategory, cleanedStakeholder, cleanedLabel || sentiment_subcategory, order]
            );
            row = rows[0];
        }
        res.json({ mapping: row });
    } catch (err) {
        console.error('Upsert stakeholder-mapping error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const deleteStakeholderMapping = async (req, res) => {
    try {
        const { rowCount } = await pool.query(
            `DELETE FROM ratings.stakeholder_mappings WHERE id = $1 AND company_id = $2`,
            [req.params.id, req.companyId]
        );
        if (rowCount === 0) return res.status(404).json({ error: 'Mapping not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

