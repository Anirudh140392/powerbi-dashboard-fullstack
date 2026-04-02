import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';
import { getTableColumns, resolveColumn, columnExists } from '../utils/schemaHelper.js';


// Helper to escape string for SQL
const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

// Dynamic SQL snippet builders that use resolved column names
const buildProductCategorySql = (categoryCol, brandCol, productCol) => `if(${categoryCol} IS NOT NULL AND ${categoryCol} != '' AND ${categoryCol} != '0', 
    ${categoryCol}, 
    multiIf(LOWER(${brandCol}) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', 
            LOWER(${brandCol}) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m'), 
                if(LOWER(toString(${productCol})) LIKE '%gift%' OR LOWER(toString(${productCol})) LIKE '%tin pack%', 
                   'Chocolates (Gifting)', 
                   'Chocolates (Non Gifting)'), 
            'Others')
)`;

const buildCityNormSql = (locationCol) => `multiIf(
    lower(${locationCol}) = 'bangalore', 'bengaluru',
    lower(${locationCol}) = 'gurgaon', 'gurugram',
    lower(${locationCol}) = 'ahemdabad', 'ahmedabad',
    lower(${locationCol}) = 'ahmedabad', 'ahmedabad',
    ${locationCol}
)`;

// Keep static versions for backward compatibility in functions that haven't been migrated
const PRODUCT_CATEGORY_SQL = buildProductCategorySql('Category', 'Brand', 'Product');
const CITY_NORMALIZATION_SQL = buildCityNormSql('p.Location');

/**
 * Dynamic schema resolution for rb_pdp_olap table.
 * Discovers actual column names at runtime to support different DB schemas.
 */
async function getPricingSource() {
    const cols = await getTableColumns('rb_pdp_olap');
    const r = (name) => resolveColumn(cols, name);

    const sellingPriceCol = r('Selling_Price');
    const mrpCol = r('MRP');
    const brandCol = r('Brand');
    const productCol = r('Product');
    const platformCol = r('Platform');
    const locationCol = r('Location');
    const salesCol = r('Sales');
    const discountCol = r('Discount');
    const compFlagCol = r('Comp_flag');
    const channelCol = r('channel'); // auto-resolves to 'channel' or 'Channel'
    const webPidCol = r('Web_Pid');
    const dateCol = r('DATE');
    const categoryCol = r('Category');
    const weightCol = r('Weight');
    const listingPercentCol = r('listing_percent');
    const nenoOsaCol = r('neno_osa');
    const denoOsaCol = r('deno_osa');
    const qtySoldCol = r('Qty_Sold');
    const ppuCol = r('PPU');

    const hasWeight = columnExists(cols, 'Weight');
    const weightExpr = hasWeight ? `toFloat64OrZero(extract(toString(p.${weightCol}), '^[0-9.]+'))` : '1';

    const wrap = (col) => `ifNull(toFloat64OrZero(toString(p.${col})), 0)`;

    // Build dynamic PRODUCT_CATEGORY_SQL and CITY_NORMALIZATION_SQL
    const prodCatSql = buildProductCategorySql(categoryCol, brandCol, productCol);
    const cityNormSql = buildCityNormSql(`p.${locationCol}`);

    return {
        table: 'rb_pdp_olap',
        cols,
        f: {
            sellingPrice: sellingPriceCol,
            mrp: mrpCol,
            brand: brandCol,
            product: productCol,
            platform: platformCol,
            location: locationCol,
            sales: salesCol,
            discount: discountCol,
            compFlag: compFlagCol,
            channel: channelCol,
            webPid: webPidCol,
            date: dateCol,
            category: categoryCol,
            weight: weightCol,
            listingPercent: listingPercentCol,
            nenoOsa: nenoOsaCol,
            denoOsa: denoOsaCol,
            qtySold: qtySoldCol,
            weightExpr,
            // Wrapped expressions for SQL
            wSellingPrice: wrap(sellingPriceCol),
            wMrp: wrap(mrpCol),
            wSales: wrap(salesCol),
            wDiscount: wrap(discountCol),
            wListingPercent: `toFloat64OrZero(toString(p.${listingPercentCol}))`,
            wNenoOsa: wrap(nenoOsaCol),
            wDenoOsa: wrap(denoOsaCol),
            wPpu: `(${wrap(ppuCol)} * 100)`,
        },
        prodCatSql,
        cityNormSql
    };
}

/**
 * Dynamic schema resolution for rb_brand_ms table.
 */
async function getBrandMsSource() {
    const cols = await getTableColumns('rb_brand_ms');
    const r = (name) => resolveColumn(cols, name);

    return {
        table: 'rb_brand_ms',
        cols,
        f: {
            webPid: r('web_pid'),
            createdOn: r('created_on'),
            sales: r('sales'),
            location: r('location')
        }
    };
}

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

            const src = await getPricingSource();
            const f = src.f;
            const gramCol = columnExists(src.cols, 'gram') ? 's.gram' : "''";

            // Build dynamic WHERE conditions
            let whereConditions = [
                `${f.wSellingPrice} > 0`,
                `p.${f.brand} IS NOT NULL`,
                `p.${f.platform} IS NOT NULL`
            ];

            // Platform filter (supports multiselect)
            const platforms = parseMultiSelectFilter(platform);
            if (platforms) {
                whereConditions.push(buildInClause(`p.${f.platform}`, platforms));
            }

            // Location filter (supports multiselect)
            const locations = normalizeLocations(parseMultiSelectFilter(location));
            if (locations) {
                whereConditions.push(buildInClause(`p.${f.location}`, locations));
            }

            const channels = normalizeChannels(parseMultiSelectFilter(channel));
            if (channels) {
                whereConditions.push(buildInClause(`p.${f.channel}`, channels));
            }

            const categories = parseMultiSelectFilter(category);
            if (categories) {
                const escaped = categories.map(v => `'${escapeStr(v.toLowerCase())}'`).join(',');
                whereConditions.push(`lower(${src.prodCatSql}) IN (${escaped})`);
            }

            const whereClause = whereConditions.join(' AND ');


            // SQL query to calculate ECP, MRP, and Discount for both periods
            // Join with rb_sku_platform to get pack size (gram)
            const query = `
            WITH comp_avg_ref AS (
                SELECT 
                    ${src.f.platform} as Platform, 
                    ${src.prodCatSql} as Category, 
                    AVG(ifNull(toFloat64OrZero(toString(${src.f.sellingPrice})), 0)) as avg_comp_val_curr,
                    AVG(CASE WHEN ${src.f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN ifNull(toFloat64OrZero(toString(${src.f.sellingPrice})), 0) ELSE NULL END) as avg_comp_val_prev
                FROM ${src.table}
                WHERE ${src.f.date} BETWEEN '${compareStartDate}' AND '${endDate}'
                  AND ${src.f.compFlag} = '1'
                  AND ifNull(toFloat64OrZero(toString(${src.f.sellingPrice})), 0) > 0
                GROUP BY Platform, Category
            )
            SELECT
                p.${src.f.brand} AS Brand,
                p.${src.prodNameSql} AS product,
                p.${src.prodPackSizeSql} AS pack_size,
                p.${src.f.platform} AS Platform,
                
                -- Current Period Our Metrics
                AVG(CASE WHEN p.${src.f.date} BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.${src.f.sellingPrice})), 0) ELSE NULL END) AS ecp_curr,
                AVG(CASE WHEN p.${src.f.date} BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.${src.f.mrp})), 0) ELSE NULL END) AS mrp_curr,
                AVG(CASE WHEN p.${src.f.date} BETWEEN '${startDate}' AND '${endDate}' THEN ifNull(toFloat64OrZero(toString(p.${src.f.discount})), 0) ELSE NULL END) AS discount_curr,
                ANY(c.avg_comp_val_curr) as comp_avg_curr,

                -- Previous Period Our Metrics
                AVG(CASE WHEN p.${src.f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN ifNull(toFloat64OrZero(toString(p.${src.f.sellingPrice})), 0) ELSE NULL END) AS ecp_prev,
                AVG(CASE WHEN p.${src.f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN ifNull(toFloat64OrZero(toString(p.${src.f.mrp})), 0) ELSE NULL END) AS mrp_prev,
                AVG(CASE WHEN p.${src.f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN ifNull(toFloat64OrZero(toString(p.${src.f.discount})), 0) ELSE NULL END) AS discount_prev,
                ANY(c.avg_comp_val_prev) as comp_avg_prev
            FROM ${src.table} p
            LEFT JOIN rb_sku_platform s ON p.${f.webPid} = s.web_pid
            LEFT JOIN comp_avg_ref c ON p.${src.f.platform} = c.Platform AND ${src.prodCatSql} = c.Category
            WHERE p.${src.f.date} BETWEEN '${compareStartDate}' AND '${endDate}'
              AND p.${src.f.brand} IS NOT NULL
              AND p.${src.f.brand} != ''
              AND p.${src.f.compFlag} = '0'
              AND ${whereClause}
            GROUP BY Brand, product, pack_size, Platform
            HAVING ecp_prev IS NOT NULL AND ecp_curr IS NOT NULL
            ORDER BY Brand, product
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

                // Calculate RPI: Our Brand SP / Competition Brand SP
                // In product-level comparison, we compare this specific SKU against the average of competitors in the same context
                // However, for SKU-level, we might want to keep SP/MRP if it's more relevant?
                // The user requested RPI as Our Brand / Competition Price.
                // In getEcpComparison, we have brand/product rows.
                // We will use SP / MRP for SKU-level as a baseline or implement a competition comparison if possible.
                // Given the request, I will use SP/MRP for individual SKU items but global RPI for brand overview.
                // Actually, if it's a "Pricing Overview" segment change, I should focus on the aggregate KPIs first.
                // But let's stay consistent.
                const compAvgPrev = parseFloat(row.comp_avg_prev) || 0;
                const rpiPrev = compAvgPrev > 0 ? (ecpPrev / compAvgPrev) : 1.0;

                const compAvgCurr = parseFloat(row.comp_avg_curr) || 0;
                const rpiCurr = compAvgCurr > 0 ? (ecpCurr / compAvgCurr) : 1.0;

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
                            p.${f.product} as product,
                            p.${f.location} as city,
                            ROUND(
                                SUM(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN ${f.wSellingPrice} ELSE 0 END)
                                / NULLIF(COUNT(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND ${f.wSellingPrice} > 0 THEN 1 END), 0),
                                2
                            ) AS ecp_prev,
                            ROUND(
                                SUM(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' THEN ${f.wSellingPrice} ELSE 0 END)
                                / NULLIF(COUNT(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' AND ${f.wSellingPrice} > 0 THEN 1 END), 0),
                                2
                            ) AS ecp_curr,
                            ROUND(
                                SUM(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' THEN ${f.wDiscount} ELSE 0 END)
                                / NULLIF(COUNT(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' THEN 1 END), 0),
                                2
                            ) AS discount_curr
                        FROM ${src.table} p
                        WHERE p.${f.date} BETWEEN '${compareStartDate}' AND '${endDate}'
                          AND p.${f.product} IN (${productEscaped})
                          ${platforms ? `AND ${buildInClause(`p.${f.platform}`, platforms)}` : ''}
                          ${locations ? `AND ${buildInClause(`p.${f.location}`, locations)}` : ''}
                          ${channels ? `AND ${buildInClause(`p.${f.channel}`, channels)}` : ''}
                          ${categories ? `AND ${src.prodCatSql} IN (${categories.map(v => `'${escapeStr(v)}'`).join(',')})` : ''}
                        GROUP BY p.${f.product}, p.${f.location}
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
            const startDate = filters.startDate || dayjs().startOf('month').format('YYYY-MM-DD');

            const periodDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
            const compareEndDate = dayjs(startDate).subtract(1, 'day').format('YYYY-MM-DD');
            const compareStartDate = dayjs(compareEndDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');

            const platform = filters.platform || null;
            const location = filters.location || null;
            const brand = filters.brand || null;
            const category = filters.category || null;
            const channel = filters.channel || null;

            const src = await getPricingSource();
            const f = src.f;

            let whereConditions = [
                `${f.wSellingPrice} > 0`
            ];

            const platforms = parseMultiSelectFilter(platform);
            if (platforms) whereConditions.push(buildInClause(`p.${f.platform}`, platforms));

            const locations = normalizeLocations(parseMultiSelectFilter(location));
            if (locations) whereConditions.push(buildInClause(`p.${f.location}`, locations));

            const brands = parseMultiSelectFilter(brand);
            // ✅ Removed Brand from WHERE clause to allow RPI comparison against all Competitors (p.Comp_flag = 1)
            // Brand filters will be applied inside CASE statements for individual KPIs
            // if (brands) whereConditions.push(buildInClause(`p.${f.brand}`, brands));

            const categories = parseMultiSelectFilter(category);
            if (categories) {
                const escaped = categories.map(v => `'${escapeStr(v.toLowerCase())}'`).join(',');
                whereConditions.push(`lower(${src.prodCatSql}) IN (${escaped})`);
            }

            const channels = normalizeChannels(parseMultiSelectFilter(channel));
            if (channels) whereConditions.push(buildInClause(`p.${f.channel}`, channels));

            const whereClause = whereConditions.join(' AND ');

            const brandCondition = brands ? buildInClause(`p.${f.brand}`, brands) : `p.${f.compFlag} = '0'`;

            const query = `
            SELECT
                -- Current Period Our Brands Metrics (Filtered by selected Brands or all Our Brands)
                AVG(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' 
                         AND ${f.wMrp} > 0 
                         AND ${brandCondition}
                    THEN ((${f.wMrp} - ${f.wSellingPrice}) / ${f.wMrp}) * 100 
                    ELSE NULL END) AS discount_curr,
                
                SUM(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' 
                         AND ${f.wMrp} > 0 
                         AND ${brandCondition}
                    THEN ((${f.wMrp} - ${f.wSellingPrice}) / ${f.wMrp}) * ${f.wSales} 
                    ELSE 0 END) / 
                NULLIF(SUM(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' AND ${brandCondition} THEN ${f.wSales} ELSE 0 END), 0) * 100 AS weighted_discount_curr,
                
                AVG(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' 
                         AND ${f.wPpu} > 0 
                         AND ${brandCondition}
                    THEN ${f.wPpu} 
                    ELSE NULL END) AS price_per_unit_curr,
                
                -- ✅ NEW RPI Logic: Our Brand SP / Competition Brand SP
                (
                    AVG(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' AND ${brandCondition} THEN ${f.wSellingPrice} ELSE NULL END)
                    /
                    NULLIF(AVG(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' AND p.${f.compFlag} = '1' THEN ${f.wSellingPrice} ELSE NULL END), 0)
                ) AS rpi_curr,
                
                AVG(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' 
                         AND ${brandCondition}
                    THEN ${f.wSellingPrice} 
                    ELSE NULL END) AS asp_curr,
 
                -- Previous Period
                AVG(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                         AND ${f.wMrp} > 0 
                         AND ${brandCondition}
                    THEN ((${f.wMrp} - ${f.wSellingPrice}) / ${f.wMrp}) * 100 
                    ELSE NULL END) AS discount_prev,
                
                SUM(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                         AND ${f.wMrp} > 0 
                         AND ${brandCondition}
                    THEN ((${f.wMrp} - ${f.wSellingPrice}) / ${f.wMrp}) * ${f.wSales} 
                    ELSE 0 END) / 
                NULLIF(SUM(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND ${brandCondition} THEN ${f.wSales} ELSE 0 END), 0) * 100 AS weighted_discount_prev,
                
                AVG(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                         AND ${f.wPpu} > 0 
                         AND ${brandCondition}
                    THEN ${f.wPpu} 
                    ELSE NULL END) AS price_per_unit_prev,
                
                -- ✅ NEW RPI Logic (Previous Period)
                (
                    AVG(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND ${brandCondition} THEN ${f.wSellingPrice} ELSE NULL END)
                    /
                    NULLIF(AVG(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND p.${f.compFlag} = '1' THEN ${f.wSellingPrice} ELSE NULL END), 0)
                ) AS rpi_prev,
                
                AVG(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                         AND ${brandCondition}
                    THEN ${f.wSellingPrice} 
                    ELSE NULL END) AS asp_prev

            FROM ${src.table} p
            WHERE p.${f.date} BETWEEN '${compareStartDate}' AND '${endDate}'
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
                // rpi: {
                //     value: formatVal(r.rpi_curr),
                //     prev: formatVal(r.rpi_prev),
                //     change: calcChange(formatVal(r.rpi_curr), formatVal(r.rpi_prev))
                // },
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

            const src = await getPricingSource();
            const f = src.f;

            let whereConditions = [
                `${f.wSellingPrice} > 0`,
                `p.${f.brand} IS NOT NULL`
            ];

            const platforms = parseMultiSelectFilter(platform);
            if (platforms) whereConditions.push(buildInClause(`p.${f.platform}`, platforms));

            const locations = normalizeLocations(parseMultiSelectFilter(location));
            if (locations) whereConditions.push(buildInClause(`p.${f.location}`, locations));

            const brands = parseMultiSelectFilter(brand);
            if (brands) whereConditions.push(buildInClause(`p.${f.brand}`, brands));

            const categories = parseMultiSelectFilter(category);
            if (categories) whereConditions.push(`${src.prodCatSql} IN (${categories.map(v => `'${escapeStr(v)}'`).join(',')})`);

            const channels = normalizeChannels(parseMultiSelectFilter(channel));
            if (channels) whereConditions.push(buildInClause(`p.${f.channel}`, channels));

            const whereClause = whereConditions.join(' AND ');

            // Comp_flag = 0 means My SKUs, 1 means Competitor
            // We calculate Average Discount change per SKU
            const query = `
            SELECT
                p.${f.brand} AS Brand,
                p.${f.product} AS Product,
                ${src.prodCatSql} AS Category,
                p.${f.compFlag} AS Comp_flag,
                p.${f.platform} AS Platform,
                AVG(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' 
                         AND ${f.wMrp} > 0 
                    THEN ((${f.wMrp} - ${f.wSellingPrice}) / ${f.wMrp}) * 100 
                    ELSE NULL END) AS discount_curr,
                AVG(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}'
                    THEN ${f.wListingPercent}
                    ELSE NULL END) AS listing_curr,
                (SUM(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' THEN ${f.wNenoOsa} ELSE 0 END) / 
                 NULLIF(SUM(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' THEN ${f.wDenoOsa} ELSE 0 END), 0)) * 100 AS osa_curr,
                
                -- Take Sales directly from rb_pdp_olap
                SUM(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' THEN ${f.wSales} ELSE 0 END) AS offtakes_curr,
                
                AVG(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                         AND ${f.wMrp} > 0 
                    THEN ((${f.wMrp} - ${f.wSellingPrice}) / ${f.wMrp}) * 100 
                    ELSE NULL END) AS discount_prev
            FROM ${src.table} p
            WHERE p.${f.date} BETWEEN '${compareStartDate}' AND '${endDate}'
              AND ${whereClause}
            GROUP BY p.${f.brand}, p.${f.product}, Category, p.${f.compFlag}, Platform
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
                    platform: r.Platform,
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
            allTopSkus.forEach(s => { cityDataMap[`${s.platform}|${s.title}`] = []; });
            if (productsList.length > 0) {
                const productEscaped = productsList.map(p => `'${escapeStr(p)}'`).join(',');
                const cityQuery = `
                    SELECT
                        p.${f.product} as product,
                        p.${f.platform} as platform,
                        p.${f.location} as city,
                        AVG(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' AND ${f.wMrp} > 0 
                            THEN ((${f.wMrp} - ${f.wSellingPrice}) / ${f.wMrp}) * 100 
                            ELSE NULL END) AS discount_curr,
                        AVG(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}'
                            THEN ${f.wListingPercent}
                            ELSE NULL END) AS listing_curr,
                        (SUM(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' THEN ${f.wNenoOsa} ELSE 0 END) / 
                         NULLIF(SUM(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' THEN ${f.wDenoOsa} ELSE 0 END), 0)) * 100 AS osa_curr,
                        
                        -- Take Sales directly from rb_pdp_olap for city level
                        SUM(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' THEN ${f.wSales} ELSE 0 END) AS offtakes_curr,

                        AVG(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND ${f.wMrp} > 0 
                            THEN ((${f.wMrp} - ${f.wSellingPrice}) / ${f.wMrp}) * 100 
                            ELSE NULL END) AS discount_prev
                    FROM ${src.table} p
                    WHERE p.${f.date} BETWEEN '${compareStartDate}' AND '${endDate}'
                      AND p.${f.product} IN (${productEscaped})
                      ${platforms ? `AND ${buildInClause(`p.${f.platform}`, platforms)}` : ''}
                      ${locations ? `AND ${buildInClause(`p.${f.location}`, locations)}` : ''}
                      ${channels ? `AND ${buildInClause(`p.${f.channel}`, channels)}` : ''}
                      ${categories ? `AND ${src.prodCatSql} IN (${categories.map(v => `'${escapeStr(v)}'`).join(',')})` : ''}
                    GROUP BY p.${f.product}, p.${f.platform}, p.${f.location}
                    HAVING discount_curr IS NOT NULL AND discount_prev IS NOT NULL
                `;

                const cityResults = await queryClickHouse(cityQuery);
                cityResults.forEach(r => {
                    const product = r.product;
                    const platform = r.platform;
                    const key = `${platform}|${product}`;
                    const dc = parseFloat(r.discount_curr) || 0;
                    const dp = parseFloat(r.discount_prev) || 0;
                    const delta = dp - dc; // delta represents price change

                    if (!cityDataMap[key]) cityDataMap[key] = [];
                    
                    cityDataMap[key].push({
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

            const enrichSku = (skus, label) => skus.map((s, i) => {
                const key = `${s.platform}|${s.title}`;
                return {
                    ...s,
                    id: `${s.brand}_${s.platform}_${label}_${i}`,
                    badge: `${label} ${i + 1}`,
                    size: "Mixed",
                    cities: cityDataMap[key] ? cityDataMap[key].slice(0, 20) : [
                        { name: "Global Avg", discount: s.discount, change: s.delta }
                    ]
                };
            });

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
            const startDate = filters.startDate || dayjs().startOf('month').format('YYYY-MM-DD');
            const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');

            const src = await getPricingSource();
            const f = src.f;

            const dimensionParam = filters.dimension || 'category';
            // dimensionParam can be 'category', 'location', 'city' or 'platform'
            const isPlatform = dimensionParam === 'platform';
            const isSku = dimensionParam === 'sku';
            const isLocation = dimensionParam === 'location' || dimensionParam === 'city';
            const groupByExpr = isPlatform ? `p.${f.platform}` :
                isSku ? `p.${f.product}` :
                    (isLocation ? src.cityNormSql : src.prodCatSql);

            const periodDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
            const compareEndDate = dayjs(startDate).subtract(1, 'day').format('YYYY-MM-DD');
            const compareStartDate = dayjs(compareEndDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');

            const platform = filters.platform || null;
            const location = filters.location || null;
            const brand = filters.brand || null;
            const category = filters.category || null;
            const channel = filters.channel || null;

            let whereConditions = [
                `${f.wSellingPrice} > 0`,
                `p.${f.brand} IS NOT NULL`,
                `p.${f.brand} != ''`
            ];

            const platforms = parseMultiSelectFilter(platform);
            if (platforms) whereConditions.push(buildInClause(`p.${f.platform}`, platforms));

            const locations = normalizeLocations(parseMultiSelectFilter(location));
            if (locations) whereConditions.push(buildInClause(`p.${f.location}`, locations));

            const brands = parseMultiSelectFilter(brand);
            // ✅ Removed Brand from WHERE clause to allow RPI comparison against all Competitors
            // if (brands) whereConditions.push(buildInClause(`p.${f.brand}`, brands));

            const categories = parseMultiSelectFilter(category);
            if (categories) whereConditions.push(`lower(${src.prodCatSql}) IN (${categories.map(v => `'${escapeStr(v.toLowerCase())}'`).join(',')})`);

            const channels = normalizeChannels(parseMultiSelectFilter(channel));
            if (channels) whereConditions.push(buildInClause(`p.${f.channel}`, channels));

            const skus = parseMultiSelectFilter(filters.sku);
            if (skus) whereConditions.push(buildInClause(`p.${f.product}`, skus));

            // ✅ Only show own brands for SKU dimension unless explicitly filtered
            if (isSku) {
                whereConditions.push(`p.${f.compFlag} = '0'`);
            }

            const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '1=1';
            const brandCondition = brands ? buildInClause(`p.${f.brand}`, brands) : `p.${f.compFlag} = '0'`;

            const query = `
                SELECT
                    ${groupByExpr} AS dimension,
                    -- Current metrics (Subject Brands)
                    AVG(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' 
                             AND ${f.wMrp} > 0 
                             AND ${brandCondition}
                        THEN ((${f.wMrp} - ${f.wSellingPrice}) / ${f.wMrp}) * 100 
                        ELSE NULL END) AS Discount,
                    AVG(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' 
                             AND ${f.wPpu} > 0 
                             AND ${brandCondition}
                        THEN ${f.wPpu} 
                        ELSE NULL END) AS PricePerUnit,
                    
                    -- ✅ NEW RPI Logic: Our Brand SP / Competition Brand SP
                    (
                        AVG(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' AND ${brandCondition} THEN ${f.wSellingPrice} ELSE NULL END)
                        /
                        NULLIF(AVG(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' AND p.${f.compFlag} = '1' THEN ${f.wSellingPrice} ELSE NULL END), 0)
                    ) AS RPI,
                    
                    AVG(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' 
                             AND ${brandCondition}
                        THEN ${f.wSellingPrice} 
                        ELSE NULL END) AS ASP,
                    SUM(CASE WHEN p.${f.date} BETWEEN '${startDate}' AND '${endDate}' 
                             AND ${brandCondition}
                        THEN ${f.wSales} 
                        ELSE 0 END) AS offtake,
                    
                    -- Previous metrics for change
                    AVG(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                             AND ${f.wMrp} > 0 
                             AND ${brandCondition}
                        THEN ((${f.wMrp} - ${f.wSellingPrice}) / ${f.wMrp}) * 100 
                        ELSE NULL END) AS discount_prev,
                    AVG(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                             AND ${f.wPpu} > 0 
                             AND ${brandCondition}
                        THEN ${f.wPpu} 
                        ELSE NULL END) AS price_per_unit_prev,
                    
                    -- ✅ NEW RPI Logic (Previous Period)
                    (
                        AVG(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND ${brandCondition} THEN ${f.wSellingPrice} ELSE NULL END)
                        /
                        NULLIF(AVG(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' AND p.${f.compFlag} = '1' THEN ${f.wSellingPrice} ELSE NULL END), 0)
                    ) AS rpi_prev,
                    
                    AVG(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                             AND ${brandCondition}
                        THEN ${f.wSellingPrice} 
                        ELSE NULL END) AS asp_prev,
                    SUM(CASE WHEN p.${f.date} BETWEEN '${compareStartDate}' AND '${compareEndDate}' 
                             AND ${brandCondition}
                        THEN ${f.wSales} 
                        ELSE 0 END) AS offtake_prev
                FROM ${src.table} p
                WHERE p.${f.date} BETWEEN '${compareStartDate}' AND '${endDate}'
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
                        asp: getMetric(r.ASP, r.asp_prev),
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

        const src = await getPricingSource();
        const f = src.f;

        const dimensionParam = filters.dimension || 'category';
        const isPlatform = dimensionParam === 'platform';
        const isSku = dimensionParam === 'sku';
        const isLocation = dimensionParam === "location" || dimensionParam === "city";
        const groupByExpr = isPlatform ? `p.${f.platform}` :
            isSku ? `p.${f.product}` :
                (isLocation ? src.cityNormSql : src.prodCatSql);
        const dimensionValue = filters.dimensionValue;

        let whereConditions = [
            `p.${f.date} BETWEEN '${startDate}' AND '${endDate}'`,
            `${f.wSellingPrice} > 0`
        ];

        const platform = filters.platform || null;
        const location = filters.location || null;
        const brand = filters.brand || null;
        const category = filters.category || null;

        const platforms = parseMultiSelectFilter(platform);
        if (platforms) whereConditions.push(buildInClause(`p.${f.platform}`, platforms));

        const locations = normalizeLocations(parseMultiSelectFilter(location));
        if (locations) whereConditions.push(buildInClause(`p.${f.location}`, locations));

        const brands = parseMultiSelectFilter(brand);
        // ✅ Removed Brand from WHERE clause to allow RPI comparison against all Competitors
        // if (brands) whereConditions.push(buildInClause(`p.${f.brand}`, brands));

        const categoriesArr = parseMultiSelectFilter(category);
        if (categoriesArr) whereConditions.push(`${src.prodCatSql} IN (${categoriesArr.map(v => `'${escapeStr(v)}'`).join(',')})`);

        const channels = normalizeChannels(parseMultiSelectFilter(filters.channel));
        if (channels) {
            whereConditions.push(buildInClause(`p.${f.channel}`, channels));
        }

        const skus = parseMultiSelectFilter(filters.sku);
        if (skus) whereConditions.push(buildInClause(`p.${f.product}`, skus));

        if (dimensionValue) {
            whereConditions.push(`lower(${groupByExpr}) = lower('${escapeStr(dimensionValue)}')`);
        }

        const whereClause = whereConditions.join(' AND ');

        const brandCondition = brands ? buildInClause(`p.${f.brand}`, brands) : `p.${f.compFlag} = '0'`;

        const query = `
        SELECT
            toString(p.${f.date}) AS date,
            -- Current metrics (Subject Brands)
            AVG(CASE WHEN ${f.wMrp} > 0 AND ${brandCondition}
                THEN ((${f.wMrp} - ${f.wSellingPrice}) / ${f.wMrp}) * 100
                ELSE NULL END) AS discount,
            AVG(CASE WHEN ${f.wPpu} > 0 AND ${brandCondition}
                THEN ${f.wPpu}
                ELSE NULL END) AS price_per_unit,
            
            -- ✅ NEW RPI Logic: Our Brand SP / Competition Brand SP
            (
                AVG(CASE WHEN ${brandCondition} THEN ${f.wSellingPrice} ELSE NULL END)
                /
                NULLIF(AVG(CASE WHEN p.${f.compFlag} = '1' THEN ${f.wSellingPrice} ELSE NULL END), 0)
            ) AS rpi,
            
            AVG(CASE WHEN ${brandCondition} THEN ${f.wSellingPrice} ELSE NULL END) AS asp,
            SUM(CASE WHEN ${brandCondition} THEN ${f.wSales} ELSE 0 END) AS offtake
        FROM ${src.table} p
        WHERE ${whereClause}
        GROUP BY p.${f.date}
        ORDER BY p.${f.date} ASC
        SETTINGS max_execution_time = 30
        `;

        console.log(`[PricingAnalysisService] Fetching Dimension Trends (${dimensionParam}=${dimensionValue})...`);
        const results = await queryClickHouse(query);

        const timeSeries = (results || []).map(r => ({
            date: r.date,
            Discount: parseFloat(r.discount) || 0,
            PricePerUnit: parseFloat(r.price_per_unit) || 0,
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
        const src = await getPricingSource();
        const f = src.f;
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
            `p.${f.date} BETWEEN '${startDate}' AND '${endDate}'`,
            `${f.wSellingPrice} > 0`
        ];

        const platform = filters.platform || null;
        const location = filters.location || null;
        const category = filters.category || null;
        const dimensionParam = filters.dimension || 'category';
        const isPlatform = dimensionParam === 'platform';
        const isSku = dimensionParam === 'sku';
        const isLocation = dimensionParam === 'location' || dimensionParam === 'city';
        const groupByExpr = isPlatform ? `p.${f.platform}` :
            isSku ? `p.${f.product}` :
                (isLocation ? src.cityNormSql : src.prodCatSql);
        const dimensionValue = filters.dimensionValue;

        const platforms = parseMultiSelectFilter(platform);
        if (platforms) whereConditions.push(buildInClause(`p.${f.platform}`, platforms));

        const locations = normalizeLocations(parseMultiSelectFilter(location));
        if (locations) whereConditions.push(buildInClause(`p.${f.location}`, locations));

        const categoriesArr = parseMultiSelectFilter(category);
        if (categoriesArr) {
            const escaped = categoriesArr.map(v => `'${escapeStr(v.toLowerCase())}'`).join(',');
            whereConditions.push(`lower(${src.prodCatSql}) IN (${escaped})`);
        }

        const channels = normalizeChannels(parseMultiSelectFilter(filters.channel));
        if (channels) {
            whereConditions.push(buildInClause(`p.${f.channel}`, channels));
        }

        if (dimensionValue) {
            whereConditions.push(`lower(${groupByExpr}) = lower('${escapeStr(dimensionValue)}')`);
        }

        // Target filtering
        const targetColumn = mode === 'sku' ? f.product : f.brand;
        whereConditions.push(buildInClause(`p.${targetColumn}`, targets));

        const whereClause = whereConditions.join(' AND ');

        const query = `
        SELECT
            toString(p.${f.date}) AS date,
            p.${targetColumn} AS target_name,
            AVG(CASE WHEN ${f.wMrp} > 0
                THEN ((${f.wMrp} - ${f.wSellingPrice}) / ${f.wMrp}) * 100
                ELSE NULL END) AS discount,
            AVG(CASE WHEN ${f.wPpu} > 0
                THEN ${f.wPpu}
                ELSE NULL END) AS price_per_unit,
            AVG(${f.wSellingPrice}) / NULLIF(any(c.avg_comp_val), 0) AS rpi,
            AVG(${f.wSellingPrice}) AS asp,
            SUM(${f.wSales}) AS offtake
        FROM ${src.table} p
        LEFT JOIN (
            SELECT 
                p.${f.date} AS date_key, 
                AVG(${f.wSellingPrice}) as avg_comp_val
            FROM ${src.table} p
            WHERE p.${f.date} BETWEEN '${startDate}' AND '${endDate}'
              AND p.${src.f.compFlag} = '1'
              AND ${f.wSellingPrice} > 0
              ${platforms ? `AND ${buildInClause(`p.${f.platform}`, platforms)}` : ''}
            GROUP BY date_key
        ) c ON p.${f.date} = c.date_key
        WHERE ${whereClause}
        GROUP BY p.${f.date}, p.${targetColumn}
        ORDER BY p.${f.date} ASC
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
        const src = await getPricingSource();
        const f = src.f;

        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const periodDays = filters.period === '3M' ? 90 : filters.period === '6M' ? 180 : filters.period === '1Y' ? 365 : 30;
        const startDate = filters.startDate || dayjs(endDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');

        const dimensionParam = filters.dimension || 'category';
        const isPlatform = dimensionParam === 'platform';
        const isSku = dimensionParam === 'sku';
        const isLocation = dimensionParam === "location" || dimensionParam === "city";
        const groupByExpr = isPlatform ? `p.${f.platform}` :
            isSku ? `p.${f.product}` :
                (isLocation ? src.cityNormSql : src.prodCatSql);
        const dimensionValue = filters.dimensionValue;

        let whereConditions = [
            `p.${f.date} BETWEEN '${startDate}' AND '${endDate}'`,
            `${f.wSellingPrice} > 0`,
            `p.${f.brand} IS NOT NULL`,
            `p.${f.brand} != ''`
        ];

        const platform = filters.platform || null;
        const location = filters.location || null;
        const brand = filters.brand || null;
        const category = filters.category || null;

        const platforms = parseMultiSelectFilter(platform);
        if (platforms) whereConditions.push(buildInClause(`p.${f.platform}`, platforms));

        const locations = normalizeLocations(parseMultiSelectFilter(location));
        if (locations) whereConditions.push(buildInClause(`p.${f.location}`, locations));

        const brands = parseMultiSelectFilter(brand);
        if (brands) whereConditions.push(buildInClause(`p.${f.brand}`, brands));

        const categoriesArr = parseMultiSelectFilter(category);
        if (categoriesArr) {
            const escaped = categoriesArr.map(v => `'${escapeStr(v.toLowerCase())}'`).join(',');
            whereConditions.push(`lower(${src.prodCatSql}) IN (${escaped})`);
        }

        const channels = normalizeChannels(parseMultiSelectFilter(filters.channel));
        if (channels) {
            whereConditions.push(buildInClause(`p.${f.channel}`, channels));
        }

        // Filter by the specific dimension value (e.g., "Toothpaste" or "Mumbai")
        if (dimensionValue) {
            whereConditions.push(`lower(${groupByExpr}) = lower('${escapeStr(dimensionValue)}')`);
        }

        const skus = parseMultiSelectFilter(filters.sku);
        if (skus) whereConditions.push(buildInClause(`p.${f.product}`, skus));

        const whereClause = whereConditions.join(' AND ');

        // Brand-level query: Discount, PricePerUnit, RPI, ASP grouped by brand
        const compAvgQuery = `
            SELECT AVG(ifNull(toFloat64OrZero(toString(${f.wSellingPrice})), 0)) as avg_comp_sp
            FROM ${src.table} p
            WHERE ${whereClause} AND p.${src.f.compFlag} = '1'
              AND ifNull(toFloat64OrZero(toString(${f.wSellingPrice})), 0) > 0
        `;

        const brandQuery = `
        WITH ( ${compAvgQuery} ) AS platform_comp_avg
        SELECT
            p.${f.brand} AS brand_name,
            AVG(CASE WHEN ${f.wMrp} > 0
                THEN ((${f.wMrp} - ${f.wSellingPrice}) / ${f.wMrp}) * 100
                ELSE NULL END) AS discount,
            AVG(CASE WHEN ${f.wPpu} > 0
                THEN ${f.wPpu}
                ELSE NULL END) AS price_per_unit,
            AVG(${f.wSellingPrice}) / NULLIF(platform_comp_avg, 0) AS rpi,
            AVG(${f.wSellingPrice}) AS asp,
            SUM(${f.wSales}) AS offtake
        FROM ${src.table} p
        WHERE ${whereClause}
        GROUP BY brand_name, platform_comp_avg
        ORDER BY discount DESC
        LIMIT 20
        SETTINGS max_execution_time = 30
        `;

        // SKU-level query: Discount, PricePerUnit, RPI, ASP grouped by product + brand
        const skuQuery = `
        WITH ( ${compAvgQuery} ) AS platform_comp_avg
        SELECT
            p.${f.product} AS sku_name,
            p.${f.brand} AS brand_name,
            AVG(CASE WHEN ${f.wMrp} > 0
                THEN ((${f.wMrp} - ${f.wSellingPrice}) / ${f.wMrp}) * 100
                ELSE NULL END) AS discount,
            AVG(CASE WHEN ${f.wPpu} > 0
                THEN ${f.wPpu}
                ELSE NULL END) AS price_per_unit,
            AVG(${f.wSellingPrice}) / NULLIF(platform_comp_avg, 0) AS rpi,
            AVG(${f.wSellingPrice}) AS asp,
            SUM(${f.wSales}) AS offtake
        FROM ${src.table} p
        WHERE ${whereClause}
          AND p.${f.product} IS NOT NULL
          AND p.${f.product} != ''
        GROUP BY p.${f.product}, p.${f.brand}, platform_comp_avg
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
            ASP: parseFloat(r.asp) || 0,
        }));

        const skuRows = (skuResults || []).map(r => ({
            sku_name: r.sku_name,
            brand_name: r.brand_name,
            Discount: parseFloat(r.discount) || 0,
            PricePerUnit: parseFloat(r.price_per_unit) || 0,
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
