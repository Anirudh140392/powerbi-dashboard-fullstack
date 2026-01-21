/**
 * Brand Price Overview Service (OPTIMIZED)
 * Provides ECP data grouped by Brand, Platform, and Gram Size
 * Uses rb_pdp_olap for price data and rb_sku_platform for size data
 */

import sequelize from '../config/db.js';
import dayjs from 'dayjs';

/**
 * Get Brand Price Overview data (OPTIMIZED for speed)
 * @param {Object} filters - { startDate, endDate, platform }
 * @returns {Object} { success, data: [...], filters: {...} }
 */
async function getBrandPriceOverview(filters = {}) {
    try {
        console.log('[BrandPriceOverviewService] getBrandPriceOverview called with filters:', filters);

        // Date range for calculation
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const startDate = filters.startDate || dayjs().subtract(30, 'days').format('YYYY-MM-DD');
        const platform = filters.platform || null;

        const replacements = {
            startDate,
            endDate
        };

        // Build platform filter clause
        let platformFilter = '';
        if (platform && platform !== 'All') {
            platformFilter = 'AND p.Platform = :platform';
            replacements.platform = platform;
        }

        // OPTIMIZED SQL query - removed trend calculation for speed
        // Uses INNER JOIN instead of LEFT JOIN for better performance
        const query = `
            SELECT
                p.Brand,
                p.Platform,
                s.quantity AS gram_size,
                s.Unit AS unit,
                ROUND(AVG(p.Selling_Price), 1) AS ecp,
                ROUND(AVG(p.MRP), 1) AS mrp,
                ROUND(AVG(p.Discount), 1) AS discount,
                COUNT(*) AS record_count
            FROM rb_pdp_olap p
            INNER JOIN rb_sku_platform s ON p.Web_Pid = s.web_pid
            WHERE p.DATE BETWEEN :startDate AND :endDate
              AND p.Brand IS NOT NULL
              AND p.Brand != ''
              AND p.Platform IS NOT NULL
              AND p.Platform != ''
              AND p.Selling_Price > 0
              AND s.quantity IS NOT NULL 
              AND s.quantity != '' 
              AND s.quantity != '0'
              ${platformFilter}
            GROUP BY p.Brand, p.Platform, s.quantity, s.Unit
            ORDER BY p.Brand, p.Platform
            LIMIT 500
        `;

        console.log('[BrandPriceOverviewService] Executing optimized query...');
        const queryStart = Date.now();

        const [results] = await sequelize.query(query, { replacements });

        console.log(`[BrandPriceOverviewService] Query completed in ${Date.now() - queryStart}ms, found ${results?.length || 0} results`);

        // Transform results
        const data = (results || []).map((row, index) => {
            const ecp = parseFloat(row.ecp) || 0;
            const mrp = parseFloat(row.mrp) || 0;
            const discount = parseFloat(row.discount) || 0;

            // Normalize gram size display
            const gramSize = row.gram_size && row.unit
                ? `${row.gram_size}${row.unit.toLowerCase()}`
                : row.gram_size
                    ? `${row.gram_size}g`
                    : 'Unknown';

            return {
                id: index + 1,
                brand: row.Brand,
                platform: row.Platform,
                gramSize: gramSize,
                ecp: ecp,
                ecpWithoutDisc: mrp,
                discount: discount,
                trend: discount > 15 ? 'down' : 'up' // Simple trend based on discount
            };
        });

        console.log(`[BrandPriceOverviewService] Returning ${data.length} records`);

        return {
            success: true,
            data,
            filters: {
                startDate,
                endDate
            },
            summary: {
                total: data.length
            }
        };

    } catch (error) {
        console.error('[BrandPriceOverviewService] Error:', error);
        return {
            success: false,
            data: [],
            error: error.message,
            filters: {
                startDate: filters.startDate,
                endDate: filters.endDate
            }
        };
    }
}

export default {
    getBrandPriceOverview
};
