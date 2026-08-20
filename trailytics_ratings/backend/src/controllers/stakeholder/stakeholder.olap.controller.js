/**
 * Stakeholder OLAP controller — uses rb_review_olap.
 *
 * In the OLAP table, stakeholder_mappings no longer exist as a separate table.
 * Instead, each review row has:
 *   - stakeholder            (the assigned stakeholder name)
 *   - sentiment_subcategory  (the NLP subcategory)
 *   - sentiment_display_label (human-readable label)
 *
 * CRUD endpoints (getStakeholderMappings / createStakeholderMapping / deleteStakeholderMapping)
 * still use the Postgres ratings.stakeholder_mappings table — those are config, not ClickHouse data.
 */

import pool from '../../config/db.js';
import clickhouse from '../../config/clickhouse.js';

const OLAP_TABLE = 'rb_review_olap';

const getTargetDb = (req) =>
    req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] ||
    (req.authUser && req.authUser.dbName) ||
    process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || 'prestige';

const formatStakeholder = (name) => {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    if (lower === 'r&d') return 'R&D';
    if (lower === 'qc') return 'QC';
    if (lower === 'it') return 'IT';
    return lower.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

// ── getStakeholderDetail ───────────────────────────────────────────────────

export const getStakeholderDetail = async (req, res) => {
    try {
        const { stakeholder, category: filterCategory, rating_bifurcation, platform, brand,
                date_from, date_to, period_months, price_mode, price_min, price_max, is_competitor,
                sentiment_category, web_pid, pareto_status } = req.query;
        if (!stakeholder) return res.status(400).json({ error: 'stakeholder param required' });

        const queryParams = { companyId: String(req.companyId), stakeholder };
        const extraFilters = [`o.company_id = {companyId:String}`, `ilike(o.stakeholder, {stakeholder:String})`];

        if (sentiment_category && sentiment_category !== 'all') { extraFilters.push(`ilike(o.sentiment_category, {sentimentCategory:String})`); queryParams.sentimentCategory = sentiment_category; }
        if (platform && platform !== 'all') { extraFilters.push(`ilike(o.platform, {platform:String})`); queryParams.platform = platform; }
        if (brand && brand !== 'all') { extraFilters.push(`ilike(o.brand, {brand:String})`); queryParams.brand = brand; }
        if (date_from) { extraFilters.push(`o.review_date >= toDate({dateFrom:String})`); queryParams.dateFrom = date_from; }
        if (date_to) { extraFilters.push(`o.review_date <= toDate({dateTo:String})`); queryParams.dateTo = date_to; }
        if (!date_from && !date_to) {
            const pm = Math.max(1, Math.min(parseInt(req.query.period_months, 10) || 6, 24));
            extraFilters.push(`o.review_date >= addMonths(today(), -${pm})`);
        }
        if (filterCategory) { extraFilters.push(`ilike(o.product_category, {filterCategory:String})`); queryParams.filterCategory = filterCategory; }
        if (rating_bifurcation === 'NP') extraFilters.push(`o.pdp_rating >= 4.2`);
        else if (rating_bifurcation === 'Issue') extraFilters.push(`o.pdp_rating < 4.0`);
        else if (rating_bifurcation === 'NI') extraFilters.push(`o.pdp_rating >= 4.0 AND o.pdp_rating < 4.2`);
        if (price_min !== undefined && price_min !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            extraFilters.push(`${pe} >= {priceMin:Float64}`); queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const pe = price_mode === 'rp' ? 'o.price_rp' : 'o.price_sp';
            extraFilters.push(`${pe} <= {priceMax:Float64}`); queryParams.priceMax = Number(price_max);
        }
        if (is_competitor === 'true') extraFilters.push(`coalesce(o.is_competitor, 0) = 1`);
        else if (is_competitor === 'false') extraFilters.push(`coalesce(o.is_competitor, 0) = 0`);
        if (web_pid) { extraFilters.push(`o.web_pid = {webPid:String}`); queryParams.webPid = web_pid; }

        const sql = `
            SELECT
                o.sentiment_subcategory,
                o.web_pid,
                any(o.product_name) AS product_name,
                argMax(o.pdp_rating, o.review_date) AS pdp_rating,
                countIf(o.sentiment = 'negative') AS neg_count,
                countIf(o.sentiment = 'positive') AS pos_count,
                round(avg(o.rating), 1) AS issue_rating,
                count() AS total_count,
                any(o.sentiment_display_label) AS display_label
            FROM ${OLAP_TABLE} o
            WHERE ${extraFilters.join(' AND ')}
              AND isNotNull(o.sentiment_subcategory)
              AND o.sentiment_subcategory != ''
              AND o.sentiment_subcategory != 'General_Feedback'
            GROUP BY o.sentiment_subcategory, o.web_pid
        `;

        const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        const subcatMap = {};
        const uniqueSkus = new Set();

        rows.forEach(r => {
            if (!subcatMap[r.sentiment_subcategory]) {
                subcatMap[r.sentiment_subcategory] = {
                    subcategory: r.sentiment_subcategory,
                    label: r.display_label || r.sentiment_subcategory.replace(/_/g, ' '),
                    negativeCount: 0, positiveCount: 0, totalCount: 0, skuCount: 0, skus: []
                };
            }
            subcatMap[r.sentiment_subcategory].negativeCount += parseInt(r.neg_count || 0);
            subcatMap[r.sentiment_subcategory].positiveCount += parseInt(r.pos_count || 0);
            subcatMap[r.sentiment_subcategory].totalCount += parseInt(r.total_count || 0);
            uniqueSkus.add(r.web_pid);
            subcatMap[r.sentiment_subcategory].skus.push({
                web_pid: r.web_pid, product_name: r.product_name,
                pdp_rating: r.pdp_rating !== null ? parseFloat(r.pdp_rating) : null,
                issue_rating: r.issue_rating !== null ? parseFloat(r.issue_rating) : null,
                negCount: parseInt(r.neg_count || 0), posCount: parseInt(r.pos_count || 0),
                totalCount: parseInt(r.total_count || 0)
            });
        });

        const issues = Object.values(subcatMap)
            .filter(i => i.negativeCount > 0)
            .map(i => { i.skuCount = i.skus.length; i.skus.sort((a, b) => b.negCount - a.negCount); return i; })
            .sort((a, b) => b.negativeCount - a.negativeCount);

        res.json({ issues, uniqueSkuCount: uniqueSkus.size });
    } catch (err) {
        console.error('[OLAP] Stakeholder detail error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── getStakeholderMappings ───────────────────────────────────────────────────

export const getStakeholderMappings = async (req, res) => {
    try {
        const sql = `
            SELECT
                sentiment_subcategory,
                any(stakeholder) AS stakeholder,
                any(sentiment_display_label) AS display_label
            FROM ${OLAP_TABLE}
            WHERE company_id = {companyId:String}
              AND isNotNull(sentiment_subcategory)
              AND sentiment_subcategory != ''
              AND sentiment_subcategory != 'General_Feedback'
            GROUP BY sentiment_subcategory
            ORDER BY stakeholder, sentiment_subcategory
        `;
        const chRes = await clickhouse.query({
            database: getTargetDb(req),
            query: sql,
            query_params: { companyId: String(req.companyId) },
            format: 'JSONEachRow'
        });
        const rows = await chRes.json();

        const grouped = {};
        const mappings = [];

        rows.forEach((r, index) => {
            const sh = formatStakeholder(r.stakeholder) || '_unassigned';
            mappings.push({
                id: index,
                sentiment_subcategory: r.sentiment_subcategory,
                stakeholder: formatStakeholder(r.stakeholder),
                display_label: r.display_label || null,
                sort_order: 0
            });
            if (!grouped[sh]) grouped[sh] = { stakeholder: formatStakeholder(r.stakeholder), subcategories: [], display_labels: {} };
            grouped[sh].subcategories.push(r.sentiment_subcategory);
            if (r.display_label) grouped[sh].display_labels[r.sentiment_subcategory] = r.display_label;
        });

        res.json({ mappings, grouped });
    } catch (err) {
        console.error('[OLAP] getStakeholderMappings error:', err);
        res.status(500).json({ error: err.message });
    }
};

// CRUD for stakeholder mappings (create/delete) stays on Postgres
export { createStakeholderMapping, deleteStakeholderMapping } from './stakeholder.controller.js';
