import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';


// Helper to escape string for SQL
const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

// Global SQL snippet to resolve the Product_Category from Brand if the column is empty
// For chocolate brands (Snickers, Galaxy), uses Product name keywords to distinguish
// Gifting (gift, tin pack, minis) from Non-Gifting
const PRODUCT_CATEGORY_SQL = `if(Category IS NOT NULL AND Category != '' AND Category != '0', 
    Category, 
    multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', 
            LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m'), 
                if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%', 
                   'Chocolates (Gifting)', 
                   'Chocolates (Non Gifting)'), 
            'Others')
)`;

// SQL snippet to normalize city names to match frontend expectations
// Updated to handle common typos and case inconsistencies
const CITY_NORMALIZATION_SQL = `multiIf(
    lower(p.Location) = 'bangalore', 'bengaluru',
    lower(p.Location) = 'gurgaon', 'gurugram',
    lower(p.Location) = 'ahemdabad', 'ahmedabad',
    lower(p.Location) = 'ahmedabad', 'ahmedabad',
    p.Location
)`;

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
    if (typeof value === 'string') { // Modified this line
        const filtered = value.split(',').map(v => v.trim()).filter(v => v && v !== 'All');
        return filtered.length > 0 ? filtered : null;
    }
    return [value];
};

/**
 * Normalizes city names from frontend to match database values
 */
const normalizeLocations = (locations) => {
    if (!locations) return null;
    return locations.map(l => {
        const lower = l.trim().toLowerCase();
        if (lower === "bengaluru" || lower === "bangalore") return "Bangalore";
        if (lower === "gurugram" || lower === "gurgaon") return "Gurgaon";
        if (lower === "ahmedabad" || lower === "ahemdabad") return "Ahmedabad";
        return l;
    });
};

/**
 * Normalizes channel names from frontend to match database values
 */
const normalizeChannels = (channels) => {
    if (!channels) return null;
    return channels.map(c => {
        if (c === "Ecommerce" || c === "E-commerce") return "QuickComm";
        return c;
    });
};

/**
 * Helper to build SQL IN clause for multiselect
 * @param {string} column - Column name
 * @param {array} values - Array of values
 * @returns {string} - SQL condition string
 */
const buildInClause = (column, values) => {
    if (!values || values.length === 0) return null;
    const escaped = values.map(v => `'${escapeStr(v.toLowerCase())}'`).join(',');
    return `lower(${column}) IN (${escaped})`;
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
            const channel = filters.channel || null;
            const category = filters.category || null;

            const dbName = getCurrentDbName();
            const isMars = dbName === 'mars';
            const channelCol = isMars ? 'p.channel' : 'p.Channel';
            const gramCol = isMars ? "''" : "s.gram"; // Fallback for mars database

            // Build dynamic WHERE conditions
            let whereConditions = [
                "toFloat64OrZero(toString(Selling_Price)) > 0",
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
            const locations = normalizeLocations(parseMultiSelectFilter(location));
            if (locations) {
                whereConditions.push(buildInClause('Location', locations));
            }

            const channels = normalizeChannels(parseMultiSelectFilter(channel));
            if (channels) {
                whereConditions.push(buildInClause(channelCol, channels));
            }

            const categories = parseMultiSelectFilter(category);
            if (categories) {
                whereConditions.push(`${PRODUCT_CATEGORY_SQL} IN (${categories.map(v => `'${escapeStr(v)}'`).join(',')})`);
            }

            const whereClause = whereConditions.join(' AND ');


            // SQL query to calculate ECP, MRP, and Discount for both periods
            // Join with rb_sku_platform to get pack size (gram)
            const query = `
            SELECT
                p.Platform,
                p.Brand,
                p.Product as product,
                ${gramCol} AS pack_size,
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
              ${channels ? `AND ${buildInClause('p.Channel', channels)}` : ''}
              ${categories ? `AND ${PRODUCT_CATEGORY_SQL} IN (${categories.map(v => `'${escapeStr(v)}'`).join(',')})` : ''}
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
                          ${channels ? `AND ${buildInClause('p.Channel', channels)}` : ''}
                          ${categories ? `AND ${PRODUCT_CATEGORY_SQL} IN (${categories.map(v => `'${escapeStr(v)}'`).join(',')})` : ''}
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
                "toFloat64OrZero(toString(Selling_Price)) > 0"
            ];

            const dbName = getCurrentDbName();
            const isMars = dbName === 'mars';
            const channelCol = isMars ? 'p.channel' : 'p.Channel';
            const weightExpr = isMars ? "1" : "ifNull(toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+')), 0)";

            const platforms = parseMultiSelectFilter(platform);
            if (platforms) whereConditions.push(buildInClause('p.Platform', platforms));

            const locations = normalizeLocations(parseMultiSelectFilter(location));
            if (locations) whereConditions.push(buildInClause('p.Location', locations));

            const brands = parseMultiSelectFilter(brand);
            if (brands) whereConditions.push(buildInClause('p.Brand', brands));

            const categories = parseMultiSelectFilter(category);
            if (categories) whereConditions.push(`${PRODUCT_CATEGORY_SQL} IN (${categories.map(v => `'${escapeStr(v)}'`).join(',')})`);

            const channels = normalizeChannels(parseMultiSelectFilter(channel));
            if (channels) whereConditions.push(buildInClause(channelCol, channels));

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
                         AND ${weightExpr} > 0 
                    THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) / ${weightExpr} 
                    ELSE NULL END) AS price_per_unit_curr,
                
                AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                         AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                    THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) / ifNull(toFloat64OrZero(toString(p.MRP)), 0) 
                    ELSE NULL END) AS rpi_curr,
                
                AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                         AND ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) > 0 
                    THEN toFloat64OrZero(toString(p.Selling_Price)) 
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
                         AND ${weightExpr} > 0 
                    THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) / ${weightExpr} 
                    ELSE NULL END) AS price_per_unit_prev,
                
                AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                         AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                    THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) / ifNull(toFloat64OrZero(toString(p.MRP)), 0) 
                    ELSE NULL END) AS rpi_prev,
                
                AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                         AND ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) > 0 
                    THEN toFloat64OrZero(toString(p.Selling_Price)) 
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

    // return await getCachedOrCompute(cacheKey, async () => {
    return await (async () => {
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
                "toFloat64OrZero(toString(Selling_Price)) > 0",
                "Brand IS NOT NULL"
            ];

            const dbName = getCurrentDbName();
            const isMars = dbName === 'mars';
            const channelCol = isMars ? 'p.channel' : 'p.Channel';

            const platforms = parseMultiSelectFilter(platform);
            if (platforms) whereConditions.push(buildInClause('p.Platform', platforms));

            const locations = normalizeLocations(parseMultiSelectFilter(location));
            if (locations) whereConditions.push(buildInClause('p.Location', locations));

            const brands = parseMultiSelectFilter(brand);
            if (brands) whereConditions.push(buildInClause('p.Brand', brands));

            const categories = parseMultiSelectFilter(category);
            if (categories) whereConditions.push(`${PRODUCT_CATEGORY_SQL} IN (${categories.map(v => `'${escapeStr(v)}'`).join(',')})`);

            const channels = normalizeChannels(parseMultiSelectFilter(channel));
            if (channels) whereConditions.push(buildInClause(channelCol, channels));

            const whereClause = whereConditions.join(' AND ');

            // Comp_flag = 0 means My SKUs, 1 means Competitor
            // We calculate Average Discount change per SKU
            const query = `
            SELECT
                p.Brand,
                p.Product,
                ${PRODUCT_CATEGORY_SQL} AS Category,
                p.Comp_flag,
                AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                         AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                    THEN ((ifNull(toFloat64OrZero(toString(p.MRP)), 0) - ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)) / ifNull(toFloat64OrZero(toString(p.MRP)), 0)) * 100 
                    ELSE NULL END) AS discount_curr,
                AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}'
                    THEN toFloat64OrZero(toString(p.listing_percent))
                    ELSE NULL END) AS listing_curr,
                (SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.neno_osa)), 0) ELSE 0 END) / 
                 NULLIF(SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.deno_osa)), 0) ELSE 0 END), 0)) * 100 AS osa_curr,
                
                -- Coalesce Sales from p (own brand) and m (competitor brand)
                COALESCE(
                    NULLIF(SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.Sales)), 0) ELSE 0 END), 0),
                    NULLIF(SUM(CASE WHEN m.created_on BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(m.sales)), 0) ELSE 0 END), 0),
                    0
                ) AS offtakes_curr,
                
                AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                         AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                    THEN ((ifNull(toFloat64OrZero(toString(p.MRP)), 0) - ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)) / ifNull(toFloat64OrZero(toString(p.MRP)), 0)) * 100 
                    ELSE NULL END) AS discount_prev
            FROM rb_pdp_olap p
            LEFT JOIN rb_brand_ms m ON p.Web_Pid = m.web_pid AND p.DATE = m.created_on
            WHERE p.DATE BETWEEN '${compareStartDate}' AND '${endDate}'
              AND ${whereClause}
            GROUP BY p.Brand, p.Product, Category, p.Comp_flag
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
                    delta: parseFloat(delta.toFixed(2)),
                    listing: parseFloat(parseFloat(r.listing_curr || 0).toFixed(1)),
                    osa: parseFloat(parseFloat(r.osa_curr || 0).toFixed(1)),
                    offtakes: parseFloat(parseFloat(r.offtakes_curr || 0).toFixed(0))
                };
            }).filter(r => Math.abs(r.delta) >= 0.1); // Only significant changes

            // Sort by absolute delta
            processed.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

            // Price Drop = delta < 0 (price decreased / discount increased)
            // Price Hike = delta > 0 (price increased / discount decreased)
            // Limit to top 5 as requested
            const my_skus_drop = processed.filter(r => r.isMySku && r.delta < 0).slice(0, 5);
            const my_skus_hike = processed.filter(r => r.isMySku && r.delta > 0).slice(0, 5);
            const comp_skus_drop = processed.filter(r => !r.isMySku && r.delta < 0).slice(0, 5);
            const comp_skus_hike = processed.filter(r => !r.isMySku && r.delta > 0).slice(0, 5);

            const allTopSkus = [...my_skus_drop, ...my_skus_hike, ...comp_skus_drop, ...comp_skus_hike];
            const productsList = allTopSkus.map(s => s.title);

            let cityDataMap = {};
            // Initialize cityDataMap for all products to prevent crashes
            allTopSkus.forEach(s => { cityDataMap[s.title] = []; });
            if (productsList.length > 0) {
                const productEscaped = productsList.map(p => `'${escapeStr(p)}'`).join(',');
                const cityQuery = `
                    SELECT
                        p.Product as product,
                        p.Location as city,
                        AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                            THEN ((ifNull(toFloat64OrZero(toString(p.MRP)), 0) - ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)) / ifNull(toFloat64OrZero(toString(p.MRP)), 0)) * 100 
                            ELSE NULL END) AS discount_curr,
                        AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}'
                            THEN toFloat64OrZero(toString(p.listing_percent))
                            ELSE NULL END) AS listing_curr,
                        (SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.neno_osa)), 0) ELSE 0 END) / 
                         NULLIF(SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.deno_osa)), 0) ELSE 0 END), 0)) * 100 AS osa_curr,
                        
                        -- Coalesce Sales from p and m for city level
                        COALESCE(
                            NULLIF(SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.Sales)), 0) ELSE 0 END), 0),
                            NULLIF(SUM(CASE WHEN m.created_on BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(m.sales)), 0) ELSE 0 END), 0),
                            0
                        ) AS offtakes_curr,

                        AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                            THEN ((ifNull(toFloat64OrZero(toString(p.MRP)), 0) - ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)) / ifNull(toFloat64OrZero(toString(p.MRP)), 0)) * 100 
                            ELSE NULL END) AS discount_prev
                    FROM rb_pdp_olap p
                    LEFT JOIN rb_brand_ms m ON p.Web_Pid = m.web_pid AND p.DATE = m.created_on AND p.Location = m.location
                    WHERE p.DATE BETWEEN '${compareStartDate}' AND '${endDate}'
                      AND p.Product IN (${productEscaped})
                      ${platforms ? `AND ${buildInClause('p.Platform', platforms)}` : ''}
                      ${locations ? `AND ${buildInClause('p.Location', locations)}` : ''}
                      ${channels ? `AND ${buildInClause(channelCol, channels)}` : ''}
                      ${categories ? `AND ${PRODUCT_CATEGORY_SQL} IN (${categories.map(v => `'${escapeStr(v)}'`).join(',')})` : ''}
                    GROUP BY p.Product, p.Location
                    HAVING discount_curr IS NOT NULL AND discount_prev IS NOT NULL
                `;

                const cityResults = await queryClickHouse(cityQuery);
                cityResults.forEach(r => {
                    const product = r.product;
                    const dc = parseFloat(r.discount_curr) || 0;
                    const dp = parseFloat(r.discount_prev) || 0;
                    const delta = dp - dc; // delta represents price change

                    cityDataMap[product].push({
                        name: r.city,
                        discount: parseFloat(dc.toFixed(2)),
                        change: parseFloat(delta.toFixed(2)),
                        listing: parseFloat(parseFloat(r.listing_curr || 0).toFixed(1)),
                        osa: parseFloat(parseFloat(r.osa_curr || 0).toFixed(1)),
                        offtakes: parseFloat(parseFloat(r.offtakes_curr || 0).toFixed(0))
                    });
                });

                // For each product, sort cities by the magnitude of delta and pick the top one
                Object.keys(cityDataMap).forEach(product => {
                    cityDataMap[product].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
                });
            }

            const enrichSku = (skus, label) => skus.map((s, i) => ({
                ...s,
                id: `${s.brand}_${label}_${i}`,
                badge: `${label} ${i + 1}`,
                size: "Mixed",
                cities: cityDataMap[s.title] ? cityDataMap[s.title].slice(0, 20) : [
                    { name: "Global Avg", discount: s.discount, change: s.delta }
                ]
            }));

            return {
                success: true,
                data: {
                    pd_my: enrichSku(my_skus_drop, "Drop"),
                    pi_my: enrichSku(my_skus_hike, "Hike"),
                    pd_comp: enrichSku(comp_skus_drop, "Drop"),
                    pi_comp: enrichSku(comp_skus_hike, "Hike")
                }
            };
        } catch (error) {
            console.error('[PricingAnalysisService] Error in getPricingInsights:', error);
            return { success: false, error: error.message };
        }
    })();
}

/**
 * Get Pricing Dimension Overview (Grouping by Category or Location)
 * @param {Object} filters - platform, location, brand, category, channel, startDate, endDate, dimension ('category' or 'location')
 */
const getDimensionOverview = async (filters = {}) => {
    console.log('[PricingAnalysisService] getDimensionOverview called with filters:', filters);
    // return await getCachedOrCompute(cacheKey, async () => {
    return await (async () => {
        try {
            const startDate = filters.startDate || dayjs().subtract(14, 'day').format('YYYY-MM-DD');
            const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');

            const dimensionParam = filters.dimension || 'category';
            // dimensionParam can be 'category', 'location', 'city' or 'platform'
            const isPlatform = dimensionParam === 'platform';
            const isSku = dimensionParam === 'sku';
            const isLocation = dimensionParam === 'location' || dimensionParam === 'city';
            const groupByExpr = isPlatform ? 'p.Platform' : 
                               isSku ? 'p.Product' : 
                               (isLocation ? CITY_NORMALIZATION_SQL : PRODUCT_CATEGORY_SQL);

            const periodDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
            const compareEndDate = dayjs(startDate).subtract(1, 'day').format('YYYY-MM-DD');
            const compareStartDate = dayjs(compareEndDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');

            const platform = filters.platform || null;
            const location = filters.location || null;
            const brand = filters.brand || null;
            const category = filters.category || null;
            const channel = filters.channel || null;

            let whereConditions = [
                "toFloat64OrZero(toString(p.Selling_Price)) > 0"
            ];

            const dbName = getCurrentDbName();
            const isMars = dbName === 'mars';
            const channelCol = isMars ? 'p.channel' : 'p.Channel';
            const weightExpr = isMars ? "1" : "toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+'))";

            const platforms = parseMultiSelectFilter(platform);
            if (platforms) whereConditions.push(buildInClause('p.Platform', platforms));

            const locations = normalizeLocations(parseMultiSelectFilter(location));
            if (locations) whereConditions.push(buildInClause('p.Location', locations));

            const brands = parseMultiSelectFilter(brand);
            if (brands) whereConditions.push(buildInClause('p.Brand', brands));

            const categories = parseMultiSelectFilter(category);
            if (categories) whereConditions.push(`lower(${PRODUCT_CATEGORY_SQL}) IN (${categories.map(v => `'${escapeStr(v.toLowerCase())}'`).join(',')})`);

            const channels = normalizeChannels(parseMultiSelectFilter(channel));
            if (channels) whereConditions.push(buildInClause(channelCol, channels));

            const skus = parseMultiSelectFilter(filters.sku);
            if (skus) whereConditions.push(buildInClause('p.Product', skus));

            // ✅ Only show own brands for SKU dimension unless explicitly filtered
            if (isSku) {
                whereConditions.push("p.Comp_flag = '0'");
            }

            const whereClause = whereConditions.join(' AND ');

            const query = `
                SELECT
                    ${groupByExpr} AS dimension,
                    -- Current metrics
                    AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                             AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                        THEN ((ifNull(toFloat64OrZero(toString(p.MRP)), 0) - ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)) / ifNull(toFloat64OrZero(toString(p.MRP)), 0)) * 100 
                        ELSE NULL END) AS Discount,
                    AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                             AND ${weightExpr} > 0 
                        THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) / ${weightExpr} 
                        ELSE NULL END) AS PricePerUnit,
                    AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                             AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                        THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) / ifNull(toFloat64OrZero(toString(p.MRP)), 0) 
                        ELSE NULL END) AS RPI,
                    AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                        THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) 
                        ELSE NULL END) AS ASP,
                    SUM(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                        THEN toFloat64OrZero(toString(p.Sales)) 
                        ELSE 0 END) AS offtake,
                    
                    -- Previous metrics for change
                    AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                             AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                        THEN ((ifNull(toFloat64OrZero(toString(p.MRP)), 0) - ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)) / ifNull(toFloat64OrZero(toString(p.MRP)), 0)) * 100 
                        ELSE NULL END) AS discount_prev,
                    AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                             AND ${weightExpr} > 0 
                        THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) / ${weightExpr} 
                        ELSE NULL END) AS price_per_unit_prev,
                    AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                             AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
                        THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) / ifNull(toFloat64OrZero(toString(p.MRP)), 0) 
                        ELSE NULL END) AS rpi_prev,
                    AVG(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                        THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) 
                        ELSE NULL END) AS asp_prev,
                    SUM(CASE WHEN p.DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                        THEN toFloat64OrZero(toString(p.Sales)) 
                        ELSE 0 END) AS offtake_prev
                FROM rb_pdp_olap p
                WHERE p.DATE BETWEEN '${compareStartDate}' AND '${endDate}'
                  AND ${whereClause}
                GROUP BY dimension
                ORDER BY Discount DESC
            `;

            console.log('[PricingAnalysisService] Executing Dimension Overview query...');
            const results = await queryClickHouse(query);

            const data = results.map((r, i) => {
                const getMetric = (curr, prev) => {
                    const c = parseFloat(curr) || 0;
                    const p = parseFloat(prev) || 0;
                    const change = p > 0 ? ((c - p) / p) * 100 : 0;
                    return {
                        value: c,
                        change: Math.abs(change),
                        dir: change >= 0 ? 'up' : 'down'
                    };
                };

                return {
                    id: String(i + 1),
                    key: r.dimension,
                    name: r.dimension,
                    data: {
                        discount: getMetric(r.Discount, r.discount_prev),
                        pricePerUnit: getMetric(r.PricePerUnit, r.price_per_unit_prev),
                        rpi: getMetric(r.RPI, r.rpi_prev),
                        asp: getMetric(r.ASP, r.asp_prev),
                        offtake: getMetric(r.offtake, r.offtake_prev)
                    }
                };
            });

            return { success: true, data };
        } catch (error) {
            console.error('[PricingAnalysisService] Error in getDimensionOverview:', error);
            return { success: false, error: error.message };
        }
    })();
};

/**
 * Get Pricing Dimension Trends (time-series)
 * @param {Object} filters - dimension, dimensionValue, timeStep, period, platform, brand, location, category
 */
const getDimensionTrends = async (filters = {}) => {
    try {
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const periodDays = filters.period === '3M' ? 90 : filters.period === '6M' ? 180 : filters.period === '1Y' ? 365 : 30;
        const startDate = filters.startDate || dayjs(endDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');

        const dimensionParam = filters.dimension || 'category';
        const isPlatform = dimensionParam === 'platform';
        const isSku = dimensionParam === 'sku';
        const isLocation = dimensionParam === "location" || dimensionParam === "city";
        const groupByExpr = isPlatform ? 'p.Platform' : 
                           isSku ? 'p.Product' : 
                           (isLocation ? CITY_NORMALIZATION_SQL : PRODUCT_CATEGORY_SQL);
        const dimensionValue = filters.dimensionValue;

        let whereConditions = [
            `p.DATE BETWEEN '${startDate}' AND '${endDate}'`,
            "toFloat64OrZero(toString(p.Selling_Price)) > 0"
        ];

        const platform = filters.platform || null;
        const location = filters.location || null;
        const brand = filters.brand || null;
        const category = filters.category || null;

        const platforms = parseMultiSelectFilter(platform);
        if (platforms) whereConditions.push(buildInClause('p.Platform', platforms));

        const locations = normalizeLocations(parseMultiSelectFilter(location));
        if (locations) whereConditions.push(buildInClause('p.Location', locations));

        const brands = parseMultiSelectFilter(brand);
        if (brands) whereConditions.push(buildInClause('p.Brand', brands));

        const categoriesArr = parseMultiSelectFilter(category);
        if (categoriesArr) whereConditions.push(`${PRODUCT_CATEGORY_SQL} IN (${categoriesArr.map(v => `'${escapeStr(v)}'`).join(',')})`);

        const channels = normalizeChannels(parseMultiSelectFilter(filters.channel));
        if (channels) {
            const dbName = getCurrentDbName();
            const isMars = dbName === 'mars';
            const channelCol = isMars ? 'p.channel' : 'p.Channel';
            whereConditions.push(buildInClause(channelCol, channels));
        }

        const skus = parseMultiSelectFilter(filters.sku);
        if (skus) whereConditions.push(buildInClause('p.Product', skus));

        if (dimensionValue) {
            whereConditions.push(`lower(${groupByExpr}) = lower('${escapeStr(dimensionValue)}')`);
        }

        const dbName = getCurrentDbName();
        const isMars = dbName === 'mars';
        const weightExpr = isMars ? "1" : "toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+'))";

        const whereClause = whereConditions.join(' AND ');

        const query = `
        SELECT
            toString(p.DATE) AS date,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN ((toFloat64OrZero(toString(p.MRP)) - toFloat64OrZero(toString(p.Selling_Price))) / toFloat64OrZero(toString(p.MRP))) * 100
                ELSE NULL END) AS discount,
            AVG(CASE WHEN ${weightExpr} > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / ${weightExpr}
                ELSE NULL END) AS price_per_unit,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(toString(p.MRP))
                ELSE NULL END) AS rpi,
            AVG(toFloat64OrZero(toString(p.Selling_Price))) AS asp,
            SUM(toFloat64OrZero(toString(p.Sales))) AS offtake
        FROM rb_pdp_olap p
        WHERE ${whereClause}
        GROUP BY p.DATE
        ORDER BY p.DATE ASC
        SETTINGS max_execution_time = 30
        `;

        console.log(`[PricingAnalysisService] Fetching Dimension Trends (${dimensionParam}=${dimensionValue})...`);
        const results = await queryClickHouse(query);

        const timeSeries = (results || []).map(r => ({
            date: r.date,
            Discount: parseFloat(r.discount) || 0,
            PricePerUnit: parseFloat(r.price_per_unit) || 0,
            RPI: parseFloat(r.rpi) || 0,
            ASP: parseFloat(r.asp) || 0,
            Offtake: parseFloat(r.offtake) || 0,
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
        const dbName = getCurrentDbName();
        const isMars = dbName === 'mars';
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
            "toFloat64OrZero(toString(p.Selling_Price)) > 0"
        ];

        const platform = filters.platform || null;
        const location = filters.location || null;
        const category = filters.category || null;
        const dimensionParam = filters.dimension || 'category';
        const isPlatform = dimensionParam === 'platform';
        const isSku = dimensionParam === 'sku';
        const isLocation = dimensionParam === 'location' || dimensionParam === 'city';
        const groupByExpr = isPlatform ? 'p.Platform' : 
                           isSku ? 'p.Product' : 
                           (isLocation ? CITY_NORMALIZATION_SQL : PRODUCT_CATEGORY_SQL);
        const dimensionValue = filters.dimensionValue;

        const platforms = parseMultiSelectFilter(platform);
        if (platforms) whereConditions.push(buildInClause('p.Platform', platforms));

        const locations = normalizeLocations(parseMultiSelectFilter(location));
        if (locations) whereConditions.push(buildInClause('p.Location', locations));

        const categoriesArr = parseMultiSelectFilter(category);
        if (categoriesArr) {
            const escaped = categoriesArr.map(v => `'${escapeStr(v.toLowerCase())}'`).join(',');
            whereConditions.push(`lower(${PRODUCT_CATEGORY_SQL}) IN (${escaped})`);
        }

        const channels = normalizeChannels(parseMultiSelectFilter(filters.channel));
        if (channels) {
            const channelCol = isMars ? 'p.channel' : 'p.Channel';
            whereConditions.push(buildInClause(channelCol, channels));
        }

        if (dimensionValue) {
            whereConditions.push(`lower(${groupByExpr}) = lower('${escapeStr(dimensionValue)}')`);
        }

        // Target filtering
        const targetColumn = mode === 'sku' ? 'Product' : 'Brand';
        whereConditions.push(buildInClause(`p.${targetColumn}`, targets));

        const weightExpr = isMars ? "1" : "toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+'))";

        const whereClause = whereConditions.join(' AND ');

        const query = `
        SELECT
            toString(p.DATE) AS date,
            p.${targetColumn} AS target_name,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN ((toFloat64OrZero(toString(p.MRP)) - toFloat64OrZero(toString(p.Selling_Price))) / toFloat64OrZero(toString(p.MRP))) * 100
                ELSE NULL END) AS discount,
            AVG(CASE WHEN ${weightExpr} > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / ${weightExpr}
                ELSE NULL END) AS price_per_unit,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(toString(p.MRP))
                ELSE NULL END) AS rpi,
            AVG(toFloat64OrZero(toString(p.Selling_Price))) AS asp,
            SUM(toFloat64OrZero(toString(p.Sales))) AS offtake
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
                Offtake: parseFloat(r.offtake) || 0,
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
        const dbName = getCurrentDbName();
        const isMars = dbName === 'mars';

        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const periodDays = filters.period === '3M' ? 90 : filters.period === '6M' ? 180 : filters.period === '1Y' ? 365 : 30;
        const startDate = filters.startDate || dayjs(endDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');

        const dimensionParam = filters.dimension || 'category';
        const isPlatform = dimensionParam === 'platform';
        const isSku = dimensionParam === 'sku';
        const isLocation = dimensionParam === "location" || dimensionParam === "city";
        const groupByExpr = isPlatform ? 'p.Platform' : 
                           isSku ? 'p.Product' : 
                           (isLocation ? CITY_NORMALIZATION_SQL : PRODUCT_CATEGORY_SQL);
        const dimensionValue = filters.dimensionValue;

        let whereConditions = [
            `p.DATE BETWEEN '${startDate}' AND '${endDate}'`,
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

        const locations = normalizeLocations(parseMultiSelectFilter(location));
        if (locations) whereConditions.push(buildInClause('p.Location', locations));

        const brands = parseMultiSelectFilter(brand);
        if (brands) whereConditions.push(buildInClause('p.Brand', brands));

        const categoriesArr = parseMultiSelectFilter(category);
        if (categoriesArr) {
            const escaped = categoriesArr.map(v => `'${escapeStr(v.toLowerCase())}'`).join(',');
            whereConditions.push(`lower(${PRODUCT_CATEGORY_SQL}) IN (${escaped})`);
        }

        const channels = normalizeChannels(parseMultiSelectFilter(filters.channel));
        if (channels) {
            const channelCol = isMars ? 'p.channel' : 'p.Channel';
            whereConditions.push(buildInClause(channelCol, channels));
        }

        // Filter by the specific dimension value (e.g., "Toothpaste" or "Mumbai")
        if (dimensionValue) {
            whereConditions.push(`lower(${groupByExpr}) = lower('${escapeStr(dimensionValue)}')`);
        }

        const skus = parseMultiSelectFilter(filters.sku);
        if (skus) whereConditions.push(buildInClause('p.Product', skus));

        const weightExpr = isMars ? "1" : "toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+'))";

        const whereClause = whereConditions.join(' AND ');

        // Brand-level query: Discount, PricePerUnit, RPI, ASP grouped by brand
        const brandQuery = `
        SELECT
            p.Brand AS brand_name,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN ((toFloat64OrZero(toString(p.MRP)) - toFloat64OrZero(toString(p.Selling_Price))) / toFloat64OrZero(toString(p.MRP))) * 100
                ELSE NULL END) AS discount,
            AVG(CASE WHEN ${weightExpr} > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / ${weightExpr}
                ELSE NULL END) AS price_per_unit,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(toString(p.MRP))
                ELSE NULL END) AS rpi,
            AVG(toFloat64OrZero(toString(p.Selling_Price))) AS asp,
            SUM(toFloat64OrZero(toString(p.Sales))) AS offtake
        FROM rb_pdp_olap p
        WHERE ${whereClause}
        GROUP BY brand_name
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
            AVG(CASE WHEN ${weightExpr} > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / ${weightExpr}
                ELSE NULL END) AS price_per_unit,
            AVG(CASE WHEN toFloat64OrZero(toString(p.MRP)) > 0
                THEN toFloat64OrZero(toString(p.Selling_Price)) / toFloat64OrZero(toString(p.MRP))
                ELSE NULL END) AS rpi,
            AVG(toFloat64OrZero(toString(p.Selling_Price))) AS asp,
            SUM(toFloat64OrZero(toString(p.Sales))) AS offtake
        FROM rb_pdp_olap p
        WHERE ${whereClause}
          AND p.Product IS NOT NULL
          AND p.Product != ''
        GROUP BY p.Product, p.Brand
        ORDER BY discount DESC
        LIMIT 40
        SETTINGS max_execution_time = 30
        `;

        console.log(`[PricingAnalysisService] Fetching competition data (${dimensionParam}=${dimensionValue})...`);
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
            Offtake: parseFloat(r.offtake) || 0,
        }));

        const skuRows = (skuResults || []).map(r => ({
            sku_name: r.sku_name,
            brand_name: r.brand_name,
            Discount: parseFloat(r.discount) || 0,
            PricePerUnit: parseFloat(r.price_per_unit) || 0,
            RPI: parseFloat(r.rpi) || 0,
            ASP: parseFloat(r.asp) || 0,
            Offtake: parseFloat(r.offtake) || 0,
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
