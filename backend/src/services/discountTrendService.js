/**
 * Discount Trend Service
 * Provides average discount data by Category and Brand per Platform
 * For the Discount Trend drilldown table on Pricing Analysis page
 */

import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

/**
 * Get available platforms from rb_pdp_olap table
 * @param {Object} replacements - { startDate, endDate }
 * @returns {Array} List of platform names
 */
async function getAvailablePlatforms(replacements) {
    const cacheKey = generateCacheKey('discount_available_platforms', replacements);
    return await getCachedOrCompute(cacheKey, async () => {
        const platformQuery = `
            SELECT DISTINCT Platform
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${replacements.startDate}' AND '${replacements.endDate}'
              AND Platform IS NOT NULL
              AND Platform != ''
            ORDER BY Platform
        `;
        const platformResults = await queryClickHouse(platformQuery);
        return platformResults.map(r => r.Platform);
    }, CACHE_TTL.LONG);
}

/**
 * Get average discount by Category per Platform
 * @param {Object} filters - { startDate, endDate }
 * @returns {Object} { success, data: [...], platforms: [...], filters }
 */
async function getDiscountByCategory(filters = {}) {
    console.log('[DiscountTrendService] getDiscountByCategory called with filters:', filters);
    const cacheKey = generateCacheKey('discount_by_category', filters);

    return await getCachedOrCompute(cacheKey, async () => {
        try {

            // Date range
            const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
            const startDate = filters.startDate || dayjs().subtract(30, 'days').format('YYYY-MM-DD');

            const replacements = { startDate, endDate };

            // First, get available platforms
            const platforms = await getAvailablePlatforms(replacements);
            console.log('[DiscountTrendService] Available platforms:', platforms);

            // SQL query to calculate average discount by Category and Platform
            // Only include categories that have status = 1 in rca_sku_dim
            const query = `
            SELECT
                Category,
                Platform,
                ROUND(AVG(CASE WHEN Discount IS NOT NULL AND toFloat64(Discount) >= 0 THEN toFloat64(Discount) ELSE NULL END), 1) AS avgDiscount
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${startDate}' AND '${endDate}'
              AND Category IS NOT NULL
              AND Category != ''
              AND Platform IS NOT NULL
              AND Category IN (
                  SELECT DISTINCT Category 
                  FROM rca_sku_dim 
                  WHERE status = 1 AND Category IS NOT NULL AND Category != ''
              )
            GROUP BY Category, Platform
            ORDER BY Category, Platform
        `;

            console.log('[DiscountTrendService] Executing discount by category query...');
            const queryStart = Date.now();

            const results = await queryClickHouse(query);


            console.log(`[DiscountTrendService] Query completed in ${Date.now() - queryStart}ms, found ${results?.length || 0} results`);

            // Transform results into category-platform structure with dynamic platform keys
            const categoryMap = {};

            (results || []).forEach(row => {
                const category = row.Category;
                const platform = row.Platform; // Keep original case
                const avgDiscount = parseFloat(row.avgDiscount) || 0;

                if (!categoryMap[category]) {
                    // Initialize with all platforms set to 0
                    categoryMap[category] = { category };
                    platforms.forEach(p => {
                        categoryMap[category][p] = 0;
                    });
                }

                // Set the discount for this platform
                categoryMap[category][platform] = avgDiscount;
            });

            // Convert to array and calculate total (average across all platforms)
            const data = Object.values(categoryMap).map(item => {
                const platformValues = platforms.map(p => item[p] || 0);
                const total = platformValues.length > 0
                    ? parseFloat((platformValues.reduce((sum, v) => sum + v, 0) / platformValues.length).toFixed(1))
                    : 0;
                return { ...item, total };
            });

            // Sort by category name
            data.sort((a, b) => a.category.localeCompare(b.category));

            console.log(`[DiscountTrendService] Returning ${data.length} category discount records`);

            return {
                success: true,
                data,
                platforms, // Return list of platforms for frontend to use as column headers
                filters: {
                    startDate,
                    endDate
                },
                summary: {
                    total: data.length
                }
            };

        } catch (error) {
            console.error('[DiscountTrendService] Error in getEcpComparison:', error);
            return {
                success: false,
                data: [],
                platforms: [],
                error: error.message,
                filters: {
                    startDate: filters.startDate,
                    endDate: filters.endDate
                }
            };
        }
    }, CACHE_TTL.ONE_HOUR);
}

/**
 * Get average discount by Brand within a Category per Platform
 * @param {Object} filters - { category, startDate, endDate }
 * @returns {Object} { success, data: [...], platforms: [...], filters }
 */
async function getDiscountByBrand(filters = {}) {
    console.log('[DiscountTrendService] getDiscountByBrand called with filters:', filters);
    const cacheKey = generateCacheKey('discount_by_brand', filters);

    return await getCachedOrCompute(cacheKey, async () => {
        try {

            const { category } = filters;

            if (!category) {
                return {
                    success: false,
                    data: [],
                    platforms: [],
                    error: 'Category is required'
                };
            }

            // Date range
            const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
            const startDate = filters.startDate || dayjs().subtract(30, 'days').format('YYYY-MM-DD');

            const replacements = { startDate, endDate, category };

            // First, get available platforms for this category
            const platformQuery = `
            SELECT DISTINCT Platform
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${startDate}' AND '${endDate}'
              AND Category = '${category}'
              AND Platform IS NOT NULL
              AND Platform != ''
            ORDER BY Platform
        `;
            const platformResults = await queryClickHouse(platformQuery);
            const platforms = platformResults.map(r => r.Platform);

            // SQL query to calculate average discount by Brand and Platform for a specific Category
            const query = `
            SELECT
                Brand,
                Platform,
                ROUND(AVG(CASE WHEN Discount IS NOT NULL AND toFloat64(Discount) >= 0 THEN toFloat64(Discount) ELSE NULL END), 1) AS avgDiscount
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${startDate}' AND '${endDate}'
              AND Category = '${category}'
              AND Brand IS NOT NULL
              AND Brand != ''
              AND Platform IS NOT NULL
            GROUP BY Brand, Platform
            ORDER BY Brand, Platform
        `;

            console.log('[DiscountTrendService] Executing discount by brand query...');
            const queryStart = Date.now();

            const results = await queryClickHouse(query);


            console.log(`[DiscountTrendService] Query completed in ${Date.now() - queryStart}ms, found ${results?.length || 0} results`);

            // Transform results into brand-platform structure with dynamic platform keys
            const brandMap = {};

            (results || []).forEach(row => {
                const brand = row.Brand;
                const platform = row.Platform; // Keep original case
                const avgDiscount = parseFloat(row.avgDiscount) || 0;

                if (!brandMap[brand]) {
                    // Initialize with all platforms set to 0
                    brandMap[brand] = { brand };
                    platforms.forEach(p => {
                        brandMap[brand][p] = 0;
                    });
                }

                // Set the discount for this platform
                brandMap[brand][platform] = avgDiscount;
            });

            // Convert to array and calculate total (average across all platforms)
            const data = Object.values(brandMap).map(item => {
                const platformValues = platforms.map(p => item[p] || 0);
                const total = platformValues.length > 0
                    ? parseFloat((platformValues.reduce((sum, v) => sum + v, 0) / platformValues.length).toFixed(1))
                    : 0;
                return { ...item, total };
            });

            // Sort by brand name
            data.sort((a, b) => a.brand.localeCompare(b.brand));

            console.log(`[DiscountTrendService] Returning ${data.length} brand discount records for category: ${category}`);

            return {
                success: true,
                data,
                platforms,
                category,
                filters: {
                    startDate,
                    endDate,
                    category
                },
                summary: {
                    total: data.length
                }
            };

        } catch (error) {
            console.error('[DiscountTrendService] Error in getDiscountByBrand:', error);
            return {
                success: false,
                data: [],
                platforms: [],
                error: error.message,
                filters: {
                    startDate: filters.startDate,
                    endDate: filters.endDate,
                    category: filters.category
                }
            };
        }
    }, CACHE_TTL.ONE_HOUR);
}

export default {
    getDiscountByCategory,
    getDiscountByBrand
};
