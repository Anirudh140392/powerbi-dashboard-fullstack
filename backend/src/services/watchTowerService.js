import TbZeptoBrandSalesAnalytics from '../models/TbZeptoBrandSalesAnalytics.js';
import TbZeptoInventoryData from '../models/TbZeptoInventoryData.js';
import TbBlinkitSalesData from '../models/TbBlinkitSalesData.js';
import RbPdpOlap from '../models/RbPdpOlap.js';
import fs from 'fs';

import RbKw from '../models/RbKw.js';
import RbBrandMs from '../models/RbBrandMs.js';
import ZeptoMarketShare from '../models/ZeptoMarketShare.js'; // Keeping for reference if needed, but primary is now RbBrandMs
import RcaSkuDim from '../models/RcaSkuDim.js';
import RbPlatform from '../models/RbPlatform.js';
import { Op, Sequelize } from 'sequelize';
import sequelize from '../config/db.js';
import { queryClickHouse, getCurrentDbName, calculateConversion } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import weekOfYear from 'dayjs/plugin/weekOfYear.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import { getTableColumns, resolveColumn, columnExists } from '../utils/schemaHelper.js';
import { buildDynamicSkuUrl, getPricingSource, normalizeLocations, normalizeChannels, parseMultiSelectFilter, buildInClause } from './pricingAnalysisService.js';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);
dayjs.extend(customParseFormat);

// Helper to escape strings for ClickHouse
const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

// Redis cache helpers removed - all queries now hit ClickHouse directly

// Import Redis data layer for indexed platform data (data retrieval only, no caching)
import { ensurePlatformData, queryByFilters, aggregateMetrics, getPlatformStats, isPlatformDataLoaded, coalesceRequest, getBrandMonthlyData } from './redisDataService.js';
import { normalizeFilterArray as originalNormalizeFilterArray, getMarketShare, getMarketShareByMonth, getMarketShareByBrand, getMarketShareTimeSeries } from './marketShareHelper.js';

const normalizeFilterArray = (value) => {
    const arr = originalNormalizeFilterArray(value);
    if (arr.length > 0 && arr.every(v => v === '0' || v === '1')) {
        if (arr.includes('1') && !arr.includes('0')) {
            return ['1'];
        }
        return [];
    }
    return arr;
};

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

// Helper for delivery time calculation logic
const DELIVERY_TIME_SQL = (col, dateCol = 'DATE') => `
    CASE 
      WHEN ${col} IS NULL OR toString(${col}) = '' OR toString(${col}) = '0' THEN NULL
      ELSE
        CASE
          WHEN dateDiff('day', ${dateCol}, coalesce(parseDateTimeBestEffortOrNull(toString(${col})), parseDateTimeBestEffortOrNull(concat(toString(${col}), ' ', toString(toYear(${dateCol})))))) < 0 THEN 0
          WHEN dateDiff('day', ${dateCol}, coalesce(parseDateTimeBestEffortOrNull(toString(${col})), parseDateTimeBestEffortOrNull(concat(toString(${col}), ' ', toString(toYear(${dateCol})))))) > 30 THEN NULL
          ELSE dateDiff('day', ${dateCol}, coalesce(parseDateTimeBestEffortOrNull(toString(${col})), parseDateTimeBestEffortOrNull(concat(toString(${col}), ' ', toString(toYear(${dateCol}))))))
        END
    END
`;

// 🔹 Materialized View Fallback Logic
let aggTableExists = null;
const AGG_TABLE_NAME = 'watchtower_agg_daily';

async function getRcaSkuDimBrandColumn() {
    const cols = await getTableColumns('rca_sku_dim');
    if (columnExists(cols, 'brand_name')) return resolveColumn(cols, 'brand_name');
    return resolveColumn(cols, 'brand');
}

/**
 * Checks if the aggregated table exists in ClickHouse.
 * Results are cached in-memory for the lifetime of the process.
 */
async function getAggTableStatus() {
    if (aggTableExists !== null) return aggTableExists;
    try {
        const result = await queryClickHouse(`EXISTS TABLE ${AGG_TABLE_NAME}`);
        aggTableExists = result && result[0] && result[0].result === 1;
        if (aggTableExists) console.log(`🚀 [Watchtower] Using aggregated table: ${AGG_TABLE_NAME}`);
        else console.warn(`⚠️ [Watchtower] Aggregated table ${AGG_TABLE_NAME} not found. Falling back to rb_pdp_olap.`);
        return aggTableExists;
    } catch (err) {
        aggTableExists = false;
        return false;
    }
}

// =====================================================
// DYNAMIC COLUMN DISCOVERY SYSTEM
// Moved to ../utils/schemaHelper.js
// =====================================================

/**
 * Returns the appropriate SQL fields and table name based on data source availability.
 */
async function getWatchtowerSource(filters = {}) {
    const mslArr = normalizeFilterArray(filters.msl);
    const hasMslFilter = mslArr && mslArr.length > 0;
    const useAgg = hasMslFilter ? false : await getAggTableStatus();
    if (useAgg) {
        // Agg table has known, controlled column names — no dynamic resolution needed
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
                buyBoxNeno: r('total_buy_box_neno_osa'),
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
                sellingPriceRaw: r('selling_price'),
                product: r('product'),
                skuCode: r('sku_code'),
                quantitySold: r('total_qty'),
                discount: `if(${r('mrp')} > 0, (${r('mrp')} - ${r('selling_price')}) / ${r('mrp')} * 100, 0)`,
                listingPercent: r('avg_listing_percent'),
                channel: r('channel'),
                deliveryDays: columnExists(aggCols, 'delivery_days') ? r('delivery_days') : null,
                msl: null
            }
        };
    }

    // Raw table — discover actual column names dynamically
    const cols = await getTableColumns('rb_pdp_olap');
    const r = (name) => resolveColumn(cols, name);

    // Build safe column expressions with actual discovered names
    const salesCol = r('Sales');
    const adSpendCol = r('Ad_Spend');
    const adSalesCol = r('Ad_sales');  // ClickHouse is case-sensitive: Ad_sales not Ad_sales
    const adClicksCol = r('Ad_Clicks');
    const adImpressionsCol = r('Ad_Impressions');
    const nenoOsaCol = r('neno_osa');
    const denoOsaCol = r('deno_osa');
    const qtySoldCol = r('Qty_Sold');
    const adQtySoldCol = r('Ad_Quantity_sold');
    const mrpCol = r('MRP');
    const sellingPriceCol = r('Selling_Price');
    const listingPercentCol = r('listing_percent');
    const dateCol = r('DATE');
    const platformCol = r('Platform');
    const brandCol = r('Brand');
    const locationCol = r('Location');
    const compFlagCol = r('Comp_flag');
    const productCol = r('Product');
    const webPidCol = r('Web_Pid');

    const wrap = (col) => `ifNull(toFloat64OrZero(toString(${col})), 0)`;

    return {
        table: 'rb_pdp_olap',
        isAgg: false,
        f: {
            sales: wrap(salesCol),
            spend: wrap(adSpendCol),
            adSales: wrap(adSalesCol),
            clicks: wrap(adClicksCol),
            impressions: wrap(adImpressionsCol),
            organicImpressions: wrap(r('Organic_Impressions')),
            neno: wrap(nenoOsaCol),
            deno: wrap(denoOsaCol),
            buyBoxNeno: wrap(r('buy_box_neno_osa')),
            qty: wrap(qtySoldCol),
            orders: wrap(adQtySoldCol),
            mrpVal: wrap(mrpCol),
            actualSales: wrap(salesCol),
            date: dateCol,
            platform: platformCol,
            brand: brandCol,
            location: locationCol,
            category: PRODUCT_CATEGORY_SQL,
            compFlag: compFlagCol,
            compFlagMapping: compFlagCol,
            mrp: wrap(mrpCol),
            sellingPrice: wrap(sellingPriceCol),
            sellingPriceRaw: `toFloat64OrNull(toString(${sellingPriceCol}))`,
            product: productCol,
            skuCode: columnExists(cols, 'sap_code') ? r('sap_code') : webPidCol,
            webPid: webPidCol,
            quantitySold: qtySoldCol,
            discount: `if(${wrap(mrpCol)} > 0, (${wrap(mrpCol)} - ${wrap(sellingPriceCol)}) / ${wrap(mrpCol)} * 100, 0)`,
            listingPercent: `if(toFloat64OrZero(toString(listing_percent)) > 0, toFloat64OrZero(toString(listing_percent)), (${wrap(nenoOsaCol)} / NULLIF(${wrap(denoOsaCol)}, 0)) * 100)`,
            channel: columnExists(cols, 'channel') ? r('channel') : null,
            deliveryDays: columnExists(cols, 'delivery_date') ? DELIVERY_TIME_SQL(r('delivery_date'), dateCol) : null,
            msl: cols.rawColumns?.has('msl') ? 'msl' : r('MSL')
        }
    };
}

/**
 * Returns the appropriate SQL fields for Performance Marketing data (rb_pm_olap).
 * Discovers actual column names dynamically to handle case-sensitivity and schema variations.
 */
async function getPmSource() {
    const tableName = 'rb_pm_olap';
    const cols = await getTableColumns(tableName);
    const r = (name) => resolveColumn(cols, name);

    const wrap = (col) => `ifNull(toFloat64OrZero(toString(${col})), 0)`;

    return {
        table: tableName,
        f: {
            spend: wrap(r('ad_spend')),
            adSales: wrap(r('Ad_sales')),
            clicks: wrap(r('ad_click')),
            impressions: wrap(r('impressions')),
            orders: wrap(r('Ad_Quantity_sold')),
            platform: r('Platform'),
            brand: columnExists(cols, 'brand') ? r('brand') : "'Unknown'",
            category: columnExists(cols, 'category') ? r('category') : "'Unknown'",
            location: columnExists(cols, 'location_name') ? r('location_name') : (columnExists(cols, 'location') ? r('location') : "'Unknown'"),
            product: columnExists(cols, 'product') ? r('product') : "'Unknown'",
            skuCode: columnExists(cols, 'sku_code') ? r('sku_code') : "'Unknown'",
            date: r('DATE'),
            channel: columnExists(cols, 'channel') ? r('channel') : null
        }
    };
}



/**
 * Global utility to format large unit counts (Offtakes units, Inorg units)
 */
const formatUnits = (val) => {
    const v = parseFloat(val);
    if (isNaN(v)) return "0";
    if (v >= 10000000) return `${(v / 10000000).toFixed(2)} Cr`;
    if (v >= 100000) return `${(v / 100000).toFixed(2)} Lac`;
    if (v >= 1000) return `${(v / 1000).toFixed(2)} K`;
    return Math.round(v).toLocaleString('en-IN');
};

// =====================================================
// DATABASE-SCOPED IN-MEMORY CACHE
// Ensures data isolation between different dashboard profiles (Mars, Petcare, etc.)
// =====================================================
const dbScopedCaches = new Map(); // key: dbName, value: cache object

const getDbCache = () => {
    const dbName = getCurrentDbName();
    if (!dbScopedCaches.has(dbName)) {
        dbScopedCaches.set(dbName, {
            distinctValues: {
                platforms: { data: null, timestamp: 0 },
                brands: new Map(),
                categories: new Map(),
                locations: new Map(),
                ourBrands: { data: null, timestamp: 0 },
            },
            maxDate: { date: null, timestamp: 0, promise: null },
            validBrandNames: { data: null, timestamp: 0, promise: null }
        });
    }
    return dbScopedCaches.get(dbName);
};

const DISTINCT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached our brands list (Comp_flag=0) - Global module-level cache
 */
const getGlobalOurBrandsList = async () => {
    const cache = getDbCache().distinctValues.ourBrands;
    if (cache.data && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        return cache.data;
    }

    try {
        const src = await getWatchtowerSource();
        // ClickHouse query
        const query = `SELECT DISTINCT ${src.f.brand} as brand FROM ${src.table} WHERE toString(${src.f.compFlag}) = '0' AND ${src.f.brand} IS NOT NULL AND ${src.f.brand} != '' ORDER BY brand`;
        const results = await queryClickHouse(query);
        const result = results.map(b => b.brand).filter(b => b);
        getDbCache().distinctValues.ourBrands = { data: result, timestamp: Date.now() };
        console.log(`[${getCurrentDbName()}] Cached ${result.length} OUR brands (Comp_flag=0)`);
        return result;
    } catch (error) {
        console.error('Error fetching our brands list:', error);
        return [];
    }
};

// =====================================================
// DYNAMIC END DATE HELPER
// Gets the latest date available in the primary table
// =====================================================
const MAX_DATE_TTL = 5 * 60 * 1000; // 5 minutes

const extractChannel = (filters) => {
    if (!filters) return null;
    const rawChannel = filters['channel[]'] || filters.channel;
    if (!rawChannel) return null;
    const channelArr = normalizeFilterArray(rawChannel);
    return channelArr && channelArr.length > 0 ? (channelArr.length === 1 ? channelArr[0] : channelArr) : null;
};

/**
 * Helper to build platform condition based on channel selection
 * @param {string} platform - The selected platform (e.g. 'All', 'Blinkit')
 * @param {string} channel - The selected channel (e.g. 'Ecommerce', 'Modern Trades')
 * @returns {string|null} - The SQL condition for platform
 */
const buildPlatformChannelCond = (platform, channel, columnName = 'Platform', forceLower = false, channelColumn = null) => {
    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

    let conditions = [];

    if (platform && platform !== 'All') {
        const platforms = Array.isArray(platform) ? platform : (typeof platform === 'string' && platform.includes(',') ? platform.split(',') : [platform]);
        if (platforms.length === 1) {
            const pLower = escapeStr(platforms[0].trim().toLowerCase());
            conditions.push(`(lower(${columnName}) = '${pLower}' OR lower(${columnName}) LIKE '%${pLower}%')`);
        } else if (platforms.length > 1) {
            const condList = platforms.map(p => {
                const pLower = escapeStr(p.trim().toLowerCase());
                return `(lower(${columnName}) = '${pLower}' OR lower(${columnName}) LIKE '%${pLower}%')`;
            }).join(' OR ');
            conditions.push(`(${condList})`);
        }
    }

    if (channel && channel !== 'All') {
        const channels = Array.isArray(channel) ? channel : (typeof channel === 'string' && channel.includes(',') ? channel.split(',') : [channel]);
        if (channelColumn) {
            // Map frontend channel names to actual database channel column values
            // Frontend sends: 'Quick Commerce', 'E-commerce', 'Ecommerce', etc.
            // Database stores: 'quickcomm', 'ecommerce'
            const mapChannelToDbValue = (ch) => {
                const lower = ch.trim().toLowerCase();
                if (lower.includes('quick') || lower === 'quickcomm' || lower === 'qcomm') return 'quickcomm';
                if (['ecommerce', 'e-commerce', 'ecom'].includes(lower)) return 'ecommerce';
                return lower; // pass through any other value as-is
            };
            const mappedChannels = [...new Set(channels.map(mapChannelToDbValue))];
            const list = mappedChannels.map(c => `'${escapeStr(c)}'`).join(', ');
            conditions.push(`lower(${channelColumn}) IN (${list})`);
        } else if (!platform || platform === 'All') {
            // Fallback for tables without a channel column (only apply when explicit platform is NOT specified)
            const isEcom = channels.some(c => ['ecommerce', 'e-commerce', 'ecom'].includes(c.toLowerCase()));
            const isQuickComm = channels.some(c => c.toLowerCase().includes('quick'));
            const isEpharm = channels.some(c => c.toLowerCase().includes('epharm') || c.toLowerCase().includes('e-pharm') || c.toLowerCase().includes('pharm'));
            const isModernTrade = channels.some(c => ['modern trades', 'moderntrade'].includes(c.toLowerCase()));

            const ecomPlatforms = ['amazon', 'flipkart', 'bigbasket', 'jiomart', 'meesho', 'myntra', 'shopify', 'first cry'];
            const quickPlatforms = ['blinkit', 'zepto', 'instamart', 'swiggy instamart', 'swiggy', 'flipkart minutes', 'amazon now'];
            const epharmPlatforms = ['pharmeasy', 'apollo 247', 'apollo', '1_mg', '1mg', 'tata 1mg', 'netmeds', 'truemeds'];

            const activeLists = [];
            if (isQuickComm) activeLists.push(...quickPlatforms);
            if (isEcom) activeLists.push(...ecomPlatforms);
            if (isEpharm) activeLists.push(...epharmPlatforms);

            if (activeLists.length > 0) {
                const combinedPlatforms = [...new Set(activeLists)];
                conditions.push(`lower(${columnName}) IN (${combinedPlatforms.map(p => `'${p}'`).join(', ')})`);
            } else if (isModernTrade) {
                const allEcomQuickPharm = [...ecomPlatforms, ...quickPlatforms, ...epharmPlatforms];
                conditions.push(`lower(${columnName}) NOT IN (${allEcomQuickPharm.map(p => `'${p}'`).join(', ')})`);
            }
        }
    }

    return conditions.length > 0 ? conditions.join(' AND ') : null;
};


/**
 * Helper to build location condition dynamically based on platform
 * @param {string[]} locationArr - Array of selected locations/cities
 * @param {string|string[]} platformVal - Selected platform(s)
 * @param {string} locationCol - Location column name (e.g. 'Location', 'location_name')
 * @param {string} platformCol - Platform column name (e.g. 'Platform', 'platform_name')
 * @returns {string|null} - The SQL condition for location
 */
const buildLocationQueryCond = (locationArr, platformVal, locationCol = 'location', platformCol = 'platform') => {
    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';
    if (!locationArr || locationArr.length === 0) return null;

    let platforms = [];
    if (platformVal && platformVal !== 'All') {
        platforms = Array.isArray(platformVal)
            ? platformVal.map(p => p.toLowerCase())
            : (typeof platformVal === 'string' && platformVal.includes(',')
                ? platformVal.split(',').map(p => p.trim().toLowerCase())
                : [platformVal.toLowerCase()]);
    }

    const hasAmazon = platforms.includes('amazon');
    const hasFlipkart = platforms.includes('flipkart');
    const hasNational = hasAmazon || hasFlipkart;
    const isOnlyNational = platforms.length > 0 && platforms.every(p => ['amazon', 'flipkart'].includes(p));

    const nationalLocs = ["'nation'", "'national'"].join(', ');

    if (isOnlyNational) {
        return `lower(${locationCol}) IN (${nationalLocs})`;
    } else if (hasNational) {
        const localLocs = locationArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ');
        const nationalPlats = ['amazon', 'flipkart'].map(p => `'${p}'`).join(', ');
        return `((lower(${platformCol}) IN (${nationalPlats}) AND lower(${locationCol}) IN (${nationalLocs})) OR (lower(${platformCol}) NOT IN (${nationalPlats}) AND lower(${locationCol}) IN (${localLocs})))`;
    } else {
        const localLocs = locationArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ');
        return `lower(${locationCol}) IN (${localLocs})`;
    }
};




/**
 * Get the latest available date in rb_pdp_olap
 */
const getCachedMaxDate = async () => {
    const dbCache = getDbCache();
    if (dbCache.maxDate.date && (Date.now() - dbCache.maxDate.timestamp) < MAX_DATE_TTL) {
        return dbCache.maxDate.date;
    }

    if (dbCache.maxDate.promise) {
        return dbCache.maxDate.promise;
    }

    dbCache.maxDate.promise = (async () => {
        try {
            const src = await getWatchtowerSource();
            const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
            const result = await queryClickHouse(`SELECT MAX(${dateCol}) as maxDate FROM ${src.table}`);
            const maxDateStr = result?.[0]?.maxDate;
            const maxDate = maxDateStr ? dayjs(maxDateStr).endOf('day') : dayjs().endOf('day');

            dbCache.maxDate = { date: maxDate, timestamp: Date.now(), promise: null };
            console.log(`🎯 [MaxDate][${getCurrentDbName()}] Latest available date detected and cached: ${maxDate.format('YYYY-MM-DD')}`);
            return maxDate;
        } catch (error) {
            console.error('Error fetching max date:', error);
            return dayjs().endOf('day'); // Fallback to today
        } finally {
            dbCache.maxDate.promise = null;
        }
    })();

    return dbCache.maxDate.promise;
};


/**
 * Get cached valid brand names from RcaSkuDim (comp_flag=0)
 * Used across multiple functions to avoid redundant DB queries
 */
const getCachedValidBrandNames = async () => {
    const dbCache = getDbCache();
    if (dbCache.validBrandNames.data && (Date.now() - dbCache.validBrandNames.timestamp) < DISTINCT_CACHE_TTL) {
        return dbCache.validBrandNames.data;
    }

    if (dbCache.validBrandNames.promise) {
        return dbCache.validBrandNames.promise;
    }

    dbCache.validBrandNames.promise = (async () => {
        try {
            const brandCol = await getRcaSkuDimBrandColumn();
            // ClickHouse query
            const query = `SELECT DISTINCT ${brandCol} AS brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND ${brandCol} IS NOT NULL AND ${brandCol} != '' ORDER BY brand_name`;
            const results = await queryClickHouse(query);
            const result = results.map(b => b.brand_name).filter(Boolean);
            dbCache.validBrandNames = { data: result, timestamp: Date.now(), promise: null };
            console.log(`[ValidBrands][${getCurrentDbName()}] Cached ${result.length} valid brand names from RcaSkuDim`);
            return result;
        } catch (error) {
            console.error('Error fetching valid brand names:', error);
            return [];
        } finally {
            dbCache.validBrandNames.promise = null;
        }
    })();

    return dbCache.validBrandNames.promise;
};

// =====================================================
// MULTI-VALUE FILTER UTILITIES
// Handle single values, arrays, and "All" selections
// =====================================================

// normalizeFilterArray is now imported from marketShareHelper.js

/**
 * Shared helpers for KPI change calculations
 */
const calcChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};
const calcPPChange = (current, previous) => (parseFloat(current) || 0) - (parseFloat(previous) || 0);
const formatChange = (val, isPP = false) => {
    const suffix = isPP ? '%' : '%';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}${suffix}`;
};

/**
 * Shared Multi-unit currency formatter
 */
/**
 * scaleMarsMetrics - DISABLED
 * Previously scaled Mars-related entries by 0.01, but the source data is NOT inflated.
 * User-verified: SQL query `SELECT SUM(Sales) FROM rb_pdp_olap WHERE Product_Category='GMFC'`
 * returns correct values (e.g., 7,642,409 = ₹76.42 Lac) without any scaling needed.
 * Keeping the function signature as a no-op so all callers continue to work.
 */
const scaleMarsMetrics = (row, key) => {
    return row;
};

const formatCurrency = (value) => {
    const val = parseFloat(value);
    if (isNaN(val)) return "₹0";
    if (val < 0.01 && val > -0.01) return "₹0";
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lac`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
    return `₹${val.toFixed(2)}`;
};

/**
 * Fetch Conversion KPI from rb_pm_olap
 * Conversion = (SUM(ad_quantity_sold) / SUM(clicks)) * 100
 */
const getPmConversion = async (start, end, platformFilter, locationFilter, categoryFilter, brandFilter, channel) => {
    try {
        const pmSrc = await getPmSource();
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';
        const conds = [`${pmSrc.f.date} BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`];

        const platArr = normalizeFilterArray(platformFilter);
        if (platArr && platArr.length > 0) {
            const pCond = buildPlatformChannelCond(platArr, channel, `lower(${pmSrc.f.platform})`, true);
            if (pCond) conds.push(pCond);
        } else {
            const pCond = buildPlatformChannelCond(null, channel, `lower(${pmSrc.f.platform})`, true);
            if (pCond) conds.push(pCond);
        }

        const locArr = normalizeFilterArray(locationFilter);
        if (pmSrc.f.location && pmSrc.f.location !== "'Unknown'" && locArr && locArr.length > 0) {
            conds.push(`lower(${pmSrc.f.location}) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
        }

        const catArr = normalizeFilterArray(categoryFilter);
        if (catArr && catArr.length > 0) {
            conds.push(`lower(${pmSrc.f.category}) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
        }

        const brandArr = normalizeFilterArray(brandFilter);
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            conds.push(`lower(${pmSrc.f.brand}) IN (${brandArr.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ')})`);
        }

        const sql = `
            SELECT 
                SUM(${pmSrc.f.orders}) as orders,
                SUM(${pmSrc.f.impressions}) as impressions,
                SUM(${pmSrc.f.clicks}) as clicks
            FROM ${pmSrc.table}
            WHERE ${conds.join(' AND ')}
        `;

        const result = await queryClickHouse(sql);
        const orders = parseFloat(result[0]?.orders || 0);
        const impressions = parseFloat(result[0]?.impressions || 0);
        const clicks = parseFloat(result[0]?.clicks || 0);

        return calculateConversion(orders, impressions, clicks);
    } catch (err) {
        console.error("Error fetching PM Conversion:", err);
        return 0;
    }
};

/**
 * Fetch Bulk Conversion KPI from rb_pm_olap grouped by a specific field
 */
const getPmConversionBulk = async (start, end, platformFilter, locationFilter, categoryFilter, brandFilter, channel, groupByField = 'Platform') => {
    try {
        const pmSrc = await getPmSource();
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';
        const conds = [`${pmSrc.f.date} BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`];

        // Resolve groupByField if possible
        let resolvedGroupBy = groupByField;
        if (groupByField.toLowerCase() === 'platform') resolvedGroupBy = pmSrc.f.platform;
        else if (groupByField.toLowerCase() === 'brand') resolvedGroupBy = pmSrc.f.brand;
        else if (groupByField.toLowerCase() === 'category') resolvedGroupBy = pmSrc.f.category;
        else if (groupByField.toLowerCase() === 'location_name') resolvedGroupBy = pmSrc.f.location;

        const platArr = normalizeFilterArray(platformFilter);
        if (platArr && platArr.length > 0) {
            const pCond = buildPlatformChannelCond(platArr, channel, `lower(${pmSrc.f.platform})`, true);
            if (pCond) conds.push(pCond);
        } else {
            const pCond = buildPlatformChannelCond(null, channel, `lower(${pmSrc.f.platform})`, true);
            if (pCond) conds.push(pCond);
        }

        const locArr = normalizeFilterArray(locationFilter);
        if (pmSrc.f.location && pmSrc.f.location !== "'Unknown'" && locArr && locArr.length > 0) {
            conds.push(`lower(${pmSrc.f.location}) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
        }

        const catArr = normalizeFilterArray(categoryFilter);
        if (catArr && catArr.length > 0) {
            conds.push(`lower(${pmSrc.f.category}) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
        }

        const brandArr = normalizeFilterArray(brandFilter);
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            conds.push(`lower(${pmSrc.f.brand}) IN (${brandArr.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ')})`);
        }

        const sql = `
            SELECT 
                ${resolvedGroupBy} as group_key,
                SUM(${pmSrc.f.orders}) as orders,
                SUM(${pmSrc.f.impressions}) as impressions,
                SUM(${pmSrc.f.clicks}) as clicks
            FROM ${pmSrc.table}
            WHERE ${conds.join(' AND ')}
            GROUP BY ${resolvedGroupBy}
        `;

        const result = await queryClickHouse(sql);
        const map = new Map();
        result.forEach(row => {
            const orders = parseFloat(row.orders || 0);
            const impressions = parseFloat(row.impressions || 0);
            const clicks = parseFloat(row.clicks || 0);
            const conv = calculateConversion(orders, impressions, clicks);
            map.set(row.group_key, conv);
        });
        return map;
    } catch (err) {
        console.error("Error fetching Bulk PM Conversion:", err);
        return new Map();
    }
};

/**
 * Shared KPI column generator with change calculations
 */
const generateKpiColumns = ({
    offtake, availability, sos, marketShare, spend, roas, inorgSales, conversion, cpm, cpc, asp, aov = 0, promoMyBrand = 0, promoCompete = 0, categorySize, adSov = 0, organicSov = 0, buyBoxPct = 0, deliveryTime = null, tacos = null, wtOsa = null, wtDiscount = null, listingPercent = null,
    prevOfftake = 0, prevAvailability = 0, prevSos = 0, prevMarketShare = 0, prevSpend = 0, prevRoas = 0, prevInorgSales = 0, prevConversion = 0, prevCpm = 0, prevCpc = 0, prevAsp = 0, prevAov = 0, prevPromoMyBrand = 0, prevPromoCompete = 0, prevCategorySize = 0, prevAdSov = 0, prevOrganicSov = 0, prevBuyBoxPct = 0, prevDeliveryTime = null, prevTacos = null, prevWtOsa = null, prevWtDiscount = null, prevListingPercent = null,
    offtakeUnits = 0, inorgUnits = 0, prevOfftakeUnits = 0, prevInorgUnits = 0
}) => {
    const isNA = (val) => val === null || val === undefined || val === 0 || val === "0";

    const safeChange = (curr, prev, calcFn) => (isNA(curr) || isNA(prev)) ? null : calcFn(curr, prev);

    // Compute TACoS = sum(Ad spend) / sum(Sales) * 100
    // Ad spend comes from rb_pm_olap (spend), Sales comes from rb_pdp_olap (offtake)
    const computedTacos = (tacos !== null && tacos !== undefined)
        ? tacos
        : ((spend !== null && spend !== undefined && offtake !== null && offtake !== undefined && parseFloat(offtake) > 0)
            ? (parseFloat(spend) / parseFloat(offtake)) * 100
            : null);

    const computedPrevTacos = (prevTacos !== null && prevTacos !== undefined)
        ? prevTacos
        : ((prevSpend !== null && prevSpend !== undefined && prevOfftake !== null && prevOfftake !== undefined && parseFloat(prevOfftake) > 0)
            ? (parseFloat(prevSpend) / parseFloat(prevOfftake)) * 100
            : null);

    const offtakeChange = safeChange(offtake, prevOfftake, calcChange);
    const quantitySoldChange = safeChange(offtakeUnits, prevOfftakeUnits, calcChange);
    const spendChange = safeChange(spend, prevSpend, calcChange);
    const tacosChange = safeChange(computedTacos, computedPrevTacos, calcPPChange);
    const roasChange = safeChange(roas, prevRoas, calcChange);
    const inorgSalesChange = safeChange(inorgSales, prevInorgSales, calcChange);
    const conversionChange = safeChange(conversion, prevConversion, calcPPChange);
    const availabilityChange = safeChange(availability, prevAvailability, calcPPChange);
    const sosChange = safeChange(sos, prevSos, calcPPChange);
    const marketShareChange = safeChange(marketShare, prevMarketShare, calcPPChange);
    const promoMyBrandChange = safeChange(promoMyBrand, prevPromoMyBrand, calcPPChange);
    const promoCompeteChange = safeChange(promoCompete, prevPromoCompete, calcPPChange);
    const wtDiscountChange = safeChange(wtDiscount, prevWtDiscount, calcPPChange);
    const cpmChange = safeChange(cpm, prevCpm, calcChange);
    const cpcChange = safeChange(cpc, prevCpc, calcChange);
    const aspChange = safeChange(asp, prevAsp, calcChange);
    const categorySizeChange = safeChange(categorySize, prevCategorySize, calcChange);
    const adSovChange = safeChange(adSov, prevAdSov, calcPPChange);
    const organicSovChange = safeChange(organicSov, prevOrganicSov, calcPPChange);
    const buyBoxPctChange = safeChange(buyBoxPct, prevBuyBoxPct, calcPPChange);
    const deliveryTimeChange = safeChange(deliveryTime, prevDeliveryTime, calcChange);
    const aovChange = safeChange(aov, prevAov, calcChange);
    const wtOsaChange = safeChange(wtOsa, prevWtOsa, calcPPChange);
    const listingPercentChange = safeChange(listingPercent, prevListingPercent, calcPPChange);

    const fmtCurr = (v) => isNA(v) ? "N/A" : formatCurrency(v);
    const fmtPct = (v) => isNA(v) ? "N/A" : `${(parseFloat(v) || 0).toFixed(2)}%`;
    const fmtX = (v) => isNA(v) ? "N/A" : `${(parseFloat(v) || 0).toFixed(2)}x`;
    const fmtRs = (v) => isNA(v) ? "N/A" : `₹${(parseFloat(v) || 0).toFixed(2)}`;
    const fmtChg = (v, isPP = false) => isNA(v) ? "N/A" : formatChange(v, isPP);
    const fmtUnits = (v) => isNA(v) ? "N/A" : formatUnits(v);
    const fmtDays = (v) => {
        if (isNA(v) || isNaN(v)) return "N/A";
        const rounded = Math.round(v);
        if (rounded <= 0) return "Same Day";
        if (rounded === 1) return "1 Day";
        return `${rounded} Days`;
    };

    return [
        { title: "Offtakes", value: fmtCurr(offtake), change: { text: fmtChg(offtakeChange), positive: offtakeChange >= 0 }, meta: { units: `${formatUnits(offtakeUnits)} units`, change: fmtChg(offtakeChange) }, rawVal: offtake },
        { title: "Quantity Sold", value: fmtUnits(offtakeUnits), change: { text: fmtChg(quantitySoldChange), positive: quantitySoldChange >= 0 }, meta: { units: "units", change: fmtChg(quantitySoldChange) }, rawVal: offtakeUnits },
        { title: "Category Size", value: fmtCurr(categorySize), change: { text: fmtChg(categorySizeChange), positive: categorySizeChange >= 0 }, meta: { units: "market", change: fmtChg(categorySizeChange) } },
        { title: "Spend", value: fmtCurr(spend), change: { text: fmtChg(spendChange), positive: spendChange >= 0 }, meta: { units: "spend", change: fmtChg(spendChange) } },
        { title: "TACoS", value: fmtPct(computedTacos), change: { text: fmtChg(tacosChange, true), positive: tacosChange <= 0 }, meta: { units: "Spend / Sales", change: fmtChg(tacosChange, true) } },
        { title: "ROAS", value: fmtX(roas), change: { text: fmtChg(roasChange), positive: roasChange >= 0 }, meta: { units: "return", change: fmtChg(roasChange) } },
        { title: "Inorg Sales", value: fmtCurr(inorgSales), change: { text: fmtChg(inorgSalesChange), positive: inorgSalesChange >= 0 }, meta: { units: `${formatUnits(inorgUnits)} units`, change: fmtChg(inorgSalesChange) } },
        { title: "Conversion", value: fmtPct(conversion), change: { text: fmtChg(conversionChange, true), positive: conversionChange >= 0 }, meta: { units: "Orders / Clicks", change: fmtChg(conversionChange, true) } },
        { title: "Availability", value: fmtPct(availability), change: { text: fmtChg(availabilityChange, true), positive: availabilityChange >= 0 }, meta: { units: "stores", change: fmtChg(availabilityChange, true) } },
        { title: "Wt OSA", value: fmtPct(wtOsa), change: { text: fmtChg(wtOsaChange, true), positive: wtOsaChange >= 0 }, meta: { units: "OSA × Listing %", change: fmtChg(wtOsaChange, true) } },
        { title: "Listing %", value: fmtPct(listingPercent), change: { text: fmtChg(listingPercentChange, true), positive: listingPercentChange >= 0 }, meta: { units: "Calculated", change: fmtChg(listingPercentChange, true) } },
        { title: "Share of Search", value: fmtPct(sos), change: { text: fmtChg(sosChange, true), positive: sosChange >= 0 }, meta: { units: "index", change: fmtChg(sosChange, true) } },
        { title: "Ad SOV", value: fmtPct(adSov), change: { text: fmtChg(adSovChange, true), positive: adSovChange >= 0 }, meta: { units: "sponsored", change: fmtChg(adSovChange, true) } },
        { title: "Organic SOV", value: fmtPct(organicSov), change: { text: fmtChg(organicSovChange, true), positive: organicSovChange >= 0 }, meta: { units: "organic", change: fmtChg(organicSovChange, true) } },
        { title: "Market Share", value: fmtPct(marketShare), change: { text: fmtChg(marketShareChange, true), positive: marketShareChange >= 0 }, meta: { units: "Category", change: fmtChg(marketShareChange, true) } },
        { title: "Buy Box %", value: fmtPct(buyBoxPct), change: { text: fmtChg(buyBoxPctChange, true), positive: buyBoxPctChange >= 0 }, meta: { units: "Calculated", change: fmtChg(buyBoxPctChange, true) } },
        { title: "Delivery Time", value: fmtDays(deliveryTime), change: { text: fmtChg(deliveryTimeChange), positive: deliveryTimeChange <= 0 }, meta: { units: "Calculated", change: fmtChg(deliveryTimeChange) } },
        { title: "Promo-My", value: fmtPct(promoMyBrand), change: { text: fmtChg(promoMyBrandChange, true), positive: promoMyBrandChange >= 0 }, meta: { units: "Depth", change: fmtChg(promoMyBrandChange, true) } },
        { title: "Promo Compete", value: fmtPct(promoCompete), change: { text: fmtChg(promoCompeteChange, true), positive: promoCompeteChange >= 0 }, meta: { units: "Depth", change: fmtChg(promoCompeteChange, true) } },
        { title: "Wt Discount", value: fmtPct(wtDiscount), change: { text: fmtChg(wtDiscountChange, true), positive: wtDiscountChange >= 0 }, meta: { units: "Weighted by Sales", change: fmtChg(wtDiscountChange, true) } },
        { title: "CPM", value: fmtRs(cpm), change: { text: fmtChg(cpmChange), positive: cpmChange >= 0 }, meta: { units: "impressions", change: fmtChg(cpmChange) } },
        { title: "CPC", value: fmtRs(cpc), change: { text: fmtChg(cpcChange), positive: cpcChange >= 0 }, meta: { units: "clicks", change: fmtChg(cpcChange) } },
        { title: "ASP", value: fmtRs(asp), change: { text: fmtChg(aspChange), positive: aspChange >= 0 }, meta: { units: "Weighted", change: fmtChg(aspChange) } },
        { title: "AOV", value: fmtRs(aov), change: { text: fmtChg(aovChange), positive: aovChange >= 0 }, meta: { units: "Order Value", change: fmtChg(aovChange) } }
    ];
};

/**
 * Build a where condition for a field with multi-value support
 * @param {string[]|null} values - Normalized array of values
 * @returns {object|null} - Sequelize where condition or null
 */
const buildMultiValueCondition = (values) => {
    if (!values || values.length === 0) return null;
    return values.length === 1 ? values[0] : { [Op.in]: values };
};

/**
 * Build a LIKE condition for Brand field with multi-value support
 * @param {string[]|null} values - Normalized array of values  
 * @returns {object|null} - Sequelize where condition with LIKE
 */
const buildBrandLikeCondition = (values) => {
    if (!values || values.length === 0) return null;
    if (values.length === 1) {
        return { [Op.like]: `%${values[0]}%` };
    }
    // Multiple brands: use OR with LIKE for each
    return { [Op.or]: values.map(v => ({ [Op.like]: `%${v}%` })) };
};

/**
 * Get cached distinct platforms or fetch from DB
 */
const getCachedDistinctPlatforms = async () => {
    const cache = getDbCache().distinctValues.platforms;
    if (cache.data && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        console.log(`⚡ [Cache Hit][${getCurrentDbName()}] Distinct platforms from memory`);
        return cache.data;
    }
    return null; // Cache miss
};

/**
 * Cache distinct platforms
 */
const cacheDistinctPlatforms = (data) => {
    getDbCache().distinctValues.platforms = { data, timestamp: Date.now() };
    console.log(`📦 [Cache Set][${getCurrentDbName()}] Distinct platforms (${data.length} items)`);
};

/**
 * Get cached distinct brands for a platform
 */
const getCachedDistinctBrands = (platform) => {
    const key = (platform || 'all').toLowerCase();
    const cache = getDbCache().distinctValues.brands.get(key);
    if (cache && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        console.log(`⚡ [Cache Hit][${getCurrentDbName()}] Distinct brands for ${platform}`);
        return cache.data;
    }
    return null;
};

/**
 * Cache distinct brands for a platform
 */
const cacheDistinctBrands = (platform, data) => {
    const key = (platform || 'all').toLowerCase();
    getDbCache().distinctValues.brands.set(key, { data, timestamp: Date.now() });
    console.log(`📦 [Cache Set][${getCurrentDbName()}] Distinct brands for ${platform} (${data.length} items)`);
};

/**
 * Get cached distinct categories for a platform
 */
const getCachedDistinctCategories = (platform) => {
    const key = (platform || 'all').toLowerCase();
    const cache = getDbCache().distinctValues.categories.get(key);
    if (cache && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        console.log(`⚡ [Cache Hit][${getCurrentDbName()}] Distinct categories for ${platform}`);
        return cache.data;
    }
    return null;
};

/**
 * Cache distinct categories for a platform
 */
const cacheDistinctCategories = (platform, data) => {
    const key = (platform || 'all').toLowerCase();
    getDbCache().distinctValues.categories.set(key, { data, timestamp: Date.now() });
    console.log(`📦 [Cache Set][${getCurrentDbName()}] Distinct categories for ${platform} (${data.length} items)`);
};

/**
 * Get cached distinct locations for a platform
 */
const getCachedDistinctLocations = (platform) => {
    const key = (platform || 'all').toLowerCase();
    const cache = getDbCache().distinctValues.locations.get(key);
    if (cache && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        console.log(`⚡ [Cache Hit][${getCurrentDbName()}] Distinct locations for ${platform}`);
        return cache.data;
    }
    return null;
};

/**
 * Cache distinct locations for a platform
 */
const cacheDistinctLocations = (platform, data) => {
    const key = (platform || 'all').toLowerCase();
    getDbCache().distinctValues.locations.set(key, { data, timestamp: Date.now() });
    console.log(`📦 [Cache Set][${getCurrentDbName()}] Distinct locations for ${platform} (${data.length} items)`);
};

/**
 * Redis-First Query Helper
 * Checks Redis for cached data first, returns null if not available (caller should fallback to DB)
 * 
 * @param {string} platform - Platform name (e.g., 'Zepto', 'Blinkit')
 * @param {Object} filters - {brand, location, startDate, endDate, category}
 * @returns {Object} - { source: 'redis'|'db', rows: Array|null }
 */
const getRowsFromRedisOrDb = async (platform, filters = {}) => {
    // Only try Redis for specific platforms (not 'All')
    if (platform && platform !== 'All') {
        try {
            const isLoaded = await isPlatformDataLoaded(platform);
            if (isLoaded) {
                const rows = await queryByFilters(platform, filters);
                if (rows && rows.length >= 0) {
                    console.log(`📊 [Redis Hit] ${platform}: ${rows.length} rows from cache`);
                    return { source: 'redis', rows };
                }
            }
        } catch (error) {
            console.warn(`⚠️ Redis query failed, falling back to DB:`, error.message);
        }
    }

    // Return null rows to signal caller should use DB
    console.log(`📊 [DB Fallback] ${platform || 'All'}: Using database query`);
    return { source: 'db', rows: null };
};

/**
 * Aggregate Redis rows in-memory (replacement for Sequelize SUM/AVG)
 * @param {Array} rows - Array of row objects from Redis
 * @param {string} column - Column name to aggregate
 * @param {string} operation - 'sum', 'avg', 'count'
 * @returns {number} - Aggregated value
 */
const aggregateFromRows = (rows, column, operation = 'sum') => {
    if (!rows || rows.length === 0) return 0;

    const values = rows
        .map(row => parseFloat(row[column]) || 0)
        .filter(v => !isNaN(v));

    switch (operation) {
        case 'sum':
            return values.reduce((acc, val) => acc + val, 0);
        case 'avg':
            return values.length > 0 ? values.reduce((acc, val) => acc + val, 0) / values.length : 0;
        case 'count':
            return values.length;
        default:
            return 0;
    }
};

// Internal implementation with all the compute logic
const computeSummaryMetrics = async (filters, options = {}) => {
    const { onlyOverview = false, skipPerformanceKpis = false } = options;

    try {
        console.log("Processing Watch Tower request with filters:", filters);
        const pmSrc = await getPmSource();

        const { months = 1, startDate: qStartDate, endDate: qEndDate, compareStartDate: qCompareStartDate, compareEndDate: qCompareEndDate } = filters;
        const channel = extractChannel(filters);

        // Extract filter values - frontend may send as 'brand' or 'brand[]' (array format)
        const rawBrand = filters['brand[]'] || filters.brand;
        const rawLocation = filters['location[]'] || filters.location;
        const rawPlatform = filters['platform[]'] || filters.platform;
        const rawCategory = filters['category[]'] || filters.category;
        const rawSkuName = filters['skuName[]'] || filters.skuName;
        const rawSkuCode = filters['skuCode[]'] || filters.skuCode || filters['sapCode[]'] || filters.sapCode;

        // Normalize multi-value filters
        const platformArr = normalizeFilterArray(rawPlatform);
        const brandArr = normalizeFilterArray(rawBrand);
        const locationArr = normalizeFilterArray(rawLocation);
        const categoryArr = normalizeFilterArray(rawCategory);
        const skuNameArr = normalizeFilterArray(rawSkuName);
        const skuCodeArr = normalizeFilterArray(rawSkuCode);

        // For backward compatibility, keep single/normalized values for string comparisons or passed to sub-functions
        const brand = brandArr ? (brandArr.length === 1 ? brandArr[0] : brandArr) : null;
        const location = locationArr ? (locationArr.length === 1 ? locationArr[0] : locationArr) : null;
        const platform = platformArr ? (platformArr.length === 1 ? platformArr[0] : platformArr) : null;
        const category = categoryArr ? (categoryArr.length === 1 ? categoryArr[0] : categoryArr) : null;
        const skuName = skuNameArr ? (skuNameArr.length === 1 ? skuNameArr[0] : skuNameArr) : null;
        const skuCode = skuCodeArr ? (skuCodeArr.length === 1 ? skuCodeArr[0] : skuCodeArr) : null;

        const monthsBack = parseInt(months, 10) || 1;

        // Calculate date range
        let endDate = await getCachedMaxDate();
        let startDate = endDate.subtract(monthsBack, 'month').startOf('day');

        if (qStartDate && qEndDate) {
            startDate = dayjs(qStartDate, ['YYYY-MM-DD', 'DD-MM-YYYY']).startOf('day');
            endDate = dayjs(qEndDate, ['YYYY-MM-DD', 'DD-MM-YYYY']).endOf('day');
        }

        // Calculate MoM (Previous Period) Date Range
        let momStartDate = startDate.clone().subtract(1, 'month');
        let momEndDate = endDate.clone().subtract(1, 'month');
        if (qCompareStartDate && qCompareEndDate) {
            momStartDate = dayjs(qCompareStartDate, ['YYYY-MM-DD', 'DD-MM-YYYY']).startOf('day');
            momEndDate = dayjs(qCompareEndDate, ['YYYY-MM-DD', 'DD-MM-YYYY']).endOf('day');
        }

        console.log(`Date Range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);
        console.log(`Compare Range: ${momStartDate.format('YYYY-MM-DD')} to ${momEndDate.format('YYYY-MM-DD')}`);

        // ===== REDIS DATA LAYER: DISABLED =====
        // NOTE: Loading all 754K+ rows into Redis causes OOM crash.
        // The system now uses direct database aggregation queries with 
        // Comp_flag=0 filter for better performance and correctness.
        // This feature can be re-enabled once optimized to use LIMIT/pagination
        // or pre-computed aggregations instead of raw row storage.
        // ===== END REDIS DATA LAYER =====

        // ===== OUR BRANDS LIST (uses global cache) =====
        // Uses getGlobalOurBrandsList() defined at module level for cross-request caching
        const getOurBrandsList = () => getGlobalOurBrandsList();
        // ===== END OUR BRANDS LIST =====

        // Helper to generate month buckets
        const generateMonthBuckets = (start, end) => {
            const buckets = [];
            let current = start.clone().startOf('month');
            const endMonth = end.clone().endOf('month');
            while (current.isBefore(endMonth)) {
                buckets.push({
                    label: current.format('MMM'),
                    date: current.toDate(),
                    value: 0
                });
                current = current.add(1, 'month');
            }
            return buckets;
        };

        // Helper to generate week buckets for weekly KPI graphs
        const generateWeekBuckets = (start, end) => {
            const buckets = [];
            let current = start.clone().startOf('isoWeek');
            const endWeek = end.clone().endOf('isoWeek');
            while (current.isBefore(endWeek) || current.isSame(endWeek, 'week')) {
                buckets.push({
                    label: `W${current.week()}`,
                    date: current.toDate(),
                    value: 0
                });
                current = current.add(1, 'week');
            }
            return buckets;
        };

        const monthBuckets = generateMonthBuckets(startDate, endDate);
        const weekBuckets = generateWeekBuckets(startDate, endDate);

        // Get the optimized data source (Materialized View table or raw table)
        const src = await getWatchtowerSource(filters);

        // Helper for currency formatting
        const formatCurrency = (value) => {
            if (value === null || value === undefined) return "N/A";
            const val = parseFloat(value);
            if (isNaN(val)) return "N/A";

            // Return "0" for negligible amounts (less than 1 paisa)
            if (val < 0.01 && val > -0.01) return "₹0";

            if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
            if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lac`;
            if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
            return `₹${val.toFixed(2)}`;
        };

        const escapeStrMain = (str) => (str && typeof str === 'string') ? str.replace(/'/g, "''") : (str || '');

        // Build Where Clause for RbPdpOlap (Offtake) - MULTI-VALUE SUPPORT
        const buildOfftakeConditions = (s = startDate, e = endDate) => {
            // Use correct date column based on source
            const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
            const conditions = [`${dateCol} BETWEEN '${s.format('YYYY-MM-DD')}' AND '${e.format('YYYY-MM-DD')}'`];

            // Filter for Our Brands Only (Comp_flag=0) if specific brands are selected
            const compFlagCol = src.isAgg ? 'comp_flag' : 'Comp_flag';
            if (brandArr && brandArr.length > 0) {
                conditions.push(`${compFlagCol} = 0`);
            }

            const brandCol = src.f.brand;
            if (brandArr && brandArr.length > 0) {
                const brandConds = brandArr.map(b => `${brandCol} LIKE '%${escapeStrMain(b)}%'`).join(' OR ');
                if (brandConds) conditions.push(`(${brandConds})`);
            }

            const locationCol = src.f.location;
            const locationArrLocal = normalizeFilterArray(location);
            if (locationCol && locationCol !== "'Unknown'" && locationArrLocal && locationArrLocal.length > 0) {
                const platformCol = src.f.platform;
                const platformArrLocal = normalizeFilterArray(platform);
                const locCond = buildLocationQueryCond(locationArrLocal, platformArrLocal, locationCol, platformCol);
                if (locCond) {
                    console.log('[DEBUG] Location Array:', locationArrLocal, 'Condition:', locCond);
                    conditions.push(locCond);
                }
            }

            const platformCol = src.f.platform;
            const platformArrLocal = normalizeFilterArray(platform);
            if (platformArrLocal && platformArrLocal.length > 0) {
                const cond = buildPlatformChannelCond(platformArrLocal, channel, `lower(${platformCol})`, true, src.f.channel);
                if (cond) conditions.push(cond);
            } else {
                // If platform is 'All' or null, handle based on channel
                const cond = buildPlatformChannelCond(null, channel, `lower(${platformCol})`, true, src.f.channel);
                if (cond) conditions.push(cond);
            }

            // Apply Product_Category filter
            const catCol = src.f.category;
            const catArrLocal = normalizeFilterArray(category);
            if (catArrLocal && catArrLocal.length > 0) {
                conditions.push(`lower(${catCol}) IN (${catArrLocal.map(c => `'${escapeStrMain(c.toLowerCase())}'`).join(', ')})`);
            }

            // Advanced SKU Search Filters (Only supported on raw table)
            if (!src.isAgg) {
                if (skuNameArr && skuNameArr.length > 0) {
                    const skuConds = skuNameArr.map(s => `lower(${src.f.product}) LIKE lower('%${escapeStrMain(s)}%')`).join(' OR ');
                    if (skuConds) conditions.push(`(${skuConds})`);
                }
                if (skuCodeArr && skuCodeArr.length > 0) {
                    const skuCodeConds = skuCodeArr.map(s => `lower(toString(${src.f.skuCode})) LIKE lower('%${escapeStrMain(s)}%')`).join(' OR ');
                    if (skuCodeConds) conditions.push(`(${skuCodeConds})`);
                }
                // MSL filter (only applies to rb_pdp_olap, NOT rb_pm_olap)
                const mslArr = normalizeFilterArray(filters.msl);
                if (mslArr && mslArr.length > 0) {
                    const mslConds = mslArr.map(m => `toString(${src.f.msl}) = '${escapeStrMain(m)}'`).join(' OR ');
                    conditions.push(`(${mslConds})`);
                }
            }
            return conditions.join(' AND ');
        };

        const offtakeCondStr = buildOfftakeConditions();

        // getMarketShare helpers moved to marketShareHelper.js
        // Supports multi-value filters - NOW USES CLICKHOUSE
        const getAvailability = async (start, end, brandFilter, platformFilter, locationFilter, categoryFilter, skuNameFilter, skuCodeFilter) => {
            // Helper to escape strings for ClickHouse
            const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

            // Build WHERE conditions
            const conditions = [];

            // Check if first argument is a pre-built where clause (legacy overload - skip)
            if (start && typeof start.toDate !== 'function' && typeof start === 'object') {
                // Legacy where clause passed - this is deprecated, return 0
                console.warn('[getAvailability] Legacy where clause passed - deprecated');
                return 0;
            }

            // Date range
            const dateCol = src.isAgg ? 'date' : 'DATE';
            conditions.push(`${dateCol} BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`);

            const compFlagCol = src.isAgg ? 'comp_flag' : 'Comp_flag';
            conditions.push(`${compFlagCol} = 0`);

            // Handle brand filter with multi-value support
            const brandFilterArr = normalizeFilterArray(brandFilter);
            const brandCol = src.isAgg ? 'brand' : 'Brand';
            if (brandFilterArr && brandFilterArr.length > 0) {
                const brandConditions = brandFilterArr.map(b => `${brandCol} LIKE '%${escapeStr(b)}%'`).join(' OR ');
                if (brandConditions) conditions.push(`(${brandConditions})`);
            }

            // Handle platform with multi-value support
            const platformFilterArr = normalizeFilterArray(platformFilter);
            const platformCol = src.f.platform;
            if (platformFilterArr && platformFilterArr.length > 0) {
                const cond = buildPlatformChannelCond(platformFilterArr, channel, `lower(${platformCol})`, true, src.f.channel);
                if (cond) conditions.push(cond);
            } else {
                // If platform is 'All' or null, handle based on channel
                const cond = buildPlatformChannelCond(null, channel, `lower(${platformCol})`, true, src.f.channel);
                if (cond) conditions.push(cond);
            }

            // Handle location with multi-value support
            const locationFilterArr = normalizeFilterArray(locationFilter);
            if (locationFilterArr && locationFilterArr.length > 0) {
                const locCond = buildLocationQueryCond(locationFilterArr, platformFilter, src.f.location, src.f.platform);
                if (locCond) conditions.push(locCond);
            }

            // Apply Product_Category filter for rb_pdp_olap
            const catArrLocal = normalizeFilterArray(categoryFilter);
            if (catArrLocal && catArrLocal.length > 0) {
                conditions.push(`lower(${src.f.category}) IN (${catArrLocal.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
            }

            // Advanced SKU Search Filters
            if (!src.isAgg) {
                const skuArr = normalizeFilterArray(skuNameFilter);
                if (skuArr && skuArr.length > 0) {
                    const skuConds = skuArr.map(s => `lower(${src.f.product}) LIKE lower('%${escapeStr(s)}%')`).join(' OR ');
                    if (skuConds) conditions.push(`(${skuConds})`);
                }
                const skuCodeArr = normalizeFilterArray(skuCodeFilter);
                if (skuCodeArr && skuCodeArr.length > 0) {
                    const skuCodeConds = skuCodeArr.map(s => `lower(toString(${src.f.skuCode})) LIKE lower('%${escapeStr(s)}%')`).join(' OR ');
                    if (skuCodeConds) conditions.push(`(${skuCodeConds})`);
                }
                // MSL filter (only applies to rb_pdp_olap, NOT rb_pm_olap)
                const mslArr = normalizeFilterArray(filters.msl);
                if (mslArr && mslArr.length > 0) {
                    const mslConds = mslArr.map(m => `toString(${src.f.msl}) = '${escapeStr(m)}'`).join(' OR ');
                    conditions.push(`(${mslConds})`);
                }
            }

            const query = `
                SELECT 
                    SUM(${src.f.neno}) as total_neno,
                    SUM(${src.f.deno}) as total_deno
                FROM ${src.table}
                WHERE ${conditions.join(' AND ')}
            `;

            try {
                const results = await queryClickHouse(query);
                const totalNeno = parseFloat(results[0]?.total_neno || 0);
                const totalDeno = parseFloat(results[0]?.total_deno || 0);
                return totalDeno > 0 ? (totalNeno / totalDeno) * 100 : null;
            } catch (error) {
                console.error('[getAvailability] ClickHouse error:', error.message);
                return null;
            }
        };

        // Share of Search Calculation Helper - NOW USES CLICKHOUSE
        // Formula: Overall SOS = SUM(overall) / COUNT(*) for selected filters × 100
        // Uses overall, spons, organic columns (0/1 values) and flag column (0=our brands, 1=competition)
        const getShareOfSearch = async (start, end, brandFilter, platformFilter, locationFilter, categoryFilter) => {
            try {
                // Helper to escape strings for ClickHouse
                const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

                // Build base conditions using DATE column
                const baseConditions = [];
                baseConditions.push(`toDate(DATE) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`);

                const catArr = normalizeFilterArray(categoryFilter);
                if (catArr && catArr.length > 0) {
                    baseConditions.push(`lower(keyword_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
                }

                const locFilterArr = normalizeFilterArray(locationFilter);
                if (locFilterArr && locFilterArr.length > 0) {
                    baseConditions.push(`lower(location_name) IN (${locFilterArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
                }

                const platFilterArr = normalizeFilterArray(platformFilter);
                if (platFilterArr && platFilterArr.length > 0) {
                    const cond = buildPlatformChannelCond(platFilterArr, channel, 'lower(platform_name)', true);
                    if (cond) baseConditions.push(cond);
                } else {
                    // Handle All platform based on channel
                    const pCond = buildPlatformChannelCond(null, channel, 'lower(platform_name)', true);
                    if (pCond) baseConditions.push(pCond);
                }

                // For brand filter: filter by specific brand name or use flag column for "our brands"
                const brandArr = normalizeFilterArray(brandFilter);
                let numCondition = '1=1';

                if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
                    // Specific brand selected — match by brand_name_th
                    const brandConds = brandArr.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ');
                    numCondition = `lower(brand_name_th) IN (${brandConds})`;
                } else {
                    // When brand is "All", use the native flag column in rb_kw_olap
                    // flag = '1' reliably marks "our brands" without cross-table name matching
                    numCondition = "toString(flag) = '1'";
                }

                // Mathematical logic matching user query: SUM(overall) for our brands / SUM(overall) total × 100
                // POSITION <= 10 constraint: Only consider top 10 positions for SOS
                const sql = `
                    SELECT 
                        sumIf(toInt32(overall), ${numCondition} AND POSITION <= 10) as num,
                        sumIf(toInt32(overall), POSITION <= 10) as den
                    FROM rb_kw_olap
                    WHERE ${baseConditions.join(' AND ')}
                `;

                const result = await queryClickHouse(sql);
                const num = parseInt(result[0]?.num || 0);
                const den = parseInt(result[0]?.den || 0);

                return den > 0 ? (num / den) * 100 : null;
            } catch (error) {
                console.error("Error calculating Share of Search:", error);
                return null;
            }
        };


        /**
         * Bulk Share of Search Calculation - NOW USES CLICKHOUSE
         * Calculates SOS for multiple brands in ONE batch query (4 total queries vs 2N queries)
         * 
         * @param {Array<string>} brands - Array of brand names
         * @param {dayjs} currStart - Current period start date
         * @param {dayjs} currEnd - Current period end date
         * @param {dayjs} prevStart - Previous period start date
         * @param {dayjs} prevEnd - Previous period end date
         * @param {string} platformFilter - Platform filter
         * @param {string} locationFilter - Location filter
         * @param {string} categoryFilter - Category filter
         * @returns {Map<brandName, {current: number, previous: number}>} Map of brand -> SOS values
         */
        const getBulkShareOfSearch = async (
            brands,
            currStart, currEnd,
            prevStart, prevEnd,
            platformFilter, locationFilter, categoryFilter, channel
        ) => {
            try {
                const timerLabel = `[Bulk SOS] Total Time ${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                console.time(timerLabel);

                const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

                const validBrands = brands.filter(b => b && b.trim());
                if (validBrands.length === 0) {
                    console.log("[Bulk SOS] No valid brands provided");
                    return new Map();
                }

                console.log(`[Bulk SOS] Calculating SOS for ${validBrands.length} brands. Platform: ${platformFilter}, Category: ${categoryFilter}, Channel: ${channel}`);


                const buildConditions = (start, end) => {
                    const conds = [`toDate(DATE) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`];

                    const catArr = normalizeFilterArray(categoryFilter);
                    if (catArr && catArr.length > 0) {
                        conds.push(`lower(keyword_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
                    }

                    const locArr = normalizeFilterArray(locationFilter);
                    if (locArr && locArr.length > 0) {
                        conds.push(`lower(location_name) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
                    }

                    const platArr = normalizeFilterArray(platformFilter);
                    if (platArr && platArr.length > 0) {
                        const platCond = buildPlatformChannelCond(platArr, channel, 'lower(platform_name)', true);
                        if (platCond) conds.push(platCond);
                    } else {
                        const pCond = buildPlatformChannelCond(null, channel, 'lower(platform_name)', true);
                        if (pCond) conds.push(pCond);
                    }
                    return conds;
                };

                const executeSOSQuery = async (start, end) => {
                    const baseConds = buildConditions(start, end);
                    // Query directly with flag = '1' to get our brands' data reliably
                    // POSITION <= 10 constraint: Only consider top 10 positions for SOS
                    const [numResult, denResult] = await Promise.all([
                        queryClickHouse(`
                            SELECT 
                                lower(brand) as brand, 
                                sumIf(toInt32(overall), POSITION <= 10) as num_overall,
                                sumIf(toInt32(spons), POSITION <= 10) as num_spons,
                                sumIf(toInt32(organic), POSITION <= 10) as num_organic
                            FROM rb_kw_olap
                            WHERE ${baseConds.join(' AND ')} AND toString(flag) = '1'
                            GROUP BY brand
                        `),
                        queryClickHouse(`
                            SELECT 
                                sumIf(toInt32(overall), POSITION <= 10) as den_overall,
                                sumIf(toInt32(spons), POSITION <= 10) as den_spons,
                                sumIf(toInt32(organic), POSITION <= 10) as den_organic
                            FROM rb_kw_olap
                            WHERE ${baseConds.join(' AND ')}
                        `)
                    ]);

                    const denO = parseFloat(denResult[0]?.den_overall || 0);
                    const denS = parseFloat(denResult[0]?.den_spons || 0);
                    const denOrg = parseFloat(denResult[0]?.den_organic || 0);

                    return numResult.map(r => ({
                        brand: r.brand,
                        num_overall: parseFloat(r.num_overall || 0),
                        num_spons: parseFloat(r.num_spons || 0),
                        num_organic: parseFloat(r.num_organic || 0),
                        den_overall: denO,
                        den_spons: denS,
                        den_organic: denOrg
                    }));
                };

                const [currResult, prevResult] = await Promise.all([
                    executeSOSQuery(currStart, currEnd),
                    executeSOSQuery(prevStart, prevEnd)
                ]);

                // Helper for fuzzy matching SOS results
                const getSosFromResults = (results, targetBrand) => {
                    const lowerTarget = targetBrand.toLowerCase();
                    // Exact match
                    let match = results.find(r => r.brand === lowerTarget);
                    // Fuzzy match
                    if (!match) {
                        match = results.find(r => r.brand.includes(lowerTarget) || lowerTarget.includes(r.brand));
                    }

                    if (!match) return { overall: 0, spons: 0, organic: 0 };

                    return {
                        overall: match.den_overall > 0 ? (match.num_overall / match.den_overall) * 100 : 0,
                        spons: match.den_spons > 0 ? (match.num_spons / match.den_spons) * 100 : 0,
                        organic: match.den_organic > 0 ? (match.num_organic / match.den_organic) * 100 : 0
                    };
                };

                const sosMap = new Map();
                validBrands.forEach(brand => {
                    sosMap.set(brand, {
                        current: getSosFromResults(currResult, brand),
                        previous: getSosFromResults(prevResult, brand)
                    });
                });

                console.timeEnd(timerLabel);
                return sosMap;
            } catch (error) {
                console.error("Error in bulk Share of Search calculation:", error);
                return new Map();
            }
        };

        /**
         * Bulk Platform Metrics - NOW USES CLICKHOUSE
         * Aggregate all platforms in ONE query
         * Reduces 90 queries to 4 queries (20x improvement)
         */
        const getBulkPlatformMetrics = async (platforms, currStart, currEnd, prevStart, prevEnd, filters) => {
            try {
                const timerLabel = `[Bulk Platform] Total ${Date.now()}`;
                console.time(timerLabel);
                const { brand, location, category, skuName, skuCode } = filters;
                const channel = extractChannel(filters);

                // Helper to escape strings for ClickHouse
                const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';



                // Build WHERE conditions for ClickHouse
                const buildConditions = (dateStart, dateEnd, isPm = false, pmSrc = null) => {
                    const conditions = [];
                    const dateCol = isPm ? pmSrc.f.date : (src.isAgg ? 'date' : 'toDate(DATE)');
                    conditions.push(`${dateCol} BETWEEN '${dateStart}' AND '${dateEnd}'`);

                    if (isPm) {
                        const brandArrLocal = normalizeFilterArray(brand);
                        if (brandArrLocal && brandArrLocal.length > 0) {
                            const brandConds = brandArrLocal.map(b => `'${escapeStr(b).toLowerCase()}'`).join(',');
                            conditions.push(`lower(${pmSrc.f.brand}) IN (${brandConds})`);
                        }
                        const platformCol = pmSrc.f.platform;
                        const platformCond = buildPlatformChannelCond((platformArr && platformArr.length > 0) ? platformArr : 'All', channel, platformCol);
                        if (platformCond) conditions.push(platformCond);

                        const catArrLocal = normalizeFilterArray(category);
                        if (catArrLocal && catArrLocal.length > 0) {
                            const catConds = catArrLocal.map(c => `'${escapeStr(c).toLowerCase()}'`).join(',');
                            conditions.push(`lower(${pmSrc.f.category}) IN (${catConds})`);
                        }

                        const locCol = pmSrc.f.location;
                        const locationArr = normalizeFilterArray(location);
                        if (locCol && locCol !== "'Unknown'" && locationArr && locationArr.length > 0) {
                            const locCond = buildLocationQueryCond(locationArr, platforms, locCol, pmSrc.f.platform);
                            if (locCond) conditions.push(locCond);
                        }
                    } else {
                        // Filter for Our Brands Only (Enforce comp_flag=0 if All brands or specific brands selected)
                        const compFlagCol = src.isAgg ? 'comp_flag' : 'Comp_flag';
                        const brandCondArr = normalizeFilterArray(brand);

                        if (brandCondArr && brandCondArr.length > 0) {
                            // If specific brands are selected, we must ensure they are our brands (comp_flag=0)
                            // or allow them if they are selected. Usually Watch Tower is for our brands.
                            conditions.push(`${compFlagCol} = 0`);

                            const brandCol = src.isAgg ? 'brand' : 'Brand';
                            const brandConds = brandCondArr.map(b => `${brandCol} LIKE '%${escapeStr(b)}%'`).join(' OR ');
                            conditions.push(`(${brandConds})`);
                        } else {
                            // If "All" brands selected, default to our brands only
                            conditions.push(`${compFlagCol} = 0`);
                        }

                        const locCol = src.isAgg ? 'location' : 'Location';
                        const locationArrLocal = normalizeFilterArray(location);
                        if (locationArrLocal && locationArrLocal.length > 0) {
                            const platformCol = src.isAgg ? 'platform' : 'Platform';
                            const locCond = buildLocationQueryCond(locationArrLocal, platforms, locCol, platformCol);
                            if (locCond) conditions.push(locCond);
                        }

                        const platformCol = src.isAgg ? 'platform' : 'Platform';
                        const platformCond = buildPlatformChannelCond((platformArr && platformArr.length > 0) ? platformArr : 'All', channel, platformCol);
                        if (platformCond) {
                            conditions.push(platformCond);
                        }

                        const catArrLocal = normalizeFilterArray(category);
                        if (catArrLocal && catArrLocal.length > 0) {
                            conditions.push(`${src.f.category} IN (${catArrLocal.map(c => `'${escapeStr(c)}'`).join(', ')})`);
                        }

                        if (!src.isAgg) {
                            const skuArr = normalizeFilterArray(skuName);
                            if (skuArr && skuArr.length > 0) {
                                const skuConds = skuArr.map(s => `Product LIKE '%${escapeStr(s)}%'`).join(' OR ');
                                conditions.push(`(${skuConds})`);
                            }
                            const skuCodeArr = normalizeFilterArray(skuCode);
                            if (skuCodeArr && skuCodeArr.length > 0) {
                                const skuCodeConds = skuCodeArr.map(s => `toString(Web_Pid) LIKE '%${escapeStr(s)}%'`).join(' OR ');
                                conditions.push(`(${skuCodeConds})`);
                            }
                            const mslArr = normalizeFilterArray(filters.msl);
                            if (mslArr && mslArr.length > 0) {
                                const mslConds = mslArr.map(m => `toString(${src.f.msl}) = '${escapeStr(m)}'`).join(' OR ');
                                conditions.push(`(${mslConds})`);
                            }
                        }
                    }
                    return conditions.join(' AND ');
                };

                const pmSrc = await getPmSource();
                const currConditions = buildConditions(currStart.format('YYYY-MM-DD'), currEnd.format('YYYY-MM-DD'), false);
                const prevConditions = buildConditions(prevStart.format('YYYY-MM-DD'), prevEnd.format('YYYY-MM-DD'), false);
                const currPmConditions = buildConditions(currStart.format('YYYY-MM-DD'), currEnd.format('YYYY-MM-DD'), true, pmSrc);
                const prevPmConditions = buildConditions(prevStart.format('YYYY-MM-DD'), prevEnd.format('YYYY-MM-DD'), true, pmSrc);

                // Execute queries in parallel using ClickHouse
                const [currData, currMs, currPmData, prevData, prevMs, prevPmData] = await Promise.all([
                    // Query 1: Current period offtake metrics for all platforms
                    queryClickHouse(`
                        SELECT 
                            ${src.f.platform} as Platform,
                            SUM(${src.f.sales}) as sales,
                            SUM(${src.f.spend}) as spend,
                            SUM(${src.f.adSales}) as Ad_sales,
                            SUM(${src.f.clicks}) as clicks,
                            SUM(${src.f.impressions}) as impressions,
                            SUM(${src.f.neno}) as neno,
                            SUM(${src.f.deno}) as deno
                        FROM ${src.table}
                        WHERE ${currConditions}
                        GROUP BY Platform
                    `),
                    // Query 2: Current period market share from rb_brand_ms
                    (async () => {
                        const brandsForNumerator = (brand && brand !== 'All')
                            ? (Array.isArray(brand) ? brand : [brand])
                            : (await getGlobalOurBrandsList());
                        const brandInClause = brandsForNumerator.map(b => `'${escapeStr(b)}'`).join(', ');
                        const msConds = [
                            `toDate(created_on) BETWEEN '${currStart.format('YYYY-MM-DD')}' AND '${currEnd.format('YYYY-MM-DD')}'`
                        ];
                        const locArr = normalizeFilterArray(location);
                        const hasLocFilter = locArr && locArr.length > 0;
                        if (hasLocFilter) {
                            const locCond = buildLocationQueryCond(locArr, platforms, 'location', 'platform');
                            if (locCond) msConds.push(locCond);
                        }
                        const catArr = normalizeFilterArray(category);
                        if (catArr && catArr.length > 0) {
                            const mappedCats = catArr.map(c => {
                                if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                                if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                                return c;
                            });
                            if (mappedCats.length === 1) {
                                msConds.push(`category = '${escapeStr(mappedCats[0])}'`);
                            } else {
                                msConds.push(`category IN (${mappedCats.map(c => `'${escapeStr(c)}'`).join(', ')})`);
                            }
                        }

                        const query = `
                            SELECT platform as platform_name,
                                   SUM(if(group_brand IN (${brandInClause}), toFloat64OrZero(toString(sales)), 0)) / nullIf(SUM(toFloat64OrZero(toString(sales))), 0) * 100 as ms
                            FROM rb_ms_olap
                            WHERE ${msConds.join(' AND ')}
                            GROUP BY platform
                        `;
                        return await queryClickHouse(query);
                    })(),
                    // Query 3: Current PM Metrics
                    queryClickHouse(`
                        SELECT 
                            ${pmSrc.f.platform} as Platform,
                            SUM(${pmSrc.f.spend}) as spend,
                            SUM(${pmSrc.f.adSales}) as Ad_sales,
                            SUM(${pmSrc.f.clicks}) as clicks,
                            SUM(${pmSrc.f.impressions}) as impressions,
                            SUM(${pmSrc.f.orders}) as orders
                        FROM ${pmSrc.table}
                        WHERE ${currPmConditions}
                        GROUP BY Platform
                    `),
                    // Query 4: Previous period offtake metrics for all platforms
                    queryClickHouse(`
                        SELECT 
                            ${src.f.platform} as Platform,
                            SUM(${src.f.sales}) as sales,
                            SUM(${src.f.spend}) as spend,
                            SUM(${src.f.adSales}) as Ad_sales,
                            SUM(${src.f.clicks}) as clicks,
                            SUM(${src.f.impressions}) as impressions,
                            SUM(${src.f.neno}) as neno,
                            SUM(${src.f.deno}) as deno
                        FROM ${src.table}
                        WHERE ${prevConditions}
                        GROUP BY Platform
                    `),
                    // Query 4: Previous period market share from rb_brand_ms
                    (async () => {
                        const brandsForNumerator = (brand && brand !== 'All')
                            ? (Array.isArray(brand) ? brand : [brand])
                            : (await getGlobalOurBrandsList());
                        const brandInClause = brandsForNumerator.map(b => `'${escapeStr(b)}'`).join(', ');
                        const msConds = [
                            `toDate(created_on) BETWEEN '${prevStart.format('YYYY-MM-DD')}' AND '${prevEnd.format('YYYY-MM-DD')}'`
                        ];
                        const locArr = normalizeFilterArray(location);
                        const hasLocFilter = locArr && locArr.length > 0;
                        if (hasLocFilter) {
                            const locCond = buildLocationQueryCond(locArr, platforms, 'location', 'platform');
                            if (locCond) msConds.push(locCond);
                        }
                        const catArr = normalizeFilterArray(category);
                        if (catArr && catArr.length > 0) {
                            const mappedCats = catArr.map(c => {
                                if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                                if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                                return c;
                            });
                            if (mappedCats.length === 1) {
                                msConds.push(`category = '${escapeStr(mappedCats[0])}'`);
                            } else {
                                msConds.push(`category IN (${mappedCats.map(c => `'${escapeStr(c)}'`).join(', ')})`);
                            }
                        }

                        const query = `
                            SELECT platform as platform_name,
                                   SUM(if(group_brand IN (${brandInClause}), toFloat64OrZero(toString(sales)), 0)) / nullIf(SUM(toFloat64OrZero(toString(sales))), 0) * 100 as ms
                            FROM rb_ms_olap
                            WHERE ${msConds.join(' AND ')}
                            GROUP BY platform
                        `;
                        return await queryClickHouse(query);
                    })(),
                    // Query 6: Previous PM Metrics
                    queryClickHouse(`
                        SELECT 
                            ${pmSrc.f.platform} as Platform,
                            SUM(${pmSrc.f.spend}) as spend,
                            SUM(${pmSrc.f.adSales}) as Ad_sales,
                            SUM(${pmSrc.f.clicks}) as clicks,
                            SUM(${pmSrc.f.impressions}) as impressions,
                            SUM(${pmSrc.f.orders}) as orders
                        FROM ${pmSrc.table}
                        WHERE ${prevPmConditions}
                        GROUP BY Platform
                    `)
                ]);

                console.log(`[Bulk Platform] Processed ${platforms.length} platforms with combined queries`);

                // Build result map
                const map = new Map();

                platforms.forEach(p => {
                    const key = p.toLowerCase();
                    const c = currData.find(d => d.Platform && d.Platform.toLowerCase() === key);
                    const pv = prevData.find(d => d.Platform && d.Platform.toLowerCase() === key);

                    const cPm = currPmData.find(d => d.Platform && d.Platform.toLowerCase() === key);
                    const pvPm = prevPmData.find(d => d.Platform && d.Platform.toLowerCase() === key);

                    const currMsRow = currMs.find(d => d.platform_name && d.platform_name.toLowerCase() === key);
                    const prevMsRow = prevMs.find(d => d.platform_name && d.platform_name.toLowerCase() === key);

                    map.set(p, {
                        curr: {
                            sales: parseFloat(c?.sales || 0),
                            spend: parseFloat(cPm?.spend || 0),
                            adSales: parseFloat(cPm?.Ad_sales || 0),
                            clicks: parseFloat(cPm?.clicks || 0),
                            impressions: parseFloat(cPm?.impressions || 0),
                            orders: parseFloat(cPm?.orders || 0),
                            neno: parseFloat(c?.neno || 0),
                            deno: parseFloat(c?.deno || 0),
                            ms: parseFloat(currMsRow?.ms || 0)
                        },
                        prev: {
                            sales: parseFloat(pv?.sales || 0),
                            spend: parseFloat(pvPm?.spend || 0),
                            adSales: parseFloat(pvPm?.Ad_sales || 0),
                            clicks: parseFloat(pvPm?.clicks || 0),
                            impressions: parseFloat(pvPm?.impressions || 0),
                            orders: parseFloat(pvPm?.orders || 0),
                            neno: parseFloat(pv?.neno || 0),
                            deno: parseFloat(pv?.deno || 0),
                            ms: parseFloat(prevMsRow?.ms || 0)
                        }
                    });
                });



                console.timeEnd(timerLabel);
                return map;
            } catch (err) {
                console.error('[Bulk Platform] Error:', err);
                return new Map();
            }
        };


        // Execute queries concurrently - NOW USING CLICKHOUSE
        // Helper for building ClickHouse WHERE conditions
        const [
            offtakeData, // Now returns daily data for trend + summary
            marketShareTrendData, // From marketShareHelper
            totalMarketShareResult,
            topSkus,
            currentAvailability,
            prevAvailability,
            currentShareOfSearch,
            prevShareOfSearch,
            availabilityTrendData,
            shareOfSearchTrendData,
            prevOfftakeResult,
            prevMarketShareResult,
            currentPromoDepth,
            prevPromoDepth,
            promoTrendData
        ] = await Promise.all([
            // 1. Offtake Data (Daily for trend)
            (async () => {
                try {
                    const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
                    const result = await queryClickHouse(`
                        SELECT ${dateCol} as date, SUM(${src.f.sales}) as total_sales 
                        FROM ${src.table} 
                        WHERE ${offtakeCondStr}
                        GROUP BY date ORDER BY date
                    `);
                    return result;
                } catch (err) {
                    console.error('[Offtake] ClickHouse error:', err.message);
                    return [];
                }
            })(),
            // 2. Market Share Trend - USING marketShareHelper
            getMarketShareTimeSeries(startDate, endDate, platform, category, brand, 'Daily', location, channel),
            // 3. Total Market Share Average
            (async () => {
                try {
                    const avgMs = await getMarketShare(startDate, endDate, platform, category, brand, location, channel);
                    return { avg_market_share: avgMs, count: 1, min_val: avgMs, max_val: avgMs };
                } catch (err) {
                    console.error('[TotalMarketShare] helper error:', err.message);
                    return { avg_market_share: 0, count: 0, min_val: 0, max_val: 0 };
                }
            })(),
            // 4. Top SKUs
            (async () => {
                try {
                    const result = await queryClickHouse(`
                        SELECT 
                            ${src.f.product} as sku_name,
                            SUM(${src.f.sales}) as sku_gmv
                        FROM ${src.table}
                        WHERE ${offtakeCondStr} AND ${src.f.compFlag} = '0' AND ${src.f.product} IS NOT NULL AND ${src.f.product} != ''
                        GROUP BY sku_name
                        ORDER BY sku_gmv DESC
                    `);
                    return result;
                } catch (error) {
                    console.error('Error fetching top SKUs:', error.message);
                    return [];
                }
            })(),
            // 5. Current Availability
            getAvailability(startDate, endDate, brand, platform, location, category, skuName, skuCode),
            // 6. Previous Availability
            getAvailability(momStartDate, momEndDate, brand, platform, location, category, skuName, skuCode),
            // 7. Current Share of Search
            getShareOfSearch(startDate, endDate, brand, platform, location, category),
            // 8. Previous Share of Search
            getShareOfSearch(momStartDate, momEndDate, brand, platform, location, category),
            // 9. Availability Trend Data - USING CLICKHOUSE
            (async () => {
                try {
                    const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
                    const result = await queryClickHouse(`
                        SELECT ${dateCol} as date, SUM(${src.f.neno}) as neno, SUM(${src.f.deno}) as deno
                        FROM ${src.table}
                        WHERE ${offtakeCondStr}
                        GROUP BY date ORDER BY date
                    `);
                    return result;
                } catch (err) {
                    console.error('[AvailabilityTrend] error:', err.message);
                    return [];
                }
            })(),
            // 10. Share of Search Trend Data - USING CLICKHOUSE
            (async () => {
                try {
                    const baseCond = [
                        `toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`
                    ];

                    const locArr = normalizeFilterArray(location);
                    if (locArr && locArr.length > 0) baseCond.push(`lower(location_name) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);

                    const catArr = normalizeFilterArray(category);
                    if (catArr && catArr.length > 0) baseCond.push(`lower(keyword_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);

                    const platArr = normalizeFilterArray(platform);
                    const platCond = buildPlatformChannelCond(platArr, channel, 'lower(platform_name)', true);
                    if (platCond) baseCond.push(platCond);

                    // Build numerator condition: use flag='1' for "All" brands, brand name match for specific brands
                    let numBrandCond;
                    if (brand && brand !== 'All') {
                        const brandsForNumerator = Array.isArray(brand) ? brand : [brand];
                        const brandInClause = brandsForNumerator.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ');
                        numBrandCond = `lower(brand) IN (${brandInClause})`;
                    } else {
                        numBrandCond = `toString(flag) = '1'`;
                    }

                    // POSITION <= 10 constraint: Only consider top 10 positions for SOS
                    const result = await queryClickHouse(`
                        SELECT 
                            toDate(DATE) as date,
                            SUM(if(${numBrandCond} AND POSITION <= 10, toInt32(overall), 0)) as num,
                            SUM(if(POSITION <= 10, toInt32(overall), 0)) as den
                        FROM rb_kw_olap
                        WHERE ${baseCond.join(' AND ')}
                        GROUP BY date ORDER BY date
                    `);
                    return result;
                } catch (err) {
                    console.error('[SOSTrend] error:', err.message);
                    return [];
                }
            })(),
            // 11. Previous Offtake
            (async () => {
                try {
                    const prevOfftakeCondStr = buildOfftakeConditions(momStartDate, momEndDate);
                    const result = await queryClickHouse(`SELECT SUM(${src.f.sales}) as total FROM ${src.table} WHERE ${prevOfftakeCondStr}`);
                    return parseFloat(result[0]?.total || 0);
                } catch (err) {
                    console.error('[PrevOfftake] ClickHouse error:', err.message);
                    return 0;
                }
            })(),
            // 12. Previous Market Share
            (async () => {
                try {
                    const avgMs = await getMarketShare(momStartDate, momEndDate, platform, category, brand, location, channel);
                    return { avg_ms: avgMs };
                } catch (err) {
                    console.error('[PrevMarketShare] helper error:', err.message);
                    return { avg_ms: 0 };
                }
            })(),
            // 13. Current Promo Depth
            (async () => {
                try {
                    const result = await queryClickHouse(`
                        SELECT (SUM(${src.f.mrp}) - SUM(${src.f.sellingPrice})) / NULLIF(SUM(${src.f.mrp}), 0) * 100 as avg_promo
                        FROM ${src.table}
                        WHERE ${offtakeCondStr} AND ${src.f.compFlag} = '0' AND neno_osa > 0
                    `);
                    return (result[0]?.avg_promo !== undefined && result[0]?.avg_promo !== null) ? parseFloat(result[0]?.avg_promo) : null;
                } catch (err) {
                    console.error('[PromoDepth] ClickHouse error:', err.message);
                    return null;
                }
            })(),
            // 14. Previous Promo Depth
            (async () => {
                try {
                    const prevOfftakeCondStr = buildOfftakeConditions(momStartDate, momEndDate);
                    const result = await queryClickHouse(`
                        SELECT (SUM(${src.f.mrp}) - SUM(${src.f.sellingPrice})) / NULLIF(SUM(${src.f.mrp}), 0) * 100 as avg_promo
                        FROM ${src.table}
                        WHERE ${prevOfftakeCondStr} AND ${src.f.compFlag} = '0' AND neno_osa > 0
                    `);
                    return (result[0]?.avg_promo !== undefined && result[0]?.avg_promo !== null) ? parseFloat(result[0]?.avg_promo) : null;
                } catch (err) {
                    console.error('[PrevPromoDepth] ClickHouse error:', err.message);
                    return null;
                }
            })(),
            // 15. Promo Trend Data
            (async () => {
                try {
                    const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
                    const result = await queryClickHouse(`
                        SELECT 
                            ${dateCol} as date,
                            (SUM(${src.f.mrp}) - SUM(${src.f.sellingPrice})) / NULLIF(SUM(${src.f.mrp}), 0) * 100 as promo
                        FROM ${src.table}
                        WHERE ${offtakeCondStr} AND ${src.f.compFlag} = '0' AND neno_osa > 0
                        GROUP BY date ORDER BY date
                    `);
                    return result;
                } catch (err) {
                    return [];
                }
            })()
        ]);

        // Process Trend Charts - Map Daily data to Week Buckets
        const mapToWeeks = (dailyData, buckets, valueKey = 'value', dateKey = 'date', isAvg = false) => {
            const result = buckets.map(b => ({ ...b, value: 0, count: 0 }));
            dailyData.forEach(d => {
                const date = dayjs(d[dateKey]);
                const bucketIndex = result.findIndex(b => {
                    const bStart = dayjs(b.date).startOf('isoWeek');
                    const bEnd = dayjs(b.date).endOf('isoWeek');
                    return date.isSame(bStart) || (date.isAfter(bStart) && date.isBefore(bEnd)) || date.isSame(bEnd);
                });
                if (bucketIndex !== -1) {
                    result[bucketIndex].value += parseFloat(d[valueKey] || 0);
                    result[bucketIndex].count += 1;
                }
            });
            return result.map(b => ({
                label: b.label,
                value: isAvg ? (b.count > 0 ? b.value / b.count : 0) : b.value
            }));
        };

        const hasOfftakeData = offtakeData.length > 0;
        const totalOfftake = hasOfftakeData ? offtakeData.reduce((sum, d) => sum + parseFloat(d.total_sales || 0), 0) : null;
        const offtakeChart = mapToWeeks(offtakeData, weekBuckets, 'total_sales');

        const formattedOfftake = formatCurrency(totalOfftake);

        // Calculate Offtake Trend
        const prevOfftakeVal = parseFloat(prevOfftakeResult || 0);
        let offtakeChange = 0;
        let offtakeTrendStr = "N/A";

        if (totalOfftake !== null) {
            if (prevOfftakeVal > 0) {
                offtakeChange = ((totalOfftake - prevOfftakeVal) / prevOfftakeVal) * 100;
            } else if (totalOfftake > 0) {
                offtakeChange = 100;
            }
            offtakeTrendStr = (offtakeChange >= 0 ? "+" : "") + offtakeChange.toFixed(2) + "%";
        }

        // Process Market Share Data
        const tier1Cities = [
            'kolkata', 'mumbai', 'pune', 'chennai', 'delhi', 'lucknow',
            'gurugram', 'chandigarh', 'hyderabad', 'faridabad', 'bengaluru'
        ];
        let hasTier23 = false;
        if (locationArr && locationArr.length > 0) {
            hasTier23 = locationArr.some(loc => {
                const lowerLoc = String(loc).trim().toLowerCase();
                if (lowerLoc === 'all' || lowerLoc === '' || lowerLoc === 'all india') return false;
                return !tier1Cities.includes(lowerLoc);
            });
        }

        const marketShareChart = weekBuckets.map(b => {
            if (hasTier23) {
                return { label: b.label, value: 0 };
            }
            const bStart = dayjs(b.date).startOf('isoWeek');
            const bEnd = dayjs(b.date).endOf('isoWeek');
            let sumMs = 0, count = 0;
            marketShareTrendData.forEach((val, dateStr) => {
                const d = dayjs(dateStr);
                if (d.isSame(bStart) || (d.isAfter(bStart) && d.isBefore(bEnd)) || d.isSame(bEnd)) {
                    sumMs += val;
                    count++;
                }
            });
            return { label: b.label, value: count > 0 ? sumMs / count : 0 };
        });

        let totalMarketShare = totalMarketShareResult?.avg_market_share !== undefined && totalMarketShareResult?.avg_market_share !== null ? parseFloat(totalMarketShareResult.avg_market_share) : null;
        if (hasTier23) totalMarketShare = null;
        const formattedMarketShare = totalMarketShare !== null ? totalMarketShare.toFixed(2) + "%" : "N/A";

        const prevMarketShareVal = parseFloat(prevMarketShareResult?.avg_ms || 0);
        const marketShareChange = (totalMarketShare !== null && !hasTier23) ? totalMarketShare - prevMarketShareVal : 0;
        const marketShareTrendStr = (totalMarketShare !== null && !hasTier23) ? (marketShareChange >= 0 ? "+" : "") + marketShareChange.toFixed(2) + "%" : "N/A";


        // Process Availability Data
        const availabilityChart = weekBuckets.map(b => {
            const bStart = dayjs(b.date).startOf('isoWeek');
            const bEnd = dayjs(b.date).endOf('isoWeek');
            let neno = 0, deno = 0;
            availabilityTrendData.forEach(d => {
                const dt = dayjs(d.date);
                if (dt.isSame(bStart) || (dt.isAfter(bStart) && dt.isBefore(bEnd)) || dt.isSame(bEnd)) {
                    neno += parseFloat(d.neno || 0);
                    deno += parseFloat(d.deno || 0);
                }
            });
            return { label: b.label, value: deno > 0 ? (neno / deno) * 100 : 0 };
        });

        const formattedAvailability = currentAvailability !== null ? currentAvailability.toFixed(2) + "%" : "N/A";
        const availabilityChange = (currentAvailability !== null && prevAvailability !== null) ? currentAvailability - prevAvailability : 0;
        const availabilityTrendStr = currentAvailability !== null ? (availabilityChange >= 0 ? "+" : "") + availabilityChange.toFixed(2) + "%" : "N/A";

        // Process SOS Data
        const shareOfSearchChart = weekBuckets.map(b => {
            const bStart = dayjs(b.date).startOf('isoWeek');
            const bEnd = dayjs(b.date).endOf('isoWeek');
            let num = 0, den = 0;
            shareOfSearchTrendData.forEach(d => {
                const dt = dayjs(d.date);
                if (dt.isSame(bStart) || (dt.isAfter(bStart) && dt.isBefore(bEnd)) || dt.isSame(bEnd)) {
                    num += parseFloat(d.num || 0);
                    den += parseFloat(d.den || 0);
                }
            });
            return { label: b.label, value: den > 0 ? (num / den) * 100 : 0 };
        });

        const formattedShareOfSearch = currentShareOfSearch !== null ? currentShareOfSearch.toFixed(2) + "%" : "N/A";
        const sosChange = (currentShareOfSearch !== null && prevShareOfSearch !== null) ? currentShareOfSearch - prevShareOfSearch : 0;
        const sosTrendStr = currentShareOfSearch !== null ? (sosChange >= 0 ? "+" : "") + sosChange.toFixed(2) + "%" : "N/A";

        // Process Promo Data
        const promoChart = mapToWeeks(promoTrendData, weekBuckets, 'promo', 'date', true);

        const safePromoDepth = currentPromoDepth !== null ? parseFloat(currentPromoDepth) : null;
        const safePrevPromoDepth = prevPromoDepth !== null ? parseFloat(prevPromoDepth) : 0;
        const formattedPromo = safePromoDepth !== null ? safePromoDepth.toFixed(2) + "%" : "N/A";
        const promoChange = (safePromoDepth !== null) ? safePromoDepth - safePrevPromoDepth : 0;
        const promoTrendStr = safePromoDepth !== null ? (promoChange >= 0 ? "+" : "") + promoChange.toFixed(2) + "%" : "N/A";

        // Process Top SKUs
        const skuTableData = topSkus.map(sku => ({
            sku_name: sku.sku_name,
            gmv: formatCurrency(sku.sku_gmv)
        }));

        // Prepare Summary Metrics Object (Header values)
        const summaryMetrics = {
            offtakes: formattedOfftake,
            offtakesTrend: offtakeTrendStr,
            shareOfSearch: formattedShareOfSearch,
            shareOfSearchTrend: sosTrendStr,
            stockAvailability: formattedAvailability,
            stockAvailabilityTrend: availabilityTrendStr,
            marketShare: formattedMarketShare,
            promo: formattedPromo,
            promoTrend: promoTrendStr
        };

        let subtitle = '';
        if (qStartDate && qEndDate) {
            subtitle = `${dayjs(qStartDate).format('DD MMM')} - ${dayjs(qEndDate).format('DD MMM')}`;
        }

        const chartLabels = offtakeChart.map(p => p.label);

        const topMetrics = [
            {
                name: "Offtake",
                label: formattedOfftake,
                subtitle: subtitle,
                trend: offtakeTrendStr,
                trendType: offtakeChange >= 0 ? "positive" : "negative",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: offtakeChart.map(p => p.value),
                labels: chartLabels
            },
            {
                name: "Availability",
                label: formattedAvailability,
                subtitle: subtitle,
                trend: availabilityTrendStr,
                trendType: availabilityChange >= 0 ? "positive" : "negative",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: availabilityChart.map(p => p.value),
                labels: chartLabels
            },
            {
                name: "Share of Search",
                label: formattedShareOfSearch,
                subtitle: subtitle,
                trend: sosTrendStr,
                trendType: sosChange >= 0 ? "positive" : "negative",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: shareOfSearchChart.map(p => p.value),
                labels: chartLabels
            },
            {
                name: "Market Share",
                label: formattedMarketShare,
                subtitle: subtitle,
                trend: marketShareTrendStr,
                trendType: marketShareChange >= 0 ? "positive" : "negative",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: marketShareChart.map(p => p.value),
                labels: chartLabels
            },
            {
                name: "Promo",
                label: formattedPromo,
                subtitle: subtitle,
                trend: promoTrendStr,
                trendType: promoChange >= 0 ? "positive" : "negative",
                comparison: "vs Previous Period",
                units: "Depth",
                unitsTrend: "",
                chart: promoChart.map(p => p.value),
                labels: chartLabels
            }
        ];

        // Performance Metrics KPIs (6 KPI Cards) - OPTIMIZED WITH GROUP BY
        // Skip this expensive computation if only topMetrics are needed
        const performanceMetricsKpis = [];

        if (!skipPerformanceKpis) {
            try {
                let momStartDate = startDate.clone().subtract(1, 'month');
                let momEndDate = endDate.clone().subtract(1, 'month');

                // If explicit compare dates are provided from frontend, use them
                if (filters.compareStartDate && filters.compareEndDate) {
                    momStartDate = dayjs(filters.compareStartDate).startOf('day');
                    momEndDate = dayjs(filters.compareEndDate).endOf('day');
                }

                // Helper to generate last 7 months
                const last7Months = [];
                for (let i = 6; i >= 0; i--) {
                    const mStart = endDate.clone().subtract(i, 'month').startOf('month');
                    const mEnd = endDate.clone().subtract(i, 'month').endOf('month');
                    last7Months.push({ start: mStart, end: mEnd, label: `P${7 - i}`, key: mStart.format('YYYY-MM-01') });
                }

                // Helper to fetch PRECISE totals for summary cards (non-grouped)
                const getPrecisePerformanceMetrics = async (start, end, filters) => {
                    const { brand, platform, location, category } = filters;
                    const channel = extractChannel(filters);
                    const pmSrc = await getPmSource();
                    const escapeStrLocal = (str) => str ? str.replace(/'/g, "''") : '';


                    const pmConditions = [
                        `${pmSrc.f.date} BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`
                    ];

                    const platformCond = buildPlatformChannelCond(platform, channel, pmSrc.f.platform, false, pmSrc.f.channel);
                    if (platformCond) pmConditions.push(platformCond);

                    const brandArrLocal = normalizeFilterArray(brand);
                    if (brandArrLocal && brandArrLocal.length > 0) {
                        const brandConds = brandArrLocal.map(b => `'${escapeStrLocal(b).toLowerCase()}'`).join(',');
                        pmConditions.push(`lower(${pmSrc.f.brand}) IN (${brandConds})`);
                    }

                    const catArrLocal = normalizeFilterArray(category);
                    if (catArrLocal && catArrLocal.length > 0) {
                        const catConds = catArrLocal.map(c => `'${escapeStrLocal(c)}'`).join(',');
                        pmConditions.push(`${pmSrc.f.category} IN (${catConds})`);
                    }

                    // Build offtake conditions for src.table
                    const offtakeConditions = buildOfftakeConditions(start, end);

                    try {
                        const [pmResults, offtakeResults] = await Promise.all([
                            queryClickHouse(`
                                SELECT 
                                    COUNT(*) as row_count,
                                    SUM(${pmSrc.f.adSales}) as adSales,
                                    SUM(${pmSrc.f.orders}) as orders,
                                    SUM(${pmSrc.f.clicks}) as clicks,
                                    SUM(${pmSrc.f.impressions}) as impressions,
                                    SUM(${pmSrc.f.spend}) as spend
                                FROM ${pmSrc.table}
                                WHERE ${pmConditions.join(' AND ')}
                            `),
                            queryClickHouse(`
                                SELECT 
                                    SUM(${src.f.sales}) as total_sales,
                                    SUM(IF(${src.isAgg ? 'comp_flag' : 'Comp_flag'} = 0, ${src.f.sales}, 0)) as total_sales_comp0
                                FROM ${src.table} 
                                WHERE ${offtakeConditions}
                            `)
                        ]);

                        return {
                            hasPmData: parseFloat(pmResults[0]?.row_count || 0) > 0,
                            sales: parseFloat(offtakeResults[0]?.total_sales || 0),
                            salesComp0: parseFloat(offtakeResults[0]?.total_sales_comp0 || 0),
                            adSales: parseFloat(pmResults[0]?.adSales || 0),
                            orders: parseFloat(pmResults[0]?.orders || 0),
                            clicks: parseFloat(pmResults[0]?.clicks || 0),
                            impressions: parseFloat(pmResults[0]?.impressions || 0),
                            spend: parseFloat(pmResults[0]?.spend || 0)
                        };
                    } catch (error) {
                        console.error('[getPrecisePerformanceMetrics] Error:', error.message);
                        return { hasPmData: false, sales: 0, salesComp0: 0, adSales: 0, orders: 0, clicks: 0, impressions: 0, spend: 0 };
                    }
                };

                // ⚡ MEGA OPTIMIZATION: Pre-computed monthly KPI cache with Redis fallback
                const getBulkPerformanceMetrics = async (startRange, endRange, filters) => {
                    const { brand, platform, location, category } = filters;
                    const channel = extractChannel(filters);
                    const pmSrc = await getPmSource();

                    // Generate list of months in range
                    const months = [];
                    let current = startRange.clone().startOf('month');
                    while (current.isBefore(endRange) || current.isSame(endRange, 'month')) {
                        months.push(current.format('YYYY-MM'));
                        current = current.add(1, 'month');
                    }



                    // ===== TRY BRAND PRE-AGGREGATED DATA (INSTANT LOOKUP) =====
                    // NOTE: Skipping pre-aggregated pdp Redis caches since we need pm metrics
                    // ===== END BRAND PRE-AGGREGATION CHECK =====

                    // Cache miss - compute aggregations (FALLBACK)
                    let dataByMonth = new Map();

                    // Fallback to ClickHouse database query - MULTI-VALUE SUPPORT
                    // Helper to escape strings
                    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

                    // Build WHERE conditions - use DATE directly
                    const pmConditions = [
                        `${pmSrc.f.date} BETWEEN '${startRange.format('YYYY-MM-DD')}' AND '${endRange.format('YYYY-MM-DD')}'`
                    ];

                    // Add platform filter (multi-value support)
                    const platformCond = buildPlatformChannelCond(platform, channel, pmSrc.f.platform, false, pmSrc.f.channel);
                    if (platformCond) {
                        pmConditions.push(platformCond);
                    }

                    // Add brand filter (mapped to brand for pmSrc.table)
                    const brandArrLocal = normalizeFilterArray(brand);
                    if (brandArrLocal && brandArrLocal.length > 0) {
                        const brandConds = brandArrLocal.map(b => `'${escapeStr(b).toLowerCase()}'`).join(',');
                        pmConditions.push(`lower(${pmSrc.f.brand}) IN (${brandConds})`);
                    }

                    const catArrLocal = normalizeFilterArray(category);
                    if (catArrLocal && catArrLocal.length > 0) {
                        const catConds = catArrLocal.map(c => `'${escapeStr(c)}'`).join(',');
                        pmConditions.push(`${pmSrc.f.category} IN (${catConds})`);
                    }

                    const offtakeConditions = buildOfftakeConditions(startRange, endRange);

                    const [pmResults, offtakeResults] = await Promise.all([
                        queryClickHouse(`
                            SELECT 
                                formatDateTime(${pmSrc.f.date}, '%Y-%m-01') as month,
                                SUM(${pmSrc.f.adSales}) as total_Ad_sales,
                                SUM(${pmSrc.f.orders}) as total_orders,
                                SUM(${pmSrc.f.clicks}) as total_clicks,
                                SUM(${pmSrc.f.impressions}) as total_impressions,
                                SUM(${pmSrc.f.spend}) as total_spend
                            FROM ${pmSrc.table}
                            WHERE ${pmConditions.join(' AND ')}
                            GROUP BY month
                            ORDER BY month ASC
                        `),
                        queryClickHouse(`
                            SELECT 
                                formatDateTime(${src.isAgg ? 'date' : 'toDate(DATE)'}, '%Y-%m-01') as month,
                                SUM(${src.f.sales}) as total_sales,
                                SUM(IF(${src.isAgg ? 'comp_flag' : 'Comp_flag'} = 0, ${src.f.sales}, 0)) as total_sales_comp0
                            FROM ${src.table}
                            WHERE ${offtakeConditions}
                            GROUP BY month
                        `)
                    ]);

                    // Map offtake results by month
                    const offtakeMap = new Map();
                    const offtakeComp0Map = new Map();
                    offtakeResults.forEach(r => {
                        offtakeMap.set(r.month, parseFloat(r.total_sales || 0));
                        offtakeComp0Map.set(r.month, parseFloat(r.total_sales_comp0 || 0));
                    });

                    // Initialize all months with missing data
                    months.forEach(m => {
                        const mKey = `${m}-01`;
                        dataByMonth.set(mKey, {
                            hasPmData: false,
                            sales: offtakeMap.get(mKey) || 0,
                            salesComp0: offtakeComp0Map.get(mKey) || 0,
                            adSales: 0,
                            orders: 0,
                            clicks: 0,
                            impressions: 0,
                            spend: 0
                        });
                    });

                    pmResults.forEach(row => {
                        dataByMonth.set(row.month, {
                            hasPmData: true, // Data exists for this month
                            sales: offtakeMap.get(row.month) || 0,
                            salesComp0: offtakeComp0Map.get(row.month) || 0,
                            adSales: parseFloat(row.total_Ad_sales || 0),
                            orders: parseFloat(row.total_orders || 0),
                            clicks: parseFloat(row.total_clicks || 0),
                            impressions: parseFloat(row.total_impressions || 0),
                            spend: parseFloat(row.total_spend || 0)
                        });
                    });

                    return dataByMonth;
                };

                // Fetch ALL months data in ONE query (current + MoM + last 7 months)
                const timerLabel = `[Performance KPIs] Bulk GROUP BY Fetch ${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                console.time(timerLabel);

                const earliestDate = last7Months[0].start;

                // Generate unique key for this specific computation - handle arrays
                const brandKey = Array.isArray(brand) ? brand.sort().join(',') : (brand || 'null');
                const locationKey = Array.isArray(location) ? location.sort().join(',') : (location || 'null');
                const coalesceKey = `perf-kpi:${platform}:${earliestDate.format('YYYY-MM')}:${endDate.format('YYYY-MM')}:${brandKey}:${locationKey}:${channel || 'null'}`;

                // Use coalesceRequest to prevent cache stampede
                let bulkData;
                try {
                    bulkData = await coalesceRequest(coalesceKey, async () =>
                        await getBulkPerformanceMetrics(earliestDate, endDate, { brand, platform, location, channel, category: filters.category })
                    );
                } catch (err) {
                    console.error('[Bulk Performance KPIs] Error:', err.message);
                    bulkData = new Map(); // Empty map on error
                }

                console.timeEnd(timerLabel);
                console.log(`[Performance KPIs] Fetched ${bulkData.size} months of data in single query`);

                // Helper functions to extract data from bulk results
                // FIXED: Sum data for ALL months in the date range
                const getDataForRange = (start, end) => {
                    const result = {
                        hasPmData: false, sales: 0, salesComp0: 0, adSales: 0, orders: 0, clicks: 0, impressions: 0, spend: 0
                    };

                    // Iterate through all months in the range and sum the values
                    let current = start.clone().startOf('month');
                    const endMonth = end.clone().endOf('month');

                    while (current.isBefore(endMonth) || current.isSame(endMonth, 'month')) {
                        const monthKey = current.format('YYYY-MM-01');
                        const monthData = bulkData.get(monthKey);

                        if (monthData) {
                            result.hasPmData = result.hasPmData || monthData.hasPmData;
                            result.sales += monthData.sales || 0;
                            result.salesComp0 += monthData.salesComp0 || 0;
                            result.adSales += monthData.adSales || 0;
                            result.orders += monthData.orders || 0;
                            result.clicks += monthData.clicks || 0;
                            result.impressions += monthData.impressions || 0;
                            result.spend += monthData.spend || 0;
                        }

                        current = current.add(1, 'month');
                    }

                    return result;
                };

                const calculateInorganicSales = (data) => {
                    return data.hasPmData ? data.adSales : null;
                };

                const calculateSpend = (data) => {
                    return data.hasPmData ? data.spend : null;
                };

                const calculateOrganicSales = (data) => {
                    const adSales = data.hasPmData ? data.adSales : 0;
                    return (data.salesComp0 || 0) - adSales;
                };

                const calculateRoas = (data) => {
                    return data.hasPmData ? (data.spend > 0 ? data.adSales / data.spend : 0) : null;
                };

                const calculateBmi = (data) => {
                    return data.hasPmData ? (data.sales > 0 ? (data.spend / data.sales) * 100 : 0) : null;
                };

                const calculateConversionLocal = (data) => {
                    return data.hasPmData ? calculateConversion(data.orders, data.impressions, data.clicks) : null;
                };

                const calculateAov = (data) => {
                    return data.hasPmData ? (data.orders > 0 ? data.adSales / data.orders : 0) : null;
                };

                // Extract data for current and MoM periods using precise fetch for exact date range accuracy
                const [currentData, momData] = await Promise.all([
                    getPrecisePerformanceMetrics(startDate, endDate, { brand, platform, location, channel, category: filters.category }),
                    getPrecisePerformanceMetrics(momStartDate, momEndDate, { brand, platform, location, channel, category: filters.category })
                ]);

                // Calculate trend data for all KPIs from bulk results
                const inorgTrendData = last7Months.map(m => calculateInorganicSales(getDataForRange(m.start, m.end)));
                const spendTrendData = last7Months.map(m => calculateSpend(getDataForRange(m.start, m.end)));
                const convTrendData = last7Months.map(m => calculateConversionLocal(getDataForRange(m.start, m.end)));
                const roasTrendData = last7Months.map(m => calculateRoas(getDataForRange(m.start, m.end)));
                const bmiTrendData = last7Months.map(m => calculateBmi(getDataForRange(m.start, m.end)));
                const aovTrendData = last7Months.map(m => calculateAov(getDataForRange(m.start, m.end)));

                // Calculate current and MoM values for each KPI
                const currentInorg = calculateInorganicSales(currentData);
                const momInorg = calculateInorganicSales(momData);
                const inorgChange = (momInorg !== null && currentInorg !== null) ? (momInorg > 0 ? ((currentInorg - momInorg) / momInorg) * 100 : (currentInorg > 0 ? 100 : 0)) : null;

                const currentSpend = calculateSpend(currentData);
                const momSpend = calculateSpend(momData);
                const spendChange = (momSpend !== null && currentSpend !== null) ? (momSpend > 0 ? ((currentSpend - momSpend) / momSpend) * 100 : (currentSpend > 0 ? 100 : 0)) : null;

                const currentConv = calculateConversionLocal(currentData);
                const momConv = calculateConversionLocal(momData);
                const convChange = (momConv !== null && currentConv !== null) ? (momConv > 0 ? ((currentConv - momConv) / momConv) * 100 : (currentConv > 0 ? 100 : 0)) : null;

                const currentRoas = calculateRoas(currentData);
                const momRoas = calculateRoas(momData);
                const roasChange = (momRoas !== null && currentRoas !== null) ? (momRoas > 0 ? ((currentRoas - momRoas) / momRoas) * 100 : (currentRoas > 0 ? 100 : 0)) : null;

                const currentAov = calculateAov(currentData);
                const momAov = calculateAov(momData);
                const aovTrendChange = (momAov !== null && currentAov !== null) ? (momAov > 0 ? ((currentAov - momAov) / momAov) * 100 : (currentAov > 0 ? 100 : 0)) : null;

                const currentOrders = currentData.hasPmData ? currentData.orders : null;
                const momOrders = momData.hasPmData ? momData.orders : null;
                const ordersChange = (momOrders !== null && currentOrders !== null) ? (momOrders > 0 ? ((currentOrders - momOrders) / momOrders) * 100 : (currentOrders > 0 ? 100 : 0)) : null;

                const currentBmi = calculateBmi(currentData);
                const momBmi = calculateBmi(momData);
                const bmiChange = (momBmi !== null && currentBmi !== null) ? (momBmi > 0 ? ((currentBmi - momBmi) / momBmi) * 100 : (currentBmi > 0 ? 100 : 0)) : null;

                // SOS KPI (USES prevShareOfSearch computed for top metrics for consistency)
                const currentSosKpi = currentShareOfSearch;
                const momSosKpi = prevShareOfSearch;
                const sosKpiChange = currentSosKpi - momSosKpi; // Calculate% difference instead of % growth

                // OPTIMIZED: SOS Trend using bulk GROUP BY query instead of 7 individual queries
                let sosTrendKpiData;
                try {
                    const sosEscapeStr = (str) => str ? str.replace(/'/g, "''") : '';
                    const sosStartDate = last7Months[0].start;
                    const sosEndDate = last7Months[6].end;

                    const sosBaseConds = [
                        `toDate(DATE) BETWEEN '${sosStartDate.format('YYYY-MM-DD')}' AND '${sosEndDate.format('YYYY-MM-DD')}'`
                    ];
                    const platArrSos = normalizeFilterArray(platform);
                    if (platArrSos && platArrSos.length > 0) {
                        sosBaseConds.push(`platform_name IN (${platArrSos.map(p => `'${sosEscapeStr(p)}'`).join(', ')})`);
                    }
                    const locArr = normalizeFilterArray(location);
                    if (locArr && locArr.length > 0) {
                        if (locArr.length === 1) {
                            sosBaseConds.push(`location_name = '${sosEscapeStr(locArr[0])}'`);
                        } else {
                            sosBaseConds.push(`location_name IN (${locArr.map(l => `'${sosEscapeStr(l)}'`).join(', ')})`);
                        }
                    }
                    const catArr = normalizeFilterArray(category);
                    if (catArr && catArr.length > 0) {
                        if (catArr.length === 1) {
                            sosBaseConds.push(`keyword_category = '${sosEscapeStr(catArr[0])}'`);
                        } else {
                            sosBaseConds.push(`keyword_category IN (${catArr.map(c => `'${sosEscapeStr(c)}'`).join(', ')})`);
                        }
                    }

                    const sosNumConds = [...sosBaseConds];
                    const brandArrLocal = normalizeFilterArray(brand);
                    if (brandArrLocal && brandArrLocal.length > 0) {
                        sosNumConds.push(`brand IN (${brandArrLocal.map(b => `'${sosEscapeStr(b)}'`).join(', ')})`);
                    } else {
                        sosNumConds.push(`toString(flag) = '1'`);
                    }

                    // 2 queries: numerator uses countIf(overall=1), denominator uses count()
                    // POSITION <= 10 constraint: Only consider top 10 positions for SOS
                    const [sosNumByMonth, sosDenomByMonth] = await Promise.all([
                        queryClickHouse(`
                            SELECT formatDateTime(toDate(DATE), '%Y-%m-01') as month, sumIf(toInt32(overall), POSITION <= 10) as count
                            FROM rb_kw_olap WHERE ${sosNumConds.join(' AND ')}
                            GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                        `),
                        queryClickHouse(`
                            SELECT formatDateTime(toDate(DATE), '%Y-%m-01') as month, sumIf(toInt32(overall), POSITION <= 10) as count
                            FROM rb_kw_olap WHERE ${sosBaseConds.join(' AND ')}
                            GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                        `)
                    ]);

                    const sosNumMap = new Map(sosNumByMonth.map(r => [r.month, parseInt(r.count)]));
                    const sosDenomMap = new Map(sosDenomByMonth.map(r => [r.month, parseInt(r.count)]));

                    sosTrendKpiData = last7Months.map(m => {
                        const monthKey = m.start.format('YYYY-MM-01');
                        const num = (sosNumMap.has(monthKey) || sosDenomMap.has(monthKey)) ? (sosNumMap.get(monthKey) || 0) : null;
                        const denom = sosDenomMap.get(monthKey) || 0;

                        if (num === null) return null; // No data at all for this month
                        return denom > 0 ? (num / denom) * 100 : 0;
                    });

                    console.log(`[SOS Trend] OPTIMIZED: Fetched 7 months with 2 bulk queries`);
                } catch (err) {
                    console.error('[SOS Trend] Error:', err.message);
                    sosTrendKpiData = Array(7).fill(0);
                }

                // OSA KPI (uses availability data already computed)
                const currentOsa = currentAvailability;
                const momOsa = prevAvailability;
                const osaAbsChange = currentOsa - momOsa;

                // OPTIMIZED: OSA Trend using bulk GROUP BY query instead of 7 individual queries
                let osaTrendData;
                try {
                    const osaEscapeStr = (str) => str ? str.replace(/'/g, "''") : '';
                    const osaStartDate = last7Months[0].start;
                    const osaEndDate = last7Months[6].end;

                    const osaConds = [
                        `${src.isAgg ? 'date' : 'toDate(DATE)'} BETWEEN '${osaStartDate.format('YYYY-MM-DD')}' AND '${osaEndDate.format('YYYY-MM-DD')}'`
                    ];
                    const brandArrOsa = normalizeFilterArray(brand);
                    if (brandArrOsa && brandArrOsa.length > 0) {
                        const brandConds = brandArrOsa.map(b => `${src.f.brand} LIKE '%${osaEscapeStr(b)}%'`).join(' OR ');
                        osaConds.push(`(${brandConds})`);
                    }
                    const platArrOsa = normalizeFilterArray(platform);
                    if (platArrOsa && platArrOsa.length > 0) {
                        osaConds.push(`${src.f.platform} IN (${platArrOsa.map(p => `'${osaEscapeStr(p)}'`).join(', ')})`);
                    }
                    const locArr = normalizeFilterArray(location);
                    if (locArr && locArr.length > 0) {
                        if (locArr.length === 1) {
                            osaConds.push(`${src.f.location} = '${osaEscapeStr(locArr[0])}'`);
                        } else {
                            osaConds.push(`${src.f.location} IN (${locArr.map(l => `'${osaEscapeStr(l)}'`).join(', ')})`);
                        }
                    }
                    const catArr = normalizeFilterArray(category);
                    if (catArr && catArr.length > 0) {
                        if (catArr.length === 1) {
                            osaConds.push(`${src.f.category} = '${osaEscapeStr(catArr[0])}'`);
                        } else {
                            osaConds.push(`${src.f.category} IN (${catArr.map(c => `'${osaEscapeStr(c)}'`).join(', ')})`);
                        }
                    }

                    // 1 query instead of 7
                    const osaByMonth = await queryClickHouse(`
                        SELECT 
                            formatDateTime(${src.isAgg ? 'date' : 'toDate(DATE)'}, '%Y-%m-01') as month,
                            SUM(${src.f.neno}) as total_neno,
                            SUM(${src.f.deno}) as total_deno
                        FROM ${src.table}
                        WHERE ${osaConds.join(' AND ')}
                        GROUP BY month
                    `);

                    const osaMap = new Map(osaByMonth.map(r => [r.month, { neno: parseFloat(r.total_neno || 0), deno: parseFloat(r.total_deno || 0) }]));

                    osaTrendData = last7Months.map(m => {
                        const monthKey = m.start.format('YYYY-MM-01');
                        const data = osaMap.get(monthKey);
                        if (!data) return null; // No data for this month
                        return data.deno > 0 ? (data.neno / data.deno) * 100 : 0;
                    });

                    console.log(`[OSA Trend] OPTIMIZED: Fetched 7 months with 1 bulk query`);
                } catch (err) {
                    console.error('[OSA Trend] Error:', err.message);
                    osaTrendData = Array(7).fill(0);
                }

                let osaStatus = "stable";
                if (currentOsa !== null && momOsa !== null) {
                    if (osaAbsChange > 1) osaStatus = "improving";
                    else if (osaAbsChange < -1) osaStatus = "declining";
                } else if (currentOsa === null) {
                    osaStatus = "stable"; // Or perhaps "unknown/null"
                }

                // Build KPI cards
                // 1. Share of Search
                performanceMetricsKpis.push({
                    id: "sos_new",
                    label: "SHARE OF SEARCH",
                    value: currentSosKpi !== null ? `${currentSosKpi.toFixed(2)}%` : "N/A",
                    prevValue: momSosKpi !== null ? `${momSosKpi.toFixed(2)}%` : "N/A",
                    unit: "",
                    tag: (currentSosKpi !== null && momSosKpi !== null) ? `${sosKpiChange >= 0 ? '+' : ''}${sosKpiChange.toFixed(2)}%` : "N/A",
                    tagTone: (currentSosKpi !== null && momSosKpi !== null) ? (sosKpiChange >= 0 ? "positive" : "warning") : "neutral",
                    footer: "Organic + Paid view",
                    trendTitle: "Share of Search Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: sosTrendKpiData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

                // 2. Inorganic Sales
                const currentOrganic = calculateOrganicSales(currentData);
                performanceMetricsKpis.push({
                    id: "inorganic",
                    label: "INORGANIC SALES",
                    value: currentInorg !== null ? formatCurrency(currentInorg) : "N/A",
                    prevValue: momInorg !== null ? formatCurrency(momInorg) : "N/A",
                    organicSales: currentOrganic !== null ? formatCurrency(currentOrganic) : "N/A",
                    unit: "",
                    tag: inorgChange !== null ? `${inorgChange >= 0 ? '+' : ''}${inorgChange.toFixed(2)}%` : "N/A",
                    tagTone: inorgChange !== null ? (inorgChange >= 0 ? "positive" : "warning") : "neutral",
                    footer: "sum(Ad Sales)",
                    trendTitle: "Inorganic Sales Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: inorgTrendData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

                // 2b. Spend
                performanceMetricsKpis.push({
                    id: "spend",
                    label: "SPEND",
                    value: currentSpend !== null ? formatCurrency(currentSpend) : "N/A",
                    prevValue: momSpend !== null ? formatCurrency(momSpend) : "N/A",
                    unit: "",
                    tag: spendChange !== null ? `${spendChange >= 0 ? '+' : ''}${spendChange.toFixed(2)}%` : "N/A",
                    tagTone: spendChange !== null ? (spendChange >= 0 ? "positive" : "warning") : "neutral",
                    footer: "sum(Ad Spend)",
                    trendTitle: "Spend Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: spendTrendData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

                // 3. Conversion
                performanceMetricsKpis.push({
                    id: "conversion",
                    label: "CONVERSION",
                    value: currentConv !== null ? `${currentConv.toFixed(2)}%` : "N/A",
                    prevValue: momConv !== null ? `${momConv.toFixed(2)}%` : "N/A",
                    unit: "%",
                    tag: convChange !== null ? `${convChange >= 0 ? '+' : ''}${convChange.toFixed(2)}%` : "N/A",
                    tagTone: convChange !== null ? (convChange >= 0 ? "positive" : "warning") : "neutral",
                    footer: "Orders / Clicks",
                    trendTitle: "Conversion Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: convTrendData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

                // 4. ROAS
                performanceMetricsKpis.push({
                    id: "roas_new",
                    label: "ROAS",
                    value: currentRoas !== null ? currentRoas.toFixed(2) : "N/A",
                    prevValue: momRoas !== null ? momRoas.toFixed(2) : "N/A",
                    unit: "",
                    tag: roasChange !== null ? `${roasChange >= 0 ? '+' : ''}${roasChange.toFixed(2)}%` : "N/A",
                    tagTone: roasChange !== null ? (roasChange >= 0 ? "positive" : "warning") : "neutral",
                    footer: "Return on Ad Spend",
                    trendTitle: "ROAS Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: roasTrendData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

                // 5. Orders (Using actual 'orders' property calculated from Ad_Quantity_sold previously)
                const ordersTrendData = last7Months.map(m => getDataForRange(m.start, m.end).hasPmData ? getDataForRange(m.start, m.end).orders : null);
                const formatter = Intl.NumberFormat('en', { notation: 'compact' });
                performanceMetricsKpis.push({
                    id: "orders",
                    label: "ORDERS",
                    value: currentOrders !== null ? (currentOrders >= 1000 ? formatter.format(currentOrders) : currentOrders.toString()) : "N/A",
                    prevValue: momOrders !== null ? (momOrders >= 1000 ? formatter.format(momOrders) : momOrders.toString()) : "N/A",
                    unit: "",
                    tag: ordersChange !== null ? `${ordersChange >= 0 ? '+' : ''}${ordersChange.toFixed(2)}%` : "N/A",
                    tagTone: ordersChange !== null ? (ordersChange >= 0 ? "positive" : "warning") : "neutral",
                    footer: "Ad Quantity Sold",
                    trendTitle: "Orders Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: ordersTrendData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

                // 6. AOV
                performanceMetricsKpis.push({
                    id: "aov",
                    label: "AOV",
                    value: currentAov !== null ? formatCurrency(currentAov) : "N/A",
                    prevValue: momAov !== null ? formatCurrency(momAov) : "N/A",
                    unit: "",
                    tag: aovTrendChange !== null ? `${aovTrendChange >= 0 ? '+' : ''}${aovTrendChange.toFixed(2)}%` : "N/A",
                    tagTone: aovTrendChange !== null ? (aovTrendChange >= 0 ? "positive" : "warning") : "neutral",
                    footer: "Ad Sales / Ad Orders",
                    trendTitle: "AOV Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: aovTrendData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });


            } catch (err) {
                console.error("Error calculating Performance Metrics KPIs:", err);
            }
        } // End of if (!skipPerformanceKpis)

        // ===== EARLY RETURN: Skip heavy sections when only overview is needed =====
        if (onlyOverview) {
            console.log('[computeSummaryMetrics] onlyOverview=true, skipping Platform/Month/Category/Brands sections');
            return {
                topMetrics,
                summaryMetrics,
                performanceMetricsKpis,
                skuTable: skuTableData,
                platformOverview: [],
                monthOverview: [],
                categoryOverview: [],
                brandsOverview: []
            };
        }
        // ===== END EARLY RETURN =====

        // 4. Platform Overview Calculation
        // Helper function to map platform names to logos
        const getPlatformLogo = (platformName) => {
            const logoMap = {
                'zepto': 'https://upload.wikimedia.org/wikipedia/en/7/7d/Logo_of_Zepto.png',
                'blinkit': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Blinkit-yellow-rounded.svg',
                'swiggy': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Swiggy_Logo_2024.webp',
                'amazon': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
                'flipkart': 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Flipkart-logo.png',
                'bigbasket': 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Bigbasket_logo.png',
                'jiomart': 'https://upload.wikimedia.org/wikipedia/commons/0/0e/JioMart_logo.png'
            };
            return logoMap[platformName.toLowerCase()] || 'https://cdn-icons-png.flaticon.com/512/3502/3502685.png';
        };

        // Helper function to determine platform type
        const getPlatformType = (platformName) => {
            const qCommercePlatforms = ['zepto', 'blinkit', 'swiggy instamart', 'instamart', 'dunzo'];
            const marketplacePlatforms = ['amazon', 'flipkart', 'swiggy', 'bigbasket', 'jiomart'];

            const lowerName = platformName.toLowerCase();
            if (qCommercePlatforms.some(p => lowerName.includes(p))) return 'Q-commerce';
            if (marketplacePlatforms.some(p => lowerName.includes(p))) return 'Marketplace';
            return 'E-commerce';
        };

        // Fetch all distinct platforms from rca_sku_dim table (as per user requirement)
        let platformDefinitions = [];
        try {
            // Check cache first
            const cachedPlatforms = await getCachedDistinctPlatforms();
            if (cachedPlatforms) {
                platformDefinitions = cachedPlatforms;
            } else {
                // Fetch platforms from rca_sku_dim table using ClickHouse
                const platformsFromDb = await queryClickHouse(`
                    SELECT DISTINCT platform FROM rca_sku_dim WHERE platform IS NOT NULL AND platform != '' ORDER BY platform
                `);

                // Build platform definitions from database results
                platformDefinitions = platformsFromDb
                    .map(p => p.platform)
                    .filter(p => p && p.trim())  // Filter out empty/null values
                    .map(platformName => ({
                        key: platformName.toLowerCase().replace(/\s+/g, '_'),
                        label: platformName.charAt(0).toUpperCase() + platformName.slice(1),  // Capitalize first letter
                        type: getPlatformType(platformName),
                        logo: getPlatformLogo(platformName)
                    }));

                // Cache the result
                cacheDistinctPlatforms(platformDefinitions);
                console.log(`[Platform Overview] Fetched ${platformDefinitions.length} platforms from rca_sku_dim:`, platformDefinitions.map(p => p.label));
            }

            // Filter platform definitions based on channel AFTER cache block
            if (channel === 'Ecommerce' || channel === 'E-commerce' || channel === 'Ecom') {
                const ecomPlatforms = ['blinkit', 'zepto', 'instamart', 'swiggy', 'amazon', 'flipkart', 'bigbasket', 'jiomart'];
                platformDefinitions = platformDefinitions.filter(p => ecomPlatforms.some(ep => p.label.toLowerCase().includes(ep)));
            } else if (channel === 'Modern Trades' || channel === 'ModernTrade') {
                const ecomPlatforms = ['blinkit', 'zepto', 'instamart', 'swiggy', 'amazon', 'flipkart', 'bigbasket', 'jiomart'];
                platformDefinitions = platformDefinitions.filter(p => !ecomPlatforms.some(ep => p.label.toLowerCase().includes(ep)));
            }
        } catch (err) {
            console.error("Error fetching platforms from database:", err);
            // Fallback to hardcoded platforms if database query fails
            platformDefinitions = [
                { key: 'zepto', label: 'Zepto', type: 'Q-commerce', logo: getPlatformLogo('zepto') },
                { key: 'blinkit', label: 'Blinkit', type: 'Q-commerce', logo: getPlatformLogo('blinkit') },
                { key: 'swiggy', label: 'Swiggy', type: 'Marketplace', logo: getPlatformLogo('swiggy') },
                { key: 'amazon', label: 'Amazon', type: 'Marketplace', logo: getPlatformLogo('amazon') }
            ];
        }

        // Apply platform permissions filter from platformArr (if present)
        if (platformArr && platformArr.length > 0) {
            platformDefinitions = platformDefinitions.filter(p =>
                platformArr.some(pa => p.label.toLowerCase() === pa.toLowerCase() || p.key.toLowerCase() === pa.toLowerCase().replace(/\s+/g, '_'))
            );
        }

        const platformOverview = [];

        // Helper functions for change calculations
        const calcChange = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        const calcPPChange = (current, previous) => {
            return current - previous; // Percentage point change
        };

        const formatChange = (changeValue, isPercentagePoint = false) => {
            const suffix = isPercentagePoint ? '%' : ''; // Changed to empty string for percentage point changes
            const sign = changeValue >= 0 ? '+' : '';
            return `${sign}${changeValue.toFixed(2)}${suffix}`;
        };

        // Helper to generate columns structure with MoM changes
        const generateColumns = (
            // Current period values
            offtake, availability, sos, marketShare = 0, spend = 0, roas = 0, inorgSales = 0,
            conversion = 0, cpm = 0, cpc = 0, promoMyBrand = 0, promoCompete = 0, buyBoxPct = 0,
            // Previous period values (for MoM calculation)
            prevOfftake = 0, prevAvailability = 0, prevSos = 0, prevMarketShare = 0,
            prevSpend = 0, prevRoas = 0, prevInorgSales = 0, prevConversion = 0,
            prevCpm = 0, prevCpc = 0, prevPromoMyBrand = 0, prevPromoCompete = 0, prevBuyBoxPct = 0
        ) => {
            // Calculate changes
            const offtakeChange = calcChange(offtake, prevOfftake);
            const spendChange = calcChange(spend, prevSpend);
            const roasChange = calcChange(roas, prevRoas);
            const inorgSalesChange = calcChange(inorgSales, prevInorgSales);
            const conversionChange = calcPPChange(conversion, prevConversion);
            const availabilityChange = calcPPChange(availability, prevAvailability);
            const sosChange = calcPPChange(sos, prevSos);
            const marketShareChange = calcPPChange(marketShare, prevMarketShare);
            const promoMyBrandChange = calcPPChange(promoMyBrand, prevPromoMyBrand);
            const promoCompeteChange = calcPPChange(promoCompete, prevPromoCompete);
            const cpmChange = calcChange(cpm, prevCpm);
            const cpcChange = calcChange(cpc, prevCpc);

            return [
                {
                    title: "Offtakes",
                    value: formatCurrency(offtake),
                    change: { text: formatChange(offtakeChange), positive: offtakeChange >= 0 },
                    meta: { units: "units", change: formatChange(offtakeChange) }
                },
                {
                    title: "Spend",
                    value: formatCurrency(spend),
                    change: { text: formatChange(spendChange), positive: spendChange >= 0 },
                    meta: { units: "₹0", change: formatChange(spendChange) }
                },
                {
                    title: "ROAS",
                    value: `${roas.toFixed(2)}x`,
                    change: { text: formatChange(roasChange), positive: roasChange >= 0 },
                    meta: { units: "₹0 return", change: formatChange(roasChange) }
                },
                {
                    title: "Inorg Sales",
                    value: formatCurrency(inorgSales),
                    change: { text: formatChange(inorgSalesChange), positive: inorgSalesChange >= 0 },
                    meta: { units: "sum(Ad_sales)", change: formatChange(inorgSalesChange) }
                },
                {
                    title: "Conversion",
                    value: `${conversion.toFixed(2)}%`,
                    change: { text: formatChange(conversionChange, true), positive: conversionChange >= 0 },
                    meta: { units: "Orders / Clicks", change: formatChange(conversionChange, true) }
                },
                {
                    title: "Availability",
                    value: `${availability.toFixed(2)}%`,
                    change: { text: formatChange(availabilityChange, true), positive: availabilityChange >= 0 },
                    meta: { units: "stores", change: formatChange(availabilityChange, true) }
                },
                {
                    title: "SOS",
                    value: `${sos.toFixed(2)}%`,
                    change: { text: formatChange(sosChange, true), positive: sosChange >= 0 },
                    meta: { units: "index", change: formatChange(sosChange, true) }
                },
                {
                    title: "Market Share",
                    value: `${(parseFloat(marketShare) || 0).toFixed(2)}%`,
                    change: { text: formatChange(marketShareChange, true), positive: marketShareChange >= 0 },
                    meta: { units: "Category", change: formatChange(marketShareChange, true) }
                },
                {
                    title: "Buy Box %",
                    value: `${(parseFloat(buyBoxPct) || 0).toFixed(2)}%`,
                    change: { text: formatChange(calcPPChange(buyBoxPct, prevBuyBoxPct), true), positive: calcPPChange(buyBoxPct, prevBuyBoxPct) >= 0 },
                    meta: { units: "Calculated", change: formatChange(calcPPChange(buyBoxPct, prevBuyBoxPct), true) }
                },
                {
                    title: "Promo Compete",
                    value: `${promoCompete.toFixed(2)}%`,
                    change: { text: formatChange(promoCompeteChange, true), positive: promoCompeteChange >= 0 },
                    meta: { units: "Depth", change: formatChange(promoCompeteChange, true) }
                },
                {
                    title: "CPM",
                    value: `₹${cpm.toFixed(2)}`,
                    change: { text: formatChange(cpmChange), positive: cpmChange >= 0 },
                    meta: { units: "impressions", change: formatChange(cpmChange) }
                },
                {
                    title: "CPC",
                    value: `₹${cpc.toFixed(2)}`,
                    change: { text: formatChange(cpcChange), positive: cpcChange >= 0 },
                    meta: { units: "clicks", change: formatChange(cpcChange) }
                },
            ];
        };

        // Calculate "All" Metrics (Global Aggregate)
        // Note: For "All", we ignore the specific platform loop but respect the global filters (Brand, Location, Date)
        // However, if the user *selected* a platform in the main filter, "All" usually means "All Platforms" ignoring the platform filter?
        // Or does it mean "All Platforms" *within* the selected context?
        // Usually "Platform Overview" shows comparison across platforms, so "All" should likely be the aggregate of ALL platforms, regardless of the single platform filter.
        // But if the user selected "Zepto", the "All" column in a table comparing Zepto vs Blinkit vs Swiggy usually represents the Total of those rows.
        // Let's assume "All" means "All Platforms" (ignoring the platform filter for this specific column calculation).

        // Use the same MoM dates as Watch Tower Overview (respects frontend-supplied compare dates)
        const allMomStart = momStartDate;
        const allMomEnd = momEndDate;

        let allOfftake = 0;
        let allAvailability = 0;
        let allSos = 0;
        let allMarketShare = 0;
        let allPromoMyBrand = 0;
        let allPromoCompete = 0;
        // Added missing KPIs for "All" column
        let allSpend = 0;
        let allAdSales = 0;
        let allRoas = 0;
        let allConversion = 0;
        let allCpm = 0;
        let allCpc = 0;
        let allBuyBoxNeno = 0;
        let allDeno = 0;

        // Previous period values for All row
        let prevAllOfftake = 0;
        let prevAllAvailability = 0;
        let prevAllSos = 0;
        let prevAllMarketShare = 0;
        let prevAllPromoMyBrand = 0;
        let prevAllPromoCompete = 0;
        let prevAllSpend = 0;
        let prevAllAdSales = 0;
        let prevAllRoas = 0;
        let prevAllConversion = 0;
        let prevAllCpm = 0;
        let prevAllCpc = 0;
        let prevAllBuyBoxNeno = 0;
        let prevAllDeno = 0;

        // Helper for Promo Depth via ClickHouse (needed by both "All" metrics and per-platform loop)
        const getPromoDepthCH = async (startDt, endDt, targetBrand, isCompete = false, plat = null, s = src) => {
            const dayjsStart = dayjs(startDt);
            const dayjsEnd = dayjs(endDt);
            const dateCol = s.isAgg ? 'date' : 'toDate(DATE)';
            const conds = [`${dateCol} BETWEEN '${dayjsStart.format('YYYY-MM-DD')}' AND '${dayjsEnd.format('YYYY-MM-DD')}'`];
            if (plat && plat !== 'All') conds.push(`${s.f.platform} = '${escapeStrMain(plat)}'`);
            const locArr = normalizeFilterArray(location);
            if (locArr && locArr.length > 0) {
                conds.push(`${s.f.location} IN (${locArr.map(l => `'${escapeStrMain(l)}'`).join(', ')})`);
            }

            // Apply Product_Category filter for rb_pdp_olap
            const catArrLocal = normalizeFilterArray(filters.category);
            if (catArrLocal && catArrLocal.length > 0) {
                conds.push(`${s.f.category} IN (${catArrLocal.map(c => `'${escapeStrMain(c)}'`).join(', ')})`);
            }


            if (isCompete) {
                conds.push(`${s.f.compFlag} = '1'`);
                if (targetBrand && targetBrand !== 'All') {
                    const bnds = Array.isArray(targetBrand) ? targetBrand : [targetBrand];
                    const bNotConds = bnds.filter(b => b && b !== 'All').map(b => `${s.f.brand} NOT LIKE '%${escapeStrMain(b)}%'`).join(' AND ');
                    if (bNotConds) conds.push(`(${bNotConds})`);
                }
            } else {
                conds.push(`${s.f.compFlag} = '0'`);
                if (targetBrand && targetBrand !== 'All') {
                    const bnds = Array.isArray(targetBrand) ? targetBrand : [targetBrand];
                    const bConds = bnds.filter(b => b && b !== 'All').map(b => `${s.f.brand} LIKE '%${escapeStrMain(b)}%'`).join(' OR ');
                    if (bConds) conds.push(`(${bConds})`);
                }
            }

            const q = `
                    SELECT (SUM(${s.f.mrp}) - SUM(${s.f.sellingPrice})) / NULLIF(SUM(${s.f.mrp}), 0) as avg_depth
                    FROM ${s.table}
                    WHERE ${conds.join(' AND ')} AND neno_osa > 0
                `;
            try {
                const res = await queryClickHouse(q);
                return parseFloat(res?.[0]?.avg_depth || 0) * 100;
            } catch (e) {
                console.error("Promo Depth CH Error:", e);
                return 0;
            }
        };

        try {
            // Build ClickHouse conditions for current period
            const buildAllConditionsLocal = (startDt, endDt, s, isPm = false) => {
                const dateCol = isPm ? s.f.date : (s.isAgg ? 'date' : 'toDate(DATE)');
                const conditions = [`${dateCol} BETWEEN '${startDt}' AND '${endDt}'`];
                if (brandArr && brandArr.length > 0) {
                    const brandConds = brandArr.map(b => `${s.f.brand} LIKE '%${escapeStr(b)}%'`).join(' OR ');
                    conditions.push(`(${brandConds})`);
                }
                const locArr = normalizeFilterArray(location);
                if (!isPm && locArr && locArr.length > 0) {
                    if (locArr.length === 1) {
                        conditions.push(`${s.f.location} = '${escapeStr(locArr[0])}'`);
                    } else {
                        conditions.push(`${s.f.location} IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                    }
                } else if (isPm && locArr && locArr.length > 0) {
                    conditions.push(`lower(${s.f.location}) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
                }

                // Apply Product_Category filter
                const catArrLocal = normalizeFilterArray(filters.category);
                if (catArrLocal && catArrLocal.length > 0) {
                    const col = isPm ? s.f.category : s.f.category;
                    conditions.push(`${col} IN (${catArrLocal.map(c => `'${escapeStr(c)}'`).join(', ')})`);
                }

                // Apply channel-based platform filter
                if (platformArr && platformArr.length > 0) {
                    const cond = buildPlatformChannelCond(platformArr, channel, s.f.platform);
                    if (cond) conditions.push(cond);
                } else {
                    const cond = buildPlatformChannelCond(null, channel, s.f.platform);
                    if (cond) conditions.push(cond);
                }

                return conditions.join(' AND ');
            };

            const pmSrc = await getPmSource();
            const pmChannelColSql = pmSrc.f.channel ? `lower(${pmSrc.f.channel})` : `(CASE WHEN lower(${pmSrc.f.platform}) IN ('amazon', 'flipkart', 'myntra', 'nykaa', 'jiomart') THEN 'ecommerce' WHEN lower(${pmSrc.f.platform}) IN ('blinkit', 'zepto', 'instamart', 'swiggy', 'bbnow') THEN 'quickcomm' ELSE 'other' END)`;

            const currConditions = buildAllConditionsLocal(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), src, false);
            const prevConditions = buildAllConditionsLocal(allMomStart.format('YYYY-MM-DD'), allMomEnd.format('YYYY-MM-DD'), src, false);
            const currPmConditions = buildAllConditionsLocal(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), pmSrc, true);
            const prevPmConditions = buildAllConditionsLocal(allMomStart.format('YYYY-MM-DD'), allMomEnd.format('YYYY-MM-DD'), pmSrc, true);

            // Fetch current and previous period metrics in parallel using ClickHouse
            const [allMetricsResult, prevAllMetricsResult, allPmMetricsResult, prevAllPmMetricsResult] = await Promise.all([
                queryClickHouse(`
                    SELECT 
                        SUM(${src.f.sales}) as total_sales,
                        SUM(${src.f.spend}) as total_spend,
                        SUM(${src.f.adSales}) as total_Ad_sales,
                        SUM(${src.f.clicks}) as total_clicks,
                        SUM(${src.f.impressions}) as total_impressions,
                        SUM(${src.f.buyBoxNeno} * 1.0) as total_buy_box_neno,
                        SUM(${src.f.deno} * 1.0) as total_deno
                    FROM ${src.table}
                    WHERE ${currConditions}
                `),
                queryClickHouse(`
                    SELECT 
                        SUM(${src.f.sales}) as total_sales,
                        SUM(${src.f.spend}) as total_spend,
                        SUM(${src.f.adSales}) as total_Ad_sales,
                        SUM(${src.f.clicks}) as total_clicks,
                        SUM(${src.f.impressions}) as total_impressions,
                        SUM(${src.f.buyBoxNeno} * 1.0) as total_buy_box_neno,
                        SUM(${src.f.deno}) as total_deno
                    FROM ${src.table}
                    WHERE ${prevConditions}
                `),
                queryClickHouse(`
                    SELECT 
                        SUM(${pmSrc.f.spend}) as total_spend,
                        SUM(${pmSrc.f.adSales}) as total_Ad_sales,
                        SUM(${pmSrc.f.clicks}) as total_clicks,
                        SUM(${pmSrc.f.impressions}) as total_impressions,
                        SUM(${pmSrc.f.orders}) as total_orders,
                        SUM(CASE WHEN ${pmChannelColSql} = 'ecommerce' THEN ${pmSrc.f.spend} ELSE 0 END) as cpc_spend,
                        SUM(CASE WHEN ${pmChannelColSql} = 'ecommerce' THEN ${pmSrc.f.clicks} ELSE 0 END) as cpc_clicks,
                        SUM(CASE WHEN ${pmChannelColSql} = 'quickcomm' THEN ${pmSrc.f.spend} ELSE 0 END) as cpm_spend,
                        SUM(CASE WHEN ${pmChannelColSql} = 'quickcomm' THEN ${pmSrc.f.impressions} ELSE 0 END) as cpm_impressions
                    FROM ${pmSrc.table}
                    WHERE ${currPmConditions}
                `),
                queryClickHouse(`
                    SELECT 
                        SUM(${pmSrc.f.spend}) as total_spend,
                        SUM(${pmSrc.f.adSales}) as total_Ad_sales,
                        SUM(${pmSrc.f.clicks}) as total_clicks,
                        SUM(${pmSrc.f.impressions}) as total_impressions,
                        SUM(${pmSrc.f.orders}) as total_orders,
                        SUM(CASE WHEN ${pmChannelColSql} = 'ecommerce' THEN ${pmSrc.f.spend} ELSE 0 END) as cpc_spend,
                        SUM(CASE WHEN ${pmChannelColSql} = 'ecommerce' THEN ${pmSrc.f.clicks} ELSE 0 END) as cpc_clicks,
                        SUM(CASE WHEN ${pmChannelColSql} = 'quickcomm' THEN ${pmSrc.f.spend} ELSE 0 END) as cpm_spend,
                        SUM(CASE WHEN ${pmChannelColSql} = 'quickcomm' THEN ${pmSrc.f.impressions} ELSE 0 END) as cpm_impressions
                    FROM ${pmSrc.table}
                    WHERE ${prevPmConditions}
                `)
            ]);

            // Current period values (ClickHouse returns array)
            const currMetrics = allMetricsResult[0] || {};
            const currPmMetrics = allPmMetricsResult[0] || {};
            allOfftake = parseFloat(currMetrics.total_sales || 0);
            allSpend = parseFloat(currPmMetrics.total_spend || 0);
            allAdSales = parseFloat(currPmMetrics.total_Ad_sales || 0);
            const allClicks = parseFloat(currPmMetrics.total_clicks || 0);
            const allImpressions = parseFloat(currPmMetrics.total_impressions || 0);
            const allOrders = parseFloat(currPmMetrics.total_orders || 0);
            allBuyBoxNeno = parseFloat(currMetrics.total_buy_box_neno || 0);
            allDeno = parseFloat(currMetrics.total_deno || 0);
            const cpcSpend = parseFloat(currPmMetrics.cpc_spend || 0);
            const cpcClicks = parseFloat(currPmMetrics.cpc_clicks || 0);
            const cpmSpend = parseFloat(currPmMetrics.cpm_spend || 0);
            const cpmImpressions = parseFloat(currPmMetrics.cpm_impressions || 0);

            console.log("ALL COLUMN OFFTAKE VALUES:", {
                allOfftake, currMetrics_totalSales: currMetrics.total_sales, currConditions
            });

            // Previous period values (ClickHouse returns array)
            const prevMetrics = prevAllMetricsResult[0] || {};
            const prevPmMetrics = prevAllPmMetricsResult[0] || {};
            prevAllOfftake = parseFloat(prevMetrics.total_sales || 0);
            prevAllSpend = parseFloat(prevPmMetrics.total_spend || 0);
            prevAllAdSales = parseFloat(prevPmMetrics.total_Ad_sales || 0);
            const prevAllClicks = parseFloat(prevPmMetrics.total_clicks || 0);
            const prevAllImpressions = parseFloat(prevPmMetrics.total_impressions || 0);
            const prevAllOrders = parseFloat(prevPmMetrics.total_orders || 0);
            prevAllBuyBoxNeno = parseFloat(prevMetrics.total_buy_box_neno || 0);
            prevAllDeno = parseFloat(prevMetrics.total_deno || 0);
            const prevCpcSpend = parseFloat(prevPmMetrics.cpc_spend || 0);
            const prevCpcClicks = parseFloat(prevPmMetrics.cpc_clicks || 0);
            const prevCpmSpend = parseFloat(prevPmMetrics.cpm_spend || 0);
            const prevCpmImpressions = parseFloat(prevPmMetrics.cpm_impressions || 0);

            // Calculate derived KPIs - Current
            allRoas = allSpend > 0 ? allAdSales / allSpend : 0;
            allConversion = allClicks > 0 ? (allOrders / allClicks) * 100 : 0;
            allCpm = cpmImpressions > 0 ? (cpmSpend / cpmImpressions) * 1000 : 0;
            allCpc = cpcClicks > 0 ? cpcSpend / cpcClicks : 0;

            // Calculate derived KPIs - Previous
            prevAllRoas = prevAllSpend > 0 ? prevAllAdSales / prevAllSpend : 0;
            prevAllConversion = prevAllClicks > 0 ? (prevAllOrders / prevAllClicks) * 100 : 0;
            prevAllCpm = prevCpmImpressions > 0 ? (prevCpmSpend / prevCpmImpressions) * 1000 : 0;
            prevAllCpc = prevCpcClicks > 0 ? prevCpcSpend / prevCpcClicks : 0;

            // 2. All Availability (current and previous in parallel)
            const [currAvail, prevAvail] = await Promise.all([
                getAvailability(startDate, endDate, brand, null, location, category),
                getAvailability(allMomStart, allMomEnd, brand, null, location, category)
            ]);
            allAvailability = currAvail;
            prevAllAvailability = prevAvail;

            // 3. All SOS (current and previous in parallel)
            const [currSos, prevSos] = await Promise.all([
                getShareOfSearch(startDate, endDate, brand, null, location, category),
                getShareOfSearch(allMomStart, allMomEnd, brand, null, location, category)
            ]);
            allSos = currSos;
            prevAllSos = prevSos;

            // 4. All Market Share using formula: (selected_brand_sales / total_sales) * 100
            // When a specific brand is selected, show that brand's market share
            // When 'All' is selected, show all our brands' combined market share
            const validBrandNamesForMS = await getCachedValidBrandNames();

            // Determine which brands to use for numerator
            const brandsForMsNumerator = (brand && brand !== 'All')
                ? (Array.isArray(brand) ? brand : [brand])  // Use selected brand(s)
                : validBrandNamesForMS;  // Use all our brands

            // Calculate overall Market Share using centralized helper
            allMarketShare = await getMarketShare(startDate, endDate, null, category, brand, location, channel);
            prevAllMarketShare = await getMarketShare(allMomStart, allMomEnd, null, category, brand, location, channel);



            // Calculate Promo Metrics for "All" platforms concurrently
            const [allMyPromo, allCompetePromo, prevMyPromo, prevCompetePromo] = await Promise.all([
                getPromoDepthCH(startDate, endDate, brand, false, null, src),
                getPromoDepthCH(startDate, endDate, brand, true, null, src),
                getPromoDepthCH(allMomStart, allMomEnd, brand, false, null, src),
                getPromoDepthCH(allMomStart, allMomEnd, brand, true, null, src)
            ]);

            allPromoMyBrand = allMyPromo;
            allPromoCompete = allCompetePromo;
            prevAllPromoMyBrand = prevMyPromo;
            prevAllPromoCompete = prevCompetePromo;

        } catch (err) {
            console.error("Error calculating All metrics:", err);
        }

        const allBuyBoxPct = allDeno > 0 ? (allBuyBoxNeno / allDeno) * 100 : 0;
        const prevAllBuyBoxPct = prevAllDeno > 0 ? (prevAllBuyBoxNeno / prevAllDeno) * 100 : 0;

        platformOverview.push({
            key: 'all',
            label: 'All',
            type: 'Overall',
            logo: "https://cdn-icons-png.flaticon.com/512/711/711284.png",
            columns: generateColumns(
                allOfftake, allAvailability, allSos, allMarketShare,
                allSpend, allRoas, allAdSales, allConversion, allCpm, allCpc,
                allPromoMyBrand, allPromoCompete, allBuyBoxPct,
                // Previous period values for proper MoM comparison
                prevAllOfftake, prevAllAvailability, prevAllSos, prevAllMarketShare,
                prevAllSpend, prevAllRoas, prevAllAdSales, prevAllConversion, prevAllCpm, prevAllCpc,
                prevAllPromoMyBrand, prevAllPromoCompete, prevAllBuyBoxPct
            )
        });

        // ⚡ PHASE 2 OPTIMIZATION: Bulk Platform Metrics
        // Fetch ALL platform metrics at once (4 queries instead of 90)
        console.log(`[Platform Overview] Starting bulk fetch for ${platformDefinitions.length} platforms...`);
        const platformBulkTimerLabel = `[Platform Overview] Bulk Fetch Total ${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        console.time(platformBulkTimerLabel);

        // Calculate MoM dates or use provided comparison dates
        let momStart = startDate.clone().subtract(1, 'month');
        let momEnd = endDate.clone().subtract(1, 'month');

        if (qCompareStartDate && qCompareEndDate) {
            momStart = dayjs(qCompareStartDate).startOf('day');
            momEnd = dayjs(qCompareEndDate).endOf('day');
        }

        // Use coalesceRequest to prevent cache stampede
        const platformCoalesceKey = `platform:${startDate.format('YYYY-MM-DD')}:${endDate.format('YYYY-MM-DD')}:${brand}:${location}:${category}`;
        const bulkPlatformMap = await coalesceRequest(platformCoalesceKey, () =>
            getBulkPlatformMetrics(
                platformDefinitions.map(p => p.label),
                startDate, endDate,
                momStart, momEnd,
                { brand, location, category }
            )
        );

        // Per-platform SOS: call getShareOfSearch with platform filter for each platform
        // getShareOfSearch already filters by POSITION <= 10 (top 10 rank)
        const platformSosMap = new Map();
        const platformSosResults = await Promise.all(
            platformDefinitions.map(async (p) => {
                const [currSos, prevSos] = await Promise.all([
                    getShareOfSearch(startDate, endDate, brand, p.label, location, category),
                    getShareOfSearch(momStart, momEnd, brand, p.label, location, category)
                ]);
                return { label: p.label, current: currSos || 0, previous: prevSos || 0 };
            })
        );
        platformSosResults.forEach(r => platformSosMap.set(r.label, { current: r.current, previous: r.previous }));

        console.timeEnd(platformBulkTimerLabel);
        console.log(`[Platform Overview] Bulk fetch complete. Now processing ${platformDefinitions.length} platforms in-memory...`);

        const platformOverviewPromises = platformDefinitions.map(async (p) => {
            try {
                // ⚡ Get pre-computed metrics from bulk maps (NO DATABASE QUERIES!)
                const metrics = bulkPlatformMap.get(p.label) || { curr: {}, prev: {} };
                const sosData = platformSosMap.get(p.label) || { current: 0, previous: 0 };

                // Current period metrics (from bulk fetch)
                const offtake = metrics.curr.sales;
                const totalSpend = metrics.curr.spend;
                const totalAdSales = metrics.curr.adSales;
                const totalClicks = metrics.curr.clicks;
                const totalImpressions = metrics.curr.impressions;

                // Hardcode Market Share values as requested by user
                const marketShare = await getMarketShare(startDate, endDate, p.label, category, null, locationArr, channel);

                const sos = sosData.current;

                // Availability calculation (in-memory)
                const availability = metrics.curr.deno > 0
                    ? (metrics.curr.neno / metrics.curr.deno) * 100
                    : 0;

                const currBuyBoxPct = metrics.curr.deno > 0 ? (metrics.curr.buyBoxNeno / metrics.curr.deno) * 100 : 0;

                const totalOrders = metrics.curr.orders;

                // Calculate ROAS: Total Ad Sales / Total Spend
                const roas = totalSpend > 0 ? totalAdSales / totalSpend : 0;

                // Calculate Conversion: (Total Orders / Total Clicks) * 100
                const conversion = calculateConversion(totalOrders, totalImpressions, totalClicks);

                // Calculate CPM: (Total Ad Spend / Total Ad Impressions) * 1000
                const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

                // Calculate CPC: Total Ad Spend / Total Ad Clicks
                const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;


                // ===== PROMO METRICS (ClickHouse) =====
                const [promoMyBrand, promoCompete] = await Promise.all([
                    getPromoDepthCH(startDate, endDate, brandArr, false, p.label, src),
                    getPromoDepthCH(startDate, endDate, brandArr, true, p.label, src)
                ]);

                // ===== PREVIOUS PERIOD (MoM) CALCULATIONS =====
                // Get from pre-computed bulk maps (NO DATABASE QUERIES!)
                const prevOfftake = metrics.prev.sales;
                const prevSpend = metrics.prev.spend;
                const prevAdSales = metrics.prev.adSales;
                const prevMarketShare = await getMarketShare(momStart, momEnd, p.label, category, null, locationArr, channel);
                const prevImpressions = metrics.prev.impressions;
                const prevSos = sosData.previous;

                const prevAvailability = metrics.prev.deno > 0
                    ? (metrics.prev.neno / metrics.prev.deno) * 100
                    : 0;

                const prevBuyBoxPct = metrics.prev.deno > 0 ? (metrics.prev.buyBoxNeno / metrics.prev.deno) * 100 : 0;

                const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;

                // Calculate previous period derived metrics from bulk data
                const prevClicks = metrics.prev.clicks;
                const prevOrders = metrics.prev.orders;
                const prevConversion = calculateConversion(prevOrders, prevImpressions, prevClicks);
                const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
                const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;

                // Promo metrics not in bulk data - set to 0 for now (can be optimized later)
                const prevPromoMyBrand = 0;
                const prevPromoCompete = 0;

                // Use absolute Ad_sales for Inorg Sales (matching Performance Matrix formula)
                const currInorgSales = totalAdSales;
                const prevInorgSales = prevAdSales;

                return {
                    key: p.key,
                    label: p.label,
                    type: p.type,
                    logo: p.logo,
                    columns: generateColumns(
                        // Current period
                        offtake, availability, sos, marketShare, totalSpend, roas, currInorgSales, conversion, cpm, cpc, promoMyBrand, promoCompete, currBuyBoxPct,
                        // Previous period
                        prevOfftake, prevAvailability, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales, prevConversion, prevCpm, prevCpc, prevPromoMyBrand, prevPromoCompete, prevBuyBoxPct
                    )
                };
            } catch (err) {
                console.error(`Error processing platform ${p.key}:`, err);
                return {
                    key: p.key,
                    label: p.label,
                    type: p.type,
                    logo: p.logo,
                    columns: generateColumns(0, 0, 0, 0) // Fallback
                };
            }
        });

        platformOverview.push(...(await Promise.all(platformOverviewPromises)));

        // 6. Month Overview Calculation
        // Use the selected platform filter from main filters. If "All" is selected, use monthOverviewPlatform.
        // Priority: monthOverviewPlatform > platform > first available platform
        const moPlatform = filters.monthOverviewPlatform ||
            (platform && platform !== 'All' ? platform : null);

        // If no specific platform is selected (All), skip month overview as it requires a specific platform
        if (!moPlatform) {
            console.log("Month Overview: Skipping - no specific platform selected (Platform is 'All')");
        } else {
            console.log("Month Overview: Calculating for Platform:", moPlatform);
        }

        // Generate columns helper for Month Overview (similar to generateColumns but for a single month row)
        const generateMonthColumns = (offtake, availability, sos, marketShare, spend = 0, roas = 0, inorgSales = 0, conversion = 0, cpm = 0, cpc = 0, buyBoxPct = 0) => [
            { title: "Offtakes", value: formatCurrency(offtake), meta: { units: "", change: "▲0.0%" } },
            { title: "Spend", value: formatCurrency(spend), meta: { units: "", change: "▲0.0%" } },
            { title: "ROAS", value: `${roas.toFixed(2)}x`, meta: { units: "", change: "▲0.0%" } },
            { title: "Inorg Sales", value: formatCurrency(inorgSales), meta: { units: "", change: "▲0.0%" } },
            { title: "Conversion", value: `${conversion.toFixed(2)}%`, meta: { units: "Orders / Clicks", change: "▲0.0%" } },
            { title: "Availability", value: `${availability.toFixed(2)}%`, meta: { units: "", change: "▲0.0%" } },
            { title: "SOS", value: `${sos.toFixed(2)}%`, meta: { units: "", change: "▲0.0%" } },
            { title: "Market Share", value: `${marketShare.toFixed(2)}%`, meta: { units: "", change: "▲0.0%" } },
            { title: "Buy Box %", value: `${buyBoxPct.toFixed(2)}%`, meta: { units: "", change: "▲0.0%" } },
            { title: "Promo My Brand", value: "0%", meta: { units: "", change: "▲0.0%" } }, // Mock
            { title: "Promo Compete", value: "0%", meta: { units: "", change: "▲0.0%" } }, // Mock
            { title: "CPM", value: `₹${cpm.toFixed(2)}`, meta: { units: "", change: "▲0.0%" } },
            { title: "CPC", value: `₹${cpc.toFixed(2)}`, meta: { units: "", change: "▲0.0%" } }
        ];

        // OPTIMIZED: Bulk month overview with GROUP BY instead of per-month queries
        let monthOverview = [];

        if (!moPlatform) {
            // No specific platform - return empty month overview
            monthOverview = monthBuckets.map(bucket => ({
                key: bucket.label,
                label: bucket.label,
                type: bucket.label,
                logo: "",
                columns: generateMonthColumns(0, 0, 0, 0)
            }));
        } else {
            console.log(`[Month Overview] OPTIMIZED: Fetching all months in ${monthBuckets.length} bulk queries`);

            // Build base conditions for rb_pdp_olap
            const buildPdpConditions = () => {
                const conds = [];
                conds.push(`${src.f.platform} = '${escapeStrMain(moPlatform)}'`);
                if (brandArr && brandArr.length > 0) {
                    const brandConds = brandArr.map(b => `${src.f.brand} LIKE '%${escapeStrMain(b)}%'`).join(' OR ');
                    conds.push(`(${brandConds})`);
                }
                if (locationArr && locationArr.length > 0) {
                    const locCond = buildLocationQueryCond(locationArr, moPlatform, src.f.location, src.f.platform);
                    if (locCond) conds.push(locCond);
                }
                // Apply Product_Category filter for rb_pdp_olap
                const catArrLocal = normalizeFilterArray(filters.category);
                if (catArrLocal && catArrLocal.length > 0) {
                    conds.push(`${src.f.category} IN (${catArrLocal.map(c => `'${escapeStrMain(c)}'`).join(', ')})`);
                }

                // Advanced SKU Search Filters
                const skuArr = normalizeFilterArray(filters.skuName);
                if (skuArr && skuArr.length > 0) {
                    const skuConds = skuArr.map(s => `${src.f.productName} LIKE '%${escapeStrMain(s)}%'`).join(' OR ');
                    conds.push(`(${skuConds})`);
                }
                const skuCodeArr = normalizeFilterArray(filters.skuCode);
                if (skuCodeArr && skuCodeArr.length > 0) {
                    const skuCodeConds = skuCodeArr.map(s => `toString(${src.f.webPid}) LIKE '%${escapeStrMain(s)}%'`).join(' OR ');
                    conds.push(`(${skuCodeConds})`);
                }

                return conds;
            };

            const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
            const pdpConds = buildPdpConditions();
            // Map pdpConds to use MV fields if necessary
            const mappedPdpConds = pdpConds.map(c => {
                let nc = c.replace(/Platform/g, src.f.platform)
                    .replace(/Brand/g, src.f.brand)
                    .replace(/Location/g, src.f.location)
                    .replace(/Web_Pid/g, src.f.webPid)
                    .replace(/Product/g, src.f.productName);
                if (PRODUCT_CATEGORY_SQL !== src.f.category) {
                    nc = nc.replace(new RegExp(PRODUCT_CATEGORY_SQL, 'g'), src.f.category);
                }
                return nc;
            });

            const dateRangeCondition = `${dateCol} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`;

            try {
                // Build PM conditions for month overview (rb_pm_olap uses Platform, brand, category, location_name directly)
                const pmSrc = await getPmSource();
                const pmMoConds = [
                    `${pmSrc.f.date} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`
                ];
                if (moPlatform) {
                    const cond = buildPlatformChannelCond(moPlatform, null, pmSrc.f.platform);
                    if (cond) pmMoConds.push(cond);
                }
                if (brandArr && brandArr.length > 0) {
                    const bConds = brandArr.map(b => `lower(${pmSrc.f.brand}) LIKE lower('%${escapeStrMain(b)}%')`).join(' OR ');
                    if (bConds) pmMoConds.push(`(${bConds})`);
                }
                if (pmSrc.f.location && pmSrc.f.location !== "'Unknown'" && locationArr && locationArr.length > 0) {
                    const locCond = buildLocationQueryCond(locationArr, moPlatform, pmSrc.f.location, pmSrc.f.platform);
                    if (locCond) pmMoConds.push(locCond);
                }
                const catArrMo = normalizeFilterArray(category);
                if (catArrMo && catArrMo.length > 0) {
                    pmMoConds.push(`lower(${pmSrc.f.category}) IN (${catArrMo.map(c => `'${escapeStrMain(c.toLowerCase())}'`).join(', ')})`);
                }

                // Execute 5 bulk queries in parallel (instead of 28 individual queries)
                const [offtakeByMonth, availByMonth, sosByMonth, msByMonth, pmByMonth] = await Promise.all([
                    // Query 1: Offtake metrics grouped by month
                    queryClickHouse(`
                        SELECT 
                            formatDateTime(${dateCol}, '%Y-%m-01') as month,
                            SUM(${src.f.sales}) as total_sales,
                            SUM(${src.f.spend}) as total_spend,
                            SUM(${src.f.adSales}) as total_Ad_sales,
                            SUM(${src.f.clicks}) as total_clicks,
                            SUM(${src.f.impressions}) as total_impressions
                        FROM ${src.table}
                        WHERE ${dateRangeCondition} AND ${mappedPdpConds.join(' AND ')}
                        GROUP BY month
                    `),
                    // Query 2: Availability grouped by month
                    queryClickHouse(`
                        SELECT 
                            formatDateTime(${dateCol}, '%Y-%m-01') as month,
                            SUM(${src.f.neno} * 1.0) as total_neno,
                            SUM(${src.f.deno} * 1.0) as total_deno,
                            SUM(${src.f.buyBoxNeno} * 1.0) as total_buy_box_neno
                        FROM ${src.table}
                        WHERE ${dateRangeCondition} AND ${mappedPdpConds.join(' AND ')}
                        GROUP BY month
                    `),
                    // Query 3: SOS grouped by month (numerator and denominator)
                    (async () => {
                        const sosBaseConds = [
                            `toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
                            `platform_name = '${escapeStrMain(moPlatform)}'`
                        ];
                        const localCatArr = normalizeFilterArray(category);
                        if (localCatArr && localCatArr.length > 0) {
                            if (localCatArr.length === 1) {
                                sosBaseConds.push(`keyword_category = '${escapeStrMain(localCatArr[0])}'`);
                            } else {
                                sosBaseConds.push(`keyword_category IN (${localCatArr.map(c => `'${escapeStrMain(c)}'`).join(', ')})`);
                            }
                        }
                        if (locationArr && locationArr.length > 0) {
                            const locCond = buildLocationQueryCond(locationArr, moPlatform, 'location_name', 'platform_name');
                            if (locCond) sosBaseConds.push(locCond);
                        }

                        const sosNumConds = [...sosBaseConds];
                        if (brandArr && brandArr.length > 0) {
                            if (brandArr.length === 1) {
                                sosNumConds.push(`brand = '${escapeStrMain(brandArr[0])}'`);
                            } else {
                                sosNumConds.push(`brand IN (${brandArr.map(b => `'${escapeStrMain(b)}'`).join(', ')})`);
                            }
                        } else {
                            sosNumConds.push(`toString(flag) = '1'`);
                        }

                        const [numByMonth, denomByMonth] = await Promise.all([
                            queryClickHouse(`
                                SELECT formatDateTime(toDate(DATE), '%Y-%m-01') as month, sum(toInt32(overall)) as count
                                FROM rb_kw_olap WHERE ${sosNumConds.join(' AND ')}
                                GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                            `),
                            queryClickHouse(`
                                SELECT formatDateTime(toDate(DATE), '%Y-%m-01') as month, sum(toInt32(overall)) as count
                                FROM rb_kw_olap WHERE ${sosBaseConds.join(' AND ')}
                                GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                            `)
                        ]);
                        return { num: numByMonth, denom: denomByMonth };
                    })(),
                    // Query 4: Market Share grouped by month - USING rb_brand_ms
                    (async () => {
                        const brandsForNumerator = (brand && brand !== 'All')
                            ? (Array.isArray(brand) ? brand : [brand])
                            : (await getGlobalOurBrandsList());
                        const brandInClause = brandsForNumerator.map(b => `'${escapeStrMain(b)}'`).join(', ');

                        const msBaseConds = [
                            `toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
                            `sales IS NOT NULL`,
                            `platform = '${escapeStrMain(moPlatform)}'`
                        ];
                        if (locationArr && locationArr.length > 0) {
                            const locCond = buildLocationQueryCond(locationArr, moPlatform, 'location', 'platform');
                            if (locCond) msBaseConds.push(locCond);
                        }
                        const localCatArr = normalizeFilterArray(category);
                        if (localCatArr && localCatArr.length > 0) {
                            if (localCatArr.length === 1) {
                                msBaseConds.push(`category = '${escapeStrMain(localCatArr[0])}'`);
                            } else {
                                msBaseConds.push(`category IN (${localCatArr.map(c => `'${escapeStrMain(c)}'`).join(', ')})`);
                            }
                        }

                        const [numByMonth, denByMonth] = await Promise.all([
                            queryClickHouse(`
                                SELECT formatDateTime(toDate(created_on), '%Y-%m-01') as month, SUM(toFloat64OrZero(toString(sales))) as our_sales
                                FROM rb_ms_olap 
                                WHERE ${msBaseConds.join(' AND ')} AND group_brand IN (${brandInClause})
                                GROUP BY formatDateTime(toDate(created_on), '%Y-%m-01')
                            `),
                            queryClickHouse(`
                                SELECT formatDateTime(toDate(created_on), '%Y-%m-01') as month, SUM(toFloat64OrZero(toString(sales))) as total_sales
                                FROM rb_ms_olap 
                                WHERE ${msBaseConds.join(' AND ')}
                                GROUP BY formatDateTime(toDate(created_on), '%Y-%m-01')
                            `)
                        ]);

                        const numMap = new Map(numByMonth.map(r => [r.month, parseFloat(r.our_sales || 0)]));
                        return denByMonth.map(r => {
                            const ourSales = numMap.get(r.month) || 0;
                            const totalSales = parseFloat(r.total_sales || 0);
                            return {
                                month: r.month,
                                avg_ms: totalSales > 0 ? (ourSales / totalSales) * 100 : 0
                            };
                        });
                    })(),
                    // Query 5: PM metrics (orders/clicks) grouped by month from pmSrc.table
                    (() => {
                        const pmChannelColSql = pmSrc.f.channel ? `lower(${pmSrc.f.channel})` : `(CASE WHEN lower(${pmSrc.f.platform}) IN ('amazon', 'flipkart', 'myntra', 'nykaa', 'jiomart') THEN 'ecommerce' WHEN lower(${pmSrc.f.platform}) IN ('blinkit', 'zepto', 'instamart', 'swiggy', 'bbnow') THEN 'quickcomm' ELSE 'other' END)`;
                        return queryClickHouse(`
                            SELECT 
                                formatDateTime(${pmSrc.f.date}, '%Y-%m-01') as month,
                                SUM(${pmSrc.f.orders}) as total_orders,
                                SUM(${pmSrc.f.impressions}) as total_impressions,
                                SUM(${pmSrc.f.clicks}) as total_clicks,
                                SUM(${pmSrc.f.adSales}) as total_Ad_sales,
                                SUM(${pmSrc.f.spend}) as total_spend,
                                SUM(CASE WHEN ${pmChannelColSql} = 'ecommerce' THEN ${pmSrc.f.spend} ELSE 0 END) as cpc_spend,
                                SUM(CASE WHEN ${pmChannelColSql} = 'ecommerce' THEN ${pmSrc.f.clicks} ELSE 0 END) as cpc_clicks,
                                SUM(CASE WHEN ${pmChannelColSql} = 'quickcomm' THEN ${pmSrc.f.spend} ELSE 0 END) as cpm_spend,
                                SUM(CASE WHEN ${pmChannelColSql} = 'quickcomm' THEN ${pmSrc.f.impressions} ELSE 0 END) as cpm_impressions
                            FROM ${pmSrc.table}
                            WHERE ${pmMoConds.join(' AND ')}
                            GROUP BY month
                        `);
                    })()
                ]);

                // Build lookup maps
                const offtakeMap = new Map(offtakeByMonth.map(r => [r.month, r]));
                const availMap = new Map(availByMonth.map(r => [r.month, r]));
                const sosNumMap = new Map(sosByMonth.num.map(r => [r.month, parseInt(r.count)]));
                const sosDenomMap = new Map(sosByMonth.denom.map(r => [r.month, parseInt(r.count)]));
                const msMap = new Map(msByMonth.map(r => [r.month, parseFloat(r.avg_ms || 0)]));
                const pmMap = new Map(pmByMonth.map(r => [r.month, r]));

                // Generate month overview from bulk data
                monthOverview = monthBuckets.map(bucket => {
                    const monthKey = dayjs(bucket.date).format('YYYY-MM-01');

                    const off = offtakeMap.get(monthKey) || {};
                    const moOfftake = parseFloat(off.total_sales || 0);

                    // Get PM data for proper Conversion, ROAS and Inorganic Sales calculation
                    const pm = pmMap.get(monthKey) || {};
                    const moImpressions = parseFloat(pm.total_impressions || 0);
                    const moOrders = parseFloat(pm.total_orders || 0);
                    const moPmClicks = parseFloat(pm.total_clicks || 0);
                    const moAdSales = parseFloat(pm.total_Ad_sales || 0);
                    const moSpend = parseFloat(pm.total_spend || 0);
                    const cpcSpend = parseFloat(pm.cpc_spend || 0);
                    const cpcClicks = parseFloat(pm.cpc_clicks || 0);
                    const cpmSpend = parseFloat(pm.cpm_spend || 0);
                    const cpmImpressions = parseFloat(pm.cpm_impressions || 0);

                    const moRoas = moSpend > 0 ? moAdSales / moSpend : 0;
                    // Conversion = (Orders / Clicks) * 100 from rb_pm_olap
                    const moConversion = moPmClicks > 0 ? (moOrders / moPmClicks) * 100 : 0;
                    const moCpm = cpmImpressions > 0 ? (cpmSpend / cpmImpressions) * 1000 : 0;
                    const moCpc = cpcClicks > 0 ? cpcSpend / cpcClicks : 0;

                    const avail = availMap.get(monthKey) || {};
                    const neno = parseFloat(avail.total_neno || 0);
                    const deno = parseFloat(avail.total_deno || 0);
                    const buyBoxNeno = parseFloat(avail.total_buy_box_neno || 0);
                    const moAvailability = deno > 0 ? (neno / deno) * 100 : 0;
                    const moBuyBoxPct = deno > 0 ? (buyBoxNeno / deno) * 100 : 0;

                    const sosNum = sosNumMap.get(monthKey) || 0;
                    const sosDenom = sosDenomMap.get(monthKey) || 0;
                    const moSos = sosDenom > 0 ? (sosNum / sosDenom) * 100 : 0;

                    const moMarketShare = msMap.get(monthKey) || 0;

                    return {
                        key: bucket.label,
                        label: bucket.label,
                        date: bucket.date,
                        type: bucket.label,
                        logo: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png",
                        columns: generateMonthColumns(moOfftake, moAvailability, moSos, moMarketShare, moSpend, moRoas, moAdSales, moConversion, moCpm, moCpc, moBuyBoxPct)
                    };
                });

                console.log(`[Month Overview] OPTIMIZED: Processed ${monthBuckets.length} months with 5 bulk queries (vs ${monthBuckets.length * 5} individual queries)`);

            } catch (err) {
                console.error('[Month Overview] Error in bulk query:', err);
                monthOverview = monthBuckets.map(bucket => ({
                    key: bucket.label,
                    label: bucket.label,
                    type: bucket.label,
                    logo: "",
                    columns: generateMonthColumns(0, 0, 0, 0)
                }));
            }
        }
        // monthOverview.push(...monthOverviewResults); // Removed push to undefined variable

        // 13. Category Overview Logic
        const categoryOverviewPlatform = filters.categoryOverviewPlatform || filters.platform || 'Zepto';

        // Fetch unique categories based on filters from RcaSkuDim (status=1 only)
        const categoryWhere = { status: 1 };

        if (categoryOverviewPlatform && categoryOverviewPlatform !== 'All') {
            categoryWhere.platform = categoryOverviewPlatform;
        }
        if (brand && brand !== 'All') {
            categoryWhere.brand_name = { [Op.like]: `%${brand}%` };
        }
        // Note: RcaSkuDim might not have location, or it might be 'location' column. 
        // Assuming location filter is not strictly needed for category listing, or we check if column exists.
        // Based on model, it has 'location'.
        if (location && location !== 'All') {
            categoryWhere.location = location;
        }

        // Use rb_pdp_olap for categories (same table as metrics data)
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const catDataConds = [`${dateCol} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        if (categoryOverviewPlatform && categoryOverviewPlatform !== 'All') {
            const cond = buildPlatformChannelCond(categoryOverviewPlatform, null, src.f.platform);
            if (cond) catDataConds.push(cond);
        }
        const bBrands = normalizeFilterArray(brand);
        if (bBrands && bBrands.length > 0) {
            const bConds = bBrands.map(b => `${src.f.brand} LIKE '%${escapeStrMain(b)}%'`).join(' OR ');
            if (bConds) catDataConds.push(`(${bConds})`);
        }
        const cLocs = normalizeFilterArray(location);
        if (cLocs && cLocs.length > 0) {
            catDataConds.push(`${src.f.location} IN (${cLocs.map(l => `'${escapeStrMain(l)}'`).join(', ')})`);
        }
        const distinctCategories = await queryClickHouse(
            `SELECT DISTINCT ${src.f.category} as category FROM ${src.table} WHERE ${catDataConds.join(' AND ')} AND ${src.f.category} != 'Others' ORDER BY category`
        );

        const categories = distinctCategories.map(c => c.category).filter(Boolean);
        console.log(`[Category Overview] Platform: ${categoryOverviewPlatform}, Found ${categories.length} categories:`, categories);

        const categoryOverviewPromises = categories.map(async (catName) => {
            try {
                // Build ClickHouse conditions for this category (src from outer scope)
                const catConds = [
                    `${dateCol} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
                    `${src.f.category} = '${escapeStrMain(catName)}'`
                ];
                const catBrandArr = normalizeFilterArray(brand);
                if (catBrandArr && catBrandArr.length > 0) {
                    const bConds = catBrandArr.map(b => `${src.f.brand} LIKE '%${escapeStrMain(b)}%'`).join(' OR ');
                    if (bConds) catConds.push(`(${bConds})`);
                }
                const locArr = normalizeFilterArray(location);
                if (locArr && locArr.length > 0) {
                    catConds.push(`${src.f.location} IN (${locArr.map(l => `'${escapeStrMain(l)}'`).join(', ')})`);
                }
                if (categoryOverviewPlatform && categoryOverviewPlatform !== 'All') {
                    const cond = buildPlatformChannelCond(categoryOverviewPlatform, null, src.f.platform);
                    if (cond) catConds.push(cond);
                }
                const catCondStr = catConds.join(' AND ');

                console.log(`[Category Overview] Processing category: ${catName}, Platform: ${categoryOverviewPlatform}`);

                // Calculate Metrics for this Category using ClickHouse
                const [
                    catOfftakeResult,
                    catAvailability,
                    catSos,
                    catMsResult,
                    catPromoMyBrandResult,
                    catPromoCompeteResult,
                    catPmResult
                ] = await Promise.all([
                    // Offtake (Sales) & Ad Metrics
                    queryClickHouse(`
                        SELECT 
                            SUM(${src.f.sales}) as total_sales,
                            SUM(${src.f.spend}) as total_spend,
                            SUM(${src.f.adSales}) as total_Ad_sales,
                            SUM(${src.f.clicks}) as total_clicks,
                            SUM(${src.f.impressions}) as total_impressions,
                            SUM(${src.f.buyBoxNeno} * 1.0) as total_buy_box_neno,
                            SUM(${src.f.deno} * 1.0) as total_deno
                        FROM ${src.table} 
                        WHERE ${catCondStr}
                    `).then(r => r[0] || {}),
                    // Availability (OSA) - already uses ClickHouse
                    getAvailability(startDate, endDate, brand, categoryOverviewPlatform, location, catName),
                    // SOS - already uses ClickHouse
                    getShareOfSearch(startDate, endDate, brand, categoryOverviewPlatform, location, catName),
                    // Market Share - USING marketShareHelper
                    // Pass null platform so rb_brand_ms is queried without platform filter
                    // (consistent with getCategoryOverview which also omits platform on getMarketShare)
                    getMarketShare(startDate, endDate, null, catName, null, location, channel),
                    // Promo My Brand (Comp_flag = 0)
                    queryClickHouse(`
                        SELECT (SUM(${src.f.mrp}) - SUM(${src.f.sellingPrice})) / NULLIF(SUM(${src.f.mrp}), 0) as avg_promo_depth
                        FROM ${src.table} 
                        WHERE ${catCondStr} AND ${src.f.compFlag} = '0' AND neno_osa > 0
                    `).then(r => r[0] || {}),
                    // Promo Compete (Comp_flag = 1)
                    queryClickHouse(`
                        SELECT (SUM(${src.f.mrp}) - SUM(${src.f.sellingPrice})) / NULLIF(SUM(${src.f.mrp}), 0) as avg_promo_depth
                        FROM ${src.table} 
                        WHERE ${catCondStr} AND ${src.f.compFlag} = '1' AND neno_osa > 0
                    `).then(r => r[0] || {}),
                    // PM Metrics (orders/clicks) from rb_pm_olap for Conversion
                    (async () => {
                        const pmSrc = await getPmSource();
                        const pmCatConds = [
                            `${pmSrc.f.date} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
                            `lower(${pmSrc.f.category}) = '${escapeStrMain(catName.toLowerCase())}'`
                        ];
                        const catBrandArrPm = normalizeFilterArray(brand);
                        if (catBrandArrPm && catBrandArrPm.length > 0) {
                            const bConds = catBrandArrPm.map(b => `lower(${pmSrc.f.brand}) LIKE lower('%${escapeStrMain(b)}%')`).join(' OR ');
                            if (bConds) pmCatConds.push(`(${bConds})`);
                        }
                        const locArrPm = normalizeFilterArray(location);
                        if (pmSrc.f.location && pmSrc.f.location !== "'Unknown'" && locArrPm && locArrPm.length > 0) {
                            pmCatConds.push(`lower(${pmSrc.f.location}) IN (${locArrPm.map(l => `'${escapeStrMain(l.toLowerCase())}'`).join(', ')})`);
                        }
                        if (categoryOverviewPlatform && categoryOverviewPlatform !== 'All') {
                            const cond = buildPlatformChannelCond(categoryOverviewPlatform, null, pmSrc.f.platform);
                            if (cond) pmCatConds.push(cond);
                        }
                        const pmResult = await queryClickHouse(`
                            SELECT SUM(${pmSrc.f.orders}) as total_orders, SUM(${pmSrc.f.impressions}) as total_impressions, SUM(${pmSrc.f.clicks}) as total_clicks
                            FROM ${pmSrc.table}
                            WHERE ${pmCatConds.join(' AND ')}
                        `);
                        return pmResult[0] || {};
                    })()
                ]);

                const catOfftake = parseFloat(catOfftakeResult?.total_sales || 0);
                const catSpend = parseFloat(catOfftakeResult?.total_spend || 0);
                const catAdSales = parseFloat(catOfftakeResult?.total_Ad_sales || 0); // Inorg Sales
                const catClicks = parseFloat(catOfftakeResult?.total_clicks || 0);
                const catImpressions = parseFloat(catOfftakeResult?.total_impressions || 0);

                const catMarketShare = parseFloat(catMsResult || 0);

                const catPromoMyBrand = parseFloat(catPromoMyBrandResult?.avg_promo_depth || 0) * 100;
                const catPromoCompete = parseFloat(catPromoCompeteResult?.avg_promo_depth || 0) * 100;

                // Debug logging for troubleshooting
                console.log(`[Category Overview] ${catName}: Offtake=${catOfftake}, Spend=${catSpend}, AdSales=${catAdSales}, Clicks=${catClicks}, Impressions=${catImpressions}`);
                console.log(`[Category Overview] ${catName}: MarketShare=${catMarketShare.toFixed(2)}%`);
                console.log(`[Category Overview] ${catName}: PromoMyBrand=${catPromoMyBrand.toFixed(2)}%, PromoCompete=${catPromoCompete.toFixed(2)}%`);

                // Calculate Metrics
                const catRoas = catSpend > 0 ? catAdSales / catSpend : 0;
                const catPmOrders = parseFloat(catPmResult?.total_orders || 0);
                const catPmImpressions = parseFloat(catPmResult?.total_impressions || 0);
                const catPmClicks = parseFloat(catPmResult?.total_clicks || 0);
                const catConversion = catPmClicks > 0 ? (catPmOrders / catPmClicks) * 100 : 0;
                const catCpm = catImpressions > 0 ? (catSpend / catImpressions) * 1000 : 0;
                const catCpc = catPmClicks > 0 ? catSpend / catPmClicks : 0;

                const catBuyBoxNeno = parseFloat(catOfftakeResult?.total_buy_box_neno || 0);
                const catDeno = parseFloat(catOfftakeResult?.total_deno || 0);
                const catBuyBoxPct = catDeno > 0 ? (catBuyBoxNeno / catDeno) * 100 : 0;



                return {
                    key: catName,
                    label: catName,
                    type: catName,
                    logo: "https://cdn-icons-png.flaticon.com/512/3502/3502685.png",
                    columns: [
                        {
                            title: "Offtakes",
                            value: formatCurrency(catOfftake),
                            change: { text: "▲0.0%", positive: true }, // Placeholder for change
                            meta: { units: "units", change: "▲0.0%" }
                        },
                        {
                            title: "Spend",
                            value: formatCurrency(catSpend),
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "currency", change: "▲0.0%" }
                        },
                        {
                            title: "ROAS",
                            value: `${catRoas.toFixed(2)}x`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "return", change: "▲0.0%" }
                        },
                        {
                            title: "Inorg Sales",
                            value: catOfftake > 0 ? `${((catAdSales / catOfftake) * 100).toFixed(2)}%` : "0%",
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: formatCurrency(catAdSales), change: "▲0.0%" }
                        },
                        {
                            title: "Conversion",
                            value: `${catConversion.toFixed(2)}%`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "Orders / Clicks", change: "▲0.0%" }
                        },
                        {
                            title: "Availability",
                            value: `${catAvailability.toFixed(2)}%`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "stores", change: "▲0.0%" }
                        },
                        {
                            title: "SOS",
                            value: `${catSos.toFixed(2)}%`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "index", change: "▲0.0%" }
                        },
                        {
                            title: "Market Share",
                            value: `${catMarketShare.toFixed(2)}%`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "share", change: "▲0.0%" }
                        },
                        {
                            title: "Buy Box %",
                            value: `${catBuyBoxPct.toFixed(2)}%`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: `${catDeno}`, change: "▲0.0%" }
                        },
                        {
                            title: "Promo My Brand",
                            value: `${catPromoMyBrand.toFixed(2)}%`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "depth", change: "▲0.0%" }
                        },
                        {
                            title: "Promo Compete",
                            value: `${catPromoCompete.toFixed(2)}%`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "depth", change: "▲0.0%" }
                        },
                        {
                            title: "CPM",
                            value: formatCurrency(catCpm),
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "impressions", change: "▲0.0%" }
                        },
                        {
                            title: "CPC",
                            value: formatCurrency(catCpc),
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "clicks", change: "▲0.0%" }
                        }
                    ]
                };

            } catch (err) {
                console.error(`Error calculating Category Overview for ${catName}:`, err);
                return {
                    key: catName,
                    label: catName,
                    type: "Category",
                    logo: "",
                    columns: generateMonthColumns(0, 0, 0, 0)
                };
            }
        });

        const categoryOverview = await Promise.all(categoryOverviewPromises);

        // 14. Brands Overview Logic
        const brandsOverviewPlatform = filters.brandsOverviewPlatform || filters.platform || 'All';
        const rawBrandsOverviewCategory = filters.brandsOverviewCategory || filters.category || 'All';
        // Normalize the category filter to handle multi-select and "All"
        const brandsOverviewCategoryArr = normalizeFilterArray(rawBrandsOverviewCategory);

        // Define Where Clauses
        const boBrandWhere = {};
        if (brandsOverviewPlatform && brandsOverviewPlatform !== 'All') boBrandWhere.platform = brandsOverviewPlatform;
        // brandsOverviewCategory where clause handled via normalized array below
        if (location && location !== 'All') boBrandWhere.location = location;

        const boOfftakeWhere = {
            DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
            Comp_flag: 0, // Only our brands
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: brandsOverviewPlatform }),
            ...(location && location !== 'All' && { Location: location })
        };

        const boPrevStartDate = startDate.clone().subtract(1, 'month');
        const boPrevEndDate = endDate.clone().subtract(1, 'month');

        const boPrevOfftakeWhere = {
            DATE: { [Op.between]: [boPrevStartDate.toDate(), boPrevEndDate.toDate()] },
            Comp_flag: 0, // Only our brands
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: brandsOverviewPlatform }),
            ...(location && location !== 'All' && { Location: location })
        };


        const boMsWhere = {
            created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: brandsOverviewPlatform }),
            ...(location && location !== 'All' && { Location: location })
        };

        const boPrevMsWhere = {
            created_on: { [Op.between]: [boPrevStartDate.toDate(), boPrevEndDate.toDate()] },
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: brandsOverviewPlatform }),
            ...(location && location !== 'All' && { Location: location })
        };

        const rcaBrandWhere = {
            comp_flag: 0  // FIXED: Only show OUR brands, not competitors
        };
        if (brandsOverviewPlatform && brandsOverviewPlatform !== 'All') {
            rcaBrandWhere.platform = brandsOverviewPlatform;
        }
        // Category filter handled via normalized array in ClickHouse conditions below

        // Priority: brandsOverviewCategoryArr > category > All
        const boPlatCondDistinct = (brandsOverviewPlatform && brandsOverviewPlatform !== 'All')
            ? `AND ${buildPlatformChannelCond(brandsOverviewPlatform, null, src.f.platform)}`
            : '';

        const distinctBrands = await queryClickHouse(`
            SELECT DISTINCT ${src.f.brand} as brand FROM ${src.table}
            WHERE ${dateCol} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'
            ${boPlatCondDistinct}
            ${brandsOverviewCategoryArr.length > 0 ? `AND ${src.f.category} IN (${brandsOverviewCategoryArr.map(c => `'${escapeStrMain(c)}'`).join(', ')})` : ''}
            ORDER BY brand
        `);

        // 1. Offtake Current - Using ClickHouse instead of Sequelize
        const boOfftakeConds = [
            `${dateCol} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
        ];
        if (brand && brand !== 'All') {
            boOfftakeConds.push(`${src.f.brand} LIKE '%${escapeStrMain(brand)}%'`);
        }
        if (brandsOverviewPlatform && brandsOverviewPlatform !== 'All') {
            const cond = buildPlatformChannelCond(brandsOverviewPlatform, null, src.f.platform);
            if (cond) boOfftakeConds.push(cond);
        }
        if (brandsOverviewCategoryArr && brandsOverviewCategoryArr.length > 0) {
            boOfftakeConds.push(`${PRODUCT_CATEGORY_SQL} IN (${brandsOverviewCategoryArr.map(c => `'${escapeStrMain(c)}'`).join(', ')})`);
        }
        const boLocArr = normalizeFilterArray(location);
        if (boLocArr && boLocArr.length > 0) {
            const platformCol = src.isAgg ? 'platform' : 'Platform';
            const locCond = buildLocationQueryCond(boLocArr, brandsOverviewPlatform, 'Location', platformCol);
            if (locCond) boOfftakeConds.push(locCond);
        }

        const buildPmCondsRange = (s, e) => {
            const conds = [`${pmSrc.f.date} BETWEEN '${s.format('YYYY-MM-DD')}' AND '${e.format('YYYY-MM-DD')}'`];
            if (brand && brand !== 'All') conds.push(`${pmSrc.f.brand} LIKE '%${escapeStrMain(brand)}%'`);
            const pCond = buildPlatformChannelCond(brandsOverviewPlatform, channel, pmSrc.f.platform, false, pmSrc.f.channel);
            if (pCond) conds.push(pCond);
            if (brandsOverviewCategoryArr && brandsOverviewCategoryArr.length > 0) {
                conds.push(`${pmSrc.f.category} IN (${brandsOverviewCategoryArr.map(c => `'${escapeStrMain(c)}'`).join(', ')})`);
            }
            if (pmSrc.f.location && pmSrc.f.location !== "'Unknown'" && boLocArr && boLocArr.length > 0) {
                const locCond = buildLocationQueryCond(boLocArr, brandsOverviewPlatform, pmSrc.f.location, pmSrc.f.platform);
                if (locCond) conds.push(locCond);
            }
            return conds.join(' AND ');
        };

        const boOfftakePromise = queryClickHouse(`
            SELECT 
                ${src.f.brand} as Brand,
                SUM(${src.f.sales}) as total_sales,
                SUM(${src.f.qty}) as total_qty,
                AVG(${src.f.discount}) as avg_discount,
                SUM(${src.f.neno} * 1.0) as total_neno,
                SUM(${src.f.deno} * 1.0) as total_deno,
                SUM(${src.f.buyBoxNeno} * 1.0) as total_buy_box_neno
            FROM ${src.table}
            WHERE ${boOfftakeConds.join(' AND ')}
            GROUP BY Brand
        `);

        // Marketing Metrics from PM table
        const boPmPromise = queryClickHouse(`
            SELECT 
                ${pmSrc.f.brand} as Brand,
                SUM(${pmSrc.f.spend}) as total_spend,
                SUM(${pmSrc.f.adSales}) as total_Ad_sales,
                SUM(${pmSrc.f.orders}) as total_ad_orders,
                SUM(${pmSrc.f.clicks}) as total_ad_clicks,
                SUM(${pmSrc.f.impressions}) as total_ad_impressions
            FROM ${pmSrc.table}
            WHERE ${buildPmCondsRange(startDate, endDate)}
            GROUP BY Brand
        `);

        // Previous period offtake conditions
        const boPrevOfftakeConds = [
            `${dateCol} BETWEEN '${boPrevStartDate.format('YYYY-MM-DD')}' AND '${boPrevEndDate.format('YYYY-MM-DD')}'`,
            `${src.f.compFlag} = '0'`
        ];
        if (brandsOverviewPlatform && brandsOverviewPlatform !== 'All') {
            const cond = buildPlatformChannelCond(brandsOverviewPlatform, null, src.f.platform);
            if (cond) boPrevOfftakeConds.push(cond);
        }
        if (brandsOverviewCategoryArr && brandsOverviewCategoryArr.length > 0) {
            if (brandsOverviewCategoryArr.length === 1) {
                boPrevOfftakeConds.push(`${src.f.category} = '${escapeStrMain(brandsOverviewCategoryArr[0])}'`);
            } else {
                boPrevOfftakeConds.push(`${src.f.category} IN (${brandsOverviewCategoryArr.map(c => `'${escapeStrMain(c)}'`).join(', ')})`);
            }
        }
        const locArr2 = normalizeFilterArray(location);
        if (locArr2 && locArr2.length > 0) {
            const platformCol = src.isAgg ? 'platform' : 'Platform';
            const locCond = buildLocationQueryCond(locArr2, brandsOverviewPlatform, 'Location', platformCol);
            if (locCond) boPrevOfftakeConds.push(locCond);
        }

        // Brand list conditions for ClickHouse
        const rcaBrandConds = [`toString(comp_flag) = '0'`, `brand_name IS NOT NULL`, `brand_name != ''`];
        if (brandsOverviewPlatform && brandsOverviewPlatform !== 'All') {
            const cond = buildPlatformChannelCond(brandsOverviewPlatform, null, 'platform');
            if (cond) rcaBrandConds.push(cond);
        }
        if (brandsOverviewCategoryArr && brandsOverviewCategoryArr.length > 0) {
            if (brandsOverviewCategoryArr.length === 1) {
                rcaBrandConds.push(`category = '${escapeStrMain(brandsOverviewCategoryArr[0])}'`);
            } else {
                rcaBrandConds.push(`category IN (${brandsOverviewCategoryArr.map(c => `'${escapeStrMain(c)}'`).join(', ')})`);
            }
        }

        const [
            boOfftakeData,
            boPmData,
            boPrevOfftakeData,
            boPrevPmData,
            boMsData,
            boPrevMsData,
            rcaBrandsData
        ] = await Promise.all([
            // 1. Offtake Current
            boOfftakePromise,
            // 1.1 PM Current
            boPmPromise,
            // 2. Offtake Previous - ClickHouse
            queryClickHouse(`
                SELECT 
                    ${src.f.brand} as Brand,
                    SUM(${src.f.sales}) as total_sales,
                    SUM(${src.f.qty}) as total_qty,
                    AVG(${src.f.discount}) as avg_discount,
                    SUM(${src.f.neno} * 1.0) as total_neno,
                    SUM(${src.f.deno} * 1.0) as total_deno,
                    SUM(${src.f.buyBoxNeno} * 1.0) as total_buy_box_neno
                FROM ${src.table} 
                WHERE ${boPrevOfftakeConds.join(' AND ')}
                GROUP BY Brand
            `),
            // 2.1 PM Previous
            queryClickHouse(`
                SELECT 
                    ${pmSrc.f.brand} as Brand,
                    SUM(${pmSrc.f.spend}) as total_spend,
                    SUM(${pmSrc.f.adSales}) as total_Ad_sales,
                    SUM(${pmSrc.f.orders}) as total_ad_orders,
                    SUM(${pmSrc.f.clicks}) as total_ad_clicks,
                    SUM(${pmSrc.f.impressions}) as total_ad_impressions
                FROM ${pmSrc.table}
                WHERE ${buildPmCondsRange(boPrevStartDate, boPrevEndDate)}
                GROUP BY Brand
            `),
            // 3. Market Share Current
            (async () => {
                try {
                    const msMap = await getMarketShareByBrand(startDate, endDate, platformArr, category, brand, location, channel);
                    return Array.from(msMap.entries()).map(([b, ms]) => ({ brand: b, avg_ms: ms }));
                } catch (err) {
                    console.error('[BrandsOverview] MS Current error:', err.message);
                    return [];
                }
            })(),
            // 4. Market Share Previous
            (async () => {
                try {
                    const msMap = await getMarketShareByBrand(boPrevStartDate, boPrevEndDate, platformArr, category, brand, location, channel);
                    return Array.from(msMap.entries()).map(([b, ms]) => ({ brand: b, avg_ms: ms }));
                } catch (err) {
                    console.error('[BrandsOverview] MS Prev error:', err.message);
                    return [];
                }
            })(),
            // 5. Brand List - ClickHouse
            queryClickHouse(`
                SELECT DISTINCT brand_name 
                FROM rca_sku_dim 
                WHERE ${rcaBrandConds.join(' AND ')} 
                ORDER BY brand_name
            `)
        ]);



        // Optimization: Create Maps for O(1) Access
        const toMap = (arr) => new Map(arr.map(i => [(i.Brand || i.brand_name || i.brand || '').toLowerCase(), i]));

        const boOfftakeMap = toMap(boOfftakeData);
        const boPmMap = toMap(boPmData);
        const boPrevOfftakeMap = toMap(boPrevOfftakeData);
        const boPrevPmMap = toMap(boPrevPmData);
        const boMsMap = toMap(boMsData);
        const boPrevMsMap = toMap(boPrevMsData);

        const findMetric = (map, brandName, key) => {
            const lowerBrand = brandName.toLowerCase();
            let item = map.get(lowerBrand);

            // Fuzzy Match if exact match fails
            if (!item) {
                for (const [mapKey, mapValue] of map.entries()) {
                    if (mapKey.includes(lowerBrand) || lowerBrand.includes(mapKey)) {
                        item = mapValue;
                        break; // Take first match
                    }
                }
            }

            return item ? parseFloat(item[key] || 0) : 0;
        };

        const calcTrend = (curr, prev) => {
            if (prev > 0) return ((curr - prev) / prev) * 100;
            if (curr > 0) return 100;
            return 0;
        };

        const calcTrendPp = (curr, prev) => curr - prev;

        const boBrands = rcaBrandsData.map(d => d.brand_name).filter(Boolean);

        // Pre-calculate totals for Promo Compete (Avg Discount of ALL brands)
        const totalDiscountSum = boOfftakeData.reduce((sum, d) => sum + parseFloat(d.avg_discount || 0), 0);
        const totalDiscountCount = boOfftakeData.length;

        const prevTotalDiscountSum = boPrevOfftakeData.reduce((sum, d) => sum + parseFloat(d.avg_discount || 0), 0);
        const prevTotalDiscountCount = boPrevOfftakeData.length;

        // ⚡ PERFORMANCE OPTIMIZATION: Bulk SOS Calculation with Request Coalescing
        // Calculate SOS for ALL brands at once (4 queries total) instead of per-brand (2N queries)
        // Use coalesceRequest to prevent cache stampede - only one computation runs, others wait
        console.log(`[Brands Overview] Calculating SOS for ${boBrands.length} brands using bulk method...`);
        const brandsSosTimerLabel = `[Brands Overview] Bulk SOS Calculation ${Date.now()}`;
        console.time(brandsSosTimerLabel);

        // Generate coalesce key for SOS calculation - include channel for accuracy
        const sosCoalesceKey = `bulk-sos:${brandsOverviewPlatform}:${startDate.format('YYYY-MM-DD')}:${endDate.format('YYYY-MM-DD')}:${location || 'All'}:${rawBrandsOverviewCategory}:${channel || 'All'}`;

        let bulkSosMap;
        try {
            bulkSosMap = await coalesceRequest(sosCoalesceKey, async () =>
                await getBulkShareOfSearch(
                    boBrands,
                    startDate, endDate,           // Current period
                    boPrevStartDate, boPrevEndDate, // Previous period
                    brandsOverviewPlatform, location, rawBrandsOverviewCategory, channel
                )
            );
        } catch (err) {
            console.error('[Brands Overview] Bulk SOS Error:', err.message);
            bulkSosMap = new Map();
        }

        console.timeEnd(brandsSosTimerLabel);
        console.log(`[Brands Overview] SOS calculated for ${bulkSosMap.size} brands`);

        const brandsOverview = await Promise.all(boBrands.map(async brandName => {
            const bName = brandName; // Use a consistent variable name for clarity

            // Offtake
            const currSales = findMetric(boOfftakeMap, bName, 'total_sales');
            const prevSales = findMetric(boPrevOfftakeMap, bName, 'total_sales');
            const salesTrend = calcTrend(currSales, prevSales);

            // Spend
            const currSpend = findMetric(boPmMap, bName, 'total_spend');
            const prevSpend = findMetric(boPrevPmMap, bName, 'total_spend');
            const spendTrend = calcTrend(currSpend, prevSpend);

            // ROAS
            const currAdSales = findMetric(boPmMap, bName, 'total_Ad_sales');
            const prevAdSales = findMetric(boPrevPmMap, bName, 'total_Ad_sales');
            const currRoas = currSpend > 0 ? currAdSales / currSpend : 0;
            const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;
            const roasTrend = calcTrend(currRoas, prevRoas);

            // console.log(`[Brands ROAS Debug] Brand: ${brandName}, currAdSales: ${currAdSales}, currSpend: ${currSpend}, currRoas: ${currRoas}`);

            // Inorg Sales
            const currInorgPct = currSales > 0 ? (currAdSales / currSales) * 100 : 0;
            const prevInorgPct = prevSales > 0 ? (prevAdSales / prevSales) * 100 : 0;
            const inorgPctTrend = calcTrendPp(currInorgPct, prevInorgPct);

            // Conversion
            const currOrders = findMetric(boPmMap, bName, 'total_ad_orders');
            const prevOrders = findMetric(boPrevPmMap, bName, 'total_ad_orders');
            const currClicks = findMetric(boPmMap, bName, 'total_ad_clicks');
            const prevClicks = findMetric(boPrevPmMap, bName, 'total_ad_clicks');
            const currConv = currClicks > 0 ? (currOrders / currClicks) * 100 : 0;
            const prevConv = prevClicks > 0 ? (prevOrders / prevClicks) * 100 : 0;
            const convTrend = calcTrendPp(currConv, prevConv);

            // Availability
            const currNeno = findMetric(boOfftakeMap, bName, 'total_neno');
            const prevNeno = findMetric(boPrevOfftakeMap, bName, 'total_neno');
            const currDeno = findMetric(boOfftakeMap, bName, 'total_deno');
            const prevDeno = findMetric(boPrevOfftakeMap, bName, 'total_deno');
            const currAvail = currDeno > 0 ? (currNeno / currDeno) * 100 : 0;
            const prevAvail = prevDeno > 0 ? (prevNeno / prevDeno) * 100 : 0;
            const availTrend = calcTrendPp(currAvail, prevAvail);

            // Buy Box %
            const currBuyBoxNeno = findMetric(boOfftakeMap, bName, 'total_buy_box_neno');
            const prevBuyBoxNeno = findMetric(boPrevOfftakeMap, bName, 'total_buy_box_neno');
            const currBuyBoxPct = currDeno > 0 ? (currBuyBoxNeno / currDeno) * 100 : 0;
            const prevBuyBoxPct = prevDeno > 0 ? (prevBuyBoxNeno / prevDeno) * 100 : 0;
            const buyBoxPctTrend = calcTrendPp(currBuyBoxPct, prevBuyBoxPct);


            // SOS - Lookup from pre-calculated bulk map (NO DATABASE QUERY!)
            const sosData = bulkSosMap.get(brandName) || {
                current: { overall: 0, spons: 0, organic: 0 },
                previous: { overall: 0, spons: 0, organic: 0 }
            };
            const currSos = sosData.current.overall || 0;
            const prevSos = sosData.previous.overall || 0;
            const sosTrend = calcTrendPp(currSos, prevSos);

            const currSponsSos = sosData.current.spons || 0;
            const prevSponsSos = sosData.previous.spons || 0;
            const sponsSosTrend = calcTrendPp(currSponsSos, prevSponsSos);

            const currOrganicSos = sosData.current.organic || 0;
            const prevOrganicSos = sosData.previous.organic || 0;
            const organicSosTrend = calcTrendPp(currOrganicSos, prevOrganicSos);


            // Market Share
            const currMs = findMetric(boMsMap, brandName, 'avg_ms');
            const prevMs = findMetric(boPrevMsMap, brandName, 'avg_ms');
            const msTrend = calcTrendPp(currMs, prevMs);

            // Promo My Brand
            const currDisc = findMetric(boOfftakeMap, brandName, 'avg_discount');
            const prevDisc = findMetric(boPrevOfftakeMap, brandName, 'avg_discount');
            const discTrend = calcTrendPp(currDisc, prevDisc);

            // Promo Compete (Avg Discount of ALL OTHER brands)
            let otherBrandsAvgDisc = 0;
            if (totalDiscountCount > 1) {
                const myDisc = boOfftakeMap.has(brandName.toLowerCase()) ? parseFloat(boOfftakeMap.get(brandName.toLowerCase()).avg_discount || 0) : 0;
                const isPresent = boOfftakeMap.has(brandName.toLowerCase());
                const otherSum = isPresent ? totalDiscountSum - myDisc : totalDiscountSum;
                const otherCount = isPresent ? totalDiscountCount - 1 : totalDiscountCount;
                otherBrandsAvgDisc = otherCount > 0 ? otherSum / otherCount : 0;
            }

            let prevOtherBrandsAvgDisc = 0;
            if (prevTotalDiscountCount > 1) {
                const myPrevDisc = boPrevOfftakeMap.has(brandName.toLowerCase()) ? parseFloat(boPrevOfftakeMap.get(brandName.toLowerCase()).avg_discount || 0) : 0;
                const isPresent = boPrevOfftakeMap.has(brandName.toLowerCase());
                const otherSum = isPresent ? prevTotalDiscountSum - myPrevDisc : prevTotalDiscountSum;
                const otherCount = isPresent ? prevTotalDiscountCount - 1 : prevTotalDiscountCount;
                prevOtherBrandsAvgDisc = otherCount > 0 ? otherSum / otherCount : 0;
            }

            const promoCompeteTrend = calcTrendPp(otherBrandsAvgDisc, prevOtherBrandsAvgDisc);

            // CPM
            const currImp = findMetric(boPmMap, bName, 'total_ad_impressions');
            const prevImp = findMetric(boPrevPmMap, bName, 'total_ad_impressions');
            const currCpm = currImp > 0 ? (currSpend / currImp) * 1000 : 0;
            const prevCpm = prevImp > 0 ? (prevSpend / prevImp) * 1000 : 0;
            const cpmTrend = calcTrend(currCpm, prevCpm);

            // CPC
            const currCpc = currClicks > 0 ? currSpend / currClicks : 0;
            const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;
            const cpcTrend = calcTrend(currCpc, prevCpc);

            // Transform to match PlatformOverview structure
            return {
                key: brandName.toLowerCase().replace(/\s+/g, '_'),
                label: brandName,
                type: "Brand",
                columns: [
                    { title: "Offtakes", value: formatCurrency(currSales), meta: { units: `${(currSales / 100000).toFixed(2)} L`, change: `${salesTrend >= 0 ? '▲' : '▼'}${Math.abs(salesTrend).toFixed(2)}%` } },
                    { title: "Spend", value: formatCurrency(currSpend), meta: { units: formatCurrency(currSpend), change: `${spendTrend >= 0 ? '▲' : '▼'}${Math.abs(spendTrend).toFixed(2)}%` } },
                    { title: "ROAS", value: `${currRoas.toFixed(2)}x`, meta: { units: `${formatCurrency(currAdSales)}`, change: `${roasTrend >= 0 ? '▲' : '▼'}${Math.abs(roasTrend).toFixed(2)}%` } },
                    {
                        title: "Inorg Sales",
                        value: `${currInorgPct.toFixed(2)}%`,
                        meta: { units: formatCurrency(currAdSales), change: `${inorgPctTrend >= 0 ? '▲' : '▼'}${Math.abs(inorgPctTrend).toFixed(2)}%` }
                    },
                    { title: "Conversion", value: `${currConv.toFixed(2)}%`, meta: { units: `${(currOrders / 1000).toFixed(2)}k`, change: `${convTrend >= 0 ? '▲' : '▼'}${Math.abs(convTrend).toFixed(2)}%` } },
                    { title: "Availability", value: `${currAvail.toFixed(2)}%`, meta: { units: `${currDeno}`, change: `${availTrend >= 0 ? '▲' : '▼'}${Math.abs(availTrend).toFixed(2)}%` } },
                    { title: "SOS", value: `${currSos.toFixed(2)}%`, meta: { units: "overall", change: `${sosTrend >= 0 ? '▲' : '▼'}${Math.abs(sosTrend).toFixed(2)}%` } },
                    { title: "Ad SOV", value: `${currSponsSos.toFixed(2)}%`, meta: { units: "sponsored", change: `${sponsSosTrend >= 0 ? '▲' : '▼'}${Math.abs(sponsSosTrend).toFixed(2)}%` } },
                    { title: "Organic SOV", value: `${currOrganicSos.toFixed(2)}%`, meta: { units: "organic", change: `${organicSosTrend >= 0 ? '▲' : '▼'}${Math.abs(organicSosTrend).toFixed(2)}%` } },
                    { title: "Market Share", value: `${currMs.toFixed(2)}%`, meta: { units: formatCurrency(currSales * (100 / currMs) || 0), change: `${msTrend >= 0 ? '▲' : '▼'}${Math.abs(msTrend).toFixed(2)}%` } },
                    { title: "Buy Box %", value: `${currBuyBoxPct.toFixed(2)}%`, meta: { units: `${currDeno}`, change: `${buyBoxPctTrend >= 0 ? '▲' : '▼'}${Math.abs(buyBoxPctTrend).toFixed(2)}%` } },
                    { title: "Promo My Brand", value: `${currDisc.toFixed(2)}%`, meta: { units: `${currDisc.toFixed(2)}%`, change: `${discTrend >= 0 ? '▲' : '▼'}${Math.abs(discTrend).toFixed(2)}%` } },
                    { title: "Promo Compete", value: `${otherBrandsAvgDisc.toFixed(2)}%`, meta: { units: `${otherBrandsAvgDisc.toFixed(2)}%`, change: `${promoCompeteTrend >= 0 ? '▲' : '▼'}${Math.abs(promoCompeteTrend).toFixed(2)}%` } },
                    { title: "CPM", value: formatCurrency(currCpm), meta: { units: formatCurrency(currCpm), change: `${cpmTrend >= 0 ? '▲' : '▼'}${Math.abs(cpmTrend).toFixed(2)}%` } },
                    { title: "CPC", value: formatCurrency(currCpc), meta: { units: formatCurrency(currCpc), change: `${cpcTrend >= 0 ? '▲' : '▼'}${Math.abs(cpcTrend).toFixed(2)}%` } }
                ]
            };
        }));

        console.log(`[Watch Tower Service] Returning categoryOverview with ${categoryOverview?.length || 0} items`);
        return {
            topMetrics,
            summaryMetrics,
            performanceMetricsKpis,
            skuTable: skuTableData,
            platformOverview,
            monthOverview,
            categoryOverview,
            brandsOverview
        };

    } catch (error) {
        console.error("Error in watchTowerService:", error);
        throw error;
    }
};

const getPlatforms = async (channel) => {
    try {
        const cols = await getTableColumns('rca_sku_dim');
        const platformCol = resolveColumn(cols, 'platform');
        const channelCol = resolveColumn(cols, 'channel');
        const hasChannel = columnExists(cols, 'channel');

        let query;
        if (hasChannel && channel && channel !== 'All') {
            const channelStr = (Array.isArray(channel) ? channel.join(',') : String(channel)).toLowerCase();
            const isEcom = channelStr.includes('ecom') || channelStr.includes('e-com');
            const isQcomm = channelStr.includes('quick') || channelStr.includes('qcomm');
            const isEpharm = channelStr.includes('epharm') || channelStr.includes('e-pharm') || channelStr.includes('pharm');

            if (isEpharm) {
                query = `SELECT DISTINCT ${platformCol} AS platform FROM rca_sku_dim WHERE ${platformCol} IS NOT NULL AND ${platformCol} != '' AND (lower(${channelCol}) LIKE '%pharm%' OR lower(${channelCol}) LIKE '%epharm%' OR lower(${platformCol}) IN ('pharmeasy', 'apollo 247', 'apollo', '1_mg', '1mg', 'tata 1mg', 'netmeds', 'truemeds') OR lower(${platformCol}) LIKE '%pharm%' OR lower(${platformCol}) LIKE '%meds%') ORDER BY platform`;
            } else if (isEcom) {
                query = `SELECT DISTINCT ${platformCol} AS platform FROM rca_sku_dim WHERE ${platformCol} IS NOT NULL AND ${platformCol} != '' AND lower(${channelCol}) LIKE '%ecom%' ORDER BY platform`;
            } else if (isQcomm) {
                query = `SELECT DISTINCT ${platformCol} AS platform FROM rca_sku_dim WHERE ${platformCol} IS NOT NULL AND ${platformCol} != '' AND (lower(${channelCol}) LIKE '%quick%' OR lower(${channelCol}) LIKE '%qcomm%') ORDER BY platform`;
            } else {
                query = `SELECT DISTINCT ${platformCol} AS platform FROM rca_sku_dim WHERE ${platformCol} IS NOT NULL AND ${platformCol} != '' AND lower(${channelCol}) LIKE '%${channelStr.replace(/'/g, "''")}%' ORDER BY platform`;
            }
        } else {
            query = `SELECT DISTINCT ${platformCol} AS platform FROM rca_sku_dim WHERE ${platformCol} IS NOT NULL AND ${platformCol} != '' ORDER BY platform`;
        }
        const results = await queryClickHouse(query);
        return results.map(p => p.platform).filter(Boolean).sort();
    } catch (error) {
        console.error("Error fetching platforms:", error);
        return [];
    }
};

const getPlatformChannels = async () => {
    try {
        const cols = await getTableColumns('rca_sku_dim');
        const platformCol = resolveColumn(cols, 'platform');
        const hasChannel = columnExists(cols, 'channel');

        let query;
        if (hasChannel) {
            const channelCol = resolveColumn(cols, 'channel');
            query = `SELECT DISTINCT ${platformCol} AS platform, ${channelCol} AS channel FROM rca_sku_dim WHERE ${platformCol} IS NOT NULL AND ${platformCol} != '' ORDER BY platform`;
        } else {
            // DB doesn't have a channel column — return platforms with empty channel (defaults to Quick Commerce tree)
            console.log(`[getPlatformChannels] 'channel' column not found in rca_sku_dim for DB=${getCurrentDbName()}, returning platforms without channel mapping`);
            query = `SELECT DISTINCT ${platformCol} AS platform, '' AS channel FROM rca_sku_dim WHERE ${platformCol} IS NOT NULL AND ${platformCol} != '' ORDER BY platform`;
        }
        const results = await queryClickHouse(query);
        return results.filter(r => r.platform);
    } catch (error) {
        console.error("Error fetching platform-channel mapping:", error);
        return [];
    }
};

const getPmPlatforms = async () => {
    try {
        const pmSrc = await getPmSource();
        const query = `SELECT DISTINCT ${pmSrc.f.platform} AS platform FROM ${pmSrc.table} WHERE ${pmSrc.f.platform} IS NOT NULL AND ${pmSrc.f.platform} != '' ORDER BY platform`;
        const results = await queryClickHouse(query);
        return results.map(p => p.platform).filter(Boolean).sort();
    } catch (error) {
        console.error("Error fetching PM platforms:", error);
        return [];
    }
};

const getPlatformMetadata = async () => {
    try {
        // 1) Get distinct platforms from rca_sku_dim
        const platformsFromDb = await queryClickHouse(
            `SELECT DISTINCT platform FROM rca_sku_dim WHERE platform IS NOT NULL AND platform != '' ORDER BY platform`
        );
        if (!platformsFromDb || platformsFromDb.length === 0) return [];

        // 2) Get platform images from rb_platform
        let platformVisualsMap = new Map();
        try {
            const tableExists = await queryClickHouse("EXISTS TABLE rb_platform");
            if (tableExists && tableExists[0]?.result === 1) {
                const visuals = await queryClickHouse(
                    "SELECT DISTINCT pf_name, platform_description FROM rb_platform WHERE platform_description IS NOT NULL AND platform_description != ''"
                );
                visuals.forEach(v => {
                    if (v.pf_name && v.platform_description) {
                        platformVisualsMap.set(v.pf_name.toLowerCase().trim(), v.platform_description);
                    }
                });
            }
        } catch (vErr) {
            console.error('[getPlatformMetadata] Error fetching visuals from rb_platform:', vErr.message);
        }

        // Fallback logos for common platforms
        const fallbackLogos = {
            'zepto': 'https://upload.wikimedia.org/wikipedia/en/7/7d/Logo_of_Zepto.png',
            'blinkit': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Blinkit-yellow-rounded.svg',
            'swiggy': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Swiggy_Logo_2024.webp',
            'amazon': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
            'amazon now': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
            'flipkart': 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Flipkart-logo.png',
            'instamart': '/instamart.jpeg',
            'swiggy instamart': '/instamart.jpeg',
            'jiomart': 'https://upload.wikimedia.org/wikipedia/en/5/54/JioMart_logo.svg',
            'meesho': 'https://upload.wikimedia.org/wikipedia/commons/3/33/Meesho_logo.png',
            'myntra': 'https://static.vecteezy.com/system/resources/previews/067/941/729/non_2x/myntra-logo-myntra-icon-transparent-background-free-png.png',
            'pharmeasy': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQmvGD4R2shvyr2o70i_tkpo4J2fygT8Im2YAcHruh45A&s',
            '1mg': 'https://downloadr2.apkmirror.com/wp-content/uploads/2022/01/23/61e9605e26437.png',
            '1_mg': 'https://downloadr2.apkmirror.com/wp-content/uploads/2022/01/23/61e9605e26437.png',
            'apollo': 'https://pbs.twimg.com/profile_images/800955664155557888/OP1uO2ZW_400x400.jpg',
            'apollo 247': 'https://pbs.twimg.com/profile_images/800955664155557888/OP1uO2ZW_400x400.jpg',
            'netmeds': 'https://www.haptik.ai/hs-fs/hubfs/Netmeds_240323.webp',
            'bigbasket': 'https://upload.wikimedia.org/wikipedia/commons/2/22/Bigbasket_logo.png'
        };

        // 3) Merge: for each platform in rca_sku_dim, attach the image
        const result = platformsFromDb.map(row => {
            const pfName = row.platform;
            const key = pfName.toLowerCase().trim();
            const dbImage = platformVisualsMap.get(key);
            // Use DB image first (could be URL or relative path), then fallback
            const image = dbImage || fallbackLogos[key] || null;
            return { pf_name: pfName, platform_description: image };
        });

        return result;
    } catch (error) {
        console.error("Error fetching platform metadata:", error);
        return [];
    }
};


const getChannels = async () => {
    try {
        const cols = await getTableColumns('rb_pdp_olap');
        const hasChannel = columnExists(cols, 'channel');
        if (!hasChannel) {
            console.log(`[getChannels] 'channel' column not found in rb_pdp_olap for DB=${getCurrentDbName()}`);
            return [];
        }
        const channelCol = resolveColumn(cols, 'channel');
        const query = `SELECT DISTINCT ${channelCol} AS channel FROM rb_pdp_olap WHERE ${channelCol} IS NOT NULL AND ${channelCol} != '' ORDER BY channel`;
        const results = await queryClickHouse(query);
        return results.map(r => r.channel).filter(Boolean).sort();
    } catch (error) {
        console.error("Error fetching channels from rb_pdp_olap:", error);
        return [];
    }
};

const getPdpPlatforms = async () => {
    try {
        const cols = await getTableColumns('rb_pdp_olap');
        const hasPlatform = columnExists(cols, 'platform');
        if (!hasPlatform) {
            console.log(`[getPdpPlatforms] 'platform' column not found in rb_pdp_olap for DB=${getCurrentDbName()}`);
            return [];
        }
        const platformCol = resolveColumn(cols, 'platform');
        const query = `SELECT DISTINCT ${platformCol} AS platform FROM rb_pdp_olap WHERE ${platformCol} IS NOT NULL AND ${platformCol} != '' ORDER BY platform`;
        const results = await queryClickHouse(query);
        return results.map(r => r.platform).filter(Boolean).sort();
    } catch (error) {
        console.error("Error fetching platforms from rb_pdp_olap:", error);
        return [];
    }
};

// Exported function - no caching layer
const getSummaryMetrics = async (filters) => {
    return await computeSummaryMetrics(filters);
};

const getBrands = async (platform, includeCompetitors = false) => {
    try {
        const brandCol = await getRcaSkuDimBrandColumn();
        const conditions = [`${brandCol} IS NOT NULL`, `${brandCol} != ''`];
        if (platform && platform !== 'All') {
            const platArr = normalizeFilterArray(platform);
            if (platArr.length === 1) {
                conditions.push(`platform = '${platArr[0].replace(/'/g, "''")}'`);
            } else if (platArr.length > 1) {
                conditions.push(`platform IN (${platArr.map(p => `'${p.replace(/'/g, "''")}'`).join(', ')})`);
            }
        }
        if (!includeCompetitors) {
            conditions.push(`comp_flag = 0`);
        }

        const query = `SELECT DISTINCT ${brandCol} as brand FROM rca_sku_dim WHERE ${conditions.join(' AND ')} ORDER BY brand`;
        const results = await queryClickHouse(query);
        return results.map(r => r.brand).filter(Boolean);
    } catch (error) {
        console.error('Error fetching brands:', error);
        return [];
    }
};

const getKeywords = async (brand) => {
    try {
        // ClickHouse query
        const conditions = [`keyword IS NOT NULL`, `keyword != ''`];
        if (brand && brand !== 'All') {
            conditions.push(`brand = '${brand.replace(/'/g, "''")}'`);
        }

        const query = `SELECT DISTINCT keyword FROM rb_kw_olap WHERE ${conditions.join(' AND ')} ORDER BY keyword`;
        const results = await queryClickHouse(query);
        return results.map(k => k.keyword).filter(Boolean).sort();
    } catch (error) {
        console.error("Error fetching keywords:", error);
        return [];
    }
};

const getLocations = async (platform, brand, includeCompetitors = false) => {
    try {
        const conditions = [`location IS NOT NULL`, `location != ''`];
        if (platform && platform !== 'All') {
            const platArr = normalizeFilterArray(platform);
            if (platArr.length === 1) {
                conditions.push(`platform = '${platArr[0].replace(/'/g, "''")}'`);
            } else if (platArr.length > 1) {
                conditions.push(`platform IN (${platArr.map(p => `'${p.replace(/'/g, "''")}'`).join(', ')})`);
            }
        }
        if (brand && brand !== 'All') {
            const brandArr = normalizeFilterArray(brand);
            if (brandArr.length === 1) {
                conditions.push(`brand_name = '${brandArr[0].replace(/'/g, "''")}'`);
            } else if (brandArr.length > 1) {
                conditions.push(`brand_name IN (${brandArr.map(b => `'${b.replace(/'/g, "''")}'`).join(', ')})`);
            }
        }
        if (!includeCompetitors) {
            conditions.push(`comp_flag = 0`);
        }

        const query = `SELECT DISTINCT location FROM rca_sku_dim WHERE ${conditions.join(' AND ')} ORDER BY location`;
        const results = await queryClickHouse(query);
        return results.map(l => l.location).filter(Boolean);
    } catch (error) {
        console.error("Error fetching locations:", error);
        return [];
    }
};

/**
 * Generate time buckets based on start/end date and time step
 */
const generateTimeBuckets = (startDate, endDate, timeStep) => {
    const buckets = [];
    let current = startDate.clone();

    // Remove strict startOf alignment to respect user's "today to 1M back" request
    // But we still need to align Daily to start of day
    current = current.startOf('day');

    const end = endDate.clone().endOf('day');

    while (current.isBefore(end) || current.isSame(end, 'day')) {
        let label;
        let groupKey;

        if (timeStep === 'Monthly') {
            // Label format must match frontend parser: "DD MMM'YY" (e.g., "08 Nov'25")
            label = current.format("DD MMM'YY");
            groupKey = current.format('YYYY-MM-01'); // Matches DB DATE_FORMAT (Calendar Month)
            current = current.add(1, 'month');
        } else if (timeStep === 'Weekly') {
            // Label format must match frontend parser: "DD MMM'YY" (e.g., "17 Dec'25")
            label = current.format("DD MMM'YY");
            // Matches DB YEARWEEK mode 1
            const year = current.isoWeekYear();
            const week = current.isoWeek();
            groupKey = year * 100 + week;
            current = current.add(1, 'week');
        } else { // Daily
            // Label format must match frontend parser: "DD MMM'YY" (e.g., "17 Dec'25")
            label = current.format("DD MMM'YY");
            groupKey = current.format('YYYY-MM-DD'); // Matches DB DATE
            current = current.add(1, 'day');
        }

        buckets.push({
            label,
            groupKey,
            date: current.clone().subtract(1, timeStep === 'Daily' ? 'day' : timeStep === 'Weekly' ? 'week' : 'month').toDate()
        });
    }

    // Ensure the last bucket covers the endDate
    // If the loop finished but the last bucket's interval doesn't include endDate, add one more.
    // Actually, we can check if the last bucket's groupKey matches the endDate's groupKey.
    // If not, we add the endDate's bucket.

    if (buckets.length > 0) {
        const lastBucket = buckets[buckets.length - 1];
        let endGroupKey;
        let endLabel;

        if (timeStep === 'Monthly') {
            endGroupKey = endDate.format('YYYY-MM-01');
            endLabel = endDate.format("DD MMM'YY");
        } else if (timeStep === 'Weekly') {
            const year = endDate.isoWeekYear();
            const week = endDate.isoWeek();
            endGroupKey = year * 100 + week;
            endLabel = endDate.format("DD MMM'YY");
        } else {
            endGroupKey = endDate.format('YYYY-MM-DD');
            endLabel = endDate.format("DD MMM'YY");
        }

        // If the last bucket is NOT the same group as the end date, add the end date bucket
        if (String(lastBucket.groupKey) !== String(endGroupKey)) {
            buckets.push({
                label: endLabel,
                groupKey: endGroupKey,
                date: endDate.toDate()
            });
        }
    }

    return buckets;
};
// Internal implementation with all the compute logic - MIGRATED TO CLICKHOUSE
const computeTrendData = async (filters) => {
    try {
        const { brand, location, platform, period, timeStep, category, startDate: customStart, endDate: customEnd, skuName, skuCode } = filters;
        const channel = extractChannel(filters);

        // 1. Determine Date Range
        let endDate = await getCachedMaxDate();
        let startDate = endDate.clone();

        if (period === 'Custom' && customStart && customEnd) {
            startDate = dayjs(customStart);
            endDate = dayjs(customEnd);
        } else {
            switch (period) {
                case '1M': startDate = startDate.subtract(1, 'month'); break;
                case '3M': startDate = startDate.subtract(3, 'month'); break;
                case '6M': startDate = startDate.subtract(6, 'month'); break;
                case '1Y': startDate = startDate.subtract(1, 'year'); break;
                default: startDate = startDate.subtract(3, 'month'); // Default 3M
            }
        }

        console.log(`computeTrendData [ClickHouse]: period=${period}, start=${startDate.format()}, end=${endDate.format()}`);

        // Helper to escape strings for ClickHouse
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // 2. Determine Grouping for ClickHouse
        let groupExpression;
        let groupExpressionMs;
        let groupExpressionKw;

        if (timeStep === 'Monthly') {
            groupExpression = `formatDateTime(toDate(DATE), '%Y-%m-01')`;
            groupExpressionMs = `formatDateTime(toDate(created_on), '%Y-%m-01')`;
            groupExpressionKw = `formatDateTime(toDate(DATE), '%Y-%m-01')`;
        } else if (timeStep === 'Weekly') {
            groupExpression = `toYearWeek(toDate(DATE), 1)`;
            groupExpressionMs = `toYearWeek(toDate(created_on), 1)`;
            groupExpressionKw = `toYearWeek(toDate(DATE), 1)`;
        } else { // Daily
            groupExpression = `formatDateTime(toDate(DATE), '%Y-%m-%d')`;
            groupExpressionMs = `formatDateTime(toDate(created_on), '%Y-%m-%d')`;
            groupExpressionKw = `formatDateTime(toDate(DATE), '%Y-%m-%d')`;
        }

        const src = await getWatchtowerSource(filters);
        // 3. Build WHERE conditions for dynamic source
        const buildPdpConds = () => {
            const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
            const conds = [`${dateCol} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];

            // Default to "Our Brands" only for consistency with Overview cards
            conds.push(`toString(${src.f.compFlag}) = '0'`);

            const trendCatArr = normalizeFilterArray(category);
            if (trendCatArr && trendCatArr.length > 0) {
                const catCol = src.f.category;
                if (trendCatArr.length === 1) {
                    conds.push(`${catCol} = '${escapeStr(trendCatArr[0])}'`);
                } else {
                    conds.push(`${catCol} IN (${trendCatArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
                }
            }
            const trendBrandArr = normalizeFilterArray(brand);
            if (trendBrandArr && trendBrandArr.length > 0) {
                const brandConds = trendBrandArr.map(b => `${src.f.brand} LIKE '%${escapeStr(b)}%'`).join(' OR ');
                conds.push(`(${brandConds})`);
            }
            const trendLocArr = normalizeFilterArray(location);
            if (trendLocArr && trendLocArr.length > 0) {
                const trendPlatArr = normalizeFilterArray(platform);
                const locCond = buildLocationQueryCond(trendLocArr, trendPlatArr, src.f.location, src.f.platform);
                if (locCond) conds.push(locCond);
            }

            // Channel-based platform filtering
            const trendPlatArr = normalizeFilterArray(platform);
            const platformCond = buildPlatformChannelCond(trendPlatArr, channel, src.f.platform);
            if (platformCond) conds.push(platformCond);

            // Advanced SKU Search Filters
            const skuArrArr = normalizeFilterArray(skuName);
            if (skuArrArr && skuArrArr.length > 0) {
                const skuConds = skuArrArr.map(s => `${src.f.product} LIKE '%${escapeStr(s)}%'`).join(' OR ');
                conds.push(`(${skuConds})`);
            }
            const skuCodeArrArr = normalizeFilterArray(skuCode);
            if (skuCodeArrArr && skuCodeArrArr.length > 0) {
                const skuCodeConds = skuCodeArrArr.map(s => `toString(${src.f.skuCode}) LIKE '%${escapeStr(s)}%'`).join(' OR ');
                conds.push(`(${skuCodeConds})`);
            }

            if (!src.isAgg) {
                const mslArr = normalizeFilterArray(filters.msl);
                if (mslArr && mslArr.length > 0) {
                    const mslConds = mslArr.map(m => `toString(${src.f.msl}) = '${escapeStr(m)}'`).join(' OR ');
                    conds.push(`(${mslConds})`);
                }
            }

            return conds.join(' AND ');
        };

        const pdpConds = buildPdpConds();

        // Query for Offtake, OSA, Discount from dynamic source
        const trendResults = await queryClickHouse(`
            SELECT 
                ${groupExpression.replace('DATE', src.f.date)} as date_group,
                MAX(toDate(${src.f.date})) as ref_date,
                SUM(${src.f.sales}) as offtake,
                SUM(CASE WHEN toString(${src.f.compFlag}) = '0' THEN ${src.f.neno} ELSE 0 END) as total_neno,
                SUM(CASE WHEN toString(${src.f.compFlag}) = '0' THEN ${src.f.deno} ELSE 0 END) as total_deno,
                (toFloat64(SUM(CASE WHEN toString(${src.f.compFlag}) = '0' THEN ${src.f.neno} ELSE 0 END)) / NULLIF(toFloat64(SUM(CASE WHEN toString(${src.f.compFlag}) = '0' THEN ${src.f.deno} ELSE 0 END)), 0)) * 100 as calculated_osa,
                SUM(CASE WHEN ${src.f.mrp} > 0 THEN ${src.f.sales} ELSE 0 END) as sales_with_mrp,
                SUM(if(${src.f.mrp} > 0, ${src.f.mrp} * ${src.f.quantitySold}, 0)) as mrp_sales_valid
            FROM ${src.table}
            WHERE ${pdpConds}
            GROUP BY date_group
            ORDER BY ref_date ASC
        `);

        // 4. Query Market Share using ClickHouse
        // Get valid brands (comp_flag = 0)
        const validBrandsResult = await queryClickHouse(`
            SELECT DISTINCT brand_name 
            FROM rca_sku_dim 
            WHERE toString(comp_flag) = '0' AND brand_name IS NOT NULL
        `);
        const validBrandNamesForMs = validBrandsResult.map(b => b.brand_name).filter(Boolean);

        // Build MS conditions
        const buildMsConds = (includeBrandFilter = false) => {
            const conds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
            conds.push(`sales IS NOT NULL`);
            const catArr = normalizeFilterArray(category);
            if (catArr && catArr.length > 0) {
                if (catArr.length === 1) {
                    conds.push(`category = '${escapeStr(catArr[0])}'`);
                } else {
                    conds.push(`category IN (${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
                }
            }
            const locArr = normalizeFilterArray(location);
            if (locArr && locArr.length > 0) {
                if (locArr.length === 1) {
                    conds.push(`location = '${escapeStr(locArr[0])}'`);
                } else {
                    conds.push(`location IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
            }
            const trendPlatArrMs = normalizeFilterArray(platform);
            if (trendPlatArrMs && trendPlatArrMs.length > 0) {
                if (trendPlatArrMs.length === 1) {
                    conds.push(`platform = '${escapeStr(trendPlatArrMs[0])}'`);
                } else {
                    conds.push(`platform IN (${trendPlatArrMs.map(p => `'${escapeStr(p)}'`).join(', ')})`);
                }
            }
            if (includeBrandFilter && validBrandNamesForMs.length > 0) {
                const brandList = validBrandNamesForMs.map(b => `'${escapeStr(b)}'`).join(', ');
                conds.push(`group_brand IN (${brandList})`);
            }
            return conds.join(' AND ');
        };

        // Numerator: Sales of our brands (comp_flag=0) grouped by time
        const msNumerator = await queryClickHouse(`
            SELECT ${groupExpressionMs} as date_group, SUM(toFloat64OrZero(toString(sales))) as our_sales
            FROM rb_ms_olap
            WHERE ${buildMsConds(true)}
            GROUP BY ${groupExpressionMs}
        `);

        // Denominator: Total platform sales grouped by time
        const msDenominator = await queryClickHouse(`
            SELECT ${groupExpressionMs} as date_group, SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE ${buildMsConds(false)}
            GROUP BY ${groupExpressionMs}
        `);

        // Create maps for easy lookup
        const msNumMap = new Map(msNumerator.map(r => [String(r.date_group), parseFloat(r.our_sales || 0)]));
        const msDenomMap = new Map(msDenominator.map(r => [String(r.date_group), parseFloat(r.total_sales || 0)]));

        // Calculate MS for each time bucket
        const msResults = msDenominator.map(r => {
            const dateGroup = String(r.date_group);
            const ourSales = msNumMap.get(dateGroup) || 0;
            const totalSales = msDenomMap.get(dateGroup) || 0;
            const avgMs = totalSales > 0 ? (ourSales / totalSales) * 100 : 0;
            return { date_group: dateGroup, avg_ms: avgMs };
        });

        // 5. Query Share of Search (SOV) using ClickHouse
        // Uses overall/spons/organic columns and flag column for our brands
        const buildSosConds = () => {
            const conds = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
            // Only consider top 10 ranked positions for SOS
            conds.push(`POSITION <= 10`);
            const catArr = normalizeFilterArray(category);
            if (catArr && catArr.length > 0) {
                if (catArr.length === 1) {
                    conds.push(`keyword_category = '${escapeStr(catArr[0])}'`);
                } else {
                    conds.push(`keyword_category IN (${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
                }
            }
            const locArr = normalizeFilterArray(location);
            if (locArr && locArr.length > 0) {
                if (locArr.length === 1) {
                    conds.push(`location_name = '${escapeStr(locArr[0])}'`);
                } else {
                    conds.push(`location_name IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
            }
            const trendPlatArrSos = normalizeFilterArray(platform);
            if (trendPlatArrSos && trendPlatArrSos.length > 0) {
                const pCond = buildPlatformChannelCond(trendPlatArrSos, channel, 'platform_name');
                if (pCond) conds.push(pCond);
            } else {
                const pCond = buildPlatformChannelCond(null, channel, 'platform_name');
                if (pCond) conds.push(pCond);
            }
            return conds.join(' AND ');
        };

        // Numerator: Our brands using flag column (reliable native marker in rb_kw_olap)
        const sosNumConds = buildSosConds();
        let numCondition = "toString(flag) = '1'";

        // POSITION <= 10 constraint: Only consider top 10 positions for SOS
        const sosNumerator = await queryClickHouse(`
            SELECT ${groupExpressionKw} as date_group, sumIf(toInt32(overall), POSITION <= 10) as count
            FROM rb_kw_olap
            WHERE ${sosNumConds} AND ${numCondition}
            GROUP BY ${groupExpressionKw}
        `);

        // Denominator: All products (no brand filter)
        const sosDenominator = await queryClickHouse(`
            SELECT ${groupExpressionKw} as date_group, sumIf(toInt32(overall), POSITION <= 10) as count
            FROM rb_kw_olap
            WHERE ${sosNumConds}
            GROUP BY ${groupExpressionKw}
        `);



        // 6. Merge and Format Data
        const buckets = generateTimeBuckets(startDate, endDate, timeStep);

        const timeSeries = buckets.map(bucket => {
            // Find matching data in results
            // We need to match bucket.groupKey with row.date_group
            // For Weekly: bucket.groupKey is int (202548), row.date_group is int
            // For Monthly: bucket.groupKey is string (2025-11-01), row.date_group is string
            // For Daily: bucket.groupKey is string (2025-11-25), row.date_group is string

            const row = trendResults.find(r => String(r.date_group) === String(bucket.groupKey)) || {};

            // OSA
            const osa = row.calculated_osa !== null && row.calculated_osa !== undefined ? parseFloat(row.calculated_osa) : null;

            // Discount
            const salesWithMrp = parseFloat(row.sales_with_mrp || 0);
            const mrpSalesValid = parseFloat(row.mrp_sales_valid || 0);
            let discount = 0;
            if (mrpSalesValid > 0) {
                discount = (1 - (salesWithMrp / mrpSalesValid)) * 100;
            }
            discount = Math.max(0, Math.min(100, discount));

            // Market Share
            const msMatch = msResults.find(m => String(m.date_group) === String(bucket.groupKey));
            const categoryShare = parseFloat(msMatch?.avg_ms || 0);

            // SOV
            const sosNum = sosNumerator.find(s => String(s.date_group) === String(bucket.groupKey));
            const sosDen = sosDenominator.find(s => String(s.date_group) === String(bucket.groupKey));
            const numCount = parseInt(sosNum?.count || 0, 10);
            const denCount = parseInt(sosDen?.count || 0, 10);
            const sov = denCount > 0 ? (numCount / denCount) * 100 : 0;

            return {
                date: bucket.label,
                offtake: parseFloat(row.offtake || 0),
                osa: osa !== null ? parseFloat(osa.toFixed(2)) : null,
                categoryShare: parseFloat(categoryShare.toFixed(2)),
                MarketShare: parseFloat(categoryShare.toFixed(2)), // Overall MS in this context is same as categoryShare if cat filter applied
                marketShare: parseFloat(categoryShare.toFixed(2)),
                discount: parseFloat(discount.toFixed(2)),
                sov: parseFloat(sov.toFixed(2))
            };
        });

        // If timeStep is Monthly, we might want to ensure all months in range are present?
        // But for now, returning what we have is fine.

        return {
            timeSeries,
            metrics: {
                offtake: true,
                estCategoryShare: true,
                osa: true,
                discount: true,
                overallSOV: true
            }
        };

    } catch (error) {
        console.error("Error in computeTrendData:", error);
        throw error;
    }
};

const getTrendData = async (filters) => {
    return await computeTrendData(filters);
};

const getBrandCategories = async (platform) => {
    try {
        const conditions = [`category IS NOT NULL`, `category != ''`, `category != 'Others'`];
        const platArr = normalizeFilterArray(platform);
        if (platArr && platArr.length > 0) {
            conditions.push(`platform IN (${platArr.map(p => `'${p.replace(/'/g, "''")}'`).join(',')})`);
        }

        const query = `SELECT DISTINCT category FROM rca_sku_dim WHERE ${conditions.join(' AND ')} ORDER BY category ASC`;
        const rows = await queryClickHouse(query);
        return rows.map(r => r.category);
    } catch (error) {
        console.error("Error fetching brand categories:", error);
        return ["None"];
    }
};

// ==================== Progressive Loading Section Endpoints ====================
// These methods split getSummaryMetrics into focused endpoints for better performance

/**
 * Get Overview Data (topMetrics, summaryMetrics, performanceMetricsKpis)
 * OPTIMIZED: Only computes overview data without platform/month/category/brand sections
 */
const getOverview = async (filters) => {
    console.log('[getOverview] Computing OPTIMIZED overview data (SKIPPING performance KPIs)...');

    // Skip performance KPIs computation - they are loaded separately via /performance-metrics
    const result = await computeSummaryMetrics(filters, { onlyOverview: true, skipPerformanceKpis: true });

    return {
        topMetrics: result.topMetrics,
        summaryMetrics: result.summaryMetrics
    };
};

/**
 * Get Performance Metrics KPIs Data (Share of Search, ROAS, Conversion, etc.)
 * OPTIMIZED: Separate endpoint for Performance Matrix section
 */
const getPerformanceMetrics = async (filters) => {
    console.log('[getPerformanceMetrics] Computing performance metrics KPIs...');

    // Call the FULL function but it will only compute overview data
    const result = await computeSummaryMetrics(filters, { onlyOverview: true });

    return {
        performanceMetricsKpis: result.performanceMetricsKpis || []
    };
};

/**
 * Get Platform Overview Data - OPTIMIZED
 * Returns platformOverview array with metrics for each platform
 * NOTE: This function computes ONLY platform data, not overview/months/categories/brands
 */
const getPlatformOverview = async (filters) => {
    console.log('[getPlatformOverview] Computing OPTIMIZED platform overview data...');

    const { months = 1, startDate: qStartDate, endDate: qEndDate, compareStartDate: qCompareStartDate, compareEndDate: qCompareEndDate, skuName } = filters;
    const rawSkuCode = filters['skuCode[]'] || filters.skuCode || filters['sapCode[]'] || filters.sapCode;
    const skuCode = rawSkuCode;
    const channel = extractChannel(filters);

    // Extract filter values - frontend may send as 'brand' or 'brand[]' (array format)
    const rawBrand = filters['brand[]'] || filters.brand;
    const rawLocation = filters['location[]'] || filters.location;
    const rawCategory = filters['category[]'] || filters.category;
    const rawPlatform = filters['platform[]'] || filters.platform;

    // Normalize multi-value filters using the core helper
    const brandArr = normalizeFilterArray(rawBrand);
    const locationArr = normalizeFilterArray(rawLocation);
    const categoryArr = normalizeFilterArray(rawCategory);
    const platformArr = normalizeFilterArray(rawPlatform);

    // Keep single values for backward compatibility and specific use cases
    const brand = brandArr ? (brandArr.length === 1 ? brandArr[0] : brandArr) : null;
    const location = locationArr ? (locationArr.length === 1 ? locationArr[0] : locationArr) : null;
    const category = categoryArr ? (categoryArr.length === 1 ? categoryArr[0] : categoryArr) : null;
    const platform = platformArr ? (platformArr.length === 1 ? platformArr[0] : platformArr) : null;

    // Check if any selected location is NOT one of the 11 Tier-1 cities (case-insensitive)
    const tier1Cities = [
        'kolkata', 'mumbai', 'pune', 'chennai', 'delhi', 'lucknow',
        'gurugram', 'chandigarh', 'hyderabad', 'faridabad', 'bengaluru'
    ];
    let hasTier23 = false;
    if (locationArr && locationArr.length > 0) {
        hasTier23 = locationArr.some(loc => {
            const lowerLoc = String(loc).trim().toLowerCase();
            if (lowerLoc === 'all' || lowerLoc === '' || lowerLoc === 'all india') return false;
            return !tier1Cities.includes(lowerLoc);
        });
    }

    const monthsBack = parseInt(months, 10) || 1;

    // Calculate date range
    let endDate = await getCachedMaxDate();
    let startDate = endDate.subtract(monthsBack, 'month').startOf('day');
    if (qStartDate && qEndDate) {
        startDate = dayjs(qStartDate).startOf('day');
        endDate = dayjs(qEndDate).endOf('day');
    }

    // Helper for currency formatting
    const formatCurrency = (value) => {
        const val = parseFloat(value);
        if (isNaN(val)) return "₹0";
        if (val < 0.01 && val > -0.01) return "₹0";
        if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
        if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lac`;
        if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
        return `₹${val.toFixed(2)}`;
    };

    // Fetch platforms from rca_sku_dim
    const cachedPlatforms = await getCachedDistinctPlatforms();
    let platformDefinitions = cachedPlatforms;

    if (!platformDefinitions) {
        // [DYNAMIC] Fetch platforms and their visuals from rb_platform if it exists
        let platformVisualsMap = new Map();
        try {
            // Check if rb_platform exists first to avoid crash on DBs without it
            const tableExists = await queryClickHouse("EXISTS TABLE rb_platform");
            if (tableExists && tableExists[0]?.result === 1) {
                const visuals = await queryClickHouse("SELECT DISTINCT pf_name, platform_description FROM rb_platform WHERE platform_description IS NOT NULL AND platform_description != ''");
                visuals.forEach(v => {
                    if (v.pf_name && v.platform_description) {
                        platformVisualsMap.set(v.pf_name.toLowerCase().trim(), v.platform_description);
                    }
                });
            }
        } catch (vErr) {
            console.error('[getPlatformOverview] Error fetching platform visuals:', vErr.message);
        }

        const platformsFromDb = await queryClickHouse(`SELECT DISTINCT platform FROM rca_sku_dim WHERE platform IS NOT NULL AND platform != ''`);

        const getPlatformLogo = (name) => {
            const dbLogo = platformVisualsMap.get(name.toLowerCase().trim());
            if (dbLogo && dbLogo.startsWith('http')) return dbLogo;

            const logoMap = {
                'zepto': 'https://upload.wikimedia.org/wikipedia/en/7/7d/Logo_of_Zepto.png',
                'blinkit': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Blinkit-yellow-rounded.svg',
                'swiggy': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Swiggy_Logo_2024.webp',
                'amazon': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
                'flipkart': 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Flipkart-logo.png',
                'instamart': '/instamart.jpeg',
                'swiggy instamart': '/instamart.jpeg',
                'jiomart': 'https://upload.wikimedia.org/wikipedia/en/5/54/JioMart_logo.svg',
                'meesho': 'https://upload.wikimedia.org/wikipedia/commons/3/33/Meesho_logo.png',
                'myntra': 'https://static.vecteezy.com/system/resources/previews/067/941/729/non_2x/myntra-logo-myntra-icon-transparent-background-free-png.png',
                'pharmeasy': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQmvGD4R2shvyr2o70i_tkpo4J2fygT8Im2YAcHruh45A&s'
            };
            return logoMap[name.toLowerCase().trim()] || 'https://cdn-icons-png.flaticon.com/512/3502/3502685.png';
        };

        const getPlatformType = (name) => {
            const qCommerce = ['zepto', 'blinkit', 'swiggy instamart', 'instamart', 'dunzo'];
            const marketplace = ['amazon', 'flipkart', 'swiggy', 'bigbasket', 'jiomart'];
            const lower = name.toLowerCase();
            if (qCommerce.some(p => lower.includes(p))) return 'Q-commerce';
            if (marketplace.some(p => lower.includes(p))) return 'Marketplace';
            return 'E-commerce';
        };

        platformDefinitions = platformsFromDb
            .map(p => p.platform)
            .filter(p => p && p.trim())
            .map(name => ({
                key: name.toLowerCase().replace(/\s+/g, '_'),
                label: name.charAt(0).toUpperCase() + name.slice(1),
                type: getPlatformType(name),
                logo: getPlatformLogo(name)
            }));

        // Cache the result
        cacheDistinctPlatforms(platformDefinitions);
    }

    // Filter platform definitions based on channel AFTER cache block
    if (channel && channel !== 'All') {
        const channelList = (Array.isArray(channel) ? channel : String(channel).split(','))
            .map(c => String(c).trim().toLowerCase())
            .filter(Boolean);

        const isAll = channelList.includes('all');
        if (!isAll && channelList.length > 0) {
            const quickPlatforms = ['blinkit', 'zepto', 'instamart', 'swiggy instamart', 'swiggy', 'dunzo', 'flipkart minutes', 'amazon now'];
            const epharmPlatforms = ['pharmeasy', 'apollo 247', 'apollo', '1_mg', '1mg', 'tata 1mg', 'netmeds', 'truemeds', 'healthkart'];
            const ecomPlatforms = ['amazon', 'flipkart', 'bigbasket', 'jiomart', 'meesho', 'myntra', 'shopify', 'first cry'];

            const hasQuick = channelList.some(c => c.includes('quick') || c === 'quickcomm' || c === 'qcomm');
            const hasEcom = channelList.some(c => ['ecommerce', 'e-commerce', 'ecom'].includes(c) || c.includes('e-com'));
            const hasEpharm = channelList.some(c => c.includes('epharm') || c.includes('e-pharm') || c.includes('pharm'));
            const hasModern = channelList.some(c => ['modern trades', 'moderntrade'].includes(c));

            if (hasQuick || hasEcom || hasEpharm || hasModern) {
                platformDefinitions = platformDefinitions.filter(p => {
                    const pLabel = p.label.toLowerCase();

                    const isQuick = quickPlatforms.some(qp => pLabel === qp || pLabel.includes(qp));
                    if (isQuick) return hasQuick;

                    const isPharm = epharmPlatforms.some(epp => pLabel === epp || pLabel.includes(epp) || epp.includes(pLabel)) || pLabel.includes('pharm') || pLabel.includes('meds') || pLabel.includes('1mg') || pLabel.includes('1_mg');
                    if (isPharm) return hasEpharm;

                    const isEcom = ecomPlatforms.some(ep => pLabel === ep || pLabel.includes(ep));
                    if (isEcom) return hasEcom;

                    return hasModern;
                });
            }
        }
    }

    // Apply platform permissions filter from platformArr (if present)
    if (platformArr && platformArr.length > 0) {
        platformDefinitions = platformDefinitions.filter(p =>
            platformArr.some(pa => p.label.toLowerCase() === pa.toLowerCase() || p.key.toLowerCase() === pa.toLowerCase().replace(/\s+/g, '_'))
        );
    }

    // Calculate MoM dates or use provided comparison dates
    let momStart = startDate.clone().subtract(1, 'month');
    let momEnd = endDate.clone().subtract(1, 'month');

    if (qCompareStartDate && qCompareEndDate) {
        momStart = dayjs(qCompareStartDate).startOf('day');
        momEnd = dayjs(qCompareEndDate).endOf('day');
    }

    // Get the optimized data source (Materialized View table or raw table)
    const src = await getWatchtowerSource(filters);
    const pmSrc = await getPmSource();


    // ===== INLINE BULK PLATFORM METRICS QUERY - USING CLICKHOUSE =====
    // Helper to escape strings for ClickHouse
    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

    // Build base conditions for rb_pdp_olap
    const buildOfftakeConds = (start, end, skipLocation = false) => {
        // If using aggregated table, column names are lowercase and simple
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const conds = [`${dateCol} BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`];

        // Enforce comp_flag = 0 (Our Brands) for Offtakes summary
        const compFlagCol = src.isAgg ? 'comp_flag' : 'Comp_flag';
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            conds.push(`toString(${compFlagCol}) = '0'`);
            const brandCol = src.isAgg ? 'brand' : 'Brand';
            conds.push(`(${brandArr.map(b => `lower(${brandCol}) LIKE '%${escapeStr(b.toLowerCase())}%'`).join(' OR ')})`);
        } else {
            // Default to our brands if "All" is selected
            conds.push(`toString(${compFlagCol}) = '0'`);
        }

        const locCol = src.isAgg ? 'location' : 'Location';
        if (!skipLocation && locationArr && locationArr.length > 0) {
            const platformCol = src.isAgg ? 'platform' : 'Platform';
            const locCond = buildLocationQueryCond(locationArr, platformArr, locCol, platformCol);
            if (locCond) conds.push(locCond);
        }

        const catCol = src.isAgg ? 'category' : PRODUCT_CATEGORY_SQL;
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`${catCol} IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }

        // Channel-based platform filtering
        const platformCol = src.isAgg ? 'platform' : 'Platform';
        const platformCond = buildPlatformChannelCond((platformArr && platformArr.length > 0) ? platformArr : 'All', channel, platformCol);
        if (platformCond) {
            conds.push(platformCond);
        }

        // Advanced SKU Search Filters (Only supported on raw table)
        if (!src.isAgg) {
            const skuArrArr = normalizeFilterArray(skuName);
            if (skuArrArr && skuArrArr.length > 0) {
                const skuConds = skuArrArr.map(s => `lower(Product) LIKE '%${escapeStr(s.toLowerCase())}%'`).join(' OR ');
                conds.push(`(${skuConds})`);
            }
            const skuCodeArrArr = normalizeFilterArray(skuCode);
            if (skuCodeArrArr && skuCodeArrArr.length > 0) {
                const skuCodeConds = skuCodeArrArr.map(s => `(lower(toString(${src.f.skuCode})) LIKE lower('%${escapeStr(s)}%') OR lower(toString(${src.f.product})) LIKE lower('%${escapeStr(s)}%'))`).join(' OR ');
                conds.push(`(${skuCodeConds})`);
            }
            const mslArr = normalizeFilterArray(filters.msl);
            if (mslArr && mslArr.length > 0) {
                const mslConds = mslArr.map(m => `toString(${src.f.msl}) = '${escapeStr(m)}'`).join(' OR ');
                conds.push(`(${mslConds})`);
            }
        }

        return conds.join(' AND ');
    };

    // Build base conditions for rb_pm_olap (Marketing Metrics)
    const buildPmConds = (start, end) => {
        const conds = [`${pmSrc.f.date} BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`];

        // Enforce our brands only for Spend (Spend table usually only has our data, but safety first)
        const pmBrandCol = pmSrc.f.brand;
        if (brandArr && brandArr.length > 0) {
            const brandConds = brandArr.map(b => `'${escapeStr(b).toLowerCase()}'`).join(',');
            conds.push(`lower(${pmBrandCol}) IN (${brandConds})`);
        } else {
            // If "All", we might want to filter by validBrandNames, but usually Spend table is pre-filtered.
            // However, to be consistent with Platform Overview, we add a placeholder or filter here if needed.
        }
        if (pmSrc.f.location && pmSrc.f.location !== "'Unknown'" && locationArr && locationArr.length > 0) {
            const locCond = buildLocationQueryCond(locationArr, platformArr, pmSrc.f.location, pmSrc.f.platform);
            if (locCond) conds.push(locCond);
        }
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`lower(${pmSrc.f.category}) IN (${categoryArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
        }
        const platformCol = pmSrc.f.platform;
        const platformCond = buildPlatformChannelCond((platformArr && platformArr.length > 0) ? platformArr : 'All', channel, platformCol);
        if (platformCond) conds.push(platformCond);
        return conds.join(' AND ');
    };


    // Build base conditions for rb_kw_olap (SOS / Ad SOV / Organic SOV)
    const buildSosConds = (start, end) => {
        const conds = [`toDate(DATE) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`];
        // Only consider top 10 ranked positions for SOS
        conds.push(`POSITION <= 10`);
        if (locationArr && locationArr.length > 0) {
            const locCond = buildLocationQueryCond(locationArr, platformArr, 'location_name', 'platform_name');
            if (locCond) conds.push(locCond);
        }
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`lower(keyword_category) IN (${categoryArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
        }
        // NOTE: Do NOT apply brand filter here for SOS/Ad SOV/Organic SOV.
        // SOS numerator uses flag='1' to identify our brands, and the denominator
        // must count ALL brands to compute market share of search correctly.
        // Applying a brand LIKE filter here would restrict both numerator and
        // denominator to the same brand, always yielding 100%.

        // Apply platform filter (rb_kw_olap uses platform_name column)
        if (platformArr && platformArr.length > 0) {
            const cond = buildPlatformChannelCond(platformArr, channel, 'lower(platform_name)', true);
            if (cond) conds.push(cond);
        } else {
            const pCond = buildPlatformChannelCond(null, channel, 'lower(platform_name)', true);
            if (pCond) conds.push(pCond);
        }

        return conds.join(' AND ');
    };

    // Build conditions for rb_ms_olap (Market Share)
    const buildMsConds = (start, end, brandsFilter = null) => {
        const conds = [`toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`];
        conds.push(`sales IS NOT NULL`);
        if (brandsFilter && brandsFilter.length > 0) {
            conds.push(`group_brand IN (${brandsFilter.map(b => `'${escapeStr(b)}'`).join(', ')})`);
        }
        if (locationArr && locationArr.length > 0) {
            const locCond = buildLocationQueryCond(locationArr, platformArr, 'location', 'platform');
            if (locCond) conds.push(locCond);
        }
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`category IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }

        // Add platform/channel filter - for denominator we want all platforms in that channel
        const platformCond = buildPlatformChannelCond(null, channel, 'platform');
        if (platformCond) {
            conds.push(platformCond);
        }

        return conds.join(' AND ');
    };

    const currOfftakeConds = buildOfftakeConds(startDate, endDate);
    const prevOfftakeConds = buildOfftakeConds(momStart, momEnd);
    const currPmConds = buildPmConds(startDate, endDate);
    const prevPmConds = buildPmConds(momStart, momEnd);
    const currSosConds = buildSosConds(startDate, endDate);
    const prevSosConds = buildSosConds(momStart, momEnd);


    const dbNameForOverview = getCurrentDbName();
    const isDrlDb = dbNameForOverview === 'drl';
    const buymorePlatforms = ['amazon', 'flipkart', 'jiomart', 'meesho', 'myntra', 'pharmeasy', 'shopify'];

    const drlExcludeBuyMoreCond = (isDrlDb)
        ? ` AND (lower(${src.f.platform}) NOT IN (${buymorePlatforms.map(p => `'${p}'`).join(', ')}) OR lower(trim(Reseller_Name)) NOT LIKE '%buy%more%' OR Reseller_Name IS NULL OR Reseller_Name = '')`
        : '';

    const currOfftakeCondsWithDrl = currOfftakeConds + drlExcludeBuyMoreCond;
    const prevOfftakeCondsWithDrl = prevOfftakeConds + drlExcludeBuyMoreCond;

    // Get valid brand names for market share
    const validBrandResult = await queryClickHouse(`
            SELECT DISTINCT brand_name 
            FROM rca_sku_dim 
            WHERE toString(comp_flag) = '0' AND brand_name IS NOT NULL`);
    const validBrandNames = validBrandResult.map(b => b.brand_name).filter(Boolean);
    // Handle brand being either a string or an array
    const brandsForNumerator = (brand && brand !== 'All')
        ? (Array.isArray(brand) ? brand : [brand])
        : validBrandNames;

    const currMsNumConds = buildMsConds(startDate, endDate, brandsForNumerator);
    const currMsDenomConds = buildMsConds(startDate, endDate, null);
    const prevMsNumConds = buildMsConds(momStart, momEnd, brandsForNumerator);
    const prevMsDenomConds = buildMsConds(momStart, momEnd, null);

    console.log('[getPlatformOverview] Executing ClickHouse platform queries with SOS and Market Share...');

    // Build the SOS/SOV numerator condition: when a specific brand is selected,
    // filter by that brand name in the numerator; otherwise use flag='1' for all our brands.
    // This mirrors the pattern in computeSummaryMetrics.
    let sosNumCondition;
    if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
        const brandConds = brandArr.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ');
        sosNumCondition = `lower(brand) IN (${brandConds})`;
    } else {
        sosNumCondition = "toString(flag) = '1'";
    }

    const [currData, prevData, currPmData, prevPmData, currSosOurBrands, currSosTotal, prevSosOurBrands, prevSosTotal, currMsNum, currMsDenom, prevMsNum, prevMsDenom, currCatSizeByPlatform, prevCatSizeByPlatform, currAdSovOur, currAdSovTotal, prevAdSovOur, prevAdSovTotal, currOrgSovOur, currOrgSovTotal, prevOrgSovOur, prevOrgSovTotal] = await Promise.all([
        // Query 1: Current period offtake metrics by platform
        queryClickHouse(`
                    SELECT ${src.f.platform} as Platform,
                        SUM(${src.f.sales}) as sales,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.qty} ELSE 0 END) as qty,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.neno} ELSE 0 END) as neno,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.deno} ELSE 0 END) as deno,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.buyBoxNeno} ELSE 0 END) as buy_box_neno,
                        AVG(if(${src.f.compFlagMapping} = 0, ${src.f.discount}, NULL)) as my_avg_discount,
                        AVG(if(${src.f.compFlagMapping} = 1, ${src.f.discount}, NULL)) as comp_avg_discount,
                        AVG(if(${src.f.compFlagMapping} = 0 AND ${src.f.sellingPriceRaw} > 0, ${src.f.sellingPriceRaw}, NULL)) as asp,
                        AVG(if(${src.f.compFlagMapping} = 0, ${src.f.listingPercent}, NULL)) as avg_listing_percent,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ((${src.f.mrp} - ${src.f.sellingPrice}) / NULLIF(${src.f.mrp}, 0)) * ${src.f.sales} ELSE 0 END) / NULLIF(SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END), 0) * 100 as my_wt_discount
                    FROM ${src.table}
                    WHERE ${currOfftakeCondsWithDrl}
                    GROUP BY Platform
                `),
        // Query 2: Previous period offtake metrics by platform
        queryClickHouse(`
                    SELECT ${src.f.platform} as Platform,
                        SUM(${src.f.sales}) as sales,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.qty} ELSE 0 END) as qty,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.neno} ELSE 0 END) as neno,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.deno} ELSE 0 END) as deno,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.buyBoxNeno} ELSE 0 END) as buy_box_neno,
                        AVG(if(${src.f.compFlagMapping} = 0, ${src.f.discount}, NULL)) as my_avg_discount,
                        AVG(if(${src.f.compFlagMapping} = 1, ${src.f.discount}, NULL)) as comp_avg_discount,
                        AVG(if(${src.f.compFlagMapping} = 0 AND ${src.f.sellingPriceRaw} > 0, ${src.f.sellingPriceRaw}, NULL)) as asp,
                        AVG(if(${src.f.compFlagMapping} = 0, ${src.f.listingPercent}, NULL)) as avg_listing_percent,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ((${src.f.mrp} - ${src.f.sellingPrice}) / NULLIF(${src.f.mrp}, 0)) * ${src.f.sales} ELSE 0 END) / NULLIF(SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END), 0) * 100 as my_wt_discount
                    FROM ${src.table}
                    WHERE ${prevOfftakeCondsWithDrl}
                    GROUP BY Platform
                `),
        // Query 2.1: Current Marketing Metrics from PM table
        queryClickHouse(`
                    SELECT ${pmSrc.f.platform} as Platform,
                        SUM(${pmSrc.f.spend}) as spend,
                        SUM(${pmSrc.f.adSales}) as Ad_sales,
                        SUM(${pmSrc.f.clicks}) as clicks,
                        SUM(${pmSrc.f.impressions}) as impressions,
                        SUM(${pmSrc.f.orders}) as orders
                    FROM ${pmSrc.table}
                    WHERE ${currPmConds}
                    GROUP BY Platform
                `),
        // Query 2.2: Previous Marketing Metrics from PM table
        queryClickHouse(`
                    SELECT ${pmSrc.f.platform} as Platform,
                        SUM(${pmSrc.f.spend}) as spend,
                        SUM(${pmSrc.f.adSales}) as Ad_sales,
                        SUM(${pmSrc.f.clicks}) as clicks,
                        SUM(${pmSrc.f.impressions}) as impressions,
                        SUM(${pmSrc.f.orders}) as orders
                    FROM ${pmSrc.table}
                    WHERE ${prevPmConds}
                    GROUP BY Platform
                `),
        // Query 3: Current SOS - sumIf(overall) per platform (our brands via sosNumCondition)
        queryClickHouse(`
                    SELECT platform_name, sumIf(toInt32(overall), ${sosNumCondition}) as count
                    FROM rb_kw_olap
                    WHERE ${currSosConds}
                    GROUP BY platform_name
                `),
        // Query 4: Current SOS - Total sum(overall) per platform
        queryClickHouse(`
                    SELECT platform_name, sum(toInt32(overall)) as count
                    FROM rb_kw_olap
                    WHERE ${currSosConds}
                    GROUP BY platform_name
                `),
        // Query 5: Previous SOS - sumIf(overall) per platform (our brands via sosNumCondition)
        queryClickHouse(`
                    SELECT platform_name, sumIf(toInt32(overall), ${sosNumCondition}) as count
                    FROM rb_kw_olap
                    WHERE ${prevSosConds}
                    GROUP BY platform_name
                `),
        // Query 6: Previous SOS - Total sum(overall) per platform
        queryClickHouse(`
                    SELECT platform_name, sum(toInt32(overall)) as count
                    FROM rb_kw_olap
                    WHERE ${prevSosConds}
                    GROUP BY platform_name
                `),
        // Query 7: Current Market Share - numerator (our brands)
        queryClickHouse(`
                    SELECT platform, SUM(toFloat64OrZero(toString(sales))) as our_sales
                    FROM rb_ms_olap
                    WHERE ${currMsNumConds}
                    GROUP BY platform
                `),
        // Query 8: Current Market Share - denominator (total)
        queryClickHouse(`
                    SELECT platform, SUM(toFloat64OrZero(toString(sales))) as total_sales
                    FROM rb_ms_olap
                    WHERE ${currMsDenomConds}
                    GROUP BY platform
                `),
        // Query 9: Previous Market Share - numerator
        queryClickHouse(`
                    SELECT platform, SUM(toFloat64OrZero(toString(sales))) as our_sales
                    FROM rb_ms_olap
                    WHERE ${prevMsNumConds}
                    GROUP BY platform
                `),
        // Query 10: Previous Market Share - denominator
        queryClickHouse(`
                    SELECT platform, SUM(toFloat64OrZero(toString(sales))) as total_sales
                    FROM rb_ms_olap
                    WHERE ${prevMsDenomConds}
                    GROUP BY platform
                `),
        // Query 11: Current Category Size by Platform
        queryClickHouse(`
                    SELECT platform, SUM(toFloat64OrZero(toString(sales))) as cat_size
                    FROM rb_ms_olap
                    WHERE ${currMsDenomConds}
                    GROUP BY platform
                `),
        // Query 12: Previous Category Size by Platform
        queryClickHouse(`
                    SELECT platform, SUM(toFloat64OrZero(toString(sales))) as cat_size
                    FROM rb_ms_olap
                    WHERE ${prevMsDenomConds}
                    GROUP BY platform
                `),
        // Query 13: Current Spons SOS (Ad SOV) - sumIf(spons) per platform (our brands via sosNumCondition)
        queryClickHouse(`
                    SELECT platform_name, sumIf(toInt32(spons), ${sosNumCondition}) as count
                    FROM rb_kw_olap
                    WHERE ${currSosConds}
                    GROUP BY platform_name
                `),
        // Query 14: Current Spons SOS (Ad SOV) - Total sum(spons) per platform
        queryClickHouse(`
                    SELECT platform_name, sum(toInt32(spons)) as count
                    FROM rb_kw_olap
                    WHERE ${currSosConds}
                    GROUP BY platform_name
                `),
        // Query 15: Previous Spons SOS (Ad SOV) - sumIf(spons) per platform (our brands via sosNumCondition)
        queryClickHouse(`
                    SELECT platform_name, sumIf(toInt32(spons), ${sosNumCondition}) as count
                    FROM rb_kw_olap
                    WHERE ${prevSosConds}
                    GROUP BY platform_name
                `),
        // Query 16: Previous Spons SOS (Ad SOV) - Total sum(spons) per platform
        queryClickHouse(`
                    SELECT platform_name, sum(toInt32(spons)) as count
                    FROM rb_kw_olap
                    WHERE ${prevSosConds}
                    GROUP BY platform_name
                `),
        // Query 17: Current Organic SOS - sumIf(organic) per platform (our brands via sosNumCondition)
        queryClickHouse(`
                    SELECT platform_name, sumIf(toInt32(organic), ${sosNumCondition}) as count
                    FROM rb_kw_olap
                    WHERE ${currSosConds}
                    GROUP BY platform_name
                `),
        // Query 18: Current Organic SOS - Total sum(organic) per platform
        queryClickHouse(`
                    SELECT platform_name, sum(toInt32(organic)) as count
                    FROM rb_kw_olap
                    WHERE ${currSosConds}
                    GROUP BY platform_name
                `),
        // Query 19: Previous Organic SOS - sumIf(organic) per platform (our brands via sosNumCondition)
        queryClickHouse(`
                    SELECT platform_name, sumIf(toInt32(organic), ${sosNumCondition}) as count
                    FROM rb_kw_olap
                    WHERE ${prevSosConds}
                    GROUP BY platform_name
                `),
        // Query 20: Previous Organic SOS - Total sum(organic) per platform
        queryClickHouse(`
                    SELECT platform_name, sum(toInt32(organic)) as count
                    FROM rb_kw_olap
                    WHERE ${prevSosConds}
                    GROUP BY platform_name
                `)
    ]);

    // Calculate Market Share per platform from numerator/denominator
    const currMsNumMap = new Map(currMsNum.map(r => [r.platform?.toLowerCase(), parseFloat(r.our_sales || 0)]));
    const currMsDenomMap = new Map(currMsDenom.map(r => [r.platform?.toLowerCase(), parseFloat(r.total_sales || 0)]));
    const currCatSizeMap = new Map(currCatSizeByPlatform.map(r => [r.platform?.toLowerCase(), parseFloat(r.cat_size || 0)]));
    const currMs = currMsDenom.map(r => {
        const key = r.platform?.toLowerCase();
        const ourSales = currMsNumMap.get(key) || 0;
        const totalSales = parseFloat(r.total_sales || 0);
        return { platform: r.platform, avg_ms: totalSales > 0 ? (ourSales / totalSales) * 100 : null };
    });

    const prevMsNumMap = new Map(prevMsNum.map(r => [r.platform?.toLowerCase(), parseFloat(r.our_sales || 0)]));
    const prevMsDenomMap = new Map(prevMsDenom.map(r => [r.platform?.toLowerCase(), parseFloat(r.total_sales || 0)]));

    // Calculate sumCatSize from all query results (not just those in platformDefinitions)
    let filteredCurrCatSize = currCatSizeByPlatform;
    let filteredPrevCatSize = prevCatSizeByPlatform;

    if (platformArr && platformArr.length > 0) {
        const requestedPlatformsLower = platformArr.map(p => p.toLowerCase());
        const filterCatSize = (arr) => arr.filter(r => {
            const platformLower = (r.platform || '').toLowerCase();
            return requestedPlatformsLower.some(rp => platformLower.includes(rp) || rp.includes(platformLower));
        });
        filteredCurrCatSize = filterCatSize(currCatSizeByPlatform);
        filteredPrevCatSize = filterCatSize(prevCatSizeByPlatform);
    }

    const sumCatSize = filteredCurrCatSize.reduce((sum, r) => sum + parseFloat(r.cat_size || 0), 0);
    const prevSumCatSize = filteredPrevCatSize.reduce((sum, r) => sum + parseFloat(r.cat_size || 0), 0);

    // Map platform category sizes for fuzzy matching later
    const currCatSizeByPlatformMap = new Map(currCatSizeByPlatform.map(r => [r.platform?.toLowerCase(), parseFloat(r.cat_size || 0)]));
    const prevCatSizeByPlatformMap = new Map(prevCatSizeByPlatform.map(r => [r.platform?.toLowerCase(), parseFloat(r.cat_size || 0)]));

    const prevMs = prevMsDenom.map(r => {
        const key = r.platform?.toLowerCase();
        const ourSales = prevMsNumMap.get(key) || 0;
        const totalSales = parseFloat(r.total_sales || 0);
        return { platform: r.platform, avg_ms: totalSales > 0 ? (ourSales / totalSales) * 100 : null };
    });

    // Build SOS lookup maps
    const currSosOurMap = new Map(currSosOurBrands.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));
    const currSosTotalMap = new Map(currSosTotal.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));
    const prevSosOurMap = new Map(prevSosOurBrands.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));
    const prevSosTotalMap = new Map(prevSosTotal.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));

    // Build Ad SOV lookup maps (spons_flag=1)
    const currAdSovOurMap = new Map(currAdSovOur.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));
    const currAdSovTotalMap = new Map(currAdSovTotal.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));
    const prevAdSovOurMap = new Map(prevAdSovOur.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));
    const prevAdSovTotalMap = new Map(prevAdSovTotal.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));

    // Build Organic SOV lookup maps (spons_flag=0)
    const currOrgSovOurMap = new Map(currOrgSovOur.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));
    const currOrgSovTotalMap = new Map(currOrgSovTotal.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));
    const prevOrgSovOurMap = new Map(prevOrgSovOur.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));
    const prevOrgSovTotalMap = new Map(prevOrgSovTotal.map(r => [r.platform_name?.toLowerCase(), parseInt(r.count) || 0]));

    // Build Market Share lookup maps
    const currMsMap = new Map(currMs.map(r => [r.platform?.toLowerCase(), (r.avg_ms !== undefined && r.avg_ms !== null) ? parseFloat(r.avg_ms) : null]));
    const prevMsMap = new Map(prevMs.map(r => [r.platform?.toLowerCase(), (r.avg_ms !== undefined && r.avg_ms !== null) ? parseFloat(r.avg_ms) : null]));

    // DEBUG: Log platform name matching for Market Share
    console.log('[getPlatformOverview] DEBUG MS - Platform keys in currMsMap (from rb_ms_olap):', [...currMsMap.keys()]);
    console.log('[getPlatformOverview] DEBUG MS - Platform keys in currMsDenomMap:', [...currMsDenomMap.keys()]);
    console.log('[getPlatformOverview] DEBUG MS - Platform definitions (from rca_sku_dim):', platformDefinitions.map(p => p.label.toLowerCase()));
    console.log('[getPlatformOverview] DEBUG MS - currMsNum raw:', currMsNum.map(r => ({ platform: r.platform, our_sales: r.our_sales })));
    console.log('[getPlatformOverview] DEBUG MS - currMsDenom raw:', currMsDenom.map(r => ({ platform: r.platform, total_sales: r.total_sales })));

    // Helper to calculate SOS percentage
    const calcSos = (ourCount, totalCount) => totalCount > 0 ? (ourCount / totalCount) * 100 : null;

    // Fetch Bulk PM Conversion Maps
    const [currPmConvMap, prevPmConvMap] = await Promise.all([
        getPmConversionBulk(startDate, endDate, platformArr, locationArr, rawCategory, brandArr, channel, 'lower(Platform)'),
        getPmConversionBulk(momStart, momEnd, platformArr, locationArr, rawCategory, brandArr, channel, 'lower(Platform)')
    ]);

    let currBuymoreMap = new Map();
    let prevBuymoreMap = new Map();
    let currBuymoreQtyMap = new Map();
    let prevBuymoreQtyMap = new Map();

    if (isDrlDb) {
        const buildBuymoreCondsForOverview = (sDate, eDate) => {
            const conds = [`toDate(DATE) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
            if (rawCategory && rawCategory !== 'All') conds.push(`lower(trim(BOTH '\t\n ' FROM category)) = '${escapeStr(rawCategory.toLowerCase())}'`);
            if (brandArr && brandArr.length > 0) {
                const brandConditions = brandArr.map(b => `lower(brand) LIKE '%${escapeStr(b.toLowerCase())}%'`).join(' OR ');
                conds.push(`(${brandConditions})`);
            }
            if (locationArr && locationArr.length > 0) conds.push(`lower(Location) IN (${locationArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
            if (platformArr && platformArr.length > 0) conds.push(`lower(Platform) IN (${platformArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
            else conds.push(`lower(Platform) IN (${buymorePlatforms.map(p => `'${p}'`).join(', ')})`);

            const validStatuses = [
                'shiplable generated', 'pickup_complete', 'pickup pending', 'payment success',
                'packed', 'ndr/npr', 'shipment_issue', 'out for delivery', 'in transit',
                'drs prepared', 'dispatched', 'delivered', 'created'
            ];
            conds.push(`lower(trim(Status)) IN (${validStatuses.map(s => `'${escapeStr(s.toLowerCase())}'`).join(', ')})`);
            return conds.join(' AND ');
        };

        try {
            const [currBmRes, prevBmRes] = await Promise.all([
                queryClickHouse(`
                    SELECT lower(Platform) as platform,
                           SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as buymore_sales,
                           SUM(ifNull(toFloat64OrZero(toString(Qty_Sold_MRP)), 0)) as buymore_qty
                    FROM drl.buymore_rb_pdp_olap
                    WHERE ${buildBuymoreCondsForOverview(startDate, endDate)}
                    GROUP BY platform
                `),
                queryClickHouse(`
                    SELECT lower(Platform) as platform,
                           SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as buymore_sales,
                           SUM(ifNull(toFloat64OrZero(toString(Qty_Sold_MRP)), 0)) as buymore_qty
                    FROM drl.buymore_rb_pdp_olap
                    WHERE ${buildBuymoreCondsForOverview(momStart, momEnd)}
                    GROUP BY platform
                `)
            ]);
            currBmRes.forEach(r => {
                currBuymoreMap.set(r.platform?.toLowerCase(), parseFloat(r.buymore_sales || 0));
                currBuymoreQtyMap.set(r.platform?.toLowerCase(), parseFloat(r.buymore_qty || 0));
            });
            prevBmRes.forEach(r => {
                prevBuymoreMap.set(r.platform?.toLowerCase(), parseFloat(r.buymore_sales || 0));
                prevBuymoreQtyMap.set(r.platform?.toLowerCase(), parseFloat(r.buymore_qty || 0));
            });
        } catch (err) {
            console.error('[getPlatformOverview] Error querying buymore_rb_pdp_olap:', err);
        }
    }

    // Helper to find matching row in platform query results (strict then substring fallback)
    const findPlatformRow = (arr, key) => {
        if (!arr || !Array.isArray(arr)) return null;
        let match = arr.find(d => d.Platform && String(d.Platform).toLowerCase() === key);
        if (!match) {
            match = arr.find(d => d.Platform && (String(d.Platform).toLowerCase().includes(key) || key.includes(String(d.Platform).toLowerCase())));
        }
        return match;
    };

    const findMapValue = (map, key) => {
        if (!map || !(map instanceof Map)) return 0;
        if (map.has(key)) return map.get(key);
        for (const [mKey, val] of map.entries()) {
            if (mKey && (mKey.includes(key) || key.includes(mKey))) return val;
        }
        return 0;
    };

    const hasMapKey = (map, key) => {
        if (!map || !(map instanceof Map)) return false;
        if (map.has(key)) return true;
        for (const [mKey] of map.entries()) {
            if (mKey && (mKey.includes(key) || key.includes(mKey))) return true;
        }
        return false;
    };

    // Build bulk platform metrics map
    const bulkPlatformMap = new Map();
    platformDefinitions.forEach(p => {
        const key = p.label.toLowerCase();
        const c = findPlatformRow(currData, key);
        const pv = findPlatformRow(prevData, key);
        const cpmVal = findPlatformRow(currPmData, key);
        const pvpmVal = findPlatformRow(prevPmData, key);

        let currSalesVal = parseFloat(c?.sales || 0);
        let prevSalesVal = parseFloat(pv?.sales || 0);
        let currQtyVal = parseFloat(c?.qty || 0);
        let prevQtyVal = parseFloat(pv?.qty || 0);

        if (isDrlDb && buymorePlatforms.includes(key)) {
            currSalesVal += (currBuymoreMap.get(key) || 0);
            prevSalesVal += (prevBuymoreMap.get(key) || 0);
            currQtyVal += (currBuymoreQtyMap.get(key) || 0);
            prevQtyVal += (prevBuymoreQtyMap.get(key) || 0);
        }

        // Calculate SOS for this platform
        const currSosValue = calcSos(findMapValue(currSosOurMap, key), findMapValue(currSosTotalMap, key));
        const prevSosValue = calcSos(findMapValue(prevSosOurMap, key), findMapValue(prevSosTotalMap, key));

        // Calculate Ad SOV for this platform (spons_flag=1)
        const currAdSovValue = calcSos(findMapValue(currAdSovOurMap, key), findMapValue(currAdSovTotalMap, key));
        const prevAdSovValue = calcSos(findMapValue(prevAdSovOurMap, key), findMapValue(prevAdSovTotalMap, key));

        // Calculate Organic SOV for this platform (spons_flag=0)
        const currOrgSovValue = calcSos(findMapValue(currOrgSovOurMap, key), findMapValue(currOrgSovTotalMap, key));
        const prevOrgSovValue = calcSos(findMapValue(prevOrgSovOurMap, key), findMapValue(prevOrgSovTotalMap, key));

        // Get Market Share for this platform
        const currMsValue = findMapValue(currMsMap, key);
        const prevMsValue = findMapValue(prevMsMap, key);

        bulkPlatformMap.set(p.label, {
            curr: {
                sales: currSalesVal,
                qty: currQtyVal,
                spend: parseFloat(cpmVal?.spend || 0),
                adSales: parseFloat(cpmVal?.Ad_sales || 0),
                clicks: parseFloat(cpmVal?.clicks || 0),
                impressions: parseFloat(cpmVal?.impressions || 0),
                orders: parseFloat(cpmVal?.orders || 0),
                conversion: currPmConvMap.get(key) || 0,
                neno: parseFloat(c?.neno || 0),
                deno: parseFloat(c?.deno || 0),
                buyBoxNeno: parseFloat(c?.buy_box_neno || 0),
                ms: currMsValue,
                sos: currSosValue,
                adSov: currAdSovValue,
                organicSov: currOrgSovValue,
                denomMS: currMsDenomMap.get(key) || 0,
                myAvgDiscount: parseFloat(c?.my_avg_discount || 0),
                compAvgDiscount: parseFloat(c?.comp_avg_discount || 0),
                asp: parseFloat(c?.asp || 0),
                avgListingPercent: parseFloat(c?.avg_listing_percent || 0),
                myWtDiscount: parseFloat(c?.my_wt_discount || 0)
            },
            prev: {
                sales: prevSalesVal,
                qty: prevQtyVal,
                spend: parseFloat(pvpmVal?.spend || 0),
                adSales: parseFloat(pvpmVal?.Ad_sales || 0),
                clicks: parseFloat(pvpmVal?.clicks || 0),
                impressions: parseFloat(pvpmVal?.impressions || 0),
                orders: parseFloat(pvpmVal?.orders || 0),
                conversion: prevPmConvMap.get(key) || 0,
                neno: parseFloat(pv?.neno || 0),
                deno: parseFloat(pv?.deno || 0),
                buyBoxNeno: parseFloat(pv?.buy_box_neno || 0),
                ms: prevMsValue,
                sos: prevSosValue,
                adSov: prevAdSovValue,
                organicSov: prevOrgSovValue,
                denomMS: prevMsDenomMap.get(key) || 0,
                myAvgDiscount: parseFloat(pv?.my_avg_discount || 0),
                compAvgDiscount: parseFloat(pv?.comp_avg_discount || 0),
                asp: parseFloat(pv?.asp || 0),
                avgListingPercent: parseFloat(pv?.avg_listing_percent || 0),
                myWtDiscount: parseFloat(pv?.my_wt_discount || 0)
            }
        });
    });
    console.log(`[getPlatformOverview] Bulk query complete for ${platformDefinitions.length} platforms`);

    // Helper functions (moved to module level)

    const platformOverview = [];

    // "All" row - aggregate across all platforms using ClickHouse
    const allConds = buildOfftakeConds(startDate, endDate);
    const prevAllConds = buildOfftakeConds(momStart, momEnd);
    const allPmConds = buildPmConds(startDate, endDate);
    const prevAllPmConds = buildPmConds(momStart, momEnd);

    const [allMetricsResult, prevAllMetricsResult, allPmMetricsResult, prevAllPmMetricsResult] = await Promise.all([
        queryClickHouse(`
                    SELECT 
                        SUM(${src.f.sales}) as total_sales,
                        SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ${src.f.quantitySold} ELSE 0 END) as total_qty,
                        SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ${src.f.neno} ELSE 0 END) as total_neno,
                        SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ${src.f.deno} ELSE 0 END) as total_deno,
                        AVG(if(${src.f.compFlag} = 0, ${src.f.discount}, NULL)) as my_avg_discount,
                        AVG(if(${src.f.compFlag} = 1, ${src.f.discount}, NULL)) as comp_avg_discount,
                        AVG(if(${src.f.compFlag} = 0 AND ${src.f.sellingPriceRaw} > 0, ${src.f.sellingPriceRaw}, NULL)) as avg_asp,
                        AVG(if(${src.f.compFlag} = 0, ${src.f.listingPercent}, NULL)) as avg_listing_pct,
                        SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ((${src.f.mrp} - ${src.f.sellingPrice}) / NULLIF(${src.f.mrp}, 0)) * ${src.f.sales} ELSE 0 END) / NULLIF(SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ${src.f.sales} ELSE 0 END), 0) * 100 as my_wt_discount
                    FROM ${src.table}
                    WHERE ${allConds}
                `),
        queryClickHouse(`
                    SELECT 
                        SUM(${src.f.sales}) as total_sales,
                        SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ${src.f.quantitySold} ELSE 0 END) as total_qty,
                        SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ${src.f.neno} ELSE 0 END) as total_neno,
                        SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ${src.f.deno} ELSE 0 END) as total_deno,
                        AVG(if(${src.f.compFlag} = 0, ${src.f.discount}, NULL)) as my_avg_discount,
                        AVG(if(${src.f.compFlag} = 1, ${src.f.discount}, NULL)) as comp_avg_discount,
                        AVG(if(${src.f.compFlag} = 0 AND ${src.f.sellingPriceRaw} > 0, ${src.f.sellingPriceRaw}, NULL)) as avg_asp,
                        AVG(if(${src.f.compFlag} = 0, ${src.f.listingPercent}, NULL)) as avg_listing_pct,
                        SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ((${src.f.mrp} - ${src.f.sellingPrice}) / NULLIF(${src.f.mrp}, 0)) * ${src.f.sales} ELSE 0 END) / NULLIF(SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ${src.f.sales} ELSE 0 END), 0) * 100 as my_wt_discount
                    FROM ${src.table}
                    WHERE ${prevAllConds}
                `),
        queryClickHouse(`
                    SELECT 
                        SUM(${pmSrc.f.spend}) as total_spend,
                        SUM(${pmSrc.f.adSales}) as total_Ad_sales,
                        SUM(${pmSrc.f.clicks}) as total_clicks,
                        SUM(${pmSrc.f.impressions}) as total_impressions,
                        SUM(${pmSrc.f.orders}) as total_orders
                    FROM ${pmSrc.table}
                    WHERE ${allPmConds}
                `),
        queryClickHouse(`
                    SELECT 
                        SUM(${pmSrc.f.spend}) as total_spend,
                        SUM(${pmSrc.f.adSales}) as total_Ad_sales,
                        SUM(${pmSrc.f.clicks}) as total_clicks,
                        SUM(${pmSrc.f.impressions}) as total_impressions,
                        SUM(${pmSrc.f.orders}) as total_orders
                    FROM ${pmSrc.table}
                    WHERE ${prevAllPmConds}
                `)
    ]);

    const allMetrics = allMetricsResult[0] || {};
    const allPmMetrics = allPmMetricsResult[0] || {};
    const allOfftake = allMetricsResult.length > 0 ? parseFloat(allMetrics.total_sales || 0) : null;
    const allOfftakeUnits = allMetricsResult.length > 0 ? parseFloat(allMetrics.total_qty || 0) : null;
    const allSpend = allPmMetricsResult.length > 0 ? parseFloat(allPmMetrics.total_spend || 0) : null;
    const allAdSales = allPmMetricsResult.length > 0 ? parseFloat(allPmMetrics.total_Ad_sales || 0) : null;
    const allInorgUnits = allPmMetricsResult.length > 0 ? parseFloat(allPmMetrics.total_orders || 0) : null;
    const allClicks = allPmMetricsResult.length > 0 ? parseFloat(allPmMetrics.total_clicks || 0) : null;
    const allImpressions = allPmMetricsResult.length > 0 ? parseFloat(allPmMetrics.total_impressions || 0) : null;
    const allOrders = allPmMetricsResult.length > 0 ? parseFloat(allPmMetrics.total_orders || 0) : null; // Quantity sold via ads
    const allNeno = allMetricsResult.length > 0 ? parseFloat(allMetrics.total_neno || 0) : null;
    const allDeno = allMetricsResult.length > 0 ? parseFloat(allMetrics.total_deno || 0) : null;

    const allAvailability = (allDeno !== null && allDeno > 0) ? (allNeno / allDeno) * 100 : null;
    const allListingPct = allMetricsResult.length > 0 ? parseFloat(allMetrics.avg_listing_pct || 0) : null;
    const allWtOsa = (allAvailability !== null && allListingPct !== null) ? (allAvailability * allListingPct) / 100 : null;

    const allRoas = (allSpend !== null && allSpend > 0) ? allAdSales / allSpend : null;
    // Conversion = fetched from rb_pm_olap
    const allConversionRes = await getPmConversion(startDate, endDate, platformArr, locationArr, rawCategory, brandArr, channel);
    const allConversion = allConversionRes !== 0 ? allConversionRes : null; // Mapping 0 to null if appropriate for N/A, but getPmConversion usually returns value

    // Compute CPC (Ecommerce only) and CPM (Quickcomm only) for the 'All' row
    let ecomSpend = 0, ecomClicks = 0;
    let quickSpend = 0, quickImpressions = 0;
    let prevEcomSpend = 0, prevEcomClicks = 0;
    let prevQuickSpend = 0, prevQuickImpressions = 0;

    const currentDbName = getCurrentDbName();
    const isPidilite = currentDbName && currentDbName.toLowerCase() === 'pidilite';

    platformDefinitions.forEach(p => {
        const key = p.label.toLowerCase();
        const isEcomRow = key.includes('amazon') || key.includes('flipkart') || key.includes('myntra') || key.includes('nykaa') || key.includes('jiomart');
        const isQuickRow = key.includes('blinkit') || key.includes('zepto') || key.includes('swiggy') || key.includes('instamart') || key.includes('bbnow') || key.includes('quick');
        const metrics = bulkPlatformMap.get(p.label);

        if (metrics) {
            if (isEcomRow || isPidilite) {
                ecomSpend += metrics.curr.spend || 0;
                ecomClicks += metrics.curr.clicks || 0;
                prevEcomSpend += metrics.prev.spend || 0;
                prevEcomClicks += metrics.prev.clicks || 0;
            }
            if (isQuickRow) {
                quickSpend += metrics.curr.spend || 0;
                quickImpressions += metrics.curr.impressions || 0;
                prevQuickSpend += metrics.prev.spend || 0;
                prevQuickImpressions += metrics.prev.impressions || 0;
            }
        }
    });

    const allCpm = (quickImpressions > 0) ? (quickSpend / quickImpressions) * 1000 : null;
    const allCpc = (ecomClicks > 0) ? ecomSpend / ecomClicks : null;
    const allInorgSales = allPmMetricsResult.length > 0 ? allAdSales : null; // Absolute value in currency
    const allAsp = allMetricsResult.length > 0 ? parseFloat(allMetrics.avg_asp || 0) : null;

    const allPromoMyBrand = allMetricsResult.length > 0 ? parseFloat(allMetrics.my_avg_discount || 0) : null;
    const allPromoCompete = allMetricsResult.length > 0 ? parseFloat(allMetrics.comp_avg_discount || 0) : null;
    const allWtDiscount = allMetricsResult.length > 0 ? parseFloat(allMetrics.my_wt_discount || 0) : null;

    // Previous period for "All" row
    const prevAllMetrics = prevAllMetricsResult[0] || {};
    const prevAllPmMetrics = prevAllPmMetricsResult[0] || {};

    const prevAllOfftake = prevAllMetricsResult.length > 0 ? parseFloat(prevAllMetrics.total_sales || 0) : null;
    const prevAllOfftakeUnits = prevAllMetricsResult.length > 0 ? parseFloat(prevAllMetrics.total_qty || 0) : null;
    const prevAllSpend = prevAllPmMetricsResult.length > 0 ? parseFloat(prevAllPmMetrics.total_spend || 0) : null;
    const prevAllAdSales = prevAllPmMetricsResult.length > 0 ? parseFloat(prevAllPmMetrics.total_Ad_sales || 0) : null;
    const prevAllInorgUnits = prevAllPmMetricsResult.length > 0 ? parseFloat(prevAllPmMetrics.total_orders || 0) : null;
    const prevAllClicks = prevAllPmMetricsResult.length > 0 ? parseFloat(prevAllPmMetrics.total_clicks || 0) : null;
    const prevAllImpressions = prevAllPmMetricsResult.length > 0 ? parseFloat(prevAllPmMetrics.total_impressions || 0) : null;
    const prevAllOrders = prevAllPmMetricsResult.length > 0 ? parseFloat(prevAllPmMetrics.total_orders || 0) : null;
    const prevAllNeno = prevAllMetricsResult.length > 0 ? parseFloat(prevAllMetrics.total_neno || 0) : null;
    const prevAllDeno = prevAllMetricsResult.length > 0 ? parseFloat(prevAllMetrics.total_deno || 0) : null;

    const prevAllPromoMyBrand = prevAllMetricsResult.length > 0 ? parseFloat(prevAllMetrics.my_avg_discount || 0) : null;
    const prevAllPromoCompete = prevAllMetricsResult.length > 0 ? parseFloat(prevAllMetrics.comp_avg_discount || 0) : null;
    const prevAllWtDiscount = prevAllMetricsResult.length > 0 ? parseFloat(prevAllMetrics.my_wt_discount || 0) : null;
    const prevAllAsp = prevAllMetricsResult.length > 0 ? parseFloat(prevAllMetrics.avg_asp || 0) : null;

    const prevAllAvailability = (prevAllDeno !== null && prevAllDeno > 0) ? (prevAllNeno / prevAllDeno) * 100 : null;
    const prevAllListingPct = prevAllMetricsResult.length > 0 ? parseFloat(prevAllMetrics.avg_listing_pct || 0) : null;
    const prevAllWtOsa = (prevAllAvailability !== null && prevAllListingPct !== null) ? (prevAllAvailability * prevAllListingPct) / 100 : null;
    const prevAllRoas = (prevAllSpend !== null && prevAllSpend > 0) ? prevAllAdSales / prevAllSpend : null;
    const prevAllConversionRes = await getPmConversion(momStart, momEnd, platformArr, locationArr, rawCategory, brandArr, channel);
    const prevAllConversion = prevAllConversionRes !== 0 ? prevAllConversionRes : null;
    const prevAllCpm = (prevQuickImpressions > 0) ? (prevQuickSpend / prevQuickImpressions) * 1000 : null;
    const prevAllCpc = (prevEcomClicks > 0) ? prevEcomSpend / prevEcomClicks : null;
    const prevAllInorgSales = prevAllPmMetricsResult.length > 0 ? prevAllAdSales : null;

    // Calculate overall SOS (sum counts across all platforms)
    let totalSosOur = 0, totalSosAll = 0;
    for (const [, count] of currSosOurMap) totalSosOur += count;
    for (const [, count] of currSosTotalMap) totalSosAll += count;
    const allSos = calcSos(totalSosOur, totalSosAll);

    let prevTotalSosOur = 0, prevTotalSosAll = 0;
    for (const [, count] of prevSosOurMap) prevTotalSosOur += count;
    for (const [, count] of prevSosTotalMap) prevTotalSosAll += count;
    const prevAllSos = calcSos(prevTotalSosOur, prevTotalSosAll);

    // Calculate overall Ad SOV (sum counts across all platforms, spons_flag=1)
    let totalAdSovOur = 0, totalAdSovAll = 0;
    for (const [, count] of currAdSovOurMap) totalAdSovOur += count;
    for (const [, count] of currAdSovTotalMap) totalAdSovAll += count;
    const allAdSov = calcSos(totalAdSovOur, totalAdSovAll);

    let prevTotalAdSovOur = 0, prevTotalAdSovAll = 0;
    for (const [, count] of prevAdSovOurMap) prevTotalAdSovOur += count;
    for (const [, count] of prevAdSovTotalMap) prevTotalAdSovAll += count;
    const prevAllAdSov = calcSos(prevTotalAdSovOur, prevTotalAdSovAll);

    // Calculate overall Organic SOV (sum counts across all platforms, spons_flag=0)
    let totalOrgSovOur = 0, totalOrgSovAll = 0;
    for (const [, count] of currOrgSovOurMap) totalOrgSovOur += count;
    for (const [, count] of currOrgSovTotalMap) totalOrgSovAll += count;
    const allOrganicSov = calcSos(totalOrgSovOur, totalOrgSovAll);

    let prevTotalOrgSovOur = 0, prevTotalOrgSovAll = 0;
    for (const [, count] of prevOrgSovOurMap) prevTotalOrgSovOur += count;
    for (const [, count] of prevOrgSovTotalMap) prevTotalOrgSovAll += count;
    const prevAllOrganicSov = calcSos(prevTotalOrgSovOur, prevTotalOrgSovAll);

    // Calculate overall Market Share (weighted approach: sum of num / sum of denom)
    let sumMsNum = 0, sumMsDenom = 0;
    let prevSumMsNum = 0, prevSumMsDenom = 0;

    let platformsForMsAll = platformDefinitions;
    if (platformArr && platformArr.length > 0) {
        const requestedPlatformsLower = platformArr.map(p => p.toLowerCase());
        platformsForMsAll = platformDefinitions.filter(p => {
            const labelLower = (p.label || '').toLowerCase();
            return requestedPlatformsLower.some(rp => labelLower.includes(rp) || rp.includes(labelLower));
        });
    }

    platformsForMsAll.forEach(p => {
        const key = p.label.toLowerCase();
        sumMsNum += currMsNumMap.get(key) || 0;
        sumMsDenom += currMsDenomMap.get(key) || 0;
        prevSumMsNum += prevMsNumMap.get(key) || 0;
        prevSumMsDenom += prevMsDenomMap.get(key) || 0;
    });

    const allMarketShare = hasTier23 ? null : await getMarketShare(startDate, endDate, 'All', rawCategory, null, locationArr, channel);
    const prevAllMarketShare = hasTier23 ? null : await getMarketShare(momStart, momEnd, 'All', rawCategory, null, locationArr, channel);

    // If location filter is active, fetch location-unfiltered Sales for TACoS denominator
    const hasLocationFilter = locationArr && locationArr.length > 0 && locationArr.some(l => l && String(l).toLowerCase() !== 'all');
    let allOfftakeNoLoc = allOfftake;
    let prevAllOfftakeNoLoc = prevAllOfftake;
    let currDataNoLoc = currData;
    let prevDataNoLoc = prevData;

    if (hasLocationFilter) {
        try {
            const allCondsNoLoc = buildOfftakeConds(startDate, endDate, true);
            const prevAllCondsNoLoc = buildOfftakeConds(momStart, momEnd, true);
            const currOfftakeCondsNoLoc = buildOfftakeConds(startDate, endDate, true);
            const prevOfftakeCondsNoLoc = buildOfftakeConds(momStart, momEnd, true);

            const [allNoLocRes, prevAllNoLocRes, cNoLoc, pNoLoc] = await Promise.all([
                queryClickHouse(`SELECT SUM(${src.f.sales}) as total_sales FROM ${src.table} WHERE ${allCondsNoLoc}`),
                queryClickHouse(`SELECT SUM(${src.f.sales}) as total_sales FROM ${src.table} WHERE ${prevAllCondsNoLoc}`),
                queryClickHouse(`SELECT ${src.f.platform} as Platform, SUM(${src.f.sales}) as sales FROM ${src.table} WHERE ${currOfftakeCondsNoLoc} GROUP BY Platform`),
                queryClickHouse(`SELECT ${src.f.platform} as Platform, SUM(${src.f.sales}) as sales FROM ${src.table} WHERE ${prevOfftakeCondsNoLoc} GROUP BY Platform`)
            ]);
            if (allNoLocRes.length > 0 && allNoLocRes[0].total_sales !== undefined) {
                allOfftakeNoLoc = parseFloat(allNoLocRes[0].total_sales || 0);
            }
            if (prevAllNoLocRes.length > 0 && prevAllNoLocRes[0].total_sales !== undefined) {
                prevAllOfftakeNoLoc = parseFloat(prevAllNoLocRes[0].total_sales || 0);
            }
            currDataNoLoc = cNoLoc;
            prevDataNoLoc = pNoLoc;
        } catch (e) {
            console.warn('[getPlatformOverview] Failed to fetch no-location sales for TACoS:', e.message);
        }
    }

    const allTacos = (allSpend !== null && allOfftakeNoLoc !== null && allOfftakeNoLoc > 0) ? (allSpend / allOfftakeNoLoc) * 100 : null;
    const prevAllTacos = (prevAllSpend !== null && prevAllOfftakeNoLoc !== null && prevAllOfftakeNoLoc > 0) ? (prevAllSpend / prevAllOfftakeNoLoc) * 100 : null;

    const hasPlatformFilter = platformArr && platformArr.length > 0;
    if (!hasPlatformFilter) {
        platformOverview.push({
            key: 'all',
            label: 'All',
            type: 'Overall',
            logo: "https://cdn-icons-png.flaticon.com/512/711/711284.png",
            columns: generateKpiColumns({
                offtake: allOfftake, availability: allAvailability, wtOsa: allWtOsa, listingPercent: allListingPct, sos: allSos, marketShare: allMarketShare, spend: allSpend, roas: allRoas, inorgSales: allInorgSales, conversion: allConversion, cpm: allCpm, cpc: allCpc, asp: allAsp, aov: (allOrders > 0 ? allAdSales / allOrders : 0), promoMyBrand: allPromoMyBrand, promoCompete: allPromoCompete, wtDiscount: allWtDiscount, categorySize: sumCatSize, adSov: allAdSov, organicSov: allOrganicSov, tacos: allTacos,
                prevOfftake: prevAllOfftake, prevAvailability: prevAllAvailability, prevWtOsa: prevAllWtOsa, prevListingPercent: prevAllListingPct, prevSos: prevAllSos, prevMarketShare: prevAllMarketShare, prevSpend: prevAllSpend, prevRoas: prevAllRoas, prevInorgSales: prevAllInorgSales, prevConversion: prevAllConversion, prevCpm: prevAllCpm, prevCpc: prevAllCpc, prevAsp: prevAllAsp, prevAov: (prevAllOrders > 0 ? prevAllAdSales / prevAllOrders : 0), prevPromoMyBrand: prevAllPromoMyBrand, prevPromoCompete: prevAllPromoCompete, prevWtDiscount: prevAllWtDiscount, prevCategorySize: prevSumCatSize, prevAdSov: prevAllAdSov, prevOrganicSov: prevAllOrganicSov, prevTacos: prevAllTacos,
                offtakeUnits: allOfftakeUnits, inorgUnits: allInorgUnits, prevOfftakeUnits: prevAllOfftakeUnits, prevInorgUnits: prevAllInorgUnits
            })
        });

        // ===== SYNC All row % changes with Watch Tower Overview =====
        // The Watch Tower Overview (computeSummaryMetrics) and Platform Overview compute
        // metrics via separate queries. To guarantee the "All" row shows identical % changes,
        // call computeSummaryMetrics and overlay its change values onto the All row's columns.
        try {
            console.log('[getPlatformOverview] Syncing All row % changes with Watch Tower Overview...');
            const overviewResult = await computeSummaryMetrics(filters, { onlyOverview: true, skipPerformanceKpis: true });
            const topMetrics = overviewResult.topMetrics || [];

            // Build a map from metric name -> { trend, trendType }
            const overviewChangeMap = {};
            topMetrics.forEach(m => {
                overviewChangeMap[m.name] = { trend: m.trend, trendType: m.trendType };
            });

            // Map Watch Tower Overview metric names to Platform Overview column titles
            const nameToTitle = {
                'Offtake': 'Offtakes',
                'Availability': 'Availability',
                'Share of Search': 'SOS',
                'Market Share': 'Market Share',
                'Promo': 'Promo My Brand'
            };

            // Override the "All" row's change values
            const allRow = platformOverview.find(r => r.key === 'all');
            if (allRow && allRow.columns) {
                for (const [overviewName, colTitle] of Object.entries(nameToTitle)) {
                    const overviewMetric = overviewChangeMap[overviewName];
                    if (!overviewMetric) continue;

                    const col = allRow.columns.find(c => c.title === colTitle);
                    if (col && col.change) {
                        col.change.text = overviewMetric.trend;
                        col.change.positive = overviewMetric.trendType === 'positive';
                    }
                }

                // Also sync the Actionable Intelligence KPIs (Inorganic Sales, Conversion, ROAS, Orders)
                // from the performanceMetricsKpis if available
                const summaryMetrics = overviewResult.summaryMetrics || {};
                // Update the All row's main values to also match the overview values
                const offtakeCol = allRow.columns.find(c => c.title === 'Offtakes');
                if (offtakeCol && summaryMetrics.offtakes) {
                    offtakeCol.value = summaryMetrics.offtakes;
                }
                const availCol = allRow.columns.find(c => c.title === 'Availability');
                if (availCol && summaryMetrics.stockAvailability) {
                    availCol.value = summaryMetrics.stockAvailability;
                }
                const sosCol = allRow.columns.find(c => c.title === 'SOS');
                if (sosCol && summaryMetrics.shareOfSearch) {
                    sosCol.value = summaryMetrics.shareOfSearch;
                }
                const msCol = allRow.columns.find(c => c.title === 'Market Share');
                if (msCol && summaryMetrics.marketShare) {
                    msCol.value = summaryMetrics.marketShare;
                }

                console.log('[getPlatformOverview] All row synced with Watch Tower Overview successfully');
            }
        } catch (syncError) {
            console.error('[getPlatformOverview] Failed to sync All row with Overview (non-fatal):', syncError.message);
            // Non-fatal: the All row keeps its independently computed values
        }
    }

    // Process each platform from bulk data
    for (const p of platformDefinitions) {
        const key = p.label.toLowerCase();
        const metrics = bulkPlatformMap.get(p.label) || { curr: {}, prev: {} };

        const hasPdp = Boolean(findPlatformRow(currData, key)) || (isDrlDb && buymorePlatforms.includes(key) && (currBuymoreMap.get(key) || 0) > 0);
        const hasPm = Boolean(findPlatformRow(currPmData, key));
        const hasMsCheck = hasMapKey(currMsMap, key) || hasMapKey(currMsDenomMap, key);
        const hasSosCheck = hasMapKey(currSosOurMap, key) || hasMapKey(currSosTotalMap, key);

        const offtake = hasPdp ? (metrics.curr.sales || 0) : null;
        const offtakeUnits = hasPdp ? (metrics.curr.qty || 0) : null;
        const totalSpend = hasPm ? (metrics.curr.spend || 0) : null;
        const totalAdSales = hasPm ? (metrics.curr.adSales || 0) : null;
        const inorgUnits = hasPm ? (metrics.curr.orders || 0) : null; // Using orders as units for Inorg Sales
        const totalClicks = hasPm ? (metrics.curr.clicks || 0) : null;
        const totalImpressions = hasPm ? (metrics.curr.impressions || 0) : null;
        const totalOrders = hasPm ? (metrics.curr.orders || 0) : null;

        // Hardcode Market Share values as requested by user
        let marketShare = hasTier23 ? null : await getMarketShare(startDate, endDate, p.label, rawCategory, null, locationArr, channel);

        console.log(`[getPlatformOverview] DEBUG MS - Platform: ${p.label}, key: ${key}, hasMsCheck: ${hasMsCheck}, marketShare: ${marketShare}, currMsMap.has(key): ${currMsMap.has(key)}, currMsDenomMap.has(key): ${currMsDenomMap.has(key)}`);

        const sos = hasSosCheck ? (metrics.curr.sos ?? null) : null;
        const adSov = hasSosCheck ? (metrics.curr.adSov ?? null) : null;
        const organicSov = hasSosCheck ? (metrics.curr.organicSov ?? null) : null;

        const availability = hasPdp ? (metrics.curr.deno > 0 ? (metrics.curr.neno / metrics.curr.deno) * 100 : null) : null;
        const wtOsa = (availability !== null && metrics.curr.avgListingPercent !== null && metrics.curr.avgListingPercent !== undefined) ? (availability * metrics.curr.avgListingPercent) / 100 : null;
        const isEcom = key.includes('amazon') || key.includes('flipkart') || key.includes('myntra') || key.includes('nykaa') || key.includes('jiomart');
        const isQuick = key.includes('blinkit') || key.includes('zepto') || key.includes('swiggy') || key.includes('instamart') || key.includes('bbnow') || key.includes('quick');

        const roas = hasPm ? (totalSpend > 0 ? totalAdSales / totalSpend : null) : null;
        const conversion = hasPm ? (metrics.curr.conversion ?? null) : null;
        const cpm = (hasPm && isQuick) ? (totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null) : null;
        const cpc = (hasPm && (isEcom || isPidilite)) ? (totalClicks > 0 ? totalSpend / totalClicks : null) : null;
        const inorgSales = hasPm ? totalAdSales : null;

        const promoMyBrand = hasPdp ? (metrics.curr.myAvgDiscount ?? null) : null;
        const promoCompete = hasPdp ? (metrics.curr.compAvgDiscount ?? null) : null;
        const wtDiscount = hasPdp ? (metrics.curr.myWtDiscount ?? null) : null;
        const listingPercent = hasPdp ? (metrics.curr.avgListingPercent ?? null) : null;
        const asp = hasPdp ? (metrics.curr.asp ?? null) : null;

        // Previous period
        const prevHasPdp = prevData.some(d => d.Platform && d.Platform.toLowerCase() === key) || (isDrlDb && buymorePlatforms.includes(key) && (prevBuymoreMap.get(key) || 0) > 0);
        const prevHasPm = prevPmData.some(d => d.Platform && d.Platform.toLowerCase() === key);
        const prevHasMsCheck = prevMsMap.has(key) || prevMsDenomMap.has(key);
        const prevHasSosCheck = prevSosOurMap.has(key) || prevSosTotalMap.has(key);

        const prevOfftake = prevHasPdp ? (metrics.prev.sales || 0) : null;
        const prevOfftakeUnits = prevHasPdp ? (metrics.prev.qty || 0) : null;
        const prevSpend = prevHasPm ? (metrics.prev.spend || 0) : null;
        const prevAdSales = prevHasPm ? (metrics.prev.adSales || 0) : null;
        const prevInorgUnits = prevHasPm ? (metrics.prev.orders || 0) : null;
        const prevImpressions = prevHasPm ? (metrics.prev.impressions || 0) : null;
        const prevClicks = prevHasPm ? (metrics.prev.clicks || 0) : null;
        const prevOrders = prevHasPm ? (metrics.prev.orders || 0) : null;

        let prevMarketShare = hasTier23 ? null : await getMarketShare(momStart, momEnd, p.label, rawCategory, null, locationArr, channel);
        const prevSos = prevHasSosCheck ? (metrics.prev.sos ?? null) : null;
        const prevAdSov = prevHasSosCheck ? (metrics.prev.adSov ?? null) : null;
        const prevOrganicSov = prevHasSosCheck ? (metrics.prev.organicSov ?? null) : null;

        const prevAvailability = prevHasPdp ? (metrics.prev.deno > 0 ? (metrics.prev.neno / metrics.prev.deno) * 100 : null) : null;
        const prevListingPercent = prevHasPdp ? (metrics.prev.avgListingPercent ?? null) : null;
        const prevWtOsa = (prevAvailability !== null && prevListingPercent !== null && prevListingPercent !== undefined) ? (prevAvailability * prevListingPercent) / 100 : null;
        const prevRoas = prevHasPm ? (prevSpend > 0 ? prevAdSales / prevSpend : null) : null;
        const prevConversion = prevHasPm ? (metrics.prev.conversion ?? null) : null;
        const prevCpm = (prevHasPm && isQuick) ? (prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : null) : null;
        const prevCpc = (prevHasPm && (isEcom || isPidilite)) ? (prevClicks > 0 ? prevSpend / prevClicks : null) : null;
        const prevAsp = prevHasPdp ? (metrics.prev.asp ?? null) : null;
        const prevAov = (prevHasPm && prevOrders > 0) ? prevAdSales / prevOrders : null;
        const prevInorgSales = prevHasPm ? prevAdSales : null;

        const prevPromoMyBrand = prevHasPdp ? (metrics.prev.myAvgDiscount ?? null) : null;
        const prevPromoCompete = prevHasPdp ? (metrics.prev.compAvgDiscount ?? null) : null;
        const prevWtDiscount = prevHasPdp ? (metrics.prev.myWtDiscount ?? null) : null;

        // Fuzzy match category size from the maps
        const fuzzyGet = (map, label) => {
            const lowerLabel = label.toLowerCase();
            if (map.has(lowerLabel)) return map.get(lowerLabel);
            for (const [mk, mv] of map.entries()) {
                if (mk.includes(lowerLabel) || lowerLabel.includes(mk)) return mv;
            }
            return 0; // if not found, we want fallback to null later
        };

        const cNoLoc = currDataNoLoc.find(d => d.Platform && d.Platform.toLowerCase() === key);
        const pNoLoc = prevDataNoLoc.find(d => d.Platform && d.Platform.toLowerCase() === key);

        const offtakeNoLoc = hasLocationFilter ? (parseFloat(cNoLoc?.sales || 0)) : offtake;
        const prevOfftakeNoLoc = hasLocationFilter ? (parseFloat(pNoLoc?.sales || 0)) : prevOfftake;

        const tacos = (totalSpend !== null && offtakeNoLoc !== null && offtakeNoLoc > 0) ? (totalSpend / offtakeNoLoc) * 100 : null;
        const prevTacos = (prevSpend !== null && prevOfftakeNoLoc !== null && prevOfftakeNoLoc > 0) ? (prevSpend / prevOfftakeNoLoc) * 100 : null;

        const currCatSizeAbsolute = fuzzyGet(currCatSizeByPlatformMap, p.label) || null;
        const prevCatSizeAbsolute = fuzzyGet(prevCatSizeByPlatformMap, p.label) || null;

        platformOverview.push({
            key: p.key,
            label: p.label,
            type: p.type,
            logo: p.logo,
            columns: generateKpiColumns({
                offtake, availability, wtOsa, listingPercent, sos, marketShare, spend: totalSpend, roas, inorgSales, conversion, cpm, cpc, asp, aov: (totalOrders > 0 ? totalAdSales / totalOrders : 0), promoMyBrand, promoCompete, wtDiscount, categorySize: currCatSizeAbsolute, adSov, organicSov, tacos,
                prevOfftake, prevAvailability, prevWtOsa, prevListingPercent, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales, prevConversion, prevCpm, prevCpc, prevAsp, prevAov, prevPromoMyBrand, prevPromoCompete, prevWtDiscount, prevCategorySize: prevCatSizeAbsolute, prevAdSov, prevOrganicSov, prevTacos,
                offtakeUnits, inorgUnits, prevOfftakeUnits, prevInorgUnits
            })
        });
    }

    console.log(`[getPlatformOverview] OPTIMIZED: Returning ${platformOverview.length} platforms`);
    return platformOverview;
};

/**
 * Get Month Overview Data - OPTIMIZED
 * Requires monthOverviewPlatform parameter
 * NOTE: Computes ONLY month data, not platforms/categories/brands
 */
const getMonthOverview = async (filters) => {
    console.log('[getMonthOverview] Computing OPTIMIZED month overview data...');

    const { months = 1, startDate: qStartDate, endDate: qEndDate, monthOverviewPlatform, skuName, skuCode } = filters;
    const channel = extractChannel(filters);

    // Extract filter values - frontend may send as 'category' or 'category[]'
    const rawCategory = filters['category[]'] || filters.category;
    const rawBrand = filters['brand[]'] || filters.brand;
    const rawLocation = filters['location[]'] || filters.location;

    // Normalize multi-value filters
    const brandArr = normalizeFilterArray(rawBrand);
    const locationArr = normalizeFilterArray(rawLocation);
    const categoryArr = normalizeFilterArray(rawCategory);
    const brand = brandArr ? (brandArr.length === 1 ? brandArr[0] : brandArr) : null;
    const location = locationArr ? (locationArr.length === 1 ? locationArr[0] : locationArr) : null;

    // Check if any selected location is NOT one of the 11 Tier-1 cities (case-insensitive)
    const tier1Cities = [
        'kolkata', 'mumbai', 'pune', 'chennai', 'delhi', 'lucknow',
        'gurugram', 'chandigarh', 'hyderabad', 'faridabad', 'bengaluru'
    ];
    let hasTier23 = false;
    if (locationArr && locationArr.length > 0) {
        hasTier23 = locationArr.some(loc => {
            const lowerLoc = String(loc).trim().toLowerCase();
            if (lowerLoc === 'all' || lowerLoc === '' || lowerLoc === 'all india') return false;
            return !tier1Cities.includes(lowerLoc);
        });
    }

    const monthsBack = parseInt(months, 10) || 1;
    const moPlatform = monthOverviewPlatform || filters.platform || null;

    // Calculate date range
    let endDate = await getCachedMaxDate();
    let startDate = endDate.subtract(monthsBack, 'month').startOf('day');
    if (qStartDate && qEndDate) {
        startDate = dayjs(qStartDate).startOf('day');
        endDate = dayjs(qEndDate).endOf('day');
    }

    // For comparison, we need one extra month at the beginning
    const fetchStartDate = startDate.clone().subtract(1, 'month').startOf('month');

    // Generate month buckets
    const monthBuckets = [];
    let current = startDate.clone().startOf('month');
    const endMonth = endDate.clone().endOf('month');
    while (current.isBefore(endMonth) || current.isSame(endMonth, 'month')) {
        monthBuckets.push({
            label: current.format('MMM YYYY'),
            date: current.toDate(),
            value: 0
        });
        current = current.add(1, 'month');
    }

    // Query all months at once with GROUP BY - USING CLICKHOUSE
    const src = await getWatchtowerSource(filters);
    const pmSrc = await getPmSource();
    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

    // Build offtake conditions - using fetchStartDate for historical data
    const buildMoConds = () => {
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const conds = [`${dateCol} BETWEEN '${fetchStartDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        const platformCond = buildPlatformChannelCond(moPlatform, channel, src.f.platform, false, src.f.channel);
        if (platformCond) conds.push(platformCond);
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            conds.push(`(${brandArr.map(b => `lower(${src.f.brand}) LIKE '%${escapeStr(b.toLowerCase())}%'`).join(' OR ')})`);
        }
        if (locationArr && locationArr.length > 0) {
            const locCond = buildLocationQueryCond(locationArr, moPlatform, src.f.location, src.f.platform);
            if (locCond) conds.push(locCond);
        }
        if (categoryArr && categoryArr.length > 0) {
            const catCol = src.f.category;
            conds.push(`${catCol} IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        // Advanced SKU Search Filters
        const skuArr = normalizeFilterArray(skuName);
        if (skuArr && skuArr.length > 0) {
            const skuConds = skuArr.map(s => `Product LIKE '%${escapeStr(s)}%'`).join(' OR ');
            conds.push(`(${skuConds})`);
        }
        const skuCodeArr = normalizeFilterArray(skuCode);
        if (skuCodeArr && skuCodeArr.length > 0) {
            const skuCodeConds = skuCodeArr.map(s => `toString(Web_Pid) LIKE '%${escapeStr(s)}%'`).join(' OR ');
            conds.push(`(${skuCodeConds})`);
        }
        if (!src.isAgg) {
            const mslArr = normalizeFilterArray(filters.msl);
            if (mslArr && mslArr.length > 0) {
                const mslConds = mslArr.map(m => `toString(${src.f.msl}) = '${escapeStr(m)}'`).join(' OR ');
                conds.push(`(${mslConds})`);
            }
        }
        return conds.join(' AND ');
    };

    // Build SOS conditions
    const buildSosMoConds = () => {
        const conds = [`toDate(DATE) BETWEEN '${fetchStartDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        const pCond = buildPlatformChannelCond(moPlatform, channel, 'platform_name');
        if (pCond) conds.push(pCond);
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`keyword_category IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        if (locationArr && locationArr.length > 0) {
            const locCond = buildLocationQueryCond(locationArr, moPlatform, 'location_name', 'platform_name');
            if (locCond) conds.push(locCond);
        }
        return conds.join(' AND ');
    };

    const buildPmMoConds = () => {
        const conds = [`${pmSrc.f.date} BETWEEN '${fetchStartDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        const platformCond = buildPlatformChannelCond(moPlatform, channel, pmSrc.f.platform, false, pmSrc.f.channel);
        if (platformCond) conds.push(platformCond);
        if (brandArr && brandArr.length > 0) {
            conds.push(`lower(${pmSrc.f.brand}) IN (${brandArr.map(b => `'${escapeStr(b).toLowerCase()}'`).join(', ')})`);
        }
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`lower(${pmSrc.f.category}) IN (${categoryArr.map(c => `'${escapeStr(c).toLowerCase()}'`).join(', ')})`);
        }
        if (pmSrc.f.location && pmSrc.f.location !== "'Unknown'" && locationArr && locationArr.length > 0) {
            const locCond = buildLocationQueryCond(locationArr, moPlatform, pmSrc.f.location, pmSrc.f.platform);
            if (locCond) conds.push(locCond);
        }
        return conds.join(' AND ');
    };

    const moConds = buildMoConds();
    const pmMoConds = buildPmMoConds();
    const sosMoConds = buildSosMoConds();

    // Get valid brand names
    const validBrandNamesForMonth = await getCachedValidBrandNames();
    const brandsForMonthMs = (brand && brand !== 'All') ? (Array.isArray(brand) ? brand : [brand]) : validBrandNamesForMonth;

    // Build MS conditions
    const buildMsMoConds = (brandsFilter = null) => {
        const conds = [`toDate(created_on) BETWEEN '${fetchStartDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        const platformCond = buildPlatformChannelCond(moPlatform, channel, 'platform');
        if (platformCond) conds.push(platformCond);
        conds.push(`sales IS NOT NULL`);
        if (brandsFilter && brandsFilter.length > 0) {
            conds.push(`group_brand IN (${brandsFilter.map(b => `'${escapeStr(b)}'`).join(', ')})`);
        }
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`category IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        if (locationArr && locationArr.length > 0) {
            const locCond = buildLocationQueryCond(locationArr, moPlatform, 'location', 'platform');
            if (locCond) conds.push(locCond);
        }
        return conds.join(' AND ');
    };

    const msNumMoConds = buildMsMoConds(brandsForMonthMs);
    const msDenomMoConds = buildMsMoConds(null);

    // ⚡ OPTIMIZED: Run all queries in PARALLEL with ClickHouse
    const [monthlyData, monthlyPmData, sosNumMonth, sosDenomMonth, msMonthData, catSizeMonth, adSovNumMonth, adSovDenomMonth, orgSovNumMonth, orgSovDenomMonth] = await Promise.all([
        queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(${src.f.date}), '%Y-%m-01') as month_date,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.sales} ELSE 0 END) as total_sales,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.quantitySold} ELSE 0 END) as total_qty,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.neno} ELSE 0 END) as total_neno,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.deno} ELSE 0 END) as total_deno,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 AND ${src.f.mrp} > 0 THEN ${src.f.mrp} * ${src.f.quantitySold} ELSE 0 END) as my_mrp_val,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 AND ${src.f.mrp} > 0 THEN ${src.f.sellingPrice} * ${src.f.quantitySold} ELSE 0 END) as my_actual_sales,
                        SUM(CASE WHEN ${src.f.compFlag} = 1 AND ${src.f.mrp} > 0 THEN ${src.f.mrp} * ${src.f.quantitySold} ELSE 0 END) as comp_mrp_val,
                        SUM(CASE WHEN ${src.f.compFlag} = 1 AND ${src.f.mrp} > 0 THEN ${src.f.sellingPrice} * ${src.f.quantitySold} ELSE 0 END) as comp_actual_sales,
                        SUM(${src.f.buyBoxNeno} * 1.0) as total_buy_box_neno,
                        AVG(if(${src.f.deliveryDays} IS NOT NULL, toFloat64OrNull(toString(${src.f.deliveryDays})), NULL)) as avg_delivery_days,
                        AVG(if(${src.f.compFlag} = 0 AND ${src.f.sellingPriceRaw} > 0, ${src.f.sellingPriceRaw}, NULL)) as avg_asp,
                        AVG(if(${src.f.compFlag} = 0, ${src.f.listingPercent}, NULL)) as avg_listing_percent,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ((${src.f.mrp} - ${src.f.sellingPrice}) / NULLIF(${src.f.mrp}, 0)) * ${src.f.sales} ELSE 0 END) / NULLIF(SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.sales} ELSE 0 END), 0) * 100 as my_wt_discount
                    FROM ${src.table}
                    WHERE ${moConds}
                    GROUP BY formatDateTime(toDate(${src.f.date}), '%Y-%m-01')
                `),
        // Marketing Metrics by month from PM table
        (() => {
            const pmChannelColSql = pmSrc.f.channel ? `lower(${pmSrc.f.channel})` : `(CASE WHEN lower(${pmSrc.f.platform}) IN ('amazon', 'flipkart', 'myntra', 'nykaa', 'jiomart') THEN 'ecommerce' WHEN lower(${pmSrc.f.platform}) IN ('blinkit', 'zepto', 'instamart', 'swiggy', 'bbnow') THEN 'quickcomm' ELSE 'other' END)`;
            return queryClickHouse(`
                SELECT 
                    formatDateTime(toDate(${pmSrc.f.date}), '%Y-%m-01') as month_date,
                    SUM(${pmSrc.f.spend}) as total_spend,
                    SUM(${pmSrc.f.adSales}) as total_Ad_sales,
                    SUM(${pmSrc.f.clicks}) as total_clicks,
                    SUM(${pmSrc.f.impressions}) as total_impressions,
                    SUM(${pmSrc.f.orders}) as total_orders,
                    SUM(CASE WHEN ${pmChannelColSql} = 'ecommerce' THEN ${pmSrc.f.spend} ELSE 0 END) as cpc_spend,
                    SUM(CASE WHEN ${pmChannelColSql} = 'ecommerce' THEN ${pmSrc.f.clicks} ELSE 0 END) as cpc_clicks,
                    SUM(CASE WHEN ${pmChannelColSql} = 'quickcomm' THEN ${pmSrc.f.spend} ELSE 0 END) as cpm_spend,
                    SUM(CASE WHEN ${pmChannelColSql} = 'quickcomm' THEN ${pmSrc.f.impressions} ELSE 0 END) as cpm_impressions
                FROM ${pmSrc.table}
                WHERE ${pmMoConds}
                GROUP BY formatDateTime(toDate(${pmSrc.f.date}), '%Y-%m-01')
            `);
        })(),
        queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(DATE), '%Y-%m-01') as month,
                        // Simple SOS numerator: sumIf(overall, flag='1') for our brand
                        sumIf(toInt32(overall), toString(flag) = '1') as count
                    FROM rb_kw_olap
                    WHERE ${sosMoConds}
                    GROUP BY month
                `),
        // SOS Denominator by month (total sum(overall))
        queryClickHouse(`
                    SELECT formatDateTime(toDate(DATE), '%Y-%m-01') as month,
                        sum(toInt32(overall)) as count
                    FROM rb_kw_olap
                    WHERE ${sosMoConds}
                    GROUP BY month
                `),
        getMarketShareByMonth(fetchStartDate, endDate, moPlatform, rawCategory, null, locationArr, channel),
        // Category Size by month
        queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(created_on), '%Y-%m-01') as month_date,
                        SUM(toFloat64OrZero(toString(sales))) as cat_size
                    FROM rb_ms_olap
                    WHERE ${msDenomMoConds}
                    GROUP BY formatDateTime(toDate(created_on), '%Y-%m-01')
                `),
        // Spons SOS (Ad SOV) numerator by month (sumIf(spons), flag=0 for our brands)
        queryClickHouse(`
                    SELECT formatDateTime(toDate(DATE), '%Y-%m-01') as month,
                        sumIf(toInt32(spons), toString(flag) = '1') as count
                    FROM rb_kw_olap
                    WHERE ${sosMoConds}
                    GROUP BY month
                `),
        // Spons SOS (Ad SOV) denominator by month (total sum(spons))
        queryClickHouse(`
                    SELECT formatDateTime(toDate(DATE), '%Y-%m-01') as month,
                        sum(toInt32(spons)) as count
                    FROM rb_kw_olap
                    WHERE ${sosMoConds}
                    GROUP BY month
                `),
        // Organic SOS numerator by month (sumIf(organic), flag=0 for our brands)
        queryClickHouse(`
                    SELECT formatDateTime(toDate(DATE), '%Y-%m-01') as month,
                        sumIf(toInt32(organic), toString(flag) = '1') as count
                    FROM rb_kw_olap
                    WHERE ${sosMoConds}
                    GROUP BY month
                `),
        // Organic SOS denominator by month (total sum(organic))
        queryClickHouse(`
                    SELECT formatDateTime(toDate(DATE), '%Y-%m-01') as month,
                        sum(toInt32(organic)) as count
                    FROM rb_kw_olap
                    WHERE ${sosMoConds}
                    GROUP BY month
                `)
    ]);

    const sosNumMonthMap = new Map(sosNumMonth.map(r => [r.month, parseInt(r.count) || 0]));
    const sosDenomMonthMap = new Map(sosDenomMonth.map(r => [r.month, parseInt(r.count) || 0]));
    const msMonthMap = new Map(msMonthData.map(r => [r.month_date, parseFloat(r.avg_market_share || 0)]));
    const catSizeMonthMap = new Map(catSizeMonth.map(r => [r.month_date, parseFloat(r.cat_size || 0)]));
    const dataMap = new Map(monthlyData.map(d => [d.month_date, d]));
    const pmDataMap = new Map(monthlyPmData.map(d => [d.month_date, d]));

    // Ad SOV and Organic SOV maps by month
    const adSovNumMonthMap = new Map(adSovNumMonth.map(r => [r.month, parseInt(r.count) || 0]));
    const adSovDenomMonthMap = new Map(adSovDenomMonth.map(r => [r.month, parseInt(r.count) || 0]));
    const orgSovNumMonthMap = new Map(orgSovNumMonth.map(r => [r.month, parseInt(r.count) || 0]));
    const orgSovDenomMonthMap = new Map(orgSovDenomMonth.map(r => [r.month, parseInt(r.count) || 0]));

    const monthOverview = monthBuckets.map(bucket => {
        const monthKey = dayjs(bucket.date).format('YYYY-MM-01');
        const data = dataMap.get(monthKey) || {};
        const pmData = pmDataMap.get(monthKey) || {};

        const hasPdp = dataMap.has(monthKey);
        const hasPm = pmDataMap.has(monthKey);
        const hasMsCheck = msMonthMap.has(monthKey);
        const hasSosCheck = sosDenomMonthMap.has(monthKey);

        const offtake = hasPdp ? parseFloat(data.total_sales || 0) : null;
        const offtakeUnits = hasPdp ? parseFloat(data.total_qty || 0) : null;
        const spend = hasPm ? parseFloat(pmData.total_spend || 0) : null;
        const adSales = hasPm ? parseFloat(pmData.total_Ad_sales || 0) : null;
        const inorgUnits = hasPm ? parseFloat(pmData.total_orders || 0) : null;
        const clicks = hasPm ? parseFloat(pmData.total_clicks || 0) : null;
        const impressions = hasPm ? parseFloat(pmData.total_impressions || 0) : null;
        const orders = hasPm ? parseFloat(pmData.total_orders || 0) : null;
        const neno = parseFloat(data.total_neno || 0);
        const deno = parseFloat(data.total_deno || 0);

        const availability = hasPdp ? (deno > 0 ? (neno / deno) * 100 : null) : null;
        const listingPercent = hasPdp ? parseFloat(data.avg_listing_percent || 0) : null;
        const wtOsa = (availability !== null && listingPercent !== null) ? (availability * listingPercent) / 100 : null;
        const wtDiscount = hasPdp ? parseFloat(data.my_wt_discount || 0) : null;
        const roas = hasPm ? (spend > 0 ? adSales / spend : null) : null;
        const conversion = hasPm ? calculateConversion(orders, impressions, clicks) : null;
        const cpcSpend = hasPm ? parseFloat(pmData.cpc_spend || 0) : 0;
        const cpcClicks = hasPm ? parseFloat(pmData.cpc_clicks || 0) : 0;
        const cpmSpend = hasPm ? parseFloat(pmData.cpm_spend || 0) : 0;
        const cpmImpressions = hasPm ? parseFloat(pmData.cpm_impressions || 0) : 0;
        const cpm = hasPm ? (cpmImpressions > 0 ? (cpmSpend / cpmImpressions) * 1000 : null) : null;
        const cpc = hasPm ? (cpcClicks > 0 ? cpcSpend / cpcClicks : null) : null;
        const asp = hasPdp ? parseFloat(data.avg_asp || 0) : null;
        const aov = (hasPm && orders > 0) ? adSales / orders : null;
        const buyBoxPct = hasPdp ? (deno > 0 ? (parseFloat(data.total_buy_box_neno || 0) * 1.0 / deno) * 100 : null) : null;
        const deliveryTime = hasPdp ? (parseFloat(data.avg_delivery_days || null)) : null;

        const marketShare = (hasMsCheck && !hasTier23) ? (msMonthMap.get(monthKey) ?? null) : null;

        const sosNum = sosNumMonthMap.get(monthKey) || 0;
        const sosDenom = sosDenomMonthMap.get(monthKey) || 0;
        const sos = hasSosCheck ? (sosDenom > 0 ? (sosNum / sosDenom) * 100 : null) : null;

        // Metrics for PREVIOUS month for change calculation
        const prevMonthKey = dayjs(bucket.date).subtract(1, 'month').format('YYYY-MM-01');
        const prevData = dataMap.get(prevMonthKey) || {};
        const prevPmData = pmDataMap.get(prevMonthKey) || {};

        const prevHasPdp = dataMap.has(prevMonthKey);
        const prevHasPm = pmDataMap.has(prevMonthKey);
        const prevHasMsCheck = msMonthMap.has(prevMonthKey);
        const prevHasSosCheck = sosDenomMonthMap.has(prevMonthKey);

        const prevOfftake = prevHasPdp ? parseFloat(prevData.total_sales || 0) : null;
        const prevOfftakeUnits = prevHasPdp ? parseFloat(prevData.total_qty || 0) : null;
        const prevSpend = prevHasPm ? parseFloat(prevPmData.total_spend || 0) : null;
        const prevAdSales = prevHasPm ? parseFloat(prevPmData.total_Ad_sales || 0) : null;
        const prevInorgUnits = prevHasPm ? parseFloat(prevPmData.total_orders || 0) : null;
        const prevClicks = prevHasPm ? parseFloat(prevPmData.total_clicks || 0) : null;
        const prevImpressions = prevHasPm ? parseFloat(prevPmData.total_impressions || 0) : null;
        const prevOrders = prevHasPm ? parseFloat(prevPmData.total_orders || 0) : null;
        const prevNeno = parseFloat(prevData.total_neno || 0);
        const prevDeno = parseFloat(prevData.total_deno || 0);

        const prevAvailability = prevHasPdp ? (prevDeno > 0 ? (prevNeno / prevDeno) * 100 : null) : null;
        const prevListingPercent = prevHasPdp ? parseFloat(prevData.avg_listing_percent || 0) : null;
        const prevWtOsa = (prevAvailability !== null && prevListingPercent !== null) ? (prevAvailability * prevListingPercent) / 100 : null;
        const prevWtDiscount = prevHasPdp ? parseFloat(prevData.my_wt_discount || 0) : null;
        const prevRoas = prevHasPm ? (prevSpend > 0 ? prevAdSales / prevSpend : null) : null;
        const prevConversion = prevHasPm ? (prevClicks > 0 ? (prevOrders / prevClicks) * 100 : null) : null;
        const prevCpcSpend = prevHasPm ? parseFloat(prevPmData.cpc_spend || 0) : 0;
        const prevCpcClicks = prevHasPm ? parseFloat(prevPmData.cpc_clicks || 0) : 0;
        const prevCpmSpend = prevHasPm ? parseFloat(prevPmData.cpm_spend || 0) : 0;
        const prevCpmImpressions = prevHasPm ? parseFloat(prevPmData.cpm_impressions || 0) : 0;
        const prevCpm = prevHasPm ? (prevCpmImpressions > 0 ? (prevCpmSpend / prevCpmImpressions) * 1000 : null) : null;
        const prevCpc = prevHasPm ? (prevCpcClicks > 0 ? prevCpcSpend / prevCpcClicks : null) : null;
        const prevAsp = prevHasPdp ? parseFloat(prevData.avg_asp || 0) : null;
        const prevAov = (prevHasPm && prevOrders > 0) ? prevAdSales / prevOrders : null;
        const prevBuyBoxPct = prevHasPdp ? (prevDeno > 0 ? (parseFloat(prevData.total_buy_box_neno || 0) * 1.0 / prevDeno) * 100 : null) : null;
        const prevDeliveryTime = prevHasPdp ? (parseFloat(prevData.avg_delivery_days || null)) : null;

        const promoMyBrand = hasPdp ? (parseFloat(data.my_mrp_val || 0) > 0
            ? ((parseFloat(data.my_mrp_val) - parseFloat(data.my_actual_sales)) / parseFloat(data.my_mrp_val)) * 100
            : null) : null;
        const promoCompete = hasPdp ? (parseFloat(data.comp_mrp_val || 0) > 0
            ? ((parseFloat(data.comp_mrp_val) - parseFloat(data.comp_actual_sales)) / parseFloat(data.comp_mrp_val)) * 100
            : null) : null;
        const prevPromoMyBrand = prevHasPdp ? (parseFloat(prevData.my_mrp_val || 0) > 0
            ? ((parseFloat(prevData.my_mrp_val) - parseFloat(prevData.my_actual_sales)) / parseFloat(prevData.my_mrp_val)) * 100
            : null) : null;
        const prevPromoCompete = prevHasPdp ? (parseFloat(prevData.comp_mrp_val || 0) > 0
            ? ((parseFloat(prevData.comp_mrp_val) - parseFloat(prevData.comp_actual_sales)) / parseFloat(prevData.comp_mrp_val)) * 100
            : null) : null;

        const prevMarketShare = (prevHasMsCheck && !hasTier23) ? (msMonthMap.get(prevMonthKey) ?? null) : null;

        const prevSosNum = sosNumMonthMap.get(prevMonthKey) || 0;
        const prevSosDenom = sosDenomMonthMap.get(prevMonthKey) || 0;
        const prevSos = prevHasSosCheck ? (prevSosDenom > 0 ? (prevSosNum / prevSosDenom) * 100 : null) : null;

        // Ad SOV (spons_flag=1)
        const adSovNum = adSovNumMonthMap.get(monthKey) || 0;
        const adSovDenom = adSovDenomMonthMap.get(monthKey) || 0;
        const adSov = hasSosCheck ? (adSovDenom > 0 ? (adSovNum / adSovDenom) * 100 : null) : null;
        const prevAdSovNum = adSovNumMonthMap.get(prevMonthKey) || 0;
        const prevAdSovDenom = adSovDenomMonthMap.get(prevMonthKey) || 0;
        const prevAdSov = prevHasSosCheck ? (prevAdSovDenom > 0 ? (prevAdSovNum / prevAdSovDenom) * 100 : null) : null;

        // Organic SOV (spons_flag=0)
        const orgSovNum = orgSovNumMonthMap.get(monthKey) || 0;
        const orgSovDenom = orgSovDenomMonthMap.get(monthKey) || 0;
        const organicSov = hasSosCheck ? (orgSovDenom > 0 ? (orgSovNum / orgSovDenom) * 100 : null) : null;
        const prevOrgSovNum = orgSovNumMonthMap.get(prevMonthKey) || 0;
        const prevOrgSovDenom = orgSovDenomMonthMap.get(prevMonthKey) || 0;
        const prevOrganicSov = prevHasSosCheck ? (prevOrgSovDenom > 0 ? (prevOrgSovNum / prevOrgSovDenom) * 100 : null) : null;

        return {
            key: bucket.label,
            label: bucket.label,
            date: bucket.date,
            type: bucket.label,
            logo: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png",
            columns: generateKpiColumns({
                offtake, availability, wtOsa, listingPercent, sos, marketShare, spend, roas, inorgSales: adSales, conversion, cpm, cpc, asp, aov, promoMyBrand, promoCompete, wtDiscount, categorySize: hasMsCheck ? (catSizeMonthMap.get(monthKey) ?? null) : null, adSov, organicSov, buyBoxPct, deliveryTime,
                prevOfftake, prevAvailability, prevWtOsa, prevListingPercent, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales: prevAdSales, prevConversion, prevCpm, prevCpc, prevAsp, prevAov, prevPromoMyBrand, prevPromoCompete, prevWtDiscount, prevCategorySize: prevHasMsCheck ? (catSizeMonthMap.get(prevMonthKey) ?? null) : null, prevAdSov, prevOrganicSov, prevBuyBoxPct, prevDeliveryTime,
                offtakeUnits, inorgUnits, prevOfftakeUnits, prevInorgUnits
            })
        };
    });

    console.log(`[getMonthOverview] OPTIMIZED: Returning ${monthOverview.length} months`);
    return monthOverview;
};

/**
 * Get Category Overview Data - OPTIMIZED
 * Requires categoryOverviewPlatform parameter
 * NOTE: Computes ONLY category data
 */
const getCategoryOverview = async (filters) => {
    console.log('[getCategoryOverview] Computing OPTIMIZED category overview data...');

    const { months = 1, startDate: qStartDate, endDate: qEndDate, categoryOverviewPlatform, skuName, skuCode } = filters;
    const channel = extractChannel(filters);

    // Extract filter values - frontend may send as 'brand' or 'brand[]' (array format)
    const rawBrand = filters['brand[]'] || filters.brand;
    const rawLocation = filters['location[]'] || filters.location;
    const rawCategory = filters['category[]'] || filters.category;

    // Normalize multi-value filters
    const brandArr = normalizeFilterArray(rawBrand)?.map(b => b.toLowerCase());
    const locationArr = normalizeFilterArray(rawLocation);
    const categoryArr = normalizeFilterArray(rawCategory)?.map(c => c.toLowerCase());
    const brand = brandArr ? (brandArr.length === 1 ? brandArr[0] : brandArr) : null;
    const location = locationArr ? (locationArr.length === 1 ? locationArr[0] : locationArr) : null;
    // Check if any selected location is NOT one of the 11 Tier-1 cities (case-insensitive)
    const tier1Cities = [
        'kolkata', 'mumbai', 'pune', 'chennai', 'delhi', 'lucknow',
        'gurugram', 'chandigarh', 'hyderabad', 'faridabad', 'bengaluru'
    ];
    let hasTier23 = false;
    if (locationArr && locationArr.length > 0) {
        hasTier23 = locationArr.some(loc => {
            const lowerLoc = String(loc).trim().toLowerCase();
            if (lowerLoc === 'all' || lowerLoc === '' || lowerLoc === 'all india') return false;
            return !tier1Cities.includes(lowerLoc);
        });
    }
    const monthsBack = parseInt(months, 10) || 1;
    const catPlatform = categoryOverviewPlatform || filters.platform || 'All';

    // Calculate date range
    let endDate = await getCachedMaxDate();
    let startDate = endDate.subtract(monthsBack, 'month').startOf('day');
    if (qStartDate && qEndDate) {
        startDate = dayjs(qStartDate).startOf('day');
        endDate = dayjs(qEndDate).endOf('day');
    }

    // Comparison period logic (MoM / same duration)
    const durationDays = endDate.diff(startDate, 'day');
    const momEnd = startDate.clone().subtract(1, 'day').endOf('day');
    const momStart = momEnd.clone().subtract(durationDays, 'day').startOf('day');

    // Get the optimized data source
    const src = await getWatchtowerSource(filters);
    const pmSrc = await getPmSource();




    // Helper to escape strings for ClickHouse
    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

    // Build category conditions for rb_pdp_olap
    const buildCatConds = (sDate, eDate) => {
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const conds = [`${dateCol} BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];

        const platformCol = src.isAgg ? 'platform' : 'Platform';
        const platformCond = buildPlatformChannelCond(catPlatform, channel, platformCol, false, src.f.channel);
        if (platformCond) conds.push(platformCond);

        const brandCol = src.isAgg ? 'brand' : 'Brand';
        if (brandArr && brandArr.length > 0) {
            conds.push(`(${brandArr.map(b => `LOWER(${brandCol}) LIKE '%${escapeStr(b)}%'`).join(' OR ')})`);
        }

        const locCol = src.isAgg ? 'location' : 'Location';
        if (locationArr && locationArr.length > 0) {
            const platformCol = src.isAgg ? 'platform' : 'Platform';
            const locCond = buildLocationQueryCond(locationArr, catPlatform, locCol, platformCol);
            if (locCond) conds.push(locCond);
        }

        const catCol = src.isAgg ? 'category' : PRODUCT_CATEGORY_SQL;
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`LOWER(${catCol}) IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }

        // Advanced SKU Search Filters (Only supported on raw table)
        if (!src.isAgg) {
            const skuArrArr = normalizeFilterArray(skuName);
            if (skuArrArr && skuArrArr.length > 0) {
                const skuConds = skuArrArr.map(s => `lower(Product) LIKE '%${escapeStr(s.toLowerCase())}%'`).join(' OR ');
                conds.push(`(${skuConds})`);
            }
            const skuCodeArrArr = normalizeFilterArray(skuCode);
            if (skuCodeArrArr && skuCodeArrArr.length > 0) {
                const skuCodeConds = skuCodeArrArr.map(s => `toString(Web_Pid) LIKE '%${escapeStr(s)}%'`).join(' OR ');
                conds.push(`(${skuCodeConds})`);
            }
            const mslArr = normalizeFilterArray(filters.msl);
            if (mslArr && mslArr.length > 0) {
                const mslConds = mslArr.map(m => `toString(${src.f.msl}) = '${escapeStr(m)}'`).join(' OR ');
                conds.push(`(${mslConds})`);
            }
        }

        return conds.join(' AND ');
    };

    // Build SOS conditions for rb_kw_olap
    const buildSosCatConds = (sDate, eDate) => {
        const conds = [`toDate(DATE) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        // Only consider top 10 ranked positions for SOS
        conds.push(`POSITION <= 10`);
        const pCond = buildPlatformChannelCond(catPlatform, channel, 'platform_name');
        if (pCond) conds.push(pCond);
        if (locationArr && locationArr.length > 0) {
            const locCond = buildLocationQueryCond(locationArr, catPlatform, 'location_name', 'platform_name');
            if (locCond) conds.push(locCond);
        }
        // NOTE: Do NOT apply brand filter here for SOS/Ad SOV/Organic SOV.
        // SOS numerator uses flag='1' or brand-specific sumIf condition, and the denominator
        // must count ALL brands to compute share of search correctly.
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`LOWER(keyword_category) IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        return conds.join(' AND ');
    };

    // Build SOS numerator condition: brand-specific or flag-based
    let sosCatNumCondition;
    if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
        const brandConds = brandArr.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ');
        sosCatNumCondition = `LOWER(brand) IN (${brandConds})`;
    } else {
        sosCatNumCondition = "toString(flag) = '1'";
    }
    // Build PM conditions for rb_pm_olap
    const buildPmCatConds = (sDate, eDate) => {
        const conds = [`${pmSrc.f.date} BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        const platformCond = buildPlatformChannelCond(catPlatform, channel, pmSrc.f.platform, false, pmSrc.f.channel);
        if (platformCond) conds.push(platformCond);
        if (pmSrc.f.location && pmSrc.f.location !== "'Unknown'" && locationArr && locationArr.length > 0) {
            const locCond = buildLocationQueryCond(locationArr, catPlatform, pmSrc.f.location, pmSrc.f.platform);
            if (locCond) conds.push(locCond);
        }
        if (brandArr && brandArr.length > 0) {
            const brandConds = brandArr.map(b => `'${escapeStr(b).toLowerCase()}'`).join(',');
            conds.push(`lower(${pmSrc.f.brand}) IN (${brandConds})`);
        }
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`lower(${pmSrc.f.category}) IN (${categoryArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
        }
        return conds.join(' AND ');
    };


    // Build MS conditions for rb_ms_olap
    const buildMsCatConds = (sDate, eDate, brandsFilter = null) => {
        const conds = [`toDate(created_on) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        conds.push(`sales IS NOT NULL`);
        conds.push(`category IS NOT NULL`);
        const platformCond = buildPlatformChannelCond(catPlatform, channel, 'platform');
        if (platformCond) conds.push(platformCond);
        if (brandsFilter && brandsFilter.length > 0) {
            conds.push(`LOWER(group_brand) IN (${brandsFilter.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ')})`);
        }
        if (locationArr && locationArr.length > 0) {
            const locCond = buildLocationQueryCond(locationArr, catPlatform, 'location', 'platform');
            if (locCond) conds.push(locCond);
        }
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`LOWER(category) IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        return conds.join(' AND ');
    };

    // Get valid brand names for MS
    const validBrandNamesFromCache = await getCachedValidBrandNames();
    const validBrandNamesForCat = (brandArr && brandArr.length > 0) ? brandArr : validBrandNamesFromCache;

    const currSosConds = buildSosCatConds(startDate, endDate);
    const prevSosConds = buildSosCatConds(momStart, momEnd);

    // Optimized Brand In Clause - Fetch directly from rca_sku_dim first to avoid complex subqueries in SUM(if)
    let brandInClause = "('')";
    if (brandArr && brandArr.length > 0) {
        brandInClause = `(${brandArr.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ')})`;
    } else {
        const brandCol = await getRcaSkuDimBrandColumn();
        const ourBrandsRaw = await queryClickHouse(`SELECT DISTINCT lower(${brandCol}) as brand FROM rca_sku_dim WHERE toString(comp_flag) = '0' AND ${brandCol} IS NOT NULL`);
        if (ourBrandsRaw && ourBrandsRaw.length > 0) {
            brandInClause = `(${ourBrandsRaw.map(b => `'${escapeStr(b.brand)}'`).join(', ')})`;
        }
    }

    // ⚡ RUN ALL QUERIES IN PARALLEL
    const [
        distinctCategories,
        currCatData, prevCatData,
        currPmCatData, prevPmCatData,
        currMsData, prevMsData
    ] = await Promise.all([
        // Query 1: Distinct categories
        queryClickHouse(`
            SELECT DISTINCT ${src.isAgg ? 'category' : src.f.category} as category
            FROM ${src.table}
            WHERE ${buildCatConds(startDate, endDate)} AND ${src.isAgg ? 'category' : PRODUCT_CATEGORY_SQL} != 'Others'
        `),
        // Metrics
        queryClickHouse(`SELECT ${src.isAgg ? 'category' : PRODUCT_CATEGORY_SQL} as Category,
            SUM(ifNull(toFloat64OrZero(toString(${src.f.sales})), 0)) as total_sales,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.qty})), 0) ELSE 0 END) as total_qty,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.neno})), 0) ELSE 0 END) as total_neno,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.deno})), 0) ELSE 0 END) as total_deno,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.mrpVal})), 0) * ifNull(toFloat64OrZero(toString(${src.f.qty})), 0) ELSE 0 END) as my_mrp_val,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.actualSales})), 0) ELSE 0 END) as my_actual_sales,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 1` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.mrpVal})), 0) * ifNull(toFloat64OrZero(toString(${src.f.qty})), 0) ELSE 0 END) as comp_mrp_val,
            SUM(${src.f.actualSales}) as comp_actual_sales,
            SUM(${src.f.buyBoxNeno} * 1.0) as total_buy_box_neno,
            AVG(if(${src.f.deliveryDays} IS NOT NULL, toFloat64OrNull(toString(${src.f.deliveryDays})), NULL)) as avg_delivery_days,
            AVG(if(${src.f.compFlagMapping} = 0 AND ${src.f.sellingPriceRaw} > 0, ${src.f.sellingPriceRaw}, NULL)) as avg_asp,
            AVG(if(${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'}, ${src.f.listingPercent}, NULL)) as avg_listing_percent,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'} THEN ((${src.f.mrp} - ${src.f.sellingPrice}) / NULLIF(${src.f.mrp}, 0)) * ${src.f.sales} ELSE 0 END) / NULLIF(SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'} THEN ${src.f.sales} ELSE 0 END), 0) * 100 as my_wt_discount
        FROM ${src.table} WHERE ${buildCatConds(startDate, endDate)} GROUP BY Category`),
        queryClickHouse(`SELECT ${src.isAgg ? 'category' : PRODUCT_CATEGORY_SQL} as Category,
            SUM(ifNull(toFloat64OrZero(toString(${src.f.sales})), 0)) as total_sales,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.qty})), 0) ELSE 0 END) as total_qty,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.neno})), 0) ELSE 0 END) as total_neno,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.deno})), 0) ELSE 0 END) as total_deno,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.mrpVal})), 0) * ifNull(toFloat64OrZero(toString(${src.f.qty})), 0) ELSE 0 END) as my_mrp_val,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.actualSales})), 0) ELSE 0 END) as my_actual_sales,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 1` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.mrpVal})), 0) * ifNull(toFloat64OrZero(toString(${src.f.qty})), 0) ELSE 0 END) as comp_mrp_val,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 1` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.actualSales})), 0) ELSE 0 END) as comp_actual_sales,
            SUM(${src.f.buyBoxNeno} * 1.0) as total_buy_box_neno,
            AVG(if(${src.f.deliveryDays} IS NOT NULL, toFloat64OrNull(toString(${src.f.deliveryDays})), NULL)) as avg_delivery_days,
            AVG(if(${src.f.compFlagMapping} = 0 AND ${src.f.sellingPriceRaw} > 0, ${src.f.sellingPriceRaw}, NULL)) as avg_asp,
            AVG(if(${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'}, ${src.f.listingPercent}, NULL)) as avg_listing_percent,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'} THEN ((${src.f.mrp} - ${src.f.sellingPrice}) / NULLIF(${src.f.mrp}, 0)) * ${src.f.sales} ELSE 0 END) / NULLIF(SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlagMapping} = 0` : '1=1'} THEN ${src.f.sales} ELSE 0 END), 0) * 100 as my_wt_discount
        FROM ${src.table} WHERE ${buildCatConds(momStart, momEnd)} GROUP BY Category`),
        // Marketing Metrics from PM table
        queryClickHouse(`SELECT ${pmSrc.f.category} as Category,
            SUM(${pmSrc.f.spend}) as total_spend,
            SUM(${pmSrc.f.adSales}) as total_Ad_sales,
            SUM(${pmSrc.f.clicks}) as total_clicks,
            SUM(${pmSrc.f.impressions}) as total_impressions,
            SUM(${pmSrc.f.orders}) as total_orders
        FROM ${pmSrc.table} WHERE ${buildPmCatConds(startDate, endDate)} GROUP BY Category`),
        queryClickHouse(`SELECT ${pmSrc.f.category} as Category,
            SUM(${pmSrc.f.spend}) as total_spend,
            SUM(${pmSrc.f.adSales}) as total_Ad_sales,
            SUM(${pmSrc.f.clicks}) as total_clicks,
            SUM(${pmSrc.f.impressions}) as total_impressions,
            SUM(${pmSrc.f.orders}) as total_orders
        FROM ${pmSrc.table} WHERE ${buildPmCatConds(momStart, momEnd)} GROUP BY Category`),
        // COMBINED Market Share & Category Size Query
        queryClickHouse(`
            SELECT 
                category,
                SUM(if(lower(group_brand) IN ${brandInClause}, toFloat64OrZero(toString(sales)), 0)) AS our_sales,
                SUM(toFloat64OrZero(toString(sales))) AS total_sales,
                if(SUM(toFloat64OrZero(toString(sales))) > 0, 
                   (SUM(if(lower(group_brand) IN ${brandInClause}, toFloat64OrZero(toString(sales)), 0)) / SUM(toFloat64OrZero(toString(sales)))) * 100, 
                   0) AS market_share_percentage
            FROM rb_ms_olap
            WHERE ${buildMsCatConds(startDate, endDate, null)}
            GROUP BY category
            ORDER BY total_sales DESC
            LIMIT 100
        `),
        queryClickHouse(`
            SELECT 
                category,
                SUM(if(lower(group_brand) IN ${brandInClause}, toFloat64OrZero(toString(sales)), 0)) AS our_sales,
                SUM(toFloat64OrZero(toString(sales))) AS total_sales,
                if(SUM(toFloat64OrZero(toString(sales))) > 0, 
                   (SUM(if(lower(group_brand) IN ${brandInClause}, toFloat64OrZero(toString(sales)), 0)) / SUM(toFloat64OrZero(toString(sales)))) * 100, 
                   0) AS market_share_percentage
            FROM rb_ms_olap
            WHERE ${buildMsCatConds(momStart, momEnd, null)}
            GROUP BY category
            ORDER BY total_sales DESC
            LIMIT 100
        `)
    ]);

    // SOS Current - Simple sumIf(overall) / sum(overall) per category
    const currSosData = await queryClickHouse(`
        SELECT keyword_category, sumIf(toInt32(overall), ${sosCatNumCondition}) as num, sum(toInt32(overall)) as den
        FROM rb_kw_olap
        WHERE ${currSosConds}
        GROUP BY keyword_category
    `);
    const prevSosData = await queryClickHouse(`
        SELECT keyword_category, sumIf(toInt32(overall), ${sosCatNumCondition}) as num, sum(toInt32(overall)) as den
        FROM rb_kw_olap
        WHERE ${prevSosConds}
        GROUP BY keyword_category
    `);
    // Spons SOS (Ad SOV) Current - sumIf(spons) per category
    const currAdSovData = await queryClickHouse(`
        SELECT keyword_category, sumIf(toInt32(spons), ${sosCatNumCondition}) as num, sum(toInt32(spons)) as den
        FROM rb_kw_olap
        WHERE ${currSosConds}
        GROUP BY keyword_category
    `);
    const prevAdSovData = await queryClickHouse(`
        SELECT keyword_category, sumIf(toInt32(spons), ${sosCatNumCondition}) as num, sum(toInt32(spons)) as den
        FROM rb_kw_olap
        WHERE ${prevSosConds}
        GROUP BY keyword_category
    `);

    // Organic SOS Current - sumIf(organic) per category
    const currOrgSovData = await queryClickHouse(`
        SELECT keyword_category, sumIf(toInt32(organic), ${sosCatNumCondition}) as num, sum(toInt32(organic)) as den
        FROM rb_kw_olap
        WHERE ${currSosConds}
        GROUP BY keyword_category
    `);
    const prevOrgSovData = await queryClickHouse(`
        SELECT keyword_category, sumIf(toInt32(organic), ${sosCatNumCondition}) as num, sum(toInt32(organic)) as den
        FROM rb_kw_olap
        WHERE ${prevSosConds}
        GROUP BY keyword_category
    `);

    const categories = distinctCategories.map(c => c.category).filter(Boolean);

    // Build maps for efficient lookup
    const buildMap = (data, keyField, valField) => new Map(data.map(r => [r[keyField] != null ? String(r[keyField]).toLowerCase() : '', r[valField]]));
    const currCatMap = new Map(currCatData.map(d => [d.Category != null ? String(d.Category).toLowerCase() : '', d]));
    const prevCatMap = new Map(prevCatData.map(d => [d.Category != null ? String(d.Category).toLowerCase() : '', d]));
    const currPmCatMap = new Map(currPmCatData.map(d => [d.Category != null ? String(d.Category).toLowerCase() : '', d]));
    const prevPmCatMap = new Map(prevPmCatData.map(d => [d.Category != null ? String(d.Category).toLowerCase() : '', d]));


    const buildSosMap = (data) => new Map(data.map(r => [r.keyword_category != null ? String(r.keyword_category).toLowerCase() : '', { num: parseInt(r.num || 0), den: parseInt(r.den || 0) }]));

    const currSosMap = buildSosMap(currSosData);
    const prevSosMap = buildSosMap(prevSosData);

    // Ad SOV and Organic SOV maps
    const currAdSovMap = buildSosMap(currAdSovData);
    const prevAdSovMap = buildSosMap(prevAdSovData);
    const currOrgSovMap = buildSosMap(currOrgSovData);
    const prevOrgSovMap = buildSosMap(prevOrgSovData);

    const currMsMap = buildMap(currMsData, 'category', 'market_share_percentage');
    const prevMsMap = buildMap(prevMsData, 'category', 'market_share_percentage');
    const currCatSizeCatMap = buildMap(currMsData, 'category', 'total_sales');
    const prevCatSizeCatMap = buildMap(prevMsData, 'category', 'total_sales');

    // Calculate total Category Size across all computed categories to use as denominator for percentage
    const totalCurrCatSize = currMsData.reduce((sum, row) => sum + parseFloat(row.total_sales || 0), 0);
    const totalPrevCatSize = prevMsData.reduce((sum, row) => sum + parseFloat(row.total_sales || 0), 0);

    // Fetch Bulk PM Conversion Maps by Category
    const [currPmConvMap, prevPmConvMap] = await Promise.all([
        getPmConversionBulk(startDate, endDate, catPlatform === 'All' ? null : catPlatform, locationArr, categoryArr, brandArr, channel, 'lower(category)'),
        getPmConversionBulk(momStart, momEnd, catPlatform === 'All' ? null : catPlatform, locationArr, categoryArr, brandArr, channel, 'lower(category)')
    ]);

    const categoryOverviewPromises = categories.map(async (catName) => {
        const catKey = catName?.toLowerCase();
        let currRaw = currCatMap.get(catKey) || {};
        let prevRaw = prevCatMap.get(catKey) || {};
        let currPmRaw = currPmCatMap.get(catKey) || {};
        let prevPmRaw = prevPmCatMap.get(catKey) || {};

        const hasPdp = currCatMap.has(catKey);
        const hasPm = currPmCatMap.has(catKey);
        const hasMsCheck = currMsMap.has(catKey);
        const hasSosCheck = currSosMap.has(catKey) || currAdSovMap.has(catKey) || currOrgSovMap.has(catKey);

        const prevHasPdp = prevCatMap.has(catKey);
        const prevHasPm = prevPmCatMap.has(catKey);
        const prevHasMsCheck = prevMsMap.has(catKey);
        const prevHasSosCheck = prevSosMap.has(catKey) || prevAdSovMap.has(catKey) || prevOrgSovMap.has(catKey);


        // Scale Mars metrics
        const curr = scaleMarsMetrics(currRaw, catName);
        const prev = scaleMarsMetrics(prevRaw, catName);

        const offtake = hasPdp ? parseFloat(curr.total_sales || 0) : null;
        const offtakeUnits = hasPdp ? parseFloat(curr.total_qty || 0) : null;
        const spend = hasPm ? parseFloat(currPmRaw.total_spend || 0) : null;
        const adSales = hasPm ? parseFloat(currPmRaw.total_Ad_sales || 0) : null;
        const clicks = hasPm ? parseFloat(currPmRaw.total_clicks || 0) : null;
        const impressions = hasPm ? parseFloat(currPmRaw.total_impressions || 0) : null;
        const orders = hasPm ? parseFloat(currPmRaw.total_orders || 0) : null;

        const availability = hasPdp ? (curr.total_deno > 0 ? (curr.total_neno / curr.total_deno) * 100 : null) : null;
        const listingPercent = hasPdp ? parseFloat(curr.avg_listing_percent || 0) : null;
        const wtOsa = (availability !== null && listingPercent !== null) ? (availability * listingPercent) / 100 : null;
        // Buy Box %: ((SUM(buy_box_neno_osa)*1.0) / SUM(deno_osa)) * 100
        const buyBoxPct = hasPdp ? (parseFloat(curr.total_deno || 0) > 0 ? (parseFloat(curr.total_buy_box_neno || 0) * 1.0 / parseFloat(curr.total_deno)) * 100 : null) : null;
        const deliveryTime = hasPdp ? (parseFloat(curr.avg_delivery_days || null)) : null;
        const roas = hasPm ? (spend > 0 ? adSales / spend : null) : null;
        const conversion = hasPm ? (currPmConvMap.get(catKey) || null) : null;
        const cpm = hasPm ? (impressions > 0 ? (spend / impressions) * 1000 : null) : null;
        const cpc = hasPm ? (clicks > 0 ? spend / clicks : null) : null;
        const asp = hasPdp ? parseFloat(curr.avg_asp || 0) : null;
        const aov = (hasPm && orders > 0) ? adSales / orders : null;

        const sosDataObj = currSosMap.get(catKey) || { num: 0, den: 0 };
        const sos = hasSosCheck ? (sosDataObj.den > 0 ? (sosDataObj.num / sosDataObj.den) * 100 : null) : null;

        // Market Share via rb_ms_olap results (respected platform filter)
        const marketShare = (hasMsCheck && !hasTier23) ? (currMsMap.get(catKey) || null) : null;

        // Previous
        const prevOfftake = prevHasPdp ? parseFloat(prev.total_sales || 0) : null;
        const prevOfftakeUnits = prevHasPdp ? parseFloat(prev.total_qty || 0) : null;
        const prevSpend = prevHasPm ? parseFloat(prevPmRaw.total_spend || 0) : null;
        const prevAdSales = prevHasPm ? parseFloat(prevPmRaw.total_Ad_sales || 0) : null;
        const prevOrders = prevHasPm ? parseFloat(prevPmRaw.total_orders || 0) : null;
        const prevClicks = prevHasPm ? parseFloat(prevPmRaw.total_clicks || 0) : null;
        const prevImpressions = prevHasPm ? parseFloat(prevPmRaw.total_impressions || 0) : null;

        const prevAvailability = prevHasPdp ? (prev.total_deno > 0 ? (prev.total_neno / prev.total_deno) * 100 : null) : null;
        const prevListingPercent = prevHasPdp ? parseFloat(prev.avg_listing_percent || 0) : null;
        const prevWtOsa = (prevAvailability !== null && prevListingPercent !== null) ? (prevAvailability * prevListingPercent) / 100 : null;
        const prevBuyBoxPct = prevHasPdp ? (parseFloat(prev.total_deno || 0) > 0 ? (parseFloat(prev.total_buy_box_neno || 0) * 1.0 / parseFloat(prev.total_deno)) * 100 : null) : null;
        const prevDeliveryTime = prevHasPdp ? (parseFloat(prev.avg_delivery_days || null)) : null;
        const prevRoas = prevHasPm ? (prevSpend > 0 ? prevAdSales / prevSpend : null) : null;
        const prevConversion = prevHasPm ? (prevPmConvMap.get(catKey) || null) : null;
        const prevCpm = prevHasPm ? (prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : null) : null;
        const prevCpc = prevHasPm ? (prevClicks > 0 ? prevSpend / prevClicks : null) : null;
        const prevAsp = prevHasPdp ? parseFloat(prev.avg_asp || 0) : null;
        const prevAov = (prevHasPm && prevOrders > 0) ? prevAdSales / prevOrders : null;

        const prevSosDataObj = prevSosMap.get(catKey) || { num: 0, den: 0 };
        const prevSos = prevHasSosCheck ? (prevSosDataObj.den > 0 ? (prevSosDataObj.num / prevSosDataObj.den) * 100 : null) : null;
        const prevMarketShare = (prevHasMsCheck && !hasTier23) ? (prevMsMap.get(catKey) || null) : null;

        const promoMyBrand = hasPdp ? (parseFloat(curr.my_mrp_val || 0) > 0
            ? ((parseFloat(curr.my_mrp_val) - parseFloat(curr.my_actual_sales)) / parseFloat(curr.my_mrp_val)) * 100
            : null) : null;
        const promoCompete = hasPdp ? (parseFloat(curr.comp_mrp_val || 0) > 0
            ? ((parseFloat(curr.comp_mrp_val) - parseFloat(curr.comp_actual_sales)) / parseFloat(curr.comp_mrp_val)) * 100
            : null) : null;
        const wtDiscount = hasPdp ? parseFloat(curr.my_wt_discount || 0) : null;
        const prevPromoMyBrand = prevHasPdp ? (parseFloat(prev.my_mrp_val || 0) > 0
            ? ((parseFloat(prev.my_mrp_val) - parseFloat(prev.my_actual_sales)) / parseFloat(prev.my_mrp_val)) * 100
            : null) : null;
        const prevPromoCompete = prevHasPdp ? (parseFloat(prev.comp_mrp_val || 0) > 0
            ? ((parseFloat(prev.comp_mrp_val) - parseFloat(prev.comp_actual_sales)) / parseFloat(prev.comp_mrp_val)) * 100
            : null) : null;
        const prevWtDiscount = prevHasPdp ? parseFloat(prev.my_wt_discount || 0) : null;

        // Ad SOV (spons_flag=1)
        const adSovDataObj = currAdSovMap.get(catKey) || { num: 0, den: 0 };
        const adSov = hasSosCheck ? (adSovDataObj.den > 0 ? (adSovDataObj.num / adSovDataObj.den) * 100 : null) : null;
        const prevAdSovDataObj = prevAdSovMap.get(catKey) || { num: 0, den: 0 };
        const prevAdSov = prevHasSosCheck ? (prevAdSovDataObj.den > 0 ? (prevAdSovDataObj.num / prevAdSovDataObj.den) * 100 : null) : null;

        // Organic SOV (spons_flag=0)
        const orgSovDataObj = currOrgSovMap.get(catKey) || { num: 0, den: 0 };
        const organicSov = hasSosCheck ? (orgSovDataObj.den > 0 ? (orgSovDataObj.num / orgSovDataObj.den) * 100 : null) : null;
        const prevOrgSovDataObj = prevOrgSovMap.get(catKey) || { num: 0, den: 0 };
        const prevOrganicSov = prevHasSosCheck ? (prevOrgSovDataObj.den > 0 ? (prevOrgSovDataObj.num / prevOrgSovDataObj.den) * 100 : null) : null;

        const currCatSizeAbsolute = hasMsCheck ? (currCatSizeCatMap.get(catKey) || null) : null;
        const prevCatSizeAbsolute = prevHasMsCheck ? (prevCatSizeCatMap.get(catKey) || null) : null;

        return {
            key: catName,
            label: catName,
            type: catName,
            logo: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png",
            columns: generateKpiColumns({
                offtake, availability, wtOsa, listingPercent, sos, marketShare, spend, roas, inorgSales: adSales, conversion, cpm, cpc, asp, aov, promoMyBrand, promoCompete, wtDiscount, categorySize: currCatSizeAbsolute, adSov, organicSov, buyBoxPct, deliveryTime,
                prevOfftake, prevAvailability, prevWtOsa, prevListingPercent, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales: prevAdSales, prevConversion, prevCpm, prevCpc, prevAsp, prevAov, prevPromoMyBrand, prevPromoCompete, prevWtDiscount, prevCategorySize: prevCatSizeAbsolute, prevAdSov, prevOrganicSov, prevBuyBoxPct, prevDeliveryTime,
                offtakeUnits, inorgUnits: orders, prevOfftakeUnits, prevInorgUnits: prevOrders
            })

        };
    });

    const categoryOverview = await Promise.all(categoryOverviewPromises);

    console.log(`[getCategoryOverview] OPTIMIZED: Returning ${categoryOverview.length} categories`);
    return categoryOverview;
};

/**
 * Get Brands Overview Data - OPTIMIZED
 * Requires brandsOverviewPlatform and brandsOverviewCategory parameters
 * NOTE: Computes ONLY brands data
 */
const getBrandsOverview = async (filters) => {
    console.log('[getBrandsOverview] Computing OPTIMIZED brands overview data...');

    const { months = 1, startDate: qStartDate, endDate: qEndDate, brandsOverviewPlatform, brandsOverviewCategory } = filters;
    const channel = extractChannel(filters);

    // Extract filter values - frontend may send as 'brand' or 'brand[]' (array format)
    const rawBrand = filters['brand[]'] || filters.brand;
    const rawLocation = filters['location[]'] || filters.location;

    // Normalize multi-value filters
    const brandArr = normalizeFilterArray(rawBrand)?.map(b => b.toLowerCase());
    const locationArr = normalizeFilterArray(rawLocation);
    const brand = brandArr ? (brandArr.length === 1 ? brandArr[0] : brandArr) : null;
    const location = locationArr ? (locationArr.length === 1 ? locationArr[0] : locationArr) : null;
    // Check if any selected location is NOT one of the 11 Tier-1 cities (case-insensitive)
    const tier1Cities = [
        'kolkata', 'mumbai', 'pune', 'chennai', 'delhi', 'lucknow',
        'gurugram', 'chandigarh', 'hyderabad', 'faridabad', 'bengaluru'
    ];
    let hasTier23 = false;
    if (locationArr && locationArr.length > 0) {
        hasTier23 = locationArr.some(loc => {
            const lowerLoc = String(loc).trim().toLowerCase();
            if (lowerLoc === 'all' || lowerLoc === '' || lowerLoc === 'all india') return false;
            return !tier1Cities.includes(lowerLoc);
        });
    }
    const monthsBack = parseInt(months, 10) || 1;
    const boPlatform = brandsOverviewPlatform || filters.platform || 'All';
    const boCategory = brandsOverviewCategory || filters.category || 'All';

    // Calculate date range
    let endDate = await getCachedMaxDate();
    let startDate = endDate.subtract(monthsBack, 'month').startOf('day');
    if (qStartDate && qEndDate) {
        startDate = dayjs(qStartDate).startOf('day');
        endDate = dayjs(qEndDate).endOf('day');
    }

    // Comparison period logic (MoM / same duration)
    const durationDays = endDate.diff(startDate, 'day');
    const momEnd = startDate.clone().subtract(1, 'day').endOf('day');
    const momStart = momEnd.clone().subtract(durationDays, 'day').startOf('day');

    // Get the optimized data source
    const src = await getWatchtowerSource(filters);
    const pmSrc = await getPmSource();


    // Helper to escape strings for ClickHouse
    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

    // Build brand conditions for rb_pdp_olap
    const buildBrandConds = (sDate, eDate) => {
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const conds = [`${dateCol} BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];

        const platformCol = src.isAgg ? 'platform' : 'Platform';
        const platformCond = buildPlatformChannelCond(boPlatform, channel, platformCol, false, src.f.channel);
        if (platformCond) conds.push(platformCond);

        const catCol = src.isAgg ? 'category' : PRODUCT_CATEGORY_SQL;
        const categoryArr = normalizeFilterArray(boCategory);
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`${catCol} IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }

        const locCol = src.isAgg ? 'location' : 'Location';
        if (locationArr && locationArr.length > 0) {
            const platformCol = src.isAgg ? 'platform' : 'Platform';
            const locCond = buildLocationQueryCond(locationArr, boPlatform, locCol, platformCol);
            if (locCond) conds.push(locCond);
        }

        // Advanced SKU Search Filters (Only supported on raw table)
        if (!src.isAgg) {
            const skuArr = normalizeFilterArray(filters.skuName);
            if (skuArr && skuArr.length > 0) {
                const skuConds = skuArr.map(s => `Product LIKE '%${escapeStr(s)}%'`).join(' OR ');
                conds.push(`(${skuConds})`);
            }
            const skuCodeArr = normalizeFilterArray(filters.skuCode);
            if (skuCodeArr && skuCodeArr.length > 0) {
                const skuCodeConds = skuCodeArr.map(s => `toString(Web_Pid) LIKE '%${escapeStr(s)}%'`).join(' OR ');
                conds.push(`(${skuCodeConds})`);
            }
            const mslArr = normalizeFilterArray(filters.msl);
            if (mslArr && mslArr.length > 0) {
                const mslConds = mslArr.map(m => `toString(${src.f.msl}) = '${escapeStr(m)}'`).join(' OR ');
                conds.push(`(${mslConds})`);
            }
        }

        return conds.join(' AND ');
    };

    // Build PM conditions for rb_pm_olap
    const buildPmBrandConds = (sDate, eDate) => {
        const conds = [`${pmSrc.f.date} BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        const platformCond = buildPlatformChannelCond(boPlatform, channel, pmSrc.f.platform, false, pmSrc.f.channel);
        if (platformCond) conds.push(platformCond);
        const categoryArr = normalizeFilterArray(boCategory);
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`lower(${pmSrc.f.category}) IN (${categoryArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
        }
        if (pmSrc.f.location && pmSrc.f.location !== "'Unknown'" && locationArr && locationArr.length > 0) {
            const locCond = buildLocationQueryCond(locationArr, boPlatform, pmSrc.f.location, pmSrc.f.platform);
            if (locCond) conds.push(locCond);
        }
        return conds.join(' AND ');
    };


    // Build SOS conditions for rb_kw_olap
    const buildSosBrandConds = (sDate, eDate) => {
        const conds = [`toDate(DATE) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        // Only consider top 10 ranked positions for SOS
        conds.push(`POSITION <= 10`);
        const platformArr = normalizeFilterArray(boPlatform);
        const pCond = buildPlatformChannelCond(boPlatform, channel, 'platform_name');
        if (pCond) conds.push(pCond);
        const categoryArr = normalizeFilterArray(boCategory);
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`keyword_category IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        const locArr = normalizeFilterArray(location);
        if (locArr && locArr.length > 0) {
            const locCond = buildLocationQueryCond(locArr, boPlatform, 'location_name', 'platform_name');
            if (locCond) conds.push(locCond);
        }
        return conds.join(' AND ');
    };

    // Build MS conditions for rb_brand_ms
    const buildMsBrandConds = (sDate, eDate, brandsFilter = null) => {
        const conds = [`toDate(created_on) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        conds.push(`sales IS NOT NULL`);
        const platformArr = normalizeFilterArray(boPlatform);
        const platformCond = buildPlatformChannelCond(boPlatform, channel, 'platform');
        if (platformCond) conds.push(platformCond);
        const categoryArr = normalizeFilterArray(boCategory);
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`category IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        if (brandsFilter && brandsFilter.length > 0) {
            conds.push(`group_brand IN (${brandsFilter.map(b => `'${escapeStr(b)}'`).join(', ')})`);
        }
        const locArr = normalizeFilterArray(location);
        if (locArr && locArr.length > 0) {
            const locCond = buildLocationQueryCond(locArr, boPlatform, 'location', 'platform');
            if (locCond) conds.push(locCond);
        }
        return conds.join(' AND ');
    };
    // Get valid brand names for MS
    const validBrandNames = await getCachedValidBrandNames();

    const currSosConds = buildSosBrandConds(startDate, endDate);
    const prevSosConds = buildSosBrandConds(momStart, momEnd);

    // ⚡ RUN ALL QUERIES IN PARALLEL
    const [
        distinctBrands,
        currBrandData, prevBrandData,
        currPmBrandData, prevPmBrandData,
        currMsNum, currMsDenom, prevMsNum, prevMsDenom,
        currCatSizeTotal, prevCatSizeTotal
    ] = await Promise.all([
        // Query 1: Distinct brands (Our Brands Only)
        queryClickHouse(`
            SELECT DISTINCT ${src.f.brand} as brand FROM ${src.table}
            WHERE ${buildBrandConds(startDate, endDate)} AND ${src.f.compFlag} = 0
            ORDER BY brand
        `),
        // Metrics
        queryClickHouse(`SELECT ${src.f.brand} as Brand,
            SUM(ifNull(toFloat64OrZero(toString(${src.f.sales})), 0)) as total_sales,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.qty})), 0) ELSE 0 END) as total_qty,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.neno})), 0) ELSE 0 END) as total_neno,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.deno})), 0) ELSE 0 END) as total_deno,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.mrpVal})), 0) * ifNull(toFloat64OrZero(toString(${src.f.qty})), 0) ELSE 0 END) as my_mrp_val,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.actualSales})), 0) ELSE 0 END) as my_actual_sales,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 1` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.mrpVal})), 0) * ifNull(toFloat64OrZero(toString(${src.f.qty})), 0) ELSE 0 END) as comp_mrp_val,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 1` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.actualSales})), 0) ELSE 0 END) as comp_actual_sales,
            SUM(${src.f.buyBoxNeno} * 1.0) as total_buy_box_neno,
            AVG(if(${src.f.deliveryDays} IS NOT NULL, toFloat64OrNull(toString(${src.f.deliveryDays})), NULL)) as avg_delivery_days,
            AVG(if(${src.f.compFlag} = 0 AND ${src.f.sellingPriceRaw} > 0, ${src.f.sellingPriceRaw}, NULL)) as avg_asp,
            AVG(if(${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'}, ${src.f.listingPercent}, NULL)) as avg_listing_percent,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ((${src.f.mrp} - ${src.f.sellingPrice}) / NULLIF(${src.f.mrp}, 0)) * ${src.f.sales} ELSE 0 END) / NULLIF(SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ${src.f.sales} ELSE 0 END), 0) * 100 as my_wt_discount
        FROM ${src.table} WHERE ${buildBrandConds(startDate, endDate)} AND ${src.f.compFlag} = 0 GROUP BY Brand`),
        queryClickHouse(`SELECT ${src.f.brand} as Brand,
            SUM(ifNull(toFloat64OrZero(toString(${src.f.sales})), 0)) as total_sales,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.qty})), 0) ELSE 0 END) as total_qty,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.neno})), 0) ELSE 0 END) as total_neno,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.deno})), 0) ELSE 0 END) as total_deno,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.mrpVal})), 0) * ifNull(toFloat64OrZero(toString(${src.f.qty})), 0) ELSE 0 END) as my_mrp_val,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.actualSales})), 0) ELSE 0 END) as my_actual_sales,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 1` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.mrpVal})), 0) * ifNull(toFloat64OrZero(toString(${src.f.qty})), 0) ELSE 0 END) as comp_mrp_val,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 1` : '1=1'} THEN ifNull(toFloat64OrZero(toString(${src.f.actualSales})), 0) ELSE 0 END) as comp_actual_sales,
            SUM(${src.f.buyBoxNeno} * 1.0) as total_buy_box_neno,
            AVG(if(${src.f.deliveryDays} IS NOT NULL, toFloat64OrNull(toString(${src.f.deliveryDays})), NULL)) as avg_delivery_days,
            AVG(if(${src.f.compFlag} = 0 AND ${src.f.sellingPriceRaw} > 0, ${src.f.sellingPriceRaw}, NULL)) as avg_asp,
            AVG(if(${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'}, ${src.f.listingPercent}, NULL)) as avg_listing_percent,
            SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ((${src.f.mrp} - ${src.f.sellingPrice}) / NULLIF(${src.f.mrp}, 0)) * ${src.f.sales} ELSE 0 END) / NULLIF(SUM(CASE WHEN ${brandArr && brandArr.length > 0 ? `${src.f.compFlag} = 0` : '1=1'} THEN ${src.f.sales} ELSE 0 END), 0) * 100 as my_wt_discount
        FROM ${src.table} WHERE ${buildBrandConds(momStart, momEnd)} AND ${src.f.compFlag} = 0 GROUP BY Brand`),
        // Marketing Metrics from PM table
        queryClickHouse(`SELECT ${pmSrc.f.brand} as Brand,
            SUM(${pmSrc.f.spend}) as total_spend,
            SUM(${pmSrc.f.adSales}) as total_Ad_sales,
            SUM(${pmSrc.f.clicks}) as total_clicks,
            SUM(${pmSrc.f.impressions}) as total_impressions,
            SUM(${pmSrc.f.orders}) as total_orders
        FROM ${pmSrc.table} WHERE ${buildPmBrandConds(startDate, endDate)} GROUP BY Brand`),
        queryClickHouse(`SELECT ${pmSrc.f.brand} as Brand,
            SUM(${pmSrc.f.spend}) as total_spend,
            SUM(${pmSrc.f.adSales}) as total_Ad_sales,
            SUM(${pmSrc.f.clicks}) as total_clicks,
            SUM(${pmSrc.f.impressions}) as total_impressions,
            SUM(${pmSrc.f.orders}) as total_orders
        FROM ${pmSrc.table} WHERE ${buildPmBrandConds(momStart, momEnd)} GROUP BY Brand`),
        // Market Share
        queryClickHouse(`SELECT group_brand as brand, SUM(toFloat64OrZero(toString(sales))) as our_sales FROM rb_ms_olap WHERE ${buildMsBrandConds(startDate, endDate, validBrandNames)} GROUP BY group_brand`),
        queryClickHouse(`SELECT group_brand as brand, SUM(toFloat64OrZero(toString(sales))) as total_sales FROM rb_ms_olap WHERE ${buildMsBrandConds(startDate, endDate, null)} GROUP BY group_brand`),
        queryClickHouse(`SELECT group_brand as brand, SUM(toFloat64OrZero(toString(sales))) as our_sales FROM rb_ms_olap WHERE ${buildMsBrandConds(momStart, momEnd, validBrandNames)} GROUP BY group_brand`),
        queryClickHouse(`SELECT group_brand as brand, SUM(toFloat64OrZero(toString(sales))) as total_sales FROM rb_ms_olap WHERE ${buildMsBrandConds(momStart, momEnd, null)} GROUP BY group_brand`),
        // Category Size
        queryClickHouse(`
                    SELECT SUM(toFloat64OrZero(toString(sales))) as cat_size
                    FROM rb_ms_olap
                    WHERE ${buildMsBrandConds(startDate, endDate, null)}
                `),
        queryClickHouse(`
                    SELECT SUM(toFloat64OrZero(toString(sales))) as cat_size
                    FROM rb_ms_olap
                    WHERE ${buildMsBrandConds(momStart, momEnd, null)}
                `)
    ]);

    // SOS Fix: Denominator must be total across ALL rows (not grouped by brand)
    // Numerator is per-brand (flag='1' = our brand rows)

    // Denominators: total sums across all rows for selected filters (no GROUP BY brand)
    const [currDenomData, prevDenomData] = await Promise.all([
        queryClickHouse(`
            SELECT sum(toInt32(overall)) as total_overall, sum(toInt32(spons)) as total_spons, sum(toInt32(organic)) as total_organic
            FROM rb_kw_olap
            WHERE ${currSosConds}
        `),
        queryClickHouse(`
            SELECT sum(toInt32(overall)) as total_overall, sum(toInt32(spons)) as total_spons, sum(toInt32(organic)) as total_organic
            FROM rb_kw_olap
            WHERE ${prevSosConds}
        `)
    ]);

    const currTotalOverall = parseInt(currDenomData[0]?.total_overall || 0);
    const currTotalSpons = parseInt(currDenomData[0]?.total_spons || 0);
    const currTotalOrganic = parseInt(currDenomData[0]?.total_organic || 0);
    const prevTotalOverall = parseInt(prevDenomData[0]?.total_overall || 0);
    const prevTotalSpons = parseInt(prevDenomData[0]?.total_spons || 0);
    const prevTotalOrganic = parseInt(prevDenomData[0]?.total_organic || 0);

    // Numerators: per-brand sums where flag='1' (our brand)
    const [currSosData, prevSosData, currAdSovData, prevAdSovData, currOrgSovData, prevOrgSovData] = await Promise.all([
        // Overall SOS per brand
        queryClickHouse(`
            SELECT brand as brand_name, sum(toInt32(overall)) as num
            FROM rb_kw_olap
            WHERE ${currSosConds} AND toString(flag) = '1'
            GROUP BY brand
        `),
        queryClickHouse(`
            SELECT brand as brand_name, sum(toInt32(overall)) as num
            FROM rb_kw_olap
            WHERE ${prevSosConds} AND toString(flag) = '1'
            GROUP BY brand
        `),
        // Spons SOS (Ad SOV) per brand
        queryClickHouse(`
            SELECT brand as brand_name, sum(toInt32(spons)) as num
            FROM rb_kw_olap
            WHERE ${currSosConds} AND toString(flag) = '1'
            GROUP BY brand
        `),
        queryClickHouse(`
            SELECT brand as brand_name, sum(toInt32(spons)) as num
            FROM rb_kw_olap
            WHERE ${prevSosConds} AND toString(flag) = '1'
            GROUP BY brand
        `),
        // Organic SOS per brand
        queryClickHouse(`
            SELECT brand as brand_name, sum(toInt32(organic)) as num
            FROM rb_kw_olap
            WHERE ${currSosConds} AND toString(flag) = '1'
            GROUP BY brand
        `),
        queryClickHouse(`
            SELECT brand as brand_name, sum(toInt32(organic)) as num
            FROM rb_kw_olap
            WHERE ${prevSosConds} AND toString(flag) = '1'
            GROUP BY brand
        `)
    ]);

    const brands = distinctBrands.map(d => d.brand).filter(Boolean);
    const currBrandCatSize = parseFloat(currCatSizeTotal[0]?.cat_size || 0);
    const prevBrandCatSize = parseFloat(prevCatSizeTotal[0]?.cat_size || 0);

    // Fetch brand images from rb_brands table (ClickHouse)
    let brandImageMap = new Map();
    try {
        const brandImages = await queryClickHouse(
            `SELECT brand_name, brand_description FROM rb_brands WHERE status = 1`
        );
        brandImages.forEach(b => {
            if (b.brand_name && b.brand_description) {
                brandImageMap.set(b.brand_name.toLowerCase(), b.brand_description);
            }
        });
        console.log(`[getBrandsOverview] Fetched ${brandImageMap.size} brand images from rb_brands`);
    } catch (err) {
        console.warn('[getBrandsOverview] Could not fetch brand images from rb_brands:', err.message);
    }

    const buildMap = (data, keyField, valField) => new Map(data.map(r => [r[keyField] != null ? String(r[keyField]).toLowerCase() : '', r[valField]]));
    const currBrandMap = new Map(currBrandData.map(d => [d.Brand != null ? String(d.Brand).toLowerCase() : '', d]));
    const prevBrandMap = new Map(prevBrandData.map(d => [d.Brand != null ? String(d.Brand).toLowerCase() : '', d]));
    const currPmBrandMap = new Map(currPmBrandData.map(d => [d.Brand != null ? String(d.Brand).toLowerCase() : '', d]));
    const prevPmBrandMap = new Map(prevPmBrandData.map(d => [d.Brand != null ? String(d.Brand).toLowerCase() : '', d]));

    const buildSosNumMap = (data) => new Map(data.map(r => [r.brand_name != null ? String(r.brand_name).toLowerCase() : '', parseInt(r.num || 0)]));

    const currSosMap = buildSosNumMap(currSosData);
    const prevSosMap = buildSosNumMap(prevSosData);

    // Ad SOV and Organic SOV maps
    const currAdSovMap = buildSosNumMap(currAdSovData);
    const prevAdSovMap = buildSosNumMap(prevAdSovData);
    const currOrgSovMap = buildSosNumMap(currOrgSovData);
    const prevOrgSovMap = buildSosNumMap(prevOrgSovData);

    // Build Market Share maps (Brand MS = Brand Sales / Total Cat Sales)
    const currCatTotalSales = parseFloat(currCatSizeTotal[0]?.cat_size || 0);
    const prevCatTotalSales = parseFloat(prevCatSizeTotal[0]?.cat_size || 0);

    const currMsMap = new Map(currMsDenom.map(r => [
        String(r.brand || '').toLowerCase(),
        currCatTotalSales > 0 ? (parseFloat(r.total_sales || 0) / currCatTotalSales) * 100 : null
    ]));
    const prevMsMap = new Map(prevMsDenom.map(r => [
        String(r.brand || '').toLowerCase(),
        prevCatTotalSales > 0 ? (parseFloat(r.total_sales || 0) / prevCatTotalSales) * 100 : null
    ]));


    const brandsOverview = brands.map(brandName => {
        const brandKey = brandName.toLowerCase();
        let currRaw = currBrandMap.get(brandKey) || {};
        let prevRaw = prevBrandMap.get(brandKey) || {};
        let currPmRaw = currPmBrandMap.get(brandKey) || {};
        let prevPmRaw = prevPmBrandMap.get(brandKey) || {};

        const hasPdp = currBrandMap.has(brandKey);
        const hasPm = currPmBrandMap.has(brandKey);
        const hasMsCheck = currMsMap.has(brandKey);
        const hasSosCheck = currSosMap.has(brandKey) || currAdSovMap.has(brandKey) || currOrgSovMap.has(brandKey);

        const prevHasPdp = prevBrandMap.has(brandKey);
        const prevHasPm = prevPmBrandMap.has(brandKey);
        const prevHasMsCheck = prevMsMap.has(brandKey);
        const prevHasSosCheck = prevSosMap.has(brandKey) || prevAdSovMap.has(brandKey) || prevOrgSovMap.has(brandKey);

        // Scale Mars metrics
        const curr = scaleMarsMetrics(currRaw, brandName);
        const prev = scaleMarsMetrics(prevRaw, brandName);

        const offtake = hasPdp ? parseFloat(curr.total_sales || 0) : null;
        const offtakeUnits = hasPdp ? parseFloat(curr.total_qty || 0) : null;
        const spend = hasPm ? parseFloat(currPmRaw.total_spend || 0) : null;
        const adSales = hasPm ? parseFloat(currPmRaw.total_Ad_sales || 0) : null;
        const orders = hasPm ? parseFloat(currPmRaw.total_orders || 0) : null;
        const clicks = hasPm ? parseFloat(currPmRaw.total_clicks || 0) : null;
        const impressions = hasPm ? parseFloat(currPmRaw.total_impressions || 0) : null;
        const availability = hasPdp ? (curr.total_deno > 0 ? (curr.total_neno / curr.total_deno) * 100 : null) : null;
        const listingPercent = hasPdp ? parseFloat(curr.avg_listing_percent || 0) : null;
        const wtOsa = (availability !== null && listingPercent !== null) ? (availability * listingPercent) / 100 : null;
        // Buy Box %: ((SUM(buy_box_neno_osa)*1.0) / SUM(deno_osa)) * 100
        const buyBoxPct = hasPdp ? (parseFloat(curr.total_deno || 0) > 0 ? (parseFloat(curr.total_buy_box_neno || 0) * 1.0 / parseFloat(curr.total_deno)) * 100 : null) : null;
        const deliveryTime = hasPdp ? (parseFloat(curr.avg_delivery_days || null)) : null;
        const roas = hasPm ? (spend > 0 ? adSales / spend : null) : null;
        const conversion = hasPm ? (clicks > 0 ? (orders / clicks) * 100 : null) : null;
        const cpm = hasPm ? (impressions > 0 ? (spend / impressions) * 1000 : null) : null;
        const cpc = hasPm ? (clicks > 0 ? spend / clicks : null) : null;
        const asp = hasPdp ? parseFloat(curr.avg_asp || 0) : null;
        const aov = (hasPm && orders > 0) ? adSales / orders : null;

        const promoMyBrand = hasPdp ? (parseFloat(curr.my_mrp_val || 0) > 0
            ? ((parseFloat(curr.my_mrp_val) - parseFloat(curr.my_actual_sales)) / parseFloat(curr.my_mrp_val)) * 100
            : null) : null;
        const promoCompete = hasPdp ? (parseFloat(curr.comp_mrp_val || 0) > 0
            ? ((parseFloat(curr.comp_mrp_val) - parseFloat(curr.comp_actual_sales)) / parseFloat(curr.comp_mrp_val)) * 100
            : null) : null;
        const wtDiscount = hasPdp ? parseFloat(curr.my_wt_discount || 0) : null;

        const sosNum = currSosMap.get(brandKey) || 0;
        const sos = hasSosCheck ? (currTotalOverall > 0 ? (sosNum / currTotalOverall) * 100 : null) : null;

        const marketShare = (hasMsCheck && !hasTier23) ? (currMsMap.get(brandKey) || null) : null;

        // Previous
        const prevOfftake = prevHasPdp ? parseFloat(prev.total_sales || 0) : null;
        const prevOfftakeUnits = prevHasPdp ? parseFloat(prev.total_qty || 0) : null;
        const prevSpend = prevHasPm ? parseFloat(prevPmRaw.total_spend || 0) : null;
        const prevAdSales = prevHasPm ? parseFloat(prevPmRaw.total_Ad_sales || 0) : null;
        const prevOrders = prevHasPm ? parseFloat(prevPmRaw.total_orders || 0) : null;
        const prevClicks = prevHasPm ? parseFloat(prevPmRaw.total_clicks || 0) : null;
        const prevImpressions = prevHasPm ? parseFloat(prevPmRaw.total_impressions || 0) : null;

        const prevAvailability = prevHasPdp ? (prev.total_deno > 0 ? (prev.total_neno / prev.total_deno) * 100 : null) : null;
        const prevListingPercent = prevHasPdp ? parseFloat(prev.avg_listing_percent || 0) : null;
        const prevWtOsa = (prevAvailability !== null && prevListingPercent !== null) ? (prevAvailability * prevListingPercent) / 100 : null;
        const prevBuyBoxPct = prevHasPdp ? (parseFloat(prev.total_deno || 0) > 0 ? (parseFloat(prev.total_buy_box_neno || 0) * 1.0 / parseFloat(prev.total_deno)) * 100 : null) : null;
        const prevDeliveryTime = prevHasPdp ? (parseFloat(prev.avg_delivery_days || null)) : null;
        const prevRoas = prevHasPm ? (prevSpend > 0 ? prevAdSales / prevSpend : null) : null;
        const prevConversion = prevHasPm ? (prevClicks > 0 ? (prevOrders / prevClicks) * 100 : null) : null;
        const prevCpm = prevHasPm ? (prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : null) : null;
        const prevCpc = prevHasPm ? (prevClicks > 0 ? prevSpend / prevClicks : null) : null;
        const prevAsp = prevHasPdp ? parseFloat(prev.avg_asp || 0) : null;
        const prevAov = (prevHasPm && prevOrders > 0) ? prevAdSales / prevOrders : null;

        const prevPromoMyBrand = prevHasPdp ? (parseFloat(prev.my_mrp_val || 0) > 0
            ? ((parseFloat(prev.my_mrp_val) - parseFloat(prev.my_actual_sales)) / parseFloat(prev.my_mrp_val)) * 100
            : null) : null;
        const prevPromoCompete = prevHasPdp ? (parseFloat(prev.comp_mrp_val || 0) > 0
            ? ((parseFloat(prev.comp_mrp_val) - parseFloat(prev.comp_actual_sales)) / parseFloat(prev.comp_mrp_val)) * 100
            : null) : null;
        const prevWtDiscount = prevHasPdp ? parseFloat(prev.my_wt_discount || 0) : null;

        const prevSosNum = prevSosMap.get(brandKey) || 0;
        const prevSos = prevHasSosCheck ? (prevTotalOverall > 0 ? (prevSosNum / prevTotalOverall) * 100 : null) : null;
        const prevMarketShare = (prevHasMsCheck && !hasTier23) ? (prevMsMap.get(brandKey) || null) : null;

        // Ad SOV (spons)
        const adSovNum = currAdSovMap.get(brandKey) || 0;
        const adSov = hasSosCheck ? (currTotalSpons > 0 ? (adSovNum / currTotalSpons) * 100 : null) : null;
        const prevAdSovNum = prevAdSovMap.get(brandKey) || 0;
        const prevAdSov = prevHasSosCheck ? (prevTotalSpons > 0 ? (prevAdSovNum / prevTotalSpons) * 100 : null) : null;

        // Organic SOV (organic)
        const orgSovNum = currOrgSovMap.get(brandKey) || 0;
        const organicSov = hasSosCheck ? (currTotalOrganic > 0 ? (orgSovNum / currTotalOrganic) * 100 : null) : null;
        const prevOrgSovNum = prevOrgSovMap.get(brandKey) || 0;
        const prevOrganicSov = prevHasSosCheck ? (prevTotalOrganic > 0 ? (prevOrgSovNum / prevTotalOrganic) * 100 : null) : null;


        return {
            key: brandKey.replace(/\s+/g, '_'),
            label: brandName,
            type: "Brand",
            logo: brandImageMap.get(brandKey) || null,
            columns: generateKpiColumns({
                offtake, availability, wtOsa, listingPercent, sos, marketShare, spend, roas, inorgSales: adSales, conversion, cpm, cpc, asp, aov, promoMyBrand, promoCompete, wtDiscount, categorySize: hasMsCheck ? currBrandCatSize : null, adSov, organicSov, buyBoxPct, deliveryTime,
                prevOfftake, prevAvailability, prevWtOsa, prevListingPercent, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales: prevAdSales, prevConversion, prevCpm, prevCpc, prevAsp, prevAov, prevPromoMyBrand, prevPromoCompete, prevWtDiscount, prevCategorySize: prevHasMsCheck ? prevBrandCatSize : null, prevAdSov, prevOrganicSov, prevBuyBoxPct, prevDeliveryTime,
                offtakeUnits: offtakeUnits, inorgUnits: orders, prevOfftakeUnits: prevOfftakeUnits, prevInorgUnits: prevOrders
            })
        };
    });

    // Sort brands: those with values (offtake > 0) first, then by offtake descending
    // Brands with all zeros go to the end
    const sortedBrandsOverview = brandsOverview.sort((a, b) => {
        // Get offtake value from columns (first column is Offtakes)
        const getOfftakeValue = (brand) => {
            const offtakeCol = brand.columns.find(c => c.title === 'Offtakes');
            if (!offtakeCol) return 0;
            // Parse the formatted currency value back to number
            const valStr = offtakeCol.value.replace(/[₹,]/g, '').trim();
            if (valStr.includes('Cr')) return parseFloat(valStr) * 10000000;
            if (valStr.includes('lac')) return parseFloat(valStr) * 100000;
            if (valStr.includes('L')) return parseFloat(valStr) * 100000;
            if (valStr.includes('K')) return parseFloat(valStr) * 1000;
            return parseFloat(valStr) || 0;
        };

        const aVal = getOfftakeValue(a);
        const bVal = getOfftakeValue(b);

        // Brands with values > 0 come first
        if (aVal > 0 && bVal === 0) return -1;
        if (aVal === 0 && bVal > 0) return 1;

        // Among brands with values, sort by offtake descending
        return bVal - aVal;
    });

    console.log(`[getBrandsOverview] OPTIMIZED: Returning ${sortedBrandsOverview.length} brands (sorted by offtake)`);
    return sortedBrandsOverview;
};

/**
 * Get KPI Trends Data for Performance Metrics
 * Returns time-series data for performance KPIs (Share of Search, Inorganic Sales, Conversion, ROAS, BMI/Sales Ratio)
 */
const getKpiTrends = async (filters) => {
    console.log('[getKpiTrends] Computing KPI trends data with filters:', filters);

    const { brand, location, platform, category, period, timeStep, startDate: customStart, endDate: customEnd, skuName, skuCode, dimension, dimensionValue, resellerName } = filters;
    const channel = extractChannel(filters);

    // 1. Determine Date Range
    let endDate = await getCachedMaxDate();
    let startDate = endDate.clone();

    if (period === 'Custom' && customStart && customEnd) {
        startDate = dayjs(customStart);
        endDate = dayjs(customEnd);
    } else {
        switch (period) {
            case '1M': startDate = startDate.subtract(1, 'month'); break;
            case '3M': startDate = startDate.subtract(3, 'month'); break;
            case '6M': startDate = startDate.subtract(6, 'month'); break;
            case '1Y': startDate = startDate.subtract(1, 'year'); break;
            default: startDate = startDate.subtract(3, 'month'); // Default 3M
        }
    }

    const isSkuSelected = (skuName && skuName !== 'All' && skuName !== '') || (skuCode && skuCode !== 'All' && skuCode !== '');
    // When SKU is selected, use rb_pdp_olap for PM KPIs (Spend, ROAS, Conversion, CPC, CPM)
    // instead of rb_pm_olap, since PM table only has aggregate-level data
    const usePdpForPmKpis = isSkuSelected;

    const validBrandNames = await getCachedValidBrandNames();

    console.log(`[getKpiTrends] Date range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}, isSkuSelected: ${isSkuSelected}, usePdpForPmKpis: ${usePdpForPmKpis}`);

    // 2. Determine Grouping for ClickHouse
    let groupFormat;  // For formatDateTime
    let groupExpression;
    let groupExpressionKw;

    if (timeStep === 'Monthly') {
        groupFormat = '%Y-%m-01';
        groupExpression = `formatDateTime(toDate(DATE), '${groupFormat}')`;
        groupExpressionKw = `formatDateTime(toDate(DATE), '${groupFormat}')`;
    } else if (timeStep === 'Weekly') {
        groupFormat = 'WEEK';
        groupExpression = `toYearWeek(toDate(DATE), 1)`;
        groupExpressionKw = `toYearWeek(toDate(DATE), 1)`;
    } else { // Daily
        groupFormat = '%Y-%m-%d';
        groupExpression = `formatDateTime(toDate(DATE), '${groupFormat}')`;
        groupExpressionKw = `formatDateTime(toDate(DATE), '${groupFormat}')`;
    }

    // Helper to escape strings for ClickHouse
    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

    // Normalize incoming effective filters array or strings
    const catArr = normalizeFilterArray(category);
    const locArr = normalizeFilterArray(location);
    const brandArr = normalizeFilterArray(brand);
    const platArr = normalizeFilterArray(platform);
    const subBrandTarget = filters.subBrand || filters.sub_brand;
    const subBrandArr = normalizeFilterArray(subBrandTarget);

    // Check for Tier-2/Tier-3 city selections
    const tier1Cities = [
        'kolkata', 'mumbai', 'pune', 'chennai', 'delhi', 'lucknow',
        'gurugram', 'chandigarh', 'hyderabad', 'faridabad', 'bengaluru'
    ];
    let hasTier23 = false;
    const allLocations = [...locArr];
    if (dimension && (dimension.toLowerCase() === 'city' || dimension.toLowerCase() === 'location') && dimensionValue && dimensionValue !== 'All') {
        allLocations.push(dimensionValue);
    }
    if (allLocations.length > 0) {
        hasTier23 = allLocations.some(loc => {
            const lowerLoc = String(loc).trim().toLowerCase();
            if (lowerLoc === 'all' || lowerLoc === '' || lowerLoc === 'all india') return false;
            return !tier1Cities.includes(lowerLoc);
        });
    }

    const src = await getWatchtowerSource(filters);
    // 3. Build WHERE conditions for dynamic source
    const buildKpiConds = () => {
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const conds = [`${dateCol} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];

        // Default to "Our Brands" only for consistency with Overview cards
        conds.push(`toString(${src.f.compFlag}) = '0'`);

        // Handle dimension filter if provided (matching Trends drawer behavior)
        if (dimension && dimensionValue && dimensionValue !== 'All') {
            const dimKey = dimension.toLowerCase();
            const val = dimensionValue;
            if (dimKey === 'platform') conds.push(`lower(${src.f.platform}) = '${escapeStr(val.toLowerCase())}'`);
            else if (dimKey === 'category' || dimKey === 'format') {
                const catCol = src.f.category;
                conds.push(`lower(trim(BOTH '\t\n ' FROM ${catCol})) = '${escapeStr(val.toLowerCase())}'`);
            }
            else if (dimKey === 'brand') conds.push(`lower(${src.f.brand}) = '${escapeStr(val.toLowerCase())}'`);
            else if (dimKey === 'city' || dimKey === 'location') conds.push(`lower(${src.f.location}) = '${escapeStr(val.toLowerCase())}'`);
        }

        if (catArr && catArr.length > 0) {
            const catCol = src.f.category;
            conds.push(`lower(trim(BOTH '\t\n ' FROM ${catCol})) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
        }

        if (brandArr && brandArr.length > 0) {
            const brandConditions = brandArr.map(b => `lower(${src.f.brand}) LIKE '%${escapeStr(b.toLowerCase())}%'`).join(' OR ');
            conds.push(`(${brandConditions})`);
        }

        if (subBrandArr && subBrandArr.length > 0 && !src.isAgg) {
            const sbConds = subBrandArr.map(sb => `lower(sub_brand) = '${escapeStr(sb.toLowerCase())}'`).join(' OR ');
            conds.push(`(${sbConds})`);
        }

        if (locArr && locArr.length > 0) conds.push(`lower(${src.f.location}) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);

        if (platArr && platArr.length > 0) {
            conds.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
        } else {
            const platformCond = buildPlatformChannelCond(null, channel, src.f.platform);
            if (platformCond) conds.push(platformCond);
        }

        // Advanced SKU Search Filters
        const skuArrArr = normalizeFilterArray(skuName);
        if (skuArrArr && skuArrArr.length > 0) {
            const skuConds = skuArrArr.map(s => `${src.f.product} LIKE '%${escapeStr(s)}%'`).join(' OR ');
            conds.push(`(${skuConds})`);
        }
        const skuCodeArrArr = normalizeFilterArray(skuCode);
        if (skuCodeArrArr && skuCodeArrArr.length > 0) {
            const skuCodeConds = skuCodeArrArr.map(s => `toString(${src.f.skuCode}) LIKE '%${escapeStr(s)}%'`).join(' OR ');
            conds.push(`(${skuCodeConds})`);
        }
        if (!src.isAgg) {
            const mslArr = normalizeFilterArray(filters.msl);
            if (mslArr && mslArr.length > 0) {
                const mslConds = mslArr.map(m => `toString(${src.f.msl}) = '${escapeStr(m)}'`).join(' OR ');
                conds.push(`(${mslConds})`);
            }
        }

        return conds.join(' AND ');
    };

    const kpiConds = buildKpiConds();
    const pmSrc = await getPmSource();

    // Helper to build PM specific conditions (fields like platform, brand might have different column names)
    const buildPmConds = () => {
        const conds = [`${pmSrc.f.date} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];

        if (dimension && dimensionValue && dimensionValue !== 'All') {
            const dimKey = dimension.toLowerCase();
            const val = dimensionValue;
            if (dimKey === 'platform') conds.push(`lower(${pmSrc.f.platform}) = '${escapeStr(val.toLowerCase())}'`);
            else if (dimKey === 'category' || dimKey === 'format') conds.push(`lower(${pmSrc.f.category}) = '${escapeStr(val.toLowerCase())}'`);
            else if (dimKey === 'brand') conds.push(`lower(${pmSrc.f.brand}) = '${escapeStr(val.toLowerCase())}'`);
            else if ((dimKey === 'city' || dimKey === 'location') && pmSrc.f.location && pmSrc.f.location !== "'Unknown'") conds.push(`lower(${pmSrc.f.location}) = '${escapeStr(val.toLowerCase())}'`);
        }

        if (catArr && catArr.length > 0) conds.push(`lower(${pmSrc.f.category}) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);

        if (brandArr && brandArr.length > 0) {
            const brandConditions = brandArr.map(b => `lower(${pmSrc.f.brand}) LIKE '%${escapeStr(b.toLowerCase())}%'`).join(' OR ');
            conds.push(`(${brandConditions})`);
        }

        if (pmSrc.f.location && pmSrc.f.location !== "'Unknown'" && locArr && locArr.length > 0) conds.push(`lower(${pmSrc.f.location}) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);

        if (platArr && platArr.length > 0) {
            conds.push(`lower(${pmSrc.f.platform}) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
        } else {
            const platformCond = buildPlatformChannelCond(null, channel, pmSrc.f.platform, false, pmSrc.f.channel);
            if (platformCond) conds.push(platformCond);
        }

        // Enforce "Our Brands" only for PM metrics if no specific brand is selected
        if (!brandArr || brandArr.length === 0 || brandArr.includes('All')) {
            if (validBrandNames && validBrandNames.length > 0) {
                const brandList = validBrandNames.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ');
                conds.push(`lower(${pmSrc.f.brand}) IN (${brandList})`);
            }
        }

        return conds.join(' AND ');
    };

    const pmKpiConds = buildPmConds();

    // Reseller_Name condition for DRL: handle Buy More (buymore_rb_pdp_olap) and other resellers (rb_pdp_olap)
    const dbNameForTrends = getCurrentDbName();
    const isDrlDb = dbNameForTrends === 'drl';
    const resellerList = (resellerName && resellerName !== 'All' && resellerName !== 'all')
        ? normalizeFilterArray(resellerName).map(r => String(r).toLowerCase().trim())
        : [];

    let includeOtherResellers = true;
    let includeBuyMore = true;
    const nonBuyMoreList = resellerList.filter(r => !(r.includes('buy') || r.includes('more')));

    // For DRL: buymore data should ONLY be included for e-commerce platforms, not for quick commerce
    if (isDrlDb) {
        const quickCommPlatforms = ['blinkit', 'zepto', 'instamart', 'swiggy', 'bbnow'];
        const ecommPlatforms = ['amazon', 'flipkart', 'jiomart', 'meesho', 'myntra', 'pharmeasy', 'shopify'];
        const selectedPlatforms = platArr.map(p => p.toLowerCase());
        const isOnlyQuickComm = selectedPlatforms.length > 0 && selectedPlatforms.every(p => quickCommPlatforms.includes(p));
        const hasEcomm = selectedPlatforms.length === 0 || selectedPlatforms.some(p => ecommPlatforms.includes(p));
        
        if (isOnlyQuickComm) {
            includeBuyMore = false;
        } else if (!hasEcomm) {
            includeBuyMore = false;
        }
    }

    if (isDrlDb && resellerList.length > 0) {
        const hasBuy = resellerList.some(r => r.includes('buy') || r.includes('more'));
        const hasOther = nonBuyMoreList.length > 0;

        if (hasBuy && !hasOther) {
            includeBuyMore = true;
            includeOtherResellers = false;
        } else if (!hasBuy && hasOther) {
            includeBuyMore = false;
            includeOtherResellers = true;
        } else {
            includeBuyMore = true;
            includeOtherResellers = true;
        }
    }

    const channelColSql = src.f.channel ? `lower(${src.f.channel})` : `(CASE WHEN lower(${src.f.platform}) IN ('amazon', 'flipkart', 'myntra', 'nykaa', 'jiomart') THEN 'ecommerce' WHEN lower(${src.f.platform}) IN ('blinkit', 'zepto', 'instamart', 'swiggy', 'bbnow') THEN 'quickcomm' ELSE 'other' END)`;
    const pmChannelColSql = pmSrc.f.channel ? `lower(${pmSrc.f.channel})` : `(CASE WHEN lower(${pmSrc.f.platform}) IN ('amazon', 'flipkart', 'myntra', 'nykaa', 'jiomart') THEN 'ecommerce' WHEN lower(${pmSrc.f.platform}) IN ('blinkit', 'zepto', 'instamart', 'swiggy', 'bbnow') THEN 'quickcomm' ELSE 'other' END)`;

    // 4. Query for Inorganic Sales, Conversion, ROAS, BMI/Sales Ratio from dynamic source
    const [kpiResults, pmResults] = await Promise.all([
        queryClickHouse(`
            SELECT 
                ${groupExpression.replace('DATE', src.f.date)} as date_group,
                MAX(toDate(${src.f.date})) as ref_date,
                SUM(${src.f.sales}) as total_sales,
                SUM(${src.f.adSales}) as total_Ad_sales,
                SUM(${src.f.spend}) as total_ad_spend,
                SUM(${src.f.orders}) as total_ad_orders,
                SUM(${src.f.clicks}) as total_ad_clicks,
                SUM(${src.f.impressions}) as total_ad_impressions,
                SUM(CASE WHEN ${channelColSql} = 'ecommerce' THEN ${src.f.spend} ELSE 0 END) as total_cpc_spend,
                SUM(CASE WHEN ${channelColSql} = 'ecommerce' THEN ${src.f.clicks} ELSE 0 END) as total_cpc_clicks,
                SUM(CASE WHEN ${channelColSql} = 'quickcomm' THEN ${src.f.spend} ELSE 0 END) as total_cpm_spend,
                SUM(CASE WHEN ${channelColSql} = 'quickcomm' THEN ${src.f.impressions} ELSE 0 END) as total_cpm_impressions,
                SUM(CASE WHEN toString(${src.f.compFlag}) = '0' THEN ${src.f.neno} ELSE 0 END) as total_neno_osa,
                SUM(CASE WHEN toString(${src.f.compFlag}) = '0' THEN ${src.f.deno} ELSE 0 END) as total_deno_osa,
                (toFloat64(SUM(CASE WHEN toString(${src.f.compFlag}) = '0' THEN ${src.f.neno} ELSE 0 END)) / NULLIF(toFloat64(SUM(CASE WHEN toString(${src.f.compFlag}) = '0' THEN ${src.f.deno} ELSE 0 END)), 0)) * 100 as total_availability,
                COUNT(DISTINCT ${src.f.skuCode}) as assortment_count,
                AVG(${src.f.sellingPrice}) as avg_selling_price,
                AVG(${src.f.mrp}) as avg_mrp,
                (SUM(CASE WHEN ${src.f.mrp} > 0 THEN ${src.f.mrp} ELSE 0 END) - SUM(CASE WHEN ${src.f.mrp} > 0 THEN ${src.f.sellingPrice} ELSE 0 END)) / NULLIF(SUM(CASE WHEN ${src.f.mrp} > 0 THEN ${src.f.mrp} ELSE 0 END), 0) * 100 as avg_discount,
                SUM(CASE WHEN ${src.f.mrp} > 0 THEN ${src.f.sales} ELSE 0 END) as sales_with_mrp,
                SUM(if(${src.f.mrp} > 0, ${src.f.mrp} * ${src.f.quantitySold}, 0)) as mrp_sales_valid,
                SUM(${src.f.sellingPrice}) as sum_selling_price,
                0 as sum_weight
            FROM ${src.table}
            WHERE ${kpiConds} ${(isDrlDb && nonBuyMoreList.length > 0) ? `AND lower(trim(Reseller_Name)) IN (${nonBuyMoreList.map(r => `'${escapeStr(r)}'`).join(', ')})` : ''} ${(isDrlDb && includeBuyMore && includeOtherResellers && nonBuyMoreList.length === 0) ? `AND (lower(trim(Reseller_Name)) NOT LIKE '%buy%more%' OR Reseller_Name IS NULL OR Reseller_Name = '')` : ''}
            GROUP BY date_group
            ORDER BY ref_date ASC
        `),
        queryClickHouse(`
            SELECT 
                ${groupExpression.replace('DATE', pmSrc.f.date)} as date_group,
                SUM(${pmSrc.f.adSales}) as pm_ad_sales,
                SUM(${pmSrc.f.spend}) as pm_ad_spend,
                SUM(${pmSrc.f.orders}) as pm_ad_orders,
                SUM(${pmSrc.f.clicks}) as pm_ad_clicks,
                SUM(${pmSrc.f.impressions}) as pm_ad_impressions,
                SUM(CASE WHEN ${pmChannelColSql} = 'ecommerce' THEN ${pmSrc.f.spend} ELSE 0 END) as pm_cpc_spend,
                SUM(CASE WHEN ${pmChannelColSql} = 'ecommerce' THEN ${pmSrc.f.clicks} ELSE 0 END) as pm_cpc_clicks,
                SUM(CASE WHEN ${pmChannelColSql} = 'quickcomm' THEN ${pmSrc.f.spend} ELSE 0 END) as pm_cpm_spend,
                SUM(CASE WHEN ${pmChannelColSql} = 'quickcomm' THEN ${pmSrc.f.impressions} ELSE 0 END) as pm_cpm_impressions
            FROM ${pmSrc.table}
            WHERE ${pmKpiConds}
            GROUP BY date_group
        `)
    ]);

    if (isDrlDb) {
        let buymoreMap = new Map();
        if (includeBuyMore) {
            const buildBuymoreConds = () => {
                const conds = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
                if (dimension && dimensionValue && dimensionValue !== 'All') {
                    const dimKey = dimension.toLowerCase();
                    const val = dimensionValue;
                    if (dimKey === 'platform') conds.push(`lower(Platform) = '${escapeStr(val.toLowerCase())}'`);
                    else if (dimKey === 'category' || dimKey === 'format') conds.push(`lower(trim(BOTH '\t\n ' FROM category)) = '${escapeStr(val.toLowerCase())}'`);
                    else if (dimKey === 'brand') conds.push(`lower(brand) = '${escapeStr(val.toLowerCase())}'`);
                    else if (dimKey === 'city' || dimKey === 'location') conds.push(`lower(Location) = '${escapeStr(val.toLowerCase())}'`);
                }
                if (catArr && catArr.length > 0) conds.push(`lower(trim(BOTH '\t\n ' FROM category)) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
                if (brandArr && brandArr.length > 0) {
                    const brandConditions = brandArr.map(b => `lower(brand) LIKE '%${escapeStr(b.toLowerCase())}%'`).join(' OR ');
                    conds.push(`(${brandConditions})`);
                }
                if (locArr && locArr.length > 0) conds.push(`lower(Location) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
                if (platArr && platArr.length > 0) conds.push(`lower(Platform) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);

                // Enforce 11 specific Status values for buymore_rb_pdp_olap
                const validStatuses = [
                    'shiplable generated',
                    'pickup_complete',
                    'pickup pending',
                    'payment success',
                    'packed',
                    'ndr/npr',
                    'shipment_issue',
                    'out for delivery',
                    'in transit',
                    'drs prepared',
                    'dispatched',
                    'delivered',
                    'created'
                ];
                conds.push(`lower(trim(Status)) IN (${validStatuses.map(s => `'${escapeStr(s.toLowerCase())}'`).join(', ')})`);

                return conds.join(' AND ');
            };

            try {
                const buymoreGroupExpr = groupExpression.replace('DATE', 'DATE');
                const buymoreResults = await queryClickHouse(`
                    SELECT 
                        ${buymoreGroupExpr} as date_group,
                        SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as buymore_sales
                    FROM drl.buymore_rb_pdp_olap
                    WHERE ${buildBuymoreConds()}
                    GROUP BY date_group
                `);
                buymoreMap = new Map(buymoreResults.map(r => [String(r.date_group), parseFloat(r.buymore_sales || 0)]));
            } catch (err) {
                console.error('[getKpiTrends] Error querying buymore_rb_pdp_olap:', err);
            }
        }

        const kpiMap = new Map();
        kpiResults.forEach(r => kpiMap.set(String(r.date_group), r));

        if (includeBuyMore) {
            buymoreMap.forEach((buySales, groupKey) => {
                if (kpiMap.has(groupKey)) {
                    const row = kpiMap.get(groupKey);
                    if (!includeOtherResellers) {
                        row.total_sales = buySales;
                    } else {
                        row.total_sales = parseFloat(row.total_sales || 0) + buySales;
                    }
                } else {
                    const newRow = {
                        date_group: groupKey,
                        total_sales: buySales,
                        total_Ad_sales: 0,
                        total_ad_spend: 0,
                        total_ad_orders: 0,
                        total_ad_clicks: 0,
                        total_ad_impressions: 0,
                        total_availability: null,
                        assortment_count: 0
                    };
                    kpiResults.push(newRow);
                    kpiMap.set(groupKey, newRow);
                }
            });
        }

        if (!includeOtherResellers && includeBuyMore) {
            kpiResults.forEach(r => {
                if (!buymoreMap.has(String(r.date_group))) {
                    r.total_sales = 0;
                }
            });
        }
    }

    // Create a map for PM results for easy lookup during bucket processing
    const pmDataMap = new Map();
    pmResults.forEach(r => {
        pmDataMap.set(String(r.date_group), {
            adSales: parseFloat(r.pm_ad_sales || 0),
            spend: parseFloat(r.pm_ad_spend || 0),
            orders: parseFloat(r.pm_ad_orders || 0),
            clicks: parseFloat(r.pm_ad_clicks || 0),
            impressions: parseFloat(r.pm_ad_impressions || 0),
            cpcSpend: parseFloat(r.pm_cpc_spend || 0),
            cpcClicks: parseFloat(r.pm_cpc_clicks || 0),
            cpmSpend: parseFloat(r.pm_cpm_spend || 0),
            cpmImpressions: parseFloat(r.pm_cpm_impressions || 0)
        });
    });

    // 5. Query for Share of Search using ClickHouse
    // Uses overall/spons/organic columns and flag column for our brands

    // Build SOS base conditions (uses DATE and flag columns)
    const buildSosConds = () => {
        const conds = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        // Only consider top 10 ranked positions for SOS
        conds.push(`POSITION <= 10`);
        if (catArr && catArr.length > 0) conds.push(`lower(keyword_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
        if (locArr && locArr.length > 0) conds.push(`lower(location_name) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
        if (platArr && platArr.length > 0) conds.push(`lower(platform_name) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);

        return conds;
    };

    // Numerator conditions - use flag=0 for our brands
    const sosNumConds = buildSosConds();
    sosNumConds.push(`toString(flag) = '1'`);

    // Denominator: All products (no brand filter, matching Platform Overview)
    const sosDenomConds = buildSosConds();

    // 6. Query for Market Share and Category Share using rb_brand_ms
    // Get valid brand names from rca_sku_dim (comp_flag = 0)
    const validOurBrandsResult = await queryClickHouse(`
            SELECT DISTINCT brand_name 
            FROM rca_sku_dim 
            WHERE toString(comp_flag) = '0' AND brand_name IS NOT NULL AND brand_name != ''
        `);
    const validOurBrandNames = validOurBrandsResult.map(b => b.brand_name).filter(Boolean);

    // Build MS base conditions (matching Platform Overview)
    const buildMsBaseConds = (catFilter = null) => {
        const conds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        conds.push(`sales IS NOT NULL`);

        if (platArr && platArr.length > 0) {
            conds.push(`Platform IN (${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
        }
        if (locArr && locArr.length > 0) {
            conds.push(`Location IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }

        // Apply global category filter from effective filters if no parameter passed,
        // or the custom provided filter (used below for Category Share)
        const categoriesToUse = catFilter ? normalizeFilterArray(catFilter) : catArr;

        if (categoriesToUse && categoriesToUse.length > 0) {
            const catEscapedLower = categoriesToUse.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ');
            conds.push(`(lower(category) IN (${catEscapedLower}) OR lower(sub_category) IN (${catEscapedLower}))`);
        }

        return conds.join(' AND ');
    };

    const msGroupExpr = (timeStep === 'Weekly') ? `toYearWeek(toDate(created_on), 1)` : `formatDateTime(toDate(created_on), '${groupFormat}')`;
    const ourBrandsFilter = validOurBrandNames.length > 0 ? `brand IN (${validOurBrandNames.map(b => `'${escapeStr(b)}'`).join(', ')})` : '1=0';

    // Calculate master assortment from rb_sku_platform for Listing %
    // Dynamically resolve column names as they differ per database (e.g. brand_name vs brand)
    const skuPlatCols = await getTableColumns('rb_sku_platform');
    const getSkuPlatCol = (possibleNames) => {
        for (const name of possibleNames) {
            if (columnExists(skuPlatCols, name)) return resolveColumn(skuPlatCols, name);
        }
        return possibleNames[0];
    };
    const skuPlatBrandCol = getSkuPlatCol(['brand_name', 'brand']);
    const skuPlatCategoryCol = getSkuPlatCol(['brand_category', 'sub_category', 'product_category', 'Product_type', 'Category']);

    const masterAssortmentConds = [`status = 1`];

    // Helper to handle hierarchical categories (e.g. "A > B > C" -> match "C" in sub_category)
    const getLeafCategory = (c) => {
        if (typeof c === 'string' && c.includes(' > ')) {
            const parts = c.split(' > ');
            return parts[parts.length - 1].trim();
        }
        return c;
    };

    if (catArr && catArr.length > 0) {
        masterAssortmentConds.push(`lower(${skuPlatCategoryCol}) IN (${catArr.map(c => `'${escapeStr(getLeafCategory(c).toLowerCase())}'`).join(', ')})`);
    }
    if (brandArr && brandArr.length > 0) masterAssortmentConds.push(`lower(${skuPlatBrandCol}) IN (${brandArr.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ')})`);

    // Dimension-specific master count
    if (dimension && dimensionValue && dimensionValue !== 'All') {
        const dimKey = dimension.toLowerCase();
        const val = dimensionValue.toLowerCase();
        if (dimKey === 'category' || dimKey === 'format') masterAssortmentConds.push(`lower(${skuPlatCategoryCol}) = '${escapeStr(getLeafCategory(val))}'`);
        else if (dimKey === 'brand') masterAssortmentConds.push(`lower(${skuPlatBrandCol}) = '${escapeStr(val)}'`);
    }

    const masterQuery = `SELECT count(DISTINCT web_pid) as total_master FROM rb_sku_platform WHERE ${masterAssortmentConds.join(' AND ')}`;

    const [sosNumerator, sosDenominator, msTimeSeriesMap, masterResult] = await Promise.all([
        // SOS Numerator (sum(overall) for our brand - filter is in WHERE)
        queryClickHouse(`
                SELECT ${groupExpressionKw} as date_group, sum(toInt32(overall)) as count
                FROM rb_kw_olap
                WHERE ${sosNumConds.join(' AND ')}
                GROUP BY ${groupExpressionKw}
            `),
        // SOS Denominator
        queryClickHouse(`
            SELECT ${groupExpressionKw} as date_group, sum(toInt32(overall)) as count
            FROM rb_kw_olap
            WHERE ${sosDenomConds.join(' AND ')}
            GROUP BY ${groupExpressionKw}
        `),
        // Optimized Market Share Time Series
        getMarketShareTimeSeries(startDate, endDate, platArr, catArr, brandArr, timeStep, locArr, channel),
        // Master Assortment Count
        queryClickHouse(masterQuery)
    ]);

    const masterCount = parseInt(masterResult[0]?.total_master, 10) || 0;

    // ===================== KPI AVAILABILITY DETECTION =====================
    // Evaluate if each individual KPI has at least one valid data point across the entire selected date range.
    // If a specific KPI is completely missing (null/0) for all dates, it will be marked as unavailable
    // and return null (showing "N/A" on the UI) for all data points.
    const hasOfftakesData = kpiResults.some(r => parseFloat(r.total_sales || 0) > 0);
    const hasAvailabilityData = kpiResults.some(r => r.total_availability !== null && r.total_availability !== undefined);
    const hasAssortmentData = kpiResults.some(r => parseInt(r.assortment_count || 0, 10) > 0);
    const hasDiscountData = kpiResults.some(r => parseFloat(r.avg_discount || 0) > 0);
    const hasPricingData = kpiResults.some(r => parseFloat(r.avg_selling_price || 0) > 0);

    // When SKU is selected, detect availability from PDP data; otherwise from PM data
    let hasPmAdSalesData, hasPmSpendData, hasPmOrdersData, hasPmClicksData, hasPmImpressionsData;
    if (usePdpForPmKpis) {
        // Use PDP table (rb_pdp_olap) ad columns for availability detection
        hasPmAdSalesData = kpiResults.some(r => parseFloat(r.total_Ad_sales || 0) > 0);
        hasPmSpendData = kpiResults.some(r => parseFloat(r.total_ad_spend || 0) > 0);
        hasPmOrdersData = kpiResults.some(r => parseFloat(r.total_ad_orders || 0) > 0);
        hasPmClicksData = kpiResults.some(r => parseFloat(r.total_ad_clicks || 0) > 0);
        hasPmImpressionsData = kpiResults.some(r => parseFloat(r.total_ad_impressions || 0) > 0);
    } else {
        hasPmAdSalesData = pmResults.some(r => parseFloat(r.pm_ad_sales || 0) > 0);
        hasPmSpendData = pmResults.some(r => parseFloat(r.pm_ad_spend || 0) > 0);
        hasPmOrdersData = pmResults.some(r => parseFloat(r.pm_ad_orders || 0) > 0);
        hasPmClicksData = pmResults.some(r => parseFloat(r.pm_ad_clicks || 0) > 0);
        hasPmImpressionsData = pmResults.some(r => parseFloat(r.pm_ad_impressions || 0) > 0);
    }

    // [FEATURE OVERRIDE]: If platform belongs to 'Quickcomm', automatically resolve hasPm data availability flags to true
    // This allows the Trend charts to effectively process available graph lines rendering '0' values rather than nulling them entirely making them disappear off the face of the graph
    // when 'All SKUs' are selected (which implies PM metrics buttons are visible, and mapping logic applies).
    const channelStr = (Array.isArray(channel) ? channel.join(',') : String(channel || '')).toLowerCase();
    if (channelStr.includes('quickcomm') && !usePdpForPmKpis) {
        hasPmAdSalesData = true;
        hasPmSpendData = true;
        hasPmOrdersData = true;
        hasPmClicksData = true;
        hasPmImpressionsData = true;
    }

    const hasSosNumeratorData = sosNumerator.some(r => parseInt(r.count || 0, 10) > 0);
    const hasSosDenominatorData = sosDenominator.some(r => parseInt(r.count || 0, 10) > 0);
    const hasSosFinalData = hasSosNumeratorData && hasSosDenominatorData;

    const hasMsData = !hasTier23 && msTimeSeriesMap.size > 0 && Array.from(msTimeSeriesMap.values()).some(v => v > 0);

    // Legacy generic table-level flags still used for KPI Availability status map
    const hasPdpData = kpiResults.length > 0;
    const hasPmData = pmResults.length > 0;
    const hasSosData = sosDenominator.length > 0;

    const kpiAvailability = {
        // PDP table KPIs: Offtakes, Availability/OSA, Discount/Promo-My, Assortment, Listing
        pdp: hasPdpData,
        // PM table KPIs: InorganicSales, Conversion, ROAS, BMI/Sales, Spend, CPM, CPC
        pm: hasPmData,
        // KW table KPIs: ShareOfSearch (SOS)
        kw: hasSosData,
        // MS table KPIs: MarketShare, CategoryShare
        ms: hasMsData
    };

    console.log('[getKpiTrends] KPI Availability:', kpiAvailability);

    // 7. Generate time buckets and format data
    const buckets = generateTimeBuckets(startDate, endDate, timeStep);

    const timeSeries = buckets.map((bucket, bucketIndex) => {
        const pdpRow = kpiResults.find(r => String(r.date_group) === String(bucket.groupKey));
        const hasPdpBucketData = !!pdpRow;
        const rowRaw = pdpRow || {};
        const row = scaleMarsMetrics(rowRaw, brand || category || skuName || dimensionValue);

        // Extract values
        const totalSales = parseFloat(row.total_sales || 0);
        const adSales = parseFloat(row.total_Ad_sales || 0);
        const adSpend = parseFloat(row.total_ad_spend || 0);
        const adOrders = parseFloat(row.total_ad_orders || 0);
        const adImpressions = parseFloat(row.total_ad_impressions || 0);
        const adClicks = parseFloat(row.total_ad_clicks || 0);
        const cpcSpend = parseFloat(row.total_cpc_spend || 0);
        const cpcClicks = parseFloat(row.total_cpc_clicks || 0);
        const cpmSpend = parseFloat(row.total_cpm_spend || 0);
        const cpmImpressions = parseFloat(row.total_cpm_impressions || 0);

        // Calculate Pricing KPIs
        const avgSellingPrice = parseFloat(row.avg_selling_price || 0);
        const avgMrp = parseFloat(row.avg_mrp || 0);
        const avgDiscount = parseFloat(row.avg_discount || 0);
        const sumSellingPrice = parseFloat(row.sum_selling_price || 0);
        const sumWeight = parseFloat(row.sum_weight || 0);

        const discount = Math.max(0, Math.min(100, avgDiscount));
        const pricePerUnit = sumWeight > 0 ? sumSellingPrice / sumWeight : 0;
        const asp = avgSellingPrice;
        const rpi = avgMrp > 0 ? (avgSellingPrice / avgMrp) : 0; // Relative Price Index baseline

        // Calculate KPIs
        // 10. Availability (OSA%)
        const availability = row.total_availability !== null && row.total_availability !== undefined ? parseFloat(row.total_availability) : null;

        // 11. Assortment
        const assortment = parseInt(row.assortment_count || 0, 10);

        // 1. Share of Search
        const sosNum = sosNumerator.find(s => String(s.date_group) === String(bucket.groupKey));
        const sosDen = sosDenominator.find(s => String(s.date_group) === String(bucket.groupKey));
        const hasSosBucketData = !!(sosNum || sosDen);
        const numCount = parseInt(sosNum?.count || 0, 10);
        const denCount = parseInt(sosDen?.count || 0, 10);
        const shareOfSearch = denCount > 0 ? (numCount / denCount) * 100 : 0;

        // Get PM metrics for this period if available
        const hasPmBucketData = pmDataMap.has(String(bucket.groupKey));
        const pmData = pmDataMap.get(String(bucket.groupKey)) || {
            adSales: 0, spend: 0, orders: 0, clicks: 0, impressions: 0,
            cpcSpend: 0, cpcClicks: 0, cpmSpend: 0, cpmImpressions: 0
        };

        const effectivePmBucketData = usePdpForPmKpis ? hasPdpBucketData : hasPmBucketData;

        // When SKU is selected, use PDP data (rb_pdp_olap) for PM KPIs;
        // otherwise use PM data (rb_pm_olap) for Platform/Category/Brand/Location level
        const effectiveAdSales = usePdpForPmKpis ? adSales : pmData.adSales;
        const effectiveAdSpend = usePdpForPmKpis ? adSpend : pmData.spend;
        const effectiveAdOrders = usePdpForPmKpis ? adOrders : pmData.orders;
        const effectiveAdClicks = usePdpForPmKpis ? adClicks : pmData.clicks;
        const effectiveAdImpressions = usePdpForPmKpis ? adImpressions : pmData.impressions;

        const effectiveCpcSpend = usePdpForPmKpis ? cpcSpend : pmData.cpcSpend;
        const effectiveCpcClicks = usePdpForPmKpis ? cpcClicks : pmData.cpcClicks;
        const effectiveCpmSpend = usePdpForPmKpis ? cpmSpend : pmData.cpmSpend;
        const effectiveCpmImpressions = usePdpForPmKpis ? cpmImpressions : pmData.cpmImpressions;

        // 2. Inorganic Sales (Ad Sales) - Absolute value as requested
        const inorganicSales = effectiveAdSales;

        // 3. Conversion (Orders / Clicks * 100)
        const conversion = calculateConversion(effectiveAdOrders, effectiveAdImpressions, effectiveAdClicks);

        // 4. ROAS (Ad Sales / Ad Spend)
        const roas = effectiveAdSpend > 0 ? effectiveAdSales / effectiveAdSpend : 0;

        // 5. BMI/Sales Ratio (Ad Spend / Total Sales * 100)
        const bmiSalesRatio = totalSales > 0 ? (effectiveAdSpend / totalSales) * 100 : 0;

        // 6. Offtakes (Total Sales) - Return raw value for frontend formatting
        const offtakes = totalSales;

        // 7. Spend (Ad Spend) - Return raw value for frontend formatting
        const spend = effectiveAdSpend;

        // 8. CPM (Cost Per Thousand Impressions)
        const cpm = effectiveCpmImpressions > 0 ? (effectiveCpmSpend / effectiveCpmImpressions) * 1000 : 0;

        // 9. CPC (Cost Per Click)
        const cpc = effectiveCpcClicks > 0 ? effectiveCpcSpend / effectiveCpcClicks : 0;

        const hasMsBucketData = msTimeSeriesMap.has(String(bucket.groupKey));
        const marketShare = hasTier23 ? 0 : (msTimeSeriesMap.get(String(bucket.groupKey)) || 0);
        const categoryShare = marketShare;

        // Build data point with all KPIs
        // Use null for KPIs whose individual data source has no data over the ENTIRE duration
        // OR when no row exists for this specific bucket date (prevents line from dropping to 0)
        const valIfData = (hasData, hasBucketData, val) => (hasData && hasBucketData && val !== null && val !== undefined) ? val : null;

        const dataPoint = {
            date: bucket.label,
            // Core 5 KPIs (Performance Matrix)
            ShareOfSearch: valIfData(hasSosFinalData, hasSosBucketData, parseFloat(shareOfSearch.toFixed(2))),
            InorganicSales: valIfData(hasPmAdSalesData, effectivePmBucketData, parseFloat(inorganicSales.toFixed(2))),
            Conversion: valIfData(hasPmOrdersData && hasPmClicksData, effectivePmBucketData, parseFloat(conversion.toFixed(2))),
            Roas: valIfData(hasPmAdSalesData && hasPmSpendData, effectivePmBucketData, parseFloat(roas.toFixed(2))),
            BmiSalesRatio: valIfData(hasPmSpendData && hasOfftakesData, effectivePmBucketData && hasPdpBucketData, parseFloat(bmiSalesRatio.toFixed(2))),
            // Extended KPIs (Platform/Month/Category/Brand pages)
            Offtakes: valIfData(hasOfftakesData, hasPdpBucketData, parseFloat(offtakes.toFixed(0))),
            Spend: valIfData(hasPmSpendData, effectivePmBucketData, parseFloat(spend.toFixed(0))),
            Availability: valIfData(hasAvailabilityData, hasPdpBucketData, availability !== null ? parseFloat(availability.toFixed(2)) : null),
            Osa: valIfData(hasAvailabilityData, hasPdpBucketData, availability !== null ? parseFloat(availability.toFixed(2)) : null),
            Listing: valIfData(hasAssortmentData, hasPdpBucketData, masterCount > 0 ? parseFloat(((assortment / masterCount) * 100).toFixed(2)) : (availability !== null ? parseFloat(availability.toFixed(2)) : null)),
            Assortment: valIfData(hasAssortmentData, hasPdpBucketData, assortment),
            CPM: valIfData(hasPmSpendData && hasPmImpressionsData, effectivePmBucketData, parseFloat(cpm.toFixed(2))),
            CPC: valIfData(hasPmSpendData && hasPmClicksData, effectivePmBucketData, parseFloat(cpc.toFixed(2))),
            // Pricing KPIs
            'Promo-My': valIfData(hasDiscountData, hasPdpBucketData, parseFloat(discount.toFixed(2))),
            PricePerUnit: valIfData(hasPricingData, hasPdpBucketData, parseFloat(pricePerUnit.toFixed(2))),
            ASP: valIfData(hasPricingData, hasPdpBucketData, parseFloat(asp.toFixed(2))),
            RPI: valIfData(hasPricingData, hasPdpBucketData, parseFloat(rpi.toFixed(2))),
            // Mapped aliases for frontend compatibility (DRAWER SYNC)
            offtake: valIfData(hasOfftakesData, hasPdpBucketData, parseFloat(offtakes.toFixed(0))),       // MyTrendsDrawer
            Offtake: valIfData(hasOfftakesData, hasPdpBucketData, parseFloat(offtakes.toFixed(0))),       // TrendsCompetitionDrawer
            osa: valIfData(hasAvailabilityData, hasPdpBucketData, availability !== null ? parseFloat(availability.toFixed(2)) : null),       // MyTrendsDrawer
            discount: valIfData(hasDiscountData, hasPdpBucketData, parseFloat(discount.toFixed(2))),      // MyTrendsDrawer
            Sos: valIfData(hasSosFinalData, hasSosBucketData, parseFloat(shareOfSearch.toFixed(2))),      // MyTrendsDrawer
            SOS: valIfData(hasSosFinalData, hasSosBucketData, parseFloat(shareOfSearch.toFixed(2))),      // TrendsCompetitionDrawer
            ROAS: valIfData(hasPmAdSalesData && hasPmSpendData, effectivePmBucketData, parseFloat(roas.toFixed(2))),
            InorgSales: valIfData(hasPmAdSalesData, effectivePmBucketData, parseFloat(inorganicSales.toFixed(2))),
            MarketShare: valIfData(hasMsData, hasMsBucketData, parseFloat(marketShare.toFixed(2))),
            marketShare: valIfData(hasMsData, hasMsBucketData, parseFloat(marketShare.toFixed(2))),
            CategoryShare: valIfData(hasMsData, hasMsBucketData, parseFloat(categoryShare.toFixed(2))),
            categoryShare: valIfData(hasMsData, hasMsBucketData, parseFloat(categoryShare.toFixed(2))),
            PromoMyBrand: valIfData(hasDiscountData, hasPdpBucketData, parseFloat(discount.toFixed(2))),
            Discount: valIfData(hasDiscountData, hasPdpBucketData, parseFloat(discount.toFixed(2))),
            PromoCompete: 0,  // Placeholder
            DspSales: 0       // Placeholder
        };

        return dataPoint;

    });

    // Ensure discount and pricing KPIs are actually returned inside the metrics block
    return {
        timeSeries,
        metrics: {
            ShareOfSearch: { enabled: true },
            InorganicSales: { enabled: true },
            Conversion: { enabled: true },
            Roas: { enabled: true },
            BmiSalesRatio: { enabled: true },
            Discount: { enabled: true }
        },
        kpiAvailability
    };
};

/**
 * Get dynamic filter options for trends drawer
 * @param {string} filterType - 'platforms'|'categories'|'brands'|'cities'
 * @param {string} platform - Selected platform filter
 * @param {string} brand - Selected brand filter (for cities)
 */
const getTrendsFilterOptions = async ({ filterType, platform, brand, category, resellerName, dbName: propDbName }) => {
    try {
        console.log(`[getTrendsFilterOptions] Fetching ${filterType} for platform=${platform}, brand=${brand}, category=${category}, resellerName=${resellerName}`);
        const src = await getWatchtowerSource();

        // Normalize arrays for multi-select support
        const platArr = normalizeFilterArray(platform);
        const brandArr = normalizeFilterArray(brand);
        const catArr = normalizeFilterArray(category);

        // Reseller_Name filter (DRL DB context only)
        const effectiveDb = (propDbName || getCurrentDbName() || '').toLowerCase();
        const isDrl = effectiveDb === 'drl';
        const resellerArr = (isDrl && resellerName && resellerName !== 'All' && resellerName !== 'all')
            ? normalizeFilterArray(resellerName)
            : null;

        // Helper to add reseller condition to a conditions array
        const addResellerCondition = (conditions) => {
            if (resellerArr && resellerArr.length > 0) {
                conditions.push(`Reseller_Name IN (${resellerArr.map(r => `'${escapeStr(r)}'`).join(',')})`);
            }
        };

        if (filterType === 'platforms') {
            // Fetch unique platforms
            const query = `SELECT DISTINCT ${src.f.platform} as platform FROM ${src.table} WHERE ${src.f.platform} IS NOT NULL AND ${src.f.platform} != '' ORDER BY platform`;
            const results = await queryClickHouse(query);
            const platformList = results.map(p => p.platform).filter(p => p && p.trim()).sort();
            return { options: [...platformList] };
        }

        if (filterType === 'resellerNames') {
            const currentDb = getCurrentDbName() || 'drl';
            const table = (currentDb === 'drl' || currentDb === 'prestige') ? `${currentDb}.rb_pdp_olap` : src.table;
            const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';
            const platformFilter = (platform && platform !== 'All') ? escapeStr(platform.toLowerCase()) : 'amazon';

            let query;
            if (platformFilter === 'flipkart') {
                // Flipkart: use Comp_flag=0 AND Sales>0
                query = `
                    SELECT DISTINCT Reseller_Name
                    FROM ${table}
                    WHERE buy_box_neno_osa > 0
                      AND lower(Platform) = 'flipkart'
                      AND toString(Comp_flag) = '0'
                      AND Sales > 0
                      AND Reseller_Name IS NOT NULL
                      AND Reseller_Name != ''
                    ORDER BY Reseller_Name
                `;
            } else {
                // Amazon (default): same logic
                query = `
                    SELECT DISTINCT Reseller_Name
                    FROM ${table}
                    WHERE buy_box_neno_osa > 0
                      AND lower(Platform) = '${platformFilter}'
                      AND toString(Comp_flag) = '0'
                      AND Sales > 0
                      AND Reseller_Name IS NOT NULL
                      AND Reseller_Name != ''
                    ORDER BY Reseller_Name
                `;
            }
            try {
                const results = await queryClickHouse(query);
                let resellerList = results.map(r => r.Reseller_Name).filter(Boolean);
                const hasBuyMore = resellerList.some(r => r.toLowerCase().includes('buy') && r.toLowerCase().includes('more'));
                if (!hasBuyMore) {
                    resellerList.unshift('buy more');
                }
                return { options: resellerList };
            } catch (err) {
                console.error('[getTrendsFilterOptions] Error executing reseller options query:', err);
                return { options: ['buy more'] };
            }
        }

        if (filterType === 'categories') {
            // Fetch unique categories dynamically from database
            const catCol = src.f.category;
            const conditions = [
                `${catCol} IS NOT NULL`,
                `${catCol} != ''`,
                `${catCol} != 'Others'`
            ];
            if (platArr && platArr.length > 0) {
                conditions.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',')})`);
            }
            addResellerCondition(conditions);

            const query = `SELECT DISTINCT ${catCol} as category FROM ${src.table} WHERE ${conditions.join(' AND ')} ORDER BY category`;
            const results = await queryClickHouse(query);
            const categoryList = results.map(c => c.category).filter(c => c && c.trim()).sort();
            return { options: [...categoryList] };
        }

        if (filterType === 'brands') {
            // Fetch unique OWN brands only (comp_flag=0)
            const conditions = [`${src.f.brand} IS NOT NULL`, `${src.f.brand} != ''`, `toString(${src.f.compFlag}) = '0'`];
            if (platArr && platArr.length > 0) {
                conditions.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',')})`);
            }
            addResellerCondition(conditions);

            const query = `SELECT DISTINCT ${src.f.brand} as brand FROM ${src.table} WHERE ${conditions.join(' AND ')} ORDER BY brand`;
            const results = await queryClickHouse(query);
            const brandList = results.map(b => b.brand).filter(b => b && b.trim()).sort();
            return { options: [...brandList] };
        }

        if (filterType === 'cities') {
            // Fetch unique cities (Location)
            const conditions = [`${src.f.location} IS NOT NULL`, `${src.f.location} != ''`];
            if (platArr && platArr.length > 0) {
                conditions.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',')})`);
            }
            if (brandArr && brandArr.length > 0) {
                conditions.push(`${src.f.brand} IN (${brandArr.map(b => `'${escapeStr(b)}'`).join(',')})`);
            }
            if (catArr && catArr.length > 0) {
                conditions.push(`lower(${src.f.category}) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(',')})`);
            }
            addResellerCondition(conditions);

            const query = `SELECT DISTINCT ${src.f.location} as city FROM ${src.table} WHERE ${conditions.join(' AND ')} ORDER BY city`;
            const results = await queryClickHouse(query);
            const cityList = results.map(c => c.city).filter(c => c && c.trim()).sort();
            return { options: [...cityList] };
        }

        if (filterType === 'skus') {
            // Fetch unique products - exclusive to Our SKUs (compFlag = 0)
            const pdpCols = await getTableColumns('rb_pdp_olap');
            const hasSapCode = columnExists(pdpCols, 'sap_code');

            if (isDrl || hasSapCode) {
                const sapCol = hasSapCode ? resolveColumn(pdpCols, 'sap_code') : "''";
                const pCol = resolveColumn(pdpCols, 'Product', 'Product');
                const cFlag = resolveColumn(pdpCols, 'Comp_flag', 'Comp_flag');
                const platCol = resolveColumn(pdpCols, 'Platform', 'Platform');
                const brandCol = resolveColumn(pdpCols, 'Brand', 'Brand');
                const catCol = resolveColumn(pdpCols, 'Category', 'Category');

                const pdpConditions = [`${pCol} IS NOT NULL`, `${pCol} != ''`, `toString(${cFlag}) = '0'`];
                if (platArr && platArr.length > 0) {
                    pdpConditions.push(`lower(${platCol}) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',')})`);
                }
                if (brandArr && brandArr.length > 0) {
                    pdpConditions.push(`lower(${brandCol}) IN (${brandArr.map(b => `'${escapeStr(b.toLowerCase())}'`).join(',')})`);
                }
                if (catArr && catArr.length > 0) {
                    pdpConditions.push(`lower(${catCol}) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(',')})`);
                }
                if (resellerArr && resellerArr.length > 0 && columnExists(pdpCols, 'Reseller_Name')) {
                    pdpConditions.push(`Reseller_Name IN (${resellerArr.map(r => `'${escapeStr(r)}'`).join(',')})`);
                }

                const webPidCol = resolveColumn(pdpCols, 'Web_Pid');
                const query = `SELECT DISTINCT ${pCol} as sku, any(${sapCol}) as sap_code, any(${webPidCol}) as web_pid FROM rb_pdp_olap WHERE ${pdpConditions.join(' AND ')} GROUP BY sku ORDER BY sku`;
                const results = await queryClickHouse(query);
                const skuList = results.map(s => s.sku).filter(s => s && s.trim()).sort();
                const skuDetails = results.filter(s => s.sku && s.sku.trim()).map(s => ({ name: s.sku, sapCode: s.sap_code || null, webPid: s.web_pid || null }));
                return { options: [...skuList], skuDetails };
            }

            const conditions = [`${src.f.product} IS NOT NULL`, `${src.f.product} != ''`, `toString(${src.f.compFlag}) = '0'`];
            if (platArr && platArr.length > 0) {
                conditions.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',')})`);
            }
            if (brandArr && brandArr.length > 0) {
                conditions.push(`lower(${src.f.brand}) IN (${brandArr.map(b => `'${escapeStr(b.toLowerCase())}'`).join(',')})`);
            }
            if (catArr && catArr.length > 0) {
                conditions.push(`lower(${src.f.category}) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(',')})`);
            }
            addResellerCondition(conditions);

            const query = `SELECT DISTINCT ${src.f.product} as sku, any(${src.f.skuCode}) as web_pid FROM ${src.table} WHERE ${conditions.join(' AND ')} GROUP BY sku ORDER BY sku`;
            const results = await queryClickHouse(query);
            const skuList = results.map(s => s.sku).filter(s => s && s.trim()).sort();
            const skuDetails = results.filter(s => s.sku && s.sku.trim()).map(s => ({ name: s.sku, webPid: s.web_pid || null }));
            return { options: [...skuList], skuDetails };
        }

        return { options: [] };
    } catch (error) {
        console.error(`[getTrendsFilterOptions] Error fetching ${filterType}:`, error);
        // Return empty array on error
        return { options: [] };
    }
};

/**
 * Get competition brand data with metrics
 * @param {Object} filters - { platform, location, category, period }
 * @returns {Object} { brands: [...] }
 */
const getCompetitionData = async (filters = {}) => {
    try {
        const { platform = 'All', location = 'All', category = 'All', brand = 'All', sku = 'All', period = '1M' } = filters;
        const channel = extractChannel(filters);

        console.log('[getCompetitionData] Filters:', { platform, location, category, brand, sku, period });

        // Calculate date range based on period
        const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
        const days = periodDays[period] || 30;

        const endDate = (filters.startDate && filters.endDate) ? dayjs(filters.endDate) : dayjs();
        const startDate = (filters.startDate && filters.endDate) ? dayjs(filters.startDate) : endDate.clone().subtract(days, 'days');
        const momStartDate = startDate.clone().subtract(days, 'days');
        const momEndDate = startDate.clone().subtract(1, 'day');

        // Helper to escape strings for ClickHouse
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // Safely destructure keeping array or string format
        const catArr = normalizeFilterArray(category);
        const locArr = normalizeFilterArray(location);
        const brandArr = normalizeFilterArray(brand);
        const platArr = normalizeFilterArray(platform);
        const skuArr = normalizeFilterArray(sku);

        const src = await getWatchtowerSource(filters);

        // Reseller_Name filter (DRL DB context only)
        const dbName = getCurrentDbName();
        const resellerArr = ((dbName === 'drl' || dbName === 'prestige') && filters.resellerName && filters.resellerName !== 'All')
            ? normalizeFilterArray(filters.resellerName)
            : null;

        // Build base conditions for ClickHouse
        const buildCompConds = (startDt, endDt) => {
            const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
            const conds = [`${dateCol} BETWEEN '${startDt.format('YYYY-MM-DD')}' AND '${endDt.format('YYYY-MM-DD')}'`];

            if (platArr && platArr.length > 0) {
                conds.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
            }

            if (locArr && locArr.length > 0) {
                conds.push(`lower(${src.f.location}) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
            }

            if (catArr && catArr.length > 0) {
                const catCol = src.f.category;
                conds.push(`lower(${catCol}) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
            }

            if (brandArr && brandArr.length > 0) {
                conds.push(`lower(${src.f.brand}) IN (${brandArr.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ')})`);
            }

            if (skuArr && skuArr.length > 0) {
                conds.push(`lower(${src.f.product}) IN (${skuArr.map(s => `'${escapeStr(s.toLowerCase())}'`).join(', ')})`);
            }

            // Reseller_Name filter for DRL
            if (resellerArr && resellerArr.length > 0) {
                conds.push(`Reseller_Name IN (${resellerArr.map(r => `'${escapeStr(r)}'`).join(', ')})`);
            }

            // MSL filter (only applies to rb_pdp_olap)
            const mslArr = normalizeFilterArray(filters.msl);
            if (mslArr && mslArr.length > 0 && src.f.msl) {
                const mslConds = mslArr.map(m => `toString(${src.f.msl}) = '${escapeStr(m)}'`).join(' OR ');
                conds.push(`(${mslConds})`);
            }

            // conds.push(`toString(${src.f.compFlag}) = '1'`); // Show both our brands and competitors

            return conds.join(' AND ');
        };

        const currConds = buildCompConds(startDate, endDate);
        const momConds = buildCompConds(momStartDate, momEndDate);

        // Get valid brand names from rca_sku_dim (comp_flag = 0) for Market Share calculation
        const validBrandsResult = await queryClickHouse(`
            SELECT DISTINCT brand_name 
            FROM rca_sku_dim 
            WHERE toString(comp_flag) = '0' AND brand_name IS NOT NULL AND brand_name != ''
        `);
        const validBrandNames = validBrandsResult.map(b => b.brand_name).filter(Boolean);
        console.log(`[getCompetitionData] Valid brands (comp_flag=0): ${validBrandNames.length}`);

        // Build Market Share conditions for rb_brand_ms
        const buildMsConds = (includeBrandFilter = false) => {
            const conds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
            conds.push(`sales IS NOT NULL`);
            if (platArr && platArr.length > 0) {
                conds.push(`lower(platform) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
            }
            if (locArr && locArr.length > 0) {
                conds.push(`lower(location) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
            }
            if (includeBrandFilter && validBrandNames.length > 0) {
                const brandList = validBrandNames.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ');
                conds.push(`lower(brand) IN (${brandList})`);
            }
            return conds.join(' AND ');
        };

        // Build Category Share conditions for rb_brand_ms (category-level)
        const buildCategoryConds = (includeBrandFilter = false) => {
            const conds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
            conds.push(`sales IS NOT NULL`);
            if (platArr && platArr.length > 0) {
                conds.push(`lower(platform) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
            }
            if (locArr && locArr.length > 0) {
                conds.push(`lower(location) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
            }
            if (catArr && catArr.length > 0) {
                conds.push(`lower(category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
            }
            if (includeBrandFilter && validBrandNames.length > 0) {
                const brandList = validBrandNames.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ');
                conds.push(`lower(group_brand) IN (${brandList})`);
            }
            return conds.join(' AND ');
        };

        // Build SOS conditions for rb_kw_olap
        const buildKwConds = (startDt, endDt) => {
            const conds = [`toDate(DATE) BETWEEN '${startDt.format('YYYY-MM-DD')}' AND '${endDt.format('YYYY-MM-DD')}'`];
            if (platArr && platArr.length > 0) {
                conds.push(`lower(platform_name) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
            }
            if (locArr && locArr.length > 0) {
                conds.push(`lower(location_name) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
            }

            // USE NORMALIZED CATEGORY FILTER CONSISTENT WITH getBulkShareOfSearch
            const catArrNorm = normalizeFilterArray(category);
            if (catArrNorm && catArrNorm.length > 0) {
                conds.push(`lower(keyword_category) IN (${catArrNorm.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
            }

            return conds.join(' AND ');
        };

        // Run all queries in parallel using ClickHouse
        const [
            currentBrands, previousBrands, osaData,
            msTotalData, msOurBrandsData, catTotalData, catOurBrandsData,
            sosDenoData, sosNenoData, sosDenoDataPrev, sosNenoDataPrev,
            skuSosNenoData, skuSosNenoDataPrev
        ] = await Promise.all([
            // Query 1: Current period brand data from dynamic source
            queryClickHouse(`
                SELECT ${src.f.brand} as Brand,
                    any(${src.f.category}) as brand_category,
                    SUM(${src.f.sales}) as total_offtakes,
                    SUM(${src.f.spend}) as total_spend,
                    SUM(${src.f.adSales}) as total_Ad_sales,
                    SUM(${src.f.impressions}) as total_impressions,
                    AVG(${src.f.mrp}) as avg_mrp,
                    AVG(${src.f.sellingPrice}) as avg_selling_price,
                    AVG(${src.f.discount}) as avg_discount,
                    SUM(${src.f.sellingPrice}) as sum_selling_price,
                    0 as sum_weight,
                    count() as record_count,
                    AVG(${src.f.listingPercent}) as avg_listing_percent
                FROM ${src.table}
                WHERE ${currConds}
                GROUP BY Brand
            `),
            // Query 2: Previous period for MoM
            queryClickHouse(`
                SELECT ${src.f.brand} as Brand,
                    SUM(${src.f.sales}) as total_offtakes,
                    SUM(${src.f.spend}) as total_spend,
                    SUM(${src.f.adSales}) as total_Ad_sales,
                    SUM(${src.f.impressions}) as total_impressions,
                    AVG(${src.f.mrp}) as avg_mrp,
                    AVG(${src.f.sellingPrice}) as avg_selling_price,
                    AVG(${src.f.discount}) as avg_discount,
                    SUM(${src.f.sellingPrice}) as sum_selling_price,
                    0 as sum_weight,
                    SUM(${src.f.neno}) as neno_osa_sum,
                    SUM(${src.f.deno}) as deno_osa_sum,
                    AVG(${src.f.listingPercent}) as avg_listing_percent
                FROM ${src.table}
                WHERE ${momConds}
                GROUP BY Brand
            `),
            // Query 3: OSA data for current period
            queryClickHouse(`
                SELECT ${src.f.brand} as Brand,
                    SUM(${src.f.neno}) as neno_osa,
                    SUM(${src.f.deno}) as deno_osa
                FROM ${src.table}
                WHERE ${currConds}
                GROUP BY Brand
            `),
            // Query 4 & 5 removed, replaced by getMarketShareByBrand later
            Promise.resolve([{ total_sales: 0 }]),
            Promise.resolve([{ our_sales: 0 }]),
            // Query 6: Total category sales from rb_ms_olap (Category Share denominator)
            queryClickHouse(`
                SELECT SUM(toFloat64OrZero(toString(sales))) as total_cat_sales
                FROM rb_ms_olap
                WHERE ${buildCategoryConds(false)}
            `),
            // Query 7: Our brands category sales from rb_ms_olap (Category Share numerator)
            queryClickHouse(`
                SELECT SUM(toFloat64OrZero(toString(sales))) as our_cat_sales
                FROM rb_ms_olap
                WHERE ${buildCategoryConds(true)}
            `),
            // Query 8: SOS Deno (Overall) from rb_kw_olap - Current Period
            queryClickHouse(`
                SELECT COUNT(*) AS overall_deno
                FROM rb_kw_olap
                WHERE toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'
                  ${platArr && platArr.length > 0 ? `AND lower(platform_name) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})` : ''}
                  ${locArr && locArr.length > 0 ? `AND lower(location_name) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})` : ''}
                  ${catArr && catArr.length > 0 ? `AND lower(keyword_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})` : ''}
            `),
            // Query 9: SOS Neno (Per Brand) from rb_kw_olap - Current Period (countIf overall=1)
            queryClickHouse(`
                SELECT brand, sum(toInt32(overall)) AS overall_neno
                FROM rb_kw_olap
                WHERE toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'
                  ${platArr && platArr.length > 0 ? `AND lower(platform_name) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})` : ''}
                  ${locArr && locArr.length > 0 ? `AND lower(location_name) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})` : ''}
                  ${catArr && catArr.length > 0 ? `AND lower(keyword_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})` : ''}
                GROUP BY brand
            `),
            // Query 10: SOS Deno (Overall) from rb_kw_olap - MoM Period
            queryClickHouse(`
                SELECT sum(overall) AS overall_deno
                FROM rb_kw_olap
                WHERE toDate(DATE) BETWEEN '${momStartDate.format('YYYY-MM-DD')}' AND '${momEndDate.format('YYYY-MM-DD')}'
                  ${platArr && platArr.length > 0 ? `AND lower(platform_name) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})` : ''}
                  ${locArr && locArr.length > 0 ? `AND lower(location_name) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})` : ''}
                  ${catArr && catArr.length > 0 ? `AND lower(keyword_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})` : ''}
            `),
            // Query 11: SOS Neno (Per Brand) from rb_kw_olap - MoM Period (sumIf overall=1)
            queryClickHouse(`
                SELECT brand, sum(toInt32(overall)) AS overall_neno
                FROM rb_kw_olap
                WHERE toDate(DATE) BETWEEN '${momStartDate.format('YYYY-MM-DD')}' AND '${momEndDate.format('YYYY-MM-DD')}'
                  ${platArr && platArr.length > 0 ? `AND lower(platform_name) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})` : ''}
                  ${locArr && locArr.length > 0 ? `AND lower(location_name) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})` : ''}
                  ${catArr && catArr.length > 0 ? `AND lower(keyword_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})` : ''}
                GROUP BY brand
            `),
            // Query 12: SKU SOS Neno (Per Product) from rb_kw_olap - Current Period (countIf overall=1)
            queryClickHouse(`
                SELECT keyword_search_product AS Product, sum(toInt32(overall)) AS overall_neno
                FROM rb_kw_olap
                WHERE toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'
                  ${platArr && platArr.length > 0 ? `AND lower(platform_name) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})` : ''}
                  ${locArr && locArr.length > 0 ? `AND lower(location_name) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})` : ''}
                  ${catArr && catArr.length > 0 ? `AND lower(keyword_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})` : ''}
                GROUP BY Product
            `),
            // Query 13: SKU SOS Neno (Per Product) from rb_kw_olap - MoM Period (countIf overall=1)
            queryClickHouse(`
                SELECT keyword_search_product AS Product, sum(toInt32(overall)) AS overall_neno
                FROM rb_kw_olap
                WHERE toDate(DATE) BETWEEN '${momStartDate.format('YYYY-MM-DD')}' AND '${momEndDate.format('YYYY-MM-DD')}'
                  ${platArr && platArr.length > 0 ? `AND lower(platform_name) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})` : ''}
                  ${locArr && locArr.length > 0 ? `AND lower(location_name) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})` : ''}
                  ${catArr && catArr.length > 0 ? `AND lower(keyword_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})` : ''}
                GROUP BY Product
            `)
        ]);

        console.log(`[getCompetitionData] ✅ Found ${currentBrands.length} brands matching ALL filters`);
        if (currentBrands.length > 0) {
            console.log(`[getCompetitionData] Sample brands: `, currentBrands.slice(0, 3).map(b => b.Brand));
        } else {
            console.log('[getCompetitionData] ⚠️ NO BRANDS FOUND with current filters!');
        }

        // Extract SOS values from Query 8-13
        const sosDeno = parseFloat(sosDenoData[0]?.overall_deno || 0);
        const sosNenoMap = new Map(sosNenoData.map(r => [r.brand?.toLowerCase(), parseFloat(r.overall_neno || 0)]));
        const sosDenoPrev = parseFloat(sosDenoDataPrev[0]?.overall_deno || 0);
        const sosNenoMapPrev = new Map(sosNenoDataPrev.map(r => [r.brand?.toLowerCase(), parseFloat(r.overall_neno || 0)]));

        const skuSosNenoMap = new Map(skuSosNenoData.map(r => [r.Product?.toLowerCase(), parseFloat(r.overall_neno || 0)]));
        const skuSosNenoMapPrev = new Map(skuSosNenoDataPrev.map(r => [r.Product?.toLowerCase(), parseFloat(r.overall_neno || 0)]));

        // Create map for previous period data
        const prevMap = new Map(previousBrands.map(b => [b.Brand, b]));

        const osaMap = new Map(osaData.map(o => [o.Brand, {
            neno: parseFloat(o.neno_osa || 0),
            deno: parseFloat(o.deno_osa || 0)
        }]));

        // Get valid brand names to pass into Market Share helper
        const validBrandNamesForNum = (brand && brand !== 'All') ? (Array.isArray(brand) ? brand : [brand]) : validBrandNames;

        // NEW: Get all competitor brands to pass to Market Share helper instead of 'our brands' (validBrandNames)
        const competitorBrands = Array.from(new Set([
            ...currentBrands.map(b => b.Brand),
            ...previousBrands.map(b => b.Brand)
        ])).filter(Boolean);

        const msBrandFilter = competitorBrands.length > 0 ? competitorBrands : validBrandNamesForNum;

        // Use centralized Market Share helper for consistent AVG(nation_level_market_share) logic
        const msMapCurr = await getMarketShareByBrand(startDate, endDate, platform, category, msBrandFilter, location, channel);
        const msMapPrev = await getMarketShareByBrand(momStartDate, momEndDate, platform, category, msBrandFilter, location, channel);

        const brandSalesMap = new Map();
        const brandSalesMapPrev = new Map();
        msMapCurr.forEach((ms, brandName) => brandSalesMap.set(brandName.toLowerCase(), ms));
        msMapPrev.forEach((ms, brandName) => brandSalesMapPrev.set(brandName.toLowerCase(), ms));

        console.log(`[getCompetitionData] Got accurate averaged market share from helper for ${brandSalesMap.size} brands`);

        // Query per-brand sales from rb_ms_olap for Category Share calculation
        const [brandSalesQuery, brandSalesQueryPrev] = await Promise.all([
            queryClickHouse(`
                SELECT group_brand as brand, SUM(toFloat64OrZero(toString(sales))) as brand_sales
                FROM rb_ms_olap
                WHERE ${buildMsConds(false)}
                GROUP BY group_brand
            `),
            queryClickHouse(`
                SELECT group_brand as brand, SUM(toFloat64OrZero(toString(sales))) as brand_sales
                FROM rb_ms_olap
                WHERE ${buildMsConds(false).replace(startDate.format('YYYY-MM-DD'), momStartDate.format('YYYY-MM-DD')).replace(endDate.format('YYYY-MM-DD'), momEndDate.format('YYYY-MM-DD'))}
                GROUP BY group_brand
            `)
        ]);
        const brandAbsoluteSalesMap = new Map(brandSalesQuery.map(r => [r.brand?.toLowerCase(), parseFloat(r.brand_sales || 0)]));
        const brandAbsoluteSalesMapPrev = new Map(brandSalesQueryPrev.map(r => [r.brand?.toLowerCase(), parseFloat(r.brand_sales || 0)]));

        // Query per-category sales from rb_ms_olap for Category Share calculation
        // This gets total sales and our brands' sales per category
        const baseMsConds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`, `sales IS NOT NULL`];
        const msPlatArr = normalizeFilterArray(platform);
        if (msPlatArr && msPlatArr.length > 0) baseMsConds.push(`platform IN(${msPlatArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);

        const msLocArr = normalizeFilterArray(location);
        if (msLocArr && msLocArr.length > 0) baseMsConds.push(`location IN(${msLocArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);

        const [categorySalesQuery, categoryOurBrandsSalesQuery, categorySalesQueryPrev, categoryOurBrandsSalesQueryPrev] = await Promise.all([
            // Total sales per category
            queryClickHouse(`
                SELECT category, SUM(toFloat64OrZero(toString(sales))) as total_cat_sales
                FROM rb_ms_olap
                WHERE ${baseMsConds.join(' AND ')} AND category IS NOT NULL AND category != ''
                GROUP BY category
            `),
            // Our brands' (comp_flag=0) sales per category
            validBrandNames.length > 0 ? queryClickHouse(`
                SELECT category, SUM(toFloat64OrZero(toString(sales))) as our_cat_sales
                FROM rb_ms_olap
                WHERE ${baseMsConds.join(' AND ')} AND category IS NOT NULL AND category != ''
                    AND group_brand IN(${validBrandNames.map(b => `'${escapeStr(b)}'`).join(', ')})
                GROUP BY category
            `) : Promise.resolve([]),
            // Prev total sales per category
            queryClickHouse(`
                SELECT category, SUM(toFloat64OrZero(toString(sales))) as total_cat_sales
                FROM rb_ms_olap
                WHERE ${baseMsConds.join(' AND ').replace(startDate.format('YYYY-MM-DD'), momStartDate.format('YYYY-MM-DD')).replace(endDate.format('YYYY-MM-DD'), momEndDate.format('YYYY-MM-DD'))} AND category IS NOT NULL AND category != ''
                GROUP BY category
            `),
            // Prev our brands' sales per category
            validBrandNames.length > 0 ? queryClickHouse(`
                SELECT category, SUM(toFloat64OrZero(toString(sales))) as our_cat_sales
                FROM rb_ms_olap
                WHERE ${baseMsConds.join(' AND ').replace(startDate.format('YYYY-MM-DD'), momStartDate.format('YYYY-MM-DD')).replace(endDate.format('YYYY-MM-DD'), momEndDate.format('YYYY-MM-DD'))} AND category IS NOT NULL AND category != ''
                    AND group_brand IN(${validBrandNames.map(b => `'${escapeStr(b)}'`).join(', ')})
                GROUP BY category
            `) : Promise.resolve([])
        ]);

        const categoryTotalSalesMap = new Map();
        const categoryTotalSalesMapPrev = new Map();
        categorySalesQuery.forEach(r => {
            if (r.category) categoryTotalSalesMap.set(r.category.toLowerCase(), parseFloat(r.total_cat_sales || 0));
        });
        categorySalesQueryPrev.forEach(r => {
            if (r.category) categoryTotalSalesMapPrev.set(r.category.toLowerCase(), parseFloat(r.total_cat_sales || 0));
        });

        const categoryOurBrandsSalesMap = new Map();
        const categoryOurBrandsSalesMapPrev = new Map();
        categoryOurBrandsSalesQuery.forEach(r => {
            if (r.category) categoryOurBrandsSalesMap.set(r.category.toLowerCase(), parseFloat(r.our_cat_sales || 0));
        });
        categoryOurBrandsSalesQueryPrev.forEach(r => {
            if (r.category) categoryOurBrandsSalesMapPrev.set(r.category.toLowerCase(), parseFloat(r.our_cat_sales || 0));
        });

        // Query per-SKU sales from rb_ms_olap (since rb_pdp_olap competitor sales are 0)
        const [skuSalesQuery, skuSalesQueryPrev] = await Promise.all([
            queryClickHouse(`
                SELECT item_name, any(category) as category, SUM(toFloat64OrZero(toString(sales))) as sku_sales
                FROM rb_ms_olap
                WHERE ${baseMsConds.join(' AND ')} AND item_name IS NOT NULL AND item_name != ''
                GROUP BY item_name
            `),
            queryClickHouse(`
                SELECT item_name, any(category) as category, SUM(toFloat64OrZero(toString(sales))) as sku_sales
                FROM rb_ms_olap
                WHERE ${baseMsConds.join(' AND ').replace(startDate.format('YYYY-MM-DD'), momStartDate.format('YYYY-MM-DD')).replace(endDate.format('YYYY-MM-DD'), momEndDate.format('YYYY-MM-DD'))} AND item_name IS NOT NULL AND item_name != ''
                GROUP BY item_name
            `)
        ]);
        const skuMsMap = new Map();
        skuSalesQuery.forEach(r => {
            if (r.item_name) {
                skuMsMap.set(r.item_name.toLowerCase().trim(), {
                    sales: parseFloat(r.sku_sales || 0),
                    category: r.category ? r.category.toLowerCase().trim() : ''
                });
            }
        });
        const skuMsMapPrev = new Map();
        skuSalesQueryPrev.forEach(r => {
            if (r.item_name) {
                skuMsMapPrev.set(r.item_name.toLowerCase().trim(), {
                    sales: parseFloat(r.sku_sales || 0),
                    category: r.category ? r.category.toLowerCase().trim() : ''
                });
            }
        });

        // Also query category totals from rb_ms_olap to cover all bases
        const [subCategorySalesQuery, subCategorySalesQueryPrev] = await Promise.all([
            queryClickHouse(`
                SELECT category as sub_category, SUM(toFloat64OrZero(toString(sales))) as total_sub_cat_sales
                FROM rb_ms_olap
                WHERE ${baseMsConds.join(' AND ')} AND category IS NOT NULL AND category != ''
                GROUP BY category
            `),
            queryClickHouse(`
                SELECT category as sub_category, SUM(toFloat64OrZero(toString(sales))) as total_sub_cat_sales
                FROM rb_ms_olap
                WHERE ${baseMsConds.join(' AND ').replace(startDate.format('YYYY-MM-DD'), momStartDate.format('YYYY-MM-DD')).replace(endDate.format('YYYY-MM-DD'), momEndDate.format('YYYY-MM-DD'))} AND category IS NOT NULL AND category != ''
                GROUP BY category
            `)
        ]);
        subCategorySalesQuery.forEach(r => {
            if (r.sub_category) {
                const lowKey = r.sub_category.toLowerCase();
                const existing = categoryTotalSalesMap.get(lowKey) || 0;
                categoryTotalSalesMap.set(lowKey, existing + parseFloat(r.total_sub_cat_sales || 0));
            }
        });
        subCategorySalesQueryPrev.forEach(r => {
            if (r.sub_category) {
                const lowKey = r.sub_category.toLowerCase();
                const existing = categoryTotalSalesMapPrev.get(lowKey) || 0;
                categoryTotalSalesMapPrev.set(lowKey, existing + parseFloat(r.total_sub_cat_sales || 0));
            }
        });

        console.log(`[getCompetitionData] Got category sales data(${categoryTotalSalesMap.size} total, ${categoryOurBrandsSalesMap.size} our brands) from rb_brand_ms`);


        // 4. Calculate metrics for each brand
        const calcChange = (current, previous) => previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
        const calcPPChange = (current, previous) => (parseFloat(current) || 0) - (parseFloat(previous) || 0);

        const brandMetrics = currentBrands.map(brand => {
            const brandCategory = brand.brand_category || '';
            const prevBrand = prevMap.get(brand.Brand) || {};

            // Calculate OSA (On-Shelf Availability)
            const hasOsaData = osaMap.has(brand.Brand);
            const osaBrand = hasOsaData ? osaMap.get(brand.Brand) : { neno: 0, deno: 0 };
            const osa = hasOsaData ? (osaBrand.deno > 0 ? (osaBrand.neno / osaBrand.deno) * 100 : 0) : null;
            const prevOsaDeno = parseFloat(prevBrand.deno_osa_sum || 0);
            const prevOsaNeno = parseFloat(prevBrand.neno_osa_sum || 0);
            const osaPrev = prevOsaDeno > 0 ? (prevOsaNeno / prevOsaDeno) * 100 : 0;
            const osaDelta = osa === null ? null : calcChange(osa, osaPrev);

            // Calculate SOS (Share of Search) - using rb_kw_olap logic
            const bNameLower = brand.Brand?.toLowerCase();
            const hasSosData = sosNenoMap.has(bNameLower);
            const neno = hasSosData ? sosNenoMap.get(bNameLower) : 0;
            const sos = hasSosData ? (sosDeno > 0 ? (neno / sosDeno) * 100 : 0) : null;

            const nenoPrev = sosNenoMapPrev.get(bNameLower) || 0;
            const sosPrev = sosDenoPrev > 0 ? (nenoPrev / sosDenoPrev) * 100 : 0;
            const sosDelta = sos === null ? null : calcPPChange(sos, sosPrev);

            // Pricing Metrics
            const discount = parseFloat(brand.avg_discount || 0);
            const prevDiscount = parseFloat(prevBrand.avg_discount || 0);
            const discountDelta = calcChange(discount, prevDiscount);

            const sumSellingPrice = parseFloat(brand.sum_selling_price || 0);
            const sumWeight = parseFloat(brand.sum_weight || 0);
            const pricePerUnit = sumWeight > 0 ? sumSellingPrice / sumWeight : 0;

            const prevSumSellingPrice = parseFloat(prevBrand.sum_selling_price || 0);
            const prevSumWeight = parseFloat(prevBrand.sum_weight || 0);
            const prevPricePerUnit = prevSumWeight > 0 ? prevSumSellingPrice / prevSumWeight : 0;
            const pricePerUnitDelta = calcChange(pricePerUnit, prevPricePerUnit);

            const avgSellingPrice = parseFloat(brand.avg_selling_price || 0);
            const prevAvgSellingPrice = parseFloat(prevBrand.avg_selling_price || 0);
            const aspDelta = calcChange(avgSellingPrice, prevAvgSellingPrice);

            const avgMrp = parseFloat(brand.avg_mrp || 0);
            const rpi = avgMrp > 0 ? (avgSellingPrice / avgMrp) : 0;
            const prevAvgMrp = parseFloat(prevBrand.avg_mrp || 0);
            const prevRpi = prevAvgMrp > 0 ? (prevAvgSellingPrice / prevAvgMrp) : 0;
            const rpiDelta = calcChange(rpi, prevRpi);

            const brandLower = brand.Brand?.toLowerCase() || '';
            const brandSales = brandAbsoluteSalesMap.get(brandLower) || 0;
            const brandSalesPrev = brandAbsoluteSalesMapPrev.get(brandLower) || 0;

            const hasMsData = brandSalesMap.has(brandLower);

            // Market Share: Individual brand's share = brand's sales / total platform sales
            const marketShare = hasMsData ? (brandSalesMap.get(brandLower) || 0) : null;
            const marketSharePrev = brandSalesMapPrev.get(brandLower) || 0;
            const marketShareDelta = marketShare === null ? null : calcChange(marketShare, marketSharePrev);

            // Category Share: Individual brand's share in its specific category
            const lowerBrandCat = brandCategory.toLowerCase();
            const categoryTotalSales = categoryTotalSalesMap.get(lowerBrandCat) || 0;
            const categoryShare = hasMsData ? (categoryTotalSales > 0 ? (brandSales / categoryTotalSales) * 100 : 0) : null;
            const categoryTotalSalesPrev = categoryTotalSalesMapPrev.get(lowerBrandCat) || 0;
            const categorySharePrev = categoryTotalSalesPrev > 0 ? (brandSalesPrev / categoryTotalSalesPrev) * 100 : 0;
            const categoryShareDelta = categoryShare === null ? null : calcChange(categoryShare, categorySharePrev);

            // Listing Percent
            const listingPercent = parseFloat(brand.avg_listing_percent || 0);
            const prevListingPercent = parseFloat(prevBrand.avg_listing_percent || 0);
            const listingPercentDelta = calcChange(listingPercent, prevListingPercent);

            return {
                brand_name: brand.Brand,
                brand: brand.Brand,
                OSA: { value: osa === null ? null : parseFloat(osa.toFixed(2)), delta: osaDelta === null ? null : parseFloat(osaDelta.toFixed(2)) },
                SOS: { value: sos === null ? null : parseFloat(sos.toFixed(3)), delta: sosDelta === null ? null : parseFloat(sosDelta.toFixed(3)) },
                Discount: { value: parseFloat(discount.toFixed(2)), delta: parseFloat(discountDelta.toFixed(2)) },
                'Promo-My': { value: parseFloat(discount.toFixed(2)), delta: parseFloat(discountDelta.toFixed(2)) },
                'PromoMy': { value: parseFloat(discount.toFixed(2)), delta: parseFloat(discountDelta.toFixed(2)) },
                PricePerUnit: { value: parseFloat(pricePerUnit.toFixed(2)), delta: parseFloat(pricePerUnitDelta.toFixed(2)) },
                ASP: { value: parseFloat(avgSellingPrice.toFixed(0)), delta: parseFloat(aspDelta.toFixed(2)) },
                RPI: { value: parseFloat(rpi.toFixed(2)), delta: parseFloat(rpiDelta.toFixed(2)) },
                // Legacy key for compat if needed
                Price: { value: parseFloat(avgSellingPrice.toFixed(0)), delta: parseFloat(aspDelta.toFixed(2)) },
                CategoryShare: { value: categoryShare === null ? null : parseFloat(categoryShare.toFixed(2)), delta: categoryShareDelta === null ? null : parseFloat(categoryShareDelta.toFixed(2)) },
                MarketShare: { value: marketShare === null ? null : parseFloat(marketShare.toFixed(2)), delta: marketShareDelta === null ? null : parseFloat(marketShareDelta.toFixed(2)) },
                ListingPercent: { value: parseFloat(listingPercent.toFixed(2)), delta: parseFloat(listingPercentDelta.toFixed(2)) },
                Assortment: { value: parseInt(brand.assortment || 0), delta: 0 },
                Listing: { value: parseFloat(listingPercent.toFixed(2)), delta: parseFloat(listingPercentDelta.toFixed(2)) }
            };
        });

        // 5. Sort by OSA descending and limit to top 10
        brandMetrics.sort((a, b) => (b.OSA?.value || 0) - (a.OSA?.value || 0));
        const topBrands = brandMetrics.slice(0, 10);

        console.log(`[getCompetitionData] Returning ${topBrands.length} brands`);

        // If no brands found, help user debug by showing available values
        if (topBrands.length === 0 && (location !== 'All' || category !== 'All')) {
            console.log('[getCompetitionData] 🔍 Debugging: Fetching available locations and categories...');

            try {
                const [availableLocations, availableCategories, availableBrands] = await Promise.all([
                    queryClickHouse(`SELECT DISTINCT ${src.f.location} as location FROM ${src.table} WHERE ${src.f.location} IS NOT NULL AND ${src.f.location} != '' LIMIT 10`),
                    queryClickHouse(`SELECT DISTINCT ${src.f.category} as category FROM ${src.table} WHERE ${src.f.category} != 'Others' LIMIT 10`),
                    queryClickHouse(`SELECT DISTINCT ${src.f.brand} as brand FROM ${src.table} WHERE ${src.f.brand} IS NOT NULL AND ${src.f.brand} != '' LIMIT 30`)
                ]);

                console.log('[getCompetitionData] 📍 Available locations (sample):',
                    availableLocations.map(l => l.location).join(', '));
                console.log('[getCompetitionData] 🏷️ Available categories (sample):',
                    availableCategories.map(c => c.category).join(', '));
                console.log('[getCompetitionData] 🏢 Available brands (sample):',
                    availableBrands.map(b => b.brand).join(', '));
            } catch (debugError) {
                console.error('[getCompetitionData] Error fetching debug info:', debugError.message);
            }
        }

        // 6. Get SKU competition data using ClickHouse
        // Note: Use OSA-based filtering since competitor products may not have sales data
        console.log('[getCompetitionData] Fetching SKU data with same filters...');

        const [currentSkus, skuOsaData, skuOsaDataPrev] = await Promise.all([
            queryClickHouse(`
                SELECT ${src.f.product} as Product, ${src.f.brand} as Brand,
            any(${src.f.category}) as sku_category,
            SUM(${src.f.sales}) as total_sales,
            SUM(${src.f.impressions}) as total_impressions,
            AVG(${src.f.mrp}) as avg_price,
            SUM(${src.f.neno}) as neno_osa_sum,
            SUM(${src.f.deno}) as deno_osa_sum,
            AVG(${src.f.discount}) as avg_discount,
            AVG(${src.f.listingPercent}) as avg_listing_percent
                FROM ${src.table}
                WHERE ${currConds}
                GROUP BY Product, Brand
            `),
            queryClickHouse(`
                SELECT ${src.f.product} as Product,
            SUM(${src.f.sales}) as total_sales,
            SUM(${src.f.spend}) as total_spend,
            SUM(${src.f.adSales}) as total_Ad_sales,
            SUM(${src.f.impressions}) as total_impressions,
            AVG(${src.f.mrp}) as avg_price,
            SUM(${src.f.neno}) as neno_osa_sum,
            SUM(${src.f.deno}) as deno_osa_sum,
            AVG(${src.f.discount}) as avg_discount,
            AVG(${src.f.listingPercent}) as avg_listing_percent
                FROM ${src.table}
                WHERE ${currConds}
                GROUP BY Product
            `),
            queryClickHouse(`
                SELECT ${src.f.product} as Product,
            SUM(${src.f.sales}) as total_sales,
            SUM(${src.f.spend}) as total_spend,
            SUM(${src.f.adSales}) as total_Ad_sales,
            SUM(${src.f.impressions}) as total_impressions,
            AVG(${src.f.mrp}) as avg_price,
            SUM(${src.f.neno}) as neno_osa_sum,
            SUM(${src.f.deno}) as deno_osa_sum,
            AVG(${src.f.discount}) as avg_discount,
            AVG(${src.f.listingPercent}) as avg_listing_percent
                FROM ${src.table}
                WHERE ${momConds}
                GROUP BY Product
            `)
        ]);

        console.log(`[getCompetitionData] SKU query returned ${currentSkus.length} products`);

        const skuOsaMap = new Map(skuOsaData.map(s => [s.Product, s]));
        const skuOsaMapPrev = new Map(skuOsaDataPrev.map(s => [s.Product, s]));

        const totalSkuSales = currentSkus.reduce((sum, s) => sum + parseFloat(s.total_sales || 0), 0);
        const totalSkuImpressions = currentSkus.reduce((sum, s) => sum + parseFloat(s.total_impressions || 0), 0);
        const totalSkuImpressionsPrev = skuOsaDataPrev.reduce((sum, s) => sum + parseFloat(s.total_impressions || 0), 0);

        // Calculate SKU metrics with new KPIs
        const skuMetrics = currentSkus.map(sku => {
            const impressions = parseFloat(sku.total_impressions || 0);
            const avgPrice = parseFloat(sku.avg_price || 0);
            const skuCategory = sku.sku_category || '';
            const prevSku = skuOsaMapPrev.get(sku.Product) || {};

            // Calculate OSA 
            const hasOsaData = sku.deno_osa_sum !== undefined && sku.neno_osa_sum !== undefined;
            const nenoOsa = parseFloat(sku.neno_osa_sum || 0);
            const denoOsa = parseFloat(sku.deno_osa_sum || 0);
            const osa = hasOsaData ? (denoOsa > 0 ? (nenoOsa / denoOsa) * 100 : 0) : null;
            const prevDenoOsa = parseFloat(prevSku.deno_osa_sum || 0);
            const prevNenoOsa = parseFloat(prevSku.neno_osa_sum || 0);
            const prevOsa = prevDenoOsa > 0 ? (prevNenoOsa / prevDenoOsa) * 100 : 0;
            const osaDelta = osa === null ? null : calcChange(osa, prevOsa);

            // Calculate SOS (Share of Search)
            const prodLower = sku.Product?.toLowerCase();
            const hasSosData = skuSosNenoMap.has(prodLower);
            const skuNeno = hasSosData ? skuSosNenoMap.get(prodLower) : 0;
            const sos = hasSosData ? (sosDeno > 0 ? (skuNeno / sosDeno) * 100 : 0) : null;

            const skuNenoPrev = skuSosNenoMapPrev.get(prodLower) || 0;
            const prevSos = sosDenoPrev > 0 ? (skuNenoPrev / sosDenoPrev) * 100 : 0;
            const sosDelta = sos === null ? null : calcPPChange(sos, prevSos);

            // Calculate Price
            const prevAvgPrice = parseFloat(prevSku.avg_price || 0);
            const priceDelta = calcChange(avgPrice, prevAvgPrice);

            // Calculate SKU Market Share: SKU sales in rb_ms_olap * 100.0 / Total Category sales in rb_ms_olap
            const getSkuMarketShare = (prodName, catName, msMap, catSalesMap) => {
                if (!prodName) return null;
                const lowerProd = prodName.toLowerCase().trim();
                let item = msMap.get(lowerProd);

                if (!item) {
                    for (const [k, v] of msMap.entries()) {
                        if (lowerProd.includes(k) || k.includes(lowerProd)) {
                            item = v;
                            break;
                        }
                    }
                }

                if (!item || !item.sales || item.sales <= 0) {
                    return 0;
                }

                const skuCat = item.category || (catName ? catName.toLowerCase().trim() : '');
                let catTotal = catSalesMap.get(skuCat) || 0;
                if (catTotal === 0) {
                    catTotal = Array.from(catSalesMap.values()).reduce((sum, val) => sum + val, 0);
                }

                if (catTotal > 0) {
                    return (item.sales * 100.0) / catTotal;
                }
                return 0;
            };

            const skuMsCurr = getSkuMarketShare(sku.Product, skuCategory, skuMsMap, categoryTotalSalesMap);
            const skuMsPrev = getSkuMarketShare(sku.Product, skuCategory, skuMsMapPrev, categoryTotalSalesMapPrev);

            const totalSkuSalesVal = parseFloat(sku.total_sales || 0);
            const fallbackMs = (totalSkuSales > 0 && totalSkuSalesVal > 0) ? (totalSkuSalesVal * 100.0) / totalSkuSales : 0;
            const marketShare = (skuMsCurr !== null && skuMsCurr > 0) ? skuMsCurr : fallbackMs;
            const marketShareDelta = marketShare === null ? null : calcChange(marketShare, skuMsPrev || 0);

            // Category Share: Our brands' share in this SKU's specific category
            const lowerSkuCat = skuCategory.toLowerCase();
            const skuBrandSales = brandAbsoluteSalesMap.get(sku.Brand?.toLowerCase()) || 0;
            const skuCategoryTotalSales = categoryTotalSalesMap.get(lowerSkuCat) || 0;
            const hasMsData = brandSalesMap.has(sku.Brand?.toLowerCase()) || (marketShare !== null && marketShare > 0);
            const categoryShare = hasMsData ? (skuCategoryTotalSales > 0 ? (skuBrandSales / skuCategoryTotalSales) * 100 : 0) : null;

            const skuBrandSalesPrev = brandAbsoluteSalesMapPrev.get(sku.Brand?.toLowerCase()) || 0;
            const skuCategoryTotalSalesPrev = categoryTotalSalesMapPrev.get(lowerSkuCat) || 0;
            const categorySharePrev = skuCategoryTotalSalesPrev > 0 ? (skuBrandSalesPrev / skuCategoryTotalSalesPrev) * 100 : 0;
            const categoryShareDelta = categoryShare === null ? null : calcChange(categoryShare, categorySharePrev);

            // Listing Percent
            const skuListingPercent = parseFloat(sku.avg_listing_percent || 0);
            const prevSkuListingPercent = parseFloat(prevSku.avg_listing_percent || 0);
            const skuListingPercentDelta = calcChange(skuListingPercent, prevSkuListingPercent);

            return {
                sku_name: sku.Product,
                brand_name: sku.Brand,
                brand: sku.Product,
                total_sales: totalSkuSalesVal,
                OSA: { value: osa === null ? null : parseFloat(osa.toFixed(2)), delta: osaDelta === null ? null : parseFloat(osaDelta.toFixed(2)) },
                SOS: { value: sos === null ? null : parseFloat(sos.toFixed(3)), delta: sosDelta === null ? null : parseFloat(sosDelta.toFixed(3)) },
                Price: { value: parseFloat(avgPrice.toFixed(0)), delta: parseFloat(priceDelta.toFixed(2)) },
                CategoryShare: { value: categoryShare === null ? null : parseFloat(categoryShare.toFixed(2)), delta: categoryShareDelta === null ? null : parseFloat(categoryShareDelta.toFixed(2)) },
                MarketShare: { value: marketShare === null ? null : parseFloat(marketShare.toFixed(2)), delta: marketShareDelta === null ? null : parseFloat(marketShareDelta.toFixed(2)) },
                'Promo-My': { value: parseFloat((sku.avg_discount || 0).toFixed(2)), delta: calcChange(sku.avg_discount || 0, prevSku.avg_discount || 0) },
                'PromoMy': { value: parseFloat((sku.avg_discount || 0).toFixed(2)), delta: calcChange(sku.avg_discount || 0, prevSku.avg_discount || 0) },
                ListingPercent: { value: parseFloat(skuListingPercent.toFixed(2)), delta: parseFloat(skuListingPercentDelta.toFixed(2)) }
            };
        });

        // Sort by Market Share descending (highest to lowest), falling back to total_sales, then OSA
        skuMetrics.sort((a, b) => {
            const msA = Number(a.MarketShare?.value ?? a.MarketShare) || 0;
            const msB = Number(b.MarketShare?.value ?? b.MarketShare) || 0;
            if (Math.abs(msB - msA) > 0.0001) return msB - msA;
            const salesA = Number(a.total_sales) || 0;
            const salesB = Number(b.total_sales) || 0;
            if (salesB !== salesA) return salesB - salesA;
            const osaA = Number(a.OSA?.value ?? a.OSA) || 0;
            const osaB = Number(b.OSA?.value ?? b.OSA) || 0;
            return osaB - osaA;
        });
        const topSkus = skuMetrics;

        console.log(`[getCompetitionData] Returning ${topBrands.length} brands and ${topSkus.length} SKUs`);

        return {
            brands: topBrands,
            skus: topSkus,  // ADDED: Return SKU data
            metadata: {
                period,
                platform,
                location,
                category,
                totalBrands: brandMetrics.length
            }
        };

    } catch (error) {
        console.error('[getCompetitionData] Error:', error);
        return {
            brands: [],
            metadata: { error: error.message }
        };
    }
};

/**
 * Get competition filter options (locations, categories, brands, and SKUs)
 * @returns {Object} { locations: [...], categories: [...], brands: [...], skus: [...] }
 */
const getCompetitionFilterOptions = async (filters = {}) => {
    try {
        const { platform = 'All', location = 'All', category = 'All', brand = 'All', context, resellerName } = filters;
        console.log('[getCompetitionFilterOptions] Cascading filters:', { platform, location, category, brand, context, resellerName });

        // Helper to escape strings for ClickHouse
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        const platArr = normalizeFilterArray(platform);
        const locArr = normalizeFilterArray(location).filter(l => l !== 'All India');
        const catArr = normalizeFilterArray(category);
        const brandArr = normalizeFilterArray(brand);

        const dbName = getCurrentDbName();
        const resellerArr = ((dbName === 'drl' || dbName === 'prestige') && resellerName && resellerName !== 'All' && resellerName !== 'all')
            ? normalizeFilterArray(resellerName)
            : null;

        const addResellerCondition = (conds) => {
            if (resellerArr && resellerArr.length > 0) {
                conds.push(`Reseller_Name IN (${resellerArr.map(r => `'${escapeStr(r)}'`).join(',')})`);
            }
        };

        const src = await getWatchtowerSource();
        // Run all queries in parallel using ClickHouse
        const [locationResults, categoryResults, brandResults, skuResults] = await Promise.all([
            // Fetch distinct locations from dynamic source
            (() => {
                const conds = [`${src.f.location} IS NOT NULL`, `${src.f.location} != ''`];
                if (platArr.length > 0) {
                    conds.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',')})`);
                }
                addResellerCondition(conds);
                return queryClickHouse(`SELECT DISTINCT ${src.f.location} as location FROM ${src.table} WHERE ${conds.join(' AND ')} ORDER BY location`);
            })(),

            // Fetch distinct product categories filtered by platform/location
            (() => {
                const conds = [];
                if (platArr.length > 0) {
                    conds.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',')})`);
                }
                if (locArr.length > 0) {
                    conds.push(`lower(${src.f.location}) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(',')})`);
                }
                const catCol = src.f.category;
                conds.push(`${catCol} IS NOT NULL`, `${catCol} != ''`, `${catCol} != 'Others'`);
                addResellerCondition(conds);
                return queryClickHouse(`SELECT DISTINCT ${catCol} as category FROM ${src.table} WHERE ${conds.length > 0 ? conds.join(' AND ') : '1=1'} ORDER BY category`);
            })(),

            // Fetch distinct brands filtered by platform/location + category
            (() => {
                const conds = [];
                if (platArr.length > 0) {
                    conds.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',')})`);
                }
                if (locArr.length > 0) {
                    conds.push(`lower(${src.f.location}) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(',')})`);
                }
                conds.push(`${src.f.brand} IS NOT NULL`, `${src.f.brand} != ''`);
                if (context === 'performance') {
                    conds.push(`toString(${src.f.compFlag}) = '0'`);
                } else {
                    conds.push(`toString(${src.f.compFlag}) IN ('0', '1')`);
                }
                if (catArr.length > 0) {
                    const catCol = src.f.category;
                    conds.push(`lower(${catCol}) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(',')})`);
                }
                addResellerCondition(conds);
                return queryClickHouse(`SELECT DISTINCT ${src.f.brand} as brand FROM ${src.table} WHERE ${conds.length > 0 ? conds.join(' AND ') : '1=1'} ORDER BY brand`);
            })(),

            // Fetch distinct SKUs from dynamic source filtered by platform/location + category + brand
            (() => {
                const conds = [];
                if (platArr.length > 0) {
                    conds.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',')})`);
                }
                if (locArr.length > 0) {
                    conds.push(`lower(${src.f.location}) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(',')})`);
                }
                if (catArr.length > 0) {
                    const catCol = src.f.category;
                    conds.push(`lower(${catCol}) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(',')})`);
                }
                if (brandArr.length > 0) {
                    conds.push(`lower(${src.f.brand}) IN (${brandArr.map(b => `'${escapeStr(b.toLowerCase())}'`).join(',')})`);
                }
                // No comp_flag filter for SKUs - show all products from rb_pdp_olap
                conds.push(`${src.f.product} IS NOT NULL`, `${src.f.product} != ''`, `${src.f.skuCode} IS NOT NULL`, `${src.f.skuCode} != ''`);
                addResellerCondition(conds);
                return queryClickHouse(`SELECT DISTINCT ${src.f.product} as skuName, toString(${src.f.skuCode}) as skuCode FROM ${src.table} WHERE ${conds.length > 0 ? conds.join(' AND ') : '1=1'} ORDER BY skuName`);
            })()
        ]);

        const locations = locationResults.map(l => l.location).filter(Boolean);
        const categories = categoryResults.map(c => c.category).filter(Boolean);
        const brands = brandResults.map(b => b.brand).filter(Boolean);
        const skuNames = skuResults.map(s => s.skuName).filter(Boolean);
        const skuCodes = skuResults.map(s => s.skuCode).filter(Boolean);

        // Ensure uniqueness
        const uniqueSkuNames = [...new Set(skuNames)];
        const uniqueSkuCodes = [...new Set(skuCodes)];

        console.log(`[getCompetitionFilterOptions] Found ${locations.length} locations, ${categories.length} categories, ${brands.length} brands, ${uniqueSkuNames.length} SKUs`);

        return {
            locations: ['All India', ...locations],
            categories,
            brands,
            skuNames: uniqueSkuNames,
            skuCodes: uniqueSkuCodes,
            skus: uniqueSkuNames
        };

    } catch (error) {
        console.error('[getCompetitionFilterOptions] Error:', error);
        return {
            locations: ['All India'],
            categories: [],
            brands: [],
            skuNames: [],
            skuCodes: []
        };
    }
};


const getLatestAvailableMonth = async (filters = {}) => {
    try {
        const {
            platform = 'All',
            brand = 'All',
            location = 'All',
            category = 'All',
            source // New optional parameter
        } = filters;

        // Helper to escape strings for ClickHouse
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // SPECIAL CASE: Content Analysis Page
        // User requested: "column name extraction_timestamp... change only in the content analysis page"
        if (source === 'content_analysis') {
            console.log("[getLatestAvailableMonth] Content Analysis source detected. Querying tb_content_score_data.");
            const contentConditions = [];

            // Note: tb_content_score_data filters are slightly different (no category column known yet)
            // But we respect platform/brand if possible.
            // Platform derived from URL usually, but let's check basic availability

            if (platform === 'Amazon') {
                contentConditions.push(`url LIKE '%amazon%'`);
            } else if (platform !== 'All') {
                // Fallback: simple text match
                contentConditions.push(`url LIKE '%${escapeStr(platform.toLowerCase())}%'`);
            }

            // Brand check - simplified for now as user just wants dates
            if (brand && brand !== 'All') {
                contentConditions.push(`lower(brand_name) = lower('${escapeStr(brand)}')`);
            }

            const contentWhere = contentConditions.length > 0 ? `WHERE ${contentConditions.join(' AND ')} ` : '';

            const contentResult = await queryClickHouse(`
                SELECT MIN(toDate(extraction_timestamp)) as minDate, MAX(toDate(extraction_timestamp)) as latestDate
                FROM tb_content_score_data
                ${contentWhere}
            `);

            const minContentDate = contentResult?.[0]?.minDate;
            const latestContentDate = contentResult?.[0]?.latestDate;
            if (!latestContentDate) return { available: false };

            const latestC = dayjs(latestContentDate);
            return {
                available: true,
                minDate: minContentDate && minContentDate !== '0000-00-00' && minContentDate !== '1970-01-01' ? dayjs(minContentDate).format('YYYY-MM-DD') : undefined,
                monthLabel: latestC.format('MMMM YYYY'),
                startDate: latestC.startOf('month').format('YYYY-MM-DD'),
                endDate: latestC.endOf('month').format('YYYY-MM-DD'),
                latestDate: latestC.format('YYYY-MM-DD'),
                defaultStartDate: latestC.startOf('month').format('YYYY-MM-DD'),
                defaultEndDate: latestC.format('YYYY-MM-DD')
            };
        }

        // Always query rb_pdp_olap directly for date range detection
        const currentDb = getCurrentDbName() || 'drl';
        const targetTable = (currentDb === 'drl' || currentDb === 'prestige') ? `${currentDb}.rb_pdp_olap` : 'rb_pdp_olap';

        const cols = await getTableColumns(targetTable);
        const r = (name) => resolveColumn(cols, name);
        const dateCol = r('DATE');
        const compFlagCol = r('Comp_flag');
        const platformCol = r('Platform');
        const brandCol = r('Brand');
        const locationCol = r('Location');

        const conditions = [`toString(${compFlagCol}) = '0'`];

        if (platform && platform !== 'All') {
            conditions.push(`lower(${platformCol}) = '${escapeStr(platform.toLowerCase())}'`);
        }

        if (brand && brand !== 'All') {
            conditions.push(`${brandCol} LIKE '%${escapeStr(brand)}%'`);
        }

        if (location && location !== 'All') {
            conditions.push(`lower(${locationCol}) = '${escapeStr(location.toLowerCase())}'`);
        }

        if (category && category !== 'All') {
            conditions.push(`lower(${PRODUCT_CATEGORY_SQL}) = '${escapeStr(category.toLowerCase())}'`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')} ` : '';

        // Query rb_pdp_olap for the latest date
        const result = await queryClickHouse(`
            SELECT MIN(toDate(${dateCol})) as minDate, MAX(toDate(${dateCol})) as latestDate
            FROM ${targetTable}
            ${whereClause}
        `);

        const minDate = result?.[0]?.minDate;
        const latestDate = result?.[0]?.latestDate;

        if (!latestDate) {
            return { available: false };
        }

        const latest = dayjs(latestDate);

        return {
            available: true,
            minDate: minDate && minDate !== '0000-00-00' && minDate !== '1970-01-01' ? dayjs(minDate).format('YYYY-MM-DD') : undefined,
            monthLabel: latest.format('MMMM YYYY'),
            startDate: latest.startOf('month').format('YYYY-MM-DD'),
            endDate: latest.endOf('month').format('YYYY-MM-DD'),
            // For date picker: actual latest date available in data
            latestDate: latest.format('YYYY-MM-DD'),
            // Default start date: 1st of the month of latest date
            defaultStartDate: latest.startOf('month').format('YYYY-MM-DD'),
            // Default end date: the actual latest date (max date in database)
            defaultEndDate: latest.format('YYYY-MM-DD')
        };

    } catch (error) {
        console.error('[getLatestAvailableMonth] Error:', error);
        return { available: false, error: error.message };
    }
};


// ==================== EXPORTS ====================


/**
 * Get KPI trends for multiple brands (Competition page)
 */
const getCompetitionBrandTrends = async (filters = {}) => {
    try {
        let { brands = 'All', skus = 'All', location = 'All', category = 'All', period = '1M', platform = 'All', msl = 'All', timeStep = 'Daily' } = filters;
        const channel = extractChannel(filters);

        // Handle "All India" -> "All" conversion
        if (location === 'All India') location = 'All';

        console.log('[getCompetitionBrandTrends] Filters:', { brands, skus, location, category, period, msl });

        const isSkuMode = skus && skus !== 'All';
        const brandList = normalizeFilterArray(brands);
        const skuList = normalizeFilterArray(skus);
        const targetList = isSkuMode ? skuList : brandList;

        // Get valid brand names from rca_sku_dim (comp_flag = 0) for Market Share calculation
        const validBrandsResult = await queryClickHouse(`
            SELECT DISTINCT brand_name 
            FROM rca_sku_dim 
            WHERE toString(comp_flag) = '0' AND brand_name IS NOT NULL AND brand_name != ''
            `);
        const validBrandNames = validBrandsResult.map(b => b.brand_name).filter(Boolean);

        // Include all unique base brands into the target list if brands is 'All' or empty
        if (!isSkuMode && validBrandNames.length > 0) {
            validBrandNames.forEach(brand => {
                if (!targetList.some(t => t.toLowerCase() === brand.toLowerCase())) {
                    targetList.unshift(brand);
                }
            });
        }

        if (targetList.length === 0) {
            return { brands: {}, metadata: { period, location, category } };
        }

        // Get the latest date from both pdp and ms tables to ensure we show the most recent data
        const [pdpMaxDateRes, msMaxDateRes] = await Promise.all([
            getCachedMaxDate(),
            queryClickHouse(`SELECT MAX(toDate(created_on)) as max_date FROM rb_ms_olap`)
        ]);
        const pdpMaxDate = dayjs(pdpMaxDateRes);
        const msMaxDate = dayjs(msMaxDateRes[0]?.max_date || '2000-01-01');
        const endDate = pdpMaxDate.isAfter(msMaxDate) ? pdpMaxDate : msMaxDate;
        let startDate;
        switch (period) {
            case '1W': startDate = endDate.subtract(7, 'days'); break;
            case '1M': startDate = endDate.subtract(1, 'month'); break;
            case '3M': startDate = endDate.subtract(3, 'month'); break;
            case '6M': startDate = endDate.subtract(6, 'month'); break;
            case '1Y': startDate = endDate.subtract(1, 'year'); break;
            default: startDate = endDate.subtract(1, 'month'); // Default 1M
        }

        const buckets = generateTimeBuckets(startDate, endDate, timeStep);

        console.log(`[getCompetitionBrandTrends] TimeStep: ${timeStep}, Buckets count: ${buckets.length}, Valid brands(comp_flag = 0): ${validBrandNames.length} `);

        const src = await getWatchtowerSource(filters);
        // Determine grouping expressions based on timeStep
        let groupExprPdp;
        let groupExprMs;
        let groupExprKw;
        let groupExprPm;

        if (timeStep === 'Monthly') {
            groupExprPdp = `formatDateTime(toDate(${src.f.date}), '%Y-%m-01')`;
            groupExprMs = `formatDateTime(toDate(created_on), '%Y-%m-01')`;
            groupExprKw = `formatDateTime(toDate(DATE), '%Y-%m-01')`;
        } else if (timeStep === 'Weekly') {
            groupExprPdp = `toYearWeek(toDate(${src.f.date}), 1)`;
            groupExprMs = `toYearWeek(toDate(created_on), 1)`;
            groupExprKw = `toYearWeek(toDate(DATE), 1)`;
        } else { // Daily
            groupExprPdp = `formatDateTime(toDate(${src.f.date}), '%Y-%m-%d')`;
            groupExprMs = `formatDateTime(toDate(created_on), '%Y-%m-%d')`;
            groupExprKw = `formatDateTime(toDate(DATE), '%Y-%m-%d')`;
        }

        const baseConds = [`toDate(${src.f.date}) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];

        const platArr = normalizeFilterArray(platform);
        const locArr = normalizeFilterArray(location);
        const catArrNorm = normalizeFilterArray(category);

        if (platArr && platArr.length > 0) {
            const platformCond = buildPlatformChannelCond(platArr, channel, src.f.platform, false, src.f.channel);
            if (platformCond) baseConds.push(platformCond);
        }

        if (locArr && locArr.length > 0) {
            baseConds.push(`lower(${src.f.location}) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
        }

        if (catArrNorm && catArrNorm.length > 0) {
            baseConds.push(`lower(${src.f.category}) IN (${catArrNorm.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
        }

        const mslArr = normalizeFilterArray(msl);
        if (mslArr && mslArr.length > 0 && src.f.msl) {
            const mslConds = mslArr.map(m => `toString(${src.f.msl}) = '${escapeStr(m)}'`).join(' OR ');
            baseConds.push(`(${mslConds})`);
        }

        // Reseller_Name filter for DRL
        const dbNameForTrends = getCurrentDbName();
        const resellerArrTrends = ((dbNameForTrends === 'drl' || dbNameForTrends === 'prestige') && filters.resellerName && filters.resellerName !== 'All')
            ? normalizeFilterArray(filters.resellerName)
            : null;
        if (resellerArrTrends && resellerArrTrends.length > 0) {
            baseConds.push(`Reseller_Name IN (${resellerArrTrends.map(r => `'${escapeStr(r)}'`).join(', ')})`);
        }

        // Market Share conditions for rb_brand_ms table (platform-level totals)
        const msBaseConds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        msBaseConds.push(`sales IS NOT NULL`);
        if (platArr && platArr.length > 0) {
            msBaseConds.push(`lower(platform) IN(${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
        }
        if (locArr && locArr.length > 0) {
            msBaseConds.push(`lower(location) IN(${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
        }
        if (catArrNorm && catArrNorm.length > 0) {
            msBaseConds.push(`lower(category) IN(${catArrNorm.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
        }

        // Category Share conditions for rb_brand_ms table (category-level totals)
        const catBaseConds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        catBaseConds.push(`sales IS NOT NULL`);
        if (platArr && platArr.length > 0) {
            catBaseConds.push(`lower(platform) IN(${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
        }
        if (locArr && locArr.length > 0) {
            catBaseConds.push(`lower(location) IN(${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
        }
        if (catArrNorm && catArrNorm.length > 0) {
            const catEscaped = catArrNorm.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ');
            catBaseConds.push(`lower(category) IN(${catEscaped})`);
        }

        // Build valid brands filter for market share numerator
        const validBrandsFilter = validBrandNames.length > 0
            ? `group_brand IN(${validBrandNames.map(b => `'${escapeStr(b)}'`).join(', ')})`
            : '1=0';

        // Build conditions for Keyword Share of Search (Denominator)
        const kwBaseConds = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        if (platArr && platArr.length > 0) {
            kwBaseConds.push(`lower(platform_name) IN(${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
        }
        if (locArr && locArr.length > 0) {
            kwBaseConds.push(`lower(location_name) IN(${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
        }
        if (catArrNorm && catArrNorm.length > 0) {
            kwBaseConds.push(`lower(keyword_category) IN(${catArrNorm.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
        }
        // Removed keyword_search_rank filter (not in actual schema)

        // Parallel queries: total impressions, total sales (MS denominator), our brands sales (MS numerator), category totals
        const [totalsData, msTotalsData, msOurBrandsData, catTotalsData, kwTotalsData] = await Promise.all([
            // Query 1: Total impressions per group from dynamic source (for SOS calculation)
            queryClickHouse(`
        SELECT
        ${groupExprPdp} as date_group,
            SUM(${src.f.impressions}) as total_impressions
                FROM ${src.table}
                WHERE ${baseConds.join(' AND ')}
                GROUP BY date_group
                ORDER BY date_group ASC
            `),
            // Query 2: Total platform sales per group from rb_ms_olap (Market Share denominator)
            queryClickHouse(`
        SELECT
        ${groupExprMs} as date_group,
            SUM(toFloat64OrZero(toString(sales))) as total_sales
                FROM rb_ms_olap
                WHERE ${msBaseConds.join(' AND ')}
                GROUP BY date_group
                ORDER BY date_group ASC
            `),
            // Query 3: Our brands (comp_flag=0) sales per group from rb_ms_olap (Market Share numerator)
            queryClickHouse(`
        SELECT
        ${groupExprMs} as date_group,
            SUM(toFloat64OrZero(toString(sales))) as our_sales
                FROM rb_ms_olap
                WHERE ${msBaseConds.join(' AND ')} AND ${validBrandsFilter}
                GROUP BY date_group
                ORDER BY date_group ASC
            `),
            // Query 4: Total category sales per group from rb_ms_olap (Category Share denominator)
            queryClickHouse(`
        SELECT
        ${groupExprMs} as date_group,
            SUM(toFloat64OrZero(toString(sales))) as total_cat_sales
                FROM rb_ms_olap
                WHERE ${catBaseConds.join(' AND ')}
                GROUP BY date_group
                ORDER BY date_group ASC
            `),
            // Query 5: Total keyword searches per group for SOS Denominator
            queryClickHouse(`
        SELECT
        ${groupExprKw} as date_group,
            COUNT(*) as total_kw
                FROM rb_kw_olap
                WHERE ${kwBaseConds.join(' AND ')}
                GROUP BY date_group
                ORDER BY date_group ASC
            `)
        ]);

        // ===================== KPI AVAILABILITY DETECTION =====================
        const pmSrc = await getPmSource();
        if (timeStep === 'Monthly') {
            groupExprPm = `formatDateTime(toDate(${pmSrc.f.date}), '%Y-%m-01')`;
        } else if (timeStep === 'Weekly') {
            groupExprPm = `toYearWeek(toDate(${pmSrc.f.date}), 1)`;
        } else {
            groupExprPm = `formatDateTime(toDate(${pmSrc.f.date}), '%Y-%m-%d')`;
        }

        const globalPmConds = [`${pmSrc.f.date} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        const pmPlatArr = normalizeFilterArray(platform);
        if (pmPlatArr && pmPlatArr.length > 0) {
            globalPmConds.push(`${pmSrc.f.platform} IN(${pmPlatArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
        } else {
            const platformCond = buildPlatformChannelCond(null, channel, pmSrc.f.platform, false, pmSrc.f.channel);
            if (platformCond) globalPmConds.push(platformCond);
        }
        const pmCheckResult = await queryClickHouse(`SELECT count(*) as count FROM ${pmSrc.table} WHERE ${globalPmConds.join(' AND ')}`);
        const hasPmData = parseInt(pmCheckResult[0]?.count || 0) > 0;

        const kpiAvailability = {
            pdp: totalsData.length > 0,
            ms: msTotalsData.length > 0,
            kw: kwTotalsData.length > 0,
            pm: hasPmData
        };

        // Build lookup maps for totals by date_group
        const totalsMap = new Map(totalsData.map(r => [
            String(r.date_group),
            { total_impressions: parseFloat(r.total_impressions || 0) }
        ]));

        const msTotalsMap = new Map(msTotalsData.map(r => [
            String(r.date_group),
            { total_sales: parseFloat(r.total_sales || 0) }
        ]));


        // Note: msOurBrandsData is not mapped here as we query per-brand sales inside the loop

        const catTotalsMap = new Map(catTotalsData.map(r => [
            String(r.date_group),
            { total_category_sales: parseFloat(r.total_cat_sales || 0) }
        ]));

        const kwTotalsMap = new Map(kwTotalsData.map(r => [
            String(r.date_group),
            { total_kw: parseFloat(r.total_kw || 0) }
        ]));

        console.log(`[getCompetitionBrandTrends] Got totals for timeStep ${timeStep}: ${totalsData.length} buckets impressions, ${msTotalsData.length} buckets platform sales`);

        const brandTrends = {};

        for (const targetName of targetList) {
            const src = await getWatchtowerSource(filters);
            // Build conditions for dynamic source (OSA, SOS, Price)
            const conds = [`toDate(${src.f.date}) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];

            if (platArr && platArr.length > 0) {
                const platformCond = buildPlatformChannelCond(platArr, channel, src.f.platform, false, src.f.channel);
                if (platformCond) conds.push(platformCond);
            }

            const locArr = normalizeFilterArray(location);
            if (locArr && locArr.length > 0) {
                conds.push(`${src.f.location} IN(${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
            }

            if (catArrNorm && catArrNorm.length > 0) {
                conds.push(`lower(${src.f.category}) IN (${catArrNorm.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
            }

            if (mslArr && mslArr.length > 0 && src.f.msl) {
                const mslConds = mslArr.map(m => `toString(${src.f.msl}) = '${escapeStr(m)}'`).join(' OR ');
                conds.push(`(${mslConds})`);
            }

            if (isSkuMode) {
                // In SKU competition queries, group by Product uses Product
                conds.push(`${src.f.product} = '${escapeStr(targetName)}'`);
            } else {
                conds.push(`${src.f.brand} = '${escapeStr(targetName)}'`);
            }

            // Build conditions to get this specific target's sales from rb_ms_olap
            let targetMsConds;
            let targetKwConds;
            const targetEscaped = escapeStr(targetName.toLowerCase());
            if (isSkuMode) {
                targetMsConds = [...msBaseConds, `lower(item_name) = '${targetEscaped}'`];
                targetKwConds = [...kwBaseConds, `lower(keyword_search_product) LIKE '%${targetEscaped}%'`];
            } else {
                targetMsConds = [...msBaseConds, `lower(group_brand) = '${targetEscaped}'`];
                // For brands, search both the brand column AND the product name to handle parent brands (e.g. Snickers vs Mars)
                targetKwConds = [...kwBaseConds, `(lower(brand) = '${targetEscaped}' OR lower(keyword_search_product) LIKE '%${targetEscaped}%')`];
            }

            // 4. Query Ad Sales from rb_pm_olap for more accuracy
            const pmSrc = await getPmSource();
            const pmConds = [`${pmSrc.f.date} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
            const pmPlatArr = normalizeFilterArray(platform);
            if (pmPlatArr && pmPlatArr.length > 0) {
                pmConds.push(`${pmSrc.f.platform} IN(${pmPlatArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
            } else {
                const platformCond = buildPlatformChannelCond(null, channel, pmSrc.f.platform, false, pmSrc.f.channel);
                if (platformCond) pmConds.push(platformCond);
            }

            pmConds.push(`lower(${pmSrc.f.brand}) = '${targetEscaped}'`);

            // Parallel queries: main metrics from dynamic source, sales, and PM metrics
            const [rawData, targetSalesData, targetKwData, targetPmData] = await Promise.all([
                // Query main metrics (OSA, SOS numerator, Price, Discount components)
                queryClickHouse(`
        SELECT
        ${groupExprPdp} as date_group,
            SUM(${src.f.sales}) as Offtakes,
            SUM(${src.f.spend}) as Spend,
            SUM(${src.f.adSales}) as Ad_sales,
            SUM(${src.f.neno}) as neno_osa_sum,
            SUM(${src.f.deno}) as deno_osa_sum,
            SUM(${src.f.impressions}) as Impressions,
            AVG(${src.f.mrp}) as avg_price,
            AVG(${src.f.discount}) as avg_discount,
            SUM(CASE WHEN ${src.f.mrp} > 0 THEN ${src.f.sales} ELSE 0 END) as sales_with_mrp,
            SUM(if(${src.f.mrp} > 0, ${src.f.mrp} * ${src.f.quantitySold}, 0)) as mrp_sales_valid
                    FROM ${src.table}
                    WHERE ${conds.join(' AND ')}
                    GROUP BY date_group
                    ORDER BY date_group ASC
            `),
                // Query 2: this brand's sales per group from rb_ms_olap (Market Share numerator)
                queryClickHouse(`
        SELECT
        ${groupExprMs} as date_group,
            SUM(toFloat64OrZero(toString(sales))) as target_sales
                FROM rb_ms_olap
                WHERE ${targetMsConds.join(' AND ')}
                GROUP BY date_group
                ORDER BY date_group ASC
            `),
                // Query 3: SOS numerator for this brand
                queryClickHouse(`
        SELECT
        ${groupExprKw} as date_group,
            SUM(toInt32(overall)) as count
                FROM rb_kw_olap
                WHERE ${targetKwConds.join(' AND ')}
                GROUP BY date_group
                ORDER BY date_group ASC
            `),
                // Query 4: Ad Sales from rb_pm_olap
                queryClickHouse(`
        SELECT
        ${groupExprPm} as date_group,
                    SUM(${pmSrc.f.adSales}) as pm_ad_sales
                FROM ${pmSrc.table}
                WHERE ${pmConds.join(' AND ')}
                GROUP BY date_group
            `)
            ]);

            // Build lookup map for this target's sales per group
            const targetSalesMap = new Map(targetSalesData.map(r => [
                String(r.date_group),
                parseFloat(r.target_sales || 0)
            ]));

            const targetKwMap = new Map(targetKwData.map(r => [
                String(r.date_group),
                parseFloat(r.count || 0)
            ]));

            const targetPmMap = new Map(targetPmData.map(r => [
                String(r.date_group),
                parseFloat(r.pm_ad_sales || 0)
            ]));

            const rawDataMap = new Map(rawData.map(r => [String(r.date_group), r]));

            brandTrends[targetName] = buckets.map(b => {
                const groupKeyStr = String(b.groupKey);
                const row = rawDataMap.get(groupKeyStr) || {};
                const nenoOsa = parseFloat(row.neno_osa_sum || 0);
                const denoOsa = parseFloat(row.deno_osa_sum || 0);
                const avgPrice = row.avg_price ? parseFloat(row.avg_price) : null;

                // Calculate OSA
                const osa = denoOsa > 0 ? ((nenoOsa / denoOsa) * 100) : null;

                // Calculate Discount
                const avgDiscount = row.avg_discount ? parseFloat(row.avg_discount) : null;
                let discount = avgDiscount !== null ? Math.max(0, Math.min(100, avgDiscount)) : null;

                // Get totals for this group (use String() for consistent key format)
                const msTotals = msTotalsMap.get(groupKeyStr) || { total_sales: 0 };
                const catTotals = catTotalsMap.get(groupKeyStr) || { total_category_sales: 0 };
                const kwTotals = kwTotalsMap.get(groupKeyStr) || { total_kw: 0 };

                const targetSales = targetSalesMap.get(groupKeyStr) || 0;
                const targetKw = targetKwMap.get(groupKeyStr) || 0;

                const sos = kwTotals.total_kw > 0 ? (targetKw / kwTotals.total_kw) * 100 : null;
                const marketShare = msTotals.total_sales > 0 ? (targetSales / msTotals.total_sales) * 100 : null;
                const categoryShare = catTotals.total_category_sales > 0 ? (targetSales / catTotals.total_category_sales) * 100 : null;

                // 2. Inorganic Sales (Ad Sales from PM / Total Sales * 100)
                const totalSales = row.Offtakes || 0;
                const pmAdSales = targetPmMap.get(groupKeyStr) || 0;
                const inorganicSales = totalSales > 0 ? (pmAdSales / totalSales) * 100 : null;

                const hasPdpBucketData = rawDataMap.has(groupKeyStr);
                const hasPmBucketData = targetPmMap.has(groupKeyStr);
                const hasKwBucketData = kwTotalsMap.has(groupKeyStr);
                const hasMsBucketData = msTotalsMap.has(groupKeyStr);

                return {
                    date: b.label,
                    // Capitalized for TrendsCompetitionDrawer compatibility
                    OSA: (kpiAvailability.pdp && hasPdpBucketData && osa !== null) ? parseFloat(osa.toFixed(2)) : null,
                    osa: (kpiAvailability.pdp && hasPdpBucketData && osa !== null) ? parseFloat(osa.toFixed(2)) : null,
                    SOS: (kpiAvailability.kw && hasKwBucketData && sos !== null) ? parseFloat(sos.toFixed(2)) : null,
                    sos: (kpiAvailability.kw && hasKwBucketData && sos !== null) ? parseFloat(sos.toFixed(2)) : null,
                    Price: (kpiAvailability.pdp && hasPdpBucketData && avgPrice !== null) ? parseFloat(avgPrice.toFixed(0)) : null,
                    price: (kpiAvailability.pdp && hasPdpBucketData && avgPrice !== null) ? parseFloat(avgPrice.toFixed(0)) : null,
                    'Promo-My': (kpiAvailability.pdp && hasPdpBucketData && discount !== null) ? parseFloat(discount.toFixed(2)) : null,
                    'promo-my': (kpiAvailability.pdp && hasPdpBucketData && discount !== null) ? parseFloat(discount.toFixed(2)) : null,
                    'PromoMy': (kpiAvailability.pdp && hasPdpBucketData && discount !== null) ? parseFloat(discount.toFixed(2)) : null,
                    CategoryShare: (kpiAvailability.ms && hasMsBucketData && categoryShare !== null) ? parseFloat(categoryShare.toFixed(2)) : null,
                    categoryShare: (kpiAvailability.ms && hasMsBucketData && categoryShare !== null) ? parseFloat(categoryShare.toFixed(2)) : null,
                    MarketShare: (kpiAvailability.ms && hasMsBucketData && marketShare !== null) ? parseFloat(marketShare.toFixed(2)) : null,
                    marketShare: (kpiAvailability.ms && hasMsBucketData && marketShare !== null) ? parseFloat(marketShare.toFixed(2)) : null,
                    Offtakes: (kpiAvailability.pdp && hasPdpBucketData && row.Offtakes !== undefined) ? parseFloat(row.Offtakes) : null,
                    offtakes: (kpiAvailability.pdp && hasPdpBucketData && row.Offtakes !== undefined) ? parseFloat(row.Offtakes) : null,
                    InorganicSales: (kpiAvailability.pm && hasPmBucketData && inorganicSales !== null) ? parseFloat(inorganicSales.toFixed(2)) : null,
                    inorganicSales: (kpiAvailability.pm && hasPmBucketData && inorganicSales !== null) ? parseFloat(inorganicSales.toFixed(2)) : null
                };
            });
        }

        console.log(`[getCompetitionBrandTrends] Returning trends for ${Object.keys(brandTrends).length} entries`);

        return {
            brands: brandTrends,
            metadata: {
                period,
                location,
                category,
                count: targetList.length,
                primaryBrand: !isSkuMode && validBrandNames.length > 0 ? validBrandNames[0] : null
            },
            kpiAvailability
        };
    } catch (error) {
        console.error('[getCompetitionBrandTrends] Error:', error);
        return { brands: {}, metadata: { error: error.message }, kpiAvailability: null };
    }
};

/**
 * Get Dark Store Count from rb_location_darkstore table
 * Returns platform-level and city-level breakdown with total/listed/new counts.
 * "Listed" = status='1', "New" = store_first_seen within last 30 days.
 * @param {Object} filters - { platform, location, startDate, endDate }
 * @returns {Object} - { totalCount, byPlatform: [...] }
 */
const getDarkStoreCount = async (filters = {}) => {
    try {
        console.log('[getDarkStoreCount] Fetching dark store count with filters:', filters);

        const { platform, location } = filters;

        // Helper to escape strings for ClickHouse
        const esc = (str) => str ? str.replace(/'/g, "''") : '';

        // Build conditions
        const conds = [];
        conds.push(`pf_id IN(4, 6, 7)`);
        conds.push(`status IN('1', '2')`);

        if (platform && platform !== 'All') {
            const platformArr = Array.isArray(platform) ? platform : [platform];
            if (platformArr.length > 0) {
                conds.push(`platform IN(${platformArr.map(p => `'${esc(p)}'`).join(', ')})`);
            }
        }

        if (location && location !== 'All') {
            const locationArr = Array.isArray(location) ? location : [location];
            if (locationArr.length > 0) {
                const locCond = buildLocationQueryCond(locationArr, platform, 'location', 'platform');
                if (locCond) conds.push(locCond);
            }
        }

        const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')} ` : '';

        // ── Platform-level query ──
        const platformQuery = `
            SELECT
                platform,
                uniq(concat(toString(pincode), merchant_name)) AS total,
                uniqIf(concat(toString(pincode), merchant_name), toString(status) = '1') AS listed,
                uniqIf(concat(toString(pincode), merchant_name), store_first_seen >= today() - 30) AS new_total,
                uniqIf(concat(toString(pincode), merchant_name), store_first_seen >= today() - 30 AND toString(status) = '1') AS new_listed
            FROM rb_location_darkstore
            ${whereClause}
            GROUP BY platform
            ORDER BY total DESC
        `;

        // ── City-level query ──
        const cityQuery = `
            SELECT
                platform,
                location AS city,
                uniq(concat(toString(pincode), merchant_name)) AS total,
                uniqIf(concat(toString(pincode), merchant_name), toString(status) = '1') AS listed,
                uniqIf(concat(toString(pincode), merchant_name), store_first_seen >= today() - 30) AS new_total,
                uniqIf(concat(toString(pincode), merchant_name), store_first_seen >= today() - 30 AND toString(status) = '1') AS new_listed
            FROM rb_location_darkstore
            ${whereClause}
            GROUP BY platform, location
            ORDER BY platform, total DESC
        `;

        console.log('[getDarkStoreCount] Platform query:', platformQuery);
        console.log('[getDarkStoreCount] City query:', cityQuery);

        const [platformResults, cityResults] = await Promise.all([
            queryClickHouse(platformQuery),
            queryClickHouse(cityQuery)
        ]);

        // Group city rows by platform
        const cityMap = {};
        (cityResults || []).forEach(row => {
            if (!cityMap[row.platform]) cityMap[row.platform] = [];
            cityMap[row.platform].push({
                city: row.city || 'Unknown',
                total: parseInt(row.total) || 0,
                listed: parseInt(row.listed) || 0,
                newTotal: parseInt(row.new_total) || 0,
                newListed: parseInt(row.new_listed) || 0,
            });
        });

        // Build response
        let totalCount = 0;
        const byPlatform = (platformResults || []).map(row => {
            const total = parseInt(row.total) || 0;
            totalCount += total;
            return {
                platform: row.platform,
                total,
                listed: parseInt(row.listed) || 0,
                newTotal: parseInt(row.new_total) || 0,
                newListed: parseInt(row.new_listed) || 0,
                cities: cityMap[row.platform] || [],
            };
        });

        console.log(`[getDarkStoreCount] Total: ${totalCount}, Platforms: ${byPlatform.length}`);

        return { totalCount, byPlatform };
    } catch (error) {
        console.error('[getDarkStoreCount] Error:', error);
        return { totalCount: 0, byPlatform: [] };
    }
};

/**
 * Get Top Actions counts, KPIs and Graph data
 * @param {Object} filters - { platform, endDate }
 * @returns {Object} - { counts, kpis, graphData }
 */
const getTopActions = async (filters = {}) => {
    try {
        const { platform = 'All' } = filters;
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // Build platform array
        const platformArr = (platform && platform !== 'All')
            ? (Array.isArray(platform) ? platform : platform.split(',').map(p => p.trim()))
            : [];

        const src = await getWatchtowerSource();
        const platCondOlap = buildPlatformChannelCond(platformArr, null, src.f.platform);
        const catCol = src.f.category;
        const catArr = normalizeFilterArray(filters.category || filters.categoryOverviewCategory);
        const catCondOlap = (catArr && catArr.length > 0)
            ? `AND ${catCol} IN (${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`
            : '';

        const requestedEnd = (filters.endDate && filters.endDate !== 'null' && filters.endDate !== 'undefined')
            ? dayjs(filters.endDate).format('YYYY-MM-DD')
            : dayjs().format('YYYY-MM-DD');

        // Check for presence of data for the EXACT requested date
        const [olapCheckRes, insightCheckRes] = await Promise.all([
            queryClickHouse(`SELECT count(*) as count FROM ${src.table} WHERE ${platCondOlap} ${catCondOlap} AND toDate(${src.f.date}) = '${requestedEnd}'`),
            queryClickHouse(`SELECT count(*) as count FROM rca_watchtower_insight WHERE ${platCond} AND toDate(DATE) = '${requestedEnd}'`)
        ]);

        let hasOlapData = parseInt(olapCheckRes[0]?.count || 0) > 0;
        let hasInsightData = parseInt(insightCheckRes[0]?.count || 0) > 0;

        let endDateStr = requestedEnd;
        let insightDateStr = requestedEnd;

        // Fallback: if no data for exact date, find latest available date
        if (!hasOlapData) {
            const latestRes = await queryClickHouse(`SELECT MAX(toDate(${src.f.date})) as latest FROM ${src.table} WHERE ${platCondOlap} ${catCondOlap} `);
            if (latestRes[0]?.latest) {
                endDateStr = dayjs(latestRes[0].latest).format('YYYY-MM-DD');
                hasOlapData = true;
                console.log(`[getTopActions] No OLAP data for ${requestedEnd}, falling back to latest: ${endDateStr} `);
            }
        }
        if (!hasInsightData) {
            const latestInsightRes = await queryClickHouse(`SELECT MAX(toDate(DATE)) as latest FROM rca_watchtower_insight WHERE ${platCond} `);
            if (latestInsightRes[0]?.latest) {
                insightDateStr = dayjs(latestInsightRes[0].latest).format('YYYY-MM-DD');
                hasInsightData = true;
                console.log(`[getTopActions] No Insight data for ${requestedEnd}, falling back to latest: ${insightDateStr} `);
            }
        }

        console.log(`[getTopActions] Requested: ${requestedEnd}, Using OLAP: ${endDateStr}, Using Insight: ${insightDateStr} `);

        // 2. Basic Counts & KPIs (Refined based on user feedback)
        // NCR Filtering for the "OSA – Quick Commerce NCR" segment
        // Robust patterns to match various naming conventions including Zepto prefixes
        const ncrPatterns = [
            'Delhi', 'NCR', 'Noida', 'Gurugram', 'Gurgaon', 'Ghaziabad', 'Faridabad',
            'DEL-', 'GGN-', 'NOD-', 'GZB-', 'FBD-'
        ];
        const ncrCondInsight = `multiSearchAnyCaseInsensitive(Darkstore_name, [${ncrPatterns.map(p => `'${escapeStr(p)}'`).join(', ')}])`;
        const ncrCondOlap = `multiSearchAnyCaseInsensitive(Location, [${ncrPatterns.map(p => `'${escapeStr(p)}'`).join(', ')}])`;

        // Store Count: distinct count of Darkstore_name from rca_watchtower_insight
        const storeQuery = `
            SELECT count(DISTINCT Darkstore_name) as count, MAX(active_dark_store) as active_stores
            FROM rca_watchtower_insight 
            WHERE ${platCond} AND toDate(DATE) = '${insightDateStr}' AND ${ncrCondInsight}
        `;

        // SKU Count: distinct count of Web_Pid from dynamic source
        const skuQuery = `
            SELECT count(DISTINCT ${src.f.skuCode}) as count, groupArray(DISTINCT ${src.f.skuCode}) as pids 
            FROM ${src.table} 
            WHERE ${buildPlatformChannelCond(platform, null, src.f.platform)} ${catCondOlap} AND toDate(${src.f.date}) = '${endDateStr}' AND ${ncrCondOlap}
        `;

        const [storeRes, skuRes] = await Promise.all([
            queryClickHouse(storeQuery),
            queryClickHouse(skuQuery)
        ]);

        const darkstoreCount = hasInsightData ? parseInt(storeRes[0]?.count || 0) : "N/A";
        const activeStoresVal = hasInsightData ? parseInt(storeRes[0]?.active_stores || 0) : "N/A";
        const skuCount = hasOlapData ? parseInt(skuRes[0]?.count || 0) : "N/A";
        const topPids = skuRes[0]?.pids ? skuRes[0].pids.slice(0, 4) : [];

        console.log(`[getTopActions] Refined Counts - OOS Stores: ${darkstoreCount}, SKUs: ${skuCount} `);

        // 3. KPIs from dynamic source
        // (src and platCondOlap already defined at top)

        // OSA %
        const osaCurrentQuery = `
            SELECT SUM(${src.f.neno}) as neno, SUM(${src.f.deno}) as deno 
            FROM ${src.table} 
            WHERE ${platCondOlap} ${catCondOlap} AND toDate(${src.f.date}) = '${endDateStr}'
            `;
        const osaPrevQuery = `
            SELECT SUM(${src.f.neno}) as neno, SUM(${src.f.deno}) as deno 
            FROM ${src.table} 
            WHERE ${platCondOlap} ${catCondOlap} AND toDate(${src.f.date}) = '${dayjs(endDateStr).subtract(7, 'day').format('YYYY-MM-DD')}'
            `;

        // Sales MTD
        const mtdStart = dayjs(endDateStr).startOf('month').format('YYYY-MM-DD');
        const salesMtdQuery = `
            SELECT SUM(${src.f.sales}) as sales 
            FROM ${src.table} 
            WHERE ${platCondOlap} ${catCondOlap} AND toDate(${src.f.date}) BETWEEN '${mtdStart}' AND '${endDateStr}'
            `;
        const lastMtdStart = dayjs(endDateStr).subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        const lastMtdEnd = dayjs(endDateStr).subtract(1, 'month').format('YYYY-MM-DD');
        const lastSalesMtdQuery = `
            SELECT SUM(${src.f.sales}) as sales 
            FROM ${src.table} 
            WHERE ${platCondOlap} ${catCondOlap} AND toDate(${src.f.date}) BETWEEN '${lastMtdStart}' AND '${lastMtdEnd}'
        `;

        const [osaCurr, osaPrev, salesCurr, salesPrev] = await Promise.all([
            queryClickHouse(osaCurrentQuery),
            queryClickHouse(osaPrevQuery),
            queryClickHouse(salesMtdQuery),
            queryClickHouse(lastSalesMtdQuery)
        ]);

        const currentOsa = osaCurr[0]?.deno > 0 ? (osaCurr[0].neno / osaCurr[0].deno) * 100 : 0;
        const previousOsa = osaPrev[0]?.deno > 0 ? (osaPrev[0].neno / osaPrev[0].deno) * 100 : 0;
        const osaDelta = currentOsa - previousOsa;

        const currentSales = parseFloat(salesCurr[0]?.sales || 0);
        const previousSales = parseFloat(salesPrev[0]?.sales || 0);
        const salesDelta = previousSales > 0 ? ((currentSales - previousSales) / previousSales) * 100 : 0;

        // Lost Sales = [(MTD Sales / currentOsa%) - MTD Sales]
        const lostSales = currentOsa > 0 ? (currentSales / (currentOsa / 100)) - currentSales : 0;

        // 4. Graph Data (7 days trend for topPids)
        const getTrend = async (startDate, endDate) => {
            if (topPids.length === 0) return [];
            const pidList = topPids.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',');
            return queryClickHouse(`
                SELECT toDate(${src.f.date}) as day, SUM(${src.f.neno}) as n, SUM(${src.f.deno}) as d
                FROM ${src.table}
                WHERE ${platCondOlap}
                  AND toDate(${src.f.date}) BETWEEN '${startDate}' AND '${endDate}'
                  AND lower(${src.f.skuCode}) IN(${pidList})
                GROUP BY day ORDER BY day ASC
            `);
        };

        const todayTrend = hasOlapData ? await getTrend(dayjs(endDateStr).subtract(6, 'day').format('YYYY-MM-DD'), endDateStr) : [];
        const weekTrend = hasOlapData ? await getTrend(dayjs(endDateStr).subtract(13, 'day').format('YYYY-MM-DD'), dayjs(endDateStr).subtract(7, 'day').format('YYYY-MM-DD')) : [];
        const monthTrend = hasOlapData ? await getTrend(dayjs(endDateStr).subtract(1, 'month').subtract(6, 'day').format('YYYY-MM-DD'), dayjs(endDateStr).subtract(1, 'month').format('YYYY-MM-DD')) : [];

        const formatGraph = (currTrend, compTrend, refDate) => {
            const labels = [];
            for (let i = 6; i >= 0; i--) {
                labels.push(dayjs(refDate).subtract(i, 'day').format('DD MMM'));
            }

            return labels.map((label, i) => {
                const c = currTrend[i]?.d > 0 ? (currTrend[i].n / currTrend[i].d) * 100 : 0;
                const p = compTrend[i]?.d > 0 ? (compTrend[i].n / compTrend[i].d) * 100 : 0;
                return { day: label, current: parseFloat(c.toFixed(2)), compare: parseFloat(p.toFixed(2)) };
            });
        };

        const result = {
            counts: { darkstoreCount, skuCount },
            kpis: {
                osa: { value: hasOlapData ? `${currentOsa.toFixed(2)}% ` : "N/A", delta: hasOlapData ? `${osaDelta >= 0 ? '+' : ''}${osaDelta.toFixed(2)}% ` : "0" },
                fillRate: { value: "Coming Soon", delta: "0" },
                salesMtd: { value: hasOlapData ? `₹${(currentSales / 10000000).toFixed(2)} Cr` : "N/A", delta: hasOlapData ? `${salesDelta >= 0 ? '+' : ''}${salesDelta.toFixed(2)}% ` : "0" },
                lostSales: { value: hasOlapData ? `₹${(lostSales / 10000000).toFixed(2)} Cr` : "N/A", delta: "" },
                activeStores: { value: activeStoresVal.toLocaleString(), delta: "" },
                heroSkus: { value: skuCount.toString(), delta: "0" }
            },
            graphData: {
                week: formatGraph(todayTrend, weekTrend, endDateStr),
                month: formatGraph(todayTrend, monthTrend, endDateStr)
            },
            metadata: { platform, endDate: endDateStr, topPids }
        };
        console.log('[getTopActions] Result generated');
        return result;

    } catch (error) {
        console.error('[getTopActions] CRITICAL ERROR:', error);
        return { counts: { darkstoreCount: 0, skuCount: 0 }, kpis: {}, graphData: { week: [], month: [] } };
    }
};

/**
 * Get OSA Deep Dive table data (city-wise breakdown)
 * @param {Object} filters - { platform, endDate }
 * @returns {Array} - Array of city objects with KPIs
 */
const getOsaDeepDive = async (filters = {}) => {
    try {
        const { platform = 'All' } = filters;
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // Build platform conditions
        const platformArr = (platform && platform !== 'All')
            ? (Array.isArray(platform) ? platform : platform.split(',').map(p => p.trim()))
            : [];

        const platCondDarkstore = platformArr.length > 0
            ? `platform IN(${platformArr.map(p => `'${escapeStr(p)}'`).join(', ')})`
            : '1=1';
        const src = await getWatchtowerSource();
        const platCondOlap = buildPlatformChannelCond(platformArr, null, src.f.platform);
        const catCol = src.f.category;
        const catCondOlapClean = (catArr && catArr.length > 0) ? `AND ${catCol} IN(${catArr.map(c => `'${escapeStr(c)}'`).join(',')})` : '';

        // Check for presence of data for the EXACT requested date
        const [olapCheckRes, insightCheckRes] = await Promise.all([
            queryClickHouse(`SELECT count(*) as count FROM ${src.table} WHERE ${platCondOlap} AND toDate(${src.f.date}) = '${requestedEnd}'`),
            queryClickHouse(`SELECT count(*) as count FROM rca_watchtower_insight WHERE ${platCondDarkstore} AND toDate(DATE) = '${requestedEnd}'`)
        ]);

        let hasOlap = parseInt(olapCheckRes[0]?.count || 0) > 0;
        let hasInsight = parseInt(insightCheckRes[0]?.count || 0) > 0;

        let endDateStr = requestedEnd;

        // Fallback: if no data for exact date, find latest available date
        if (!hasOlap) {
            const latestRes = await queryClickHouse(`SELECT MAX(toDate(${src.f.date})) as latest FROM ${src.table} WHERE ${platCondOlap} `);
            if (latestRes[0]?.latest) {
                endDateStr = dayjs(latestRes[0].latest).format('YYYY-MM-DD');
                hasOlap = true;
                console.log(`[getOsaDeepDive] No OLAP data for ${requestedEnd}, falling back to latest: ${endDateStr} `);
            }
        }
        if (!hasInsight) {
            const latestInsightRes = await queryClickHouse(`SELECT MAX(toDate(DATE)) as latest FROM rca_watchtower_insight WHERE ${platCondDarkstore} `);
            if (latestInsightRes[0]?.latest) {
                hasInsight = true;
                console.log(`[getOsaDeepDive] No Insight data for ${requestedEnd}, falling back to latest insight date`);
            }
        }

        // If still no data after fallback, return empty
        if (!hasOlap) {
            console.log(`[getOsaDeepDive] No OLAP data found at all`);
            return [];
        }
        const mtdStart = dayjs(requestedEnd).startOf('month').format('YYYY-MM-DD');

        // 2. Fetch Hero SKUs for filtering (Strict date)
        const heroSkuRes = await queryClickHouse(`
            SELECT DISTINCT lower(web_pid) as pid 
            FROM rca_watchtower_insight 
            WHERE ${platCondDarkstore} AND toDate(DATE) = '${requestedEnd}'
            `);
        const heroPids = heroSkuRes.map(r => `'${escapeStr(r.pid)}'`).join(',');
        const heroSkuFilter = heroPids ? `AND lower(${src.f.skuCode}) IN(${heroPids})` : 'AND 1=0';

        // 3. Parallel Queries for City Data
        // a) City Store Counts from rb_location_darkstore
        const storeCountQuery = `
            SELECT location, count(DISTINCT merchant_name) as count 
            FROM rb_location_darkstore 
            WHERE ${platCondDarkstore} AND toDate(created_on) <= '${endDateStr}'
            GROUP BY location
            `;

        // b) City KPIs from dynamic source (OSA, Sales, Hero SKUs)
        const cityStatsQuery = `
        SELECT
        ${src.f.location} as city,
            SUM(${src.f.neno}) as neno,
            SUM(${src.f.deno}) as deno,
            SUM(CASE WHEN toDate(${src.f.date}) BETWEEN '${mtdStart}' AND '${endDateStr}' THEN ${src.f.sales} ELSE 0 END) as sales_mtd,
            count(DISTINCT CASE WHEN toDate(${src.f.date}) = '${endDateStr}' ${heroSkuFilter} THEN ${src.f.skuCode} END) as hero_skus
            FROM ${src.table}
            WHERE ${platCondOlap} ${catCondOlapClean} AND toDate(${src.f.date}) BETWEEN '${mtdStart}' AND '${endDateStr}'
            GROUP BY city
        `;

        const [storeCounts, cityStats] = await Promise.all([
            queryClickHouse(storeCountQuery),
            queryClickHouse(cityStatsQuery)
        ]);

        // 4. Merge Results
        const cityMap = {};

        // Start with all cities from darkstore table to ensure 706 count consistency
        storeCounts.forEach(row => {
            const cityName = row.location || 'Other';
            cityMap[cityName.toLowerCase()] = {
                city: cityName,
                osa: '0.0%',
                fillRate: 'Coming Soon',
                sales: '₹0.0 Cr',
                lostSales: '₹0.0 Cr',
                heroSkus: '0',
                storeCount: row.count
            };
        });

        // Overlay with actual KPIs where available
        cityStats.forEach(row => {
            const key = row.city.toLowerCase();
            const osa = row.deno > 0 ? (row.neno / row.deno) * 100 : 0;
            const sales = parseFloat(row.sales_mtd || 0);
            const lostSales = osa > 0 ? (sales / (osa / 100)) - sales : 0;

            if (cityMap[key]) {
                cityMap[key].osa = osa.toFixed(2) + '%';
                cityMap[key].sales = `₹${(sales / 10000000).toFixed(2)} Cr`;
                cityMap[key].lostSales = `₹${(lostSales / 10000000).toFixed(2)} Cr`;
                cityMap[key].heroSkus = row.hero_skus.toString();
            } else {
                // If it's a city in OLAP but not in Darkstore list (rare), add it too
                cityMap[key] = {
                    city: row.city,
                    osa: osa.toFixed(2) + '%',
                    fillRate: 'Coming Soon',
                    sales: `₹${(sales / 10000000).toFixed(2)} Cr`,
                    lostSales: `₹${(lostSales / 10000000).toFixed(2)} Cr`,
                    heroSkus: row.hero_skus.toString(),
                    storeCount: 0
                };
            }
        });

        // Convert to array and filter out cities with 0 stores
        return Object.values(cityMap)
            .filter(c => c.storeCount > 0 || c.osa !== '0.0%')
            .sort((a, b) => b.storeCount - a.storeCount);

    } catch (error) {
        console.error('[getOsaDeepDive] Error:', error);
        return [];
    }
};

/**
 * Get RCA (Root Cause Analysis) Data
 * @param {Object} filters - { platform, category, brand, sku, month }
 * @returns {Object} - { cards: [], tree: {} }
 */
const getRcaData = async (filters = {}) => {
    try {
        const { platform = 'All', category = 'All', brand = 'All', sku = 'All', month, drilldownLevel, drilldownId, kpiCategory, activeTab = 'gainers' } = filters;
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // Calculate date range for the selected month
        let startDate, endDate;
        if (month) {
            startDate = dayjs(month).startOf('month');
            endDate = dayjs(month).endOf('month');
        } else if (filters.startDate && filters.endDate) {
            startDate = dayjs(filters.startDate);
            endDate = dayjs(filters.endDate);
        } else {
            // Fallback to latest month if not provided
            endDate = await getCachedMaxDate();
            startDate = endDate.clone().startOf('month');
        }

        const startStr = startDate.format('YYYY-MM-DD');
        const endStr = endDate.format('YYYY-MM-DD');

        // Previous period for delta calculation
        let prevStartDate, prevEndDate;
        if (filters.compareStartDate && filters.compareEndDate) {
            prevStartDate = dayjs(filters.compareStartDate);
            prevEndDate = dayjs(filters.compareEndDate);
        } else {
            // Shift back by the same duration
            const diff = endDate.diff(startDate, 'day') + 1;
            prevEndDate = startDate.subtract(1, 'day');
            prevStartDate = prevEndDate.subtract(diff - 1, 'day');
        }
        const prevStartStr = prevStartDate.format('YYYY-MM-DD');
        const prevEndStr = prevEndDate.format('YYYY-MM-DD');

        console.log(`[getRcaData] Current: ${startStr} to ${endStr}, Previous: ${prevStartStr} to ${prevEndStr} `);

        const src = await getWatchtowerSource();

        // Build conditions for dynamic source
        const buildOlapConds = (sDate, eDate) => {
            const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
            const conds = [`${dateCol} BETWEEN '${sDate}' AND '${eDate}'`];
            const platArr = normalizeFilterArray(platform);
            if (platArr && platArr.length > 0) {
                conds.push(`lower(${src.f.platform}) IN(${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
            }
            const catArr = normalizeFilterArray(category);
            if (catArr && catArr.length > 0) {
                const catCol = src.f.category;
                conds.push(`lower(${catCol}) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
            }
            if (brand && brand !== 'All' && brand !== 'All Brands') {
                conds.push(`lower(${src.f.brand}) LIKE '%${escapeStr(brand.toLowerCase())}%'`);
            }
            if (sku && sku !== 'All' && sku !== 'All SKUs') {
                conds.push(`lower(${src.f.skuCode}) = '${escapeStr(sku.toLowerCase())}'`);
            }
            return conds.join(' AND ');
        };

        // Build conditions for rb_kw_olap
        const buildKwConds = (sDate, eDate) => {
            const conds = [`toDate(DATE) BETWEEN '${sDate}' AND '${eDate}'`];
            const platArr = normalizeFilterArray(platform);
            if (platArr && platArr.length > 0) {
                conds.push(`lower(platform_name) IN(${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
            }
            if (category && category !== 'All') {
                conds.push(`lower(keyword_category) = '${escapeStr(category.toLowerCase())}'`);
            }
            return conds.join(' AND ');
        };

        // Build conditions for rb_brand_ms
        const buildMsConds = (sDate, eDate) => {
            const conds = [`toDate(created_on) BETWEEN '${sDate}' AND '${eDate}'`];
            const platArr = normalizeFilterArray(platform);
            if (platArr && platArr.length > 0) {
                conds.push(`lower(platform) IN(${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
            }
            if (category && category !== 'All') {
                conds.push(`lower(category) = '${escapeStr(category.toLowerCase())}'`);
            }
            return conds.join(' AND ');
        };

        const currOlapConds = buildOlapConds(startStr, endStr);
        const prevOlapConds = buildOlapConds(prevStartStr, prevEndStr);
        const currKwConds = buildKwConds(startStr, endStr);
        const prevKwConds = buildKwConds(prevStartStr, prevEndStr);
        const currMsConds = buildMsConds(startStr, endStr);

        // Build conditions for rb_pm_olap for keyword-level metrics
        const buildPmConds = (sDate, eDate) => {
            const conds = [`toDate(DATE) BETWEEN '${sDate}' AND '${eDate}'`];
            const platArr = normalizeFilterArray(platform);
            if (platArr && platArr.length > 0) {
                conds.push(`lower(Platform) IN(${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
            }
            if (category && category !== 'All') {
                conds.push(`lower(category) = '${escapeStr(category.toLowerCase())}'`);
            }
            if (brand && brand !== 'All' && brand !== 'All Brands') {
                conds.push(`lower(brand) LIKE '%${escapeStr(brand.toLowerCase())}%'`);
            }
            return conds.join(' AND ');
        };

        const currPmConds = buildPmConds(startStr, endStr);
        const prevPmConds = buildPmConds(prevStartStr, prevEndStr);

        // (src already defined at top)
        // The big OLAP query - get all metrics in one shot
        const olapQuery = (conds) => `
        SELECT
        SUM(${src.f.sales}) as sales,
            SUM(${src.f.quantitySold}) as qty,
            SUM(${src.f.spend}) as spend,
            SUM(${src.f.adSales}) as Ad_sales,
            SUM(${src.f.clicks}) as clicks,
            SUM(${src.f.impressions}) as impressions,
            SUM(${src.f.organicImpressions}) as organic_impressions,
            SUM(${src.f.orders}) as orders,
            SUM(${src.f.neno}) as neno,
            SUM(${src.f.deno}) as deno,
            AVG(CASE WHEN ${src.f.mrp} > 0 
                    THEN(${src.f.mrp} - ${src.f.sellingPrice}) / ${src.f.mrp} 
                    ELSE 0 END) * 100 as avg_discount,
            countIf(${src.f.deno} > 0) as listed_count,
            count() as total_count
            FROM ${src.table}
            WHERE ${conds} AND ${src.f.compFlag} = '0'
        `;

        const isBrandFiltered = brand && brand !== 'All' && brand !== 'All Brands';
        const isSkuFiltered = sku && sku !== 'All' && sku !== 'All SKUs';
        const entityCol = isSkuFiltered ? src.f.location : isBrandFiltered ? src.f.product : src.f.brand;

        const brandQuery = (conds) => `
            SELECT
                ${entityCol} as brand,
                SUM(${src.f.sales}) as sales,
                SUM(${src.f.quantitySold}) as qty,
                SUM(${src.f.impressions}) as impressions,
                SUM(${src.f.clicks}) as clicks,
                SUM(${src.f.organicImpressions}) as organic_impressions,
                SUM(${src.f.orders}) as orders,
                SUM(${src.f.neno}) as neno,
                SUM(${src.f.deno}) as deno,
                AVG(CASE WHEN ${src.f.mrp} > 0 
                        THEN(${src.f.mrp} - ${src.f.sellingPrice}) / ${src.f.mrp} 
                        ELSE 0 END) * 100 as avg_discount,
                countIf(${src.f.deno} > 0) as listed_count,
                count() as total_count,
                AVG(${src.f.listingPercent}) as avg_listing_pct
            FROM ${src.table}
            WHERE ${conds} AND ${src.f.compFlag} = '0'
            GROUP BY brand
            ORDER BY sales DESC
            LIMIT 15
        `;

        const kwQuery = (conds) => {
            const baseConditions = conds.split(' AND ');
            return `
            SELECT 
                SUM(toInt32(overall)) as total_kws,
                SUM(toInt32(organic)) as organic_kws,
                SUM(toInt32(spons)) as ad_kws,
                sumIf(toInt32(overall), toString(flag)='1') as rb_kw_olaps,
                sumIf(toInt32(organic), toString(flag)='1') as organic_rb_kw_olaps,
                sumIf(toInt32(spons), toString(flag)='1') as ad_rb_kw_olaps,
                
                -- Organic Totals (Deno)
                sumIf(toInt32(organic), keyword_type='Branded') as org_branded_deno,
                sumIf(toInt32(organic), keyword_type='Generic') as org_generic_deno,
                sumIf(toInt32(organic), keyword_type IN ('Competition', 'Competitor')) as org_comp_deno,
                
                -- Organic Brand (Neno)
                sumIf(toInt32(organic), keyword_type='Branded' AND toString(flag)='1') as org_branded_neno,
                sumIf(toInt32(organic), keyword_type='Generic' AND toString(flag)='1') as org_generic_neno,
                sumIf(toInt32(organic), keyword_type IN ('Competition', 'Competitor') AND toString(flag)='1') as org_comp_neno,
                
                -- Ad Totals (Deno)
                sumIf(toInt32(spons), keyword_type='Branded') as ad_branded_deno,
                sumIf(toInt32(spons), keyword_type='Generic') as ad_generic_deno,
                sumIf(toInt32(spons), keyword_type IN ('Competition', 'Competitor')) as ad_comp_deno,
                
                -- Ad Brand (Neno)
                sumIf(toInt32(spons), keyword_type='Branded' AND toString(flag)='1') as ad_branded_neno,
                sumIf(toInt32(spons), keyword_type='Generic' AND toString(flag)='1') as ad_generic_neno,
                sumIf(toInt32(spons), keyword_type IN ('Competition', 'Competitor') AND toString(flag)='1') as ad_comp_neno,

                -- Legacy (needed for parent nodes/meta)
                sum(CASE WHEN toString(flag) = '1' THEN toInt32(organic) ELSE 0 END) as organic_branded,
                sum(CASE WHEN toString(flag) = '0' THEN toInt32(organic) ELSE 0 END) as organic_generic,
                sum(CASE WHEN toString(flag) = '1' THEN toInt32(spons) ELSE 0 END) as ad_branded,
                sum(CASE WHEN toString(flag) = '0' THEN 0 ELSE toInt32(spons) END) as ad_comp,
                sum(CASE WHEN toString(flag) = '1' THEN toInt32(overall) ELSE 0 END) as rb_kws
            FROM rb_kw_olap
            WHERE ${baseConditions.join(' AND ')}
        `;
        };

        const brandKwQuery = (conds) => {
            const baseConditions = conds.split(' AND ');
            return `
                SELECT 
                    brand,
                    sum(toInt32(organic)) as organic_total,
                    sum(toInt32(spons)) as ad_total,
                    sum(CASE WHEN toString(flag) = '1' THEN toInt32(organic) ELSE 0 END) as organic_branded,
                    sum(CASE WHEN toString(flag) = '0' THEN toInt32(organic) ELSE 0 END) as organic_generic,
                    sum(CASE WHEN toString(flag) = '1' THEN toInt32(spons) ELSE 0 END) as ad_branded,
                    sum(CASE WHEN toString(flag) = '0' THEN 0 ELSE toInt32(spons) END) as ad_comp,
                    
                    sumIf(toInt32(organic), keyword_type='Branded') as org_branded_neno,
                    sumIf(toInt32(organic), keyword_type='Generic') as org_generic_neno,
                    sumIf(toInt32(organic), keyword_type IN ('Competition', 'Competitor')) as org_comp_neno,
                    
                    sumIf(toInt32(spons), keyword_type='Branded') as ad_branded_neno,
                    sumIf(toInt32(spons), keyword_type='Generic') as ad_generic_neno,
                    sumIf(toInt32(spons), keyword_type IN ('Competition', 'Competitor')) as ad_comp_neno
                FROM rb_kw_olap
                WHERE ${baseConditions.join(' AND ')} AND toString(flag) = '1'
                GROUP BY brand
            `;
        };

        const brandArrForMs = normalizeFilterArray(brand);
        const brandCaseWhen = brandArrForMs && brandArrForMs.length > 0
            ? `group_brand IN(${brandArrForMs.map(b => `'${escapeStr(b)}'`).join(', ')})`
            : `group_brand = '${escapeStr(brand)}'`;

        const pmKeywordQuery = (conds) => `
            SELECT 
                ifNull(keyword_type, 'Generic') as keyword_type,
                ifNull(keyword, 'N/A') as keyword,
                SUM(impressions) as total_impressions,
                SUM(if(trim(lower(brand)) = trim(lower('${escapeStr(brand)}')), impressions, 0)) as brand_impressions
            FROM rb_pm_olap
            WHERE ${conds} 
              AND keyword IS NOT NULL AND keyword != ''
            GROUP BY keyword_type, keyword
            ORDER BY total_impressions DESC
            LIMIT 100
        `;

        const topOrganicKwQuery = (conds) => `
            SELECT 
                ifNull(keyword_type, 'Generic') as keyword_type,
                ifNull(keyword, 'N/A') as keyword,
                SUM(toInt32(organic)) as total_impressions,
                SUM(if(trim(lower(brand)) = trim(lower('${escapeStr(brand)}')), toInt32(organic), 0)) as brand_impressions
            FROM rb_kw_olap
            WHERE ${conds} 
              AND keyword IS NOT NULL AND keyword != ''
            GROUP BY keyword_type, keyword
            ORDER BY total_impressions DESC
            LIMIT 100
        `;

        // Query to get impressions from rb_pm_olap grouped by keyword_type (competition, branded, generic)
        const pmImpressionsByTypeQuery = (conds) => `
            SELECT
                lower(keyword_type) as keyword_type,
                SUM(ifNull(toFloat64OrZero(toString(impressions)), 0)) as total_impressions
            FROM rb_pm_olap
            WHERE ${conds}
              AND keyword_type IS NOT NULL AND keyword_type != ''
            GROUP BY keyword_type
        `;

        if (drilldownLevel) {
            const platArr = normalizeFilterArray(platform);
            const qcPlatforms = ['blinkit', 'zepto', 'instamart', 'swiggy instamart', 'swiggy', 'dunzo'];
            const isQuickComm = platArr.some(p => qcPlatforms.includes(p.toLowerCase()) || p.toLowerCase().includes('quickcomm'));

            console.log(`[getRcaData] Drilldown Request: ${drilldownLevel} for ${drilldownId || 'ROOT'} (${kpiCategory})`);

            // Special handler for Keyword SOS KPIs (Branded/Generic/Comp Keyword)
            const kpiLower = (kpiCategory || '').toLowerCase();
            const isOrganicKeywordSOS = kpiLower.includes('organic') && kpiLower.includes('keyword') && kpiLower.includes('sos');

            if (kpiLower.includes('keyword') && !isOrganicKeywordSOS) {
                const isOrganic = kpiLower.includes('organic') ||
                    (kpiCategory || '').toLowerCase() === 'branded keyword' ||
                    (kpiCategory || '').toLowerCase() === 'generic keyword' ||
                    (kpiCategory || '').toLowerCase() === 'comp keyword';

                // Determine keyword_type filter from KPI label
                let kwTypeFilter = '';
                if (kpiLower.includes('branded')) kwTypeFilter = `AND keyword_type = 'Branded'`;
                else if (kpiLower.includes('generic')) kwTypeFilter = `AND keyword_type = 'Generic'`;
                else if (kpiLower.includes('comp')) kwTypeFilter = `AND keyword_type IN ('Competition', 'Competitor')`;

                const kwSosQuery = (sDate, eDate) => {
                    const catProp = category && category !== 'All' ? category : 'All';

                    let nameCol = 'keyword';
                    if (drilldownLevel === 'brand') nameCol = 'brand';
                    else if (drilldownLevel === 'sku') nameCol = 'keyword';
                    else if (drilldownLevel === 'location') nameCol = 'location_name';

                    const scopeBrand = filters.brandScope || filters.brand || '';

                    if (isQuickComm) {
                        const platCondPm = platArr && platArr.length > 0
                            ? `AND lower(Platform) IN(${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`
                            : '';
                        const catCondPm = catProp !== 'All'
                            ? `AND lower(category) = lower('${escapeStr(catProp)}')`
                            : '';

                        let kwTypeFilterPm = '';
                        if (kpiLower.includes('branded')) kwTypeFilterPm = `AND lower(keyword_type) = 'branded'`;
                        else if (kpiLower.includes('generic')) kwTypeFilterPm = `AND lower(keyword_type) = 'generic'`;
                        else if (kpiLower.includes('comp')) kwTypeFilterPm = `AND lower(keyword_type) IN ('competition', 'competitor')`;

                        let brandScopeCondPm = `1=1`;
                        if (kpiLower.includes('branded') && scopeBrand && scopeBrand !== 'All' && scopeBrand !== 'All Brands') {
                            brandScopeCondPm = `lower(brand) = lower('${escapeStr(scopeBrand)}')`;
                        }

                        let parentCondPm = '';
                        if (drilldownId) {
                            if (drilldownLevel === 'sku' || drilldownLevel === 'keyword') {
                                parentCondPm = `AND lower(brand) = lower('${escapeStr(drilldownId)}')`;
                            }
                        }

                        // rb_pm_olap fallback for nameCol if not available (like location)
                        const safeNameCol = (nameCol === 'location_name') ? 'brand' : nameCol;

                        const finalSql = `
                            SELECT 
                                ${safeNameCol} as name,
                                (SELECT SUM(ifNull(toFloat64OrZero(toString(impressions)), 0)) FROM rb_pm_olap WHERE DATE BETWEEN '${sDate}' AND '${eDate}' ${platCondPm} ${catCondPm} ${kwTypeFilterPm}) as total_impressions,
                                SUM(ifNull(toFloat64OrZero(toString(impressions)), 0)) as brand_impressions
                            FROM rb_pm_olap
                            WHERE DATE BETWEEN '${sDate}' AND '${eDate}'
                                ${platCondPm}
                                ${catCondPm}
                                ${kwTypeFilterPm}
                                ${parentCondPm}
                                AND ${safeNameCol} IS NOT NULL AND ${safeNameCol} != ''
                            GROUP BY name
                            HAVING brand_impressions > 0
                            ORDER BY brand_impressions DESC
                            LIMIT 50
                        `;
                        fs.appendFileSync('sql_debug.log', `\n\n--- [${new Date().toISOString()}] ---\n${finalSql}\n`);
                        return finalSql;
                    }

                    const platCond = platArr && platArr.length > 0
                        ? `AND platform_name IN(${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`
                        : '';
                    const catCond = catProp !== 'All'
                        ? `AND keyword_category = '${escapeStr(catProp)}'`
                        : '';

                    let parentCond = '';
                    let brandScopeCond = `toString(flag)='1'`;
                    if (scopeBrand && scopeBrand !== 'All' && scopeBrand !== 'All Brands') {
                        brandScopeCond = `lower(brand) = lower('${escapeStr(scopeBrand)}')`;
                    }

                    // For Comp and Generic keywords, we want category-wide SOS (don't filter brand_impressions by selected brand)
                    if (kpiLower.includes('comp') || kpiLower.includes('generic')) {
                        brandScopeCond = '1=1';
                    }

                    if (drilldownId) {
                        if (drilldownLevel === 'sku') {
                            brandScopeCond = `lower(brand) = lower('${escapeStr(drilldownId)}')`;
                        } else if (drilldownLevel === 'location') {
                            // Parent is Keyword
                            parentCond = `AND keyword = '${escapeStr(drilldownId)}'`;
                        }
                    }

                    const metricCol = isOrganic ? 'organic' : 'overall';

                    if (drilldownLevel === 'brand') {
                        return `
                            SELECT 
                                brand as name,
                                (SELECT SUM(ifNull(toInt32(${metricCol}), 0)) FROM rb_kw_olap WHERE toDate(DATE) BETWEEN '${sDate}' AND '${eDate}' ${platCond} ${catCond} ${kwTypeFilter}) as total_impressions,
                                SUM(ifNull(toInt32(${metricCol}), 0)) as brand_impressions
                            FROM rb_kw_olap
                            WHERE toDate(DATE) BETWEEN '${sDate}' AND '${eDate}'
                                ${platCond}
                                ${catCond}
                                ${kwTypeFilter}
                                AND toString(flag) = '1'
                                AND brand IS NOT NULL AND brand != ''
                            GROUP BY brand
                            HAVING brand_impressions > 0
                            ORDER BY brand_impressions DESC
                            LIMIT 50
                        `;
                    }

                    return `
                        SELECT 
                            ${nameCol} as name,
                            (SELECT SUM(ifNull(toInt32(${metricCol}), 0)) FROM rb_kw_olap WHERE toDate(DATE) BETWEEN '${sDate}' AND '${eDate}' ${platCond} ${catCond} ${kwTypeFilter}) as total_impressions,
                            sumIf(ifNull(toInt32(${metricCol}), 0), ${brandScopeCond}) as brand_impressions
                        FROM rb_kw_olap
                        WHERE toDate(DATE) BETWEEN '${sDate}' AND '${eDate}'
                            ${platCond}
                            ${catCond}
                            ${kwTypeFilter}
                            ${parentCond}
                            AND ${nameCol} IS NOT NULL AND ${nameCol} != ''
                        GROUP BY name
                        LIMIT 50
                    `;
                };

                const currSql = kwSosQuery(startStr, endStr);
                const prevSql = kwSosQuery(prevStartStr, prevEndStr);
                console.log(`[getRcaData] isQuickComm=${isQuickComm}, platArr=${JSON.stringify(platArr)}, kpiLower=${kpiLower}`);
                console.log("[getRcaData] kwSos SQL:", currSql);

                const [currKwSos, prevKwSos] = await Promise.all([
                    queryClickHouse(currSql),
                    queryClickHouse(prevSql)
                ]);

                const kwSosMap = new Map();
                currKwSos.forEach(r => {
                    const sos = parseFloat(r.total_impressions) > 0
                        ? (parseFloat(r.brand_impressions) / parseFloat(r.total_impressions)) * 100
                        : 0;
                    kwSosMap.set(r.name, { curr: sos, prev: 0 });
                });
                prevKwSos.forEach(r => {
                    const sos = parseFloat(r.total_impressions) > 0
                        ? (parseFloat(r.brand_impressions) / parseFloat(r.total_impressions)) * 100
                        : 0;
                    if (kwSosMap.has(r.name)) kwSosMap.get(r.name).prev = sos;
                    else kwSosMap.set(r.name, { curr: 0, prev: sos });
                });

                const results = Array.from(kwSosMap.entries()).map(([name, d]) => {
                    const delta = d.curr - d.prev;
                    return {
                        name,
                        currentVal: d.curr,
                        prevVal: d.prev,
                        change: (delta >= 0 ? '+' : '') + delta.toFixed(2) + '%',
                        _delta: delta
                    };
                });

                let filteredResults = results;
                if (activeTab === 'gainers') {
                    filteredResults = results.filter(r => r._delta > 0);
                    filteredResults.sort((a, b) => b._delta - a._delta);
                } else {
                    filteredResults = results.filter(r => r._delta < 0);
                    filteredResults.sort((a, b) => a._delta - b._delta);
                }

                console.log(`[getRcaData] Returning ${filteredResults.length} rows for level=${drilldownLevel}. Sample:`, filteredResults.slice(0, 3));
                return { rows: filteredResults };
            }

            const getDrilldownSQL = (conds, level, parentId) => {
                let colName = src.f.brand;
                let table = src.table;
                let dateCol = 'toDate(DATE)';

                if (level === 'sku') {
                    colName = src.f.product;
                } else if (level === 'location') {
                    colName = src.f.location;
                } else if (level === 'keyword') {
                    colName = 'keyword';
                    table = 'rb_pm_olap';
                    dateCol = 'DATE';
                }

                const drilldownParentLevel = filters.drilldownParentLevel || '';
                let parentCond = '';
                if (parentId) {
                    const safeId = escapeStr(parentId).toLowerCase();
                    if (level === 'sku') {
                        parentCond = ` AND lower(${src.f.brand}) = '${safeId}'`;
                    } else if (level === 'keyword') {
                        parentCond = ` AND lower(brand) LIKE '%${safeId}%'`;
                    } else if (level === 'location' && drilldownParentLevel === 'brand') {
                        parentCond = ` AND lower(${src.f.brand}) LIKE '%${safeId}%'`;
                    } else {
                        parentCond = ` AND lower(${src.f.product}) = '${safeId}'`;
                    }
                }

                if (level === 'keyword') {
                    const isOrganicKpi = (kpiCategory || '').toLowerCase().includes('organic');
                    const kpiLower = (kpiCategory || '').toLowerCase();
                    let flagCond = '';
                    if (isQuickComm && isOrganicKpi && table === 'rb_pm_olap') {
                        if (kpiLower.includes('branded')) flagCond = " AND lower(keyword_type) = 'branded'";
                        else if (kpiLower.includes('generic')) flagCond = " AND lower(keyword_type) = 'generic'";
                        else if (kpiLower.includes('comp')) flagCond = " AND lower(keyword_type) IN ('competition', 'competitor')";
                    } else {
                        if (kpiLower.includes('branded')) flagCond = " AND toString(flag) = '1'";
                        else if (kpiLower.includes('generic')) flagCond = " AND toString(flag) = '0'";
                        else if (kpiLower.includes('comp')) flagCond = " AND toString(flag) = '0'";
                    }

                    if (isOrganicKpi) {
                        table = isQuickComm ? 'rb_pm_olap' : 'rb_kw_olap';
                        dateCol = isQuickComm ? 'DATE' : 'toDate(DATE)';

                        // Handle column differences
                        const impCol = isQuickComm ? 'impressions' : 'organic';
                        const platCol = isQuickComm ? 'Platform' : 'platform_name';
                        const platCondDrill = isQuickComm ? `AND lower(Platform) IN(${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})` : '';
                        const catCondDrill = (category && category !== 'All') ? `AND lower(category) = lower('${escapeStr(category)}')` : '';

                        return `
                    SELECT
                    keyword as name,
                        0 as sales,
                        0 as qty,
                        SUM(ifNull(toFloat64OrZero(toString(${table}.${impCol})), 0)) as impressions,
                        SUM(ifNull(toFloat64OrZero(toString(${table}.${impCol})), 0)) as organic_impressions,
                        0 as orders,
                        0 as neno,
                        0 as deno,
                        0 as avg_discount,
                        0 as avg_listing_pct
                            FROM ${table}
                            WHERE ${dateCol} BETWEEN '${conds.match(/'(\d{4}-\d{2}-\d{2})'/g)[0].replace(/'/g, '')}' AND '${conds.match(/'(\d{4}-\d{2}-\d{2})'/g)[1].replace(/'/g, '')}'
                              AND lower(brand) LIKE '%${escapeStr(parentId).toLowerCase()}%' ${flagCond} ${platCondDrill} ${catCondDrill}
                            GROUP BY name
                            ORDER BY impressions DESC
                            LIMIT 50
                    `;
                    }

                    return `
                SELECT
                keyword as name,
                    SUM(ifNull(toFloat64OrZero(toString(ad_sales)), 0)) as sales,
                    SUM(ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0)) as qty,
                    SUM(ifNull(toFloat64OrZero(toString(impressions)), 0)) as impressions,
                    SUM(ifNull(toFloat64OrZero(toString(ad_click)), 0)) as clicks,
                    0 as organic_impressions,
                    SUM(ifNull(toFloat64OrZero(toString(ad_quantity_sold)), 0)) as orders,
                    0 as neno,
                    0 as deno,
                    0 as avg_discount,
                    0 as avg_listing_pct
                        FROM ${table}
                        WHERE ${dateCol} BETWEEN '${conds.match(/'(\d{4}-\d{2}-\d{2})'/g)[0].replace(/'/g, '')}' AND '${conds.match(/'(\d{4}-\d{2}-\d{2})'/g)[1].replace(/'/g, '')}' ${parentCond} ${flagCond}
                        GROUP BY name
                        ORDER BY impressions DESC
                        LIMIT 50
                `;
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
                AVG(CASE WHEN ${src.f.mrp} > 0 
                                THEN(${src.f.mrp} - ${src.f.sellingPrice}) / ${src.f.mrp} 
                                ELSE 0 END) * 100 as avg_discount,
                AVG(${src.f.listingPercent}) as avg_listing_pct
                    FROM ${table}
                    WHERE ${conds} ${parentCond} AND ${src.f.compFlag} = '0'
                    GROUP BY name
                    ORDER BY sales DESC
                    LIMIT 25
                `;
            };

            const [currDrill, prevDrill] = await Promise.all([
                queryClickHouse(getDrilldownSQL(buildOlapConds(startStr, endStr), drilldownLevel, drilldownId)),
                queryClickHouse(getDrilldownSQL(buildOlapConds(prevStartStr, prevEndStr), drilldownLevel, drilldownId))
            ]);

            const drillMap = new Map();
            currDrill.forEach(d => drillMap.set(d.name, { curr: d, prev: null }));
            prevDrill.forEach(d => {
                if (drillMap.has(d.name)) drillMap.get(d.name).prev = d;
                else drillMap.set(d.name, { curr: null, prev: d });
            });

            const results = Array.from(drillMap.entries()).map(([name, d]) => {
                const c = d.curr || {};
                const p = d.prev || {};

                const getVal = (obj, cat) => {
                    const isOrganicKeywordSOS = cat.includes('organic') && cat.includes('keyword') && cat.includes('sos');
                    if (cat.includes('offtake')) return parseFloat(obj.sales || 0);
                    if (cat.includes('price')) return (obj.qty > 0 ? obj.sales / obj.qty : 0);
                    if (isOrganicKeywordSOS) return parseFloat(obj.organic_impressions || obj.impressions || 0);
                    if (cat.includes('organic') && cat.includes('impression')) return parseFloat(obj.organic_impressions || 0);
                    if (cat.includes('ad') && cat.includes('impression')) return parseFloat(obj.impressions || 0);
                    if (cat.includes('impression')) return parseFloat(obj.impressions || 0) + parseFloat(obj.organic_impressions || 0);
                    if (cat.includes('conversion') || cat.includes('cvr')) return calculateConversion(obj.orders, obj.impressions, obj.clicks);
                    if (cat.includes('keyword')) return (obj.deno > 0 ? (obj.neno / obj.deno) * 100 : 0);
                    if (cat.includes('osa')) return (obj.deno > 0 ? (obj.neno / obj.deno) * 100 : 0);
                    if (cat.includes('listing')) return parseFloat(obj.avg_listing_pct || 0);
                    if (cat.includes('discount') || cat.includes('disc')) return parseFloat(obj.avg_discount || 0);
                    return parseFloat(obj.sales || 0);
                };

                const curV = getVal(c, kpiLower);
                const preV = getVal(p, kpiLower);
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

            let filteredResults = results;
            if (activeTab === 'gainers') {
                filteredResults = results.filter(r => r._delta > 0);
                filteredResults.sort((a, b) => b._delta - a._delta);
            } else {
                filteredResults = results.filter(r => r._delta < 0);
                filteredResults.sort((a, b) => a._delta - b._delta);
            }

            return { rows: filteredResults };
        }

        // Execute all queries in parallel for main tree
        const [currOlap, prevOlap, currKw, prevKw, currMs, currBrands, prevBrands, currBrandKw, prevBrandKw, currPmKw, prevPmKw, currOrgKw, prevOrgKw, currPmImpByType, prevPmImpByType] = await Promise.all([
            queryClickHouse(olapQuery(currOlapConds)),
            queryClickHouse(olapQuery(prevOlapConds)),
            queryClickHouse(kwQuery(currKwConds)),
            queryClickHouse(kwQuery(prevKwConds)),
            queryClickHouse(`
            SELECT
            SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as total_sales,
                SUM(CASE WHEN ${brandCaseWhen} THEN ifNull(toFloat64OrZero(toString(sales)), 0) ELSE 0 END) as brand_sales
                FROM rb_ms_olap
                WHERE ${currMsConds}
            `),
            queryClickHouse(brandQuery(currOlapConds)),
            queryClickHouse(brandQuery(prevOlapConds)),
            queryClickHouse(brandKwQuery(currKwConds)),
            queryClickHouse(brandKwQuery(prevKwConds)),
            queryClickHouse(pmKeywordQuery(currPmConds)),
            queryClickHouse(pmKeywordQuery(prevPmConds)),
            queryClickHouse(topOrganicKwQuery(currKwConds)),
            queryClickHouse(topOrganicKwQuery(prevKwConds)),
            queryClickHouse(pmImpressionsByTypeQuery(currPmConds)),
            queryClickHouse(pmImpressionsByTypeQuery(prevPmConds))
        ]);

        // ... build maps for BOTH ...
        const buildKwMetrics = (curr, prev) => {
            const _absDelta = (c, p) => {
                const d = c - p;
                return { val: `${d > 0 ? '+' : ''}${d.toFixed(2)}% `, isPos: d >= 0 };
            };

            const m = new Map();
            curr.forEach(r => m.set(`${r.keyword_type}_${r.keyword} `, { keyword: r.keyword, type: r.keyword_type, curr: parseFloat(r.total_impressions || 0), currBrand: parseFloat(r.brand_impressions || 0), prev: 0, prevBrand: 0 }));
            prev.forEach(r => {
                const key = `${r.keyword_type}_${r.keyword} `;
                if (m.has(key)) {
                    const existing = m.get(key);
                    existing.prev = parseFloat(r.total_impressions || 0);
                    existing.prevBrand = parseFloat(r.brand_impressions || 0);
                } else {
                    m.set(key, { keyword: r.keyword, type: r.keyword_type, curr: 0, currBrand: 0, prev: parseFloat(r.total_impressions || 0), prevBrand: parseFloat(r.brand_impressions || 0) });
                }
            });

            // Compute totals per keyword type for SOS calculation (category wide total)
            const typeTotals = { curr: {}, prev: {} };
            Array.from(m.values()).forEach(item => {
                const t = (item.type || '').toLowerCase();
                let cat = 'other';
                if (t.includes('generic')) cat = 'generic';
                else if (t.includes('brand')) cat = 'branded';
                else if (t.includes('comp')) cat = 'comp';
                typeTotals.curr[cat] = (typeTotals.curr[cat] || 0) + item.curr;
                typeTotals.prev[cat] = (typeTotals.prev[cat] || 0) + item.prev;
            });

            const gen = [], br = [], co = [];
            Array.from(m.values()).forEach(item => {
                const t = (item.type || '').toLowerCase();
                let cat = 'other';
                if (t.includes('generic')) cat = 'generic';
                else if (t.includes('brand')) cat = 'branded';
                else if (t.includes('comp')) cat = 'comp';

                // SOS Calculation:
                // - Branded keywords: Show this brand's share of the keyword search (matches modal with brand filter)
                // - Comp/Generic: Show keyword's category-wide share (matches modal with brand-less filter)
                const currentBrandVal = filters.brand || brand || '';
                const hasSelectedBrand = currentBrandVal && currentBrandVal !== 'All' && currentBrandVal !== 'All Brands';
                const useBrandMetric = cat === 'branded' && hasSelectedBrand;
                const currMetricVal = useBrandMetric ? item.currBrand : item.curr;
                const prevMetricVal = useBrandMetric ? item.prevBrand : item.prev;

                const currSos = typeTotals.curr[cat] > 0 ? (currMetricVal / typeTotals.curr[cat]) * 100 : 0;
                const prevSos = typeTotals.prev[cat] > 0 ? (prevMetricVal / typeTotals.prev[cat]) * 100 : 0;

                const obj = {
                    keyword: item.keyword,
                    current: `${currSos.toFixed(2)}% `,
                    previous: `${prevSos.toFixed(2)}% `,
                    change: _absDelta(currSos, prevSos).val,
                    isPositive: _absDelta(currSos, prevSos).isPos,
                    rawChange: currSos - prevSos,
                    rawCurrent: currSos,
                    rawPrev: prevSos
                };
                if (cat === 'generic') gen.push(obj);
                else if (cat === 'branded') br.push(obj);
                else if (cat === 'comp') co.push(obj);
            });

            // Sort by current SOS descending
            gen.sort((a, b) => b.rawCurrent - a.rawCurrent);
            br.sort((a, b) => b.rawCurrent - a.rawCurrent);
            co.sort((a, b) => b.rawCurrent - a.rawCurrent);

            return { gen, br, co };
        };

        const adKwData = buildKwMetrics(currPmKw, prevPmKw);
        const orgKwData = buildKwMetrics(currOrgKw, prevOrgKw);

        const curr = currOlap[0] || {};
        const prev = prevOlap[0] || {};
        const kwCurr = currKw[0] || {};
        const kwPrev = prevKw[0] || {};
        const ms = currMs[0] || {};

        // Parse current values
        const cSales = parseFloat(curr.sales || 0);
        const cQty = parseFloat(curr.qty || 0);
        const cImp = parseFloat(curr.impressions || 0) + parseFloat(curr.organic_impressions || 0);
        const cAdImpPdp = parseFloat(curr.impressions || 0);
        const cOrgImpPdp = parseFloat(curr.organic_impressions || 0);
        const cClicks = parseFloat(curr.clicks || 0);
        const cOrders = parseFloat(curr.orders || 0);
        const cAdSales = parseFloat(curr.Ad_sales || 0);
        const cSpend = parseFloat(curr.spend || 0);
        const cNeno = parseFloat(curr.neno || 0);
        const cDeno = parseFloat(curr.deno || 0);
        const cDiscount = parseFloat(curr.avg_discount || 0);
        const cListed = parseFloat(curr.listed_count || 0);
        const cTotal = parseFloat(curr.total_count || 1);

        // Parse previous values
        const pSales = parseFloat(prev.sales || 0);
        const pQty = parseFloat(prev.qty || 0);
        const pImp = parseFloat(prev.impressions || 0) + parseFloat(prev.organic_impressions || 0);
        const pAdImpPdp = parseFloat(prev.impressions || 0);
        const pOrgImpPdp = parseFloat(prev.organic_impressions || 0);
        const pClicks = parseFloat(prev.clicks || 0);
        const pOrders = parseFloat(prev.orders || 0);
        const pAdSales = parseFloat(prev.Ad_sales || 0);
        const pNeno = parseFloat(prev.neno || 0);
        const pDeno = parseFloat(prev.deno || 0);
        const pDiscount = parseFloat(prev.avg_discount || 0);
        const pListed = parseFloat(prev.listed_count || 0);
        const pTotal = parseFloat(prev.total_count || 1);

        // Keyword metrics
        const cTotalKw = parseFloat(kwCurr.total_kws || 0);
        const cRbKw = parseFloat(kwCurr.rb_kw_olaps || 0);
        const cOrgRbKw = parseFloat(kwCurr.organic_rb_kw_olaps || 0);
        const cAdRbKw = parseFloat(kwCurr.ad_rb_kw_olaps || 0);
        const cOrgKw = parseFloat(kwCurr.organic_kws || 0);
        const cAdKw = parseFloat(kwCurr.ad_kws || 0);
        const pTotalKw = parseFloat(kwPrev.total_kws || 0);
        const pRbKw = parseFloat(kwPrev.rb_kw_olaps || 0);
        const pOrgRbKw = parseFloat(kwPrev.organic_rb_kw_olaps || 0);
        const pAdRbKw = parseFloat(kwPrev.ad_rb_kw_olaps || 0);

        // Derived KPIs
        const cAsp = cQty > 0 ? cSales / cQty : 0;
        const pAsp = pQty > 0 ? pSales / pQty : 0;
        const cOsa = cDeno > 0 ? (cNeno / cDeno) * 100 : 0;
        const pOsa = pDeno > 0 ? (pNeno / pDeno) * 100 : 0;
        const cCvr = calculateConversion(cOrders, cImp, cClicks);
        const pCvr = calculateConversion(pOrders, pImp, pClicks);
        const cListing = cTotal > 0 ? (cListed / cTotal) * 100 : 0;
        const pListing = pTotal > 0 ? (pListed / pTotal) * 100 : 0;
        const cSos = cTotalKw > 0 ? (cRbKw / cTotalKw) * 100 : 0;
        const pSos = pTotalKw > 0 ? (pRbKw / pTotalKw) * 100 : 0;

        // Market share
        const msDenom = parseFloat(ms.total_sales || 0);
        const brandSalesMs = parseFloat(ms.brand_sales || 0);
        const marketShare = msDenom > 0 ? (brandSalesMs / msDenom) * 100 : 0;

        // Formatting helpers
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

        const formatDeltaCount = (curr, prev) => {
            const d = curr - prev;
            const sign = d > 0 ? '+' : '';
            return `${sign}${formatCount(Math.abs(d))} `;
        };

        // Calculate deltas
        const salesDelta = pctDelta(cSales, pSales);
        const aspDelta = pctDelta(cAsp, pAsp);
        const impDelta = pctDelta(cImp, pImp);
        const cvrDelta = absDelta(cCvr, pCvr);
        const osaDelta = absDelta(cOsa, pOsa);
        const listingDelta = absDelta(cListing, pListing);
        const discDelta = absDelta(cDiscount, pDiscount);
        const sosDelta = absDelta(cSos, pSos);
        const qtyDelta = pctDelta(cQty, pQty);
        const adImpDelta = pctDelta(cAdImpPdp, pAdImpPdp);
        const orgImpDelta = pctDelta(cOrgImpPdp, pOrgImpPdp);
        const orgRbDelta = pctDelta(cOrgRbKw, pOrgRbKw);
        const adRbDelta = pctDelta(cAdRbKw, pAdRbKw);

        // Helper to compute SOS (Share of Search)
        const safeSos = (neno, deno) => parseFloat(deno || 0) > 0 ? ((parseFloat(neno || 0) / parseFloat(deno || 0)) * 100).toFixed(2) : "0.00";

        // Current Period SOS
        const cOrgBrandedSos = safeSos(kwCurr.org_branded_neno, kwCurr.org_branded_deno);
        const cOrgGenericSos = safeSos(kwCurr.org_generic_neno, kwCurr.org_generic_deno);
        const cOrgCompSos = safeSos(kwCurr.org_comp_neno, kwCurr.org_comp_deno);
        const cAdBrandedSos = safeSos(kwCurr.ad_branded_neno, kwCurr.ad_branded_deno);
        const cAdGenericSos = safeSos(kwCurr.ad_generic_neno, kwCurr.ad_generic_deno);
        const cAdCompSos = safeSos(kwCurr.ad_comp_neno, kwCurr.ad_comp_deno);

        // Previous Period SOS
        const pOrgBrandedSos = safeSos(kwPrev.org_branded_neno, kwPrev.org_branded_deno);
        const pOrgGenericSos = safeSos(kwPrev.org_generic_neno, kwPrev.org_generic_deno);
        const pOrgCompSos = safeSos(kwPrev.org_comp_neno, kwPrev.org_comp_deno);
        const pAdBrandedSos = safeSos(kwPrev.ad_branded_neno, kwPrev.ad_branded_deno);
        const pAdGenericSos = safeSos(kwPrev.ad_generic_neno, kwPrev.ad_generic_deno);
        const pAdCompSos = safeSos(kwPrev.ad_comp_neno, kwPrev.ad_comp_deno);

        // Deltas
        const orgBrandedSosDelta = absDelta(parseFloat(cOrgBrandedSos), parseFloat(pOrgBrandedSos));
        const orgGenericSosDelta = absDelta(parseFloat(cOrgGenericSos), parseFloat(pOrgGenericSos));
        const orgCompSosDelta = absDelta(parseFloat(cOrgCompSos), parseFloat(pOrgCompSos));
        const adBrandedSosDelta = absDelta(parseFloat(cAdBrandedSos), parseFloat(pAdBrandedSos));
        const adGenericSosDelta = absDelta(parseFloat(cAdGenericSos), parseFloat(pAdGenericSos));
        const adCompSosDelta = absDelta(parseFloat(cAdCompSos), parseFloat(pAdCompSos));

        // Parse rb_pm_olap impressions by keyword_type (competition, branded, generic)
        const parsePmImpByType = (rows) => {
            const result = { competition: 0, branded: 0, generic: 0 };
            (rows || []).forEach(r => {
                const kt = (r.keyword_type || '').toLowerCase();
                const imp = parseFloat(r.total_impressions || 0);
                if (kt === 'competition') result.competition = imp;
                else if (kt === 'branded') result.branded = imp;
                else if (kt === 'generic') result.generic = imp;
            });
            return result;
        };
        const cPmImpTypes = parsePmImpByType(currPmImpByType);
        const pPmImpTypes = parsePmImpByType(prevPmImpByType);
        const cPmCompImp = cPmImpTypes.competition;
        const pPmCompImp = pPmImpTypes.competition;
        const cPmBrandedImp = cPmImpTypes.branded;
        const pPmBrandedImp = pPmImpTypes.branded;
        const cPmGenericImp = cPmImpTypes.generic;
        const pPmGenericImp = pPmImpTypes.generic;
        const cPmTotalImp = cPmCompImp + cPmBrandedImp + cPmGenericImp;
        const pPmTotalImp = pPmCompImp + pPmBrandedImp + pPmGenericImp;
        const pmCompImpDelta = pctDelta(cPmCompImp, pPmCompImp);
        const pmBrandedImpDelta = pctDelta(cPmBrandedImp, pPmBrandedImp);
        const pmGenericImpDelta = pctDelta(cPmGenericImp, pPmGenericImp);

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

        const kwMap = new Map();
        currBrandKw.forEach(row => {
            const b = (row.brand || '').toLowerCase();
            if (!kwMap.has(b)) kwMap.set(b, { curr: row, prev: null });
            else kwMap.get(b).curr = row;
        });
        prevBrandKw.forEach(row => {
            const b = (row.brand || '').toLowerCase();
            if (!kwMap.has(b)) kwMap.set(b, { curr: null, prev: row });
            else kwMap.get(b).prev = row;
        });

        const allNodeMetrics = Array.from(brandsMap.entries()).map(([brandName, data]) => {
            const c = data.curr || {};
            const p = data.prev || {};

            const k = kwMap.get(brandName.toLowerCase()) || { curr: {}, prev: {} };
            const kc = k.curr || {};
            const kp = k.prev || {};

            const cAspB = c.qty > 0 ? c.sales / c.qty : 0;
            const pAspB = p.qty > 0 ? p.sales / p.qty : 0;
            const cCvrB = calculateConversion(c.orders, c.impressions, c.clicks);
            const pCvrB = calculateConversion(p.orders, p.impressions, p.clicks);
            const cOsaB = c.deno > 0 ? (c.neno / c.deno) * 100 : 0;
            const pOsaB = p.deno > 0 ? (p.neno / p.deno) * 100 : 0;

            const brandOrgBrandedSos = safeSos(kc.org_branded_neno, kwCurr.org_branded_deno);
            const prevBrandOrgBrandedSos = safeSos(kp.org_branded_neno, kwPrev.org_branded_deno);

            const brandOrgGenericSos = safeSos(kc.org_generic_neno, kwCurr.org_generic_deno);
            const prevBrandOrgGenericSos = safeSos(kp.org_generic_neno, kwPrev.org_generic_deno);

            const brandOrgCompSos = safeSos(kc.org_comp_neno, kwCurr.org_comp_deno);
            const prevBrandOrgCompSos = safeSos(kp.org_comp_neno, kwPrev.org_comp_deno);

            const brandAdBrandedSos = safeSos(kc.ad_branded_neno, kwCurr.ad_branded_deno);
            const prevBrandAdBrandedSos = safeSos(kp.ad_branded_neno, kwPrev.ad_branded_deno);

            const brandAdGenericSos = safeSos(kc.ad_generic_neno, kwCurr.ad_generic_deno);
            const prevBrandAdGenericSos = safeSos(kp.ad_generic_neno, kwPrev.ad_generic_deno);

            const brandAdCompSos = safeSos(kc.ad_comp_neno, kwCurr.ad_comp_deno);
            const prevBrandAdCompSos = safeSos(kp.ad_comp_neno, kwPrev.ad_comp_deno);

            return {
                brand: brandName,
                // Direct values for dynamic tooltip columns
                offtake: formatLac(parseFloat(c.sales || 0)),
                prevOfftake: formatLac(parseFloat(p.sales || 0)),
                deltaOfftake: pctDelta(parseFloat(c.sales || 0), parseFloat(p.sales || 0)).val,

                price: `₹${cAspB.toFixed(1)} `,
                prevPrice: `₹${pAspB.toFixed(1)} `,
                deltaPrice: `${(cAspB - pAspB) > 0 ? '+' : ''}₹${Math.abs(cAspB - pAspB).toFixed(1)} `,
                rawPrice: cAspB,
                rawPrevPrice: pAspB,
                rawOfftake: parseFloat(c.sales || 0),
                rawPrevOfftake: parseFloat(p.sales || 0),

                impressions: formatCount(parseFloat(c.impressions || 0) + parseFloat(c.organic_impressions || 0)),
                deltaImpressions: formatCount((parseFloat(c.impressions || 0) + parseFloat(c.organic_impressions || 0)) - (parseFloat(p.impressions || 0) + parseFloat(p.organic_impressions || 0))),
                rawImpressions: parseFloat(c.impressions || 0) + parseFloat(c.organic_impressions || 0),
                rawPrevImpressions: parseFloat(p.impressions || 0) + parseFloat(p.organic_impressions || 0),

                // Granular keyword metrics
                organic: formatCount(parseFloat(c.organic_impressions || 0)),
                deltaOrganic: formatCount(parseFloat(c.organic_impressions || 0) - parseFloat(p.organic_impressions || 0)),
                rawOrganic: parseFloat(c.organic_impressions || 0),
                rawPrevOrganic: parseFloat(p.organic_impressions || 0),
                ad: formatCount(parseFloat(c.impressions || 0)),
                deltaAd: formatCount(parseFloat(c.impressions || 0) - parseFloat(p.impressions || 0)),
                rawAd: parseFloat(c.impressions || 0),
                rawPrevAd: parseFloat(p.impressions || 0),
                orgBranded: formatCount(parseFloat(kc.organic_branded || 0)),
                prevOrgBranded: formatCount(parseFloat(kp.organic_branded || 0)),
                deltaOrgBranded: formatDeltaCount(parseFloat(kc.organic_branded || 0), parseFloat(kp.organic_branded || 0)),

                orgGeneric: formatCount(parseFloat(kc.organic_generic || 0)),
                prevOrgGeneric: formatCount(parseFloat(kp.organic_generic || 0)),
                deltaOrgGeneric: formatDeltaCount(parseFloat(kc.organic_generic || 0), parseFloat(kp.organic_generic || 0)),

                adBranded: formatCount(parseFloat(kc.ad_branded || 0)),
                prevAdBranded: formatCount(parseFloat(kp.ad_branded || 0)),
                deltaAdBranded: formatDeltaCount(parseFloat(kc.ad_branded || 0), parseFloat(kp.ad_branded || 0)),

                adComp: formatCount(parseFloat(kc.ad_comp || 0)),
                prevAdComp: formatCount(parseFloat(kp.ad_comp || 0)),
                deltaAdComp: formatDeltaCount(parseFloat(kc.ad_comp || 0), parseFloat(kp.ad_comp || 0)),

                conversion: `${cCvrB.toFixed(1)}% `,
                prevConversion: `${pCvrB.toFixed(1)}% `,
                deltaConversion: `${(cCvrB - pCvrB) > 0 ? '+' : ''}${(cCvrB - pCvrB).toFixed(1)}% `,
                rawCvr: cCvrB,
                rawPrevCvr: pCvrB,

                discount: `${parseFloat(c.avg_discount || 0).toFixed(1)}% `,
                prevDiscount: `${parseFloat(p.avg_discount || 0).toFixed(1)}% `,
                deltaDiscount: `${(parseFloat(c.avg_discount || 0) - parseFloat(p.avg_discount || 0)) > 0 ? '+' : ''}${(parseFloat(c.avg_discount || 0) - parseFloat(p.avg_discount || 0)).toFixed(1)}% `,
                rawDiscount: parseFloat(c.avg_discount || 0),
                rawPrevDiscount: parseFloat(p.avg_discount || 0),

                osa: `${cOsaB.toFixed(1)}% `,
                prevOsa: `${pOsaB.toFixed(1)}% `,
                deltaOsa: `${(cOsaB - pOsaB) > 0 ? '+' : ''}${(cOsaB - pOsaB).toFixed(1)}% `,
                rawOsa: cOsaB,
                rawPrevOsa: pOsaB,

                // Rating and Listing specific metrics
                rating: formatCount(parseFloat(c.qty || 0)),
                prevRating: formatCount(parseFloat(p.qty || 0)),
                deltaRating: formatDeltaCount(parseFloat(c.qty || 0), parseFloat(p.qty || 0)),
                rawRating: parseFloat(c.qty || 0),
                rawPrevRating: parseFloat(p.qty || 0),

                listing: `${(c.total_count > 0 ? (c.listed_count / c.total_count) * 100 : 0).toFixed(1)}% `,
                prevListing: `${(p.total_count > 0 ? (p.listed_count / p.total_count) * 100 : 0).toFixed(1)}% `,
                deltaListing: `${((c.total_count > 0 ? (c.listed_count / c.total_count) * 100 : 0) - (p.total_count > 0 ? (p.listed_count / p.total_count) * 100 : 0)) > 0 ? '+' : ''}${((c.total_count > 0 ? (c.listed_count / c.total_count) * 100 : 0) - (p.total_count > 0 ? (p.listed_count / p.total_count) * 100 : 0)).toFixed(1)}% `,
                rawListing: c.total_count > 0 ? (c.listed_count / c.total_count) * 100 : 0,
                rawPrevListing: p.total_count > 0 ? (p.listed_count / p.total_count) * 100 : 0,

                rawOrgBrandedSos: parseFloat(brandOrgBrandedSos),
                rawPrevOrgBrandedSos: parseFloat(prevBrandOrgBrandedSos),
                rawOrgGenericSos: parseFloat(brandOrgGenericSos),
                rawPrevOrgGenericSos: parseFloat(prevBrandOrgGenericSos),
                rawOrgCompSos: parseFloat(brandOrgCompSos),
                rawPrevOrgCompSos: parseFloat(prevBrandOrgCompSos),

                rawAdBrandedSos: parseFloat(brandAdBrandedSos),
                rawPrevAdBrandedSos: parseFloat(prevBrandAdBrandedSos),
                rawAdGenericSos: parseFloat(brandAdGenericSos),
                rawPrevAdGenericSos: parseFloat(prevBrandAdGenericSos),
                rawAdCompSos: parseFloat(brandAdCompSos),
                rawPrevAdCompSos: parseFloat(prevBrandAdCompSos),

                // PPU logic placeholder
                ppu: `₹${(cAspB / 100).toFixed(1)} `,
                prevPpu: `₹${(pAspB / 100).toFixed(1)} `,
                deltaPpu: `${((cAspB - pAspB) / 100) > 0 ? '+' : ''}₹${Math.abs((cAspB - pAspB) / 100).toFixed(1)} `,

                // Legacy support for older tooltips if any
                asp: `₹${cAspB.toFixed(1)} `,
                prevAsp: `₹${pAspB.toFixed(1)} `,
                deltaAsp: `${(cAspB - pAspB) > 0 ? '+' : ''}₹${Math.abs(cAspB - pAspB).toFixed(1)} `,
            };
        });

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
            meta: [{ label: "Est. Category Share", value: `${marketShare.toFixed(2)}% `, change: sosDelta.val, isPositive: sosDelta.isPos }],
            metrics: allNodeMetrics,
            children: [
                {
                    id: "asp",
                    label: "PRICE",
                    value: `₹ ${cAsp.toFixed(2)} `,
                    prevValue: `₹ ${pAsp.toFixed(2)} `,
                    change: aspDelta.val,
                    isPositive: aspDelta.isPos,
                    category: "price",
                    importance: "primary",
                    meta: [{ label: "Baseline PRICE", value: `₹ ${pAsp.toFixed(0)} ` }],
                    metrics: allNodeMetrics
                },
                {
                    id: "indexed-impressions",
                    label: "Impressions",
                    value: formatCount(cImp),
                    prevValue: formatCount(pImp),
                    change: impDelta.val,
                    isPositive: impDelta.isPos,
                    category: "impressions",
                    importance: "primary",
                    metrics: allNodeMetrics,
                    insight: impDelta.isPos ? "High Visibility" : "Visibility Loss",
                    meta: [{ label: "Overall SOS", value: `${cSos.toFixed(2)}% `, change: sosDelta.val, isPositive: sosDelta.isPos }],
                    children: [
                        {
                            id: "availability",
                            label: "Wt. OSA %",
                            value: `${cOsa.toFixed(2)}% `,
                            prevValue: `${pOsa.toFixed(2)}% `,
                            change: osaDelta.val,
                            isPositive: osaDelta.isPos,
                            category: "availability",
                            metrics: allNodeMetrics,
                            children: [
                                {
                                    id: "listing",
                                    label: "DS Listing %",
                                    value: `${cListing.toFixed(2)}% `,
                                    prevValue: `${pListing.toFixed(2)}% `,
                                    change: listingDelta.val,
                                    isPositive: listingDelta.isPos,
                                    category: "availability",
                                    metrics: allNodeMetrics
                                }
                            ]
                        },
                        {
                            id: "organic-impressions",
                            label: "Organic Impressions",
                            value: formatCount(cOrgImpPdp),
                            prevValue: formatCount(pOrgImpPdp),
                            change: orgImpDelta.val,
                            isPositive: orgImpDelta.isPos,
                            category: "organic",
                            insight: orgImpDelta.isPos ? "Organic Pull" : "Low Ranking",
                            metrics: allNodeMetrics,
                            meta: [{ label: "Organic SOS", value: cTotalKw > 0 ? `${((cOrgRbKw / cTotalKw) * 100).toFixed(2)}% ` : "0.0%", change: orgRbDelta.val, isPositive: orgRbDelta.isPos }],
                            children: [
                                {
                                    id: "org-comp", label: "Comp Keyword", value: formatCount(cPmCompImp), prevValue: formatCount(pPmCompImp), change: pmCompImpDelta.val, isPositive: pmCompImpDelta.isPos, category: "organic", metrics: allNodeMetrics, keywordMetrics: orgKwData.co,
                                    meta: [
                                        { label: "Comp Impressions", value: formatCount(cPmCompImp), change: pmCompImpDelta.val, isPositive: pmCompImpDelta.isPos },
                                        { label: "Comp Imp%", value: `${cPmTotalImp > 0 ? ((cPmCompImp / cPmTotalImp) * 100).toFixed(2) : '0.00'}%` }
                                    ]
                                },
                                {
                                    id: "org-branded", label: "Branded Keyword", value: formatCount(cPmBrandedImp), prevValue: formatCount(pPmBrandedImp), change: pmBrandedImpDelta.val, isPositive: pmBrandedImpDelta.isPos, category: "organic", metrics: allNodeMetrics, keywordMetrics: orgKwData.br,
                                    meta: [
                                        { label: "Branded Impressions", value: formatCount(cPmBrandedImp), change: pmBrandedImpDelta.val, isPositive: pmBrandedImpDelta.isPos },
                                        { label: "Branded Imp%", value: `${cPmTotalImp > 0 ? ((cPmBrandedImp / cPmTotalImp) * 100).toFixed(2) : '0.00'}%` }
                                    ]
                                },
                                {
                                    id: "org-generic", label: "Generic Keyword", value: formatCount(cPmGenericImp), prevValue: formatCount(pPmGenericImp), change: pmGenericImpDelta.val, isPositive: pmGenericImpDelta.isPos, category: "organic", metrics: allNodeMetrics, keywordMetrics: orgKwData.gen,
                                    meta: [
                                        { label: "Generic Impressions", value: formatCount(cPmGenericImp), change: pmGenericImpDelta.val, isPositive: pmGenericImpDelta.isPos },
                                        { label: "Generic Imp%", value: `${cPmTotalImp > 0 ? ((cPmGenericImp / cPmTotalImp) * 100).toFixed(2) : '0.00'}%` }
                                    ]
                                }
                            ]
                        },
                        {
                            id: "ad-impressions",
                            label: "Ad Impressions",
                            value: formatCount(cAdImpPdp),
                            prevValue: formatCount(pAdImpPdp),
                            change: adImpDelta.val,
                            isPositive: adImpDelta.isPos,
                            category: "ad",
                            metrics: allNodeMetrics,
                            meta: [{ label: "Ad SOS", value: cTotalKw > 0 ? `${((cAdRbKw / cTotalKw) * 100).toFixed(2)}% ` : "0.0%", change: adRbDelta.val, isPositive: adRbDelta.isPos }],
                            children: [
                                { id: "ad-comp", label: "Comp Keyword", value: `${cAdCompSos}% `, prevValue: `${pAdCompSos}% `, change: adCompSosDelta.val, isPositive: adCompSosDelta.isPos, category: "ad", metrics: allNodeMetrics, keywordMetrics: adKwData.co },
                                { id: "ad-branded", label: "Branded Keyword", value: `${cAdBrandedSos}% `, prevValue: `${pAdBrandedSos}% `, change: adBrandedSosDelta.val, isPositive: adBrandedSosDelta.isPos, category: "ad", metrics: allNodeMetrics, keywordMetrics: adKwData.br },
                                { id: "ad-generic", label: "Generic Keyword", value: `${cAdGenericSos}% `, prevValue: `${pAdGenericSos}% `, change: adGenericSosDelta.val, isPositive: adGenericSosDelta.isPos, category: "ad", metrics: allNodeMetrics, keywordMetrics: adKwData.gen }
                            ]
                        }
                    ]
                },
                {
                    id: "indexed-cvr",
                    label: "Conversion",
                    value: `${cCvr.toFixed(2)}% `,
                    prevValue: `${pCvr.toFixed(2)}% `,
                    change: cvrDelta.val,
                    isPositive: cvrDelta.isPos,
                    category: "conversion",
                    importance: "outcome",
                    insight: cvrDelta.isPos ? "Conv. Efficacy" : "Conv. Drop",
                    metrics: allNodeMetrics,
                    children: [
                        {
                            id: "cvr-ad-impressions",
                            label: "Ad Impressions",
                            value: formatCount(cAdImpPdp),
                            change: adImpDelta.val,
                            isPositive: adImpDelta.isPos,
                            category: "ad",
                            metrics: allNodeMetrics,
                            meta: [{ label: "Ad SOS", value: cTotalKw > 0 ? `${((cAdRbKw / cTotalKw) * 100).toFixed(2)}% ` : "0.0%", change: adRbDelta.val, isPositive: adRbDelta.isPos }],
                            children: [
                                { id: "cvr-ad-branded", label: "Branded Keyword", value: `${cAdBrandedSos}% `, prevValue: `${pAdBrandedSos}% `, change: adBrandedSosDelta.val, isPositive: adBrandedSosDelta.isPos, category: "ad", metrics: allNodeMetrics, keywordMetrics: adKwData.br },
                                { id: "cvr-ad-comp", label: "Comp Keyword", value: `${cAdCompSos}% `, prevValue: `${pAdCompSos}% `, change: adCompSosDelta.val, isPositive: adCompSosDelta.isPos, category: "ad", metrics: allNodeMetrics, keywordMetrics: adKwData.co }
                            ]
                        },
                        { id: "cvr-discounting", label: "Wt. Disc %", value: `${cDiscount.toFixed(2)}% `, prevValue: `${pDiscount.toFixed(2)}% `, change: discDelta.val, isPositive: discDelta.isPos, category: "discounting", metrics: allNodeMetrics },
                        { id: "rating-count", label: "Rating Count", value: formatCount(cQty), prevValue: formatCount(pQty), change: qtyDelta.val, isPositive: qtyDelta.isPos, category: "rating", metrics: allNodeMetrics }
                    ]
                }
            ]
        };

        // Summary cards
        const cards = [
            { title: "Estimated Offtake", value: formatLac(cSales), change: salesDelta.val, isPositive: salesDelta.isPos },
            { title: "Estimated Category Share", value: `${marketShare.toFixed(2)}% `, change: sosDelta.val, isPositive: sosDelta.isPos },
            { title: "Avg Selling Price", value: `₹ ${cAsp.toFixed(0)} `, change: aspDelta.val, isPositive: aspDelta.isPos }
        ];

        console.log(`[getRcaData] Tree built - Offtake: ${formatLac(cSales)}, ASP: ₹${cAsp.toFixed(0)}, OSA: ${cOsa.toFixed(2)}% `);
        return { cards, tree };

    } catch (error) {
        console.error('[getRcaData] Error:', error);
        throw error;
    }
};

/**
 * Get SKU Overview Data - OPTIMIZED
 * Groups data by SKU for the Performance Matrix
 */
const getSkuOverview = async (filters) => {
    console.log('[getSkuOverview] Computing SKU overview data...');

    const { months = 1, startDate: qStartDate, endDate: qEndDate, skuOverviewPlatform } = filters;
    const channel = extractChannel(filters);

    // Extract filter values
    const rawBrand = filters['brand[]'] || filters.brand;
    const rawLocation = filters['location[]'] || filters.location;
    const rawCategory = filters['category[]'] || filters.category;

    // Normalize multi-value filters
    const brandArr = normalizeFilterArray(rawBrand);
    const locationArr = normalizeFilterArray(rawLocation);
    const categoryArr = normalizeFilterArray(rawCategory);
    const skuPlatform = skuOverviewPlatform || filters.platform || 'All';

    // Check if any selected location is NOT one of the 11 Tier-1 cities (case-insensitive)
    const tier1Cities = [
        'kolkata', 'mumbai', 'pune', 'chennai', 'delhi', 'lucknow',
        'gurugram', 'chandigarh', 'hyderabad', 'faridabad', 'bengaluru'
    ];
    let hasTier23 = false;
    if (locationArr && locationArr.length > 0) {
        hasTier23 = locationArr.some(loc => {
            const lowerLoc = String(loc).trim().toLowerCase();
            if (lowerLoc === 'all' || lowerLoc === '' || lowerLoc === 'all india') return false;
            return !tier1Cities.includes(lowerLoc);
        });
    }
    const monthsBack = parseInt(months, 10) || 1;

    // Calculate current date range
    let endDate = await getCachedMaxDate();
    let startDate = endDate.subtract(monthsBack, 'month').startOf('day');
    if (qStartDate && qEndDate) {
        startDate = dayjs(qStartDate).startOf('day');
        endDate = dayjs(qEndDate).endOf('day');
    }

    // Comparison period logic (MoM / same duration)
    const diff = endDate.diff(startDate, 'day') + 1;
    const prevEndDate = startDate.subtract(1, 'day').endOf('day');
    const prevStartDate = prevEndDate.subtract(diff - 1, 'day').startOf('day');

    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

    // Get the optimized data source
    const src = await getWatchtowerSource(filters);

    // Build SKU conditions for rb_pdp_olap
    const buildSkuConds = (sDate, eDate) => {
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const conds = [`${dateCol} BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];

        if (src.f && src.f.compFlagMapping) {
            conds.push(`${src.f.compFlagMapping} = 0`);
        }

        const brandCol = src.isAgg ? 'brand' : 'Brand';
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            conds.push(`(${brandArr.map(b => `lower(${brandCol}) LIKE '%${escapeStr(b.toLowerCase())}%'`).join(' OR ')})`);
        }

        const platformCol = src.isAgg ? 'platform' : 'Platform';
        const platformCond = buildPlatformChannelCond(skuPlatform, channel, platformCol, false, src.f.channel);
        if (platformCond) conds.push(platformCond);

        const locCol = src.isAgg ? 'location' : 'Location';
        if (locationArr && locationArr.length > 0) {
            const platformCol = src.isAgg ? 'platform' : 'Platform';
            const locCond = buildLocationQueryCond(locationArr, skuPlatform, locCol, platformCol);
            if (locCond) conds.push(locCond);
        }

        const catCol = src.isAgg ? 'category' : PRODUCT_CATEGORY_SQL;
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`${catCol} IN(${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }

        // Advanced SKU Search Filters (Only supported on raw table)
        if (!src.isAgg) {
            const skuArr = normalizeFilterArray(filters.skuName);
            if (skuArr && skuArr.length > 0) {
                const skuConds = skuArr.map(s => `Product LIKE '%${escapeStr(s)}%'`).join(' OR ');
                conds.push(`(${skuConds})`);
            }
            const skuCodeArr = normalizeFilterArray(filters.skuCode);
            if (skuCodeArr && skuCodeArr.length > 0) {
                const skuCodeConds = skuCodeArr.map(s => `toString(Web_Pid) LIKE '%${escapeStr(s)}%'`).join(' OR ');
                conds.push(`(${skuCodeConds})`);
            }
            const mslArr = normalizeFilterArray(filters.msl);
            if (mslArr && mslArr.length > 0) {
                const mslConds = mslArr.map(m => `toString(${src.f.msl}) = '${escapeStr(m)}'`).join(' OR ');
                conds.push(`(${mslConds})`);
            }
        }

        return conds.join(' AND ');
    };


    const currSkuConds = buildSkuConds(startDate, endDate);
    const prevSkuConds = buildSkuConds(prevStartDate, prevEndDate);

    // Build MS conditions for rb_brand_ms
    const buildMsSkuConds = (sDate, eDate) => {
        const conds = [`toDate(created_on) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        conds.push(`sales IS NOT NULL`);
        const pCond = buildPlatformChannelCond(skuPlatform, channel, 'platform');
        if (pCond) conds.push(pCond);
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`category IN(${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        if (locationArr && locationArr.length > 0) {
            const locCond = buildLocationQueryCond(locationArr, skuPlatform, 'location', 'platform');
            if (locCond) conds.push(locCond);
        }
        return conds.join(' AND ');
    };

    // Build SOS conditions for rb_kw_olap (SKU level uses keyword_search_product)
    const buildSosBaseConds = (sDate, eDate) => {
        const conds = [`toDate(DATE) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        const pCond = buildPlatformChannelCond(skuPlatform, channel, 'platform_name');
        if (pCond) conds.push(pCond);
        if (locationArr && locationArr.length > 0) {
            const locCond = buildLocationQueryCond(locationArr, skuPlatform, 'location_name', 'platform_name');
            if (locCond) conds.push(locCond);
        }
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`keyword_category IN(${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        return conds.join(' AND ');
    };

    const buildSosSkuConds = (sDate, eDate) => {
        const conds = [buildSosBaseConds(sDate, eDate)];
        if (brandArr && brandArr.length > 0) {
            conds.push(`(${brandArr.map(b => `brand LIKE '%${escapeStr(b)}%'`).join(' OR ')})`);
        }
        // SKU filter on keyword_search_product
        const skuArr = normalizeFilterArray(filters.skuName);
        if (skuArr && skuArr.length > 0) {
            const skuConds = skuArr.map(s => `lower(keyword_search_product) LIKE '%${escapeStr(s.toLowerCase())}%'`).join(' OR ');
            conds.push(`(${skuConds})`);
        }
        return conds.join(' AND ');
    };

    const currSosBaseConds = buildSosBaseConds(startDate, endDate);
    const prevSosBaseConds = buildSosBaseConds(prevStartDate, prevEndDate);
    const currSosSkuConds = buildSosSkuConds(startDate, endDate);
    const prevSosSkuConds = buildSosSkuConds(prevStartDate, prevEndDate);

    // Query SKU metrics for both periods
    const results = await Promise.all([
        queryClickHouse(`
            SELECT ${src.isAgg ? 'brand' : 'Product'} as Product,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END) as total_sales,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.qty} ELSE 0 END) as total_qty,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.spend} ELSE 0 END) as total_spend,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_Ad_sales,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.clicks} ELSE 0 END) as total_clicks,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.impressions} ELSE 0 END) as total_impressions,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.orders} ELSE 0 END) as total_orders,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.neno} ELSE 0 END) as total_neno,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.deno} ELSE 0 END) as total_deno,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as my_mrp_val,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.actualSales} ELSE 0 END) as my_actual_sales,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as comp_mrp_val,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.actualSales} ELSE 0 END) as comp_actual_sales,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.buyBoxNeno} * 1.0 ELSE 0 END) as total_buy_box_neno,
                AVG(if(${src.f.compFlagMapping} = 0 AND ${src.f.deliveryDays} IS NOT NULL, toFloat64OrNull(toString(${src.f.deliveryDays})), NULL)) as avg_delivery_days,
                AVG(if(${src.f.compFlagMapping} = 0 AND ${src.f.sellingPriceRaw} > 0, ${src.f.sellingPriceRaw}, NULL)) as avg_asp,
                AVG(if(${src.f.compFlagMapping} = 0, ${src.f.listingPercent}, NULL)) as avg_listing_percent,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ((${src.f.mrp} - ${src.f.sellingPrice}) / NULLIF(${src.f.mrp}, 0)) * ${src.f.sales} ELSE 0 END) / NULLIF(SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END), 0) * 100 as my_wt_discount,
                any(${src.isAgg ? 'sku_code' : 'Web_Pid'}) as web_pid
            FROM ${src.table}
            WHERE ${currSkuConds} AND ${src.isAgg ? 'brand' : 'Product'} IS NOT NULL AND ${src.isAgg ? 'brand' : 'Product'} != ''
            GROUP BY Product
            HAVING (total_sales > 0 OR total_neno > 0 OR total_deno > 0 OR total_spend > 0)
            ORDER BY total_sales DESC
                `),
        queryClickHouse(`
            SELECT ${src.isAgg ? 'brand' : 'Product'} as Product,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END) as total_sales,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.qty} ELSE 0 END) as total_qty,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.spend} ELSE 0 END) as total_spend,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_Ad_sales,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.clicks} ELSE 0 END) as total_clicks,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.impressions} ELSE 0 END) as total_impressions,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.orders} ELSE 0 END) as total_orders,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.neno} ELSE 0 END) as total_neno,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.deno} ELSE 0 END) as total_deno,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as my_mrp_val,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.actualSales} ELSE 0 END) as my_actual_sales,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as comp_mrp_val,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.actualSales} ELSE 0 END) as comp_actual_sales,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.buyBoxNeno} * 1.0 ELSE 0 END) as total_buy_box_neno,
                AVG(if(${src.f.compFlagMapping} = 0 AND ${src.f.deliveryDays} IS NOT NULL, toFloat64OrNull(toString(${src.f.deliveryDays})), NULL)) as avg_delivery_days,
                AVG(if(${src.f.compFlagMapping} = 0 AND ${src.f.sellingPriceRaw} > 0, ${src.f.sellingPriceRaw}, NULL)) as avg_asp,
                AVG(if(${src.f.compFlagMapping} = 0, ${src.f.listingPercent}, NULL)) as avg_listing_percent,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ((${src.f.mrp} - ${src.f.sellingPrice}) / NULLIF(${src.f.mrp}, 0)) * ${src.f.sales} ELSE 0 END) / NULLIF(SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END), 0) * 100 as my_wt_discount
            FROM ${src.table}
            WHERE ${prevSkuConds} AND ${src.isAgg ? 'brand' : 'Product'} IS NOT NULL AND ${src.isAgg ? 'brand' : 'Product'} != ''
            GROUP BY Product
        `),
        // Market Size
        queryClickHouse(`SELECT SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as total_sales FROM rb_ms_olap WHERE ${buildMsSkuConds(startDate, endDate)} `),
        queryClickHouse(`SELECT SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as total_sales FROM rb_ms_olap WHERE ${buildMsSkuConds(prevStartDate, prevEndDate)} `),
        // Category Size
        queryClickHouse(`
                    SELECT SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as cat_size
                        FROM rb_ms_olap
                        WHERE ${buildMsSkuConds(startDate, endDate)}
            `),
        queryClickHouse(`
                    SELECT SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as cat_size
                        FROM rb_ms_olap
                        WHERE ${buildMsSkuConds(prevStartDate, prevEndDate)}
            `),
        // SOS by SKU (keyword_search_product) - sumIf(overall) with flag=0 for our brands
        queryClickHouse(`SELECT keyword_search_product, sumIf(toInt32(overall), toString(flag) = '1') as count FROM rb_kw_olap WHERE ${currSosSkuConds} GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, sum(toInt32(overall)) as count FROM rb_kw_olap WHERE ${currSosSkuConds} GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, sumIf(toInt32(overall), toString(flag) = '1') as count FROM rb_kw_olap WHERE ${prevSosSkuConds} GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, sum(toInt32(overall)) as count FROM rb_kw_olap WHERE ${prevSosSkuConds} GROUP BY keyword_search_product`),
        // Spons SOS by SKU - sumIf(spons) with flag=0
        queryClickHouse(`SELECT keyword_search_product, sumIf(toInt32(spons), toString(flag) = '1') as count FROM rb_kw_olap WHERE ${currSosSkuConds} GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, sum(toInt32(spons)) as count FROM rb_kw_olap WHERE ${currSosSkuConds} GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, sumIf(toInt32(spons), toString(flag) = '1') as count FROM rb_kw_olap WHERE ${prevSosSkuConds} GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, sum(toInt32(spons)) as count FROM rb_kw_olap WHERE ${prevSosSkuConds} GROUP BY keyword_search_product`),
        // Organic SOS by SKU - sumIf(organic) with flag=0
        queryClickHouse(`SELECT keyword_search_product, sumIf(toInt32(organic), toString(flag) = '1') as count FROM rb_kw_olap WHERE ${currSosSkuConds} GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, sum(toInt32(organic)) as count FROM rb_kw_olap WHERE ${currSosSkuConds} GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, sumIf(toInt32(organic), toString(flag) = '1') as count FROM rb_kw_olap WHERE ${prevSosSkuConds} GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, sum(toInt32(organic)) as count FROM rb_kw_olap WHERE ${prevSosSkuConds} GROUP BY keyword_search_product`),
        // Total SOS Denominators (Category level)
        queryClickHouse(`SELECT sum(toInt32(overall)) as total_count FROM rb_kw_olap WHERE ${currSosBaseConds}`),
        queryClickHouse(`SELECT sum(toInt32(overall)) as total_count FROM rb_kw_olap WHERE ${prevSosBaseConds}`),
        queryClickHouse(`SELECT sum(toInt32(spons)) as total_count FROM rb_kw_olap WHERE ${currSosBaseConds}`),
        queryClickHouse(`SELECT sum(toInt32(spons)) as total_count FROM rb_kw_olap WHERE ${prevSosBaseConds}`),
        queryClickHouse(`SELECT sum(toInt32(organic)) as total_count FROM rb_kw_olap WHERE ${currSosBaseConds}`),
        queryClickHouse(`SELECT sum(toInt32(organic)) as total_count FROM rb_kw_olap WHERE ${prevSosBaseConds}`)
    ]);

    const [
        currSkuMetrics, prevSkuMetrics, currMsResult, prevMsResult, currSkuCatSize, prevSkuCatSize,
        currSosNumSku, currSosDenomSku, prevSosNumSku, prevSosDenomSku,
        currAdSovNumSku, currAdSovDenomSku, prevAdSovNumSku, prevAdSovDenomSku,
        currOrgSovNumSku, currOrgSovDenomSku, prevOrgSovNumSku, prevOrgSovDenomSku,
        currTotalSosCatRes, prevTotalSosCatRes,
        currTotalAdSovCatRes, prevTotalAdSovCatRes,
        currTotalOrgSovCatRes, prevTotalOrgSovCatRes
    ] = results;

    const [
        currTotalSosCat, prevTotalSosCat,
        currTotalAdSovCat, prevTotalAdSovCat,
        currTotalOrgSovCat, prevTotalOrgSovCat
    ] = [
            parseFloat(currTotalSosCatRes[0]?.total_count || 0), parseFloat(prevTotalSosCatRes[0]?.total_count || 0),
            parseFloat(currTotalAdSovCatRes[0]?.total_count || 0), parseFloat(prevTotalAdSovCatRes[0]?.total_count || 0),
            parseFloat(currTotalOrgSovCatRes[0]?.total_count || 0), parseFloat(prevTotalOrgSovCatRes[0]?.total_count || 0)
        ];

    const currMarketSize = parseFloat(currMsResult[0]?.total_sales || 0);
    const prevMarketSize = parseFloat(prevMsResult[0]?.total_sales || 0);
    const currSkuCategorySize = parseFloat(currSkuCatSize[0]?.cat_size || 0);
    const prevSkuCategorySize = parseFloat(prevSkuCatSize[0]?.cat_size || 0);

    const prevSkuMap = new Map(prevSkuMetrics.map(d => [d.Product, d]));

    // Build SOS/Ad SOV/Organic SOV maps by keyword_search_product (lowercase for matching)
    const buildSkuKwMap = (data) => new Map(data.map(r => [r.keyword_search_product?.toLowerCase()?.trim(), parseInt(r.count) || 0]));
    const currSosNumSkuMap = buildSkuKwMap(currSosNumSku);
    const currSosDenomSkuMap = buildSkuKwMap(currSosDenomSku);
    const prevSosNumSkuMap = buildSkuKwMap(prevSosNumSku);
    const prevSosDenomSkuMap = buildSkuKwMap(prevSosDenomSku);
    const currAdSovNumSkuMap = buildSkuKwMap(currAdSovNumSku);
    const currAdSovDenomSkuMap = buildSkuKwMap(currAdSovDenomSku);
    const prevAdSovNumSkuMap = buildSkuKwMap(prevAdSovNumSku);
    const prevAdSovDenomSkuMap = buildSkuKwMap(prevAdSovDenomSku);
    const currOrgSovNumSkuMap = buildSkuKwMap(currOrgSovNumSku);
    const currOrgSovDenomSkuMap = buildSkuKwMap(currOrgSovDenomSku);
    const prevOrgSovNumSkuMap = buildSkuKwMap(prevOrgSovNumSku);
    const prevOrgSovDenomSkuMap = buildSkuKwMap(prevOrgSovDenomSku);

    // Fetch SKU details from rb_sku_platform using web_pid
    const skuWebPids = currSkuMetrics.map(r => r.web_pid).filter(Boolean);
    let skuImageMap = {};
    let skuUrlMap = {};
    if (skuWebPids.length > 0) {
        try {
            const skuCols = await getTableColumns('rb_sku_platform');
            let selectCols = ['LOWER(web_pid) as web_pid', 'any(image_url) as img'];
            let hasPageUrl = false;
            let hasPlatformName = false;

            if (skuCols.size > 0) {
                if (columnExists(skuCols, 'page_url')) {
                    selectCols.push('any(page_url) as page_url');
                    hasPageUrl = true;
                }
                if (columnExists(skuCols, 'platform_name')) {
                    selectCols.push('any(platform_name) as platform_name');
                    hasPlatformName = true;
                }
            }

            const imgData = await queryClickHouse(`
                SELECT ${selectCols.join(', ')}
                FROM rb_sku_platform
                WHERE LOWER(web_pid) IN (${skuWebPids.map(id => `'${escapeStr(String(id).toLowerCase())}'`).join(',')})
                GROUP BY web_pid
            `);
            imgData.forEach(row => {
                const key = String(row.web_pid).toLowerCase();
                skuImageMap[key] = row.img;

                let raw = (hasPageUrl && row.page_url) || null;
                if (!raw && hasPlatformName && row.platform_name) {
                    raw = buildDynamicSkuUrl(row.platform_name, row.web_pid);
                }
                if (raw) {
                    try {
                        const u = new URL(raw);
                        const parts = u.pathname.split('/');
                        parts[parts.length - 1] = parts[parts.length - 1].toUpperCase();
                        u.pathname = parts.join('/');
                        skuUrlMap[key] = u.toString();
                    } catch (_) {
                        skuUrlMap[key] = raw;
                    }
                }
            });
            console.log(`[getSkuOverview] Fetched ${Object.keys(skuImageMap).length} SKU details from rb_sku_platform`);
        } catch (imgError) {
            console.error('[getSkuOverview] Failed to fetch SKU details from rb_sku_platform:', imgError);
        }
    }

    // Calculate total offtake for all returned SKUs to determine Offtake Share
    const currTotalSkuSales = currSkuMetrics.reduce((sum, item) => sum + parseFloat(item.total_sales || 0), 0);

    const skuOverview = currSkuMetrics.map((dataRaw, idx) => {
        const skuName = (dataRaw.Product || 'Unknown').trim().replace(/\s+/g, ' ');
        const data = scaleMarsMetrics(dataRaw, skuName);
        const prevDataRaw = prevSkuMap.get(skuName) || {};
        const prevData = scaleMarsMetrics(prevDataRaw, skuName);

        const skuKeyLower = skuName.toLowerCase().trim();

        const hasPdp = true;
        const hasPm = true;
        const hasMsCheck = currMarketSize > 0;
        const hasSosCheck = currSosDenomSkuMap.has(skuKeyLower) || currAdSovDenomSkuMap.has(skuKeyLower) || currOrgSovDenomSkuMap.has(skuKeyLower);

        const prevHasPdp = prevSkuMap.has(skuName);
        const prevHasPm = prevSkuMap.has(skuName);
        const prevHasMsCheck = prevMarketSize > 0;
        const prevHasSosCheck = prevSosDenomSkuMap.has(skuKeyLower) || prevAdSovDenomSkuMap.has(skuKeyLower) || prevOrgSovDenomSkuMap.has(skuKeyLower);

        // Current Metrics
        const offtake = hasPdp ? parseFloat(data.total_sales || 0) : null;
        const offtakeUnits = hasPdp ? parseFloat(data.total_qty || 0) : null;
        const spend = hasPm ? parseFloat(data.total_spend || 0) : null;
        const adSales = hasPm ? parseFloat(data.total_Ad_sales || 0) : null;
        const clicks = hasPm ? parseFloat(data.total_clicks || 0) : null;
        const impressions = hasPm ? parseFloat(data.total_impressions || 0) : null;
        const orders = hasPm ? parseFloat(data.total_orders || 0) : null;
        const neno = parseFloat(data.total_neno || 0);
        const deno = parseFloat(data.total_deno || 0);

        const availability = hasPdp ? (deno > 0 ? (neno / deno) * 100 : null) : null;
        const listingPercent = hasPdp ? parseFloat(data.avg_listing_percent || 0) : null;
        const wtOsa = (availability !== null && listingPercent !== null) ? (availability * listingPercent) / 100 : null;
        const roas = hasPm ? (spend > 0 ? adSales / spend : null) : null;
        const conversion = hasPm ? calculateConversion(orders, impressions, clicks) : null;
        const cpm = hasPm ? (impressions > 0 ? (spend / impressions) * 1000 : null) : null;
        const cpc = hasPm ? (clicks > 0 ? spend / clicks : null) : null;
        const asp = hasPdp ? parseFloat(data.avg_asp || 0) : null;
        const aov = (hasPm && orders > 0) ? adSales / orders : null;
        const buyBoxNeno = parseFloat(data.total_buy_box_neno || 0);
        const buyBoxPct = deno > 0 ? (buyBoxNeno / deno) * 100 : null;
        const deliveryTime = parseFloat(data.avg_delivery_days ?? null);

        const promoMyBrand = hasPdp ? (parseFloat(data.my_mrp_val || 0) > 0
            ? ((parseFloat(data.my_mrp_val) - parseFloat(data.my_actual_sales)) / parseFloat(data.my_mrp_val)) * 100
            : null) : null;
        const promoCompete = hasPdp ? (parseFloat(data.comp_mrp_val || 0) > 0
            ? ((parseFloat(data.comp_mrp_val) - parseFloat(data.comp_actual_sales)) / parseFloat(data.comp_mrp_val)) * 100
            : null) : null;
        const wtDiscount = hasPdp ? parseFloat(data.my_wt_discount || 0) : null;

        // Previous Metrics
        const prevOfftake = prevHasPdp ? parseFloat(prevData.total_sales || 0) : null;
        const prevOfftakeUnits = prevHasPdp ? parseFloat(prevData.total_qty || 0) : null;
        const prevSpend = prevHasPm ? parseFloat(prevData.total_spend || 0) : null;
        const prevAdSales = prevHasPm ? parseFloat(prevData.total_Ad_sales || 0) : null;
        const prevClicks = prevHasPm ? parseFloat(prevData.total_clicks || 0) : null;
        const prevImpressions = prevHasPm ? parseFloat(prevData.total_impressions || 0) : null;
        const prevOrders = prevHasPm ? parseFloat(prevData.total_orders || 0) : null;
        const prevNeno = parseFloat(prevData.total_neno || 0);
        const prevDeno = parseFloat(prevData.total_deno || 0);

        const prevAvailability = prevHasPdp ? (prevDeno > 0 ? (prevNeno / prevDeno) * 100 : null) : null;
        const prevListingPercent = prevHasPdp ? parseFloat(prevData.avg_listing_percent || 0) : null;
        const prevWtOsa = (prevAvailability !== null && prevListingPercent !== null) ? (prevAvailability * prevListingPercent) / 100 : null;
        const prevRoas = prevHasPm ? (prevSpend > 0 ? prevAdSales / prevSpend : null) : null;
        const prevConversion = prevHasPm ? calculateConversion(prevOrders, prevImpressions, prevClicks) : null;
        const prevCpm = prevHasPm ? (prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : null) : null;
        const prevCpc = prevHasPm ? (prevClicks > 0 ? prevSpend / prevClicks : null) : null;
        const prevAsp = prevHasPdp ? parseFloat(prevData.avg_asp || 0) : null;
        const prevAov = (prevHasPm && prevOrders > 0) ? prevAdSales / prevOrders : null;
        const prevBuyBoxNeno = parseFloat(prevData.total_buy_box_neno || 0);
        const prevBuyBoxPct = prevDeno > 0 ? (prevBuyBoxNeno / prevDeno) * 100 : null;
        const prevDeliveryTime = parseFloat(prevData.avg_delivery_days ?? null);

        const prevPromoMyBrand = prevHasPdp ? (parseFloat(prevData.my_mrp_val || 0) > 0
            ? ((parseFloat(prevData.my_mrp_val) - parseFloat(prevData.my_actual_sales)) / parseFloat(prevData.my_mrp_val)) * 100
            : null) : null;
        const prevPromoCompete = prevHasPdp ? (parseFloat(prevData.comp_mrp_val || 0) > 0
            ? ((parseFloat(prevData.comp_mrp_val) - parseFloat(prevData.comp_actual_sales)) / parseFloat(prevData.comp_mrp_val)) * 100
            : null) : null;
        const prevWtDiscount = prevHasPdp ? parseFloat(prevData.my_wt_discount || 0) : null;
        const marketShare = (hasMsCheck && !hasTier23) ? (currMarketSize > 0 ? (offtake / currMarketSize) * 100 : null) : null;
        const prevMarketShare = (prevHasMsCheck && !hasTier23) ? (prevMarketSize > 0 ? (prevOfftake / prevMarketSize) * 100 : null) : null;

        // SOS, Ad SOV, Organic SOV by keyword_search_product
        const sosNum = currSosNumSkuMap.get(skuKeyLower) || 0;
        const sosDenom = currSosDenomSkuMap.get(skuKeyLower) || 0;
        const sos = hasSosCheck ? (currTotalSosCat > 0 ? (sosNum / currTotalSosCat) * 100 : null) : null;
        const prevSosNum = prevSosNumSkuMap.get(skuKeyLower) || 0;
        const prevSos = prevHasSosCheck ? (prevTotalSosCat > 0 ? (prevSosNum / prevTotalSosCat) * 100 : null) : null;

        const adSovNum = currAdSovNumSkuMap.get(skuKeyLower) || 0;
        const adSov = hasSosCheck ? (currTotalAdSovCat > 0 ? (adSovNum / currTotalAdSovCat) * 100 : null) : null;
        const prevAdSovNum = prevAdSovNumSkuMap.get(skuKeyLower) || 0;
        const prevAdSov = prevHasSosCheck ? (prevTotalAdSovCat > 0 ? (prevAdSovNum / prevTotalAdSovCat) * 100 : null) : null;

        const orgSovNum = currOrgSovNumSkuMap.get(skuKeyLower) || 0;
        const organicSov = hasSosCheck ? (currTotalOrgSovCat > 0 ? (orgSovNum / currTotalOrgSovCat) * 100 : null) : null;
        const prevOrgSovNum = prevOrgSovNumSkuMap.get(skuKeyLower) || 0;
        const prevOrganicSov = prevHasSosCheck ? (prevTotalOrgSovCat > 0 ? (prevOrgSovNum / prevTotalOrgSovCat) * 100 : null) : null;


        const offtakeShare = currTotalSkuSales > 0 ? (offtake / currTotalSkuSales) * 100 : 0;

        return {
            key: `sku_${idx}_${skuName.toLowerCase().replace(/\s+/g, '_').substring(0, 30)} `,
            label: skuName,
            type: "SKU",
            logo: (dataRaw.web_pid && skuImageMap[String(dataRaw.web_pid).toLowerCase()]) || null,
            page_url: (dataRaw.web_pid && skuUrlMap[String(dataRaw.web_pid).toLowerCase()]) || null,
            offtakeShare: parseFloat(offtakeShare.toFixed(2)),
            columns: generateKpiColumns({
                offtake, availability, wtOsa, listingPercent, sos, marketShare, spend, roas, inorgSales: adSales, conversion, cpm, cpc, asp, aov, promoMyBrand, promoCompete, wtDiscount, categorySize: hasMsCheck ? currSkuCategorySize : null, adSov, organicSov, buyBoxPct, deliveryTime,
                prevOfftake, prevAvailability, prevWtOsa, prevListingPercent, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales: prevAdSales, prevConversion, prevCpm, prevCpc, prevAsp, prevAov, prevPromoMyBrand, prevPromoCompete, prevWtDiscount, prevCategorySize: prevHasMsCheck ? prevSkuCategorySize : null, prevAdSov, prevOrganicSov, prevBuyBoxPct, prevDeliveryTime,
                offtakeUnits, inorgUnits: orders, prevOfftakeUnits, prevInorgUnits: prevOrders
            })
        };
    });

    console.log(`[getSkuOverview] Returning ${skuOverview.length} SKUs`);
    return skuOverview;
};

/**
 * Get City Overview Data - OPTIMIZED
 * Groups data by Location (City) for the Performance Matrix
 */
const getCityOverview = async (filters) => {
    console.log('[getCityOverview] Computing City overview data...');

    const { months = 1, startDate: qStartDate, endDate: qEndDate, cityOverviewPlatform } = filters;
    const channel = extractChannel(filters);

    // Extract filter values
    const rawBrand = filters['brand[]'] || filters.brand;
    const rawCategory = filters['category[]'] || filters.category;

    // Normalize multi-value filters
    const brandArr = normalizeFilterArray(rawBrand);
    const categoryArr = normalizeFilterArray(rawCategory);
    const cityPlatform = cityOverviewPlatform || filters.platform || 'All';

    const monthsBack = parseInt(months, 10) || 1;

    // Calculate current date range
    let endDate = await getCachedMaxDate();
    let startDate = endDate.subtract(monthsBack, 'month').startOf('day');
    if (qStartDate && qEndDate) {
        startDate = dayjs(qStartDate).startOf('day');
        endDate = dayjs(qEndDate).endOf('day');
    }

    // Comparison period logic (MoM / same duration)
    const diff = endDate.diff(startDate, 'day') + 1;
    const prevEndDate = startDate.subtract(1, 'day').endOf('day');
    const prevStartDate = prevEndDate.subtract(diff - 1, 'day').startOf('day');

    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

    // Get the optimized data source
    const src = await getWatchtowerSource(filters);
    const pmSrc = await getPmSource();

    // Build City conditions for rb_pdp_olap
    const buildCityConds = (sDate, eDate) => {
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const conds = [`${dateCol} BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];

        const brandCol = src.isAgg ? 'brand' : 'Brand';
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            conds.push(`(${brandArr.map(b => `lower(${brandCol}) LIKE '%${escapeStr(b.toLowerCase())}%'`).join(' OR ')})`);
        }

        const platformCol = src.isAgg ? 'platform' : 'Platform';
        const platformCond = buildPlatformChannelCond(cityPlatform, channel, platformCol);
        if (platformCond) conds.push(platformCond);

        const catCol = src.isAgg ? 'category' : PRODUCT_CATEGORY_SQL;
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`${catCol} IN(${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }

        // Advanced SKU Search Filters (Only supported on raw table)
        if (!src.isAgg) {
            const skuArr = normalizeFilterArray(filters.skuName);
            if (skuArr && skuArr.length > 0) {
                const skuConds = skuArr.map(s => `Product LIKE '%${escapeStr(s)}%'`).join(' OR ');
                conds.push(`(${skuConds})`);
            }
            const skuCodeArr = normalizeFilterArray(filters.skuCode);
            if (skuCodeArr && skuCodeArr.length > 0) {
                const skuCodeConds = skuCodeArr.map(s => `toString(Web_Pid) LIKE '%${escapeStr(s)}%'`).join(' OR ');
                conds.push(`(${skuCodeConds})`);
            }
            const mslArr = normalizeFilterArray(filters.msl);
            if (mslArr && mslArr.length > 0) {
                const mslConds = mslArr.map(m => `toString(${src.f.msl}) = '${escapeStr(m)}'`).join(' OR ');
                conds.push(`(${mslConds})`);
            }
        }

        return conds.join(' AND ');
    };

    const currCityConds = buildCityConds(startDate, endDate);
    const prevCityConds = buildCityConds(prevStartDate, prevEndDate);

    // Build MS conditions for rb_brand_ms
    const buildMsCityConds = (sDate, eDate) => {
        const conds = [`toDate(created_on) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        conds.push(`sales IS NOT NULL`);
        const pCond = buildPlatformChannelCond(cityPlatform, channel, 'platform');
        if (pCond) conds.push(pCond);
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`category IN(${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        return conds.join(' AND ');
    };

    const buildPmCityConds = (sDate, eDate) => {
        const conds = [`${pmSrc.f.date} BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        const pCond = buildPlatformChannelCond(cityPlatform, channel, pmSrc.f.platform, false, pmSrc.f.channel);
        if (pCond) conds.push(pCond);
        if (brandArr && brandArr.length > 0) {
            conds.push(`lower(${pmSrc.f.brand}) IN (${brandArr.map(b => `'${escapeStr(b).toLowerCase()}'`).join(', ')})`);
        }
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`lower(${pmSrc.f.category}) IN (${categoryArr.map(c => `'${escapeStr(c).toLowerCase()}'`).join(', ')})`);
        }
        if (pmSrc.f.location && pmSrc.f.location !== "'Unknown'" && locationArr && locationArr.length > 0) {
            const locCond = buildLocationQueryCond(locationArr, cityPlatform, pmSrc.f.location, pmSrc.f.platform);
            if (locCond) conds.push(locCond);
        }
        return conds.join(' AND ');
    };

    const currPmCityConds = buildPmCityConds(startDate, endDate);
    const prevPmCityConds = buildPmCityConds(prevStartDate, prevEndDate);

    // Query City metrics for both periods
    const results = await Promise.all([
        queryClickHouse(`
            SELECT ${src.isAgg ? 'location' : 'Location'} as Location,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END) as total_sales,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.qty} ELSE 0 END) as total_qty,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.spend} ELSE 0 END) as total_spend,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_Ad_sales,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.clicks} ELSE 0 END) as total_clicks,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.impressions} ELSE 0 END) as total_impressions,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.orders} ELSE 0 END) as total_orders,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.neno} ELSE 0 END) as total_neno,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.deno} ELSE 0 END) as total_deno,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as my_mrp_val,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.actualSales} ELSE 0 END) as my_actual_sales,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as comp_mrp_val,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.actualSales} ELSE 0 END) as comp_actual_sales
            FROM ${src.table}
            WHERE ${currCityConds} AND ${src.isAgg ? 'location' : 'Location'} IS NOT NULL AND ${src.isAgg ? 'location' : 'Location'} != ''
            GROUP BY Location
            ORDER BY total_sales DESC
            LIMIT 50
                `),
        queryClickHouse(`
            SELECT ${src.isAgg ? 'location' : 'Location'} as Location,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END) as total_sales,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.qty} ELSE 0 END) as total_qty,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.spend} ELSE 0 END) as total_spend,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_Ad_sales,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.clicks} ELSE 0 END) as total_clicks,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.impressions} ELSE 0 END) as total_impressions,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.orders} ELSE 0 END) as total_orders,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.neno} ELSE 0 END) as total_neno,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.deno} ELSE 0 END) as total_deno,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as my_mrp_val,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.actualSales} ELSE 0 END) as my_actual_sales,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as comp_mrp_val,
                SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.actualSales} ELSE 0 END) as comp_actual_sales
            FROM ${src.table}
            WHERE ${prevCityConds} AND ${src.isAgg ? 'location' : 'Location'} IS NOT NULL AND ${src.isAgg ? 'location' : 'Location'} != ''
            GROUP BY Location
        `),
        // Market Share / Category Size by Location
        queryClickHouse(`SELECT location, SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as city_market_sales FROM rb_ms_olap WHERE ${buildMsCityConds(startDate, endDate)} GROUP BY location`),
        queryClickHouse(`SELECT location, SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as city_market_sales FROM rb_ms_olap WHERE ${buildMsCityConds(prevStartDate, prevEndDate)} GROUP BY location`),
        // Category Size by Location (monthly_category_size summed per week/category)
        queryClickHouse(`
                    SELECT location, SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as cat_size
                        FROM rb_ms_olap
                        WHERE ${buildMsCityConds(startDate, endDate)}
                    GROUP BY location
                `),
        queryClickHouse(`
                    SELECT location, SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as cat_size
                        FROM rb_ms_olap
                        WHERE ${buildMsCityConds(prevStartDate, prevEndDate)}
                    GROUP BY location
                `),
        // Marketing Metrics from PM table
        queryClickHouse(`
            SELECT ${pmSrc.f.location} as Location,
                SUM(${pmSrc.f.spend}) as total_spend,
                SUM(${pmSrc.f.adSales}) as total_Ad_sales,
                SUM(${pmSrc.f.clicks}) as total_clicks,
                SUM(${pmSrc.f.impressions}) as total_impressions,
                SUM(${pmSrc.f.orders}) as total_orders
            FROM ${pmSrc.table}
            WHERE ${currPmCityConds}
            GROUP BY Location
        `),
        queryClickHouse(`
            SELECT ${pmSrc.f.location} as Location,
                SUM(${pmSrc.f.spend}) as total_spend,
                SUM(${pmSrc.f.adSales}) as total_Ad_sales,
                SUM(${pmSrc.f.clicks}) as total_clicks,
                SUM(${pmSrc.f.impressions}) as total_impressions,
                SUM(${pmSrc.f.orders}) as total_orders
            FROM ${pmSrc.table}
            WHERE ${prevPmCityConds}
            GROUP BY Location
        `)
    ]);

    const [currCityMetrics, prevCityMetrics, currMsResult, prevMsResult, currCityCatSize, prevCityCatSize, currPmCityMetrics, prevPmCityMetrics] = results;
    const prevCityMap = new Map(prevCityMetrics.map(d => [d.Location, d]));
    const currPmMap = new Map(currPmCityMetrics.map(d => [d.Location?.toLowerCase(), d]));
    const prevPmMap = new Map(prevPmCityMetrics.map(d => [d.Location?.toLowerCase(), d]));

    const currMsMap = new Map(currMsResult.map(d => [d.location?.toLowerCase(), parseFloat(d.city_market_sales || 0)]));
    const prevMsMap = new Map(prevMsResult.map(d => [d.location?.toLowerCase(), parseFloat(d.city_market_sales || 0)]));
    const currCityCatSizeMap = new Map(currCityCatSize.map(d => [d.location?.toLowerCase(), parseFloat(d.cat_size || 0)]));
    const prevCityCatSizeMap = new Map(prevCityCatSize.map(d => [d.location?.toLowerCase(), parseFloat(d.cat_size || 0)]));

    const cityOverview = currCityMetrics.map(data => {
        const cityName = data.Location || 'Unknown';
        const prevData = prevCityMap.get(cityName) || {};

        const cityNameLower = cityName.toLowerCase();
        const pmData = currPmMap.get(cityNameLower) || {};
        const prevPmData = prevPmMap.get(cityNameLower) || {};

        const hasPdp = true;
        const hasPm = currPmMap.has(cityNameLower);
        const hasMsCheck = currMsMap.has(cityNameLower);

        const prevHasPdp = prevCityMap.has(cityName);
        const prevHasPm = prevPmMap.has(cityNameLower);
        const prevHasMsCheck = prevMsMap.has(cityNameLower);

        // Current Metrics
        const offtake = hasPdp ? parseFloat(data.total_sales || 0) : null;
        const offtakeUnits = hasPdp ? parseFloat(data.total_qty || 0) : null;
        const spend = hasPm ? parseFloat(pmData.total_spend || 0) : null;
        const adSales = hasPm ? parseFloat(pmData.total_Ad_sales || 0) : null;
        const clicks = hasPm ? parseFloat(pmData.total_clicks || 0) : null;
        const impressions = hasPm ? parseFloat(pmData.total_impressions || 0) : null;
        const orders = hasPm ? parseFloat(pmData.total_orders || 0) : null;
        const neno = parseFloat(data.total_neno || 0);
        const deno = parseFloat(data.total_deno || 0);

        const availability = hasPdp ? (deno > 0 ? (neno / deno) * 100 : null) : null;
        const roas = hasPm ? (spend > 0 ? adSales / spend : null) : null;
        const conversion = hasPm ? calculateConversion(orders, impressions, clicks) : null;
        const cpm = hasPm ? (impressions > 0 ? (spend / impressions) * 1000 : null) : null;
        const cpc = hasPm ? (clicks > 0 ? spend / clicks : null) : null;

        const promoMyBrand = hasPdp ? (parseFloat(data.my_mrp_val || 0) > 0
            ? ((parseFloat(data.my_mrp_val) - parseFloat(data.my_actual_sales)) / parseFloat(data.my_mrp_val)) * 100
            : null) : null;
        const promoCompete = hasPdp ? (parseFloat(data.comp_mrp_val || 0) > 0
            ? ((parseFloat(data.comp_mrp_val) - parseFloat(data.comp_actual_sales)) / parseFloat(data.comp_mrp_val)) * 100
            : null) : null;

        // Previous Metrics
        const prevOfftake = prevHasPdp ? parseFloat(prevData.total_sales || 0) : null;
        const prevOfftakeUnits = prevHasPdp ? parseFloat(prevData.total_qty || 0) : null;
        const prevSpend = prevHasPm ? parseFloat(prevPmData.total_spend || 0) : null;
        const prevAdSales = prevHasPm ? parseFloat(prevPmData.total_Ad_sales || 0) : null;
        const prevClicks = prevHasPm ? parseFloat(prevPmData.total_clicks || 0) : null;
        const prevImpressions = prevHasPm ? parseFloat(prevPmData.total_impressions || 0) : null;
        const prevOrders = prevHasPm ? parseFloat(prevPmData.total_orders || 0) : null;
        const prevNeno = parseFloat(prevData.total_neno || 0);
        const prevDeno = parseFloat(prevData.total_deno || 0);

        const prevAvailability = prevHasPdp ? (prevDeno > 0 ? (prevNeno / prevDeno) * 100 : null) : null;
        const prevRoas = prevHasPm ? (prevSpend > 0 ? prevAdSales / prevSpend : null) : null;
        const prevConversion = prevHasPm ? calculateConversion(prevOrders, prevImpressions, prevClicks) : null;
        const prevCpm = prevHasPm ? (prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : null) : null;
        const prevCpc = prevHasPm ? (prevClicks > 0 ? prevSpend / prevClicks : null) : null;

        const prevPromoMyBrand = prevHasPdp ? (parseFloat(prevData.my_mrp_val || 0) > 0
            ? ((parseFloat(prevData.my_mrp_val) - parseFloat(prevData.my_actual_sales)) / parseFloat(prevData.my_mrp_val)) * 100
            : null) : null;
        const prevPromoCompete = prevHasPdp ? (parseFloat(prevData.comp_mrp_val || 0) > 0
            ? ((parseFloat(prevData.comp_mrp_val) - parseFloat(prevData.comp_actual_sales)) / parseFloat(prevData.comp_mrp_val)) * 100
            : null) : null;

        const currCityMarket = currMsMap.get(cityName.toLowerCase()) || 0;
        const prevCityMarket = prevMsMap.get(cityName.toLowerCase()) || 0;
        const tier1Cities = [
            'kolkata', 'mumbai', 'pune', 'chennai', 'delhi', 'lucknow',
            'gurugram', 'chandigarh', 'hyderabad', 'faridabad', 'bengaluru'
        ];
        const lowerCityName = cityName ? cityName.toLowerCase().trim() : '';
        const isCityTier1 = tier1Cities.includes(lowerCityName);
        const marketShare = (isCityTier1 && hasMsCheck) ? (currCityMarket > 0 ? (offtake / currCityMarket) * 100 : null) : null;
        const prevMarketShare = (isCityTier1 && prevHasMsCheck) ? (prevCityMarket > 0 ? (prevOfftake / prevCityMarket) * 100 : null) : null;

        return {
            key: cityName.toLowerCase().replace(/\s+/g, '_'),
            label: cityName,
            type: "Location",
            logo: "https://cdn-icons-png.flaticon.com/512/535/535239.png",
            columns: generateKpiColumns({
                offtake, availability, sos: null, marketShare, spend, roas, inorgSales: adSales, conversion, cpm, cpc, promoMyBrand, promoCompete, categorySize: hasMsCheck ? (currCityCatSizeMap.get(cityName.toLowerCase()) || null) : null,
                prevOfftake, prevAvailability, prevSos: null, prevMarketShare, prevSpend, prevRoas, prevInorgSales: prevAdSales, prevConversion, prevCpm, prevCpc, prevPromoMyBrand, prevPromoCompete, prevCategorySize: prevHasMsCheck ? (prevCityCatSizeMap.get(cityName.toLowerCase()) || null) : null,
                offtakeUnits, inorgUnits: orders, prevOfftakeUnits, prevInorgUnits: prevOrders
            })
        };
    });

    // Ensure 'Other' or 'Unknown' appear at the end
    const sortedCityOverview = [
        ...cityOverview.filter(c => c.label.toLowerCase() !== 'other' && c.label.toLowerCase() !== 'unknown'),
        ...cityOverview.filter(c => c.label.toLowerCase() === 'other' || c.label.toLowerCase() === 'unknown')
    ];

    console.log(`[getCityOverview] Returning ${sortedCityOverview.length} cities`);
    return sortedCityOverview;
};

/**
 * Get Performance Breakdown Data
 * @param {Object} filters
 */
const getPerformanceBreakdownData = async (filters) => {
    try {
        const pmSrc = await getPmSource();
        const groupByMap = {
            'category': pmSrc.f.category,
            'brand': pmSrc.f.brand,
            'sku': pmSrc.f.product || pmSrc.f.skuCode
        };
        const groupByCol = groupByMap[filters.group_by] || pmSrc.f.category;

        // ── Apply Date Range or Fallback to MTD (Month-To-Date) ──
        const now = new Date();
        const dateStart = filters.startDate ? new Date(filters.startDate).toISOString().split('T')[0] : new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const dateEnd = filters.endDate ? new Date(filters.endDate).toISOString().split('T')[0] : now.toISOString().split('T')[0];
        const dateClause = `AND ${pmSrc.f.date} >= '${dateStart}' AND ${pmSrc.f.date} <= '${dateEnd}'`;

        // ── Build consolidated platform/channel condition ──
        const rawPlatform = filters.platform || filters.platform_uuid;
        const pCond = buildPlatformChannelCond(rawPlatform, filters.channel, pmSrc.f.platform, false, pmSrc.f.channel);
        const platformCond = pCond ? `AND ${pCond} ` : '';

        // ── Build additional filter clauses (brand, category, location) ──
        let extraClauses = '';
        if (filters.brand && filters.brand !== 'All') {
            const brands = filters.brand.includes(',') ? filters.brand.split(',').map(b => b.trim()) : [filters.brand];
            extraClauses += ` AND lower(${pmSrc.f.brand}) IN(${brands.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ')})`;
        }
        if (filters.category && filters.category !== 'All') {
            const cats = filters.category.includes(',') ? filters.category.split(',').map(c => c.trim()) : [filters.category];
            extraClauses += ` AND lower(${pmSrc.f.category}) IN(${cats.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`;
        }
        if (pmSrc.f.location && pmSrc.f.location !== "'Unknown'" && filters.location && filters.location !== 'All') {
            const locs = filters.location.includes(',') ? filters.location.split(',').map(l => l.trim()) : [filters.location];
            extraClauses += ` AND lower(${pmSrc.f.location}) IN(${locs.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`;
        }

        // ── SKU Filters ──
        if (filters.skuName && filters.skuName !== 'All') {
            const skus = filters.skuName.includes(',') ? filters.skuName.split(',').map(s => s.trim()) : [filters.skuName];
            extraClauses += ` AND ${pmSrc.f.product} IN(${skus.map(s => `'${escapeStr(s)}'`).join(', ')})`;
        }
        if (filters.skuCode && filters.skuCode !== 'All') {
            const codes = filters.skuCode.includes(',') ? filters.skuCode.split(',').map(s => s.trim()) : [filters.skuCode];
            extraClauses += ` AND ${pmSrc.f.skuCode} IN(${codes.map(c => `'${escapeStr(c)}'`).join(', ')})`;
        }

        // ── Filter to only our brands (comp_flag=0) ──
        // For PM Olap, we don't need to filter by ourBrands list because the PM data 
        // doesn't always contain the brand name (e.g., has 'Performance', 'Test')
        // and we only have PM data for our own brands anyway.
        let ourBrandClause = '';
        /*
        const ourBrands = await getGlobalOurBrandsList();
        if (ourBrands && ourBrands.length > 0) {
            ourBrandClause = ` AND lower(${pmSrc.f.brand}) IN(${ourBrands.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ')})`;
        }
        */

        // ── Calculate total spends by summing rows later to ensure 100% share consistency ──
        // (Removing separate total_spends query for performance and better percentage alignment)

        const cvrFormula = `if (group_clicks > 0, (group_orders / group_clicks) * 100, 0)`;

        const query = `
            SELECT
                ${groupByCol} AS tag,
                SUM(${pmSrc.f.impressions}) AS group_impressions,
                SUM(if(lower(${pmSrc.f.platform}) IN ('zepto', 'blinkit', 'swiggy instamart', 'instamart', 'dunzo', 'swiggy', 'bbnow', 'quickcomm', 'qcommerce', 'q-commerce') OR lower(${pmSrc.f.platform}) LIKE '%quick%' OR lower(${pmSrc.f.platform}) LIKE '%instamart%', 0, ${pmSrc.f.clicks})) AS group_clicks_ecom,
                SUM(if(lower(${pmSrc.f.platform}) IN ('zepto', 'blinkit', 'swiggy instamart', 'instamart', 'dunzo', 'swiggy', 'bbnow', 'quickcomm', 'qcommerce', 'q-commerce') OR lower(${pmSrc.f.platform}) LIKE '%quick%' OR lower(${pmSrc.f.platform}) LIKE '%instamart%', ${pmSrc.f.clicks}, 0)) AS group_atc,
                (group_clicks_ecom + group_atc) AS group_clicks_total,
                if (group_impressions > 0, (group_clicks_total / group_impressions) * 100, 0) AS ctr,
                SUM(${pmSrc.f.spend}) AS group_spends,
                0 AS spend_percent_share,
                if (group_clicks_total > 0, group_spends / group_clicks_total, 0) AS cpc,
                SUM(${pmSrc.f.orders}) AS group_orders,
                if (group_clicks_total > 0, (group_orders / group_clicks_total) * 100, 0) AS cvr,
                SUM(${pmSrc.f.adSales}) AS group_sales
            FROM ${pmSrc.table}
            WHERE 1 = 1 ${platformCond} ${dateClause} ${extraClauses} ${ourBrandClause}
            GROUP BY tag
            ORDER BY group_spends DESC
        `;

        const data = await queryClickHouse(query);

        let totals = {
            impressions: 0, clicks: 0, ctr: 0, spends: 0, cpc: 0, orders: 0, cvr: 0, sales: 0, atc: 0, aov: 0, totalClicks: 0
        };

        const parsedData = data.map(row => {
            const scaled = scaleMarsMetrics(row, row.tag);
            const impressions = parseFloat(scaled.group_impressions) || 0;
            const clicks = parseFloat(scaled.group_clicks) || 0;
            const spends = parseFloat(scaled.group_spends) || 0;
            const orders = parseFloat(scaled.group_orders) || 0;
            const sales = parseFloat(scaled.group_sales) || 0;

            totals.impressions += impressions;
            totals.clicks += parseFloat(scaled.group_clicks_ecom) || 0;
            totals.spends += spends;
            totals.orders += orders;
            totals.sales += sales;
            totals.atc += parseFloat(scaled.group_atc) || 0;
            const totalClicks = parseFloat(scaled.group_clicks_total) || 0;
            totals.totalClicks = (totals.totalClicks || 0) + totalClicks;

            return {
                tag: scaled.tag || 'Unknown',
                impressions,
                clicks: parseFloat(scaled.group_clicks_ecom) || 0,
                ctr: parseFloat(scaled.ctr) || 0,
                spends,
                cpc: parseFloat(scaled.cpc) || 0,
                orders,
                cvr: parseFloat(scaled.cvr) || 0,
                sales,
                atc: parseFloat(scaled.group_atc) || 0,
                aov: orders > 0 ? sales / orders : 0
            };
        });

        // ── Re-calculate percentages based on the sum of group_spends ──
        const total_visible_spends = parsedData.reduce((acc, row) => acc + (parseFloat(row.spends) || 0), 0);
        parsedData.forEach(row => {
            row.spend_percent_share = total_visible_spends > 0 ? (row.spends / total_visible_spends) * 100 : 0;
        });

        totals.ctr = totals.impressions > 0 ? (totals.totalClicks / totals.impressions) * 100 : 0;
        totals.cpc = totals.totalClicks > 0 ? totals.spends / totals.totalClicks : 0;
        totals.cvr = totals.totalClicks > 0 ? (totals.orders / totals.totalClicks) * 100 : 0;
        totals.aov = totals.orders > 0 ? totals.sales / totals.orders : 0;

        // ── Period Comparison ───────────────────────────────────────────────
        let period_comparison = null;
        const comparePeriodKeys = filters.compare_periods;
        if (comparePeriodKeys) {
            const periodKeys = typeof comparePeriodKeys === 'string' ? comparePeriodKeys.split(',').map(k => k.trim()) : [];

            const getPresetRange = (key) => {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                switch (key) {
                    case 'last_week': { const e = new Date(today); e.setDate(e.getDate() - 1); const s = new Date(e); s.setDate(s.getDate() - 6); return { start: s, end: e }; }
                    case 'last_month': { const e = new Date(today.getFullYear(), today.getMonth(), 0); return { start: new Date(e.getFullYear(), e.getMonth(), 1), end: e }; }
                    case 'mtd': { const s = new Date(today.getFullYear(), today.getMonth(), 1); const e = new Date(today); e.setDate(e.getDate() - 1); return { start: s, end: e }; }
                    case 'last_3_months': { const e = new Date(today); e.setDate(e.getDate() - 1); const s = new Date(e); s.setMonth(s.getMonth() - 3); return { start: s, end: e }; }
                    case 'ytd': { const s = new Date(today.getFullYear(), 0, 1); const e = new Date(today); e.setDate(e.getDate() - 1); return { start: s, end: e }; }
                    default: return null;
                }
            };

            const fmtDate = (d) => d.toISOString().split('T')[0];

            const periodResults = await Promise.all(periodKeys.map(async (periodParam) => {
                let key = periodParam;
                let range = null;

                if (periodParam.includes(':')) {
                    const parts = periodParam.split(':');
                    key = parts[0];
                    const customStart = parts[1];
                    const customEnd = parts[2];
                    if (customStart && customEnd) {
                        range = { start: new Date(customStart), end: new Date(customEnd) };
                    }
                } else {
                    range = getPresetRange(key);
                }

                if (!range) return { key, data: [] };

                const startStr = fmtDate(range.start);
                const endStr = fmtDate(range.end);
                const pDateClause = `AND ${pmSrc.f.date} >= '${startStr}' AND ${pmSrc.f.date} <= '${endStr}'`;

                const periodData = await queryClickHouse(`
                    SELECT 
                        ${groupByCol} AS tag, 
                        SUM(${pmSrc.f.impressions}) AS group_impressions,
                        SUM(if(lower(${pmSrc.f.platform}) IN ('zepto', 'blinkit', 'swiggy instamart', 'instamart', 'dunzo', 'swiggy', 'bbnow', 'quickcomm', 'qcommerce', 'q-commerce') OR lower(${pmSrc.f.platform}) LIKE '%quick%' OR lower(${pmSrc.f.platform}) LIKE '%instamart%', 0, ${pmSrc.f.clicks})) AS group_clicks_ecom,
                        SUM(if(lower(${pmSrc.f.platform}) IN ('zepto', 'blinkit', 'swiggy instamart', 'instamart', 'dunzo', 'swiggy', 'bbnow', 'quickcomm', 'qcommerce', 'q-commerce') OR lower(${pmSrc.f.platform}) LIKE '%quick%' OR lower(${pmSrc.f.platform}) LIKE '%instamart%', ${pmSrc.f.clicks}, 0)) AS group_atc,
                        SUM(${pmSrc.f.spend}) AS group_spends, 
                        SUM(${pmSrc.f.orders}) AS group_orders, 
                        SUM(${pmSrc.f.adSales}) AS group_sales
                    FROM ${pmSrc.table}
                    WHERE 1 = 1 ${platformCond} ${pDateClause} ${extraClauses} ${ourBrandClause}
                    GROUP BY tag
                `);

                const mappedData = periodData.map(r => {
                    const scaled = scaleMarsMetrics(r, r.tag);
                    const impressions = parseFloat(scaled.group_impressions) || 0;
                    const orders = parseFloat(scaled.group_orders) || 0;
                    const clicksEcom = parseFloat(scaled.group_clicks_ecom) || 0;
                    const atc = parseFloat(scaled.group_atc) || 0;
                    const totalClicks = clicksEcom + atc;
                    const spends = parseFloat(scaled.group_spends) || 0;
                    const sales = parseFloat(scaled.group_sales) || 0;

                    return {
                        tag: scaled.tag || 'Unknown',
                        impressions,
                        clicks: clicksEcom,
                        atc,
                        ctr: impressions > 0 ? (totalClicks / impressions) * 100 : 0,
                        spends,
                        cpc: totalClicks > 0 ? spends / totalClicks : 0,
                        orders,
                        cvr: totalClicks > 0 ? (orders / totalClicks) * 100 : 0,
                        sales,
                        aov: orders > 0 ? sales / orders : 0
                    };
                });

                // Calculate spend_percent_share for this specific period
                const periodTotalSpend = mappedData.reduce((acc, r) => acc + r.spends, 0);
                if (periodTotalSpend > 0) {
                    mappedData.forEach(r => {
                        r.spend_percent_share = (r.spends / periodTotalSpend) * 100;
                    });
                } else {
                    mappedData.forEach(r => {
                        r.spend_percent_share = 0;
                    });
                }

                return {
                    key,
                    data: mappedData
                };
            }));

            period_comparison = {};
            periodResults.forEach(({ key, data }) => { period_comparison[key] = data; });
        }

        return {
            success: true,
            data: parsedData,
            totals,
            untagged: { count: 0, percent: 0 },
            period_comparison
        };

    } catch (error) {
        console.error('[getPerformanceBreakdownData] Error:', error);
        throw error;
    }
};

const getProducts = async (filters = {}) => {
    try {
        const src = await getWatchtowerSource();
        const { platform, brand, category } = filters;
        const conditions = [`${src.f.product} IS NOT NULL`, `${src.f.product} != ''`, `toString(${src.f.compFlag}) = '0'`];

        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';
        const platArr = normalizeFilterArray(platform);
        const bndArr = normalizeFilterArray(brand);
        const catArr = normalizeFilterArray(category);

        if (platArr && platArr.length > 0) {
            conditions.push(`${src.f.platform} IN(${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
        }
        if (bndArr && bndArr.length > 0) {
            conditions.push(`${src.f.brand} IN(${bndArr.map(b => `'${escapeStr(b)}'`).join(', ')})`);
        }
        if (catArr && catArr.length > 0) {
            const catCol = src.f.category;
            conditions.push(`${catCol} IN(${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        const query = `SELECT DISTINCT ${src.f.product} as Product FROM ${src.table} WHERE ${conditions.join(' AND ')} ORDER BY Product`;
        const results = await queryClickHouse(query);
        return results.map(r => r.Product).filter(Boolean).sort();
    } catch (error) {
        console.error("[getProducts] Error:", error);
        return [];
    }
};

/**
 * Returns product identifiers for every client.
 */
/**
 * Dynamic Sub Brand list fetching. Checks if sub_brand column exists in rb_pdp_olap table.
 * If column does NOT exist in DB, returns empty array [].
 * If column exists, returns distinct sub_brand values.
 */
const getSubBrands = async (filters = {}) => {
    try {
        const pdpCols = await getTableColumns('rb_pdp_olap');
        const hasSubBrand = columnExists(pdpCols, 'sub_brand') || columnExists(pdpCols, 'subbrand');
        if (!hasSubBrand) {
            return [];
        }
        const actualSubCol = columnExists(pdpCols, 'sub_brand') ? resolveColumn(pdpCols, 'sub_brand') : resolveColumn(pdpCols, 'subbrand');
        
        const { platform, brand, category } = filters;
        const conditions = [
            `isNotNull(${actualSubCol})`,
            `toString(${actualSubCol}) != ''`,
            `toString(${actualSubCol}) != '0'`,
            `Comp_flag = 0`
        ];
        
        const _esc = (str) => str ? str.replace(/'/g, "''") : '';
        const platArr = normalizeFilterArray(platform);
        const bndArr = normalizeFilterArray(brand);
        const catArr = normalizeFilterArray(category);

        if (platArr && platArr.length > 0) {
            conditions.push(`Platform IN (${platArr.map(p => `'${_esc(p)}'`).join(', ')})`);
        }
        if (bndArr && bndArr.length > 0) {
            conditions.push(`Brand IN (${bndArr.map(b => `'${_esc(b)}'`).join(', ')})`);
        }
        if (catArr && catArr.length > 0) {
            conditions.push(`Category IN (${catArr.map(c => `'${_esc(c)}'`).join(', ')})`);
        }

        const query = `
            SELECT DISTINCT toString(${actualSubCol}) as sub_brand
            FROM rb_pdp_olap
            WHERE ${conditions.join(' AND ')}
            ORDER BY sub_brand
        `;
        const results = await queryClickHouse(query);
        return results.map(r => r.sub_brand).filter(Boolean);
    } catch (error) {
        console.error('[getSubBrands] Error:', error);
        return [];
    }
};

const getProductsWithSap = async (filters = {}) => {
    try {
        const src = await getWatchtowerSource();
        const { platform, brand, category, subBrand, sub_brand } = filters;
        const targetSubBrand = subBrand || sub_brand;
        const conditions = [
            `${src.f.product} IS NOT NULL`,
            `${src.f.product} != ''`,
            `toString(${src.f.compFlag}) = '0'`
        ];

        const _esc = (str) => str ? str.replace(/'/g, "''") : '';
        const platArr = normalizeFilterArray(platform);
        const bndArr = normalizeFilterArray(brand);
        const catArr = normalizeFilterArray(category);
        const subArr = normalizeFilterArray(targetSubBrand);

        if (platArr && platArr.length > 0) {
            conditions.push(`${src.f.platform} IN(${platArr.map(p => `'${_esc(p)}'`).join(', ')})`);
        }
        if (bndArr && bndArr.length > 0) {
            conditions.push(`${src.f.brand} IN(${bndArr.map(b => `'${_esc(b)}'`).join(', ')})`);
        }
        if (catArr && catArr.length > 0) {
            conditions.push(`${src.f.category} IN(${catArr.map(c => `'${_esc(c)}'`).join(', ')})`);
        }

        // Discover identifier columns safely so the same dropdown works for every client.
        const tableName = src.table || 'rb_pdp_olap';
        const cols = await getTableColumns(tableName);

        const hasSubBrandCol = columnExists(cols, 'sub_brand') || columnExists(cols, 'subbrand');
        if (subArr && subArr.length > 0 && hasSubBrandCol) {
            const actualSubCol = columnExists(cols, 'sub_brand') ? resolveColumn(cols, 'sub_brand') : resolveColumn(cols, 'subbrand');
            conditions.push(`lower(trim(BOTH '\t\n ' FROM toString(${actualSubCol}))) IN (${subArr.map(s => `'${_esc(s.toLowerCase())}'`).join(', ')})`);
        }
        const hasSap = columnExists(cols, 'sap_code');
        const sapExpr = hasSap ? resolveColumn(cols, 'sap_code') : "''";
        const webPidExpr = resolveColumn(cols, 'Web_Pid');

        const query = `
                        SELECT
                            ${src.f.product} AS product_name,
                            any(${sapExpr}) AS sap_code,
                            any(${webPidExpr}) AS web_pid
                        FROM ${src.table}
                        WHERE ${conditions.join(' AND ')}
                        GROUP BY product_name
                        ORDER BY product_name
                    `;
        const results = await queryClickHouse(query);
        return results
            .filter(r => r.product_name)
            .map(r => ({ name: r.product_name, sapCode: r.sap_code || null, webPid: r.web_pid || null }));
    } catch (error) {
        console.error('[getProductsWithSap] Error:', error);
        return [];
    }
};

const getProductCategories = async (filters = {}) => {
    try {
        const { platform } = filters;
        const channel = extractChannel(filters);
        const query = `
            SELECT DISTINCT Product_type as category
            FROM rb_pdp_olap
            WHERE Product_type IS NOT NULL AND Product_type != ''
            ${platform ? `AND Platform = '${escapeStr(platform)}'` : ''}
            ORDER BY category
                `;
        const results = await queryClickHouse(query);
        return results.map(r => r.category).filter(Boolean);
    } catch (error) {
        console.error('[getProductCategories] Error:', error);
        return [];
    }
};

const getWatchTowerCascadedFilters = async (filters) => {
    try {
        const { platform, category, brand, location, startDate, endDate } = filters;
        const channel = extractChannel(filters);

        const cols = await getTableColumns('rca_sku_dim');
        const hasChannel = columnExists(cols, 'channel');

        const channelCol = hasChannel ? resolveColumn(cols, 'channel') : null;
        const platformCol = resolveColumn(cols, 'platform');
        const categoryCol = resolveColumn(cols, 'category');
        const brandCol = cols.has('brand_name') ? resolveColumn(cols, 'brand_name') : resolveColumn(cols, 'brand');
        const locationCol = cols.has('location_name') ? resolveColumn(cols, 'location_name') : resolveColumn(cols, 'location');

        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // Helper to get conditions excluding a specific field
        const getConditions = (excludeField) => {
            const conds = [];

            // 1. Channel & Platform filters
            const targetPlatform = excludeField === 'platform' ? null : platform;
            const targetChannel = excludeField === 'channel' ? null : channel;
            const platChanCond = buildPlatformChannelCond(targetPlatform, targetChannel, platformCol, false, channelCol);
            if (platChanCond) {
                conds.push(platChanCond);
            }

            // 2. Category filter
            if (excludeField !== 'category' && category && category !== 'All') {
                const catArr = normalizeFilterArray(category);
                if (catArr.length > 0) {
                    conds.push(`lower(${categoryCol}) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(',')})`);
                }
            }

            // 3. Brand filter
            if (excludeField !== 'brand' && brand && brand !== 'All') {
                const brandArr = normalizeFilterArray(brand);
                if (brandArr.length > 0) {
                    conds.push(`lower(${brandCol}) IN (${brandArr.map(b => `'${escapeStr(b.toLowerCase())}'`).join(',')})`);
                }
            }

            // 4. Location filter
            if (excludeField !== 'location' && location && location !== 'All') {
                const locArr = normalizeFilterArray(location);
                if (locArr.length > 0) {
                    conds.push(`lower(${locationCol}) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(',')})`);
                }
            }

            // Always exclude competitors for these lists
            if (columnExists(cols, 'comp_flag')) {
                const compFlagCol = resolveColumn(cols, 'comp_flag');
                conds.push(`toString(${compFlagCol}) = '0'`);
            }

            return conds;
        };

        const runQuery = async (field, colName) => {
            if (!colName) return [];
            try {
                const conds = getConditions(field);
                conds.push(`${colName} IS NOT NULL`, `${colName} != ''`);
                if (field === 'category') {
                    conds.push(`${colName} != 'Others'`);
                }
                const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
                const query = `SELECT DISTINCT ${colName} AS val FROM rca_sku_dim ${whereClause} ORDER BY val`;
                const results = await queryClickHouse(query);
                return results.map(r => r.val).filter(Boolean);
            } catch (err) {
                console.error(`[getWatchTowerCascadedFilters] Error for field ${field}:`, err);
                return [];
            }
        };

        const runGrammageQuery = async () => {
            try {
                const src = await getPricingSource();
                const f = src.f;
                if (!src.hasWeight) return [];

                let whereConditions = [`p.${f.weight} IS NOT NULL`, `p.${f.weight} != ''`];

                const platforms = parseMultiSelectFilter(platform);
                if (platforms) whereConditions.push(buildInClause(`p.${f.platform}`, platforms));

                const locations = normalizeLocations(parseMultiSelectFilter(location));
                if (locations) whereConditions.push(buildInClause(`p.${f.location}`, locations));

                const brands = parseMultiSelectFilter(brand);
                if (brands) whereConditions.push(buildInClause(`p.${f.brand}`, brands));

                const categories = parseMultiSelectFilter(category);
                if (categories) {
                    const escaped = categories.map(v => `'${escapeStr(v.toLowerCase())}'`).join(',');
                    whereConditions.push(`lower(${src.p_prodCatSql}) IN (${escaped})`);
                }

                const channels = normalizeChannels(parseMultiSelectFilter(channel));
                if (channels) whereConditions.push(buildInClause(`p.${f.channel}`, channels));

                whereConditions.push(`p.${f.compFlag} = '0'`);

                if (startDate && endDate) {
                    whereConditions.push(`p.${f.date} BETWEEN '${startDate}' AND '${endDate}'`);
                }

                const whereClause = whereConditions.join(' AND ');
                const query = `SELECT DISTINCT p.${f.weight} AS val FROM ${src.table} p WHERE ${whereClause} ORDER BY val`;
                const results = await queryClickHouse(query);
                return results.map(r => r.val).filter(Boolean);
            } catch (err) {
                console.error(`[getWatchTowerCascadedFilters] Error for grammage:`, err);
                return [];
            }
        };

        const [channelsList, platformsList, categoriesList, brandsList, locationsList, grammagesList] = await Promise.all([
            runQuery('channel', channelCol),
            runQuery('platform', platformCol),
            runQuery('category', categoryCol),
            runQuery('brand', brandCol),
            runQuery('location', locationCol),
            runGrammageQuery()
        ]);

        return {
            channels: channelsList,
            platforms: platformsList,
            categories: categoriesList,
            brands: brandsList,
            locations: locationsList,
            grammages: grammagesList
        };
    } catch (error) {
        console.error("Error in getWatchTowerCascadedFilters:", error);
        return {
            channels: [],
            platforms: [],
            categories: [],
            brands: [],
            locations: [],
            grammages: []
        };
    }
};

const getMsls = async () => {
    try {
        // Resolve the actual column name dynamically (could be 'msl', 'MSL', etc.)
        const cols = await getTableColumns('rb_pdp_olap');
        const mslCol = resolveColumn(cols, 'msl');
        const query = `
            SELECT DISTINCT ${mslCol} AS msl_val
            FROM rb_pdp_olap 
            WHERE ${mslCol} IS NOT NULL 
            ORDER BY msl_val ASC
            LIMIT 20
        `;
        const results = await queryClickHouse(query);
        return results.map(r => r.msl_val).filter(val => val !== null && val !== undefined);
    } catch (error) {
        console.error('[getMsls] Error in watchTowerService:', error);
        return [];
    }
};

export { getMsls };
export default {
    getSummaryMetrics,
    getTrendData,
    getPlatformChannels,
    getPlatforms,
    getPmPlatforms,
    getPlatformMetadata,
    getBrands,
    getKeywords,
    getLocations,
    getBrandCategories,
    getOverview,
    getPerformanceMetrics,
    getPlatformOverview,
    getMonthOverview,
    getCategoryOverview,
    getBrandsOverview,
    getKpiTrends,
    getTrendsFilterOptions,
    getCompetitionData,
    getCompetitionFilterOptions,
    getCompetitionBrandTrends,
    getLatestAvailableMonth,
    getDarkStoreCount,
    getTopActions,
    getOsaDeepDive,
    getRcaData,
    getSkuOverview,
    getCityOverview,
    getPerformanceBreakdownData,
    getProducts,
    getProductsWithSap,
    getProductCategories,
    getChannels,
    getPdpPlatforms,
    getWatchTowerCascadedFilters,
    getMsls,
    getSubBrands
};


