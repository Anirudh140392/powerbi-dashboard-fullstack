/**
 * Compare SKU Service
 * Dedicated backend service for the Compare SKU feature.
 * All data sourced from rb_pdp_olap (ClickHouse) via existing helpers.
 */
import { queryClickHouse, calculateConversion } from '../config/clickhouse.js';
import { getTableColumns, resolveColumn } from '../utils/schemaHelper.js';
import { normalizeFilterArray } from './marketShareHelper.js';
import dayjs from 'dayjs';

// ─── Helper: escape strings for ClickHouse ─────────────────────────
const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

// ─── Helper: wrap column in safe float cast ────────────────────────
const wrap = (col) => `ifNull(toFloat64OrZero(toString(${col})), 0)`;

// ─── Category SQL (mirrors watchTowerService) ──────────────────────
const PRODUCT_CATEGORY_SQL = `if(Category IS NOT NULL AND Category != '' AND Category != '0', 
    Category, 
    multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', 
            LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m'), 
                if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%', 
                   'Chocolates (Gifting)', 
                   'Chocolates (Non Gifting)'), 
            'Others')
)`;

/**
 * Discover column names for rb_pdp_olap (same pattern as watchTowerService)
 */
async function getSource() {
    const cols = await getTableColumns('rb_pdp_olap');
    const r = (name) => resolveColumn(cols, name);

    return {
        table: 'rb_pdp_olap',
        f: {
            sales: wrap(r('Sales')),
            spend: wrap(r('Ad_Spend')),
            adSales: wrap(r('Ad_sales')),
            clicks: wrap(r('Ad_Clicks')),
            impressions: wrap(r('Ad_Impressions')),
            neno: wrap(r('neno_osa')),
            deno: wrap(r('deno_osa')),
            qty: wrap(r('Qty_Sold')),
            orders: wrap(r('Ad_Quantity_sold')),
            mrpVal: wrap(r('MRP')),
            sellingPrice: wrap(r('Selling_Price')),
            date: r('DATE'),
            platform: r('Platform'),
            brand: r('Brand'),
            location: r('Location'),
            category: PRODUCT_CATEGORY_SQL,
            compFlag: r('Comp_flag'),
            product: r('Product'),
            skuCode: r('Web_Pid'),
        }
    };
}/**
 * Discover column names for rb_ms_olap
 */
async function getMsSource() {
    const cols = await getTableColumns('rb_ms_olap');
    const r = (name) => resolveColumn(cols, name);

    return {
        table: 'rb_ms_olap',
        f: {
            sales: r('sales'),
            date: r('created_on'),
            brand: r('brand'),
            category: r('category'),
            platform: r('Platform')
        }
    };
}

// ═══════════════════════════════════════════════════════════════════
// 1) getCompareSkuDateRange — min/max DATE from rb_pdp_olap
// ═══════════════════════════════════════════════════════════════════
export const getCompareSkuDateRange = async () => {
    try {
        const src = await getSource();
        const result = await queryClickHouse(`
            SELECT 
                MIN(toDate(${src.f.date})) as minDate,
                MAX(toDate(${src.f.date})) as maxDate
            FROM ${src.table}
        `);
        const row = result?.[0] || {};
        return {
            minDate: row.minDate || null,
            maxDate: row.maxDate || null,
        };
    } catch (error) {
        console.error('[compareSkuService.getCompareSkuDateRange] Error:', error);
        return { minDate: null, maxDate: null };
    }
};

// ═══════════════════════════════════════════════════════════════════
// 2) getCompareSkuFilters — distinct Platforms, Brands, Categories
// ═══════════════════════════════════════════════════════════════════
export const getCompareSkuFilters = async () => {
    try {
        const src = await getSource();

        const [platformsResult, brandsResult, categoriesResult, locationsResult] = await Promise.all([
            queryClickHouse(`
                SELECT DISTINCT ${src.f.platform} as name, count() as cnt
                FROM ${src.table}
                WHERE ${src.f.platform} IS NOT NULL AND ${src.f.platform} != ''
                GROUP BY name ORDER BY cnt DESC
            `),
            queryClickHouse(`
                SELECT DISTINCT ${src.f.brand} as name, count() as cnt
                FROM ${src.table}
                WHERE ${src.f.brand} IS NOT NULL AND ${src.f.brand} != ''
                GROUP BY name ORDER BY cnt DESC
            `),
            queryClickHouse(`
                SELECT DISTINCT ${PRODUCT_CATEGORY_SQL} as name, count() as cnt
                FROM ${src.table}
                WHERE ${PRODUCT_CATEGORY_SQL} IS NOT NULL AND ${PRODUCT_CATEGORY_SQL} != '' AND ${PRODUCT_CATEGORY_SQL} != 'Others'
                GROUP BY name ORDER BY cnt DESC
            `),
            queryClickHouse(`
                SELECT DISTINCT ${src.f.location} as name, count() as cnt
                FROM ${src.table}
                WHERE ${src.f.location} IS NOT NULL AND ${src.f.location} != ''
                GROUP BY name ORDER BY cnt DESC
            `)
        ]);

        return {
            platforms: platformsResult.map(r => ({ id: r.name, name: r.name, count: parseInt(r.cnt) || 0 })),
            brands: brandsResult.map(r => ({ id: r.name, name: r.name, count: parseInt(r.cnt) || 0 })),
            categories: categoriesResult.map(r => ({ id: r.name, name: r.name, count: parseInt(r.cnt) || 0 })),
            locations: locationsResult.map(r => ({ id: r.name, name: r.name, count: parseInt(r.cnt) || 0 })),
        };
    } catch (error) {
        console.error('[compareSkuService.getCompareSkuFilters] Error:', error);
        return { platforms: [], brands: [], categories: [] };
    }
};

// ═══════════════════════════════════════════════════════════════════
// 3) getCompareSkuProducts — SKU list with dynamic filters
// ═══════════════════════════════════════════════════════════════════
export const getCompareSkuProducts = async (filters = {}) => {
    try {
        const src = await getSource();
        const { search, page = 1, limit = 60 } = filters;
        const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

        // Build WHERE conditions
        const conditions = [
            `${src.f.product} IS NOT NULL`,
            `${src.f.product} != ''`
        ];

        // Platform filter
        const platArr = normalizeFilterArray(filters.platform);
        if (platArr && platArr.length > 0) {
            conditions.push(`${src.f.platform} IN(${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
        }

        // Brand filter
        const brandArr = normalizeFilterArray(filters.brand);
        if (brandArr && brandArr.length > 0) {
            conditions.push(`${src.f.brand} IN(${brandArr.map(b => `'${escapeStr(b)}'`).join(', ')})`);
        }

        // Category filter
        const catArr = normalizeFilterArray(filters.category);
        if (catArr && catArr.length > 0) {
            conditions.push(`${PRODUCT_CATEGORY_SQL} IN(${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }

        // Location filter
        const locArrProd = normalizeFilterArray(filters.location || filters.locations);
        if (locArrProd && locArrProd.length > 0) {
            conditions.push(`${src.f.location} IN(${locArrProd.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }

        // Text search on Product name
        if (search && search.trim()) {
            conditions.push(`LOWER(toString(${src.f.product})) LIKE '%${escapeStr(search.trim().toLowerCase())}%'`);
        }

        const whereClause = conditions.join(' AND ');

        // Setup having clause for ASP filter
        const havingConditions = [];
        if (filters.minAsp !== undefined && filters.maxAsp !== undefined) {
            const aspExpr = `SUM(${src.f.sales}) / nullIf(SUM(${src.f.qty}), 0)`;
            havingConditions.push(`${aspExpr} >= ${parseFloat(filters.minAsp)}`);
            havingConditions.push(`${aspExpr} <= ${parseFloat(filters.maxAsp)}`);
        }
        const havingClause = havingConditions.length > 0 ? `HAVING ${havingConditions.join(' AND ')}` : '';

        // Get total count for pagination (requires subquery when using HAVING)
        const countResult = await queryClickHouse(`
            SELECT count() as total FROM (
                SELECT ${src.f.product}
                FROM ${src.table}
                WHERE ${whereClause}
                GROUP BY ${src.f.product}
                ${havingClause}
            )
        `);
        const totalCount = parseInt(countResult?.[0]?.total) || 0;

        // Get products with aggregated info
        const productsResult = await queryClickHouse(`
            SELECT 
                ${src.f.product} as name,
                any(${src.f.platform}) as platform,
                any(${src.f.brand}) as brand,
                any(${PRODUCT_CATEGORY_SQL}) as category,
                count() as rowCount,
                SUM(${src.f.sales}) / nullIf(SUM(${src.f.qty}), 0) as asp
            FROM ${src.table}
            WHERE ${whereClause}
            GROUP BY name
            ${havingClause}
            ORDER BY rowCount DESC
            LIMIT ${parseInt(limit)} OFFSET ${offset}
        `);

        return {
            products: productsResult.map((r, idx) => ({
                id: `${r.name}_${idx}`,
                name: r.name,
                platform: r.platform || '',
                brand: r.brand || '',
                category: r.category || '',
                size: '',  // Size not stored as separate column
            })),
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
        };
    } catch (error) {
        console.error('[compareSkuService.getCompareSkuProducts] Error:', error);
        return { products: [], total: 0, page: 1, limit: 60 };
    }
};

// ═══════════════════════════════════════════════════════════════════
// 4) getCompareSkuMetrics — KPI values for selected SKU names
// ═══════════════════════════════════════════════════════════════════
export const getCompareSkuMetrics = async (filters = {}) => {
    try {
        const src = await getSource();
        const { skuNames, startDate: qStartDate, endDate: qEndDate } = filters;

        if (!skuNames || skuNames.length === 0) {
            return { skus: [] };
        }

        const skuArr = normalizeFilterArray(skuNames);
        if (!skuArr || skuArr.length === 0) return { skus: [] };

        // Determine date range (default to last 1 month if not provided)
        let endDate;
        if (qEndDate) {
            endDate = dayjs(qEndDate).endOf('day');
        } else {
            const maxResult = await queryClickHouse(`SELECT MAX(toDate(${src.f.date})) as maxDate FROM ${src.table}`);
            endDate = maxResult?.[0]?.maxDate ? dayjs(maxResult[0].maxDate).endOf('day') : dayjs().endOf('day');
        }

        let startDate;
        if (qStartDate) {
            startDate = dayjs(qStartDate).startOf('day');
        } else {
            startDate = endDate.subtract(1, 'month').startOf('day');
        }

        // Previous period (same duration)
        const diff = endDate.diff(startDate, 'day') + 1;
        const prevEndDate = startDate.subtract(1, 'day').endOf('day');
        const prevStartDate = prevEndDate.subtract(diff - 1, 'day').startOf('day');

        // Platform/Brand/Category/Location filters
        const platArr = normalizeFilterArray(filters.platforms);
        const brandArr = normalizeFilterArray(filters.brands);
        const catArr = normalizeFilterArray(filters.categories);
        const locArrMet = normalizeFilterArray(filters.locations);

        // Per-SKU platform filtering
        const skuPlatformArr = normalizeFilterArray(filters.skuPlatforms);
        const hasPerSkuPlatform = skuPlatformArr && skuPlatformArr.length === skuArr.length && skuPlatformArr.some(p => p && p.trim());

        const buildConditions = (sDate, eDate) => {
            const conds = [
                `toDate(${src.f.date}) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`,
            ];

            // Use per-SKU platform filtering if available
            if (hasPerSkuPlatform) {
                const skuConds = skuArr.map((skuName, idx) => {
                    const platform = skuPlatformArr[idx];
                    if (platform && platform.trim()) {
                        return `(${src.f.product} = '${escapeStr(skuName)}' AND trimBoth(${src.f.platform}) = '${escapeStr(platform.trim())}')`;
                    }
                    return `${src.f.product} = '${escapeStr(skuName)}'`;
                });
                conds.push(`(${skuConds.join(' OR ')})`);
            } else {
                conds.push(`${src.f.product} IN(${skuArr.map(s => `'${escapeStr(s)}'`).join(', ')})`);
            }

            if (platArr && platArr.length > 0) {
                conds.push(`${src.f.platform} IN(${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
            }
            if (brandArr && brandArr.length > 0) {
                conds.push(`${src.f.brand} IN(${brandArr.map(b => `'${escapeStr(b)}'`).join(', ')})`);
            }
            if (catArr && catArr.length > 0) {
                conds.push(`${PRODUCT_CATEGORY_SQL} IN(${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
            }
            if (locArrMet && locArrMet.length > 0) {
                conds.push(`${src.f.location} IN(${locArrMet.map(l => `'${escapeStr(l)}'`).join(', ')})`);
            }

            return conds.join(' AND ');
        };

        const currConds = buildConditions(startDate, endDate);
        const prevConds = buildConditions(prevStartDate, prevEndDate);

        // Conditions for Market Share against rb_ms_olap
        const buildMsConds = (sDate, eDate) => {
            const conds = [
                `toDate(created_on) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`,
                `sales IS NOT NULL`
            ];
            if (platArr && platArr.length > 0) conds.push(`platform IN(${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
            if (catArr && catArr.length > 0) conds.push(`category IN(${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
            // Note: market size spans ALL brands matching these filters, not just the SKU brands
            return conds.join(' AND ');
        };

        // Query metrics for current and previous period, grouped by Product
        const [currMetrics, prevMetrics, currCatSize, prevCatSize, currMarketSize, prevMarketSize, currPmMetrics, prevPmMetrics] = await Promise.all([
            queryClickHouse(`
                SELECT 
                    ${src.f.product} as Product,
                    any(${src.f.brand}) as Brand,
                    MAX(toFloat64OrZero(toString(${src.f.compFlag}))) as comp_flag,
                    SUM(${src.f.sales}) as total_sales,
                    SUM(${src.f.qty}) as total_qty,
                    SUM(${src.f.spend}) as total_spend,
                    SUM(${src.f.adSales}) as total_ad_sales,
                    SUM(${src.f.clicks}) as total_clicks,
                    SUM(${src.f.impressions}) as total_impressions,
                    SUM(${src.f.orders}) as total_orders,
                    SUM(${src.f.neno}) as total_neno,
                    SUM(${src.f.deno}) as total_deno,
                    SUM(${src.f.mrpVal} * ${src.f.qty}) as total_mrp_val,
                    SUM(${src.f.sellingPrice} * ${src.f.qty}) as total_sp_val
                FROM ${src.table}
                WHERE ${currConds}
                GROUP BY Product
            `),
            queryClickHouse(`
                SELECT 
                    ${src.f.product} as Product,
                    SUM(${src.f.sales}) as total_sales,
                    SUM(${src.f.qty}) as total_qty,
                    SUM(${src.f.spend}) as total_spend,
                    SUM(${src.f.adSales}) as total_ad_sales,
                    SUM(${src.f.clicks}) as total_clicks,
                    SUM(${src.f.impressions}) as total_impressions,
                    SUM(${src.f.orders}) as total_orders,
                    SUM(${src.f.neno}) as total_neno,
                    SUM(${src.f.deno}) as total_deno,
                    SUM(${src.f.mrpVal} * ${src.f.qty}) as total_mrp_val,
                    SUM(${src.f.sellingPrice} * ${src.f.qty}) as total_sp_val
                FROM ${src.table}
                WHERE ${prevConds}
                GROUP BY Product
            `),
            // Total category sales for Est. Cat Share (from ms olap for accuracy)
            queryClickHouse(`
                SELECT SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as cat_size
                FROM rb_ms_olap
                WHERE ${buildMsConds(startDate, endDate)}
            `),
            queryClickHouse(`
                SELECT SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as cat_size
                FROM rb_ms_olap
                WHERE ${buildMsConds(prevStartDate, prevEndDate)}
            `),
            // Market Size for Market Share (total market sales across filters)
            queryClickHouse(`
                SELECT SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as market_size
                FROM rb_ms_olap
                WHERE ${buildMsConds(startDate, endDate)}
            `),
            queryClickHouse(`
                SELECT SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as market_size
                FROM rb_ms_olap
                WHERE ${buildMsConds(prevStartDate, prevEndDate)}
            `)
        ]);

        const prevMap = new Map(prevMetrics.map(d => [d.Product, d]));

        const currCategorySize = parseFloat(currCatSize?.[0]?.cat_size || 0);
        const prevCategorySize = parseFloat(prevCatSize?.[0]?.cat_size || 0);
        const currMktSize = parseFloat(currMarketSize?.[0]?.market_size || 0);
        const prevMktSize = parseFloat(prevMarketSize?.[0]?.market_size || 0);

        // ─── SOS Calculation from rb_kw_olap ───────────────────────────
        // Extract unique brands from currMetrics to query SOS
        const brandSet = new Set();
        const skuBrandMap = new Map(); // SKU -> Brand
        currMetrics.forEach(d => {
            const brand = d.Brand || '';
            if (brand) {
                brandSet.add(brand);
                skuBrandMap.set(d.Product, brand);
            }
        });

        let currSosMap = new Map(); // brand -> { overall, ad, organic }
        let prevSosMap = new Map();

        if (brandSet.size > 0) {
            const brandList = Array.from(brandSet).map(b => `'${escapeStr(b)}'`).join(', ');

            // Build platform condition for SOS (use per-SKU platforms if available)
            let sosPlatformCond = '';
            if (skuPlatformArr && skuPlatformArr.length > 0) {
                const uniquePlatforms = [...new Set(skuPlatformArr.filter(p => p && p.trim()))];
                if (uniquePlatforms.length > 0) {
                    sosPlatformCond = `AND platform_name IN (${uniquePlatforms.map(p => `'${escapeStr(p.trim())}'`).join(', ')})`;
                }
            } else if (platArr && platArr.length > 0) {
                sosPlatformCond = `AND platform_name IN (${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`;
            }

            try {
                const [currSosRows, prevSosRows] = await Promise.all([
                    queryClickHouse(`
                        SELECT 
                            keyword as brand_keyword,
                            ROUND(sumIf(toInt32(overall), flag = 1) * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                            ROUND(sumIf(toInt32(spons), flag = 1) * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS ad_sos,
                            ROUND(sumIf(toInt32(organic), flag = 1) * 100.0 / nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos
                        FROM rb_kw_olap
                        WHERE DATE BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'
                          AND LOWER(keyword) IN (${Array.from(brandSet).map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ')})
                          ${sosPlatformCond}
                        GROUP BY keyword
                    `),
                    queryClickHouse(`
                        SELECT 
                            keyword as brand_keyword,
                            ROUND(sumIf(toInt32(overall), flag = 1) * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                            ROUND(sumIf(toInt32(spons), flag = 1) * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS ad_sos,
                            ROUND(sumIf(toInt32(organic), flag = 1) * 100.0 / nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos
                        FROM rb_kw_olap
                        WHERE DATE BETWEEN '${prevStartDate.format('YYYY-MM-DD')}' AND '${prevEndDate.format('YYYY-MM-DD')}'
                          AND LOWER(keyword) IN (${Array.from(brandSet).map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ')})
                          ${sosPlatformCond}
                        GROUP BY keyword
                    `)
                ]);

                currSosRows.forEach(r => {
                    currSosMap.set(String(r.brand_keyword).toLowerCase(), {
                        overall: parseFloat(r.overall_sos) || 0,
                        ad: parseFloat(r.ad_sos) || 0,
                        organic: parseFloat(r.organic_sos) || 0
                    });
                });
                prevSosRows.forEach(r => {
                    prevSosMap.set(String(r.brand_keyword).toLowerCase(), {
                        overall: parseFloat(r.overall_sos) || 0,
                        ad: parseFloat(r.ad_sos) || 0,
                        organic: parseFloat(r.organic_sos) || 0
                    });
                });

                console.log(`[compareSkuService] SOS data fetched for ${currSosMap.size} brands (curr), ${prevSosMap.size} brands (prev)`);
            } catch (sosErr) {
                console.error('[compareSkuService] SOS calculation error:', sosErr);
                // Fall through with empty maps — SOS will show 0.0
            }
        }

        // Build per-SKU metrics
        const skus = currMetrics.map(data => {
            const skuName = data.Product || 'Unknown';
            const prevData = prevMap.get(skuName) || {};

            const isComp = data.comp_flag === 1;

            // Current
            const offtake = parseFloat(data.total_sales || 0);
            const qty = parseFloat(data.total_qty || 0);
            const spend = parseFloat(data.total_spend || 0);
            const adSales = parseFloat(data.total_ad_sales || 0);
            const clicks = parseFloat(data.total_clicks || 0);
            const impressions = parseFloat(data.total_impressions || 0);
            
            // Conversion uses PDP OLAP orders/clicks (like SKU page)
            const pdpOrders = parseFloat(data.total_orders || 0);
            const pdpClicks = parseFloat(data.total_clicks || 0);
            
            const neno = parseFloat(data.total_neno || 0);
            const deno = parseFloat(data.total_deno || 0);
            const mrpVal = parseFloat(data.total_mrp_val || 0);
            const spVal = parseFloat(data.total_sp_val || 0);

            const availability = deno > 0 ? (neno / deno) * 100 : 0;
            const estCatShare = currCategorySize > 0 ? (offtake / currCategorySize) * 100 : 0;
            const marketShare = currMktSize > 0 ? (offtake / currMktSize) * 100 : 0;
            const wtDiscount = mrpVal > 0 ? ((mrpVal - spVal) / mrpVal) * 100 : 0;
            const wtPpu = qty > 0 ? (offtake / qty) * 100 : 0;
            const conversion = pdpClicks > 0 ? (pdpOrders / pdpClicks) * 100 : 0;
            const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
            const cpc = clicks > 0 ? spend / clicks : 0;
            const roas = spend > 0 ? adSales / spend : 0;

            // Previous
            const prevOfftake = parseFloat(prevData.total_sales || 0);
            const prevQty = parseFloat(prevData.total_qty || 0);
            const prevNeno = parseFloat(prevData.total_neno || 0);
            const prevDeno = parseFloat(prevData.total_deno || 0);
            const prevMrpVal = parseFloat(prevData.total_mrp_val || 0);
            const prevSpVal = parseFloat(prevData.total_sp_val || 0);
            const prevSpend = parseFloat(prevData.total_spend || 0);
            const prevClicks = parseFloat(prevData.total_clicks || 0);
            const prevImpressions = parseFloat(prevData.total_impressions || 0);
            const prevAdSales = parseFloat(prevData.total_ad_sales || 0);
            const prevPdpOrders = parseFloat(prevData.total_orders || 0);
            const prevPdpClicks = parseFloat(prevData.total_clicks || 0);

            const prevAvailability = prevDeno > 0 ? (prevNeno / prevDeno) * 100 : 0;
            const prevEstCatShare = prevCategorySize > 0 ? (prevOfftake / prevCategorySize) * 100 : 0;
            const prevMarketShare = prevMktSize > 0 ? (prevOfftake / prevMktSize) * 100 : 0;
            const prevWtDiscount = prevMrpVal > 0 ? ((prevMrpVal - prevSpVal) / prevMrpVal) * 100 : 0;
            const prevWtPpu = prevQty > 0 ? (prevOfftake / prevQty) * 100 : 0;
            const prevConversion = prevPdpClicks > 0 ? (prevPdpOrders / prevPdpClicks) * 100 : 0;
            const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
            const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;
            const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;

            const calcDelta = (curr, prev) => prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : (curr > 0 ? 100 : 0);
            const fmtValue = (val, type) => {
                if (type === 'currency') {
                    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} cr`;
                    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} lac`;
                    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
                    return `₹${val.toFixed(0)}`;
                }
                if (type === 'percent') return val.toFixed(1);
                if (type === 'ratio') return val.toFixed(2);
                return val.toFixed(1);
            };
            const fmtDeltaAbs = (curr, prev, type) => {
                const diff = curr - prev;
                if (type === 'currency') {
                    const abs = Math.abs(diff);
                    if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(2)} cr`;
                    if (abs >= 100000) return `₹${(abs / 100000).toFixed(1)} lac`;
                    if (abs >= 1000) return `₹${(abs / 1000).toFixed(1)}k`;
                    return `₹${abs.toFixed(0)}`;
                }
                return Math.abs(diff).toFixed(1);
            };

            const getMetricObj = (val, prevVal, type, hideIfComp = false) => {
                if (hideIfComp && isComp) {
                    return { value: 'N/A', delta: null, deltaAbs: 'N/A' };
                }
                return {
                    value: fmtValue(val, type),
                    delta: parseFloat(calcDelta(val, prevVal).toFixed(1)),
                    deltaAbs: fmtDeltaAbs(val, prevVal, type)
                };
            };

            return {
                name: skuName,
                platform: '',  // Will be filled by frontend from the product info
                metrics: {
                    offtake: getMetricObj(offtake, prevOfftake, 'currency', true),
                    est_cat_share: getMetricObj(estCatShare, prevEstCatShare, 'ratio', false),
                    ds_listing: getMetricObj(availability, prevAvailability, 'percent', false),
                    overall_sov: (() => {
                        const brand = skuBrandMap.get(skuName) || '';
                        const currSos = currSosMap.get(brand.toLowerCase()) || { overall: 0 };
                        const prevSos = prevSosMap.get(brand.toLowerCase()) || { overall: 0 };
                        return getMetricObj(currSos.overall, prevSos.overall, 'percent', false);
                    })(),
                    ad_sov: (() => {
                        const brand = skuBrandMap.get(skuName) || '';
                        const currSos = currSosMap.get(brand.toLowerCase()) || { ad: 0 };
                        const prevSos = prevSosMap.get(brand.toLowerCase()) || { ad: 0 };
                        return getMetricObj(currSos.ad, prevSos.ad, 'percent', false);
                    })(),
                    organic_sos: (() => {
                        const brand = skuBrandMap.get(skuName) || '';
                        const currSos = currSosMap.get(brand.toLowerCase()) || { organic: 0 };
                        const prevSos = prevSosMap.get(brand.toLowerCase()) || { organic: 0 };
                        return getMetricObj(currSos.organic, prevSos.organic, 'percent', false);
                    })(),
                    wt_discount: getMetricObj(wtDiscount, prevWtDiscount, 'percent', false),
                    wt_ppu: getMetricObj(wtPpu, prevWtPpu, 'percent', false),
                    spend: getMetricObj(spend, prevSpend, 'currency', true),
                    conversion: getMetricObj(conversion, prevConversion, 'percent', true),
                    inorg_sales: getMetricObj(adSales, prevAdSales, 'currency', true),
                    availability: getMetricObj(availability, prevAvailability, 'percent', false),
                    market_share: getMetricObj(marketShare, prevMarketShare, 'percent', false),
                    cpm: getMetricObj(cpm, prevCpm, 'percent', true),
                    cpc: getMetricObj(cpc, prevCpc, 'percent', true),
                }
            };
        });

        // Also include SKUs that were requested but had no data (return empty metrics)
        const foundNames = new Set(currMetrics.map(d => d.Product));
        for (const sku of skuArr) {
            if (!foundNames.has(sku)) {
                skus.push({
                    name: sku,
                    platform: '',
                    metrics: {} // empty → frontend shows "--"
                });
            }
        }

        console.log(`[compareSkuService.getCompareSkuMetrics] Returning metrics for ${skus.length} SKUs`);
        return { skus };
    } catch (error) {
        console.error('[compareSkuService.getCompareSkuMetrics] Error:', error);
        return { skus: [] };
    }
};

// ═══════════════════════════════════════════════════════════════════
// 5) getCompareSkuTrend — Trend data by brand for selected KPI
// ═══════════════════════════════════════════════════════════════════
export const getCompareSkuTrend = async (filters = {}) => {
    try {
        const src = await getSource();
        // filters
        const { startDate, endDate, metricId = 'offtake', skuNames = [] } = filters;
        const platforms = normalizeFilterArray(filters.platforms);
        const categories = normalizeFilterArray(filters.categories);
        const brands = normalizeFilterArray(filters.brands);
        const locations = normalizeFilterArray(filters.locations);

        let dStart = startDate ? dayjs(startDate).format('YYYY-MM-DD') : dayjs().subtract(1, 'month').format('YYYY-MM-DD');
        let dEnd = endDate ? dayjs(endDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

        const skuArr = normalizeFilterArray(skuNames);
        if (!skuArr || skuArr.length === 0) {
            return {
                trendData: [],
                skus: [],
                summary: { avgDsListing: '0', weightedDiscount: '0', catShare: '0' }
            };
        }

        // Per-SKU platform filtering
        const skuPlatformArr = normalizeFilterArray(filters.skuPlatforms);
        const hasPerSkuPlatform = skuPlatformArr && skuPlatformArr.length === skuArr.length && skuPlatformArr.some(p => p && p.trim());

        // Apply filters
        const conditions = [
            `toDate(${src.f.date}) >= '${dStart}'`,
            `toDate(${src.f.date}) <= '${dEnd}'`,
        ];

        // Use per-SKU platform filtering if available
        if (hasPerSkuPlatform) {
            const skuConds = skuArr.map((skuName, idx) => {
                const platform = skuPlatformArr[idx];
                if (platform && platform.trim()) {
                    return `(${src.f.product} = '${escapeStr(skuName)}' AND trimBoth(${src.f.platform}) = '${escapeStr(platform.trim())}')`;
                }
                return `${src.f.product} = '${escapeStr(skuName)}'`;
            });
            conditions.push(`(${skuConds.join(' OR ')})`);
        } else {
            conditions.push(`${src.f.product} IN (${skuArr.map(s => `'${escapeStr(s)}'`).join(', ')})`);
        }

        // Also add global filters if present, to refine the selected SKUs
        if (platforms?.length) conditions.push(`trimBoth(${src.f.platform}) IN (${platforms.map(p => `'${escapeStr(p)}'`).join(', ')})`);
        if (categories?.length) conditions.push(`trimBoth(${src.f.category}) IN (${categories.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        if (brands?.length) conditions.push(`trimBoth(${src.f.brand}) IN (${brands.map(b => `'${escapeStr(b)}'`).join(', ')})`);
        if (locations?.length) conditions.push(`trimBoth(${src.f.location}) IN (${locations.map(l => `'${escapeStr(l)}'`).join(', ')})`);

        // SQL select generation based on metricId
        let selectExp = `SUM(ifNull(toFloat64OrZero(toString(${src.f.sales})), 0))`; 
        let isPercentage = false;
        
        switch(metricId) {
            case 'offtakes':
            case 'offtake':
                selectExp = `SUM(ifNull(toFloat64OrZero(toString(${src.f.sales})), 0))`;
                break;
            case 'spend':
                selectExp = `SUM(ifNull(toFloat64OrZero(toString(${src.f.spend})), 0))`;
                break;
            case 'inorgSales':
            case 'inorg_sales':
                selectExp = `SUM(ifNull(toFloat64OrZero(toString(${src.f.adSales})), 0))`;
                break;
            case 'cpm':
                selectExp = `SUM(ifNull(toFloat64OrZero(toString(${src.f.spend})), 0)) / nullIf(SUM(ifNull(toFloat64OrZero(toString(${src.f.impressions})), 0)), 0) * 1000`;
                break;
            case 'cpc':
                selectExp = `SUM(ifNull(toFloat64OrZero(toString(${src.f.spend})), 0)) / nullIf(SUM(ifNull(toFloat64OrZero(toString(${src.f.clicks})), 0)), 0)`;
                break;
            case 'availability':
            case 'ds_listing':
                selectExp = `SUM(ifNull(toFloat64OrZero(toString(${src.f.neno})), 0)) / nullIf(SUM(ifNull(toFloat64OrZero(toString(${src.f.deno})), 0)), 0) * 100`;
                isPercentage = true;
                break;
            case 'conversion':
                selectExp = `SUM(ifNull(toFloat64OrZero(toString(${src.f.orders})), 0)) / nullIf(SUM(ifNull(toFloat64OrZero(toString(${src.f.clicks})), 0)), 0) * 100`;
                isPercentage = true;
                break;
            case 'discounting':
            case 'wt_discount':
                selectExp = `(SUM(ifNull(toFloat64OrZero(toString(${src.f.mrpVal})), 0)) - SUM(ifNull(toFloat64OrZero(toString(${src.f.sellingPrice})), 0))) / nullIf(SUM(ifNull(toFloat64OrZero(toString(${src.f.mrpVal})), 0)), 0) * 100`;
                isPercentage = true;
                break;
            case 'ppu':
            case 'wt_ppu':
                selectExp = `SUM(ifNull(toFloat64OrZero(toString(${src.f.sales})), 0)) / nullIf(SUM(ifNull(toFloat64OrZero(toString(${src.f.qty})), 0)), 0) * 100`;
                break;
        }

        const sql = `
            SELECT 
                toDate(${src.f.date}) AS DateVal,
                trimBoth(${src.f.product}) AS ProductName,
                MAX(toFloat64OrZero(toString(${src.f.compFlag}))) AS CompFlag,
                ${selectExp} AS MetricValue
            FROM ${src.table}
            WHERE ${conditions.join(' AND ')}
            GROUP BY DateVal, ProductName
            ORDER BY DateVal ASC
        `;

        const rawData = await queryClickHouse(sql);

        const dateMap = new Map();
        const skuSet = new Set();
        
        const proprietaryMetrics = ['offtakes', 'offtake', 'spend', 'inorgSales', 'inorg_sales', 'cpm', 'cpc', 'conversion'];
        const isProprietary = proprietaryMetrics.includes(metricId);

        rawData.forEach(row => {
            const dateStr = dayjs(row.DateVal).format("DD MMM 'YY");
            const productName = row.ProductName || 'Unknown';
            const isComp = row.CompFlag === 1;
            const value = parseFloat(row.MetricValue) || 0;
            
            skuSet.add(productName);
            
            if (!dateMap.has(dateStr)) {
                dateMap.set(dateStr, { date: dateStr, ts: dayjs(row.DateVal).valueOf() });
            }
            
            if (isProprietary && isComp) {
                // Do not set a value so Recharts ignores it instead of plotting 0
                dateMap.get(dateStr)[productName] = null;
            } else {
                dateMap.get(dateStr)[productName] = isPercentage ? parseFloat(value.toFixed(2)) : parseFloat(value.toFixed(1));
            }
        });

        const trendData = Array.from(dateMap.values()).sort((a, b) => a.ts - b.ts).map(item => {
            const { ts, ...rest } = item;
            return rest;
        });

        // Summary Aggregates
        const summarySql = `
            SELECT 
                SUM(ifNull(toFloat64OrZero(toString(${src.f.neno})), 0)) AS totalOsaNum,
                SUM(ifNull(toFloat64OrZero(toString(${src.f.deno})), 0)) AS totalOsaDen,
                SUM(ifNull(toFloat64OrZero(toString(${src.f.mrpVal})), 0)) AS totalMrp,
                SUM(ifNull(toFloat64OrZero(toString(${src.f.sellingPrice})), 0)) AS totalSp,
                SUM(ifNull(toFloat64OrZero(toString(${src.f.sales})), 0)) AS totalBrandSales
            FROM ${src.table}
            WHERE ${conditions.join(' AND ')}
        `;
        const [summaryRow] = await queryClickHouse(summarySql) || [{}];
        
        const avgDsListing = summaryRow.totalOsaDen > 0 
            ? ((parseFloat(summaryRow.totalOsaNum) / parseFloat(summaryRow.totalOsaDen)) * 100).toFixed(1)
            : '0.0';
            
        const weightedDiscount = summaryRow.totalMrp > 0
            ? (((parseFloat(summaryRow.totalMrp) - parseFloat(summaryRow.totalSp)) / parseFloat(summaryRow.totalMrp)) * 100).toFixed(1)
            : '0.0';

        // Calculate Market Size for Cat Share
        let catShare = '0.0';
        try {
            const msSrc = await getMsSource();
            let msConds = [
                `toDate(${msSrc.f.date}) >= '${dStart}'`,
                `toDate(${msSrc.f.date}) <= '${dEnd}'`
            ];
            if (categories?.length) msConds.push(`trimBoth(${msSrc.f.category}) IN (${categories.map(c => `'${escapeStr(c)}'`).join(', ')})`);
            
            const msSql = `SELECT SUM(ifNull(toFloat64OrZero(toString(${msSrc.f.sales})), 0)) as marketSize FROM ${msSrc.table} WHERE ${msConds.join(' AND ')}`;
            const [msRow] = await queryClickHouse(msSql) || [{}];
            const marketSize = parseFloat(msRow.marketSize) || 0;
            
            if (marketSize > 0) {
                catShare = ((parseFloat(summaryRow.totalBrandSales || 0) / marketSize) * 100).toFixed(1);
            }
        } catch (catErr) {
            console.error('[getCompareSkuTrend] Cat Share error:', catErr);
        }

        return { 
            trendData, 
            skus: Array.from(skuSet).slice(0, 15), // Limit to top 15 to prevent UI crowding
            summary: {
                avgDsListing,
                weightedDiscount,
                catShare
            } 
        };

    } catch (error) {
        console.error('[compareSkuService.getCompareSkuTrend] Error:', error);
        return { trendData: [], brands: [], summary: {} };
    }
};

export default {
    getCompareSkuDateRange,
    getCompareSkuFilters,
    getCompareSkuProducts,
    getCompareSkuMetrics,
    getCompareSkuTrend,
};
