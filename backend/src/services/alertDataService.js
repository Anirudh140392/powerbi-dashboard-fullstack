// src/services/alertDataService.js
// Data-fetching layer for dynamic alert email content.
// Separated from cron logic for testability and reuse.

import { queryAdminDB } from '../config/adminClickhouse.js';

/**
 * Fetch company logo_url from admin_master.tb_database using db_id.
 * @param {string} dbId - The db_id from tb_alert
 * @returns {Promise<string>} logo_url or empty string
 */
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

/**
 * Parse benchmark_period string (e.g. "7 days", "14 days", "30 days", "1 week")
 * and compute current period and previous period date ranges.
 *
 * Example for "7 days" on Aug 5, 2026:
 *   currentStart = Jul 30, currentEnd = Aug 5
 *   prevStart    = Jul 22, prevEnd    = Jul 29
 *
 * @param {string} benchmarkPeriod - Human-readable period string from tb_alert
 * @returns {{ currentStart: string, currentEnd: string, prevStart: string, prevEnd: string, days: number }}
 */
export const computeDateRanges = (benchmarkPeriod) => {
    const now = new Date();
    // Shift to IST for date consistency
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffsetMs);

    let days = 7; // default
    if (benchmarkPeriod) {
        const lower = String(benchmarkPeriod).toLowerCase().trim();

        // Match "N days" pattern
        const dayMatch = lower.match(/(\d+)\s*day/);
        if (dayMatch) {
            days = parseInt(dayMatch[1], 10);
        }
        // Match "N week(s)" pattern
        else if (lower.match(/(\d+)\s*week/)) {
            const weekMatch = lower.match(/(\d+)\s*week/);
            days = parseInt(weekMatch[1], 10) * 7;
        }
        // Match "N month(s)" pattern
        else if (lower.match(/(\d+)\s*month/)) {
            const monthMatch = lower.match(/(\d+)\s*month/);
            days = parseInt(monthMatch[1], 10) * 30;
        }
        // Match common keywords
        else if (lower.includes('week')) {
            days = 7;
        } else if (lower.includes('month')) {
            days = 30;
        } else if (lower.includes('fortnight') || lower.includes('bi-week')) {
            days = 14;
        }
    }

    const formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    };

    // Current period: (today - days) to today
    const currentEnd = new Date(istNow);
    const currentStart = new Date(istNow);
    currentStart.setDate(currentStart.getDate() - days);

    // Previous period: (today - 2*days - 1) to (today - days - 1)
    const prevEnd = new Date(currentStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);

    return {
        currentStart: formatDate(currentStart),
        currentEnd: formatDate(currentEnd),
        prevStart: formatDate(prevStart),
        prevEnd: formatDate(prevEnd),
        days,
    };
};

/**
 * Build SQL IN clause from array of strings (case-insensitive)
 */
const buildInClause = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const filtered = arr.filter(v => v && v !== 'All Brands' && v !== 'All Platforms');
    if (filtered.length === 0) return null;
    return filtered.map(v => `'${v.trim().toLowerCase()}'`).join(',');
};

/**
 * Get per-brand OSA for a specific platform, both current and previous periods.
 *
 * @param {string} dbName - Client database name (e.g. "prestige")
 * @param {string} platform - Single platform name (e.g. "Amazon")
 * @param {string[]} brands - List of brand names to filter
 * @param {string} currentStart - YYYY-MM-DD
 * @param {string} currentEnd - YYYY-MM-DD
 * @param {string} prevStart - YYYY-MM-DD
 * @param {string} prevEnd - YYYY-MM-DD
 * @returns {Promise<Array<{brand: string, currentOsa: number, previousOsa: number, delta: number}>>}
 */
export const getBrandOsaByPlatform = async (dbName, platform, brands, currentStart, currentEnd, prevStart, prevEnd) => {
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
              AND lower(Platform) = '${platform.trim().toLowerCase()}'
              ${brandClause}
              AND Brand IS NOT NULL AND Brand != ''
            GROUP BY Brand
            ORDER BY brand
        `;

        const prevQuery = `
            SELECT 
                Brand as brand,
                round((SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / 
                       nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100, 2) AS osa
            FROM \`${dbName}\`.rb_pdp_olap
            WHERE DATE BETWEEN '${prevStart}' AND '${prevEnd}'
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

        // Build a map of previous OSA by brand name (case-insensitive)
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

/**
 * Get the top N most-impacted SKUs for a platform.
 *
 * Logic:
 * 1. Filter rb_pdp_olap for MSL = 1, specified platform & brands
 * 2. Join with rb_ms_olap on web_pid to find SKUs with LOWEST total sales
 * 3. For those SKUs, compute current vs previous period OSA from rb_pdp_olap
 *
 * @param {string} dbName - Client database name
 * @param {string} platform - Single platform name
 * @param {string[]} brands - Brand filter list
 * @param {string} currentStart - YYYY-MM-DD
 * @param {string} currentEnd - YYYY-MM-DD
 * @param {string} prevStart - YYYY-MM-DD
 * @param {string} prevEnd - YYYY-MM-DD
 * @param {number} [limit=5] - Max SKUs to return
 * @returns {Promise<Array<{skuName: string, brand: string, currentOsa: number, previousOsa: number, delta: number}>>}
 */
export const getImpactedSkus = async (dbName, platform, brands, currentStart, currentEnd, prevStart, prevEnd, limit = 5) => {
    try {
        const brandFilter = buildInClause(brands);
        const brandClause = brandFilter ? `AND lower(pdp.Brand) IN (${brandFilter})` : '';
        const msBrandClause = brandFilter ? `AND lower(ms.group_brand) IN (${brandFilter})` : '';

        // Step 1+2: Get MSL=1 SKUs joined with rb_ms_olap, ranked by lowest sales
        const impactedQuery = `
            WITH msl_skus AS (
                SELECT DISTINCT 
                    Web_Pid,
                    any(Product) AS product_name,
                    any(Brand) AS brand_name
                FROM \`${dbName}\`.rb_pdp_olap AS pdp
                WHERE MSL = 1
                  AND lower(Platform) = '${platform.trim().toLowerCase()}'
                  ${brandClause}
                  AND DATE BETWEEN '${currentStart}' AND '${currentEnd}'
                  AND Web_Pid IS NOT NULL AND Web_Pid != ''
                GROUP BY Web_Pid
            ),
            sku_sales AS (
                SELECT 
                    ms.web_pid,
                    SUM(ifNull(toFloat64OrZero(toString(ms.sales)), 0)) AS total_sales
                FROM \`${dbName}\`.rb_ms_olap AS ms
                INNER JOIN msl_skus AS m ON ms.web_pid = m.Web_Pid
                WHERE toDate(ms.created_on) BETWEEN '${currentStart}' AND '${currentEnd}'
                  AND lower(ms.platform) = '${platform.trim().toLowerCase()}'
                  ${msBrandClause}
                GROUP BY ms.web_pid
            )
            SELECT 
                m.Web_Pid AS web_pid,
                m.product_name,
                m.brand_name,
                ifNull(s.total_sales, 0) AS total_sales
            FROM msl_skus AS m
            LEFT JOIN sku_sales AS s ON m.Web_Pid = s.web_pid
            ORDER BY total_sales ASC
            LIMIT ${limit}
        `;

        const impactedRows = await queryAdminDB(impactedQuery);

        if (impactedRows.length === 0) {
            console.log(`[AlertData] No impacted SKUs found for ${platform} on ${dbName}`);
            return [];
        }

        // Step 3: Get current and previous OSA for these specific SKUs
        const webPids = impactedRows.map(r => `'${r.web_pid}'`).join(',');

        const currentOsaQuery = `
            SELECT 
                Web_Pid AS web_pid,
                round((SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / 
                       nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100, 2) AS osa
            FROM \`${dbName}\`.rb_pdp_olap
            WHERE DATE BETWEEN '${currentStart}' AND '${currentEnd}'
              AND lower(Platform) = '${platform.trim().toLowerCase()}'
              AND Web_Pid IN (${webPids})
            GROUP BY Web_Pid
        `;

        const prevOsaQuery = `
            SELECT 
                Web_Pid AS web_pid,
                round((SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / 
                       nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100, 2) AS osa
            FROM \`${dbName}\`.rb_pdp_olap
            WHERE DATE BETWEEN '${prevStart}' AND '${prevEnd}'
              AND lower(Platform) = '${platform.trim().toLowerCase()}'
              AND Web_Pid IN (${webPids})
            GROUP BY Web_Pid
        `;

        const [currentOsaRows, prevOsaRows] = await Promise.all([
            queryAdminDB(currentOsaQuery),
            queryAdminDB(prevOsaQuery),
        ]);

        // Build lookup maps
        const currentOsaMap = new Map();
        for (const row of currentOsaRows) {
            currentOsaMap.set(row.web_pid, parseFloat(row.osa) || 0);
        }
        const prevOsaMap = new Map();
        for (const row of prevOsaRows) {
            prevOsaMap.set(row.web_pid, parseFloat(row.osa) || 0);
        }

        return impactedRows.map(row => {
            const currentOsa = currentOsaMap.get(row.web_pid) || 0;
            const previousOsa = prevOsaMap.get(row.web_pid) || 0;
            const delta = parseFloat((currentOsa - previousOsa).toFixed(2));
            return {
                skuName: row.product_name || row.web_pid,
                brand: row.brand_name || 'Unknown',
                currentOsa: parseFloat(currentOsa.toFixed(2)),
                previousOsa: parseFloat(previousOsa.toFixed(2)),
                delta,
            };
        });
    } catch (err) {
        console.error(`[AlertData] getImpactedSkus failed for ${platform} on ${dbName}:`, err.message);
        return [];
    }
};

/**
 * Get aggregate (overall) OSA across all specified platforms and brands for the header metrics.
 *
 * @param {string} dbName
 * @param {string[]} platforms
 * @param {string[]} brands
 * @param {string} currentStart
 * @param {string} currentEnd
 * @param {string} prevStart
 * @param {string} prevEnd
 * @returns {Promise<{currentOsa: number, previousOsa: number, delta: number}>}
 */
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
              ${platClause}
              ${brandClause}
        `;

        const prevQuery = `
            SELECT 
                round((SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / 
                       nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100, 2) AS osa
            FROM \`${dbName}\`.rb_pdp_olap
            WHERE DATE BETWEEN '${prevStart}' AND '${prevEnd}'
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
