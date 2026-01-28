/**
 * One View Price Grid Service
 * Provides date-wise product pricing data with all filterable columns
 * Joins rb_pdp_olap and rb_sku_platform tables
 */

import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';

/**
 * Get One View Price Grid data
 * @param {Object} filters - All column filters as query params
 * @returns {Object} { success, data: [...], filters: {...} }
 */
async function getOneViewPriceGrid(filters = {}) {
    try {
        console.log('[OneViewPriceGridService] getOneViewPriceGrid called with filters:', filters);

        // Date range (required)
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const startDate = filters.startDate || dayjs().subtract(30, 'days').format('YYYY-MM-DD');

        // Build dynamic WHERE clauses for all optional filters
        let filterClauses = [];

        // Platform filter
        if (filters.platform && filters.platform !== 'All') {
            filterClauses.push(`p.Platform = '${filters.platform}'`);
        }

        // Brand filter
        if (filters.brand && filters.brand !== 'All') {
            filterClauses.push(`p.Brand = '${filters.brand}'`);
        }

        // Product filter (partial match - use like with %%)
        if (filters.product) {
            filterClauses.push(`p.Product LIKE '%${filters.product}%'`);
        }

        // SKU Type filter (Own/Competition based on Comp_flag)
        if (filters.skuType) {
            if (filters.skuType.toLowerCase() === 'own') {
                filterClauses.push('p.Comp_flag = 0');
            } else if (filters.skuType.toLowerCase() === 'competition') {
                filterClauses.push('p.Comp_flag = 1');
            }
        }

        // Format (Category) filter
        if (filters.format && filters.format !== 'All') {
            filterClauses.push(`p.Category = '${filters.format}'`);
        }

        // ML filter
        if (filters.ml) {
            filterClauses.push(`s.quantity = '${filters.ml}'`);
        }

        // Combine all filter clauses
        const additionalFilters = filterClauses.length > 0
            ? 'AND ' + filterClauses.join(' AND ')
            : '';

        // Main SQL query joining rb_pdp_olap and rb_sku_platform
        const query = `
            SELECT
                formatDateTime(p.DATE, '%d %b %Y') as date,
                p.DATE as rawDate,
                p.Platform as platform,
                p.Brand as brand,
                p.Product as product,
                CASE WHEN p.Comp_flag = 0 THEN 'Own' ELSE 'Competition' END as skuType,
                p.Category as format,
                s.quantity as ml,
                ROUND(AVG(toFloat64(p.MRP)), 1) as mrp,
                0 as basePrice,
                ROUND(AVG(toFloat64(p.Discount)), 1) as discount,
                ROUND(AVG(toFloat64(p.Selling_Price)), 1) as ecp
            FROM rb_pdp_olap p
            INNER JOIN rb_sku_platform s ON p.Web_Pid = s.web_pid
            WHERE p.DATE BETWEEN '${startDate}' AND '${endDate}'
              AND p.Product IS NOT NULL
              AND p.Product != ''
              AND p.Platform IS NOT NULL
              AND p.Platform != ''
              AND s.quantity IS NOT NULL
              AND s.quantity != ''
              AND s.quantity != '0'
              AND toFloat64(s.quantity) > 0
              ${additionalFilters}
            GROUP BY p.DATE, p.Platform, p.Brand, p.Product, p.Comp_flag, p.Category, s.quantity
            ORDER BY p.DATE DESC, p.Platform, p.Brand
            LIMIT 1000
        `;

        console.log('[OneViewPriceGridService] Executing query...');
        const queryStart = Date.now();

        const results = await queryClickHouse(query);


        console.log(`[OneViewPriceGridService] Query completed in ${Date.now() - queryStart}ms, found ${results?.length || 0} results`);

        // Transform results with unique IDs
        const data = (results || []).map((row, index) => ({
            id: index + 1,
            date: row.date,
            rawDate: row.rawDate,
            platform: row.platform,
            brand: row.brand,
            product: row.product,
            skuType: row.skuType,
            format: row.format,
            ml: row.ml,
            mrp: row.mrp,
            basePrice: row.basePrice,
            discount: row.discount,
            ecp: row.ecp
        }));

        console.log(`[OneViewPriceGridService] Returning ${data.length} records`);

        return {
            success: true,
            data,
            filters: {
                startDate,
                endDate,
                platform: filters.platform || 'All',
                brand: filters.brand || 'All',
                skuType: filters.skuType || 'All',
                format: filters.format || 'All'
            },
            summary: {
                total: data.length
            }
        };

    } catch (error) {
        console.error('[OneViewPriceGridService] Error:', error);
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
    getOneViewPriceGrid
};
