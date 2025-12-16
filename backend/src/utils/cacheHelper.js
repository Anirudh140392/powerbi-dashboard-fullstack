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
 * @param {number} ttl - Time to live in seconds (default: 1800 = 30 minutes)
 * @returns {Promise<boolean>} Success status
 */
export async function setCached(key, data, ttl = 1800) {
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
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<object>} Cached or computed data
 */
export async function getCachedOrCompute(key, computeFn, ttl = 1800) {
    // Try to get from cache first
    const cached = await getCached(key);

    if (cached !== null) {
        console.log(`✅ Cache HIT: ${key}`);
        return cached;
    }

    console.log(`❌ Cache MISS: ${key}`);

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
