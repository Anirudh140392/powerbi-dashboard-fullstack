/**
 * Discount Trend Service
 * Provides average discount data by Category and Brand per Platform
 * For the Discount Trend drilldown table on Pricing Analysis page
 */

import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

// Helper to escape string for SQL
const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

/**
 * Helper to parse multiselect filter values
 */
const parseMultiSelectFilter = (value) => {
    if (!value || value === 'All') return null;
    if (Array.isArray(value)) {
        const filtered = value.filter(v => v && v !== 'All');
        return filtered.length > 0 ? filtered : null;
    }
    if (typeof value === 'string' && value.includes(',')) {
        const filtered = value.split(',').map(v => v.trim()).filter(v => v && v !== 'All');
        return filtered.length > 0 ? filtered : null;
    }
    return [value];
};

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

        const isMars = getCurrentDbName() === 'mars';
        const catCol = isMars ? 'Product_type' : 'Category';

        let mslClause = '';
        const mslArr = parseMultiSelectFilter(filters.msl);
        if (mslArr) {
            const escaped = mslArr.map(m => `'${escapeStr(m)}'`).join(',');
            mslClause = `AND toString(p.msl) IN (${escaped})`;
        }

        const query = `
        SELECT
            p.${catCol} AS Category,
            p.Platform,
            ROUND(AVG(CASE WHEN p.Discount IS NOT NULL AND ifNull(toFloat64OrZero(toString(p.Discount)), 0) >= 0 THEN ifNull(toFloat64OrZero(toString(p.Discount)), 0) ELSE NULL END), 1) AS avgDiscount,
            ROUND(AVG(CASE WHEN p.Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) ELSE NULL END), 1) AS avgOurEcp,
            ROUND(AVG(CASE WHEN p.Comp_flag = '1' THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) ELSE NULL END), 1) AS avgCompEcp
        FROM rb_pdp_olap p
        INNER JOIN (
            SELECT DISTINCT category
            FROM rca_sku_dim
            WHERE status = 1 AND category IS NOT NULL AND category != ''
        ) d ON p.${catCol} = d.category
        WHERE p.DATE BETWEEN '${startDate}' AND '${endDate}'
          AND p.${catCol} IS NOT NULL
          AND p.${catCol} != ''
          AND p.Platform IS NOT NULL
          ${mslClause}
        GROUP BY p.${catCol}, p.Platform
        ORDER BY p.${catCol}, p.Platform
        `;

        console.log('[DiscountTrendService] Executing discount by category query...');
        const results = await queryClickHouse(query);

        // Transform results into category-platform structure
        const categoryMap = {};

        (results || []).forEach(row => {
            const category = row.Category;
            const platform = row.Platform;

            let val = 0;
            if (metricType === 'ecp') val = parseFloat(row.avgOurEcp) || 0;
            else if (metricType === 'rpi') {
                const ourPrice = parseFloat(row.avgOurEcp) || 0;
                const compPrice = parseFloat(row.avgCompEcp) || 0;
                val = compPrice > 0 ? parseFloat((ourPrice / compPrice).toFixed(2)) : 1.0;
            }
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

        const isMars = getCurrentDbName() === 'mars';
        const catCol = isMars ? 'Product_type' : 'Category';

        let mslClauseP = '';
        let mslClauseNoAlias = '';
        const mslArr = parseMultiSelectFilter(filters.msl);
        if (mslArr) {
            const escaped = mslArr.map(m => `'${escapeStr(m)}'`).join(',');
            mslClauseP = `AND toString(p.msl) IN (${escaped})`;
            mslClauseNoAlias = `AND toString(msl) IN (${escaped})`;
        }

        const platformQuery = `
            SELECT DISTINCT Platform FROM rb_pdp_olap
            WHERE DATE BETWEEN '${startDate}' AND '${endDate}' AND ${catCol} = '${category}' AND Platform IS NOT NULL
              ${mslClauseNoAlias}
            ORDER BY Platform
        `;
        const platformResults = await queryClickHouse(platformQuery);
        const platforms = platformResults.map(r => r.Platform);

        const query = `
        WITH category_comp_avg AS (
            SELECT Platform, AVG(ifNull(toFloat64OrZero(toString(Selling_Price)), 0)) as avg_comp_val
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${startDate}' AND '${endDate}'
              AND ${catCol} = '${category}'
              AND Comp_flag = '1'
              AND ifNull(toFloat64OrZero(toString(Selling_Price)), 0) > 0
              ${mslClauseNoAlias}
            GROUP BY Platform
        )
        SELECT
            p.Brand, p.Platform,
            ROUND(AVG(CASE WHEN p.Discount IS NOT NULL AND ifNull(toFloat64OrZero(toString(p.Discount)), 0) >= 0 THEN ifNull(toFloat64OrZero(toString(p.Discount)), 0) ELSE NULL END), 1) AS avgDiscount,
            ROUND(AVG(ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)), 1) AS avgEcp,
            c.avg_comp_val AS avgCompEcp
        FROM rb_pdp_olap p
        LEFT JOIN category_comp_avg c ON p.Platform = c.Platform
        WHERE p.DATE BETWEEN '${startDate}' AND '${endDate}'
          AND p.${catCol} = '${category}'
          AND p.Brand IS NOT NULL
          AND p.Platform IS NOT NULL
          ${mslClauseP}
        GROUP BY p.Brand, p.Platform, c.avg_comp_val
        ORDER BY p.Brand, p.Platform
        `;

        const results = await queryClickHouse(query);
        const brandMap = {};

        (results || []).forEach(row => {
            const brand = row.Brand;
            const platform = row.Platform;

            let val = 0;
            if (metricType === 'ecp') val = parseFloat(row.avgEcp) || 0;
            else if (metricType === 'rpi') {
                const ourPrice = parseFloat(row.avgEcp) || 0;
                const compPrice = parseFloat(row.avgCompEcp) || 0;
                val = compPrice > 0 ? parseFloat((ourPrice / compPrice).toFixed(2)) : 1.0;
            }
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
