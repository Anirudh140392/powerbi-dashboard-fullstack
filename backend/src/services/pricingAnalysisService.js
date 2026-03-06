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
                "ifNull(toFloat64OrZero(toString(Selling_Price)), 0) > 0",
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
                    SUM(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) ELSE 0 END)
                    / NULLIF(
                        COUNT(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) > 0 THEN 1 END),
                        0
                    ),
                    2
                ) AS ecp_prev,
                ROUND(
                    SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) ELSE 0 END)
                    / NULLIF(
                        COUNT(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' AND ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) > 0 THEN 1 END),
                        0
                    ),
                    2
                ) AS ecp_curr,
                ROUND(
                    SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.MRP)), 0) ELSE 0 END)
                    / NULLIF(
                        COUNT(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 THEN 1 END),
                        0
                    ),
                    2
                ) AS mrp_curr,
                ROUND(
                    SUM(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN ifNull(toFloat64OrZero(toString(p.MRP)), 0) ELSE 0 END)
                    / NULLIF(
                        COUNT(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 THEN 1 END),
                        0
                    ),
                    2
                ) AS mrp_prev,
                ROUND(
                    SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.Discount)), 0) ELSE 0 END)
                    / NULLIF(
                        COUNT(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN 1 END),
                        0
                    ),
                    2
                ) AS discount_curr,
                ROUND(
                    SUM(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN ifNull(toFloat64OrZero(toString(p.Discount)), 0) ELSE 0 END)
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
                                SUM(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) ELSE 0 END)
                                / NULLIF(COUNT(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) > 0 THEN 1 END), 0),
                                2
                            ) AS ecp_prev,
                            ROUND(
                                SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) ELSE 0 END)
                                / NULLIF(COUNT(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' AND ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) > 0 THEN 1 END), 0),
                                2
                            ) AS ecp_curr,
                            ROUND(
                                SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.Discount)), 0) ELSE 0 END)
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

/**
 * Get Pricing KPIs based on formulas:
 * Discount = (MRP - SP)/MRP
 * Weighted Discount = Discount * Offtake share (Sales)
 * Price Per Unit = Price / Grammage
 * RPI = Pricing Index (SP / MRP)
 * @param {Object} filters
 */
async function getPricingKpis(filters = {}) {
    console.log('[PricingAnalysisService] getPricingKpis called with filters:', filters);
    const cacheKey = generateCacheKey('pricing_kpis', filters);

    return await getCachedOrCompute(cacheKey, async () => {
        try {
            const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
            const startDate = filters.startDate || dayjs().subtract(15, 'days').format('YYYY-MM-DD');

            const periodDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
            const compareEndDate = dayjs(startDate).subtract(1, 'day').format('YYYY-MM-DD');
            const compareStartDate = dayjs(compareEndDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');

            const platform = filters.platform || null;
            const location = filters.location || null;
            const brand = filters.brand || null;
            const category = filters.category || null;
            const channel = filters.channel || null;

            let whereConditions = [
                "Selling_Price IS NOT NULL",
                "ifNull(toFloat64OrZero(toString(Selling_Price)), 0) > 0"
            ];

            const platforms = parseMultiSelectFilter(platform);
            if (platforms) whereConditions.push(buildInClause('p.Platform', platforms));

            const locations = parseMultiSelectFilter(location);
            if (locations) whereConditions.push(buildInClause('p.Location', locations));

            const brands = parseMultiSelectFilter(brand);
            if (brands) whereConditions.push(buildInClause('p.Brand', brands));

            const categories = parseMultiSelectFilter(category);
            if (categories) whereConditions.push(buildInClause('p.Category', categories));

            const channels = parseMultiSelectFilter(channel);
            if (channels) whereConditions.push(buildInClause('p.Channel', channels));

            const whereClause = whereConditions.join(' AND ');

            const query = `
            SELECT
                -- Current Period
                AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                         AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                    THEN ((ifNull(toFloat64OrZero(toString(p.MRP)), 0) - ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)) / ifNull(toFloat64OrZero(toString(p.MRP)), 0)) * 100 
                    ELSE NULL END) AS discount_curr,
                
                SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                         AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                    THEN ((ifNull(toFloat64OrZero(toString(p.MRP)), 0) - ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)) / ifNull(toFloat64OrZero(toString(p.MRP)), 0)) * ifNull(toFloat64OrZero(toString(p.Sales)), 0) 
                    ELSE 0 END) / 
                NULLIF(SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.Sales)), 0) ELSE 0 END), 0) * 100 AS weighted_discount_curr,
                
                AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                         AND ifNull(toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+')), 0) > 0 
                    THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) / ifNull(toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+')), 0) 
                    ELSE NULL END) AS price_per_unit_curr,
                
                AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                         AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                    THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) / ifNull(toFloat64OrZero(toString(p.MRP)), 0) 
                    ELSE NULL END) AS rpi_curr,
                
                AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                    THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) 
                    ELSE NULL END) AS asp_curr,

                -- Previous Period
                AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                         AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                    THEN ((ifNull(toFloat64OrZero(toString(p.MRP)), 0) - ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)) / ifNull(toFloat64OrZero(toString(p.MRP)), 0)) * 100 
                    ELSE NULL END) AS discount_prev,
                
                SUM(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                         AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                    THEN ((ifNull(toFloat64OrZero(toString(p.MRP)), 0) - ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)) / ifNull(toFloat64OrZero(toString(p.MRP)), 0)) * ifNull(toFloat64OrZero(toString(p.Sales)), 0) 
                    ELSE 0 END) / 
                NULLIF(SUM(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN ifNull(toFloat64OrZero(toString(p.Sales)), 0) ELSE 0 END), 0) * 100 AS weighted_discount_prev,
                
                AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                         AND ifNull(toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+')), 0) > 0 
                    THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) / ifNull(toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+')), 0) 
                    ELSE NULL END) AS price_per_unit_prev,
                
                AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                         AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                    THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) / ifNull(toFloat64OrZero(toString(p.MRP)), 0) 
                    ELSE NULL END) AS rpi_prev,
                
                AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                    THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) 
                    ELSE NULL END) AS asp_prev

            FROM rb_pdp_olap p
            WHERE p.DATE BETWEEN '${compareStartDate}' AND '${endDate}'
              AND ${whereClause}
            `;

            console.log('[PricingAnalysisService] Executing KPI query...');
            const results = await queryClickHouse(query);

            if (!results || results.length === 0) {
                return { success: false, data: null };
            }

            const r = results[0];

            const formatVal = (val) => parseFloat(val) || 0;
            const calcChange = (curr, prev) => (prev > 0 ? ((curr - prev) / prev) * 100 : 0);
            const calcPointsChange = (curr, prev) => curr - prev;

            const data = {
                discount: {
                    value: formatVal(r.discount_curr),
                    prev: formatVal(r.discount_prev),
                    change: calcPointsChange(formatVal(r.discount_curr), formatVal(r.discount_prev))
                },
                weightedDiscount: {
                    value: formatVal(r.weighted_discount_curr),
                    prev: formatVal(r.weighted_discount_prev),
                    change: calcPointsChange(formatVal(r.weighted_discount_curr), formatVal(r.weighted_discount_prev))
                },
                pricePerUnit: {
                    value: formatVal(r.price_per_unit_curr),
                    prev: formatVal(r.price_per_unit_prev),
                    change: calcChange(formatVal(r.price_per_unit_curr), formatVal(r.price_per_unit_prev))
                },
                rpi: {
                    value: formatVal(r.rpi_curr),
                    prev: formatVal(r.rpi_prev),
                    change: calcChange(formatVal(r.rpi_curr), formatVal(r.rpi_prev))
                },
                asp: {
                    value: formatVal(r.asp_curr),
                    prev: formatVal(r.asp_prev),
                    change: calcChange(formatVal(r.asp_curr), formatVal(r.asp_prev))
                }
            };

            return { success: true, data };
        } catch (error) {
            console.error('[PricingAnalysisService] Error in getPricingKpis:', error);
            return { success: false, error: error.message };
        }
    }, CACHE_TTL.ONE_HOUR);
}

/**
 * Get Pricing Insights (Price Drops & Hikes for My SKUs and Competitors)
 */
async function getPricingInsights(filters = {}) {
    console.log('[PricingAnalysisService] getPricingInsights called with filters:', filters);
    const cacheKey = generateCacheKey('pricing_insights', filters);

    return await getCachedOrCompute(cacheKey, async () => {
        try {
            const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
            const startDate = filters.startDate || dayjs().subtract(15, 'days').format('YYYY-MM-DD');

            const periodDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
            const compareEndDate = dayjs(startDate).subtract(1, 'day').format('YYYY-MM-DD');
            const compareStartDate = dayjs(compareEndDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');

            const platform = filters.platform || null;
            const location = filters.location || null;
            const brand = filters.brand || null;
            const category = filters.category || null;
            const channel = filters.channel || null;

            let whereConditions = [
                "Selling_Price IS NOT NULL",
                "ifNull(toFloat64OrZero(toString(Selling_Price)), 0) > 0",
                "Brand IS NOT NULL"
            ];

            const platforms = parseMultiSelectFilter(platform);
            if (platforms) whereConditions.push(buildInClause('p.Platform', platforms));

            const locations = parseMultiSelectFilter(location);
            if (locations) whereConditions.push(buildInClause('p.Location', locations));

            const brands = parseMultiSelectFilter(brand);
            if (brands) whereConditions.push(buildInClause('p.Brand', brands));

            const categories = parseMultiSelectFilter(category);
            if (categories) whereConditions.push(buildInClause('p.Category', categories));

            const channels = parseMultiSelectFilter(channel);
            if (channels) whereConditions.push(buildInClause('p.Channel', channels));

            const whereClause = whereConditions.join(' AND ');

            // Comp_flag = 0 means My SKUs, 1 means Competitor
            // We calculate Average Discount change per SKU
            const query = `
            SELECT
                p.Brand,
                p.Product,
                p.Category,
                p.Comp_flag,
                AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                         AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                    THEN ((ifNull(toFloat64OrZero(toString(p.MRP)), 0) - ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)) / ifNull(toFloat64OrZero(toString(p.MRP)), 0)) * 100 
                    ELSE NULL END) AS discount_curr,
                AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                         AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                    THEN ((ifNull(toFloat64OrZero(toString(p.MRP)), 0) - ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)) / ifNull(toFloat64OrZero(toString(p.MRP)), 0)) * 100 
                    ELSE NULL END) AS discount_prev
            FROM rb_pdp_olap p
            WHERE p.DATE BETWEEN '${compareStartDate}' AND '${endDate}'
              AND ${whereClause}
            GROUP BY p.Brand, p.Product, p.Category, p.Comp_flag
            HAVING discount_curr IS NOT NULL AND discount_prev IS NOT NULL
            `;

            console.log('[PricingAnalysisService] Executing Insights query...');
            const results = await queryClickHouse(query);

            const processed = (results || []).map(r => {
                const dc = parseFloat(r.discount_curr) || 0;
                const dp = parseFloat(r.discount_prev) || 0;
                // delta represents PRICE change: positive = price went up, negative = price went down
                // When discount increases (dc > dp), price drops → delta is negative
                const delta = dp - dc;
                return {
                    brand: r.Brand,
                    title: r.Product,
                    cat: r.Category || "Uncategorized",
                    isMySku: parseInt(r.Comp_flag) === 0,
                    discount: dc,
                    delta: parseFloat(delta.toFixed(2))
                };
            }).filter(r => Math.abs(r.delta) >= 0.1); // Only significant changes

            // Sort by absolute delta
            processed.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

            // Price Drop = delta < 0 (price decreased / discount increased)
            // Price Hike = delta > 0 (price increased / discount decreased)
            const my_skus_drop = processed.filter(r => r.isMySku && r.delta < 0).slice(0, 10);
            const my_skus_hike = processed.filter(r => r.isMySku && r.delta > 0).slice(0, 10);
            const comp_skus_drop = processed.filter(r => !r.isMySku && r.delta < 0).slice(0, 10);
            const comp_skus_hike = processed.filter(r => !r.isMySku && r.delta > 0).slice(0, 10);

            // Mocking cities payload format to match UI requirement without doing 4 extra heavy queries
            const addCities = (skus) => skus.map((s, i) => ({
                ...s,
                id: `${s.brand}_${i}`,
                badge: s.delta < 0 ? `Drop ${i + 1}` : `Hike ${i + 1}`,
                size: "Mixed",
                cities: [
                    { name: "Top City 1", discount: s.discount, change: s.delta }
                ]
            }));

            return {
                success: true,
                data: {
                    pd_my: addCities(my_skus_drop),
                    pi_my: addCities(my_skus_hike),
                    pd_comp: addCities(comp_skus_drop),
                    pi_comp: addCities(comp_skus_hike)
                }
            };
        } catch (error) {
            console.error('[PricingAnalysisService] Error in getPricingInsights:', error);
            return { success: false, error: error.message };
        }
    }, CACHE_TTL.ONE_HOUR);
}

/**
 * Get Pricing Dimension Overview (Grouping by Category or Location)
 * @param {Object} filters - platform, location, brand, category, channel, startDate, endDate, dimension ('category' or 'location')
 */
const getDimensionOverview = async (filters) => {
    try {
        const startDate = filters.startDate || dayjs().subtract(14, 'day').format('YYYY-MM-DD');
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');

        const dimensionParam = filters.dimension || 'category';
        // dimensionParam can be 'category', 'location', or 'city' (frontend sends 'city')
        const groupByColumn = (dimensionParam === 'location' || dimensionParam === 'city') ? 'Location' : 'Category';

        const periodDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
        const compareEndDate = dayjs(startDate).subtract(1, 'day').format('YYYY-MM-DD');
        const compareStartDate = dayjs(compareEndDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');

        const platform = filters.platform || null;
        const location = filters.location || null;
        const brand = filters.brand || null;
        const category = filters.category || null;

        let whereConditions = [
            "p.Selling_Price IS NOT NULL",
            "p.Selling_Price != ''",
            "toFloat64OrZero(toString(p.Selling_Price)) > 0"
        ];

        const platforms = parseMultiSelectFilter(platform);
        if (platforms) whereConditions.push(buildInClause('p.Platform', platforms));

        const locations = parseMultiSelectFilter(location);
        if (locations) whereConditions.push(buildInClause('p.Location', locations));

        const brands = parseMultiSelectFilter(brand);
        if (brands) whereConditions.push(buildInClause('p.Brand', brands));

        const categories = parseMultiSelectFilter(category);
        if (categories) whereConditions.push(buildInClause('p.Category', categories));

        const whereClause = whereConditions.join(' AND ');

        const query = `
        SELECT
            p.${groupByColumn} AS dimension_name,
            -- Current Period
            AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' AND toFloat64OrZero(toString(p.MRP)) > 0 
                THEN ((toFloat64OrZero(toString(p.MRP)) - toFloat64OrZero(toString(p.Selling_Price))) / toFloat64OrZero(toString(p.MRP))) * 100 ELSE NULL END) AS discount_curr,
            
            SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' AND toFloat64OrZero(toString(p.MRP)) > 0 
                THEN ((toFloat64OrZero(toString(p.MRP)) - toFloat64OrZero(toString(p.Selling_Price))) / toFloat64OrZero(toString(p.MRP))) * toFloat64OrZero(toString(p.Sales)) ELSE 0 END) / 
            NULLIF(SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN toFloat64OrZero(toString(p.Sales)) ELSE 0 END), 0) * 100 AS weighted_discount_curr,
            
            AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' AND toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+')) > 0 
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+')) ELSE NULL END) AS price_per_unit_curr,
            
            AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' AND toFloat64OrZero(toString(p.MRP)) > 0 
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(toString(p.MRP)) ELSE NULL END) AS rpi_curr,
            
            AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN toFloat64OrZero(toString(p.Selling_Price)) ELSE NULL END) AS asp_curr,

            -- Previous Period
            AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND toFloat64OrZero(toString(p.MRP)) > 0 
                THEN ((toFloat64OrZero(toString(p.MRP)) - toFloat64OrZero(toString(p.Selling_Price))) / toFloat64OrZero(toString(p.MRP))) * 100 ELSE NULL END) AS discount_prev,
            
            SUM(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND toFloat64OrZero(toString(p.MRP)) > 0 
                THEN ((toFloat64OrZero(toString(p.MRP)) - toFloat64OrZero(toString(p.Selling_Price))) / toFloat64OrZero(toString(p.MRP))) * toFloat64OrZero(toString(p.Sales)) ELSE 0 END) / 
            NULLIF(SUM(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN toFloat64OrZero(toString(p.Sales)) ELSE 0 END), 0) * 100 AS weighted_discount_prev,
            
            AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+')) > 0 
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+')) ELSE NULL END) AS price_per_unit_prev,
            
            AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND toFloat64OrZero(toString(p.MRP)) > 0 
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(toString(p.MRP)) ELSE NULL END) AS rpi_prev,
            
            AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN toFloat64OrZero(toString(p.Selling_Price)) ELSE NULL END) AS asp_prev

        FROM rb_pdp_olap p
        WHERE p.DATE BETWEEN '${compareStartDate}' AND '${endDate}'
          AND p.${groupByColumn} IS NOT NULL
          AND p.${groupByColumn} != ''
          AND ${whereClause}
        GROUP BY p.${groupByColumn}
        ORDER BY p.${groupByColumn} ASC
        SETTINGS max_execution_time = 30
        `;

        console.log(`[PricingAnalysisService] Executing Dimension Overview query (group by ${groupByColumn})...`);
        const results = await queryClickHouse(query);

        const processedData = (results || []).map(r => {
            const mapMetric = (currKey, prevKey) => {
                const curr = parseFloat(r[currKey]) || 0;
                const prev = parseFloat(r[prevKey]) || 0;
                const change = curr - prev;
                return {
                    value: curr,
                    prev: prev,
                    change: change,
                    dir: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
                };
            };

            return {
                key: r.dimension_name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                name: r.dimension_name,
                data: {
                    discount: mapMetric('discount_curr', 'discount_prev'),
                    weightedDiscount: mapMetric('weighted_discount_curr', 'weighted_discount_prev'),
                    pricePerUnit: mapMetric('price_per_unit_curr', 'price_per_unit_prev'),
                    rpi: mapMetric('rpi_curr', 'rpi_prev'),
                    asp: mapMetric('asp_curr', 'asp_prev')
                }
            };
        });

        return {
            success: true,
            data: processedData
        };
    } catch (error) {
        console.error('[PricingAnalysisService] Error in getDimensionOverview:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get Pricing Dimension Trends (time-series) for a category or city
 * @param {Object} filters - dimension, dimensionValue, timeStep, period, startDate, endDate, platform, brand, location, category
 */
const getDimensionTrends = async (filters) => {
    try {
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const periodDays = filters.period === '3M' ? 90 : filters.period === '6M' ? 180 : filters.period === '1Y' ? 365 : 30;
        const startDate = filters.startDate || dayjs(endDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');

        const dimensionParam = filters.dimension || 'category';
        const groupByColumn = (dimensionParam === 'location' || dimensionParam === 'city') ? 'Location' : 'Category';
        const dimensionValue = filters.dimensionValue;

        const timeStep = (filters.timeStep || 'Daily').toLowerCase();
        let dateGroupExpr;
        if (timeStep === 'monthly') {
            dateGroupExpr = `toStartOfMonth(p.DATE)`;
        } else if (timeStep === 'weekly') {
            dateGroupExpr = `toMonday(p.DATE)`;
        } else {
            dateGroupExpr = `p.DATE`;
        }

        let whereConditions = [
            `p.DATE BETWEEN '${startDate}' AND '${endDate}'`,
            "p.Selling_Price IS NOT NULL",
            "p.Selling_Price != ''",
            "toFloat64OrZero(toString(p.Selling_Price)) > 0"
        ];

        const platform = filters.platform || null;
        const location = filters.location || null;
        const brand = filters.brand || null;
        const category = filters.category || null;

        const platforms = parseMultiSelectFilter(platform);
        if (platforms) whereConditions.push(buildInClause('p.Platform', platforms));

        const locations = parseMultiSelectFilter(location);
        if (locations) whereConditions.push(buildInClause('p.Location', locations));

        const brands = parseMultiSelectFilter(brand);
        if (brands) whereConditions.push(buildInClause('p.Brand', brands));

        const categories = parseMultiSelectFilter(category);
        if (categories) whereConditions.push(buildInClause('p.Category', categories));

        // Filter by the specific dimension value (e.g., "Toothpaste" or "Mumbai")
        if (dimensionValue) {
            whereConditions.push(`lower(p.${groupByColumn}) = lower('${escapeStr(dimensionValue)}')`);
        }

        const whereClause = whereConditions.join(' AND ');

        const query = `
        SELECT
            toString(${dateGroupExpr}) AS date,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN ((toFloat64OrZero(toString(p.MRP)) - toFloat64OrZero(toString(p.Selling_Price))) / toFloat64OrZero(toString(p.MRP))) * 100
                ELSE NULL END) AS discount,
            AVG(CASE WHEN toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+')) > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+'))
                ELSE NULL END) AS price_per_unit,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(toString(p.MRP))
                ELSE NULL END) AS rpi,
            AVG(toFloat64OrZero(toString(p.Selling_Price))) AS asp
        FROM rb_pdp_olap p
        WHERE ${whereClause}
          AND p.${groupByColumn} IS NOT NULL
          AND p.${groupByColumn} != ''
        GROUP BY date
        ORDER BY date ASC
        SETTINGS max_execution_time = 30
        `;

        console.log(`[PricingAnalysisService] Executing Dimension Trends query (${groupByColumn}=${dimensionValue}, step=${timeStep})...`);
        const results = await queryClickHouse(query);

        const timeSeries = (results || []).map(r => ({
            date: r.date,
            Discount: parseFloat(r.discount) || 0,
            PricePerUnit: parseFloat(r.price_per_unit) || 0,
            RPI: parseFloat(r.rpi) || 0,
            ASP: parseFloat(r.asp) || 0,
        }));

        return { success: true, timeSeries };
    } catch (error) {
        console.error('[PricingAnalysisService] Error in getDimensionTrends:', error);
        return { success: false, error: error.message, timeSeries: [] };
    }
};

/**
 * Get Pricing Competition Trends (time-series) for specific brands or skus
 * @param {Object} filters - mode (brand vs sku), targets, period, platform, location, category, dimension, dimensionValue
 */
const getPricingCompetitionTrends = async (filters) => {
    try {
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const periodDays = filters.period === '3M' ? 90 : filters.period === '6M' ? 180 : filters.period === '1Y' ? 365 : 30;
        const startDate = filters.startDate || dayjs(endDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');

        const mode = filters.mode || 'brand'; // 'brand' or 'sku'
        const targets = parseMultiSelectFilter(filters.targets) || [];

        // If no targets selected, return empty
        if (targets.length === 0) {
            return { success: true, timeSeriesByTarget: {}, dates: [] };
        }

        let whereConditions = [
            `p.DATE BETWEEN '${startDate}' AND '${endDate}'`,
            "p.Selling_Price IS NOT NULL",
            "p.Selling_Price != ''",
            "toFloat64OrZero(toString(p.Selling_Price)) > 0"
        ];

        const platform = filters.platform || null;
        const location = filters.location || null;
        const category = filters.category || null;
        const dimensionParam = filters.dimension || 'category';
        const dimensionValue = filters.dimensionValue;
        const groupByColumn = (dimensionParam === 'location' || dimensionParam === 'city') ? 'Location' : 'Category';

        const platforms = parseMultiSelectFilter(platform);
        if (platforms) whereConditions.push(buildInClause('p.Platform', platforms));

        const locations = parseMultiSelectFilter(location);
        if (locations) whereConditions.push(buildInClause('p.Location', locations));

        const categories = parseMultiSelectFilter(category);
        if (categories) whereConditions.push(buildInClause('p.Category', categories));

        if (dimensionValue) {
            whereConditions.push(`lower(p.${groupByColumn}) = lower('${escapeStr(dimensionValue)}')`);
        }

        // Target filtering
        const targetColumn = mode === 'sku' ? 'Product' : 'Brand';
        whereConditions.push(buildInClause(`p.${targetColumn}`, targets));

        const whereClause = whereConditions.join(' AND ');

        const query = `
        SELECT
            toString(p.DATE) AS date,
            p.${targetColumn} AS target_name,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN ((toFloat64OrZero(toString(p.MRP)) - toFloat64OrZero(toString(p.Selling_Price))) / toFloat64OrZero(toString(p.MRP))) * 100
                ELSE NULL END) AS discount,
            AVG(CASE WHEN toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+')) > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+'))
                ELSE NULL END) AS price_per_unit,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(toString(p.MRP))
                ELSE NULL END) AS rpi,
            AVG(toFloat64OrZero(toString(p.Selling_Price))) AS asp
        FROM rb_pdp_olap p
        WHERE ${whereClause}
        GROUP BY p.DATE, p.${targetColumn}
        ORDER BY p.DATE ASC
        SETTINGS max_execution_time = 30
        `;

        console.log(`[PricingAnalysisService] Executing Competition Trends query (mode=${mode})...`);
        const results = await queryClickHouse(query);

        // Generate uniform dates array
        const datesMap = new Set();
        const timeSeriesByTarget = {};

        targets.forEach(t => { timeSeriesByTarget[t] = {}; }); // Initialize object

        (results || []).forEach(r => {
            const rowDate = r.date;
            datesMap.add(rowDate);
            const tName = r.target_name;

            if (!timeSeriesByTarget[tName]) timeSeriesByTarget[tName] = {};

            timeSeriesByTarget[tName][rowDate] = {
                Discount: parseFloat(r.discount) || 0,
                PricePerUnit: parseFloat(r.price_per_unit) || 0,
                RPI: parseFloat(r.rpi) || 0,
                ASP: parseFloat(r.asp) || 0,
            };
        });

        const dates = Array.from(datesMap).sort();

        return { success: true, timeSeriesByTarget, dates };
    } catch (error) {
        console.error('[PricingAnalysisService] Error in getPricingCompetitionTrends:', error);
        return { success: false, error: error.message, timeSeriesByTarget: {}, dates: [] };
    }
};

/**
 * Get Pricing Competition Data (Brand-level and SKU-level pricing metrics)
 * Used by the Competition tab in the Category Overview drawer
 * @param {Object} filters - platform, location, brand, category, startDate, endDate, dimensionValue, dimension, period
 */
const getPricingCompetition = async (filters) => {
    try {
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const periodDays = filters.period === '3M' ? 90 : filters.period === '6M' ? 180 : filters.period === '1Y' ? 365 : 30;
        const startDate = filters.startDate || dayjs(endDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');

        const dimensionParam = filters.dimension || 'category';
        const groupByColumn = (dimensionParam === 'location' || dimensionParam === 'city') ? 'Location' : 'Category';
        const dimensionValue = filters.dimensionValue;

        let whereConditions = [
            `p.DATE BETWEEN '${startDate}' AND '${endDate}'`,
            "p.Selling_Price IS NOT NULL",
            "p.Selling_Price != ''",
            "toFloat64OrZero(toString(p.Selling_Price)) > 0",
            "p.Brand IS NOT NULL",
            "p.Brand != ''"
        ];

        const platform = filters.platform || null;
        const location = filters.location || null;
        const brand = filters.brand || null;
        const category = filters.category || null;

        const platforms = parseMultiSelectFilter(platform);
        if (platforms) whereConditions.push(buildInClause('p.Platform', platforms));

        const locations = parseMultiSelectFilter(location);
        if (locations) whereConditions.push(buildInClause('p.Location', locations));

        const brands = parseMultiSelectFilter(brand);
        if (brands) whereConditions.push(buildInClause('p.Brand', brands));

        const categories = parseMultiSelectFilter(category);
        if (categories) whereConditions.push(buildInClause('p.Category', categories));

        // Filter by the specific dimension value (e.g., "Toothpaste" or "Mumbai")
        if (dimensionValue) {
            whereConditions.push(`lower(p.${groupByColumn}) = lower('${escapeStr(dimensionValue)}')`);
        }

        const whereClause = whereConditions.join(' AND ');

        // Brand-level query: Discount, PricePerUnit, RPI, ASP grouped by brand
        const brandQuery = `
        SELECT
            p.Brand AS brand_name,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN ((toFloat64OrZero(toString(p.MRP)) - toFloat64OrZero(toString(p.Selling_Price))) / toFloat64OrZero(toString(p.MRP))) * 100
                ELSE NULL END) AS discount,
            AVG(CASE WHEN toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+')) > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+'))
                ELSE NULL END) AS price_per_unit,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(toString(p.MRP))
                ELSE NULL END) AS rpi,
            AVG(toFloat64OrZero(toString(p.Selling_Price))) AS asp
        FROM rb_pdp_olap p
        WHERE ${whereClause}
        GROUP BY p.Brand
        ORDER BY discount DESC
        LIMIT 20
        SETTINGS max_execution_time = 30
        `;

        // SKU-level query: Discount, PricePerUnit, RPI, ASP grouped by product + brand
        const skuQuery = `
        SELECT
            p.Product AS sku_name,
            p.Brand AS brand_name,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN ((toFloat64OrZero(toString(p.MRP)) - toFloat64OrZero(toString(p.Selling_Price))) / toFloat64OrZero(toString(p.MRP))) * 100
                ELSE NULL END) AS discount,
            AVG(CASE WHEN toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+')) > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+'))
                ELSE NULL END) AS price_per_unit,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(toString(p.MRP))
                ELSE NULL END) AS rpi,
            AVG(toFloat64OrZero(toString(p.Selling_Price))) AS asp
        FROM rb_pdp_olap p
        WHERE ${whereClause}
          AND p.Product IS NOT NULL
          AND p.Product != ''
        GROUP BY p.Product, p.Brand
        ORDER BY discount DESC
        LIMIT 40
        SETTINGS max_execution_time = 30
        `;

        console.log(`[PricingAnalysisService] Fetching competition data (${groupByColumn}=${dimensionValue})...`);
        const [brandResults, skuResults] = await Promise.all([
            queryClickHouse(brandQuery),
            queryClickHouse(skuQuery)
        ]);

        const brandRows = (brandResults || []).map(r => ({
            brand_name: r.brand_name,
            Discount: parseFloat(r.discount) || 0,
            PricePerUnit: parseFloat(r.price_per_unit) || 0,
            RPI: parseFloat(r.rpi) || 0,
            ASP: parseFloat(r.asp) || 0,
        }));

        const skuRows = (skuResults || []).map(r => ({
            sku_name: r.sku_name,
            brand_name: r.brand_name,
            Discount: parseFloat(r.discount) || 0,
            PricePerUnit: parseFloat(r.price_per_unit) || 0,
            RPI: parseFloat(r.rpi) || 0,
            ASP: parseFloat(r.asp) || 0,
        }));

        return { success: true, brands: brandRows, skus: skuRows };
    } catch (error) {
        console.error('[PricingAnalysisService] Error in getPricingCompetition:', error);
        return { success: false, error: error.message, brands: [], skus: [] };
    }
};

export {
    getEcpComparison,
    getPricingKpis,
    getPricingInsights,
    getDimensionOverview,
    getDimensionTrends,
    getPricingCompetition,
    getPricingCompetitionTrends
};
