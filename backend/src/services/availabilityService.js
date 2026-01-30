/**
 * Availability Analysis Service - ClickHouse Version
 * Migrated from Sequelize/MySQL to native ClickHouse client
 */

import dayjs from 'dayjs';
import { queryClickHouse } from '../config/clickhouse.js';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

// Helper to build WHERE clause from filters
const buildWhereConditions = (filters, includeDate = true) => {
    const conditions = [];
    const { platform, brand, location, category, startDate, endDate } = filters;

    if (includeDate) {
        if (startDate && endDate) {
            conditions.push(`DATE BETWEEN '${dayjs(startDate).format('YYYY-MM-DD')}' AND '${dayjs(endDate).format('YYYY-MM-DD')}'`);
        } else if (endDate) {
            conditions.push(`DATE = '${dayjs(endDate).format('YYYY-MM-DD')}'`);
        }
    }

    if (platform && platform !== 'All') {
        conditions.push(`Platform = '${platform}'`);
    }
    if (brand && brand !== 'All') {
        conditions.push(`Brand = '${brand}'`);
    }
    if (location && location !== 'All') {
        conditions.push(`Location = '${location}'`);
    }
    if (category && category !== 'All') {
        conditions.push(`Category = '${category}'`);
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
};

// Helper to escape string for SQL
const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

/**
 * Robust helper to build WHERE clause for availability queries.
 * Supports all advanced filters and correctly handles arrays.
 */
const buildAvailabilityWhereClause = (filters, tableAlias = '') => {
    const {
        platform, brand, location, startDate, endDate, dates, months,
        cities, categories, formats, zones, metroFlags, pincodes
    } = filters;
    const conditions = [];

    const prefix = tableAlias ? `${tableAlias}.` : '';

    // Standard filters
    if (platform && platform !== 'All') {
        const pArr = Array.isArray(platform) ? platform : [platform];
        conditions.push(`lower(replace(${prefix}Platform, ' ', '_')) IN (${pArr.map(p => `'${escapeStr(p.toLowerCase().replace(/\s+/g, '_'))}'`).join(',')})`);
    }
    if (brand && brand !== 'All') {
        const bArr = Array.isArray(brand) ? brand : [brand];
        conditions.push(`lower(replace(${prefix}Brand, ' ', '_')) IN (${bArr.map(b => `'${escapeStr(b.toLowerCase().replace(/\s+/g, '_'))}'`).join(',')})`);
    }

    // City/Location filter
    const lArr = [];
    if (location && location !== 'All') {
        if (Array.isArray(location)) lArr.push(...location);
        else lArr.push(location);
    }
    if (cities && cities !== 'All') {
        if (Array.isArray(cities)) lArr.push(...cities);
        else lArr.push(cities);
    }
    // Backward compatibility for 'city' key
    if (filters.city && filters.city !== 'All') {
        if (Array.isArray(filters.city)) lArr.push(...filters.city);
        else lArr.push(filters.city);
    }

    if (lArr.length > 0) {
        const uniqueLArr = [...new Set(lArr)];
        conditions.push(`lower(replace(${prefix}Location, ' ', '_')) IN (${uniqueLArr.map(l => `'${escapeStr(l.toLowerCase().replace(/\s+/g, '_'))}'`).join(',')})`);
    }

    // Category/Format filter
    const cArr = [];
    if (categories && categories !== 'All') {
        if (Array.isArray(categories)) cArr.push(...categories);
        else cArr.push(categories);
    }
    if (formats && formats !== 'All') {
        if (Array.isArray(formats)) cArr.push(...formats);
        else cArr.push(formats);
    }
    // Backward compatibility for 'category' and 'format' keys
    if (filters.category && filters.category !== 'All') {
        if (Array.isArray(filters.category)) cArr.push(...filters.category);
        else cArr.push(filters.category);
    }
    if (filters.format && filters.format !== 'All') {
        if (Array.isArray(filters.format)) cArr.push(...filters.format);
        else cArr.push(filters.format);
    }

    if (cArr.length > 0) {
        const uniqueCArr = [...new Set(cArr)];
        conditions.push(`lower(replace(${prefix}Category, ' ', '_')) IN (${uniqueCArr.map(c => `'${escapeStr(c.toLowerCase().replace(/\s+/g, '_'))}'`).join(',')})`);
    }

    // Date/Month range
    if (dates && Array.isArray(dates) && dates.length > 0) {
        conditions.push(`${prefix}DATE IN (${dates.map(d => `'${d}'`).join(',')})`);
    } else if (months && Array.isArray(months) && months.length > 0) {
        conditions.push(`formatDateTime(${prefix}DATE, '%Y-%m') IN (${months.map(m => `'${m}'`).join(',')})`);
    } else if (startDate && endDate) {
        const startStr = dayjs(startDate).format('YYYY-MM-DD');
        const endStr = dayjs(endDate).format('YYYY-MM-DD');
        conditions.push(`${prefix}DATE BETWEEN '${startStr}' AND '${endStr}'`);
    }

    // Advanced filters requiring subqueries on rb_location_darkstore
    if (zones && zones !== 'All') {
        const zArr = Array.isArray(zones) ? zones : [zones];
        conditions.push(`${prefix}Location IN (SELECT location FROM rb_location_darkstore WHERE region IN (${zArr.map(z => `'${escapeStr(z)}'`).join(',')}))`);
    }
    if (metroFlags && metroFlags !== 'All') {
        const mArr = Array.isArray(metroFlags) ? metroFlags : [metroFlags];
        conditions.push(`${prefix}Location IN (SELECT location FROM rb_location_darkstore WHERE tier IN (${mArr.map(m => `'${escapeStr(m)}'`).join(',')}))`);
    }
    if (pincodes && pincodes !== 'All') {
        const pArr = Array.isArray(pincodes) ? pincodes : [pincodes];
        conditions.push(`${prefix}Location IN (SELECT location FROM rb_location_darkstore WHERE toString(pincode) IN (${pArr.map(p => `'${escapeStr(p)}'`).join(',')}))`);
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
};

/**
 * Helper to get the latest available date from rb_pdp_olap
 */
const getLatestDate = async () => {
    try {
        const query = 'SELECT MAX(toDate(DATE)) as maxDate FROM rb_pdp_olap';
        const result = await queryClickHouse(query);
        const date = result[0]?.maxDate ? dayjs(result[0].maxDate) : dayjs();
        return date;
    } catch (error) {
        console.error('[getLatestDate] Error:', error);
        return dayjs();
    }
};

const getAssortment = async (filters) => {
    const cacheKey = generateCacheKey('assortment', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, startDate, endDate, brand, location } = filters;

            // Determine target date
            const targetDate = endDate ? dayjs(endDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

            // Build conditions
            const conditions = [`DATE = '${targetDate}'`];
            if (brand && brand !== 'All') conditions.push(`Brand = '${escapeStr(brand)}'`);
            if (location && location !== 'All') conditions.push(`Location = '${escapeStr(location)}'`);
            if (platform && platform !== 'All') conditions.push(`Platform = '${escapeStr(platform)}'`);

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Query by platform breakdown
            const query = `
                SELECT 
                    Platform,
                    COUNT(DISTINCT Web_Pid) as count
                FROM rb_pdp_olap
                ${whereClause}
                GROUP BY Platform
            `;

            const results = await queryClickHouse(query);

            // Convert to object { Platform: Count }
            const assortmentMap = {};
            results.forEach(r => {
                assortmentMap[r.Platform] = parseInt(r.count, 10);
            });

            // Total count
            const totalQuery = `
                SELECT COUNT(DISTINCT Web_Pid) as total
                FROM rb_pdp_olap
                ${whereClause}
            `;
            const totalResult = await queryClickHouse(totalQuery);
            const total = parseInt(totalResult[0]?.total, 10) || 0;

            return {
                breakdown: assortmentMap,
                total: total,
                date: targetDate
            };
        } catch (error) {
            console.error('Error calculating Assortment:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

const getAbsoluteOsaOverview = async (filters) => {
    console.log('[getAbsoluteOsaOverview] Request received with filters:', filters);

    const cacheKey = generateCacheKey('absolute_osa_overview', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, brand, location, startDate, endDate } = filters;

            // Build conditions
            const whereClauseStr = buildAvailabilityWhereClause(filters);
            const whereClause = whereClauseStr !== '1=1' ? `WHERE ${whereClauseStr}` : '';

            const query = `
                SELECT 
                    SUM(toFloat64(neno_osa)) as sumNenoOsa,
                    SUM(toFloat64(deno_osa)) as sumDenoOsa
                FROM rb_pdp_olap
                ${whereClause}
            `;

            console.log('[getAbsoluteOsaOverview] Query:', query);
            const result = await queryClickHouse(query);
            const row = result[0] || {};

            const sumNenoOsa = parseFloat(row.sumNenoOsa) || 0;
            const sumDenoOsa = parseFloat(row.sumDenoOsa) || 0;

            let stockAvailability = 0;
            if (sumDenoOsa > 0) {
                stockAvailability = (sumNenoOsa / sumDenoOsa) * 100;
            }

            return {
                section: "availability_overview",
                stockAvailability: parseFloat(stockAvailability.toFixed(2)),
                sumNenoOsa: sumNenoOsa,
                sumDenoOsa: sumDenoOsa,
                filters: filters,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getAbsoluteOsaOverview] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

const getAbsoluteOsaPlatformKpiMatrix = async (filters) => {
    console.log('[getAbsoluteOsaPlatformKpiMatrix] Request received with filters:', filters);

    const cacheKey = generateCacheKey('platform_kpi_matrix', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { viewMode = 'Platform', platform, brand, location, startDate, endDate } = filters;

            // Date calculations
            const currentEndDate = endDate ? dayjs(endDate) : dayjs();
            const currentStartDate = startDate ? dayjs(startDate) : currentEndDate.subtract(30, 'day');
            const periodDays = currentEndDate.diff(currentStartDate, 'day') + 1;
            const prevEndDate = currentStartDate.subtract(1, 'day');
            const prevStartDate = prevEndDate.subtract(periodDays - 1, 'day');

            // Determine group column based on viewMode
            const groupColumn = viewMode === 'Format' ? 'Category' :
                viewMode === 'City' ? 'Location' : 'Platform';

            // Build base filter conditions using the helper (excluding date as it's handled separately for current/prev)
            const baseFilterParams = { ...filters };
            delete baseFilterParams.startDate;
            delete baseFilterParams.endDate;
            delete baseFilterParams.dates;
            delete baseFilterParams.months;

            // Exclude common grouping columns from their own viewMode filters to allow showing top N
            if (viewMode === 'Platform') delete baseFilterParams.platform;
            if (viewMode === 'City') delete baseFilterParams.location;
            if (viewMode === 'Format') delete baseFilterParams.category;

            const baseWhereClause = buildAvailabilityWhereClause(baseFilterParams);
            const baseFilter = baseWhereClause !== '1=1' ? ` AND ${baseWhereClause}` : '';

            // Get distinct column values
            // For Format viewMode, only show categories with status=1 in rca_sku_dim
            let additionalCategoryFilter = '';
            if (viewMode === 'Format') {
                // Pre-fetch valid categories to avoid correlated subquery (not supported in ClickHouse)
                const validCatResult = await queryClickHouse(`SELECT DISTINCT category FROM rca_sku_dim WHERE status = 1 AND category IS NOT NULL AND category != ''`);
                const validCategories = validCatResult.map(r => r.category).filter(Boolean);
                if (validCategories.length > 0) {
                    additionalCategoryFilter = ` AND ${groupColumn} IN (${validCategories.map(c => `'${escapeStr(c)}'`).join(',')})`;
                }
            }

            const distinctQuery = `
                SELECT DISTINCT ${groupColumn} as value
                FROM rb_pdp_olap
                WHERE ${groupColumn} IS NOT NULL AND ${groupColumn} != ''
                ${baseFilter}
                ${additionalCategoryFilter}
                ORDER BY value
                LIMIT 10
            `;


            const columnValues = (await queryClickHouse(distinctQuery))
                .map(r => r.value)
                .filter(v => v && v.trim());


            if (columnValues.length === 0) {
                return {
                    section: "platform_kpi_matrix",
                    viewMode,
                    columns: ['KPI'],
                    rows: [],
                    filters,
                    timestamp: new Date().toISOString()
                };
            }

            // Calculate KPIs for all columns in a single optimized query
            // OSA uses the selected period
            // DOI uses latest inventory and a 30-day sales lookback (from currentEndDate)
            const doiLookbackDate = currentEndDate.subtract(30, 'day').format('YYYY-MM-DD');
            const prevDoiLookbackDate = prevEndDate.subtract(30, 'day').format('YYYY-MM-DD');

            const kpiQuery = `
                WITH daily_stats AS (
                    SELECT 
                        DATE,
                        ${groupColumn} as col_value,
                        SUM(toFloat64(Inventory)) as daily_inv
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                      AND ${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                      ${baseFilter}
                    GROUP BY DATE, ${groupColumn}
                ),
                latest_inv_stats AS (
                    SELECT 
                        col_value,
                        argMax(daily_inv, DATE) as latest_inventory
                    FROM daily_stats
                    GROUP BY col_value
                )
                SELECT 
                    t1.${groupColumn} as col_value,
                    SUM(toFloat64(t1.neno_osa)) as sum_neno,
                    SUM(toFloat64(t1.deno_osa)) as sum_deno,
                    SUM(toFloat64(t1.buy_box_neno_osa)) as sum_buybox_neno,
                    SUM(toFloat64(t1.MSL)) as sum_msl,
                    COUNT(DISTINCT t1.Web_Pid) as assortment_count,
                    any(l.latest_inventory) as latest_inventory
                FROM rb_pdp_olap t1
                LEFT JOIN latest_inv_stats l ON t1.${groupColumn} = l.col_value
                WHERE t1.DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                  AND t1.${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                  ${baseFilter}
                GROUP BY col_value
            `;

            const prevKpiQuery = `
                WITH daily_stats AS (
                    SELECT 
                        DATE,
                        ${groupColumn} as col_value,
                        SUM(toFloat64(Inventory)) as daily_inv
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${prevStartDate.format('YYYY-MM-DD')}' AND '${prevEndDate.format('YYYY-MM-DD')}'
                      AND ${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                      ${baseFilter}
                    GROUP BY DATE, ${groupColumn}
                ),
                latest_inv_stats AS (
                    SELECT 
                        col_value,
                        argMax(daily_inv, DATE) as latest_inventory
                    FROM daily_stats
                    GROUP BY col_value
                )
                SELECT 
                    t1.${groupColumn} as col_value,
                    SUM(toFloat64(t1.neno_osa)) as sum_neno,
                    SUM(toFloat64(t1.deno_osa)) as sum_deno,
                    SUM(toFloat64(t1.buy_box_neno_osa)) as sum_buybox_neno,
                    SUM(toFloat64(t1.MSL)) as sum_msl,
                    COUNT(DISTINCT t1.Web_Pid) as assortment_count,
                    any(l.latest_inventory) as latest_inventory
                FROM rb_pdp_olap t1
                LEFT JOIN latest_inv_stats l ON t1.${groupColumn} = l.col_value
                WHERE t1.DATE BETWEEN '${prevStartDate.format('YYYY-MM-DD')}' AND '${prevEndDate.format('YYYY-MM-DD')}'
                  AND t1.${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                  ${baseFilter}
                GROUP BY col_value
            `;

            // DOI sales queries (30-day lookback for current and prev)
            const doiSalesQuery = `
                SELECT 
                    ${groupColumn} as col_value,
                    SUM(toFloat64(Qty_Sold)) as total_qty_sold
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '${doiLookbackDate}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                  AND ${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                  ${baseFilter}
                GROUP BY ${groupColumn}
            `;

            const prevDoiSalesQuery = `
                SELECT 
                    ${groupColumn} as col_value,
                    SUM(toFloat64(Qty_Sold)) as total_qty_sold
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '${prevDoiLookbackDate}' AND '${prevEndDate.format('YYYY-MM-DD')}'
                  AND ${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                  ${baseFilter}
                GROUP BY ${groupColumn}
            `;

            const [currentResults, prevResults, currentSales, prevSales] = await Promise.all([
                queryClickHouse(kpiQuery),
                queryClickHouse(prevKpiQuery),
                queryClickHouse(doiSalesQuery),
                queryClickHouse(prevDoiSalesQuery)
            ]);

            // Build lookup maps
            const currentMap = {};
            currentResults.forEach(r => { currentMap[r.col_value] = r; });
            const prevMap = {};
            prevResults.forEach(r => { prevMap[r.col_value] = r; });

            const currentSalesMap = {};
            currentSales.forEach(r => { currentSalesMap[r.col_value] = r.total_qty_sold; });
            const prevSalesMap = {};
            prevSales.forEach(r => { prevSalesMap[r.col_value] = r.total_qty_sold; });

            // Build KPI rows
            const kpiRows = {
                osa: { kpi: 'OSA', trend: {} },
                doi: { kpi: 'DOI', trend: {} },
                fillrate: { kpi: 'FILLRATE', trend: {} },
                assortment: { kpi: 'ASSORTMENT', trend: {} },
                psl: { kpi: 'PSL', trend: {} }
            };

            for (const colValue of columnValues) {
                const curr = currentMap[colValue] || {};
                const prev = prevMap[colValue] || {};

                // OSA
                const currOsa = (parseFloat(curr.sum_deno) > 0)
                    ? (parseFloat(curr.sum_neno) / parseFloat(curr.sum_deno)) * 100 : 0;
                const prevOsa = (parseFloat(prev.sum_deno) > 0)
                    ? (parseFloat(prev.sum_neno) / parseFloat(prev.sum_deno)) * 100 : 0;
                kpiRows.osa[colValue] = Math.round(currOsa);
                kpiRows.osa.trend[colValue] = Math.round(currOsa - prevOsa);

                // DOI: (Latest Inventory / Last 30 Days Sales) * 30
                const currSalesVal = parseFloat(currentSalesMap[colValue]) || 0;
                const prevSalesVal = parseFloat(prevSalesMap[colValue]) || 0;

                const currDoi = (currSalesVal > 0)
                    ? (parseFloat(curr.latest_inventory) / currSalesVal) * 30 : 0;
                const prevDoi = (prevSalesVal > 0)
                    ? (parseFloat(prev.latest_inventory) / prevSalesVal) * 30 : 0;
                kpiRows.doi[colValue] = Math.round(currDoi);
                kpiRows.doi.trend[colValue] = Math.round(currDoi - prevDoi);

                // Fillrate: (SUM(buy_box_neno_osa) / SUM(deno_osa)) * 100
                const currFillrate = (parseFloat(curr.sum_deno) > 0)
                    ? (parseFloat(curr.sum_buybox_neno) / parseFloat(curr.sum_deno)) * 100 : 0;
                const prevFillrate = (parseFloat(prev.sum_deno) > 0)
                    ? (parseFloat(prev.sum_buybox_neno) / parseFloat(prev.sum_deno)) * 100 : 0;
                kpiRows.fillrate[colValue] = Math.round(currFillrate);
                kpiRows.fillrate.trend[colValue] = Math.round(currFillrate - prevFillrate);

                // Assortment
                kpiRows.assortment[colValue] = parseInt(curr.assortment_count, 10) || 0;
                kpiRows.assortment.trend[colValue] = (parseInt(curr.assortment_count, 10) || 0) - (parseInt(prev.assortment_count, 10) || 0);

                // PSL: (Latest Inventory / SUM(MSL)) * 100 if MSL > 0, else proxy or 0
                const currMsl = parseFloat(curr.sum_msl) || 0;
                const prevMsl = parseFloat(prev.sum_msl) || 0;
                const currInv = parseFloat(curr.latest_inventory) || 0;
                const prevInv = parseFloat(prev.latest_inventory) || 0;

                const currPsl = currMsl > 0 ? (currInv / currMsl) * 100 : (currOsa * 0.95); // Using proxy if MSL is 0
                const prevPsl = prevMsl > 0 ? (prevInv / prevMsl) * 100 : (prevOsa * 0.95);

                kpiRows.psl[colValue] = Math.round(currPsl);
                kpiRows.psl.trend[colValue] = Math.round(currPsl - prevPsl);
            }

            return {
                section: "platform_kpi_matrix",
                viewMode,
                columns: ['KPI', ...columnValues],
                rows: [kpiRows.osa, kpiRows.doi, kpiRows.fillrate, kpiRows.assortment, kpiRows.psl],
                currentPeriod: { start: currentStartDate.format('YYYY-MM-DD'), end: currentEndDate.format('YYYY-MM-DD') },
                comparisonPeriod: { start: prevStartDate.format('YYYY-MM-DD'), end: prevEndDate.format('YYYY-MM-DD') },
                filters,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getAbsoluteOsaPlatformKpiMatrix] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

const getAbsoluteOsaPercentageDetail = async (filters) => {
    console.log('[getAbsoluteOsaPercentageDetail] Request received with filters:', filters);
    return {
        message: "OSA Percentage Detail View section request received",
        section: "osa_percentage_detail",
        filters: filters,
        timestamp: new Date().toISOString()
    };
};

const getDOI = async (filters) => {
    console.log('[getDOI] Request received with filters:', filters);

    const cacheKey = generateCacheKey('doi_overview', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, brand, location, startDate, endDate } = filters;

            const currentEndDate = endDate ? dayjs(endDate) : dayjs();
            const thirtyDaysAgo = currentEndDate.subtract(30, 'day');
            const prevEndDate = thirtyDaysAgo.subtract(1, 'day');
            const prevStartDate = prevEndDate.subtract(29, 'day');

            // Build filter conditions using buildAvailabilityWhereClause
            // Note: We exclude dates from the base params and add them manually for each sub-query
            const baseParams = { ...filters };
            delete baseParams.startDate;
            delete baseParams.endDate;
            delete baseParams.dates;
            delete baseParams.months;

            const baseWhere = buildAvailabilityWhereClause(baseParams);
            const baseFilter = baseWhere !== '1=1' ? ` AND ${baseWhere}` : '';

            // Get today's inventory
            const invQuery = `
                SELECT SUM(toFloat64(Inventory)) as totalInventory
                FROM rb_pdp_olap
                WHERE DATE = '${currentEndDate.format('YYYY-MM-DD')}'
                ${baseFilter}
            `;
            let invResult = await queryClickHouse(invQuery);
            let todayInventory = parseFloat(invResult[0]?.totalInventory) || 0;

            // Fallback to last 7 days average
            if (todayInventory === 0) {
                const last7Query = `
                    SELECT 
                        SUM(toFloat64(Inventory)) as totalInventory,
                        COUNT(DISTINCT DATE) as daysCount
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${currentEndDate.subtract(7, 'day').format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                    ${baseFilter}
                `;
                const last7Result = await queryClickHouse(last7Query);
                const totalInv = parseFloat(last7Result[0]?.totalInventory) || 0;
                const daysCount = parseFloat(last7Result[0]?.daysCount) || 1;
                todayInventory = daysCount > 0 ? totalInv / daysCount : 0;
            }

            // Get last 30 days Qty_Sold and previous period data in parallel
            const [qtySoldResult, prevInvResult, prevQtySoldResult] = await Promise.all([
                queryClickHouse(`
                    SELECT SUM(toFloat64(Qty_Sold)) as totalQtySold
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${thirtyDaysAgo.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                    ${baseFilter}
                `),
                queryClickHouse(`
                    SELECT SUM(toFloat64(Inventory)) as totalInventory
                    FROM rb_pdp_olap
                    WHERE DATE = '${prevEndDate.format('YYYY-MM-DD')}'
                    ${baseFilter}
                `),
                queryClickHouse(`
                    SELECT SUM(toFloat64(Qty_Sold)) as totalQtySold
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${prevStartDate.format('YYYY-MM-DD')}' AND '${prevEndDate.format('YYYY-MM-DD')}'
                    ${baseFilter}
                `)
            ]);

            const totalQtySold = parseFloat(qtySoldResult[0]?.totalQtySold) || 0;
            const currentDOI = totalQtySold > 0 ? (todayInventory / totalQtySold) * 30 : 0;

            const prevInventory = parseFloat(prevInvResult[0]?.totalInventory) || 0;
            const prevTotalQtySold = parseFloat(prevQtySoldResult[0]?.totalQtySold) || 0;
            const prevDOI = prevTotalQtySold > 0 ? (prevInventory / prevTotalQtySold) * 30 : 0;

            const changePercent = prevDOI > 0 ? ((currentDOI - prevDOI) / prevDOI) * 100 : 0;

            return {
                section: "doi_overview",
                doi: parseFloat(currentDOI.toFixed(1)),
                prevDoi: parseFloat(prevDOI.toFixed(1)),
                changePercent: parseFloat(changePercent.toFixed(1)),
                todayInventory: todayInventory,
                totalQtySold: totalQtySold,
                filters: filters,
                currentPeriod: {
                    inventoryDate: currentEndDate.format('YYYY-MM-DD'),
                    qtySoldStart: thirtyDaysAgo.format('YYYY-MM-DD'),
                    qtySoldEnd: currentEndDate.format('YYYY-MM-DD')
                },
                comparisonPeriod: {
                    inventoryDate: prevEndDate.format('YYYY-MM-DD'),
                    qtySoldStart: prevStartDate.format('YYYY-MM-DD'),
                    qtySoldEnd: prevEndDate.format('YYYY-MM-DD')
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getDOI] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

const getMetroCities = async () => {
    const cacheKey = generateCacheKey('metro_cities_list', {});

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const query = `
                SELECT DISTINCT location
                FROM rb_location_darkstore
                WHERE tier = 'Tier 1'
            `;
            const results = await queryClickHouse(query);
            return results.map(r => r.location).filter(Boolean);
        } catch (error) {
            console.error('[getMetroCities] Error:', error);
            return [];
        }
    }, CACHE_TTL.LONG);
};

const isMetroCity = async (location) => {
    if (!location || location === 'All') return true;
    const metroCities = await getMetroCities();
    return metroCities.some(city => city.toLowerCase() === location.toLowerCase());
};

const getMetroCityStockAvailability = async (filters) => {
    console.log('[getMetroCityStockAvailability] Request received with filters:', filters);

    const cacheKey = generateCacheKey('metro_city_osa', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, brand, location, startDate, endDate } = filters;

            const metroCities = await getMetroCities();
            if (metroCities.length === 0) {
                return {
                    section: "metro_city_osa",
                    stockAvailability: 0,
                    prevStockAvailability: 0,
                    change: 0,
                    isMetroCity: false,
                    filters: filters,
                    timestamp: new Date().toISOString()
                };
            }

            let isLocationMetro = true;
            let targetLocations = metroCities;

            if (location && location !== 'All') {
                isLocationMetro = metroCities.some(c => c.toLowerCase() === location.toLowerCase());
                if (!isLocationMetro) {
                    return {
                        section: "metro_city_osa",
                        stockAvailability: 0,
                        prevStockAvailability: 0,
                        change: 0,
                        isMetroCity: false,
                        filters: filters,
                        timestamp: new Date().toISOString()
                    };
                }
                targetLocations = [location];
            }

            // Build date conditions
            const currentEndDate = endDate ? dayjs(endDate) : dayjs();
            const currentStartDate = startDate ? dayjs(startDate) : currentEndDate.startOf('month');
            const periodDays = currentEndDate.diff(currentStartDate, 'day') + 1;
            const prevEndDate = currentStartDate.subtract(1, 'day');
            const prevStartDate = prevEndDate.subtract(periodDays - 1, 'day');

            // Build filter conditions using buildAvailabilityWhereClause
            const currentFilters = { ...filters, startDate: currentStartDate.format('YYYY-MM-DD'), endDate: currentEndDate.format('YYYY-MM-DD') };
            const prevFilters = { ...filters, startDate: prevStartDate.format('YYYY-MM-DD'), endDate: prevEndDate.format('YYYY-MM-DD') };

            // Overwrite location with metro cities for this specific card
            const metroLocations = targetLocations;
            currentFilters.location = metroLocations;
            prevFilters.location = metroLocations;

            const currentWhere = buildAvailabilityWhereClause(currentFilters);
            const prevWhere = buildAvailabilityWhereClause(prevFilters);

            const [currentResult, prevResult] = await Promise.all([
                queryClickHouse(`
                    SELECT 
                        SUM(toFloat64(neno_osa)) as sumNeno,
                        SUM(toFloat64(deno_osa)) as sumDeno
                    FROM rb_pdp_olap
                    WHERE ${currentWhere}
                `),
                queryClickHouse(`
                    SELECT 
                        SUM(toFloat64(neno_osa)) as sumNeno,
                        SUM(toFloat64(deno_osa)) as sumDeno
                    FROM rb_pdp_olap
                    WHERE ${prevWhere}
                `)
            ]);

            const currNeno = parseFloat(currentResult[0]?.sumNeno) || 0;
            const currDeno = parseFloat(currentResult[0]?.sumDeno) || 0;
            const prevNeno = parseFloat(prevResult[0]?.sumNeno) || 0;
            const prevDeno = parseFloat(prevResult[0]?.sumDeno) || 0;

            const currentOsa = currDeno > 0 ? (currNeno / currDeno) * 100 : 0;
            const prevOsa = prevDeno > 0 ? (prevNeno / prevDeno) * 100 : 0;

            return {
                section: "metro_city_osa",
                stockAvailability: parseFloat(currentOsa.toFixed(2)),
                prevStockAvailability: parseFloat(prevOsa.toFixed(2)),
                change: parseFloat((currentOsa - prevOsa).toFixed(2)),
                isMetroCity: true,
                metroCitiesCount: targetLocations.length,
                filters: filters,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getMetroCityStockAvailability] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

const getAvailabilityFilterOptions = async ({ filterType, platform, brand, category, city, months, metroFlag }) => {
    const pKey = Array.isArray(platform) ? platform.join(',') : (platform || 'all');
    const bKey = Array.isArray(brand) ? brand.join(',') : (brand || 'all');
    const cKey = Array.isArray(category) ? category.join(',') : (category || 'all');
    const ctKey = Array.isArray(city) ? city.join(',') : (city || 'all');
    const mKey = Array.isArray(months) ? months.join(',') : (months || 'all');
    const mfKey = Array.isArray(metroFlag) ? metroFlag.join(',') : (metroFlag || 'all');

    const cacheKey = `availability_filter:${filterType}:${pKey.toLowerCase()}:${bKey.toLowerCase()}:${cKey.toLowerCase()}:${ctKey.toLowerCase()}:${mKey.toLowerCase()}:${mfKey.toLowerCase()}`;

    return getCachedOrCompute(cacheKey, async () => {
        try {
            console.log(`[getAvailabilityFilterOptions] Fetching ${filterType}`);

            // Helper to build IN clause or equality
            const buildInClause = (col, val) => {
                const arr = Array.isArray(val) ? val : [val];
                if (arr.length === 1) return `${col} = '${escapeStr(arr[0])}'`;
                return `${col} IN (${arr.map(v => `'${escapeStr(v)}'`).join(',')})`;
            };

            // Build cascading filter conditions
            const conditions = [];
            if (platform && platform !== 'All') conditions.push(buildInClause('Platform', platform));
            if (category && category !== 'All') conditions.push(buildInClause('Category', category));
            if (city && city !== 'All') conditions.push(buildInClause('Location', city));
            const baseFilter = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            if (filterType === 'platforms') {
                const query = `SELECT DISTINCT Platform as value FROM rb_pdp_olap WHERE Platform IS NOT NULL AND Platform != '' ORDER BY Platform`;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'categories' || filterType === 'formats') {
                const catConditions = [`status = 1`, `category IS NOT NULL`, `category != ''`];
                if (platform && platform !== 'All') catConditions.push(buildInClause('platform', platform)); // rca_sku_dim uses lowercase platform
                if (city && city !== 'All') catConditions.push(buildInClause('location', city)); // rca_sku_dim uses lowercase location

                const query = `
                    SELECT DISTINCT category as value 
                    FROM rca_sku_dim
                    WHERE ${catConditions.join(' AND ')}
                    ORDER BY value
                `;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'zones') {
                const query = `SELECT DISTINCT region as value FROM rb_location_darkstore WHERE region IS NOT NULL AND region != '' ORDER BY value`;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'metroFlags') {
                const query = `SELECT DISTINCT tier as value FROM rb_location_darkstore WHERE tier IS NOT NULL AND tier != '' ORDER BY value`;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'pincodes') {
                const pincodeConditions = [`pincode IS NOT NULL`];
                if (platform && platform !== 'All') pincodeConditions.push(buildInClause('platform', platform));
                if (city && city !== 'All') pincodeConditions.push(buildInClause('location', city));

                const whereClause = pincodeConditions.length > 0 ? `WHERE ${pincodeConditions.join(' AND ')}` : '';
                const query = `SELECT DISTINCT toString(pincode) as value FROM rb_location_darkstore ${whereClause} ORDER BY value`;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'kpis') {
                return { options: ['OSA', 'DOI', 'Fillrate', 'Assortment', 'PSL'] };
            }

            if (filterType === 'cities') {
                // rb_pdp_olap uses uppercase Location, Platform, Brand
                const cityConditions = [];
                if (platform && platform !== 'All') cityConditions.push(buildInClause('Platform', platform));
                if (brand && brand !== 'All') cityConditions.push(buildInClause('Brand', brand));
                if (category && category !== 'All') cityConditions.push(buildInClause('Category', category));

                // Join with rb_location_darkstore for tier (metroFlag) filtering
                if (metroFlag && metroFlag !== 'All') {
                    // This requires a join or a subquery. Since we're fetching from rb_pdp_olap, 
                    // we'll use a subquery for simplicity if filtering by metroFlag.
                    const tierArr = Array.isArray(metroFlag) ? metroFlag : [metroFlag];
                    const metroCitiesQuery = `SELECT DISTINCT location FROM rb_location_darkstore WHERE tier IN (${tierArr.map(t => `'${escapeStr(t)}'`).join(',')})`;
                    const metroCitiesResult = await queryClickHouse(metroCitiesQuery);
                    const metroCities = metroCitiesResult.map(r => r.location).filter(Boolean);

                    if (metroCities.length > 0) {
                        cityConditions.push(`Location IN (${metroCities.map(c => `'${escapeStr(c)}'`).join(',')})`);
                    } else {
                        return { options: [] };
                    }
                }

                cityConditions.push(`Location IS NOT NULL AND Location != ''`);
                const whereClause = cityConditions.length > 0 ? `WHERE ${cityConditions.join(' AND ')}` : '';
                const query = `SELECT DISTINCT Location as value FROM rb_pdp_olap ${whereClause} ORDER BY Location`;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'brands') {
                const brandConditions = [];
                if (platform && platform !== 'All') brandConditions.push(buildInClause('Platform', platform));
                if (city && city !== 'All') brandConditions.push(buildInClause('Location', city));
                if (category && category !== 'All') brandConditions.push(buildInClause('Category', category));

                brandConditions.push(`Brand IS NOT NULL AND Brand != ''`);
                const whereClause = brandConditions.length > 0 ? `WHERE ${brandConditions.join(' AND ')}` : '';
                const query = `SELECT DISTINCT Brand as value FROM rb_pdp_olap ${whereClause} ORDER BY Brand`;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'months') {
                const query = `
                    SELECT DISTINCT formatDateTime(DATE, '%Y-%m') as value
                    FROM rb_pdp_olap
                    WHERE DATE IS NOT NULL
                    ORDER BY value DESC
                `;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'dates') {
                const dateConditions = [`DATE IS NOT NULL`];
                if (months && months !== 'All') {
                    dateConditions.push(buildInClause("formatDateTime(DATE, '%Y-%m')", months));
                }

                const query = `
                    SELECT DISTINCT toString(DATE) as value
                    FROM rb_pdp_olap
                    WHERE ${dateConditions.join(' AND ')}
                    ORDER BY value DESC
                `;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            return { options: [] };
        } catch (error) {
            console.error('[getAvailabilityFilterOptions] Error:', error);
            return { options: [] };
        }
    }, CACHE_TTL.MEDIUM);
};

/**
 * Internal helper to build WHERE clause for availability analysis with advanced filters
 */

const getOsaDetailByCategory = async (filters) => {
    console.log('[getOsaDetailByCategory] Request received with filters:', filters);

    // Apply default dates if not provided to ensure performance and "not applied" behavior
    const effectiveFilters = { ...filters };
    if (!effectiveFilters.startDate && !effectiveFilters.endDate && !effectiveFilters.dates && !effectiveFilters.months) {
        effectiveFilters.endDate = dayjs().format('YYYY-MM-DD');
        effectiveFilters.startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
    }

    const cacheKey = generateCacheKey('osa_detail_sku_level', effectiveFilters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const whereClause = buildAvailabilityWhereClause(effectiveFilters, 't1');

            // Query SKU-level data joined with rca_sku_dim to filter by active segments (status=1)
            // Note: rca_sku_dim uses lowercase column names (platform, location, brand_name, category)
            const query = `
                SELECT 
                    t1.Product as name,
                    t1.Web_Pid as sku,
                    t1.DATE,
                    SUM(toFloat64(t1.neno_osa)) as sum_neno,
                    SUM(toFloat64(t1.deno_osa)) as sum_deno
                FROM rb_pdp_olap t1
                JOIN rca_sku_dim t2 ON lower(t1.Platform) = lower(t2.platform) 
                    AND lower(t1.Location) = lower(t2.location) 
                    AND lower(t1.Brand) = lower(t2.brand_name) 
                    AND lower(t1.Category) = lower(t2.category)
                WHERE ${whereClause}
                  AND t2.status = 1
                GROUP BY t1.Product, t1.Web_Pid, t1.DATE
                ORDER BY t1.Product, t1.Web_Pid, t1.DATE
            `;


            const results = await queryClickHouse(query);

            // Transform into the format the frontend expects: { name, sku, values, avg31, status }
            const skuMap = {};

            // Determine the full date range for gap filling
            let rangeStart = effectiveFilters.startDate;
            let rangeEnd = effectiveFilters.endDate;

            if (!rangeStart || !rangeEnd) {
                // If using months filter instead of explicit range
                if (effectiveFilters.months && effectiveFilters.months.length > 0) {
                    const sortedMonths = [...effectiveFilters.months].sort();
                    rangeStart = dayjs(sortedMonths[0]).startOf('month').format('YYYY-MM-DD');
                    rangeEnd = dayjs(sortedMonths[sortedMonths.length - 1]).endOf('month').format('YYYY-MM-DD');
                } else if (results.length > 0) {
                    // Fallback to the dates present in results
                    const allDatesArr = results.map(r => dayjs(r.DATE).format('YYYY-MM-DD')).sort();
                    rangeStart = allDatesArr[0];
                    rangeEnd = allDatesArr[allDatesArr.length - 1];
                } else {
                    // Total fallback
                    rangeEnd = dayjs().format('YYYY-MM-DD');
                    rangeStart = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
                }
            }

            // Generate full date list
            const sortedDates = [];
            let current = dayjs(rangeStart);
            const end = dayjs(rangeEnd);
            while (current.isBefore(end) || current.isSame(end)) {
                sortedDates.push(current.format('YYYY-MM-DD'));
                current = current.add(1, 'day');
            }

            results.forEach(row => {
                const skuId = row.sku;
                const dateStr = dayjs(row.DATE).format('YYYY-MM-DD');

                const neno = parseFloat(row.sum_neno) || 0;
                const deno = parseFloat(row.sum_deno) || 0;
                const osa = deno > 0 ? (neno / deno) * 100 : 0;

                if (!skuMap[skuId]) {
                    skuMap[skuId] = {
                        name: row.name,
                        sku: row.sku,
                        dailyOsa: {}
                    };
                }
                skuMap[skuId].dailyOsa[dateStr] = parseFloat(osa.toFixed(1));
            });

            const categories = Object.values(skuMap).map(item => {
                // Map to sortedDates and fill gaps with 0
                const values = sortedDates.map(d => item.dailyOsa[d] ?? 0);

                // Overall average
                const totalSum = values.reduce((a, b) => a + b, 0);
                const avg31 = values.length > 0 ? Math.round(totalSum / values.length) : 0;

                // Health status logic (based on last 7 days of the selected range)
                const last7Values = values.slice(-7);
                const avg7 = last7Values.length > 0
                    ? Math.round(last7Values.reduce((a, b) => a + b, 0) / last7Values.length)
                    : avg31;

                let status = "Healthy";
                if (avg7 < 70) status = "Action";
                else if (avg7 < 85) status = "Watch";

                return {
                    name: item.name,
                    sku: item.sku,
                    values: values,
                    avg31: avg31,
                    status: status
                };
            });

            return {
                section: "osa_percentage_detail",
                categories: categories,
                dates: sortedDates,
                filters,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getOsaDetailByCategory] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

const getAvailabilityKpiTrends = async (filters) => {
    console.log('[getAvailabilityKpiTrends] Request received with filters:', filters);

    const cacheKey = generateCacheKey('availability_kpi_trends', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, brand, location, category, period = '1M', timeStep = 'daily', startDate: filterStart, endDate: filterEnd } = filters;

            const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
            const days = periodDays[period] || 30;

            let currentEndDate, currentStartDate;
            if (filterStart && filterEnd) {
                currentEndDate = dayjs(filterEnd);
                currentStartDate = dayjs(filterStart);
            } else {
                currentEndDate = await getLatestDate();
                currentStartDate = currentEndDate.subtract(days - 1, 'days');
            }

            // Build filter conditions using the enhanced where clause
            // CRITICAL: We MUST pass the calculated startDate and endDate to buildAvailabilityWhereClause
            // so that the SQL query is restricted to the selected period.
            const whereClause = buildAvailabilityWhereClause({
                ...filters,
                startDate: currentStartDate,
                endDate: currentEndDate
            });

            console.log(`[getAvailabilityKpiTrends] Querying for period ${currentStartDate.format('YYYY-MM-DD')} to ${currentEndDate.format('YYYY-MM-DD')}`);

            const query = `
                SELECT 
                    DATE as ref_date,
                    SUM(toFloat64OrZero(toString(neno_osa))) as total_neno,
                    SUM(toFloat64OrZero(toString(deno_osa))) as total_deno,
                    SUM(toFloat64OrZero(toString(Inventory))) as total_inventory,
                    SUM(toFloat64OrZero(toString(Qty_Sold))) as total_qty_sold,
                    COUNT(DISTINCT Web_Pid) as assortment_count
                FROM rb_pdp_olap
                WHERE ${whereClause}
                GROUP BY DATE
                ORDER BY DATE ASC
            `;

            const results = await queryClickHouse(query);

            // Get total active assortment from rb_sku_platform for Listing % calculation
            // Note: rb_sku_platform only has brand_name, brand_category, web_pid, status (no platform column)
            const masterAssortmentConds = [`status = 1`];
            // Platform filter is omitted as rb_sku_platform doesn't have a platform column
            if (category && category !== 'All') masterAssortmentConds.push(`lower(brand_category) = '${escapeStr(category.toLowerCase())}'`);
            if (brand && brand !== 'All') masterAssortmentConds.push(`lower(brand_name) = '${escapeStr(brand.toLowerCase())}'`);

            const masterQuery = `
                SELECT count(DISTINCT web_pid) as total_master
                FROM rb_sku_platform
                WHERE ${masterAssortmentConds.join(' AND ')}
            `;
            const masterResult = await queryClickHouse(masterQuery);
            const masterCount = parseInt(masterResult[0]?.total_master, 10) || 0;



            const timeSeries = results.map(row => {
                const neno = parseFloat(row.total_neno) || 0;
                const deno = parseFloat(row.total_deno) || 0;
                const dailyUniquePids = parseInt(row.assortment_count, 10) || 0;

                const osa = deno > 0 ? (neno / deno) * 100 : 0;
                const listing = masterCount > 0 ? (dailyUniquePids / masterCount) * 100 : 0;

                return {
                    date: dayjs(row.ref_date).format("DD MMM'YY"),
                    Osa: parseFloat(osa.toFixed(1)),
                    Listing: parseFloat(listing.toFixed(1)),
                    Assortment: dailyUniquePids
                };
            });

            return {
                metrics: [
                    { id: 'Osa', label: 'OSA', color: '#F97316', default: true },
                    { id: 'Listing', label: 'Listing %', color: '#0EA5E9', default: true },
                    { id: 'Assortment', label: 'Assortment', color: '#22C55E', default: false }
                ],
                timeSeries,
                period,
                dateRange: { start: currentStartDate.format('YYYY-MM-DD'), end: currentEndDate.format('YYYY-MM-DD') }
            };
        } catch (error) {
            console.error('[getAvailabilityKpiTrends] Error:', error);
            return { metrics: [], timeSeries: [] };
        }
    }, CACHE_TTL.SHORT);
};

const getAvailabilityCompetitionData = async (filters = {}) => {
    console.log('[getAvailabilityCompetitionData] Request with filters:', filters);

    const cacheKey = generateCacheKey('availability_competition_data', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            let { platform = 'All', location = 'All', category = 'All', brand = 'All', period = '1M', startDate: fStart, endDate: fEnd } = filters;
            if (location === 'All India') location = 'All';

            const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };

            let startDate, endDate;
            if (fStart && fEnd) {
                startDate = dayjs(fStart);
                endDate = dayjs(fEnd);
            } else {
                const days = periodDays[period] || 30;
                endDate = await getLatestDate();
                startDate = endDate.subtract(days, 'days');
            }

            const whereClause = buildAvailabilityWhereClause({ ...filters, startDate, endDate });

            const query = `
                WITH latest_skus AS (
                    SELECT 
                        Brand,
                        Web_Pid,
                        argMax(toFloat64OrZero(toString(Inventory)), DATE) as latest_inv
                    FROM rb_pdp_olap
                    WHERE ${whereClause}
                    GROUP BY Brand, Web_Pid
                )
                SELECT 
                    Brand as brand_name,
                    SUM(toFloat64OrZero(toString(neno_osa))) as total_neno,
                    SUM(toFloat64OrZero(toString(deno_osa))) as total_deno,
                    SUM(toFloat64OrZero(toString(Qty_Sold))) as total_qty_sold,
                    SUM(latest_inv) as total_inventory,
                    COUNT(DISTINCT Web_Pid) as assortment_count
                FROM rb_pdp_olap
                LEFT JOIN latest_skus ON rb_pdp_olap.Web_Pid = latest_skus.Web_Pid AND rb_pdp_olap.Brand = latest_skus.Brand
                WHERE ${whereClause}
                  AND Brand IS NOT NULL AND Brand != ''
                  AND Comp_flag = 1
                GROUP BY Brand
                ORDER BY total_deno DESC
                LIMIT 10
            `;


            const results = await queryClickHouse(query);

            // Get master counts from rb_sku_platform for all brands in the results to calculate Listing %
            const foundBrands = results.map(r => r.brand_name).filter(Boolean);
            let brandMasterCounts = {};

            if (foundBrands.length > 0) {
                const brandListStr = foundBrands.map(b => `'${escapeStr(b)}'`).join(', ');
                const masterConds = [`status = 1`, `brand_name IN (${brandListStr})`];
                // Platform filter is omitted as rb_sku_platform doesn't have a platform column
                if (category && category !== 'All') masterConds.push(`lower(brand_category) = '${escapeStr(category.toLowerCase())}'`);

                const masterQuery = `
                    SELECT brand_name, count(DISTINCT web_pid) as total_master
                    FROM rb_sku_platform
                    WHERE ${masterConds.join(' AND ')}
                    GROUP BY brand_name
                `;
                const masterResults = await queryClickHouse(masterQuery);
                masterResults.forEach(r => {
                    brandMasterCounts[r.brand_name] = parseInt(r.total_master, 10) || 0;
                });
            }



            const brands = results.map((row, idx) => {
                const neno = parseFloat(row.total_neno) || 0;
                const deno = parseFloat(row.total_deno) || 0;
                const dailyUniquePids = parseInt(row.assortment_count, 10) || 0;
                const brandName = row.brand_name;
                const masterCount = brandMasterCounts[brandName] || 0;

                const totalQtySold = parseFloat(row.total_qty_sold) || 0;
                const totalBrandInv = parseFloat(row.total_inventory) || 0;

                const osa = deno > 0 ? (neno / deno) * 100 : 0;
                const listing = masterCount > 0 ? (dailyUniquePids / masterCount) * 100 : 0;

                // DOI = (Current Inventory / Total Sales in Period) * period_days
                // Assuming 1M period (30 days) as default
                const doi = totalQtySold > 0 ? (totalBrandInv / totalQtySold) * 30 : 0;

                return {
                    rank: idx + 1,
                    brand: brandName,
                    osa: parseFloat(osa.toFixed(1)),
                    osaDelta: 0,
                    listing: parseFloat(listing.toFixed(1)),
                    listingDelta: 0,
                    assortment: dailyUniquePids,
                    assortmentDelta: 0,
                    doi: parseFloat(doi.toFixed(1)),
                    fillrate: 'Coming Soon',
                    psl: parseFloat(listing.toFixed(1))
                };
            });

            const skuQuery = `
                SELECT 
                    Product as sku_name,
                    Brand as brand_name,
                    SUM(toFloat64OrZero(toString(neno_osa))) as total_neno,
                    SUM(toFloat64OrZero(toString(deno_osa))) as total_deno,
                    SUM(toFloat64OrZero(toString(Qty_Sold))) as total_qty_sold,
                    argMax(toFloat64OrZero(toString(Inventory)), DATE) as latest_sku_inventory
                FROM rb_pdp_olap
                WHERE ${whereClause}
                  AND Product IS NOT NULL AND Product != ''
                  AND Comp_flag = 1
                GROUP BY Product, Brand
                ORDER BY total_deno DESC
                LIMIT 8
            `;


            const skuResults = await queryClickHouse(skuQuery);
            const skus = skuResults.map(s => {
                const neno = parseFloat(s.total_neno) || 0;
                const deno = parseFloat(s.total_deno) || 0;
                const totalQtySold = parseFloat(s.total_qty_sold) || 0;
                const latestInv = parseFloat(s.latest_sku_inventory) || 0;

                const osa = deno > 0 ? (neno / deno) * 100 : 0;
                const doi = totalQtySold > 0 ? (latestInv / totalQtySold) * 30 : 0;

                return {
                    sku_name: s.sku_name,
                    brand_name: s.brand_name,
                    osa: parseFloat(osa.toFixed(1)),
                    osaDelta: 0,
                    doi: parseFloat(doi.toFixed(1)),
                    fillrate: 'Coming Soon',
                    assortment: 1,
                    psl: 0
                };
            });

            return {
                brands,
                skus,
                period,
                filters,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getAvailabilityCompetitionData] Error:', error);
            return { brands: [], skus: [] };
        }
    }, CACHE_TTL.SHORT);
};

const getAvailabilityCompetitionFilterOptions = async (filters = {}) => {
    console.log('[getAvailabilityCompetitionFilterOptions] Request with filters:', filters);

    try {
        const { platform = 'All', location = 'All', category = 'All', brand = 'All' } = filters;

        // 1. Build base condition (Platform and Location)
        const baseWhere = buildAvailabilityWhereClause({ platform, location, metroFlag: filters.metroFlag, zones: filters.zones, pincodes: filters.pincodes });
        const baseConds = baseWhere !== '1=1' ? [baseWhere] : [];
        baseConds.push('Comp_flag = 1');

        // 2. Build Category conditions (filtered by Platform/Location/Advanced)
        const catQuery = `SELECT DISTINCT Category as value FROM rb_pdp_olap WHERE ${baseConds.join(' AND ')} AND Category IS NOT NULL AND Category != '' ORDER BY Category`;

        // 3. Build Brand conditions (filtered by Platform/Location/Advanced/Category)
        const brandWhere = buildAvailabilityWhereClause({ platform, location, category, metroFlag: filters.metroFlag, zones: filters.zones, pincodes: filters.pincodes });
        const brandConds = brandWhere !== '1=1' ? [brandWhere] : [];
        brandConds.push('Comp_flag = 1');
        const brandQuery = `SELECT DISTINCT Brand as value FROM rb_pdp_olap WHERE ${brandConds.join(' AND ')} AND Brand IS NOT NULL AND Brand != '' ORDER BY Brand`;

        // 4. Build SKU conditions (filtered by Platform/Location/Advanced/Category/Brand)
        const skuWhere = buildAvailabilityWhereClause({ platform, location, category, brand, metroFlag: filters.metroFlag, zones: filters.zones, pincodes: filters.pincodes });
        const skuConds = skuWhere !== '1=1' ? [skuWhere] : [];
        skuConds.push('Comp_flag = 1');
        const skuQuery = `SELECT DISTINCT Product as value FROM rb_pdp_olap WHERE ${skuConds.join(' AND ')} AND Product IS NOT NULL AND Product != '' ORDER BY Product LIMIT 200`;

        const [locationResults, categoryResults, brandResults, skuResults] = await Promise.all([
            queryClickHouse(`SELECT DISTINCT Location as value FROM rb_pdp_olap WHERE Comp_flag = 1 AND Location IS NOT NULL AND Location != '' ORDER BY Location`),
            queryClickHouse(catQuery),
            queryClickHouse(brandQuery),
            queryClickHouse(skuQuery)
        ]);

        return {
            locations: ['All India', ...locationResults.map(r => r.value).filter(Boolean)],
            categories: ['All', ...categoryResults.map(r => r.value).filter(Boolean)],
            brands: ['All', ...brandResults.map(r => r.value).filter(Boolean)],
            skus: ['All', ...skuResults.map(r => r.value).filter(Boolean)]
        };
    } catch (error) {
        console.error('[getAvailabilityCompetitionFilterOptions] Error:', error);
        return { locations: ['All India'], categories: ['All'], brands: ['All'], skus: ['All'] };
    }
};

const getAvailabilityCompetitionBrandTrends = async (filters = {}) => {
    console.log('[getAvailabilityCompetitionBrandTrends] Request with filters:', filters);

    const cacheKey = generateCacheKey('availability_competition_brand_trends', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            let { brands = 'All', location = 'All', category = 'All', period = '1M', startDate: fStart, endDate: fEnd } = filters;
            if (location === 'All India') location = 'All';

            let brandList = [];
            if (brands && brands !== 'All') {
                if (Array.isArray(brands)) {
                    brandList = brands;
                } else {
                    brandList = brands.split(',').map(b => b.trim());
                }
            }
            if (brandList.length === 0) {
                return { metrics: [], timeSeries: {}, brands: [] };
            }

            let startDate, endDate;
            if (fStart && fEnd) {
                startDate = dayjs(fStart);
                endDate = dayjs(fEnd);
            } else {
                const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
                const days = periodDays[period] || 30;
                endDate = await getLatestDate();
                startDate = endDate.subtract(days, 'days');
            }

            const whereClause = buildAvailabilityWhereClause({ ...filters, startDate, endDate });

            const query = `
                SELECT 
                    Brand,
                    DATE as ref_date,
                    SUM(toFloat64OrZero(toString(neno_osa))) as total_neno,
                    SUM(toFloat64OrZero(toString(deno_osa))) as total_deno,
                    SUM(toFloat64OrZero(toString(Inventory))) as total_inventory,
                    SUM(toFloat64OrZero(toString(Qty_Sold))) as total_qty_sold,
                    COUNT(DISTINCT Web_Pid) as assortment_count
                FROM rb_pdp_olap
                WHERE ${whereClause}
                GROUP BY Brand, DATE
                ORDER BY DATE ASC
            `;

            const results = await queryClickHouse(query);

            // Get master counts from rca_sku_dim for all brands in the brandList to calculate Listing %
            let brandMasterCounts = {};
            if (brandList.length > 0) {
                const brandFilterStr = brandList.map(b => `'${escapeStr(b)}'`).join(',');
                const masterConds = [`status = 1`, `brand_name IN (${brandFilterStr})`];
                if (category && category !== 'All') masterConds.push(`brand_category = '${escapeStr(category)}'`);

                const masterQuery = `
                    SELECT brand_name, count(DISTINCT web_pid) as total_master
                    FROM rb_sku_platform
                    WHERE ${masterConds.join(' AND ')}
                    GROUP BY brand_name
                `;
                const masterResults = await queryClickHouse(masterQuery);
                masterResults.forEach(r => {
                    brandMasterCounts[r.brand_name] = parseInt(r.total_master, 10) || 0;
                });
            }

            // Get all unique dates in the results
            const uniqueDates = Array.from(new Set(results.map(r => dayjs(r.ref_date).format("DD MMM'YY")))).sort((a, b) => {
                const dateA = dayjs(a, "DD MMM'YY");
                const dateB = dayjs(b, "DD MMM'YY");
                return dateA.diff(dateB);
            });

            // Prepare the response in the format expected by TrendView
            const response = {
                dates: uniqueDates,
                osa: {},
                doi: {},
                listing: {},
                assortment: {},
                fillrate: {},
                psl: {}
            };

            // Initialize brand arrays for each metric
            brandList.forEach(brandName => {
                response.osa[brandName] = new Array(uniqueDates.length).fill(0);
                response.doi[brandName] = new Array(uniqueDates.length).fill(0);
                response.listing[brandName] = new Array(uniqueDates.length).fill(0);
                response.assortment[brandName] = new Array(uniqueDates.length).fill(0);
                response.fillrate[brandName] = new Array(uniqueDates.length).fill(0);
                response.psl[brandName] = new Array(uniqueDates.length).fill(0);
            });

            // Map results into the prefilled response arrays
            results.forEach(row => {
                const brandName = row.Brand;
                const dateStr = dayjs(row.ref_date).format("DD MMM'YY");
                const dateIndex = uniqueDates.indexOf(dateStr);

                if (dateIndex !== -1 && response.osa[brandName]) {
                    const neno = parseFloat(row.total_neno) || 0;
                    const deno = parseFloat(row.total_deno) || 0;
                    const dailyUniquePids = parseInt(row.assortment_count, 10) || 0;
                    const masterCount = brandMasterCounts[brandName] || 0;
                    const totalQtySold = parseFloat(row.total_qty_sold) || 0;
                    const totalInv = parseFloat(row.total_inventory) || 0;

                    const osa = deno > 0 ? (neno / deno) * 100 : 0;
                    const listing = masterCount > 0 ? (dailyUniquePids / masterCount) * 100 : 0;
                    const doi = totalQtySold > 0 ? (totalInv / totalQtySold) * 30 : 0;

                    response.osa[brandName][dateIndex] = parseFloat(osa.toFixed(1));
                    response.listing[brandName][dateIndex] = parseFloat(listing.toFixed(1));
                    response.assortment[brandName][dateIndex] = dailyUniquePids;
                    response.doi[brandName][dateIndex] = parseFloat(doi.toFixed(1));
                    response.psl[brandName][dateIndex] = parseFloat(listing.toFixed(1)); // Placeholder using listing for now
                }
            });

            return response;
        } catch (error) {
            console.error('[getAvailabilityCompetitionBrandTrends] Error:', error);
            return { metrics: [], timeSeries: {}, brands: [] };
        }
    }, CACHE_TTL.SHORT);
};

export default {
    getAssortment,
    getAbsoluteOsaOverview,
    getAbsoluteOsaPlatformKpiMatrix,
    getAbsoluteOsaPercentageDetail,
    getDOI,
    isMetroCity,
    getMetroCities,
    getMetroCityStockAvailability,
    getAvailabilityFilterOptions,
    getOsaDetailByCategory,
    getAvailabilityKpiTrends,
    getAvailabilityCompetitionData,
    getAvailabilityCompetitionFilterOptions,
    getAvailabilityCompetitionBrandTrends
};
