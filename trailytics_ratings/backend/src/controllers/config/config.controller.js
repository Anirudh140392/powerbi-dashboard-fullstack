import pool from '../../config/db.js';
import clickhouse from '../../config/clickhouse.js';

const getTargetDb = (req) => {
    return (req.query.db && req.query.db.toLowerCase() === 'danone') ? 'danone' : 'loreal';
};

export const getPlatformOptions = async (req, res) => {
    try {
        const { is_competitor } = req.query;
        const params = { companyId: String(req.companyId) };
        let competitorFilter = '';

        if (is_competitor !== undefined && is_competitor !== 'all') {
            competitorFilter = 'AND r.is_competitor = {isCompetitor:UInt8}';
            params.isCompetitor = is_competitor === 'true' ? 1 : 0;
        }

        const chRes = await clickhouse.query({
            database: getTargetDb(req),
            query: `SELECT DISTINCT platform FROM rb_review_olap r WHERE r.company_id = {companyId:String} ${competitorFilter} AND r.platform != '' ORDER BY platform`,
            query_params: params,
            format: 'JSONEachRow'
        });
        const rows = await chRes.json();

        res.json({ platforms: rows.map(row => row.platform) });
    } catch (err) {
        console.error('Platform options error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getPriceRanges = async (req, res) => {
    try {
        const sql = `
            SELECT
                COALESCE(ps.price_rp, p.mrp) AS price_rp,
                COALESCE(ps.price_sp, p.selling_price, p.mop) AS price_sp
            FROM masters.products p
            LEFT JOIN LATERAL (
                SELECT ps2.price_rp, ps2.price_sp
                FROM ratings.product_snapshots ps2
                WHERE ps2.company_id = p.company_id
                  AND ps2.web_pid = p.product_external_id
                  AND (ps2.platform = p.platform OR p.platform IS NULL)
                ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
                LIMIT 1
            ) ps ON true
            WHERE p.company_id = $1
              AND (CASE 
                WHEN $2 = 'true' THEN p.is_competitor = true
                WHEN $2 = 'false' THEN p.is_competitor = false
                ELSE true
              END)
        `;
        const { rows } = await pool.query(sql, [req.companyId, String(req.query.is_competitor || 'all')]);
        const rp = buildPriceBuckets(rows.map(row => row.price_rp));
        const sp = buildPriceBuckets(rows.map(row => row.price_sp));
        res.json({
            minRp: rp.min,
            maxRp: rp.max,
            minSp: sp.min,
            maxSp: sp.max,
            modes: {
                rp: { label: 'MRP', min: rp.min, max: rp.max, slabs: rp.slabs },
                sp: { label: 'Selling Price', min: sp.min, max: sp.max, slabs: sp.slabs },
            },
        });
    } catch (err) {
        console.error('Price ranges error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getSentimentCategories = async (req, res) => {
    try {
        const params = { companyId: String(req.companyId) };
        const chRes = await clickhouse.query({
            database: getTargetDb(req),
            query: `SELECT DISTINCT sentiment_category AS category FROM ml_reviews WHERE company_id = {companyId:String} AND sentiment_category != '' ORDER BY category`,
            query_params: params,
            format: 'JSONEachRow'
        });
        const rows = await chRes.json();
        res.json({ categories: rows.map(r => r.category) });
    } catch (err) {
        console.error('Sentiment-categories error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getSpecTypeMappings = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT category, spec_type FROM ratings.category_rules
             WHERE company_id = $1
             ORDER BY category ASC`,
            [req.companyId]
        );
        const mappings = {};
        rows.forEach(r => { mappings[r.category] = r.spec_type || 'generic'; });
        res.json({ mappings });
    } catch (err) {
        console.error('Spec-type-mappings error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getCompanyConfig = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT brand_name, brand_color, logo_url FROM ratings.company_config WHERE company_id = $1`,
            [req.companyId]
        );
        res.json({ config: rows[0] || { brand_name: 'Our Brand', brand_color: '#6366f1' } });
    } catch (err) {
        console.error('company-config error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getBrandConfig = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT brand_name, display_color, is_own_brand, sort_order 
             FROM ratings.brand_config WHERE company_id = $1 ORDER BY sort_order`,
            [req.companyId]
        );
        res.json({ brands: rows });
    } catch (err) {
        console.error('brand-config error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getAlertScopeOptions = async (req, res) => {
    try {
        const { type, q } = req.query;
        const term = q ? `%${String(q).trim()}%` : null;
        let sql, params;
        switch (type) {
            case 'product': {
                sql = `
                    SELECT product_external_id AS value,
                           COALESCE(product_name, product_external_id) AS label,
                           platform, brand_name AS brand, is_competitor
                      FROM masters.products
                     WHERE company_id = $1
                       ${term ? 'AND (product_name ILIKE $2 OR product_external_id ILIKE $2 OR sku_code ILIKE $2)' : ''}
                     ORDER BY product_name ASC NULLS LAST
                     LIMIT 200`;
                params = term ? [req.companyId, term] : [req.companyId];
                break;
            }
            case 'brand': {
                sql = `
                    SELECT DISTINCT brand_name AS value, brand_name AS label,
                           BOOL_OR(is_competitor) AS is_competitor
                      FROM masters.products
                     WHERE company_id = $1 AND brand_name IS NOT NULL AND brand_name <> ''
                       ${term ? 'AND brand_name ILIKE $2' : ''}
                     GROUP BY brand_name
                     ORDER BY brand_name ASC
                     LIMIT 200`;
                params = term ? [req.companyId, term] : [req.companyId];
                break;
            }
            case 'category': {
                sql = `
                    SELECT DISTINCT
                       COALESCE(NULLIF(master_category,''), NULLIF(category,'')) AS value,
                       COALESCE(NULLIF(master_category,''), NULLIF(category,'')) AS label
                      FROM masters.products
                     WHERE company_id = $1
                       AND COALESCE(NULLIF(master_category,''), NULLIF(category,'')) IS NOT NULL
                       ${term ? "AND COALESCE(NULLIF(master_category,''), NULLIF(category,'')) ILIKE $2" : ''}
                     ORDER BY 1 ASC
                     LIMIT 200`;
                params = term ? [req.companyId, term] : [req.companyId];
                break;
            }
            default:
                return res.status(400).json({ error: 'type must be product | brand | category' });
        }
        const { rows } = await pool.query(sql, params);
        res.json({ options: rows });
    } catch (err) {
        console.error('alert-scope-options error:', err);
        res.status(500).json({ error: err.message });
    }
};


export const getClientBrands = async (req, res) => {
    try {
        const { is_competitor } = req.query;
        const params = { companyId: String(req.companyId) };
        let competitorFilter = '';

        if (is_competitor !== undefined && is_competitor !== 'all') {
            competitorFilter = 'AND r.is_competitor = {isCompetitor:UInt8}';
            params.isCompetitor = is_competitor === 'true' ? 1 : 0;
        }

        const chRes = await clickhouse.query({
            database: getTargetDb(req),
            query: `SELECT DISTINCT brand AS brand FROM rb_review_olap r WHERE r.company_id = {companyId:String} ${competitorFilter} AND r.brand != '' ORDER BY brand`,
            query_params: params,
            format: 'JSONEachRow'
        });
        const rows = await chRes.json();
        res.json({ brands: rows.map(r => r.brand) });
    } catch (err) {
        console.error('Client-brands error:', err);
        res.status(500).json({ error: err.message });
    }
};

function buildPriceBuckets(values) {
    const sorted = values
        .map(v => Number(v))
        .filter(v => Number.isFinite(v) && v > 0)
        .sort((a, b) => a - b);

    if (sorted.length === 0) {
        return { min: 0, max: 0, slabs: [] };
    }

    const percentiles = [0, 0.25, 0.5, 0.75, 1];
    const edges = percentiles.map(p => {
        const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
        return sorted[idx];
    });

    const deduped = [sorted[0]];
    for (const edge of edges.slice(1)) {
        if (edge > deduped[deduped.length - 1]) deduped.push(edge);
    }
    if (deduped[deduped.length - 1] !== sorted[sorted.length - 1]) {
        deduped.push(sorted[sorted.length - 1]);
    }

    const slabs = [];
    for (let i = 0; i < deduped.length - 1; i++) {
        const min = deduped[i];
        const max = deduped[i + 1];
        if (!(max > min)) continue;
        const count = sorted.filter(v => i === deduped.length - 2 ? v >= min && v <= max : v >= min && v < max).length;
        slabs.push({
            min,
            max,
            count,
            label: `₹${Math.round(min).toLocaleString('en-IN')} - ₹${Math.round(max).toLocaleString('en-IN')}`,
        });
    }

    if (slabs.length === 0) {
        slabs.push({
            min: sorted[0],
            max: sorted[sorted.length - 1],
            count: sorted.length,
            label: `₹${Math.round(sorted[0]).toLocaleString('en-IN')} - ₹${Math.round(sorted[sorted.length - 1]).toLocaleString('en-IN')}`,
        });
    }

    return {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        slabs,
    };
}
