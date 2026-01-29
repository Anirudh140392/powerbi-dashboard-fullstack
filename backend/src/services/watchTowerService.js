import TbZeptoBrandSalesAnalytics from '../models/TbZeptoBrandSalesAnalytics.js';
import TbZeptoInventoryData from '../models/TbZeptoInventoryData.js';
import TbBlinkitSalesData from '../models/TbBlinkitSalesData.js';
import RbPdpOlap from '../models/RbPdpOlap.js';

import RbKw from '../models/RbKw.js';
import RbBrandMs from '../models/RbBrandMs.js';
import ZeptoMarketShare from '../models/ZeptoMarketShare.js'; // Keeping for reference if needed, but primary is now RbBrandMs
import RcaSkuDim from '../models/RcaSkuDim.js';
import { Op, Sequelize } from 'sequelize';
import sequelize from '../config/db.js';
import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import weekOfYear from 'dayjs/plugin/weekOfYear.js';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);

// Import cache helpers
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

// Import Redis data layer for indexed platform data caching
import { ensurePlatformData, queryByFilters, aggregateMetrics, getPlatformStats, isPlatformDataLoaded, getCachedSOSData, cacheSOSData, getCachedMonthlyKPIs, cacheMonthlyKPIs, coalesceRequest, getCachedPlatformMetrics, cachePlatformMetrics, getBrandMonthlyData } from './redisDataService.js';

/**
 * Global utility to format large unit counts (Offtakes units, Inorg units)
 */
const formatUnits = (val) => {
    const v = parseFloat(val);
    if (isNaN(v)) return "0";
    if (v >= 10000000) return `${(v / 10000000).toFixed(2)} Cr`;
    if (v >= 1000000) return `${(v / 1000000).toFixed(2)} M`;
    if (v >= 100000) return `${(v / 100000).toFixed(2)} L`;
    if (v >= 1000) return `${(v / 1000).toFixed(2)} K`;
    return Math.round(v).toLocaleString('en-IN');
};

// =====================================================
// IN-MEMORY CACHE FOR DISTINCT VALUES
// Reduces redundant database queries for lookup data
// =====================================================
const DISTINCT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const distinctValuesCache = {
    platforms: { data: null, timestamp: 0 },
    brands: new Map(), // key: platform, value: { data, timestamp }
    categories: new Map(), // key: platform, value: { data, timestamp }
    locations: new Map(), // key: platform, value: { data, timestamp }
    ourBrands: { data: null, timestamp: 0 }, // Global cache for our brands (Comp_flag=0)
};

/**
 * Get cached our brands list (Comp_flag=0) - Global module-level cache
 */
const getGlobalOurBrandsList = async () => {
    const cache = distinctValuesCache.ourBrands;
    if (cache.data && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        return cache.data;
    }

    try {
        // ClickHouse query
        const query = `SELECT DISTINCT Brand as brand FROM rb_pdp_olap WHERE toString(Comp_flag) = '0' AND Brand IS NOT NULL AND Brand != '' ORDER BY brand`;
        const results = await queryClickHouse(query);
        const result = results.map(b => b.brand).filter(b => b);
        distinctValuesCache.ourBrands = { data: result, timestamp: Date.now() };
        console.log(`[Global] Cached ${result.length} OUR brands (Comp_flag=0)`);
        return result;
    } catch (error) {
        console.error('Error fetching our brands list:', error);
        return [];
    }
};

// =====================================================
// DYNAMIC END DATE HELPER
// Gets the latest date available in the primary table
// =====================================================
let cachedMaxDate = { date: null, timestamp: 0 };
const MAX_DATE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the latest available date in rb_pdp_olap
 */
const getCachedMaxDate = async () => {
    if (cachedMaxDate.date && (Date.now() - cachedMaxDate.timestamp) < MAX_DATE_TTL) {
        return cachedMaxDate.date;
    }

    try {
        const result = await queryClickHouse(`SELECT MAX(toDate(DATE)) as maxDate FROM rb_pdp_olap`);
        const maxDateStr = result?.[0]?.maxDate;
        const maxDate = maxDateStr ? dayjs(maxDateStr).endOf('day') : dayjs().endOf('day');

        cachedMaxDate = { date: maxDate, timestamp: Date.now() };
        console.log(`🎯 [MaxDate] Latest available date detected and cached: ${maxDate.format('YYYY-MM-DD')}`);
        return maxDate;
    } catch (error) {
        console.error('Error fetching max date:', error);
        return dayjs().endOf('day'); // Fallback to today
    }
};

// Cache for RcaSkuDim valid brand names (comp_flag=0)
let cachedValidBrandNames = { data: null, timestamp: 0 };

/**
 * Get cached valid brand names from RcaSkuDim (comp_flag=0)
 * Used across multiple functions to avoid redundant DB queries
 */
const getCachedValidBrandNames = async () => {
    if (cachedValidBrandNames.data && (Date.now() - cachedValidBrandNames.timestamp) < DISTINCT_CACHE_TTL) {
        return cachedValidBrandNames.data;
    }

    try {
        // ClickHouse query
        const query = `SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL AND brand_name != '' ORDER BY brand_name`;
        const results = await queryClickHouse(query);
        const result = results.map(b => b.brand_name).filter(Boolean);
        cachedValidBrandNames = { data: result, timestamp: Date.now() };
        console.log(`⚡ [Cache] Cached ${result.length} valid brand names from RcaSkuDim`);
        return result;
    } catch (error) {
        console.error('Error fetching valid brand names:', error);
        return [];
    }
};

// =====================================================
// MULTI-VALUE FILTER UTILITIES
// Handle single values, arrays, and "All" selections
// =====================================================

/**
 * Normalize a filter value to an array or null
 * @param {string|string[]|undefined} value - The filter value
 * @returns {string[]|null} - Array of values, or null if "All" or empty
 */
const normalizeFilterArray = (value) => {
    // Handle undefined, null, empty string
    if (!value) return null;

    // Handle "All" string or array containing "All"
    if (value === 'All') return null;
    if (Array.isArray(value) && (value.length === 0 || value.includes('All'))) return null;

    // Convert string to array if needed
    return Array.isArray(value) ? value : [value];
};

/**
 * Build a where condition for a field with multi-value support
 * @param {string[]|null} values - Normalized array of values
 * @returns {object|null} - Sequelize where condition or null
 */
const buildMultiValueCondition = (values) => {
    if (!values || values.length === 0) return null;
    return values.length === 1 ? values[0] : { [Op.in]: values };
};

/**
 * Build a LIKE condition for Brand field with multi-value support
 * @param {string[]|null} values - Normalized array of values  
 * @returns {object|null} - Sequelize where condition with LIKE
 */
const buildBrandLikeCondition = (values) => {
    if (!values || values.length === 0) return null;
    if (values.length === 1) {
        return { [Op.like]: `%${values[0]}%` };
    }
    // Multiple brands: use OR with LIKE for each
    return { [Op.or]: values.map(v => ({ [Op.like]: `%${v}%` })) };
};

/**
 * Get cached distinct platforms or fetch from DB
 */
const getCachedDistinctPlatforms = async () => {
    const cache = distinctValuesCache.platforms;
    if (cache.data && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        console.log('⚡ [Cache Hit] Distinct platforms from memory');
        return cache.data;
    }
    return null; // Cache miss
};

/**
 * Cache distinct platforms
 */
const cacheDistinctPlatforms = (data) => {
    distinctValuesCache.platforms = { data, timestamp: Date.now() };
    console.log(`📦 [Cache Set] Distinct platforms (${data.length} items)`);
};

/**
 * Get cached distinct brands for a platform
 */
const getCachedDistinctBrands = (platform) => {
    const key = (platform || 'all').toLowerCase();
    const cache = distinctValuesCache.brands.get(key);
    if (cache && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        console.log(`⚡ [Cache Hit] Distinct brands for ${platform}`);
        return cache.data;
    }
    return null;
};

/**
 * Cache distinct brands for a platform
 */
const cacheDistinctBrands = (platform, data) => {
    const key = (platform || 'all').toLowerCase();
    distinctValuesCache.brands.set(key, { data, timestamp: Date.now() });
    console.log(`📦 [Cache Set] Distinct brands for ${platform} (${data.length} items)`);
};

/**
 * Get cached distinct categories for a platform
 */
const getCachedDistinctCategories = (platform) => {
    const key = (platform || 'all').toLowerCase();
    const cache = distinctValuesCache.categories.get(key);
    if (cache && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        console.log(`⚡ [Cache Hit] Distinct categories for ${platform}`);
        return cache.data;
    }
    return null;
};

/**
 * Cache distinct categories for a platform
 */
const cacheDistinctCategories = (platform, data) => {
    const key = (platform || 'all').toLowerCase();
    distinctValuesCache.categories.set(key, { data, timestamp: Date.now() });
    console.log(`📦 [Cache Set] Distinct categories for ${platform} (${data.length} items)`);
};

/**
 * Get cached distinct locations for a platform
 */
const getCachedDistinctLocations = (platform) => {
    const key = (platform || 'all').toLowerCase();
    const cache = distinctValuesCache.locations.get(key);
    if (cache && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        console.log(`⚡ [Cache Hit] Distinct locations for ${platform}`);
        return cache.data;
    }
    return null;
};

/**
 * Cache distinct locations for a platform
 */
const cacheDistinctLocations = (platform, data) => {
    const key = (platform || 'all').toLowerCase();
    distinctValuesCache.locations.set(key, { data, timestamp: Date.now() });
    console.log(`📦 [Cache Set] Distinct locations for ${platform} (${data.length} items)`);
};

/**
 * Redis-First Query Helper
 * Checks Redis for cached data first, returns null if not available (caller should fallback to DB)
 * 
 * @param {string} platform - Platform name (e.g., 'Zepto', 'Blinkit')
 * @param {Object} filters - {brand, location, startDate, endDate, category}
 * @returns {Object} - { source: 'redis'|'db', rows: Array|null }
 */
const getRowsFromRedisOrDb = async (platform, filters = {}) => {
    // Only try Redis for specific platforms (not 'All')
    if (platform && platform !== 'All') {
        try {
            const isLoaded = await isPlatformDataLoaded(platform);
            if (isLoaded) {
                const rows = await queryByFilters(platform, filters);
                if (rows && rows.length >= 0) {
                    console.log(`📊 [Redis Hit] ${platform}: ${rows.length} rows from cache`);
                    return { source: 'redis', rows };
                }
            }
        } catch (error) {
            console.warn(`⚠️ Redis query failed, falling back to DB:`, error.message);
        }
    }

    // Return null rows to signal caller should use DB
    console.log(`📊 [DB Fallback] ${platform || 'All'}: Using database query`);
    return { source: 'db', rows: null };
};

/**
 * Aggregate Redis rows in-memory (replacement for Sequelize SUM/AVG)
 * @param {Array} rows - Array of row objects from Redis
 * @param {string} column - Column name to aggregate
 * @param {string} operation - 'sum', 'avg', 'count'
 * @returns {number} - Aggregated value
 */
const aggregateFromRows = (rows, column, operation = 'sum') => {
    if (!rows || rows.length === 0) return 0;

    const values = rows
        .map(row => parseFloat(row[column]) || 0)
        .filter(v => !isNaN(v));

    switch (operation) {
        case 'sum':
            return values.reduce((acc, val) => acc + val, 0);
        case 'avg':
            return values.length > 0 ? values.reduce((acc, val) => acc + val, 0) / values.length : 0;
        case 'count':
            return values.length;
        default:
            return 0;
    }
};

// Internal implementation with all the compute logic
const computeSummaryMetrics = async (filters, options = {}) => {
    const { onlyOverview = false, skipPerformanceKpis = false } = options;

    try {
        console.log("Processing Watch Tower request with filters:", filters);

        const { months = 1, startDate: qStartDate, endDate: qEndDate, compareStartDate: qCompareStartDate, compareEndDate: qCompareEndDate, category } = filters;

        // Extract filter values - frontend may send as 'brand' or 'brand[]' (array format)
        const rawBrand = filters['brand[]'] || filters.brand;
        const rawLocation = filters['location[]'] || filters.location;
        const rawPlatform = filters['platform[]'] || filters.platform;

        // Normalize multi-value filters
        const platformArr = normalizeFilterArray(rawPlatform);
        const brandArr = normalizeFilterArray(rawBrand);
        const locationArr = normalizeFilterArray(rawLocation);

        // For backward compatibility, keep single values for string comparisons
        const brand = brandArr ? (brandArr.length === 1 ? brandArr[0] : brandArr) : null;
        const location = locationArr ? (locationArr.length === 1 ? locationArr[0] : locationArr) : null;
        const platform = platformArr ? (platformArr.length === 1 ? platformArr[0] : platformArr) : null;

        const monthsBack = parseInt(months, 10) || 1;

        // Calculate date range
        let endDate = await getCachedMaxDate();
        let startDate = endDate.subtract(monthsBack, 'month').startOf('day');

        if (qStartDate && qEndDate) {
            startDate = dayjs(qStartDate).startOf('day');
            endDate = dayjs(qEndDate).endOf('day');
        }

        console.log(`Date Range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);

        // ===== REDIS DATA LAYER: DISABLED =====
        // NOTE: Loading all 754K+ rows into Redis causes OOM crash.
        // The system now uses direct database aggregation queries with 
        // Comp_flag=0 filter for better performance and correctness.
        // This feature can be re-enabled once optimized to use LIMIT/pagination
        // or pre-computed aggregations instead of raw row storage.
        // ===== END REDIS DATA LAYER =====

        // ===== OUR BRANDS LIST (uses global cache) =====
        // Uses getGlobalOurBrandsList() defined at module level for cross-request caching
        const getOurBrandsList = () => getGlobalOurBrandsList();
        // ===== END OUR BRANDS LIST =====

        // Helper to generate month buckets
        const generateMonthBuckets = (start, end) => {
            const buckets = [];
            let current = start.clone().startOf('month');
            const endMonth = end.clone().endOf('month');
            while (current.isBefore(endMonth)) {
                buckets.push({
                    label: current.format('MMM'),
                    date: current.toDate(),
                    value: 0
                });
                current = current.add(1, 'month');
            }
            return buckets;
        };

        // Helper to generate week buckets for weekly KPI graphs
        const generateWeekBuckets = (start, end) => {
            const buckets = [];
            let current = start.clone().startOf('isoWeek');
            const endWeek = end.clone().endOf('isoWeek');
            while (current.isBefore(endWeek) || current.isSame(endWeek, 'week')) {
                buckets.push({
                    label: `W${current.week()}`,
                    date: current.toDate(),
                    value: 0
                });
                current = current.add(1, 'week');
            }
            return buckets;
        };

        const monthBuckets = generateMonthBuckets(startDate, endDate);
        const weekBuckets = generateWeekBuckets(startDate, endDate);

        // Helper for currency formatting
        const formatCurrency = (value) => {
            const val = parseFloat(value);
            if (isNaN(val)) return "0";

            // Return "0" for negligible amounts (less than 1 paisa)
            if (val < 0.01 && val > -0.01) return "0";

            if (val >= 1000000000) return `₹${(val / 1000000000).toFixed(2)} B`;
            if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
            if (val >= 1000000) return `₹${(val / 1000000).toFixed(2)} M`;
            if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lac`;
            if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
            return `₹${val.toFixed(2)}`;
        };

        // Build Where Clause for RbPdpOlap (Offtake) - MULTI-VALUE SUPPORT
        const offtakeWhereClause = {
            DATE: {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
            }
        };

        // Handle brand filter with multi-value support
        if (brandArr && brandArr.length > 0) {
            offtakeWhereClause.Brand = buildBrandLikeCondition(brandArr);
        } else {
            offtakeWhereClause.Comp_flag = 0;  // Our brands only when "All" selected
        }

        // Handle location filter with multi-value support
        const locationCondition = buildMultiValueCondition(locationArr);
        if (locationCondition) {
            offtakeWhereClause.Location = locationCondition;
        }

        // Handle platform filter with multi-value support
        const platformCondition = buildMultiValueCondition(platformArr);
        if (platformCondition) {
            offtakeWhereClause.Platform = platformCondition;
        }

        // 3. Availability Calculation Helper (Unified for all platforms using RbPdpOlap)
        // Supports multi-value filters - NOW USES CLICKHOUSE
        const getAvailability = async (start, end, brandFilter, platformFilter, locationFilter, categoryFilter) => {
            // Helper to escape strings for ClickHouse
            const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

            // Build WHERE conditions
            const conditions = [];

            // Check if first argument is a pre-built where clause (legacy overload - skip)
            if (start && typeof start.toDate !== 'function' && typeof start === 'object') {
                // Legacy where clause passed - this is deprecated, return 0
                console.warn('[getAvailability] Legacy where clause passed - deprecated');
                return 0;
            }

            // Date range
            conditions.push(`DATE BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`);

            // Handle brand filter with multi-value support
            const brandFilterArr = normalizeFilterArray(brandFilter);
            if (brandFilterArr && brandFilterArr.length > 0) {
                const brandConditions = brandFilterArr.map(b => `Brand LIKE '%${escapeStr(b)}%'`).join(' OR ');
                conditions.push(`(${brandConditions})`);
            } else {
                conditions.push(`toString(Comp_flag) = '0'`);  // Our brands only when "All" selected
            }

            // Handle platform with multi-value support
            const platformFilterArr = normalizeFilterArray(platformFilter);
            if (platformFilterArr && platformFilterArr.length > 0) {
                if (platformFilterArr.length === 1) {
                    conditions.push(`Platform = '${escapeStr(platformFilterArr[0])}'`);
                } else {
                    conditions.push(`Platform IN (${platformFilterArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
                }
            }

            // Handle location with multi-value support
            const locationFilterArr = normalizeFilterArray(locationFilter);
            if (locationFilterArr && locationFilterArr.length > 0) {
                if (locationFilterArr.length === 1) {
                    conditions.push(`Location = '${escapeStr(locationFilterArr[0])}'`);
                } else {
                    conditions.push(`Location IN (${locationFilterArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
            }

            // Handle category with multi-value support
            const categoryFilterArr = normalizeFilterArray(categoryFilter);
            if (categoryFilterArr && categoryFilterArr.length > 0) {
                if (categoryFilterArr.length === 1) {
                    conditions.push(`Category = '${escapeStr(categoryFilterArr[0])}'`);
                } else {
                    conditions.push(`Category IN (${categoryFilterArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
                }
            }

            const query = `
                SELECT 
                    SUM(ifNull(toFloat64(neno_osa), 0)) as total_neno,
                    SUM(ifNull(toFloat64(deno_osa), 0)) as total_deno
                FROM rb_pdp_olap
                WHERE ${conditions.join(' AND ')}
            `;

            try {
                const results = await queryClickHouse(query);
                const totalNeno = parseFloat(results[0]?.total_neno || 0);
                const totalDeno = parseFloat(results[0]?.total_deno || 0);
                return totalDeno > 0 ? (totalNeno / totalDeno) * 100 : 0;
            } catch (error) {
                console.error('[getAvailability] ClickHouse error:', error.message);
                return 0;
            }
        };

        // Share of Search Calculation Helper - NOW USES CLICKHOUSE
        // Formula when Brand = "All": SOS = (Count of rows where keyword_is_rb_product=1) / (Count of ALL rows) × 100
        // Uses keyword_is_rb_product column in rb_kw table (1 = our RB product)
        const getShareOfSearch = async (start, end, brandFilter, platformFilter, locationFilter, categoryFilter) => {
            try {
                // Helper to escape strings for ClickHouse
                const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

                // ===== CHECK CACHE FIRST =====
                const cachedResult = await getCachedSOSData(
                    platformFilter,
                    start.format('YYYY-MM-DD'),
                    end.format('YYYY-MM-DD'),
                    categoryFilter,
                    locationFilter
                );
                if (cachedResult && cachedResult.brandCounts) {
                    const brandKey = (brandFilter || 'all').toLowerCase();
                    const brandCount = cachedResult.brandCounts[brandKey] || 0;
                    const sos = cachedResult.totalCount > 0 ? (brandCount / cachedResult.totalCount) * 100 : 0;
                    return sos;
                }
                // ===== END CACHE CHECK =====

                // Build base conditions - use toDate() since kw_crawl_date is datetime string
                const baseConditions = [];
                baseConditions.push(`toDate(kw_crawl_date) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`);

                if (categoryFilter && categoryFilter !== 'All') {
                    baseConditions.push(`keyword_category = '${escapeStr(categoryFilter)}'`);
                }

                // Location with multi-value support
                const locFilterArr = normalizeFilterArray(locationFilter);
                if (locFilterArr && locFilterArr.length > 0) {
                    if (locFilterArr.length === 1) {
                        baseConditions.push(`location_name = '${escapeStr(locFilterArr[0])}'`);
                    } else {
                        baseConditions.push(`location_name IN (${locFilterArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                    }
                }

                // Platform with multi-value support
                const platFilterArr = normalizeFilterArray(platformFilter);
                if (platFilterArr && platFilterArr.length > 0) {
                    if (platFilterArr.length === 1) {
                        baseConditions.push(`platform_name = '${escapeStr(platFilterArr[0])}'`);
                    } else {
                        baseConditions.push(`platform_name IN (${platFilterArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
                    }
                }

                // Build numerator conditions (adds brand filter)
                const numeratorConditions = [...baseConditions];
                const brandFilterArr = normalizeFilterArray(brandFilter);
                if (brandFilterArr && brandFilterArr.length > 0) {
                    if (brandFilterArr.length === 1) {
                        numeratorConditions.push(`brand_name = '${escapeStr(brandFilterArr[0])}'`);
                    } else {
                        numeratorConditions.push(`brand_name IN (${brandFilterArr.map(b => `'${escapeStr(b)}'`).join(', ')})`);
                    }
                } else {
                    // "All" brands selected - use keyword_is_rb_product='1' for our brands
                    numeratorConditions.push(`toString(keyword_is_rb_product) = '1'`);
                }

                // Execute both count queries in parallel
                const [numResult, denomResult] = await Promise.all([
                    queryClickHouse(`SELECT count() as cnt FROM rb_kw WHERE ${numeratorConditions.join(' AND ')}`),
                    queryClickHouse(`SELECT count() as cnt FROM rb_kw WHERE ${baseConditions.join(' AND ')}`)
                ]);

                const numeratorCount = parseInt(numResult[0]?.cnt || 0);
                const denominatorCount = parseInt(denomResult[0]?.cnt || 0);

                const sos = denominatorCount > 0 ? (numeratorCount / denominatorCount) * 100 : 0;
                return sos;
            } catch (error) {
                console.error("Error calculating Share of Search:", error);
                return 0;
            }
        };


        /**
         * Bulk Share of Search Calculation - NOW USES CLICKHOUSE
         * Calculates SOS for multiple brands in ONE batch query (4 total queries vs 2N queries)
         * 
         * @param {Array<string>} brands - Array of brand names
         * @param {dayjs} currStart - Current period start date
         * @param {dayjs} currEnd - Current period end date
         * @param {dayjs} prevStart - Previous period start date
         * @param {dayjs} prevEnd - Previous period end date
         * @param {string} platformFilter - Platform filter
         * @param {string} locationFilter - Location filter
         * @param {string} categoryFilter - Category filter
         * @returns {Map<brandName, {current: number, previous: number}>} Map of brand -> SOS values
         */
        const getBulkShareOfSearch = async (
            brands,
            currStart, currEnd,
            prevStart, prevEnd,
            platformFilter, locationFilter, categoryFilter
        ) => {
            try {
                const timerLabel = `[Bulk SOS] Total Time ${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                console.time(timerLabel);

                // Helper to escape strings for ClickHouse
                const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

                // ===== CHECK REDIS CACHE FIRST =====
                const currCacheKey = {
                    platform: platformFilter,
                    dateStart: currStart.format('YYYY-MM-DD'),
                    dateEnd: currEnd.format('YYYY-MM-DD'),
                    category: categoryFilter,
                    location: locationFilter
                };
                const prevCacheKey = {
                    platform: platformFilter,
                    dateStart: prevStart.format('YYYY-MM-DD'),
                    dateEnd: prevEnd.format('YYYY-MM-DD'),
                    category: categoryFilter,
                    location: locationFilter
                };

                const [cachedCurr, cachedPrev] = await Promise.all([
                    getCachedSOSData(currCacheKey.platform, currCacheKey.dateStart, currCacheKey.dateEnd, currCacheKey.category, currCacheKey.location),
                    getCachedSOSData(prevCacheKey.platform, prevCacheKey.dateStart, prevCacheKey.dateEnd, prevCacheKey.category, prevCacheKey.location)
                ]);

                // If both periods are cached, calculate SOS from cache
                if (cachedCurr && cachedPrev) {
                    console.log(`📊 [SOS Cache Hit] Using cached data for both periods`);
                    const validBrands = brands.filter(b => b && b.trim());
                    const sosMap = new Map();

                    validBrands.forEach(brand => {
                        const brandKey = brand.toLowerCase();
                        const currCount = cachedCurr.brandCounts[brandKey] || 0;
                        const prevCount = cachedPrev.brandCounts[brandKey] || 0;

                        const currSos = cachedCurr.totalCount > 0 ? (currCount / cachedCurr.totalCount) * 100 : 0;
                        const prevSos = cachedPrev.totalCount > 0 ? (prevCount / cachedPrev.totalCount) * 100 : 0;

                        sosMap.set(brand, { current: currSos, previous: prevSos });
                    });

                    console.timeEnd(timerLabel);
                    return sosMap;
                }
                // ===== END REDIS CACHE CHECK =====

                // Build base conditions for ClickHouse
                const buildBaseConditions = () => {
                    const conditions = [];
                    if (categoryFilter) {
                        conditions.push(`lower(keyword_category) = '${escapeStr(categoryFilter.toLowerCase())}'`);
                    }
                    if (locationFilter && locationFilter !== 'All') {
                        conditions.push(`lower(location_name) = '${escapeStr(locationFilter.toLowerCase())}'`);
                    }
                    if (platformFilter && platformFilter !== 'All') {
                        conditions.push(`lower(platform_name) = '${escapeStr(platformFilter.toLowerCase())}'`);
                    }
                    return conditions;
                };

                // Filter out empty/null brands
                const validBrands = brands.filter(b => b && b.trim());
                if (validBrands.length === 0) {
                    console.timeEnd(timerLabel);
                    return new Map();
                }

                console.log(`[Bulk SOS] Calculating SOS for ${validBrands.length} brands:`, validBrands.slice(0, 5).join(', ') + '...');

                // Build brand list for IN clause
                const brandInClause = validBrands.map(b => `'${escapeStr(b)}'`).join(', ');
                const baseConditions = buildBaseConditions();
                const baseCondStr = baseConditions.length > 0 ? ` AND ${baseConditions.join(' AND ')}` : '';

                // Execute all 4 queries in parallel using ClickHouse
                const [currBrandCounts, currTotalResult, prevBrandCounts, prevTotalResult] = await Promise.all([
                    // Query 1: Get counts for ALL brands (current period)
                    queryClickHouse(`
                        SELECT brand_name, count() as count
                        FROM rb_kw
                        WHERE kw_crawl_date BETWEEN '${currStart.format('YYYY-MM-DD')}' AND '${currEnd.format('YYYY-MM-DD')}'
                        AND brand_name IN (${brandInClause})
                        ${baseCondStr}
                        GROUP BY brand_name
                    `),
                    // Query 2: Get total count (current period)
                    queryClickHouse(`
                        SELECT count() as cnt
                        FROM rb_kw
                        WHERE kw_crawl_date BETWEEN '${currStart.format('YYYY-MM-DD')}' AND '${currEnd.format('YYYY-MM-DD')}'
                        ${baseCondStr}
                    `),
                    // Query 3: Get counts for ALL brands (previous period)
                    queryClickHouse(`
                        SELECT brand_name, count() as count
                        FROM rb_kw
                        WHERE kw_crawl_date BETWEEN '${prevStart.format('YYYY-MM-DD')}' AND '${prevEnd.format('YYYY-MM-DD')}'
                        AND brand_name IN (${brandInClause})
                        ${baseCondStr}
                        GROUP BY brand_name
                    `),
                    // Query 4: Get total count (previous period)
                    queryClickHouse(`
                        SELECT count() as cnt
                        FROM rb_kw
                        WHERE kw_crawl_date BETWEEN '${prevStart.format('YYYY-MM-DD')}' AND '${prevEnd.format('YYYY-MM-DD')}'
                        ${baseCondStr}
                    `)
                ]);

                const currTotalCount = parseInt(currTotalResult[0]?.cnt || 0);
                const prevTotalCount = parseInt(prevTotalResult[0]?.cnt || 0);

                console.log(`[Bulk SOS] Query results: currBrandCounts=${currBrandCounts.length}, currTotalCount=${currTotalCount}, prevBrandCounts=${prevBrandCounts.length}, prevTotalCount=${prevTotalCount}`);

                if (currBrandCounts.length > 0) {
                    console.log(`[Bulk SOS] Sample currBrandCounts:`, currBrandCounts.slice(0, 3).map(r => `${r.brand_name}:${r.count}`).join(', '));
                } else {
                    console.log(`[Bulk SOS] WARNING: No brands found in rb_kw for brands:`, validBrands.slice(0, 5).join(', '));
                }

                // Build lookup maps
                const currCountMap = new Map(
                    currBrandCounts.map(r => [r.brand_name.toLowerCase(), parseInt(r.count)])
                );
                const prevCountMap = new Map(
                    prevBrandCounts.map(r => [r.brand_name.toLowerCase(), parseInt(r.count)])
                );

                // Calculate SOS for each brand
                const sosMap = new Map();

                validBrands.forEach(brand => {
                    const brandKey = brand.toLowerCase();
                    const currCount = currCountMap.get(brandKey) || 0;
                    const prevCount = prevCountMap.get(brandKey) || 0;

                    const currSos = currTotalCount > 0 ? (currCount / currTotalCount) * 100 : 0;
                    const prevSos = prevTotalCount > 0 ? (prevCount / prevTotalCount) * 100 : 0;

                    sosMap.set(brand, {
                        current: currSos,
                        previous: prevSos
                    });
                });

                // ===== CACHE THE RESULTS FOR FUTURE REQUESTS =====
                cacheSOSData(
                    currCacheKey.platform, currCacheKey.dateStart, currCacheKey.dateEnd,
                    currCacheKey.category, currCacheKey.location,
                    { brandCounts: Object.fromEntries(currCountMap), totalCount: currTotalCount }
                ).catch(err => console.warn('Failed to cache curr SOS:', err.message));

                cacheSOSData(
                    prevCacheKey.platform, prevCacheKey.dateStart, prevCacheKey.dateEnd,
                    prevCacheKey.category, prevCacheKey.location,
                    { brandCounts: Object.fromEntries(prevCountMap), totalCount: prevTotalCount }
                ).catch(err => console.warn('Failed to cache prev SOS:', err.message));
                // ===== END CACHE STORAGE =====

                console.timeEnd(timerLabel);
                return sosMap;

            } catch (error) {
                console.error("Error in bulk Share of Search calculation:", error);
                // Return empty map on error
                return new Map();
            }
        };

        /**
         * Bulk Platform Metrics - NOW USES CLICKHOUSE
         * Aggregate all platforms in ONE query
         * Reduces 90 queries to 4 queries (20x improvement)
         */
        const getBulkPlatformMetrics = async (platforms, currStart, currEnd, prevStart, prevEnd, filters) => {
            try {
                const timerLabel = `[Bulk Platform] Total ${Date.now()}`;
                console.time(timerLabel);
                const { brand, location, category } = filters;

                // Helper to escape strings for ClickHouse
                const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

                // ===== CHECK CACHE FIRST =====
                const cachedData = await getCachedPlatformMetrics(
                    currStart.format('YYYY-MM-DD'),
                    currEnd.format('YYYY-MM-DD'),
                    prevStart.format('YYYY-MM-DD'),
                    prevEnd.format('YYYY-MM-DD'),
                    brand, location, category
                );
                if (cachedData) {
                    console.log(`📊 [Platform Metrics Cache Hit] Returning cached data`);
                    console.timeEnd(timerLabel);
                    return cachedData;
                }
                // ===== END CACHE CHECK =====

                // Build WHERE conditions for ClickHouse
                const buildConditions = (dateStart, dateEnd) => {
                    const conditions = [`DATE BETWEEN '${dateStart}' AND '${dateEnd}'`];

                    const brandCondArr = normalizeFilterArray(brand);
                    if (brandCondArr && brandCondArr.length > 0) {
                        const brandConds = brandCondArr.map(b => `Brand LIKE '%${escapeStr(b)}%'`).join(' OR ');
                        conditions.push(`(${brandConds})`);
                    } else {
                        conditions.push(`toString(Comp_flag) = '0'`);
                    }

                    if (location && location !== 'All') {
                        conditions.push(`Location = '${escapeStr(location)}'`);
                    }
                    if (category && category !== 'All') {
                        conditions.push(`Category = '${escapeStr(category)}'`);
                    }
                    return conditions.join(' AND ');
                };

                const currConditions = buildConditions(currStart.format('YYYY-MM-DD'), currEnd.format('YYYY-MM-DD'));
                const prevConditions = buildConditions(prevStart.format('YYYY-MM-DD'), prevEnd.format('YYYY-MM-DD'));

                // Execute 4 queries in parallel using ClickHouse
                const [currData, currMs, prevData, prevMs] = await Promise.all([
                    // Query 1: Current period offtake metrics for all platforms
                    queryClickHouse(`
                        SELECT 
                            Platform,
                            SUM(ifNull(toFloat64(Sales), 0)) as sales,
                            SUM(ifNull(toFloat64(Ad_Spend), 0)) as spend,
                            SUM(ifNull(toFloat64(Ad_sales), 0)) as ad_sales,
                            SUM(ifNull(toFloat64(Ad_Clicks), 0)) as clicks,
                            SUM(ifNull(toFloat64(Ad_Impressions), 0)) as impressions,
                            SUM(ifNull(toFloat64(neno_osa), 0)) as neno,
                            SUM(ifNull(toFloat64(deno_osa), 0)) as deno
                        FROM rb_pdp_olap
                        WHERE ${currConditions}
                        GROUP BY Platform
                    `),
                    // Query 2: Current period market share from rb_brand_ms
                    queryClickHouse(`
                        SELECT AVG(toFloat64(market_share)) as ms
                        FROM rb_brand_ms
                        WHERE created_on BETWEEN '${currStart.format('YYYY-MM-DD')}' AND '${currEnd.format('YYYY-MM-DD')}'
                        ${brand && brand !== 'All' ? (Array.isArray(brand) ? `AND brand IN (${brand.map(b => `'${escapeStr(b)}'`).join(', ')})` : `AND brand = '${escapeStr(brand)}'`) : ''}
                        ${location && location !== 'All' ? `AND Location = '${escapeStr(location)}'` : ''}
                        ${category && category !== 'All' ? `AND category = '${escapeStr(category)}'` : ''}
                    `),
                    // Query 3: Previous period offtake metrics for all platforms
                    queryClickHouse(`
                        SELECT 
                            Platform,
                            SUM(ifNull(toFloat64(Sales), 0)) as sales,
                            SUM(ifNull(toFloat64(Ad_Spend), 0)) as spend,
                            SUM(ifNull(toFloat64(Ad_sales), 0)) as ad_sales,
                            SUM(ifNull(toFloat64(Ad_Clicks), 0)) as clicks,
                            SUM(ifNull(toFloat64(Ad_Impressions), 0)) as impressions,
                            SUM(ifNull(toFloat64(neno_osa), 0)) as neno,
                            SUM(ifNull(toFloat64(deno_osa), 0)) as deno
                        FROM rb_pdp_olap
                        WHERE ${prevConditions}
                        GROUP BY Platform
                    `),
                    // Query 4: Previous period market share from rb_brand_ms
                    queryClickHouse(`
                        SELECT AVG(toFloat64(market_share)) as ms
                        FROM rb_brand_ms
                        WHERE created_on BETWEEN '${prevStart.format('YYYY-MM-DD')}' AND '${prevEnd.format('YYYY-MM-DD')}'
                        ${brand && brand !== 'All' ? (Array.isArray(brand) ? `AND brand IN (${brand.map(b => `'${escapeStr(b)}'`).join(', ')})` : `AND brand = '${escapeStr(brand)}'`) : ''}
                        ${location && location !== 'All' ? `AND Location = '${escapeStr(location)}'` : ''}
                        ${category && category !== 'All' ? `AND category = '${escapeStr(category)}'` : ''}
                    `)
                ]);

                console.log(`[Bulk Platform] Processed ${platforms.length} platforms with 4 queries (vs ${platforms.length * 15} individual queries)`);

                // Build result map
                const map = new Map();
                const overallCurrMs = parseFloat(currMs[0]?.ms || 0);
                const overallPrevMs = parseFloat(prevMs[0]?.ms || 0);

                platforms.forEach(p => {
                    const key = p.toLowerCase();
                    const c = currData.find(d => d.Platform && d.Platform.toLowerCase() === key);
                    const pv = prevData.find(d => d.Platform && d.Platform.toLowerCase() === key);

                    map.set(p, {
                        curr: {
                            sales: parseFloat(c?.sales || 0),
                            spend: parseFloat(c?.spend || 0),
                            adSales: parseFloat(c?.ad_sales || 0),
                            clicks: parseFloat(c?.clicks || 0),
                            impressions: parseFloat(c?.impressions || 0),
                            neno: parseFloat(c?.neno || 0),
                            deno: parseFloat(c?.deno || 0),
                            ms: overallCurrMs
                        },
                        prev: {
                            sales: parseFloat(pv?.sales || 0),
                            spend: parseFloat(pv?.spend || 0),
                            adSales: parseFloat(pv?.ad_sales || 0),
                            clicks: parseFloat(pv?.clicks || 0),
                            impressions: parseFloat(pv?.impressions || 0),
                            neno: parseFloat(pv?.neno || 0),
                            deno: parseFloat(pv?.deno || 0),
                            ms: overallPrevMs
                        }
                    });
                });

                // ===== CACHE THE RESULTS =====
                cachePlatformMetrics(
                    currStart.format('YYYY-MM-DD'),
                    currEnd.format('YYYY-MM-DD'),
                    prevStart.format('YYYY-MM-DD'),
                    prevEnd.format('YYYY-MM-DD'),
                    brand, location, category, map
                ).catch(err => console.warn('Failed to cache platform metrics:', err.message));
                // ===== END CACHE STORAGE =====

                console.timeEnd(timerLabel);
                return map;
            } catch (err) {
                console.error('[Bulk Platform] Error:', err);
                return new Map();
            }
        };


        // Execute queries concurrently - NOW USING CLICKHOUSE
        // Helper for building ClickHouse WHERE conditions
        const escapeStrMain = (str) => str ? str.replace(/'/g, "''") : '';
        const buildOfftakeConditions = () => {
            // Use toDate(DATE) since DATE column is String type
            const conditions = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
            if (brandArr && brandArr.length > 0) {
                const brandConds = brandArr.map(b => `Brand LIKE '%${escapeStrMain(b)}%'`).join(' OR ');
                conditions.push(`(${brandConds})`);
            } else {
                conditions.push(`toString(Comp_flag) = '0'`);
            }
            if (locationArr && locationArr.length > 0) {
                if (locationArr.length === 1) {
                    conditions.push(`Location = '${escapeStrMain(locationArr[0])}'`);
                } else {
                    conditions.push(`Location IN (${locationArr.map(l => `'${escapeStrMain(l)}'`).join(', ')})`);
                }
            }
            if (platformArr && platformArr.length > 0) {
                if (platformArr.length === 1) {
                    conditions.push(`Platform = '${escapeStrMain(platformArr[0])}'`);
                } else {
                    conditions.push(`Platform IN (${platformArr.map(p => `'${escapeStrMain(p)}'`).join(', ')})`);
                }
            }
            if (category && category !== 'All') {
                conditions.push(`Category = '${escapeStrMain(category)}'`);
            }
            return conditions.join(' AND ');
        };

        const offtakeCondStr = buildOfftakeConditions();

        const [
            offtakeData,
            marketShareData,
            totalMarketShareResult,
            topSkus,
            currentAvailability,
            prevAvailability,
            currentShareOfSearch,
            prevShareOfSearch,
            availabilityTrendData,
            shareOfSearchTrendData,
            prevOfftakeResult,
            prevMarketShareResult
        ] = await Promise.all([
            // 1. Total Offtake (Sales) & Chart Data - NOW USES CLICKHOUSE
            (async () => {
                try {
                    const result = await queryClickHouse(`
                        SELECT 
                            toMonday(toDate(DATE)) as week_date,
                            SUM(ifNull(toFloat64(Sales), 0)) as total_sales
                        FROM rb_pdp_olap
                        WHERE ${offtakeCondStr}
                        GROUP BY toMonday(toDate(DATE))
                        ORDER BY week_date
                    `);
                    return result;
                } catch (err) {
                    console.error('[Offtake] ClickHouse error:', err.message);
                    return [];
                }
            })(),
            // 2. Market Share - USING CLICKHOUSE
            (async () => {
                try {
                    // Get valid brands (comp_flag = 0)
                    const validBrands = await queryClickHouse(`SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL`);
                    const validBrandNames = validBrands.map(b => b.brand_name).filter(Boolean);

                    const brandsForNumerator = (brand && brand !== 'All')
                        ? (Array.isArray(brand) ? brand : [brand])
                        : validBrandNames;

                    if (brandsForNumerator.length === 0) return [];

                    const brandInClause = brandsForNumerator.map(b => `'${escapeStrMain(b)}'`).join(', ');
                    const msBaseConditions = [
                        `created_on BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
                        `sales IS NOT NULL`
                    ];
                    // Handle multi-value Platform filter
                    if (platformArr && platformArr.length > 0) {
                        if (platformArr.length === 1) {
                            msBaseConditions.push(`Platform = '${escapeStrMain(platformArr[0])}'`);
                        } else {
                            msBaseConditions.push(`Platform IN (${platformArr.map(p => `'${escapeStrMain(p)}'`).join(', ')})`);
                        }
                    }
                    // Handle multi-value Location filter
                    if (locationArr && locationArr.length > 0) {
                        if (locationArr.length === 1) {
                            msBaseConditions.push(`Location = '${escapeStrMain(locationArr[0])}'`);
                        } else {
                            msBaseConditions.push(`Location IN (${locationArr.map(l => `'${escapeStrMain(l)}'`).join(', ')})`);
                        }
                    }

                    const [numeratorData, denominatorData] = await Promise.all([
                        queryClickHouse(`
                            SELECT toMonday(toDate(created_on)) as week_date, SUM(toFloat64OrZero(sales)) as our_sales
                            FROM rb_brand_ms
                            WHERE ${msBaseConditions.join(' AND ')} AND brand IN (${brandInClause})
                            GROUP BY toMonday(toDate(created_on))
                        `),
                        queryClickHouse(`
                            SELECT toMonday(toDate(created_on)) as week_date, SUM(toFloat64OrZero(sales)) as total_sales
                            FROM rb_brand_ms
                            WHERE ${msBaseConditions.join(' AND ')}
                            GROUP BY toMonday(toDate(created_on))
                        `)
                    ]);

                    const numMap = new Map(numeratorData.map(r => [r.week_date, parseFloat(r.our_sales || 0)]));
                    return denominatorData.map(r => {
                        const ourSales = numMap.get(r.week_date) || 0;
                        const totalSales = parseFloat(r.total_sales || 0);
                        return {
                            week_date: r.week_date,
                            avg_market_share: totalSales > 0 ? (ourSales / totalSales) * 100 : 0
                        };
                    });
                } catch (err) {
                    console.error('[MarketShare] ClickHouse error:', err.message);
                    return [];
                }
            })(),
            // 3. Total Market Share Average - USING CLICKHOUSE
            (async () => {
                try {
                    const validBrands = await queryClickHouse(`SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL`);
                    const validBrandNames = validBrands.map(b => b.brand_name).filter(Boolean);
                    const brandsForNumerator = (brand && brand !== 'All') ? (Array.isArray(brand) ? brand : [brand]) : validBrandNames;

                    if (brandsForNumerator.length === 0) return { avg_market_share: 0, count: 0, min_val: 0, max_val: 0 };

                    const brandInClause = brandsForNumerator.map(b => `'${escapeStrMain(b)}'`).join(', ');
                    const msBaseConditions = [
                        `created_on BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
                        `sales IS NOT NULL`
                    ];
                    // Handle multi-value Platform filter
                    if (platformArr && platformArr.length > 0) {
                        if (platformArr.length === 1) {
                            msBaseConditions.push(`Platform = '${escapeStrMain(platformArr[0])}'`);
                        } else {
                            msBaseConditions.push(`Platform IN (${platformArr.map(p => `'${escapeStrMain(p)}'`).join(', ')})`);
                        }
                    }
                    // Handle multi-value Location filter
                    if (locationArr && locationArr.length > 0) {
                        if (locationArr.length === 1) {
                            msBaseConditions.push(`Location = '${escapeStrMain(locationArr[0])}'`);
                        } else {
                            msBaseConditions.push(`Location IN (${locationArr.map(l => `'${escapeStrMain(l)}'`).join(', ')})`);
                        }
                    }

                    const [ourSalesResult, totalSalesResult] = await Promise.all([
                        queryClickHouse(`SELECT SUM(toFloat64OrZero(sales)) as our_sales FROM rb_brand_ms WHERE ${msBaseConditions.join(' AND ')} AND brand IN (${brandInClause})`),
                        queryClickHouse(`SELECT SUM(toFloat64OrZero(sales)) as total_sales FROM rb_brand_ms WHERE ${msBaseConditions.join(' AND ')}`)
                    ]);

                    const ourSales = parseFloat(ourSalesResult[0]?.our_sales || 0);
                    const totalSales = parseFloat(totalSalesResult[0]?.total_sales || 0);
                    const avgMs = totalSales > 0 ? (ourSales / totalSales) * 100 : 0;
                    return { avg_market_share: avgMs, count: 1, min_val: avgMs, max_val: avgMs };
                } catch (err) {
                    console.error('[TotalMarketShare] ClickHouse error:', err.message);
                    return { avg_market_share: 0, count: 0, min_val: 0, max_val: 0 };
                }
            })(),
            // 4. Top SKUs - USING CLICKHOUSE (simplified without join)
            (async () => {
                try {
                    const result = await queryClickHouse(`
                        SELECT 
                            Product as sku_name,
                            SUM(ifNull(toFloat64(Sales), 0)) as sku_gmv
                        FROM rb_pdp_olap
                        WHERE ${offtakeCondStr} AND Product IS NOT NULL AND Product != ''
                        GROUP BY Product
                        ORDER BY sku_gmv DESC
                        LIMIT 10
                    `);
                    return result;
                } catch (error) {
                    console.error('Error fetching top SKUs:', error.message);
                    return [];
                }
            })(),
            // 5. Current Availability (already uses ClickHouse)
            getAvailability(startDate, endDate, brand, platform, location, category),
            // 6. Previous Availability
            (filters.compareStartDate && filters.compareEndDate)
                ? getAvailability(dayjs(filters.compareStartDate), dayjs(filters.compareEndDate), brand, platform, location, category)
                : Promise.resolve(0),
            // 7. Current Share of Search (already uses ClickHouse)
            getShareOfSearch(startDate, endDate, brand, platform, location, category),
            // 8. Previous Share of Search
            (filters.compareStartDate && filters.compareEndDate)
                ? getShareOfSearch(dayjs(filters.compareStartDate), dayjs(filters.compareEndDate), brand, platform, location, category)
                : Promise.resolve(0),
            // 9. Availability Trend Data - USING CLICKHOUSE
            (async () => {
                try {
                    return await queryClickHouse(`
                        SELECT 
                            toMonday(toDate(DATE)) as week_date,
                            SUM(ifNull(toFloat64(neno_osa), 0)) as total_neno,
                            SUM(ifNull(toFloat64(deno_osa), 0)) as total_deno
                        FROM rb_pdp_olap
                        WHERE ${offtakeCondStr}
                        GROUP BY toMonday(toDate(DATE))
                        ORDER BY week_date
                    `);
                } catch (err) {
                    console.error('[AvailabilityTrend] ClickHouse error:', err.message);
                    return [];
                }
            })(),
            // 10. Share of Search Trend Data - USING CLICKHOUSE
            (async () => {
                try {
                    const kwBaseConditions = [`kw_crawl_date BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
                    if (category) kwBaseConditions.push(`lower(keyword_category) = '${escapeStrMain(category.toLowerCase())}'`);
                    if (locationArr && locationArr.length > 0) {
                        if (locationArr.length === 1) {
                            kwBaseConditions.push(`lower(location_name) = '${escapeStrMain(locationArr[0].toLowerCase())}'`);
                        } else {
                            kwBaseConditions.push(`location_name IN (${locationArr.map(l => `'${escapeStrMain(l)}'`).join(', ')})`);
                        }
                    }
                    if (platformArr && platformArr.length > 0) {
                        if (platformArr.length === 1) {
                            kwBaseConditions.push(`lower(platform_name) = '${escapeStrMain(platformArr[0].toLowerCase())}'`);
                        } else {
                            kwBaseConditions.push(`platform_name IN (${platformArr.map(p => `'${escapeStrMain(p)}'`).join(', ')})`);
                        }
                    }

                    const numeratorConditions = [...kwBaseConditions];
                    if (brandArr && brandArr.length > 0) {
                        if (brandArr.length === 1) {
                            numeratorConditions.push(`lower(brand_name) = '${escapeStrMain(brandArr[0].toLowerCase())}'`);
                        } else {
                            numeratorConditions.push(`brand_name IN (${brandArr.map(b => `'${escapeStrMain(b)}'`).join(', ')})`);
                        }
                    } else {
                        numeratorConditions.push(`keyword_is_rb_product = 1`);
                    }

                    const [brandWeekCounts, totalWeekCounts] = await Promise.all([
                        queryClickHouse(`
                            SELECT toMonday(toDate(kw_crawl_date)) as week, count() as count
                            FROM rb_kw
                            WHERE ${numeratorConditions.join(' AND ')}
                            GROUP BY toMonday(toDate(kw_crawl_date))
                        `),
                        queryClickHouse(`
                            SELECT toMonday(toDate(kw_crawl_date)) as week, count() as count
                            FROM rb_kw
                            WHERE ${kwBaseConditions.join(' AND ')}
                            GROUP BY toMonday(toDate(kw_crawl_date))
                        `)
                    ]);

                    const brandCountMap = new Map(brandWeekCounts.map(r => [dayjs(r.week).format('YYYY-MM-DD'), parseInt(r.count)]));
                    const totalCountMap = new Map(totalWeekCounts.map(r => [dayjs(r.week).format('YYYY-MM-DD'), parseInt(r.count)]));

                    return weekBuckets.map(bucket => {
                        const weekKey = dayjs(bucket.date).startOf('isoWeek').format('YYYY-MM-DD');
                        const brandCount = brandCountMap.get(weekKey) || 0;
                        const totalCount = totalCountMap.get(weekKey) || 0;
                        const sosValue = totalCount > 0 ? (brandCount / totalCount) * 100 : 0;
                        return { week_date: bucket.date, value: sosValue };
                    });
                } catch (error) {
                    console.error('Error calculating bulk SOS trend:', error.message);
                    return weekBuckets.map(bucket => ({ week_date: bucket.date, value: 0 }));
                }
            })(),
            // 11. Previous Offtake - USING CLICKHOUSE
            (async () => {
                if (!filters.compareStartDate || !filters.compareEndDate) return 0;
                try {
                    const prevConditions = [
                        `DATE BETWEEN '${dayjs(filters.compareStartDate).format('YYYY-MM-DD')}' AND '${dayjs(filters.compareEndDate).format('YYYY-MM-DD')}'`
                    ];
                    if (brandArr && brandArr.length > 0) {
                        prevConditions.push(`(${brandArr.map(b => `Brand LIKE '%${escapeStrMain(b)}%'`).join(' OR ')})`);
                    } else {
                        prevConditions.push(`toString(Comp_flag) = '0'`);
                    }
                    if (locationArr && locationArr.length > 0) {
                        prevConditions.push(`Location IN (${locationArr.map(l => `'${escapeStrMain(l)}'`).join(', ')})`);
                    }
                    if (platformArr && platformArr.length > 0) {
                        prevConditions.push(`Platform IN (${platformArr.map(p => `'${escapeStrMain(p)}'`).join(', ')})`);
                    }
                    if (category && category !== 'All') {
                        prevConditions.push(`Category = '${escapeStrMain(category)}'`);
                    }
                    const result = await queryClickHouse(`SELECT SUM(ifNull(toFloat64(Sales), 0)) as total FROM rb_pdp_olap WHERE ${prevConditions.join(' AND ')}`);
                    return parseFloat(result[0]?.total || 0);
                } catch (err) {
                    console.error('[PrevOfftake] ClickHouse error:', err.message);
                    return 0;
                }
            })(),
            // 12. Previous Market Share - USING CLICKHOUSE
            (async () => {
                if (!filters.compareStartDate || !filters.compareEndDate) return null;
                try {
                    const conditions = [
                        `created_on BETWEEN '${dayjs(filters.compareStartDate).format('YYYY-MM-DD')}' AND '${dayjs(filters.compareEndDate).format('YYYY-MM-DD')}'`
                    ];
                    if (brand && brand !== 'All') conditions.push(`brand = '${escapeStrMain(brand)}'`);
                    if (location && location !== 'All') conditions.push(`Location = '${escapeStrMain(location)}'`);
                    const result = await queryClickHouse(`SELECT AVG(toFloat64(market_share)) as avg_ms FROM rb_brand_ms WHERE ${conditions.join(' AND ')}`);
                    return { avg_ms: parseFloat(result[0]?.avg_ms || 0) };
                } catch (err) {
                    console.error('[PrevMarketShare] ClickHouse error:', err.message);
                    return null;
                }
            })()
        ]);

        // Process Offtake Data - Using weekBuckets for weekly chart
        const offtakeChart = weekBuckets.map(bucket => {
            const match = offtakeData.find(d => {
                return dayjs(d.week_date).isSame(dayjs(bucket.date), 'week');
            });
            return match ? parseFloat(match.total_sales) / 10000000 : 0; // Convert to Cr
        });

        const totalOfftake = offtakeData.reduce((sum, d) => sum + parseFloat(d.total_sales), 0);
        const formattedOfftake = formatCurrency(totalOfftake);

        // Calculate Offtake Trend
        const prevOfftakeVal = parseFloat(prevOfftakeResult || 0);
        let offtakeChange = 0;
        if (prevOfftakeVal > 0) {
            offtakeChange = ((totalOfftake - prevOfftakeVal) / prevOfftakeVal) * 100;
        } else if (totalOfftake > 0) {
            offtakeChange = 100; // Treat as 100% growth if previous was 0 and current is > 0
        }
        const offtakeTrendStr = (offtakeChange >= 0 ? "+" : "") + offtakeChange.toFixed(1) + "%";

        // Process Market Share Data - Using weekBuckets for weekly chart
        const marketShareChart = weekBuckets.map(bucket => {
            const match = marketShareData.find(d => dayjs(d.week_date).isSame(dayjs(bucket.date), 'week'));
            return match ? parseFloat(match.avg_market_share) : 0;
        });

        const totalMarketShare = totalMarketShareResult?.avg_market_share || 0;
        const formattedMarketShare = parseFloat(totalMarketShare).toFixed(1) + "%";

        // Calculate Market Share Trend (percentage point difference for % KPIs)
        const prevMarketShareVal = parseFloat(prevMarketShareResult?.avg_ms || 0);
        const marketShareChange = totalMarketShare - prevMarketShareVal;
        const marketShareTrendStr = (marketShareChange >= 0 ? "+" : "") + marketShareChange.toFixed(1) + " pp";

        // Process Availability Data
        const formattedAvailability = currentAvailability.toFixed(1) + "%";

        // Calculate Availability Trend (percentage point difference for % KPIs)
        const availabilityChange = currentAvailability - prevAvailability;
        const availabilityTrendStr = (availabilityChange >= 0 ? "+" : "") + availabilityChange.toFixed(1) + " pp";

        // Process Availability Chart - Using weekBuckets for weekly chart
        const availabilityChart = weekBuckets.map(bucket => {
            const match = availabilityTrendData.find(d => dayjs(d.week_date).isSame(dayjs(bucket.date), 'week'));
            if (match) {
                const totalNeno = parseFloat(match.total_neno || 0);
                const totalDeno = parseFloat(match.total_deno || 0);
                return totalDeno > 0 ? (totalNeno / totalDeno) * 100 : 0;
            }
            return 0;
        });

        // Process Share of Search Data
        const formattedShareOfSearch = currentShareOfSearch.toFixed(1) + "%";

        // Calculate SOS Trend (percentage point difference for % KPIs)
        const sosChange = currentShareOfSearch - prevShareOfSearch;
        const sosTrendStr = (sosChange >= 0 ? "+" : "") + sosChange.toFixed(1) + " pp";

        // Process Share of Search Chart - Using weekBuckets for weekly chart
        const shareOfSearchChart = weekBuckets.map(bucket => {
            const match = shareOfSearchTrendData.find(d => dayjs(d.week_date).isSame(dayjs(bucket.date), 'week'));
            return match ? parseFloat(match.value) : 0;
        });

        // Process Top SKUs
        const skuTableData = topSkus.map(sku => ({
            sku_name: sku.sku_name,
            gmv: formatCurrency(sku.sku_gmv)
        }));

        // Prepare Summary Metrics Object (Header values)
        const summaryMetrics = {
            offtakes: `₹${formattedOfftake}`,
            offtakesTrend: offtakeTrendStr,
            shareOfSearch: formattedShareOfSearch,
            shareOfSearchTrend: sosTrendStr,
            stockAvailability: formattedAvailability,
            stockAvailabilityTrend: availabilityTrendStr,
            marketShare: formattedMarketShare,
        };

        // Prepare Top Metrics Array (Cards with Charts) - Use weekBuckets for weekly labels
        const chartLabels = weekBuckets.map(b => b.label);

        // Determine subtitle based on filters
        let subtitle = `last ${monthsBack} months`;
        if (qStartDate && qEndDate) {
            subtitle = `${dayjs(qStartDate).format('DD MMM')} - ${dayjs(qEndDate).format('DD MMM')}`;
        }

        const topMetrics = [
            {
                name: "Offtake",
                label: formattedOfftake,
                subtitle: subtitle,
                trend: offtakeTrendStr,
                trendType: offtakeChange >= 0 ? "positive" : "negative",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: offtakeChart,
                labels: chartLabels
            },
            {
                name: "Availability",
                label: formattedAvailability,
                subtitle: subtitle,
                trend: availabilityTrendStr,
                trendType: availabilityChange >= 0 ? "positive" : "negative",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: availabilityChart,
                labels: chartLabels
            },
            {
                name: "Share of Search",
                label: formattedShareOfSearch,
                subtitle: subtitle,
                trend: sosTrendStr,
                trendType: sosChange >= 0 ? "positive" : "negative",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: shareOfSearchChart,
                labels: chartLabels
            },
            {
                name: "Market Share",
                label: formattedMarketShare,
                subtitle: subtitle,
                trend: marketShareTrendStr,
                trendType: marketShareChange >= 0 ? "positive" : "negative",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: marketShareChart,
                labels: chartLabels
            },
        ];

        // Performance Metrics KPIs (6 KPI Cards) - OPTIMIZED WITH GROUP BY
        // Skip this expensive computation if only topMetrics are needed
        const performanceMetricsKpis = [];

        if (!skipPerformanceKpis) {
            try {
                const momStartDate = startDate.clone().subtract(1, 'month');
                const momEndDate = endDate.clone().subtract(1, 'month');

                // Helper to generate last 7 months
                const last7Months = [];
                for (let i = 6; i >= 0; i--) {
                    const mStart = endDate.clone().subtract(i, 'month').startOf('month');
                    const mEnd = endDate.clone().subtract(i, 'month').endOf('month');
                    last7Months.push({ start: mStart, end: mEnd, label: `P${7 - i}`, key: mStart.format('YYYY-MM-01') });
                }

                // ⚡ MEGA OPTIMIZATION: Pre-computed monthly KPI cache with Redis fallback
                const getBulkPerformanceMetrics = async (startRange, endRange, filters) => {
                    const { brand, platform, location } = filters;

                    // Generate list of months in range
                    const months = [];
                    let current = startRange.clone().startOf('month');
                    while (current.isBefore(endRange) || current.isSame(endRange, 'month')) {
                        months.push(current.format('YYYY-MM'));
                        current = current.add(1, 'month');
                    }

                    // ===== CHECK PRE-COMPUTED MONTHLY KPI CACHE FIRST =====
                    const cachedData = await getCachedMonthlyKPIs(platform, months, brand, location);
                    if (cachedData) {
                        console.log(`📊 [KPI Cache Hit] Returning cached data for ${months.length} months`);
                        // Convert to expected format (month key with -01 suffix)
                        const dataByMonth = new Map();
                        for (const [month, data] of cachedData) {
                            dataByMonth.set(month + '-01', data);
                        }
                        return dataByMonth;
                    }
                    // ===== END CACHE CHECK =====

                    // ===== TRY BRAND PRE-AGGREGATED DATA (INSTANT LOOKUP) =====
                    // This uses data pre-computed during Redis load - no row fetching needed!
                    if (brand && brand !== 'All' && platform && platform !== 'All') {
                        const brandPreAggData = await getBrandMonthlyData(platform, brand, months);
                        if (brandPreAggData && brandPreAggData.size > 0) {
                            // Cache this result for future requests
                            const monthDataMap = new Map();
                            for (const [monthKey, data] of brandPreAggData) {
                                const month = monthKey.substring(0, 7); // YYYY-MM-01 -> YYYY-MM
                                monthDataMap.set(month, data);
                            }
                            cacheMonthlyKPIs(platform, monthDataMap, brand, location)
                                .catch(err => console.warn('Failed to cache monthly KPIs:', err.message));
                            return brandPreAggData;
                        }
                    }
                    // ===== END BRAND PRE-AGGREGATION CHECK =====

                    // Cache miss - compute aggregations (FALLBACK)
                    let dataByMonth = new Map();

                    // Try Redis raw data first
                    const redisResult = await getRowsFromRedisOrDb(platform, {
                        brand: brand,
                        location: location,
                        startDate: startRange.format('YYYY-MM-DD'),
                        endDate: endRange.format('YYYY-MM-DD')
                    });

                    if (redisResult.source === 'redis' && redisResult.rows) {
                        // Aggregate in-memory by month
                        redisResult.rows.forEach(row => {
                            const monthKey = dayjs(row.DATE).format('YYYY-MM-01');

                            if (!dataByMonth.has(monthKey)) {
                                dataByMonth.set(monthKey, {
                                    sales: 0, adSales: 0, orders: 0, clicks: 0, impressions: 0, spend: 0
                                });
                            }

                            const data = dataByMonth.get(monthKey);
                            data.sales += parseFloat(row.Sales || 0);
                            data.adSales += parseFloat(row.Ad_sales || 0);
                            data.orders += parseFloat(row.Ad_Quanity_sold || 0);
                            data.clicks += parseFloat(row.Ad_Clicks || 0);
                            data.impressions += parseFloat(row.Ad_Impressions || 0);
                            data.spend += parseFloat(row.Ad_Spend || 0);
                        });

                        console.log(`📊 [Redis] Aggregated ${redisResult.rows.length} rows into ${dataByMonth.size} months`);
                    } else {
                        // Fallback to ClickHouse database query - MULTI-VALUE SUPPORT
                        // Helper to escape strings
                        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

                        // Build WHERE conditions - use toDate(DATE) since DATE is String
                        const conditions = [
                            `toDate(DATE) BETWEEN '${startRange.format('YYYY-MM-DD')}' AND '${endRange.format('YYYY-MM-DD')}'`
                        ];

                        // Add location filter (multi-value support)
                        const locArr = Array.isArray(location) ? location : (location && location !== 'All' ? [location] : null);
                        if (locArr && locArr.length > 0) {
                            if (locArr.length === 1) {
                                conditions.push(`Location = '${escapeStr(locArr[0])}'`);
                            } else {
                                conditions.push(`Location IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                            }
                        }

                        // Add platform filter (multi-value support)
                        const platArr = Array.isArray(platform) ? platform : (platform && platform !== 'All' ? [platform] : null);
                        if (platArr && platArr.length > 0) {
                            if (platArr.length === 1) {
                                conditions.push(`Platform = '${escapeStr(platArr[0])}'`);
                            } else {
                                conditions.push(`Platform IN (${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
                            }
                        }

                        // Add brand filter (multi-value support with LIKE)
                        const brandArrLocal = Array.isArray(brand) ? brand : (brand && brand !== 'All' ? [brand] : null);
                        if (brandArrLocal && brandArrLocal.length > 0) {
                            const brandConds = brandArrLocal.map(b => `Brand LIKE '%${escapeStr(b)}%'`).join(' OR ');
                            conditions.push(`(${brandConds})`);
                        } else {
                            conditions.push(`toString(Comp_flag) = '0'`);  // Our brands only when "All" selected
                        }

                        const results = await queryClickHouse(`
                            SELECT 
                                formatDateTime(toDate(DATE), '%Y-%m-01') as month,
                                SUM(ifNull(toFloat64(Sales), 0)) as total_sales,
                                SUM(ifNull(toFloat64(Ad_sales), 0)) as total_ad_sales,
                                SUM(ifNull(toFloat64(Ad_Quanity_sold), 0)) as total_orders,
                                SUM(ifNull(toFloat64(Ad_Clicks), 0)) as total_clicks,
                                SUM(ifNull(toFloat64(Ad_Impressions), 0)) as total_impressions,
                                SUM(ifNull(toFloat64(Ad_Spend), 0)) as total_spend
                            FROM rb_pdp_olap
                            WHERE ${conditions.join(' AND ')}
                            GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                            ORDER BY month ASC
                        `);

                        results.forEach(row => {
                            dataByMonth.set(row.month, {
                                sales: parseFloat(row.total_sales || 0),
                                adSales: parseFloat(row.total_ad_sales || 0),
                                orders: parseFloat(row.total_orders || 0),
                                clicks: parseFloat(row.total_clicks || 0),
                                impressions: parseFloat(row.total_impressions || 0),
                                spend: parseFloat(row.total_spend || 0)
                            });
                        });
                    }

                    // ===== CACHE THE COMPUTED AGGREGATIONS =====
                    // Convert to month format without -01 for caching
                    const monthDataMap = new Map();
                    for (const [monthKey, data] of dataByMonth) {
                        const month = monthKey.substring(0, 7); // YYYY-MM-01 -> YYYY-MM
                        monthDataMap.set(month, data);
                    }
                    cacheMonthlyKPIs(platform, monthDataMap, brand, location)
                        .catch(err => console.warn('Failed to cache monthly KPIs:', err.message));
                    // ===== END CACHE STORAGE =====

                    return dataByMonth;
                };

                // Fetch ALL months data in ONE query (current + MoM + last 7 months)
                const timerLabel = `[Performance KPIs] Bulk GROUP BY Fetch ${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                console.time(timerLabel);

                const earliestDate = last7Months[0].start;

                // Generate unique key for this specific computation - handle arrays
                const brandKey = Array.isArray(brand) ? brand.sort().join(',') : (brand || 'null');
                const locationKey = Array.isArray(location) ? location.sort().join(',') : (location || 'null');
                const coalesceKey = `perf-kpi:${platform}:${earliestDate.format('YYYY-MM')}:${endDate.format('YYYY-MM')}:${brandKey}:${locationKey}`;

                // Use coalesceRequest to prevent cache stampede
                let bulkData;
                try {
                    bulkData = await coalesceRequest(coalesceKey, async () =>
                        await getBulkPerformanceMetrics(earliestDate, endDate, { brand, platform, location })
                    );
                } catch (err) {
                    console.error('[Bulk Performance KPIs] Error:', err.message);
                    bulkData = new Map(); // Empty map on error
                }

                console.timeEnd(timerLabel);
                console.log(`[Performance KPIs] Fetched ${bulkData.size} months of data in single query`);

                // Helper functions to extract data from bulk results
                // FIXED: Sum data for ALL months in the date range
                const getDataForRange = (start, end) => {
                    const result = {
                        sales: 0, adSales: 0, orders: 0, clicks: 0, impressions: 0, spend: 0
                    };

                    // Iterate through all months in the range and sum the values
                    let current = start.clone().startOf('month');
                    const endMonth = end.clone().endOf('month');

                    while (current.isBefore(endMonth) || current.isSame(endMonth, 'month')) {
                        const monthKey = current.format('YYYY-MM-01');
                        const monthData = bulkData.get(monthKey);

                        if (monthData) {
                            result.sales += monthData.sales || 0;
                            result.adSales += monthData.adSales || 0;
                            result.orders += monthData.orders || 0;
                            result.clicks += monthData.clicks || 0;
                            result.impressions += monthData.impressions || 0;
                            result.spend += monthData.spend || 0;
                        }

                        current = current.add(1, 'month');
                    }

                    return result;
                };

                const calculateInorganicSales = (data) => {
                    return data.adSales; // sum(Ad_Sales) - absolute value
                };

                const calculateConversion = (data) => {
                    return data.clicks > 0 ? data.orders / data.clicks : 0; // Orders / Clicks
                };

                const calculateRoas = (data) => {
                    return data.spend > 0 ? data.adSales / data.spend : 0;
                };

                const calculateBmi = (data) => {
                    return data.sales > 0 ? (data.spend / data.sales) * 100 : 0;
                };

                // Extract data for current and MoM periods
                const currentData = getDataForRange(startDate, endDate);
                const momData = getDataForRange(momStartDate, momEndDate);

                // Calculate trend data for all KPIs from bulk results
                const inorgTrendData = last7Months.map(m => calculateInorganicSales(getDataForRange(m.start, m.end)));
                const convTrendData = last7Months.map(m => calculateConversion(getDataForRange(m.start, m.end)));
                const roasTrendData = last7Months.map(m => calculateRoas(getDataForRange(m.start, m.end)));
                const bmiTrendData = last7Months.map(m => calculateBmi(getDataForRange(m.start, m.end)));

                // Calculate current and MoM values for each KPI
                const currentInorg = calculateInorganicSales(currentData);
                const momInorg = calculateInorganicSales(momData);
                const inorgChange = momInorg > 0 ? ((currentInorg - momInorg) / momInorg) * 100 : (currentInorg > 0 ? 100 : 0);

                const currentConv = calculateConversion(currentData);
                const momConv = calculateConversion(momData);
                const convChange = momConv > 0 ? ((currentConv - momConv) / momConv) * 100 : (currentConv > 0 ? 100 : 0);

                const currentRoas = calculateRoas(currentData);
                const momRoas = calculateRoas(momData);
                const roasChange = momRoas > 0 ? ((currentRoas - momRoas) / momRoas) * 100 : (currentRoas > 0 ? 100 : 0);

                const currentBmi = calculateBmi(currentData);
                const momBmi = calculateBmi(momData);
                const bmiChange = momBmi > 0 ? ((currentBmi - momBmi) / momBmi) * 100 : (currentBmi > 0 ? 100 : 0);

                // SOS KPI (still needs separate queries for now - different table)
                const currentSosKpi = currentShareOfSearch;
                const momSosKpi = await getShareOfSearch(momStartDate, momEndDate, brand, platform, location, category);
                const sosKpiChange = momSosKpi > 0 ? ((currentSosKpi - momSosKpi) / momSosKpi) * 100 : (currentSosKpi > 0 ? 100 : 0);

                // OPTIMIZED: SOS Trend using bulk GROUP BY query instead of 7 individual queries
                let sosTrendKpiData;
                try {
                    const sosEscapeStr = (str) => str ? str.replace(/'/g, "''") : '';
                    const sosStartDate = last7Months[0].start;
                    const sosEndDate = last7Months[6].end;

                    const sosBaseConds = [
                        `toDate(kw_crawl_date) BETWEEN '${sosStartDate.format('YYYY-MM-DD')}' AND '${sosEndDate.format('YYYY-MM-DD')}'`
                    ];
                    if (platform && platform !== 'All') sosBaseConds.push(`platform_name = '${sosEscapeStr(platform)}'`);
                    if (location && location !== 'All') sosBaseConds.push(`location_name = '${sosEscapeStr(location)}'`);
                    if (category && category !== 'All') sosBaseConds.push(`keyword_category = '${sosEscapeStr(category)}'`);

                    const sosNumConds = [...sosBaseConds];
                    const brandArrLocal = Array.isArray(brand) ? brand : (brand && brand !== 'All' ? [brand] : null);
                    if (brandArrLocal && brandArrLocal.length > 0) {
                        if (brandArrLocal.length === 1) {
                            sosNumConds.push(`brand_name = '${sosEscapeStr(brandArrLocal[0])}'`);
                        } else {
                            sosNumConds.push(`brand_name IN (${brandArrLocal.map(b => `'${sosEscapeStr(b)}'`).join(', ')})`);
                        }
                    } else {
                        sosNumConds.push(`toString(keyword_is_rb_product) = '1'`);
                    }

                    // 2 queries instead of 14
                    const [sosNumByMonth, sosDenomByMonth] = await Promise.all([
                        queryClickHouse(`
                            SELECT formatDateTime(toDate(kw_crawl_date), '%Y-%m-01') as month, count() as count
                            FROM rb_kw WHERE ${sosNumConds.join(' AND ')}
                            GROUP BY formatDateTime(toDate(kw_crawl_date), '%Y-%m-01')
                        `),
                        queryClickHouse(`
                            SELECT formatDateTime(toDate(kw_crawl_date), '%Y-%m-01') as month, count() as count
                            FROM rb_kw WHERE ${sosBaseConds.join(' AND ')}
                            GROUP BY formatDateTime(toDate(kw_crawl_date), '%Y-%m-01')
                        `)
                    ]);

                    const sosNumMap = new Map(sosNumByMonth.map(r => [r.month, parseInt(r.count)]));
                    const sosDenomMap = new Map(sosDenomByMonth.map(r => [r.month, parseInt(r.count)]));

                    sosTrendKpiData = last7Months.map(m => {
                        const monthKey = m.start.format('YYYY-MM-01');
                        const num = sosNumMap.get(monthKey) || 0;
                        const denom = sosDenomMap.get(monthKey) || 0;
                        return denom > 0 ? (num / denom) * 100 : 0;
                    });

                    console.log(`[SOS Trend] OPTIMIZED: Fetched 7 months with 2 bulk queries`);
                } catch (err) {
                    console.error('[SOS Trend] Error:', err.message);
                    sosTrendKpiData = Array(7).fill(0);
                }

                // OSA KPI (uses availability data already computed)
                const currentOsa = currentAvailability;
                const momOsa = prevAvailability;
                const osaAbsChange = currentOsa - momOsa;

                // OPTIMIZED: OSA Trend using bulk GROUP BY query instead of 7 individual queries
                let osaTrendData;
                try {
                    const osaEscapeStr = (str) => str ? str.replace(/'/g, "''") : '';
                    const osaStartDate = last7Months[0].start;
                    const osaEndDate = last7Months[6].end;

                    const osaConds = [
                        `toDate(DATE) BETWEEN '${osaStartDate.format('YYYY-MM-DD')}' AND '${osaEndDate.format('YYYY-MM-DD')}'`
                    ];
                    const brandArrOsa = Array.isArray(brand) ? brand : (brand && brand !== 'All' ? [brand] : null);
                    if (brandArrOsa && brandArrOsa.length > 0) {
                        const brandConds = brandArrOsa.map(b => `Brand LIKE '%${osaEscapeStr(b)}%'`).join(' OR ');
                        osaConds.push(`(${brandConds})`);
                    } else {
                        osaConds.push(`toString(Comp_flag) = '0'`);
                    }
                    if (platform && platform !== 'All') osaConds.push(`Platform = '${osaEscapeStr(platform)}'`);
                    if (location && location !== 'All') osaConds.push(`Location = '${osaEscapeStr(location)}'`);
                    if (category && category !== 'All') osaConds.push(`Category = '${osaEscapeStr(category)}'`);

                    // 1 query instead of 7
                    const osaByMonth = await queryClickHouse(`
                        SELECT 
                            formatDateTime(toDate(DATE), '%Y-%m-01') as month,
                            SUM(ifNull(toFloat64(neno_osa), 0)) as total_neno,
                            SUM(ifNull(toFloat64(deno_osa), 0)) as total_deno
                        FROM rb_pdp_olap
                        WHERE ${osaConds.join(' AND ')}
                        GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                    `);

                    const osaMap = new Map(osaByMonth.map(r => [r.month, { neno: parseFloat(r.total_neno || 0), deno: parseFloat(r.total_deno || 0) }]));

                    osaTrendData = last7Months.map(m => {
                        const monthKey = m.start.format('YYYY-MM-01');
                        const data = osaMap.get(monthKey) || { neno: 0, deno: 0 };
                        return data.deno > 0 ? (data.neno / data.deno) * 100 : 0;
                    });

                    console.log(`[OSA Trend] OPTIMIZED: Fetched 7 months with 1 bulk query`);
                } catch (err) {
                    console.error('[OSA Trend] Error:', err.message);
                    osaTrendData = Array(7).fill(0);
                }

                let osaStatus = "stable";
                if (osaAbsChange > 1) osaStatus = "improving";
                else if (osaAbsChange < -1) osaStatus = "declining";

                // Build KPI cards
                // 1. Share of Search
                performanceMetricsKpis.push({
                    id: "sos_new",
                    label: "SHARE OF SEARCH",
                    value: `${currentSosKpi.toFixed(1)}%`,
                    unit: "",
                    tag: `${sosKpiChange >= 0 ? '+' : ''}${sosKpiChange.toFixed(1)}%`,
                    tagTone: sosKpiChange >= 0 ? "positive" : "warning",
                    footer: "Organic + Paid view",
                    trendTitle: "Share of Search Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: sosTrendKpiData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

                // 2. Inorganic Sales
                performanceMetricsKpis.push({
                    id: "inorganic",
                    label: "INORGANIC SALES",
                    value: formatCurrency(currentInorg),
                    unit: "",
                    tag: `${inorgChange >= 0 ? '+' : ''}${inorgChange.toFixed(1)}%`,
                    tagTone: inorgChange >= 0 ? "positive" : "warning",
                    footer: "sum(Ad_Sales)",
                    trendTitle: "Inorganic Sales Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: inorgTrendData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

                // 3. Conversion
                performanceMetricsKpis.push({
                    id: "conversion",
                    label: "CONVERSION",
                    value: currentConv.toFixed(1),
                    unit: "",
                    tag: `${convChange >= 0 ? '+' : ''}${convChange.toFixed(1)}%`,
                    tagTone: convChange >= 0 ? "positive" : "warning",
                    footer: "Clicks / Orders",
                    trendTitle: "Conversion Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: convTrendData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

                // 4. ROAS
                performanceMetricsKpis.push({
                    id: "roas_new",
                    label: "ROAS",
                    value: currentRoas.toFixed(1),
                    unit: "",
                    tag: `${roasChange >= 0 ? '+' : ''}${roasChange.toFixed(1)}%`,
                    tagTone: roasChange >= 0 ? "positive" : "warning",
                    footer: "Return on Ad Spend",
                    trendTitle: "ROAS Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: roasTrendData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

                // 5. BMI/Sales Ratio
                performanceMetricsKpis.push({
                    id: "bmi",
                    label: "BMI / SALES RATIO",
                    value: `${currentBmi.toFixed(1)}%`,
                    unit: "",
                    tag: `${bmiChange >= 0 ? '+' : ''}${bmiChange.toFixed(1)}%`,
                    tagTone: bmiChange < 0 ? "positive" : "warning", // Lower is better for BMI
                    footer: "Efficiency index",
                    trendTitle: "BMI / Sales Ratio Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: bmiTrendData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

            } catch (err) {
                console.error("Error calculating Performance Metrics KPIs:", err);
            }
        } // End of if (!skipPerformanceKpis)

        // ===== EARLY RETURN: Skip heavy sections when only overview is needed =====
        if (onlyOverview) {
            console.log('[computeSummaryMetrics] onlyOverview=true, skipping Platform/Month/Category/Brands sections');
            return {
                topMetrics,
                summaryMetrics,
                performanceMetricsKpis,
                skuTable: skuTableData,
                platformOverview: [],
                monthOverview: [],
                categoryOverview: [],
                brandsOverview: []
            };
        }
        // ===== END EARLY RETURN =====

        // 4. Platform Overview Calculation
        // Helper function to map platform names to logos
        const getPlatformLogo = (platformName) => {
            const logoMap = {
                'zepto': 'https://upload.wikimedia.org/wikipedia/en/7/7d/Logo_of_Zepto.png',
                'blinkit': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Blinkit-yellow-rounded.svg',
                'swiggy': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Swiggy_Logo_2024.webp',
                'amazon': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
                'flipkart': 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Flipkart-logo.png',
                'bigbasket': 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Bigbasket_logo.png',
                'jiomart': 'https://upload.wikimedia.org/wikipedia/commons/0/0e/JioMart_logo.png'
            };
            return logoMap[platformName.toLowerCase()] || 'https://cdn-icons-png.flaticon.com/512/3502/3502685.png';
        };

        // Helper function to determine platform type
        const getPlatformType = (platformName) => {
            const qCommercePlatforms = ['zepto', 'blinkit', 'swiggy instamart', 'dunzo'];
            const marketplacePlatforms = ['amazon', 'flipkart', 'swiggy', 'bigbasket', 'jiomart'];

            const lowerName = platformName.toLowerCase();
            if (qCommercePlatforms.some(p => lowerName.includes(p))) return 'Q-commerce';
            if (marketplacePlatforms.some(p => lowerName.includes(p))) return 'Marketplace';
            return 'E-commerce';
        };

        // Fetch all distinct platforms from rca_sku_dim table (as per user requirement)
        let platformDefinitions = [];
        try {
            // Check cache first
            const cachedPlatforms = await getCachedDistinctPlatforms();
            if (cachedPlatforms) {
                platformDefinitions = cachedPlatforms;
            } else {
                // Fetch platforms from rca_sku_dim table using ClickHouse
                const platformsFromDb = await queryClickHouse(`
                    SELECT DISTINCT platform FROM rca_sku_dim WHERE platform IS NOT NULL AND platform != '' ORDER BY platform
                `);

                // Build platform definitions from database results
                platformDefinitions = platformsFromDb
                    .map(p => p.platform)
                    .filter(p => p && p.trim())  // Filter out empty/null values
                    .map(platformName => ({
                        key: platformName.toLowerCase().replace(/\s+/g, '_'),
                        label: platformName.charAt(0).toUpperCase() + platformName.slice(1),  // Capitalize first letter
                        type: getPlatformType(platformName),
                        logo: getPlatformLogo(platformName)
                    }));

                // Cache the result
                cacheDistinctPlatforms(platformDefinitions);
                console.log(`[Platform Overview] Fetched ${platformDefinitions.length} platforms from rca_sku_dim:`, platformDefinitions.map(p => p.label));
            }
        } catch (err) {
            console.error("Error fetching platforms from database:", err);
            // Fallback to hardcoded platforms if database query fails
            platformDefinitions = [
                { key: 'zepto', label: 'Zepto', type: 'Q-commerce', logo: getPlatformLogo('zepto') },
                { key: 'blinkit', label: 'Blinkit', type: 'Q-commerce', logo: getPlatformLogo('blinkit') },
                { key: 'swiggy', label: 'Swiggy', type: 'Marketplace', logo: getPlatformLogo('swiggy') },
                { key: 'amazon', label: 'Amazon', type: 'Marketplace', logo: getPlatformLogo('amazon') }
            ];
        }

        const platformOverview = [];

        // Helper functions for change calculations
        const calcChange = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        const calcPPChange = (current, previous) => {
            return current - previous; // Percentage point change
        };

        const formatChange = (changeValue, isPercentagePoint = false) => {
            const suffix = isPercentagePoint ? ' pp' : '%';
            const sign = changeValue >= 0 ? '+' : '';
            return `${sign}${changeValue.toFixed(1)}${suffix}`;
        };

        // Helper to generate columns structure with MoM changes
        const generateColumns = (
            // Current period values
            offtake, availability, sos, marketShare = 0, spend = 0, roas = 0, inorgSales = 0,
            conversion = 0, cpm = 0, cpc = 0, promoMyBrand = 0, promoCompete = 0,
            // Previous period values (for MoM calculation)
            prevOfftake = 0, prevAvailability = 0, prevSos = 0, prevMarketShare = 0,
            prevSpend = 0, prevRoas = 0, prevInorgSales = 0, prevConversion = 0,
            prevCpm = 0, prevCpc = 0, prevPromoMyBrand = 0, prevPromoCompete = 0
        ) => {
            // Calculate changes
            const offtakeChange = calcChange(offtake, prevOfftake);
            const spendChange = calcChange(spend, prevSpend);
            const roasChange = calcChange(roas, prevRoas);
            const inorgSalesChange = calcChange(inorgSales, prevInorgSales);
            const conversionChange = calcPPChange(conversion, prevConversion);
            const availabilityChange = calcPPChange(availability, prevAvailability);
            const sosChange = calcPPChange(sos, prevSos);
            const marketShareChange = calcPPChange(marketShare, prevMarketShare);
            const promoMyBrandChange = calcPPChange(promoMyBrand, prevPromoMyBrand);
            const promoCompeteChange = calcPPChange(promoCompete, prevPromoCompete);
            const cpmChange = calcChange(cpm, prevCpm);
            const cpcChange = calcChange(cpc, prevCpc);

            return [
                {
                    title: "Offtakes",
                    value: formatCurrency(offtake),
                    change: { text: formatChange(offtakeChange), positive: offtakeChange >= 0 },
                    meta: { units: "units", change: formatChange(offtakeChange) }
                },
                {
                    title: "Spend",
                    value: formatCurrency(spend),
                    change: { text: formatChange(spendChange), positive: spendChange >= 0 },
                    meta: { units: "₹0", change: formatChange(spendChange) }
                },
                {
                    title: "ROAS",
                    value: `${roas.toFixed(2)}x`,
                    change: { text: formatChange(roasChange), positive: roasChange >= 0 },
                    meta: { units: "₹0 return", change: formatChange(roasChange) }
                },
                {
                    title: "Inorg Sales",
                    value: formatCurrency(inorgSales),
                    change: { text: formatChange(inorgSalesChange), positive: inorgSalesChange >= 0 },
                    meta: { units: "sum(Ad_Sales)", change: formatChange(inorgSalesChange) }
                },
                {
                    title: "Conversion",
                    value: `${conversion.toFixed(1)}%`,
                    change: { text: formatChange(conversionChange, true), positive: conversionChange >= 0 },
                    meta: { units: "0 conversions", change: formatChange(conversionChange, true) }
                },
                {
                    title: "Availability",
                    value: `${availability.toFixed(1)}%`,
                    change: { text: formatChange(availabilityChange, true), positive: availabilityChange >= 0 },
                    meta: { units: "stores", change: formatChange(availabilityChange, true) }
                },
                {
                    title: "SOS",
                    value: `${sos.toFixed(1)}%`,
                    change: { text: formatChange(sosChange, true), positive: sosChange >= 0 },
                    meta: { units: "index", change: formatChange(sosChange, true) }
                },
                {
                    title: "Market Share",
                    value: `${(parseFloat(marketShare) || 0).toFixed(1)}%`,
                    change: { text: formatChange(marketShareChange, true), positive: marketShareChange >= 0 },
                    meta: { units: "Category", change: formatChange(marketShareChange, true) }
                },
                {
                    title: "Promo My Brand",
                    value: `${promoMyBrand.toFixed(1)}%`,
                    change: { text: formatChange(promoMyBrandChange, true), positive: promoMyBrandChange >= 0 },
                    meta: { units: "Depth", change: formatChange(promoMyBrandChange, true) }
                },
                {
                    title: "Promo Compete",
                    value: `${promoCompete.toFixed(1)}%`,
                    change: { text: formatChange(promoCompeteChange, true), positive: promoCompeteChange >= 0 },
                    meta: { units: "Depth", change: formatChange(promoCompeteChange, true) }
                },
                {
                    title: "CPM",
                    value: `₹${Math.round(cpm)}`,
                    change: { text: formatChange(cpmChange), positive: cpmChange >= 0 },
                    meta: { units: "impressions", change: formatChange(cpmChange) }
                },
                {
                    title: "CPC",
                    value: `₹${Math.round(cpc)}`,
                    change: { text: formatChange(cpcChange), positive: cpcChange >= 0 },
                    meta: { units: "clicks", change: formatChange(cpcChange) }
                },
            ];
        };

        // Calculate "All" Metrics (Global Aggregate)
        // Note: For "All", we ignore the specific platform loop but respect the global filters (Brand, Location, Date)
        // However, if the user *selected* a platform in the main filter, "All" usually means "All Platforms" ignoring the platform filter?
        // Or does it mean "All Platforms" *within* the selected context?
        // Usually "Platform Overview" shows comparison across platforms, so "All" should likely be the aggregate of ALL platforms, regardless of the single platform filter.
        // But if the user selected "Zepto", the "All" column in a table comparing Zepto vs Blinkit vs Swiggy usually represents the Total of those rows.
        // Let's assume "All" means "All Platforms" (ignoring the platform filter for this specific column calculation).

        // Calculate MoM dates for All row comparison
        const allMomStart = startDate.clone().subtract(1, 'month');
        const allMomEnd = endDate.clone().subtract(1, 'month');

        let allOfftake = 0;
        let allAvailability = 0;
        let allSos = 0;
        let allMarketShare = 0;
        let allPromoMyBrand = 0;
        let allPromoCompete = 0;
        // Added missing KPIs for "All" column
        let allSpend = 0;
        let allAdSales = 0;
        let allRoas = 0;
        let allConversion = 0;
        let allCpm = 0;
        let allCpc = 0;

        // Previous period values for All row
        let prevAllOfftake = 0;
        let prevAllAvailability = 0;
        let prevAllSos = 0;
        let prevAllMarketShare = 0;
        let prevAllPromoMyBrand = 0;
        let prevAllPromoCompete = 0;
        let prevAllSpend = 0;
        let prevAllAdSales = 0;
        let prevAllRoas = 0;
        let prevAllConversion = 0;
        let prevAllCpm = 0;
        let prevAllCpc = 0;

        try {
            // Helper to escape strings for ClickHouse
            const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

            // Build ClickHouse conditions for current period
            const buildAllConditions = (startDt, endDt) => {
                const conditions = [`DATE BETWEEN '${startDt}' AND '${endDt}'`];
                if (brandArr && brandArr.length > 0) {
                    const brandConds = brandArr.map(b => `Brand LIKE '%${escapeStr(b)}%'`).join(' OR ');
                    conditions.push(`(${brandConds})`);
                } else {
                    conditions.push(`toString(Comp_flag) = '0'`);
                }
                if (location && location !== 'All') conditions.push(`Location = '${escapeStr(location)}'`);
                if (category && category !== 'All') conditions.push(`Category = '${escapeStr(category)}'`);
                return conditions.join(' AND ');
            };

            const currConditions = buildAllConditions(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));
            const prevConditions = buildAllConditions(allMomStart.format('YYYY-MM-DD'), allMomEnd.format('YYYY-MM-DD'));

            // Fetch current and previous period metrics in parallel using ClickHouse
            const [allMetricsResult, prevAllMetricsResult] = await Promise.all([
                queryClickHouse(`
                    SELECT 
                        SUM(ifNull(toFloat64(Sales), 0)) as total_sales,
                        SUM(ifNull(toFloat64(Ad_Spend), 0)) as total_spend,
                        SUM(ifNull(toFloat64(Ad_sales), 0)) as total_ad_sales,
                        SUM(ifNull(toFloat64(Ad_Clicks), 0)) as total_clicks,
                        SUM(ifNull(toFloat64(Ad_Impressions), 0)) as total_impressions
                    FROM rb_pdp_olap
                    WHERE ${currConditions}
                `),
                queryClickHouse(`
                    SELECT 
                        SUM(ifNull(toFloat64(Sales), 0)) as total_sales,
                        SUM(ifNull(toFloat64(Ad_Spend), 0)) as total_spend,
                        SUM(ifNull(toFloat64(Ad_sales), 0)) as total_ad_sales,
                        SUM(ifNull(toFloat64(Ad_Clicks), 0)) as total_clicks,
                        SUM(ifNull(toFloat64(Ad_Impressions), 0)) as total_impressions
                    FROM rb_pdp_olap
                    WHERE ${prevConditions}
                `)
            ]);

            // Current period values (ClickHouse returns array)
            const currMetrics = allMetricsResult[0] || {};
            allOfftake = parseFloat(currMetrics.total_sales || 0);
            allSpend = parseFloat(currMetrics.total_spend || 0);
            allAdSales = parseFloat(currMetrics.total_ad_sales || 0);
            const allClicks = parseFloat(currMetrics.total_clicks || 0);
            const allImpressions = parseFloat(currMetrics.total_impressions || 0);

            // Previous period values (ClickHouse returns array)
            const prevMetrics = prevAllMetricsResult[0] || {};
            prevAllOfftake = parseFloat(prevMetrics.total_sales || 0);
            prevAllSpend = parseFloat(prevMetrics.total_spend || 0);
            prevAllAdSales = parseFloat(prevMetrics.total_ad_sales || 0);
            const prevAllClicks = parseFloat(prevMetrics.total_clicks || 0);
            const prevAllImpressions = parseFloat(prevMetrics.total_impressions || 0);

            // Calculate derived KPIs - Current
            allRoas = allSpend > 0 ? allAdSales / allSpend : 0;
            allConversion = allImpressions > 0 ? (allClicks / allImpressions) * 100 : 0;
            allCpm = allImpressions > 0 ? (allSpend / allImpressions) * 1000 : 0;
            allCpc = allClicks > 0 ? allSpend / allClicks : 0;

            // Calculate derived KPIs - Previous
            prevAllRoas = prevAllSpend > 0 ? prevAllAdSales / prevAllSpend : 0;
            prevAllConversion = prevAllImpressions > 0 ? (prevAllClicks / prevAllImpressions) * 100 : 0;
            prevAllCpm = prevAllImpressions > 0 ? (prevAllSpend / prevAllImpressions) * 1000 : 0;
            prevAllCpc = prevAllClicks > 0 ? prevAllSpend / prevAllClicks : 0;

            // 2. All Availability (current and previous in parallel)
            const [currAvail, prevAvail] = await Promise.all([
                getAvailability(startDate, endDate, brand, null, location, category),
                getAvailability(allMomStart, allMomEnd, brand, null, location, category)
            ]);
            allAvailability = currAvail;
            prevAllAvailability = prevAvail;

            // 3. All SOS (current and previous in parallel)
            const [currSos, prevSos] = await Promise.all([
                getShareOfSearch(startDate, endDate, brand, null, location, category),
                getShareOfSearch(allMomStart, allMomEnd, brand, null, location, category)
            ]);
            allSos = currSos;
            prevAllSos = prevSos;

            // 4. All Market Share using formula: (selected_brand_sales / total_sales) * 100
            // When a specific brand is selected, show that brand's market share
            // When 'All' is selected, show all our brands' combined market share
            const validBrandNamesForMS = await getCachedValidBrandNames();

            // Determine which brands to use for numerator
            const brandsForMsNumerator = (brand && brand !== 'All')
                ? (Array.isArray(brand) ? brand : [brand])  // Use selected brand(s)
                : validBrandNamesForMS;  // Use all our brands

            // Build ClickHouse conditions for market share queries
            const buildMsConditions = (startDt, endDt) => {
                const conds = [
                    `created_on BETWEEN '${startDt}' AND '${endDt}'`,
                    `sales IS NOT NULL`
                ];
                if (platform && platform !== 'All') conds.push(`Platform = '${escapeStr(platform)}'`);
                if (location && location !== 'All') conds.push(`Location = '${escapeStr(location)}'`);
                if (category && category !== 'All') conds.push(`category = '${escapeStr(category)}'`);
                return conds.join(' AND ');
            };

            const currMsConds = buildMsConditions(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));
            const prevMsConds = buildMsConditions(allMomStart.format('YYYY-MM-DD'), allMomEnd.format('YYYY-MM-DD'));
            const brandInClause = brandsForMsNumerator.map(b => `'${escapeStr(b)}'`).join(', ');

            const [currOurSales, currTotalSales, prevOurSales, prevTotalSales] = await Promise.all([
                // Current period: Selected brand sales (or all our brands if brand='All')
                queryClickHouse(`SELECT SUM(toFloat64OrZero(sales)) as our_sales FROM rb_brand_ms WHERE ${currMsConds} AND brand IN (${brandInClause})`),
                // Current period: Total market sales
                queryClickHouse(`SELECT SUM(toFloat64OrZero(sales)) as total_sales FROM rb_brand_ms WHERE ${currMsConds}`),
                // Previous period: Selected brand sales
                queryClickHouse(`SELECT SUM(toFloat64OrZero(sales)) as our_sales FROM rb_brand_ms WHERE ${prevMsConds} AND brand IN (${brandInClause})`),
                // Previous period: Total market sales
                queryClickHouse(`SELECT SUM(toFloat64OrZero(sales)) as total_sales FROM rb_brand_ms WHERE ${prevMsConds}`)
            ]);

            const currOur = parseFloat(currOurSales[0]?.our_sales || 0);
            const currTotal = parseFloat(currTotalSales[0]?.total_sales || 0);
            const prevOur = parseFloat(prevOurSales[0]?.our_sales || 0);
            const prevTotal = parseFloat(prevTotalSales[0]?.total_sales || 0);

            allMarketShare = currTotal > 0 ? (currOur / currTotal) * 100 : 0;
            prevAllMarketShare = prevTotal > 0 ? (prevOur / prevTotal) * 100 : 0;

            // Calculate Promo My Brand for "All" platforms (Comp_flag = 0)
            const promoAllBrandCondition = buildBrandLikeCondition(brandArr);
            if (promoAllBrandCondition) {
                const allPromoMyBrandWhere = {
                    DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                    Brand: promoAllBrandCondition,
                    Comp_flag: 0
                };
                const locCondition = buildMultiValueCondition(locationArr);
                if (locCondition) allPromoMyBrandWhere.Location = locCondition;
                if (category && category !== 'All') allPromoMyBrandWhere.Category = category;

                const allPromoMyBrandResult = await RbPdpOlap.findOne({
                    attributes: [[Sequelize.fn('AVG', Sequelize.literal('CASE WHEN MRP > 0 THEN (MRP - Selling_Price) / MRP ELSE 0 END')), 'avg_promo_depth']],
                    where: allPromoMyBrandWhere,
                    raw: true
                });
                allPromoMyBrand = parseFloat(allPromoMyBrandResult?.avg_promo_depth || 0) * 100;
            }

            // Calculate Promo Compete for "All" platforms (Comp_flag = 1)
            const allPromoCompeteWhere = {
                DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                Comp_flag: 1
            };
            if (location && location !== 'All') allPromoCompeteWhere.Location = location;
            if (category && category !== 'All') allPromoCompeteWhere.Category = category;
            if (brand && brand !== 'All') {
                allPromoCompeteWhere.Brand = { [Op.notLike]: `%${brand}%` };
            }

            const allPromoCompeteResult = await RbPdpOlap.findOne({
                attributes: [[Sequelize.fn('AVG', Sequelize.literal('CASE WHEN MRP > 0 THEN (MRP - Selling_Price) / MRP ELSE 0 END')), 'avg_promo_depth']],
                where: allPromoCompeteWhere,
                raw: true
            });
            allPromoCompete = parseFloat(allPromoCompeteResult?.avg_promo_depth || 0) * 100;

        } catch (err) {
            console.error("Error calculating All metrics:", err);
        }

        platformOverview.push({
            key: 'all',
            label: 'All',
            type: 'Overall',
            logo: "https://cdn-icons-png.flaticon.com/512/711/711284.png",
            columns: generateColumns(
                allOfftake, allAvailability, allSos, allMarketShare,
                allSpend, allRoas, allOfftake > 0 ? (allAdSales / allOfftake) * 100 : 0, allConversion, allCpm, allCpc,
                allPromoMyBrand, allPromoCompete,
                // Previous period values for proper MoM comparison
                prevAllOfftake, prevAllAvailability, prevAllSos, prevAllMarketShare,
                prevAllSpend, prevAllRoas, prevAllOfftake > 0 ? (prevAllAdSales / prevAllOfftake) * 100 : 0, prevAllConversion, prevAllCpm, prevAllCpc,
                prevAllPromoMyBrand, prevAllPromoCompete
            )
        });

        // ⚡ PHASE 2 OPTIMIZATION: Bulk Platform Metrics
        // Fetch ALL platform metrics at once (4 queries instead of 90)
        console.log(`[Platform Overview] Starting bulk fetch for ${platformDefinitions.length} platforms...`);
        const platformBulkTimerLabel = `[Platform Overview] Bulk Fetch Total ${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        console.time(platformBulkTimerLabel);

        // Calculate MoM dates or use provided comparison dates
        let momStart = startDate.clone().subtract(1, 'month');
        let momEnd = endDate.clone().subtract(1, 'month');

        if (qCompareStartDate && qCompareEndDate) {
            momStart = dayjs(qCompareStartDate).startOf('day');
            momEnd = dayjs(qCompareEndDate).endOf('day');
        }

        // Use coalesceRequest to prevent cache stampede
        const platformCoalesceKey = `platform:${startDate.format('YYYY-MM-DD')}:${endDate.format('YYYY-MM-DD')}:${brand}:${location}:${category}`;
        const bulkPlatformMap = await coalesceRequest(platformCoalesceKey, () =>
            getBulkPlatformMetrics(
                platformDefinitions.map(p => p.label),
                startDate, endDate,
                momStart, momEnd,
                { brand, location, category }
            )
        );

        // ⚠️ OPTIMIZATION: Skip platform-level SOS calculation
        // SOS is a brand metric, not a platform metric. The previous code incorrectly 
        // passed platform names (Zepto, Blinkit) as brand names, causing 2+ minute 
        // queries that returned nothing. Platform SOS will be set to 0.
        // For accurate per-platform SOS, use getShareOfSearch with platform filter.
        const platformSosMap = new Map(); // Empty map - platform SOS not meaningful

        console.timeEnd(platformBulkTimerLabel);
        console.log(`[Platform Overview] Bulk fetch complete. Now processing ${platformDefinitions.length} platforms in-memory...`);

        const platformOverviewPromises = platformDefinitions.map(async (p) => {
            try {
                // ⚡ Get pre-computed metrics from bulk maps (NO DATABASE QUERIES!)
                const metrics = bulkPlatformMap.get(p.label) || { curr: {}, prev: {} };
                const sosData = platformSosMap.get(p.label) || { current: 0, previous: 0 };

                // Current period metrics (from bulk fetch)
                const offtake = metrics.curr.sales;
                const totalSpend = metrics.curr.spend;
                const totalAdSales = metrics.curr.adSales;
                const totalClicks = metrics.curr.clicks;
                const totalImpressions = metrics.curr.impressions;
                const marketShare = metrics.curr.ms;
                const sos = sosData.current;

                // Availability calculation (in-memory)
                const availability = metrics.curr.deno > 0
                    ? (metrics.curr.neno / metrics.curr.deno) * 100
                    : 0;

                // Calculate ROAS: Total Ad Sales / Total Spend
                const roas = totalSpend > 0 ? totalAdSales / totalSpend : 0;

                // Calculate Conversion: (Total Ad Clicks / Total Ad Impressions) * 100
                const conversion = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

                // Calculate CPM: (Total Ad Spend / Total Ad Impressions) * 1000
                const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

                // Calculate CPC: Total Ad Spend / Total Ad Clicks
                const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;


                // ===== PROMO METRICS =====
                // Note: Promo metrics still require individual queries as they use Comp_flag filtering
                // which is not included in bulk aggregation
                const platformOfftakeWhere = {
                    DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                    Platform: p.label
                };
                const platformBrandCondition = buildBrandLikeCondition(brandArr);
                if (platformBrandCondition) platformOfftakeWhere.Brand = platformBrandCondition;
                const platLocCondition = buildMultiValueCondition(locationArr);
                if (platLocCondition) platformOfftakeWhere.Location = platLocCondition;
                if (category && category !== 'All') platformOfftakeWhere.Category = category;

                // ⚡ Fetch both promo metrics concurrently
                const [promoMyBrandResult, promoCompeteResult] = await Promise.all([
                    // Promo My Brand: Own brand promo depth (Comp_flag = 0)
                    (brand && brand !== 'All') ? RbPdpOlap.findOne({
                        attributes: [[Sequelize.fn('AVG', Sequelize.literal('CASE WHEN MRP > 0 THEN (MRP - Selling_Price) / MRP ELSE 0 END')), 'avg_promo_depth']],
                        where: {
                            ...platformOfftakeWhere,
                            Comp_flag: 0
                        },
                        raw: true
                    }) : Promise.resolve(null),

                    // Promo Compete: Competitor promo depth (Comp_flag = 1)
                    RbPdpOlap.findOne({
                        attributes: [[Sequelize.fn('AVG', Sequelize.literal('CASE WHEN MRP > 0 THEN (MRP - Selling_Price) / MRP ELSE 0 END')), 'avg_promo_depth']],
                        where: {
                            DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                            Platform: p.label,
                            Comp_flag: 1,
                            ...(location && location !== 'All' && { Location: location }),
                            ...(category && category !== 'All' && { Category: category }),
                            ...(brand && brand !== 'All' && { Brand: { [Op.notLike]: `%${brand}%` } })
                        },
                        raw: true
                    })
                ]);

                const promoMyBrand = parseFloat(promoMyBrandResult?.avg_promo_depth || 0) * 100;
                const promoCompete = parseFloat(promoCompeteResult?.avg_promo_depth || 0) * 100;
                console.log(`[${p.label}] Promo My Brand: ${promoMyBrand}, Promo Compete: ${promoCompete}`);

                // ===== PREVIOUS PERIOD (MoM) CALCULATIONS =====
                // Get from pre-computed bulk maps (NO DATABASE QUERIES!)
                const prevOfftake = metrics.prev.sales;
                const prevSpend = metrics.prev.spend;
                const prevAdSales = metrics.prev.adSales;
                const prevMarketShare = metrics.prev.ms;
                const prevImpressions = metrics.prev.impressions;
                const prevSos = sosData.previous;

                const prevAvailability = metrics.prev.deno > 0
                    ? (metrics.prev.neno / metrics.prev.deno) * 100
                    : 0;

                const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;

                // Calculate previous period derived metrics from bulk data
                const prevClicks = metrics.prev.clicks;
                const prevConversion = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
                const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
                const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;

                // Promo metrics not in bulk data - set to 0 for now (can be optimized later)
                const prevPromoMyBrand = 0;
                const prevPromoCompete = 0;

                // Use absolute Ad_Sales for Inorg Sales (matching Performance Matrix formula)
                const currInorgSales = totalAdSales;
                const prevInorgSales = prevAdSales;

                return {
                    key: p.key,
                    label: p.label,
                    type: p.type,
                    logo: p.logo,
                    columns: generateColumns(
                        // Current period
                        offtake, availability, sos, marketShare, totalSpend, roas, currInorgSales, conversion, cpm, cpc, promoMyBrand, promoCompete,
                        // Previous period
                        prevOfftake, prevAvailability, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales, prevConversion, prevCpm, prevCpc, prevPromoMyBrand, prevPromoCompete
                    )
                };
            } catch (err) {
                console.error(`Error processing platform ${p.key}:`, err);
                return {
                    key: p.key,
                    label: p.label,
                    type: p.type,
                    logo: p.logo,
                    columns: generateColumns(0, 0, 0, 0) // Fallback
                };
            }
        });

        platformOverview.push(...(await Promise.all(platformOverviewPromises)));

        // 6. Month Overview Calculation
        // Use the selected platform filter from main filters. If "All" is selected, use monthOverviewPlatform.
        // Priority: monthOverviewPlatform > platform > first available platform
        const moPlatform = filters.monthOverviewPlatform ||
            (platform && platform !== 'All' ? platform : null);

        // If no specific platform is selected (All), skip month overview as it requires a specific platform
        if (!moPlatform) {
            console.log("Month Overview: Skipping - no specific platform selected (Platform is 'All')");
        } else {
            console.log("Calculating Month Overview for Platform:", moPlatform);
        }

        // Generate columns helper for Month Overview (similar to generateColumns but for a single month row)
        // Generate columns helper for Month Overview (similar to generateColumns but for a single month row)
        const generateMonthColumns = (offtake, availability, sos, marketShare, spend = 0, roas = 0, inorgSales = 0, conversion = 0, cpm = 0, cpc = 0) => [
            { title: "Offtakes", value: formatCurrency(offtake), meta: { units: "", change: "▲0.0%" } },
            { title: "Spend", value: formatCurrency(spend), meta: { units: "", change: "▲0.0%" } },
            { title: "ROAS", value: `${roas.toFixed(2)}x`, meta: { units: "", change: "▲0.0%" } },
            { title: "Inorg Sales", value: formatCurrency(inorgSales), meta: { units: "", change: "▲0.0%" } },
            { title: "Conversion", value: `${conversion.toFixed(1)}%`, meta: { units: "", change: "▲0.0 pp" } },
            { title: "Availability", value: `${availability.toFixed(1)}%`, meta: { units: "", change: "▲0.0 pp" } },
            { title: "SOS", value: `${sos.toFixed(1)}%`, meta: { units: "", change: "▲0.0 pp" } },
            { title: "Market Share", value: `${marketShare.toFixed(1)}%`, meta: { units: "", change: "▲0.0 pp" } },
            { title: "Promo My Brand", value: "0%", meta: { units: "", change: "▲0.0 pp" } }, // Mock
            { title: "Promo Compete", value: "0%", meta: { units: "", change: "▲0.0 pp" } }, // Mock
            { title: "CPM", value: `₹${Math.round(cpm)}`, meta: { units: "", change: "▲0.0%" } },
            { title: "CPC", value: `₹${Math.round(cpc)}`, meta: { units: "", change: "▲0.0%" } }
        ];

        // OPTIMIZED: Bulk month overview with GROUP BY instead of per-month queries
        let monthOverview = [];

        if (!moPlatform) {
            // No specific platform - return empty month overview
            monthOverview = monthBuckets.map(bucket => ({
                key: bucket.label,
                label: bucket.label,
                type: bucket.label,
                logo: "",
                columns: generateMonthColumns(0, 0, 0, 0)
            }));
        } else {
            console.log(`[Month Overview] OPTIMIZED: Fetching all months in ${monthBuckets.length} bulk queries`);

            // Helper to escape strings for ClickHouse
            const escapeStrMo = (str) => str ? str.replace(/'/g, "''") : '';

            // Build base conditions for rb_pdp_olap
            const buildPdpConditions = () => {
                const conds = [];
                conds.push(`Platform = '${escapeStrMo(moPlatform)}'`);
                if (brandArr && brandArr.length > 0) {
                    const brandConds = brandArr.map(b => `Brand LIKE '%${escapeStrMo(b)}%'`).join(' OR ');
                    conds.push(`(${brandConds})`);
                } else {
                    conds.push(`toString(Comp_flag) = '0'`);
                }
                if (locationArr && locationArr.length > 0) {
                    if (locationArr.length === 1) {
                        conds.push(`Location = '${escapeStrMo(locationArr[0])}'`);
                    } else {
                        conds.push(`Location IN (${locationArr.map(l => `'${escapeStrMo(l)}'`).join(', ')})`);
                    }
                }
                if (category && category !== 'All') conds.push(`Category = '${escapeStrMo(category)}'`);
                return conds;
            };

            const pdpConds = buildPdpConditions();
            const dateRangeCondition = `toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`;

            try {
                // Execute 4 bulk queries in parallel (instead of 28 individual queries)
                const [offtakeByMonth, availByMonth, sosByMonth, msByMonth] = await Promise.all([
                    // Query 1: Offtake metrics grouped by month
                    queryClickHouse(`
                        SELECT 
                            formatDateTime(toDate(DATE), '%Y-%m-01') as month,
                            SUM(ifNull(toFloat64(Sales), 0)) as total_sales,
                            SUM(ifNull(toFloat64(Ad_Spend), 0)) as total_spend,
                            SUM(ifNull(toFloat64(Ad_sales), 0)) as total_ad_sales,
                            SUM(ifNull(toFloat64(Ad_Clicks), 0)) as total_clicks,
                            SUM(ifNull(toFloat64(Ad_Impressions), 0)) as total_impressions
                        FROM rb_pdp_olap
                        WHERE ${dateRangeCondition} AND ${pdpConds.join(' AND ')}
                        GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                    `),
                    // Query 2: Availability grouped by month
                    queryClickHouse(`
                        SELECT 
                            formatDateTime(toDate(DATE), '%Y-%m-01') as month,
                            SUM(ifNull(toFloat64(neno_osa), 0)) as total_neno,
                            SUM(ifNull(toFloat64(deno_osa), 0)) as total_deno
                        FROM rb_pdp_olap
                        WHERE ${dateRangeCondition} AND ${pdpConds.join(' AND ')}
                        GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                    `),
                    // Query 3: SOS grouped by month (numerator and denominator)
                    (async () => {
                        const sosBaseConds = [
                            `toDate(kw_crawl_date) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
                            `platform_name = '${escapeStrMo(moPlatform)}'`
                        ];
                        if (category && category !== 'All') sosBaseConds.push(`keyword_category = '${escapeStrMo(category)}'`);
                        if (locationArr && locationArr.length > 0) {
                            if (locationArr.length === 1) {
                                sosBaseConds.push(`location_name = '${escapeStrMo(locationArr[0])}'`);
                            } else {
                                sosBaseConds.push(`location_name IN (${locationArr.map(l => `'${escapeStrMo(l)}'`).join(', ')})`);
                            }
                        }

                        const sosNumConds = [...sosBaseConds];
                        if (brandArr && brandArr.length > 0) {
                            if (brandArr.length === 1) {
                                sosNumConds.push(`brand_name = '${escapeStrMo(brandArr[0])}'`);
                            } else {
                                sosNumConds.push(`brand_name IN (${brandArr.map(b => `'${escapeStrMo(b)}'`).join(', ')})`);
                            }
                        } else {
                            sosNumConds.push(`toString(keyword_is_rb_product) = '1'`);
                        }

                        const [numByMonth, denomByMonth] = await Promise.all([
                            queryClickHouse(`
                                SELECT formatDateTime(toDate(kw_crawl_date), '%Y-%m-01') as month, count() as count
                                FROM rb_kw WHERE ${sosNumConds.join(' AND ')}
                                GROUP BY formatDateTime(toDate(kw_crawl_date), '%Y-%m-01')
                            `),
                            queryClickHouse(`
                                SELECT formatDateTime(toDate(kw_crawl_date), '%Y-%m-01') as month, count() as count
                                FROM rb_kw WHERE ${sosBaseConds.join(' AND ')}
                                GROUP BY formatDateTime(toDate(kw_crawl_date), '%Y-%m-01')
                            `)
                        ]);
                        return { num: numByMonth, denom: denomByMonth };
                    })(),
                    // Query 4: Market Share grouped by month
                    (async () => {
                        const msConds = [
                            `toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
                            `Platform = '${escapeStrMo(moPlatform)}'`
                        ];
                        const brandArrMs = Array.isArray(brand) ? brand : (brand && brand !== 'All' ? [brand] : null);
                        if (brandArrMs && brandArrMs.length > 0) {
                            if (brandArrMs.length === 1) {
                                msConds.push(`brand = '${escapeStrMo(brandArrMs[0])}'`);
                            } else {
                                msConds.push(`brand IN (${brandArrMs.map(b => `'${escapeStrMo(b)}'`).join(', ')})`);
                            }
                        }
                        if (location && location !== 'All') msConds.push(`Location = '${escapeStrMo(location)}'`);

                        return await queryClickHouse(`
                            SELECT formatDateTime(toDate(created_on), '%Y-%m-01') as month, AVG(toFloat64(market_share)) as avg_ms
                            FROM rb_brand_ms
                            WHERE ${msConds.join(' AND ')}
                            GROUP BY formatDateTime(toDate(created_on), '%Y-%m-01')
                        `);
                    })()
                ]);

                // Build lookup maps
                const offtakeMap = new Map(offtakeByMonth.map(r => [r.month, r]));
                const availMap = new Map(availByMonth.map(r => [r.month, r]));
                const sosNumMap = new Map(sosByMonth.num.map(r => [r.month, parseInt(r.count)]));
                const sosDenomMap = new Map(sosByMonth.denom.map(r => [r.month, parseInt(r.count)]));
                const msMap = new Map(msByMonth.map(r => [r.month, parseFloat(r.avg_ms || 0)]));

                // Generate month overview from bulk data
                monthOverview = monthBuckets.map(bucket => {
                    const monthKey = dayjs(bucket.date).format('YYYY-MM-01');

                    const off = offtakeMap.get(monthKey) || {};
                    const moOfftake = parseFloat(off.total_sales || 0);
                    const moSpend = parseFloat(off.total_spend || 0);
                    const moAdSales = parseFloat(off.total_ad_sales || 0);
                    const moClicks = parseFloat(off.total_clicks || 0);
                    const moImpressions = parseFloat(off.total_impressions || 0);

                    const moRoas = moSpend > 0 ? moAdSales / moSpend : 0;
                    const moConversion = moImpressions > 0 ? (moClicks / moImpressions) * 100 : 0;
                    const moCpm = moImpressions > 0 ? (moSpend / moImpressions) * 1000 : 0;
                    const moCpc = moClicks > 0 ? moSpend / moClicks : 0;

                    const avail = availMap.get(monthKey) || {};
                    const neno = parseFloat(avail.total_neno || 0);
                    const deno = parseFloat(avail.total_deno || 0);
                    const moAvailability = deno > 0 ? (neno / deno) * 100 : 0;

                    const sosNum = sosNumMap.get(monthKey) || 0;
                    const sosDenom = sosDenomMap.get(monthKey) || 0;
                    const moSos = sosDenom > 0 ? (sosNum / sosDenom) * 100 : 0;

                    const moMarketShare = msMap.get(monthKey) || 0;

                    return {
                        key: bucket.label,
                        label: bucket.label,
                        date: bucket.date,
                        type: bucket.label,
                        logo: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png",
                        columns: generateMonthColumns(moOfftake, moAvailability, moSos, moMarketShare, moSpend, moRoas, moAdSales, moConversion, moCpm, moCpc)
                    };
                });

                console.log(`[Month Overview] OPTIMIZED: Processed ${monthBuckets.length} months with 4 bulk queries (vs ${monthBuckets.length * 4} individual queries)`);

            } catch (err) {
                console.error('[Month Overview] Error in bulk query:', err);
                monthOverview = monthBuckets.map(bucket => ({
                    key: bucket.label,
                    label: bucket.label,
                    type: bucket.label,
                    logo: "",
                    columns: generateMonthColumns(0, 0, 0, 0)
                }));
            }
        }
        // monthOverview.push(...monthOverviewResults); // Removed push to undefined variable

        // 13. Category Overview Logic
        const categoryOverviewPlatform = filters.categoryOverviewPlatform || filters.platform || 'Zepto';

        // Fetch unique categories based on filters from RcaSkuDim (status=1 only)
        const categoryWhere = { status: 1 };

        if (categoryOverviewPlatform && categoryOverviewPlatform !== 'All') {
            categoryWhere.platform = categoryOverviewPlatform;
        }
        if (brand && brand !== 'All') {
            categoryWhere.brand_name = { [Op.like]: `%${brand}%` };
        }
        // Note: RcaSkuDim might not have location, or it might be 'location' column. 
        // Assuming location filter is not strictly needed for category listing, or we check if column exists.
        // Based on model, it has 'location'.
        if (location && location !== 'All') {
            categoryWhere.location = location;
        }

        const distinctCategories = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Category')), 'Category']],
            where: categoryWhere,
            raw: true
        });

        const categories = distinctCategories.map(c => c.Category).filter(Boolean);
        console.log(`[Category Overview] Platform: ${categoryOverviewPlatform}, Found ${categories.length} categories:`, categories);

        const categoryOverviewPromises = categories.map(async (catName) => {
            try {
                // Build catWhere independently to avoid conflicts from offtakeWhereClause
                // (offtakeWhereClause may have different Platform filter or other conflicting filters)
                const catWhere = {
                    DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                    // Case-insensitive Category match
                    Category: catName
                };

                // Apply brand filter
                if (brand && brand !== 'All') {
                    catWhere.Brand = { [Op.like]: `%${brand}%` };
                } else {
                    catWhere.Comp_flag = 0; // Our brands only when "All" selected
                }

                // Apply location filter
                if (location && location !== 'All') {
                    catWhere.Location = location;
                }

                // Apply Platform filter from categoryOverviewPlatform (not platform)
                if (categoryOverviewPlatform && categoryOverviewPlatform !== 'All') {
                    catWhere.Platform = categoryOverviewPlatform;
                }

                console.log(`[Category Overview] Processing category: ${catName}, Platform: ${categoryOverviewPlatform}`);

                // Calculate Metrics for this Category
                const [
                    catOfftakeResult,
                    catAvailability,
                    catSos,
                    catMsResult,
                    catPromoMyBrandResult,
                    catPromoCompeteResult
                ] = await Promise.all([
                    // Offtake (Sales) & Ad Metrics
                    RbPdpOlap.findOne({
                        attributes: [
                            [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions']
                        ],
                        where: catWhere,
                        raw: true
                    }),
                    // Availability (OSA)
                    getAvailability(startDate, endDate, brand, categoryOverviewPlatform, location, catName),
                    // SOS
                    getShareOfSearch(startDate, endDate, brand, categoryOverviewPlatform, location, catName),
                    // Market Share - CALCULATED: (Our Brand Sales / Total Category Sales) × 100
                    // Query 1: Get our brand's sales in this category (Comp_flag = 0)
                    // Query 2: Get total sales in this category (all brands)
                    Promise.all([
                        // Our brand sales (Comp_flag = 0)
                        RbPdpOlap.findOne({
                            attributes: [[Sequelize.fn('SUM', Sequelize.col('Sales')), 'our_sales']],
                            where: {
                                DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                                Category: catName,
                                Comp_flag: 0,
                                ...(categoryOverviewPlatform && categoryOverviewPlatform !== 'All' && { Platform: categoryOverviewPlatform }),
                                ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
                                ...(location && location !== 'All' && { Location: location })
                            },
                            raw: true
                        }),
                        // Total category sales (all brands, both Comp_flag 0 and 1)
                        RbPdpOlap.findOne({
                            attributes: [[Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']],
                            where: {
                                DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                                Category: catName,
                                ...(categoryOverviewPlatform && categoryOverviewPlatform !== 'All' && { Platform: categoryOverviewPlatform }),
                                ...(location && location !== 'All' && { Location: location })
                            },
                            raw: true
                        })
                    ]),
                    // Promo My Brand (Comp_flag = 0)
                    RbPdpOlap.findOne({
                        attributes: [
                            [Sequelize.fn('AVG', Sequelize.literal('CASE WHEN MRP > 0 THEN (MRP - Selling_Price) / MRP ELSE 0 END')), 'avg_promo_depth']
                        ],
                        where: {
                            ...catWhere,
                            Comp_flag: 0
                        },
                        raw: true
                    }),
                    // Promo Compete (Comp_flag = 1)
                    RbPdpOlap.findOne({
                        attributes: [
                            [Sequelize.fn('AVG', Sequelize.literal('CASE WHEN MRP > 0 THEN (MRP - Selling_Price) / MRP ELSE 0 END')), 'avg_promo_depth']
                        ],
                        where: {
                            ...catWhere,
                            Comp_flag: 1
                        },
                        raw: true
                    })
                ]);

                const catOfftake = parseFloat(catOfftakeResult?.total_sales || 0);
                const catSpend = parseFloat(catOfftakeResult?.total_spend || 0);
                const catAdSales = parseFloat(catOfftakeResult?.total_ad_sales || 0); // Inorg Sales
                const catClicks = parseFloat(catOfftakeResult?.total_clicks || 0);
                const catImpressions = parseFloat(catOfftakeResult?.total_impressions || 0);

                // Market Share calculation: (Our Brand Sales / Total Category Sales) × 100
                // catMsResult is now an array: [ourSalesResult, totalSalesResult]
                const ourBrandSales = parseFloat(catMsResult?.[0]?.our_sales || 0);
                const totalCategorySales = parseFloat(catMsResult?.[1]?.total_sales || 0);
                const catMarketShare = totalCategorySales > 0 ? (ourBrandSales / totalCategorySales) * 100 : 0;

                const catPromoMyBrand = parseFloat(catPromoMyBrandResult?.avg_promo_depth || 0) * 100;
                const catPromoCompete = parseFloat(catPromoCompeteResult?.avg_promo_depth || 0) * 100;

                // Debug logging for troubleshooting
                console.log(`[Category Overview] ${catName}: Offtake=${catOfftake}, Spend=${catSpend}, AdSales=${catAdSales}, Clicks=${catClicks}, Impressions=${catImpressions}`);
                console.log(`[Category Overview] ${catName}: MarketShare=${catMarketShare.toFixed(1)}% (OurSales=${ourBrandSales}, TotalSales=${totalCategorySales})`);
                console.log(`[Category Overview] ${catName}: PromoMyBrand=${catPromoMyBrand.toFixed(1)}%, PromoCompete=${catPromoCompete.toFixed(1)}%`);

                // Calculate Metrics
                const catRoas = catSpend > 0 ? catAdSales / catSpend : 0;
                const catConversion = catImpressions > 0 ? (catClicks / catImpressions) * 100 : 0;
                const catCpm = catImpressions > 0 ? (catSpend / catImpressions) * 1000 : 0;
                const catCpc = catClicks > 0 ? catSpend / catClicks : 0;



                return {
                    key: catName,
                    label: catName,
                    type: catName,
                    logo: "https://cdn-icons-png.flaticon.com/512/3502/3502685.png",
                    columns: [
                        {
                            title: "Offtakes",
                            value: formatCurrency(catOfftake),
                            change: { text: "▲0.0%", positive: true }, // Placeholder for change
                            meta: { units: "units", change: "▲0.0%" }
                        },
                        {
                            title: "Spend",
                            value: formatCurrency(catSpend),
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "currency", change: "▲0.0%" }
                        },
                        {
                            title: "ROAS",
                            value: `${catRoas.toFixed(1)}x`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "return", change: "▲0.0%" }
                        },
                        {
                            title: "Inorg Sales",
                            value: catOfftake > 0 ? `${((catAdSales / catOfftake) * 100).toFixed(1)}%` : "0%",
                            change: { text: "▲0.0 pp", positive: true },
                            meta: { units: formatCurrency(catAdSales), change: "▲0.0 pp" }
                        },
                        {
                            title: "Conversion",
                            value: `${catConversion.toFixed(1)}%`,
                            change: { text: "▲0.0 pp", positive: true },
                            meta: { units: "conversions", change: "▲0.0 pp" }
                        },
                        {
                            title: "Availability",
                            value: `${catAvailability.toFixed(1)}%`,
                            change: { text: "▲0.0 pp", positive: true },
                            meta: { units: "stores", change: "▲0.0 pp" }
                        },
                        {
                            title: "SOS",
                            value: `${catSos.toFixed(1)}%`,
                            change: { text: "▲0.0 pp", positive: true },
                            meta: { units: "index", change: "▲0.0 pp" }
                        },
                        {
                            title: "Market Share",
                            value: `${catMarketShare.toFixed(1)}%`,
                            change: { text: "▲0.0 pp", positive: true },
                            meta: { units: "share", change: "▲0.0 pp" }
                        },
                        {
                            title: "Promo My Brand",
                            value: `${catPromoMyBrand.toFixed(1)}%`,
                            change: { text: "▲0.0 pp", positive: true },
                            meta: { units: "depth", change: "▲0.0 pp" }
                        },
                        {
                            title: "Promo Compete",
                            value: `${catPromoCompete.toFixed(1)}%`,
                            change: { text: "▲0.0 pp", positive: true },
                            meta: { units: "depth", change: "▲0.0 pp" }
                        },
                        {
                            title: "CPM",
                            value: formatCurrency(catCpm),
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "impressions", change: "▲0.0%" }
                        },
                        {
                            title: "CPC",
                            value: formatCurrency(catCpc),
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "clicks", change: "▲0.0%" }
                        }
                    ]
                };

            } catch (err) {
                console.error(`Error calculating Category Overview for ${catName}:`, err);
                return {
                    key: catName,
                    label: catName,
                    type: "Category",
                    logo: "",
                    columns: generateMonthColumns(0, 0, 0, 0)
                };
            }
        });

        const categoryOverview = await Promise.all(categoryOverviewPromises);

        // 14. Brands Overview Logic
        const brandsOverviewPlatform = filters.brandsOverviewPlatform || filters.platform || 'All';
        const brandsOverviewCategory = filters.brandsOverviewCategory || filters.category || 'All';

        // Define Where Clauses
        const boBrandWhere = {};
        if (brandsOverviewPlatform && brandsOverviewPlatform !== 'All') boBrandWhere.platform = brandsOverviewPlatform;
        if (brandsOverviewCategory && brandsOverviewCategory !== 'All') boBrandWhere.Category = brandsOverviewCategory;
        if (location && location !== 'All') boBrandWhere.location = location;

        const boOfftakeWhere = {
            DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
            Comp_flag: 0, // Only our brands
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: brandsOverviewPlatform }),
            ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { Category: brandsOverviewCategory }),
            ...(location && location !== 'All' && { Location: location })
        };

        const boPrevStartDate = startDate.clone().subtract(1, 'month');
        const boPrevEndDate = endDate.clone().subtract(1, 'month');

        const boPrevOfftakeWhere = {
            DATE: { [Op.between]: [boPrevStartDate.toDate(), boPrevEndDate.toDate()] },
            Comp_flag: 0, // Only our brands
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: brandsOverviewPlatform }),
            ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { Category: brandsOverviewCategory }),
            ...(location && location !== 'All' && { Location: location })
        };


        const boMsWhere = {
            created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: brandsOverviewPlatform }),
            ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { category: brandsOverviewCategory }),
            ...(location && location !== 'All' && { Location: location })
        };

        const boPrevMsWhere = {
            created_on: { [Op.between]: [boPrevStartDate.toDate(), boPrevEndDate.toDate()] },
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: brandsOverviewPlatform }),
            ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { category: brandsOverviewCategory }),
            ...(location && location !== 'All' && { Location: location })
        };

        const rcaBrandWhere = {
            comp_flag: 0  // FIXED: Only show OUR brands, not competitors
        };
        if (brandsOverviewPlatform && brandsOverviewPlatform !== 'All') {
            rcaBrandWhere.platform = brandsOverviewPlatform;
        }
        if (brandsOverviewCategory && brandsOverviewCategory !== 'All') {
            rcaBrandWhere.Category = brandsOverviewCategory;
        }



        // 1. Offtake Current (Conditional Logic)
        let boOfftakePromise;
        const lowerPlatform = (brandsOverviewPlatform || '').toLowerCase();

        if (lowerPlatform === 'zepto') {
            const zeptoWhere = {
                sales_date: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { sku_category: brandsOverviewCategory }),
                ...(location && location !== 'All' && { city: location })
            };
            // Use rb_pdp_olap Sales column for Zepto (same as other platforms)
            boOfftakePromise = RbPdpOlap.findAll({
                attributes: [
                    'Brand',
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Quanity_sold')), 'total_ad_orders'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_ad_clicks'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_ad_impressions'],
                    [Sequelize.fn('AVG', Sequelize.col('Discount')), 'avg_discount'],
                    // ROAS is calculated manually as: SUM(Ad_sales) / SUM(Ad_Spend)
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: {
                    DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                    Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), lowerPlatform),
                    ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
                    ...(location && location !== 'All' && { Location: location }),
                    ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { Category: brandsOverviewCategory })
                },
                group: ['Brand'],
                raw: true
            });
        } else if (lowerPlatform === 'blinkit') {
            const blinkitWhere = {
                created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                // Removed category filter due to mismatch with RcaSkuDim categories
                ...(location && location !== 'All' && { city_name: location })
            };
            boOfftakePromise = TbBlinkitSalesData.findAll({
                attributes: [
                    [Sequelize.literal("SUBSTRING_INDEX(item_name, ' ', 1)"), 'Brand'], // Extract Brand proxy from item_name? Or use manufacturer_name? Using manufacturer_name is safer if available.
                    // Actually, let's check if we can use manufacturer_name or if we need to extract.
                    // Model has manufacturer_name. Let's use that as Brand for now.
                    // [Sequelize.col('manufacturer_name'), 'Brand'], 
                    // Wait, user wants "Brand" columns. manufacturer_name might be "Godrej Consumer Products Ltd".
                    // Let's stick to existing pattern if possible. 
                    // But for now, let's use manufacturer_name as 'Brand' alias.
                    ['manufacturer_name', 'Brand'],
                    [Sequelize.fn('SUM', Sequelize.literal('CAST(qty_sold AS DECIMAL(10,2)) * CAST(mrp AS DECIMAL(10,2))')), 'total_sales'],
                    [Sequelize.literal('0'), 'total_spend'],
                    [Sequelize.literal('0'), 'total_ad_sales'],
                    [Sequelize.literal('0'), 'total_ad_orders'],
                    [Sequelize.literal('0'), 'total_ad_clicks'],
                    [Sequelize.literal('0'), 'total_ad_impressions'],
                    [Sequelize.literal('0'), 'avg_discount'],
                    // ROAS is calculated manually as: SUM(Ad_sales) / SUM(Ad_Spend)
                    [Sequelize.literal('0'), 'total_neno'],
                    [Sequelize.literal('0'), 'total_deno']
                ],
                where: blinkitWhere,
                group: ['manufacturer_name'],
                raw: true
            });
        } else {
            // Fallback to RbPdpOlap for 'All' or other platforms
            boOfftakePromise = RbPdpOlap.findAll({
                attributes: [
                    'Brand',
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Quanity_sold')), 'total_ad_orders'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_ad_clicks'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_ad_impressions'],
                    [Sequelize.fn('AVG', Sequelize.col('Discount')), 'avg_discount'],
                    // ROAS is calculated manually as: SUM(Ad_sales) / SUM(Ad_Spend)
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: boOfftakeWhere,
                group: ['Brand'],
                raw: true
            });
        }

        const [
            boOfftakeData,
            boPrevOfftakeData,
            boMsData,
            boPrevMsData,
            rcaBrandsData
        ] = await Promise.all([
            // 1. Offtake Current
            boOfftakePromise,
            // 2. Offtake Previous
            RbPdpOlap.findAll({
                attributes: [
                    'Brand',
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Quanity_sold')), 'total_ad_orders'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_ad_clicks'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_ad_impressions'],
                    [Sequelize.fn('AVG', Sequelize.col('Discount')), 'avg_discount'],
                    [Sequelize.fn('AVG', Sequelize.col('ROAS')), 'avg_roas'],
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: boPrevOfftakeWhere,
                group: ['Brand'],
                raw: true
            }),
            // 3. Market Share Current
            RbBrandMs.findAll({
                attributes: ['brand', [Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                where: boMsWhere,
                group: ['brand'],
                raw: true
            }),
            // 4. Market Share Previous
            RbBrandMs.findAll({
                attributes: ['brand', [Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                where: boPrevMsWhere,
                group: ['brand'],
                raw: true
            }),
            // 5. Brand List
            RcaSkuDim.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
                where: rcaBrandWhere,
                raw: true
            })
        ]);



        // Optimization: Create Maps for O(1) Access
        const toMap = (arr) => new Map(arr.map(i => [(i.Brand || i.brand_name || i.brand || '').toLowerCase(), i]));

        const boOfftakeMap = toMap(boOfftakeData);
        const boPrevOfftakeMap = toMap(boPrevOfftakeData);
        const boMsMap = toMap(boMsData);
        const boPrevMsMap = toMap(boPrevMsData);

        const findMetric = (map, brandName, key) => {
            const lowerBrand = brandName.toLowerCase();
            let item = map.get(lowerBrand);

            // Fuzzy Match if exact match fails
            if (!item) {
                for (const [mapKey, mapValue] of map.entries()) {
                    if (mapKey.includes(lowerBrand) || lowerBrand.includes(mapKey)) {
                        item = mapValue;
                        break; // Take first match
                    }
                }
            }

            return item ? parseFloat(item[key] || 0) : 0;
        };

        const calcTrend = (curr, prev) => {
            if (prev > 0) return ((curr - prev) / prev) * 100;
            if (curr > 0) return 100;
            return 0;
        };

        const calcTrendPp = (curr, prev) => curr - prev;

        const boBrands = rcaBrandsData.map(d => d.brand_name).filter(Boolean);

        // Pre-calculate totals for Promo Compete (Avg Discount of ALL brands)
        const totalDiscountSum = boOfftakeData.reduce((sum, d) => sum + parseFloat(d.avg_discount || 0), 0);
        const totalDiscountCount = boOfftakeData.length;

        const prevTotalDiscountSum = boPrevOfftakeData.reduce((sum, d) => sum + parseFloat(d.avg_discount || 0), 0);
        const prevTotalDiscountCount = boPrevOfftakeData.length;

        // ⚡ PERFORMANCE OPTIMIZATION: Bulk SOS Calculation with Request Coalescing
        // Calculate SOS for ALL brands at once (4 queries total) instead of per-brand (2N queries)
        // Use coalesceRequest to prevent cache stampede - only one computation runs, others wait
        console.log(`[Brands Overview] Calculating SOS for ${boBrands.length} brands using bulk method...`);
        const brandsSosTimerLabel = `[Brands Overview] Bulk SOS Calculation ${Date.now()}`;
        console.time(brandsSosTimerLabel);

        // Generate coalesce key for SOS calculation
        const sosCoalesceKey = `bulk-sos:${platform || 'All'}:${startDate.format('YYYY-MM-DD')}:${endDate.format('YYYY-MM-DD')}:${location || 'All'}:${category || 'All'}`;

        let bulkSosMap;
        try {
            bulkSosMap = await coalesceRequest(sosCoalesceKey, async () =>
                await getBulkShareOfSearch(
                    boBrands,
                    startDate, endDate,           // Current period
                    boPrevStartDate, boPrevEndDate, // Previous period
                    platform, location, category
                )
            );
        } catch (err) {
            console.error('[Brands Overview] Bulk SOS Error:', err.message);
            bulkSosMap = new Map();
        }

        console.timeEnd(brandsSosTimerLabel);
        console.log(`[Brands Overview] SOS calculated for ${bulkSosMap.size} brands`);

        const brandsOverview = await Promise.all(boBrands.map(async brandName => {
            // Offtake
            const currSales = findMetric(boOfftakeMap, brandName, 'total_sales');
            const prevSales = findMetric(boPrevOfftakeMap, brandName, 'total_sales');
            const salesTrend = calcTrend(currSales, prevSales);

            // Spend
            const currSpend = findMetric(boOfftakeMap, brandName, 'total_spend');
            const prevSpend = findMetric(boPrevOfftakeMap, brandName, 'total_spend');
            const spendTrend = calcTrend(currSpend, prevSpend);

            // ROAS
            const currAdSales = findMetric(boOfftakeMap, brandName, 'total_ad_sales');
            const prevAdSales = findMetric(boPrevOfftakeMap, brandName, 'total_ad_sales');
            const currRoas = currSpend > 0 ? currAdSales / currSpend : 0;
            const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;
            const roasTrend = calcTrend(currRoas, prevRoas);

            // console.log(`[Brands ROAS Debug] Brand: ${brandName}, currAdSales: ${currAdSales}, currSpend: ${currSpend}, currRoas: ${currRoas}`);

            // Inorg Sales
            const currInorgPct = currSales > 0 ? (currAdSales / currSales) * 100 : 0;
            const prevInorgPct = prevSales > 0 ? (prevAdSales / prevSales) * 100 : 0;
            const inorgPctTrend = calcTrendPp(currInorgPct, prevInorgPct);

            // Conversion
            const currOrders = findMetric(boOfftakeMap, brandName, 'total_ad_orders');
            const prevOrders = findMetric(boPrevOfftakeMap, brandName, 'total_ad_orders');
            const currClicks = findMetric(boOfftakeMap, brandName, 'total_ad_clicks');
            const prevClicks = findMetric(boPrevOfftakeMap, brandName, 'total_ad_clicks');
            const currConv = currClicks > 0 ? (currOrders / currClicks) * 100 : 0;
            const prevConv = prevClicks > 0 ? (prevOrders / prevClicks) * 100 : 0;
            const convTrend = calcTrendPp(currConv, prevConv);

            // Availability
            const currNeno = findMetric(boOfftakeMap, brandName, 'total_neno');
            const prevNeno = findMetric(boPrevOfftakeMap, brandName, 'total_neno');
            const currDeno = findMetric(boOfftakeMap, brandName, 'total_deno');
            const prevDeno = findMetric(boPrevOfftakeMap, brandName, 'total_deno');
            const currAvail = currDeno > 0 ? (currNeno / currDeno) * 100 : 0;
            const prevAvail = prevDeno > 0 ? (prevNeno / prevDeno) * 100 : 0;
            const availTrend = calcTrendPp(currAvail, prevAvail);


            // SOS - Lookup from pre-calculated bulk map (NO DATABASE QUERY!)
            const sosData = bulkSosMap.get(brandName) || { current: 0, previous: 0 };
            const currSos = sosData.current;
            const prevSos = sosData.previous;
            const sosTrend = calcTrendPp(currSos, prevSos);


            // Market Share
            const currMs = findMetric(boMsMap, brandName, 'avg_ms');
            const prevMs = findMetric(boPrevMsMap, brandName, 'avg_ms');
            const msTrend = calcTrendPp(currMs, prevMs);

            // Promo My Brand
            const currDisc = findMetric(boOfftakeMap, brandName, 'avg_discount');
            const prevDisc = findMetric(boPrevOfftakeMap, brandName, 'avg_discount');
            const discTrend = calcTrendPp(currDisc, prevDisc);

            // Promo Compete (Avg Discount of ALL OTHER brands)
            let otherBrandsAvgDisc = 0;
            if (totalDiscountCount > 1) {
                const myDisc = boOfftakeMap.has(brandName.toLowerCase()) ? parseFloat(boOfftakeMap.get(brandName.toLowerCase()).avg_discount || 0) : 0;
                const isPresent = boOfftakeMap.has(brandName.toLowerCase());
                const otherSum = isPresent ? totalDiscountSum - myDisc : totalDiscountSum;
                const otherCount = isPresent ? totalDiscountCount - 1 : totalDiscountCount;
                otherBrandsAvgDisc = otherCount > 0 ? otherSum / otherCount : 0;
            }

            let prevOtherBrandsAvgDisc = 0;
            if (prevTotalDiscountCount > 1) {
                const myPrevDisc = boPrevOfftakeMap.has(brandName.toLowerCase()) ? parseFloat(boPrevOfftakeMap.get(brandName.toLowerCase()).avg_discount || 0) : 0;
                const isPresent = boPrevOfftakeMap.has(brandName.toLowerCase());
                const otherSum = isPresent ? prevTotalDiscountSum - myPrevDisc : prevTotalDiscountSum;
                const otherCount = isPresent ? prevTotalDiscountCount - 1 : prevTotalDiscountCount;
                prevOtherBrandsAvgDisc = otherCount > 0 ? otherSum / otherCount : 0;
            }

            const promoCompeteTrend = calcTrendPp(otherBrandsAvgDisc, prevOtherBrandsAvgDisc);

            // CPM
            const currImp = findMetric(boOfftakeMap, brandName, 'total_ad_impressions');
            const prevImp = findMetric(boPrevOfftakeMap, brandName, 'total_ad_impressions');
            const currCpm = currImp > 0 ? (currSpend / currImp) * 1000 : 0;
            const prevCpm = prevImp > 0 ? (prevSpend / prevImp) * 1000 : 0;
            const cpmTrend = calcTrend(currCpm, prevCpm);

            // CPC
            const currCpc = currClicks > 0 ? currSpend / currClicks : 0;
            const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;
            const cpcTrend = calcTrend(currCpc, prevCpc);

            // Transform to match PlatformOverview structure
            return {
                key: brandName.toLowerCase().replace(/\s+/g, '_'),
                label: brandName,
                type: "Brand",
                columns: [
                    { title: "Offtakes", value: formatCurrency(currSales), meta: { units: `${(currSales / 100000).toFixed(2)} L`, change: `${salesTrend >= 0 ? '▲' : '▼'}${Math.abs(salesTrend).toFixed(1)}%` } },
                    { title: "Spend", value: formatCurrency(currSpend), meta: { units: formatCurrency(currSpend), change: `${spendTrend >= 0 ? '▲' : '▼'}${Math.abs(spendTrend).toFixed(1)}%` } },
                    { title: "ROAS", value: `${currRoas.toFixed(1)}x`, meta: { units: `${formatCurrency(currAdSales)}`, change: `${roasTrend >= 0 ? '▲' : '▼'}${Math.abs(roasTrend).toFixed(1)}%` } },
                    {
                        title: "Inorg Sales",
                        value: `${currInorgPct.toFixed(1)}%`,
                        meta: { units: formatCurrency(currAdSales), change: `${inorgPctTrend >= 0 ? '▲' : '▼'}${Math.abs(inorgPctTrend).toFixed(1)} pp` }
                    },
                    { title: "Conversion", value: `${currConv.toFixed(1)}%`, meta: { units: `${(currOrders / 1000).toFixed(1)}k`, change: `${convTrend >= 0 ? '▲' : '▼'}${Math.abs(convTrend).toFixed(1)} pp` } },
                    { title: "Availability", value: `${currAvail.toFixed(1)}%`, meta: { units: `${currDeno}`, change: `${availTrend >= 0 ? '▲' : '▼'}${Math.abs(availTrend).toFixed(1)} pp` } },
                    { title: "SOS", value: `${currSos.toFixed(1)}%`, meta: { units: `${currSos.toFixed(1)}`, change: `${sosTrend >= 0 ? '▲' : '▼'}${Math.abs(sosTrend).toFixed(1)} pp` } },
                    { title: "Market Share", value: `${currMs.toFixed(1)}%`, meta: { units: formatCurrency(currSales * (100 / currMs) || 0), change: `${msTrend >= 0 ? '▲' : '▼'}${Math.abs(msTrend).toFixed(1)} pp` } },
                    { title: "Promo My Brand", value: `${currDisc.toFixed(1)}%`, meta: { units: `${currDisc.toFixed(1)}%`, change: `${discTrend >= 0 ? '▲' : '▼'}${Math.abs(discTrend).toFixed(1)} pp` } },
                    { title: "Promo Compete", value: `${otherBrandsAvgDisc.toFixed(1)}%`, meta: { units: `${otherBrandsAvgDisc.toFixed(1)}%`, change: `${promoCompeteTrend >= 0 ? '▲' : '▼'}${Math.abs(promoCompeteTrend).toFixed(1)} pp` } },
                    { title: "CPM", value: formatCurrency(currCpm), meta: { units: formatCurrency(currCpm), change: `${cpmTrend >= 0 ? '▲' : '▼'}${Math.abs(cpmTrend).toFixed(1)}%` } },
                    { title: "CPC", value: formatCurrency(currCpc), meta: { units: formatCurrency(currCpc), change: `${cpcTrend >= 0 ? '▲' : '▼'}${Math.abs(cpcTrend).toFixed(1)}%` } }
                ]
            };
        }));

        console.log(`[Watch Tower Service] Returning categoryOverview with ${categoryOverview?.length || 0} items`);
        return {
            topMetrics,
            summaryMetrics,
            performanceMetricsKpis,
            skuTable: skuTableData,
            platformOverview,
            monthOverview,
            categoryOverview,
            brandsOverview
        };

    } catch (error) {
        console.error("Error in watchTowerService:", error);
        throw error;
    }
};

const getPlatforms = async () => {
    return getCachedOrCompute('watchtower:platforms:all:v2', async () => {
        try {
            // ClickHouse query
            const query = `SELECT DISTINCT platform FROM rca_sku_dim WHERE platform IS NOT NULL AND platform != '' ORDER BY platform`;
            const results = await queryClickHouse(query);
            return results.map(p => p.platform).filter(Boolean).sort();
        } catch (error) {
            console.error("Error fetching platforms:", error);
            return []; // Return empty array instead of throwing
        }
    }, CACHE_TTL.VERY_STATIC); // Cache for 7 days - platforms almost never change
};

// Exported function with caching layer
const getSummaryMetrics = async (filters) => {
    // Generate cache key from filters
    const cacheKey = generateCacheKey('summary', filters);

    // Get from cache or compute with request coalescing to prevent cache stampede
    return await getCachedOrCompute(cacheKey, async () => {
        // Use coalesceRequest to ensure only one computation runs at a time
        const computeKey = `compute:${cacheKey}`;
        return await coalesceRequest(computeKey, async () => {
            return await computeSummaryMetrics(filters);
        });
    }, CACHE_TTL.METRICS); // Cache for 1 hour - aggregated metrics
};

const getBrands = async (platform, includeCompetitors = false) => {
    const cacheKey = `watchtower:brands:${platform || 'all'}:${includeCompetitors ? 'all' : 'ours'}`;
    return getCachedOrCompute(cacheKey, async () => {
        try {
            // ClickHouse query - build conditions
            const conditions = [`brand_name IS NOT NULL`, `brand_name != ''`];
            if (platform && platform !== 'All') {
                conditions.push(`platform = '${platform.replace(/'/g, "''")}'`);
            }
            if (!includeCompetitors) {
                conditions.push(`comp_flag = 0`);
            }

            const query = `SELECT DISTINCT brand_name FROM rca_sku_dim WHERE ${conditions.join(' AND ')} ORDER BY brand_name`;
            const results = await queryClickHouse(query);
            return results.map(r => r.brand_name).filter(Boolean);
        } catch (error) {
            console.error('Error fetching brands from rca_sku_dim:', error);
            return [];
        }
    }, CACHE_TTL.VERY_STATIC); // 7 days - brands rarely change
};

const getKeywords = async (brand) => {
    const cacheKey = `watchtower:keywords:${brand || 'all'}`;
    return getCachedOrCompute(cacheKey, async () => {
        try {
            // ClickHouse query
            const conditions = [`keyword IS NOT NULL`, `keyword != ''`];
            if (brand) {
                conditions.push(`brand_name = '${brand.replace(/'/g, "''")}'`);
            }

            const query = `SELECT DISTINCT keyword FROM rb_kw WHERE ${conditions.join(' AND ')} ORDER BY keyword`;
            const results = await queryClickHouse(query);
            return results.map(k => k.keyword).filter(Boolean).sort();
        } catch (error) {
            console.error("Error fetching keywords:", error);
            return [];
        }
    }, CACHE_TTL.VERY_STATIC); // 7 days - keywords rarely change
};

const getLocations = async (platform, brand, includeCompetitors = false) => {
    const cacheKey = `watchtower:locations:${platform || 'all'}:${brand || 'all'}:${includeCompetitors ? 'all' : 'ours'}`;
    return getCachedOrCompute(cacheKey, async () => {
        try {
            // ClickHouse query
            const conditions = [`location IS NOT NULL`, `location != ''`];
            if (platform && platform !== 'All') {
                conditions.push(`platform = '${platform.replace(/'/g, "''")}'`);
            }
            if (brand && brand !== 'All') {
                conditions.push(`brand_name = '${brand.replace(/'/g, "''")}'`);
            }
            if (!includeCompetitors) {
                conditions.push(`comp_flag = 0`);
            }

            const query = `SELECT DISTINCT location FROM rca_sku_dim WHERE ${conditions.join(' AND ')} ORDER BY location`;
            const results = await queryClickHouse(query);
            return results.map(l => l.location).filter(Boolean);
        } catch (error) {
            console.error("Error fetching locations:", error);
            return [];
        }
    }, CACHE_TTL.VERY_STATIC); // 7 days - locations rarely change
};

/**
 * Generate time buckets based on start/end date and time step
 */
const generateTimeBuckets = (startDate, endDate, timeStep) => {
    const buckets = [];
    let current = startDate.clone();

    // Remove strict startOf alignment to respect user's "today to 1M back" request
    // But we still need to align Daily to start of day
    current = current.startOf('day');

    const end = endDate.clone().endOf('day');

    while (current.isBefore(end) || current.isSame(end, 'day')) {
        let label;
        let groupKey;

        if (timeStep === 'Monthly') {
            // Label format must match frontend parser: "DD MMM'YY" (e.g., "08 Nov'25")
            label = current.format("DD MMM'YY");
            groupKey = current.format('YYYY-MM-01'); // Matches DB DATE_FORMAT (Calendar Month)
            current = current.add(1, 'month');
        } else if (timeStep === 'Weekly') {
            // Label format must match frontend parser: "DD MMM'YY" (e.g., "17 Dec'25")
            label = current.format("DD MMM'YY");
            // Matches DB YEARWEEK mode 1
            const year = current.year();
            const week = current.isoWeek();
            groupKey = year * 100 + week;
            current = current.add(1, 'week');
        } else { // Daily
            // Label format must match frontend parser: "DD MMM'YY" (e.g., "17 Dec'25")
            label = current.format("DD MMM'YY");
            groupKey = current.format('YYYY-MM-DD'); // Matches DB DATE
            current = current.add(1, 'day');
        }

        buckets.push({
            label,
            groupKey,
            date: current.clone().subtract(1, timeStep === 'Daily' ? 'day' : timeStep === 'Weekly' ? 'week' : 'month').toDate()
        });
    }

    // Ensure the last bucket covers the endDate
    // If the loop finished but the last bucket's interval doesn't include endDate, add one more.
    // Actually, we can check if the last bucket's groupKey matches the endDate's groupKey.
    // If not, we add the endDate's bucket.

    if (buckets.length > 0) {
        const lastBucket = buckets[buckets.length - 1];
        let endGroupKey;
        let endLabel;

        if (timeStep === 'Monthly') {
            endGroupKey = endDate.format('YYYY-MM-01');
            endLabel = endDate.format("DD MMM'YY");
        } else if (timeStep === 'Weekly') {
            const year = endDate.year();
            const week = endDate.isoWeek();
            endGroupKey = year * 100 + week;
            endLabel = endDate.format("DD MMM'YY");
        } else {
            endGroupKey = endDate.format('YYYY-MM-DD');
            endLabel = endDate.format("DD MMM'YY");
        }

        // If the last bucket is NOT the same group as the end date, add the end date bucket
        if (String(lastBucket.groupKey) !== String(endGroupKey)) {
            buckets.push({
                label: endLabel,
                groupKey: endGroupKey,
                date: endDate.toDate()
            });
        }
    }

    return buckets;
};
// Internal implementation with all the compute logic - MIGRATED TO CLICKHOUSE
const computeTrendData = async (filters) => {
    try {
        const { brand, location, platform, period, timeStep, category, startDate: customStart, endDate: customEnd } = filters;

        // 1. Determine Date Range
        let endDate = await getCachedMaxDate();
        let startDate = endDate.clone();

        if (period === 'Custom' && customStart && customEnd) {
            startDate = dayjs(customStart);
            endDate = dayjs(customEnd);
        } else {
            switch (period) {
                case '1M': startDate = startDate.subtract(1, 'month'); break;
                case '3M': startDate = startDate.subtract(3, 'month'); break;
                case '6M': startDate = startDate.subtract(6, 'month'); break;
                case '1Y': startDate = startDate.subtract(1, 'year'); break;
                default: startDate = startDate.subtract(3, 'month'); // Default 3M
            }
        }

        console.log(`computeTrendData [ClickHouse]: period=${period}, start=${startDate.format()}, end=${endDate.format()}`);

        // Helper to escape strings for ClickHouse
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // 2. Determine Grouping for ClickHouse
        let groupExpression;
        let groupExpressionMs;
        let groupExpressionKw;

        if (timeStep === 'Monthly') {
            groupExpression = `formatDateTime(toDate(DATE), '%Y-%m-01')`;
            groupExpressionMs = `formatDateTime(toDate(created_on), '%Y-%m-01')`;
            groupExpressionKw = `formatDateTime(toDate(kw_crawl_date), '%Y-%m-01')`;
        } else if (timeStep === 'Weekly') {
            groupExpression = `toYearWeek(toDate(DATE), 1)`;
            groupExpressionMs = `toYearWeek(toDate(created_on), 1)`;
            groupExpressionKw = `toYearWeek(toDate(kw_crawl_date), 1)`;
        } else { // Daily
            groupExpression = `formatDateTime(toDate(DATE), '%Y-%m-%d')`;
            groupExpressionMs = `formatDateTime(toDate(created_on), '%Y-%m-%d')`;
            groupExpressionKw = `formatDateTime(toDate(kw_crawl_date), '%Y-%m-%d')`;
        }

        // 3. Build WHERE conditions for rb_pdp_olap
        const buildPdpConds = () => {
            const conds = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
            if (category && category !== 'All') conds.push(`Category = '${escapeStr(category)}'`);
            if (brand && brand !== 'All') conds.push(`Brand LIKE '%${escapeStr(brand)}%'`);
            if (location && location !== 'All') conds.push(`Location = '${escapeStr(location)}'`);
            if (platform && platform !== 'All') conds.push(`Platform = '${escapeStr(platform)}'`);
            return conds.join(' AND ');
        };

        const pdpConds = buildPdpConds();

        // Query for Offtake, OSA, Discount using ClickHouse
        const trendResults = await queryClickHouse(`
            SELECT 
                ${groupExpression} as date_group,
                MAX(toDate(DATE)) as ref_date,
                SUM(ifNull(toFloat64(Sales), 0)) as offtake,
                SUM(ifNull(toFloat64(neno_osa), 0)) as total_neno,
                SUM(ifNull(toFloat64(deno_osa), 0)) as total_deno,
                SUM(CASE WHEN toFloat64OrNull(replaceAll(toString(MRP), ',', '')) > 0 THEN ifNull(toFloat64(Sales), 0) ELSE 0 END) as sales_with_mrp,
                SUM(CASE WHEN toFloat64OrNull(replaceAll(toString(MRP), ',', '')) > 0 THEN toFloat64OrNull(replaceAll(toString(MRP), ',', '')) * toFloat64OrNull(Qty_Sold) ELSE 0 END) as mrp_sales_valid
            FROM rb_pdp_olap
            WHERE ${pdpConds}
            GROUP BY ${groupExpression}
            ORDER BY ref_date ASC
        `);

        // 4. Query Market Share using ClickHouse
        // Get valid brands (comp_flag = 0)
        const validBrandsResult = await queryClickHouse(`
            SELECT DISTINCT brand_name 
            FROM rca_sku_dim 
            WHERE toString(comp_flag) = '0' AND brand_name IS NOT NULL
        `);
        const validBrandNamesForMs = validBrandsResult.map(b => b.brand_name).filter(Boolean);

        // Build MS conditions
        const buildMsConds = (includeBrandFilter = false) => {
            const conds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
            conds.push(`sales IS NOT NULL`);
            if (category && category !== 'All') conds.push(`category_master = '${escapeStr(category)}'`);
            if (location && location !== 'All') conds.push(`Location = '${escapeStr(location)}'`);
            if (platform && platform !== 'All') conds.push(`Platform = '${escapeStr(platform)}'`);
            if (includeBrandFilter && validBrandNamesForMs.length > 0) {
                const brandList = validBrandNamesForMs.map(b => `'${escapeStr(b)}'`).join(', ');
                conds.push(`brand IN (${brandList})`);
            }
            return conds.join(' AND ');
        };

        // Numerator: Sales of our brands (comp_flag=0) grouped by time
        const msNumerator = await queryClickHouse(`
            SELECT ${groupExpressionMs} as date_group, SUM(toFloat64OrZero(sales)) as our_sales
            FROM rb_brand_ms
            WHERE ${buildMsConds(true)}
            GROUP BY ${groupExpressionMs}
        `);

        // Denominator: Total platform sales grouped by time
        const msDenominator = await queryClickHouse(`
            SELECT ${groupExpressionMs} as date_group, SUM(toFloat64OrZero(sales)) as total_sales
            FROM rb_brand_ms
            WHERE ${buildMsConds(false)}
            GROUP BY ${groupExpressionMs}
        `);

        // Create maps for easy lookup
        const msNumMap = new Map(msNumerator.map(r => [String(r.date_group), parseFloat(r.our_sales || 0)]));
        const msDenomMap = new Map(msDenominator.map(r => [String(r.date_group), parseFloat(r.total_sales || 0)]));

        // Calculate MS for each time bucket
        const msResults = msDenominator.map(r => {
            const dateGroup = String(r.date_group);
            const ourSales = msNumMap.get(dateGroup) || 0;
            const totalSales = msDenomMap.get(dateGroup) || 0;
            const avgMs = totalSales > 0 ? (ourSales / totalSales) * 100 : 0;
            return { date_group: dateGroup, avg_ms: avgMs };
        });

        // 5. Query Share of Search (SOV) using ClickHouse
        const buildSosConds = (includeBrand = false) => {
            const conds = [`toDate(kw_crawl_date) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
            conds.push(`toString(spons_flag) != '1'`);
            if (category && category !== 'All') conds.push(`keyword_category = '${escapeStr(category)}'`);
            if (location && location !== 'All') conds.push(`location_name = '${escapeStr(location)}'`);
            if (platform && platform !== 'All') conds.push(`platform_name = '${escapeStr(platform)}'`);
            if (includeBrand && brand && brand !== 'All') conds.push(`brand_name = '${escapeStr(brand)}'`);
            return conds.join(' AND ');
        };

        // Numerator: Brand matches + Not Sponsored
        const sosNumerator = await queryClickHouse(`
            SELECT ${groupExpressionKw} as date_group, count() as count
            FROM rb_kw
            WHERE ${buildSosConds(true)}
            GROUP BY ${groupExpressionKw}
        `);

        // Denominator: All Brands (No Brand Filter) + Not Sponsored
        const sosDenominator = await queryClickHouse(`
            SELECT ${groupExpressionKw} as date_group, count() as count
            FROM rb_kw
            WHERE ${buildSosConds(false)}
            GROUP BY ${groupExpressionKw}
        `);


        // 6. Merge and Format Data
        const buckets = generateTimeBuckets(startDate, endDate, timeStep);

        const timeSeries = buckets.map(bucket => {
            // Find matching data in results
            // We need to match bucket.groupKey with row.date_group
            // For Weekly: bucket.groupKey is int (202548), row.date_group is int
            // For Monthly: bucket.groupKey is string (2025-11-01), row.date_group is string
            // For Daily: bucket.groupKey is string (2025-11-25), row.date_group is string

            const row = trendResults.find(r => String(r.date_group) === String(bucket.groupKey)) || {};

            // OSA
            const neno = parseFloat(row.total_neno || 0);
            const deno = parseFloat(row.total_deno || 0);
            const osa = deno > 0 ? (neno / deno) * 100 : 0;

            // Discount
            const salesWithMrp = parseFloat(row.sales_with_mrp || 0);
            const mrpSalesValid = parseFloat(row.mrp_sales_valid || 0);
            let discount = 0;
            if (mrpSalesValid > 0) {
                discount = (1 - (salesWithMrp / mrpSalesValid)) * 100;
            }
            discount = Math.max(0, Math.min(100, discount));

            // Market Share
            const msMatch = msResults.find(m => String(m.date_group) === String(bucket.groupKey));
            const categoryShare = parseFloat(msMatch?.avg_ms || 0);

            // SOV
            const sosNum = sosNumerator.find(s => String(s.date_group) === String(bucket.groupKey));
            const sosDen = sosDenominator.find(s => String(s.date_group) === String(bucket.groupKey));
            const numCount = parseInt(sosNum?.count || 0, 10);
            const denCount = parseInt(sosDen?.count || 0, 10);
            const sov = denCount > 0 ? (numCount / denCount) * 100 : 0;

            return {
                date: bucket.label,
                offtake: parseFloat(row.offtake || 0),
                osa: parseFloat(osa.toFixed(1)),
                categoryShare: parseFloat(categoryShare.toFixed(1)),
                discount: parseFloat(discount.toFixed(1)),
                sov: parseFloat(sov.toFixed(1))
            };
        });

        // If timeStep is Monthly, we might want to ensure all months in range are present?
        // But for now, returning what we have is fine.

        return {
            timeSeries,
            metrics: {
                offtake: true,
                estCategoryShare: true,
                osa: true,
                discount: true,
                overallSOV: true
            }
        };

    } catch (error) {
        console.error("Error in computeTrendData:", error);
        throw error;
    }
};

// Exported function with caching layer
const getTrendData = async (filters) => {
    // Generate cache key from filters
    const cacheKey = generateCacheKey('trend', filters);

    // Get from cache or compute
    return await getCachedOrCompute(cacheKey, async () => {
        return await computeTrendData(filters);
    }, parseInt(process.env.REDIS_DEFAULT_TTL || '1800')); // 30 minutes default TTL
};

const getBrandCategories = async (platform) => {
    try {
        // ClickHouse query
        const conditions = [`status = 1`, `Category IS NOT NULL`, `Category != ''`];
        if (platform && platform !== 'All') {
            conditions.push(`platform = '${platform.replace(/'/g, "''")}'`);
        }

        const query = `SELECT DISTINCT Category FROM rca_sku_dim WHERE ${conditions.join(' AND ')} ORDER BY Category`;
        const results = await queryClickHouse(query);
        return results.map(c => c.Category).filter(Boolean);
    } catch (error) {
        console.error("Error fetching brand categories:", error);
        throw error;
    }
};

// ==================== Progressive Loading Section Endpoints ====================
// These methods split getSummaryMetrics into focused endpoints for better performance

/**
 * Get Overview Data (topMetrics, summaryMetrics, performanceMetricsKpis)
 * OPTIMIZED: Only computes overview data without platform/month/category/brand sections
 */
const getOverview = async (filters) => {
    const cacheKey = generateCacheKey('overview', filters);
    return await getCachedOrCompute(cacheKey, async () => {
        // Use coalesceRequest to prevent cache stampede
        return await coalesceRequest(`compute:${cacheKey}`, async () => {
            console.log('[getOverview] Computing OPTIMIZED overview data (SKIPPING performance KPIs)...');

            // Skip performance KPIs computation - they are loaded separately via /performance-metrics
            const result = await computeSummaryMetrics(filters, { onlyOverview: true, skipPerformanceKpis: true });

            return {
                topMetrics: result.topMetrics,
                summaryMetrics: result.summaryMetrics
            };
        });
    }, parseInt(process.env.REDIS_DEFAULT_TTL || '1800'));
};

/**
 * Get Performance Metrics KPIs Data (Share of Search, ROAS, Conversion, etc.)
 * OPTIMIZED: Separate endpoint for Performance Matrix section
 */
const getPerformanceMetrics = async (filters) => {
    const cacheKey = generateCacheKey('performance_metrics', filters);
    return await getCachedOrCompute(cacheKey, async () => {
        // Use coalesceRequest to prevent cache stampede
        return await coalesceRequest(`compute:${cacheKey}`, async () => {
            console.log('[getPerformanceMetrics] Computing performance metrics KPIs...');

            // Call the FULL function but it will only compute overview data
            const result = await computeSummaryMetrics(filters, { onlyOverview: true });

            return {
                performanceMetricsKpis: result.performanceMetricsKpis || []
            };
        });
    }, parseInt(process.env.REDIS_DEFAULT_TTL || '1800'));
};

/**
 * Get Platform Overview Data - OPTIMIZED
 * Returns platformOverview array with metrics for each platform
 * NOTE: This function computes ONLY platform data, not overview/months/categories/brands
 */
const getPlatformOverview = async (filters) => {
    const cacheKey = generateCacheKey('platform_overview_v4', filters);
    return await getCachedOrCompute(cacheKey, async () => {
        return await coalesceRequest(`compute:${cacheKey}`, async () => {
            console.log('[getPlatformOverview] Computing OPTIMIZED platform overview data...');

            const { months = 1, startDate: qStartDate, endDate: qEndDate, compareStartDate: qCompareStartDate, compareEndDate: qCompareEndDate, category } = filters;

            // Extract filter values - frontend may send as 'brand' or 'brand[]' (array format)
            const rawBrand = filters['brand[]'] || filters.brand;
            const rawLocation = filters['location[]'] || filters.location;

            // Normalize multi-value filters
            const brandArr = normalizeFilterArray(rawBrand);
            const locationArr = normalizeFilterArray(rawLocation);
            const brand = brandArr ? (brandArr.length === 1 ? brandArr[0] : brandArr) : null;
            const location = locationArr ? (locationArr.length === 1 ? locationArr[0] : locationArr) : null;

            const monthsBack = parseInt(months, 10) || 1;

            // Calculate date range
            let endDate = await getCachedMaxDate();
            let startDate = endDate.subtract(monthsBack, 'month').startOf('day');
            if (qStartDate && qEndDate) {
                startDate = dayjs(qStartDate).startOf('day');
                endDate = dayjs(qEndDate).endOf('day');
            }

            // Helper for currency formatting
            const formatCurrency = (value) => {
                const val = parseFloat(value);
                if (isNaN(val)) return "0";
                if (val < 0.01 && val > -0.01) return "0";
                if (val >= 1000000000) return `₹${(val / 1000000000).toFixed(2)} B`;
                if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
                if (val >= 1000000) return `₹${(val / 1000000).toFixed(2)} M`;
                if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lac`;
                if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
                return `₹${val.toFixed(2)}`;
            };

            // Fetch platforms from rca_sku_dim
            const cachedPlatforms = await getCachedDistinctPlatforms();
            let platformDefinitions = cachedPlatforms;

            if (!platformDefinitions) {
                const platformsFromDb = await queryClickHouse(`SELECT DISTINCT platform FROM rca_sku_dim WHERE platform IS NOT NULL AND platform != ''`);

                const getPlatformLogo = (name) => {
                    const logoMap = {
                        'zepto': 'https://upload.wikimedia.org/wikipedia/en/7/7d/Logo_of_Zepto.png',
                        'blinkit': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Blinkit-yellow-rounded.svg',
                        'swiggy': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Swiggy_Logo_2024.webp',
                        'amazon': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
                        'flipkart': 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Flipkart-logo.png'
                    };
                    return logoMap[name.toLowerCase()] || 'https://cdn-icons-png.flaticon.com/512/3502/3502685.png';
                };

                const getPlatformType = (name) => {
                    const qCommerce = ['zepto', 'blinkit', 'swiggy instamart', 'dunzo'];
                    const marketplace = ['amazon', 'flipkart', 'swiggy', 'bigbasket', 'jiomart'];
                    const lower = name.toLowerCase();
                    if (qCommerce.some(p => lower.includes(p))) return 'Q-commerce';
                    if (marketplace.some(p => lower.includes(p))) return 'Marketplace';
                    return 'E-commerce';
                };

                platformDefinitions = platformsFromDb
                    .map(p => p.platform)
                    .filter(p => p && p.trim())
                    .map(name => ({
                        key: name.toLowerCase().replace(/\s+/g, '_'),
                        label: name.charAt(0).toUpperCase() + name.slice(1),
                        type: getPlatformType(name),
                        logo: getPlatformLogo(name)
                    }));
                cacheDistinctPlatforms(platformDefinitions);
            }

            // Calculate MoM dates or use provided comparison dates
            let momStart = startDate.clone().subtract(1, 'month');
            let momEnd = endDate.clone().subtract(1, 'month');

            if (qCompareStartDate && qCompareEndDate) {
                momStart = dayjs(qCompareStartDate).startOf('day');
                momEnd = dayjs(qCompareEndDate).endOf('day');
            }

            // ===== INLINE BULK PLATFORM METRICS QUERY - USING CLICKHOUSE =====
            // Helper to escape strings for ClickHouse
            const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

            // Build base conditions for rb_pdp_olap
            const buildOfftakeConds = (start, end) => {
                const conds = [`toDate(DATE) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`];
                if (brandArr && brandArr.length > 0) {
                    conds.push(`(${brandArr.map(b => `Brand LIKE '%${escapeStr(b)}%'`).join(' OR ')})`);
                } else {
                    conds.push(`toString(Comp_flag) = '0'`);
                }
                if (locationArr && locationArr.length > 0) {
                    conds.push(`Location IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
                if (category && category !== 'All') {
                    conds.push(`Category = '${escapeStr(category)}'`);
                }
                return conds.join(' AND ');
            };

            // Build base conditions for rb_kw (SOS)
            const buildSosConds = (start, end) => {
                const conds = [`toDate(kw_crawl_date) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`];
                if (locationArr && locationArr.length > 0) {
                    conds.push(`location_name IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
                if (category && category !== 'All') {
                    conds.push(`keyword_category = '${escapeStr(category)}'`);
                }
                return conds.join(' AND ');
            };

            // Build conditions for rb_brand_ms (Market Share)
            const buildMsConds = (start, end, brandsFilter = null) => {
                const conds = [`toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`];
                conds.push(`sales IS NOT NULL`);
                if (brandsFilter && brandsFilter.length > 0) {
                    conds.push(`brand IN (${brandsFilter.map(b => `'${escapeStr(b)}'`).join(', ')})`);
                }
                if (locationArr && locationArr.length > 0) {
                    conds.push(`Location IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
                if (category && category !== 'All') {
                    conds.push(`category_master = '${escapeStr(category)}'`);
                }
                return conds.join(' AND ');
            };

            const currOfftakeConds = buildOfftakeConds(startDate, endDate);
            const prevOfftakeConds = buildOfftakeConds(momStart, momEnd);
            const currSosConds = buildSosConds(startDate, endDate);
            const prevSosConds = buildSosConds(momStart, momEnd);

            // Get valid brand names for market share
            const validBrandResult = await queryClickHouse(`SELECT DISTINCT brand_name FROM rca_sku_dim WHERE toString(comp_flag) = '0' AND brand_name IS NOT NULL`);
            const validBrandNames = validBrandResult.map(b => b.brand_name).filter(Boolean);
            // Handle brand being either a string or an array
            const brandsForNumerator = (brand && brand !== 'All')
                ? (Array.isArray(brand) ? brand : [brand])
                : validBrandNames;

            const currMsNumConds = buildMsConds(startDate, endDate, brandsForNumerator);
            const currMsDenomConds = buildMsConds(startDate, endDate, null);
            const prevMsNumConds = buildMsConds(momStart, momEnd, brandsForNumerator);
            const prevMsDenomConds = buildMsConds(momStart, momEnd, null);

            console.log('[getPlatformOverview] Executing ClickHouse platform queries with SOS and Market Share...');

            const [currData, prevData, currSosOurBrands, currSosTotal, prevSosOurBrands, prevSosTotal, currMsNum, currMsDenom, prevMsNum, prevMsDenom] = await Promise.all([
                // Query 1: Current period offtake metrics by platform
                queryClickHouse(`
                    SELECT Platform,
                        SUM(ifNull(toFloat64(Sales), 0)) as sales,
                        SUM(ifNull(toFloat64(Qty_Sold), 0)) as qty,
                        SUM(ifNull(toFloat64(Ad_Spend), 0)) as spend,
                        SUM(ifNull(toFloat64(Ad_sales), 0)) as ad_sales,
                        SUM(ifNull(toFloat64(Ad_Clicks), 0)) as clicks,
                        SUM(ifNull(toFloat64(Ad_Impressions), 0)) as impressions,
                        SUM(ifNull(toFloat64(Ad_Quanity_sold), 0)) as orders,
                        SUM(ifNull(toFloat64(neno_osa), 0)) as neno,
                        SUM(ifNull(toFloat64(deno_osa), 0)) as deno
                    FROM rb_pdp_olap
                    WHERE ${currOfftakeConds}
                    GROUP BY Platform
                `),
                // Query 2: Previous period offtake metrics by platform
                queryClickHouse(`
                    SELECT Platform,
                        SUM(ifNull(toFloat64(Sales), 0)) as sales,
                        SUM(ifNull(toFloat64(Qty_Sold), 0)) as qty,
                        SUM(ifNull(toFloat64(Ad_Spend), 0)) as spend,
                        SUM(ifNull(toFloat64(Ad_sales), 0)) as ad_sales,
                        SUM(ifNull(toFloat64(Ad_Clicks), 0)) as clicks,
                        SUM(ifNull(toFloat64(Ad_Impressions), 0)) as impressions,
                        SUM(ifNull(toFloat64(Ad_Quanity_sold), 0)) as orders,
                        SUM(ifNull(toFloat64(neno_osa), 0)) as neno,
                        SUM(ifNull(toFloat64(deno_osa), 0)) as deno
                    FROM rb_pdp_olap
                    WHERE ${prevOfftakeConds}
                    GROUP BY Platform
                `),
                // Query 3: Current SOS - Our brands count per platform
                queryClickHouse(`
                    SELECT platform_name, count() as count
                    FROM rb_kw
                    WHERE ${currSosConds} AND toString(keyword_is_rb_product) = '1'
                    GROUP BY platform_name
                `),
                // Query 4: Current SOS - Total count per platform
                queryClickHouse(`
                    SELECT platform_name, count() as count
                    FROM rb_kw
                    WHERE ${currSosConds}
                    GROUP BY platform_name
                `),
                // Query 5: Previous SOS - Our brands count per platform
                queryClickHouse(`
                    SELECT platform_name, count() as count
                    FROM rb_kw
                    WHERE ${prevSosConds} AND toString(keyword_is_rb_product) = '1'
                    GROUP BY platform_name
                `),
                // Query 6: Previous SOS - Total count per platform
                queryClickHouse(`
                    SELECT platform_name, count() as count
                    FROM rb_kw
                    WHERE ${prevSosConds}
                    GROUP BY platform_name
                `),
                // Query 7: Current Market Share - numerator (our brands)
                queryClickHouse(`
                    SELECT Platform, SUM(toFloat64OrZero(sales)) as our_sales
                    FROM rb_brand_ms
                    WHERE ${currMsNumConds}
                    GROUP BY Platform
                `),
                // Query 8: Current Market Share - denominator (total)
                queryClickHouse(`
                    SELECT Platform, SUM(toFloat64OrZero(sales)) as total_sales
                    FROM rb_brand_ms
                    WHERE ${currMsDenomConds}
                    GROUP BY Platform
                `),
                // Query 9: Previous Market Share - numerator
                queryClickHouse(`
                    SELECT Platform, SUM(toFloat64OrZero(sales)) as our_sales
                    FROM rb_brand_ms
                    WHERE ${prevMsNumConds}
                    GROUP BY Platform
                `),
                // Query 10: Previous Market Share - denominator
                queryClickHouse(`
                    SELECT Platform, SUM(toFloat64OrZero(sales)) as total_sales
                    FROM rb_brand_ms
                    WHERE ${prevMsDenomConds}
                    GROUP BY Platform
                `)
            ]);

            // Calculate Market Share per platform from numerator/denominator
            const currMsNumMap = new Map(currMsNum.map(r => [r.Platform?.toLowerCase(), parseFloat(r.our_sales || 0)]));
            const currMsDenomMap = new Map(currMsDenom.map(r => [r.Platform?.toLowerCase(), parseFloat(r.total_sales || 0)]));
            const currMs = currMsDenom.map(r => {
                const key = r.Platform?.toLowerCase();
                const ourSales = currMsNumMap.get(key) || 0;
                const totalSales = parseFloat(r.total_sales || 0);
                return { Platform: r.Platform, avg_ms: totalSales > 0 ? (ourSales / totalSales) * 100 : 0 };
            });

            const prevMsNumMap = new Map(prevMsNum.map(r => [r.Platform?.toLowerCase(), parseFloat(r.our_sales || 0)]));
            const prevMsDenomMap = new Map(prevMsDenom.map(r => [r.Platform?.toLowerCase(), parseFloat(r.total_sales || 0)]));
            const prevMs = prevMsDenom.map(r => {
                const key = r.Platform?.toLowerCase();
                const ourSales = prevMsNumMap.get(key) || 0;
                const totalSales = parseFloat(r.total_sales || 0);
                return { Platform: r.Platform, avg_ms: totalSales > 0 ? (ourSales / totalSales) * 100 : 0 };
            });

            // Build SOS lookup maps
            const currSosOurMap = new Map(currSosOurBrands.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));
            const currSosTotalMap = new Map(currSosTotal.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));
            const prevSosOurMap = new Map(prevSosOurBrands.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));
            const prevSosTotalMap = new Map(prevSosTotal.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));

            // Build Market Share lookup maps
            const currMsMap = new Map(currMs.map(r => [r.Platform?.toLowerCase(), parseFloat(r.avg_ms) || 0]));
            const prevMsMap = new Map(prevMs.map(r => [r.Platform?.toLowerCase(), parseFloat(r.avg_ms) || 0]));

            // Helper to calculate SOS percentage
            const calcSos = (ourCount, totalCount) => totalCount > 0 ? (ourCount / totalCount) * 100 : 0;

            // Build bulk platform metrics map
            const bulkPlatformMap = new Map();
            platformDefinitions.forEach(p => {
                const key = p.label.toLowerCase();
                const c = currData.find(d => d.Platform && d.Platform.toLowerCase() === key);
                const pv = prevData.find(d => d.Platform && d.Platform.toLowerCase() === key);

                // Calculate SOS for this platform
                const currSosValue = calcSos(currSosOurMap.get(key) || 0, currSosTotalMap.get(key) || 0);
                const prevSosValue = calcSos(prevSosOurMap.get(key) || 0, prevSosTotalMap.get(key) || 0);

                // Get Market Share for this platform
                const currMsValue = currMsMap.get(key) || 0;
                const prevMsValue = prevMsMap.get(key) || 0;

                bulkPlatformMap.set(p.label, {
                    curr: {
                        sales: parseFloat(c?.sales || 0),
                        qty: parseFloat(c?.qty || 0),
                        spend: parseFloat(c?.spend || 0),
                        adSales: parseFloat(c?.ad_sales || 0),
                        clicks: parseFloat(c?.clicks || 0),
                        impressions: parseFloat(c?.impressions || 0),
                        orders: parseFloat(c?.orders || 0),
                        neno: parseFloat(c?.neno || 0),
                        deno: parseFloat(c?.deno || 0),
                        ms: currMsValue,
                        sos: currSosValue
                    },
                    prev: {
                        sales: parseFloat(pv?.sales || 0),
                        qty: parseFloat(pv?.qty || 0),
                        spend: parseFloat(pv?.spend || 0),
                        adSales: parseFloat(pv?.ad_sales || 0),
                        clicks: parseFloat(pv?.clicks || 0),
                        impressions: parseFloat(pv?.impressions || 0),
                        orders: parseFloat(pv?.orders || 0),
                        neno: parseFloat(pv?.neno || 0),
                        deno: parseFloat(pv?.deno || 0),
                        ms: prevMsValue,
                        sos: prevSosValue
                    }
                });
            });
            console.log(`[getPlatformOverview] Bulk query complete for ${platformDefinitions.length} platforms`);

            // Helper functions
            const calcChange = (current, previous) => {
                if (previous === 0) return current > 0 ? 100 : 0;
                return ((current - previous) / previous) * 100;
            };
            const calcPPChange = (current, previous) => current - previous;
            const formatChange = (val, isPP = false) => {
                const suffix = isPP ? ' pp' : '%';
                const sign = val >= 0 ? '+' : '';
                return `${sign}${val.toFixed(1)}${suffix}`;
            };

            const generateColumns = (offtake, availability, sos, marketShare, spend, roas, inorgSales, conversion, cpm, cpc, promoMyBrand, promoCompete,
                prevOfftake, prevAvailability, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales, prevConversion, prevCpm, prevCpc, prevPromoMyBrand, prevPromoCompete,
                offtakeUnits = 0, inorgUnits = 0, prevOfftakeUnits = 0, prevInorgUnits = 0) => {
                const offtakeChange = calcChange(offtake, prevOfftake);
                const spendChange = calcChange(spend, prevSpend);
                const roasChange = calcChange(roas, prevRoas);
                const inorgSalesChange = calcChange(inorgSales, prevInorgSales);
                const conversionChange = calcPPChange(conversion, prevConversion);
                const availabilityChange = calcPPChange(availability, prevAvailability);
                const sosChange = calcPPChange(sos, prevSos);
                const marketShareChange = calcPPChange(marketShare, prevMarketShare);
                const promoMyBrandChange = calcPPChange(promoMyBrand, prevPromoMyBrand);
                const promoCompeteChange = calcPPChange(promoCompete, prevPromoCompete);
                const cpmChange = calcChange(cpm, prevCpm);
                const cpcChange = calcChange(cpc, prevCpc);

                return [
                    { title: "Offtakes", value: formatCurrency(offtake), change: { text: formatChange(offtakeChange), positive: offtakeChange >= 0 }, meta: { units: `${formatUnits(offtakeUnits)} units`, change: formatChange(offtakeChange) } },
                    { title: "Spend", value: formatCurrency(spend), change: { text: formatChange(spendChange), positive: spendChange >= 0 }, meta: { units: "spend", change: formatChange(spendChange) } },
                    { title: "ROAS", value: `${roas.toFixed(2)}x`, change: { text: formatChange(roasChange), positive: roasChange >= 0 }, meta: { units: "return", change: formatChange(roasChange) } },
                    { title: "Inorg Sales", value: formatCurrency(inorgSales), change: { text: formatChange(inorgSalesChange), positive: inorgSalesChange >= 0 }, meta: { units: `${formatUnits(inorgUnits)} units`, change: formatChange(inorgSalesChange) } },
                    { title: "Conversion", value: `${conversion.toFixed(1)}%`, change: { text: formatChange(conversionChange, true), positive: conversionChange >= 0 }, meta: { units: "% conv", change: formatChange(conversionChange, true) } },
                    { title: "Availability", value: `${availability.toFixed(1)}%`, change: { text: formatChange(availabilityChange, true), positive: availabilityChange >= 0 }, meta: { units: "stores", change: formatChange(availabilityChange, true) } },
                    { title: "SOS", value: `${sos.toFixed(1)}%`, change: { text: formatChange(sosChange, true), positive: sosChange >= 0 }, meta: { units: "index", change: formatChange(sosChange, true) } },
                    { title: "Market Share", value: `${(parseFloat(marketShare) || 0).toFixed(1)}%`, change: { text: formatChange(marketShareChange, true), positive: marketShareChange >= 0 }, meta: { units: "Category", change: formatChange(marketShareChange, true) } },
                    { title: "Promo My Brand", value: `${promoMyBrand.toFixed(1)}%`, change: { text: formatChange(promoMyBrandChange, true), positive: promoMyBrandChange >= 0 }, meta: { units: "Depth", change: formatChange(promoMyBrandChange, true) } },
                    { title: "Promo Compete", value: `${promoCompete.toFixed(1)}%`, change: { text: formatChange(promoCompeteChange, true), positive: promoCompeteChange >= 0 }, meta: { units: "Depth", change: formatChange(promoCompeteChange, true) } },
                    { title: "CPM", value: `₹${Math.round(cpm)}`, change: { text: formatChange(cpmChange), positive: cpmChange >= 0 }, meta: { units: "impressions", change: formatChange(cpmChange) } },
                    { title: "CPC", value: `₹${Math.round(cpc)}`, change: { text: formatChange(cpcChange), positive: cpcChange >= 0 }, meta: { units: "clicks", change: formatChange(cpcChange) } }
                ];
            };

            // Build platformOverview array
            const platformOverview = [];

            // "All" row - aggregate across all platforms using ClickHouse
            const allConds = buildOfftakeConds(startDate, endDate);
            const prevAllConds = buildOfftakeConds(momStart, momEnd);

            const [allMetricsResult, prevAllMetricsResult] = await Promise.all([
                queryClickHouse(`
                    SELECT 
                        SUM(ifNull(toFloat64(Sales), 0)) as total_sales,
                        SUM(ifNull(toFloat64(Qty_Sold), 0)) as total_qty,
                        SUM(ifNull(toFloat64(Ad_Spend), 0)) as total_spend,
                        SUM(ifNull(toFloat64(Ad_sales), 0)) as total_ad_sales,
                        SUM(ifNull(toFloat64(Ad_Clicks), 0)) as total_clicks,
                        SUM(ifNull(toFloat64(Ad_Impressions), 0)) as total_impressions,
                        SUM(ifNull(toFloat64(Ad_Quanity_sold), 0)) as total_inorg_qty,
                        SUM(ifNull(toFloat64(neno_osa), 0)) as total_neno,
                        SUM(ifNull(toFloat64(deno_osa), 0)) as total_deno
                    FROM rb_pdp_olap
                    WHERE ${allConds}
                `),
                queryClickHouse(`
                    SELECT 
                        SUM(ifNull(toFloat64(Sales), 0)) as total_sales,
                        SUM(ifNull(toFloat64(Qty_Sold), 0)) as total_qty,
                        SUM(ifNull(toFloat64(Ad_Spend), 0)) as total_spend,
                        SUM(ifNull(toFloat64(Ad_sales), 0)) as total_ad_sales,
                        SUM(ifNull(toFloat64(Ad_Clicks), 0)) as total_clicks,
                        SUM(ifNull(toFloat64(Ad_Impressions), 0)) as total_impressions,
                        SUM(ifNull(toFloat64(Ad_Quanity_sold), 0)) as total_inorg_qty,
                        SUM(ifNull(toFloat64(neno_osa), 0)) as total_neno,
                        SUM(ifNull(toFloat64(deno_osa), 0)) as total_deno
                    FROM rb_pdp_olap
                    WHERE ${prevAllConds}
                `)
            ]);

            const allMetrics = allMetricsResult[0] || {};
            const allOfftake = parseFloat(allMetrics.total_sales || 0);
            const allOfftakeUnits = parseFloat(allMetrics.total_qty || 0);
            const allSpend = parseFloat(allMetrics.total_spend || 0);
            const allAdSales = parseFloat(allMetrics.total_ad_sales || 0);
            const allInorgUnits = parseFloat(allMetrics.total_inorg_qty || 0);
            const allClicks = parseFloat(allMetrics.total_clicks || 0);
            const allImpressions = parseFloat(allMetrics.total_impressions || 0);
            const allOrders = parseFloat(allMetrics.total_inorg_qty || 0); // Quantity sold via ads
            const allNeno = parseFloat(allMetrics.total_neno || 0);
            const allDeno = parseFloat(allMetrics.total_deno || 0);

            const allAvailability = allDeno > 0 ? (allNeno / allDeno) * 100 : 0;
            const allRoas = allSpend > 0 ? allAdSales / allSpend : 0;
            // Conversion = (Orders / Clicks) * 100 (Standard percentage)
            const allConversion = allClicks > 0 ? (allOrders / allClicks) * 100 : 0;
            const allCpm = allImpressions > 0 ? (allSpend / allImpressions) * 1000 : 0;
            const allCpc = allClicks > 0 ? allSpend / allClicks : 0;
            const allInorgSales = allAdSales; // Absolute value in currency

            // Previous period for "All" row
            const prevAllMetrics = prevAllMetricsResult[0] || {};
            const prevAllOfftake = parseFloat(prevAllMetrics.total_sales || 0);
            const prevAllOfftakeUnits = parseFloat(prevAllMetrics.total_qty || 0);
            const prevAllSpend = parseFloat(prevAllMetrics.total_spend || 0);
            const prevAllAdSales = parseFloat(prevAllMetrics.total_ad_sales || 0);
            const prevAllInorgUnits = parseFloat(prevAllMetrics.total_inorg_qty || 0);
            const prevAllClicks = parseFloat(prevAllMetrics.total_clicks || 0);
            const prevAllImpressions = parseFloat(prevAllMetrics.total_impressions || 0);
            const prevAllOrders = parseFloat(prevAllMetrics.total_inorg_qty || 0);
            const prevAllNeno = parseFloat(prevAllMetrics.total_neno || 0);
            const prevAllDeno = parseFloat(prevAllMetrics.total_deno || 0);

            const prevAllAvailability = prevAllDeno > 0 ? (prevAllNeno / prevAllDeno) * 100 : 0;
            const prevAllRoas = prevAllSpend > 0 ? prevAllAdSales / prevAllSpend : 0;
            const prevAllConversion = prevAllClicks > 0 ? (prevAllOrders / prevAllClicks) * 100 : 0;
            const prevAllCpm = prevAllImpressions > 0 ? (prevAllSpend / prevAllImpressions) * 1000 : 0;
            const prevAllCpc = prevAllClicks > 0 ? prevAllSpend / prevAllClicks : 0;
            const prevAllInorgSales = prevAllAdSales;

            // Calculate overall SOS (sum counts across all platforms)
            let totalSosOur = 0, totalSosAll = 0;
            for (const [, count] of currSosOurMap) totalSosOur += count;
            for (const [, count] of currSosTotalMap) totalSosAll += count;
            const allSos = calcSos(totalSosOur, totalSosAll);

            let prevTotalSosOur = 0, prevTotalSosAll = 0;
            for (const [, count] of prevSosOurMap) prevTotalSosOur += count;
            for (const [, count] of prevSosTotalMap) prevTotalSosAll += count;
            const prevAllSos = calcSos(prevTotalSosOur, prevTotalSosAll);

            // Calculate overall Market Share (weighted approach: sum of num / sum of denom)
            let sumMsNum = 0, sumMsDenom = 0;
            for (const [, value] of currMsNumMap) sumMsNum += value;
            for (const [, value] of currMsDenomMap) sumMsDenom += value;
            const allMarketShare = sumMsDenom > 0 ? (sumMsNum / sumMsDenom) * 100 : 0;

            let prevSumMsNum = 0, prevSumMsDenom = 0;
            for (const [, value] of prevMsNumMap) prevSumMsNum += value;
            for (const [, value] of prevMsDenomMap) prevSumMsDenom += value;
            const prevAllMarketShare = prevSumMsDenom > 0 ? (prevSumMsNum / prevSumMsDenom) * 100 : 0;

            platformOverview.push({
                key: 'all',
                label: 'All',
                type: 'Overall',
                logo: "https://cdn-icons-png.flaticon.com/512/711/711284.png",
                columns: generateColumns(
                    allOfftake, allAvailability, allSos, allMarketShare, allSpend, allRoas, allInorgSales, allConversion, allCpm, allCpc, 0, 0,
                    prevAllOfftake, prevAllAvailability, prevAllSos, prevAllMarketShare, prevAllSpend, prevAllRoas, prevAllInorgSales, prevAllConversion, prevAllCpm, prevAllCpc, 0, 0,
                    allOfftakeUnits, allInorgUnits, prevAllOfftakeUnits, prevAllInorgUnits
                )
            });

            // Process each platform from bulk data
            for (const p of platformDefinitions) {
                const metrics = bulkPlatformMap.get(p.label) || { curr: {}, prev: {} };

                const offtake = metrics.curr.sales || 0;
                const offtakeUnits = metrics.curr.qty || 0;
                const totalSpend = metrics.curr.spend || 0;
                const totalAdSales = metrics.curr.adSales || 0;
                const inorgUnits = metrics.curr.orders || 0; // Using orders as units for Inorg Sales
                const totalClicks = metrics.curr.clicks || 0;
                const totalImpressions = metrics.curr.impressions || 0;
                const totalOrders = metrics.curr.orders || 0;
                const marketShare = metrics.curr.ms || 0;
                const sos = metrics.curr.sos || 0;

                const availability = metrics.curr.deno > 0 ? (metrics.curr.neno / metrics.curr.deno) * 100 : 0;
                const roas = totalSpend > 0 ? totalAdSales / totalSpend : 0;
                // Conversion = (Orders / Clicks) * 100
                const conversion = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0;
                const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
                const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
                const inorgSales = totalAdSales;

                // Previous period
                const prevOfftake = metrics.prev.sales || 0;
                const prevOfftakeUnits = metrics.prev.qty || 0;
                const prevSpend = metrics.prev.spend || 0;
                const prevAdSales = metrics.prev.adSales || 0;
                const prevInorgUnits = metrics.prev.orders || 0;
                const prevMarketShare = metrics.prev.ms || 0;
                const prevSos = metrics.prev.sos || 0;
                const prevImpressions = metrics.prev.impressions || 0;
                const prevClicks = metrics.prev.clicks || 0;
                const prevOrders = metrics.prev.orders || 0;
                const prevAvailability = metrics.prev.deno > 0 ? (metrics.prev.neno / metrics.prev.deno) * 100 : 0;
                const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;
                // Conversion = (Orders / Clicks) * 100
                const prevConversion = prevClicks > 0 ? (prevOrders / prevClicks) * 100 : 0;
                const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
                const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;
                const prevInorgSales = prevAdSales;

                platformOverview.push({
                    key: p.key,
                    label: p.label,
                    type: p.type,
                    logo: p.logo,
                    columns: generateColumns(offtake, availability, sos, marketShare, totalSpend, roas, inorgSales, conversion, cpm, cpc, 0, 0,
                        prevOfftake, prevAvailability, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales, prevConversion, prevCpm, prevCpc, 0, 0,
                        offtakeUnits, inorgUnits, prevOfftakeUnits, prevInorgUnits)
                });
            }

            console.log(`[getPlatformOverview] OPTIMIZED: Returning ${platformOverview.length} platforms`);
            return platformOverview;
        });
    }, parseInt(process.env.REDIS_DEFAULT_TTL || '1800'));
};

/**
 * Get Month Overview Data - OPTIMIZED
 * Requires monthOverviewPlatform parameter
 * NOTE: Computes ONLY month data, not platforms/categories/brands
 */
const getMonthOverview = async (filters) => {
    const cacheKey = generateCacheKey('month_overview', filters);
    return await getCachedOrCompute(cacheKey, async () => {
        return await coalesceRequest(`compute:${cacheKey}`, async () => {
            console.log('[getMonthOverview] Computing OPTIMIZED month overview data...');

            const { months = 1, startDate: qStartDate, endDate: qEndDate, category, monthOverviewPlatform } = filters;

            // Extract filter values - frontend may send as 'brand' or 'brand[]' (array format)
            const rawBrand = filters['brand[]'] || filters.brand;
            const rawLocation = filters['location[]'] || filters.location;

            // Normalize multi-value filters
            const brandArr = normalizeFilterArray(rawBrand);
            const locationArr = normalizeFilterArray(rawLocation);
            const brand = brandArr ? (brandArr.length === 1 ? brandArr[0] : brandArr) : null;
            const location = locationArr ? (locationArr.length === 1 ? locationArr[0] : locationArr) : null;

            const monthsBack = parseInt(months, 10) || 1;
            const moPlatform = monthOverviewPlatform || filters.platform || null;

            // Skip if no platform selected
            if (!moPlatform || moPlatform === 'All') {
                console.log('[getMonthOverview] No specific platform selected, returning empty');
                return [];
            }

            // Calculate date range
            let endDate = await getCachedMaxDate();
            let startDate = endDate.subtract(monthsBack, 'month').startOf('day');
            if (qStartDate && qEndDate) {
                startDate = dayjs(qStartDate).startOf('day');
                endDate = dayjs(qEndDate).endOf('day');
            }

            // Helper for currency formatting
            const formatCurrency = (value) => {
                const val = parseFloat(value);
                if (isNaN(val)) return "0";
                if (val < 0.01 && val > -0.01) return "0";
                if (val >= 1000000000) return `₹${(val / 1000000000).toFixed(2)} B`;
                if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
                if (val >= 1000000) return `₹${(val / 1000000).toFixed(2)} M`;
                if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lac`;
                if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
                return `₹${val.toFixed(2)}`;
            };

            // Generate month buckets
            const monthBuckets = [];
            let current = startDate.clone().startOf('month');
            const endMonth = endDate.clone().endOf('month');
            while (current.isBefore(endMonth)) {
                monthBuckets.push({
                    label: current.format('MMM'),
                    date: current.toDate(),
                    value: 0
                });
                current = current.add(1, 'month');
            }

            // Query all months at once with GROUP BY - USING CLICKHOUSE
            const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

            // Build offtake conditions
            const buildMoConds = () => {
                const conds = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
                conds.push(`Platform = '${escapeStr(moPlatform)}'`);
                if (brandArr && brandArr.length > 0) {
                    conds.push(`(${brandArr.map(b => `Brand LIKE '%${escapeStr(b)}%'`).join(' OR ')})`);
                } else {
                    conds.push(`toString(Comp_flag) = '0'`);
                }
                if (locationArr && locationArr.length > 0) {
                    conds.push(`Location IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
                if (category && category !== 'All') {
                    conds.push(`Category = '${escapeStr(category)}'`);
                }
                return conds.join(' AND ');
            };

            // Build SOS conditions
            const buildSosMoConds = () => {
                const conds = [`toDate(kw_crawl_date) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
                conds.push(`platform_name = '${escapeStr(moPlatform)}'`);
                if (category && category !== 'All') {
                    conds.push(`keyword_category = '${escapeStr(category)}'`);
                }
                if (locationArr && locationArr.length > 0) {
                    conds.push(`location_name IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
                return conds.join(' AND ');
            };

            const moConds = buildMoConds();
            const sosMoConds = buildSosMoConds();

            // Get valid brand names
            const validBrandNamesForMonth = await getCachedValidBrandNames();
            const brandsForMonthMs = (brand && brand !== 'All') ? (Array.isArray(brand) ? brand : [brand]) : validBrandNamesForMonth;

            // Build MS conditions
            const buildMsMoConds = (brandsFilter = null) => {
                const conds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
                conds.push(`Platform = '${escapeStr(moPlatform)}'`);
                conds.push(`sales IS NOT NULL`);
                if (brandsFilter && brandsFilter.length > 0) {
                    conds.push(`brand IN (${brandsFilter.map(b => `'${escapeStr(b)}'`).join(', ')})`);
                }
                if (category && category !== 'All') {
                    conds.push(`category = '${escapeStr(category)}'`);
                }
                if (locationArr && locationArr.length > 0) {
                    conds.push(`Location IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
                return conds.join(' AND ');
            };

            const msNumMoConds = buildMsMoConds(brandsForMonthMs);
            const msDenomMoConds = buildMsMoConds(null);

            // ⚡ OPTIMIZED: Run all queries in PARALLEL with ClickHouse
            const [monthlyData, sosNumMonth, sosDenomMonth, msNumMonth, msDenomMonth] = await Promise.all([
                // Query 1: Monthly offtake data
                queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(DATE), '%Y-%m-01') as month_date,
                        SUM(ifNull(toFloat64(Sales), 0)) as total_sales,
                        SUM(ifNull(toFloat64(Ad_Spend), 0)) as total_spend,
                        SUM(ifNull(toFloat64(Ad_sales), 0)) as total_ad_sales,
                        SUM(ifNull(toFloat64(Ad_Clicks), 0)) as total_clicks,
                        SUM(ifNull(toFloat64(Ad_Impressions), 0)) as total_impressions,
                        SUM(ifNull(toFloat64(Ad_Quanity_sold), 0)) as total_orders,
                        SUM(ifNull(toFloat64(neno_osa), 0)) as total_neno,
                        SUM(ifNull(toFloat64(deno_osa), 0)) as total_deno
                    FROM rb_pdp_olap
                    WHERE ${moConds}
                    GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                `),
                // Query 2: SOS numerator (our brands)
                queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(kw_crawl_date), '%Y-%m-01') as month_date,
                        count() as count
                    FROM rb_kw
                    WHERE ${sosMoConds} AND toString(keyword_is_rb_product) = '1'
                    GROUP BY formatDateTime(toDate(kw_crawl_date), '%Y-%m-01')
                `),
                // Query 3: SOS denominator (all)
                queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(kw_crawl_date), '%Y-%m-01') as month_date,
                        count() as count
                    FROM rb_kw
                    WHERE ${sosMoConds}
                    GROUP BY formatDateTime(toDate(kw_crawl_date), '%Y-%m-01')
                `),
                // Query 4: MS numerator
                queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(created_on), '%Y-%m-01') as month_date,
                        SUM(toFloat64OrZero(sales)) as our_sales
                    FROM rb_brand_ms
                    WHERE ${msNumMoConds}
                    GROUP BY formatDateTime(toDate(created_on), '%Y-%m-01')
                `),
                // Query 5: MS denominator
                queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(created_on), '%Y-%m-01') as month_date,
                        SUM(toFloat64OrZero(sales)) as total_sales
                    FROM rb_brand_ms
                    WHERE ${msDenomMoConds}
                    GROUP BY formatDateTime(toDate(created_on), '%Y-%m-01')
                `)
            ]);

            const sosNumMonthMap = new Map(sosNumMonth.map(r => [r.month_date, parseInt(r.count) || 0]));
            const sosDenomMonthMap = new Map(sosDenomMonth.map(r => [r.month_date, parseInt(r.count) || 0]));
            const msNumMonthMap = new Map(msNumMonth.map(r => [r.month_date, parseFloat(r.our_sales || 0)]));
            const msDenomMonthMap = new Map(msDenomMonth.map(r => [r.month_date, parseFloat(r.total_sales || 0)]));

            // Build lookup map
            const dataMap = new Map(monthlyData.map(d => [d.month_date, d]));

            const generateMonthColumns = (offtake, availability, sos, marketShare, spend, roas, inorgSales, conversion, cpm, cpc) => [
                { title: "Offtakes", value: formatCurrency(offtake), meta: { units: "" } },
                { title: "Spend", value: formatCurrency(spend), meta: { units: "" } },
                { title: "ROAS", value: `${roas.toFixed(2)}x`, meta: { units: "" } },
                { title: "Inorg Sales", value: formatCurrency(inorgSales), meta: { units: "" } },
                { title: "Conversion", value: conversion.toFixed(1), meta: { units: "Clicks / Orders" } },
                { title: "Availability", value: `${availability.toFixed(1)}%`, meta: { units: "" } },
                { title: "SOS", value: `${sos.toFixed(1)}%`, meta: { units: "" } },
                { title: "Market Share", value: `${marketShare.toFixed(1)}%`, meta: { units: "" } },
                { title: "Promo My Brand", value: "0%", meta: { units: "" } },
                { title: "Promo Compete", value: "0%", meta: { units: "" } },
                { title: "CPM", value: `₹${Math.round(cpm)}`, meta: { units: "" } },
                { title: "CPC", value: `₹${Math.round(cpc)}`, meta: { units: "" } }
            ];

            const monthOverview = monthBuckets.map(bucket => {
                const monthKey = dayjs(bucket.date).format('YYYY-MM-01');
                const data = dataMap.get(monthKey) || {};

                const offtake = parseFloat(data.total_sales || 0);
                const spend = parseFloat(data.total_spend || 0);
                const adSales = parseFloat(data.total_ad_sales || 0);
                const clicks = parseFloat(data.total_clicks || 0);
                const impressions = parseFloat(data.total_impressions || 0);
                const orders = parseFloat(data.total_orders || 0);
                const neno = parseFloat(data.total_neno || 0);
                const deno = parseFloat(data.total_deno || 0);

                const availability = deno > 0 ? (neno / deno) * 100 : 0;
                const roas = spend > 0 ? adSales / spend : 0;
                const conversion = clicks > 0 ? orders / clicks : 0;  // Conversion = Orders / Clicks (matching Platform Overview)
                const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
                const cpc = clicks > 0 ? spend / clicks : 0;

                // Calculate SOS and MS for this month
                const sosNum = sosNumMonthMap.get(monthKey) || 0;
                const sosDenom = sosDenomMonthMap.get(monthKey) || 0;
                const sos = sosDenom > 0 ? (sosNum / sosDenom) * 100 : 0;

                const msNum = msNumMonthMap.get(monthKey) || 0;
                const msDenom = msDenomMonthMap.get(monthKey) || 0;
                const marketShare = msDenom > 0 ? (msNum / msDenom) * 100 : 0;

                return {
                    key: bucket.label,
                    label: bucket.label,
                    date: bucket.date,
                    type: bucket.label,
                    logo: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png",
                    columns: generateMonthColumns(offtake, availability, sos, marketShare, spend, roas, adSales, conversion, cpm, cpc)
                };
            });

            console.log(`[getMonthOverview] OPTIMIZED: Returning ${monthOverview.length} months`);
            return monthOverview;
        });
    }, parseInt(process.env.REDIS_DEFAULT_TTL || '1800'));
};

/**
 * Get Category Overview Data - OPTIMIZED
 * Requires categoryOverviewPlatform parameter
 * NOTE: Computes ONLY category data
 */
const getCategoryOverview = async (filters) => {
    const cacheKey = generateCacheKey('category_overview', filters);
    return await getCachedOrCompute(cacheKey, async () => {
        return await coalesceRequest(`compute:${cacheKey}`, async () => {
            console.log('[getCategoryOverview] Computing OPTIMIZED category overview data...');

            const { months = 1, startDate: qStartDate, endDate: qEndDate, categoryOverviewPlatform } = filters;

            // Extract filter values - frontend may send as 'brand' or 'brand[]' (array format)
            const rawBrand = filters['brand[]'] || filters.brand;
            const rawLocation = filters['location[]'] || filters.location;

            // Normalize multi-value filters
            const brandArr = normalizeFilterArray(rawBrand);
            const locationArr = normalizeFilterArray(rawLocation);
            const brand = brandArr ? (brandArr.length === 1 ? brandArr[0] : brandArr) : null;
            const location = locationArr ? (locationArr.length === 1 ? locationArr[0] : locationArr) : null;

            const monthsBack = parseInt(months, 10) || 1;
            const catPlatform = categoryOverviewPlatform || filters.platform || 'All';

            // Calculate date range
            let endDate = dayjs().endOf('day');
            let startDate = endDate.subtract(monthsBack, 'month').startOf('day');
            if (qStartDate && qEndDate) {
                startDate = dayjs(qStartDate).startOf('day');
                endDate = dayjs(qEndDate).endOf('day');
            }

            // Helper for currency formatting
            const formatCurrency = (value) => {
                const val = parseFloat(value);
                if (isNaN(val)) return "0";
                if (val < 0.01 && val > -0.01) return "0";
                if (val >= 1000000000) return `₹${(val / 1000000000).toFixed(2)} B`;
                if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
                if (val >= 1000000) return `₹${(val / 1000000).toFixed(2)} M`;
                if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lac`;
                if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
                return `₹${val.toFixed(2)}`;
            };

            // Helper to escape strings for ClickHouse
            const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

            // Build category conditions for rb_pdp_olap
            const buildCatConds = () => {
                const conds = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
                if (catPlatform && catPlatform !== 'All') {
                    conds.push(`Platform = '${escapeStr(catPlatform)}'`);
                }
                if (brandArr && brandArr.length > 0) {
                    conds.push(`(${brandArr.map(b => `Brand LIKE '%${escapeStr(b)}%'`).join(' OR ')})`);
                } else {
                    conds.push(`toString(Comp_flag) = '0'`);
                }
                if (locationArr && locationArr.length > 0) {
                    conds.push(`Location IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
                return conds.join(' AND ');
            };

            // Build SOS conditions for rb_kw
            const buildSosCatConds = () => {
                const conds = [`toDate(kw_crawl_date) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
                if (catPlatform && catPlatform !== 'All') {
                    conds.push(`platform_name = '${escapeStr(catPlatform)}'`);
                }
                if (locationArr && locationArr.length > 0) {
                    conds.push(`location_name IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
                return conds.join(' AND ');
            };

            // Build MS conditions for rb_brand_ms
            const buildMsCatConds = (brandsFilter = null) => {
                const conds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
                conds.push(`sales IS NOT NULL`);
                conds.push(`category_master IS NOT NULL`);
                if (catPlatform && catPlatform !== 'All') {
                    conds.push(`Platform = '${escapeStr(catPlatform)}'`);
                }
                if (brandsFilter && brandsFilter.length > 0) {
                    conds.push(`brand IN (${brandsFilter.map(b => `'${escapeStr(b)}'`).join(', ')})`);
                }
                if (locationArr && locationArr.length > 0) {
                    conds.push(`Location IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
                return conds.join(' AND ');
            };

            const catConds = buildCatConds();
            const sosCatConds = buildSosCatConds();

            // Get valid brand names for MS
            const validBrandNamesForCat = await getCachedValidBrandNames();
            const msNumCatConds = buildMsCatConds(validBrandNamesForCat);
            const msDenomCatConds = buildMsCatConds(null);

            // ⚡ OPTIMIZED: Run all queries in PARALLEL with ClickHouse
            const [distinctCategories, categoryData, sosNumCat, sosDenomCat, msNumCat, msDenomCat] = await Promise.all([
                // Query 1: Distinct categories
                queryClickHouse(`SELECT DISTINCT category FROM rca_sku_dim WHERE toString(status) = '1' AND category IS NOT NULL AND category != ''`),
                // Query 2: Category metrics
                queryClickHouse(`
                    SELECT Category,
                        SUM(ifNull(toFloat64(Sales), 0)) as total_sales,
                        SUM(ifNull(toFloat64(Qty_Sold), 0)) as total_qty,
                        SUM(ifNull(toFloat64(Ad_Spend), 0)) as total_spend,
                        SUM(ifNull(toFloat64(Ad_sales), 0)) as total_ad_sales,
                        SUM(ifNull(toFloat64(Ad_Clicks), 0)) as total_clicks,
                        SUM(ifNull(toFloat64(Ad_Impressions), 0)) as total_impressions,
                        SUM(ifNull(toFloat64(Ad_Quanity_sold), 0)) as total_orders,
                        SUM(ifNull(toFloat64(neno_osa), 0)) as total_neno,
                        SUM(ifNull(toFloat64(deno_osa), 0)) as total_deno
                    FROM rb_pdp_olap
                    WHERE ${catConds}
                    GROUP BY Category
                `),
                // Query 3: SOS numerator
                queryClickHouse(`
                    SELECT keyword_category, count() as count
                    FROM rb_kw
                    WHERE ${sosCatConds} AND toString(keyword_is_rb_product) = '1'
                    GROUP BY keyword_category
                `),
                // Query 4: SOS denominator
                queryClickHouse(`
                    SELECT keyword_category, count() as count
                    FROM rb_kw
                    WHERE ${sosCatConds}
                    GROUP BY keyword_category
                `),
                // Query 5: MS numerator (our brands)
                queryClickHouse(`
                    SELECT category_master, SUM(toFloat64OrZero(sales)) as our_sales
                    FROM rb_brand_ms
                    WHERE ${msNumCatConds}
                    GROUP BY category_master
                `),
                // Query 6: MS denominator (total sales)
                queryClickHouse(`
                    SELECT category_master, SUM(toFloat64OrZero(sales)) as total_sales
                    FROM rb_brand_ms
                    WHERE ${msDenomCatConds}
                    GROUP BY category_master
                `)
            ]);

            const categories = distinctCategories.map(c => c.category).filter(Boolean);
            const sosNumCatMap = new Map(sosNumCat.map(r => [r.keyword_category?.toLowerCase(), parseInt(r.count) || 0]));
            const sosDenomCatMap = new Map(sosDenomCat.map(r => [r.keyword_category?.toLowerCase(), parseInt(r.count) || 0]));
            const msNumCatMap = new Map(msNumCat.map(r => [r.category_master?.toLowerCase(), parseFloat(r.our_sales || 0)]));
            const msDenomCatMap = new Map(msDenomCat.map(r => [r.category_master?.toLowerCase(), parseFloat(r.total_sales || 0)]));

            // Build lookup map
            const dataMap = new Map(categoryData.map(d => [d.Category, d]));

            const categoryOverview = categories.map(catName => {
                const data = dataMap.get(catName) || {};

                const offtake = parseFloat(data.total_sales || 0);
                const offtakeUnits = parseFloat(data.total_qty || 0);
                const spend = parseFloat(data.total_spend || 0);
                const adSales = parseFloat(data.total_ad_sales || 0);
                const clicks = parseFloat(data.total_clicks || 0);
                const impressions = parseFloat(data.total_impressions || 0);
                const orders = parseFloat(data.total_orders || 0);
                const neno = parseFloat(data.total_neno || 0);
                const deno = parseFloat(data.total_deno || 0);

                const availability = deno > 0 ? (neno / deno) * 100 : 0;
                const roas = spend > 0 ? adSales / spend : 0;
                const conversion = clicks > 0 ? (orders / clicks) * 100 : 0;  // Conversion %
                const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
                const cpc = clicks > 0 ? spend / clicks : 0;

                // Calculate SOS and MS for this category
                const catKey = catName?.toLowerCase();
                const sosNum = sosNumCatMap.get(catKey) || 0;
                const sosDenom = sosDenomCatMap.get(catKey) || 0;
                const sos = sosDenom > 0 ? (sosNum / sosDenom) * 100 : 0;

                const msNum = msNumCatMap.get(catKey) || 0;
                const msDenom = msDenomCatMap.get(catKey) || 0;
                const marketShare = msDenom > 0 ? (msNum / msDenom) * 100 : 0;

                return {
                    key: catName,
                    label: catName,
                    type: catName,
                    logo: "https://cdn-icons-png.flaticon.com/512/3502/3502685.png",
                    columns: [
                        { title: "Offtakes", value: formatCurrency(offtake), meta: { units: `${formatUnits(offtakeUnits)} units` } },
                        { title: "Spend", value: formatCurrency(spend), meta: { units: "spend" } },
                        { title: "ROAS", value: `${roas.toFixed(2)}x`, meta: { units: "return" } },
                        { title: "Inorg Sales", value: formatCurrency(adSales), meta: { units: `${formatUnits(orders)} units` } },
                        { title: "Conversion", value: `${conversion.toFixed(1)}%`, meta: { units: "% conv" } },
                        { title: "Availability", value: `${availability.toFixed(1)}%`, meta: { units: "stores" } },
                        { title: "SOS", value: `${sos.toFixed(1)}%`, meta: { units: "index" } },
                        { title: "Market Share", value: `${marketShare.toFixed(1)}%`, meta: { units: "Category" } },
                        { title: "Promo My Brand", value: "0%", meta: { units: "Depth" } },
                        { title: "Promo Compete", value: "0%", meta: { units: "Depth" } },
                        { title: "CPM", value: `₹${Math.round(cpm)}`, meta: { units: "impressions" } },
                        { title: "CPC", value: `₹${Math.round(cpc)}`, meta: { units: "clicks" } }
                    ]
                };
            });

            console.log(`[getCategoryOverview] OPTIMIZED: Returning ${categoryOverview.length} categories`);
            return categoryOverview;
        });
    }, parseInt(process.env.REDIS_DEFAULT_TTL || '1800'));
};

/**
 * Get Brands Overview Data - OPTIMIZED
 * Requires brandsOverviewPlatform and brandsOverviewCategory parameters
 * NOTE: Computes ONLY brands data
 */
const getBrandsOverview = async (filters) => {
    const cacheKey = generateCacheKey('brands_overview', filters);
    return await getCachedOrCompute(cacheKey, async () => {
        return await coalesceRequest(`compute:${cacheKey}`, async () => {
            console.log('[getBrandsOverview] Computing OPTIMIZED brands overview data...');

            const { months = 1, startDate: qStartDate, endDate: qEndDate, brandsOverviewPlatform, brandsOverviewCategory } = filters;

            // Extract filter values - frontend may send as 'location' or 'location[]' (array format)
            const rawLocation = filters['location[]'] || filters.location;

            // Normalize multi-value filters
            const locationArr = normalizeFilterArray(rawLocation);
            const location = locationArr ? (locationArr.length === 1 ? locationArr[0] : locationArr) : null;

            const monthsBack = parseInt(months, 10) || 1;
            const boPlatform = brandsOverviewPlatform || filters.platform || 'All';
            const boCategory = brandsOverviewCategory || filters.category || 'All';

            // Calculate date range
            let endDate = dayjs().endOf('day');
            let startDate = endDate.subtract(monthsBack, 'month').startOf('day');
            if (qStartDate && qEndDate) {
                startDate = dayjs(qStartDate).startOf('day');
                endDate = dayjs(qEndDate).endOf('day');
            }

            // Helper for currency formatting
            const formatCurrency = (value) => {
                const val = parseFloat(value);
                if (isNaN(val)) return "0";
                if (val < 0.01 && val > -0.01) return "0";
                if (val >= 1000000000) return `₹${(val / 1000000000).toFixed(2)} B`;
                if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
                if (val >= 1000000) return `₹${(val / 1000000).toFixed(2)} M`;
                if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lac`;
                if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
                return `₹${val.toFixed(2)}`;
            };

            // Helper to escape strings for ClickHouse
            const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

            // Build brand conditions for rb_pdp_olap
            const buildBrandConds = () => {
                const conds = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
                conds.push(`toString(Comp_flag) = '0'`);  // Only our brands
                if (boPlatform && boPlatform !== 'All') {
                    conds.push(`Platform = '${escapeStr(boPlatform)}'`);
                }
                if (boCategory && boCategory !== 'All') {
                    conds.push(`Category = '${escapeStr(boCategory)}'`);
                }
                if (locationArr && locationArr.length > 0) {
                    conds.push(`Location IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
                return conds.join(' AND ');
            };

            // Build SOS conditions for rb_kw
            const buildSosBrandConds = () => {
                const conds = [`toDate(kw_crawl_date) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
                const platformArr = normalizeFilterArray(boPlatform);
                if (platformArr && platformArr.length > 0) {
                    conds.push(`platform_name IN (${platformArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
                }
                const categoryArr = normalizeFilterArray(boCategory);
                if (categoryArr && categoryArr.length > 0) {
                    conds.push(`keyword_category IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
                }
                const locArr = normalizeFilterArray(location);
                if (locArr && locArr.length > 0) {
                    conds.push(`location_name IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
                return conds.join(' AND ');
            };

            // Build MS conditions for rb_brand_ms
            const buildMsBrandConds = (brandsFilter = null) => {
                const conds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
                conds.push(`sales IS NOT NULL`);
                const platformArr = normalizeFilterArray(boPlatform);
                if (platformArr && platformArr.length > 0) {
                    conds.push(`Platform IN (${platformArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
                }
                const categoryArr = normalizeFilterArray(boCategory);
                if (categoryArr && categoryArr.length > 0) {
                    conds.push(`category IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
                }
                if (brandsFilter && brandsFilter.length > 0) {
                    conds.push(`brand IN (${brandsFilter.map(b => `'${escapeStr(b)}'`).join(', ')})`);
                }
                const locArr = normalizeFilterArray(location);
                if (locArr && locArr.length > 0) {
                    conds.push(`Location IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
                return conds.join(' AND ');
            };

            const brandConds = buildBrandConds();
            const sosBrandConds = buildSosBrandConds();

            // Get valid brand names for MS
            const validBrandNames = await getCachedValidBrandNames();
            const msBrandConds = buildMsBrandConds(validBrandNames);
            const msTotalConds = buildMsBrandConds(null);

            // ⚡ OPTIMIZED: Run ALL queries in PARALLEL with ClickHouse
            const [brandsData, totalPlatformData, sosNumBrand, sosDenomBrand, brandsMetrics, ourBrandsSales] = await Promise.all([
                // Query 1: Distinct brands
                queryClickHouse(`SELECT DISTINCT brand_name FROM rca_sku_dim WHERE toString(comp_flag) = '0' AND brand_name IS NOT NULL AND brand_name != ''`),
                // Query 2: Total platform sales
                queryClickHouse(`SELECT SUM(toFloat64OrZero(sales)) as total_sales FROM rb_brand_ms WHERE ${msTotalConds}`),
                // Query 3: SOS numerator
                queryClickHouse(`
                    SELECT brand_name, count() as count
                    FROM rb_kw
                    WHERE ${sosBrandConds} AND toString(keyword_is_rb_product) = '1'
                    GROUP BY brand_name
                `),
                // Query 4: SOS denominator
                queryClickHouse(`
                    SELECT brand_name, count() as count
                    FROM rb_kw
                    WHERE ${sosBrandConds}
                    GROUP BY brand_name
                `),
                // Query 5: Brand metrics from rb_pdp_olap
                queryClickHouse(`
                    SELECT Brand,
                        SUM(ifNull(toFloat64(Sales), 0)) as total_sales,
                        SUM(ifNull(toFloat64(Ad_Spend), 0)) as total_spend,
                        SUM(ifNull(toFloat64(Ad_sales), 0)) as total_ad_sales,
                        SUM(ifNull(toFloat64(Ad_Quanity_sold), 0)) as total_orders,
                        SUM(ifNull(toFloat64(Ad_Clicks), 0)) as total_clicks,
                        SUM(ifNull(toFloat64(Ad_Impressions), 0)) as total_impressions,
                        SUM(ifNull(toFloat64(neno_osa), 0)) as total_neno,
                        SUM(ifNull(toFloat64(deno_osa), 0)) as total_deno
                    FROM rb_pdp_olap
                    WHERE ${brandConds}
                    GROUP BY Brand
                `),
                // Query 6: Our brands sales per brand from rb_brand_ms
                queryClickHouse(`
                    SELECT brand, SUM(toFloat64OrZero(sales)) as brand_sales
                    FROM rb_brand_ms
                    WHERE ${msBrandConds}
                    GROUP BY brand
                `)
            ]);

            const brands = brandsData.map(d => d.brand_name).filter(Boolean);
            const totalPlatformSales = parseFloat(totalPlatformData[0]?.total_sales || 0);
            const sosNumBrandMap = new Map(sosNumBrand.map(r => [r.brand_name?.toLowerCase(), parseInt(r.count) || 0]));
            const sosDenomBrandMap = new Map(sosDenomBrand.map(r => [r.brand_name?.toLowerCase(), parseInt(r.count) || 0]));

            // Create map of brand -> sales for MS calculation
            const brandMsSalesMap = new Map(ourBrandsSales.map(b => [b.brand?.toLowerCase(), parseFloat(b.brand_sales || 0)]));
            const totalMarketSales = totalPlatformSales;

            // Build lookup map
            const dataMap = new Map(brandsMetrics.map(d => [(d.Brand || '').toLowerCase(), d]));

            const brandsOverview = brands.map(brandName => {
                const data = dataMap.get(brandName.toLowerCase()) || {};

                const sales = parseFloat(data.total_sales || 0);
                const spend = parseFloat(data.total_spend || 0);
                const adSales = parseFloat(data.total_ad_sales || 0);
                const orders = parseFloat(data.total_orders || 0);
                const clicks = parseFloat(data.total_clicks || 0);
                const impressions = parseFloat(data.total_impressions || 0);
                const neno = parseFloat(data.total_neno || 0);
                const deno = parseFloat(data.total_deno || 0);

                const availability = deno > 0 ? (neno / deno) * 100 : 0;
                const roas = spend > 0 ? adSales / spend : 0;
                const conversion = clicks > 0 ? orders / clicks : 0;  // Conversion = Orders / Clicks (matching Platform Overview)
                const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
                const cpc = clicks > 0 ? spend / clicks : 0;
                const inorgPct = sales > 0 ? (adSales / sales) * 100 : 0;

                // Calculate Market Share using rb_brand_ms: Brand Sales / Total Platform Sales
                const brandMsSales = brandMsSalesMap.get(brandName.toLowerCase()) || 0;
                const marketShare = totalMarketSales > 0 ? (brandMsSales / totalMarketSales) * 100 : 0;

                // Calculate SOS for this brand
                const sosNum = sosNumBrandMap.get(brandName.toLowerCase()) || 0;
                const sosDenom = sosDenomBrandMap.get(brandName.toLowerCase()) || 0;
                const sos = sosDenom > 0 ? (sosNum / sosDenom) * 100 : 0;

                return {
                    key: brandName.toLowerCase().replace(/\s+/g, '_'),
                    label: brandName,
                    type: "Brand",
                    columns: [
                        { title: "Offtakes", value: formatCurrency(sales), meta: { units: `${(sales / 100000).toFixed(2)} L` } },
                        { title: "Spend", value: formatCurrency(spend), meta: { units: formatCurrency(spend) } },
                        { title: "ROAS", value: `${roas.toFixed(1)}x`, meta: { units: formatCurrency(adSales) } },
                        { title: "Inorg Sales", value: formatCurrency(adSales), meta: { units: "units" } },
                        { title: "Conversion", value: conversion.toFixed(1), meta: { units: "Clicks / Orders" } },
                        { title: "Availability", value: `${availability.toFixed(1)}%`, meta: { units: `${deno}` } },
                        { title: "SOS", value: `${sos.toFixed(1)}%`, meta: { units: `${sosNum}/${sosDenom}` } },
                        { title: "Market Share", value: `${marketShare.toFixed(1)}%`, meta: { units: formatCurrency(totalMarketSales) } },
                        { title: "Promo My Brand", value: "0%", meta: { units: "0%" } },
                        { title: "Promo Compete", value: "0%", meta: { units: "0%" } },
                        { title: "CPM", value: formatCurrency(cpm), meta: { units: formatCurrency(cpm) } },
                        { title: "CPC", value: formatCurrency(cpc), meta: { units: formatCurrency(cpc) } }
                    ]
                };
            });

            // Sort brands: those with values (offtake > 0) first, then by offtake descending
            // Brands with all zeros go to the end
            const sortedBrandsOverview = brandsOverview.sort((a, b) => {
                // Get offtake value from columns (first column is Offtakes)
                const getOfftakeValue = (brand) => {
                    const offtakeCol = brand.columns.find(c => c.title === 'Offtakes');
                    if (!offtakeCol) return 0;
                    // Parse the formatted currency value back to number
                    const valStr = offtakeCol.value.replace(/[₹,]/g, '').trim();
                    if (valStr.includes('B')) return parseFloat(valStr) * 1000000000;
                    if (valStr.includes('Cr')) return parseFloat(valStr) * 10000000;
                    if (valStr.includes('M')) return parseFloat(valStr) * 1000000;
                    if (valStr.includes('Lac')) return parseFloat(valStr) * 100000;
                    if (valStr.includes('L')) return parseFloat(valStr) * 100000;
                    if (valStr.includes('K')) return parseFloat(valStr) * 1000;
                    return parseFloat(valStr) || 0;
                };

                const aVal = getOfftakeValue(a);
                const bVal = getOfftakeValue(b);

                // Brands with values > 0 come first
                if (aVal > 0 && bVal === 0) return -1;
                if (aVal === 0 && bVal > 0) return 1;

                // Among brands with values, sort by offtake descending
                return bVal - aVal;
            });

            console.log(`[getBrandsOverview] OPTIMIZED: Returning ${sortedBrandsOverview.length} brands (sorted by offtake)`);
            return sortedBrandsOverview;
        });
    }, parseInt(process.env.REDIS_DEFAULT_TTL || '1800'));
};

/**
 * Get KPI Trends Data for Performance Metrics
 * Returns time-series data for performance KPIs (Share of Search, Inorganic Sales, Conversion, ROAS, BMI/Sales Ratio)
 */
const getKpiTrends = async (filters) => {
    const cacheKey = generateCacheKey('kpi_trends', filters);
    return await getCachedOrCompute(cacheKey, async () => {
        console.log('[getKpiTrends] Computing KPI trends data with filters:', filters);

        const { brand, location, platform, category, period, timeStep, startDate: customStart, endDate: customEnd } = filters;

        // 1. Determine Date Range
        let endDate = await getCachedMaxDate();
        let startDate = endDate.clone();

        if (period === 'Custom' && customStart && customEnd) {
            startDate = dayjs(customStart);
            endDate = dayjs(customEnd);
        } else {
            switch (period) {
                case '1M': startDate = startDate.subtract(1, 'month'); break;
                case '3M': startDate = startDate.subtract(3, 'month'); break;
                case '6M': startDate = startDate.subtract(6, 'month'); break;
                case '1Y': startDate = startDate.subtract(1, 'year'); break;
                default: startDate = startDate.subtract(3, 'month'); // Default 3M
            }
        }

        console.log(`[getKpiTrends] Date range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);

        // 2. Determine Grouping for ClickHouse
        let groupFormat;  // For formatDateTime
        let groupExpression;
        let groupExpressionKw;

        if (timeStep === 'Monthly') {
            groupFormat = '%Y-%m-01';
            groupExpression = `formatDateTime(toDate(DATE), '${groupFormat}')`;
            groupExpressionKw = `formatDateTime(toDate(kw_crawl_date), '${groupFormat}')`;
        } else if (timeStep === 'Weekly') {
            groupFormat = 'WEEK';
            groupExpression = `toYearWeek(toDate(DATE), 1)`;
            groupExpressionKw = `toYearWeek(toDate(kw_crawl_date), 1)`;
        } else { // Daily
            groupFormat = '%Y-%m-%d';
            groupExpression = `formatDateTime(toDate(DATE), '${groupFormat}')`;
            groupExpressionKw = `formatDateTime(toDate(kw_crawl_date), '${groupFormat}')`;
        }

        // Helper to escape strings for ClickHouse
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // 3. Build WHERE conditions for rb_pdp_olap
        const buildKpiConds = () => {
            const conds = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];

            const catArr = normalizeFilterArray(category);
            if (catArr && catArr.length > 0) conds.push(`Category IN (${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);

            const brandArr = normalizeFilterArray(brand);
            if (brandArr && brandArr.length > 0) {
                const brandConditions = brandArr.map(b => `Brand LIKE '%${escapeStr(b)}%'`).join(' OR ');
                conds.push(`(${brandConditions})`);
            }

            const locArr = normalizeFilterArray(location);
            if (locArr && locArr.length > 0) conds.push(`Location IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);

            const platArr = normalizeFilterArray(platform);
            if (platArr && platArr.length > 0) conds.push(`Platform IN (${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);

            return conds.join(' AND ');
        };

        const kpiConds = buildKpiConds();

        // 4. Query for Inorganic Sales, Conversion, ROAS, BMI/Sales Ratio using ClickHouse
        const kpiResults = await queryClickHouse(`
            SELECT 
                ${groupExpression} as date_group,
                MAX(toDate(DATE)) as ref_date,
                SUM(ifNull(toFloat64(Sales), 0)) as total_sales,
                SUM(ifNull(toFloat64(Ad_sales), 0)) as total_ad_sales,
                SUM(ifNull(toFloat64(Ad_Spend), 0)) as total_ad_spend,
                SUM(ifNull(toFloat64(Ad_Quanity_sold), 0)) as total_ad_orders,
                SUM(ifNull(toFloat64(Ad_Clicks), 0)) as total_ad_clicks,
                SUM(ifNull(toFloat64(Ad_Impressions), 0)) as total_ad_impressions,
                SUM(ifNull(toFloat64(neno_osa), 0)) as total_neno_osa,
                SUM(ifNull(toFloat64(deno_osa), 0)) as total_deno_osa
            FROM rb_pdp_olap
            WHERE ${kpiConds}
            GROUP BY ${groupExpression}
            ORDER BY ref_date ASC
        `);

        // 5. Query for Share of Search using ClickHouse
        // Formula when Brand = "All": SOS = (Count of rows where keyword_is_rb_product=1) / (Count of ALL rows) × 100
        // Uses keyword_is_rb_product column in rb_kw table (1 = our RB product)

        // Build SOS base conditions
        const buildSosConds = (isBrandSpecific = false) => {
            const conds = [`toDate(kw_crawl_date) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
            conds.push(`toString(spons_flag) != '1'`);
            if (category && category !== 'All') conds.push(`keyword_category = '${escapeStr(category)}'`);
            if (location && location !== 'All') conds.push(`location_name = '${escapeStr(location)}'`);
            if (platform && platform !== 'All') conds.push(`platform_name = '${escapeStr(platform)}'`);
            return conds;
        };

        // Numerator conditions
        const sosNumConds = buildSosConds();
        if (brand && brand !== 'All') {
            // Specific brand selected - filter by brand name
            sosNumConds.push(`brand_name = '${escapeStr(brand)}'`);
        } else {
            // "All" brands selected - use keyword_is_rb_product=1 (our RB products)
            sosNumConds.push(`toString(keyword_is_rb_product) = '1'`);
            console.log(`[KPI Trends SOS] "All" brands selected - using keyword_is_rb_product=1`);
        }

        const sosNumerator = await queryClickHouse(`
            SELECT ${groupExpressionKw} as date_group, count() as count
            FROM rb_kw
            WHERE ${sosNumConds.join(' AND ')}
            GROUP BY ${groupExpressionKw}
        `);

        // Denominator: All Brands (No Brand Filter) + Not Sponsored
        const sosDenomConds = buildSosConds();

        const sosDenominator = await queryClickHouse(`
            SELECT ${groupExpressionKw} as date_group, count() as count
            FROM rb_kw
            WHERE ${sosDenomConds.join(' AND ')}
            GROUP BY ${groupExpressionKw}
        `);

        // 6. Generate time buckets and format data
        const buckets = generateTimeBuckets(startDate, endDate, timeStep);

        const timeSeries = buckets.map((bucket, bucketIndex) => {
            const row = kpiResults.find(r => String(r.date_group) === String(bucket.groupKey)) || {};

            // Extract values
            const totalSales = parseFloat(row.total_sales || 0);
            const adSales = parseFloat(row.total_ad_sales || 0);
            const adSpend = parseFloat(row.total_ad_spend || 0);
            const adOrders = parseFloat(row.total_ad_orders || 0);
            const adClicks = parseFloat(row.total_ad_clicks || 0);

            // Calculate KPIs
            // 1. Share of Search
            const sosNum = sosNumerator.find(s => String(s.date_group) === String(bucket.groupKey));
            const sosDen = sosDenominator.find(s => String(s.date_group) === String(bucket.groupKey));
            const numCount = parseInt(sosNum?.count || 0, 10);
            const denCount = parseInt(sosDen?.count || 0, 10);
            const shareOfSearch = denCount > 0 ? (numCount / denCount) * 100 : 0;

            // 2. Inorganic Sales (Ad Sales / Total Sales * 100)
            const inorganicSales = totalSales > 0 ? (adSales / totalSales) * 100 : 0;

            // 3. Conversion (Orders / Clicks * 100)
            const conversion = adClicks > 0 ? (adOrders / adClicks) * 100 : 0;

            // 4. ROAS (Ad Sales / Ad Spend)
            const roas = adSpend > 0 ? adSales / adSpend : 0;

            // 5. BMI/Sales Ratio (Ad Spend / Total Sales * 100)
            const bmiSalesRatio = totalSales > 0 ? (adSpend / totalSales) * 100 : 0;

            // 6. Offtakes (Total Sales) - Return raw value for frontend formatting
            const offtakes = totalSales;

            // 7. Spend (Ad Spend) - Return raw value for frontend formatting
            const spend = adSpend;

            // 8. CPM (Cost Per Thousand Impressions)
            const adImpressions = parseFloat(row.total_ad_impressions || 0);
            const cpm = adImpressions > 0 ? (adSpend / adImpressions) * 1000 : 0;

            // 9. CPC (Cost Per Click)
            const cpc = adClicks > 0 ? adSpend / adClicks : 0;

            // 10. Availability (OSA%)
            const nenoOsa = parseFloat(row.total_neno_osa || 0);
            const denoOsa = parseFloat(row.total_deno_osa || 0);
            const availability = denoOsa > 0 ? (nenoOsa / denoOsa) * 100 : 0;

            // Build data point with all KPIs
            const dataPoint = {
                date: bucket.label,
                // Core 5 KPIs (Performance Matrix)
                ShareOfSearch: parseFloat(shareOfSearch.toFixed(2)),
                InorganicSales: parseFloat(inorganicSales.toFixed(2)),
                Conversion: parseFloat(conversion.toFixed(2)),
                Roas: parseFloat(roas.toFixed(2)),
                BmiSalesRatio: parseFloat(bmiSalesRatio.toFixed(2)),
                // Extended KPIs (Platform/Month/Category/Brand pages)
                Offtakes: parseFloat(offtakes.toFixed(0)),
                Spend: parseFloat(spend.toFixed(0)),
                Availability: parseFloat(availability.toFixed(2)),
                CPM: parseFloat(cpm.toFixed(2)),
                CPC: parseFloat(cpc.toFixed(2)),
                // Mapped aliases for frontend compatibility
                ROAS: parseFloat(roas.toFixed(2)),
                SOS: parseFloat(shareOfSearch.toFixed(2)),
                InorgSales: parseFloat(inorganicSales.toFixed(2)),
                CategoryShare: 0, // Placeholder
                MarketShare: 0,   // Placeholder
                PromoMyBrand: 0,  // Placeholder
                PromoCompete: 0,  // Placeholder
                DspSales: 0       // Placeholder
            };

            return dataPoint;

        });

        return {

            timeSeries,
            metrics: {
                ShareOfSearch: { enabled: true },
                InorganicSales: { enabled: true },
                Conversion: { enabled: true },
                Roas: { enabled: true },
                BmiSalesRatio: { enabled: true }
            }
        };
    }, parseInt(process.env.REDIS_DEFAULT_TTL || '1800'));
};

/**
 * Get dynamic filter options for trends drawer
 * @param {string} filterType - 'platforms'|'categories'|'brands'|'cities'
 * @param {string} platform - Selected platform filter
 * @param {string} brand - Selected brand filter (for cities)
 */
const getTrendsFilterOptions = async ({ filterType, platform, brand }) => {
    try {
        console.log(`[getTrendsFilterOptions] Fetching ${filterType} for platform=${platform}, brand=${brand}`);

        // Helper to escape strings for ClickHouse
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        if (filterType === 'platforms') {
            // Fetch unique platforms from rca_sku_dim (comp_flag=0)
            const query = `SELECT DISTINCT platform FROM rca_sku_dim WHERE comp_flag = 0 AND platform IS NOT NULL AND platform != '' ORDER BY platform`;
            const results = await queryClickHouse(query);
            const platformList = results.map(p => p.platform).filter(p => p && p.trim()).sort();
            return { options: [...platformList] };
        }

        if (filterType === 'categories') {
            // Fetch unique categories (category) from rca_sku_dim (comp_flag=0, status=1)
            const conditions = [`comp_flag = 0`, `status = 1`, `category IS NOT NULL`, `category != ''`];
            if (platform && platform !== 'All') {
                conditions.push(`lower(platform) = '${escapeStr(platform.toLowerCase())}'`);
            }

            const query = `SELECT DISTINCT category FROM rca_sku_dim WHERE ${conditions.join(' AND ')} ORDER BY category`;
            const results = await queryClickHouse(query);
            const categoryList = results.map(c => c.category).filter(c => c && c.trim()).sort();
            return { options: [...categoryList] };
        }

        if (filterType === 'brands') {
            // Fetch unique brands from rca_sku_dim (comp_flag=0)
            const conditions = [`comp_flag = 0`, `brand_name IS NOT NULL`, `brand_name != ''`];
            if (platform && platform !== 'All') {
                conditions.push(`lower(platform) = '${escapeStr(platform.toLowerCase())}'`);
            }

            const query = `SELECT DISTINCT brand_name as brand FROM rca_sku_dim WHERE ${conditions.join(' AND ')} ORDER BY brand`;
            const results = await queryClickHouse(query);
            const brandList = results.map(b => b.brand).filter(b => b && b.trim()).sort();
            return { options: [...brandList] };
        }

        if (filterType === 'cities') {
            // Fetch unique cities (location) from rca_sku_dim (comp_flag=0)
            const conditions = [`comp_flag = 0`, `location IS NOT NULL`, `location != ''`];
            if (platform && platform !== 'All') {
                conditions.push(`lower(platform) = '${escapeStr(platform.toLowerCase())}'`);
            }
            if (brand && brand !== 'All') {
                conditions.push(`brand_name LIKE '%${escapeStr(brand)}%'`);
            }

            const query = `SELECT DISTINCT location as city FROM rca_sku_dim WHERE ${conditions.join(' AND ')} ORDER BY city`;
            const results = await queryClickHouse(query);
            const cityList = results.map(c => c.city).filter(c => c && c.trim()).sort();
            return { options: [...cityList] };
        }

        return { options: [] };
    } catch (error) {
        console.error(`[getTrendsFilterOptions] Error fetching ${filterType}:`, error);
        // Return empty array on error
        return { options: [] };
    }
};

/**
 * Get competition brand data with metrics
 * @param {Object} filters - { platform, location, category, period }
 * @returns {Object} { brands: [...] }
 */
const getCompetitionData = async (filters = {}) => {
    try {
        const { platform = 'All', location = 'All', category = 'All', brand = 'All', sku = 'All', period = '1M' } = filters;

        console.log('[getCompetitionData] Filters:', { platform, location, category, brand, sku, period });

        // Calculate date range based on period
        const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
        const days = periodDays[period] || 30;

        const endDate = dayjs();
        const startDate = endDate.clone().subtract(days, 'days');
        const momStartDate = startDate.clone().subtract(days, 'days');
        const momEndDate = startDate.clone().subtract(1, 'day');

        // Helper to escape strings for ClickHouse
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // Build base conditions for ClickHouse
        const buildCompConds = (startDt, endDt) => {
            const conds = [`toDate(DATE) BETWEEN '${startDt.format('YYYY-MM-DD')}' AND '${endDt.format('YYYY-MM-DD')}'`];
            const platArr = normalizeFilterArray(platform);
            if (platArr && platArr.length > 0) conds.push(`Platform IN (${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);

            const locArr = normalizeFilterArray(location);
            if (locArr && locArr.length > 0) conds.push(`Location IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);

            const catArr = normalizeFilterArray(category);
            if (catArr && catArr.length > 0) conds.push(`Category IN (${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);

            const brandArr = normalizeFilterArray(brand);
            if (brandArr && brandArr.length > 0) {
                if (brandArr.length === 1) {
                    conds.push(`lower(Brand) = '${escapeStr(brandArr[0].toLowerCase())}'`);
                } else {
                    conds.push(`lower(Brand) IN (${brandArr.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ')})`);
                }
            }

            const skuArr = normalizeFilterArray(sku);
            if (skuArr && skuArr.length > 0) conds.push(`Product IN (${skuArr.map(s => `'${escapeStr(s)}'`).join(', ')})`);

            return conds.join(' AND ');
        };

        const currConds = buildCompConds(startDate, endDate);
        const momConds = buildCompConds(momStartDate, momEndDate);

        console.log('[getCompetitionData] 🔍 DEBUG currConds:', currConds);
        console.log('[getCompetitionData] 🔍 DEBUG dateRange:', startDate.format('YYYY-MM-DD'), 'to', endDate.format('YYYY-MM-DD'));

        // Get valid brand names from rca_sku_dim (comp_flag = 0) for Market Share calculation
        const validBrandsResult = await queryClickHouse(`
            SELECT DISTINCT brand_name 
            FROM rca_sku_dim 
            WHERE toString(comp_flag) = '0' AND brand_name IS NOT NULL AND brand_name != ''
        `);
        const validBrandNames = validBrandsResult.map(b => b.brand_name).filter(Boolean);
        console.log(`[getCompetitionData] Valid brands (comp_flag=0): ${validBrandNames.length}`);

        // Build Market Share conditions for rb_brand_ms
        const buildMsConds = (includeBrandFilter = false) => {
            const conds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
            conds.push(`sales IS NOT NULL`);
            if (platform && platform !== 'All') conds.push(`Platform = '${escapeStr(platform)}'`);
            if (location && location !== 'All') conds.push(`Location = '${escapeStr(location)}'`);
            if (includeBrandFilter && validBrandNames.length > 0) {
                const brandList = validBrandNames.map(b => `'${escapeStr(b)}'`).join(', ');
                conds.push(`brand IN (${brandList})`);
            }
            return conds.join(' AND ');
        };

        // Build Category Share conditions for rb_brand_ms (category-level)
        const buildCategoryConds = (includeBrandFilter = false) => {
            const conds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
            conds.push(`sales IS NOT NULL`);
            if (platform && platform !== 'All') conds.push(`Platform = '${escapeStr(platform)}'`);
            if (location && location !== 'All') conds.push(`Location = '${escapeStr(location)}'`);
            if (category && category !== 'All') conds.push(`category_master = '${escapeStr(category)}'`);
            if (includeBrandFilter && validBrandNames.length > 0) {
                const brandList = validBrandNames.map(b => `'${escapeStr(b)}'`).join(', ');
                conds.push(`brand IN (${brandList})`);
            }
            return conds.join(' AND ');
        };

        // Run all queries in parallel using ClickHouse
        const [currentBrands, previousBrands, osaData, msTotalData, msOurBrandsData, catTotalData, catOurBrandsData] = await Promise.all([
            // Query 1: Current period brand data from rb_pdp_olap (with Category)
            queryClickHouse(`
                SELECT Brand,
                    any(Category) as brand_category,
                    SUM(ifNull(toFloat64(Sales), 0)) as total_offtakes,
                    SUM(ifNull(toFloat64(Ad_Spend), 0)) as total_spend,
                    SUM(ifNull(toFloat64(Ad_sales), 0)) as total_ad_sales,
                    SUM(ifNull(toFloat64(Ad_Impressions), 0)) as total_impressions,
                    AVG(ifNull(toFloat64(MRP), 0)) as avg_price,
                    count() as record_count
                FROM rb_pdp_olap
                WHERE ${currConds}
                GROUP BY Brand
            `),
            // Query 2: Previous period for MoM
            queryClickHouse(`
                SELECT Brand,
                    SUM(ifNull(toFloat64(Sales), 0)) as total_offtakes,
                    SUM(ifNull(toFloat64(Ad_Spend), 0)) as total_spend,
                    SUM(ifNull(toFloat64(Ad_sales), 0)) as total_ad_sales
                FROM rb_pdp_olap
                WHERE ${momConds}
                GROUP BY Brand
            `),
            // Query 3: OSA data for current period
            queryClickHouse(`
                SELECT Brand,
                    SUM(ifNull(toFloat64(neno_osa), 0)) as neno_osa,
                    SUM(ifNull(toFloat64(deno_osa), 0)) as deno_osa
                FROM rb_pdp_olap
                WHERE ${currConds}
                GROUP BY Brand
            `),
            // Query 4: Total platform sales from rb_brand_ms (Market Share denominator)
            queryClickHouse(`
                SELECT SUM(toFloat64OrZero(sales)) as total_sales
                FROM rb_brand_ms
                WHERE ${buildMsConds(false)}
            `),
            // Query 5: Our brands sales from rb_brand_ms (Market Share numerator - comp_flag=0 brands)
            queryClickHouse(`
                SELECT SUM(toFloat64OrZero(sales)) as our_sales
                FROM rb_brand_ms
                WHERE ${buildMsConds(true)}
            `),
            // Query 6: Total category sales from rb_brand_ms (Category Share denominator)
            queryClickHouse(`
                SELECT SUM(toFloat64OrZero(sales)) as total_cat_sales
                FROM rb_brand_ms
                WHERE ${buildCategoryConds(false)}
            `),
            // Query 7: Our brands category sales from rb_brand_ms (Category Share numerator)
            queryClickHouse(`
                SELECT SUM(toFloat64OrZero(sales)) as our_cat_sales
                FROM rb_brand_ms
                WHERE ${buildCategoryConds(true)}
            `)
        ]);

        console.log(`[getCompetitionData] ✅ Found ${currentBrands.length} brands matching ALL filters`);
        if (currentBrands.length > 0) {
            console.log(`[getCompetitionData] Sample brands:`, currentBrands.slice(0, 3).map(b => b.Brand));
        } else {
            console.log('[getCompetitionData] ⚠️ NO BRANDS FOUND with current filters!');
        }

        // Create map for previous period data
        const prevMap = new Map(previousBrands.map(b => [b.Brand, b]));

        const osaMap = new Map(osaData.map(o => [o.Brand, {
            neno: parseFloat(o.neno_osa || 0),
            deno: parseFloat(o.deno_osa || 0)
        }]));

        // Extract Market Share values (platform level - for per-brand calculation)
        const totalPlatformSales = parseFloat(msTotalData?.[0]?.total_sales || 0);
        console.log(`[getCompetitionData] Total Platform Sales: ${totalPlatformSales.toFixed(0)}`);

        // Query per-brand sales from rb_brand_ms for Market Share calculation
        const brandSalesQuery = await queryClickHouse(`
            SELECT brand, SUM(toFloat64OrZero(sales)) as brand_sales
            FROM rb_brand_ms
            WHERE ${buildMsConds(false)}
            GROUP BY brand
        `);
        const brandSalesMap = new Map(brandSalesQuery.map(r => [r.brand, parseFloat(r.brand_sales || 0)]));
        console.log(`[getCompetitionData] Got sales data for ${brandSalesMap.size} brands from rb_brand_ms`);

        // Query per-category sales from rb_brand_ms for Category Share calculation
        // This gets total sales and our brands' sales per category
        const baseMsConds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`, `sales IS NOT NULL`];
        if (platform && platform !== 'All') baseMsConds.push(`Platform = '${escapeStr(platform)}'`);
        if (location && location !== 'All') baseMsConds.push(`Location = '${escapeStr(location)}'`);

        const [categorySalesQuery, categoryOurBrandsSalesQuery] = await Promise.all([
            // Total sales per category
            queryClickHouse(`
                SELECT category_master as category, SUM(toFloat64OrZero(sales)) as total_cat_sales
                FROM rb_brand_ms
                WHERE ${baseMsConds.join(' AND ')} AND category_master IS NOT NULL AND category_master != ''
                GROUP BY category_master
            `),
            // Our brands' (comp_flag=0) sales per category
            validBrandNames.length > 0 ? queryClickHouse(`
                SELECT category_master as category, SUM(toFloat64OrZero(sales)) as our_cat_sales
                FROM rb_brand_ms
                WHERE ${baseMsConds.join(' AND ')} AND category_master IS NOT NULL AND category_master != ''
                    AND brand IN (${validBrandNames.map(b => `'${escapeStr(b)}'`).join(', ')})
                GROUP BY category_master
            `) : Promise.resolve([])
        ]);

        const categoryTotalSalesMap = new Map(categorySalesQuery.map(r => [r.category, parseFloat(r.total_cat_sales || 0)]));
        const categoryOurBrandsSalesMap = new Map(categoryOurBrandsSalesQuery.map(r => [r.category, parseFloat(r.our_cat_sales || 0)]));
        console.log(`[getCompetitionData] Got category sales data for ${categoryTotalSalesMap.size} categories`);

        // 4. Calculate metrics for each brand
        // Calculate total impressions for SOS calculation  
        const totalImpressions = currentBrands.reduce((sum, b) => sum + parseFloat(b.total_impressions || 0), 0);

        const brandMetrics = currentBrands.map(brand => {
            const impressions = parseFloat(brand.total_impressions || 0);
            const avgPrice = parseFloat(brand.avg_price || 0);
            const brandCategory = brand.brand_category || '';

            // Calculate OSA (On-Shelf Availability)
            const osaBrand = osaMap.get(brand.Brand) || { neno: 0, deno: 0 };
            const osa = osaBrand.deno > 0 ? (osaBrand.neno / osaBrand.deno) * 100 : 0;

            // Calculate SOS (Share of Search) - based on impressions share
            const sos = totalImpressions > 0 ? (impressions / totalImpressions) * 100 : 0;

            // Market Share: Individual brand's share = brand's sales / total platform sales
            const brandSales = brandSalesMap.get(brand.Brand) || 0;
            const marketShare = totalPlatformSales > 0 ? (brandSales / totalPlatformSales) * 100 : 0;

            // Category Share: Our brands' share in this brand's specific category
            // = Our brands' category sales / Total category sales
            const categoryTotalSales = categoryTotalSalesMap.get(brandCategory) || 0;
            const categoryOurBrandsSales = categoryOurBrandsSalesMap.get(brandCategory) || 0;
            const categoryShare = categoryTotalSales > 0 ? (categoryOurBrandsSales / categoryTotalSales) * 100 : 0;

            return {
                brand_name: brand.Brand,
                osa: parseFloat(osa.toFixed(1)),
                sos: parseFloat(sos.toFixed(1)),
                price: parseFloat(avgPrice.toFixed(0)),
                categoryShare: parseFloat(categoryShare.toFixed(1)),
                marketShare: parseFloat(marketShare.toFixed(1))
            };
        });

        // 5. Sort by OSA descending and limit to top 10
        brandMetrics.sort((a, b) => b.osa - a.osa);
        const topBrands = brandMetrics.slice(0, 10);

        console.log(`[getCompetitionData] Returning ${topBrands.length} brands`);

        // If no brands found, help user debug by showing available values
        if (topBrands.length === 0 && (location !== 'All' || category !== 'All')) {
            console.log('[getCompetitionData] 🔍 Debugging: Fetching available locations and categories...');

            try {
                const [availableLocations, availableCategories, availableBrands] = await Promise.all([
                    queryClickHouse(`SELECT DISTINCT Location as location FROM rb_pdp_olap WHERE Location IS NOT NULL AND Location != '' LIMIT 10`),
                    queryClickHouse(`SELECT DISTINCT Category as category FROM rb_pdp_olap WHERE Category IS NOT NULL AND Category != '' LIMIT 10`),
                    queryClickHouse(`SELECT DISTINCT Brand as brand FROM rb_pdp_olap WHERE Brand IS NOT NULL AND Brand != '' LIMIT 30`)
                ]);

                console.log('[getCompetitionData] 📍 Available locations (sample):',
                    availableLocations.map(l => l.location).join(', '));
                console.log('[getCompetitionData] 🏷️ Available categories (sample):',
                    availableCategories.map(c => c.category).join(', '));
                console.log('[getCompetitionData] 🏢 Available brands (sample):',
                    availableBrands.map(b => b.brand).join(', '));
            } catch (debugError) {
                console.error('[getCompetitionData] Error fetching debug info:', debugError.message);
            }
        }

        // 6. Get SKU competition data using ClickHouse
        // Note: Use OSA-based filtering since competitor products may not have sales data
        console.log('[getCompetitionData] Fetching SKU data with same filters...');

        const [currentSkus, skuOsaData] = await Promise.all([
            queryClickHouse(`
                SELECT Product, Brand,
                    any(Category) as sku_category,
                    SUM(ifNull(toFloat64(Sales), 0)) as total_sales,
                    SUM(ifNull(toFloat64(Ad_Impressions), 0)) as total_impressions,
                    AVG(ifNull(toFloat64(MRP), 0)) as avg_price,
                    SUM(toFloat64OrNull(toString(neno_osa))) as neno_osa,
                    SUM(toFloat64OrNull(toString(deno_osa))) as deno_osa
                FROM rb_pdp_olap
                WHERE ${currConds}
                GROUP BY Product, Brand
                LIMIT 100
            `),
            queryClickHouse(`
                SELECT Product,
                    SUM(toFloat64OrNull(toString(neno_osa))) as neno_osa,
                    SUM(toFloat64OrNull(toString(deno_osa))) as deno_osa
                FROM rb_pdp_olap
                WHERE ${currConds}
                GROUP BY Product
            `)
        ]);

        console.log(`[getCompetitionData] SKU query returned ${currentSkus.length} products`);

        const skuOsaMap = new Map(skuOsaData.map(s => [s.Product, s]));

        const totalSkuSales = currentSkus.reduce((sum, s) => sum + parseFloat(s.total_sales || 0), 0);
        const totalSkuImpressions = currentSkus.reduce((sum, s) => sum + parseFloat(s.total_impressions || 0), 0);

        // Calculate SKU metrics with new KPIs
        const skuMetrics = currentSkus.map(sku => {
            const impressions = parseFloat(sku.total_impressions || 0);
            const avgPrice = parseFloat(sku.avg_price || 0);
            const skuCategory = sku.sku_category || '';

            // Calculate OSA - use data from main query since we included neno_osa/deno_osa
            const nenoOsa = parseFloat(sku.neno_osa || 0);
            const denoOsa = parseFloat(sku.deno_osa || 0);
            const osa = denoOsa > 0 ? (nenoOsa / denoOsa) * 100 : 0;

            // Calculate SOS (Share of Search)
            const sos = totalSkuImpressions > 0 ? (impressions / totalSkuImpressions) * 100 : 0;

            // Market Share: Use the SKU's brand's market share (brand sales / total platform sales)
            const skuBrandSales = brandSalesMap.get(sku.Brand) || 0;
            const marketShare = totalPlatformSales > 0 ? (skuBrandSales / totalPlatformSales) * 100 : 0;

            // Category Share: Our brands' share in this SKU's specific category
            const skuCategoryTotalSales = categoryTotalSalesMap.get(skuCategory) || 0;
            const skuCategoryOurBrandsSales = categoryOurBrandsSalesMap.get(skuCategory) || 0;
            const categoryShare = skuCategoryTotalSales > 0 ? (skuCategoryOurBrandsSales / skuCategoryTotalSales) * 100 : 0;

            return {
                sku_name: sku.Product,
                brand_name: sku.Brand,
                osa: parseFloat(osa.toFixed(1)),
                sos: parseFloat(sos.toFixed(1)),
                price: parseFloat(avgPrice.toFixed(0)),
                categoryShare: parseFloat(categoryShare.toFixed(1)),
                marketShare: parseFloat(marketShare.toFixed(1))
            };
        });

        // Sort by OSA descending and limit to top 10
        skuMetrics.sort((a, b) => b.osa - a.osa);
        const topSkus = skuMetrics.slice(0, 10);

        console.log(`[getCompetitionData] Returning ${topBrands.length} brands and ${topSkus.length} SKUs`);

        return {
            brands: topBrands,
            skus: topSkus,  // ADDED: Return SKU data
            metadata: {
                period,
                platform,
                location,
                category,
                totalBrands: brandMetrics.length
            }
        };

    } catch (error) {
        console.error('[getCompetitionData] Error:', error);
        return {
            brands: [],
            metadata: { error: error.message }
        };
    }
};

/**
 * Get competition filter options (locations, categories, brands, and SKUs)
 * @returns {Object} { locations: [...], categories: [...], brands: [...], skus: [...] }
 */
const getCompetitionFilterOptions = async (filters = {}) => {
    try {
        const { platform = 'All', location = 'All', category = 'All', brand = 'All' } = filters;
        console.log('[getCompetitionFilterOptions] Cascading filters:', { platform, location, category, brand });

        // Helper to escape strings for ClickHouse
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // Build base condition for rca_sku_dim
        const buildBaseConds = () => {
            const conds = [`toString(status) = '1'`];
            if (platform && platform !== 'All') {
                const platArr = platform.split(',').map(p => p.trim()).filter(p => p && p !== 'All');
                if (platArr.length > 0) conds.push(`lower(Platform) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',')})`);
            }
            if (location && location !== 'All' && location !== 'All India') {
                const locArr = location.split(',').map(l => l.trim()).filter(l => l && l !== 'All' && l !== 'All India');
                if (locArr.length > 0) conds.push(`lower(location) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(',')})`);
            }
            return conds;
        };

        // Run all queries in parallel using ClickHouse
        const [locationResults, categoryResults, brandResults, skuResults] = await Promise.all([
            // Fetch distinct locations from rca_sku_dim
            queryClickHouse(`SELECT DISTINCT location FROM rca_sku_dim WHERE location IS NOT NULL AND location != '' ORDER BY location`),

            // Fetch distinct categories filtered by platform/location
            (() => {
                const conds = buildBaseConds();
                conds.push(`category IS NOT NULL`, `category != ''`);
                return queryClickHouse(`SELECT DISTINCT category FROM rca_sku_dim WHERE ${conds.join(' AND ')} ORDER BY category`);
            })(),

            // Fetch distinct competitor brands filtered by platform/location + category
            (() => {
                const conds = buildBaseConds();
                conds.push(`brand_name IS NOT NULL`, `brand_name != ''`, `toString(comp_flag) = '1'`);
                const catArr = category.split(',').map(c => c.trim()).filter(c => c && c !== 'All');
                if (catArr.length > 0) {
                    conds.push(`lower(category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(',')})`);
                }
                return queryClickHouse(`SELECT DISTINCT brand_name as brand FROM rca_sku_dim WHERE ${conds.join(' AND ')} ORDER BY brand`);
            })(),

            // Fetch distinct SKUs from rb_pdp_olap filtered by platform/location + category + brand
            (() => {
                const conds = [];
                if (platform && platform !== 'All') {
                    const platArr = platform.split(',').map(p => p.trim()).filter(p => p && p !== 'All');
                    if (platArr.length > 0) conds.push(`Platform IN (${platArr.map(p => `'${escapeStr(p)}'`).join(',')})`);
                }
                if (location && location !== 'All' && location !== 'All India') {
                    const locArr = location.split(',').map(l => l.trim()).filter(l => l && l !== 'All' && l !== 'All India');
                    if (locArr.length > 0) conds.push(`Location IN (${locArr.map(l => `'${escapeStr(l)}'`).join(',')})`);
                }
                const catArr = category.split(',').map(c => c.trim()).filter(c => c && c !== 'All');
                if (catArr.length > 0) {
                    conds.push(`Category IN (${catArr.map(c => `'${escapeStr(c)}'`).join(',')})`);
                }
                const bndArr = brand.split(',').map(b => b.trim()).filter(b => b && b !== 'All');
                if (bndArr.length > 0) {
                    conds.push(`Brand IN (${bndArr.map(b => `'${escapeStr(b)}'`).join(',')})`);
                }
                conds.push(`Product IS NOT NULL`, `Product != ''`);
                return queryClickHouse(`SELECT DISTINCT Product as sku FROM rb_pdp_olap WHERE ${conds.length > 0 ? conds.join(' AND ') : '1=1'} ORDER BY sku LIMIT 200`);
            })()
        ]);

        const locations = locationResults.map(l => l.location).filter(Boolean);
        const categories = categoryResults.map(c => c.category).filter(Boolean);
        const brands = brandResults.map(b => b.brand).filter(Boolean);
        const skus = skuResults.map(s => s.sku).filter(Boolean);

        return {
            locations: ['All India', ...locations],
            categories: ['All', ...categories],
            brands: ['All', ...brands],
            skus: ['All', ...skus]
        };

    } catch (error) {
        console.error('[getCompetitionFilterOptions] Error:', error);
        return {
            locations: ['All India'],
            categories: ['All'],
            brands: ['All'],
            skus: ['All']
        };
    }
};


const getLatestAvailableMonth = async (filters = {}) => {
    try {
        const {
            platform = 'All',
            brand = 'All',
            location = 'All',
            category = 'All'
        } = filters;

        // Helper to escape strings for ClickHouse
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // Build WHERE conditions for ClickHouse
        const conditions = [];

        if (platform && platform !== 'All') {
            conditions.push(`lower(Platform) = '${escapeStr(platform.toLowerCase())}'`);
        }

        if (brand && brand !== 'All') {
            conditions.push(`Brand LIKE '%${escapeStr(brand)}%'`);
            conditions.push(`toString(Comp_flag) = '0'`);
        }

        if (location && location !== 'All') {
            conditions.push(`lower(Location) = '${escapeStr(location.toLowerCase())}'`);
        }

        if (category && category !== 'All') {
            conditions.push(`lower(Category) = '${escapeStr(category.toLowerCase())}'`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Query ClickHouse for the latest date
        const result = await queryClickHouse(`
            SELECT MAX(toDate(DATE)) as latestDate
            FROM rb_pdp_olap
            ${whereClause}
        `);

        const latestDate = result?.[0]?.latestDate;

        if (!latestDate) {
            return { available: false };
        }

        const latest = dayjs(latestDate);

        return {
            available: true,
            monthLabel: latest.format('MMMM YYYY'),
            startDate: latest.startOf('month').format('YYYY-MM-DD'),
            endDate: latest.endOf('month').format('YYYY-MM-DD'),
            // For date picker: actual latest date available in data
            latestDate: latest.format('YYYY-MM-DD'),
            // Default start date: 1st of the month of latest date
            defaultStartDate: latest.startOf('month').format('YYYY-MM-DD'),
            // Default end date: the actual latest date (max date in database)
            defaultEndDate: latest.format('YYYY-MM-DD')
        };

    } catch (error) {
        console.error('[getLatestAvailableMonth] Error:', error);
        return { available: false, error: error.message };
    }
};


// ==================== EXPORTS ====================


/**
 * Get KPI trends for multiple brands (Competition page)
 */
const getCompetitionBrandTrends = async (filters = {}) => {
    try {
        let { brands = 'All', location = 'All', category = 'All', period = '1M' } = filters;

        // Handle "All India" -> "All" conversion
        if (location === 'All India') location = 'All';

        console.log('[getCompetitionBrandTrends] Filters:', { brands, location, category, period });

        const brandList = brands && brands !== 'All' ? brands.split(',').map(b => b.trim()) : [];
        if (brandList.length === 0) {
            return { brands: {}, metadata: { period, location, category } };
        }

        const endDate = await getCachedMaxDate();
        const startDate = period === '1W' ? endDate.subtract(7, 'days') : endDate.subtract(30, 'days');

        // Helper to escape strings for ClickHouse
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // Get valid brand names from rca_sku_dim (comp_flag = 0) for Market Share calculation
        const validBrandsResult = await queryClickHouse(`
            SELECT DISTINCT brand_name 
            FROM rca_sku_dim 
            WHERE toString(comp_flag) = '0' AND brand_name IS NOT NULL AND brand_name != ''
        `);
        const validBrandNames = validBrandsResult.map(b => b.brand_name).filter(Boolean);
        console.log(`[getCompetitionBrandTrends] Valid brands (comp_flag=0): ${validBrandNames.length}`);

        // First, get total impressions from rb_pdp_olap and Market Share from rb_brand_ms
        const baseConds = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        baseConds.push(`toString(Comp_flag) = '1'`);  // Competitor brands only

        const locArr = normalizeFilterArray(location);
        if (locArr && locArr.length > 0) {
            baseConds.push(`Location IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }

        // Market Share conditions for rb_brand_ms table (platform-level totals)
        const msBaseConds = [`created_on BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        msBaseConds.push(`sales IS NOT NULL`);
        if (locArr && locArr.length > 0) {
            msBaseConds.push(`Location IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }

        // Category Share conditions for rb_brand_ms table (category-level totals)
        const catBaseConds = [`created_on BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        catBaseConds.push(`sales IS NOT NULL`);
        if (locArr && locArr.length > 0) {
            catBaseConds.push(`Location IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }
        const catArr = normalizeFilterArray(category);
        if (catArr && catArr.length > 0) {
            catBaseConds.push(`category_master IN (${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }

        // Build valid brands filter for market share numerator
        const validBrandsFilter = validBrandNames.length > 0
            ? `brand IN (${validBrandNames.map(b => `'${escapeStr(b)}'`).join(', ')})`
            : '1=0';

        // Parallel queries: total impressions, total sales (MS denominator), our brands sales (MS numerator), category totals
        const [totalsData, msTotalsData, msOurBrandsData, catTotalsData, catOurBrandsData] = await Promise.all([
            // Query 1: Total impressions per day from rb_pdp_olap (for SOS calculation)
            queryClickHouse(`
                SELECT 
                    toDate(DATE) as date_key,
                    SUM(ifNull(toFloat64(Ad_Impressions), 0)) as total_impressions
                FROM rb_pdp_olap
                WHERE ${baseConds.join(' AND ')}
                GROUP BY date_key
                ORDER BY date_key ASC
            `),
            // Query 2: Total platform sales per day from rb_brand_ms (Market Share denominator)
            queryClickHouse(`
                SELECT 
                    toDate(created_on) as date_key,
                    SUM(toFloat64OrZero(sales)) as total_sales
                FROM rb_brand_ms
                WHERE ${msBaseConds.join(' AND ')}
                GROUP BY date_key
                ORDER BY date_key ASC
            `),
            // Query 3: Our brands (comp_flag=0) sales per day from rb_brand_ms (Market Share numerator)
            queryClickHouse(`
                SELECT 
                    toDate(created_on) as date_key,
                    SUM(toFloat64OrZero(sales)) as our_sales
                FROM rb_brand_ms
                WHERE ${msBaseConds.join(' AND ')} AND ${validBrandsFilter}
                GROUP BY date_key
                ORDER BY date_key ASC
            `),
            // Query 4: Total category sales per day from rb_brand_ms (Category Share denominator)
            queryClickHouse(`
                SELECT 
                    toDate(created_on) as date_key,
                    SUM(toFloat64OrZero(sales)) as total_cat_sales
                FROM rb_brand_ms
                WHERE ${catBaseConds.join(' AND ')}
                GROUP BY date_key
                ORDER BY date_key ASC
            `),
            // Query 5: Our brands category sales per day from rb_brand_ms (Category Share numerator)
            queryClickHouse(`
                SELECT 
                    toDate(created_on) as date_key,
                    SUM(toFloat64OrZero(sales)) as our_cat_sales
                FROM rb_brand_ms
                WHERE ${catBaseConds.join(' AND ')} AND ${validBrandsFilter}
                GROUP BY date_key
                ORDER BY date_key ASC
            `)
        ]);

        // Build lookup maps for totals by date
        const totalsMap = new Map(totalsData.map(r => [
            String(r.date_key),
            { total_impressions: parseFloat(r.total_impressions || 0) }
        ]));

        const msTotalsMap = new Map(msTotalsData.map(r => [
            String(r.date_key),
            { total_sales: parseFloat(r.total_sales || 0) }
        ]));


        // Note: msOurBrandsData is not mapped here as we query per-brand sales inside the loop

        const catTotalsMap = new Map(catTotalsData.map(r => [
            String(r.date_key),
            { total_cat_sales: parseFloat(r.total_cat_sales || 0) }
        ]));

        const catOurBrandsMap = new Map(catOurBrandsData.map(r => [
            String(r.date_key),
            { our_cat_sales: parseFloat(r.our_cat_sales || 0) }
        ]));

        console.log(`[getCompetitionBrandTrends] Got totals: ${totalsData.length} days impressions, ${msTotalsData.length} days market share, ${catTotalsData.length} days category share`);

        const brandTrends = {};

        for (const brandName of brandList) {
            // Build conditions for ClickHouse (rb_pdp_olap for OSA, SOS, Price)
            const conds = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
            if (location && location !== 'All') {
                conds.push(`Location = '${escapeStr(location)}'`);
            }
            conds.push(`Brand = '${escapeStr(brandName)}'`);

            // Build conditions to get this specific brand's sales from rb_brand_ms
            const brandMsConds = [...msBaseConds, `brand = '${escapeStr(brandName)}'`];

            // Parallel queries: main metrics from rb_pdp_olap and brand sales from rb_brand_ms
            const [rawData, brandSalesData] = await Promise.all([
                // Query main metrics from rb_pdp_olap (OSA, SOS numerator, Price)
                queryClickHouse(`
                    SELECT 
                        toDate(DATE) as date_key,
                        SUM(ifNull(toFloat64(Sales), 0)) as Offtakes,
                        SUM(ifNull(toFloat64(Ad_Spend), 0)) as Spend,
                        SUM(ifNull(toFloat64(Ad_sales), 0)) as Ad_sales,
                        SUM(ifNull(toFloat64(neno_osa), 0)) as neno_osa,
                        SUM(ifNull(toFloat64(deno_osa), 0)) as deno_osa,
                        SUM(ifNull(toFloat64(Ad_Impressions), 0)) as Impressions,
                        AVG(ifNull(toFloat64(MRP), 0)) as avg_price
                    FROM rb_pdp_olap
                    WHERE ${conds.join(' AND ')}
                    GROUP BY date_key
                    ORDER BY date_key ASC
                `),
                // Query this specific brand's sales per day from rb_brand_ms (for Market Share numerator)
                queryClickHouse(`
                    SELECT 
                        toDate(created_on) as date_key,
                        SUM(toFloat64OrZero(sales)) as brand_sales
                    FROM rb_brand_ms
                    WHERE ${brandMsConds.join(' AND ')}
                    GROUP BY date_key
                    ORDER BY date_key ASC
                `)
            ]);

            // Build lookup map for this brand's sales per day
            const brandSalesMap = new Map(brandSalesData.map(r => [
                String(r.date_key),
                parseFloat(r.brand_sales || 0)
            ]));

            console.log(`[getCompetitionBrandTrends] Brand "${brandName}": ${rawData.length} data points, ${brandSalesData.length} market share points`);

            // Process the raw data to get trend points
            brandTrends[brandName] = rawData.map(row => {
                const nenoOsa = parseFloat(row.neno_osa || 0);
                const denoOsa = parseFloat(row.deno_osa || 0);
                const avgPrice = parseFloat(row.avg_price || 0);
                const impressions = parseFloat(row.Impressions || 0);

                // Calculate OSA
                const osa = denoOsa > 0 ? ((nenoOsa / denoOsa) * 100) : 0;

                // Get totals for this date (use String() for consistent key format)
                const dateKey = String(row.date_key);
                const totals = totalsMap.get(dateKey) || { total_impressions: 0 };
                const msTotals = msTotalsMap.get(dateKey) || { total_sales: 0 };
                const catTotals = catTotalsMap.get(dateKey) || { total_cat_sales: 0 };
                const catOurBrands = catOurBrandsMap.get(dateKey) || { our_cat_sales: 0 };
                const brandSales = brandSalesMap.get(dateKey) || 0;

                // Calculate SOS (Share of Search) = brand impressions / total impressions
                const sos = totals.total_impressions > 0
                    ? (impressions / totals.total_impressions) * 100
                    : 0;

                // Calculate Market Share = this brand's sales / total platform sales
                const marketShare = msTotals.total_sales > 0
                    ? (brandSales / msTotals.total_sales) * 100
                    : 0;

                // Calculate Category Share = our brands category sales (comp_flag=0) / total category sales
                const categoryShare = catTotals.total_cat_sales > 0
                    ? (catOurBrands.our_cat_sales / catTotals.total_cat_sales) * 100
                    : 0;

                // Return only the 5 KPIs the frontend uses
                return {
                    date: dayjs(row.date_key).format("DD MMM'YY"),
                    osa: parseFloat(osa.toFixed(1)),
                    sos: parseFloat(sos.toFixed(1)),
                    price: parseFloat(avgPrice.toFixed(0)),
                    categoryShare: parseFloat(categoryShare.toFixed(1)),
                    marketShare: parseFloat(marketShare.toFixed(1))
                };
            });
        }

        console.log(`[getCompetitionBrandTrends] Returning trends for ${Object.keys(brandTrends).length} brands`);

        return {
            brands: brandTrends,
            metadata: { period, location, category, brandCount: brandList.length }
        };
    } catch (error) {
        console.error('[getCompetitionBrandTrends] Error:', error);
        return { brands: {}, metadata: { error: error.message } };
    }
};

/**
 * Get Dark Store Count from rb_location_darkstore table
 * Returns count of distinct merchant_name grouped by platform based on filters
 * @param {Object} filters - { platform, location, startDate, endDate }
 * @returns {Object} - { totalCount, byPlatform: { platform: count } }
 */
/**
 * Get Dark Store Count from rb_location_darkstore table
 * Returns count of distinct merchant_name grouped by platform based on filters
 * @param {Object} filters - { platform, location, startDate, endDate }
 * @returns {Object} - { totalCount, byPlatform: { platform: count } }
 */
const getDarkStoreCount = async (filters = {}) => {
    try {
        console.log('[getDarkStoreCount] Fetching dark store count with filters:', filters);

        const { platform, location, startDate, endDate } = filters;

        // Helper to escape strings for ClickHouse
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // Build conditions
        const conds = [];

        // Platform filter
        if (platform && platform !== 'All') {
            const platformArr = Array.isArray(platform) ? platform : [platform];
            if (platformArr.length > 0) {
                conds.push(`platform IN (${platformArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
            }
        }

        // Location filter
        if (location && location !== 'All') {
            const locationArr = Array.isArray(location) ? location : [location];
            if (locationArr.length > 0) {
                conds.push(`location IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
            }
        }

        const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

        // Query for dark store count grouped by platform
        const query = `
            SELECT 
                platform,
                count(DISTINCT merchant_name) as store_count
            FROM rb_location_darkstore
            ${whereClause}
            GROUP BY platform
        `;

        console.log('[getDarkStoreCount] Query:', query);

        const results = await queryClickHouse(query);

        // Build response
        const byPlatform = {};
        let totalCount = 0;

        results.forEach(row => {
            const count = parseInt(row.store_count) || 0;
            byPlatform[row.platform] = count;
            totalCount += count;
        });

        console.log(`[getDarkStoreCount] Total: ${totalCount}, By Platform:`, byPlatform);

        return {
            totalCount,
            byPlatform
        };
    } catch (error) {
        console.error('[getDarkStoreCount] Error:', error);
        return { totalCount: 0, byPlatform: {} };
    }
};

/**
 * Get Top Actions counts, KPIs and Graph data
 * @param {Object} filters - { platform, endDate }
 * @returns {Object} - { counts, kpis, graphData }
 */
const getTopActions = async (filters = {}) => {
    try {
        const { platform = 'All' } = filters;
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // Build platform array
        const platformArr = (platform && platform !== 'All')
            ? (Array.isArray(platform) ? platform : platform.split(',').map(p => p.trim()))
            : [];

        const platCond = platformArr.length > 0
            ? `platform IN (${platformArr.map(p => `'${escapeStr(p)}'`).join(', ')})`
            : '1=1';

        // 1. Fetch Latest Available Dates from both tables for alignment fallback
        const [latestOlapRes, latestInsightRes] = await Promise.all([
            queryClickHouse(`SELECT MAX(toDate(DATE)) as max_date FROM rb_pdp_olap WHERE ${platCond.replace('platform', 'Platform')}`),
            queryClickHouse(`SELECT MAX(toDate(DATE)) as max_date FROM rca_watchtower_insight WHERE ${platCond}`)
        ]);

        const maxOlapDate = latestOlapRes[0]?.max_date ? dayjs(latestOlapRes[0].max_date) : dayjs();
        const maxInsightDate = latestInsightRes[0]?.max_date ? dayjs(latestInsightRes[0].max_date) : dayjs();

        // Use requested date or cap at available data (or fallback to latest if none provided)
        let targetOlapDate = (filters.endDate && filters.endDate !== 'null' && filters.endDate !== 'undefined')
            ? dayjs(filters.endDate)
            : maxOlapDate;

        // Capping logic (ensures we don't query empty future dates if user selects one)
        if (targetOlapDate.isAfter(maxOlapDate)) targetOlapDate = maxOlapDate;

        let targetInsightDate = (filters.endDate && filters.endDate !== 'null' && filters.endDate !== 'undefined')
            ? dayjs(filters.endDate)
            : maxInsightDate;

        if (targetInsightDate.isAfter(maxInsightDate)) targetInsightDate = maxInsightDate;

        const dateVal = targetOlapDate; // Primary reference for trends/KPIs
        const endDateStr = dateVal.format('YYYY-MM-DD');
        const insightDateStr = targetInsightDate.format('YYYY-MM-DD');

        console.log(`[getTopActions] Alignment - OLAP: ${endDateStr}, Insight: ${insightDateStr}`);

        // 2. Basic Counts & KPIs (Refined based on user feedback)
        // NCR Filtering for the "OSA – Quick Commerce NCR" segment
        // Robust patterns to match various naming conventions including Zepto prefixes
        const ncrPatterns = [
            'Delhi', 'NCR', 'Noida', 'Gurugram', 'Gurgaon', 'Ghaziabad', 'Faridabad',
            'DEL-', 'GGN-', 'NOD-', 'GZB-', 'FBD-'
        ];
        const ncrCondInsight = `multiSearchAnyCaseInsensitive(Darkstore_name, [${ncrPatterns.map(p => `'${escapeStr(p)}'`).join(', ')}])`;
        const ncrCondOlap = `multiSearchAnyCaseInsensitive(Location, [${ncrPatterns.map(p => `'${escapeStr(p)}'`).join(', ')}])`;

        // Store Count: distinct count of Darkstore_name from rca_watchtower_insight
        const storeQuery = `
            SELECT count(DISTINCT Darkstore_name) as count, MAX(active_dark_store) as active_stores
            FROM rca_watchtower_insight 
            WHERE ${platCond} AND toDate(DATE) = '${insightDateStr}' AND ${ncrCondInsight}
        `;

        // SKU Count: distinct count of Web_Pid from rb_pdp_olap
        const skuQuery = `
            SELECT count(DISTINCT Web_Pid) as count, groupArray(DISTINCT Web_Pid) as pids 
            FROM rb_pdp_olap 
            WHERE ${platCond.replace('platform', 'Platform')} AND toDate(DATE) = '${endDateStr}' AND ${ncrCondOlap}
        `;

        const [storeRes, skuRes] = await Promise.all([
            queryClickHouse(storeQuery),
            queryClickHouse(skuQuery)
        ]);

        const darkstoreCount = parseInt(storeRes[0]?.count || 0);
        const activeStoresVal = parseInt(storeRes[0]?.active_stores || 0);
        const skuCount = parseInt(skuRes[0]?.count || 0);
        const topPids = skuRes[0]?.pids ? skuRes[0].pids.slice(0, 4) : [];

        console.log(`[getTopActions] Refined Counts - OOS Stores: ${darkstoreCount}, Active Stores KPI: ${activeStoresVal}, SKUs: ${skuCount}`);

        // 3. KPIs from rb_pdp_olap
        const platCondOlap = platCond.replace('platform', 'Platform');

        // OSA %
        const osaCurrentQuery = `
            SELECT SUM(toFloat64OrZero(neno_osa)) as neno, SUM(toFloat64(deno_osa)) as deno 
            FROM rb_pdp_olap 
            WHERE ${platCondOlap} AND toDate(DATE) = '${endDateStr}'
        `;
        const osaPrevQuery = `
            SELECT SUM(toFloat64OrZero(neno_osa)) as neno, SUM(toFloat64(deno_osa)) as deno 
            FROM rb_pdp_olap 
            WHERE ${platCondOlap} AND toDate(DATE) = '${dateVal.subtract(7, 'day').format('YYYY-MM-DD')}'
        `;

        // Sales MTD
        const mtdStart = dateVal.startOf('month').format('YYYY-MM-DD');
        const salesMtdQuery = `
            SELECT SUM(toFloat64OrZero(Sales)) as sales 
            FROM rb_pdp_olap 
            WHERE ${platCondOlap} AND toDate(DATE) BETWEEN '${mtdStart}' AND '${endDateStr}'
        `;
        const lastMtdStart = dateVal.subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        const lastMtdEnd = dateVal.subtract(1, 'month').format('YYYY-MM-DD');
        const lastSalesMtdQuery = `
            SELECT SUM(toFloat64OrZero(Sales)) as sales 
            FROM rb_pdp_olap 
            WHERE ${platCondOlap} AND toDate(DATE) BETWEEN '${lastMtdStart}' AND '${lastMtdEnd}'
        `;

        const [osaCurr, osaPrev, salesCurr, salesPrev] = await Promise.all([
            queryClickHouse(osaCurrentQuery),
            queryClickHouse(osaPrevQuery),
            queryClickHouse(salesMtdQuery),
            queryClickHouse(lastSalesMtdQuery)
        ]);

        const currentOsa = osaCurr[0]?.deno > 0 ? (osaCurr[0].neno / osaCurr[0].deno) * 100 : 0;
        const previousOsa = osaPrev[0]?.deno > 0 ? (osaPrev[0].neno / osaPrev[0].deno) * 100 : 0;
        const osaDelta = currentOsa - previousOsa;

        const currentSales = parseFloat(salesCurr[0]?.sales || 0);
        const previousSales = parseFloat(salesPrev[0]?.sales || 0);
        const salesDelta = previousSales > 0 ? ((currentSales - previousSales) / previousSales) * 100 : 0;

        // Lost Sales = [(MTD Sales / currentOsa%) - MTD Sales]
        const lostSales = currentOsa > 0 ? (currentSales / (currentOsa / 100)) - currentSales : 0;

        // 4. Graph Data (7 days trend for topPids)
        const getTrend = async (startDate, endDate) => {
            if (topPids.length === 0) return [];
            const pidList = topPids.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',');
            return queryClickHouse(`
                SELECT toDate(DATE) as day, SUM(toFloat64OrZero(neno_osa)) as n, SUM(toFloat64(deno_osa)) as d
                FROM rb_pdp_olap
                WHERE ${platCondOlap}
                  AND toDate(DATE) BETWEEN '${startDate}' AND '${endDate}'
                  AND lower(Web_Pid) IN (${pidList})
                GROUP BY day ORDER BY day ASC
            `);
        };

        const todayTrend = await getTrend(dateVal.subtract(6, 'day').format('YYYY-MM-DD'), endDateStr);
        const weekTrend = await getTrend(dateVal.subtract(13, 'day').format('YYYY-MM-DD'), dateVal.subtract(7, 'day').format('YYYY-MM-DD'));
        const monthTrend = await getTrend(dateVal.subtract(1, 'month').subtract(6, 'day').format('YYYY-MM-DD'), dateVal.subtract(1, 'month').format('YYYY-MM-DD'));

        const formatGraph = (currTrend, compTrend) => {
            const labels = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Today'];
            return labels.map((label, i) => {
                const c = currTrend[i]?.d > 0 ? (currTrend[i].n / currTrend[i].d) * 100 : 0;
                const p = compTrend[i]?.d > 0 ? (compTrend[i].n / compTrend[i].d) * 100 : 0;
                return { day: label, current: parseFloat(c.toFixed(1)), compare: parseFloat(p.toFixed(1)) };
            });
        };

        const result = {
            counts: { darkstoreCount, skuCount },
            kpis: {
                osa: { value: `${currentOsa.toFixed(1)}%`, delta: `${osaDelta >= 0 ? '+' : ''}${osaDelta.toFixed(1)} pt` },
                fillRate: { value: "Coming Soon", delta: "0" },
                salesMtd: { value: `₹${(currentSales / 10000000).toFixed(1)} Cr`, delta: `${salesDelta >= 0 ? '+' : ''}${salesDelta.toFixed(1)}%` },
                lostSales: { value: `₹${(lostSales / 10000000).toFixed(1)} Cr`, delta: "" },
                activeStores: { value: activeStoresVal.toLocaleString(), delta: "" },
                heroSkus: { value: skuCount.toString(), delta: "0" }
            },
            graphData: {
                week: formatGraph(todayTrend, weekTrend),
                month: formatGraph(todayTrend, monthTrend)
            },
            metadata: { platform, endDate: endDateStr, topPids }
        };
        console.log('[getTopActions] Result generated');
        return result;

    } catch (error) {
        console.error('[getTopActions] CRITICAL ERROR:', error);
        return { counts: { darkstoreCount: 0, skuCount: 0 }, kpis: {}, graphData: { week: [], month: [] } };
    }
};

/**
 * Get OSA Deep Dive table data (city-wise breakdown)
 * @param {Object} filters - { platform, endDate }
 * @returns {Array} - Array of city objects with KPIs
 */
const getOsaDeepDive = async (filters = {}) => {
    try {
        const { platform = 'All' } = filters;
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // Build platform conditions
        const platformArr = (platform && platform !== 'All')
            ? (Array.isArray(platform) ? platform : platform.split(',').map(p => p.trim()))
            : [];

        const platCondDarkstore = platformArr.length > 0
            ? `platform IN (${platformArr.map(p => `'${escapeStr(p)}'`).join(', ')})`
            : '1=1';
        const platCondOlap = platformArr.length > 0
            ? `Platform IN (${platformArr.map(p => `'${escapeStr(p)}'`).join(', ')})`
            : '1=1';

        // 1. Fetch Latest Available Date from rb_pdp_olap
        const latestDateRes = await queryClickHouse(`
            SELECT MAX(toDate(DATE)) as max_date 
            FROM rb_pdp_olap 
            WHERE ${platCondOlap}
        `);
        const maxAvailableDate = latestDateRes[0]?.max_date ? dayjs(latestDateRes[0].max_date) : dayjs();

        let targetDate = filters.endDate && filters.endDate !== 'null' && filters.endDate !== 'undefined'
            ? dayjs(filters.endDate)
            : maxAvailableDate;

        if (targetDate.isAfter(maxAvailableDate)) {
            targetDate = maxAvailableDate;
        }

        const endDateStr = targetDate.format('YYYY-MM-DD');
        const mtdStart = targetDate.startOf('month').format('YYYY-MM-DD');

        // 2. Fetch Hero SKUs for filtering
        const heroSkuRes = await queryClickHouse(`
            SELECT DISTINCT lower(web_pid) as pid 
            FROM rca_watchtower_insight 
            WHERE ${platCondDarkstore} AND date = '${endDateStr}'
        `);
        const heroPids = heroSkuRes.map(r => `'${escapeStr(r.pid)}'`).join(',');
        const heroSkuFilter = heroPids ? `AND lower(Web_Pid) IN (${heroPids})` : 'AND 1=0';

        // 3. Parallel Queries for City Data
        // a) City Store Counts from rb_location_darkstore
        const storeCountQuery = `
            SELECT location, count(DISTINCT merchant_name) as count 
            FROM rb_location_darkstore 
            WHERE ${platCondDarkstore} AND toDate(created_on) <= '${endDateStr}'
            GROUP BY location
        `;

        // b) City KPIs from rb_pdp_olap (OSA, Sales, Hero SKUs)
        const cityStatsQuery = `
            SELECT 
                Location as city,
                SUM(toFloat64OrZero(neno_osa)) as neno, 
                SUM(toFloat64(deno_osa)) as deno,
                SUM(CASE WHEN toDate(DATE) BETWEEN '${mtdStart}' AND '${endDateStr}' THEN toFloat64OrZero(Sales) ELSE 0 END) as sales_mtd,
                count(DISTINCT CASE WHEN toDate(DATE) = '${endDateStr}' ${heroSkuFilter} THEN Web_Pid END) as hero_skus
            FROM rb_pdp_olap
            WHERE ${platCondOlap} AND toDate(DATE) BETWEEN '${mtdStart}' AND '${endDateStr}'
            GROUP BY city
        `;

        const [storeCounts, cityStats] = await Promise.all([
            queryClickHouse(storeCountQuery),
            queryClickHouse(cityStatsQuery)
        ]);

        // 4. Merge Results
        const cityMap = {};

        // Start with all cities from darkstore table to ensure 706 count consistency
        storeCounts.forEach(row => {
            const cityName = row.location || 'Other';
            cityMap[cityName.toLowerCase()] = {
                city: cityName,
                osa: '0.0%',
                fillRate: 'Coming Soon',
                sales: '₹0.0 Cr',
                lostSales: '₹0.0 Cr',
                heroSkus: '0',
                storeCount: row.count
            };
        });

        // Overlay with actual KPIs where available
        cityStats.forEach(row => {
            const key = row.city.toLowerCase();
            const osa = row.deno > 0 ? (row.neno / row.deno) * 100 : 0;
            const sales = parseFloat(row.sales_mtd || 0);
            const lostSales = osa > 0 ? (sales / (osa / 100)) - sales : 0;

            if (cityMap[key]) {
                cityMap[key].osa = osa.toFixed(1) + '%';
                cityMap[key].sales = `₹${(sales / 10000000).toFixed(1)} Cr`;
                cityMap[key].lostSales = `₹${(lostSales / 10000000).toFixed(1)} Cr`;
                cityMap[key].heroSkus = row.hero_skus.toString();
            } else {
                // If it's a city in OLAP but not in Darkstore list (rare), add it too
                cityMap[key] = {
                    city: row.city,
                    osa: osa.toFixed(1) + '%',
                    fillRate: 'Coming Soon',
                    sales: `₹${(sales / 10000000).toFixed(1)} Cr`,
                    lostSales: `₹${(lostSales / 10000000).toFixed(1)} Cr`,
                    heroSkus: row.hero_skus.toString(),
                    storeCount: 0
                };
            }
        });

        // Convert to array and filter out cities with 0 stores
        return Object.values(cityMap)
            .filter(c => c.storeCount > 0 || c.osa !== '0.0%')
            .sort((a, b) => b.storeCount - a.storeCount);

    } catch (error) {
        console.error('[getOsaDeepDive] Error:', error);
        return [];
    }
};

export default {
    getSummaryMetrics,
    getTrendData,
    getPlatforms,
    getBrands,
    getKeywords,
    getLocations,
    getBrandCategories,
    getOverview,
    getPerformanceMetrics,
    getPlatformOverview,
    getMonthOverview,
    getCategoryOverview,
    getBrandsOverview,
    getKpiTrends,
    getTrendsFilterOptions,
    getCompetitionData,
    getCompetitionFilterOptions,
    getCompetitionBrandTrends,
    getLatestAvailableMonth,
    getDarkStoreCount,
    getTopActions,
    getOsaDeepDive
};
