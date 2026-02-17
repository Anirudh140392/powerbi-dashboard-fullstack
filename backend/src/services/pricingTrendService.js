/**
 * Pricing Trend Service
 * Provides overall Pricing, Discount, and RPI trends for the Snapshot Overview sparklines
 */

import { queryClickHouse } from '../config/clickhouse.js';
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
 * Helper to build SQL IN clause for multiselect
 */
const buildInClause = (column, values) => {
    if (!values || values.length === 0) return null;
    const escaped = values.map(v => `'${escapeStr(v)}'`).join(',');
    return `${column} IN (${escaped})`;
};

/**
 * Get overall pricing trends (ECP, RPI, Discount)
 * @param {Object} filters - { startDate, endDate, platform, location, brand }
 * @returns {Object} { success, data: { ecp: [], rpi: [], discount: [], labels: [] } }
 */
async function getPricingTrends(filters = {}) {
    console.log('[PricingTrendService] getPricingTrends called with filters:', filters);
    const cacheKey = generateCacheKey('pricing_overview_trends', filters);

    return await getCachedOrCompute(cacheKey, async () => {
        try {
            // Default to last 6 months if no date provided, or use provided range
            // For sparklines, we want a time series. 
            // If range is > 2 months, group by month. If < 2 months, group by week or day?
            // Let's stick to Month for now as consistent with other charts, 
            // but for "Overview" sparklines, maybe "Weekly" or "Daily" is better if the range is short?
            // To keep it simple and performant, let's use Month for long ranges, and Day for short ranges (< 60 days).

            const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
            const startDate = filters.startDate || dayjs().subtract(6, 'months').format('YYYY-MM-DD');

            const daysDiff = dayjs(endDate).diff(dayjs(startDate), 'day');

            let timeFormat, timeLabel, conversion;

            if (daysDiff > 90) {
                // Monthly
                timeFormat = '%Y-%m';
                timeLabel = '%b %Y';
                conversion = 'toStartOfMonth';
            } else {
                // Daily (or maybe weekly? let's do Daily for granular sparkline)
                timeFormat = '%Y-%m-%d';
                timeLabel = '%d %b';
                conversion = 'toDate';
            }

            // Build filters
            let whereConditions = [
                `DATE BETWEEN '${startDate}' AND '${endDate}'`,
                "Selling_Price IS NOT NULL",
                "toFloat64(Selling_Price) > 0"
            ];

            // Platform
            const platforms = parseMultiSelectFilter(filters.platform);
            if (platforms) whereConditions.push(buildInClause('Platform', platforms));

            // Location
            const locations = parseMultiSelectFilter(filters.location);
            if (locations) whereConditions.push(buildInClause('Location', locations));

            // Brand
            const brands = parseMultiSelectFilter(filters.brand);
            if (brands) whereConditions.push(buildInClause('Brand', brands));

            const whereClause = whereConditions.join(' AND ');

            const query = `
                SELECT
                    formatDateTime(${conversion}(DATE), '${timeFormat}') as timeKey,
                    formatDateTime(${conversion}(DATE), '${timeLabel}') as label,
                    ROUND(AVG(toFloat64(Selling_Price)), 1) as avgEcp,
                    ROUND(AVG(toFloat64(Selling_Price)) / NULLIF(AVG(toFloat64OrZero(MRP)), 0), 2) as avgRpi,
                    ROUND(AVG(CASE WHEN Discount IS NOT NULL AND toFloat64(Discount) >= 0 THEN toFloat64(Discount) ELSE NULL END), 1) as avgDiscount
                FROM rb_pdp_olap
                WHERE ${whereClause}
                GROUP BY timeKey, label
                ORDER BY timeKey ASC
            `;

            console.log('[PricingTrendService] Executing query...');
            const results = await queryClickHouse(query);

            if (!results || results.length === 0) {
                return {
                    success: true,
                    data: { ecp: [], rpi: [], discount: [], labels: [] }
                };
            }

            const ecp = results.map(r => parseFloat(r.avgEcp));
            const rpi = results.map(r => parseFloat(r.avgRpi));
            const discount = results.map(r => parseFloat(r.avgDiscount));
            const labels = results.map(r => r.label);

            return {
                success: true,
                data: { ecp, rpi, discount, labels }
            };

        } catch (error) {
            console.error('[PricingTrendService] Error:', error);
            return {
                success: false,
                data: { ecp: [], rpi: [], discount: [], labels: [] },
                error: error.message
            };
        }
    }, CACHE_TTL.ONE_HOUR);
}

export default {
    getPricingTrends
};
