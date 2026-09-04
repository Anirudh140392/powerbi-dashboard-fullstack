// src/services/categoryPerfSummaryDataService.js
// Data-fetching layer for Performance Summary alert email.
// Uses CW (latest completed Sunday–Saturday week) vs L4W (prior 4 weeks average).
// KPIs: Offtake Units, Offtake GMV, Weighted Discount, OSA, Ad Spend & TACoS, SOS.

import { queryAdminDB } from '../config/adminClickhouse.js';

const esc = (str) => (str ? String(str).replace(/'/g, "''") : '');

const buildBrandClause = (brands) => {
    if (!Array.isArray(brands) || brands.length === 0) return '';
    const filtered = brands.filter(b => b && b !== 'All Brands' && b !== 'All');
    if (filtered.length === 0) return '';
    return `AND lower(Brand) IN (${filtered.map(b => `'${esc(b.trim().toLowerCase())}'`).join(',')})`;
};

// Common Category expression — maps empty/null to 'Uncategorized'
const CATEGORY_EXPR = `if(Category IS NOT NULL AND trim(Category) != '' AND trim(Category) != '0' AND trim(Category) != '-', trim(Category), 'Uncategorized')`;

// ─────────────────────────────────────────────────────────────
// PDP KPIs: Offtake Units, Offtake GMV, Weighted Discount, OSA
// CW = latest completed Sun-Sat week, L4W = prior 4 weeks avg
// ─────────────────────────────────────────────────────────────
const getPdpKPIsByCategory = async (dbName, platform, brands, cwStart, isRolling = false) => {
    const brandClause = buildBrandClause(brands);
    const platClause = `AND lower(Platform) = '${esc(platform.trim().toLowerCase())}'`;

    const query = `
        WITH
            week_boundaries AS (
                SELECT toDate('${cwStart}') AS cw_start
            ),
            weekly_cat AS (
                SELECT
                    ${CATEGORY_EXPR} AS cat,
                    ${isRolling ? `if(DATE >= b.cw_start, 'cw', 'l4w')` : `subtractDays(DATE, toDayOfWeek(DATE) % 7)`} AS week_start,
                    SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS qty,
                    SUM(ifNull(toFloat64OrZero(toString(Selling_Price)), 0) * ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS gmv,
                    SUM((ifNull(toFloat64OrZero(toString(MRP)), 0) - ifNull(toFloat64OrZero(toString(Selling_Price)), 0)) * ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS disc_num,
                    SUM(ifNull(toFloat64OrZero(toString(MRP)), 0) * ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS disc_den,
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) AS osa_num,
                    SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) AS osa_den
                FROM \`${dbName}\`.rb_pdp_olap
                CROSS JOIN week_boundaries b
                WHERE DATE >= b.cw_start - INTERVAL 28 DAY
                  AND DATE < b.cw_start + INTERVAL 7 DAY
                  ${platClause}
                  AND (Comp_flag = 0 OR Comp_flag IS NULL)
                  AND Category IS NOT NULL AND trim(Category) != '' AND trim(Category) != '0' AND trim(Category) != '-'
                  AND lower(trim(Category)) NOT IN ('uncategorized', 'other', 'others', 'undefined', 'null')
                  ${brandClause}
                GROUP BY cat, week_start
            ),
            cw AS (
                SELECT w.*
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE w.week_start = ${isRolling ? `'cw'` : `b.cw_start`}
            ),
            l4w AS (
                SELECT
                    w.cat,
                    ${isRolling ? `sum(w.qty)/4` : `avg(w.qty)`} AS qty,
                    ${isRolling ? `sum(w.gmv)/4` : `avg(w.gmv)`} AS gmv,
                    -- For weighted metrics, we sum across all 4 weeks then compute ratio
                    sum(w.disc_num) AS disc_num,
                    sum(w.disc_den) AS disc_den,
                    sum(w.osa_num) AS osa_num,
                    sum(w.osa_den) AS osa_den
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE ${isRolling ? `w.week_start = 'l4w'` : `w.week_start >= b.cw_start - INTERVAL 28 DAY AND w.week_start < b.cw_start`}
                GROUP BY w.cat
            )
        SELECT
            coalesce(c.cat, l.cat) AS CategoryName,
            ifNull(c.qty, 0) AS cw_qty,
            ifNull(c.gmv, 0) AS cw_gmv,
            if(c.disc_den > 0, ROUND(c.disc_num / c.disc_den * 100, 2), 0) AS cw_disc,
            if(c.osa_den > 0, ROUND(c.osa_num / c.osa_den * 100, 2), 0) AS cw_osa,
            ifNull(l.qty, 0) AS l4w_qty,
            ifNull(l.gmv, 0) AS l4w_gmv,
            if(l.disc_den > 0, ROUND(l.disc_num / l.disc_den * 100, 2), 0) AS l4w_disc,
            if(l.osa_den > 0, ROUND(l.osa_num / l.osa_den * 100, 2), 0) AS l4w_osa
        FROM cw c
        FULL OUTER JOIN l4w l ON c.cat = l.cat
    `;

    const rows = await queryAdminDB(query);
    const result = {};
    for (const row of rows) {
        const cat = row.CategoryName || 'Uncategorized';
        result[cat] = {
            qtySold: { current: parseFloat(row.cw_qty) || 0, previous: parseFloat(row.l4w_qty) || 0 },
            gmv: { current: parseFloat(row.cw_gmv) || 0, previous: parseFloat(row.l4w_gmv) || 0 },
            discounting: { current: parseFloat(row.cw_disc) || 0, previous: parseFloat(row.l4w_disc) || 0 },
            osa: { current: parseFloat(row.cw_osa) || 0, previous: parseFloat(row.l4w_osa) || 0 },
        };
    }
    return result;
};

// ─────────────────────────────────────────────────────────────
// Ad Spend & TACoS from rb_pm_olap
// TACoS = Ad Spend / GMV * 100 (needs GMV from PDP)
// ─────────────────────────────────────────────────────────────
const getAdSpendByCategory = async (dbName, platform, brands, cwStart, isRolling = false) => {
    const brandClause = buildBrandClause(brands);
    // rb_pm_olap uses lowercase 'platform' and 'brand'
    let pmPlatClause = '';
    if (platform) {
        pmPlatClause = `AND lower(Platform) = '${esc(platform.trim().toLowerCase())}'`;
    }
    let pmBrandClause = '';
    if (Array.isArray(brands) && brands.length > 0) {
        const filtered = brands.filter(b => b && b !== 'All Brands' && b !== 'All');
        if (filtered.length > 0) {
            pmBrandClause = `AND lower(brand) IN (${filtered.map(b => `'${esc(b.trim().toLowerCase())}'`).join(',')})`;
        }
    }

    const buildAdQuery = (catCol) => `
        WITH
            week_boundaries AS (
                SELECT toDate('${cwStart}') AS cw_start
            ),
            weekly_cat AS (
                SELECT
                    if(${catCol} IS NOT NULL AND trim(${catCol}) != '' AND trim(${catCol}) != '0' AND trim(${catCol}) != '-', trim(${catCol}), 'Uncategorized') AS cat,
                    ${isRolling ? `if(DATE >= b.cw_start, 'cw', 'l4w')` : `subtractDays(DATE, toDayOfWeek(DATE) % 7)`} AS week_start,
                    SUM(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) AS spend
                FROM \`${dbName}\`.rb_pm_olap
                CROSS JOIN week_boundaries b
                WHERE DATE >= b.cw_start - INTERVAL 28 DAY
                  AND DATE < b.cw_start + INTERVAL 7 DAY
                  ${pmPlatClause}
                  AND ${catCol} IS NOT NULL AND trim(${catCol}) != '' AND trim(${catCol}) != '0' AND trim(${catCol}) != '-'
                  AND lower(trim(${catCol})) NOT IN ('uncategorized', 'other', 'others', 'undefined', 'null')
                  ${pmBrandClause}
                GROUP BY cat, week_start
            ),
            cw AS (
                SELECT w.*
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE w.week_start = ${isRolling ? `'cw'` : `b.cw_start`}
            ),
            l4w AS (
                SELECT
                    w.cat,
                    ${isRolling ? `sum(w.spend)/4` : `avg(w.spend)`} AS spend
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE ${isRolling ? `w.week_start = 'l4w'` : `w.week_start >= b.cw_start - INTERVAL 28 DAY AND w.week_start < b.cw_start`}
                GROUP BY w.cat
            )
        SELECT
            coalesce(c.cat, l.cat) AS CategoryName,
            ifNull(c.spend, 0) AS cw_spend,
            ifNull(l.spend, 0) AS l4w_spend
        FROM cw c
        FULL OUTER JOIN l4w l ON c.cat = l.cat
    `;

    const parseAdRows = (rows) => {
        const result = {};
        for (const row of rows) {
            const cat = row.CategoryName || 'Uncategorized';
            result[cat] = {
                current: parseFloat(row.cw_spend) || 0,
                previous: parseFloat(row.l4w_spend) || 0,
            };
        }
        return result;
    };

    try {
        const rows = await queryAdminDB(buildAdQuery('category'));
        return parseAdRows(rows);
    } catch (err) {
        console.warn(`[CatPerfSummary] getAdSpendByCategory first try ERROR (category):`, err.message);
        try {
            const rows = await queryAdminDB(buildAdQuery('Category'));
            return parseAdRows(rows);
        } catch (e2) {
            console.error(`[CatPerfSummary] getAdSpendByCategory second try ERROR (Category):`, e2.message);
            return {};
        }
    }
};

// ─────────────────────────────────────────────────────────────
// SOS from rb_kw_olap
// ─────────────────────────────────────────────────────────────
const getSOSByCategory = async (dbName, platform, cwStart, isRolling = false) => {
    const platClause = `AND lower(platform_name) = '${esc(platform.trim().toLowerCase())}'`;

    // Try keyword_category first, fallback to category
    const buildQuery = (catCol) => `
        WITH
            week_boundaries AS (
                SELECT toDate('${cwStart}') AS cw_start
            ),
            weekly_cat AS (
                SELECT
                    ${catCol} AS cat,
                    ${isRolling ? `if(DATE >= b.cw_start, 'cw', 'l4w')` : `subtractDays(DATE, toDayOfWeek(DATE) % 7)`} AS week_start,
                    ROUND(sumIf(overall, flag = 1) * 100.0 / nullIf(sum(overall), 0), 2) AS sos
                FROM \`${dbName}\`.rb_kw_olap
                CROSS JOIN week_boundaries b
                WHERE DATE >= b.cw_start - INTERVAL 28 DAY
                  AND DATE < b.cw_start + INTERVAL 7 DAY
                  ${platClause}
                  AND ${catCol} IS NOT NULL AND trim(${catCol}) != '' AND trim(${catCol}) != '0' AND trim(${catCol}) != '-'
                  AND lower(trim(${catCol})) NOT IN ('uncategorized', 'other', 'others', 'undefined', 'null')
                GROUP BY cat, week_start
            ),
            cw AS (
                SELECT w.*
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE w.week_start = ${isRolling ? `'cw'` : `b.cw_start`}
            ),
            l4w AS (
                SELECT
                    w.cat,
                    avg(w.sos) AS sos
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE ${isRolling ? `w.week_start = 'l4w'` : `w.week_start >= b.cw_start - INTERVAL 28 DAY AND w.week_start < b.cw_start`}
                GROUP BY w.cat
            )
        SELECT
            coalesce(c.cat, l.cat) AS CategoryName,
            ifNull(c.sos, 0) AS cw_sos,
            ifNull(l.sos, 0) AS l4w_sos
        FROM cw c
        FULL OUTER JOIN l4w l ON c.cat = l.cat
    `;

    const parseRows = (rows) => {
        const result = {};
        for (const row of rows) {
            if (row.CategoryName) {
                result[row.CategoryName] = {
                    current: parseFloat(row.cw_sos) || 0,
                    previous: parseFloat(row.l4w_sos) || 0,
                };
            }
        }
        return result;
    };

    try {
        const query1 = buildQuery('keyword_category');
        const rows = await queryAdminDB(query1);
        return parseRows(rows);
    } catch (err) {
        console.warn(`[CatPerfSummary] getSOSByCategory first try ERROR (keyword_category):`, err.message);
        try {
            const query2 = buildQuery('category');
            const rows = await queryAdminDB(query2);
            return parseRows(rows);
        } catch (e2) {
            console.warn(`[CatPerfSummary] getSOSByCategory second try ERROR (category):`, e2.message);
            try {
                const query3 = buildQuery('Category');
                const rows = await queryAdminDB(query3);
                return parseRows(rows);
            } catch (e3) {
                console.error(`[CatPerfSummary] getSOSByCategory third try ERROR (Category):`, e3.message);
                return {};
            }
        }
    }
};

// ─────────────────────────────────────────────────────────────
// Get the CW date range for display (e.g. "3 Aug – 9 Aug 2026")
// ─────────────────────────────────────────────────────────────
export const getCWDateRange = async (dbName, platform, tableName = 'rb_pdp_olap', isRolling = false) => {
    let platClause = '';
    if (platform) {
        const platCol = tableName === 'rb_kw_olap' ? 'platform_name' : 'Platform';
        platClause = `AND lower(${platCol}) = '${esc(platform.trim().toLowerCase())}'`;
    }

    const compClause = tableName === 'rb_kw_olap' ? '' : 'AND (Comp_flag = 0 OR Comp_flag IS NULL)';

    try {
        const rows = await queryAdminDB(`
            WITH latest_date AS (
                SELECT MAX(DATE) AS max_date
                FROM \`${dbName}\`.\`${tableName}\`
                WHERE DATE IS NOT NULL ${platClause} ${compClause}
            )
            SELECT
                ${isRolling ? 'max_date - INTERVAL 6 DAY' : 'subtractDays(max_date, toDayOfWeek(max_date) % 7 + 7)'} AS cw_start,
                ${isRolling ? 'max_date' : 'subtractDays(max_date, toDayOfWeek(max_date) % 7 + 7) + INTERVAL 6 DAY'} AS cw_end,
                ${isRolling ? 'max_date - INTERVAL 34 DAY' : 'subtractDays(max_date, toDayOfWeek(max_date) % 7 + 7) - INTERVAL 28 DAY'} AS l4w_start,
                ${isRolling ? 'max_date - INTERVAL 7 DAY' : 'subtractDays(max_date, toDayOfWeek(max_date) % 7 + 7) - INTERVAL 1 DAY'} AS l4w_end
            FROM latest_date
        `);
        if (rows.length > 0) {
            return {
                cwStart: String(rows[0].cw_start).slice(0, 10),
                cwEnd: String(rows[0].cw_end).slice(0, 10),
                l4wStart: String(rows[0].l4w_start).slice(0, 10),
                l4wEnd: String(rows[0].l4w_end).slice(0, 10),
            };
        }
    } catch (err) {
        console.warn('[CatPerfSummary] getCWDateRange failed:', err.message);
    }
    return { cwStart: '', cwEnd: '', l4wStart: '', l4wEnd: '' };
};

// ─────────────────────────────────────────────────────────────
// Orchestrator: fetch all 6 KPIs for a single platform, by category
// ─────────────────────────────────────────────────────────────
export const fetchAllPlatformCategoryKPIs = async (dbName, platform, brands, isRolling = false) => {
    console.log(`[CatPerfSummary] Fetching CW/L4W KPIs for ${platform} on ${dbName} (Rolling: ${isRolling})`);

    // Centralize date boundary logic so all KPIs align
    const dateRange = await getCWDateRange(dbName, platform, 'rb_pdp_olap', isRolling);
    if (!dateRange.cwStart) {
        console.warn(`[CatPerfSummary] No valid data found for ${platform} to establish date boundaries.`);
        return [];
    }
    const { cwStart } = dateRange;

    const [pdpData, adSpendData, sosData] = await Promise.all([
        getPdpKPIsByCategory(dbName, platform, brands, cwStart, isRolling),
        getAdSpendByCategory(dbName, platform, brands, cwStart, isRolling),
        getSOSByCategory(dbName, platform, cwStart, isRolling),
    ]);

    const normalizeCat = (cat) => cat ? cat.trim().toUpperCase() : 'UNCATEGORIZED';
    const originalCats = {}; 
    const unifiedData = {};

    const addData = (source, type) => {
        for (const [cat, data] of Object.entries(source)) {
            const norm = normalizeCat(cat);
            if (!unifiedData[norm]) {
                unifiedData[norm] = {
                    pdp: { qtySold: { current: 0, previous: 0 }, gmv: { current: 0, previous: 0 }, discounting: { current: 0, previous: 0 }, osa: { current: 0, previous: 0 } },
                    ad: { current: 0, previous: 0 },
                    sos: { current: 0, previous: 0 }
                };
                originalCats[norm] = cat;
            } else if (cat === norm && originalCats[norm] !== norm) {
                // If the new category is exactly the uppercase version, prefer it for display
                originalCats[norm] = cat;
            }
            unifiedData[norm][type] = data;
        }
    };

    addData(pdpData, 'pdp');
    addData(adSpendData, 'ad');
    addData(sosData, 'sos');

    const round1 = (v) => parseFloat(parseFloat(v).toFixed(1));
    const pctDelta = (curr, prev) => {
        const c = round1(curr);
        const p = round1(prev);
        return p !== 0 ? round1(((c - p) / p) * 100) : (c > 0 ? 100 : 0);
    };
    const ptDelta = (curr, prev) => round1(round1(curr) - round1(prev));

    const results = [];
    for (const norm of Object.keys(unifiedData)) {
        if (!norm || norm === '' || ['UNCATEGORIZED', 'UNDEFINED', 'NULL', 'OTHER', 'OTHERS', '0'].includes(norm)) {
            console.log(`[CategoryPerfSummary] Skipping norm=${norm}`);
            continue;
        }
        console.log(`[CategoryPerfSummary] Pushing norm=${norm}, originalCat=${originalCats[norm]}`);

        const pdp = unifiedData[norm].pdp;
        const ad = unifiedData[norm].ad;
        const sos = unifiedData[norm].sos;

        // Compute TACoS = Ad Spend / GMV * 100
        const cwTacos = pdp.gmv.current > 0 ? round1(ad.current / pdp.gmv.current * 100) : 0;
        const l4wTacos = pdp.gmv.previous > 0 ? round1(ad.previous / pdp.gmv.previous * 100) : 0;

        results.push({
            categoryName: originalCats[norm],
            kpis: {
                qtySold: { current: pdp.qtySold.current, previous: pdp.qtySold.previous, delta: pctDelta(pdp.qtySold.current, pdp.qtySold.previous) },
                gmv: { current: pdp.gmv.current, previous: pdp.gmv.previous, delta: pctDelta(pdp.gmv.current, pdp.gmv.previous) },
                discounting: { current: pdp.discounting.current, previous: pdp.discounting.previous, delta: ptDelta(pdp.discounting.current, pdp.discounting.previous) },
                osa: { current: pdp.osa.current, previous: pdp.osa.previous, delta: ptDelta(pdp.osa.current, pdp.osa.previous) },
                adSpend: { current: ad.current, previous: ad.previous, delta: pctDelta(ad.current, ad.previous) },
                tacos: { current: cwTacos, previous: l4wTacos, delta: ptDelta(cwTacos, l4wTacos) },
                sos: { current: sos.current, previous: sos.previous, delta: ptDelta(sos.current, sos.previous) },
            }
        });
    }

    return results;
};
