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
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import weekOfYear from 'dayjs/plugin/weekOfYear.js';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);

// Import cache helpers
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

// Import Redis data layer for indexed platform data caching
import { ensurePlatformData, queryByFilters, aggregateMetrics, getPlatformStats, isPlatformDataLoaded, getCachedSOSData, cacheSOSData, getCachedMonthlyKPIs, cacheMonthlyKPIs, coalesceRequest, getCachedPlatformMetrics, cachePlatformMetrics, getBrandMonthlyData } from './redisDataService.js';

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
        const ourBrands = await RbPdpOlap.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Brand')), 'brand']],
            where: { Comp_flag: 0 },
            raw: true
        });
        const result = ourBrands.map(b => b.brand).filter(b => b);
        distinctValuesCache.ourBrands = { data: result, timestamp: Date.now() };
        console.log(`[Global] Cached ${result.length} OUR brands (Comp_flag=0)`);
        return result;
    } catch (error) {
        console.error('Error fetching our brands list:', error);
        return [];
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
        const validBrandsData = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
            where: { comp_flag: 0 },
            raw: true
        });
        const result = validBrandsData.map(b => b.brand_name).filter(Boolean);
        cachedValidBrandNames = { data: result, timestamp: Date.now() };
        console.log(`⚡ [Cache] Cached ${result.length} valid brand names from RcaSkuDim`);
        return result;
    } catch (error) {
        console.error('Error fetching valid brand names:', error);
        return [];
    }
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

        const { months = 1, startDate: qStartDate, endDate: qEndDate, compareStartDate: qCompareStartDate, compareEndDate: qCompareEndDate, brand: rawBrand, location: rawLocation, category, platform } = filters;
        const brand = rawBrand?.trim();
        const location = rawLocation?.trim();
        const monthsBack = parseInt(months, 10) || 1;

        // Calculate date range
        let endDate = dayjs().endOf('day');
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

        const monthBuckets = generateMonthBuckets(startDate, endDate);

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

        // Build Where Clause for RbPdpOlap (Offtake)
        const offtakeWhereClause = {
            DATE: {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
            }
        };

        // FIXED: When brand is "All", only include OUR brands (Comp_flag = 0)
        if (brand && brand !== 'All') {
            offtakeWhereClause.Brand = { [Op.like]: `%${brand}%` };
        } else {
            offtakeWhereClause.Comp_flag = 0;  // Our brands only when "All" selected
        }
        if (location && location !== 'All') {
            offtakeWhereClause.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
        }

        const selectedPlatform = filters.platform;
        if (selectedPlatform && selectedPlatform !== 'All') {
            offtakeWhereClause.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), selectedPlatform.toLowerCase());
        }

        // 3. Availability Calculation Helper (Unified for all platforms using RbPdpOlap)
        const getAvailability = async (start, end, brandFilter, platformFilter, locationFilter, categoryFilter) => {
            let where = {};

            // Check if first argument is a pre-built where clause (overload)
            if (start && typeof start.toDate !== 'function' && typeof start === 'object') {
                where = start;
            } else {
                where = {
                    DATE: {
                        [Op.between]: [start.toDate(), end.toDate()]
                    }
                };

                // FIXED: When brand is "All", only include OUR brands (Comp_flag = 0)
                if (brandFilter && brandFilter !== 'All') {
                    where.Brand = {
                        [Op.like]: `%${brandFilter}%`
                    };
                } else {
                    where.Comp_flag = 0;  // Our brands only when "All" selected
                }
                if (platformFilter && platformFilter !== 'All') where.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platformFilter.toLowerCase());
                if (locationFilter && locationFilter !== 'All') where.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), locationFilter.toLowerCase());
                if (categoryFilter && categoryFilter !== 'All') where.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), categoryFilter.toLowerCase());
            }

            const result = await RbPdpOlap.findOne({
                attributes: [
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: where,
                raw: true
            });

            const totalNeno = parseFloat(result?.total_neno || 0);
            const totalDeno = parseFloat(result?.total_deno || 0);

            return totalDeno > 0 ? (totalNeno / totalDeno) * 100 : 0;
        };

        // Share of Search Calculation Helper
        // Formula when Brand = "All": SOS = (Count of rows where keyword_is_rb_product=1) / (Count of ALL rows) × 100
        // Uses keyword_is_rb_product column in rb_kw table (1 = our RB product)
        const getShareOfSearch = async (start, end, brandFilter, platformFilter, locationFilter, categoryFilter) => {
            try {
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

                // Common where clause (applies to all queries) - filters: time period, platform, location
                const baseWhere = {
                    kw_crawl_date: {
                        [Op.between]: [start.toDate(), end.toDate()]
                    }
                };

                if (categoryFilter && categoryFilter !== 'All') {
                    baseWhere.keyword_category = sequelize.where(sequelize.fn('LOWER', sequelize.col('keyword_category')), categoryFilter.toLowerCase());
                }

                if (locationFilter && locationFilter !== 'All') {
                    baseWhere.location_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), locationFilter.toLowerCase());
                }

                if (platformFilter && platformFilter !== 'All') {
                    baseWhere.platform_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), platformFilter.toLowerCase());
                }

                // 1. Determine which rows to count in the numerator
                const numeratorWhere = { ...baseWhere };

                if (brandFilter && brandFilter !== 'All') {
                    // Specific brand selected - filter by that brand name
                    numeratorWhere.brand_name = brandFilter;
                } else {
                    // "All" brands selected - use keyword_is_rb_product=1 for our brands (RB products)
                    numeratorWhere.keyword_is_rb_product = 1;
                }

                // 2. Count ALL rows for denominator (same filters minus brand/competitor filter)
                const denominatorWhere = { ...baseWhere };

                const [numeratorCount, denominatorCount] = await Promise.all([
                    RbKw.count({ where: numeratorWhere }),  // Counts OUR brands rows (keyword_is_rb_product=1)
                    RbKw.count({ where: denominatorWhere })  // Counts ALL rows (total market)
                ]);

                const sos = denominatorCount > 0 ? (numeratorCount / denominatorCount) * 100 : 0;
                // Debug logging (uncomment when needed):
                // console.log(`[SOS Calculation] Brand: ${brandFilter}, OurBrandsCount: ${numeratorCount}, TotalCount: ${denominatorCount}, SOS: ${sos.toFixed(2)}%`);

                return sos;
            } catch (error) {
                console.error("Error calculating Share of Search:", error);
                return 0;
            }
        };


        /**
         * Bulk Share of Search Calculation
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

                // Base where clause (common filters)
                const baseWhere = {};

                if (categoryFilter) {
                    baseWhere.keyword_category = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('keyword_category')),
                        categoryFilter.toLowerCase()
                    );
                }

                if (locationFilter && locationFilter !== 'All') {
                    baseWhere.location_name = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('location_name')),
                        locationFilter.toLowerCase()
                    );
                }

                if (platformFilter && platformFilter !== 'All') {
                    baseWhere.platform_name = sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('platform_name')),
                        platformFilter.toLowerCase()
                    );
                }

                // Filter out empty/null brands
                const validBrands = brands.filter(b => b && b.trim());
                if (validBrands.length === 0) {
                    console.timeEnd(timerLabel);
                    return new Map();
                }

                console.log(`[Bulk SOS] Calculating SOS for ${validBrands.length} brands:`, validBrands.slice(0, 5).join(', ') + '...');

                // Execute all 4 queries in parallel
                // OPTIMIZED: Direct brand name comparison without LOWER() for faster queries

                const [currBrandCounts, currTotalCount, prevBrandCounts, prevTotalCount] = await Promise.all([
                    // Query 1: Get counts for ALL brands (current period) in ONE query
                    RbKw.findAll({
                        attributes: [
                            'brand_name',
                            [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
                        ],
                        where: {
                            ...baseWhere,
                            kw_crawl_date: {
                                [Op.between]: [currStart.toDate(), currEnd.toDate()]
                            },
                            // OPTIMIZED: Direct comparison without LOWER() - much faster
                            brand_name: { [Op.in]: validBrands }
                        },
                        group: ['brand_name'],
                        raw: true
                    }),

                    // Query 2: Get total count (current period) - ONCE
                    RbKw.count({
                        where: {
                            ...baseWhere,
                            kw_crawl_date: {
                                [Op.between]: [currStart.toDate(), currEnd.toDate()]
                            }
                        }
                    }),

                    // Query 3: Get counts for ALL brands (previous period) in ONE query
                    RbKw.findAll({
                        attributes: [
                            'brand_name',
                            [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
                        ],
                        where: {
                            ...baseWhere,
                            kw_crawl_date: {
                                [Op.between]: [prevStart.toDate(), prevEnd.toDate()]
                            },
                            // OPTIMIZED: Direct comparison without LOWER() - much faster
                            brand_name: { [Op.in]: validBrands }
                        },
                        group: ['brand_name'],
                        raw: true
                    }),

                    // Query 4: Get total count (previous period) - ONCE
                    RbKw.count({
                        where: {
                            ...baseWhere,
                            kw_crawl_date: {
                                [Op.between]: [prevStart.toDate(), prevEnd.toDate()]
                            }
                        }
                    })
                ]);

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
                // Cache current period data
                cacheSOSData(
                    currCacheKey.platform,
                    currCacheKey.dateStart,
                    currCacheKey.dateEnd,
                    currCacheKey.category,
                    currCacheKey.location,
                    {
                        brandCounts: Object.fromEntries(currCountMap),
                        totalCount: currTotalCount
                    }
                ).catch(err => console.warn('Failed to cache curr SOS:', err.message));

                // Cache previous period data
                cacheSOSData(
                    prevCacheKey.platform,
                    prevCacheKey.dateStart,
                    prevCacheKey.dateEnd,
                    prevCacheKey.category,
                    prevCacheKey.location,
                    {
                        brandCounts: Object.fromEntries(prevCountMap),
                        totalCount: prevTotalCount
                    }
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
         * Bulk Platform Metrics - Aggregate all platforms in ONE query
         * Reduces 90 queries to 4 queries (20x improvement)
         */
        const getBulkPlatformMetrics = async (platforms, currStart, currEnd, prevStart, prevEnd, filters) => {
            try {
                const timerLabel = `[Bulk Platform] Total ${Date.now()}`;
                console.time(timerLabel);
                const { brand, location, category } = filters;

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

                // Current period where clause
                const currWhere = {
                    DATE: { [Op.between]: [currStart.toDate(), currEnd.toDate()] }
                };
                // FIXED: When brand is "All", only include OUR brands (Comp_flag = 0)
                if (brand && brand !== 'All') {
                    currWhere.Brand = { [Op.like]: `%${brand}%` };
                } else {
                    currWhere.Comp_flag = 0;  // Our brands only when "All" selected
                }
                if (location && location !== 'All') {
                    currWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
                }
                if (category && category !== 'All') {
                    currWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());
                }

                // Previous period where clause
                const prevWhere = {
                    DATE: { [Op.between]: [prevStart.toDate(), prevEnd.toDate()] }
                };
                // FIXED: When brand is "All", only include OUR brands (Comp_flag = 0)
                if (brand && brand !== 'All') {
                    prevWhere.Brand = { [Op.like]: `%${brand}%` };
                } else {
                    prevWhere.Comp_flag = 0;  // Our brands only when "All" selected
                }
                if (location && location !== 'All') {
                    prevWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
                }
                if (category && category !== 'All') {
                    prevWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());
                }

                // Execute 4 queries in parallel - GROUP BY Platform
                const [currData, currMs, prevData, prevMs] = await Promise.all([
                    // Query 1: Current period offtake metrics for all platforms
                    RbPdpOlap.findAll({
                        attributes: [
                            'Platform',
                            [Sequelize.fn('SUM', Sequelize.col('Sales')), 'sales'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'spend'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'ad_sales'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'clicks'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'impressions'],
                            [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'neno'],
                            [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'deno']
                        ],
                        where: currWhere,
                        group: ['Platform'],
                        raw: true
                    }),
                    // Query 2: Current period market share - rb_brand_ms doesn't have Platform column
                    // Return overall market share instead of per-platform breakdown
                    RbBrandMs.findOne({
                        attributes: [
                            [Sequelize.fn('AVG', Sequelize.col('market_share')), 'ms']
                        ],
                        where: {
                            created_on: { [Op.between]: [currStart.toDate(), currEnd.toDate()] },
                            ...(brand && brand !== 'All' && {
                                brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase())
                            }),
                            ...(location && location !== 'All' && {
                                Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase())
                            }),
                            ...(category && category !== 'All' && {
                                category: sequelize.where(sequelize.fn('LOWER', sequelize.col('category')), category.toLowerCase())
                            })
                        },
                        raw: true
                    }),
                    // Query 3: Previous period offtake metrics for all platforms
                    RbPdpOlap.findAll({
                        attributes: [
                            'Platform',
                            [Sequelize.fn('SUM', Sequelize.col('Sales')), 'sales'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'spend'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'ad_sales'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'clicks'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'impressions'],
                            [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'neno'],
                            [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'deno']
                        ],
                        where: prevWhere,
                        group: ['Platform'],
                        raw: true
                    }),
                    // Query 4: Previous period market share - rb_brand_ms doesn't have Platform column
                    // Return overall market share instead of per-platform breakdown
                    RbBrandMs.findOne({
                        attributes: [
                            [Sequelize.fn('AVG', Sequelize.col('market_share')), 'ms']
                        ],
                        where: {
                            created_on: { [Op.between]: [prevStart.toDate(), prevEnd.toDate()] },
                            ...(brand && brand !== 'All' && {
                                brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase())
                            }),
                            ...(location && location !== 'All' && {
                                Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase())
                            }),
                            ...(category && category !== 'All' && {
                                category: sequelize.where(sequelize.fn('LOWER', sequelize.col('category')), category.toLowerCase())
                            })
                        },
                        raw: true
                    })
                ]);

                console.log(`[Bulk Platform] Processed ${platforms.length} platforms with 4 queries (vs ${platforms.length * 15} individual queries)`);

                // Build result map
                const map = new Map();
                // currMs and prevMs are now single objects, not arrays
                // Use overall market share for all platforms since rb_brand_ms doesn't have Platform column
                const overallCurrMs = parseFloat(currMs?.ms || 0);
                const overallPrevMs = parseFloat(prevMs?.ms || 0);

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
                            ms: overallCurrMs  // Use overall market share
                        },
                        prev: {
                            sales: parseFloat(pv?.sales || 0),
                            spend: parseFloat(pv?.spend || 0),
                            adSales: parseFloat(pv?.ad_sales || 0),
                            clicks: parseFloat(pv?.clicks || 0),
                            impressions: parseFloat(pv?.impressions || 0),
                            neno: parseFloat(pv?.neno || 0),
                            deno: parseFloat(pv?.deno || 0),
                            ms: overallPrevMs  // Use overall market share
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


        // Execute queries concurrently
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
            // 1. Total Offtake (Sales) & Chart Data - Always use rb_pdp_olap Sales column
            (async () => {
                // console.log("\n[OFFTAKE DEBUG] Querying rb_pdp_olap with filters:");
                // console.log("  Where Clause:", JSON.stringify(offtakeWhereClause, null, 2));

                const result = await RbPdpOlap.findAll({
                    attributes: [
                        [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01'), 'month_date'],
                        [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']
                    ],
                    where: offtakeWhereClause,
                    group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01')],
                    raw: true
                });

                // console.log(`  Result: ${result.length} month(s) with data`);
                // result.forEach(r => {
                //     console.log(`    ${r.month_date}: ₹${(r.total_sales || 0).toLocaleString('en-IN')}`);
                // });

                // const totalSales = result.reduce((sum, r) => sum + parseFloat(r.total_sales || 0), 0);
                // console.log(`  Total Offtake: ₹${totalSales.toLocaleString('en-IN')}\n`);

                return result;
            })(),
            // 2. Market Share using new formula: (Sales of our brands) / (Total sales) * 100
            // Get valid brands first, then calculate MS
            (async () => {
                // Get valid brands (comp_flag = 0)
                const validBrands = await RcaSkuDim.findAll({
                    attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
                    where: { comp_flag: 0 },
                    raw: true
                });
                const validBrandNames = validBrands.map(b => b.brand_name).filter(Boolean);

                const msFilter = {
                    created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                    sales: { [Op.ne]: null },
                    ...(platform && platform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase()) }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
                };

                // Monthly chart data
                const [numeratorData, denominatorData] = await Promise.all([
                    // Numerator: Our brands sales per month
                    RbBrandMs.findAll({
                        attributes: [
                            [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01'), 'month_date'],
                            [Sequelize.fn('SUM', Sequelize.col('sales')), 'our_sales']
                        ],
                        where: { ...msFilter, brand: { [Op.in]: validBrandNames } },
                        group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01')],
                        raw: true
                    }),
                    // Denominator: Total sales per month
                    RbBrandMs.findAll({
                        attributes: [
                            [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01'), 'month_date'],
                            [Sequelize.fn('SUM', Sequelize.col('sales')), 'total_sales']
                        ],
                        where: msFilter,
                        group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01')],
                        raw: true
                    })
                ]);

                // Create map for numerator
                const numMap = new Map(numeratorData.map(r => [r.month_date, parseFloat(r.our_sales || 0)]));

                // Calculate MS for each month
                return denominatorData.map(r => {
                    const ourSales = numMap.get(r.month_date) || 0;
                    const totalSales = parseFloat(r.total_sales || 0);
                    return {
                        month_date: r.month_date,
                        avg_market_share: totalSales > 0 ? (ourSales / totalSales) * 100 : 0
                    };
                });
            })(),
            // Total Market Share Average (calculated)
            (async () => {
                // Get valid brands (comp_flag = 0)
                const validBrands = await RcaSkuDim.findAll({
                    attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
                    where: { comp_flag: 0 },
                    raw: true
                });
                const validBrandNames = validBrands.map(b => b.brand_name).filter(Boolean);

                const msFilter = {
                    created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                    sales: { [Op.ne]: null },
                    ...(platform && platform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase()) }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
                };

                const [ourSalesResult, totalSalesResult] = await Promise.all([
                    RbBrandMs.findOne({
                        attributes: [[Sequelize.fn('SUM', Sequelize.col('sales')), 'our_sales']],
                        where: { ...msFilter, brand: { [Op.in]: validBrandNames } },
                        raw: true
                    }),
                    RbBrandMs.findOne({
                        attributes: [[Sequelize.fn('SUM', Sequelize.col('sales')), 'total_sales']],
                        where: msFilter,
                        raw: true
                    })
                ]);

                const ourSales = parseFloat(ourSalesResult?.our_sales || 0);
                const totalSales = parseFloat(totalSalesResult?.total_sales || 0);
                const avgMs = totalSales > 0 ? (ourSales / totalSales) * 100 : 0;

                return {
                    avg_market_share: avgMs,
                    count: 1,
                    min_val: avgMs,
                    max_val: avgMs
                };
            })(),
            // 3. Top SKUs by GMV (Using rb_sku_platform.sku_name instead of Product)
            (async () => {
                try {
                    // Build WHERE conditions for the SQL query
                    let whereConditions = [];
                    let replacements = {};

                    // Date filter
                    if (offtakeWhereClause.DATE) {
                        whereConditions.push('olap.DATE BETWEEN :dateFrom AND :dateTo');
                        replacements.dateFrom = offtakeWhereClause.DATE[Op.between][0];
                        replacements.dateTo = offtakeWhereClause.DATE[Op.between][1];
                    }

                    // Brand filter - use brand_name from rb_sku_platform
                    if (brand && brand !== 'All') {
                        whereConditions.push('sku.brand_name = :brand');
                        replacements.brand = brand;
                    }

                    // Location filter (case-insensitive)
                    if (location && location !== 'All') {
                        whereConditions.push('LOWER(olap.Location) = :location');
                        replacements.location = location.toLowerCase();
                    }

                    // Platform filter (case-insensitive)
                    if (selectedPlatform && selectedPlatform !== 'All') {
                        whereConditions.push('LOWER(olap.Platform) = :platform');
                        replacements.platform = selectedPlatform.toLowerCase();
                    }

                    // Category filter (case-insensitive)
                    if (category && category !== 'All') {
                        whereConditions.push('LOWER(olap.Category) = :category');
                        replacements.category = category.toLowerCase();
                    }

                    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

                    // Use raw SQL to join with rb_sku_platform
                    const query = `
                        SELECT 
                            sku.sku_name AS sku_name,
                            SUM(olap.Sales) AS sku_gmv
                        FROM rb_pdp_olap AS olap
                        INNER JOIN rb_sku_platform AS sku ON olap.Web_Pid = sku.web_pid
                        ${whereClause}
                        GROUP BY sku.sku_name
                        ORDER BY sku_gmv DESC
                        LIMIT 10
                    `;

                    const results = await sequelize.query(query, {
                        replacements,
                        type: sequelize.QueryTypes.SELECT
                    });

                    return results;
                } catch (error) {
                    console.error('Error fetching top SKUs:', error);
                    return [];
                }
            })(),
            // 4. Current Availability
            getAvailability(startDate, endDate, brand, selectedPlatform, location, category),
            // 5. Previous Availability (if compare dates exist)
            (filters.compareStartDate && filters.compareEndDate)
                ? getAvailability(dayjs(filters.compareStartDate), dayjs(filters.compareEndDate), brand, selectedPlatform, location, category)
                : Promise.resolve(0),
            // 6. Current Share of Search
            getShareOfSearch(startDate, endDate, brand, selectedPlatform, location, category),
            // 7. Previous Share of Search
            (filters.compareStartDate && filters.compareEndDate)
                ? getShareOfSearch(dayjs(filters.compareStartDate), dayjs(filters.compareEndDate), brand, selectedPlatform, location, category)
                : Promise.resolve(0),
            // 8. Availability Trend Data (Monthly)
            RbPdpOlap.findAll({
                attributes: [
                    [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01'), 'month_date'],
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: offtakeWhereClause, // Reusing the same where clause as Offtake (RbPdpOlap)
                group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01')],
                raw: true
            }),
            // 9. Share of Search Trend Data (Monthly) - OPTIMIZED: Single bulk query instead of N sequential queries
            (async () => {
                try {
                    // Build base where clause
                    const baseWhere = {};

                    if (category) {
                        baseWhere.keyword_category = sequelize.where(
                            sequelize.fn('LOWER', sequelize.col('keyword_category')),
                            category.toLowerCase()
                        );
                    }

                    if (location && location !== 'All') {
                        baseWhere.location_name = sequelize.where(
                            sequelize.fn('LOWER', sequelize.col('location_name')),
                            location.toLowerCase()
                        );
                    }

                    if (selectedPlatform && selectedPlatform !== 'All') {
                        baseWhere.platform_name = sequelize.where(
                            sequelize.fn('LOWER', sequelize.col('platform_name')),
                            selectedPlatform.toLowerCase()
                        );
                    }

                    // Query 1: Get numerator counts grouped by month
                    // When Brand = "All", use keyword_is_rb_product=1 for our brands
                    const numeratorWhere = {
                        ...baseWhere,
                        kw_crawl_date: {
                            [Op.between]: [startDate.toDate(), endDate.toDate()]
                        }
                    };
                    if (brand && brand !== 'All') {
                        // Specific brand selected - filter by brand name
                        numeratorWhere.brand_name = sequelize.where(
                            sequelize.fn('LOWER', sequelize.col('brand_name')),
                            brand.toLowerCase()
                        );
                    } else {
                        // "All" brands selected - use keyword_is_rb_product=1 for our brands (RB products)
                        numeratorWhere.keyword_is_rb_product = 1;
                    }

                    const [brandMonthCounts, totalMonthCounts] = await Promise.all([
                        RbKw.findAll({
                            attributes: [
                                [Sequelize.fn('DATE_FORMAT', Sequelize.col('kw_crawl_date'), '%Y-%m-01'), 'month'],
                                [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
                            ],
                            where: numeratorWhere,
                            group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('kw_crawl_date'), '%Y-%m-01')],
                            raw: true
                        }),
                        // Query 2: Get total counts grouped by month (denominator)
                        RbKw.findAll({
                            attributes: [
                                [Sequelize.fn('DATE_FORMAT', Sequelize.col('kw_crawl_date'), '%Y-%m-01'), 'month'],
                                [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
                            ],
                            where: {
                                ...baseWhere,
                                kw_crawl_date: {
                                    [Op.between]: [startDate.toDate(), endDate.toDate()]
                                }
                            },
                            group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('kw_crawl_date'), '%Y-%m-01')],
                            raw: true
                        })
                    ]);

                    // Build lookup maps for O(1) access
                    const brandCountMap = new Map(
                        brandMonthCounts.map(r => [r.month, parseInt(r.count)])
                    );
                    const totalCountMap = new Map(
                        totalMonthCounts.map(r => [r.month, parseInt(r.count)])
                    );

                    // Calculate SOS for each month bucket
                    return monthBuckets.map(bucket => {
                        const monthKey = dayjs(bucket.date).format('YYYY-MM-01');
                        const brandCount = brandCountMap.get(monthKey) || 0;
                        const totalCount = totalCountMap.get(monthKey) || 0;
                        const sosValue = totalCount > 0 ? (brandCount / totalCount) * 100 : 0;

                        return { month_date: bucket.date, value: sosValue };
                    });
                } catch (error) {
                    console.error('Error calculating bulk SOS trend:', error);
                    // Return zero values for all months on error
                    return monthBuckets.map(bucket => ({ month_date: bucket.date, value: 0 }));
                }
            })(),
            // 10. Previous Offtake (Total Sales) - Always use rb_pdp_olap Sales column
            (filters.compareStartDate && filters.compareEndDate)
                ? RbPdpOlap.sum('Sales', {
                    where: {
                        DATE: { [Op.between]: [dayjs(filters.compareStartDate).toDate(), dayjs(filters.compareEndDate).toDate()] },
                        ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
                        ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                        ...(category && category !== 'All' && { Category: sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase()) }),
                        ...(selectedPlatform && selectedPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), selectedPlatform.toLowerCase()) })
                    }
                })
                : Promise.resolve(0),
            // 11. Previous Market Share
            (filters.compareStartDate && filters.compareEndDate)
                ? RbBrandMs.findOne({
                    attributes: [[Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                    where: {
                        created_on: { [Op.between]: [dayjs(filters.compareStartDate).toDate(), dayjs(filters.compareEndDate).toDate()] },
                        ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                        ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
                        // Note: rb_brand_ms table does NOT have Platform column
                    },
                    raw: true
                })
                : Promise.resolve(null)
        ]);

        // Process Offtake Data
        const offtakeChart = monthBuckets.map(bucket => {
            const match = offtakeData.find(d => {
                return dayjs(d.month_date).isSame(dayjs(bucket.date), 'month');
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

        // Process Market Share Data
        const marketShareChart = monthBuckets.map(bucket => {
            const match = marketShareData.find(d => dayjs(d.month_date).isSame(dayjs(bucket.date), 'month'));
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

        // Process Availability Chart
        const availabilityChart = monthBuckets.map(bucket => {
            const match = availabilityTrendData.find(d => dayjs(d.month_date).isSame(dayjs(bucket.date), 'month'));
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

        // Process Share of Search Chart
        const shareOfSearchChart = monthBuckets.map(bucket => {
            const match = shareOfSearchTrendData.find(d => dayjs(d.month_date).isSame(dayjs(bucket.date), 'month'));
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

        // Prepare Top Metrics Array (Cards with Charts)
        const chartLabels = monthBuckets.map(b => b.label);

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
                    const { brand, selectedPlatform, location } = filters;

                    // Generate list of months in range
                    const months = [];
                    let current = startRange.clone().startOf('month');
                    while (current.isBefore(endRange) || current.isSame(endRange, 'month')) {
                        months.push(current.format('YYYY-MM'));
                        current = current.add(1, 'month');
                    }

                    // ===== CHECK PRE-COMPUTED MONTHLY KPI CACHE FIRST =====
                    const cachedData = await getCachedMonthlyKPIs(selectedPlatform, months, brand, location);
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
                    if (brand && brand !== 'All' && selectedPlatform && selectedPlatform !== 'All') {
                        const brandPreAggData = await getBrandMonthlyData(selectedPlatform, brand, months);
                        if (brandPreAggData && brandPreAggData.size > 0) {
                            // Cache this result for future requests
                            const monthDataMap = new Map();
                            for (const [monthKey, data] of brandPreAggData) {
                                const month = monthKey.substring(0, 7); // YYYY-MM-01 -> YYYY-MM
                                monthDataMap.set(month, data);
                            }
                            cacheMonthlyKPIs(selectedPlatform, monthDataMap, brand, location)
                                .catch(err => console.warn('Failed to cache monthly KPIs:', err.message));
                            return brandPreAggData;
                        }
                    }
                    // ===== END BRAND PRE-AGGREGATION CHECK =====

                    // Cache miss - compute aggregations (FALLBACK)
                    let dataByMonth = new Map();

                    // Try Redis raw data first
                    const redisResult = await getRowsFromRedisOrDb(selectedPlatform, {
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
                            data.orders += parseFloat(row.Ad_Orders || 0);
                            data.clicks += parseFloat(row.Ad_Clicks || 0);
                            data.impressions += parseFloat(row.Ad_Impressions || 0);
                            data.spend += parseFloat(row.Ad_Spend || 0);
                        });

                        console.log(`📊 [Redis] Aggregated ${redisResult.rows.length} rows into ${dataByMonth.size} months`);
                    } else {
                        // Fallback to database query
                        const where = {
                            DATE: { [Op.between]: [startRange.toDate(), endRange.toDate()] },
                            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                            ...(selectedPlatform && selectedPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), selectedPlatform.toLowerCase()) })
                        };
                        // FIXED: When brand is "All", only include OUR brands (Comp_flag = 0)
                        if (brand && brand !== 'All') {
                            where.Brand = { [Op.like]: `%${brand}%` };
                        } else {
                            where.Comp_flag = 0;  // Our brands only when "All" selected
                        }

                        const results = await RbPdpOlap.findAll({
                            attributes: [
                                [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01'), 'month'],
                                [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                                [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                                [Sequelize.fn('SUM', Sequelize.col('Ad_Orders')), 'total_orders'],
                                [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                                [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions'],
                                [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend']
                            ],
                            where,
                            group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01')],
                            order: [[Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01'), 'ASC']],
                            raw: true
                        });

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
                    cacheMonthlyKPIs(selectedPlatform, monthDataMap, brand, location)
                        .catch(err => console.warn('Failed to cache monthly KPIs:', err.message));
                    // ===== END CACHE STORAGE =====

                    return dataByMonth;
                };

                // Fetch ALL months data in ONE query (current + MoM + last 7 months)
                const timerLabel = `[Performance KPIs] Bulk GROUP BY Fetch ${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                console.time(timerLabel);

                const earliestDate = last7Months[0].start;

                // Generate unique key for this specific computation
                const coalesceKey = `perf-kpi:${selectedPlatform}:${earliestDate.format('YYYY-MM')}:${endDate.format('YYYY-MM')}:${brand}:${location}`;

                // Use coalesceRequest to prevent cache stampede
                let bulkData;
                try {
                    bulkData = await coalesceRequest(coalesceKey, async () =>
                        await getBulkPerformanceMetrics(earliestDate, endDate, { brand, selectedPlatform, location })
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
                    return data.orders > 0 ? data.clicks / data.orders : 0; // Clicks / Orders
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
                const momSosKpi = await getShareOfSearch(momStartDate, momEndDate, brand, selectedPlatform, location, category);
                const sosKpiChange = momSosKpi > 0 ? ((currentSosKpi - momSosKpi) / momSosKpi) * 100 : (currentSosKpi > 0 ? 100 : 0);

                let sosTrendKpiData;
                try {
                    sosTrendKpiData = await Promise.all(last7Months.map(async (m) => {
                        const val = await getShareOfSearch(m.start, m.end, brand, selectedPlatform, location, category);
                        return val;
                    }));
                } catch (err) {
                    console.error('[SOS Trend] Error:', err.message);
                    sosTrendKpiData = Array(7).fill(0);
                }

                // OSA KPI (uses availability data already computed)
                const currentOsa = currentAvailability;
                const momOsa = prevAvailability;
                const osaAbsChange = currentOsa - momOsa;

                let osaTrendData;
                try {
                    osaTrendData = await Promise.all(last7Months.map(async (m) => {
                        const val = await getAvailability(m.start, m.end, brand, selectedPlatform, location, category);
                        return val;
                    }));
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
                // Fetch platforms from rca_sku_dim table
                const platformsFromDb = await RcaSkuDim.findAll({
                    attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('platform')), 'platform']],
                    where: {
                        platform: { [Op.ne]: null }  // Exclude null platforms
                    },
                    raw: true
                });

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
            // Base where clause for current period
            const allOfftakeWhere = {
                DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
            };
            // FIXED: When brand is "All", only include OUR brands (Comp_flag = 0)
            if (brand && brand !== 'All') {
                allOfftakeWhere.Brand = { [Op.like]: `%${brand}%` };
            } else {
                allOfftakeWhere.Comp_flag = 0;  // Our brands only when "All" selected
            }
            if (location && location !== 'All') allOfftakeWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
            if (category && category !== 'All') allOfftakeWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());
            // Intentionally NOT filtering by Platform here to get the "All Platforms" total

            // Base where clause for previous period (same filters, different dates)
            const prevAllOfftakeWhere = {
                DATE: { [Op.between]: [allMomStart.toDate(), allMomEnd.toDate()] }
            };
            if (brand && brand !== 'All') {
                prevAllOfftakeWhere.Brand = { [Op.like]: `%${brand}%` };
            } else {
                prevAllOfftakeWhere.Comp_flag = 0;
            }
            if (location && location !== 'All') prevAllOfftakeWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
            if (category && category !== 'All') prevAllOfftakeWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());

            // Fetch current and previous period metrics in parallel
            const [allMetricsResult, prevAllMetricsResult] = await Promise.all([
                RbPdpOlap.findOne({
                    attributes: [
                        [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions']
                    ],
                    where: allOfftakeWhere,
                    raw: true
                }),
                RbPdpOlap.findOne({
                    attributes: [
                        [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions']
                    ],
                    where: prevAllOfftakeWhere,
                    raw: true
                })
            ]);

            // Current period values
            allOfftake = parseFloat(allMetricsResult?.total_sales || 0);
            allSpend = parseFloat(allMetricsResult?.total_spend || 0);
            allAdSales = parseFloat(allMetricsResult?.total_ad_sales || 0);
            const allClicks = parseFloat(allMetricsResult?.total_clicks || 0);
            const allImpressions = parseFloat(allMetricsResult?.total_impressions || 0);

            // Previous period values
            prevAllOfftake = parseFloat(prevAllMetricsResult?.total_sales || 0);
            prevAllSpend = parseFloat(prevAllMetricsResult?.total_spend || 0);
            prevAllAdSales = parseFloat(prevAllMetricsResult?.total_ad_sales || 0);
            const prevAllClicks = parseFloat(prevAllMetricsResult?.total_clicks || 0);
            const prevAllImpressions = parseFloat(prevAllMetricsResult?.total_impressions || 0);

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

            // 4. All Market Share (current and previous in parallel)
            const [allMsResult, prevAllMsResult] = await Promise.all([
                RbBrandMs.findOne({
                    attributes: [[Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                    where: {
                        created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                        ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                        ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                        ...(category && category !== 'All' && { category: sequelize.where(sequelize.fn('LOWER', sequelize.col('category')), category.toLowerCase()) })
                    },
                    raw: true
                }),
                RbBrandMs.findOne({
                    attributes: [[Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                    where: {
                        created_on: { [Op.between]: [allMomStart.toDate(), allMomEnd.toDate()] },
                        ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                        ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                        ...(category && category !== 'All' && { category: sequelize.where(sequelize.fn('LOWER', sequelize.col('category')), category.toLowerCase()) })
                    },
                    raw: true
                })
            ]);
            allMarketShare = parseFloat(allMsResult?.avg_ms || 0);
            prevAllMarketShare = parseFloat(prevAllMsResult?.avg_ms || 0);

            // Calculate Promo My Brand for "All" platforms (Comp_flag = 0)
            if (brand && brand !== 'All') {
                const allPromoMyBrandWhere = {
                    DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                    Brand: { [Op.like]: `%${brand}%` },
                    Comp_flag: 0
                };
                if (location && location !== 'All') allPromoMyBrandWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
                if (category && category !== 'All') allPromoMyBrandWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());

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
            if (location && location !== 'All') allPromoCompeteWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
            if (category && category !== 'All') allPromoCompeteWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());
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
                    Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), p.label.toLowerCase())
                };
                if (brand && brand !== 'All') platformOfftakeWhere.Brand = { [Op.like]: `%${brand}%` };
                if (location && location !== 'All') platformOfftakeWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
                if (category && category !== 'All') platformOfftakeWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());

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
                            Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), p.label.toLowerCase()),
                            Comp_flag: 1,
                            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                            ...(category && category !== 'All' && { Category: sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase()) }),
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
        // Priority: monthOverviewPlatform > selectedPlatform > first available platform
        const moPlatform = filters.monthOverviewPlatform ||
            (selectedPlatform && selectedPlatform !== 'All' ? selectedPlatform : null);

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

        const monthOverviewPromises = monthBuckets.map(async (bucket) => {
            try {
                // Skip if no specific platform is selected
                if (!moPlatform) {
                    return {
                        key: bucket.label,
                        label: bucket.label,
                        type: bucket.label,
                        logo: "",
                        columns: generateMonthColumns(0, 0, 0, 0)
                    };
                }

                const mStart = dayjs(bucket.date).startOf('month');
                const mEnd = dayjs(bucket.date).endOf('month');

                // Offtake
                const moOfftakeWhere = {
                    DATE: { [Op.between]: [mStart.toDate(), mEnd.toDate()] },
                    Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), moPlatform.toLowerCase())
                };
                if (brand && brand !== 'All') moOfftakeWhere.Brand = { [Op.like]: `%${brand}%` };
                if (location && location !== 'All') moOfftakeWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
                if (category && category !== 'All') moOfftakeWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());

                const moOfftakeResult = await RbPdpOlap.findOne({
                    attributes: [
                        [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions']
                    ],
                    where: moOfftakeWhere,
                    raw: true
                });
                const moOfftake = parseFloat(moOfftakeResult?.total_sales || 0);
                const moSpend = parseFloat(moOfftakeResult?.total_spend || 0);
                const moAdSales = parseFloat(moOfftakeResult?.total_ad_sales || 0);
                const moClicks = parseFloat(moOfftakeResult?.total_clicks || 0);
                const moImpressions = parseFloat(moOfftakeResult?.total_impressions || 0);

                // Calculate Metrics
                const moRoas = moSpend > 0 ? moAdSales / moSpend : 0;
                const moConversion = moImpressions > 0 ? (moClicks / moImpressions) * 100 : 0;
                const moCpm = moImpressions > 0 ? (moSpend / moImpressions) * 1000 : 0;
                const moCpc = moClicks > 0 ? moSpend / moClicks : 0;

                // Availability
                const moAvailability = await getAvailability(mStart, mEnd, brand, moPlatform, location);

                // SOS
                const moSos = await getShareOfSearch(mStart, mEnd, brand, moPlatform, location, category);

                // Market Share
                let moMarketShare = 0;
                const moMsResult = await RbBrandMs.findOne({
                    attributes: [[Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                    where: {
                        created_on: { [Op.between]: [mStart.toDate(), mEnd.toDate()] },
                        Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), moPlatform.toLowerCase()),
                        ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                        ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
                    },
                    raw: true
                });
                moMarketShare = parseFloat(moMsResult?.avg_ms || 0);

                return {
                    key: bucket.label,
                    label: bucket.label, // e.g. "Nov"
                    date: bucket.date,   // Add date for frontend context
                    type: bucket.label,  // Reuse label as type for UI consistency
                    logo: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png", // Generic calendar icon
                    columns: generateMonthColumns(moOfftake, moAvailability, moSos, moMarketShare, moSpend, moRoas, moAdSales, moConversion, moCpm, moCpc)
                };

            } catch (err) {
                console.error(`Error calculating Month Overview for ${bucket.label}:`, err);
                return {
                    key: bucket.label,
                    label: bucket.label,
                    type: bucket.label,
                    logo: "",
                    columns: generateMonthColumns(0, 0, 0, 0)
                };
            }
        });

        const monthOverview = await Promise.all(monthOverviewPromises);
        // monthOverview.push(...monthOverviewResults); // Removed push to undefined variable

        // 13. Category Overview Logic
        const categoryOverviewPlatform = filters.categoryOverviewPlatform || filters.platform || 'Zepto';

        // Fetch unique categories based on filters from RcaSkuDim (status=1 only)
        const categoryWhere = { status: 1 };

        if (categoryOverviewPlatform && categoryOverviewPlatform !== 'All') {
            categoryWhere.platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('platform')), categoryOverviewPlatform.toLowerCase());
        }
        if (brand && brand !== 'All') {
            categoryWhere.brand_name = { [Op.like]: `%${brand}%` };
        }
        // Note: RcaSkuDim might not have location, or it might be 'location' column. 
        // Assuming location filter is not strictly needed for category listing, or we check if column exists.
        // Based on model, it has 'location'.
        if (location && location !== 'All') {
            categoryWhere.location = sequelize.where(sequelize.fn('LOWER', sequelize.col('location')), location.toLowerCase());
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
                    Category: sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), catName.toLowerCase())
                };

                // Apply brand filter
                if (brand && brand !== 'All') {
                    catWhere.Brand = { [Op.like]: `%${brand}%` };
                } else {
                    catWhere.Comp_flag = 0; // Our brands only when "All" selected
                }

                // Apply location filter
                if (location && location !== 'All') {
                    catWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
                }

                // Apply Platform filter from categoryOverviewPlatform (not selectedPlatform)
                if (categoryOverviewPlatform && categoryOverviewPlatform !== 'All') {
                    catWhere.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), categoryOverviewPlatform.toLowerCase());
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
                                Category: sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), catName.toLowerCase()),
                                Comp_flag: 0,
                                ...(categoryOverviewPlatform && categoryOverviewPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), categoryOverviewPlatform.toLowerCase()) }),
                                ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
                                ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
                            },
                            raw: true
                        }),
                        // Total category sales (all brands, both Comp_flag 0 and 1)
                        RbPdpOlap.findOne({
                            attributes: [[Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']],
                            where: {
                                DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                                Category: sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), catName.toLowerCase()),
                                ...(categoryOverviewPlatform && categoryOverviewPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), categoryOverviewPlatform.toLowerCase()) }),
                                ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
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
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), brandsOverviewPlatform.toLowerCase()) }),
            ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { Category: sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), brandsOverviewCategory.toLowerCase()) }),
            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
        };

        const boPrevStartDate = startDate.clone().subtract(1, 'month');
        const boPrevEndDate = endDate.clone().subtract(1, 'month');

        const boPrevOfftakeWhere = {
            DATE: { [Op.between]: [boPrevStartDate.toDate(), boPrevEndDate.toDate()] },
            Comp_flag: 0, // Only our brands
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), brandsOverviewPlatform.toLowerCase()) }),
            ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { Category: sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), brandsOverviewCategory.toLowerCase()) }),
            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
        };


        const boMsWhere = {
            created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), brandsOverviewPlatform.toLowerCase()) }),
            ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { category: sequelize.where(sequelize.fn('LOWER', sequelize.col('category')), brandsOverviewCategory.toLowerCase()) }),
            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
        };

        const boPrevMsWhere = {
            created_on: { [Op.between]: [boPrevStartDate.toDate(), boPrevEndDate.toDate()] },
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), brandsOverviewPlatform.toLowerCase()) }),
            ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { category: brandsOverviewCategory }),
            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
        };

        const rcaBrandWhere = {
            comp_flag: 0  // FIXED: Only show OUR brands, not competitors
        };
        if (brandsOverviewPlatform && brandsOverviewPlatform !== 'All') {
            rcaBrandWhere.platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('platform')), brandsOverviewPlatform.toLowerCase());
        }
        if (brandsOverviewCategory && brandsOverviewCategory !== 'All') {
            rcaBrandWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), brandsOverviewCategory.toLowerCase());
        }



        // 1. Offtake Current (Conditional Logic)
        let boOfftakePromise;
        const lowerPlatform = (brandsOverviewPlatform || '').toLowerCase();

        if (lowerPlatform === 'zepto') {
            const zeptoWhere = {
                sales_date: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { sku_category: sequelize.where(sequelize.fn('LOWER', sequelize.col('sku_category')), brandsOverviewCategory.toLowerCase()) }),
                ...(location && location !== 'All' && { city: sequelize.where(sequelize.fn('LOWER', sequelize.col('city')), location.toLowerCase()) })
            };
            // Use rb_pdp_olap Sales column for Zepto (same as other platforms)
            boOfftakePromise = RbPdpOlap.findAll({
                attributes: [
                    'Brand',
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Orders')), 'total_ad_orders'],
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
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                    ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { Category: sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), brandsOverviewCategory.toLowerCase()) })
                },
                group: ['Brand'],
                raw: true
            });
        } else if (lowerPlatform === 'blinkit') {
            const blinkitWhere = {
                created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                // Removed category filter due to mismatch with RcaSkuDim categories
                ...(location && location !== 'All' && { city_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('city_name')), location.toLowerCase()) })
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
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Orders')), 'total_ad_orders'],
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
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Orders')), 'total_ad_orders'],
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
        const sosCoalesceKey = `bulk-sos:${selectedPlatform || 'All'}:${startDate.format('YYYY-MM-DD')}:${endDate.format('YYYY-MM-DD')}:${location || 'All'}:${category || 'All'}`;

        let bulkSosMap;
        try {
            bulkSosMap = await coalesceRequest(sosCoalesceKey, async () =>
                await getBulkShareOfSearch(
                    boBrands,
                    startDate, endDate,           // Current period
                    boPrevStartDate, boPrevEndDate, // Previous period
                    selectedPlatform, location, category
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
    return getCachedOrCompute('watchtower:platforms:all', async () => {
        try {
            const platforms = await RcaSkuDim.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('platform')), 'platform']],
                raw: true
            });
            return platforms.map(p => p.platform).filter(Boolean).sort();
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
            // Query RcaSkuDim for brands - this table has comp_flag to distinguish our brands from competitors
            const whereClause = {};
            if (platform && platform !== 'All') {
                whereClause.platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('platform')), platform.toLowerCase());
            }

            // If includeCompetitors is true, show all brands (for Availability Analysis)
            // Otherwise, show only our brands (comp_flag=0) for Watch Tower
            if (!includeCompetitors) {
                whereClause.comp_flag = 0;
            }

            const result = await RcaSkuDim.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
                where: {
                    ...whereClause,
                    brand_name: { [Op.ne]: null }
                },
                order: [['brand_name', 'ASC']],
                raw: true
            });

            return result.map(r => r.brand_name).filter(Boolean);
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
            const where = {};
            if (brand) {
                where.brand_name = brand;
            }

            const keywords = await RbKw.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('keyword')), 'keyword']],
                where: where,
                raw: true
            });
            return keywords.map(k => k.keyword).filter(Boolean).sort();
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
            const where = {};
            if (platform && platform !== 'All') {
                where.platform = platform;
            }
            if (brand && brand !== 'All') {
                where.brand_name = brand;
            }
            // If includeCompetitors is false, only show locations with our brands (comp_flag=0)
            if (!includeCompetitors) {
                where.comp_flag = 0;
            }

            const result = await RcaSkuDim.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('location')), 'location']],
                where: where,
                order: [['location', 'ASC']],
                raw: true
            });
            return result.map(l => l.location).filter(Boolean);
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
// Internal implementation with all the compute logic
const computeTrendData = async (filters) => {
    try {
        const { brand, location, platform, period, timeStep, category, startDate: customStart, endDate: customEnd } = filters;

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
                default: startDate = startDate.subtract(3, 'month'); // Default 3M
            }
        }

        console.log(`computeTrendData: period=${period}, start=${startDate.format()}, end=${endDate.format()}`);

        // 2. Determine Grouping
        let groupCol;
        let groupColMs; // For RbBrandMs
        let groupColKw; // For RbKw
        let dateFormat;

        if (timeStep === 'Monthly') {
            groupCol = sequelize.fn('DATE_FORMAT', sequelize.col('DATE'), '%Y-%m-01');
            groupColMs = sequelize.fn('DATE_FORMAT', sequelize.col('created_on'), '%Y-%m-01');
            groupColKw = sequelize.fn('DATE_FORMAT', sequelize.col('kw_crawl_date'), '%Y-%m-01');
            dateFormat = 'MMM YY';
        } else if (timeStep === 'Weekly') {
            // MySQL YEARWEEK mode 1 (Monday first)
            groupCol = sequelize.fn('YEARWEEK', sequelize.col('DATE'), 1);
            groupColMs = sequelize.fn('YEARWEEK', sequelize.col('created_on'), 1);
            groupColKw = sequelize.fn('YEARWEEK', sequelize.col('kw_crawl_date'), 1);
            dateFormat = 'Week';
        } else { // Daily
            // Use simple column reference for Daily grouping as verified by debug script
            groupCol = sequelize.col('DATE');
            groupColMs = sequelize.col('created_on');
            groupColKw = sequelize.col('kw_crawl_date');
            dateFormat = 'DD MMM';
        }

        // 3. Query Data - Offtake, OSA, Discount
        const whereClause = {
            DATE: {
                [Op.between]: [
                    sequelize.literal(`'${startDate.format('YYYY-MM-DD')}'`),
                    sequelize.literal(`'${endDate.format('YYYY-MM-DD')}'`)
                ]
            },
            ...(category && { Category: category }),
            ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
            ...(platform && platform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase()) })
        };

        const trendResults = await RbPdpOlap.findAll({
            attributes: [
                [groupCol, 'date_group'],
                [sequelize.fn('MAX', sequelize.col('DATE')), 'ref_date'], // To help formatting
                [sequelize.fn('SUM', sequelize.col('Sales')), 'offtake'],
                [sequelize.fn('SUM', sequelize.col('neno_osa')), 'total_neno'],
                [sequelize.fn('SUM', sequelize.col('deno_osa')), 'total_deno'],
                // Calculate Discount components only for valid MRP rows
                [sequelize.fn('SUM', sequelize.literal('CASE WHEN CAST(REPLACE(MRP, ",", "") AS DECIMAL(10,2)) > 0 THEN Sales ELSE 0 END')), 'sales_with_mrp'],
                [sequelize.fn('SUM', sequelize.literal('CASE WHEN CAST(REPLACE(MRP, ",", "") AS DECIMAL(10,2)) > 0 THEN CAST(REPLACE(MRP, ",", "") AS DECIMAL(10,2)) * Qty_Sold ELSE 0 END')), 'mrp_sales_valid']
            ],
            where: whereClause,
            group: [groupCol],
            order: [[sequelize.col('ref_date'), 'ASC']],
            raw: true
        });

        // 4. Query Market Share using new formula:
        // MS = (Sales of our brands) / (Total platform sales) * 100
        // Using rb_brand_ms joined with rca_sku_dim for comp_flag=0 filtering

        const msDateFilter = {
            created_on: {
                [Op.between]: [
                    sequelize.literal(`'${startDate.format('YYYY-MM-DD')}'`),
                    sequelize.literal(`'${endDate.format('YYYY-MM-DD')}'`)
                ]
            },
            sales: { [Op.ne]: null },
            ...(category && { category: category }),
            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
            ...(platform && platform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase()) })
        };

        // Get valid brands (comp_flag = 0)
        const validBrandsList = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
            where: { comp_flag: 0 },
            raw: true
        });
        const validBrandNamesForMs = validBrandsList.map(b => b.brand_name).filter(Boolean);

        // Numerator: Sales of our brands (comp_flag=0) grouped by time
        const msNumerator = await RbBrandMs.findAll({
            attributes: [
                [groupColMs, 'date_group'],
                [Sequelize.fn('SUM', Sequelize.col('sales')), 'our_sales']
            ],
            where: {
                ...msDateFilter,
                brand: { [Op.in]: validBrandNamesForMs }
            },
            group: [groupColMs],
            raw: true
        });

        // Denominator: Total platform sales grouped by time
        const msDenominator = await RbBrandMs.findAll({
            attributes: [
                [groupColMs, 'date_group'],
                [Sequelize.fn('SUM', Sequelize.col('sales')), 'total_sales']
            ],
            where: msDateFilter,
            group: [groupColMs],
            raw: true
        });

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

        // 5. Query Share of Search (SOV)
        // Numerator: Brand matches + Not Sponsored
        const sosNumWhere = {
            kw_crawl_date: {
                [Op.between]: [
                    sequelize.literal(`'${startDate.format('YYYY-MM-DD')}'`),
                    sequelize.literal(`'${endDate.format('YYYY-MM-DD')}'`)
                ]
            },
            spons_flag: { [Op.ne]: 1 },
            ...(category && { keyword_category: category }),
            ...(brand && brand !== 'All' && { brand_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), brand.toLowerCase()) }),
            ...(location && location !== 'All' && { location_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), location.toLowerCase()) }),
            ...(platform && platform !== 'All' && { platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), platform.toLowerCase()) })
        };

        const sosNumerator = await RbKw.findAll({
            attributes: [
                [groupColKw, 'date_group'],
                [sequelize.fn('COUNT', sequelize.col('keyword')), 'count']
            ],
            where: sosNumWhere,
            group: [groupColKw],
            raw: true
        });

        // Denominator: All Brands (No Brand Filter) + Not Sponsored
        const sosDenomWhere = {
            kw_crawl_date: {
                [Op.between]: [
                    sequelize.literal(`'${startDate.format('YYYY-MM-DD')}'`),
                    sequelize.literal(`'${endDate.format('YYYY-MM-DD')}'`)
                ]
            },
            spons_flag: { [Op.ne]: 1 },
            ...(category && { keyword_category: category }),
            ...(location && location !== 'All' && { location_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), location.toLowerCase()) }),
            ...(platform && platform !== 'All' && { platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), platform.toLowerCase()) })
        };

        const sosDenominator = await RbKw.findAll({
            attributes: [
                [groupColKw, 'date_group'],
                [sequelize.fn('COUNT', sequelize.col('keyword')), 'count']
            ],
            where: sosDenomWhere,
            group: [groupColKw],
            raw: true
        });


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
        const where = { status: 1 }; // Only active categories (status=1)
        if (platform && platform !== 'All') {
            where.platform = platform;
        }

        const result = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Category')), 'Category']],
            where: where,
            order: [['Category', 'ASC']],
            raw: true
        });
        return result.map(c => c.Category).filter(Boolean);
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
    const cacheKey = generateCacheKey('platform_overview', filters);
    return await getCachedOrCompute(cacheKey, async () => {
        return await coalesceRequest(`compute:${cacheKey}`, async () => {
            console.log('[getPlatformOverview] Computing OPTIMIZED platform overview data...');

            const { months = 1, startDate: qStartDate, endDate: qEndDate, compareStartDate: qCompareStartDate, compareEndDate: qCompareEndDate, brand: rawBrand, location: rawLocation, category } = filters;
            const brand = rawBrand?.trim();
            const location = rawLocation?.trim();
            const monthsBack = parseInt(months, 10) || 1;

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

            // Fetch platforms from rca_sku_dim
            const cachedPlatforms = await getCachedDistinctPlatforms();
            let platformDefinitions = cachedPlatforms;

            if (!platformDefinitions) {
                const platformsFromDb = await RcaSkuDim.findAll({
                    attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('platform')), 'platform']],
                    where: { platform: { [Op.ne]: null } },
                    raw: true
                });

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

            // ===== INLINE BULK PLATFORM METRICS QUERY (moved from computeSummaryMetrics) =====
            // Current period where clause
            const currWhere = {
                DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
            };
            if (brand && brand !== 'All') {
                currWhere.Brand = { [Op.like]: `%${brand}%` };
            } else {
                currWhere.Comp_flag = 0;
            }
            if (location && location !== 'All') {
                currWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
            }
            if (category && category !== 'All') {
                currWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());
            }

            // Previous period where clause
            const prevWhere = {
                DATE: { [Op.between]: [momStart.toDate(), momEnd.toDate()] }
            };
            if (brand && brand !== 'All') {
                prevWhere.Brand = { [Op.like]: `%${brand}%` };
            } else {
                prevWhere.Comp_flag = 0;
            }
            if (location && location !== 'All') {
                prevWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
            }
            if (category && category !== 'All') {
                prevWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());
            }

            // Execute 10 queries in parallel - GROUP BY Platform (including SOS and Market Share)
            console.log('[getPlatformOverview] Executing bulk platform queries with SOS and Market Share...');

            // Build SOS where clauses for rb_kw table
            const sosBaseWhere = {
                kw_crawl_date: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
            };
            if (location && location !== 'All') {
                sosBaseWhere.location_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), location.toLowerCase());
            }
            if (category && category !== 'All') {
                sosBaseWhere.keyword_category = sequelize.where(sequelize.fn('LOWER', sequelize.col('keyword_category')), category.toLowerCase());
            }

            const sosPrevBaseWhere = {
                kw_crawl_date: { [Op.between]: [momStart.toDate(), momEnd.toDate()] }
            };
            if (location && location !== 'All') {
                sosPrevBaseWhere.location_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), location.toLowerCase());
            }
            if (category && category !== 'All') {
                sosPrevBaseWhere.keyword_category = sequelize.where(sequelize.fn('LOWER', sequelize.col('keyword_category')), category.toLowerCase());
            }

            // Build Market Share where clauses for rb_brand_ms table
            const msBaseWhere = {
                created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
            };
            if (brand && brand !== 'All') {
                msBaseWhere.brand = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase());
            }
            if (location && location !== 'All') {
                msBaseWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
            }
            if (category && category !== 'All') {
                msBaseWhere.category = sequelize.where(sequelize.fn('LOWER', sequelize.col('category')), category.toLowerCase());
            }

            const msPrevBaseWhere = {
                created_on: { [Op.between]: [momStart.toDate(), momEnd.toDate()] }
            };
            if (brand && brand !== 'All') {
                msPrevBaseWhere.brand = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase());
            }
            if (location && location !== 'All') {
                msPrevBaseWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
            }
            if (category && category !== 'All') {
                msPrevBaseWhere.category = sequelize.where(sequelize.fn('LOWER', sequelize.col('category')), category.toLowerCase());
            }

            const [currData, prevData, currSosOurBrands, currSosTotal, prevSosOurBrands, prevSosTotal, currMs, prevMs] = await Promise.all([
                // Query 1: Current period offtake metrics
                RbPdpOlap.findAll({
                    attributes: [
                        'Platform',
                        [Sequelize.fn('SUM', Sequelize.col('Sales')), 'sales'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'spend'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'ad_sales'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'clicks'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'impressions'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Orders')), 'orders'],
                        [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'neno'],
                        [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'deno']
                    ],
                    where: currWhere,
                    group: ['Platform'],
                    raw: true
                }),
                // Query 2: Previous period offtake metrics
                RbPdpOlap.findAll({
                    attributes: [
                        'Platform',
                        [Sequelize.fn('SUM', Sequelize.col('Sales')), 'sales'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'spend'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'ad_sales'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'clicks'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'impressions'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Orders')), 'orders'],
                        [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'neno'],
                        [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'deno']
                    ],
                    where: prevWhere,
                    group: ['Platform'],
                    raw: true
                }),
                // Query 3: Current SOS - Our brands count per platform (keyword_is_rb_product=1)
                RbKw.findAll({
                    attributes: [
                        'platform_name',
                        [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
                    ],
                    where: { ...sosBaseWhere, keyword_is_rb_product: 1 },
                    group: ['platform_name'],
                    raw: true
                }),
                // Query 4: Current SOS - Total count per platform
                RbKw.findAll({
                    attributes: [
                        'platform_name',
                        [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
                    ],
                    where: sosBaseWhere,
                    group: ['platform_name'],
                    raw: true
                }),
                // Query 5: Previous SOS - Our brands count per platform (keyword_is_rb_product=1)
                RbKw.findAll({
                    attributes: [
                        'platform_name',
                        [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
                    ],
                    where: { ...sosPrevBaseWhere, keyword_is_rb_product: 1 },
                    group: ['platform_name'],
                    raw: true
                }),
                // Query 6: Previous SOS - Total count per platform
                RbKw.findAll({
                    attributes: [
                        'platform_name',
                        [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
                    ],
                    where: sosPrevBaseWhere,
                    group: ['platform_name'],
                    raw: true
                }),
                // Query 7: Current Market Share per platform using new formula
                // MS = (Sales of our brands) / (Total platform sales) * 100
                (async () => {
                    // Get valid brands (comp_flag = 0)
                    const validBrands = await RcaSkuDim.findAll({
                        attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
                        where: { comp_flag: 0 },
                        raw: true
                    });
                    const validBrandNames = validBrands.map(b => b.brand_name).filter(Boolean);

                    // Get our brands sales per platform
                    const numData = await RbBrandMs.findAll({
                        attributes: ['Platform', [Sequelize.fn('SUM', Sequelize.col('sales')), 'our_sales']],
                        where: { ...msBaseWhere, brand: { [Op.in]: validBrandNames } },
                        group: ['Platform'],
                        raw: true
                    });
                    // Get total sales per platform
                    const denomData = await RbBrandMs.findAll({
                        attributes: ['Platform', [Sequelize.fn('SUM', Sequelize.col('sales')), 'total_sales']],
                        where: msBaseWhere,
                        group: ['Platform'],
                        raw: true
                    });

                    // Calculate MS per platform
                    const numMap = new Map(numData.map(r => [r.Platform?.toLowerCase(), parseFloat(r.our_sales || 0)]));
                    return denomData.map(r => {
                        const key = r.Platform?.toLowerCase();
                        const ourSales = numMap.get(key) || 0;
                        const totalSales = parseFloat(r.total_sales || 0);
                        return { Platform: r.Platform, avg_ms: totalSales > 0 ? (ourSales / totalSales) * 100 : 0 };
                    });
                })(),
                // Query 8: Previous Market Share per platform using new formula
                (async () => {
                    // Get valid brands (comp_flag = 0)
                    const validBrands = await RcaSkuDim.findAll({
                        attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
                        where: { comp_flag: 0 },
                        raw: true
                    });
                    const validBrandNames = validBrands.map(b => b.brand_name).filter(Boolean);

                    // Get our brands sales per platform (previous period)
                    const numData = await RbBrandMs.findAll({
                        attributes: ['Platform', [Sequelize.fn('SUM', Sequelize.col('sales')), 'our_sales']],
                        where: { ...msPrevBaseWhere, brand: { [Op.in]: validBrandNames } },
                        group: ['Platform'],
                        raw: true
                    });
                    // Get total sales per platform (previous period)
                    const denomData = await RbBrandMs.findAll({
                        attributes: ['Platform', [Sequelize.fn('SUM', Sequelize.col('sales')), 'total_sales']],
                        where: msPrevBaseWhere,
                        group: ['Platform'],
                        raw: true
                    });

                    // Calculate MS per platform
                    const numMap = new Map(numData.map(r => [r.Platform?.toLowerCase(), parseFloat(r.our_sales || 0)]));
                    return denomData.map(r => {
                        const key = r.Platform?.toLowerCase();
                        const ourSales = numMap.get(key) || 0;
                        const totalSales = parseFloat(r.total_sales || 0);
                        return { Platform: r.Platform, avg_ms: totalSales > 0 ? (ourSales / totalSales) * 100 : 0 };
                    });
                })()
            ]);

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
                prevOfftake, prevAvailability, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales, prevConversion, prevCpm, prevCpc, prevPromoMyBrand, prevPromoCompete) => {
                const offtakeChange = calcChange(offtake, prevOfftake);
                const spendChange = calcChange(spend, prevSpend);
                const roasChange = calcChange(roas, prevRoas);
                const inorgSalesChange = calcChange(inorgSales, prevInorgSales);
                const conversionChange = calcChange(conversion, prevConversion);
                const availabilityChange = calcPPChange(availability, prevAvailability);
                const sosChange = calcPPChange(sos, prevSos);
                const marketShareChange = calcPPChange(marketShare, prevMarketShare);
                const promoMyBrandChange = calcPPChange(promoMyBrand, prevPromoMyBrand);
                const promoCompeteChange = calcPPChange(promoCompete, prevPromoCompete);
                const cpmChange = calcChange(cpm, prevCpm);
                const cpcChange = calcChange(cpc, prevCpc);

                return [
                    { title: "Offtakes", value: formatCurrency(offtake), change: { text: formatChange(offtakeChange), positive: offtakeChange >= 0 }, meta: { units: "units", change: formatChange(offtakeChange) } },
                    { title: "Spend", value: formatCurrency(spend), change: { text: formatChange(spendChange), positive: spendChange >= 0 }, meta: { units: "₹0", change: formatChange(spendChange) } },
                    { title: "ROAS", value: `${roas.toFixed(2)}x`, change: { text: formatChange(roasChange), positive: roasChange >= 0 }, meta: { units: "₹0 return", change: formatChange(roasChange) } },
                    { title: "Inorg Sales", value: formatCurrency(inorgSales), change: { text: formatChange(inorgSalesChange), positive: inorgSalesChange >= 0 }, meta: { units: "0 units", change: formatChange(inorgSalesChange) } },
                    { title: "Conversion", value: conversion.toFixed(1), change: { text: formatChange(conversionChange), positive: conversionChange >= 0 }, meta: { units: "Clicks / Orders", change: formatChange(conversionChange) } },
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

            // "All" row - aggregate across all platforms
            const allOfftakeWhere = {
                DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
            };
            if (brand && brand !== 'All') {
                allOfftakeWhere.Brand = { [Op.like]: `%${brand}%` };
            } else {
                allOfftakeWhere.Comp_flag = 0;
            }
            if (location && location !== 'All') allOfftakeWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
            if (category && category !== 'All') allOfftakeWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());

            const allMetricsResult = await RbPdpOlap.findOne({
                attributes: [
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions'],
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: allOfftakeWhere,
                raw: true
            });

            const allOfftake = parseFloat(allMetricsResult?.total_sales || 0);
            const allSpend = parseFloat(allMetricsResult?.total_spend || 0);
            const allAdSales = parseFloat(allMetricsResult?.total_ad_sales || 0);
            const allClicks = parseFloat(allMetricsResult?.total_clicks || 0);
            const allImpressions = parseFloat(allMetricsResult?.total_impressions || 0);
            const allNeno = parseFloat(allMetricsResult?.total_neno || 0);
            const allDeno = parseFloat(allMetricsResult?.total_deno || 0);

            const allAvailability = allDeno > 0 ? (allNeno / allDeno) * 100 : 0;
            const allRoas = allSpend > 0 ? allAdSales / allSpend : 0;
            const allConversion = allImpressions > 0 ? (allClicks / allImpressions) * 100 : 0;
            const allCpm = allImpressions > 0 ? (allSpend / allImpressions) * 1000 : 0;
            const allCpc = allClicks > 0 ? allSpend / allClicks : 0;

            // Calculate overall SOS (sum across all platforms)
            let totalSosOur = 0, totalSosAll = 0;
            for (const [, count] of currSosOurMap) totalSosOur += count;
            for (const [, count] of currSosTotalMap) totalSosAll += count;
            const allSos = calcSos(totalSosOur, totalSosAll);

            // Calculate overall Market Share (average across all platforms)
            let totalMs = 0, msCount = 0;
            for (const [, ms] of currMsMap) { totalMs += ms; msCount++; }
            const allMarketShare = msCount > 0 ? totalMs / msCount : 0;

            platformOverview.push({
                key: 'all',
                label: 'All',
                type: 'Overall',
                logo: "https://cdn-icons-png.flaticon.com/512/711/711284.png",
                columns: generateColumns(allOfftake, allAvailability, allSos, allMarketShare, allSpend, allRoas, allOfftake > 0 ? (allAdSales / allOfftake) * 100 : 0, allConversion, allCpm, allCpc, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
            });

            // Process each platform from bulk data
            for (const p of platformDefinitions) {
                const metrics = bulkPlatformMap.get(p.label) || { curr: {}, prev: {} };

                const offtake = metrics.curr.sales || 0;
                const totalSpend = metrics.curr.spend || 0;
                const totalAdSales = metrics.curr.adSales || 0;
                const totalClicks = metrics.curr.clicks || 0;
                const totalImpressions = metrics.curr.impressions || 0;
                const totalOrders = metrics.curr.orders || 0;
                const marketShare = metrics.curr.ms || 0;
                const sos = metrics.curr.sos || 0;

                const availability = metrics.curr.deno > 0 ? (metrics.curr.neno / metrics.curr.deno) * 100 : 0;
                const roas = totalSpend > 0 ? totalAdSales / totalSpend : 0;
                // Conversion = Clicks / Orders (matching Performance Matrix formula)
                const conversion = totalOrders > 0 ? totalClicks / totalOrders : 0;
                const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
                const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

                // Previous period
                const prevOfftake = metrics.prev.sales || 0;
                const prevSpend = metrics.prev.spend || 0;
                const prevAdSales = metrics.prev.adSales || 0;
                const prevMarketShare = metrics.prev.ms || 0;
                const prevSos = metrics.prev.sos || 0;
                const prevImpressions = metrics.prev.impressions || 0;
                const prevClicks = metrics.prev.clicks || 0;
                const prevOrders = metrics.prev.orders || 0;
                const prevAvailability = metrics.prev.deno > 0 ? (metrics.prev.neno / metrics.prev.deno) * 100 : 0;
                const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;
                // Conversion = Clicks / Orders (matching Performance Matrix formula)
                const prevConversion = prevOrders > 0 ? prevClicks / prevOrders : 0;
                const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
                const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;

                // Use absolute Ad_Sales for Inorg Sales (matching Performance Matrix formula)
                const currInorgSales = totalAdSales;
                const prevInorgSales = prevAdSales;

                platformOverview.push({
                    key: p.key,
                    label: p.label,
                    type: p.type,
                    logo: p.logo,
                    columns: generateColumns(offtake, availability, sos, marketShare, totalSpend, roas, currInorgSales, conversion, cpm, cpc, 0, 0,
                        prevOfftake, prevAvailability, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales, prevConversion, prevCpm, prevCpc, 0, 0)
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

            const { months = 1, startDate: qStartDate, endDate: qEndDate, brand: rawBrand, location: rawLocation, category, monthOverviewPlatform } = filters;
            const brand = rawBrand?.trim();
            const location = rawLocation?.trim();
            const monthsBack = parseInt(months, 10) || 1;
            const moPlatform = monthOverviewPlatform || filters.platform || null;

            // Skip if no platform selected
            if (!moPlatform || moPlatform === 'All') {
                console.log('[getMonthOverview] No specific platform selected, returning empty');
                return [];
            }

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

            // Query all months at once with GROUP BY
            const moWhere = {
                DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), moPlatform.toLowerCase())
            };
            if (brand && brand !== 'All') moWhere.Brand = { [Op.like]: `%${brand}%` };
            else moWhere.Comp_flag = 0;
            if (location && location !== 'All') moWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
            if (category && category !== 'All') moWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());

            const monthlyData = await RbPdpOlap.findAll({
                attributes: [
                    [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01'), 'month_date'],
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions'],
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: moWhere,
                group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01')],
                raw: true
            });

            // ===== SOS Query for Month Overview =====
            const sosMonthWhere = {
                kw_crawl_date: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), moPlatform.toLowerCase())
            };
            if (category && category !== 'All') sosMonthWhere.keyword_category = category;
            if (location && location !== 'All') sosMonthWhere.location_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), location.toLowerCase());

            const [sosNumMonth, sosDenomMonth] = await Promise.all([
                RbKw.findAll({
                    attributes: [
                        [Sequelize.fn('DATE_FORMAT', Sequelize.col('kw_crawl_date'), '%Y-%m-01'), 'month_date'],
                        [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
                    ],
                    where: { ...sosMonthWhere, keyword_is_rb_product: 1 },
                    group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('kw_crawl_date'), '%Y-%m-01')],
                    raw: true
                }),
                RbKw.findAll({
                    attributes: [
                        [Sequelize.fn('DATE_FORMAT', Sequelize.col('kw_crawl_date'), '%Y-%m-01'), 'month_date'],
                        [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
                    ],
                    where: sosMonthWhere,
                    group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('kw_crawl_date'), '%Y-%m-01')],
                    raw: true
                })
            ]);
            const sosNumMonthMap = new Map(sosNumMonth.map(r => [r.month_date, parseInt(r.count) || 0]));
            const sosDenomMonthMap = new Map(sosDenomMonth.map(r => [r.month_date, parseInt(r.count) || 0]));

            // ===== Market Share Query for Month Overview =====
            const validBrandsForMonth = await RcaSkuDim.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
                where: { comp_flag: 0 },
                raw: true
            });
            const validBrandNamesForMonth = validBrandsForMonth.map(b => b.brand_name).filter(Boolean);

            const msMonthWhere = {
                created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                sales: { [Op.ne]: null },
                Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), moPlatform.toLowerCase())
            };
            if (category && category !== 'All') msMonthWhere.category = sequelize.where(sequelize.fn('LOWER', sequelize.col('category')), category.toLowerCase());
            if (location && location !== 'All') msMonthWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());

            const [msNumMonth, msDenomMonth] = await Promise.all([
                RbBrandMs.findAll({
                    attributes: [
                        [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01'), 'month_date'],
                        [Sequelize.fn('SUM', Sequelize.col('sales')), 'our_sales']
                    ],
                    where: { ...msMonthWhere, brand: { [Op.in]: validBrandNamesForMonth } },
                    group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01')],
                    raw: true
                }),
                RbBrandMs.findAll({
                    attributes: [
                        [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01'), 'month_date'],
                        [Sequelize.fn('SUM', Sequelize.col('sales')), 'total_sales']
                    ],
                    where: msMonthWhere,
                    group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01')],
                    raw: true
                })
            ]);
            const msNumMonthMap = new Map(msNumMonth.map(r => [r.month_date, parseFloat(r.our_sales || 0)]));
            const msDenomMonthMap = new Map(msDenomMonth.map(r => [r.month_date, parseFloat(r.total_sales || 0)]));

            // Build lookup map
            const dataMap = new Map(monthlyData.map(d => [d.month_date, d]));

            const generateMonthColumns = (offtake, availability, sos, marketShare, spend, roas, inorgSales, conversion, cpm, cpc) => [
                { title: "Offtakes", value: formatCurrency(offtake), meta: { units: "" } },
                { title: "Spend", value: formatCurrency(spend), meta: { units: "" } },
                { title: "ROAS", value: `${roas.toFixed(2)}x`, meta: { units: "" } },
                { title: "Inorg Sales", value: formatCurrency(inorgSales), meta: { units: "" } },
                { title: "Conversion", value: `${conversion.toFixed(1)}%`, meta: { units: "" } },
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
                const neno = parseFloat(data.total_neno || 0);
                const deno = parseFloat(data.total_deno || 0);

                const availability = deno > 0 ? (neno / deno) * 100 : 0;
                const roas = spend > 0 ? adSales / spend : 0;
                const conversion = impressions > 0 ? (clicks / impressions) * 100 : 0;
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

            const { months = 1, startDate: qStartDate, endDate: qEndDate, brand: rawBrand, location: rawLocation, categoryOverviewPlatform } = filters;
            const brand = rawBrand?.trim();
            const location = rawLocation?.trim();
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

            // Get distinct categories (only active status=1)
            const categoryWhere = { status: 1 };
            if (catPlatform && catPlatform !== 'All') {
                categoryWhere.platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('platform')), catPlatform.toLowerCase());
            }
            if (brand && brand !== 'All') categoryWhere.brand_name = { [Op.like]: `%${brand}%` };
            if (location && location !== 'All') categoryWhere.location = sequelize.where(sequelize.fn('LOWER', sequelize.col('location')), location.toLowerCase());

            const distinctCategories = await RcaSkuDim.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Category')), 'Category']],
                where: categoryWhere,
                raw: true
            });
            const categories = distinctCategories.map(c => c.Category).filter(Boolean);

            // Build where clause for bulk query
            const catWhere = {
                DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
            };
            if (catPlatform && catPlatform !== 'All') catWhere.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), catPlatform.toLowerCase());
            if (brand && brand !== 'All') catWhere.Brand = { [Op.like]: `%${brand}%` };
            else catWhere.Comp_flag = 0;
            if (location && location !== 'All') catWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());

            // Bulk query all categories at once
            const categoryData = await RbPdpOlap.findAll({
                attributes: [
                    'Category',
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions'],
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: catWhere,
                group: ['Category'],
                raw: true
            });

            // ===== SOS Query for Category Overview =====
            const sosCatWhere = {
                kw_crawl_date: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
            };
            if (catPlatform && catPlatform !== 'All') sosCatWhere.platform_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), catPlatform.toLowerCase());
            if (location && location !== 'All') sosCatWhere.location_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), location.toLowerCase());

            const [sosNumCat, sosDenomCat] = await Promise.all([
                RbKw.findAll({
                    attributes: ['keyword_category', [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']],
                    where: { ...sosCatWhere, keyword_is_rb_product: 1 },
                    group: ['keyword_category'],
                    raw: true
                }),
                RbKw.findAll({
                    attributes: ['keyword_category', [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']],
                    where: sosCatWhere,
                    group: ['keyword_category'],
                    raw: true
                })
            ]);
            const sosNumCatMap = new Map(sosNumCat.map(r => [r.keyword_category?.toLowerCase(), parseInt(r.count) || 0]));
            const sosDenomCatMap = new Map(sosDenomCat.map(r => [r.keyword_category?.toLowerCase(), parseInt(r.count) || 0]));

            // ===== Market Share Query for Category Overview =====
            const validBrandsForCat = await RcaSkuDim.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
                where: { comp_flag: 0 },
                raw: true
            });
            const validBrandNamesForCat = validBrandsForCat.map(b => b.brand_name).filter(Boolean);

            const msCatWhere = {
                created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                sales: { [Op.ne]: null }
            };
            if (catPlatform && catPlatform !== 'All') msCatWhere.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), catPlatform.toLowerCase());
            if (location && location !== 'All') msCatWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());

            const [msNumCat, msDenomCat] = await Promise.all([
                RbBrandMs.findAll({
                    attributes: ['category', [Sequelize.fn('SUM', Sequelize.col('sales')), 'our_sales']],
                    where: { ...msCatWhere, brand: { [Op.in]: validBrandNamesForCat } },
                    group: ['category'],
                    raw: true
                }),
                RbBrandMs.findAll({
                    attributes: ['category', [Sequelize.fn('SUM', Sequelize.col('sales')), 'total_sales']],
                    where: msCatWhere,
                    group: ['category'],
                    raw: true
                })
            ]);
            const msNumCatMap = new Map(msNumCat.map(r => [r.category?.toLowerCase(), parseFloat(r.our_sales || 0)]));
            const msDenomCatMap = new Map(msDenomCat.map(r => [r.category?.toLowerCase(), parseFloat(r.total_sales || 0)]));

            // Build lookup map
            const dataMap = new Map(categoryData.map(d => [d.Category, d]));

            const categoryOverview = categories.map(catName => {
                const data = dataMap.get(catName) || {};

                const offtake = parseFloat(data.total_sales || 0);
                const spend = parseFloat(data.total_spend || 0);
                const adSales = parseFloat(data.total_ad_sales || 0);
                const clicks = parseFloat(data.total_clicks || 0);
                const impressions = parseFloat(data.total_impressions || 0);
                const neno = parseFloat(data.total_neno || 0);
                const deno = parseFloat(data.total_deno || 0);

                const availability = deno > 0 ? (neno / deno) * 100 : 0;
                const roas = spend > 0 ? adSales / spend : 0;
                const conversion = impressions > 0 ? (clicks / impressions) * 100 : 0;
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
                        { title: "Offtakes", value: formatCurrency(offtake), meta: { units: "units" } },
                        { title: "Spend", value: formatCurrency(spend), meta: { units: "currency" } },
                        { title: "ROAS", value: `${roas.toFixed(1)}x`, meta: { units: "return" } },
                        { title: "Inorg Sales", value: offtake > 0 ? `${((adSales / offtake) * 100).toFixed(1)}%` : "0%", meta: { units: formatCurrency(adSales) } },
                        { title: "Conversion", value: `${conversion.toFixed(1)}%`, meta: { units: "conversions" } },
                        { title: "Availability", value: `${availability.toFixed(1)}%`, meta: { units: "stores" } },
                        { title: "SOS", value: `${sos.toFixed(1)}%`, meta: { units: "index" } },
                        { title: "Market Share", value: `${marketShare.toFixed(1)}%`, meta: { units: "share" } },
                        { title: "Promo My Brand", value: "0%", meta: { units: "depth" } },
                        { title: "Promo Compete", value: "0%", meta: { units: "depth" } },
                        { title: "CPM", value: formatCurrency(cpm), meta: { units: "impressions" } },
                        { title: "CPC", value: formatCurrency(cpc), meta: { units: "clicks" } }
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

            const { months = 1, startDate: qStartDate, endDate: qEndDate, brand: rawBrand, location: rawLocation, brandsOverviewPlatform, brandsOverviewCategory } = filters;
            const brand = rawBrand?.trim();
            const location = rawLocation?.trim();
            const monthsBack = parseInt(months, 10) || 1;
            const boPlatform = brandsOverviewPlatform || filters.platform || 'All';
            const boCategory = brandsOverviewCategory || 'All';

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

            // Get distinct brands from rca_sku_dim
            const rcaBrandWhere = { comp_flag: 0 };
            if (boPlatform && boPlatform !== 'All') {
                rcaBrandWhere.platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('platform')), boPlatform.toLowerCase());
            }
            if (boCategory && boCategory !== 'All') {
                rcaBrandWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), boCategory.toLowerCase());
            }

            const brandsData = await RcaSkuDim.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
                where: rcaBrandWhere,
                raw: true
            });
            const brands = brandsData.map(d => d.brand_name).filter(Boolean);

            // Build where clause for bulk query
            const boWhere = {
                DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                Comp_flag: 0 // Only our brands
            };
            if (boPlatform && boPlatform !== 'All') boWhere.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), boPlatform.toLowerCase());
            if (boCategory && boCategory !== 'All') boWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), boCategory.toLowerCase());
            if (location && location !== 'All') boWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());

            // 2. Fetch Market Share using rb_brand_ms table
            // Formula: Market Share = (Sales of our brands) / (Total platform sales) * 100
            // Using rb_brand_ms joined with rca_sku_dim for comp_flag=0 filtering

            // Build where clause for rb_brand_ms
            const msWhere = {
                created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                sales: { [Op.ne]: null }
            };
            if (boPlatform && boPlatform !== 'All') {
                msWhere.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), boPlatform.toLowerCase());
            }
            if (boCategory && boCategory !== 'All') {
                msWhere.category = sequelize.where(sequelize.fn('LOWER', sequelize.col('category')), boCategory.toLowerCase());
            }
            if (location && location !== 'All') {
                msWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
            }

            // Get total platform sales (Denominator) - ALL brands from rb_brand_ms
            const totalPlatformData = await RbBrandMs.findOne({
                attributes: [[Sequelize.fn('SUM', Sequelize.col('sales')), 'total_sales']],
                where: msWhere,
                raw: true
            });
            const totalPlatformSales = parseFloat(totalPlatformData?.total_sales || 0);

            // Get valid brands (comp_flag = 0) from cached function
            const validBrandNames = await getCachedValidBrandNames();

            // Get our brands sales per brand (Numerator) - brands that exist in valid_brands
            const ourBrandsSales = await RbBrandMs.findAll({
                attributes: [
                    'brand',
                    [Sequelize.fn('SUM', Sequelize.col('sales')), 'brand_sales']
                ],
                where: {
                    ...msWhere,
                    brand: { [Op.in]: validBrandNames }
                },
                group: ['brand'],
                raw: true
            });

            // Create map of brand -> sales for MS calculation
            const brandMsSalesMap = new Map(ourBrandsSales.map(b => [b.brand?.toLowerCase(), parseFloat(b.brand_sales || 0)]));
            const totalMarketSales = totalPlatformSales; // For compatibility with existing code

            // ===== SOS Query for Brands Overview =====
            const sosBrandWhere = {
                kw_crawl_date: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
            };
            if (boPlatform && boPlatform !== 'All') sosBrandWhere.platform_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), boPlatform.toLowerCase());
            if (location && location !== 'All') sosBrandWhere.location_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), location.toLowerCase());
            if (boCategory && boCategory !== 'All') sosBrandWhere.keyword_category = boCategory;

            const [sosNumBrand, sosDenomBrand] = await Promise.all([
                RbKw.findAll({
                    attributes: ['brand_name', [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']],
                    where: { ...sosBrandWhere, keyword_is_rb_product: 1 },
                    group: ['brand_name'],
                    raw: true
                }),
                RbKw.findAll({
                    attributes: ['brand_name', [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']],
                    where: sosBrandWhere,
                    group: ['brand_name'],
                    raw: true
                })
            ]);
            const sosNumBrandMap = new Map(sosNumBrand.map(r => [r.brand_name?.toLowerCase(), parseInt(r.count) || 0]));
            const sosDenomBrandMap = new Map(sosDenomBrand.map(r => [r.brand_name?.toLowerCase(), parseInt(r.count) || 0]));


            // Bulk query all brands at once (Our brands only - Comp_flag=0)
            const brandsMetrics = await RbPdpOlap.findAll({
                attributes: [
                    'Brand',
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Orders')), 'total_orders'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions'],
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: boWhere,
                group: ['Brand'],
                raw: true
            });

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
                const conversion = clicks > 0 ? (orders / clicks) * 100 : 0;
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
                        { title: "Inorg Sales", value: `${inorgPct.toFixed(1)}%`, meta: { units: formatCurrency(adSales) } },
                        { title: "Conversion", value: `${conversion.toFixed(1)}%`, meta: { units: `${(orders / 1000).toFixed(1)}k` } },
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
                default: startDate = startDate.subtract(3, 'month'); // Default 3M
            }
        }

        console.log(`[getKpiTrends] Date range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);

        // 2. Determine Grouping
        let groupCol;
        let groupColKw; // For RbKw (Share of Search)

        if (timeStep === 'Monthly') {
            groupCol = sequelize.fn('DATE_FORMAT', sequelize.col('DATE'), '%Y-%m-01');
            groupColKw = sequelize.fn('DATE_FORMAT', sequelize.col('kw_crawl_date'), '%Y-%m-01');
        } else if (timeStep === 'Weekly') {
            groupCol = sequelize.fn('YEARWEEK', sequelize.col('DATE'), 1);
            groupColKw = sequelize.fn('YEARWEEK', sequelize.col('kw_crawl_date'), 1);
        } else { // Daily
            // Use DATE() function to normalize dates (strip time component) for consistent matching
            groupCol = sequelize.fn('DATE', sequelize.col('DATE'));
            groupColKw = sequelize.fn('DATE', sequelize.col('kw_crawl_date'));
        }

        // 3. Base where clause for RbPdpOlap
        const whereClause = {
            DATE: {
                [Op.between]: [
                    sequelize.literal(`'${startDate.format('YYYY-MM-DD')}'`),
                    sequelize.literal(`'${endDate.format('YYYY-MM-DD')}'`)
                ]
            },
            ...(category && category !== 'All' && { Category: category }), // ADDED: Category filter
            ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
            ...(platform && platform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase()) })
        };

        // 4. Query for Inorganic Sales, Conversion, ROAS, BMI/Sales Ratio
        const kpiResults = await RbPdpOlap.findAll({
            attributes: [
                [groupCol, 'date_group'],
                [sequelize.fn('MAX', sequelize.col('DATE')), 'ref_date'],
                // For Inorganic Sales, ROAS, BMI/Sales Ratio
                [sequelize.fn('SUM', sequelize.col('Sales')), 'total_sales'],
                [sequelize.fn('SUM', sequelize.col('ad_sales')), 'total_ad_sales'],
                [sequelize.fn('SUM', sequelize.col('ad_spend')), 'total_ad_spend'],
                // For Conversion
                [sequelize.fn('SUM', sequelize.col('ad_orders')), 'total_ad_orders'],
                [sequelize.fn('SUM', sequelize.col('ad_clicks')), 'total_ad_clicks'],
                // For CPM calculation
                [sequelize.fn('SUM', sequelize.col('Ad_Impressions')), 'total_ad_impressions'],
                // For Availability calculation
                [sequelize.fn('SUM', sequelize.col('neno_osa')), 'total_neno_osa'],
                [sequelize.fn('SUM', sequelize.col('deno_osa')), 'total_deno_osa']
            ],
            where: whereClause,
            group: [groupCol],
            order: [[sequelize.col('ref_date'), 'ASC']],
            raw: true
        });

        // 5. Query for Share of Search
        // Formula when Brand = "All": SOS = (Count of rows where keyword_is_rb_product=1) / (Count of ALL rows) × 100
        // Uses keyword_is_rb_product column in rb_kw table (1 = our RB product)

        let sosNumWhere = {
            kw_crawl_date: {
                [Op.between]: [
                    sequelize.literal(`'${startDate.format('YYYY-MM-DD')}'`),
                    sequelize.literal(`'${endDate.format('YYYY-MM-DD')}'`)
                ]
            },
            spons_flag: { [Op.ne]: 1 },
            ...(category && category !== 'All' && { keyword_category: category }),
            ...(location && location !== 'All' && { location_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), location.toLowerCase()) }),
            ...(platform && platform !== 'All' && { platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), platform.toLowerCase()) })
        };

        // When "All" brands selected, use keyword_is_rb_product=1 for our brands
        if (brand && brand !== 'All') {
            // Specific brand selected - filter by brand name
            sosNumWhere.brand_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), brand.toLowerCase());
        } else {
            // "All" brands selected - use keyword_is_rb_product=1 (our RB products)
            sosNumWhere.keyword_is_rb_product = 1;
            console.log(`[KPI Trends SOS] "All" brands selected - using keyword_is_rb_product=1`);
        }

        const sosNumerator = await RbKw.findAll({
            attributes: [
                [groupColKw, 'date_group'],
                [sequelize.fn('COUNT', sequelize.col('keyword')), 'count']
            ],
            where: sosNumWhere,
            group: [groupColKw],
            raw: true
        });

        // Denominator: All Brands (No Brand Filter) + Not Sponsored
        const sosDenomWhere = {
            kw_crawl_date: {
                [Op.between]: [
                    sequelize.literal(`'${startDate.format('YYYY-MM-DD')}'`),
                    sequelize.literal(`'${endDate.format('YYYY-MM-DD')}'`)
                ]
            },
            spons_flag: { [Op.ne]: 1 },
            ...(category && category !== 'All' && { keyword_category: category }), // ADDED: Category filter
            ...(location && location !== 'All' && { location_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), location.toLowerCase()) }),
            ...(platform && platform !== 'All' && { platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), platform.toLowerCase()) })
        };

        const sosDenominator = await RbKw.findAll({
            attributes: [
                [groupColKw, 'date_group'],
                [sequelize.fn('COUNT', sequelize.col('keyword')), 'count']
            ],
            where: sosDenomWhere,
            group: [groupColKw],
            raw: true
        });

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

        // Base where clause for our brands only (comp_flag = 0)
        const baseWhereClause = { comp_flag: 0 };

        if (filterType === 'platforms') {
            // Fetch unique platforms from rca_sku_dim (comp_flag=0)
            const platforms = await RcaSkuDim.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('platform')), 'platform']],
                where: baseWhereClause,
                raw: true
            });

            const platformList = platforms
                .map(p => p.platform)
                .filter(p => p && p.trim())
                .sort();

            return { options: [...platformList] };
        }

        if (filterType === 'categories') {
            // Fetch unique categories (Category) from rca_sku_dim (status=1 only)
            const whereClause = { ...baseWhereClause, status: 1 };
            if (platform && platform !== 'All') {
                whereClause.platform = sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('platform')),
                    platform.toLowerCase()
                );
            }

            const categories = await RcaSkuDim.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('Category')), 'category']],
                where: whereClause,
                raw: true
            });

            const categoryList = categories
                .map(c => c.category)
                .filter(c => c && c.trim())
                .sort();

            return { options: [...categoryList] };
        }

        if (filterType === 'brands') {
            // Fetch unique brands from rca_sku_dim filtered by platform and comp_flag=0
            const whereClause = { ...baseWhereClause };
            if (platform && platform !== 'All') {
                whereClause.platform = sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('platform')),
                    platform.toLowerCase()
                );
            }

            const brands = await RcaSkuDim.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('brand_name')), 'brand']],
                where: whereClause,
                raw: true
            });

            const brandList = brands
                .map(b => b.brand)
                .filter(b => b && b.trim())
                .sort();

            return { options: [...brandList] };
        }

        if (filterType === 'cities') {
            // Fetch unique cities (location) from rca_sku_dim
            const whereClause = { ...baseWhereClause };
            if (platform && platform !== 'All') {
                whereClause.platform = sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('platform')),
                    platform.toLowerCase()
                );
            }
            if (brand && brand !== 'All') {
                whereClause.brand_name = { [Op.like]: `%${brand}%` };
            }

            const cities = await RcaSkuDim.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('location')), 'city']],
                where: whereClause,
                raw: true
            });

            const cityList = cities
                .map(c => c.city)
                .filter(c => c && c.trim())
                .sort();

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

        // Build where clause for current period
        const whereClause = {
            DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
        };

        if (platform && platform !== 'All') {
            whereClause.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase());
        }
        if (location && location !== 'All') {
            whereClause.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
        }
        if (category && category !== 'All') {
            whereClause.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());
        }

        // FIXED: Handle multiple brand selection (comma-separated)
        // When brands are selected, show ONLY those brands
        if (brand && brand !== 'All') {
            const brandList = brand.split(',').map(b => b.trim().toLowerCase());

            if (brandList.length === 1) {
                // Single brand: use exact match
                whereClause.Brand = sequelize.where(sequelize.fn('LOWER', sequelize.col('Brand')), brandList[0]);
            } else {
                // Multiple brands: use IN clause
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

        if (sku && sku !== 'All') {
            whereClause.Product = sequelize.where(sequelize.fn('LOWER', sequelize.col('Product')), sku.toLowerCase());
        }

        // Only include our brands (Comp_flag = 0)
        whereClause.Comp_flag = 0;


        // 1. Get all brands with aggregated metrics for current period
        const currentBrands = await RbPdpOlap.findAll({
            attributes: [
                'Brand',
                [sequelize.fn('SUM', sequelize.col('Sales')), 'total_offtakes'],
                [sequelize.fn('SUM', sequelize.col('Ad_Spend')), 'total_spend'],
                [sequelize.fn('SUM', sequelize.col('Ad_sales')), 'total_ad_sales'],
                [sequelize.fn('SUM', sequelize.col('Ad_Impressions')), 'total_impressions'],
                [sequelize.fn('AVG', sequelize.cast(sequelize.col('MRP'), 'FLOAT')), 'avg_price'],
            ],
            where: whereClause,
            group: ['Brand'],
            having: sequelize.where(sequelize.fn('SUM', sequelize.col('Sales')), { [Op.gt]: 0 }),
            raw: true
        });

        console.log(`[getCompetitionData] ✅ Found ${currentBrands.length} brands matching ALL filters`);
        if (currentBrands.length > 0) {
            console.log(`[getCompetitionData] Sample brands:`, currentBrands.slice(0, 3).map(b => b.Brand));
        } else {
            console.log('[getCompetitionData] ⚠️ NO BRANDS FOUND with current filters! This might indicate:');
            console.log('  - Location name mismatch (e.g., "Banglore" vs "Bangalore")');
            console.log('  - Category name mismatch');
            console.log('  - No data exists for this filter combination');
        }

        // 2. Get previous period metrics for MoM calculation
        const momWhereClause = {
            DATE: { [Op.between]: [momStartDate.toDate(), momEndDate.toDate()] }
        };
        if (platform && platform !== 'All') momWhereClause.Platform = whereClause.Platform;
        if (location && location !== 'All') momWhereClause.Location = whereClause.Location;
        if (category && category !== 'All') momWhereClause.Category = whereClause.Category;
        // FIXED: Also exclude selected brand from previous period data
        if (brand && brand !== 'All') momWhereClause.Brand = whereClause.Brand;

        const previousBrands = await RbPdpOlap.findAll({
            attributes: [
                'Brand',
                [sequelize.fn('SUM', sequelize.col('Sales')), 'total_offtakes'],
                [sequelize.fn('SUM', sequelize.col('Ad_Spend')), 'total_spend'],
                [sequelize.fn('SUM', sequelize.col('Ad_sales')), 'total_ad_sales'],
            ],
            where: momWhereClause,
            group: ['Brand'],
            raw: true
        });

        // Create map for previous period data
        const prevMap = new Map(
            previousBrands.map(b => [b.Brand, b])
        );

        // 3. Get OSA data for availability calculation
        const osaData = await RbPdpOlap.findAll({
            attributes: [
                'Brand',
                [sequelize.fn('SUM', sequelize.col('Neno_OSA')), 'neno_osa'],
                [sequelize.fn('SUM', sequelize.col('Deno_OSA')), 'deno_osa'],
            ],
            where: whereClause,
            group: ['Brand'],
            raw: true
        });

        const osaMap = new Map(
            osaData.map(o => [o.Brand, {
                neno: parseFloat(o.neno_osa || 0),
                deno: parseFloat(o.deno_osa || 0)
            }])
        );

        // 4. Calculate metrics for each brand
        // Calculate total sales globally for market share and category share calculation
        const totalSales = currentBrands.reduce((sum, b) => sum + parseFloat(b.total_offtakes || 0), 0);

        // Calculate total impressions for SOS calculation  
        const totalImpressions = currentBrands.reduce((sum, b) => sum + parseFloat(b.total_impressions || 0), 0);

        const brandMetrics = currentBrands.map(brand => {
            const sales = parseFloat(brand.total_offtakes || 0);
            const impressions = parseFloat(brand.total_impressions || 0);
            const avgPrice = parseFloat(brand.avg_price || 0);

            // Calculate OSA (On-Shelf Availability)
            const osaBrand = osaMap.get(brand.Brand) || { neno: 0, deno: 0 };
            const osa = osaBrand.deno > 0 ? (osaBrand.neno / osaBrand.deno) * 100 : 0;

            // Calculate SOS (Share of Search) - based on impressions share
            const sos = totalImpressions > 0 ? (impressions / totalImpressions) * 100 : 0;

            // Calculate Market Share (brand sales / total sales)
            const marketShare = totalSales > 0 ? (sales / totalSales) * 100 : 0;

            // Category Share (same as market share for now since we filter by category)
            const categoryShare = marketShare;

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
                // Get distinct locations
                const availableLocations = await RbPdpOlap.findAll({
                    attributes: [[sequelize.fn('DISTINCT', sequelize.col('Location')), 'location']],
                    where: { Location: { [Op.ne]: null } },
                    limit: 10,
                    raw: true
                });

                // Get distinct categories
                const availableCategories = await RbPdpOlap.findAll({
                    attributes: [[sequelize.fn('DISTINCT', sequelize.col('Category')), 'category']],
                    where: { Category: { [Op.ne]: null } },
                    limit: 10,
                    raw: true
                });

                // FIXED: Get distinct brands to help debug name mismatches
                const availableBrands = await RbPdpOlap.findAll({
                    attributes: [[sequelize.fn('DISTINCT', sequelize.col('Brand')), 'brand']],
                    where: { Brand: { [Op.ne]: null } },
                    limit: 30,
                    raw: true
                });

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

        // 6. Get SKU competition data (similar to brands)
        console.log('[getCompetitionData] Fetching SKU data with same filters...');

        const currentSkus = await RbPdpOlap.findAll({
            attributes: [
                'Product',
                'Brand',
                [sequelize.fn('SUM', sequelize.col('Sales')), 'total_sales'],
                [sequelize.fn('SUM', sequelize.col('Ad_Impressions')), 'total_impressions'],
                [sequelize.fn('AVG', sequelize.cast(sequelize.col('MRP'), 'FLOAT')), 'avg_price'],
            ],
            where: whereClause,
            group: ['Product', 'Brand'],
            having: sequelize.where(sequelize.fn('SUM', sequelize.col('Sales')), { [Op.gt]: 0 }),
            raw: true
        });

        // Get SKU OSA data
        const skuOsaData = await RbPdpOlap.findAll({
            attributes: [
                'Product',
                [sequelize.fn('SUM', sequelize.col('Neno_OSA')), 'neno_osa'],
                [sequelize.fn('SUM', sequelize.col('Deno_OSA')), 'deno_osa'],
            ],
            where: whereClause,
            group: ['Product'],
            raw: true
        });

        const skuOsaMap = new Map(skuOsaData.map(s => [s.Product, s]));

        // Calculate total sales and impressions for share calculations
        const totalSkuSales = currentSkus.reduce((sum, s) => sum + parseFloat(s.total_sales || 0), 0);
        const totalSkuImpressions = currentSkus.reduce((sum, s) => sum + parseFloat(s.total_impressions || 0), 0);

        // Calculate SKU metrics with new KPIs
        const skuMetrics = currentSkus.map(sku => {
            const sales = parseFloat(sku.total_sales || 0);
            const impressions = parseFloat(sku.total_impressions || 0);
            const avgPrice = parseFloat(sku.avg_price || 0);

            // Calculate OSA
            const osaData = skuOsaMap.get(sku.Product);
            const nenoOsa = parseFloat(osaData?.neno_osa || 0);
            const denoOsa = parseFloat(osaData?.deno_osa || 0);
            const osa = denoOsa > 0 ? (nenoOsa / denoOsa) * 100 : 0;

            // Calculate SOS (Share of Search)
            const sos = totalSkuImpressions > 0 ? (impressions / totalSkuImpressions) * 100 : 0;

            // Calculate Market Share and Category Share
            const marketShare = totalSkuSales > 0 ? (sales / totalSkuSales) * 100 : 0;
            const categoryShare = marketShare;

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
        const { location = null, category = null, brand = null } = filters;
        console.log('[getCompetitionFilterOptions] Cascading filters:', { location, category, brand });

        // Fetch distinct locations
        const locationResults = await RcaSkuDim.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('location')), 'location']],
            where: {
                location: { [Op.ne]: null }
            },
            order: [['location', 'ASC']],
            raw: true
        });

        // Fetch distinct categories filtered by location
        const categoryWhere = { Category: { [Op.ne]: null }, status: 1 };
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
        // NOTE: For competition pages, show ALL brands (our brands + competitor brands)
        // This allows users to analyze competitive landscape
        const brandWhere = {
            brand_name: { [Op.ne]: null }
            // No comp_flag filter - show all brands for competition analysis
        };
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
        // NOTE: For competition pages, show ALL SKUs (our SKUs + competitor SKUs)
        const skuWhere = {
            Product: { [Op.ne]: null }
            // No Comp_flag filter - show all SKUs for competition analysis
        };
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

        console.log(`[getCompetitionFilterOptions] Found ${locations.length} locations, ${categories.length} categories, ${brands.length} brands, and ${skus.length} SKUs`);

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

        const endDate = dayjs();
        const startDate = period === '1W' ? endDate.subtract(7, 'days') : endDate.subtract(30, 'days');

        const where = {
            DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
        };

        if (location && location !== 'All') {
            where.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
        }

        const brandTrends = {};

        for (const brandName of brandList) {
            const brandWhere = {
                ...where,
                Brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('Brand')), brandName.toLowerCase())
            };

            // Main metrics query - only fetch what we need for the 5 KPIs
            const rawData = await RbPdpOlap.findAll({
                attributes: [
                    'DATE',
                    [sequelize.fn('SUM', sequelize.col('Sales')), 'Offtakes'],
                    [sequelize.fn('SUM', sequelize.col('Ad_Spend')), 'Spend'],
                    [sequelize.fn('SUM', sequelize.col('Ad_sales')), 'Ad_sales'],
                    [sequelize.fn('SUM', sequelize.col('Neno_OSA')), 'neno_osa'],
                    [sequelize.fn('SUM', sequelize.col('Deno_OSA')), 'deno_osa'],
                    [sequelize.fn('SUM', sequelize.col('Ad_Impressions')), 'Impressions'],
                    [sequelize.fn('AVG', sequelize.cast(sequelize.col('MRP'), 'FLOAT')), 'avg_price'],
                ],
                where: brandWhere,
                group: ['DATE'],
                order: [['DATE', 'ASC']],
                raw: true
            });

            console.log(`[getCompetitionBrandTrends] Brand "${brandName}": ${rawData.length} data points, date range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);

            // Process the raw data to get trend points
            brandTrends[brandName] = rawData.map(row => {
                const nenoOsa = parseFloat(row.neno_osa || 0);
                const denoOsa = parseFloat(row.deno_osa || 0);
                const avgPrice = parseFloat(row.avg_price || 0);
                const impressions = parseFloat(row.Impressions || 0);

                // Calculate OSA
                const osa = denoOsa > 0 ? ((nenoOsa / denoOsa) * 100) : 0;

                // SOS will be calculated based on impressions share (simplified)
                // For now, use a placeholder - this would need total impressions to calculate properly
                const sos = 0;

                // Return only the 5 KPIs the frontend uses
                return {
                    date: dayjs(row.DATE).format("DD MMM'YY"),
                    osa: parseFloat(osa.toFixed(1)),
                    sos: parseFloat(sos.toFixed(1)),
                    price: parseFloat(avgPrice.toFixed(0)),
                    categoryShare: 0,
                    marketShare: 0
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
    getCompetitionBrandTrends
};
