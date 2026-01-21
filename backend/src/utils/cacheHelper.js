import redisClient from '../config/redis.js';

/**
 * Generates a consistent cache key from filter parameters
 * @param {string} section - Section name (e.g., 'summary', 'performanceMarketing')
 * @param {object} filters - Filter parameters
 * @returns {string} Cache key
 */
export function generateCacheKey(section, filters) {
    // 1. Extract and Normalize Parent Filters
    const rawPlatform = filters['platform[]'] || filters.platform || 'all';
    // Support both 'brand' (singular) and 'brands' (plural - used by brand-comparison-trends)
    const rawBrand = filters['brand[]'] || filters.brand || filters.brands || 'all';
    const rawLocation = filters['location[]'] || filters.location || 'all';


    const normalize = (val) => {
        if (!val || val === 'all' || val === 'All') return 'all';
        let values = [];
        if (Array.isArray(val)) {
            values = val;
        } else if (typeof val === 'string' && val.includes(',')) {
            values = val.split(',');
        } else {
            return String(val).toLowerCase().trim().replace(/\s+/g, '_');
        }
        return values
            .map(v => String(v || '').toLowerCase().trim().replace(/\s+/g, '_'))
            .filter(Boolean)
            .sort()
            .join(',');
    };

    const p = normalize(rawPlatform);
    const b = normalize(rawBrand);
    const l = normalize(rawLocation);

    // 2. Start building key with hierarchical prefix
    // watchtower:p_{platform}:b_{brand}:l_{location}:s_{section}
    let key = `watchtower:p_${p}:b_${b}:l_${l}:s_${normalize(section)}`;

    // 3. Extract other filters
    const {
        startDate = '',
        endDate = '',
        compareStartDate = '',
        compareEndDate = '',
        category = 'all',
        region = 'all',
        level = '',
        viewMode = '',
        period = '',
        timeStep = '',
        page = '',
        limit = '',
        signalType = '',
        type = '', // Often used in Signal Lab instead of section
        webPid = '',
        filterType = '', // Filter type for filter-options endpoints
        // Section-specific platform/category overrides
        monthOverviewPlatform = '',
        categoryOverviewPlatform = '',
        brandsOverviewPlatform = '',
        brandsOverviewCategory = ''
    } = filters;

    // 4. Append secondary filters
    if (filterType) key += `:ft_${normalize(filterType)}`;
    if (viewMode) key += `:vm_${normalize(viewMode)}`;
    if (level) key += `:lv_${normalize(level)}`;
    if (region && region !== 'all') key += `:reg_${normalize(region)}`;
    if (category && category !== 'all') key += `:cat_${normalize(category)}`;
    if (type && type !== 'all') key += `:tp_${normalize(type)}`;
    if (signalType) key += `:sig_${normalize(signalType)}`;
    if (webPid) key += `:pid_${normalize(webPid)}`;

    // Pagination
    if (page) key += `:pg_${page}`;
    if (limit) key += `:lim_${limit}`;

    // Date ranges
    if (startDate && endDate) {
        key += `:dt_${startDate}_${endDate}`;
    }
    if (compareStartDate && compareEndDate) {
        key += `:comp_${compareStartDate}_${compareEndDate}`;
    }

    // Trends specific
    if (period) key += `:pd_${normalize(period)}`;
    if (timeStep) key += `:ts_${normalize(timeStep)}`;

    // Section-specific platform/category overrides (for By Month, By Category, By Brands tabs)
    if (monthOverviewPlatform) key += `:mop_${normalize(monthOverviewPlatform)}`;
    if (categoryOverviewPlatform) key += `:cop_${normalize(categoryOverviewPlatform)}`;
    if (brandsOverviewPlatform) key += `:bop_${normalize(brandsOverviewPlatform)}`;
    if (brandsOverviewCategory) key += `:boc_${normalize(brandsOverviewCategory)}`;

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

        // Warm platform list (used in every dropdown) - uses ClickHouse
        const platformKey = 'watchtower:platforms:all';
        const platforms = await watchTowerService.getPlatforms();
        await setCached(platformKey, platforms, CACHE_TTL.VERY_STATIC);

        console.log('✅ Cache warming complete: platforms');
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
