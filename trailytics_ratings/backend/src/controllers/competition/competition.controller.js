import pool from '../../config/db.js';

export const getCompetitorMentions = async (req, res) => {
    try {
        const { brand, platform, date_from, date_to, limit = 100 } = req.query;
        const params = [req.companyId];
        const where = ['company_id = $1'];
        let idx = 2;
        if (brand)     { where.push(`LOWER(brand) = LOWER($${idx++})`); params.push(brand); }
        if (platform)  { where.push(`LOWER(platform) = LOWER($${idx++})`); params.push(platform); }
        if (date_from) { where.push(`review_date >= $${idx++}`);     params.push(date_from); }
        if (date_to)   { where.push(`review_date <= $${idx++}`);     params.push(date_to); }
        // Default to a 6-month window like the rest of the dashboard, so undated /
        // ancient rows don't fold into an all-time headline.
        if (!date_from && !date_to) { where.push(`review_date >= (CURRENT_DATE - INTERVAL '6 months')`); }
        const whereSql = where.join(' AND ');

        const [agg, sample] = await Promise.all([
            pool.query(`
                -- Collapse case-variant brand rows (e.g. 'hawkins' + 'Hawkins') that the
                -- scanner stored verbatim, and de-dupe the same review counted under both
                -- variants: group on LOWER(brand) and count DISTINCT review_id (not COUNT(*)).
                SELECT LOWER(brand) AS brand,
                       COUNT(DISTINCT review_id) AS total,
                       COUNT(DISTINCT review_id) FILTER (WHERE is_favorable) AS favorable,
                       COUNT(DISTINCT review_id) FILTER (WHERE sentiment = 'Negative' AND NOT is_favorable) AS unfavorable,
                       COUNT(DISTINCT review_id) FILTER (WHERE NOT is_favorable AND sentiment <> 'Negative') AS neutral
                FROM ratings.competitor_mentions
                WHERE ${whereSql}
                GROUP BY LOWER(brand)
                ORDER BY total DESC
            `, params),
            pool.query(`
                SELECT id, review_id, web_pid, platform, brand, context, sentiment,
                       is_favorable, review_date, review_rating, scanned_at
                FROM ratings.competitor_mentions
                WHERE ${whereSql}
                ORDER BY review_date DESC NULLS LAST, id DESC
                LIMIT $${idx}
            `, [...params, Math.min(parseInt(limit, 10) || 100, 500)]),
        ]);

        const total = agg.rows.reduce((s, r) => s + parseInt(r.total, 10), 0);
        res.json({
            total,
            byBrand: agg.rows.map(r => ({
                brand: r.brand,
                total: parseInt(r.total, 10),
                favorable: parseInt(r.favorable, 10),
                unfavorable: parseInt(r.unfavorable, 10),
                neutral: parseInt(r.neutral, 10),
                favorableRate: parseInt(r.total, 10) > 0 ? parseInt(r.favorable, 10) / parseInt(r.total, 10) : 0,
            })),
            sample: sample.rows.map(r => ({
                id: r.id,
                reviewId: r.review_id,
                brand: r.brand,
                context: r.context,
                sentiment: r.sentiment,
                isFavorable: r.is_favorable,
                reviewDate: r.review_date,
                reviewRating: r.review_rating,
                webPid: r.web_pid,
                platform: r.platform,
            })),
        });
    } catch (err) {
        console.error('competitor-mentions error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// PATCH /api/ratings/products/:id/pareto-status — manual classification override
// Lets admins flip a SKU between Pareto / Non-Pareto / NPD from the master table.
// normalizePareto() in sync_mysql_master.cjs already preserves NPD across syncs.
// ============================================================================

export const getCompetitorMatrix = async (req, res) => {
    try {
        const { platform, category, date_from, date_to, period_months } = req.query;
        let where = ['company_id = $1'];
        let params = [req.companyId];
        let idx = 2;

        if (platform && platform !== 'all') { where.push(`platform ILIKE $${idx++}`); params.push(platform); }
        if (category) { where.push(`category ILIKE $${idx++}`); params.push(category); }
        if (date_from) { where.push(`review_date >= $${idx++}`); params.push(date_from); }
        if (date_to) { where.push(`review_date <= $${idx++}`); params.push(date_to); }
        // Default 6-month window when no explicit dates — the Competition tab used
        // to show ALL-TIME here (no date filter), so it never matched the exec's
        // 6-month pull. Mirrors the window used by summary/category-health/etc.
        if (!date_from && !date_to) {
            const pm = Math.max(1, Math.min(parseInt(period_months, 10) || 6, 24));
            where.push(`review_date >= CURRENT_DATE - INTERVAL '${pm} months'`);
        }

        const sql = `
            SELECT
                INITCAP(LOWER(brand)) AS brand,
                is_competitor,
                COUNT(*) as total_reviews,
                ROUND(AVG(rating)::numeric, 2) as avg_rating,
                ROUND(AVG(quality_score)::numeric, 2) as avg_quality,
                category as primary_category
            FROM ratings.reviews
            WHERE ${where.join(' AND ')}
            GROUP BY INITCAP(LOWER(brand)), is_competitor, category
            ORDER BY total_reviews DESC
            LIMIT 50
        `;
        
        const { rows } = await pool.query(sql, params);
        res.json({ success: true, matrix: rows });
    } catch (err) {
        console.error('Competitor Matrix error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// GET /api/ratings/product-health — Product health scores (server-side)
// ============================================================================

export const getCompetitorMappings = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                MIN(id) AS id,
                our_sku,
                our_product_name,
                our_category AS shared_category,
                json_agg(
                    json_build_object(
                        'sku', comp_sku,
                        'productName', comp_product_name,
                        'brand', comp_brand,
                        'mappingType', match_type
                    )
                    ORDER BY comp_brand, comp_product_name
                ) AS competitors
            FROM ratings.competitor_mapping_pairs
            WHERE company_id = $1
            GROUP BY our_sku, our_product_name, our_category
            ORDER BY our_category, our_product_name
        `, [req.companyId]);
        res.json({ mappings: rows });
    } catch (err) {
        console.error('Fetch competitor-mappings error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const createCompetitorMapping = async (req, res) => {
    try {
        const { our_sku, our_product_name, shared_category, competitors } = req.body;
        const inserted = [];
        for (const competitor of competitors || []) {
            const { rows } = await pool.query(`
                INSERT INTO ratings.competitor_mapping_pairs (
                    company_id, our_sku, our_product_name, our_category,
                    comp_brand, comp_sku, comp_product_name,
                    match_type, notes
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                RETURNING *
            `, [
                req.companyId,
                our_sku,
                our_product_name,
                shared_category,
                competitor.brand || null,
                competitor.sku || null,
                competitor.productName || null,
                competitor.mappingType || 'PEER',
                null,
            ]);
            inserted.push(rows[0]);
        }
        res.json({ mapping: { id: inserted[0]?.id || null, our_sku, our_product_name, shared_category, competitors: competitors || [] } });
    } catch (err) {
        console.error('Create competitor-mapping error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const updateCompetitorMapping = async (req, res) => {
    try {
        const { id } = req.params;
        const { our_sku, our_product_name, shared_category, competitors } = req.body;
        const lookup = await pool.query(`
            SELECT our_sku
            FROM ratings.competitor_mapping_pairs
            WHERE id = $1 AND company_id = $2
        `, [id, req.companyId]);
        const targetSku = lookup.rows[0]?.our_sku || our_sku;

        await pool.query(`
            DELETE FROM ratings.competitor_mapping_pairs
            WHERE company_id = $1 AND our_sku = $2
        `, [req.companyId, targetSku]);

        const inserted = [];
        for (const competitor of competitors || []) {
            const { rows } = await pool.query(`
                INSERT INTO ratings.competitor_mapping_pairs (
                    company_id, our_sku, our_product_name, our_category,
                    comp_brand, comp_sku, comp_product_name,
                    match_type, notes
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                RETURNING *
            `, [
                req.companyId,
                our_sku,
                our_product_name,
                shared_category,
                competitor.brand || null,
                competitor.sku || null,
                competitor.productName || null,
                competitor.mappingType || 'PEER',
                null,
            ]);
            inserted.push(rows[0]);
        }
        res.json({ mapping: { id: inserted[0]?.id || id, our_sku, our_product_name, shared_category, competitors: competitors || [] } });
    } catch (err) {
        console.error('Update competitor-mapping error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const deleteCompetitorMapping = async (req, res) => {
    try {
        const { id } = req.params;
        const lookup = await pool.query(`
            SELECT our_sku
            FROM ratings.competitor_mapping_pairs
            WHERE id = $1 AND company_id = $2
        `, [id, req.companyId]);
        const targetSku = lookup.rows[0]?.our_sku;
        if (targetSku) {
            await pool.query(`
                DELETE FROM ratings.competitor_mapping_pairs
                WHERE company_id = $1 AND our_sku = $2
            `, [req.companyId, targetSku]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Delete competitor-mapping error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// COMPETITOR MAPPING PAIRS — Flat table CRUD (industry-standard)
// ============================================================================

// GET /api/ratings/competitor-mapping-types — Match type config for dropdowns

export const getCompetitorMappingTypes = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT code, label, color, sort_order FROM ratings.competitor_mapping_types
             WHERE company_id = $1 ORDER BY sort_order`, [req.companyId]
        );
        res.json({ types: rows });
    } catch (err) {
        console.error('competitor-mapping-types error:', err);
        res.status(500).json({ error: err.message });
    }
};

// GET /api/ratings/competitor-mapping-options — Distinct filter options

export const getCompetitorMappingOptions = async (req, res) => {
    try {
        const catRes = await pool.query(`SELECT DISTINCT our_category FROM ratings.competitor_mapping_pairs WHERE company_id = $1 AND our_category IS NOT NULL ORDER BY our_category`, [req.companyId]);
        const brandRes = await pool.query(`SELECT DISTINCT comp_brand FROM ratings.competitor_mapping_pairs WHERE company_id = $1 AND comp_brand IS NOT NULL ORDER BY comp_brand`, [req.companyId]);
        res.json({
            categories: catRes.rows.map(r => r.our_category),
            brands: brandRes.rows.map(r => r.comp_brand)
        });
    } catch (err) {
        console.error('competitor-mapping-options error:', err);
        res.status(500).json({ error: err.message });
    }
};

// GET /api/ratings/competitor-mapping-pairs — List all flat pairs with filters

export const getCompetitorMappingPairs = async (req, res) => {
    try {
        const { search, category, brand, match_type, page = '1', limit = '50' } = req.query;
        const conditions = [`p.company_id = $1`];
        const params = [req.companyId];
        let idx = 2;

        if (search) {
            conditions.push(`(p.our_sku ILIKE $${idx} OR p.our_product_name ILIKE $${idx} OR p.comp_brand ILIKE $${idx} OR p.comp_sku ILIKE $${idx} OR p.comp_product_name ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }
        if (category) {
            conditions.push(`p.our_category = $${idx}`);
            params.push(category);
            idx++;
        }
        if (brand) {
            conditions.push(`p.comp_brand = $${idx}`);
            params.push(brand);
            idx++;
        }
        if (match_type) {
            conditions.push(`p.match_type = $${idx}`);
            params.push(match_type);
            idx++;
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Count query
        const countRes = await pool.query(
            `SELECT COUNT(*) FROM ratings.competitor_mapping_pairs p WHERE ${conditions.join(' AND ')}`, params
        );
        const total = parseInt(countRes.rows[0].count);

        // Data query
        const { rows } = await pool.query(
            `SELECT p.id, p.our_sku, p.our_product_name, p.our_category, p.our_material, p.our_wattage, p.our_platform,
                    p.comp_brand, p.comp_sku, p.comp_product_name, p.comp_category, p.comp_material, p.comp_wattage, p.comp_platform,
                    p.match_type, p.is_active, p.notes, p.created_at
             FROM ratings.competitor_mapping_pairs p
             WHERE ${conditions.join(' AND ')}
             ORDER BY p.our_category, p.our_sku, p.comp_brand
             LIMIT $${idx} OFFSET $${idx + 1}`,
            [...params, parseInt(limit), offset]
        );

        res.json({ pairs: rows, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error('competitor-mapping-pairs list error:', err);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/ratings/competitor-mapping-pairs — Create a new mapping

export const createCompetitorMappingPair = async (req, res) => {
    try {
        const { our_sku, our_product_name, our_category, our_material, our_wattage, our_platform,
                comp_brand, comp_sku, comp_product_name, comp_category, comp_material, comp_wattage, comp_platform,
                match_type, notes } = req.body;

        const { rows } = await pool.query(
            `INSERT INTO ratings.competitor_mapping_pairs
             (company_id, our_sku, our_product_name, our_category, our_material, our_wattage, our_platform,
              comp_brand, comp_sku, comp_product_name, comp_category, comp_material, comp_wattage, comp_platform,
              match_type, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
             RETURNING *`,
            [req.companyId, our_sku, our_product_name, our_category, our_material, our_wattage, our_platform || 'amazon',
             comp_brand, comp_sku, comp_product_name, comp_category, comp_material, comp_wattage, comp_platform || 'amazon',
             match_type || 'PEER', notes]
        );
        res.json({ pair: rows[0] });
    } catch (err) {
        console.error('competitor-mapping-pairs create error:', err);
        res.status(500).json({ error: err.message });
    }
};

// PUT /api/ratings/competitor-mapping-pairs/:id — Update a mapping

export const updateCompetitorMappingPair = async (req, res) => {
    try {
        const { id } = req.params;
        const fields = req.body;
        const setClauses = [];
        const params = [];
        let idx = 1;

        const allowedFields = ['our_sku','our_product_name','our_category','our_material','our_wattage','our_platform',
                                'comp_brand','comp_sku','comp_product_name','comp_category','comp_material','comp_wattage','comp_platform',
                                'match_type','is_active','notes'];

        for (const f of allowedFields) {
            if (fields[f] !== undefined) {
                setClauses.push(`${f} = $${idx}`);
                params.push(fields[f]);
                idx++;
            }
        }
        setClauses.push(`updated_at = NOW()`);

        params.push(id);
        params.push(req.companyId);

        const { rows } = await pool.query(
            `UPDATE ratings.competitor_mapping_pairs SET ${setClauses.join(', ')}
             WHERE id = $${idx} AND company_id = $${idx + 1} RETURNING *`, params
        );
        res.json({ pair: rows[0] });
    } catch (err) {
        console.error('competitor-mapping-pairs update error:', err);
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/ratings/competitor-mapping-pairs/:id — Delete a mapping

export const deleteCompetitorMappingPair = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(
            `DELETE FROM ratings.competitor_mapping_pairs WHERE id = $1 AND company_id = $2`,
            [id, req.companyId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('competitor-mapping-pairs delete error:', err);
        res.status(500).json({ error: err.message });
    }
};

// GET /api/ratings/competitor-mapping-pairs/export — CSV export

export const exportCompetitorMappingPairs = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT p.our_sku, p.our_product_name, p.our_category, p.our_material, p.our_wattage, p.our_platform,
                    p.comp_brand, p.comp_sku, p.comp_product_name, p.comp_category, p.comp_material, p.comp_wattage, p.comp_platform,
                    p.match_type, p.notes
             FROM ratings.competitor_mapping_pairs p
             WHERE p.company_id = $1 AND p.is_active = true
             ORDER BY p.our_category, p.our_sku, p.comp_brand`,
            [req.companyId]
        );

        // Build CSV
        const headers = ['Our SKU','Our Product','Our Category','Our Material','Our Wattage','Our Platform',
                          'Comp Brand','Comp SKU','Comp Product','Comp Category','Comp Material','Comp Wattage','Comp Platform',
                          'Match Type','Notes'];
        const csvRows = [headers.join(',')];
        for (const r of rows) {
            csvRows.push(Object.values(r).map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=competitor_mappings.csv');
        res.send(csvRows.join('\n'));
    } catch (err) {
        console.error('competitor-mapping-pairs export error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// GET /api/ratings/sentiment-categories — Derived from actual review data
// ============================================================================

export const getCompetitorBrands = async (req, res) => {
    try {
        // Defensive filter: legacy text-extraction left junk like "The", "not",
        // "Gas", "Extracted" in ratings.reviews.brand for thousands of rows.
        // Constrain to brands that look real: >= 3 chars, not in a stop-word
        // list, and present on at least 3 reviews (to drop one-off noise).
        const { rows } = await pool.query(
            `SELECT brand FROM (
                SELECT INITCAP(LOWER(brand)) AS brand, COUNT(*) n FROM ratings.reviews
                WHERE company_id = $1 AND is_competitor = true
                  AND brand IS NOT NULL AND brand != ''
                  AND LENGTH(brand) >= 3
                  AND LOWER(brand) NOT IN ('the','not','and','gas','extracted','none','null','n/a','other','unknown','etc','for','was','were','our','your','its')
                GROUP BY INITCAP(LOWER(brand))
                HAVING COUNT(*) >= 3
            ) t ORDER BY brand ASC`,
            [req.companyId]
        );
        res.json({ brands: rows.map(r => r.brand) });
    } catch (err) {
        console.error('Competitor-brands error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// GET /api/ratings/spec-type-mappings — From category_rules.spec_type column
// ============================================================================

