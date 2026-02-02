/**
 * ECP Weekday/Weekend Service
 * Calculates average ECP (Selling Price) by Brand, split by weekday vs weekend
 * Uses Date column to determine day of week
 */

import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';

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
 * Helper to build SQL IN clause for multiselect
 */
const buildInClause = (column, values) => {
    if (!values || values.length === 0) return null;
    const escaped = values.map(v => `'${escapeStr(v)}'`).join(',');
    return `${column} IN (${escaped})`;
};

/**
 * Get average ECP by Brand split by Weekday vs Weekend
 * ClickHouse toDayOfWeek: 1=Monday, ..., 7=Sunday
 * Weekday = Monday-Friday (1-5)
 * Weekend = Saturday-Sunday (6, 7)
 * 
 * @param {Object} filters - { platform, location, startDate, endDate, brand }
 * @returns {Object} { success, data: [...], filters }
 */
async function getEcpWeekdayWeekend(filters = {}) {
    try {
        console.log('[EcpWeekdayWeekendService] getEcpWeekdayWeekend called with filters:', filters);

        const { platform, location, brand } = filters;

        // Date range
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const startDate = filters.startDate || dayjs().subtract(30, 'days').format('YYYY-MM-DD');

        const conditions = [`DATE BETWEEN '${startDate}' AND '${endDate}'`];

        // Apply platform filter (supports multiselect)
        const platforms = parseMultiSelectFilter(platform);
        if (platforms) {
            conditions.push(buildInClause('Platform', platforms));
        }

        // Apply location filter (supports multiselect)
        const locations = parseMultiSelectFilter(location);
        if (locations) {
            conditions.push(buildInClause('Location', locations));
        }

        // Apply brand filter (optional - when clicking on a specific brand, supports multiselect)
        const brands = parseMultiSelectFilter(brand);
        if (brands && !brands.includes('All Brands')) {
            conditions.push(buildInClause('Brand', brands));
        }

        const whereClause = conditions.join(' AND ');

        // SQL query to calculate average ECP by Brand split by weekday/weekend
        // ClickHouse toDayOfWeek: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
        // Weekday = 1,2,3,4,5
        // Weekend = 6,7
        const query = `
            SELECT
                Brand,
                ROUND(AVG(CASE 
                    WHEN toDayOfWeek(DATE) IN (1,2,3,4,5) 
                    THEN toFloat64(Selling_Price) 
                    ELSE NULL 
                END), 2) AS weekdayEcp,
                ROUND(AVG(CASE 
                    WHEN toDayOfWeek(DATE) IN (6,7) 
                    THEN toFloat64(Selling_Price) 
                    ELSE NULL 
                END), 2) AS weekendEcp
            FROM rb_pdp_olap
            WHERE ${whereClause}
              AND Brand IS NOT NULL
              AND Brand != ''
              AND toFloat64(Selling_Price) > 0
            GROUP BY Brand
            ORDER BY Brand
        `;

        console.log('[EcpWeekdayWeekendService] Executing query...');
        const queryStart = Date.now();

        const results = await queryClickHouse(query);


        console.log(`[EcpWeekdayWeekendService] Query completed in ${Date.now() - queryStart}ms, found ${results?.length || 0} results`);

        // Transform to frontend-friendly format
        const data = (results || []).map(row => ({
            brand: row.Brand,
            weekday: parseFloat(row.weekdayEcp) || 0,
            weekend: parseFloat(row.weekendEcp) || 0
        }));

        // Calculate overall totals (average across all brands)
        let totalWeekday = 0, totalWeekend = 0, countWeekday = 0, countWeekend = 0;
        data.forEach(row => {
            if (row.weekday > 0) { totalWeekday += row.weekday; countWeekday++; }
            if (row.weekend > 0) { totalWeekend += row.weekend; countWeekend++; }
        });

        const allBrandsRow = {
            brand: 'All Brands',
            weekday: countWeekday > 0 ? parseFloat((totalWeekday / countWeekday).toFixed(2)) : 0,
            weekend: countWeekend > 0 ? parseFloat((totalWeekend / countWeekend).toFixed(2)) : 0
        };

        console.log(`[EcpWeekdayWeekendService] Returning ${data.length} brand records`);

        return {
            success: true,
            data,
            summary: allBrandsRow,
            filters: {
                startDate,
                endDate,
                platform,
                location,
                brand
            }
        };

    } catch (error) {
        console.error('[EcpWeekdayWeekendService] Error in getEcpWeekdayWeekend:', error);
        return {
            success: false,
            data: [],
            error: error.message,
            filters: {
                startDate: filters.startDate,
                endDate: filters.endDate,
                platform: filters.platform,
                location: filters.location,
                brand: filters.brand
            }
        };
    }
}

export default {
    getEcpWeekdayWeekend
};
