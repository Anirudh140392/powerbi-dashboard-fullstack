import pool from '../../config/db.js';
import clickhouse from '../../config/clickhouse.js';

const getTargetDb = (req) => {
    return req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] || (req.authUser && req.authUser.dbName) || process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || 'prestige';
};

export const getCompetitorMentions = async (req, res) => {
    try {
        const { brand, platform, date_from, date_to, limit = 100 } = req.query;
        const companyId = req.query.company_id || req.query.companyId || req.companyId;
        if (!companyId) {
            return res.status(400).json({ error: 'Company ID required' });
        }
        const queryParams = { companyId: String(companyId) };
        const where = ['company_id = {companyId:String}'];
        
        if (brand)     { where.push(`lower(brand) = lower({brand:String})`); queryParams.brand = brand; }
        if (platform)  { where.push(`lower(platform) = lower({platform:String})`); queryParams.platform = platform; }
        if (date_from) { where.push(`review_date >= toDate({dateFrom:String})`); queryParams.dateFrom = date_from; }
        if (date_to)   { where.push(`review_date <= toDate({dateTo:String})`); queryParams.dateTo = date_to; }
        if (!date_from && !date_to) { where.push(`review_date >= subtractMonths(today(), 6)`); }
        
        const whereSql = where.join(' AND ');
        const targetLimit = Math.min(parseInt(limit, 10) || 100, 500);
        queryParams.limit = targetLimit;

        const aggQuery = `
            SELECT lower(brand) AS brand,
                   uniqExact(review_id) AS total,
                   uniqExactIf(review_id, is_favorable = 1) AS favorable,
                   uniqExactIf(review_id, sentiment = 'Negative' AND is_favorable = 0) AS unfavorable,
                   uniqExactIf(review_id, is_favorable = 0 AND sentiment != 'Negative') AS neutral
            FROM competitor_mentions
            WHERE ${whereSql}
            GROUP BY brand
            ORDER BY total DESC
        `;
        
        const sampleQuery = `
            SELECT id, review_id, web_pid, platform, brand, context, sentiment,
                   is_favorable, review_date, review_rating, scanned_at
            FROM competitor_mentions
            WHERE ${whereSql}
            ORDER BY review_date DESC NULLS LAST, id DESC
            LIMIT {limit:Int32}
        `;

        const [aggRes, sampleRes] = await Promise.all([
            clickhouse.query({ database: getTargetDb(req), query: aggQuery, query_params: queryParams, format: 'JSONEachRow' }),
            clickhouse.query({ database: getTargetDb(req), query: sampleQuery, query_params: queryParams, format: 'JSONEachRow' }),
        ]);

        const aggRows = await aggRes.json();
        const sampleRows = await sampleRes.json();

        const total = aggRows.reduce((s, r) => s + parseInt(r.total, 10), 0);
        res.json({
            total,
            byBrand: aggRows.map(r => ({
                brand: r.brand,
                total: parseInt(r.total, 10),
                favorable: parseInt(r.favorable, 10),
                unfavorable: parseInt(r.unfavorable, 10),
                neutral: parseInt(r.neutral, 10),
                favorableRate: parseInt(r.total, 10) > 0 ? parseInt(r.favorable, 10) / parseInt(r.total, 10) : 0,
            })),
            sample: sampleRows.map(r => ({
                id: r.id,
                reviewId: r.review_id,
                brand: r.brand,
                context: r.context,
                sentiment: r.sentiment,
                isFavorable: r.is_favorable === 1 || r.is_favorable === true,
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
        const companyId = req.query.company_id || req.query.companyId || req.companyId;
        if (!companyId) {
            return res.status(400).json({ error: 'Company ID required' });
        }
        const queryParams = { companyId: String(companyId) };
        let where = ['company_id = {companyId:String}'];

        if (platform && platform !== 'all') { where.push(`ilike(platform, {platform:String})`); queryParams.platform = platform; }
        if (category) { where.push(`ilike(category, {category:String})`); queryParams.category = category; }
        if (date_from) { where.push(`review_date >= toDate({dateFrom:String})`); queryParams.dateFrom = date_from; }
        if (date_to) { where.push(`review_date <= toDate({dateTo:String})`); queryParams.dateTo = date_to; }
        
        if (!date_from && !date_to) {
            const pm = Math.max(1, Math.min(parseInt(period_months, 10) || 6, 24));
            where.push(`review_date >= subtractMonths(today(), ${pm})`);
        }

        const sql = `
            SELECT
                initcap(lower(brand)) AS brand,
                is_competitor,
                count() as total_reviews,
                round(avg(rating), 2) as avg_rating,
                round(avg(quality_score), 2) as avg_quality,
                category as primary_category
            FROM ml_reviews
            WHERE ${where.join(' AND ')}
            GROUP BY brand, is_competitor, category
            ORDER BY total_reviews DESC
            LIMIT 50
        `;
        
        const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        res.json({ success: true, matrix: rows });
    } catch (err) {
        console.error('Competitor Matrix error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// NOTE: The following endpoints for competitor mappings (CRUD operations) 
// are intentionally kept in Postgres as they deal with configuration and 
// administrative data. The corresponding tables (ratings.competitor_mapping_pairs 
// and ratings.competitor_mapping_types) do not exist in the ClickHouse 'prestige' DB.
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
        const queryParams = { companyId: String(req.companyId) };
        const sql = `
            SELECT brand FROM (
                SELECT initcap(lower(brand)) AS brand, count() AS n FROM ml_reviews
                WHERE company_id = {companyId:String} AND coalesce(is_competitor, 0) = 1
                  AND isNotNull(brand) AND brand != ''
                  AND length(brand) >= 3
                  AND lower(brand) NOT IN ('the','not','and','gas','extracted','none','null','n/a','other','unknown','etc','for','was','were','our','your','its')
                GROUP BY brand
                HAVING count() >= 3
            ) ORDER BY brand ASC
        `;
        const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();
        
        res.json({ brands: rows.map(r => r.brand) });
    } catch (err) {
        console.error('Competitor-brands error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// GET /api/ratings/spec-type-mappings — From category_rules.spec_type column
// ============================================================================

