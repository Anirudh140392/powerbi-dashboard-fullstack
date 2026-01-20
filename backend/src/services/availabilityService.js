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
                    SUM(toFloat64OrNull(neno_osa)) as sumNenoOsa,
                    SUM(toFloat64OrNull(deno_osa)) as sumDenoOsa
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
            const kpiQuery = `
                SELECT 
                    ${groupColumn} as col_value,
                    SUM(toFloat64OrNull(neno_osa)) as sum_neno,
                    SUM(toFloat64OrNull(deno_osa)) as sum_deno,
                    SUM(toFloat64(ifNull(inventory, 0))) as total_inventory,
                    SUM(toFloat64(ifNull(Qty_Sold, 0))) as total_qty_sold,
                    COUNT(DISTINCT Web_Pid) as assortment_count
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                  AND ${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                  ${baseFilter}
                GROUP BY ${groupColumn}
            `;

            const prevKpiQuery = `
                SELECT 
                    ${groupColumn} as col_value,
                    SUM(toFloat64OrNull(neno_osa)) as sum_neno,
                    SUM(toFloat64OrNull(deno_osa)) as sum_deno,
                    SUM(toFloat64(ifNull(inventory, 0))) as total_inventory,
                    SUM(toFloat64(ifNull(Qty_Sold, 0))) as total_qty_sold,
                    COUNT(DISTINCT Web_Pid) as assortment_count
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '${prevStartDate.format('YYYY-MM-DD')}' AND '${prevEndDate.format('YYYY-MM-DD')}'
                  AND ${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                  ${baseFilter}
                GROUP BY ${groupColumn}
            `;

            const [currentResults, prevResults] = await Promise.all([
                queryClickHouse(kpiQuery),
                queryClickHouse(prevKpiQuery)
            ]);

            // Build lookup maps
            const currentMap = {};
            currentResults.forEach(r => { currentMap[r.col_value] = r; });
            const prevMap = {};
            prevResults.forEach(r => { prevMap[r.col_value] = r; });

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

                // DOI
                const currDoi = (parseFloat(curr.total_qty_sold) > 0)
                    ? (parseFloat(curr.total_inventory) / parseFloat(curr.total_qty_sold)) * 30 : 0;
                const prevDoi = (parseFloat(prev.total_qty_sold) > 0)
                    ? (parseFloat(prev.total_inventory) / parseFloat(prev.total_qty_sold)) * 30 : 0;
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
                SELECT SUM(toFloat64(ifNull(inventory, 0))) as totalInventory
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
                        SUM(toFloat64(ifNull(inventory, 0))) as totalInventory,
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
                    SELECT SUM(toFloat64(ifNull(Qty_Sold, 0))) as totalQtySold
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${thirtyDaysAgo.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                    ${baseFilter}
                `),
                queryClickHouse(`
                    SELECT SUM(toFloat64(ifNull(inventory, 0))) as totalInventory
                    FROM rb_pdp_olap
                    WHERE DATE = '${prevEndDate.format('YYYY-MM-DD')}'
                    ${baseFilter}
                `),
                queryClickHouse(`
                    SELECT SUM(toFloat64(ifNull(Qty_Sold, 0))) as totalQtySold
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

            // Build date conditions
            const currentEndDate = endDate ? dayjs(endDate) : dayjs();
            const currentStartDate = startDate ? dayjs(startDate) : currentEndDate.startOf('month');
            const periodDays = currentEndDate.diff(currentStartDate, 'day') + 1;
            const prevEndDate = currentStartDate.subtract(1, 'day');
            const prevStartDate = prevEndDate.subtract(periodDays - 1, 'day');

            // Build filter conditions
            const metroLocations = metroCities.map(c => `'${escapeStr(c)}'`).join(',');
            const baseConditions = [`Location IN (${metroLocations})`];
            if (platform && platform !== 'All') baseConditions.push(`Platform = '${escapeStr(platform)}'`);
            if (brand && brand !== 'All') baseConditions.push(`Brand = '${escapeStr(brand)}'`);
            const baseFilter = baseConditions.join(' AND ');

            const [currentResult, prevResult] = await Promise.all([
                queryClickHouse(`
                    SELECT 
                        SUM(toFloat64OrNull(neno_osa)) as sumNeno,
                        SUM(toFloat64OrNull(deno_osa)) as sumDeno
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                      AND ${baseFilter}
                `),
                queryClickHouse(`
                    SELECT 
                        SUM(toFloat64OrNull(neno_osa)) as sumNeno,
                        SUM(toFloat64OrNull(deno_osa)) as sumDeno
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
                metroCitiesCount: metroCities.length,
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
                const catConditions = [...conditions.filter(c => !c.includes('Category'))];
                catConditions.push(`Category IS NOT NULL AND Category != ''`);
                const whereClause = catConditions.length > 0 ? `WHERE ${catConditions.join(' AND ')}` : '';
                const query = `SELECT DISTINCT Category as value FROM rb_pdp_olap ${whereClause} ORDER BY Category`;
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

const getOsaDetailByCategory = async (filters) => {
    console.log('[getOsaDetailByCategory] Request received with filters:', filters);

    const cacheKey = generateCacheKey('osa_detail_by_category', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, brand, location, startDate, endDate } = filters;

            const currentEndDate = endDate ? dayjs(endDate) : dayjs();
            const currentStartDate = startDate ? dayjs(startDate) : currentEndDate.subtract(30, 'day');

            // Build filter conditions
            const conditions = [
                `DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'`
            ];
            if (platform && platform !== 'All') conditions.push(`Platform = '${escapeStr(platform)}'`);
            if (brand && brand !== 'All') conditions.push(`Brand = '${escapeStr(brand)}'`);
            if (location && location !== 'All') conditions.push(`Location = '${escapeStr(location)}'`);

            const whereClause = conditions.join(' AND ');

            const query = `
                SELECT 
                    Category,
                    DATE,
                    SUM(toFloat64OrNull(neno_osa)) as sum_neno,
                    SUM(toFloat64OrNull(deno_osa)) as sum_deno
                FROM rb_pdp_olap
                WHERE ${whereClause}
                  AND Category IS NOT NULL AND Category != ''
                GROUP BY Category, DATE
                ORDER BY Category, DATE
            `;

            const results = await queryClickHouse(query);

            // Transform into category-based structure
            const categoryMap = {};
            results.forEach(row => {
                const cat = row.Category;
                const date = dayjs(row.DATE).format('YYYY-MM-DD');
                const neno = parseFloat(row.sum_neno) || 0;
                const deno = parseFloat(row.sum_deno) || 0;
                const osa = deno > 0 ? (neno / deno) * 100 : 0;

                if (!categoryMap[cat]) {
                    categoryMap[cat] = { category: cat, dailyOsa: {} };
                }
                categoryMap[cat].dailyOsa[date] = parseFloat(osa.toFixed(1));
            });

            return {
                section: "osa_detail_by_category",
                categories: Object.values(categoryMap),
                dateRange: {
                    start: currentStartDate.format('YYYY-MM-DD'),
                    end: currentEndDate.format('YYYY-MM-DD')
                },
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
            const { platform, brand, location, category, period = '1M', timeStep = 'daily' } = filters;

            const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
            const days = periodDays[period] || 30;
            const endDate = dayjs();
            const startDate = endDate.subtract(days, 'days');

            // Build filter conditions
            const conditions = [
                `DATE BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`
            ];
            if (platform && platform !== 'All') conditions.push(`Platform = '${escapeStr(platform)}'`);
            if (brand && brand !== 'All') conditions.push(`Brand = '${escapeStr(brand)}'`);
            if (location && location !== 'All') conditions.push(`Location = '${escapeStr(location)}'`);
            if (category && category !== 'All') conditions.push(`Category = '${escapeStr(category)}'`);

            const whereClause = conditions.join(' AND ');

            const query = `
                SELECT 
                    DATE as ref_date,
                    SUM(toFloat64OrNull(neno_osa)) as total_neno,
                    SUM(toFloat64OrNull(deno_osa)) as total_deno,
                    SUM(toFloat64(ifNull(inventory, 0))) as total_inventory,
                    SUM(toFloat64(ifNull(Qty_Sold, 0))) as total_qty_sold,
                    COUNT(DISTINCT Web_Pid) as assortment_count
                FROM rb_pdp_olap
                WHERE ${whereClause}
                GROUP BY DATE
                ORDER BY DATE ASC
            `;

            const results = await queryClickHouse(query);

            const timeSeries = results.map(row => {
                const neno = parseFloat(row.total_neno) || 0;
                const deno = parseFloat(row.total_deno) || 0;
                const inventory = parseFloat(row.total_inventory) || 0;
                const qtySold = parseFloat(row.total_qty_sold) || 0;

                const osa = deno > 0 ? (neno / deno) * 100 : 0;
                const doi = qtySold > 0 ? (inventory / qtySold) * 30 : 0;

                return {
                    date: dayjs(row.ref_date).format("DD MMM'YY"),
                    Osa: parseFloat(osa.toFixed(1)),
                    Doi: parseFloat(doi.toFixed(1)),
                    Fillrate: 0,
                    Assortment: parseInt(row.assortment_count, 10) || 0
                };
            });

            return {
                metrics: [
                    { id: 'Osa', label: 'OSA', color: '#F97316', default: true },
                    { id: 'Doi', label: 'DOI', color: '#7C3AED', default: true },
                    { id: 'Fillrate', label: 'Fillrate', color: '#6366F1', default: false },
                    { id: 'Assortment', label: 'Assortment', color: '#22C55E', default: false }
                ],
                timeSeries,
                period,
                dateRange: { start: startDate.format('YYYY-MM-DD'), end: endDate.format('YYYY-MM-DD') }
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
            let { platform = 'All', location = 'All', category = 'All', brand = 'All', period = '1M' } = filters;
            if (location === 'All India') location = 'All';

            const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
            const days = periodDays[period] || 30;
            const endDate = dayjs();
            const startDate = endDate.subtract(days, 'days');

            // Build filter conditions
            const conditions = [
                `DATE BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`
            ];
            if (platform && platform !== 'All') conditions.push(`Platform = '${escapeStr(platform)}'`);
            if (location && location !== 'All') conditions.push(`Location = '${escapeStr(location)}'`);
            if (category && category !== 'All') conditions.push(`Category = '${escapeStr(category)}'`);
            if (brand && brand !== 'All') conditions.push(`Brand = '${escapeStr(brand)}'`);

            const whereClause = conditions.join(' AND ');

            const query = `
                SELECT 
                    Brand,
                    SUM(toFloat64OrNull(neno_osa)) as total_neno,
                    SUM(toFloat64OrNull(deno_osa)) as total_deno,
                    SUM(toFloat64(ifNull(inventory, 0))) as total_inventory,
                    SUM(toFloat64(ifNull(Qty_Sold, 0))) as total_qty_sold,
                    COUNT(DISTINCT Web_Pid) as assortment_count
                FROM rb_pdp_olap
                WHERE ${whereClause}
                  AND Brand IS NOT NULL AND Brand != ''
                GROUP BY Brand
                ORDER BY total_deno DESC
                LIMIT 20
            `;

            const results = await queryClickHouse(query);

            const brands = results.map((row, idx) => {
                const neno = parseFloat(row.total_neno) || 0;
                const deno = parseFloat(row.total_deno) || 0;
                const inventory = parseFloat(row.total_inventory) || 0;
                const qtySold = parseFloat(row.total_qty_sold) || 0;

                const osa = deno > 0 ? (neno / deno) * 100 : 0;
                const doi = qtySold > 0 ? (inventory / qtySold) * 30 : 0;

                return {
                    rank: idx + 1,
                    brand: row.Brand,
                    osa: parseFloat(osa.toFixed(1)),
                    osaDelta: 0, // TODO: calculate from previous period
                    doi: parseFloat(doi.toFixed(1)),
                    doiDelta: 0,
                    assortment: parseInt(row.assortment_count, 10) || 0,
                    assortmentDelta: 0
                };
            });

            return {
                brands,
                period,
                filters,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getAvailabilityCompetitionData] Error:', error);
            return { brands: [] };
        }
    }, CACHE_TTL.SHORT);
};

const getAvailabilityCompetitionFilterOptions = async (filters = {}) => {
    console.log('[getAvailabilityCompetitionFilterOptions] Request with filters:', filters);

    try {
        const { platform = 'All', location = 'All', category = 'All', brand = 'All' } = filters;

        // Build cascading conditions
        const conditions = [];
        if (platform && platform !== 'All') conditions.push(`Platform = '${escapeStr(platform)}'`);

        const baseFilter = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const [locationResults, categoryResults, brandResults, skuResults] = await Promise.all([
            queryClickHouse(`SELECT DISTINCT Location as value FROM rb_pdp_olap WHERE Location IS NOT NULL AND Location != '' ORDER BY Location`),
            queryClickHouse(`SELECT DISTINCT Category as value FROM rb_pdp_olap ${baseFilter ? baseFilter + ' AND' : 'WHERE'} Category IS NOT NULL AND Category != '' ORDER BY Category`),
            queryClickHouse(`SELECT DISTINCT Brand as value FROM rb_pdp_olap ${baseFilter ? baseFilter + ' AND' : 'WHERE'} Brand IS NOT NULL AND Brand != '' ORDER BY Brand`),
            queryClickHouse(`SELECT DISTINCT Product as value FROM rb_pdp_olap ${baseFilter ? baseFilter + ' AND' : 'WHERE'} Product IS NOT NULL AND Product != '' ORDER BY Product LIMIT 100`)
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
            let { brands = 'All', location = 'All', category = 'All', period = '1M' } = filters;
            if (location === 'All India') location = 'All';

            const brandList = brands && brands !== 'All' ? brands.split(',').map(b => b.trim()) : [];
            if (brandList.length === 0) {
                return { metrics: [], timeSeries: {}, brands: [] };
            }

            const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
            const days = periodDays[period] || 30;
            const endDate = dayjs();
            const startDate = endDate.subtract(days, 'days');

            // Build filter conditions
            const brandFilter = brandList.map(b => `'${escapeStr(b)}'`).join(',');
            const conditions = [
                `DATE BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
                `Brand IN (${brandFilter})`
            ];
            if (location && location !== 'All') conditions.push(`Location = '${escapeStr(location)}'`);
            if (category && category !== 'All') conditions.push(`Category = '${escapeStr(category)}'`);

            const whereClause = conditions.join(' AND ');

            const query = `
                SELECT 
                    Brand,
                    DATE as ref_date,
                    SUM(toFloat64OrNull(neno_osa)) as total_neno,
                    SUM(toFloat64OrNull(deno_osa)) as total_deno,
                    SUM(toFloat64(ifNull(inventory, 0))) as total_inventory,
                    SUM(toFloat64(ifNull(Qty_Sold, 0))) as total_qty_sold,
                    COUNT(DISTINCT Web_Pid) as assortment_count
                FROM rb_pdp_olap
                WHERE ${whereClause}
                GROUP BY Brand, DATE
                ORDER BY DATE ASC
            `;

            const results = await queryClickHouse(query);

            // Transform into brand-based time series
            const brandTrends = {};
            results.forEach(row => {
                const brandName = row.Brand;
                if (!brandTrends[brandName]) {
                    brandTrends[brandName] = [];
                }

                const neno = parseFloat(row.total_neno) || 0;
                const deno = parseFloat(row.total_deno) || 0;
                const inventory = parseFloat(row.total_inventory) || 0;
                const qtySold = parseFloat(row.total_qty_sold) || 0;

                const osa = deno > 0 ? (neno / deno) * 100 : 0;
                const doi = qtySold > 0 ? (inventory / qtySold) * 30 : 0;

                brandTrends[brandName].push({
                    date: dayjs(row.ref_date).format("DD MMM'YY"),
                    Osa: parseFloat(osa.toFixed(1)),
                    Doi: parseFloat(doi.toFixed(1)),
                    Fillrate: 0,
                    Assortment: parseInt(row.assortment_count, 10) || 0
                });
            });

            return {
                metrics: [
                    { id: 'Osa', label: 'OSA', color: '#F97316', default: true },
                    { id: 'Doi', label: 'DOI', color: '#7C3AED', default: true },
                    { id: 'Fillrate', label: 'Fillrate', color: '#6366F1', default: false },
                    { id: 'Assortment', label: 'Assortment', color: '#22C55E', default: false }
                ],
                timeSeries: brandTrends,
                brands: brandList,
                period,
                dateRange: { start: startDate.format('YYYY-MM-DD'), end: endDate.format('YYYY-MM-DD') }
            };
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
