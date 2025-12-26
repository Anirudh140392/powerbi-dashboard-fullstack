/**
 * Redis Data Service
 * 
 * Provides an indexed in-memory data layer for rb_pdp_olap table.
 * Strategy:
 * 1. Fetch ALL data for a platform from DB (one-time)
 * 2. Store in Redis with synthetic IDs and indexed structures
 * 3. Serve subsequent queries entirely from Redis
 * 
 * Key Structure:
 * - pdp:{platform}:data       → Hash of all rows (id → JSON)
 * - pdp:{platform}:idx:brand:{brand}      → Set of row IDs
 * - pdp:{platform}:idx:location:{loc}     → Set of row IDs
 * - pdp:{platform}:idx:date:{YYYY-MM-DD}  → Set of row IDs
 * - pdp:{platform}:idx:category:{cat}     → Set of row IDs
 * - pdp:{platform}:meta       → Metadata (count, lastUpdated)
 */

import redisClient from '../config/redis.js';
import RbPdpOlap from '../models/RbPdpOlap.js';
import dayjs from 'dayjs';

// Cache TTL: 24 hours (data refreshes daily)
const PLATFORM_DATA_TTL = 86400;

// Key prefixes
const KEY_PREFIX = 'pdp';

// ================================
// IN-FLIGHT REQUEST TRACKING (Cache Stampede Prevention)
// ================================
// Maps cache keys to Promises - if same computation is in progress, return existing Promise
const inFlightRequests = new Map();

/**
 * Generate cache keys for a platform
 */
const getKeys = (platform) => {
    const p = platform.toLowerCase();
    return {
        data: `${KEY_PREFIX}:${p}:data`,
        meta: `${KEY_PREFIX}:${p}:meta`,
        monthlyAgg: `${KEY_PREFIX}:${p}:agg:monthly`, // Pre-aggregated monthly totals
        brandMonthAgg: `${KEY_PREFIX}:${p}:agg:brand:monthly`, // Pre-aggregated brand+month totals
        brandIndex: (brand) => `${KEY_PREFIX}:${p}:idx:brand:${brand.toLowerCase()}`,
        locationIndex: (loc) => `${KEY_PREFIX}:${p}:idx:location:${loc.toLowerCase()}`,
        dateIndex: (date) => `${KEY_PREFIX}:${p}:idx:date:${date}`,
        categoryIndex: (cat) => `${KEY_PREFIX}:${p}:idx:category:${cat.toLowerCase()}`,
        allIndexPattern: `${KEY_PREFIX}:${p}:idx:*`
    };
};

/**
 * Check if platform data is already loaded in Redis
 */
export async function isPlatformDataLoaded(platform) {
    if (!redisClient.isReady()) return false;

    try {
        const keys = getKeys(platform);
        const meta = await redisClient.getClient().hGetAll(keys.meta);

        if (meta && meta.rowCount) {
            const lastUpdated = parseInt(meta.lastUpdated || 0);
            const age = Date.now() - lastUpdated;
            const maxAge = PLATFORM_DATA_TTL * 1000;

            // Data is valid if not expired
            if (age < maxAge) {
                console.log(`✅ Platform ${platform} data loaded (${meta.rowCount} rows, age: ${Math.round(age / 60000)}min)`);
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error(`Error checking platform data status:`, error.message);
        return false;
    }
}

/**
 * Load ALL data for a platform from DB and store in Redis
 * This is the one-time expensive operation
 */
export async function loadPlatformData(platform) {
    if (!redisClient.isReady()) {
        console.warn('❌ Redis not available, cannot load platform data');
        return false;
    }

    const startTime = Date.now();
    console.log(`🔄 Loading ${platform} data from database...`);

    try {
        const keys = getKeys(platform);
        const client = redisClient.getClient();

        // Fetch ALL rows for this platform from DB
        const rows = await RbPdpOlap.findAll({
            where: {
                Platform: platform
            },
            raw: true
        });

        console.log(`📊 Fetched ${rows.length} rows for ${platform} in ${Date.now() - startTime}ms`);

        if (rows.length === 0) {
            console.warn(`⚠️ No data found for platform: ${platform}`);
            return false;
        }

        // Clear existing data for this platform
        const existingKeys = await client.keys(`${KEY_PREFIX}:${platform.toLowerCase()}:*`);
        if (existingKeys.length > 0) {
            await client.del(existingKeys);
        }

        // Use pipeline for batch operations (much faster than individual commands)
        const pipeline = client.multi();

        // Process rows and build indices
        const brandSets = new Map();
        const locationSets = new Map();
        const dateSets = new Map();
        const categorySets = new Map();

        // Pre-aggregate monthly totals for fast retrieval
        const monthlyAggs = new Map();

        // Pre-aggregate brand+month totals for instant brand-filtered KPI lookups
        // Key format: "brand:month" (e.g., "godrej ezee:2025-12")
        const brandMonthAggs = new Map();

        rows.forEach((row, index) => {
            // Generate synthetic ID
            const id = `${index}`;

            // Add row to data hash
            pipeline.hSet(keys.data, id, JSON.stringify(row));

            // Track indices (will batch add later)
            const brand = (row.Brand || 'unknown').toLowerCase();
            const location = (row.Location || 'unknown').toLowerCase();
            const date = row.DATE ? dayjs(row.DATE).format('YYYY-MM-DD') : 'unknown';
            const month = row.DATE ? dayjs(row.DATE).format('YYYY-MM') : 'unknown';
            const category = (row.Category || 'unknown').toLowerCase();

            if (!brandSets.has(brand)) brandSets.set(brand, []);
            brandSets.get(brand).push(id);

            if (!locationSets.has(location)) locationSets.set(location, []);
            locationSets.get(location).push(id);

            if (!dateSets.has(date)) dateSets.set(date, []);
            dateSets.get(date).push(id);

            if (!categorySets.has(category)) categorySets.set(category, []);
            categorySets.get(category).push(id);

            // Accumulate monthly aggregations (platform-wide)
            if (month !== 'unknown') {
                if (!monthlyAggs.has(month)) {
                    monthlyAggs.set(month, {
                        sales: 0,
                        spend: 0,
                        adSales: 0,
                        clicks: 0,
                        impressions: 0,
                        nenoOsa: 0,
                        denoOsa: 0,
                        orders: 0,
                        rowCount: 0
                    });
                }
                const agg = monthlyAggs.get(month);
                agg.sales += parseFloat(row.Sales) || 0;
                agg.spend += parseFloat(row.Ad_Spend) || 0;
                agg.adSales += parseFloat(row.Ad_sales) || 0;
                agg.clicks += parseFloat(row.Ad_Clicks) || 0;
                agg.impressions += parseFloat(row.Ad_Impressions) || 0;
                agg.nenoOsa += parseFloat(row.neno_osa) || 0;
                agg.denoOsa += parseFloat(row.deno_osa) || 0;
                agg.orders += parseFloat(row.Ad_Orders) || 0;
                agg.rowCount++;

                // Accumulate brand+month aggregations for instant brand filter lookups
                const brandMonthKey = `${brand}:${month}`;
                if (!brandMonthAggs.has(brandMonthKey)) {
                    brandMonthAggs.set(brandMonthKey, {
                        sales: 0,
                        spend: 0,
                        adSales: 0,
                        clicks: 0,
                        impressions: 0,
                        nenoOsa: 0,
                        denoOsa: 0,
                        orders: 0,
                        rowCount: 0
                    });
                }
                const brandAgg = brandMonthAggs.get(brandMonthKey);
                brandAgg.sales += parseFloat(row.Sales) || 0;
                brandAgg.spend += parseFloat(row.Ad_Spend) || 0;
                brandAgg.adSales += parseFloat(row.Ad_sales) || 0;
                brandAgg.clicks += parseFloat(row.Ad_Clicks) || 0;
                brandAgg.impressions += parseFloat(row.Ad_Impressions) || 0;
                brandAgg.nenoOsa += parseFloat(row.neno_osa) || 0;
                brandAgg.denoOsa += parseFloat(row.deno_osa) || 0;
                brandAgg.orders += parseFloat(row.Ad_Orders) || 0;
                brandAgg.rowCount++;
            }
        });

        // Add brand indices
        for (const [brand, ids] of brandSets) {
            pipeline.sAdd(keys.brandIndex(brand), ids);
        }

        // Add location indices
        for (const [location, ids] of locationSets) {
            pipeline.sAdd(keys.locationIndex(location), ids);
        }

        // Add date indices
        for (const [date, ids] of dateSets) {
            pipeline.sAdd(keys.dateIndex(date), ids);
        }

        // Add category indices
        for (const [category, ids] of categorySets) {
            pipeline.sAdd(keys.categoryIndex(category), ids);
        }

        // Store pre-aggregated monthly totals
        for (const [month, agg] of monthlyAggs) {
            pipeline.hSet(keys.monthlyAgg, month, JSON.stringify(agg));
        }

        // Store pre-aggregated brand+month totals for instant brand filter lookups
        for (const [brandMonthKey, agg] of brandMonthAggs) {
            pipeline.hSet(keys.brandMonthAgg, brandMonthKey, JSON.stringify(agg));
        }

        // Add metadata
        pipeline.hSet(keys.meta, {
            rowCount: rows.length.toString(),
            lastUpdated: Date.now().toString(),
            platform: platform,
            brands: brandSets.size.toString(),
            locations: locationSets.size.toString(),
            categories: categorySets.size.toString(),
            monthsPreAggregated: monthlyAggs.size.toString(),
            brandMonthsPreAggregated: brandMonthAggs.size.toString()
        });

        // Set TTL on main data key
        pipeline.expire(keys.data, PLATFORM_DATA_TTL);
        pipeline.expire(keys.meta, PLATFORM_DATA_TTL);
        pipeline.expire(keys.monthlyAgg, PLATFORM_DATA_TTL);
        pipeline.expire(keys.brandMonthAgg, PLATFORM_DATA_TTL);

        // Execute pipeline
        await pipeline.exec();

        const totalTime = Date.now() - startTime;
        console.log(`✅ Loaded ${rows.length} rows for ${platform} in ${totalTime}ms`);
        console.log(`   Indices: ${brandSets.size} brands, ${locationSets.size} locations, ${categorySets.size} categories`);
        console.log(`   Pre-aggregated: ${monthlyAggs.size} months of totals`);

        return true;
    } catch (error) {
        console.error(`❌ Error loading platform data:`, error.message);
        return false;
    }
}

/**
 * Ensure platform data is loaded (load if not already)
 */
export async function ensurePlatformData(platform) {
    if (!platform || platform === 'All') {
        // For "All" platform, we'd need to load all platforms - skip for now
        console.log('⏭️ Skipping Redis cache for "All" platform');
        return false;
    }

    const isLoaded = await isPlatformDataLoaded(platform);
    if (isLoaded) return true;

    return await loadPlatformData(platform);
}

/**
 * Query cached data by filters
 * Returns array of matching row data
 */
export async function queryByFilters(platform, filters = {}) {
    if (!redisClient.isReady()) return null;

    const { brand, location, startDate, endDate, category } = filters;
    const keys = getKeys(platform);
    const client = redisClient.getClient();

    try {
        // Start with all row IDs if no filters, or build intersection
        let resultIds = null;

        // Get brand filter IDs
        if (brand && brand !== 'All') {
            const brandIds = await client.sMembers(keys.brandIndex(brand));
            resultIds = resultIds ? resultIds.filter(id => brandIds.includes(id)) : brandIds;
        }

        // Get location filter IDs
        if (location && location !== 'All') {
            const locationIds = await client.sMembers(keys.locationIndex(location));
            resultIds = resultIds ? resultIds.filter(id => locationIds.includes(id)) : locationIds;
        }

        // Get category filter IDs
        if (category && category !== 'All') {
            const categoryIds = await client.sMembers(keys.categoryIndex(category));
            resultIds = resultIds ? resultIds.filter(id => categoryIds.includes(id)) : categoryIds;
        }

        // Date range filter - need to get IDs from multiple date indices
        if (startDate && endDate) {
            const start = dayjs(startDate);
            const end = dayjs(endDate);
            const dateIds = new Set();

            // Get all date index keys
            const dateKeys = await client.keys(`${KEY_PREFIX}:${platform.toLowerCase()}:idx:date:*`);

            for (const key of dateKeys) {
                const dateStr = key.split(':').pop();
                const date = dayjs(dateStr);
                if (date.isValid() && date.isAfter(start.subtract(1, 'day')) && date.isBefore(end.add(1, 'day'))) {
                    const ids = await client.sMembers(key);
                    ids.forEach(id => dateIds.add(id));
                }
            }

            const dateIdArray = Array.from(dateIds);
            resultIds = resultIds ? resultIds.filter(id => dateIdArray.includes(id)) : dateIdArray;
        }

        // If no filters applied, get all IDs
        if (resultIds === null) {
            resultIds = await client.hKeys(keys.data);
        }

        // Fetch actual row data for matching IDs
        if (resultIds.length === 0) {
            return [];
        }

        // Use pipeline to fetch all matching rows
        const pipeline = client.multi();
        resultIds.forEach(id => {
            pipeline.hGet(keys.data, id);
        });

        const results = await pipeline.exec();

        // Parse JSON rows
        const rows = results
            .filter(r => r !== null)
            .map(r => JSON.parse(r));

        console.log(`📊 Redis query: ${rows.length} rows matched (from ${resultIds.length} IDs)`);
        return rows;

    } catch (error) {
        console.error('Error querying Redis:', error.message);
        return null;
    }
}

/**
 * Aggregate metrics from cached data
 */
export function aggregateMetrics(rows, options = {}) {
    if (!rows || rows.length === 0) {
        return { total: 0, sum: 0, avg: 0 };
    }

    const { column, groupBy } = options;

    if (groupBy) {
        // Group aggregation
        const groups = new Map();

        rows.forEach(row => {
            const key = row[groupBy] || 'unknown';
            if (!groups.has(key)) {
                groups.set(key, { sum: 0, count: 0, rows: [] });
            }
            const group = groups.get(key);
            group.rows.push(row);
            if (column && row[column]) {
                group.sum += parseFloat(row[column]) || 0;
            }
            group.count++;
        });

        return Object.fromEntries(groups);
    }

    // Simple aggregation
    let sum = 0;
    let count = 0;

    rows.forEach(row => {
        if (column && row[column]) {
            sum += parseFloat(row[column]) || 0;
        }
        count++;
    });

    return {
        total: count,
        sum: sum,
        avg: count > 0 ? sum / count : 0
    };
}

/**
 * Get unique values for a column (for dropdowns)
 */
export async function getUniqueValues(platform, column) {
    if (!redisClient.isReady()) return null;

    const keys = getKeys(platform);
    const client = redisClient.getClient();

    try {
        let pattern;
        switch (column.toLowerCase()) {
            case 'brand':
                pattern = `${KEY_PREFIX}:${platform.toLowerCase()}:idx:brand:*`;
                break;
            case 'location':
                pattern = `${KEY_PREFIX}:${platform.toLowerCase()}:idx:location:*`;
                break;
            case 'category':
                pattern = `${KEY_PREFIX}:${platform.toLowerCase()}:idx:category:*`;
                break;
            default:
                return null;
        }

        const indexKeys = await client.keys(pattern);

        // Extract unique values from key names
        const values = indexKeys.map(key => {
            const parts = key.split(':');
            return parts[parts.length - 1];
        }).filter(v => v && v !== 'unknown');

        return values;
    } catch (error) {
        console.error(`Error getting unique values for ${column}:`, error.message);
        return null;
    }
}

/**
 * Get platform data statistics
 */
export async function getPlatformStats(platform) {
    if (!redisClient.isReady()) return null;

    try {
        const keys = getKeys(platform);
        const meta = await redisClient.getClient().hGetAll(keys.meta);

        if (!meta || !meta.rowCount) {
            return { loaded: false };
        }

        return {
            loaded: true,
            rowCount: parseInt(meta.rowCount),
            lastUpdated: new Date(parseInt(meta.lastUpdated)),
            brands: parseInt(meta.brands || 0),
            locations: parseInt(meta.locations || 0),
            categories: parseInt(meta.categories || 0)
        };
    } catch (error) {
        console.error('Error getting platform stats:', error.message);
        return null;
    }
}

// ================================
// SHARE OF SEARCH (SOS) PRE-COMPUTED CACHE
// ================================
const SOS_KEY_PREFIX = 'sos';
const SOS_CACHE_TTL = 3600; // 1 hour (SOS data changes less frequently)

/**
 * Get SOS cache key for a specific query
 */
const getSOSCacheKey = (platform, dateStart, dateEnd, category, location) => {
    const parts = [
        SOS_KEY_PREFIX,
        platform?.toLowerCase() || 'all',
        dateStart,
        dateEnd,
        category?.toLowerCase() || 'all',
        location?.toLowerCase() || 'all'
    ];
    return parts.join(':');
};

/**
 * Get cached SOS data for brands
 * Returns: { brandCounts: {brand: count}, totalCount: number } or null if not cached
 */
export async function getCachedSOSData(platform, dateStart, dateEnd, category, location) {
    if (!redisClient.isReady()) return null;

    try {
        const cacheKey = getSOSCacheKey(platform, dateStart, dateEnd, category, location);
        const cached = await redisClient.getClient().get(cacheKey);

        if (cached) {
            console.log(`📊 [SOS Cache Hit] ${platform} ${dateStart} to ${dateEnd}`);
            return JSON.parse(cached);
        }
        return null;
    } catch (error) {
        console.error('Error getting cached SOS data:', error.message);
        return null;
    }
}

/**
 * Cache SOS data for brands
 */
export async function cacheSOSData(platform, dateStart, dateEnd, category, location, data) {
    if (!redisClient.isReady()) return false;

    try {
        const cacheKey = getSOSCacheKey(platform, dateStart, dateEnd, category, location);
        await redisClient.getClient().setEx(cacheKey, SOS_CACHE_TTL, JSON.stringify(data));
        console.log(`📊 [SOS Cache Set] ${platform} ${dateStart} to ${dateEnd}`);
        return true;
    } catch (error) {
        console.error('Error caching SOS data:', error.message);
        return false;
    }
}

/**
 * Invalidate SOS cache for a platform
 */
export async function invalidateSOSCache(platform) {
    if (!redisClient.isReady()) return false;

    try {
        const pattern = `${SOS_KEY_PREFIX}:${platform?.toLowerCase() || '*'}:*`;
        const keys = await redisClient.getClient().keys(pattern);
        if (keys.length > 0) {
            await redisClient.getClient().del(keys);
            console.log(`🗑️ [SOS Cache] Cleared ${keys.length} cached entries for ${platform}`);
        }
        return true;
    } catch (error) {
        console.error('Error invalidating SOS cache:', error.message);
        return false;
    }
}

// ================================
// MONTHLY KPI AGGREGATIONS CACHE
// ================================
const KPI_KEY_PREFIX = 'kpi:monthly';
const KPI_CACHE_TTL = 3600; // 1 hour

/**
 * Generate cache key for monthly KPI aggregations
 */
const getKPICacheKey = (platform, month, brand, location) => {
    const parts = [
        KPI_KEY_PREFIX,
        platform?.toLowerCase() || 'all',
        month, // YYYY-MM format
        brand?.toLowerCase() || 'all',
        location?.toLowerCase() || 'all'
    ];
    return parts.join(':');
};

/**
 * Get cached monthly KPI aggregations
 * Returns: { sales, adSales, orders, clicks, impressions, spend } or null
 */
export async function getCachedMonthlyKPI(platform, month, brand, location) {
    if (!redisClient.isReady()) return null;

    try {
        const cacheKey = getKPICacheKey(platform, month, brand, location);
        const cached = await redisClient.getClient().get(cacheKey);

        if (cached) {
            console.log(`📊 [KPI Cache Hit] ${platform} ${month}`);
            return JSON.parse(cached);
        }
        return null;
    } catch (error) {
        console.error('Error getting cached KPI data:', error.message);
        return null;
    }
}

/**
 * Cache monthly KPI aggregations
 */
export async function cacheMonthlyKPI(platform, month, brand, location, data) {
    if (!redisClient.isReady()) return false;

    try {
        const cacheKey = getKPICacheKey(platform, month, brand, location);
        await redisClient.getClient().setEx(cacheKey, KPI_CACHE_TTL, JSON.stringify(data));
        console.log(`📊 [KPI Cache Set] ${platform} ${month}`);
        return true;
    } catch (error) {
        console.error('Error caching KPI data:', error.message);
        return false;
    }
}

/**
 * Get multiple months of cached KPI data at once
 * Returns: Map<month, kpiData>
 */
export async function getCachedMonthlyKPIs(platform, months, brand, location) {
    if (!redisClient.isReady()) return null;

    try {
        const client = redisClient.getClient();
        const pipeline = client.multi();

        months.forEach(month => {
            const cacheKey = getKPICacheKey(platform, month, brand, location);
            pipeline.get(cacheKey);
        });

        const results = await pipeline.exec();

        const dataByMonth = new Map();
        let allCached = true;

        results.forEach((result, index) => {
            if (result) {
                dataByMonth.set(months[index], JSON.parse(result));
            } else {
                allCached = false;
            }
        });

        if (allCached && dataByMonth.size === months.length) {
            console.log(`📊 [KPI Cache Hit] All ${months.length} months cached for ${platform}`);
            return dataByMonth;
        }

        return null; // Return null if any month is missing, let caller fetch from source
    } catch (error) {
        console.error('Error getting cached monthly KPIs:', error.message);
        return null;
    }
}

/**
 * Cache multiple months of KPI data at once
 */
export async function cacheMonthlyKPIs(platform, monthDataMap, brand, location) {
    if (!redisClient.isReady()) return false;

    try {
        const client = redisClient.getClient();
        const pipeline = client.multi();

        for (const [month, data] of monthDataMap) {
            const cacheKey = getKPICacheKey(platform, month, brand, location);
            pipeline.setEx(cacheKey, KPI_CACHE_TTL, JSON.stringify(data));
        }

        await pipeline.exec();
        console.log(`📊 [KPI Cache Set] Cached ${monthDataMap.size} months for ${platform}`);
        return true;
    } catch (error) {
        console.error('Error caching monthly KPIs:', error.message);
        return false;
    }
}

/**
 * Get pre-aggregated monthly data for a platform
 * Returns data aggregated during the initial load, avoiding 555K row aggregation
 * 
 * @param {string} platform - Platform name
 * @param {Array<string>} months - Array of month strings in YYYY-MM format
 * @returns {Map<string, Object>} - Map of month -> aggregated data
 */
export async function getPreAggregatedMonthlyData(platform, months = []) {
    if (!redisClient.isReady()) return null;

    try {
        const keys = getKeys(platform);
        const client = redisClient.getClient();

        if (months.length === 0) {
            // Get all months
            const allData = await client.hGetAll(keys.monthlyAgg);
            if (!allData || Object.keys(allData).length === 0) {
                return null;
            }

            const result = new Map();
            for (const [month, dataStr] of Object.entries(allData)) {
                result.set(month, JSON.parse(dataStr));
            }
            console.log(`📊 [Pre-Agg Cache Hit] ${platform}: ${result.size} months from pre-aggregated data`);
            return result;
        }

        // Get specific months
        const pipeline = client.multi();
        months.forEach(month => {
            pipeline.hGet(keys.monthlyAgg, month);
        });

        const results = await pipeline.exec();
        const dataMap = new Map();

        results.forEach((result, index) => {
            if (result) {
                dataMap.set(months[index], JSON.parse(result));
            }
        });

        if (dataMap.size > 0) {
            console.log(`📊 [Pre-Agg Cache Hit] ${platform}: ${dataMap.size} months from pre-aggregated data`);
            return dataMap;
        }
        return null;
    } catch (error) {
        console.error('Error getting pre-aggregated monthly data:', error.message);
        return null;
    }
}

/**
 * Get pre-aggregated brand+month data for instant brand-filtered KPI lookups
 * This eliminates the need to fetch thousands of rows and aggregate on every request
 * 
 * @param {string} platform - Platform name
 * @param {string} brand - Brand name to filter by
 * @param {Array<string>} months - Array of month strings in YYYY-MM format
 * @returns {Map<string, Object>} - Map of month -> aggregated data
 */
export async function getBrandMonthlyData(platform, brand, months = []) {
    if (!redisClient.isReady() || !brand || brand === 'All') return null;

    try {
        const keys = getKeys(platform);
        const client = redisClient.getClient();
        const brandLower = brand.toLowerCase();

        // Build keys for brand:month format
        const brandMonthKeys = months.map(month => `${brandLower}:${month}`);

        // Use pipeline to fetch all at once
        const pipeline = client.multi();
        brandMonthKeys.forEach(key => {
            pipeline.hGet(keys.brandMonthAgg, key);
        });

        const results = await pipeline.exec();
        const dataMap = new Map();

        results.forEach((result, index) => {
            if (result) {
                // Store with YYYY-MM-01 format to match existing code expectations
                dataMap.set(months[index] + '-01', JSON.parse(result));
            }
        });

        if (dataMap.size > 0) {
            console.log(`⚡ [Brand Pre-Agg Hit] ${platform}/${brand}: ${dataMap.size} months from pre-aggregated data`);
            return dataMap;
        }
        return null;
    } catch (error) {
        console.error('Error getting brand monthly data:', error.message);
        return null;
    }
}

export default {
    isPlatformDataLoaded,
    loadPlatformData,
    ensurePlatformData,
    queryByFilters,
    aggregateMetrics,
    getUniqueValues,
    getPlatformStats,
    // SOS Cache functions
    getCachedSOSData,
    cacheSOSData,
    invalidateSOSCache,
    // Monthly KPI Cache functions
    getCachedMonthlyKPI,
    cacheMonthlyKPI,
    getCachedMonthlyKPIs,
    cacheMonthlyKPIs,
    // Request coalescing (cache stampede prevention)
    coalesceRequest,
    // Platform Metrics Cache
    getCachedPlatformMetrics,
    cachePlatformMetrics,
    // Pre-aggregated monthly data
    getPreAggregatedMonthlyData,
    // Brand+month pre-aggregated data
    getBrandMonthlyData
};

// ================================
// PLATFORM METRICS CACHE
// ================================
const PLATFORM_METRICS_PREFIX = 'platform:metrics';
const PLATFORM_METRICS_TTL = 3600; // 1 hour

/**
 * Generate cache key for platform metrics
 */
const getPlatformMetricsCacheKey = (currStart, currEnd, prevStart, prevEnd, brand, location, category) => {
    const parts = [
        PLATFORM_METRICS_PREFIX,
        currStart,
        currEnd,
        prevStart,
        prevEnd,
        brand?.toLowerCase() || 'all',
        location?.toLowerCase() || 'all',
        category?.toLowerCase() || 'all'
    ];
    return parts.join(':');
};

/**
 * Get cached platform metrics
 * Returns: Map-like object {platform: {curr: {...}, prev: {...}}} or null
 */
export async function getCachedPlatformMetrics(currStart, currEnd, prevStart, prevEnd, brand, location, category) {
    if (!redisClient.isReady()) return null;

    try {
        const cacheKey = getPlatformMetricsCacheKey(currStart, currEnd, prevStart, prevEnd, brand, location, category);
        const cached = await redisClient.getClient().get(cacheKey);

        if (cached) {
            console.log(`📊 [Platform Metrics Cache Hit] ${currStart} to ${currEnd}`);
            // Convert the cached object back to a Map
            const data = JSON.parse(cached);
            const map = new Map();
            for (const [key, value] of Object.entries(data)) {
                map.set(key, value);
            }
            return map;
        }
        return null;
    } catch (error) {
        console.error('Error getting cached platform metrics:', error.message);
        return null;
    }
}

/**
 * Cache platform metrics
 */
export async function cachePlatformMetrics(currStart, currEnd, prevStart, prevEnd, brand, location, category, dataMap) {
    if (!redisClient.isReady()) return false;

    try {
        const cacheKey = getPlatformMetricsCacheKey(currStart, currEnd, prevStart, prevEnd, brand, location, category);
        // Convert Map to plain object for JSON serialization
        const plainObject = {};
        for (const [key, value] of dataMap) {
            plainObject[key] = value;
        }
        await redisClient.getClient().setEx(cacheKey, PLATFORM_METRICS_TTL, JSON.stringify(plainObject));
        console.log(`📊 [Platform Metrics Cache Set] ${currStart} to ${currEnd}`);
        return true;
    } catch (error) {
        console.error('Error caching platform metrics:', error.message);
        return false;
    }
}

/**
 * Coalesce identical concurrent requests
 * If same computation is in progress, wait for it instead of starting a new one
 * This prevents cache stampede where N identical requests all compute the same thing
 * 
 * Enhanced with short-TTL result caching (30s) to prevent recomputation
 * when same request comes in shortly after a previous one completed.
 * 
 * @param {string} key - Unique key identifying the computation
 * @param {Function} computeFn - Async function that performs the computation
 * @returns {Promise<any>} - Result of the computation
 */

// Short-lived result cache for coalesced requests (30s TTL)
const coalescedResultCache = new Map();
const COALESCE_CACHE_TTL = 30000; // 30 seconds

// Cleanup stale cache entries periodically (every 60s)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of coalescedResultCache.entries()) {
        if (now - entry.timestamp > COALESCE_CACHE_TTL) {
            coalescedResultCache.delete(key);
        }
    }
}, 60000);

export async function coalesceRequest(key, computeFn) {
    // Check if we have a recent cached result
    const cached = coalescedResultCache.get(key);
    if (cached && Date.now() - cached.timestamp < COALESCE_CACHE_TTL) {
        console.log(`⚡ [Coalesce Cache] Returning cached result: ${key}`);
        return cached.result;
    }

    // Check if same computation is already in progress
    if (inFlightRequests.has(key)) {
        console.log(`🔄 [Coalesce] Waiting for in-flight request: ${key}`);
        return inFlightRequests.get(key);
    }

    // Start new computation and track it
    const promise = (async () => {
        try {
            console.log(`🚀 [Coalesce] Starting computation: ${key}`);
            const result = await computeFn();
            console.log(`✅ [Coalesce] Completed: ${key}`);

            // Cache the result for short TTL
            coalescedResultCache.set(key, { result, timestamp: Date.now() });

            return result;
        } finally {
            // Remove from in-flight tracking when done
            inFlightRequests.delete(key);
        }
    })();

    inFlightRequests.set(key, promise);
    return promise;
}
