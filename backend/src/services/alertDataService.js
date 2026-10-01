// src/services/alertDataService.js
// Data-fetching layer for dynamic alert email content.
// Separated from cron logic for testability and reuse.

import { queryAdminDB } from '../config/adminClickhouse.js';

export const getCompanyLogo = async (dbId) => {
    try {
        const rows = await queryAdminDB(`
            SELECT logo_url
            FROM tb_database
            WHERE toString(db_id) = '${dbId}'
            LIMIT 1
        `);
        return (rows.length > 0 && rows[0].logo_url) ? rows[0].logo_url : '';
    } catch (err) {
        console.error('[AlertData] Failed to fetch company logo:', err.message);
        return '';
    }
};

export const getLatestDataDate = async (dbName) => {
    try {
        const rows = await queryAdminDB(`
            SELECT toString(MAX(DATE)) AS max_date
            FROM \`${dbName}\`.rb_pdp_olap
            WHERE DATE IS NOT NULL
        `);
        const maxDate = rows.length > 0 ? rows[0].max_date : null;
        if (maxDate && maxDate !== '1970-01-01' && maxDate !== '0000-00-00') {
            console.log(`[AlertData] Latest data date for ${dbName}: ${maxDate}`);
            return maxDate;
        }
        // Fallback to today - 1 (IST)
        const now = new Date();
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffsetMs);
        istNow.setDate(istNow.getDate() - 1);
        const fallback = `${istNow.getFullYear()}-${String(istNow.getMonth() + 1).padStart(2, '0')}-${String(istNow.getDate()).padStart(2, '0')}`;
        console.warn(`[AlertData] MAX(DATE) returned invalid for ${dbName}, using fallback: ${fallback}`);
        return fallback;
    } catch (err) {
        console.error(`[AlertData] Failed to fetch latest data date for ${dbName}:`, err.message);
        // Fallback to today - 1 (IST)
        const now = new Date();
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffsetMs);
        istNow.setDate(istNow.getDate() - 1);
        return `${istNow.getFullYear()}-${String(istNow.getMonth() + 1).padStart(2, '0')}-${String(istNow.getDate()).padStart(2, '0')}`;
    }
};

export const computeDateRanges = (benchmarkPeriod, latestDateStr) => {
    let maxDate;
    if (latestDateStr) {
        maxDate = new Date(latestDateStr);
    } else {
        const now = new Date();
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        maxDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffsetMs);
    }

    let currentStart = new Date(maxDate);
    let currentEnd = new Date(maxDate);
    let prevStart = new Date(maxDate);
    let prevEnd = new Date(maxDate);

    const bp = (benchmarkPeriod || '').toLowerCase().trim();

    if (bp.includes('previous day')) {
        prevStart.setDate(prevStart.getDate() - 1);
        prevEnd.setDate(prevEnd.getDate() - 1);
    } else if (bp.includes('same day last week')) {
        prevStart.setDate(prevStart.getDate() - 7);
        prevEnd.setDate(prevEnd.getDate() - 7);
    } else if (bp.includes('30-day average') || bp.includes('month')) {
        currentStart.setDate(currentStart.getDate() - 29);
        prevEnd.setDate(prevEnd.getDate() - 30);
        prevStart.setDate(prevStart.getDate() - 59);
    } else {
        currentStart.setDate(currentStart.getDate() - 6);
        prevEnd.setDate(prevEnd.getDate() - 7);
        prevStart.setDate(prevStart.getDate() - 13);
    }

    const formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    };

    return {
        currentStart: formatDate(currentStart),
        currentEnd: formatDate(currentEnd),
        prevStart: formatDate(prevStart),
        prevEnd: formatDate(prevEnd),
        days: Math.round((currentEnd - currentStart) / (1000 * 60 * 60 * 24)) + 1
    };
};

const buildInClause = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const filtered = arr.filter(v => v && v !== 'All Brands' && v !== 'All Platforms');
    if (filtered.length === 0) return null;
    return filtered.map(v => `'${v.trim().toLowerCase()}'`).join(',');
};

export const getBrandOsaByPlatform = async (dbName, platform, brands, currentStart, currentEnd, prevStart, prevEnd, thresholdValue = null) => {
    try {
        const brandFilter = buildInClause(brands);
        const brandClause = brandFilter ? `AND lower(Brand) IN (${brandFilter})` : '';

        const currentQuery = `
            SELECT 
                Brand as brand,
                round((SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / 
                       nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100, 2) AS osa
            FROM \`${dbName}\`.rb_pdp_olap
            WHERE DATE BETWEEN '${currentStart}' AND '${currentEnd}'
              AND toString(Comp_flag) = '0'
              AND lower(Platform) = '${platform.trim().toLowerCase()}'
              ${brandClause}
              AND Brand IS NOT NULL AND Brand != ''
            GROUP BY Brand
            ${thresholdValue !== null ? `HAVING osa < ${thresholdValue}` : ''}
            ORDER BY brand
        `;

        const prevQuery = `
            SELECT 
                Brand as brand,
                round((SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / 
                       nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100, 2) AS osa
            FROM \`${dbName}\`.rb_pdp_olap
            WHERE DATE BETWEEN '${prevStart}' AND '${prevEnd}'
              AND toString(Comp_flag) = '0'
              AND lower(Platform) = '${platform.trim().toLowerCase()}'
              ${brandClause}
              AND Brand IS NOT NULL AND Brand != ''
            GROUP BY Brand
            ORDER BY brand
        `;

        const [currentRows, prevRows] = await Promise.all([
            queryAdminDB(currentQuery),
            queryAdminDB(prevQuery),
        ]);

        const prevMap = new Map();
        for (const row of prevRows) {
            prevMap.set(String(row.brand).toLowerCase(), parseFloat(row.osa) || 0);
        }

        return currentRows.map(row => {
            const currentOsa = parseFloat(row.osa) || 0;
            const previousOsa = prevMap.get(String(row.brand).toLowerCase()) || 0;
            return {
                brand: row.brand,
                currentOsa: parseFloat(currentOsa.toFixed(2)),
                previousOsa: parseFloat(previousOsa.toFixed(2)),
                delta: parseFloat((currentOsa - previousOsa).toFixed(2)),
            };
        });
    } catch (err) {
        console.error(`[AlertData] getBrandOsaByPlatform failed for ${platform} on ${dbName}:`, err.message);
        return [];
    }
};

export const getImpactedSkus = async (dbName, platform, brands, currentStart, currentEnd, prevStart, prevEnd, limit = 3, thresholdValue = 95) => {
    try {
        const brandFilter = buildInClause(brands);
        const brandClause = brandFilter ? `AND lower(Brand) IN (${brandFilter})` : '';

        const impactedQuery = `
            WITH sku_metrics AS (
                SELECT
                    Platform,
                    LOWER(Web_Pid) AS web_pid_lower,
                    any(Product) AS SKU_Name,
                    any(Brand) AS brand_name,
                    SUM(IF(DATE BETWEEN '${currentStart}' AND '${currentEnd}', ifNull(toFloat64OrZero(toString(Sales)), 0), 0)) AS Current_Sales,
                    SUM(IF(DATE BETWEEN '${prevStart}' AND '${prevEnd}', ifNull(toFloat64OrZero(toString(Sales)), 0), 0)) AS Previous_Sales,
                    SUM(IF(DATE BETWEEN '${currentStart}' AND '${currentEnd}', ifNull(toFloat64OrZero(toString(neno_osa)), 0), 0)) / nullIf(SUM(IF(DATE BETWEEN '${currentStart}' AND '${currentEnd}', ifNull(toFloat64OrZero(toString(deno_osa)), 0), 0)), 0) AS Current_OSA,
                    SUM(IF(DATE BETWEEN '${prevStart}' AND '${prevEnd}', ifNull(toFloat64OrZero(toString(neno_osa)), 0), 0)) / nullIf(SUM(IF(DATE BETWEEN '${prevStart}' AND '${prevEnd}', ifNull(toFloat64OrZero(toString(deno_osa)), 0), 0)), 0) AS Previous_OSA
                FROM \`${dbName}\`.rb_pdp_olap
                WHERE msl = 1
                  AND lower(Platform) = '${platform.trim().toLowerCase()}'
                  ${brandClause}
                  AND DATE BETWEEN '${prevStart}' AND '${currentEnd}'
                  AND toString(Comp_flag) = '0'
                GROUP BY Platform, web_pid_lower
            )
            SELECT
                Platform, Web_Pid, SKU_Name, brand_name, Previous_Sales, Current_Sales, Sales_Loss, Current_OSA, Previous_OSA, OSA_Delta
            FROM
            (
                SELECT
                    Platform, web_pid_lower AS Web_Pid, SKU_Name, brand_name, Previous_Sales, Current_Sales,
                    (Previous_Sales - Current_Sales) AS Sales_Loss, Current_OSA, Previous_OSA,
                    (Current_OSA - Previous_OSA) AS OSA_Delta,
                    ROW_NUMBER() OVER (PARTITION BY Platform ORDER BY (Previous_Sales - Current_Sales) DESC) AS rn
                FROM sku_metrics
                WHERE (Previous_Sales - Current_Sales) > 0
                  AND Current_OSA < (${thresholdValue} / 100.0)
                  AND (Current_OSA - Previous_OSA) < 0
            )
            WHERE rn <= ${limit}
            ORDER BY Platform, Sales_Loss DESC;
        `;

        const impactedRows = await queryAdminDB(impactedQuery);

        if (impactedRows.length === 0) {
            console.log(`[AlertData] No impacted SKUs found for ${platform} on ${dbName}`);
            return [];
        }

        return impactedRows.map(row => {
            const currentOsa = parseFloat(row.Current_OSA) * 100 || 0;
            const previousOsa = parseFloat(row.Previous_OSA) * 100 || 0;
            const delta = parseFloat(row.OSA_Delta) * 100 || 0;
            
            return {
                skuName: row.SKU_Name || row.Web_Pid,
                brand: row.brand_name || 'Unknown',
                currentOsa: parseFloat(currentOsa.toFixed(2)),
                previousOsa: parseFloat(previousOsa.toFixed(2)),
                delta: parseFloat(delta.toFixed(2)),
                salesLoss: parseFloat(row.Sales_Loss) || 0,
            };
        });
    } catch (err) {
        console.error(`[AlertData] getImpactedSkus failed for ${platform} on ${dbName}:`, err.message);
        return [];
    }
};

export const getAggregateOsa = async (dbName, platforms, brands, currentStart, currentEnd, prevStart, prevEnd) => {
    try {
        const platFilter = buildInClause(platforms);
        const platClause = platFilter ? `AND lower(Platform) IN (${platFilter})` : '';
        const brandFilter = buildInClause(brands);
        const brandClause = brandFilter ? `AND lower(Brand) IN (${brandFilter})` : '';

        const currentQuery = `
            SELECT 
                round((SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / 
                       nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100, 2) AS osa
            FROM \`${dbName}\`.rb_pdp_olap
            WHERE DATE BETWEEN '${currentStart}' AND '${currentEnd}'
              AND toString(Comp_flag) = '0'
              ${platClause}
              ${brandClause}
        `;

        const prevQuery = `
            SELECT 
                round((SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / 
                       nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100, 2) AS osa
            FROM \`${dbName}\`.rb_pdp_olap
            WHERE DATE BETWEEN '${prevStart}' AND '${prevEnd}'
              AND toString(Comp_flag) = '0'
              ${platClause}
              ${brandClause}
        `;

        const [currentRows, prevRows] = await Promise.all([
            queryAdminDB(currentQuery),
            queryAdminDB(prevQuery),
        ]);

        const currentOsa = parseFloat(currentRows[0]?.osa) || 0;
        const previousOsa = parseFloat(prevRows[0]?.osa) || 0;

        return {
            currentOsa: parseFloat(currentOsa.toFixed(2)),
            previousOsa: parseFloat(previousOsa.toFixed(2)),
            delta: parseFloat((currentOsa - previousOsa).toFixed(2)),
        };
    } catch (err) {
        console.error(`[AlertData] getAggregateOsa failed for ${dbName}:`, err.message);
        return { currentOsa: 0, previousOsa: 0, delta: 0 };
    }
};
