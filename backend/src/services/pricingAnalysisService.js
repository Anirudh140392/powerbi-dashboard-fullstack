/**
 * Pricing Analysis Service
 * Provides ECP (Effective Consumer Price) comparison logic for the Pricing Analysis page
 */

import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';

// Helper to escape string for SQL
const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';


/**
 * Get ECP Comparison between two time periods
 * @param {Object} filters - { platform, location, startDate, endDate, compareStartDate, compareEndDate }
 * @returns {Object} { data: [...], filters: {...} }
 */
async function getEcpComparison(filters = {}) {
    try {
        console.log('[PricingAnalysisService] getEcpComparison called with filters:', filters);

        // Current period (selected date range)
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const startDate = filters.startDate || dayjs().subtract(15, 'days').format('YYYY-MM-DD');

        // Comparison period (previous date range)
        let compareStartDate, compareEndDate;
        if (filters.compareStartDate && filters.compareEndDate) {
            compareStartDate = filters.compareStartDate;
            compareEndDate = filters.compareEndDate;
        } else {
            // Auto-calculate previous period of same length
            const periodDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
            compareEndDate = dayjs(startDate).subtract(1, 'day').format('YYYY-MM-DD');
            compareStartDate = dayjs(compareEndDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');
        }

        const platform = filters.platform || null;
        const location = filters.location || null;

        // Build dynamic WHERE conditions
        let whereConditions = [
            "Selling_Price IS NOT NULL",
            "Selling_Price > 0",
            "Brand IS NOT NULL",
            "Platform IS NOT NULL"
        ];
        const replacements = {
            startDate,
            endDate,
            compareStartDate,
            compareEndDate
        };

        if (platform && platform !== 'All') {
            whereConditions.push(`LOWER(Platform) = LOWER('${platform}')`);
        }

        if (location && location !== 'All') {
            whereConditions.push(`LOWER(Location) = LOWER('${location}')`);
        }

        const whereClause = whereConditions.join(' AND ');


        // SQL query to calculate ECP for both periods
        const query = `
            SELECT
                Platform,
                Brand,
                ROUND(
                    SUM(CASE WHEN DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN toFloat64(Selling_Price) ELSE 0 END)
                    / NULLIF(
                        COUNT(CASE WHEN DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN 1 END),
                        0
                    ),
                    2
                ) AS ecp_prev,
                ROUND(
                    SUM(CASE WHEN DATE BETWEEN '${startDate}' AND '${endDate}' THEN toFloat64(Selling_Price) ELSE 0 END)
                    / NULLIF(
                        COUNT(CASE WHEN DATE BETWEEN '${startDate}' AND '${endDate}' THEN 1 END),
                        0
                    ),
                    2
                ) AS ecp_curr
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${compareStartDate}' AND '${endDate}'
              AND ${whereClause}
            GROUP BY Platform, Brand
            HAVING ecp_prev IS NOT NULL AND ecp_curr IS NOT NULL
            ORDER BY Platform, Brand
        `;

        console.log('[PricingAnalysisService] Executing ECP comparison query...');
        const queryStart = Date.now();

        const results = await queryClickHouse(query);


        console.log(`[PricingAnalysisService] Query completed in ${Date.now() - queryStart}ms, found ${results?.length || 0} results`);

        // Process results and add trend labels
        const data = (results || []).map(row => {
            const ecpPrev = parseFloat(row.ecp_prev) || 0;
            const ecpCurr = parseFloat(row.ecp_curr) || 0;
            const change = ecpCurr - ecpPrev;
            const changePercent = ecpPrev > 0 ? ((change / ecpPrev) * 100) : 0;

            // Label as "up" if ecp_curr increased, "down" if decreased
            let trend = 'neutral';
            if (change > 0) {
                trend = 'up';
            } else if (change < 0) {
                trend = 'down';
            }

            return {
                brand: row.Brand,
                platform: row.Platform,
                ecp_prev: ecpPrev,
                ecp_curr: ecpCurr,
                trend,
                change: parseFloat(change.toFixed(2)),
                changePercent: parseFloat(changePercent.toFixed(2))
            };
        });

        console.log(`[PricingAnalysisService] Returning ${data.length} ECP comparison records`);

        return {
            success: true,
            data,
            filters: {
                startDate,
                endDate,
                compareStartDate,
                compareEndDate,
                platform: platform || 'All',
                location: location || 'All'
            },
            summary: {
                total: data.length,
                upCount: data.filter(d => d.trend === 'up').length,
                downCount: data.filter(d => d.trend === 'down').length,
                neutralCount: data.filter(d => d.trend === 'neutral').length
            }
        };

    } catch (error) {
        console.error('[PricingAnalysisService] Error in getEcpComparison:', error);
        return {
            success: false,
            data: [],
            error: error.message,
            filters: {
                startDate: filters.startDate,
                endDate: filters.endDate,
                compareStartDate: filters.compareStartDate,
                compareEndDate: filters.compareEndDate
            }
        };
    }
}

export default {
    getEcpComparison
};
