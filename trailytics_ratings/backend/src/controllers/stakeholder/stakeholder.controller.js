import pool from '../../config/db.js';

export const getStakeholderDetail = async (req, res) => {
    try {
        const { stakeholder, category: filterCategory, pareto_status: filterParetoStatus, rating_bifurcation, platform, date_from, date_to, price_mode, price_min, price_max, sentiment_category } = req.query;
        if (!stakeholder) return res.status(400).json({ error: 'stakeholder param required' });

        const mappingResult = await pool.query(
            `SELECT sentiment_subcategory, display_label FROM ratings.stakeholder_mappings 
             WHERE company_id = $1 AND stakeholder = $2 ORDER BY sort_order`,
            [req.companyId, stakeholder]
        );
        const subcategories = mappingResult.rows.map(r => r.sentiment_subcategory);
        const labelMap = {};
        mappingResult.rows.forEach(r => { labelMap[r.sentiment_subcategory] = r.display_label; });

        if (subcategories.length === 0) return res.json({ issues: [] });

        const params = [req.companyId, ...subcategories];
        const subPlaceholders = subcategories.map((_, i) => `$${i + 2}`).join(',');

        let categoryFilter = '';
        let paretoFilter = '';
        let ratingFilter = '';
        let platformFilter = '';
        let dateFilter = '';
        let priceFilter = '';
        let sentimentCategoryFilter = '';

        if (sentiment_category && sentiment_category !== 'all') {
            params.push(sentiment_category);
            sentimentCategoryFilter = `AND r.sentiment_category ILIKE $${params.length}`;
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

        const sql = `
            WITH latest_snapshots AS (
                SELECT DISTINCT ON (web_pid, LOWER(platform))
                    web_pid, platform, price_rp, price_sp, category, pareto_status, rating
                FROM ratings.product_snapshots
                WHERE company_id = $1
                ORDER BY web_pid, LOWER(platform), snapshot_date DESC, created_at DESC NULLS LAST
            ),
            sku_issues AS (
                SELECT
                    r.sentiment_subcategory,
                    r.web_pid,
                    MAX(r.product_name) AS product_name,
                    MAX(ps.rating) AS pdp_rating,
                    COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS neg_count,
                    COUNT(*) AS total_count
                FROM ratings.reviews r
                LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
                LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND LOWER(ps.platform) = LOWER(r.platform)
                WHERE r.company_id = $1
                  AND (CASE
                    WHEN $${params.length + 1} = 'true' THEN r.is_competitor = true
                    WHEN $${params.length + 1} = 'false' THEN r.is_competitor = false
                    ELSE true
                  END)
                  AND r.sentiment_subcategory IN (${subPlaceholders})
                  ${categoryFilter}
                  ${paretoFilter}
                  ${ratingFilter}
                  ${platformFilter}
                  ${dateFilter}
                  ${priceFilter}
                  ${sentimentCategoryFilter}
                GROUP BY r.sentiment_subcategory, r.web_pid
            )
            SELECT
                sentiment_subcategory,
                SUM(neg_count)::int AS negative_count,
                SUM(total_count)::int AS total_count,
                COUNT(DISTINCT web_pid)::int AS sku_count,
                json_agg(json_build_object(
                    'web_pid', web_pid,
                    'product_name', product_name,
                    'pdp_rating', pdp_rating,
                    'negCount', neg_count,
                    'totalCount', total_count
                ) ORDER BY neg_count DESC) AS skus
            FROM sku_issues
            GROUP BY sentiment_subcategory
            ORDER BY SUM(neg_count) DESC
        `;

        const { is_competitor = 'false' } = req.query;
        params.push(is_competitor);
        const { rows } = await pool.query(sql, params);
        const issues = rows.map(r => ({
            subcategory: r.sentiment_subcategory,
            label: labelMap[r.sentiment_subcategory] || r.sentiment_subcategory.replace(/_/g, ' '),
            negativeCount: r.negative_count,
            totalCount: r.total_count,
            skuCount: r.sku_count,
            skus: r.skus.map(s => ({
                web_pid: s.web_pid,
                product_name: s.product_name,
                pdp_rating: s.pdp_rating ? parseFloat(s.pdp_rating) : null,
                negCount: parseInt(s.negCount),
                totalCount: parseInt(s.totalCount),
            })),
        }));
        
        const uniqueSkuCount = new Set(
            issues.flatMap(issue => issue.skus.map(sku => sku.web_pid)).filter(Boolean)
        ).size;

        res.json({ issues, uniqueSkuCount });
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

