// src/services/ptdPerfSummaryDataService.js
// Data-fetching layer for Period-To-Date (PTD) Performance Summary alert email.
// Date logic: CP = current period (start to today), PP = same duration from previous period start.
// KPIs: Weighted Discount, OSA, Ad Spend, TACoS, SOS (from OLAP) + Primary Info (from po_primary_sales & po_primary_billing_v2).

import { queryAdminDB } from '../config/adminClickhouse.js';

const esc = (str) => (str ? String(str).replace(/'/g, "''") : '');

// ─────────────────────────────────────────────────────────────
// Platform derivation from PO number
// Zepto:     starts with 'p' followed by digits only (e.g. p3345307)
// Blinkit:   purely numeric (e.g. 2575110109046)
// Instamart: contains 'po' substring (e.g. mbipo385968, mblpo400604)
// ─────────────────────────────────────────────────────────────
export const derivePlatformFromPo = (po) => {
    if (!po) return 'unknown';
    const s = String(po).trim();
    // Purely numeric → Blinkit
    if (/^\d+$/.test(s)) return 'blinkit';
    // Contains 'po' (case-insensitive) anywhere → Instamart
    if (/po/i.test(s)) return 'instamart';
    // Starts with 'p' (case-insensitive) followed by digits → Zepto
    if (/^[pP]\d+$/.test(s)) return 'zepto';
    return 'unknown';
};

// ─────────────────────────────────────────────────────────────
// Period date logic using tb_period from mars database
// Returns { cpStart, cpEnd, ppStart, ppEnd, duration }
// duration = number of days from cpStart to today (inclusive)
// ppStart..ppEnd = same duration window starting from previous period W1 start
// ─────────────────────────────────────────────────────────────
export const getPTDDateRanges = async () => {
    // Step 1: find current period row for today
    const periodQuery = `
        SELECT min(start_date) AS cp_start
        FROM admin_master.tb_period
        WHERE period = (
            SELECT period 
            FROM admin_master.tb_period 
            WHERE start_date <= today() AND end_date >= today() 
            LIMIT 1
        )
    `;

    let rows;
    try {
        rows = await queryAdminDB(periodQuery);
    } catch (err) {
        console.error('[PTDPerfSummary] getPTDDateRanges failed to fetch current period:', err.message);
        throw err;
    }

    if (!rows || rows.length === 0 || !rows[0].cp_start) {
        throw new Error('[PTDPerfSummary] No period found in tb_period for today.');
    }

    const cpStart = String(rows[0].cp_start).slice(0, 10);
    const today = new Date();
    // Format today as YYYY-MM-DD in local time
    const todayStr = today.toISOString().slice(0, 10);

    // duration = days from cpStart to today (0-based)
    const dStart = new Date(cpStart);
    const dToday = new Date(todayStr);
    const duration = Math.floor((dToday - dStart) / (1000 * 60 * 60 * 24));

    // Step 2: find previous period's earliest week_start_date (W1 start)
    const prevPeriodQuery = `
        SELECT min(start_date) AS pp_start
        FROM admin_master.tb_period
        WHERE period = (
            SELECT period 
            FROM admin_master.tb_period 
            WHERE end_date < toDate('${cpStart}') 
            ORDER BY end_date DESC 
            LIMIT 1
        )
    `;

    let prevRows;
    try {
        prevRows = await queryAdminDB(prevPeriodQuery);
    } catch (err) {
        console.error('[PTDPerfSummary] getPTDDateRanges failed to fetch previous period:', err.message);
        throw err;
    }

    let ppStart;
    if (!prevRows || prevRows.length === 0 || !prevRows[0].pp_start) {
        throw new Error('[PTDPerfSummary] No previous period found in tb_period.');
    } else {
        ppStart = String(prevRows[0].pp_start).slice(0, 10);
    }

    // ppEnd = ppStart + duration days
    const dPpStart = new Date(ppStart);
    const dPpEnd = new Date(dPpStart);
    dPpEnd.setDate(dPpStart.getDate() + duration);
    const ppEnd = dPpEnd.toISOString().slice(0, 10);

    console.log(`[PTDPerfSummary] CP: ${cpStart} to ${todayStr} (${duration + 1} days) | PP: ${ppStart} to ${ppEnd}`);

    return { cpStart, cpEnd: todayStr, ppStart, ppEnd, duration };
};

// ─────────────────────────────────────────────────────────────
// Primary Sales KPIs from po_primary_sales + po_primary_billing_v2
// Groups by derived platform (from po_number)
// ─────────────────────────────────────────────────────────────
export const getPrimaryKPIsByPlatform = async (dbName, cpStart, cpEnd, ppStart, ppEnd) => {
    const salesQuery = `
        SELECT
            period,
            po_number,
            SUM(toFloat64OrZero(toString(order_qty)))      AS sum_order_qty,
            SUM(toFloat64OrZero(toString(confirmed_qty)))  AS sum_confirmed_qty,
            SUM(
                multiIf(
                    toFloat64OrZero(toString(order_qty)) > 0, 
                    (toFloat64OrZero(toString(nv)) / toFloat64OrZero(toString(order_qty))) * toFloat64OrZero(toString(confirmed_qty)),
                    0
                )
            )                                               AS sum_confirmed_value
        FROM (
            SELECT 'CP' AS period, po_number, order_qty, confirmed_qty, nv
            FROM \`${dbName}\`.po_primary_sales
            WHERE po_date >= toDate('${cpStart}') AND po_date <= toDate('${cpEnd}')
            UNION ALL
            SELECT 'PP' AS period, po_number, order_qty, confirmed_qty, nv
            FROM \`${dbName}\`.po_primary_sales
            WHERE po_date >= toDate('${ppStart}') AND po_date <= toDate('${ppEnd}')
        )
        GROUP BY period, po_number
    `;

    const billingQuery = `
        SELECT
            period_type,
            po_number,
            SUM(toFloat64OrZero(toString(sale_in_lacs)) * 100000) AS sum_billed_value
        FROM (
            SELECT 'CP' AS period_type, po_number, sale_in_lacs
            FROM \`${dbName}\`.po_primary_billing_v2
            WHERE billing_date >= toDate('${cpStart}') AND billing_date <= toDate('${cpEnd}')
            UNION ALL
            SELECT 'PP' AS period_type, po_number, sale_in_lacs
            FROM \`${dbName}\`.po_primary_billing_v2
            WHERE billing_date >= toDate('${ppStart}') AND billing_date <= toDate('${ppEnd}')
        )
        GROUP BY period_type, po_number
    `;

    const [salesRows, billingRows] = await Promise.all([
        queryAdminDB(salesQuery).catch(err => { console.error('[PTDPerfSummary] sales query error:', err.message); return []; }),
        queryAdminDB(billingQuery).catch(err => { console.error('[PTDPerfSummary] billing query error:', err.message); return []; }),
    ]);

    const result = {};
    const ensurePlatform = (platform, period) => {
        if (!result[platform]) result[platform] = {};
        if (!result[platform][period]) {
            result[platform][period] = { orderedQty: 0, confirmedQty: 0, confirmedValue: 0, billedValue: 0 };
        }
    };

    for (const row of salesRows) {
        const platform = derivePlatformFromPo(row.po_number);
        const period = row.period;
        ensurePlatform(platform, period);
        result[platform][period].orderedQty     += parseFloat(row.sum_order_qty || 0);
        result[platform][period].confirmedQty   += parseFloat(row.sum_confirmed_qty || 0);
        result[platform][period].confirmedValue += parseFloat(row.sum_confirmed_value || 0);
    }

    for (const row of billingRows) {
        const platform = derivePlatformFromPo(row.po_number);
        const period = row.period_type;
        ensurePlatform(platform, period);
        result[platform][period].billedValue += parseFloat(row.sum_billed_value || 0);
    }

    return result;
};

// ─────────────────────────────────────────────────────────────
// OLAP KPIs: Weighted Discount, OSA, Ad Spend, TACoS, SOS
// Grouped by Platform using PTD date ranges
// ─────────────────────────────────────────────────────────────
export const getOlapKPIsByPlatform = async (dbName, cpStart, cpEnd, ppStart, ppEnd) => {
    const pdpQuery = `
        SELECT
            lower(trim(Platform)) AS platform,
            sumIf(toFloat64OrZero(toString(Qty_Sold)), DATE >= toDate('${cpStart}') AND DATE <= toDate('${cpEnd}')) AS cp_qty,
            sumIf(toFloat64OrZero(toString(Selling_Price)) * toFloat64OrZero(toString(Qty_Sold)), DATE >= toDate('${cpStart}') AND DATE <= toDate('${cpEnd}')) AS cp_gmv,
            sumIf((toFloat64OrZero(toString(MRP)) - toFloat64OrZero(toString(Selling_Price))) * toFloat64OrZero(toString(Qty_Sold)), DATE >= toDate('${cpStart}') AND DATE <= toDate('${cpEnd}')) AS cp_disc_num,
            sumIf(toFloat64OrZero(toString(MRP)) * toFloat64OrZero(toString(Qty_Sold)), DATE >= toDate('${cpStart}') AND DATE <= toDate('${cpEnd}')) AS cp_disc_den,
            sumIf(toFloat64OrZero(toString(neno_osa)), DATE >= toDate('${cpStart}') AND DATE <= toDate('${cpEnd}')) AS cp_osa_num,
            sumIf(toFloat64OrZero(toString(deno_osa)), DATE >= toDate('${cpStart}') AND DATE <= toDate('${cpEnd}')) AS cp_osa_den,
            sumIf(toFloat64OrZero(toString(Qty_Sold)), DATE >= toDate('${ppStart}') AND DATE <= toDate('${ppEnd}')) AS pp_qty,
            sumIf(toFloat64OrZero(toString(Selling_Price)) * toFloat64OrZero(toString(Qty_Sold)), DATE >= toDate('${ppStart}') AND DATE <= toDate('${ppEnd}')) AS pp_gmv,
            sumIf((toFloat64OrZero(toString(MRP)) - toFloat64OrZero(toString(Selling_Price))) * toFloat64OrZero(toString(Qty_Sold)), DATE >= toDate('${ppStart}') AND DATE <= toDate('${ppEnd}')) AS pp_disc_num,
            sumIf(toFloat64OrZero(toString(MRP)) * toFloat64OrZero(toString(Qty_Sold)), DATE >= toDate('${ppStart}') AND DATE <= toDate('${ppEnd}')) AS pp_disc_den,
            sumIf(toFloat64OrZero(toString(neno_osa)), DATE >= toDate('${ppStart}') AND DATE <= toDate('${ppEnd}')) AS pp_osa_num,
            sumIf(toFloat64OrZero(toString(deno_osa)), DATE >= toDate('${ppStart}') AND DATE <= toDate('${ppEnd}')) AS pp_osa_den
        FROM \`${dbName}\`.rb_pdp_olap
        WHERE (
            (DATE >= toDate('${cpStart}') AND DATE <= toDate('${cpEnd}'))
            OR (DATE >= toDate('${ppStart}') AND DATE <= toDate('${ppEnd}'))
        )
        AND (Comp_flag = 0 OR Comp_flag IS NULL)
        AND Platform IS NOT NULL AND trim(Platform) != ''
        GROUP BY platform
    `;

    const adQuery = `
        SELECT
            lower(trim(Platform)) AS platform,
            sumIf(toFloat64OrZero(toString(ad_spend)), DATE >= toDate('${cpStart}') AND DATE <= toDate('${cpEnd}')) AS cp_spend,
            sumIf(toFloat64OrZero(toString(ad_spend)), DATE >= toDate('${ppStart}') AND DATE <= toDate('${ppEnd}')) AS pp_spend
        FROM \`${dbName}\`.rb_pm_olap
        WHERE (
            (DATE >= toDate('${cpStart}') AND DATE <= toDate('${cpEnd}'))
            OR (DATE >= toDate('${ppStart}') AND DATE <= toDate('${ppEnd}'))
        )
        AND Platform IS NOT NULL AND trim(Platform) != ''
        GROUP BY platform
    `;

    const buildSosQuery = (platCol) => `
        SELECT
            lower(trim(${platCol})) AS platform,
            ROUND(
                sumIf(overall, flag = 1 AND DATE >= toDate('${cpStart}') AND DATE <= toDate('${cpEnd}')) * 100.0
                / nullIf(sumIf(overall, DATE >= toDate('${cpStart}') AND DATE <= toDate('${cpEnd}')), 0),
                2
            ) AS cp_sos,
            ROUND(
                sumIf(overall, flag = 1 AND DATE >= toDate('${ppStart}') AND DATE <= toDate('${ppEnd}')) * 100.0
                / nullIf(sumIf(overall, DATE >= toDate('${ppStart}') AND DATE <= toDate('${ppEnd}')), 0),
                2
            ) AS pp_sos
        FROM \`${dbName}\`.rb_kw_olap
        WHERE (
            (DATE >= toDate('${cpStart}') AND DATE <= toDate('${cpEnd}'))
            OR (DATE >= toDate('${ppStart}') AND DATE <= toDate('${ppEnd}'))
        )
        AND ${platCol} IS NOT NULL AND trim(${platCol}) != ''
        GROUP BY platform
    `;

    const [pdpRows, adRows] = await Promise.all([
        queryAdminDB(pdpQuery).catch(err => { console.error('[PTDPerfSummary] PDP OLAP error:', err.message); return []; }),
        queryAdminDB(adQuery).catch(err => { console.error('[PTDPerfSummary] Ad OLAP error:', err.message); return []; }),
    ]);

    let sosRows = [];
    try {
        sosRows = await queryAdminDB(buildSosQuery('platform_name'));
    } catch (_) {
        try { sosRows = await queryAdminDB(buildSosQuery('platform')); } catch (e2) {
            console.warn('[PTDPerfSummary] SOS query failed:', e2.message);
        }
    }

    const round1 = (v) => parseFloat(parseFloat(v || 0).toFixed(1));
    const pctDelta = (c, p) => { c = round1(c); p = round1(p); return p !== 0 ? round1(((c - p) / p) * 100) : (c > 0 ? 100 : 0); };
    const ptDelta  = (c, p) => round1(round1(c) - round1(p));

    const result = {};

    for (const row of pdpRows) {
        const plat = row.platform || 'unknown';
        const cpGmv = parseFloat(row.cp_gmv || 0);
        const ppGmv = parseFloat(row.pp_gmv || 0);
        const cpDisc = parseFloat(row.cp_disc_den || 0) > 0 ? round1(parseFloat(row.cp_disc_num) / parseFloat(row.cp_disc_den) * 100) : 0;
        const ppDisc = parseFloat(row.pp_disc_den || 0) > 0 ? round1(parseFloat(row.pp_disc_num) / parseFloat(row.pp_disc_den) * 100) : 0;
        const cpOsa  = parseFloat(row.cp_osa_den  || 0) > 0 ? round1(parseFloat(row.cp_osa_num)  / parseFloat(row.cp_osa_den)  * 100) : 0;
        const ppOsa  = parseFloat(row.pp_osa_den  || 0) > 0 ? round1(parseFloat(row.pp_osa_num)  / parseFloat(row.pp_osa_den)  * 100) : 0;
        
        const cpQty = parseFloat(row.cp_qty || 0);
        const ppQty = parseFloat(row.pp_qty || 0);

        result[plat] = {
            offtakeUnits: { current: cpQty, previous: ppQty, delta: pctDelta(cpQty, ppQty) },
            offtakeGmv:   { current: cpGmv, previous: ppGmv, delta: pctDelta(cpGmv, ppGmv) },
            discount: { current: cpDisc, previous: ppDisc, delta: ptDelta(cpDisc, ppDisc) },
            osa:      { current: cpOsa,  previous: ppOsa,  delta: ptDelta(cpOsa, ppOsa) },
            _cpGmv: cpGmv,
            _ppGmv: ppGmv,
        };
    }

    for (const row of adRows) {
        const plat = row.platform || 'unknown';
        if (!result[plat]) result[plat] = { _cpGmv: 0, _ppGmv: 0 };
        const cpSpend = parseFloat(row.cp_spend || 0);
        const ppSpend = parseFloat(row.pp_spend || 0);
        const cpTacos = result[plat]._cpGmv > 0 ? round1(cpSpend / result[plat]._cpGmv * 100) : 0;
        const ppTacos = result[plat]._ppGmv > 0 ? round1(ppSpend / result[plat]._ppGmv * 100) : 0;
        result[plat].adSpend = { current: cpSpend, previous: ppSpend, delta: pctDelta(cpSpend, ppSpend) };
        result[plat].tacos   = { current: cpTacos,  previous: ppTacos,  delta: ptDelta(cpTacos, ppTacos) };
    }

    for (const row of sosRows) {
        const plat = row.platform || 'unknown';
        if (!result[plat]) result[plat] = { _cpGmv: 0, _ppGmv: 0 };
        const cpSos = parseFloat(row.cp_sos || 0);
        const ppSos = parseFloat(row.pp_sos || 0);
        result[plat].sos = { current: cpSos, previous: ppSos, delta: ptDelta(cpSos, ppSos) };
    }

    for (const plat of Object.keys(result)) {
        delete result[plat]._cpGmv;
        delete result[plat]._ppGmv;
        if (!result[plat].offtakeUnits) result[plat].offtakeUnits = { current: 0, previous: 0, delta: 0 };
        if (!result[plat].offtakeGmv)   result[plat].offtakeGmv   = { current: 0, previous: 0, delta: 0 };
        if (!result[plat].discount) result[plat].discount = { current: 0, previous: 0, delta: 0 };
        if (!result[plat].osa)      result[plat].osa      = { current: 0, previous: 0, delta: 0 };
        if (!result[plat].adSpend)  result[plat].adSpend  = { current: 0, previous: 0, delta: 0 };
        if (!result[plat].tacos)    result[plat].tacos    = { current: 0, previous: 0, delta: 0 };
        if (!result[plat].sos)      result[plat].sos      = { current: 0, previous: 0, delta: 0 };
    }

    return result;
};

// ─────────────────────────────────────────────────────────────
// Orchestrator: assemble all platform KPIs for PTD alert
// ─────────────────────────────────────────────────────────────
export const fetchPTDPlatformKPIs = async (dbName, platforms) => {
    const { cpStart, cpEnd, ppStart, ppEnd } = await getPTDDateRanges();

    const [primaryData, olapData] = await Promise.all([
        getPrimaryKPIsByPlatform(dbName, cpStart, cpEnd, ppStart, ppEnd),
        getOlapKPIsByPlatform(dbName, cpStart, cpEnd, ppStart, ppEnd),
    ]);

    const pctDelta = (curr, prev) => {
        const c = parseFloat(curr || 0); const p = parseFloat(prev || 0);
        return p !== 0 ? parseFloat(((c - p) / p * 100).toFixed(1)) : (c > 0 ? 100 : 0);
    };

    // Union of all discovered platforms + requested ones
    const allPlatforms = new Set([
        ...platforms.map(p => p.toLowerCase()),
        ...Object.keys(primaryData),
        ...Object.keys(olapData),
    ]);

    const allowedPlatforms = new Set(['blinkit', 'instamart', 'zepto']);

    const result = [];
    for (const platKey of allPlatforms) {
        if (!allowedPlatforms.has(platKey)) continue;

        const primary = primaryData[platKey] || {};
        const olap    = olapData[platKey]    || {};
        const cpP = primary.CP || { orderedQty: 0, confirmedQty: 0, confirmedValue: 0, billedValue: 0 };
        const ppP = primary.PP || { orderedQty: 0, confirmedQty: 0, confirmedValue: 0, billedValue: 0 };

        result.push({
            platform: platKey.charAt(0).toUpperCase() + platKey.slice(1),
            cpStart, cpEnd, ppStart, ppEnd,
            kpis: {
                offtakeUnits:   olap.offtakeUnits || { current: 0, previous: 0, delta: 0 },
                offtakeGmv:     olap.offtakeGmv   || { current: 0, previous: 0, delta: 0 },
                discount:       olap.discount || { current: 0, previous: 0, delta: 0 },
                osa:            olap.osa      || { current: 0, previous: 0, delta: 0 },
                adSpend:        olap.adSpend  || { current: 0, previous: 0, delta: 0 },
                tacos:          olap.tacos    || { current: 0, previous: 0, delta: 0 },
                sos:            olap.sos      || { current: 0, previous: 0, delta: 0 },
                orderedQty:     { current: cpP.orderedQty,    previous: ppP.orderedQty,    delta: pctDelta(cpP.orderedQty,    ppP.orderedQty) },
                confirmedQty:   { current: cpP.confirmedQty,  previous: ppP.confirmedQty,  delta: pctDelta(cpP.confirmedQty,  ppP.confirmedQty) },
                confirmedValue: { current: cpP.confirmedValue, previous: ppP.confirmedValue, delta: pctDelta(cpP.confirmedValue, ppP.confirmedValue) },
                billedValue:    { current: cpP.billedValue,   previous: ppP.billedValue,   delta: pctDelta(cpP.billedValue,   ppP.billedValue) },
            },
        });
    }

    return { platformCards: result, cpStart, cpEnd, ppStart, ppEnd };
};
