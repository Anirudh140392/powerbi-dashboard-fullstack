import { Op } from 'sequelize';
import dayjs from 'dayjs';
import sequelize from '../config/db.js';
import RbPdpOlap from '../models/RbPdpOlap.js';
import RcaSkuDim from '../models/RcaSkuDim.js';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

const getAssortment = async (filters) => {
    // Generate cache key based on filters
    const cacheKey = generateCacheKey('assortment', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, months, startDate, endDate, brand, location } = filters;
            const whereClause = {};

            // Determine the target date (last date of the period)
            let targetDate;
            if (endDate) {
                targetDate = dayjs(endDate).format('YYYY-MM-DD');
            } else {
                targetDate = dayjs().format('YYYY-MM-DD');
            }

            // Update whereClause to filter by this specific date instead of a range
            whereClause.DATE = targetDate;

            // Brand Filter
            if (brand && brand !== 'All') {
                whereClause.Brand = brand;
            }

            // Location Filter
            if (location && location !== 'All') {
                whereClause.Location = location;
            }

            // Platform Filter - only apply if specific platform selected, otherwise get all for breakdown
            if (platform && platform !== 'All') {
                whereClause.Platform = platform;
            }

            const results = await RbPdpOlap.findAll({
                attributes: [
                    'Platform',
                    [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('Web_Pid'))), 'count']
                ],
                where: whereClause,
                group: ['Platform'],
                raw: true
            });

            // Convert to object { Platform: Count }
            const assortmentMap = {};
            results.forEach(r => {
                const count = parseInt(r.count, 10);
                assortmentMap[r.Platform] = count;
            });

            const totalAssortmentCount = await RbPdpOlap.count({
                distinct: true,
                col: 'Web_Pid',
                where: whereClause
            });

            return {
                breakdown: assortmentMap,
                total: totalAssortmentCount,
                date: targetDate
            };
        } catch (error) {
            console.error('Error calculating Assortment:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT); // 5 minutes - assortment data is fairly static
};

// ==================== Absolute OSA Section APIs ====================

/**
 * Get Availability Overview data for Absolute OSA page
 * Stock Availability = (Sum of neno_osa / Sum of deno_osa) * 100
 * @param {Object} filters - { platform, brand, location, startDate, endDate }
 */
const getAbsoluteOsaOverview = async (filters) => {
    console.log('[getAbsoluteOsaOverview] Request received with filters:', filters);

    // Generate cache key based on filters
    const cacheKey = generateCacheKey('absolute_osa_overview', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, brand, location, startDate, endDate } = filters;
            const whereClause = {};

            // Time Period Filter - date range
            if (startDate && endDate) {
                whereClause.DATE = {
                    [Op.between]: [dayjs(startDate).format('YYYY-MM-DD'), dayjs(endDate).format('YYYY-MM-DD')]
                };
            } else if (endDate) {
                whereClause.DATE = dayjs(endDate).format('YYYY-MM-DD');
            } else {
                // Default to today's date
                whereClause.DATE = dayjs().format('YYYY-MM-DD');
            }

            // Platform Filter
            if (platform && platform !== 'All') {
                whereClause.Platform = platform;
            }

            // Brand Filter
            if (brand && brand !== 'All') {
                whereClause.Brand = brand;
            }

            // Location Filter
            if (location && location !== 'All') {
                whereClause.Location = location;
            }

            console.log('[getAbsoluteOsaOverview] Where clause:', whereClause);

            // Query to get Sum of neno_osa and Sum of deno_osa
            const result = await RbPdpOlap.findOne({
                attributes: [
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('neno_osa'), 'DECIMAL')), 'sumNenoOsa'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('deno_osa'), 'DECIMAL')), 'sumDenoOsa']
                ],
                where: whereClause,
                raw: true
            });

            console.log('[getAbsoluteOsaOverview] Query result:', result);

            // Calculate Stock Availability: (Sum of neno_osa / Sum of deno_osa) * 100
            const sumNenoOsa = parseFloat(result?.sumNenoOsa) || 0;
            const sumDenoOsa = parseFloat(result?.sumDenoOsa) || 0;

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

/**
 * Get Platform KPI Matrix data for Absolute OSA page
 * Dynamic columns based on viewMode (Platform/Format/City)
 * @param {Object} filters - { viewMode, platform, brand, location, startDate, endDate }
 */
const getAbsoluteOsaPlatformKpiMatrix = async (filters) => {
    console.log('[getAbsoluteOsaPlatformKpiMatrix] Request received with filters:', filters);

    const cacheKey = generateCacheKey('platform_kpi_matrix', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { viewMode = 'Platform', platform, brand, location, startDate, endDate } = filters;

            // Import RcaSkuDim for fetching dynamic columns
            const RcaSkuDim = (await import('../models/RcaSkuDim.js')).default;

            // Date calculations
            const currentEndDate = endDate ? dayjs(endDate) : dayjs();
            const currentStartDate = startDate ? dayjs(startDate) : currentEndDate.subtract(30, 'day');
            const periodDays = currentEndDate.diff(currentStartDate, 'day') + 1;
            const prevEndDate = currentStartDate.subtract(1, 'day');
            const prevStartDate = prevEndDate.subtract(periodDays - 1, 'day');

            // Determine which column to use for grouping based on viewMode
            let groupColumn, rcaDimColumn;
            switch (viewMode) {
                case 'Format':
                    groupColumn = 'Category';  // Using Category as Format
                    rcaDimColumn = 'Category';
                    break;
                case 'City':
                    groupColumn = 'Location';
                    rcaDimColumn = 'location';
                    break;
                case 'Platform':
                default:
                    groupColumn = 'Platform';
                    rcaDimColumn = 'platform';
                    break;
            }

            // Fetch distinct column values from rca_sku_dim
            const rcaWhereClause = {};
            if (platform && platform !== 'All' && viewMode !== 'Platform') {
                rcaWhereClause.platform = platform;
            }

            const distinctValues = await RcaSkuDim.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col(rcaDimColumn)), 'value']],
                where: {
                    [rcaDimColumn]: { [Op.ne]: null },
                    ...rcaWhereClause
                },
                raw: true,
                limit: 10  // Limit to 10 columns for performance
            });

            const columnValues = distinctValues
                .map(r => r.value)
                .filter(v => v && v.trim())
                .sort()
                .slice(0, 10);

            console.log(`[getAbsoluteOsaPlatformKpiMatrix] Found ${columnValues.length} ${viewMode} values:`, columnValues);

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

            // Build base where clause
            const buildWhereClause = (start, end, columnValue) => {
                const whereClause = {
                    DATE: {
                        [Op.between]: [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]
                    }
                };

                // Add column filter based on viewMode
                whereClause[groupColumn] = columnValue;

                // Apply additional filters
                if (platform && platform !== 'All' && viewMode !== 'Platform') {
                    whereClause.Platform = platform;
                }
                if (brand && brand !== 'All') {
                    whereClause.Brand = brand;
                }
                if (location && location !== 'All' && viewMode !== 'City') {
                    whereClause.Location = location;
                }

                return whereClause;
            };

            // Calculate KPIs for each column
            const kpiRows = {
                osa: { kpi: 'OSA', trend: {} },
                doi: { kpi: 'DOI', trend: {} },
                fillrate: { kpi: 'FILLRATE', trend: {} },
                assortment: { kpi: 'ASSORTMENT', trend: {} },
                psl: { kpi: 'PSL', trend: {} }
            };

            // Process each column value
            for (const colValue of columnValues) {
                const currentWhere = buildWhereClause(currentStartDate, currentEndDate, colValue);
                const prevWhere = buildWhereClause(prevStartDate, prevEndDate, colValue);

                // === OSA Calculation ===
                const osaResult = await RbPdpOlap.findOne({
                    attributes: [
                        [sequelize.fn('SUM', sequelize.cast(sequelize.col('neno_osa'), 'DECIMAL')), 'sumNeno'],
                        [sequelize.fn('SUM', sequelize.cast(sequelize.col('deno_osa'), 'DECIMAL')), 'sumDeno']
                    ],
                    where: currentWhere,
                    raw: true
                });
                const osaPrevResult = await RbPdpOlap.findOne({
                    attributes: [
                        [sequelize.fn('SUM', sequelize.cast(sequelize.col('neno_osa'), 'DECIMAL')), 'sumNeno'],
                        [sequelize.fn('SUM', sequelize.cast(sequelize.col('deno_osa'), 'DECIMAL')), 'sumDeno']
                    ],
                    where: prevWhere,
                    raw: true
                });

                const currentOsa = (parseFloat(osaResult?.sumDeno) > 0)
                    ? (parseFloat(osaResult?.sumNeno) / parseFloat(osaResult?.sumDeno)) * 100
                    : 0;
                const prevOsa = (parseFloat(osaPrevResult?.sumDeno) > 0)
                    ? (parseFloat(osaPrevResult?.sumNeno) / parseFloat(osaPrevResult?.sumDeno)) * 100
                    : 0;

                kpiRows.osa[colValue] = Math.round(currentOsa);
                kpiRows.osa.trend[colValue] = Math.round(currentOsa - prevOsa);

                // === DOI Calculation ===
                // Formula: DOI = [end date inventory / period Qty_Sold] * 30
                // Use end date inventory (or avg of last 7 days if no data)
                const doiEndDateWhere = {
                    DATE: currentEndDate.format('YYYY-MM-DD'),
                    [groupColumn]: colValue
                };
                if (platform && platform !== 'All' && viewMode !== 'Platform') {
                    doiEndDateWhere.Platform = platform;
                }
                if (brand && brand !== 'All') {
                    doiEndDateWhere.Brand = brand;
                }
                if (location && location !== 'All' && viewMode !== 'City') {
                    doiEndDateWhere.Location = location;
                }

                let endDateInventoryResult = await RbPdpOlap.findOne({
                    attributes: [
                        [sequelize.fn('SUM', sequelize.cast(sequelize.col('inventory'), 'DECIMAL')), 'totalInventory']
                    ],
                    where: doiEndDateWhere,
                    raw: true
                });

                let endDateInventory = parseFloat(endDateInventoryResult?.totalInventory) || 0;

                // If no inventory for end date, use average of last 7 days
                if (endDateInventory === 0) {
                    const last7DaysWhere = {
                        DATE: {
                            [Op.between]: [currentEndDate.subtract(7, 'day').format('YYYY-MM-DD'), currentEndDate.format('YYYY-MM-DD')]
                        },
                        [groupColumn]: colValue
                    };
                    if (platform && platform !== 'All' && viewMode !== 'Platform') {
                        last7DaysWhere.Platform = platform;
                    }
                    if (brand && brand !== 'All') {
                        last7DaysWhere.Brand = brand;
                    }
                    if (location && location !== 'All' && viewMode !== 'City') {
                        last7DaysWhere.Location = location;
                    }

                    const last7DaysResult = await RbPdpOlap.findOne({
                        attributes: [
                            [sequelize.fn('SUM', sequelize.cast(sequelize.col('inventory'), 'DECIMAL')), 'totalInventory'],
                            [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('DATE'))), 'daysCount']
                        ],
                        where: last7DaysWhere,
                        raw: true
                    });

                    const totalInv = parseFloat(last7DaysResult?.totalInventory) || 0;
                    const daysCount = parseFloat(last7DaysResult?.daysCount) || 1;
                    endDateInventory = daysCount > 0 ? totalInv / daysCount : 0;
                }

                // Get Qty_Sold for the period
                const doiQtySoldResult = await RbPdpOlap.findOne({
                    attributes: [
                        [sequelize.fn('SUM', sequelize.cast(sequelize.col('Qty_Sold'), 'DECIMAL')), 'totalQtySold']
                    ],
                    where: currentWhere,
                    raw: true
                });

                const totalQtySold = parseFloat(doiQtySoldResult?.totalQtySold) || 0;
                const currentDoi = totalQtySold > 0 ? (endDateInventory / totalQtySold) * 30 : 0;

                // Previous period DOI
                const doiPrevEndDateWhere = {
                    DATE: prevEndDate.format('YYYY-MM-DD'),
                    [groupColumn]: colValue
                };
                if (platform && platform !== 'All' && viewMode !== 'Platform') {
                    doiPrevEndDateWhere.Platform = platform;
                }
                if (brand && brand !== 'All') {
                    doiPrevEndDateWhere.Brand = brand;
                }
                if (location && location !== 'All' && viewMode !== 'City') {
                    doiPrevEndDateWhere.Location = location;
                }

                const prevEndDateInventoryResult = await RbPdpOlap.findOne({
                    attributes: [
                        [sequelize.fn('SUM', sequelize.cast(sequelize.col('inventory'), 'DECIMAL')), 'totalInventory']
                    ],
                    where: doiPrevEndDateWhere,
                    raw: true
                });
                const prevEndDateInventory = parseFloat(prevEndDateInventoryResult?.totalInventory) || 0;

                const doiPrevQtySoldResult = await RbPdpOlap.findOne({
                    attributes: [
                        [sequelize.fn('SUM', sequelize.cast(sequelize.col('Qty_Sold'), 'DECIMAL')), 'totalQtySold']
                    ],
                    where: prevWhere,
                    raw: true
                });
                const prevTotalQtySold = parseFloat(doiPrevQtySoldResult?.totalQtySold) || 0;
                const prevDoi = prevTotalQtySold > 0 ? (prevEndDateInventory / prevTotalQtySold) * 30 : 0;

                kpiRows.doi[colValue] = Math.round(currentDoi);
                kpiRows.doi.trend[colValue] = Math.round(currentDoi - prevDoi);

                // === FILLRATE - Coming Soon ===
                kpiRows.fillrate[colValue] = 'Coming Soon';
                kpiRows.fillrate.trend[colValue] = 0;

                // === ASSORTMENT Calculation ===
                const assortResult = await RbPdpOlap.count({
                    distinct: true,
                    col: 'Web_Pid',
                    where: currentWhere
                });
                const assortPrevResult = await RbPdpOlap.count({
                    distinct: true,
                    col: 'Web_Pid',
                    where: prevWhere
                });

                kpiRows.assortment[colValue] = assortResult || 0;
                kpiRows.assortment.trend[colValue] = (assortResult || 0) - (assortPrevResult || 0);

                // === PSL - Placeholder ===
                kpiRows.psl[colValue] = Math.round(Math.random() * 30);  // Placeholder
                kpiRows.psl.trend[colValue] = 0;
            }

            return {
                section: "platform_kpi_matrix",
                viewMode,
                columns: ['KPI', ...columnValues],
                rows: [
                    kpiRows.osa,
                    kpiRows.doi,
                    kpiRows.fillrate,
                    kpiRows.assortment,
                    kpiRows.psl
                ],
                currentPeriod: {
                    start: currentStartDate.format('YYYY-MM-DD'),
                    end: currentEndDate.format('YYYY-MM-DD')
                },
                comparisonPeriod: {
                    start: prevStartDate.format('YYYY-MM-DD'),
                    end: prevEndDate.format('YYYY-MM-DD')
                },
                filters,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getAbsoluteOsaPlatformKpiMatrix] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};


/**
 * Get OSA Percentage Detail View data for Absolute OSA page
 * @param {Object} filters - { platform, brand, location, startDate, endDate }
 */
const getAbsoluteOsaPercentageDetail = async (filters) => {
    console.log('[getAbsoluteOsaPercentageDetail] Request received with filters:', filters);

    // Placeholder - return confirmation message
    return {
        message: "OSA Percentage Detail View section request received",
        section: "osa_percentage_detail",
        filters: filters,
        timestamp: new Date().toISOString()
    };
};

/**
 * Get Days of Inventory (DOI) data for Availability Overview
 * Formula: DOI = [[MRP * Inventory] / last 30 days Sales] * 30
 * @param {Object} filters - { platform, brand, location, startDate, endDate }
 */
const getDOI = async (filters) => {
    console.log('[getDOI] Request received with filters:', filters);

    // Generate cache key based on filters
    const cacheKey = generateCacheKey('doi_overview', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, brand, location, startDate, endDate } = filters;

            // Get end date (defaults to today) - this is "today's date" for inventory
            const currentEndDate = endDate ? dayjs(endDate) : dayjs();
            // For Qty_Sold, we need last 30 days from the end date
            const thirtyDaysAgo = currentEndDate.subtract(30, 'day');

            // Previous period for comparison (30 days before the current 30-day window)
            const prevEndDate = thirtyDaysAgo.subtract(1, 'day');
            const prevStartDate = prevEndDate.subtract(29, 'day');

            // Build base where clause with filters (without date)
            const buildBaseFilters = () => {
                const whereClause = {};
                if (platform && platform !== 'All') {
                    whereClause.Platform = platform;
                }
                if (brand && brand !== 'All') {
                    whereClause.Brand = brand;
                }
                if (location && location !== 'All') {
                    whereClause.Location = location;
                }
                return whereClause;
            };

            const baseFilters = buildBaseFilters();

            // NEW FORMULA: DOI = [sum of today's inventory / last 30 days sum of Qty_Sold] * 30

            // Step 1: Get inventory for the end date (or sum of last 7 days if end date has no data)
            // First try the exact end date
            let todayWhereClause = {
                ...baseFilters,
                DATE: currentEndDate.format('YYYY-MM-DD')
            };

            let todayInventoryResult = await RbPdpOlap.findOne({
                attributes: [
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('inventory'), 'DECIMAL')), 'totalInventory']
                ],
                where: todayWhereClause,
                raw: true
            });

            let todayInventory = parseFloat(todayInventoryResult?.totalInventory) || 0;

            // If no inventory for end date, try last 7 days average * 1 day
            if (todayInventory === 0) {
                const last7Days = currentEndDate.subtract(7, 'day');
                const last7DaysWhereClause = {
                    ...baseFilters,
                    DATE: {
                        [Op.between]: [last7Days.format('YYYY-MM-DD'), currentEndDate.format('YYYY-MM-DD')]
                    }
                };

                const last7DaysResult = await RbPdpOlap.findOne({
                    attributes: [
                        [sequelize.fn('SUM', sequelize.cast(sequelize.col('inventory'), 'DECIMAL')), 'totalInventory'],
                        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('DATE'))), 'daysCount']
                    ],
                    where: last7DaysWhereClause,
                    raw: true
                });

                const totalInv = parseFloat(last7DaysResult?.totalInventory) || 0;
                const daysCount = parseFloat(last7DaysResult?.daysCount) || 1;
                todayInventory = daysCount > 0 ? totalInv / daysCount : 0;

                console.log('[getDOI] Using last 7 days average inventory:', { totalInv, daysCount, avgInventory: todayInventory });
            }

            // Step 2: Get last 30 days Qty_Sold
            const last30DaysWhereClause = {
                ...baseFilters,
                DATE: {
                    [Op.between]: [thirtyDaysAgo.format('YYYY-MM-DD'), currentEndDate.format('YYYY-MM-DD')]
                }
            };

            const qtySoldResult = await RbPdpOlap.findOne({
                attributes: [
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('Qty_Sold'), 'DECIMAL')), 'totalQtySold']
                ],
                where: last30DaysWhereClause,
                raw: true
            });

            console.log('[getDOI] Today inventory:', todayInventory);
            console.log('[getDOI] Last 30 days Qty_Sold result:', qtySoldResult);

            // Calculate current DOI: [today's inventory / last 30 days Qty_Sold] * 30
            // todayInventory is already calculated above
            const totalQtySold = parseFloat(qtySoldResult?.totalQtySold) || 0;

            let currentDOI = 0;
            if (totalQtySold > 0) {
                currentDOI = (todayInventory / totalQtySold) * 30;
            }

            // Calculate previous period DOI for comparison
            const prevTodayWhereClause = {
                ...baseFilters,
                DATE: prevEndDate.format('YYYY-MM-DD')
            };

            const prevInventoryResult = await RbPdpOlap.findOne({
                attributes: [
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('inventory'), 'DECIMAL')), 'totalInventory']
                ],
                where: prevTodayWhereClause,
                raw: true
            });

            const prev30DaysWhereClause = {
                ...baseFilters,
                DATE: {
                    [Op.between]: [prevStartDate.format('YYYY-MM-DD'), prevEndDate.format('YYYY-MM-DD')]
                }
            };

            const prevQtySoldResult = await RbPdpOlap.findOne({
                attributes: [
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('Qty_Sold'), 'DECIMAL')), 'totalQtySold']
                ],
                where: prev30DaysWhereClause,
                raw: true
            });

            const prevInventory = parseFloat(prevInventoryResult?.totalInventory) || 0;
            const prevTotalQtySold = parseFloat(prevQtySoldResult?.totalQtySold) || 0;

            let prevDOI = 0;
            if (prevTotalQtySold > 0) {
                prevDOI = (prevInventory / prevTotalQtySold) * 30;
            }

            // Calculate change percentage
            let changePercent = 0;
            if (prevDOI > 0) {
                changePercent = ((currentDOI - prevDOI) / prevDOI) * 100;
            }

            console.log('[getDOI] Calculated DOI:', {
                todayInventory,
                totalQtySold,
                currentDOI,
                prevDOI,
                changePercent
            });

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

/**
 * Check if a location is a Metro City (Tier 1)
 * @param {string} location - location name to check
 * @returns {Promise<boolean>} true if location is Tier 1
 */
const isMetroCity = async (location) => {
    if (!location || location === 'All') return true; // All includes metro cities

    const cacheKey = generateCacheKey('is_metro_city', { location });

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const RbLocationDarkstore = (await import('../models/RbLocationDarkstore.js')).default;

            const result = await RbLocationDarkstore.findOne({
                attributes: ['tier'],
                where: {
                    location: location,
                    tier: 'Tier 1'
                },
                raw: true
            });

            return !!result;
        } catch (error) {
            console.error('[isMetroCity] Error:', error);
            return false;
        }
    }, CACHE_TTL.MEDIUM);
};

/**
 * Get list of all Metro Cities (Tier 1)
 * @returns {Promise<string[]>} array of metro city location names
 */
const getMetroCities = async () => {
    const cacheKey = generateCacheKey('metro_cities_list', {});

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const RbLocationDarkstore = (await import('../models/RbLocationDarkstore.js')).default;

            const results = await RbLocationDarkstore.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('location')), 'location']],
                where: {
                    tier: 'Tier 1'
                },
                raw: true
            });

            return results.map(r => r.location).filter(Boolean);
        } catch (error) {
            console.error('[getMetroCities] Error:', error);
            return [];
        }
    }, CACHE_TTL.LONG);
};

/**
 * Get Metro City Stock Availability
 * Same formula as Stock Availability but filtered by Tier 1 (Metro) cities
 * Stock Availability = (Sum of neno_osa / Sum of deno_osa) * 100
 * @param {Object} filters - { platform, brand, location, startDate, endDate }
 */
const getMetroCityStockAvailability = async (filters) => {
    console.log('[getMetroCityStockAvailability] Request received with filters:', filters);

    const cacheKey = generateCacheKey('metro_city_osa', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, brand, location, startDate, endDate } = filters;

            // Get list of metro cities (Tier 1)
            const metroCities = await getMetroCities();
            console.log('[getMetroCityStockAvailability] Metro cities found:', metroCities.length);

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

            // Check if user-selected location is a metro city
            let locationFilter = metroCities;
            let isUserLocationMetro = true;

            if (location && location !== 'All') {
                // Helper function to check if two strings are similar (for handling typos)
                const isSimilar = (str1, str2) => {
                    const s1 = str1.toLowerCase().trim();
                    const s2 = str2.toLowerCase().trim();

                    // Exact match
                    if (s1 === s2) return true;

                    // Substring match
                    if (s1.includes(s2) || s2.includes(s1)) return true;

                    // Check if they start with the same 3+ characters (handles Ahmedabad vs Ahemdabad)
                    if (s1.length >= 3 && s2.length >= 3) {
                        const prefix1 = s1.substring(0, 3);
                        const prefix2 = s2.substring(0, 3);
                        // If they share the same first 3 chars and are similar length
                        if (prefix1 === prefix2 && Math.abs(s1.length - s2.length) <= 2) {
                            return true;
                        }
                    }

                    // Check if only 1-2 characters are different (simple edit distance approximation)
                    if (Math.abs(s1.length - s2.length) <= 1) {
                        let differences = 0;
                        const longer = s1.length >= s2.length ? s1 : s2;
                        const shorter = s1.length < s2.length ? s1 : s2;
                        for (let i = 0; i < shorter.length && differences <= 2; i++) {
                            if (shorter[i] !== longer[i]) differences++;
                        }
                        if (differences <= 2) return true;
                    }

                    return false;
                };

                const matchedMetroCity = metroCities.find(city => isSimilar(city, location));

                isUserLocationMetro = !!matchedMetroCity;
                if (isUserLocationMetro) {
                    // Use the matched metro city name (from rb_location_darkstore) for the pdp_olap query
                    // This handles cases where user input has typos (e.g., "Ahemdabad" -> "Ahmedabad")
                    locationFilter = [matchedMetroCity];
                    console.log(`[getMetroCityStockAvailability] Matched "${location}" to metro city "${matchedMetroCity}"`);
                } else {
                    // User selected a non-metro city, return with flag
                    return {
                        section: "metro_city_osa",
                        stockAvailability: null,
                        prevStockAvailability: null,
                        change: null,
                        isMetroCity: false,
                        message: "Selected location is not a metro city",
                        filters: filters,
                        timestamp: new Date().toISOString()
                    };
                }
            }

            // Date range calculations
            const currentEndDate = endDate ? dayjs(endDate) : dayjs();
            const currentStartDate = startDate ? dayjs(startDate) : currentEndDate.subtract(30, 'day');
            const periodDays = currentEndDate.diff(currentStartDate, 'day') + 1;
            const prevEndDate = currentStartDate.subtract(1, 'day');
            const prevStartDate = prevEndDate.subtract(periodDays - 1, 'day');

            // Build base where clause
            const buildWhereClause = (start, end, locations) => {
                const whereClause = {
                    DATE: {
                        [Op.between]: [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]
                    },
                    Location: {
                        [Op.in]: locations
                    }
                };

                if (platform && platform !== 'All') {
                    whereClause.Platform = platform;
                }
                if (brand && brand !== 'All') {
                    whereClause.Brand = brand;
                }

                return whereClause;
            };

            // Query for current period
            const currentWhereClause = buildWhereClause(currentStartDate, currentEndDate, locationFilter);
            console.log('[getMetroCityStockAvailability] Current period where clause locations count:', locationFilter.length);

            const currentResult = await RbPdpOlap.findOne({
                attributes: [
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('neno_osa'), 'DECIMAL')), 'sumNenoOsa'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('deno_osa'), 'DECIMAL')), 'sumDenoOsa']
                ],
                where: currentWhereClause,
                raw: true
            });

            // Calculate current Stock Availability
            const currentNenoOsa = parseFloat(currentResult?.sumNenoOsa) || 0;
            const currentDenoOsa = parseFloat(currentResult?.sumDenoOsa) || 0;
            let currentStockAvail = 0;
            if (currentDenoOsa > 0) {
                currentStockAvail = (currentNenoOsa / currentDenoOsa) * 100;
            }

            // Query for previous period (comparison)
            const prevWhereClause = buildWhereClause(prevStartDate, prevEndDate, locationFilter);

            const prevResult = await RbPdpOlap.findOne({
                attributes: [
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('neno_osa'), 'DECIMAL')), 'sumNenoOsa'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('deno_osa'), 'DECIMAL')), 'sumDenoOsa']
                ],
                where: prevWhereClause,
                raw: true
            });

            // Calculate previous Stock Availability
            const prevNenoOsa = parseFloat(prevResult?.sumNenoOsa) || 0;
            const prevDenoOsa = parseFloat(prevResult?.sumDenoOsa) || 0;
            let prevStockAvail = 0;
            if (prevDenoOsa > 0) {
                prevStockAvail = (prevNenoOsa / prevDenoOsa) * 100;
            }

            // Calculate change
            const change = currentStockAvail - prevStockAvail;

            console.log('[getMetroCityStockAvailability] Calculated:', { currentStockAvail, prevStockAvail, change });

            return {
                section: "metro_city_osa",
                stockAvailability: parseFloat(currentStockAvail.toFixed(1)),
                prevStockAvailability: parseFloat(prevStockAvail.toFixed(1)),
                change: parseFloat(change.toFixed(1)),
                isMetroCity: isUserLocationMetro,
                metroCitiesCount: metroCities.length,
                filters: filters,
                currentPeriod: {
                    start: currentStartDate.format('YYYY-MM-DD'),
                    end: currentEndDate.format('YYYY-MM-DD')
                },
                comparisonPeriod: {
                    start: prevStartDate.format('YYYY-MM-DD'),
                    end: prevEndDate.format('YYYY-MM-DD')
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getMetroCityStockAvailability] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

/**
 * Get filter options for availability analysis filters
 * Now uses rca_sku_dim table for Platform, City, and Category filters
 * @param {Object} params - { filterType, platform, brand, category, city }
 * @returns {Object} { options: [...] }
 */
const getAvailabilityFilterOptions = async ({ filterType, platform, brand, category, city }) => {
    // Use a custom cache key that includes filterType and all cascading filters
    const cacheKey = `availability_filter:${filterType}:${(platform || 'all').toLowerCase()}:${(brand || 'all').toLowerCase()}:${(category || 'all').toLowerCase()}:${(city || 'all').toLowerCase()}`;

    return getCachedOrCompute(cacheKey, async () => {
        try {
            console.log(`[getAvailabilityFilterOptions] Fetching ${filterType} for platform=${platform}, brand=${brand}, category=${category}, city=${city}`);

            // Import RcaSkuDim model for dimension table queries
            const RcaSkuDim = (await import('../models/RcaSkuDim.js')).default;

            // Build base where clause for rca_sku_dim with cascading filters
            const buildRcaWhereClause = () => {
                const whereClause = {};
                if (platform && platform !== 'All') {
                    whereClause.platform = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('platform')),
                        platform.toLowerCase()
                    );
                }
                if (category && category !== 'All') {
                    whereClause.Category = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('Category')),
                        category.toLowerCase()
                    );
                }
                if (city && city !== 'All') {
                    whereClause.location = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('location')),
                        city.toLowerCase()
                    );
                }
                return whereClause;
            };

            // Build base where clause for rb_pdp_olap (for date/month queries)
            const buildOlapWhereClause = () => {
                const whereClause = {};
                if (platform && platform !== 'All') {
                    whereClause.Platform = platform;
                }
                if (brand && brand !== 'All') {
                    whereClause.Brand = brand;
                }
                return whereClause;
            };

            // Handle different filter types
            // PLATFORMS: Fetch from rca_sku_dim.platform
            if (filterType === 'platforms') {
                const results = await RcaSkuDim.findAll({
                    attributes: [[sequelize.fn('DISTINCT', sequelize.col('platform')), 'platform']],
                    where: { platform: { [Op.ne]: null } },
                    raw: true
                });

                const options = results
                    .map(r => r.platform)
                    .filter(p => p && p.trim())
                    .sort();

                console.log(`[getAvailabilityFilterOptions] Found ${options.length} platforms from rca_sku_dim`);
                return { options };
            }

            // CATEGORIES: Fetch from rca_sku_dim.Category with platform filter
            if (filterType === 'categories') {
                const whereClause = { Category: { [Op.ne]: null } };

                // Apply cascading filter - filter by platform if selected
                if (platform && platform !== 'All') {
                    whereClause.platform = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('platform')),
                        platform.toLowerCase()
                    );
                }

                const results = await RcaSkuDim.findAll({
                    attributes: [[sequelize.fn('DISTINCT', sequelize.col('Category')), 'category']],
                    where: whereClause,
                    raw: true
                });

                const options = results
                    .map(r => r.category)
                    .filter(c => c && c.trim())
                    .sort();

                console.log(`[getAvailabilityFilterOptions] Found ${options.length} categories from rca_sku_dim`);
                return { options };
            }

            // CITIES: Fetch from rca_sku_dim.location with platform and category filters
            if (filterType === 'cities') {
                const whereClause = { location: { [Op.ne]: null } };

                // Apply cascading filters
                if (platform && platform !== 'All') {
                    whereClause.platform = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('platform')),
                        platform.toLowerCase()
                    );
                }
                if (category && category !== 'All') {
                    whereClause.Category = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('Category')),
                        category.toLowerCase()
                    );
                }

                const results = await RcaSkuDim.findAll({
                    attributes: [[sequelize.fn('DISTINCT', sequelize.col('location')), 'city']],
                    where: whereClause,
                    raw: true
                });

                const options = results
                    .map(r => r.city)
                    .filter(c => c && c.trim())
                    .sort();

                console.log(`[getAvailabilityFilterOptions] Found ${options.length} cities from rca_sku_dim`);
                return { options };
            }

            // BRANDS: Fetch from rca_sku_dim.brand_name with platform and category filters
            // For Availability Analysis, show ALL brands (including competitors)
            if (filterType === 'brands') {
                const whereClause = {
                    brand_name: { [Op.ne]: null }
                    // No comp_flag filter - show all brands for availability analysis
                };

                // Apply cascading filters
                if (platform && platform !== 'All') {
                    whereClause.platform = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('platform')),
                        platform.toLowerCase()
                    );
                }
                if (category && category !== 'All') {
                    whereClause.Category = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('Category')),
                        category.toLowerCase()
                    );
                }
                if (city && city !== 'All') {
                    whereClause.location = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('location')),
                        city.toLowerCase()
                    );
                }

                const results = await RcaSkuDim.findAll({
                    attributes: [[sequelize.fn('DISTINCT', sequelize.col('brand_name')), 'brand']],
                    where: whereClause,
                    raw: true
                });

                const options = results
                    .map(r => r.brand)
                    .filter(b => b && b.trim())
                    .sort();

                console.log(`[getAvailabilityFilterOptions] Found ${options.length} brands from rca_sku_dim`);
                return { options };
            }

            // LOCATIONS: Alias for cities (same functionality)
            // For Availability Analysis, show ALL locations
            if (filterType === 'locations') {
                const whereClause = {
                    location: { [Op.ne]: null }
                    // No comp_flag filter - show all locations for availability analysis
                };

                // Apply cascading filters
                if (platform && platform !== 'All') {
                    whereClause.platform = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('platform')),
                        platform.toLowerCase()
                    );
                }
                if (category && category !== 'All') {
                    whereClause.Category = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('Category')),
                        category.toLowerCase()
                    );
                }
                if (brand && brand !== 'All') {
                    whereClause.brand_name = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('brand_name')),
                        brand.toLowerCase()
                    );
                }

                const results = await RcaSkuDim.findAll({
                    attributes: [[sequelize.fn('DISTINCT', sequelize.col('location')), 'location']],
                    where: whereClause,
                    raw: true
                });

                const options = results
                    .map(r => r.location)
                    .filter(l => l && l.trim())
                    .sort();

                console.log(`[getAvailabilityFilterOptions] Found ${options.length} locations from rca_sku_dim`);
                return { options };
            }

            // MONTHS: Keep from rb_pdp_olap.DATE (not available in rca_sku_dim)
            if (filterType === 'months') {
                const whereClause = buildOlapWhereClause();

                const results = await RbPdpOlap.findAll({
                    attributes: [
                        [sequelize.fn('DISTINCT', sequelize.fn('DATE_FORMAT', sequelize.col('DATE'), '%Y-%m')), 'month']
                    ],
                    where: whereClause,
                    raw: true,
                    order: [[sequelize.fn('DATE_FORMAT', sequelize.col('DATE'), '%Y-%m'), 'DESC']]
                });

                const options = results
                    .map(r => r.month)
                    .filter(m => m && m.trim());

                console.log(`[getAvailabilityFilterOptions] Found ${options.length} months from rb_pdp_olap`);
                return { options };
            }

            // DATES: Keep from rb_pdp_olap.DATE (not available in rca_sku_dim)
            if (filterType === 'dates') {
                const whereClause = buildOlapWhereClause();

                const results = await RbPdpOlap.findAll({
                    attributes: [
                        [sequelize.fn('DISTINCT', sequelize.fn('DATE_FORMAT', sequelize.col('DATE'), '%Y-%m-%d')), 'date']
                    ],
                    where: whereClause,
                    raw: true,
                    order: [[sequelize.fn('DATE_FORMAT', sequelize.col('DATE'), '%Y-%m-%d'), 'DESC']],
                    limit: 365 // Limit to last year of dates
                });

                const options = results
                    .map(r => r.date)
                    .filter(d => d && d.trim());

                console.log(`[getAvailabilityFilterOptions] Found ${options.length} dates from rb_pdp_olap`);
                return { options };
            }

            // PRODUCTS: Keep from rb_pdp_olap with platform/brand filters
            if (filterType === 'products') {
                const whereClause = buildOlapWhereClause();

                const results = await RbPdpOlap.findAll({
                    attributes: [[sequelize.fn('DISTINCT', sequelize.col('Product')), 'product']],
                    where: whereClause,
                    raw: true,
                    limit: 100 // Limit to prevent too many results
                });

                const options = results
                    .map(r => r.product)
                    .filter(p => p && p.trim())
                    .sort();

                return { options };
            }

            // ZONES: Get unique regions from rb_location_darkstore
            if (filterType === 'zones') {
                const RbLocationDarkstore = (await import('../models/RbLocationDarkstore.js')).default;

                const results = await RbLocationDarkstore.findAll({
                    attributes: [[sequelize.fn('DISTINCT', sequelize.col('region')), 'zone']],
                    where: {},
                    raw: true
                });

                const options = results
                    .map(r => r.zone)
                    .filter(z => z && z.trim())
                    .sort();

                return { options };
            }

            // METRO FLAGS: Get unique tiers from rb_location_darkstore
            if (filterType === 'metroFlags') {
                const RbLocationDarkstore = (await import('../models/RbLocationDarkstore.js')).default;

                const results = await RbLocationDarkstore.findAll({
                    attributes: [[sequelize.fn('DISTINCT', sequelize.col('tier')), 'tier']],
                    where: {},
                    raw: true
                });

                const options = results
                    .map(r => r.tier)
                    .filter(t => t && t.trim())
                    .sort();

                return { options };
            }

            // Return empty for unknown filter types
            return { options: [] };

        } catch (error) {
            console.error(`[getAvailabilityFilterOptions] Error fetching ${filterType}:`, error);
            return { options: [] };
        }
    }, CACHE_TTL.MEDIUM);
};

/**
 * Get OSA Detail by Category for the OSA Detail View table
 * Returns categories with daily OSA % for last 31 days
 * @param {Object} filters - { platform, brand, location, startDate, endDate }
 */
const getOsaDetailByCategory = async (filters) => {
    console.log('[getOsaDetailByCategory] Request received with filters:', filters);

    const cacheKey = generateCacheKey('osa_detail_by_category', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, brand, location, startDate, endDate, dates, months, cities, categories } = filters;

            // Determine date range based on filters
            let dateFilter;
            let datesToUse = [];

            if (dates && dates.length > 0) {
                // If specific dates are selected, use those
                dateFilter = { [Op.in]: dates };
                datesToUse = [...dates].sort();
            } else if (months && months.length > 0) {
                // If months are selected, filter by those months (format: 'YYYY-MM' or 'MMM YYYY')
                // We'll need to handle this in the query
                const currentEndDate = endDate ? dayjs(endDate) : dayjs();
                const currentStartDate = startDate ? dayjs(startDate) : currentEndDate.subtract(30, 'day');
                dateFilter = {
                    [Op.between]: [
                        currentStartDate.toDate(),
                        currentEndDate.toDate()
                    ]
                };
                // Generate date array for response
                for (let i = 30; i >= 0; i--) {
                    datesToUse.push(currentEndDate.subtract(i, 'day').format('YYYY-MM-DD'));
                }
            } else {
                // Default: last 31 days
                const currentEndDate = endDate ? dayjs(endDate) : dayjs();
                const currentStartDate = startDate ? dayjs(startDate) : currentEndDate.subtract(30, 'day');
                dateFilter = {
                    [Op.between]: [
                        currentStartDate.toDate(),
                        currentEndDate.toDate()
                    ]
                };
                // Generate date array for response
                for (let i = 30; i >= 0; i--) {
                    datesToUse.push(currentEndDate.subtract(i, 'day').format('YYYY-MM-DD'));
                }
            }

            // Build base where clause for rb_pdp_olap query
            const whereClause = {
                DATE: dateFilter,
                Category: { [Op.ne]: null },
                deno_osa: { [Op.gt]: 0 }  // Only rows with actual data
            };

            // Platform filter
            if (platform && platform !== 'All') {
                whereClause.Platform = platform;
            }

            // Brand filter
            if (brand && brand !== 'All') {
                whereClause.Brand = brand;
            }

            // Location filter - support both single location and array of cities
            if (cities && cities.length > 0) {
                // Convert city IDs back to labels (they're lowercase with underscores)
                const cityLabels = cities.map(c => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
                whereClause.Location = { [Op.in]: cityLabels };
            } else if (location && location !== 'All') {
                whereClause.Location = location;
            }

            // Category filter
            if (categories && categories.length > 0) {
                // Convert category IDs back to labels
                const categoryLabels = categories.map(c => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
                whereClause.Category = {
                    [Op.and]: [
                        { [Op.ne]: null },
                        { [Op.in]: categoryLabels }
                    ]
                };
            }

            // Fetch all OSA data grouped by Category and Date at once
            const results = await RbPdpOlap.findAll({
                attributes: [
                    'Category',
                    [sequelize.fn('DATE', sequelize.col('DATE')), 'formattedDate'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('neno_osa'), 'DECIMAL')), 'sumNeno'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('deno_osa'), 'DECIMAL')), 'sumDeno']
                ],
                where: whereClause,
                group: ['Category', sequelize.fn('DATE', sequelize.col('DATE'))],
                raw: true
            });

            console.log(`[getOsaDetailByCategory] Found ${results.length} category-date combinations`);

            // Group results by category
            const categoryMap = new Map();

            for (const row of results) {
                const category = row.Category;
                const formattedDate = row.formattedDate;
                const sumNeno = parseFloat(row.sumNeno) || 0;
                const sumDeno = parseFloat(row.sumDeno) || 0;

                const osaPercent = sumDeno > 0 ? Math.round((sumNeno / sumDeno) * 100) : 0;

                if (!categoryMap.has(category)) {
                    categoryMap.set(category, new Map());
                }

                categoryMap.get(category).set(formattedDate, osaPercent);
            }

            console.log(`[getOsaDetailByCategory] Processing ${categoryMap.size} categories`);

            // Build category data array
            const categoryData = [];

            for (const [category, dateMap] of categoryMap.entries()) {
                // Build values array for all selected dates
                const values = datesToUse.map(date => {
                    return dateMap.get(date) || 0;
                });

                // Calculate average (based on valid values)
                const validValues = values.filter(v => v > 0);
                const avg31 = validValues.length > 0
                    ? Math.round(validValues.reduce((a, b) => a + b, 0) / validValues.length)
                    : 0;

                // Determine status based on average
                let status = 'Action';
                if (avg31 >= 85) {
                    status = 'Healthy';
                } else if (avg31 >= 70) {
                    status = 'Watch';
                }

                categoryData.push({
                    name: category,
                    sku: category.toLowerCase().replace(/\s+/g, '_'),
                    values: values,
                    avg31: avg31,
                    status: status
                });
            }

            // Sort by avg31 descending
            categoryData.sort((a, b) => b.avg31 - a.avg31);

            // Build date range for response
            const sortedDates = [...datesToUse].sort();
            const dateRangeStart = sortedDates[0] || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
            const dateRangeEnd = sortedDates[sortedDates.length - 1] || dayjs().format('YYYY-MM-DD');

            return {
                categories: categoryData,
                dateRange: {
                    start: dateRangeStart,
                    end: dateRangeEnd
                },
                dates: datesToUse,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getOsaDetailByCategory] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

/**
 * Get Availability KPI Trends for Trends/Competition Drawer
 * Returns time-series data for OSA, DOI, Fillrate, Assortment
 * @param {Object} filters - { platform, brand, location, category, period, timeStep, startDate, endDate }
 */
const getAvailabilityKpiTrends = async (filters) => {
    console.log('[getAvailabilityKpiTrends] Request received with filters:', filters);

    const cacheKey = generateCacheKey('availability_kpi_trends', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, brand, location, category, period, timeStep, startDate: customStart, endDate: customEnd } = filters;

            // 1. Determine Date Range
            let endDate = dayjs();
            let startDate = dayjs();

            if (period === 'Custom' && customStart && customEnd) {
                startDate = dayjs(customStart);
                endDate = dayjs(customEnd);
            } else {
                switch (period) {
                    case '1M': startDate = startDate.subtract(1, 'month'); break;
                    case '3M': startDate = startDate.subtract(3, 'month'); break;
                    case '6M': startDate = startDate.subtract(6, 'month'); break;
                    case '1Y': startDate = startDate.subtract(1, 'year'); break;
                    default: startDate = startDate.subtract(1, 'month'); // Default 1M
                }
            }

            console.log(`[getAvailabilityKpiTrends] Date range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);

            // 2. Determine Grouping based on timeStep
            let groupCol;
            let dateFormat;

            if (timeStep === 'Monthly') {
                groupCol = sequelize.fn('DATE_FORMAT', sequelize.col('DATE'), '%Y-%m-01');
                dateFormat = 'MMM\'YY';
            } else if (timeStep === 'Weekly') {
                groupCol = sequelize.fn('YEARWEEK', sequelize.col('DATE'), 1);
                dateFormat = 'DD MMM\'YY'; // Include year for consistent parsing
            } else { // Daily
                groupCol = sequelize.fn('DATE', sequelize.col('DATE'));
                dateFormat = 'DD MMM\'YY';
            }

            // 3. Build base where clause
            const whereClause = {
                DATE: {
                    [Op.between]: [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
                }
            };

            if (platform && platform !== 'All') {
                whereClause.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase());
            }
            if (brand && brand !== 'All') {
                whereClause.Brand = { [Op.like]: `%${brand}%` };
            }
            if (location && location !== 'All') {
                whereClause.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
            }
            if (category && category !== 'All') {
                whereClause.Category = category;
            }

            // 4. Query for OSA, DOI, Assortment
            const kpiResults = await RbPdpOlap.findAll({
                attributes: [
                    [groupCol, 'date_group'],
                    [sequelize.fn('MAX', sequelize.col('DATE')), 'ref_date'],
                    // For OSA
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('neno_osa'), 'DECIMAL')), 'total_neno_osa'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('deno_osa'), 'DECIMAL')), 'total_deno_osa'],
                    // For DOI
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('inventory'), 'DECIMAL')), 'total_inventory'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('Qty_Sold'), 'DECIMAL')), 'total_qty_sold'],
                    // For Assortment
                    [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('Web_Pid'))), 'assortment_count']
                ],
                where: whereClause,
                group: [groupCol],
                order: [[sequelize.col('ref_date'), 'ASC']],
                raw: true
            });

            console.log(`[getAvailabilityKpiTrends] Query returned ${kpiResults.length} data points`);

            // 5. Transform results into trend points
            const trendPoints = kpiResults.map(row => {
                const refDate = dayjs(row.ref_date);
                const label = refDate.format(dateFormat);

                // Calculate OSA: (neno_osa / deno_osa) * 100
                const nenoOsa = parseFloat(row.total_neno_osa) || 0;
                const denoOsa = parseFloat(row.total_deno_osa) || 0;
                const osa = denoOsa > 0 ? Math.round((nenoOsa / denoOsa) * 100) : 0;

                // Calculate DOI: (inventory / Qty_Sold) * 30
                const inventory = parseFloat(row.total_inventory) || 0;
                const qtySold = parseFloat(row.total_qty_sold) || 0;
                const doi = qtySold > 0 ? Math.round((inventory / qtySold) * 30) : 0;

                // Assortment: distinct count of Web_Pid
                const assortment = parseInt(row.assortment_count, 10) || 0;

                // Fillrate: placeholder (Coming Soon)
                const fillrate = 0;

                return {
                    date: label,
                    Osa: osa,
                    Doi: doi,
                    Fillrate: fillrate,
                    Assortment: assortment
                };
            });

            // 6. Build response with metrics config
            return {
                context: {
                    level: 'Platform',
                    audience: platform || 'All'
                },
                rangeOptions: ['Custom', '1M', '3M', '6M', '1Y'],
                defaultRange: period || '1M',
                timeSteps: ['Daily', 'Weekly', 'Monthly'],
                defaultTimeStep: timeStep || 'Daily',
                metrics: [
                    { id: 'Osa', label: 'OSA', color: '#F97316', axis: 'left', default: true },
                    { id: 'Doi', label: 'DOI', color: '#7C3AED', axis: 'right', default: true },
                    { id: 'Fillrate', label: 'Fillrate', color: '#6366F1', axis: 'left', default: false },
                    { id: 'Assortment', label: 'Assortment', color: '#22C55E', axis: 'left', default: false }
                ],
                points: trendPoints,
                dateRange: {
                    start: startDate.format('YYYY-MM-DD'),
                    end: endDate.format('YYYY-MM-DD')
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getAvailabilityKpiTrends] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

/**
 * Get Availability Competition Data
 * Returns top brands with OSA, DOI, and Assortment metrics
 * @param {Object} filters - { platform, location, category, brand, period }
 */
const getAvailabilityCompetitionData = async (filters = {}) => {
    console.log('[getAvailabilityCompetitionData] Request with filters:', filters);

    const cacheKey = generateCacheKey('availability_competition_data', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform = 'All', location = 'All', category = 'All', brand = 'All', period = '1M' } = filters;

            // Calculate date range based on period
            const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
            const days = periodDays[period] || 30;

            const endDate = dayjs();
            const startDate = endDate.clone().subtract(days, 'days');

            // Build where clause for current period
            const whereClause = {
                DATE: { [Op.between]: [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')] }
            };

            if (platform && platform !== 'All') {
                whereClause.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase());
            }
            if (location && location !== 'All' && location !== 'All India') {
                whereClause.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
            }
            if (category && category !== 'All') {
                whereClause.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());
            }
            if (brand && brand !== 'All') {
                const brandList = brand.split(',').map(b => b.trim().toLowerCase());
                if (brandList.length === 1) {
                    whereClause.Brand = sequelize.where(sequelize.fn('LOWER', sequelize.col('Brand')), brandList[0]);
                } else {
                    whereClause.Brand = {
                        [Op.and]: [
                            sequelize.where(
                                sequelize.fn('LOWER', sequelize.col('Brand')),
                                { [Op.in]: brandList }
                            )
                        ]
                    };
                }
            }

            // Only include our brands (Comp_flag = 0)
            whereClause.Comp_flag = 0;

            // 1. Get all brands with aggregated metrics
            const currentBrands = await RbPdpOlap.findAll({
                attributes: [
                    'Brand',
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('neno_osa'), 'DECIMAL')), 'total_neno_osa'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('deno_osa'), 'DECIMAL')), 'total_deno_osa'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('inventory'), 'DECIMAL')), 'total_inventory'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('Qty_Sold'), 'DECIMAL')), 'total_qty_sold'],
                    [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('Web_Pid'))), 'assortment_count']
                ],
                where: whereClause,
                group: ['Brand'],
                having: sequelize.where(sequelize.fn('SUM', sequelize.col('deno_osa')), { [Op.gt]: 0 }),
                raw: true
            });

            console.log(`[getAvailabilityCompetitionData] Found ${currentBrands.length} brands`);

            // 2. Calculate metrics for each brand
            const brandMetrics = currentBrands.map(brand => {
                const nenoOsa = parseFloat(brand.total_neno_osa) || 0;
                const denoOsa = parseFloat(brand.total_deno_osa) || 0;
                const inventory = parseFloat(brand.total_inventory) || 0;
                const qtySold = parseFloat(brand.total_qty_sold) || 0;
                const assortment = parseInt(brand.assortment_count, 10) || 0;

                // Calculate OSA
                const osa = denoOsa > 0 ? (nenoOsa / denoOsa) * 100 : 0;

                // Calculate DOI
                const doi = qtySold > 0 ? (inventory / qtySold) * 30 : 0;

                // Fillrate is placeholder
                const fillrate = 0;

                return {
                    brand: brand.Brand,
                    Osa: { value: parseFloat(osa.toFixed(1)), delta: 0 },
                    Doi: { value: parseFloat(doi.toFixed(1)), delta: 0 },
                    Fillrate: { value: fillrate, delta: 0 },
                    Assortment: { value: assortment, delta: 0 }
                };
            });

            // 3. Sort by OSA descending and limit to top 10
            brandMetrics.sort((a, b) => b.Osa.value - a.Osa.value);
            const topBrands = brandMetrics.slice(0, 10);

            console.log(`[getAvailabilityCompetitionData] Returning ${topBrands.length} brands`);

            // 4. Get SKU data similarly
            const currentSkus = await RbPdpOlap.findAll({
                attributes: [
                    'Product',
                    'Brand',
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('neno_osa'), 'DECIMAL')), 'total_neno_osa'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('deno_osa'), 'DECIMAL')), 'total_deno_osa'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('inventory'), 'DECIMAL')), 'total_inventory'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('Qty_Sold'), 'DECIMAL')), 'total_qty_sold']
                ],
                where: whereClause,
                group: ['Product', 'Brand'],
                having: sequelize.where(sequelize.fn('SUM', sequelize.col('deno_osa')), { [Op.gt]: 0 }),
                raw: true
            });

            const skuMetrics = currentSkus.map(sku => {
                const nenoOsa = parseFloat(sku.total_neno_osa) || 0;
                const denoOsa = parseFloat(sku.total_deno_osa) || 0;
                const inventory = parseFloat(sku.total_inventory) || 0;
                const qtySold = parseFloat(sku.total_qty_sold) || 0;

                const osa = denoOsa > 0 ? (nenoOsa / denoOsa) * 100 : 0;
                const doi = qtySold > 0 ? (inventory / qtySold) * 30 : 0;

                return {
                    brand: sku.Product,
                    brand_parent: sku.Brand,
                    Osa: { value: parseFloat(osa.toFixed(1)), delta: 0 },
                    Doi: { value: parseFloat(doi.toFixed(1)), delta: 0 },
                    Fillrate: { value: 0, delta: 0 },
                    Assortment: { value: 0, delta: 0 }
                };
            });

            skuMetrics.sort((a, b) => b.Osa.value - a.Osa.value);
            const topSkus = skuMetrics.slice(0, 10);

            return {
                brands: topBrands,
                skus: topSkus,
                metadata: { period, platform, location, category, totalBrands: brandMetrics.length }
            };
        } catch (error) {
            console.error('[getAvailabilityCompetitionData] Error:', error);
            return { brands: [], skus: [], metadata: { error: error.message } };
        }
    }, CACHE_TTL.SHORT);
};

/**
 * Get Availability Competition Filter Options
 * Returns cascading filter options from rca_sku_dim
 */
const getAvailabilityCompetitionFilterOptions = async (filters = {}) => {
    console.log('[getAvailabilityCompetitionFilterOptions] Request with filters:', filters);

    try {
        const { location = null, category = null, brand = null } = filters;

        // Fetch distinct locations
        const locationResults = await RcaSkuDim.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('location')), 'location']],
            where: { location: { [Op.ne]: null } },
            order: [['location', 'ASC']],
            raw: true
        });

        // Fetch distinct categories filtered by location
        const categoryWhere = { Category: { [Op.ne]: null } };
        if (location && location !== 'All' && location !== 'All India') {
            categoryWhere.location = sequelize.where(
                sequelize.fn('LOWER', sequelize.col('location')),
                location.toLowerCase()
            );
        }

        const categoryResults = await RcaSkuDim.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Category')), 'category']],
            where: categoryWhere,
            order: [['Category', 'ASC']],
            raw: true
        });

        // Fetch distinct brands filtered by location + category
        const brandWhere = { brand_name: { [Op.ne]: null } };
        if (location && location !== 'All' && location !== 'All India') {
            brandWhere.location = sequelize.where(
                sequelize.fn('LOWER', sequelize.col('location')),
                location.toLowerCase()
            );
        }
        if (category && category !== 'All') {
            brandWhere.Category = sequelize.where(
                sequelize.fn('LOWER', sequelize.col('Category')),
                category.toLowerCase()
            );
        }

        const brandResults = await RcaSkuDim.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('brand_name')), 'brand']],
            where: brandWhere,
            order: [['brand_name', 'ASC']],
            raw: true
        });

        // Fetch distinct SKUs from rb_pdp_olap filtered by location + category + brand
        const skuWhere = { Product: { [Op.ne]: null } };
        if (location && location !== 'All' && location !== 'All India') {
            skuWhere.Location = sequelize.where(
                sequelize.fn('LOWER', sequelize.col('Location')),
                location.toLowerCase()
            );
        }
        if (category && category !== 'All') {
            skuWhere.Category = sequelize.where(
                sequelize.fn('LOWER', sequelize.col('Category')),
                category.toLowerCase()
            );
        }
        if (brand && brand !== 'All') {
            skuWhere.Brand = sequelize.where(
                sequelize.fn('LOWER', sequelize.col('Brand')),
                brand.toLowerCase()
            );
        }

        const skuResults = await RbPdpOlap.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Product')), 'sku']],
            where: skuWhere,
            order: [['Product', 'ASC']],
            raw: true
        });

        const locations = locationResults.map(l => l.location).filter(Boolean);
        const categories = categoryResults.map(c => c.category).filter(Boolean);
        const brands = brandResults.map(b => b.brand).filter(Boolean);
        const skus = skuResults.map(s => s.sku).filter(Boolean);

        console.log(`[getAvailabilityCompetitionFilterOptions] Found ${locations.length} locations, ${categories.length} categories, ${brands.length} brands, ${skus.length} SKUs`);

        return {
            locations: ['All India', ...locations],
            categories: ['All', ...categories],
            brands: ['All', ...brands],
            skus: ['All', ...skus]
        };
    } catch (error) {
        console.error('[getAvailabilityCompetitionFilterOptions] Error:', error);
        return { locations: ['All India'], categories: ['All'], brands: ['All'], skus: ['All'] };
    }
};

/**
 * Get Availability Competition Brand Trends
 * Returns time-series data for comparing multiple brands
 */
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

            // Calculate date range
            const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
            const days = periodDays[period] || 30;

            const endDate = dayjs();
            const startDate = endDate.clone().subtract(days, 'days');

            // Use daily grouping
            const groupCol = sequelize.fn('DATE', sequelize.col('DATE'));
            const dateFormat = 'DD MMM\'YY';

            // Build base where clause
            const whereClause = {
                DATE: { [Op.between]: [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')] },
                Brand: { [Op.in]: brandList }
            };

            if (location && location !== 'All') {
                whereClause.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
            }
            if (category && category !== 'All') {
                whereClause.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());
            }

            // Query for each brand's KPIs over time
            const results = await RbPdpOlap.findAll({
                attributes: [
                    'Brand',
                    [groupCol, 'date_group'],
                    [sequelize.fn('MAX', sequelize.col('DATE')), 'ref_date'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('neno_osa'), 'DECIMAL')), 'total_neno_osa'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('deno_osa'), 'DECIMAL')), 'total_deno_osa'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('inventory'), 'DECIMAL')), 'total_inventory'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('Qty_Sold'), 'DECIMAL')), 'total_qty_sold'],
                    [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('Web_Pid'))), 'assortment_count']
                ],
                where: whereClause,
                group: ['Brand', groupCol],
                order: [[sequelize.col('ref_date'), 'ASC']],
                raw: true
            });

            console.log(`[getAvailabilityCompetitionBrandTrends] Query returned ${results.length} data points for ${brandList.length} brands`);

            // Transform results into time series per brand
            const brandTrends = {};

            results.forEach(row => {
                const brandName = row.Brand;
                if (!brandTrends[brandName]) {
                    brandTrends[brandName] = [];
                }

                const refDate = dayjs(row.ref_date);
                const nenoOsa = parseFloat(row.total_neno_osa) || 0;
                const denoOsa = parseFloat(row.total_deno_osa) || 0;
                const inventory = parseFloat(row.total_inventory) || 0;
                const qtySold = parseFloat(row.total_qty_sold) || 0;
                const assortment = parseInt(row.assortment_count, 10) || 0;

                const osa = denoOsa > 0 ? (nenoOsa / denoOsa) * 100 : 0;
                const doi = qtySold > 0 ? (inventory / qtySold) * 30 : 0;

                brandTrends[brandName].push({
                    date: refDate.format(dateFormat),
                    Osa: parseFloat(osa.toFixed(1)),
                    Doi: parseFloat(doi.toFixed(1)),
                    Fillrate: 0,
                    Assortment: assortment
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

