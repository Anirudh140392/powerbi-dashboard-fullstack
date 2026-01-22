/**
 * Brand Discount Trend Service
 * Provides brand-wise average discount data on monthly basis
 * For the "Price Intelligence — Trend & RPI" chart on Pricing Analysis page
 */

import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';


/**
 * Get brand-wise discount trend on monthly basis
 * @param {Object} filters - { startDate, endDate, platform }
 * @returns {Object} { success, data: { months: [...], series: [...] }, filters }
 * 
 * Response format:
 * {
 *   months: ["Nov 2025", "Oct 2025", "Sep 2025", ...],
 *   series: [
 *     { name: "Dairy Day", data: [25.3, 22.1, 28.5, ...] },
 *     { name: "Amul", data: [18.2, 19.5, 17.8, ...] },
 *     ...
 *   ]
 * }
 */
async function getBrandDiscountTrend(filters = {}) {
    try {
        console.log('[BrandDiscountTrendService] getBrandDiscountTrend called with filters:', filters);

        // Date range - default to last 6 months
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const startDate = filters.startDate || dayjs().subtract(6, 'months').format('YYYY-MM-DD');

        // Build platform filter clause
        let platformClause = '';
        if (filters.platform && filters.platform !== 'All') {
            platformClause = `AND Platform = '${filters.platform}'`;
        }

        // SQL query to get monthly average discount by brand
        // Groups by Year-Month and Brand, calculates average discount
        const query = `
            SELECT
                Brand,
                formatDateTime(DATE, '%b %Y') as monthLabel,
                formatDateTime(DATE, '%Y-%m') as monthSort,
                ROUND(AVG(CASE WHEN Discount IS NOT NULL AND toFloat64(Discount) >= 0 THEN toFloat64(Discount) ELSE NULL END), 1) AS avgDiscount
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${startDate}' AND '${endDate}'
              AND Brand IS NOT NULL
              AND Brand != ''
              ${platformClause}
            GROUP BY Brand, monthSort, monthLabel
            ORDER BY Brand, monthSort DESC
        `;

        console.log('[BrandDiscountTrendService] Executing query...');
        const queryStart = Date.now();

        const results = await queryClickHouse(query);

        console.log(`[BrandDiscountTrendService] Query completed in ${Date.now() - queryStart}ms, found ${results?.length || 0} results`);

        if (!results || results.length === 0) {
            return {
                success: true,
                data: {
                    months: [],
                    series: []
                },
                filters: {
                    startDate,
                    endDate,
                    platform: filters.platform || 'All'
                },
                summary: {
                    totalBrands: 0,
                    totalMonths: 0
                }
            };
        }

        // Extract unique months in descending order (newest first)
        const monthsSet = new Map();
        results.forEach(row => {
            if (!monthsSet.has(row.monthSort)) {
                monthsSet.set(row.monthSort, row.monthLabel);
            }
        });

        // Sort months in descending order (newest first for display like Nov 2025, Oct 2025...)
        const sortedMonthKeys = Array.from(monthsSet.keys()).sort((a, b) => b.localeCompare(a));
        const months = sortedMonthKeys.map(key => monthsSet.get(key));

        // Group results by brand
        const brandMap = {};
        results.forEach(row => {
            const brand = row.Brand;
            if (!brandMap[brand]) {
                brandMap[brand] = {};
            }
            brandMap[brand][row.monthSort] = parseFloat(row.avgDiscount) || 0;
        });

        // Build series array with data aligned to months order
        const series = Object.keys(brandMap).sort().map(brand => {
            const data = sortedMonthKeys.map(monthKey => brandMap[brand][monthKey] || 0);
            return {
                name: brand,
                type: 'line',
                smooth: true,
                data
            };
        });

        console.log(`[BrandDiscountTrendService] Returning ${series.length} brands across ${months.length} months`);

        return {
            success: true,
            data: {
                months,
                series
            },
            filters: {
                startDate,
                endDate,
                platform: filters.platform || 'All'
            },
            summary: {
                totalBrands: series.length,
                totalMonths: months.length
            }
        };

    } catch (error) {
        console.error('[BrandDiscountTrendService] Error in getBrandDiscountTrend:', error);
        return {
            success: false,
            data: {
                months: [],
                series: []
            },
            error: error.message,
            filters: {
                startDate: filters.startDate,
                endDate: filters.endDate,
                platform: filters.platform || 'All'
            }
        };
    }
}

/**
 * Get available brands for the selected platform and date range
 * @param {Object} filters - { startDate, endDate, platform }
 * @returns {Object} { success, data: [...brand names] }
 */
async function getAvailableBrands(filters = {}) {
    try {
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const startDate = filters.startDate || dayjs().subtract(6, 'months').format('YYYY-MM-DD');


        let platformClause = '';
        if (filters.platform && filters.platform !== 'All') {
            platformClause = `AND Platform = '${filters.platform}'`;
        }

        const query = `
            SELECT DISTINCT Brand
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${startDate}' AND '${endDate}'
              AND Brand IS NOT NULL
              AND Brand != ''
              ${platformClause}
            ORDER BY Brand
        `;

        const results = await queryClickHouse(query);
        const brands = results.map(r => r.Brand);


        return {
            success: true,
            data: brands
        };

    } catch (error) {
        console.error('[BrandDiscountTrendService] Error in getAvailableBrands:', error);
        return {
            success: false,
            data: [],
            error: error.message
        };
    }
}

export default {
    getBrandDiscountTrend,
    getAvailableBrands
};
