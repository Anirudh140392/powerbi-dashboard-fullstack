// src/services/perfSummaryDataService.js
// Data-fetching layer for the Performance Summary (qcomm_summary) alert email.
// Each function fetches a single KPI for a single platform on a single day.
// Used by alertCronService.js when alert_type === 'performance_summary'.

import { queryAdminDB } from '../config/adminClickhouse.js';

/**
 * Escape single quotes for safe SQL interpolation.
 */
const esc = (str) => (str ? String(str).replace(/'/g, "''") : '');

/**
 * Build a WHERE clause for brand filtering (our brands only, Comp_flag = 0).
 * @param {string[]} brands - Brand list from tb_alert
 * @returns {string} SQL fragment (with leading AND if non-empty)
 */
const buildBrandClause = (brands) => {
    if (!Array.isArray(brands) || brands.length === 0) return '';
    const filtered = brands.filter(b => b && b !== 'All Brands' && b !== 'All');
    if (filtered.length === 0) return '';
    return `AND lower(Brand) IN (${filtered.map(b => `'${esc(b.trim().toLowerCase())}'`).join(',')})`;
};

/**
 * Build a platform WHERE clause for rb_ms_olap (uses lowercase column `platform`).
 */
const buildMsPlatformClause = (platform) => {
    if (!platform) return '';
    return `AND lower(platform) = '${esc(platform.trim().toLowerCase())}'`;
};

/**
 * Get our brand names from rca_sku_dim (comp_flag = 0) for SOV calculation.
 */
const getOurBrands = async (dbName) => {
    try {
        const rows = await queryAdminDB(`
            SELECT DISTINCT brand_name
            FROM \`${dbName}\`.rca_sku_dim
            WHERE comp_flag = 0
              AND brand_name IS NOT NULL
              AND brand_name != ''
        `);
        return rows.map(r => r.brand_name).filter(Boolean);
    } catch (err) {
        console.error('[PerfSummaryData] getOurBrands failed:', err.message);
        return [];
    }
};

// ─────────────────────────────────────────────────────────────
// KPI 1: Sales [MRP] = SUM(MRP * Qty_Sold)
// ─────────────────────────────────────────────────────────────
export const getSalesMRP = async (dbName, platform, brands, date) => {
    const brandClause = buildBrandClause(brands);
    const query = `
        SELECT SUM(
            ifNull(toFloat64OrZero(toString(MRP)), 0) *
            ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)
        ) AS value
        FROM \`${dbName}\`.rb_pdp_olap
        WHERE DATE = '${date}'
          AND lower(Platform) = '${esc(platform.trim().toLowerCase())}'
          AND (Comp_flag = 0 OR Comp_flag IS NULL)
          ${brandClause}
    `;
    const rows = await queryAdminDB(query);
    return parseFloat(rows[0]?.value) || 0;
};

// ─────────────────────────────────────────────────────────────
// KPI 2: Sales [ASP] = SUM(Selling_Price * Qty_Sold)
// ─────────────────────────────────────────────────────────────
export const getSalesASP = async (dbName, platform, brands, date) => {
    const brandClause = buildBrandClause(brands);
    const query = `
        SELECT SUM(
            ifNull(toFloat64OrZero(toString(Selling_Price)), 0) *
            ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)
        ) AS value
        FROM \`${dbName}\`.rb_pdp_olap
        WHERE DATE = '${date}'
          AND lower(Platform) = '${esc(platform.trim().toLowerCase())}'
          AND (Comp_flag = 0 OR Comp_flag IS NULL)
          ${brandClause}
    `;
    const rows = await queryAdminDB(query);
    return parseFloat(rows[0]?.value) || 0;
};

// ─────────────────────────────────────────────────────────────
// KPI 3: Qty Sold = SUM(Qty_Sold)
// ─────────────────────────────────────────────────────────────
export const getQtySold = async (dbName, platform, brands, date) => {
    const brandClause = buildBrandClause(brands);
    const query = `
        SELECT SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS value
        FROM \`${dbName}\`.rb_pdp_olap
        WHERE DATE = '${date}'
          AND lower(Platform) = '${esc(platform.trim().toLowerCase())}'
          AND (Comp_flag = 0 OR Comp_flag IS NULL)
          ${brandClause}
    `;
    const rows = await queryAdminDB(query);
    return parseFloat(rows[0]?.value) || 0;
};

// ─────────────────────────────────────────────────────────────
// KPI 4: OSA = (SUM(neno_osa) / SUM(deno_osa)) * 100
// ─────────────────────────────────────────────────────────────
export const getOSA = async (dbName, platform, brands, date) => {
    const brandClause = buildBrandClause(brands);
    const query = `
        SELECT ROUND(
            (SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) /
             NULLIF(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100,
            2
        ) AS value
        FROM \`${dbName}\`.rb_pdp_olap
        WHERE DATE = '${date}'
          AND lower(Platform) = '${esc(platform.trim().toLowerCase())}'
          AND (Comp_flag = 0 OR Comp_flag IS NULL)
          ${brandClause}
    `;
    const rows = await queryAdminDB(query);
    return parseFloat(rows[0]?.value) || 0;
};

// ─────────────────────────────────────────────────────────────
// KPI 5: Discounting = weighted avg ((MRP - SP) / MRP) * 100
//   = SUM((MRP - SP) * Qty_Sold) / SUM(MRP * Qty_Sold) * 100
// ─────────────────────────────────────────────────────────────
export const getDiscounting = async (dbName, platform, brands, date) => {
    const brandClause = buildBrandClause(brands);
    const query = `
        SELECT ROUND(
            SUM(
                (ifNull(toFloat64OrZero(toString(MRP)), 0) - ifNull(toFloat64OrZero(toString(Selling_Price)), 0))
                * ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)
            ) * 100.0 /
            NULLIF(SUM(
                ifNull(toFloat64OrZero(toString(MRP)), 0)
                * ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)
            ), 0),
            2
        ) AS value
        FROM \`${dbName}\`.rb_pdp_olap
        WHERE DATE = '${date}'
          AND lower(Platform) = '${esc(platform.trim().toLowerCase())}'
          AND (Comp_flag = 0 OR Comp_flag IS NULL)
          ${brandClause}
    `;
    const rows = await queryAdminDB(query);
    return parseFloat(rows[0]?.value) || 0;
};

// ─────────────────────────────────────────────────────────────
// KPI 6: Market Share = our_sales / total_sales * 100
//   Uses rb_ms_olap, data at T-3
// ─────────────────────────────────────────────────────────────
export const getMarketShare = async (dbName, platform, brands, date) => {
    // Determine our brands
    let ourBrands = [];
    if (Array.isArray(brands) && brands.length > 0) {
        ourBrands = brands.filter(b => b && b !== 'All Brands' && b !== 'All');
    }
    if (ourBrands.length === 0) {
        // Fetch dynamically from rca_sku_dim
        try {
            const brandRows = await queryAdminDB(`
                SELECT DISTINCT brand_name
                FROM \`${dbName}\`.rca_sku_dim
                WHERE comp_flag = 0
                  AND brand_name IS NOT NULL AND brand_name != ''
            `);
            ourBrands = brandRows.map(b => b.brand_name).filter(Boolean);
        } catch (e) {
            console.warn('[PerfSummaryData] Could not fetch our brands for market share:', e.message);
            return 0;
        }
    }
    if (ourBrands.length === 0) return 0;

    const brandsSql = ourBrands.map(b => `'${esc(b)}'`).join(',');
    const platClause = buildMsPlatformClause(platform);

    const numQuery = `
        SELECT SUM(toFloat64OrZero(toString(sales))) AS our_sales
        FROM \`${dbName}\`.rb_ms_olap
        WHERE toDate(created_on) = '${date}'
          ${platClause}
          AND group_brand IN (${brandsSql})
    `;
    const denomQuery = `
        SELECT SUM(toFloat64OrZero(toString(sales))) AS total_sales
        FROM \`${dbName}\`.rb_ms_olap
        WHERE toDate(created_on) = '${date}'
          ${platClause}
    `;

    const [numRows, denomRows] = await Promise.all([
        queryAdminDB(numQuery),
        queryAdminDB(denomQuery),
    ]);

    const ourSales = parseFloat(numRows[0]?.our_sales) || 0;
    const totalSales = parseFloat(denomRows[0]?.total_sales) || 0;
    return totalSales > 0 ? parseFloat(((ourSales / totalSales) * 100).toFixed(2)) : 0;
};

// ─────────────────────────────────────────────────────────────
// KPI 7: SOV (SOS) = sumIf(overall, flag = 1) / sumIf(overall, 1=1) * 100
//   Uses rb_kw_olap
// ─────────────────────────────────────────────────────────────
export const getSOV = async (dbName, platform, brands, date) => {
    const query = `
        SELECT ROUND(
            sumIf(overall, flag = 1) * 100.0 /
            nullIf(sumIf(overall, 1=1), 0),
            2
        ) AS value
        FROM \`${dbName}\`.rb_kw_olap
        WHERE DATE = '${date}'
          AND lower(platform_name) = '${esc(platform.trim().toLowerCase())}'
    `;

    try {
        const rows = await queryAdminDB(query);
        return parseFloat(rows[0]?.value) || 0;
    } catch (err) {
        // rb_kw_olap may not exist for all clients
        console.warn(`[PerfSummaryData] getSOV failed for ${platform} on ${dbName}:`, err.message);
        return 0;
    }
};

// ─────────────────────────────────────────────────────────────
// Orchestrator: fetch all 7 KPIs for a single platform + date pair
// ─────────────────────────────────────────────────────────────
/**
 * Fetch all KPIs for one platform on current and previous dates.
 * @param {string} dbName - Client database
 * @param {string} platform - Platform name (e.g. "Zepto")
 * @param {string[]} brands - Brand list
 * @param {string} currentDate - YYYY-MM-DD (T-1)
 * @param {string} previousDate - YYYY-MM-DD (LWD = T-1 minus 7)
 * @param {string} msCurrentDate - YYYY-MM-DD (T-3) for Market Share
 * @param {string} msPreviousDate - YYYY-MM-DD (T-3 minus 7) for Market Share
 * @returns {Promise<Object>} All KPI values
 */
export const fetchAllPlatformKPIs = async (dbName, platform, brands, currentDate, previousDate, msCurrentDate, msPreviousDate) => {
    console.log(`[PerfSummaryData] Fetching KPIs for ${platform} on ${dbName} | Current: ${currentDate} | LWD: ${previousDate} | MS-Current: ${msCurrentDate} | MS-LWD: ${msPreviousDate}`);

    // Fire all queries in parallel for speed
    const [
        salesMrpCurr, salesMrpPrev,
        salesAspCurr, salesAspPrev,
        qtySoldCurr, qtySoldPrev,
        osaCurr, osaPrev,
        discCurr, discPrev,
        msCurr, msPrev,
        sovCurr, sovPrev,
    ] = await Promise.all([
        getSalesMRP(dbName, platform, brands, currentDate),
        getSalesMRP(dbName, platform, brands, previousDate),
        getSalesASP(dbName, platform, brands, currentDate),
        getSalesASP(dbName, platform, brands, previousDate),
        getQtySold(dbName, platform, brands, currentDate),
        getQtySold(dbName, platform, brands, previousDate),
        getOSA(dbName, platform, brands, currentDate),
        getOSA(dbName, platform, brands, previousDate),
        getDiscounting(dbName, platform, brands, currentDate),
        getDiscounting(dbName, platform, brands, previousDate),
        getMarketShare(dbName, platform, brands, msCurrentDate),
        getMarketShare(dbName, platform, brands, msPreviousDate),
        getSOV(dbName, platform, brands, currentDate),
        getSOV(dbName, platform, brands, previousDate),
    ]);

    // Compute deltas (percentage change for absolute KPIs, point change for percentage KPIs)
    // Round to 1 decimal place first to ensure UI-displayed values match the delta
    const round1 = (v) => parseFloat(parseFloat(v).toFixed(1));
    
    const pctDelta = (curr, prev) => {
        const c = round1(curr);
        const p = round1(prev);
        return p !== 0 ? round1(((c - p) / p) * 100) : (c > 0 ? 100 : 0);
    };
    
    const ptDelta = (curr, prev) => round1(round1(curr) - round1(prev));

    return {
        salesMrp: { current: salesMrpCurr, previous: salesMrpPrev, delta: pctDelta(salesMrpCurr, salesMrpPrev) },
        salesAsp: { current: salesAspCurr, previous: salesAspPrev, delta: pctDelta(salesAspCurr, salesAspPrev) },
        qtySold:  { current: qtySoldCurr,  previous: qtySoldPrev,  delta: pctDelta(qtySoldCurr, qtySoldPrev) },
        osa:      { current: osaCurr,      previous: osaPrev,      delta: ptDelta(osaCurr, osaPrev) },
        discounting: { current: discCurr,  previous: discPrev,     delta: ptDelta(discCurr, discPrev) },
        marketShare: { current: msCurr,    previous: msPrev,       delta: ptDelta(msCurr, msPrev) },
        sov:      { current: sovCurr,      previous: sovPrev,      delta: ptDelta(sovCurr, sovPrev) },
    };
};
