import redisClient from '../config/redis.js';

/**
 * Generates a consistent cache key from filter parameters
 * @param {string} section - Section name (e.g., 'summary', 'performanceMarketing')
 * @param {object} filters - Filter parameters
 * @returns {string} Cache key
 */
export function generateCacheKey(section, filters) {
    const {
        platform = 'all',
        brand = 'all',
        location = 'all',
        startDate = '',
        endDate = '',
        category = 'all',
        monthOverviewPlatform = '',
        categoryOverviewPlatform = '',
        brandsOverviewPlatform = '',
        brandsOverviewCategory = '',
        period = '',
        timeStep = ''
    } = filters;

    // Normalize values to lowercase for consistency
    const normalize = (val) => String(val || 'all').toLowerCase().replace(/\s+/g, '_');

    // Build key based on section
    let key = `watchtower:${normalize(section)}`;

    // Add common filters
    key += `:${normalize(platform)}:${normalize(brand)}:${normalize(location)}`;

    // Add dates if present
    if (startDate && endDate) {
        key += `:${startDate}:${endDate}`;
    }

    // Add section-specific filters
    if (category && category !== 'all') {
        key += `:${normalize(category)}`;
    }

    if (monthOverviewPlatform) {
        key += `:mo_${normalize(monthOverviewPlatform)}`;
    }

    if (categoryOverviewPlatform) {
        key += `:co_${normalize(categoryOverviewPlatform)}`;
    }

    if (brandsOverviewPlatform) {
        key += `:bo_${normalize(brandsOverviewPlatform)}`;
        if (brandsOverviewCategory) {
            key += `:${normalize(brandsOverviewCategory)}`;
        }
    }

    // Add trend-specific filters
    if (period) {
        key += `:pd_${normalize(period)}`;
    }

    if (timeStep) {
        key += `:ts_${normalize(timeStep)}`;
    }

    return key;
}

/**
 * Get cached data
 * @param {string} key - Cache key
 * @returns {Promise<object|null>} Cached data or null
 */
export async function getCached(key) {
    if (!redisClient.isReady()) {
        return null;
    }

    try {
        const data = await redisClient.getClient().get(key);
        if (data) {
            return JSON.parse(data);
        }
        return null;
    } catch (error) {
        console.error(`Error getting cache for key ${key}:`, error.message);
        return null;
    }
}

/**
 * Set cached data with TTL
 * @param {string} key - Cache key
 * @param {object} data - Data to cache
 * @param {number} ttl - Time to live in seconds (default: 3600 = 1 hour for metrics)
 * @returns {Promise<boolean>} Success status
 */
export async function setCached(key, data, ttl = 3600) {
    if (!redisClient.isReady()) {
        return false;
    }

    try {
        const serialized = JSON.stringify(data);
        await redisClient.getClient().setEx(key, ttl, serialized);
        return true;
    } catch (error) {
        console.error(`Error setting cache for key ${key}:`, error.message);
        return false;
    }
}

// Tiered TTL constants for different data types
export const CACHE_TTL = {
    VERY_STATIC: 604800,    // 7 days - platforms, brands (almost never change)
    STATIC: 86400,          // 24 hours - categories, locations (rarely change)
    METRICS: 7200,          // 2 hours - aggregated metrics (increased for better repeat performance)
    COMPUTED_HEAVY: 14400,  // 4 hours - expensive computations (bulk operations)
    REALTIME: 600,          // 10 minutes - real-time dashboards (increased)
    SHORT: 300,             // 5 minutes - very dynamic data (increased)
    TRENDING: 180           // 3 minutes - trending/live data
};

/**
 * Warm cache with common queries on startup
 * Pre-populates frequently accessed static data
 */
export async function warmCommonCaches() {
    if (!redisClient.isReady()) {
        console.log('⚠️  Redis not ready, skipping cache warming');
        return;
    }

    try {
        console.log('🔥 Warming common caches...');

        // Import services (lazy to avoid circular dependencies)
        const { default: watchTowerService } = await import('../services/watchTowerService.js');
        const { getAllMetricKeys } = await import('../services/keyMetricsService.js');

        // Warm platform list (used in every dropdown)
        const platformKey = 'watchtower:platforms:all';
        const platforms = await watchTowerService.getPlatforms();
        await setCached(platformKey, platforms, CACHE_TTL.VERY_STATIC);

        // Warm metric keys (used in SKU metrics dropdown)
        const metricKeysKey = 'metric_keys';
        const metricKeys = await getAllMetricKeys();
        await setCached(metricKeysKey, metricKeys, CACHE_TTL.VERY_STATIC);

        console.log('✅ Cache warming complete: platforms, metric keys');
    } catch (error) {
        console.error('❌ Error warming cache:', error.message);
        // Don't throw - cache warming is optional
    }
}

/**
 * Delete cached data by key or pattern
 * @param {string} pattern - Cache key or pattern (e.g., 'watchtower:*')
 * @returns {Promise<number>} Number of keys deleted
 */
export async function deleteCached(pattern) {
    if (!redisClient.isReady()) {
        return 0;
    }

    try {
        const keys = await redisClient.getClient().keys(pattern);
        if (keys.length > 0) {
            return await redisClient.getClient().del(keys);
        }
        return 0;
    } catch (error) {
        console.error(`Error deleting cache for pattern ${pattern}:`, error.message);
        return 0;
    }
}

/**
 * Main caching wrapper - get from cache or compute
 * @param {string} key - Cache key
 * @param {Function} computeFn - Async function to compute data if cache miss
 * @param {number} ttl - Time to live in seconds (default: 3600 = 1 hour)
 * @returns {Promise<object>} Cached or computed data
 */
export async function getCachedOrCompute(key, computeFn, ttl = 3600) {
    // Try to get from cache first
    const cached = await getCached(key);

    if (cached !== null) {
        // Only log if explicitly enabled
        if (process.env.LOG_CACHE === 'true') {
            console.log(`✅ Cache HIT: ${key}`);
        }
        return cached;
    }

    // Only log cache misses if enabled
    if (process.env.LOG_CACHE === 'true') {
        console.log(`❌ Cache MISS: ${key}`);
    }

    // Compute the result
    const result = await computeFn();

    // Store in cache (non-blocking)
    setCached(key, result, ttl).catch(err => {
        console.error('Failed to cache result:', err.message);
    });

    return result;
}

/**
 * Get cache statistics
 * @returns {Promise<object>} Cache stats
 */
export async function getCacheStats() {
    if (!redisClient.isReady()) {
        return {
            enabled: false,
            connected: false
        };
    }

    try {
        const client = redisClient.getClient();
        const info = await client.info('stats');
        const dbSize = await client.dbSize();

        return {
            enabled: true,
            connected: true,
            totalKeys: dbSize,
            info: info
        };
    } catch (error) {
        console.error('Error getting cache stats:', error.message);
        return {
            enabled: true,
            connected: false,
            error: error.message
        };
    }
}
