import { Op, Sequelize } from 'sequelize';
import sequelize from '../config/db.js';
import { queryClickHouse, getCurrentDbName, calculateConversion } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import { getTableColumns, resolveColumn, columnExists } from '../utils/schemaHelper.js';
import { normalizeFilterArray } from './marketShareHelper.js';

// Helper to escape strings for ClickHouse
const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

// Dynamic category: reads from DB Category column, falls back to 'Others' if empty
const PRODUCT_CATEGORY_SQL = `if(Category IS NOT NULL AND Category != '' AND Category != '0', Category, 'Others')`;

let aggTableExists = null;
const AGG_TABLE_NAME = 'watchtower_agg_daily';

async function getAggTableStatus() {
    if (aggTableExists !== null) return aggTableExists;
    try {
        const result = await queryClickHouse(`EXISTS TABLE ${AGG_TABLE_NAME}`);
        aggTableExists = result && result[0] && result[0].result === 1;
        if (aggTableExists) console.log(`🚀 [EcomRca] Using aggregated table: ${AGG_TABLE_NAME}`);
        return aggTableExists;
    } catch (err) {
        aggTableExists = false;
        return false;
    }
}

async function getWatchtowerSource() {
    const useAgg = await getAggTableStatus();
    if (useAgg) {
        const aggCols = await getTableColumns(AGG_TABLE_NAME);
        const r = (name) => resolveColumn(aggCols, name);
        return {
            table: AGG_TABLE_NAME,
            isAgg: true,
            f: {
                sales: r('total_sales'),
                spend: r('total_spend'),
                adSales: r('total_Ad_sales'),
                clicks: r('total_clicks'),
                impressions: r('total_impressions'),
                organicImpressions: r('total_organic_impressions'),
                neno: r('total_neno_osa'),
                deno: r('total_deno_osa'),
                qty: r('total_qty'),
                orders: r('total_orders'),
                mrpVal: r('mrp_val'),
                actualSales: r('actual_sales'),
                date: r('date'),
                platform: r('platform'),
                brand: r('brand'),
                location: r('location'),
                category: PRODUCT_CATEGORY_SQL,
                compFlag: r('comp_flag'),
                compFlagMapping: r('comp_flag'),
                mrp: r('mrp'),
                sellingPrice: r('selling_price'),
                product: r('product'),
                skuCode: r('sku_code'),
                quantitySold: r('total_qty'),
                overallGv: `(${r('total_impressions')} + ${r('total_organic_impressions')})`,
                discount: `if(${r('mrp')} > 0, (${r('mrp')} - ${r('selling_price')}) / ${r('mrp')} * 100, 0)`,
                listingPercent: r('avg_listing_percent')
            }
        };
    }

    const cols = await getTableColumns('rb_pdp_olap');
    const r = (name) => resolveColumn(cols, name);
    const wrap = (col) => `ifNull(toFloat64OrZero(toString(${col})), 0)`;

    const salesCol = r('Sales');
    const adSpendCol = r('Ad_Spend');
    const adSalesCol = r('Ad_sales');
    const adClicksCol = r('Ad_Clicks');
    const adImpressionsCol = r('Ad_Impressions');
    const nenoOsaCol = r('neno_osa');
    const denoOsaCol = r('deno_osa');
    const qtySoldCol = r('Qty_Sold');
    const adQtySoldCol = r('Ad_Quantity_sold');
    const mrpCol = r('MRP');
    const sellingPriceCol = r('Selling_Price');
    const listingPercentCol = r('listing_percent');

    const hasDeliveryDate = columnExists(cols, 'delivery_date');
    const deliveryDateCol = hasDeliveryDate ? r('delivery_date') : null;
    const overallGvCol = r('overall_gv');

    return {
        table: 'rb_pdp_olap',
        isAgg: false,
        hasDeliveryDate,
        deliveryDateCol,
        overallGvCol,
        f: {
            sales: wrap(salesCol),
            spend: wrap(adSpendCol),
            adSales: wrap(adSalesCol),
            clicks: wrap(adClicksCol),
            impressions: wrap(adImpressionsCol),
            organicImpressions: wrap(r('Organic_Impressions')),
            neno: wrap(nenoOsaCol),
            deno: wrap(denoOsaCol),
            qty: wrap(qtySoldCol),
            orders: wrap(adQtySoldCol),
            mrpVal: wrap(mrpCol),
            actualSales: wrap(salesCol),
            date: r('DATE'),
            platform: r('Platform'),
            brand: r('Brand'),
            location: r('Location'),
            category: PRODUCT_CATEGORY_SQL,
            compFlag: r('Comp_flag'),
            compFlagMapping: r('Comp_flag'),
            mrp: wrap(mrpCol),
            sellingPrice: wrap(sellingPriceCol),
            product: r('Product'),
            skuCode: r('Web_Pid'),
            quantitySold: qtySoldCol,
            overallGv: wrap(overallGvCol),
            discount: `if(${wrap(mrpCol)} > 0, (${wrap(mrpCol)} - ${wrap(sellingPriceCol)}) / ${wrap(mrpCol)} * 100, 0)`,
            listingPercent: `if(toFloat64OrZero(toString(${listingPercentCol})) > 0, toFloat64OrZero(toString(${listingPercentCol})), (${wrap(nenoOsaCol)} / NULLIF(${wrap(denoOsaCol)}, 0)) * 100)`
        }
    };
}

let cachedMaxDate = null;
let lastMaxDateFetch = 0;

async function getCachedMaxDate() {
    const now = Date.now();
    if (cachedMaxDate && (now - lastMaxDateFetch < 3600000)) {
        return cachedMaxDate;
    }
    try {
        const query = `SELECT MAX(toDate(DATE)) as maxDate FROM rb_pdp_olap`;
        const result = await queryClickHouse(query);
        if (result && result.length > 0 && result[0].maxDate) {
            cachedMaxDate = dayjs(result[0].maxDate);
            lastMaxDateFetch = now;
            return cachedMaxDate;
        }
    } catch (err) {
        console.error('Error fetching max date for E-com RCA:', err);
    }
    return dayjs().subtract(1, 'day');
}

export const getEcomRcaData = async (filters = {}) => {
    try {
        const { platform = 'All', category = 'All', brand = 'All', sku = 'All', month, drilldownLevel, drilldownId, kpiCategory, activeTab } = filters;
        
        // Calculate date ranges
        let startDate, endDate;
        if (month) {
            startDate = dayjs(month).startOf('month');
            endDate = dayjs(month).endOf('month');
        } else if (filters.startDate && filters.endDate) {
            startDate = dayjs(filters.startDate);
            endDate = dayjs(filters.endDate);
        } else {
            endDate = await getCachedMaxDate();
            startDate = endDate.clone().startOf('month');
        }

        const startStr = startDate.format('YYYY-MM-DD');
        const endStr = endDate.format('YYYY-MM-DD');

        // Previous period
        let prevStartDate, prevEndDate;
        if (filters.compareStartDate && filters.compareEndDate) {
            prevStartDate = dayjs(filters.compareStartDate);
            prevEndDate = dayjs(filters.compareEndDate);
        } else {
            const diff = endDate.diff(startDate, 'day') + 1;
            prevEndDate = startDate.subtract(1, 'day');
            prevStartDate = prevEndDate.subtract(diff - 1, 'day');
        }
        const prevStartStr = prevStartDate.format('YYYY-MM-DD');
        const prevEndStr = prevEndDate.format('YYYY-MM-DD');

        console.log(`[getEcomRcaData] Dates: ${startStr} to ${endStr} vs ${prevStartStr} to ${prevEndStr}`);

        const src = await getWatchtowerSource();

        // -------------------------
        // BUILD CONDITIONS
        // -------------------------
        const buildOlapConds = (sDate, eDate) => {
            const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
            const conds = [`${dateCol} BETWEEN '${sDate}' AND '${eDate}'`];
            const platArr = normalizeFilterArray(platform);
            if (platArr && platArr.length > 0) {
                conds.push(`${src.f.platform} IN(${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
            }
            const catArr = normalizeFilterArray(category);
            if (catArr && catArr.length > 0) {
                conds.push(`${src.f.category} IN (${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
            }
            if (brand && brand !== 'All' && brand !== 'All Brands') {
                conds.push(`${src.f.brand} LIKE '%${escapeStr(brand)}%'`);
            }
            if (sku && sku !== 'All' && sku !== 'All SKUs') {
                conds.push(`${src.f.skuCode} = '${escapeStr(sku)}'`);
            }
            return conds.join(' AND ');
        };

        const buildKwConds = (sDate, eDate) => {
            const conds = [`toDate(DATE) BETWEEN '${sDate}' AND '${eDate}'`];
            const platArr = normalizeFilterArray(platform);
            if (platArr && platArr.length > 0) {
                conds.push(`platform_name IN(${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
            }
            if (category && category !== 'All') {
                conds.push(`keyword_category = '${escapeStr(category)}'`);
            }
            return conds.join(' AND ');
        };

        const buildPmConds = (sDate, eDate) => {
            const conds = [`toDate(DATE) BETWEEN '${sDate}' AND '${eDate}'`];
            const platArr = normalizeFilterArray(platform);
            if (platArr && platArr.length > 0) {
                conds.push(`Platform IN(${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
            }
            if (category && category !== 'All') {
                conds.push(`category = '${escapeStr(category)}'`);
            }
            if (brand && brand !== 'All' && brand !== 'All Brands') {
                conds.push(`brand LIKE '%${escapeStr(brand)}%'`);
            }
            return conds.join(' AND ');
        };

        const currOlapConds = buildOlapConds(startStr, endStr);
        const prevOlapConds = buildOlapConds(prevStartStr, prevEndStr);
        const currKwConds = buildKwConds(startStr, endStr);
        const prevKwConds = buildKwConds(prevStartStr, prevEndStr);
        const currPmConds = buildPmConds(startStr, endStr);
        const prevPmConds = buildPmConds(prevStartStr, prevEndStr);

        if (drilldownLevel) {
            const getDrilldownSQL = (conds, level, parentId) => {
                let colName = src.f.brand;
                if (level === 'sku') {
                    colName = src.f.product;
                } else if (level === 'location') {
                    colName = src.f.location;
                }

                let parentCond = '';
                if (parentId) {
                    if (level === 'sku') {
                        parentCond = ` AND ${src.f.brand} = '${escapeStr(parentId)}'`;
                    } else {
                        parentCond = ` AND ${src.f.product} = '${escapeStr(parentId)}'`;
                    }
                }

                return `
                    SELECT 
                        ${colName} as name,
                        SUM(${src.f.sales}) as sales,
                        SUM(${src.f.quantitySold}) as qty,
                        SUM(${src.f.impressions}) as impressions,
                        SUM(${src.f.clicks}) as clicks,
                        SUM(${src.f.organicImpressions}) as organic_impressions,
                        SUM(${src.f.orders}) as orders,
                        SUM(${src.f.neno}) as neno,
                        SUM(${src.f.deno}) as deno,
                        SUM(${src.f.overallGv}) as overall_gv,
                        AVG(CASE WHEN ${src.f.mrp} > 0 
                                THEN(${src.f.mrp} - ${src.f.sellingPrice}) / ${src.f.mrp} 
                                ELSE 0 END) * 100 as avg_discount,
                        SUM(ifNull(toFloat64OrZero(toString(sp_ad_clicks)), 0)) as sp_ad_clicks,
                        SUM(ifNull(toFloat64OrZero(toString(sp_ad_sales)), 0)) as sp_ad_sales,
                        SUM(ifNull(toFloat64OrZero(toString(sp_ad_spend)), 0)) as sp_ad_spend,
                        SUM(ifNull(toFloat64OrZero(toString(sp_ad_units_sold)), 0)) as sp_ad_units_sold,
                        SUM(ifNull(toFloat64OrZero(toString(sd_ad_clicks)), 0)) as sd_ad_clicks,
                        SUM(ifNull(toFloat64OrZero(toString(sd_ad_sales)), 0)) as sd_ad_sales,
                        SUM(ifNull(toFloat64OrZero(toString(sd_ad_spend)), 0)) as sd_ad_spend,
                        SUM(ifNull(toFloat64OrZero(toString(sd_ad_units_sold)), 0)) as sd_ad_units_sold,
                        AVG(${src.f.listingPercent}) as avg_listing_pct
                    FROM ${src.table}
                    WHERE ${conds} ${parentCond} AND ${src.f.compFlag} = '0' AND ${colName} IS NOT NULL AND ${colName} != ''
                    GROUP BY name
                    ORDER BY sales DESC
                    LIMIT 2000
                `;
            };

            const getKwDrilldownSQL = (conds, level, parentId) => {
                let colName = 'lower(brand_name_th)';
                let parentCond = '';

                if (level === 'keyword' || level === 'sku') {
                    colName = 'keyword';
                    if (parentId) {
                        parentCond = ` AND lower(brand_name_th) = '${escapeStr(parentId.toLowerCase())}'`;
                    }
                } else if (level === 'location') {
                    colName = 'lower(location_name)';
                    if (parentId) {
                        if (filters && filters.drilldownParentLevel === 'brand') {
                            parentCond = ` AND lower(brand_name_th) = '${escapeStr(parentId.toLowerCase())}'`;
                        } else {
                            parentCond = ` AND keyword = '${escapeStr(parentId)}'`;
                        }
                    }
                } else if (level === 'brand') {
                    colName = 'lower(brand_name_th)';
                }

                let denomParentCond = '';
                if (level === 'location') {
                    if (filters && filters.drilldownParentLevel === 'brand') {
                        denomParentCond = '';
                    } else {
                        denomParentCond = parentCond;
                    }
                }

                return `
                    WITH numerator AS (
                        SELECT 
                            ${colName} as name,
                            sum(toInt32(overall)) as brand_kws
                        FROM rb_kw_olap
                        WHERE ${conds} ${parentCond} AND flag = 1 AND ${colName} IS NOT NULL AND ${colName} != ''
                        GROUP BY name
                    ),
                    denominator AS (
                        SELECT 
                            ${colName} as name,
                            sum(toInt32(overall)) as total_kws
                        FROM rb_kw_olap
                        WHERE ${conds} ${denomParentCond} AND ${colName} IS NOT NULL AND ${colName} != ''
                        GROUP BY name
                    )
                    SELECT 
                        n.name as name,
                        n.brand_kws,
                        d.total_kws
                    FROM numerator n
                    JOIN denominator d ON n.name = d.name
                    ORDER BY n.brand_kws DESC
                    LIMIT 2000
                `;
            };

            const kpiLower = (kpiCategory || '').toLowerCase();
            const isSponsoredKpi = kpiLower.includes('sponsored search') || kpiLower.includes('sponsored brand') || kpiLower.includes('sponsored product') || kpiLower.includes('sponsored display');
            const isVisibility = !isSponsoredKpi && (kpiLower.includes('visibility') || kpiLower.includes('sos') || kpiLower.includes('search') || kpiLower.includes('keyword'));

            const isPm = kpiLower === 'sb' || kpiLower.includes('sponsored brand') || 
                         kpiLower.includes('sb spend') || kpiLower.includes('sb roas') || 
                         kpiLower.includes('inorganic cvr');
            const isOrganicCvr = kpiLower.includes('organic cvr');
            const isSponsoredSearch = kpiLower.includes('sponsored search');
            const isAdGv = kpiLower.includes('ad gv') || kpiLower.includes('ad impression');
            const isOrganicGv = kpiLower.includes('organic gv') || kpiLower.includes('organic impression');
            const isDeliveryKpi = kpiLower === 'delivery time' || kpiLower.includes('same day') || kpiLower.includes('1 day') || kpiLower.includes('2 day') || kpiLower.includes('> 2 day') || kpiLower.includes('>2 day') || kpiLower.includes('greater');

            const getPmDrilldownSQL = (conds, level, parentId) => {
                let colName = 'lower(brand)';
                let parentCond = '';

                if (level === 'sku') {
                    colName = 'keyword';
                    if (parentId) {
                        parentCond = ` AND lower(brand) = '${escapeStr(parentId.toLowerCase())}'`;
                    }
                } else if (level === 'keyword') {
                    colName = 'keyword';
                    if (parentId) {
                        parentCond = ` AND lower(brand) = '${escapeStr(parentId.toLowerCase())}'`;
                    }
                } else if (level === 'location') {
                    // rb_pm_olap has keyword_type as a proxy dimension
                    colName = 'keyword_type';
                    if (parentId) {
                        if (filters && filters.drilldownParentLevel === 'brand') {
                            parentCond = ` AND lower(brand) = '${escapeStr(parentId.toLowerCase())}'`;
                        } else if (filters && filters.drilldownParentLevel === 'sku') {
                            parentCond = ` AND keyword = '${escapeStr(parentId)}'`;
                        } else {
                            parentCond = ` AND keyword = '${escapeStr(parentId)}'`;
                        }
                    }
                } else if (level === 'brand') {
                    colName = 'lower(brand)';
                    if (parentId) {
                        parentCond = ` AND lower(brand) = '${escapeStr(parentId.toLowerCase())}'`;
                    }
                }

                let orderCol = 'ad_clicks';
                if (kpiLower === 'sp' || kpiLower.includes('sponsored product')) orderCol = 'sp_clicks';
                if (kpiLower === 'sb' || kpiLower.includes('sponsored brand')) orderCol = 'sb_clicks';
                if (kpiLower === 'sd' || kpiLower.includes('sponsored display')) orderCol = 'sd_clicks';
                if (kpiLower.includes('sponsored search')) orderCol = 'ad_clicks';

                return `
                    SELECT 
                        ${colName} as name,
                        SUM(CASE WHEN targeting_type='SPONSORED_PRODUCTS' THEN ifNull(toFloat64OrZero(toString(ad_click)), 0) ELSE 0 END) as sp_clicks,
                        SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_click)), 0) ELSE 0 END) as sb_clicks,
                        SUM(CASE WHEN targeting_type='SPONSORED_DISPLAY' THEN ifNull(toFloat64OrZero(toString(ad_click)), 0) ELSE 0 END) as sd_clicks,
                        
                        SUM(CASE WHEN targeting_type='SPONSORED_PRODUCTS' THEN ifNull(toFloat64OrZero(toString(impressions)), 0) ELSE 0 END) as sp_impressions,
                        SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(impressions)), 0) ELSE 0 END) as sb_impressions,
                        SUM(CASE WHEN targeting_type='SPONSORED_DISPLAY' THEN ifNull(toFloat64OrZero(toString(impressions)), 0) ELSE 0 END) as sd_impressions,

                        SUM(CASE WHEN targeting_type='SPONSORED_PRODUCTS' THEN ifNull(toFloat64OrZero(toString(ad_sales)), 0) ELSE 0 END) as sp_sales,
                        SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_sales)), 0) ELSE 0 END) as sb_sales,
                        SUM(CASE WHEN targeting_type='SPONSORED_DISPLAY' THEN ifNull(toFloat64OrZero(toString(ad_sales)), 0) ELSE 0 END) as sd_sales,

                        SUM(CASE WHEN targeting_type='SPONSORED_PRODUCTS' THEN ifNull(toFloat64OrZero(toString(ad_spend)), 0) ELSE 0 END) as sp_spend,
                        SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_spend)), 0) ELSE 0 END) as sb_spend,
                        SUM(CASE WHEN targeting_type='SPONSORED_DISPLAY' THEN ifNull(toFloat64OrZero(toString(ad_spend)), 0) ELSE 0 END) as sd_spend,

                        SUM(CASE WHEN targeting_type='SPONSORED_PRODUCTS' THEN ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0) ELSE 0 END) as sp_orders,
                        SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0) ELSE 0 END) as sb_orders,
                        SUM(CASE WHEN targeting_type='SPONSORED_DISPLAY' THEN ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0) ELSE 0 END) as sd_orders,

                        SUM(ifNull(toFloat64OrZero(toString(ad_click)), 0)) as ad_clicks,
                        SUM(ifNull(toFloat64OrZero(toString(impressions)), 0)) as ad_impressions,
                        SUM(ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0)) as ad_orders
                    FROM rb_pm_olap
                    WHERE ${conds} ${parentCond} AND ${colName} IS NOT NULL AND ${colName} != ''
                    GROUP BY name
                    ORDER BY ${orderCol} DESC
                    LIMIT 2000
                `;
            };

            // Delivery time drilldown SQL - groups by brand/sku/location and calculates delivery day GV buckets
            const getDeliveryDrilldownSQL = (conds, level, parentId) => {
                if (!src.hasDeliveryDate) return getDrilldownSQL(conds, level, parentId); // fallback

                let colName = src.f.brand;
                if (level === 'sku') colName = src.f.product;
                else if (level === 'location') colName = src.f.location;

                let parentCond = '';
                if (parentId) {
                    if (level === 'sku') parentCond = ` AND ${src.f.brand} = '${escapeStr(parentId)}'`;
                    else parentCond = ` AND ${src.f.product} = '${escapeStr(parentId)}'`;
                }

                return `
                    WITH delivery_base AS (
                        SELECT
                            ${colName} as name,
                            ${src.overallGvCol} AS gv_val,
                            CASE
                                WHEN ${src.deliveryDateCol} IS NULL OR ${src.deliveryDateCol} = '' OR ${src.deliveryDateCol} = '0' THEN NULL
                                ELSE
                                    CASE
                                        WHEN dateDiff('day', ${src.f.date}, parseDateTimeBestEffortOrNull(concat(${src.deliveryDateCol}, ' ', toString(toYear(${src.f.date}))))) < 0 THEN 0
                                        WHEN dateDiff('day', ${src.f.date}, parseDateTimeBestEffortOrNull(concat(${src.deliveryDateCol}, ' ', toString(toYear(${src.f.date}))))) > 30 THEN NULL
                                        ELSE dateDiff('day', ${src.f.date}, parseDateTimeBestEffortOrNull(concat(${src.deliveryDateCol}, ' ', toString(toYear(${src.f.date})))))
                                    END
                            END AS delivery_days
                        FROM ${src.table}
                        WHERE ${conds} ${parentCond} AND ${src.f.compFlag} = '0' AND ${colName} IS NOT NULL AND ${colName} != ''
                    )
                    SELECT
                        name,
                        sumIf(gv_val, delivery_days = 0) AS same_day_gv,
                        sumIf(gv_val, delivery_days = 1) AS one_day_gv,
                        sumIf(gv_val, delivery_days = 2) AS two_day_gv,
                        sumIf(gv_val, delivery_days > 2) AS gt_two_day_gv,
                        sum(gv_val) AS total_delivery_gv,
                        round(avg(delivery_days)) AS avg_delivery_days
                    FROM delivery_base
                    WHERE delivery_days IS NOT NULL
                    GROUP BY name
                    ORDER BY total_delivery_gv DESC
                    LIMIT 2000
                `;
            };

            const drillSQL = isDeliveryKpi ? getDeliveryDrilldownSQL : (isVisibility ? getKwDrilldownSQL : (isPm ? getPmDrilldownSQL : getDrilldownSQL));
            const cConds = isDeliveryKpi ? currOlapConds : (isVisibility ? currKwConds : (isPm ? currPmConds : currOlapConds));
            const pConds = isDeliveryKpi ? prevOlapConds : (isVisibility ? prevKwConds : (isPm ? prevPmConds : prevOlapConds));

            let cDrillDenom = 1;
            let pDrillDenom = 1;
            if (isVisibility) {
                const [cTotRes, pTotRes] = await Promise.all([
                    queryClickHouse(`SELECT sum(toInt32(overall)) as tot FROM rb_kw_olap WHERE ${currKwConds}`),
                    queryClickHouse(`SELECT sum(toInt32(overall)) as tot FROM rb_kw_olap WHERE ${prevKwConds}`)
                ]);
                cDrillDenom = parseFloat(cTotRes[0]?.tot || 1) || 1;
                pDrillDenom = parseFloat(pTotRes[0]?.tot || 1) || 1;
            }

            let currDrill, prevDrill;

            if (isOrganicCvr) {
                // For Organic CVR, we need data from both PDP (quantity, overall_gv) and PM (ad_clicks, ad_orders)
                const [cOlap, pOlap, cPm, pPm] = await Promise.all([
                    queryClickHouse(getDrilldownSQL(currOlapConds, drilldownLevel, drilldownId)),
                    queryClickHouse(getDrilldownSQL(prevOlapConds, drilldownLevel, drilldownId)),
                    queryClickHouse(getPmDrilldownSQL(currPmConds, drilldownLevel, drilldownId)),
                    queryClickHouse(getPmDrilldownSQL(prevPmConds, drilldownLevel, drilldownId))
                ]);

                const mergePmIntoOlap = (olap, pm) => {
                    const mergedMap = new Map();

                    olap.forEach(o => {
                        const key = o.name ? o.name.toString().toLowerCase() : '';
                        if (key) {
                            mergedMap.set(key, {
                                ...o,
                                ad_clicks: 0,
                                ad_orders: 0
                            });
                        }
                    });

                    pm.forEach(p => {
                        const key = p.name ? p.name.toString().toLowerCase() : '';
                        if (!key) return;

                        if (mergedMap.has(key)) {
                            const existing = mergedMap.get(key);
                            mergedMap.set(key, {
                                ...existing,
                                ad_clicks: p.ad_clicks || 0,
                                ad_orders: p.ad_orders || 0
                            });
                        } else {
                            mergedMap.set(key, {
                                name: p.name,
                                sales: 0, qty: 0, impressions: 0, clicks: 0, organic_impressions: 0, orders: 0, neno: 0, deno: 0, overall_gv: 0, avg_discount: 0,
                                sp_ad_clicks: 0, sp_ad_sales: 0, sp_ad_spend: 0, sp_ad_units_sold: 0,
                                sd_ad_clicks: 0, sd_ad_sales: 0, sd_ad_spend: 0, sd_ad_units_sold: 0,
                                avg_listing_pct: 0,
                                ad_clicks: p.ad_clicks || 0,
                                ad_orders: p.ad_orders || 0
                            });
                        }
                    });

                    return Array.from(mergedMap.values());
                };

                currDrill = mergePmIntoOlap(cOlap, cPm);
                prevDrill = mergePmIntoOlap(pOlap, pPm);
            } else if (isSponsoredSearch || isAdGv || isOrganicGv) {
                // Sponsored Search / Ad GVs = SP(PDP) + SB(PM) + SD(PDP)
                // KPI block uses sp_ad_clicks(rb_pdp_olap) + sb_clicks(rb_pm_olap) + sd_ad_clicks(rb_pdp_olap)
                // So we merge OLAP (for sp_ad_clicks, sd_ad_clicks) with PM (for sb_clicks)
                const [cOlap, pOlap, cPm, pPm] = await Promise.all([
                    queryClickHouse(getDrilldownSQL(currOlapConds, drilldownLevel, drilldownId)),
                    queryClickHouse(getDrilldownSQL(prevOlapConds, drilldownLevel, drilldownId)),
                    queryClickHouse(getPmDrilldownSQL(currPmConds, drilldownLevel, drilldownId)),
                    queryClickHouse(getPmDrilldownSQL(prevPmConds, drilldownLevel, drilldownId))
                ]);

                const mergeSearchData = (olap, pm) => {
                    const mergedMap = new Map();
                    
                    // Fill from Olap first
                    olap.forEach(o => {
                        const key = o.name ? o.name.toString().toLowerCase() : '';
                        if (key) {
                            mergedMap.set(key, {
                                ...o,
                                sb_clicks: 0, sb_impressions: 0, sb_sales: 0, sb_spend: 0, sb_orders: 0
                            });
                        }
                    });

                    // Update with PM data or add missing brands
                    pm.forEach(p => {
                        const key = p.name ? p.name.toString().toLowerCase() : '';
                        if (!key) return;
                        
                        if (mergedMap.has(key)) {
                            const existing = mergedMap.get(key);
                            mergedMap.set(key, {
                                ...existing,
                                sb_clicks: p.sb_clicks || 0,
                                sb_impressions: p.sb_impressions || 0,
                                sb_sales: p.sb_sales || 0,
                                sb_spend: p.sb_spend || 0,
                                sb_orders: p.sb_orders || 0
                            });
                        } else {
                            // Brand not found in Olap, create entry with PM data
                            mergedMap.set(key, {
                                name: p.name,
                                sales: 0, qty: 0, impressions: 0, clicks: 0, organic_impressions: 0, orders: 0, neno: 0, deno: 0, overall_gv: 0, avg_discount: 0,
                                sp_ad_clicks: 0, sp_ad_sales: 0, sp_ad_spend: 0, sp_ad_units_sold: 0,
                                sd_ad_clicks: 0, sd_ad_sales: 0, sd_ad_spend: 0, sd_ad_units_sold: 0,
                                avg_listing_pct: 0,
                                ...p
                            });
                        }
                    });

                    return Array.from(mergedMap.values());
                };

                currDrill = mergeSearchData(cOlap, cPm);
                prevDrill = mergeSearchData(pOlap, pPm);
            } else {
                [currDrill, prevDrill] = await Promise.all([
                    queryClickHouse(drillSQL(cConds, drilldownLevel, drilldownId)),
                    queryClickHouse(drillSQL(pConds, drilldownLevel, drilldownId))
                ]);
            }

            const drillMap = new Map();
            currDrill.forEach(d => drillMap.set(d.name, { curr: d, prev: null }));
            prevDrill.forEach(d => {
                if (drillMap.has(d.name)) drillMap.get(d.name).prev = d;
                else drillMap.set(d.name, { curr: null, prev: d });
            });

            let results = Array.from(drillMap.entries()).map(([name, d]) => {
                const c = d.curr || {};
                const p = d.prev || {};

                const getVal = (obj, cat, isPrev) => {
                    if (cat.includes('price') || cat.includes('asp')) {
                        const q = parseFloat(obj.qty || 0);
                        const s = parseFloat(obj.sales || 0);
                        return q > 0 ? s / q : 0;
                    }
                    if (cat.includes('conversion') || cat.includes('cvr')) {
                        if (cat.includes('inorganic cvr')) {
                            const clicks = parseFloat(obj.ad_clicks || 0);
                            return clicks > 0 ? (parseFloat(obj.ad_orders || 0) / clicks) * 100 : 0;
                        } else if (cat.includes('organic cvr')) {
                            // Organic CVR = (Organic Qty / Organic GV) * 100
                            // Organic Qty = Qty_sold - Ad_Quantity_sold, Organic GV = Overall GV - Ad GV
                            const totalGv = parseFloat(obj.overall_gv || 0);
                            const totalQty = parseFloat(obj.qty || 0);
                            const adClicks = parseFloat(obj.ad_clicks || 0);
                            const adOrders = parseFloat(obj.ad_orders || 0);
                            const organicGv = Math.max(totalGv - adClicks, 0);
                            const organicQty = Math.max(totalQty - adOrders, 0);
                            return organicGv > 0 ? (organicQty / organicGv) * 100 : 0;
                        }
                        // Default: Total CVR
                        const totalGv = parseFloat(obj.overall_gv || 0);
                        return totalGv > 0 ? (parseFloat(obj.qty || 0) / totalGv) * 100 : 0;
                    }
                    if (cat.includes('availability') || cat.includes('listing') || cat.includes('osa')) {
                        const neno = parseFloat(obj.neno || 0);
                        const deno = parseFloat(obj.deno || 0);
                        return deno > 0 ? (neno / deno) * 100 : 0;
                    }
                    if (cat.includes('discount') || cat.includes('disc')) return parseFloat(obj.avg_discount || 0);

                    if (cat.includes('sponsored search') || cat.includes('ad gv') || cat.includes('ad impression')) {
                        return parseFloat(obj.sp_ad_clicks || obj.sp_clicks || 0) + 
                               parseFloat(obj.sb_clicks || 0) + 
                               parseFloat(obj.sd_ad_clicks || obj.sd_clicks || 0);
                    }
                    if (cat.includes('sponsored product') || cat === 'sp') return parseFloat(obj.sp_clicks || obj.sp_ad_clicks || 0);
                    if (cat.includes('sponsored brand') || cat === 'sb') return parseFloat(obj.sb_clicks || 0);
                    if (cat.includes('sponsored display') || cat === 'sd') return parseFloat(obj.sd_clicks || obj.sd_ad_clicks || 0);

                    // Delivery time KPIs — must be checked BEFORE the generic 'gv' match below
                    if (cat === 'delivery time') {
                        return parseFloat(obj.avg_delivery_days || 0);
                    }
                    if (cat.includes('same day')) {
                        const sdGv = parseFloat(obj.same_day_gv || 0);
                        const tGv = parseFloat(obj.total_delivery_gv || obj.overall_gv || 0);
                        return tGv > 0 ? (sdGv / tGv) * 100 : 0;
                    }
                    if (cat.includes('1 day') && !cat.includes('ad')) {
                        const odGv = parseFloat(obj.one_day_gv || 0);
                        const tGv = parseFloat(obj.total_delivery_gv || obj.overall_gv || 0);
                        return tGv > 0 ? (odGv / tGv) * 100 : 0;
                    }
                    if (cat.includes('2 day') && !cat.includes('ad')) {
                        const tdGv = parseFloat(obj.two_day_gv || 0);
                        const tGv = parseFloat(obj.total_delivery_gv || obj.overall_gv || 0);
                        return tGv > 0 ? (tdGv / tGv) * 100 : 0;
                    }
                    if (cat.includes('> 2 day') || cat.includes('>2 day') || cat.includes('greater')) {
                        const gtGv = parseFloat(obj.gt_two_day_gv || 0);
                        const tGv = parseFloat(obj.total_delivery_gv || obj.overall_gv || 0);
                        return tGv > 0 ? (gtGv / tGv) * 100 : 0;
                    }

                    if (cat.includes('organic') && cat.includes('impression')) return parseFloat(obj.organic_impressions || 0);
                    // Organic GVs = Total GVs - Ad GVs (SP + SB + SD clicks)
                    if (cat.includes('organic') && cat.includes('gv')) {
                        const totalGv = parseFloat(obj.overall_gv || 0);
                        const adGv = parseFloat(obj.sp_ad_clicks || obj.sp_clicks || 0) + 
                                     parseFloat(obj.sb_clicks || 0) + 
                                     parseFloat(obj.sd_ad_clicks || obj.sd_clicks || 0);
                        return Math.max(totalGv - adGv, 0);
                    }
                    if (cat.includes('impression') || cat.includes('gv')) return parseFloat(obj.overall_gv || 0);
                    if ((cat.includes('visibility') || cat.includes('sos') || cat.includes('search')) && !cat.includes('sponsored')) {
                        const raw = parseFloat(obj.brand_kws || 0);
                        let denom = isPrev ? pDrillDenom : cDrillDenom;
                        
                        // Use keyword-level total across all brands as denominator if available
                        if (drilldownLevel === 'keyword' || drilldownLevel === 'sku') {
                            denom = parseFloat(obj.total_kws || 1);
                        }

                        return denom > 0 ? (raw / denom) * 100 : 0;
                    }

                    if (cat.includes('offtake')) return parseFloat(obj.sales || 0);
                    return parseFloat(obj.sales || 0); // fallback to offtake
                };

                const curV = getVal(c, kpiLower, false);
                const preV = getVal(p, kpiLower, true);
                const delta = curV - preV;
                const deltaPct = preV > 0 ? (delta / Math.abs(preV)) * 100 : (curV > 0 ? 100 : 0);

                return {
                    name,
                    currentVal: curV,
                    prevVal: preV,
                    change: (delta >= 0 ? '+' : '') + deltaPct.toFixed(1) + '%',
                    _delta: delta
                };
            });

            // Filter: Gainers = positive delta only, Drainers = negative delta only
            if (activeTab === 'gainers') {
                results = results.filter(r => r._delta > 0);
                results.sort((a, b) => b._delta - a._delta);
            } else {
                results = results.filter(r => r._delta < 0);
                results.sort((a, b) => a._delta - b._delta);
            }

            return { rows: results.slice(0, 200) };
        }

        // -------------------------
        // QUERIES
        // -------------------------
        const olapQuery = (conds) => `
            SELECT
                SUM(${src.f.sales}) as sales,
                SUM(${src.f.quantitySold}) as qty,
                SUM(${src.f.spend}) as spend,
                SUM(${src.f.adSales}) as Ad_sales,
                SUM(${src.f.clicks}) as clicks,
                SUM(${src.f.impressions}) as impressions,
                SUM(${src.f.organicImpressions}) as org_impressions,
                SUM(${src.f.orders}) as orders,
                SUM(${src.f.neno}) as neno,
                SUM(${src.f.deno}) as deno,
                SUM(${src.f.overallGv}) as overall_gv,
                AVG(CASE WHEN ${src.f.mrp} > 0 
                     THEN(${src.f.mrp} - ${src.f.sellingPrice}) / ${src.f.mrp} 
                     ELSE 0 END) * 100 as avg_discount,
                SUM(${src.f.listingPercent}) as listed_count,
                SUM(ifNull(toFloat64OrZero(toString(sp_ad_clicks)), 0)) as sp_ad_clicks,
                SUM(ifNull(toFloat64OrZero(toString(sp_ad_sales)), 0)) as sp_ad_sales,
                SUM(ifNull(toFloat64OrZero(toString(sp_ad_spend)), 0)) as sp_ad_spend,
                SUM(ifNull(toFloat64OrZero(toString(sp_ad_units_sold)), 0)) as sp_ad_units_sold,
                SUM(ifNull(toFloat64OrZero(toString(sd_ad_clicks)), 0)) as sd_ad_clicks,
                SUM(ifNull(toFloat64OrZero(toString(sd_ad_sales)), 0)) as sd_ad_sales,
                SUM(ifNull(toFloat64OrZero(toString(sd_ad_spend)), 0)) as sd_ad_spend,
                SUM(ifNull(toFloat64OrZero(toString(sd_ad_units_sold)), 0)) as sd_ad_units_sold,
                count(*) as total_count
            FROM ${src.table}
            WHERE ${conds} AND ${src.f.compFlag} = '0'
        `;

        // No hardcoded brand list — comp_flag=0 in the DB determines "our brands"

        // Delivery time query - Same Day / 1 Day / 2 Day / >2 Days GV%
        const deliveryQuery = (conds) => {
            if (!src.hasDeliveryDate) return null;
            return `
                WITH base AS (
                    SELECT
                        ${src.overallGvCol} AS gv_val,
                        CASE
                            WHEN ${src.deliveryDateCol} IS NULL OR ${src.deliveryDateCol} = '' OR ${src.deliveryDateCol} = '0' THEN NULL
                            ELSE
                                CASE
                                    WHEN dateDiff('day', ${src.f.date}, parseDateTimeBestEffortOrNull(concat(${src.deliveryDateCol}, ' ', toString(toYear(${src.f.date}))))) < 0 THEN 0
                                    WHEN dateDiff('day', ${src.f.date}, parseDateTimeBestEffortOrNull(concat(${src.deliveryDateCol}, ' ', toString(toYear(${src.f.date}))))) > 30 THEN NULL
                                    ELSE dateDiff('day', ${src.f.date}, parseDateTimeBestEffortOrNull(concat(${src.deliveryDateCol}, ' ', toString(toYear(${src.f.date})))))
                                END
                        END AS delivery_days
                    FROM ${src.table}
                    WHERE ${conds} AND ${src.f.compFlag} = '0'
                )
                SELECT
                    sumIf(gv_val, delivery_days = 0) AS same_day_gv,
                    sumIf(gv_val, delivery_days = 1) AS one_day_gv,
                    sumIf(gv_val, delivery_days = 2) AS two_day_gv,
                    sumIf(gv_val, delivery_days > 2) AS gt_two_day_gv,
                    sum(gv_val) AS total_gv,
                    round(avg(delivery_days)) AS avg_delivery_days
                FROM base
                WHERE delivery_days IS NOT NULL
            `;
        };

        const kwQuery = (conds) => `
            SELECT 
                sum(toInt32(overall)) as total_kws,
                sumIf(toInt32(overall), flag=1) as rb_kw_olaps,
                sumIf(toInt32(spons), flag=1) as rb_kw_spons,
                sumIf(toInt32(organic), flag=1) as rb_kw_organic
            FROM rb_kw_olap
            WHERE ${conds}
        `;

        const pmQuery = (conds) => `
            SELECT 
                SUM(ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0)) as orders,
                SUM(ifNull(toFloat64OrZero(toString(impressions)), 0)) as impressions,
                SUM(ifNull(toFloat64OrZero(toString(ad_click)), 0)) as clicks,
                
                SUM(CASE WHEN targeting_type='SPONSORED_PRODUCTS' THEN ifNull(toFloat64OrZero(toString(ad_click)), 0) ELSE 0 END) as sp_clicks,
                SUM(CASE WHEN targeting_type='SPONSORED_PRODUCTS' THEN ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0) ELSE 0 END) as sp_orders,
                SUM(CASE WHEN targeting_type='SPONSORED_PRODUCTS' THEN ifNull(toFloat64OrZero(toString(ad_sales)), 0) ELSE 0 END) as sp_sales,
                SUM(CASE WHEN targeting_type='SPONSORED_PRODUCTS' THEN ifNull(toFloat64OrZero(toString(ad_spend)), 0) ELSE 0 END) as sp_spend,

                SUM(CASE WHEN targeting_type='SPONSORED_DISPLAY' THEN ifNull(toFloat64OrZero(toString(ad_click)), 0) ELSE 0 END) as sd_clicks,
                SUM(CASE WHEN targeting_type='SPONSORED_DISPLAY' THEN ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0) ELSE 0 END) as sd_orders,
                SUM(CASE WHEN targeting_type='SPONSORED_DISPLAY' THEN ifNull(toFloat64OrZero(toString(ad_sales)), 0) ELSE 0 END) as sd_sales,
                SUM(CASE WHEN targeting_type='SPONSORED_DISPLAY' THEN ifNull(toFloat64OrZero(toString(ad_spend)), 0) ELSE 0 END) as sd_spend,

                SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_click)), 0) ELSE 0 END) as sb_clicks,
                SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0) ELSE 0 END) as sb_orders,
                SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_sales)), 0) ELSE 0 END) as sb_sales,
                SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_spend)), 0) ELSE 0 END) as sb_spend
            FROM rb_pm_olap
            WHERE ${conds}
        `;

        const brandQuery = (conds) => `
            SELECT
                ${src.f.brand} as brand,
                SUM(${src.f.sales}) as sales,
                SUM(${src.f.quantitySold}) as qty,
                SUM(${src.f.impressions}) as impressions,
                SUM(${src.f.clicks}) as clicks,
                SUM(${src.f.organicImpressions}) as organic_impressions,
                SUM(${src.f.orders}) as orders,
                SUM(${src.f.neno}) as neno,
                SUM(${src.f.deno}) as deno,
                SUM(${src.f.overallGv}) as overall_gv,
                AVG(CASE WHEN ${src.f.mrp} > 0 
                        THEN(${src.f.mrp} - ${src.f.sellingPrice}) / ${src.f.mrp} 
                        ELSE 0 END) * 100 as avg_discount,
                countIf(${src.f.deno} > 0) as listed_count,
                SUM(ifNull(toFloat64OrZero(toString(sp_ad_clicks)), 0)) as sp_ad_clicks,
                SUM(ifNull(toFloat64OrZero(toString(sp_ad_sales)), 0)) as sp_ad_sales,
                SUM(ifNull(toFloat64OrZero(toString(sp_ad_spend)), 0)) as sp_ad_spend,
                SUM(ifNull(toFloat64OrZero(toString(sp_ad_units_sold)), 0)) as sp_ad_units_sold,
                SUM(ifNull(toFloat64OrZero(toString(sd_ad_clicks)), 0)) as sd_ad_clicks,
                SUM(ifNull(toFloat64OrZero(toString(sd_ad_sales)), 0)) as sd_ad_sales,
                SUM(ifNull(toFloat64OrZero(toString(sd_ad_spend)), 0)) as sd_ad_spend,
                SUM(ifNull(toFloat64OrZero(toString(sd_ad_units_sold)), 0)) as sd_ad_units_sold,
                count() as total_count,
                AVG(${src.f.listingPercent}) as avg_listing_pct
            FROM ${src.table}
            WHERE ${conds} AND ${src.f.compFlag} = '0' AND ${src.f.brand} IS NOT NULL AND ${src.f.brand} != ''
            GROUP BY brand
            ORDER BY sales DESC
            LIMIT 15
        `;

        const kwBrandQuery = (conds) => `
            SELECT
                lower(brand_name_th) as brand,
                sum(toInt32(overall)) as brand_kws
            FROM rb_kw_olap
            WHERE ${conds} AND flag=1
            GROUP BY brand
        `;

        const pmBrandQuery = (conds) => `
            SELECT
                lower(brand) as brand,
                SUM(ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0)) as orders,
                SUM(ifNull(toFloat64OrZero(toString(ad_click)), 0)) as clicks,
                
                SUM(CASE WHEN targeting_type='SPONSORED_PRODUCTS' THEN ifNull(toFloat64OrZero(toString(ad_click)), 0) ELSE 0 END) as sp_clicks,
                SUM(CASE WHEN targeting_type='SPONSORED_PRODUCTS' THEN ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0) ELSE 0 END) as sp_orders,
                SUM(CASE WHEN targeting_type='SPONSORED_PRODUCTS' THEN ifNull(toFloat64OrZero(toString(ad_sales)), 0) ELSE 0 END) as sp_sales,
                SUM(CASE WHEN targeting_type='SPONSORED_PRODUCTS' THEN ifNull(toFloat64OrZero(toString(ad_spend)), 0) ELSE 0 END) as sp_spend,

                SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_click)), 0) ELSE 0 END) as sb_clicks,
                SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0) ELSE 0 END) as sb_orders,
                SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_sales)), 0) ELSE 0 END) as sb_sales,
                SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_spend)), 0) ELSE 0 END) as sb_spend,

                SUM(CASE WHEN targeting_type='SPONSORED_DISPLAY' THEN ifNull(toFloat64OrZero(toString(ad_click)), 0) ELSE 0 END) as sd_clicks,
                SUM(CASE WHEN targeting_type='SPONSORED_DISPLAY' THEN ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0) ELSE 0 END) as sd_orders,
                SUM(CASE WHEN targeting_type='SPONSORED_DISPLAY' THEN ifNull(toFloat64OrZero(toString(ad_sales)), 0) ELSE 0 END) as sd_sales,
                SUM(CASE WHEN targeting_type='SPONSORED_DISPLAY' THEN ifNull(toFloat64OrZero(toString(ad_spend)), 0) ELSE 0 END) as sd_spend,

                SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_click)), 0) ELSE 0 END) as sb_clicks,
                SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0) ELSE 0 END) as sb_orders,
                SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_sales)), 0) ELSE 0 END) as sb_sales,
                SUM(CASE WHEN targeting_type='SPONSORED_BRANDS' THEN ifNull(toFloat64OrZero(toString(ad_spend)), 0) ELSE 0 END) as sb_spend
            FROM rb_pm_olap
            WHERE ${conds} AND brand IS NOT NULL AND brand != ''
            GROUP BY brand
        `;

        // Build delivery queries (may be null if column doesn't exist)
        const currDeliverySQL = deliveryQuery(currOlapConds);
        const prevDeliverySQL = deliveryQuery(prevOlapConds);

        const [
            currOlap, prevOlap,
            currKw, prevKw,
            currPm, prevPm,
            currBrands, prevBrands,
            currKwBrands, prevKwBrands,
            currPmBrands, prevPmBrands,
            currDelivery, prevDelivery
        ] = await Promise.all([
            queryClickHouse(olapQuery(currOlapConds)),
            queryClickHouse(olapQuery(prevOlapConds)),
            queryClickHouse(kwQuery(currKwConds)),
            queryClickHouse(kwQuery(prevKwConds)),
            queryClickHouse(pmQuery(currPmConds)),
            queryClickHouse(pmQuery(prevPmConds)),
            queryClickHouse(brandQuery(currOlapConds)),
            queryClickHouse(brandQuery(prevOlapConds)),
            queryClickHouse(kwBrandQuery(currKwConds)),
            queryClickHouse(kwBrandQuery(prevKwConds)),
            queryClickHouse(pmBrandQuery(currPmConds)),
            queryClickHouse(pmBrandQuery(prevPmConds)),
            currDeliverySQL ? queryClickHouse(currDeliverySQL) : Promise.resolve([]),
            prevDeliverySQL ? queryClickHouse(prevDeliverySQL) : Promise.resolve([])
        ]);

        // -------------------------
        // PARSE DATA
        // -------------------------
        const c = currOlap[0] || {};
        const p = prevOlap[0] || {};
        const ck = currKw[0] || {};
        const pk = prevKw[0] || {};
        const cpm = currPm[0] || {};
        const ppm = prevPm[0] || {};

        const cSpAdClicks = parseFloat(c.sp_ad_clicks || 0);
        const pSpAdClicks = parseFloat(p.sp_ad_clicks || 0);
        const cSpAdSales = parseFloat(c.sp_ad_sales || 0);
        const pSpAdSales = parseFloat(p.sp_ad_sales || 0);
        const cSpAdSpend = parseFloat(c.sp_ad_spend || 0);
        const pSpAdSpend = parseFloat(p.sp_ad_spend || 0);
        const cSpRoas = cSpAdSpend > 0 ? (cSpAdSales / cSpAdSpend) : 0;
        const pSpRoas = pSpAdSpend > 0 ? (pSpAdSales / pSpAdSpend) : 0;

        const cSdAdClicks = parseFloat(c.sd_ad_clicks || 0);
        const pSdAdClicks = parseFloat(p.sd_ad_clicks || 0);
        const cSdAdSales = parseFloat(c.sd_ad_sales || 0);
        const pSdAdSales = parseFloat(p.sd_ad_sales || 0);
        const cSdAdSpend = parseFloat(c.sd_ad_spend || 0);
        const pSdAdSpend = parseFloat(p.sd_ad_spend || 0);
        const cSdRoas = cSdAdSpend > 0 ? (cSdAdSales / cSdAdSpend) : 0;
        const pSdRoas = pSdAdSpend > 0 ? (pSdAdSales / pSdAdSpend) : 0;

        // Calculate PM Ad Metrics
        const cSpClicks = parseFloat(cpm.sp_clicks || 0);
        const pSpClicks = parseFloat(ppm.sp_clicks || 0);
        const cSpOrders = parseFloat(cpm.sp_orders || 0);
        const pSpOrders = parseFloat(ppm.sp_orders || 0);
        const cSpCvr = cSpClicks > 0 ? (cSpOrders / cSpClicks) * 100 : 0;
        const pSpCvr = pSpClicks > 0 ? (pSpOrders / pSpClicks) * 100 : 0;

        const cSdClicks = parseFloat(cpm.sd_clicks || 0);
        const pSdClicks = parseFloat(ppm.sd_clicks || 0);
        const cSdOrders = parseFloat(cpm.sd_orders || 0);
        const pSdOrders = parseFloat(ppm.sd_orders || 0);
        const cSdCvr = cSdClicks > 0 ? (cSdOrders / cSdClicks) * 100 : 0;
        const pSdCvr = pSdClicks > 0 ? (pSdOrders / pSdClicks) * 100 : 0;

        const cSales = parseFloat(c.sales || 0);
        const pSales = parseFloat(p.sales || 0);
        const cQty = parseFloat(c.qty || 0);
        const pQty = parseFloat(p.qty || 0);
        
        const cImpAd = parseFloat(c.impressions || 0);
        const pImpAd = parseFloat(p.impressions || 0);
        
        const cTotalGvs = parseFloat(c.overall_gv || 0);
        const pTotalGvs = parseFloat(p.overall_gv || 0);

        const cOrders = parseFloat(c.orders || 0);
        const pOrders = parseFloat(p.orders || 0);
        const cClicks = parseFloat(c.clicks || 0);

        const cNeno = parseFloat(c.neno || 0);
        const cDeno = parseFloat(c.deno || 0);
        const pNeno = parseFloat(p.neno || 0);
        const pDeno = parseFloat(p.deno || 0);

        const cDiscount = parseFloat(c.avg_discount || 0);
        const pDiscount = parseFloat(p.avg_discount || 0);

        // Keyword data
        const cTotalKw = parseFloat(ck.total_kws || 0);
        const pTotalKw = parseFloat(pk.total_kws || 0);
        const cRbKw = parseFloat(ck.rb_kw_olaps || 0);
        const pRbKw = parseFloat(pk.rb_kw_olaps || 0);

        // PM data
        const cPmOrders = parseFloat(cpm.orders || 0);
        const cPmImp = parseFloat(cpm.impressions || 0);
        const cPmClicks = parseFloat(cpm.clicks || 0);
        const pPmOrders = parseFloat(ppm.orders || 0);
        const pPmImp = parseFloat(ppm.impressions || 0);
        const pPmClicks = parseFloat(ppm.clicks || 0);
        
        
        const cSbClicks = parseFloat(cpm.sb_clicks || 0);
        const pSbClicks = parseFloat(ppm.sb_clicks || 0);

        // SB Conversion = sb_orders / sb_clicks * 100 (from rb_pm_olap)
        const cSbOrders = parseFloat(cpm.sb_orders || 0);
        const pSbOrders = parseFloat(ppm.sb_orders || 0);
        const cSbCvr = cSbClicks > 0 ? (cSbOrders / cSbClicks) * 100 : 0;
        const pSbCvr = pSbClicks > 0 ? (pSbOrders / pSbClicks) * 100 : 0;

        // SB ROAS = sb_sales / sb_spend
        const cSbSales = parseFloat(cpm.sb_sales || 0);
        const pSbSales = parseFloat(ppm.sb_sales || 0);
        const cSbSpend = parseFloat(cpm.sb_spend || 0);
        const pSbSpend = parseFloat(ppm.sb_spend || 0);
        const cSbRoas = cSbSpend > 0 ? (cSbSales / cSbSpend) : 0;
        const pSbRoas = pSbSpend > 0 ? (pSbSales / pSbSpend) : 0;

        // Sponsored Search Aggregations (SP + SB + SD)
        const cSearchAdSales = cSpAdSales + cSbSales + cSdAdSales;
        const pSearchAdSales = pSpAdSales + pSbSales + pSdAdSales;
        const cSearchAdSpend = cSpAdSpend + cSbSpend + cSdAdSpend;
        const pSearchAdSpend = pSpAdSpend + pSbSpend + pSdAdSpend;
        const cSearchRoas = cSearchAdSpend > 0 ? (cSearchAdSales / cSearchAdSpend) : 0;
        const pSearchRoas = pSearchAdSpend > 0 ? (pSearchAdSales / pSearchAdSpend) : 0;

        // Organic GV = Total GV - Ad GV
        // For Amazon: Ad GV = SP(PDP ad clicks) + SB(PM clicks) + SD(PDP ad clicks)
        // For Flipkart: Ad GV = SP(PM clicks) + SB(PM clicks)
        const isAmazonCalc = (platform && platform.toLowerCase().includes('amazon'));
        const cAdGvTotal = isAmazonCalc ? (cSpAdClicks + cSbClicks + cSdAdClicks) : (cSpClicks + cSbClicks);
        const pAdGvTotal = isAmazonCalc ? (pSpAdClicks + pSbClicks + pSdAdClicks) : (pSpClicks + pSbClicks);
        const cImpOrg = Math.max(cTotalGvs - cAdGvTotal, 0);
        const pImpOrg = Math.max(pTotalGvs - pAdGvTotal, 0);

        // Derived KPIs
        const cAsp = cQty > 0 ? cSales / cQty : 0;
        const pAsp = pQty > 0 ? pSales / pQty : 0;
        
        const cOsa = cDeno > 0 ? (cNeno / cDeno) * 100 : 0;
        const pOsa = pDeno > 0 ? (pNeno / pDeno) * 100 : 0;

        // CVR = Qty_Sold / Overall_GV
        const cOverallGv = parseFloat(c.overall_gv || 0);
        const pOverallGv = parseFloat(p.overall_gv || 0);
        const cCvr = cOverallGv > 0 ? (cQty / cOverallGv) * 100 : 0;
        const pCvr = pOverallGv > 0 ? (pQty / pOverallGv) * 100 : 0;
        
        // Organic CVR = (Organic Qty / Organic GV) * 100
        // Organic Qty = Qty_sold (rb_pdp_olap) - Ad_Quantity_sold (rb_pm_olap)
        // Organic GV = Overall GV (rb_pdp_olap) - Ad GV (SP + SB clicks from rb_pm_olap)
        const cOrgQty = Math.max(cQty - cPmOrders, 0);
        const pOrgQty = Math.max(pQty - pPmOrders, 0);
        const cCvrOrg = cImpOrg > 0 ? (cOrgQty / cImpOrg) * 100 : 0;
        const pCvrOrg = pImpOrg > 0 ? (pOrgQty / pImpOrg) * 100 : 0;
        
        const cSearchOrders = cSpOrders + cSbOrders + cSdOrders;
        const pSearchOrders = pSpOrders + pSbOrders + pSdOrders;
        const cSearchClicks = cSpClicks + cSbClicks + cSdClicks;
        const pSearchClicks = pSpClicks + pSbClicks + pSdClicks;
        const cCvrAd = cSearchClicks > 0 ? (cSearchOrders / cSearchClicks) * 100 : 0;
        const pCvrAd = pSearchClicks > 0 ? (pSearchOrders / pSearchClicks) * 100 : 0;

        const cSos = cTotalKw > 0 ? (cRbKw / cTotalKw) * 100 : 0;
        const pSos = pTotalKw > 0 ? (pRbKw / pTotalKw) * 100 : 0;

        // Parse delivery time data
        const cd = (currDelivery && currDelivery[0]) || {};
        const pd = (prevDelivery && prevDelivery[0]) || {};
        const hasDeliveryData = src.hasDeliveryDate && (parseFloat(cd.total_gv || 0) > 0);

        const cSameDayPct = parseFloat(cd.total_gv || 0) > 0 ? (parseFloat(cd.same_day_gv || 0) / parseFloat(cd.total_gv)) * 100 : 0;
        const pSameDayPct = parseFloat(pd.total_gv || 0) > 0 ? (parseFloat(pd.same_day_gv || 0) / parseFloat(pd.total_gv)) * 100 : 0;
        const cOneDayPct = parseFloat(cd.total_gv || 0) > 0 ? (parseFloat(cd.one_day_gv || 0) / parseFloat(cd.total_gv)) * 100 : 0;
        const pOneDayPct = parseFloat(pd.total_gv || 0) > 0 ? (parseFloat(pd.one_day_gv || 0) / parseFloat(pd.total_gv)) * 100 : 0;
        const cTwoDayPct = parseFloat(cd.total_gv || 0) > 0 ? (parseFloat(cd.two_day_gv || 0) / parseFloat(cd.total_gv)) * 100 : 0;
        const pTwoDayPct = parseFloat(pd.total_gv || 0) > 0 ? (parseFloat(pd.two_day_gv || 0) / parseFloat(pd.total_gv)) * 100 : 0;
        const cGtTwoDayPct = parseFloat(cd.total_gv || 0) > 0 ? (parseFloat(cd.gt_two_day_gv || 0) / parseFloat(cd.total_gv)) * 100 : 0;
        const pGtTwoDayPct = parseFloat(pd.total_gv || 0) > 0 ? (parseFloat(pd.gt_two_day_gv || 0) / parseFloat(pd.total_gv)) * 100 : 0;

        // Avg delivery days
        const cAvgDelivDays = Math.round(parseFloat(cd.avg_delivery_days || 0));
        const pAvgDelivDays = Math.round(parseFloat(pd.avg_delivery_days || 0));
        const formatDelivTime = (days) => days === 0 ? 'Same Day' : `${days} ${days === 1 ? 'Day' : 'Days'}`;
        const cAvgDelivTime = formatDelivTime(cAvgDelivDays);
        const pAvgDelivTime = formatDelivTime(pAvgDelivDays);

        console.log(`[getEcomRcaData] Delivery data available: ${hasDeliveryData}, Avg: ${cAvgDelivTime}, Same Day: ${cSameDayPct.toFixed(2)}%`);

        // -------------------------
        // FORMAT FORMATTERS
        // -------------------------
        const formatLac = (val) => {
            if (val >= 10000000) return `₹ ${(val / 10000000).toFixed(2)} Cr`;
            if (val >= 100000) return `₹ ${(val / 100000).toFixed(2)} lac`;
            if (val >= 1000) return `₹ ${(val / 1000).toFixed(2)} K`;
            return `₹ ${val.toFixed(0)} `;
        };
        const formatCount = (val) => {
            if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
            if (val >= 100000) return `${(val / 100000).toFixed(2)} lac`;
            if (val >= 1000) return `${(val / 1000).toFixed(2)} K`;
            return `${val.toFixed(0)} `;
        };
        const pctDelta = (curr, prev) => {
            if (prev === 0) return { val: curr > 0 ? '+100.0%' : '0.0%', isPos: curr > 0 };
            const d = ((curr - prev) / Math.abs(prev)) * 100;
            return { val: `${d > 0 ? '+' : ''}${d.toFixed(2)}% `, isPos: d >= 0 };
        };
        const absDelta = (curr, prev) => {
            const d = curr - prev;
            return { val: `${d > 0 ? '+' : ''}${d.toFixed(2)}% `, isPos: d >= 0 };
        };

        const salesDelta = pctDelta(cSales, pSales);
        const aspDelta = pctDelta(cAsp, pAsp);
        const spDelta = pctDelta(cSpClicks, pSpClicks);
        const sbDelta = pctDelta(cSbClicks, pSbClicks);
        const gvDelta = pctDelta(cTotalGvs, pTotalGvs);
        const orgGvDelta = pctDelta(cImpOrg, pImpOrg);
        const adGvDelta = pctDelta(cImpAd, pImpAd);
        const cvrDelta = absDelta(cCvr, pCvr);
        const cvrOrgDelta = absDelta(cCvrOrg, pCvrOrg);
        const cvrAdDelta = absDelta(cCvrAd, pCvrAd);
        const spCvrDelta = absDelta(cSpCvr, pSpCvr);
        const sdCvrDelta = absDelta(cSdCvr, pSdCvr);
        const sbCvrDelta = absDelta(cSbCvr, pSbCvr);
        const osaDelta = absDelta(cOsa, pOsa);
        const discDelta = absDelta(cDiscount, pDiscount);
        const sosDelta = absDelta(cSos, pSos);
        const searchSpendDelta = pctDelta(cSearchAdSpend, pSearchAdSpend);

        // Map brand metrics for tooltips
        const brandsMap = new Map();
        currBrands.forEach(b => {
            brandsMap.set(b.brand, { curr: b, prev: null });
        });
        prevBrands.forEach(b => {
            if (brandsMap.has(b.brand)) {
                brandsMap.get(b.brand).prev = b;
            } else {
                brandsMap.set(b.brand, { curr: null, prev: b });
            }
        });

        const allNodeMetrics = Array.from(brandsMap.entries()).map(([brandName, data]) => {
            const cb = data.curr || {};
            const pb = data.prev || {};

            const cAspB = cb.qty > 0 ? cb.sales / cb.qty : 0;
            const pAspB = pb.qty > 0 ? pb.sales / pb.qty : 0;
            // CVR = Qty_Sold / Overall_GV
            const cOverallGvB = parseFloat(cb.overall_gv || 0);
            const pOverallGvB = parseFloat(pb.overall_gv || 0);
            const cCvrB = cOverallGvB > 0 ? (parseFloat(cb.qty || 0) / cOverallGvB) * 100 : 0;
            const pCvrB = pOverallGvB > 0 ? (parseFloat(pb.qty || 0) / pOverallGvB) * 100 : 0;

            const cListB = cb.deno > 0 ? (cb.neno / cb.deno) * 100 : 0;
            const pListB = pb.deno > 0 ? (pb.neno / pb.deno) * 100 : 0;
            const cDiscB = parseFloat(cb.avg_discount || 0);
            const pDiscB = parseFloat(pb.avg_discount || 0);

            const lowerBrand = brandName.toLowerCase();
            const ckw = currKwBrands.find(b => b.brand === lowerBrand) || {};
            const pkw = prevKwBrands.find(b => b.brand === lowerBrand) || {};
            const cBrandKwsB = parseFloat(ckw.brand_kws || 0);
            const pBrandKwsB = parseFloat(pkw.brand_kws || 0);
            const cSosB = cTotalKw > 0 ? (cBrandKwsB / cTotalKw) * 100 : 0;
            const pSosB = pTotalKw > 0 ? (pBrandKwsB / pTotalKw) * 100 : 0;

            const cpmB = (currPmBrands || []).find(b => b.brand === lowerBrand) || {};
            const ppmB = (prevPmBrands || []).find(b => b.brand === lowerBrand) || {};
            
            const cPmOrdersB = parseFloat(cpmB.orders || 0);
            const pPmOrdersB = parseFloat(ppmB.orders || 0);
            const cPmClicksB = parseFloat(cpmB.clicks || 0);
            const pPmClicksB = parseFloat(ppmB.clicks || 0);
            
            const cSpClicksB = parseFloat(cb.sp_ad_clicks || cpmB.sp_clicks || 0);
            const pSpClicksB = parseFloat(pb.sp_ad_clicks || ppmB.sp_clicks || 0);
            const cSbClicksB = parseFloat(cpmB.sb_clicks || 0);
            const pSbClicksB = parseFloat(ppmB.sb_clicks || 0);

            const cSpOrdersB = parseFloat(cb.sp_ad_units_sold || cpmB.sp_orders || 0);
            const pSpOrdersB = parseFloat(pb.sp_ad_units_sold || ppmB.sp_orders || 0);
            const cSpSalesB = parseFloat(cb.sp_ad_sales || cpmB.sp_sales || 0);
            const pSpSalesB = parseFloat(pb.sp_ad_sales || ppmB.sp_sales || 0);
            const cSpSpendB = parseFloat(cb.sp_ad_spend || cpmB.sp_spend || 0);
            const pSpSpendB = parseFloat(pb.sp_ad_spend || ppmB.sp_spend || 0);
            const cSpCvrB = cSpClicksB > 0 ? (cSpOrdersB / cSpClicksB) * 100 : 0;
            const pSpCvrB = pSpClicksB > 0 ? (pSpOrdersB / pSpClicksB) * 100 : 0;
            const cSpRoasB = cSpSpendB > 0 ? (cSpSalesB / cSpSpendB) : 0;
            const pSpRoasB = pSpSpendB > 0 ? (pSpSalesB / pSpSpendB) : 0;

            const cSdOrdersB = parseFloat(cb.sd_ad_units_sold || cpmB.sd_orders || 0);
            const pSdOrdersB = parseFloat(pb.sd_ad_units_sold || ppmB.sd_orders || 0);
            const cSdClicksB = parseFloat(cb.sd_ad_clicks || cpmB.sd_clicks || 0);
            const pSdClicksB = parseFloat(pb.sd_ad_clicks || ppmB.sd_clicks || 0);
            const cSdSalesB = parseFloat(cb.sd_ad_sales || cpmB.sd_sales || 0);
            const pSdSalesB = parseFloat(pb.sd_ad_sales || ppmB.sd_sales || 0);
            const cSdSpendB = parseFloat(cb.sd_ad_spend || cpmB.sd_spend || 0);
            const pSdSpendB = parseFloat(pb.sd_ad_spend || ppmB.sd_spend || 0);
            const cSdCvrB = cSdClicksB > 0 ? (cSdOrdersB / cSdClicksB) * 100 : 0;
            const pSdCvrB = pSdClicksB > 0 ? (pSdOrdersB / pSdClicksB) * 100 : 0;
            const cSdRoasB = cSdSpendB > 0 ? (cSdSalesB / cSdSpendB) : 0;
            const pSdRoasB = pSdSpendB > 0 ? (pSdSalesB / pSdSpendB) : 0;

            const cSbOrdersB = parseFloat(cpmB.sb_orders || 0);
            const pSbOrdersB = parseFloat(ppmB.sb_orders || 0);
            const cSbSalesB = parseFloat(cpmB.sb_sales || 0);
            const pSbSalesB = parseFloat(ppmB.sb_sales || 0);
            const cSbSpendB = parseFloat(cpmB.sb_spend || 0);
            const pSbSpendB = parseFloat(ppmB.sb_spend || 0);
            const cSbCvrB = cSbClicksB > 0 ? (cSbOrdersB / cSbClicksB) * 100 : 0;
            const pSbCvrB = pSbClicksB > 0 ? (pSbOrdersB / pSbClicksB) * 100 : 0;
            const cSbRoasB = cSbSpendB > 0 ? (cSbSalesB / cSbSpendB) : 0;
            const pSbRoasB = pSbSpendB > 0 ? (pSbSalesB / pSbSpendB) : 0;

            const cSearchOrdersB = cSpOrdersB + cSbOrdersB + cSdOrdersB;
            const pSearchOrdersB = pSpOrdersB + pSbOrdersB + pSdOrdersB;
            const cSearchClicksB = cSpClicksB + cSbClicksB + cSdClicksB;
            const pSearchClicksB = pSpClicksB + pSbClicksB + pSdClicksB;
            const cSearchSalesB = cSpSalesB + cSbSalesB + cSdSalesB;
            const pSearchSalesB = pSpSalesB + pSbSalesB + pSdSalesB;
            const cSearchSpendB = cSpSpendB + cSbSpendB + cSdSpendB;
            const pSearchSpendB = pSpSpendB + pSbSpendB + pSdSpendB;

            const cCvrAdB = cSearchClicksB > 0 ? (cSearchOrdersB / cSearchClicksB) * 100 : 0;
            const pCvrAdB = pSearchClicksB > 0 ? (pSearchOrdersB / pSearchClicksB) * 100 : 0;
            const cSearchRoasB = cSearchSpendB > 0 ? (cSearchSalesB / cSearchSpendB) : 0;
            const pSearchRoasB = pSearchSpendB > 0 ? (pSearchSalesB / pSearchSpendB) : 0;

            return {
                brand: brandName,
                // Offtake fields
                offtake: formatLac(parseFloat(cb.sales || 0)),
                prevOfftake: formatLac(parseFloat(pb.sales || 0)),
                deltaOfftake: pctDelta(parseFloat(cb.sales || 0), parseFloat(pb.sales || 0)).val,
                rawOfftake: parseFloat(cb.sales || 0),
                rawPrevOfftake: parseFloat(pb.sales || 0),
                
                // ASP (Price) fields
                price: `₹${cAspB.toFixed(1)} `,
                prevPrice: `₹${pAspB.toFixed(1)} `,
                deltaPrice: `${(cAspB - pAspB) > 0 ? '+' : ''}₹${Math.abs(cAspB - pAspB).toFixed(1)} `,
                rawPrice: cAspB,
                rawPrevPrice: pAspB,
                
                // CVR fields
                conversion: `${cCvrB.toFixed(1)}% `,
                prevConversion: `${pCvrB.toFixed(1)}% `,
                deltaConversion: `${(cCvrB - pCvrB) > 0 ? '+' : ''} ${(cCvrB - pCvrB).toFixed(1)}% `,
                rawCvr: cCvrB,
                rawPrevCvr: pCvrB,
                rawInorganicCvr: cCvrAdB,
                rawPrevInorganicCvr: pCvrAdB,

                // Availability (Listing) fields
                rawListing: cListB,
                rawPrevListing: pListB,

                // Discount fields
                rawDiscount: cDiscB,
                rawPrevDiscount: pDiscB,

                // Share of Search fields
                rawSos: cSosB,
                rawPrevSos: pSosB,

                // GVs field for tooltip
                rawGv: cOverallGvB,
                rawPrevGv: pOverallGvB,

                // Organic GV = Total GV - Ad GV (consistent with KPI block)
                // For Amazon: Ad GV = SP(PDP ad_clicks) + SB(PM clicks) + SD(PDP ad_clicks)
                // For Flipkart: Ad GV = SP(PM clicks) + SB(PM clicks)
                rawOrganic: isAmazonCalc
                    ? Math.max(cOverallGvB - (parseFloat(cb.sp_ad_clicks || 0) + cSbClicksB + parseFloat(cb.sd_ad_clicks || 0)), 0)
                    : Math.max(cOverallGvB - (cSpClicksB + cSbClicksB), 0),
                rawPrevOrganic: isAmazonCalc
                    ? Math.max(pOverallGvB - (parseFloat(pb.sp_ad_clicks || 0) + pSbClicksB + parseFloat(pb.sd_ad_clicks || 0)), 0)
                    : Math.max(pOverallGvB - (pSpClicksB + pSbClicksB), 0),

                // Organic Qty = Qty_sold - Ad_Quantity_sold
                rawOrganicQty: Math.max(parseFloat(cb.qty || 0) - cPmOrdersB, 0),
                rawPrevOrganicQty: Math.max(parseFloat(pb.qty || 0) - pPmOrdersB, 0),

                // Organic CVR = Organic Qty / Organic GV * 100
                rawOrganicCvr: (() => {
                    const orgGv = isAmazonCalc
                        ? Math.max(cOverallGvB - (parseFloat(cb.sp_ad_clicks || 0) + cSbClicksB + parseFloat(cb.sd_ad_clicks || 0)), 0)
                        : Math.max(cOverallGvB - (cSpClicksB + cSbClicksB), 0);
                    const orgQty = Math.max(parseFloat(cb.qty || 0) - cPmOrdersB, 0);
                    return orgGv > 0 ? (orgQty / orgGv) * 100 : 0;
                })(),
                rawPrevOrganicCvr: (() => {
                    const orgGv = isAmazonCalc
                        ? Math.max(pOverallGvB - (parseFloat(pb.sp_ad_clicks || 0) + pSbClicksB + parseFloat(pb.sd_ad_clicks || 0)), 0)
                        : Math.max(pOverallGvB - (pSpClicksB + pSbClicksB), 0);
                    const orgQty = Math.max(parseFloat(pb.qty || 0) - pPmOrdersB, 0);
                    return orgGv > 0 ? (orgQty / orgGv) * 100 : 0;
                })(),

                // Ad GV (SP(PDP) + SB(PM) + SD(PDP)) matching KPI block
                rawAd: parseFloat(cb.sp_ad_clicks || 0) + cSbClicksB + parseFloat(cb.sd_ad_clicks || 0),
                rawPrevAd: parseFloat(pb.sp_ad_clicks || 0) + pSbClicksB + parseFloat(pb.sd_ad_clicks || 0),

                // SP / SB / SD clicks for tooltip
                rawSp: parseFloat(cb.sp_ad_clicks || 0), rawPrevSp: parseFloat(pb.sp_ad_clicks || 0),
                rawSd: cSdClicksB, rawPrevSd: pSdClicksB,
                rawSb: cSbClicksB, rawPrevSb: pSbClicksB,

                rawSpCvr: cSpCvrB, rawPrevSpCvr: pSpCvrB,
                rawSpRoas: cSpRoasB, rawPrevSpRoas: pSpRoasB,
                rawSpSpend: cSpSpendB, rawPrevSpSpend: pSpSpendB,

                rawSdCvr: cSdCvrB, rawPrevSdCvr: pSdCvrB,
                rawSdRoas: cSdRoasB, rawPrevSdRoas: pSdRoasB,
                rawSdSpend: cSdSpendB, rawPrevSdSpend: pSdSpendB,

                rawSbCvr: cSbCvrB, rawPrevSbCvr: pSbCvrB,
                rawSbRoas: cSbRoasB, rawPrevSbRoas: pSbRoasB,
                rawSbSpend: cSbSpendB, rawPrevSbSpend: pSbSpendB,

                rawSearchRoas: cSearchRoasB, rawPrevSearchRoas: pSearchRoasB,
                rawSearchSpend: cSearchSpendB, rawPrevSearchSpend: pSearchSpendB,

            };
        });

        // Placeholder delta
        const phDelta = { val: '0.0%', isPos: true };
        const phValue = 'Coming Soon';

        // -------------------------
        // BUILD E-COM TARGET TREE
        // -------------------------
        
        const isAmazon = (platform && platform.toLowerCase().includes('amazon'));
        const isFlipkart = (platform && platform.toLowerCase().includes('flipkart'));

        let adBreakdownNodes = [];
        if (isAmazon) {
            adBreakdownNodes = [
                {
                    id: "dsp",
                    label: "DSP",
                    value: phValue,
                    prevValue: phValue,
                    change: '0.0%',
                    isPositive: true,
                    category: "ad",
                    meta: [
                        { label: "Display GVs", value: phValue },
                        { label: "Conversion", value: phValue }
                    ]
                },
                {
                    id: "sponsored-search",
                    label: "Sponsored Search",
                    value: formatCount(cSpAdClicks + cSbClicks + cSdAdClicks),
                    prevValue: formatCount(pSpAdClicks + pSbClicks + pSdAdClicks),
                    change: pctDelta(cSpAdClicks + cSbClicks + cSdAdClicks, pSpAdClicks + pSbClicks + pSdAdClicks).val,
                    isPositive: pctDelta(cSpAdClicks + cSbClicks + cSdAdClicks, pSpAdClicks + pSbClicks + pSdAdClicks).isPos,
                    category: "ad",
                    metrics: allNodeMetrics,
                    meta: [
                        { label: "Search GVs", value: formatCount(cSpAdClicks + cSbClicks + cSdAdClicks), change: pctDelta(cSpAdClicks + cSbClicks + cSdAdClicks, pSpAdClicks + pSbClicks + pSdAdClicks).val, isPositive: pctDelta(cSpAdClicks + cSbClicks + cSdAdClicks, pSpAdClicks + pSbClicks + pSdAdClicks).isPos },
                        { label: "Conversion", value: `${cCvrAd.toFixed(2)}%`, change: cvrAdDelta.val, isPositive: cvrAdDelta.isPos },
                        { label: "ROAS", value: cSearchRoas.toFixed(2) },
                        { label: "SPEND", value: formatCount(cSearchAdSpend), change: searchSpendDelta.val, isPositive: searchSpendDelta.isPos }
                    ],
                    children: [
                        { id: "sp", label: "Sponsored Product", value: formatCount(cSpAdClicks), prevValue: formatCount(pSpAdClicks), change: pctDelta(cSpAdClicks, pSpAdClicks).val, isPositive: pctDelta(cSpAdClicks, pSpAdClicks).isPos, category: "ad", metrics: allNodeMetrics,
                          meta: [
                              { label: "SP GVs", value: formatCount(cSpAdClicks), change: pctDelta(cSpAdClicks, pSpAdClicks).val, isPositive: pctDelta(cSpAdClicks, pSpAdClicks).isPos },
                              { label: "Conversion", value: `${cSpCvr.toFixed(2)}%`, change: spCvrDelta.val, isPositive: spCvrDelta.isPos },
                              { label: "SP ROAS", value: cSpRoas.toFixed(2) },
                              { label: "SP SPEND", value: formatCount(cSpAdSpend), change: pctDelta(cSpAdSpend, pSpAdSpend).val, isPositive: pctDelta(cSpAdSpend, pSpAdSpend).isPos }
                          ]
                        },
                        { id: "sb", label: "Sponsored Brand", value: formatCount(cSbClicks), prevValue: formatCount(pSbClicks), change: sbDelta.val, isPositive: sbDelta.isPos, category: "ad", metrics: allNodeMetrics,
                          meta: [
                              { label: "SB All GVs", value: formatCount(cSbClicks), change: sbDelta.val, isPositive: sbDelta.isPos },
                              { label: "Conversion", value: `${cSbCvr.toFixed(2)}%`, change: sbCvrDelta.val, isPositive: sbCvrDelta.isPos },
                              { label: "SB ROAS", value: cSbRoas.toFixed(2) },
                              { label: "SB SPEND", value: formatCount(cSbSpend), change: pctDelta(cSbSpend, pSbSpend).val, isPositive: pctDelta(cSbSpend, pSbSpend).isPos }
                          ]
                        },
                        { id: "sd", label: "Sponsored Display", value: formatCount(cSdAdClicks), prevValue: formatCount(pSdAdClicks), change: pctDelta(cSdAdClicks, pSdAdClicks).val, isPositive: pctDelta(cSdAdClicks, pSdAdClicks).isPos, category: "ad", metrics: allNodeMetrics,
                          meta: [
                              { label: "SD GVs", value: formatCount(cSdAdClicks), change: pctDelta(cSdAdClicks, pSdAdClicks).val, isPositive: pctDelta(cSdAdClicks, pSdAdClicks).isPos },
                              { label: "Conversion", value: `${cSdCvr.toFixed(2)}%`, change: sdCvrDelta.val, isPositive: sdCvrDelta.isPos },
                              { label: "SD ROAS", value: cSdRoas.toFixed(2) },
                              { label: "SD SPEND", value: formatCount(cSdAdSpend), change: pctDelta(cSdAdSpend, pSdAdSpend).val, isPositive: pctDelta(cSdAdSpend, pSdAdSpend).isPos }
                          ]
                        }
                    ]
                }
            ];
        } else if (isFlipkart) {
            adBreakdownNodes = [
                { id: "pla", label: "PLA", value: phValue, prevValue: phValue, change: "--", isPositive: true, category: "ad" },
                { id: "pca", label: "PCA", value: phValue, prevValue: phValue, change: "--", isPositive: true, category: "ad" },
                { id: "display-ads", label: "Display Ads", value: phValue, prevValue: phValue, change: "--", isPositive: true, category: "ad" }
            ];
        }

        const tree = {
            id: "root",
            label: "Offtake",
            value: formatLac(cSales),
            prevValue: formatLac(pSales),
            change: salesDelta.val,
            isPositive: salesDelta.isPos,
            importance: "outcome",
            category: "offtake",
            insight: salesDelta.isPos ? "Volume Growth" : "Critical Decline",
            metrics: allNodeMetrics,
            children: [
                {
                    id: "gvs",
                    label: isAmazon ? "GVs" : "Impressions",
                    value: formatCount(cTotalGvs),
                    prevValue: formatCount(pTotalGvs),
                    change: gvDelta.val,
                    isPositive: gvDelta.isPos,
                    category: "impressions",
                    importance: "primary",
                    metrics: allNodeMetrics,
                    meta: [
                        { label: "Total GVs", value: formatCount(cTotalGvs), change: gvDelta.val, isPositive: gvDelta.isPos },
                        { label: "Conversion", value: `${cCvr.toFixed(2)}%`, change: cvrDelta.val, isPositive: cvrDelta.isPos },
                        { label: "ROAS", value: cSearchRoas.toFixed(2) },
                        { label: "SPEND", value: formatCount(cSearchAdSpend), change: searchSpendDelta.val, isPositive: searchSpendDelta.isPos }
                    ],
                    children: [
                        {
                            id: "organic-gvs",
                            label: `Organic ${isAmazon ? 'GVs' : 'Impressions'}`,
                            value: formatCount(cImpOrg),
                            prevValue: formatCount(pImpOrg),
                            change: orgGvDelta.val,
                            isPositive: orgGvDelta.isPos,
                            category: "organic",
                            metrics: allNodeMetrics,
                            meta: [
                                { label: `Organic ${isAmazon ? 'GVs' : 'Impressions'}`, value: formatCount(cImpOrg), change: orgGvDelta.val, isPositive: orgGvDelta.isPos },
                                { label: `Organic ${isAmazon ? 'GV' : 'Impression'}%`, value: `${cTotalGvs > 0 ? ((cImpOrg / cTotalGvs) * 100).toFixed(2) : '0.00'}%`, change: pctDelta(cTotalGvs > 0 ? (cImpOrg / cTotalGvs) * 100 : 0, pTotalGvs > 0 ? (pImpOrg / pTotalGvs) * 100 : 0).val, isPositive: pctDelta(cTotalGvs > 0 ? (cImpOrg / cTotalGvs) * 100 : 0, pTotalGvs > 0 ? (pImpOrg / pTotalGvs) * 100 : 0).isPos },
                                { label: "Organic CVR", value: `${cCvrOrg.toFixed(2)}%`, change: cvrOrgDelta.val, isPositive: cvrOrgDelta.isPos }
                            ]
                        },
                        {
                            id: `ad-${isAmazon ? 'gvs' : 'impressions'}`,
                            label: `Ad ${isAmazon ? 'GVs' : 'Impressions'}`,
                            value: formatCount(isAmazon ? (cSpAdClicks + cSbClicks + cSdAdClicks) : (cSpClicks + cSbClicks)),
                            prevValue: formatCount(isAmazon ? (pSpAdClicks + pSbClicks + pSdAdClicks) : (pSpClicks + pSbClicks)),
                            change: pctDelta(isAmazon ? (cSpAdClicks + cSbClicks + cSdAdClicks) : (cSpClicks + cSbClicks), isAmazon ? (pSpAdClicks + pSbClicks + pSdAdClicks) : (pSpClicks + pSbClicks)).val,
                            isPositive: pctDelta(isAmazon ? (cSpAdClicks + cSbClicks + cSdAdClicks) : (cSpClicks + cSbClicks), isAmazon ? (pSpAdClicks + pSbClicks + pSdAdClicks) : (pSpClicks + pSbClicks)).isPos,
                            category: "ad",
                            metrics: allNodeMetrics,
                            meta: [
                                { label: "Ad GVs", value: formatCount(isAmazon ? (cSpAdClicks + cSbClicks + cSdAdClicks) : (cSpClicks + cSbClicks)), change: pctDelta(isAmazon ? (cSpAdClicks + cSbClicks + cSdAdClicks) : (cSpClicks + cSbClicks), isAmazon ? (pSpAdClicks + pSbClicks + pSdAdClicks) : (pSpClicks + pSbClicks)).val, isPositive: pctDelta(isAmazon ? (cSpAdClicks + cSbClicks + cSdAdClicks) : (cSpClicks + cSbClicks), isAmazon ? (pSpAdClicks + pSbClicks + pSdAdClicks) : (pSpClicks + pSbClicks)).isPos },
                                { label: "Conversion", value: `${cCvrAd.toFixed(2)}%`, change: cvrAdDelta.val, isPositive: cvrAdDelta.isPos },
                                { label: "ROAS", value: cSearchRoas.toFixed(2) },
                                { label: "SPEND", value: formatCount(cSearchAdSpend), change: searchSpendDelta.val, isPositive: searchSpendDelta.isPos }
                            ],
                            children: adBreakdownNodes
                        },
                        {
                            id: "sov-overall",
                            label: "Share of Search Overall",
                            value: `${cSos.toFixed(1)}% `,
                            prevValue: `${pSos.toFixed(1)}% `,
                            change: sosDelta.val,
                            isPositive: sosDelta.isPos,
                            category: "visibility",
                            metrics: allNodeMetrics
                        }
                    ]
                },
                {
                    id: "cvr",
                    label: "CVR",
                    value: `${cCvr.toFixed(2)}% `,
                    prevValue: `${pCvr.toFixed(2)}% `,
                    change: cvrDelta.val,
                    isPositive: cvrDelta.isPos,
                    category: "conversion",
                    importance: "primary",
                    metrics: allNodeMetrics,
                    children: [
                        {
                            id: "availability",
                            label: "Availability",
                            value: `${cOsa.toFixed(1)}% `,
                            prevValue: `${pOsa.toFixed(1)}% `,
                            change: osaDelta.val,
                            isPositive: osaDelta.isPos,
                            category: "availability",
                            metrics: allNodeMetrics,
                            children: [
                                { id: "buybox", label: "BuyBox%", value: phValue, prevValue: phValue, change: '0.0%', isPositive: true, category: "availability" },
                                { id: "seller-listing", label: "Seller Listing%", value: phValue, prevValue: phValue, change: '0.0%', isPositive: true, category: "availability" }
                            ]
                        },
                        {
                            id: "delivery-time",
                            label: "Delivery Time",
                            value: hasDeliveryData ? cAvgDelivTime : "Coming Soon",
                            prevValue: hasDeliveryData ? pAvgDelivTime : "Coming Soon",
                            change: hasDeliveryData ? absDelta(cAvgDelivDays, pAvgDelivDays).val : '0.0%',
                            isPositive: hasDeliveryData ? (cAvgDelivDays <= pAvgDelivDays) : true,
                            category: "segment",
                            children: isFlipkart ? [] : [
                                { id: "same-day", label: `Same Day ${isAmazon ? 'GVs' : 'Impressions'}%`, value: hasDeliveryData ? `${cSameDayPct.toFixed(2)}%` : "Coming Soon", prevValue: hasDeliveryData ? `${pSameDayPct.toFixed(2)}%` : "Coming Soon", change: hasDeliveryData ? absDelta(cSameDayPct, pSameDayPct).val : '0.0%', isPositive: hasDeliveryData ? absDelta(cSameDayPct, pSameDayPct).isPos : true, category: "segment" },
                                { id: "one-day", label: `1 Day ${isAmazon ? 'GVs' : 'Impressions'}%`, value: hasDeliveryData ? `${cOneDayPct.toFixed(2)}%` : "Coming Soon", prevValue: hasDeliveryData ? `${pOneDayPct.toFixed(2)}%` : "Coming Soon", change: hasDeliveryData ? absDelta(cOneDayPct, pOneDayPct).val : '0.0%', isPositive: hasDeliveryData ? absDelta(cOneDayPct, pOneDayPct).isPos : true, category: "segment" },
                                { id: "two-day", label: `2 Day ${isAmazon ? 'GVs' : 'Impressions'}%`, value: hasDeliveryData ? `${cTwoDayPct.toFixed(2)}%` : "Coming Soon", prevValue: hasDeliveryData ? `${pTwoDayPct.toFixed(2)}%` : "Coming Soon", change: hasDeliveryData ? absDelta(cTwoDayPct, pTwoDayPct).val : '0.0%', isPositive: hasDeliveryData ? absDelta(cTwoDayPct, pTwoDayPct).isPos : true, category: "segment" },
                                { id: "greater-two", label: `> 2 Days ${isAmazon ? 'GVs' : 'Impressions'}%`, value: hasDeliveryData ? `${cGtTwoDayPct.toFixed(2)}%` : "Coming Soon", prevValue: hasDeliveryData ? `${pGtTwoDayPct.toFixed(2)}%` : "Coming Soon", change: hasDeliveryData ? absDelta(cGtTwoDayPct, pGtTwoDayPct).val : '0.0%', isPositive: hasDeliveryData ? absDelta(cGtTwoDayPct, pGtTwoDayPct).isPos : true, category: "segment" }
                            ]
                        },
                        {
                            id: "discounting",
                            label: "Discounting%",
                            value: `${cDiscount.toFixed(1)}% `,
                            prevValue: `${pDiscount.toFixed(1)}% `,
                            change: discDelta.val,
                            isPositive: discDelta.isPos,
                            category: "discounting",
                            metrics: allNodeMetrics,
                            children: []
                        },
                        {
                            id: "organic-cvr",
                            label: "Organic CVR",
                            value: `${cCvrOrg.toFixed(2)}% `,
                            prevValue: `${pCvrOrg.toFixed(2)}% `,
                            change: cvrOrgDelta.val,
                            isPositive: cvrOrgDelta.isPos,
                            category: "conversion",
                            metrics: allNodeMetrics,
                            children: []
                        },
                        {
                            id: "inorganic-cvr",
                            label: "Inorganic CVR",
                            value: `${cCvrAd.toFixed(2)}% `,
                            prevValue: `${pCvrAd.toFixed(2)}% `,
                            change: cvrAdDelta.val,
                            isPositive: cvrAdDelta.isPos,
                            category: "conversion",
                            metrics: allNodeMetrics,
                            children: []
                        }
                    ]
                },
                {
                    id: "asp",
                    label: "ASP",
                    value: `₹ ${cAsp.toFixed(0)}`,
                    prevValue: `₹ ${pAsp.toFixed(0)}`,
                    change: aspDelta.val,
                    isPositive: aspDelta.isPos,
                    category: "price",
                    importance: "primary",
                    metrics: allNodeMetrics,
                    children: [
                        { id: "combo-sales", label: "Combo Sales%", value: phValue, prevValue: phValue, change: '0.0%', isPositive: true, category: "segment" },
                        { id: "large-sales", label: "Large Sales%", value: phValue, prevValue: phValue, change: '0.0%', isPositive: true, category: "segment" },
                        { id: "premium-sales", label: "Premium Sales%", value: phValue, prevValue: phValue, change: '0.0%', isPositive: true, category: "segment" }
                    ]
                },
                {
                    id: "sns",
                    label: "Subscribe & Save %",
                    value: "Coming Soon",
                    prevValue: "Coming Soon",
                    change: '0.0%',
                    isPositive: true,
                    category: "segment",
                    meta: [{ label: "SnS Sales%", value: "Coming Soon" }],
                    children: []
                }
            ]
        };

        const cards = [
            { title: "Estimated Offtake", value: formatLac(cSales), change: salesDelta.val, isPositive: salesDelta.isPos },
            { title: "Avg Selling Price", value: `₹ ${cAsp.toFixed(0)} `, change: aspDelta.val, isPositive: aspDelta.isPos },
            { title: "CVR", value: `${cCvr.toFixed(2)}% `, change: cvrDelta.val, isPositive: cvrDelta.isPos }
        ];

        return { cards, tree };
    } catch (error) {
        console.error('[getEcomRcaData] Error:', error);
        throw error;
    }
};

export default {
    getEcomRcaData
};
