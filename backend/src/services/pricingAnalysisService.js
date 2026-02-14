import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

// Helper to escape string for SQL
const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

/**
 * Helper to parse multiselect filter values
 * Handles: arrays, comma-separated strings, or single values
 * @param {string|array} value - Filter value(s)
 * @returns {array|null} - Array of values or null if empty/All
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
 * @param {string} column - Column name
 * @param {array} values - Array of values
 * @returns {string} - SQL condition string
 */
const buildInClause = (column, values) => {
    if (!values || values.length === 0) return null;
    const escaped = values.map(v => `'${escapeStr(v)}'`).join(',');
    return `${column} IN (${escaped})`;
};


/**
 * Get ECP Comparison between two time periods
 * @param {Object} filters - { platform, location, startDate, endDate, compareStartDate, compareEndDate }
 * @returns {Object} { data: [...], filters: {...} }
 */
async function getEcpComparison(filters = {}) {
    console.log('[PricingAnalysisService] getEcpComparison called with filters:', filters);
    const cacheKey = generateCacheKey('pricing_ecp_comparison', filters);

    return await getCachedOrCompute(cacheKey, async () => {
        try {

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
                "toFloat64(Selling_Price) > 0",
                "Brand IS NOT NULL",
                "Platform IS NOT NULL"
            ];
            const replacements = {
                startDate,
                endDate,
                compareStartDate,
                compareEndDate
            };

            // Platform filter (supports multiselect)
            const platforms = parseMultiSelectFilter(platform);
            if (platforms) {
                whereConditions.push(buildInClause('Platform', platforms));
            }

            // Location filter (supports multiselect)
            const locations = parseMultiSelectFilter(location);
            if (locations) {
                whereConditions.push(buildInClause('Location', locations));
            }

            const whereClause = whereConditions.join(' AND ');


            // SQL query to calculate ECP, MRP, and Discount for both periods
            // Join with rb_sku_platform to get pack size (gram)
            const query = `
            SELECT
                p.Platform,
                p.Brand,
                p.Product as product,
                s.gram AS pack_size,
                ROUND(
                    SUM(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN toFloat64(p.Selling_Price) ELSE 0 END)
                    / NULLIF(
                        COUNT(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND toFloat64(p.Selling_Price) > 0 THEN 1 END),
                        0
                    ),
                    2
                ) AS ecp_prev,
                ROUND(
                    SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN toFloat64(p.Selling_Price) ELSE 0 END)
                    / NULLIF(
                        COUNT(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' AND toFloat64(p.Selling_Price) > 0 THEN 1 END),
                        0
                    ),
                    2
                ) AS ecp_curr,
                ROUND(
                    SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN toFloat64(p.MRP) ELSE 0 END)
                    / NULLIF(
                        COUNT(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' AND toFloat64(p.MRP) > 0 THEN 1 END),
                        0
                    ),
                    2
                ) AS mrp_curr,
                ROUND(
                    SUM(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN toFloat64(p.MRP) ELSE 0 END)
                    / NULLIF(
                        COUNT(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND toFloat64(p.MRP) > 0 THEN 1 END),
                        0
                    ),
                    2
                ) AS mrp_prev,
                ROUND(
                    SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN toFloat64(p.Discount) ELSE 0 END)
                    / NULLIF(
                        COUNT(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN 1 END),
                        0
                    ),
                    2
                ) AS discount_curr,
                ROUND(
                    SUM(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN toFloat64(p.Discount) ELSE 0 END)
                    / NULLIF(
                        COUNT(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN 1 END),
                        0
                    ),
                    2
                ) AS discount_prev
            FROM rb_pdp_olap p
            LEFT JOIN rb_sku_platform s ON p.Web_Pid = s.web_pid
            WHERE p.DATE BETWEEN '${compareStartDate}' AND '${endDate}'
              AND p.Brand IS NOT NULL
              AND p.Platform IS NOT NULL
              AND p.Product IS NOT NULL
              AND p.Product != ''
              ${platforms ? `AND ${buildInClause('p.Platform', platforms)}` : ''}
              ${locations ? `AND ${buildInClause('p.Location', locations)}` : ''}
            GROUP BY p.Platform, p.Brand, p.Product, pack_size
            HAVING ecp_prev IS NOT NULL AND ecp_curr IS NOT NULL
            ORDER BY p.Platform, p.Brand, p.Product
        `;

            console.log('[PricingAnalysisService] Executing enhanced ECP comparison query...');
            const queryStart = Date.now();

            const results = await queryClickHouse(query);


            console.log(`[PricingAnalysisService] Query completed in ${Date.now() - queryStart}ms, found ${results?.length || 0} results`);

            // Process results and add trend labels
            const data = (results || []).map(row => {
                const ecpPrev = parseFloat(row.ecp_prev) || 0;
                const ecpCurr = parseFloat(row.ecp_curr) || 0;
                const mrpCurr = parseFloat(row.mrp_curr) || 0;
                const mrpPrev = parseFloat(row.mrp_prev) || 0;
                const discountCurr = parseFloat(row.discount_curr) || 0;
                const discountPrev = parseFloat(row.discount_prev) || 0;

                const change = ecpCurr - ecpPrev;
                const changePercent = ecpPrev > 0 ? ((change / ecpPrev) * 100) : 0;

                // Label as "up" if ecp_curr increased, "down" if decreased
                let trend = 'neutral';
                if (change > 0) {
                    trend = 'up';
                } else if (change < 0) {
                    trend = 'down';
                }

                // Calculate RPI
                const rpiPrev = mrpPrev > 0 ? (ecpPrev / mrpPrev) : 1.0;
                const rpiCurr = mrpCurr > 0 ? (ecpCurr / mrpCurr) : 1.0;

                return {
                    brand: row.Brand,
                    product: row.product,
                    packSize: row.pack_size || 'N/A',
                    platform: row.Platform,
                    ecp_prev: ecpPrev,
                    ecp_curr: ecpCurr,
                    mrp_prev: mrpPrev,
                    mrp_curr: mrpCurr,
                    discount_prev: discountPrev,
                    discount_curr: discountCurr,
                    rpi_prev: parseFloat(rpiPrev.toFixed(2)),
                    rpi_curr: parseFloat(rpiCurr.toFixed(2)),
                    trend,
                    change: parseFloat(change.toFixed(2)),
                    changePercent: parseFloat(changePercent.toFixed(2)),
                    discountChange: parseFloat((discountCurr - discountPrev).toFixed(1)),
                    rpiChange: parseFloat((rpiCurr - rpiPrev).toFixed(2)),
                    topCities: []
                };
            });

            // Populate topCities for top items to avoid huge data transfer
            // We'll pick top 20 gainers and top 20 drainers overall to enrich
            const topGainers = [...data].sort((a, b) => b.changePercent - a.changePercent).slice(0, 20);
            const topDrainers = [...data].sort((a, b) => a.changePercent - b.changePercent).slice(0, 20);
            const topProducts = [...new Set([...topGainers, ...topDrainers].map(p => p.product))];

            if (topProducts.length > 0) {
                try {
                    const productEscaped = topProducts.map(p => `'${escapeStr(p)}'`).join(',');
                    const cityQuery = `
                        SELECT
                            p.Product as product,
                            p.Location as city,
                            ROUND(
                                SUM(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN toFloat64(p.Selling_Price) ELSE 0 END)
                                / NULLIF(COUNT(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND toFloat64(p.Selling_Price) > 0 THEN 1 END), 0),
                                2
                            ) AS ecp_prev,
                            ROUND(
                                SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN toFloat64(p.Selling_Price) ELSE 0 END)
                                / NULLIF(COUNT(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' AND toFloat64(p.Selling_Price) > 0 THEN 1 END), 0),
                                2
                            ) AS ecp_curr,
                            ROUND(
                                SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN toFloat64(p.Discount) ELSE 0 END)
                                / NULLIF(COUNT(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN 1 END), 0),
                                2
                            ) AS discount_curr
                        FROM rb_pdp_olap p
                        WHERE p.DATE BETWEEN '${compareStartDate}' AND '${endDate}'
                          AND p.Product IN (${productEscaped})
                          ${platforms ? `AND ${buildInClause('p.Platform', platforms)}` : ''}
                          ${locations ? `AND ${buildInClause('p.Location', locations)}` : ''}
                        GROUP BY p.Product, p.Location
                        HAVING ecp_prev IS NOT NULL AND ecp_curr IS NOT NULL
                    `;

                    const cityResults = await queryClickHouse(cityQuery);

                    // Group city impacts by product
                    const cityImpactMap = {};
                    cityResults.forEach(r => {
                        if (!cityImpactMap[r.product]) cityImpactMap[r.product] = [];

                        const cp = parseFloat(r.ecp_prev);
                        const cc = parseFloat(r.ecp_curr);
                        const chg = cc - cp;
                        const pct = cp > 0 ? ((chg / cp) * 100).toFixed(1) : 0;

                        cityImpactMap[r.product].push({
                            city: r.city,
                            metric: `ECP ₹${cc.toFixed(0)}`,
                            change: `${chg > 0 ? '+' : ''}${pct}%`
                        });
                    });

                    // Assign top cities (sorted by magnitude of change)
                    data.forEach(item => {
                        if (cityImpactMap[item.product]) {
                            item.topCities = cityImpactMap[item.product]
                                .sort((a, b) => Math.abs(parseFloat(b.change)) - Math.abs(parseFloat(a.change)))
                                .slice(0, 2);
                        }
                    });
                } catch (cityError) {
                    console.error('[PricingAnalysisService] Error fetching city impacts:', cityError);
                }
            }

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
                }
            };
        }
    }, CACHE_TTL.ONE_HOUR);
}

export default {
    getEcpComparison
};
