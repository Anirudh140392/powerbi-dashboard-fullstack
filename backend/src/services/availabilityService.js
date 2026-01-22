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
            const conditions = [];
            if (startDate && endDate) {
                conditions.push(`DATE BETWEEN '${dayjs(startDate).format('YYYY-MM-DD')}' AND '${dayjs(endDate).format('YYYY-MM-DD')}'`);
            } else if (endDate) {
                conditions.push(`DATE = '${dayjs(endDate).format('YYYY-MM-DD')}'`);
            } else {
                conditions.push(`DATE = '${dayjs().format('YYYY-MM-DD')}'`);
            }

            if (platform && platform !== 'All') conditions.push(`Platform = '${escapeStr(platform)}'`);
            if (brand && brand !== 'All') conditions.push(`Brand = '${escapeStr(brand)}'`);
            if (location && location !== 'All') conditions.push(`Location = '${escapeStr(location)}'`);

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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

            // Build base filter conditions (without date and group column)
            const baseConditions = [];
            if (platform && platform !== 'All' && viewMode !== 'Platform') {
                baseConditions.push(`Platform = '${escapeStr(platform)}'`);
            }
            if (brand && brand !== 'All') {
                baseConditions.push(`Brand = '${escapeStr(brand)}'`);
            }
            if (location && location !== 'All' && viewMode !== 'City') {
                baseConditions.push(`Location = '${escapeStr(location)}'`);
            }

            if (viewMode === 'Format') {
                const activeCategoriesResult = await queryClickHouse(
                    `SELECT DISTINCT Category FROM rca_sku_dim WHERE toString(status) = '1' AND Category IS NOT NULL AND Category != ''`
                );

                const validCategories = activeCategoriesResult.map(c => c.Category).filter(Boolean);

                if (validCategories.length > 0) {
                    baseConditions.push(`Category IN (${validCategories.map(v => `'${escapeStr(v)}'`).join(',')})`);
                } else {
                    // If no categories have status=1, we should return empty to avoid showing inactive ones
                    return {
                        section: "platform_kpi_matrix",
                        viewMode,
                        columns: ['KPI'],
                        rows: [],
                        filters,
                        timestamp: new Date().toISOString()
                    };
                }
            }

            const baseFilter = baseConditions.length > 0 ? ` AND ${baseConditions.join(' AND ')}` : '';

            // Get distinct column values
            const distinctQuery = `
                SELECT DISTINCT ${groupColumn} as value
                FROM rb_pdp_olap
                WHERE ${groupColumn} IS NOT NULL AND ${groupColumn} != ''
                ${baseFilter}
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

                // Fillrate (placeholder)
                kpiRows.fillrate[colValue] = 'Coming Soon';
                kpiRows.fillrate.trend[colValue] = 0;

                // Assortment
                kpiRows.assortment[colValue] = parseInt(curr.assortment_count, 10) || 0;
                kpiRows.assortment.trend[colValue] = (parseInt(curr.assortment_count, 10) || 0) - (parseInt(prev.assortment_count, 10) || 0);

                // PSL (placeholder)
                kpiRows.psl[colValue] = Math.round(Math.random() * 30);
                kpiRows.psl.trend[colValue] = 0;
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

            // Build base filter conditions
            const baseConditions = [];
            if (platform && platform !== 'All') baseConditions.push(`Platform = '${escapeStr(platform)}'`);
            if (brand && brand !== 'All') baseConditions.push(`Brand = '${escapeStr(brand)}'`);
            if (location && location !== 'All') baseConditions.push(`Location = '${escapeStr(location)}'`);
            const baseFilter = baseConditions.length > 0 ? ` AND ${baseConditions.join(' AND ')}` : '';

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

            // Build filter conditions
            const metroLocations = targetLocations.map(c => `'${escapeStr(c)}'`).join(',');
            const baseConditions = [`Location IN (${metroLocations})`];
            if (platform && platform !== 'All') baseConditions.push(`Platform = '${escapeStr(platform)}'`);
            if (brand && brand !== 'All') baseConditions.push(`Brand = '${escapeStr(brand)}'`);
            const baseFilter = baseConditions.join(' AND ');

            const [currentResult, prevResult] = await Promise.all([
                queryClickHouse(`
                    SELECT 
                        SUM(toFloat64(neno_osa)) as sumNeno,
                        SUM(toFloat64(deno_osa)) as sumDeno
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                      AND ${baseFilter}
                `),
                queryClickHouse(`
                    SELECT 
                        SUM(toFloat64(neno_osa)) as sumNeno,
                        SUM(toFloat64(deno_osa)) as sumDeno
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${prevStartDate.format('YYYY-MM-DD')}' AND '${prevEndDate.format('YYYY-MM-DD')}'
                      AND ${baseFilter}
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

const getAvailabilityFilterOptions = async ({ filterType, platform, brand, category, city }) => {
    const cacheKey = `availability_filter:${filterType}:${(platform || 'all').toLowerCase()}:${(brand || 'all').toLowerCase()}:${(category || 'all').toLowerCase()}:${(city || 'all').toLowerCase()}`;

    return getCachedOrCompute(cacheKey, async () => {
        try {
            console.log(`[getAvailabilityFilterOptions] Fetching ${filterType}`);

            // Build cascading filter conditions
            const conditions = [];
            if (platform && platform !== 'All') conditions.push(`Platform = '${escapeStr(platform)}'`);
            if (category && category !== 'All') conditions.push(`Category = '${escapeStr(category)}'`);
            if (city && city !== 'All') conditions.push(`Location = '${escapeStr(city)}'`);
            const baseFilter = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            if (filterType === 'platforms') {
                const query = `SELECT DISTINCT Platform as value FROM rb_pdp_olap WHERE Platform IS NOT NULL AND Platform != '' ORDER BY Platform`;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'categories') {
                const catConditions = [`status = 1`, `Category IS NOT NULL`, `Category != ''`];
                if (platform && platform !== 'All') catConditions.push(`platform = '${escapeStr(platform)}'`);
                if (city && city !== 'All') catConditions.push(`location = '${escapeStr(city)}'`);

                const query = `
                    SELECT DISTINCT Category as value 
                    FROM rca_sku_dim
                    WHERE ${catConditions.join(' AND ')}
                    ORDER BY value
                `;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'cities') {
                const cityConditions = [...conditions.filter(c => !c.includes('Location'))];
                cityConditions.push(`Location IS NOT NULL AND Location != ''`);
                const whereClause = cityConditions.length > 0 ? `WHERE ${cityConditions.join(' AND ')}` : '';
                const query = `SELECT DISTINCT Location as value FROM rb_pdp_olap ${whereClause} ORDER BY Location`;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'brands') {
                const brandConditions = [...conditions.filter(c => !c.includes('Brand'))];
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
const buildAvailabilityWhereClause = (filters, tableAlias = 't1') => {
    const { platform, brand, location, startDate, endDate, dates, months, cities, categories } = filters;
    const conditions = [];

    const prefix = tableAlias ? `${tableAlias}.` : '';

    if (platform && platform !== 'All') conditions.push(`${prefix}Platform = '${escapeStr(platform)}'`);
    if (brand && brand !== 'All') conditions.push(`${prefix}Brand = '${escapeStr(brand)}'`);
    if (location && location !== 'All') conditions.push(`${prefix}Location = '${escapeStr(location)}'`);

    // Date/Month range
    if (dates && dates.length > 0) {
        conditions.push(`${prefix}DATE IN (${dates.map(d => `'${d}'`).join(',')})`);
    } else if (months && months.length > 0) {
        conditions.push(`formatDateTime(${prefix}DATE, '%Y-%m') IN (${months.map(m => `'${m}'`).join(',')})`);
    } else if (startDate && endDate) {
        conditions.push(`${prefix}DATE BETWEEN '${startDate}' AND '${endDate}'`);
    }

    // Advanced filters (Normalized ID matching)
    if (cities && cities.length > 0) {
        conditions.push(`lower(replace(${prefix}Location, ' ', '_')) IN (${cities.map(c => `'${escapeStr(c).toLowerCase()}'`).join(',')})`);
    }
    if (categories && categories.length > 0) {
        conditions.push(`lower(replace(${prefix}Category, ' ', '_')) IN (${categories.map(c => `'${escapeStr(c).toLowerCase()}'`).join(',')})`);
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
};

const getOsaDetailByCategory = async (filters) => {
    console.log('[getOsaDetailByCategory] Request received with filters:', filters);

    const cacheKey = generateCacheKey('osa_detail_sku_level', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const whereClause = buildAvailabilityWhereClause(filters, 't1');

            // Query SKU-level data joined with rca_sku_dim to filter by active segments (status=1)
            const query = `
                SELECT 
                    t1.Product as name,
                    t1.Web_Pid as sku,
                    t1.DATE,
                    SUM(toFloat64(t1.neno_osa)) as sum_neno,
                    SUM(toFloat64(t1.deno_osa)) as sum_deno
                FROM rb_pdp_olap t1
                JOIN rca_sku_dim t2 ON t1.Platform = t2.platform 
                    AND t1.Location = t2.location 
                    AND t1.Brand = t2.brand_name 
                    AND t1.Category = t2.Category
                WHERE ${whereClause}
                  AND t2.status = 1
                GROUP BY t1.Product, t1.Web_Pid, t1.DATE
                ORDER BY t1.Product, t1.Web_Pid, t1.DATE
            `;

            const results = await queryClickHouse(query);

            // Transform into the format the frontend expects: { name, sku, values, avg31, status }
            const skuMap = {};
            const allDatesSet = new Set();

            results.forEach(row => {
                const skuId = row.sku;
                const dateStr = dayjs(row.DATE).format('YYYY-MM-DD');
                allDatesSet.add(dateStr);

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

            const sortedDates = Array.from(allDatesSet).sort();

            const categories = Object.values(skuMap).map(item => {
                const values = sortedDates.map(d => item.dailyOsa[d] ?? 0);

                // Overall average (avg31 in frontend, but here it's for the selected period)
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

            const currentEndDate = filterEnd ? dayjs(filterEnd) : dayjs();
            const currentStartDate = filterStart ? dayjs(filterStart) : currentEndDate.subtract(days - 1, 'days');

            // Build filter conditions
            const conditions = [
                `DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'`
            ];
            if (platform && platform !== 'All') {
                const platformList = platform.split(',').map(p => p.trim()).filter(p => p && p !== 'All');
                if (platformList.length > 0) {
                    conditions.push(`Platform IN (${platformList.map(p => `'${escapeStr(p)}'`).join(',')})`);
                }
            }
            if (brand && brand !== 'All') {
                const brandList = brand.split(',').map(b => b.trim()).filter(b => b && b !== 'All');
                if (brandList.length > 0) {
                    conditions.push(`Brand IN (${brandList.map(b => `'${escapeStr(b)}'`).join(',')})`);
                }
            }
            if (location && location !== 'All' && location !== 'All India') {
                const locationList = location.split(',').map(l => l.trim()).filter(l => l && l !== 'All' && l !== 'All India');
                if (locationList.length > 0) {
                    conditions.push(`Location IN (${locationList.map(l => `'${escapeStr(l)}'`).join(',')})`);
                }
            }
            if (category && category !== 'All') {
                const categoryList = category.split(',').map(c => c.trim()).filter(c => c && c !== 'All');
                if (categoryList.length > 0) {
                    conditions.push(`Category IN (${categoryList.map(c => `'${escapeStr(c)}'`).join(',')})`);
                }
            }

            const whereClause = conditions.join(' AND ');

            const query = `
                SELECT 
                    DATE as ref_date,
                    SUM(toFloat64(neno_osa)) as total_neno,
                    SUM(toFloat64(deno_osa)) as total_deno,
                    SUM(toFloat64(Inventory)) as total_inventory,
                    SUM(toFloat64(Qty_Sold)) as total_qty_sold,
                    COUNT(DISTINCT Web_Pid) as assortment_count
                FROM rb_pdp_olap
                WHERE ${whereClause}
                GROUP BY DATE
                ORDER BY DATE ASC
            `;

            const results = await queryClickHouse(query);

            // Get total active assortment from rb_sku_platform for Listing % calculation
            const masterAssortmentConds = [`status = 1`];
            if (platform && platform !== 'All') masterAssortmentConds.push(`platform_name = '${escapeStr(platform)}'`);
            if (category && category !== 'All') masterAssortmentConds.push(`brand_category = '${escapeStr(category)}'`);
            if (brand && brand !== 'All') masterAssortmentConds.push(`brand_name = '${escapeStr(brand)}'`);

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
                endDate = dayjs();
                startDate = endDate.subtract(days, 'days');
            }

            // Build filter conditions
            const conditions = [
                `DATE BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`
            ];
            if (platform && platform !== 'All') {
                const platformList = platform.split(',').map(p => p.trim()).filter(p => p && p !== 'All');
                if (platformList.length > 0) {
                    conditions.push(`Platform IN (${platformList.map(p => `'${escapeStr(p)}'`).join(',')})`);
                }
            }
            if (location && location !== 'All' && location !== 'All India') {
                const locationList = location.split(',').map(l => l.trim()).filter(l => l && l !== 'All' && l !== 'All India');
                if (locationList.length > 0) {
                    conditions.push(`Location IN (${locationList.map(l => `'${escapeStr(l)}'`).join(',')})`);
                }
            }
            if (category && category !== 'All') {
                const categoryList = category.split(',').map(c => c.trim()).filter(c => c && c !== 'All');
                if (categoryList.length > 0) {
                    conditions.push(`Category IN (${categoryList.map(c => `'${escapeStr(c)}'`).join(',')})`);
                }
            }
            if (brand && brand !== 'All') {
                const brandList = brand.split(',').map(b => b.trim()).filter(b => b && b !== 'All');
                if (brandList.length > 0) {
                    conditions.push(`Brand IN (${brandList.map(b => `'${escapeStr(b)}'`).join(',')})`);
                }
            }

            const whereClause = conditions.join(' AND ');

            const query = `
                WITH latest_skus AS (
                    SELECT 
                        Brand,
                        Web_Pid,
                        argMax(toFloat64OrZero(Inventory), DATE) as sku_latest_inventory
                    FROM rb_pdp_olap
                    WHERE ${whereClause}
                      AND Brand IS NOT NULL AND Brand != ''
                      AND Comp_flag = 1
                    GROUP BY Brand, Web_Pid
                )
                SELECT 
                    Brand,
                    SUM(toFloat64(neno_osa)) as total_neno,
                    SUM(toFloat64(deno_osa)) as total_deno,
                    SUM(toFloat64OrZero(Qty_Sold)) as total_qty_sold,
                    COUNT(DISTINCT Web_Pid) as assortment_count,
                    (SELECT SUM(sku_latest_inventory) FROM latest_skus WHERE latest_skus.Brand = rb_pdp_olap.Brand) as total_brand_inventory
                FROM rb_pdp_olap
                WHERE ${whereClause}
                  AND Brand IS NOT NULL AND Brand != ''
                  AND Comp_flag = 1
                GROUP BY Brand
                ORDER BY total_deno DESC
                LIMIT 8
            `;

            const results = await queryClickHouse(query);

            // Get master counts from rb_sku_platform for all brands in the results to calculate Listing %
            const foundBrands = results.map(r => r.Brand).filter(Boolean);
            let brandMasterCounts = {};

            if (foundBrands.length > 0) {
                const brandListStr = foundBrands.map(b => `'${escapeStr(b)}'`).join(', ');
                const masterConds = [`status = 1`, `brand_name IN (${brandListStr})`];
                if (platform && platform !== 'All') masterConds.push(`platform_name = '${escapeStr(platform)}'`);
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

            const brands = results.map((row, idx) => {
                const neno = parseFloat(row.total_neno) || 0;
                const deno = parseFloat(row.total_deno) || 0;
                const dailyUniquePids = parseInt(row.assortment_count, 10) || 0;
                const brandName = row.Brand;
                const masterCount = brandMasterCounts[brandName] || 0;

                const totalQtySold = parseFloat(row.total_qty_sold) || 0;
                const totalBrandInv = parseFloat(row.total_brand_inventory) || 0;

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
                    SUM(toFloat64(neno_osa)) as total_neno,
                    SUM(toFloat64(deno_osa)) as total_deno,
                    SUM(toFloat64OrZero(Qty_Sold)) as total_qty_sold,
                    argMax(toFloat64OrZero(Inventory), DATE) as latest_sku_inventory
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
        const baseConds = [`Comp_flag = 1`];
        if (platform && platform !== 'All') {
            const platArr = platform.split(',').map(p => p.trim()).filter(p => p && p !== 'All');
            if (platArr.length > 0) baseConds.push(`Platform IN (${platArr.map(p => `'${escapeStr(p)}'`).join(',')})`);
        }

        // Handle location for filtering others
        const locArr = location.split(',').map(l => l.trim()).filter(l => l && l !== 'All' && l !== 'All India');
        const locFilter = locArr.length > 0 ? `AND Location IN (${locArr.map(l => `'${escapeStr(l)}'`).join(',')})` : '';

        // 2. Build Category conditions (filtered by Platform/Location)
        const catQuery = `SELECT DISTINCT Category as value FROM rb_pdp_olap WHERE ${baseConds.join(' AND ')} ${locFilter} AND Category IS NOT NULL AND Category != '' ORDER BY Category`;

        // 3. Build Brand conditions (filtered by Platform/Location/Category)
        const brandConds = [...baseConds];
        const catArr = category.split(',').map(c => c.trim()).filter(c => c && c !== 'All');
        if (catArr.length > 0) {
            brandConds.push(`Category IN (${catArr.map(c => `'${escapeStr(c)}'`).join(',')})`);
        }
        const brandQuery = `SELECT DISTINCT Brand as value FROM rb_pdp_olap WHERE ${brandConds.join(' AND ')} ${locFilter} AND Brand IS NOT NULL AND Brand != '' ORDER BY Brand`;

        // 4. Build SKU conditions (filtered by Platform/Location/Category/Brand)
        const skuConds = [...brandConds];
        const bndArr = brand.split(',').map(b => b.trim()).filter(b => b && b !== 'All');
        if (bndArr.length > 0) {
            skuConds.push(`Brand IN (${bndArr.map(b => `'${escapeStr(b)}'`).join(',')})`);
        }
        const skuQuery = `SELECT DISTINCT Product as value FROM rb_pdp_olap WHERE ${skuConds.join(' AND ')} ${locFilter} AND Product IS NOT NULL AND Product != '' ORDER BY Product LIMIT 200`;

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

            const brandList = brands && brands !== 'All' ? brands.split(',').map(b => b.trim()) : [];
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
                endDate = dayjs();
                startDate = endDate.subtract(days, 'days');
            }

            // Build filter conditions
            const brandFilter = brandList.map(b => `'${escapeStr(b)}'`).join(',');
            const conditions = [
                `DATE BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
                `Brand IN (${brandFilter})`,
                `Comp_flag = 1`
            ];

            if (location && location !== 'All') {
                const locationList = location.split(',').map(l => l.trim());
                conditions.push(`Location IN (${locationList.map(l => `'${escapeStr(l)}'`).join(',')})`);
            }
            if (category && category !== 'All') {
                const categoryList = category.split(',').map(c => c.trim());
                conditions.push(`Category IN (${categoryList.map(c => `'${escapeStr(c)}'`).join(',')})`);
            }

            const whereClause = conditions.join(' AND ');

            const query = `
                SELECT 
                    Brand,
                    DATE as ref_date,
                    SUM(toFloat64(neno_osa)) as total_neno,
                    SUM(toFloat64(deno_osa)) as total_deno,
                    SUM(toFloat64(Inventory)) as total_inventory,
                    SUM(toFloat64(Qty_Sold)) as total_qty_sold,
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
