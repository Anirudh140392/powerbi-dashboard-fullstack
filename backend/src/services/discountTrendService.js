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

    // No caching here for now to ensure we get fresh data while debugging/developing
    try {
        const metricType = filters.metricType || 'discount';
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const startDate = filters.startDate || dayjs().subtract(30, 'days').format('YYYY-MM-DD');

        const replacements = { startDate, endDate };

        // First, get available platforms
        const platforms = await getAvailablePlatforms(replacements);
        console.log('[DiscountTrendService] Available platforms:', platforms);

        const query = `
        SELECT
            p.Category,
            p.Platform,
            ROUND(AVG(CASE WHEN p.Discount IS NOT NULL AND toFloat64(p.Discount) >= 0 THEN toFloat64(p.Discount) ELSE NULL END), 1) AS avgDiscount,
            ROUND(AVG(toFloat64OrZero(p.Selling_Price)), 1) AS avgEcp,
            ROUND(AVG(toFloat64OrZero(p.Selling_Price)) / NULLIF(AVG(toFloat64OrZero(p.MRP)), 0), 2) AS avgRpi
        FROM rb_pdp_olap p
        INNER JOIN (
            SELECT DISTINCT category
            FROM rca_sku_dim
            WHERE status = 1 AND category IS NOT NULL AND category != ''
        ) d ON p.Category = d.category
        WHERE p.DATE BETWEEN '${startDate}' AND '${endDate}'
          AND p.Category IS NOT NULL
          AND p.Category != ''
          AND p.Platform IS NOT NULL
        GROUP BY p.Category, p.Platform
        ORDER BY p.Category, p.Platform
        `;

        console.log('[DiscountTrendService] Executing discount by category query...');
        const results = await queryClickHouse(query);

        // Transform results into category-platform structure
        const categoryMap = {};

        (results || []).forEach(row => {
            const category = row.Category;
            const platform = row.Platform;

            let val = 0;
            if (metricType === 'ecp') val = parseFloat(row.avgEcp) || 0;
            else if (metricType === 'rpi') val = parseFloat(row.avgRpi) || 0;
            else val = parseFloat(row.avgDiscount) || 0;

            if (!categoryMap[category]) {
                categoryMap[category] = { category };
                platforms.forEach(p => {
                    categoryMap[category][p] = 0;
                });
            }
            categoryMap[category][platform] = val;
        });

        const data = Object.values(categoryMap).map(item => {
            const platformValues = platforms.map(p => item[p] || 0);
            const total = platformValues.length > 0
                ? parseFloat((platformValues.reduce((sum, v) => sum + v, 0) / platformValues.length).toFixed(metricType === 'rpi' ? 2 : 1))
                : 0;
            return { ...item, total };
        });

        data.sort((a, b) => a.category.localeCompare(b.category));

        return {
            success: true,
            data,
            platforms,
            filters: { startDate, endDate, metricType },
            summary: { total: data.length }
        };
    } catch (error) {
        console.error('[DiscountTrendService] Error:', error);
        return { success: false, data: [], error: error.message };
    }
}

async function getDiscountByBrand(filters = {}) {
    console.log('[DiscountTrendService] getDiscountByBrand called with filters:', filters);
    try {
        const { category } = filters;
        const metricType = filters.metricType || 'discount';
        if (!category) return { success: false, error: 'Category is required' };

        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const startDate = filters.startDate || dayjs().subtract(30, 'days').format('YYYY-MM-DD');

        const platformQuery = `
            SELECT DISTINCT Platform FROM rb_pdp_olap
            WHERE DATE BETWEEN '${startDate}' AND '${endDate}' AND Category = '${category}' AND Platform IS NOT NULL
            ORDER BY Platform
        `;
        const platformResults = await queryClickHouse(platformQuery);
        const platforms = platformResults.map(r => r.Platform);

        const query = `
        SELECT
            Brand, Platform,
            ROUND(AVG(CASE WHEN Discount IS NOT NULL AND toFloat64(Discount) >= 0 THEN toFloat64(Discount) ELSE NULL END), 1) AS avgDiscount,
            ROUND(AVG(toFloat64OrZero(Selling_Price)), 1) AS avgEcp,
            ROUND(AVG(toFloat64OrZero(Selling_Price)) / NULLIF(AVG(toFloat64OrZero(MRP)), 0), 2) AS avgRpi
        FROM rb_pdp_olap
        WHERE DATE BETWEEN '${startDate}' AND '${endDate}' AND Category = '${category}' AND Brand IS NOT NULL AND Platform IS NOT NULL
        GROUP BY Brand, Platform
        ORDER BY Brand, Platform
        `;

        const results = await queryClickHouse(query);
        const brandMap = {};

        (results || []).forEach(row => {
            const brand = row.Brand;
            const platform = row.Platform;

            let val = 0;
            if (metricType === 'ecp') val = parseFloat(row.avgEcp) || 0;
            else if (metricType === 'rpi') val = parseFloat(row.avgRpi) || 0;
            else val = parseFloat(row.avgDiscount) || 0;

            if (!brandMap[brand]) {
                brandMap[brand] = { brand };
                platforms.forEach(p => {
                    brandMap[brand][p] = 0;
                });
            }
            brandMap[brand][platform] = val;
        });

        const data = Object.values(brandMap).map(item => {
            const platformValues = platforms.map(p => item[p] || 0);
            const total = platformValues.length > 0
                ? parseFloat((platformValues.reduce((sum, v) => sum + v, 0) / platformValues.length).toFixed(metricType === 'rpi' ? 2 : 1))
                : 0;
            return { ...item, total };
        });

        data.sort((a, b) => a.brand.localeCompare(b.brand));

        return {
            success: true,
            data,
            platforms,
            category,
            filters: { startDate, endDate, category, metricType },
            summary: { total: data.length }
        };
    } catch (error) {
        console.error('[DiscountTrendService] Error:', error);
        return { success: false, data: [], error: error.message };
    }
}

export default {
    getDiscountByCategory,
    getDiscountByBrand
};
